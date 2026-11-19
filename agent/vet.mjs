// vet.mjs — deterministic on-chain vetting engine for BSC free-mint contracts.
// Read-only: every check is an eth_call / public HTTP GET. No transaction is
// ever built, signed or broadcast. No API keys. No paid endpoints.
//
// Pipeline per contract:
//   1. eth_getCode            — is there actually a contract here?
//   2. Sourcify v2           — is the source code verified? (200 = yes, 404 = no)
//   3. owner()               — does a single admin/owner still control it?
//   4. totalSupply/maxSupply — is there supply left at all?
//   5. balanceOf/hasClaimed  — has the probe wallet already used its slot?
//   6. free-lane probes      — static eth_call of common free-mint functions
//                              with value 0. A non-reverting call means the
//                              free path is at least callable without payment.
//
// Scoring is a PURE function of the check list (scoreChecks), so it is
// unit-testable without any network access and fully deterministic.

import { ethers } from "ethers";
import { PROBE_WALLET } from "./candidates.mjs";

// Public BSC JSON-RPC endpoints, tried in order (fastest measured first;
// PublicNode was observed at 7s+ and rate-limited, so it sits last).
// The first healthy one wins the race; the rest are failover only.
export const RPC_URLS = [
  "https://rpc.48.club",
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc-dataseed2.binance.org",
  "https://bsc-rpc.publicnode.com",
  "https://bsc.publicnode.com",
];

const SOURCIFY_V2 = "https://sourcify.dev/server/v2/contract/56";

// --- function selectors ----------------------------------------------------
const SEL = {
  totalSupply: "0x18160ddd",
  maxSupply: "0xd5abeb01",
  owner: "0x8da5cb5b",
  balanceOf: "0x70a08231",
};

// hasClaimed(address) selector computed at runtime — no magic constant.
const HAS_CLAIMED_SEL = ethers.id("hasClaimed(address)").slice(0, 10);

// Free-mint entry points seen across Agent-ID projects. Each is probed with a
// static eth_call, value 0, from the probe wallet. Order matters only for the
// human-readable "which lane answered" detail.
const FREE_LANE_PROBES = [
  { name: "mint(uint256)", data: new ethers.Interface(["function mint(uint256)"]).encodeFunctionData("mint", [1]) },
  { name: "mint()", data: new ethers.Interface(["function mint()"]).encodeFunctionData("mint", []) },
  { name: "openFree()", data: new ethers.Interface(["function openFree()"]).encodeFunctionData("openFree", []) },
  { name: "mintFree()", data: new ethers.Interface(["function mintFree()"]).encodeFunctionData("mintFree", []) },
  { name: "freeMint()", data: new ethers.Interface(["function freeMint()"]).encodeFunctionData("freeMint", []) },
  { name: "claim()", data: new ethers.Interface(["function claim()"]).encodeFunctionData("claim", []) },
  { name: "claimFree()", data: new ethers.Interface(["function claimFree()"]).encodeFunctionData("claimFree", []) },
];

// --- scoring (pure, deterministic) ----------------------------------------
// Penalty table: every non-pass check deducts a fixed amount from 100.
// Verdict bands: >=70 SAFE, 40–69 RISKY, <40 TRAP. A contract with no code
// is INVALID; a run where the chain itself could not be read is UNKNOWN.
export const PENALTIES = {
  sourceUnverified: 25,
  sourceUnknown: 10,
  hasOwner: 20,
  ownerUnknown: 5,
  freeLaneClosed: 30,
  soldOut: 40,
  supplyUnknown: 10,
  slotUsed: 15,
};

export function scoreChecks(checks) {
  let score = 100;
  const byId = Object.fromEntries(checks.map((c) => [c.id, c.status]));
  if (byId.source === "fail") score -= PENALTIES.sourceUnverified;
  if (byId.source === "unknown") score -= PENALTIES.sourceUnknown;
  if (byId.owner === "fail") score -= PENALTIES.hasOwner;
  if (byId.owner === "unknown") score -= PENALTIES.ownerUnknown;
  if (byId.freeLane === "fail") score -= PENALTIES.freeLaneClosed;
  if (byId.supply === "fail") score -= PENALTIES.soldOut;
  if (byId.supply === "unknown") score -= PENALTIES.supplyUnknown;
  if (byId.slot === "fail") score -= PENALTIES.slotUsed;
  return Math.max(0, Math.min(100, score));
}

export function verdictFor(score) {
  if (score === null || score === undefined) return "UNKNOWN";
  if (score >= 70) return "SAFE";
  if (score >= 40) return "RISKY";
  return "TRAP";
}

// Run async tasks with bounded concurrency + one retry. Public BSC RPCs
// rate-limit bursts: 13 simultaneous eth_calls returned timeouts, while
// the same calls succeed at concurrency 3.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch (err) {
        try {
          out[i] = await fn(items[i]); // one retry for transient RPC errors
        } catch (err2) {
          out[i] = { ok: false, error: String(err2?.shortMessage ?? err2?.message ?? err2) };
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
// --- RPC helpers -----------------------------------------------------------
// One JsonRpcProvider per public endpoint. Strategy: race all endpoints once
// for the fastest healthy node, use it for the whole process, and rotate to
// the next endpoint only when a call actually fails. (Trying every endpoint
// per call made a slow node cost 5× timeout per read; racing once is what
// keeps a 5-candidate patrol under ~90s on flaky public RPCs.)
let providers = null;
let providerIdx = 0;

function getProviders() {
  if (!providers) {
    providers = RPC_URLS.map((url) => {
      const req = new ethers.FetchRequest(url);
      req.timeout = 8000;
      // staticNetwork skips ethers' auto network detection (eth_chainId
      // retries every 1s on flaky public nodes and floods the log).
      return new ethers.JsonRpcProvider(req, 56, { staticNetwork: true });
    });
  }
  return providers;
}

async function callWithFailover(fn) {
  const list = getProviders();
  // Start at the fastest measured endpoint (list order); rotate to the next
  // endpoint only on a real transport failure. No upfront health race — it
  // fired 7 simultaneous requests and cost more than it saved.
  for (let attempt = 0; attempt < list.length; attempt++) {
    const idx = (providerIdx + attempt) % list.length;
    try {
      const value = await fn(list[idx]);
      providerIdx = idx;
      return { ok: true, value };
    } catch (err) {
      if (!isTransportError(err) || attempt === list.length - 1) {
        return { ok: false, error: String(err?.shortMessage ?? err?.message ?? err) };
      }
      // otherwise rotate to the next endpoint and retry
    }
  }
  return { ok: false, error: "all RPC endpoints failed" };
}

async function tryCall(to, data) {
  const r = await callWithFailover((p) => p.call({ to, data, from: PROBE_WALLET, value: 0 }));
  return r.ok ? { ok: true, data: r.value } : { ok: false, error: r.error };
}

async function tryGetCode(address) {
  return callWithFailover((p) => p.getCode(address));
}

function decodeUint(hex) {
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

async function checkSourceVerified(address) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SOURCIFY_V2}/${address}`, { signal: controller.signal });
    if (res.status === 200) return "pass";
    if (res.status === 404) return "fail";
    return "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

// --- main vetting ----------------------------------------------------------
/**
 * Vet one contract address live on BSC.
 * @returns {object} { address, name?, checkedAt, rpcOk, score, verdict,
 *   checks: [{id,label,status,detail}], supply: {total,max,remaining}|null }
 */
export async function vetMint(address, { name = null, wallet = PROBE_WALLET } = {}) {
  const checkedAt = new Date().toISOString();
  const checks = [];
  const result = {
    address: ethers.getAddress(address),
    name,
    checkedAt,
    rpcOk: false,
    score: null,
    verdict: "UNKNOWN",
    checks,
    supply: null,
    freeLane: null,
  };

  // 1. Contract code present? (tries every RPC endpoint in turn)
  const t0 = Date.now();
  const lap = (m) => { if (process.env.VET_DEBUG) console.error(`[vet ${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`); };
  const codeRes = await tryGetCode(result.address);
  lap(`getCode done ok=${codeRes.ok}`);
  if (!codeRes.ok) {
    checks.push({ id: "rpc", label: "BSC RPC reachable", status: "fail", detail: `All BSC RPC endpoints failed: ${codeRes.error.slice(0, 160)}` });
    // The chain could not be read — do NOT call this INVALID. Unknown is honest.
    result.verdict = "UNKNOWN";
    result.score = null;
    return result;
  }
  result.rpcOk = true;
  const code = codeRes.value;
  if (code === "0x" || code === "0x0") {
    checks.push({ id: "code", label: "Contract code present", status: "fail", detail: "No code at address — not a contract (or wrong chain)." });
    result.verdict = "INVALID";
    result.score = 0;
    return result;
  }
  checks.push({ id: "code", label: "Contract code present", status: "pass", detail: `${code.length / 2 - 1} bytes of runtime code` });

  // 2–6. Independent checks run CONCURRENTLY with bounded concurrency (3)
  // — public RPCs rate-limit bursts; sequential calls made one candidate
  // cost ~40s. Each probe resolves to its own check object; scoring stays
  // pure and deterministic.
  const balData = new ethers.Interface(["function balanceOf(address)"]).encodeFunctionData("balanceOf", [wallet]);
  const claimedData = new ethers.Interface(["function hasClaimed(address)"]).encodeFunctionData("hasClaimed", [wallet]);

  const sourceStatus = await checkSourceVerified(result.address);
  lap(`sourcify done ${sourceStatus}`);
  const [ownerCall, totalCall, maxCall, balCall, claimedCall, ...laneResults] = await mapLimit(
    [
      () => tryCall(result.address, SEL.owner),
      () => tryCall(result.address, SEL.totalSupply),
      () => tryCall(result.address, SEL.maxSupply),
      () => tryCall(result.address, balData),
      () => tryCall(result.address, claimedData),
      ...FREE_LANE_PROBES.map((probe) => () =>
        tryCall(result.address, probe.data).then((r) => ({ name: probe.name, ...r }))),
    ],
    3,
    (fn) => fn(),
  );
  lap(`probes done`);

  // 2. Source verified (Sourcify v2, no key)
  checks.push({
    id: "source",
    label: "Source code verified",
    status: sourceStatus,
    detail:
      sourceStatus === "pass"
        ? "Verified on Sourcify — bytecode matches published source"
        : sourceStatus === "fail"
          ? "NOT verified — bytecode cannot be audited from source"
          : "Verification check failed (Sourcify unreachable)",
  });

  // 3. Owner / admin still in control?
  if (ownerCall.ok) {
    const owner = ethers.getAddress("0x" + ownerCall.data.slice(-40));
    const renounced = owner === ethers.ZeroAddress;
    checks.push({
      id: "owner",
      label: "No single owner/admin",
      status: renounced ? "pass" : "fail",
      detail: renounced ? "owner() returns 0x0 — ownership renounced" : `owner() = ${owner} — one address can still admin the contract`,
    });
  } else {
    checks.push({ id: "owner", label: "No single owner/admin", status: "unknown", detail: "owner() not present or call failed — cannot confirm admin rights" });
  }

  // 4. Supply: totalSupply / maxSupply
  const total = totalCall.ok ? decodeUint(totalCall.data) : null;
  const max = maxCall.ok ? decodeUint(maxCall.data) : null;
  if (total !== null && max !== null) {
    result.supply = { total: total.toString(), max: max.toString(), remaining: (max - total).toString() };
    const remaining = max - total;
    checks.push({
      id: "supply",
      label: "Supply remaining",
      status: remaining > 0n ? "pass" : "fail",
      detail: remaining > 0n ? `${remaining} of ${max} left (${total} minted)` : `SOLD OUT — ${total}/${max} minted`,
    });
  } else if (total !== null) {
    result.supply = { total: total.toString(), max: null, remaining: null };
    checks.push({ id: "supply", label: "Supply remaining", status: "unknown", detail: `totalSupply ${total}, but maxSupply() not exposed — cannot confirm remaining supply` });
  } else {
    checks.push({ id: "supply", label: "Supply remaining", status: "unknown", detail: "totalSupply() not exposed — supply cannot be read" });
  }

  // 5. Probe wallet slot: balanceOf / hasClaimed
  const balance = balCall.ok ? decodeUint(balCall.data) : null;
  const claimed = claimedCall.ok ? decodeUint(claimedCall.data) !== 0n : null;
  if (balance !== null || claimed !== null) {
    const used = (balance !== null && balance > 0n) || claimed === true;
    checks.push({
      id: "slot",
      label: "Probe wallet slot unused",
      status: used ? "fail" : "pass",
      detail:
        used
          ? `Probe wallet already holds/claimed (balance ${balance ?? "?"}, hasClaimed ${claimed}) — 1/wallet slot likely used`
          : `Probe wallet holds ${balance ?? "?"} and hasClaimed=${claimed ?? "?"} — slot looks unused`,
    });
  } else {
    checks.push({ id: "slot", label: "Probe wallet slot unused", status: "unknown", detail: "Neither balanceOf() nor hasClaimed() answered — slot state unknown" });
  }

  // 6. Free-lane probes: static calls, value 0.
  const answered = laneResults.filter((r) => r.ok).map((r) => r.name);
  const firstError = laneResults.find((r) => !r.ok)?.error ?? null;
  result.freeLane = answered.length > 0 ? answered : null;
  checks.push({
    id: "freeLane",
    label: "Free lane callable with 0 value",
    status: answered.length > 0 ? "pass" : "fail",
    detail:
      answered.length > 0
        ? `Static call succeeded (value 0): ${answered.join(", ")}`
        : `No free-mint entry point answered a 0-value static call${firstError ? ` (e.g. ${firstError.slice(0, 120)})` : ""} — lane closed, paid-only, or gated`,
  });

  result.score = scoreChecks(checks);
  result.verdict = verdictFor(result.score);
  return result;
}

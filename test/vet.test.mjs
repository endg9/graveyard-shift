// Property-based tests for the vetting engine — handwritten, zero dependencies.
// Strategy: generate random check-lists (the full input space of scoreChecks)
// and assert the invariants that must hold for EVERY input, not just examples.
// Network is never touched here; vetMint itself is covered by the MCP smoke
// test and the live server check in BUILD-LOG.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { scoreChecks, verdictFor, PENALTIES } from "../agent/vet.mjs";

const IDS = ["source", "owner", "freeLane", "supply", "slot", "code", "rpc"];
const STATUSES = ["pass", "warn", "fail", "unknown"];

// Deterministic PRNG (mulberry32) so the "random" suite is reproducible.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomChecks(rand) {
  return IDS.map((id) => ({
    id,
    label: id,
    status: STATUSES[Math.floor(rand() * STATUSES.length)],
    detail: "",
  }));
}

const N = 2000; // property-test sample size

test("property: score is always within [0, 100]", () => {
  const rand = rng(0xC0FFEE);
  for (let i = 0; i < N; i++) {
    const s = scoreChecks(randomChecks(rand));
    assert.ok(Number.isInteger(s), `score ${s} not an integer`);
    assert.ok(s >= 0 && s <= 100, `score ${s} out of range`);
  }
});

test("property: scoring is deterministic (same checks -> same score)", () => {
  const rand = rng(42);
  for (let i = 0; i < N; i++) {
    const checks = randomChecks(rand);
    assert.equal(scoreChecks(checks), scoreChecks(structuredClone(checks)));
  }
});

test("property: worsening any check never raises the score (monotonicity)", () => {
  const rand = rng(1337);
  for (let i = 0; i < N; i++) {
    const checks = randomChecks(rand);
    const base = scoreChecks(checks);
    for (let j = 0; j < checks.length; j++) {
      if (checks[j].status === "pass") {
        const worse = structuredClone(checks);
        worse[j].status = "fail";
        assert.ok(scoreChecks(worse) <= base, `flipping ${checks[j].id} pass->fail raised score ${base} -> ${scoreChecks(worse)}`);
      }
    }
  }
});

test("property: verdict bands match the score", () => {
  const rand = rng(7);
  for (let i = 0; i < N; i++) {
    const s = scoreChecks(randomChecks(rand));
    const v = verdictFor(s);
    if (s >= 70) assert.equal(v, "SAFE");
    else if (s >= 40) assert.equal(v, "RISKY");
    else assert.equal(v, "TRAP");
  }
  assert.equal(verdictFor(null), "UNKNOWN");
  assert.equal(verdictFor(undefined), "UNKNOWN");
  assert.equal(verdictFor(70), "SAFE");
  assert.equal(verdictFor(69), "RISKY");
  assert.equal(verdictFor(40), "RISKY");
  assert.equal(verdictFor(39), "TRAP");
});

test("property: every penalty is bounded — one bad check can never zero the score alone unless it is the sold-out penalty stack", () => {
  // Each single failing check deducts at most its tabled penalty; the worst
  // single penalty (sold out, 40) still leaves a passing-possible score.
  for (const [id, penalty] of Object.entries({
    source: PENALTIES.sourceUnverified,
    owner: PENALTIES.hasOwner,
    freeLane: PENALTIES.freeLaneClosed,
    supply: PENALTIES.soldOut,
    slot: PENALTIES.slotUsed,
  })) {
    const checks = IDS.map((x) => ({ id: x, label: x, status: "pass", detail: "" }));
    checks.find((c) => c.id === id).status = "fail";
    assert.equal(scoreChecks(checks), 100 - penalty, `single ${id} failure`);
  }
});

test("examples: all-pass is 100/SAFE; all-fail is TRAP", () => {
  const allPass = IDS.map((id) => ({ id, label: id, status: "pass", detail: "" }));
  assert.equal(scoreChecks(allPass), 100);
  assert.equal(verdictFor(scoreChecks(allPass)), "SAFE");

  const allFail = IDS.map((id) => ({ id, label: id, status: "fail", detail: "" }));
  const s = scoreChecks(allFail);
  assert.ok(s < 40, `all-fail score ${s} should be TRAP territory`);
  assert.equal(verdictFor(s), "TRAP");
});

test("examples: unverified + owned + closed lane is at most RISKY", () => {
  const checks = IDS.map((id) => ({ id, label: id, status: "pass", detail: "" }));
  for (const id of ["source", "owner", "freeLane"]) checks.find((c) => c.id === id).status = "fail";
  const s = scoreChecks(checks);
  assert.equal(s, 100 - 25 - 20 - 30);
  assert.equal(verdictFor(s), "TRAP");
});

// --- MCP server smoke test (stdio, no network for tools/list) --------------
async function mcpCall(messages, wantId, timeoutMs = 15000) {
  const child = spawn(process.execPath, ["agent/mcp-server.mjs"], { cwd: new URL("..", import.meta.url).pathname });
  try {
    return await new Promise((resolve, reject) => {
      let buf = "";
      const timer = setTimeout(() => reject(new Error("mcp timeout")), timeoutMs);
      child.stdout.on("data", (d) => {
        buf += d;
        for (const line of buf.trim().split("\n")) {
          try {
            const msg = JSON.parse(line);
            if (msg.id === wantId) { clearTimeout(timer); resolve(msg); return; }
          } catch { /* partial line */ }
        }
      });
      child.on("error", (e) => { clearTimeout(timer); reject(e); });
      for (const m of messages) child.stdin.write(JSON.stringify(m) + "\n");
    });
  } finally {
    child.kill("SIGKILL");
  }
}

test("mcp: tools/list exposes vet_mint and list_candidates", async () => {
  const list = await mcpCall([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  ], 2);
  const names = list.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["list_candidates", "vet_mint"]);
});

test("mcp: list_candidates returns the seed addresses", async () => {
  const msg = await mcpCall([
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_candidates", arguments: {} } },
  ], 1);
  const cands = msg.result.structuredContent.candidates;
  assert.ok(cands.length >= 5, `expected >=5 seed candidates, got ${cands.length}`);
  for (const c of cands) assert.match(c.address, /^0x[0-9a-fA-F]{40}$/);
});

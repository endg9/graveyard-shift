// api/candidates.mjs — Vercel serverless: vet all seed candidates live.
// Same engine as the local server (agent/vet.mjs). Module-level cache keeps
// a 5-minute window across warm invocations; candidates are vetted 2 at a
// time so a cold start stays inside the function timeout.
import { vetMint } from "../agent/vet.mjs";
import { CANDIDATES } from "../agent/candidates.mjs";

const CACHE_MS = 5 * 60 * 1000;
let cache = { at: 0, results: null };

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  const now = Date.now();
  if (cache.results && now - cache.at < CACHE_MS) {
    return res.status(200).json({ candidates: cache.results, cachedAt: new Date(cache.at).toISOString() });
  }
  const results = await mapLimit(CANDIDATES, 2, async (c) => {
    try {
      return await vetMint(c.address, { name: c.name });
    } catch (err) {
      return {
        address: c.address,
        name: c.name,
        checkedAt: new Date().toISOString(),
        rpcOk: false,
        score: null,
        verdict: "UNKNOWN",
        checks: [{ id: "rpc", label: "Vetting failed", status: "fail", detail: String(err?.message ?? err) }],
        supply: null,
        freeLane: null,
      };
    }
  });
  cache = { at: now, results };
  return res.status(200).json({ candidates: results, cachedAt: new Date(now).toISOString() });
}

// watch.mjs — the sentinel's patrol loop. Vets every seed candidate once per
// run and appends one JSON line per candidate to data/audit.jsonl.
// Run once:  node agent/watch.mjs
// The HTTP server re-runs this in-process every 5 minutes (see server.mjs).
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vetMint } from "./vet.mjs";
import { CANDIDATES } from "./candidates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const AUDIT_PATH = join(ROOT, "data", "audit.jsonl");

export async function runWatch(candidates = CANDIDATES) {
  await mkdir(dirname(AUDIT_PATH), { recursive: true });
  const results = [];
  for (const c of candidates) {
    const r = await vetMint(c.address, { name: c.name });
    const line = {
      ts: r.checkedAt,
      address: r.address,
      name: r.name,
      verdict: r.verdict,
      score: r.score,
      rpcOk: r.rpcOk,
      supply: r.supply,
      freeLane: r.freeLane,
      checks: r.checks.map(({ id, status, detail }) => ({ id, status, detail })),
    };
    await appendFile(AUDIT_PATH, JSON.stringify(line) + "\n", "utf8");
    results.push(line);
    console.log(`[watch] ${c.name} ${r.address.slice(0, 10)}… verdict=${r.verdict} score=${r.score}`);
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runWatch().catch((err) => {
    console.error("[watch] failed:", err);
    process.exit(1);
  });
}

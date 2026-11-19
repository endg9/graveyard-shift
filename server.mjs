// server.mjs — Graveyard Shift dashboard server.
// Node built-in `http` only: serves the static dashboard from public/ and a
// small JSON API. No framework, no templating — the frontend renders purely
// from live API data (never from hardcoded numbers).
//
//   GET  /                     dashboard
//   GET  /api/candidates       vet all seed candidates (5-min cache)
//   GET  /api/verdict/:addr    vet one contract address live
//   GET  /api/audit?limit=50   last N audit-log lines
//   GET  /api/health           { ok, rpcOk, candidates, lastRun }
//
// A background patrol re-vets every candidate every 5 minutes and appends
// to data/audit.jsonl (see agent/watch.mjs).

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { vetMint } from "./agent/vet.mjs";
import { CANDIDATES } from "./agent/candidates.mjs";
import { runWatch, AUDIT_PATH } from "./agent/watch.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ROOT, "public");
const PORT = Number(process.env.PORT ?? 3000);
const CACHE_MS = 5 * 60 * 1000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

let cache = { at: 0, results: null, error: null };
let lastWatchAt = null;
let lastWatchError = null;

async function vetAll() {
  const now = Date.now();
  if (cache.results && now - cache.at < CACHE_MS) return cache.results;
  const results = [];
  for (const c of CANDIDATES) {
    try {
      results.push(await vetMint(c.address, { name: c.name }));
    } catch (err) {
      results.push({
        address: c.address,
        name: c.name,
        checkedAt: new Date().toISOString(),
        rpcOk: false,
        score: null,
        verdict: "UNKNOWN",
        checks: [{ id: "rpc", label: "Vetting failed", status: "fail", detail: String(err?.message ?? err) }],
        supply: null,
        freeLane: null,
      });
    }
  }
  cache = { at: now, results, error: null };
  return results;
}

async function readAudit(limit = 50) {
  try {
    const raw = await readFile(AUDIT_PATH, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean).slice(-limit);
    return lines.map((l) => JSON.parse(l)).reverse();
  } catch {
    return [];
  }
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  try {
    if (path === "/api/candidates") {
      return json(res, 200, { candidates: await vetAll(), cachedAt: new Date(cache.at).toISOString() });
    }
    if (path.startsWith("/api/verdict/")) {
      const addr = decodeURIComponent(path.slice("/api/verdict/".length));
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
        return json(res, 400, { error: "invalid address — expected 0x + 40 hex chars" });
      }
      return json(res, 200, await vetMint(addr));
    }
    if (path === "/api/audit") {
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
      return json(res, 200, { entries: await readAudit(limit) });
    }
    if (path === "/api/health") {
      return json(res, 200, {
        ok: true,
        service: "graveyard-shift",
        candidates: CANDIDATES.length,
        lastWatchAt,
        lastWatchError,
        cacheAgeMs: cache.results ? Date.now() - cache.at : null,
      });
    }

    // Static files (dashboard). Only files under public/ are served.
    const file = path === "/" ? "index.html" : path.slice(1);
    const safe = join(PUBLIC, file);
    if (!safe.startsWith(PUBLIC)) return json(res, 403, { error: "forbidden" });
    await stat(safe);
    const body = await readFile(safe);
    res.writeHead(200, { "content-type": MIME[extname(safe)] ?? "application/octet-stream", "content-length": body.length });
    res.end(body);
  } catch (err) {
    if (err?.code === "ENOENT") return json(res, 404, { error: "not found" });
    console.error("[server]", err);
    return json(res, 500, { error: "internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`[server] Graveyard Shift listening on http://localhost:${PORT}`);
  console.log(`[server] dashboard: http://localhost:${PORT}/  ·  api: /api/candidates`);
});

// Patrol: vet everything on boot (async, non-blocking) and every 5 minutes.
async function patrol() {
  try {
    await runWatch();
    lastWatchAt = new Date().toISOString();
    lastWatchError = null;
    cache = { at: 0, results: null, error: null }; // force fresh API data
  } catch (err) {
    lastWatchError = String(err?.message ?? err);
    console.error("[patrol]", lastWatchError);
  }
}
patrol();
setInterval(patrol, 5 * 60 * 1000);

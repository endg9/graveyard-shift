# Tasks — Graveyard Shift (mint-sentinel)

Spec-driven build checklist. Checked = done and verified.

## 1. Project scaffolding

- [x] `package.json` (ESM, `ethers` only, scripts: `start` / `test` / `watch` / `mcp`)
- [x] `LICENSE` (MIT), `.env.example`, `.gitignore` (keeps `.kiro/` tracked, excludes `node_modules/` and the live audit log)
- [x] `README.md` with <5-minute quickstart + "How Kiro was used"

## 2. Vetting engine (`agent/vet.mjs`)

- [x] BSC RPC failover list (7 public endpoints, fastest-first)
- [x] `staticNetwork: true` providers (kills ethers network-detection retry spam)
- [x] Revert-vs-transport error split (reverts return immediately; only transport errors rotate endpoints)
- [x] Bounded-concurrency probes (3) — public RPCs rate-limit bursts
- [x] Checks: code, Sourcify v2 source, `owner()`, `totalSupply`/`maxSupply`, `balanceOf`/`hasClaimed`, 7 free-lane static-call probes
- [x] Pure deterministic scoring (`scoreChecks`, `verdictFor`) + penalty table
- [x] Honest unknowns: `INVALID` for no code, `UNKNOWN` + null score for unreachable chain
- [x] Live verification: all 5 seed candidates vetted, patrol in ~14s

## 3. Candidates + patrol

- [x] `agent/candidates.mjs` — 5 real public Agent-ID mint contracts
- [x] `agent/watch.mjs` — patrol loop, appends JSONL to `data/audit.jsonl`

## 4. MCP server

- [x] `agent/mcp-server.mjs` — stdio JSON-RPC 2.0, tools `vet_mint` + `list_candidates`, no SDK
- [x] `.kiro/settings/mcp.json` registers the local server
- [x] Smoke test: `tools/list` + `list_candidates` over stdio

## 5. HTTP server + dashboard

- [x] `server.mjs` — Node built-in `http`, static `public/` + `/api/candidates`, `/api/verdict/:address`, `/api/audit`, `/api/health`
- [x] 5-minute API cache + patrol timer (boot + every 5 min)
- [x] `public/index.html` / `styles.css` / `app.js` — graveyard theme, tombstone cards, vet-any-address form, audit table, 60s auto-refresh
- [x] Verified live: dashboard serves, all endpoints return real on-chain data

## 6. Tests

- [x] `test/vet.test.mjs` — handwritten property-based tests (`node:test`, zero-dep): score range, determinism, monotonicity, verdict bands, penalty bounds; plus MCP stdio smoke tests
- [x] `npm test`: 9/9 passing

## 7. Kiro artifacts

- [x] `.kiro/specs/mint-sentinel/{requirements,design,tasks}.md`
- [x] `.kiro/steering/{product,tech,structure}.md`
- [x] `.kiro/hooks/on-agent-change.json` (auto-run tests on `agent/` changes)
- [x] `.kiro/settings/mcp.json`
- [x] Kiro CLI install attempted (see BUILD-LOG.md — installed, login needs an account; not created per task rules)

## 8. Demo + docs

- [x] `DEMO-SCRIPT.md` — <3-minute demo video script, scene by scene
- [x] `BUILD-LOG.md` — what was built, verification results, open items

## Future (not for this submission)

- [ ] ERC-1155 supply probe (`totalSupply(uint256)` per token id)
- [ ] Agent-ID proof-aware free-lane check (needs a real Agent ID signature flow)
- [ ] Candidate discovery (watch new Agent-ID mints instead of a static seed list)
- [ ] Persistent verdict history chart on the dashboard

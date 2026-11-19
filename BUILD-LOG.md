# BUILD-LOG — Graveyard Shift (Kiroween 2026)

Built 2026-11-19 (WIB) in `~/workspace/hackathons/kiroween-2026/`.
Status: **complete, verified live**. No submission, no account, no payment
made (per task rules — push + Devpost are the parent's steps).

## What was built

**"Graveyard Shift — autonomous free-mint sentinel"** (Frankenstein):
a read-only agent that vets BSC Agent-ID free-mint contracts live on-chain
and scores them before anyone spends gas. Dashboard = Halloween graveyard,
one tombstone per candidate.

### Key files

| File | What it is |
|---|---|
| `server.mjs` | Node built-in `http` server: static dashboard + `/api/candidates`, `/api/verdict/:address`, `/api/audit`, `/api/health`; 5-min cache; patrol timer |
| `agent/vet.mjs` | Vetting engine: RPC failover, 6 check groups, pure deterministic scoring |
| `agent/candidates.mjs` | 5 real public seed contracts (Rulz Share, Agent Mint Pass, MOSSMINDS, RONAGENT, ONLYAI) |
| `agent/watch.mjs` | Patrol loop → `data/audit.jsonl` (JSONL, one line per candidate per run) |
| `agent/mcp-server.mjs` | MCP server (stdio JSON-RPC 2.0, no SDK): tools `vet_mint`, `list_candidates` |
| `public/index.html` + `styles.css` + `app.js` | Vanilla dashboard: tombstones, vet-any-address, audit table, 60s refresh |
| `test/vet.test.mjs` | Handwritten property tests (`node:test`, zero-dep) + MCP smoke tests |
| `.kiro/specs/mint-sentinel/` | `requirements.md`, `design.md`, `tasks.md` |
| `.kiro/steering/` | `product.md`, `tech.md`, `structure.md` |
| `.kiro/hooks/on-agent-change.json` | Auto-run `npm test` on `agent/` changes |
| `.kiro/settings/mcp.json` | Registers the local MCP server |
| `README.md`, `DEMO-SCRIPT.md` | Quickstart + <3-min demo video script |
| `LICENSE` (MIT), `.env.example`, `.gitignore` | `.kiro/` intentionally NOT ignored |

Single dependency: `ethers` v6. Everything else is Node built-ins.

## Verification results (all live, 19 Nov 2026)

1. **`npm install`** — clean, 9 packages added.
2. **`npm test`** — **9/9 passing** (property tests: score range,
   determinism, monotonicity, verdict bands, penalty bounds; MCP stdio
   smoke tests).
3. **`npm run watch`** — full patrol of 5 candidates in **~14s**:
   Rulz Share RISKY 55, Agent Mint Pass RISKY 55, MOSSMINDS RISKY 50
   (supply 1,427/4,000, owner live, lane reverts "exact value"),
   RONAGENT RISKY 40 (supply 1,112), ONLYAI RISKY 40 (supply 3,375).
   Supply numbers moved between runs (1,426 → 1,427), proving live data.
4. **`npm start`** — server up at `http://localhost:3000` (still running);
   `/api/health` OK, `/api/candidates` returns live verdicts, dashboard
   serves, `/api/audit` returns patrol entries, `/api/verdict/:address`
   vets arbitrary contracts live.
5. **MCP smoke test** — `tools/list` exposes both tools; live
   `vet_mint` over stdio returned MOSSMINDS RISKY 50 in ~5s.

## Performance debugging (worth recording)

- First patrol: ~40s/candidate sequential → parallelized to ~14s for all 5.
- Then a regression: 13 parallel calls tripped public-RPC rate limits
  (timeouts) → bounded concurrency 3.
- Then a worse regression: per-call failover retried **reverted** calls on
  all 7 endpoints (a revert is a final answer, not a transport failure) →
  75s/candidate. Fix: revert-vs-transport split + `staticNetwork: true`
  (kills ethers' 1s network-detection retry spam) + fastest-first endpoint
  order (PublicNode measured 7s+ and rate-limited → moved last).
- Final: ~5s/candidate, ~14s patrol.

## Kiro CLI — attempted, blocked on login (honest note)

- Installed from `https://cli.kiro.dev/install`: **kiro-cli 3.5.0**,
  verified via `kiro-cli --version`.
- `kiro-cli whoami` → "Not logged in". Using the CLI agent requires
  signing in with GitHub / Google / AWS Builder ID — i.e. creating or
  using an account. Per task rules (no account registration), no account
  was created, so the CLI could not execute a build step.
- The project instead follows the Kiro **spec-driven methodology** with a
  complete, compatible `.kiro/` artifact set (specs, steering, hooks,
  MCP settings), ready for Kiro IDE/CLI the moment a signed-in user opens
  the folder. This is stated honestly in the README's "How Kiro was used".

## What is NOT done (parent / joko steps)

- GitHub repo creation + push (repo is local only).
- Devpost submission, demo video recording (script ready in
  `DEMO-SCRIPT.md`), deployed URL for judges.
- Kiro CLI sign-in (needs joko's account choice).
- Future improvements listed in `.kiro/specs/mint-sentinel/tasks.md`:
  ERC-1155 supply probe, Agent-ID proof-aware lane check, candidate
  discovery, verdict history chart.

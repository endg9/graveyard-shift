# 🪦 Graveyard Shift — Autonomous Free-Mint Sentinel

**Kiroween 2026 · Frankenstein category**

Thousands of Binance Agent ID holders hunt "free" mints on BSC — but many
"free" mints are traps: a live owner who can still gate the sale, a hidden
fee, a fake free lane, or a supply that is already gone. Checking each
contract by hand wastes time and gas.

Graveyard Shift is a read-only sentinel that vets mint contracts **live
on-chain** and gives a verdict + score + full audit trail *before* you spend
gas. Each candidate is a tombstone in a Halloween graveyard. The sentinel
never sends a transaction — it cannot spend your money, by construction.

## Quickstart (< 5 minutes)

```bash
npm install
npm start
# open http://localhost:3000
```

No accounts, no API keys, no wallet connection. Public BSC RPCs + Sourcify
only.

## How it judges a mint

| Check | What it proves | Penalty |
|---|---|---|
| Contract code present | There is actually a contract here | no code → INVALID |
| Source verified (Sourcify v2) | Bytecode matches published source | −25 if not |
| No single owner/admin | `owner()` is renounced / absent | −20 if live owner |
| Supply remaining | `totalSupply` vs `maxSupply` | −40 if sold out |
| Probe-wallet slot unused | `balanceOf` / `hasClaimed` for a synthetic probe wallet | −15 if used |
| Free lane callable | Static `eth_call` (value 0) to `mint()` / `openFree()` / `claim()` … must not revert | −30 if none answers |

**Verdict:** ≥ 70 SAFE · 40–69 RISKY · < 40 TRAP · no code INVALID ·
chain unreachable UNKNOWN (null score, never invented).

Scoring is a **pure function** of the check list — same on-chain state,
same score, every time. Anything the chain cannot answer is labelled
`unknown`, never guessed.

## Architecture

```
public/ (vanilla dashboard — tombstones, vet-any-address, audit table)
   │  fetch /api/*
server.mjs (Node built-in http — no Express; 5-min cache; patrol timer)
   │  vetMint()
agent/vet.mjs (engine: RPC failover, probes, pure deterministic scoring)
   ├──► BSC public RPCs (7 endpoints, fastest-first, transport-only failover)
   └──► Sourcify v2 (source verification, keyless)
agent/watch.mjs (patrol: re-vets every candidate every 5 min → data/audit.jsonl)
agent/mcp-server.mjs (MCP server over stdio: tools vet_mint + list_candidates)
```

Key engineering details:

- **Revert ≠ transport error.** A reverted `eth_call` is a deterministic
  contract answer; retrying it on 7 nodes wasted ~60s per candidate. Only
  timeouts / network / rate-limit errors rotate endpoints. (Patrol went
  from ~75s → ~15s for 5 candidates.)
- **Bounded concurrency (3).** Public RPCs rate-limit bursts.
- **`staticNetwork: true`** on ethers providers — skips auto network
  detection, which retries `eth_chainId` every second on flaky nodes.
- **Property-based tests, handwritten, zero-dep** (`node:test` + seeded
  PRNG): score range, determinism, monotonicity, verdict bands, penalty
  bounds — plus MCP stdio smoke tests.

## API

| Endpoint | Description |
|---|---|
| `GET /` | Dashboard |
| `GET /api/candidates` | All seed candidates, vetted live (5-min cache) |
| `GET /api/verdict/:address` | Vet any BSC contract address live |
| `GET /api/audit?limit=50` | Latest patrol entries, newest first |
| `GET /api/health` | Service + patrol status |

## MCP

```bash
npm run mcp   # stdio JSON-RPC 2.0 server
```

Tools: `vet_mint(address, name?)` → full verdict object;
`list_candidates()` → seed list. Registered for Kiro in
`.kiro/settings/mcp.json`. Smoke test:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_candidates","arguments":{}}}' \
  | node agent/mcp-server.mjs
```

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dashboard + API on `:3000`, patrol every 5 min |
| `npm test` | Property tests + MCP smoke tests (9 tests) |
| `npm run watch` | One patrol run → `data/audit.jsonl` |
| `npm run mcp` | MCP server on stdio |

## Live results (19 Nov 2026, first patrol)

| Candidate | Verdict | Score | Notes |
|---|---|---|---|
| Rulz Share | RISKY | 55 | ERC-1155: supply/owner unreadable; free lane gated |
| Agent Mint Pass | RISKY | 55 | Same profile |
| MOSSMINDS | RISKY | 50 | Owner live; 1,426/4,000 minted; lane reverts "exact value" (paid) |
| RONAGENT | RISKY | 40 | Owner live; 1,112 minted |
| ONLYAI | RISKY | 40 | Owner live; 3,375 minted |

Honest reading: none of the five seed mints currently proves a free lane
with a bare 0-value call — most need an Agent-ID signature proof, which the
sentinel cannot fake and correctly reports as "not detected" rather than
claiming SAFE.

## How Kiro was used

This project was built **spec-driven, the Kiro way** — requirements first,
then design, then tasks, then code — with the full `.kiro/` artifact set
committed in the repo (never git-ignored):

- `.kiro/specs/mint-sentinel/` — `requirements.md` (user stories +
  acceptance criteria), `design.md` (architecture + decisions),
  `tasks.md` (implementation checklist, all checked).
- `.kiro/steering/` — `product.md`, `tech.md`, `structure.md`: the
  standing rules the build followed (read-only, deterministic scoring,
  zero-dep except ethers, honest unknowns).
- `.kiro/hooks/on-agent-change.json` — auto-runs `npm test` whenever a
  file under `agent/` changes.
- `.kiro/settings/mcp.json` — registers the local MCP server
  (`vet_mint`, `list_candidates`) for Kiro.
- **Kiro CLI:** installed from `https://cli.kiro.dev/install`
  (kiro-cli 3.5.0, verified with `kiro-cli --version`). `kiro-cli whoami`
  reports "Logged in with Builder ID" (GitHub endg9, Builder ID
  ruslindg9@gmail.com — signed in 2026-11-19). The project follows the
  Kiro spec-driven methodology with complete, compatible `.kiro/`
  artifacts, ready to be picked up by Kiro IDE/CLI.

## Deploy (Vercel, free)

- `public/` is served statically; `api/*.mjs` are serverless functions
  wrapping the same `agent/vet.mjs` engine (live on-chain vetting,
  5-minute cache). `vercel.json` sets `maxDuration: 60` for the vetting
  endpoints.
- Deploy: connect Vercel, then `vercel deploy` (or import the repo in
  the Vercel dashboard — framework: Other, no build command needed).
- The 5-minute patrol + audit trail (`agent/watch.mjs`) run on the
  local server; the serverless deployment is stateless, so `/api/audit`
  honestly returns an empty trail there.

## License

MIT — see `LICENSE`.

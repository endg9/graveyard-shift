# Design — Graveyard Shift (mint-sentinel)

## Overview

Graveyard Shift is a small Node.js app with three surfaces over one
vetting engine:

```
                ┌──────────────────┐
                │  public/         │  vanilla HTML/CSS/JS dashboard
                │  (graveyard UI)  │  (tombstone per candidate)
                └───────┬──────────┘
                        │ fetch /api/*
                ┌───────▼──────────┐
                │  server.mjs      │  Node built-in http only
                │  static + JSON   │  5-min cache + patrol timer
                └───────┬──────────┘
                        │ vetMint()
                ┌───────▼──────────┐     ┌──────────────────┐
                │  agent/vet.mjs   │────▶│  BSC public RPCs │
                │  deterministic   │     │  (failover list) │
                │  scoring engine  │────▶│  Sourcify v2     │
                └───────┬──────────┘     └──────────────────┘
                        │
              ┌─────────┴──────────┐
              │ agent/watch.mjs    │  patrol → data/audit.jsonl
              │ agent/mcp-server   │  MCP tools: vet_mint,
              │   .mjs (stdio)     │  list_candidates
              └────────────────────┘
```

## Components

### `agent/vet.mjs` — the engine (the only part that touches the chain)

- **RPC layer.** One `JsonRpcProvider` per public endpoint, built with
  `staticNetwork: true` (skips ethers' auto network detection, which retries
  `eth_chainId` every second on flaky nodes and floods the log). Endpoints
  are ordered fastest-first (measured: `rpc.48.club`,
  `bsc-dataseed.binance.org`, … PublicNode last — it was observed at 7s+
  and rate-limited). `callWithFailover` starts at the current best endpoint
  and rotates only on a **transport** error.
- **Revert ≠ transport error.** A reverted `eth_call` (`CALL_EXCEPTION`,
  "execution reverted") is a deterministic contract answer. Retrying it on
  7 nodes wasted ~60s per candidate; now it returns immediately. Only
  timeout / network / rate-limit / 5xx errors rotate endpoints.
- **Bounded concurrency.** 12 probes per candidate run at concurrency 3 —
  public RPCs rate-limit bursts (13 simultaneous calls timed out).
- **Scoring is pure.** `scoreChecks(checks)` and `verdictFor(score)` take
  no network, clock or random input. This is what makes property-based
  testing possible without a chain.
- **Honest unknowns.** Every check has four states: `pass`, `warn`, `fail`,
  `unknown`. A check the chain cannot answer is `unknown` (small penalty),
  never guessed. No code at the address → `INVALID`; no RPC at all →
  `UNKNOWN` with null score.

### `agent/candidates.mjs` — seed list

Five real, publicly known Agent-ID mint contracts (Rulz Share, Agent Mint
Pass, MOSSMINDS, RONAGENT, ONLYAI). The list is a starting point only —
every entry is re-verified live on every run; nothing is trusted on
reputation.

### `agent/watch.mjs` — patrol

Vets every candidate once per run, appends one JSON line per candidate to
`data/audit.jsonl`. Runnable standalone (`npm run watch`) or in-process from
the server timer.

### `agent/mcp-server.mjs` — MCP (stdio, zero SDK)

The MCP wire protocol is small (`initialize`, `tools/list`, `tools/call`,
`ping` over newline-delimited JSON-RPC 2.0), so it is implemented directly
instead of pulling in an SDK — keeping the dependency tree at exactly one
package. Tools: `vet_mint`, `list_candidates`.

### `server.mjs` — HTTP

Node built-in `http` only (no Express). Serves `public/` statically and
four JSON endpoints. `/api/candidates` is cached for 5 minutes (a full vet
pass costs ~15s of public-RPC time). A patrol runs on boot and every
5 minutes and invalidates the cache.

### `public/` — dashboard

Vanilla HTML/CSS/JS, no build step, no framework. The graveyard is CSS:
tombstones are cards with a rounded-top shape, a moon glow, and a
perspective tilt on hover. All numbers come from the API; the only
hardcoded content is the legend and the "how we judge" explainer.

## Key decisions

| Decision | Rationale |
|---|---|
| ethers v6 as the only dependency | Mature, single-purpose, no framework needed |
| No Express | `http` built-in is enough for 4 endpoints + static files |
| No MCP SDK | Wire protocol is ~100 lines; zero-dep keeps install trivial |
| Handwritten property tests, no fast-check | `node:test` + a seeded PRNG covers the invariants; one less dependency |
| Sourcify v2 (not BscScan API) | No API key; `200`/`404` is a clean verified/not-verified signal |
| JSONL audit log | Append-only, greppable, no database to run |
| Score penalties as a table | Transparent, auditable, and trivially property-testable |

## Known limitations (honest, by design)

- **ERC-1155 contracts** (e.g. Rulz Share) don't expose `totalSupply()` /
  `owner()` with the ERC-721 selectors, so supply/owner read `unknown`
  rather than wrong. A future iteration can probe `totalSupply(uint256)`.
- **Gated free lanes** (Agent-ID signature proofs) revert a bare static
  call, so the lane reads "not detected". That is the correct conservative
  answer: the sentinel cannot prove the lane is free without a real
  Agent-ID proof, and it says so instead of claiming SAFE.
- **Public RPC flakiness** is handled by failover, not eliminated. A
  dedicated node would make patrols faster and more stable.

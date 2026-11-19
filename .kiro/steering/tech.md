# Tech steering — Graveyard Shift

## Stack

- **Runtime:** Node.js ≥ 20, ESM (`"type": "module"`).
- **Language:** JavaScript. No TypeScript, no build step, no bundler.
- **Dependencies:** exactly one — `ethers` v6 (chain reads). Everything
  else is Node built-ins (`http`, `fs`, `node:test`).
- **Frontend:** vanilla HTML/CSS/JS. No framework, no CDN assets.

## Rules

1. **Zero-dep except ethers.** Before adding a dependency, prove the
   built-in cannot do it. (The MCP server is hand-rolled JSON-RPC for
   exactly this reason.)
2. **No transaction code, ever.** `eth_call` and `eth_getCode` only. If a
   line of code could move funds, it does not belong in this repo.
3. **No secrets in the repo.** No private keys, no API keys, no `.env`
   with real values. `.env.example` only.
4. **Pure scoring.** `scoreChecks` / `verdictFor` must stay pure functions
   of their input — no I/O, no clock, no randomness — so property tests
   can run offline.
5. **Failover, don't fail.** Public RPCs are flaky: rotate endpoints on
   transport errors only. A contract revert is a final answer, not a
   reason to retry.
6. **Bounded concurrency.** Max 3 simultaneous RPC calls — public nodes
   rate-limit bursts.
7. **Static network for ethers providers.** Always construct
   `JsonRpcProvider` with `(req, 56, { staticNetwork: true })` to skip
   auto network detection (it retries `eth_chainId` every second on
   flaky nodes and floods logs).
8. **Tests are `node:test`, zero-dep.** Property tests use a seeded PRNG
   (mulberry32) so the suite is reproducible.
9. **Every user-facing number is live or labelled unavailable.** No
   placeholder data in the UI, no fake "demo mode".

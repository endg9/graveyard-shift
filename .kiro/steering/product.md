# Product steering — Graveyard Shift

## What this is

A read-only sentinel that protects Binance Agent ID holders from trap
"free" mints on BSC. It vets contracts live on-chain and tells the truth:
SAFE, RISKY, TRAP, INVALID, or UNKNOWN — with the full check list behind
every verdict.

## Product rules

1. **Never trust, always verify.** A project's own claim ("free mint!") is
   worth nothing until the chain confirms it. Every number on the dashboard
   comes from a live RPC call or is labelled "unavailable".
2. **Read-only, always.** The sentinel never builds, signs or broadcasts a
   transaction. It cannot spend the user's money, by construction — no
   wallet connection exists anywhere in the app.
3. **Honest unknowns beat confident guesses.** If the chain cannot answer,
   say UNKNOWN. A wrong SAFE is worse than an UNKNOWN.
4. **Conservative by default.** A gated free lane that cannot be proven
   free reads as "not detected", not as SAFE. The user decides; the
   sentinel only reports evidence.
5. **Deterministic scoring.** Same on-chain state → same score, every time.
   Scores are comparable across days and testable without a chain.
6. **One glance, one decision.** The dashboard must let a hunter judge a
   mint in under 10 seconds: name, verdict, score, supply, free lane.
7. **Free to run.** No paid APIs, no keys, no accounts. Public RPCs +
   Sourcify only. `npm install && npm start` in under 5 minutes.
8. **Halloween, but legible.** The graveyard theme is the personality, not
   a gimmick that hides data. Tombstones carry the full audit trail.

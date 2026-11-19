# Requirements — Graveyard Shift (mint-sentinel)

## Introduction

Thousands of Binance Agent ID holders hunt "free" mints on BSC. Many are
traps: an owner who can still mint or gate the sale, a hidden fee, a fake
free lane, or a sold-out supply. Checking each contract by hand wastes time
and gas. Graveyard Shift is a read-only sentinel: it vets mint contracts
live on-chain and gives a verdict + score + full audit trail before anyone
spends gas.

## Glossary

- **Candidate**: a BSC contract address believed to offer a free Agent-ID mint.
- **Verdict**: SAFE (≥70), RISKY (40–69), TRAP (<40), INVALID (no code at
  address), UNKNOWN (the chain could not be read).
- **Score**: deterministic 0–100, a pure function of the check list.
- **Patrol**: one scheduled pass that vets every candidate and appends to
  the audit log.
- **Probe wallet**: a synthetic address (`0x1111…1111`) used only for
  read-only `eth_call` probes. Never a real wallet, never signs anything.

## Requirements

### Requirement 1: Live on-chain vetting

**User Story:** As a mint hunter, I want every candidate verified against
live BSC state, so I never trust a stale screenshot or a project's promise.

#### Acceptance Criteria

1. WHEN the sentinel vets a contract THEN it SHALL read contract code via
   `eth_getCode` on BSC mainnet (chain 56).
2. WHEN code is absent THEN the verdict SHALL be `INVALID` with score 0.
3. WHEN no RPC endpoint answers THEN the verdict SHALL be `UNKNOWN` with a
   null score — never a fabricated score.
4. WHEN the source is checked THEN the sentinel SHALL query Sourcify v2
   (`200` = verified, `404` = not verified) without any API key.
5. WHEN `owner()` returns a non-zero address THEN the check SHALL fail with
   the owner address in the detail.
6. WHEN `totalSupply()` and `maxSupply()` both answer THEN remaining supply
   SHALL be reported and a zero remainder SHALL fail the supply check.
7. WHEN the free lane is probed THEN the sentinel SHALL static-call common
   free-mint entry points (`mint(uint256)`, `mint()`, `openFree()`,
   `mintFree()`, `freeMint()`, `claim()`, `claimFree()`) with value 0 and
   record which (if any) answered without reverting.
8. WHEN the probe wallet is checked THEN `balanceOf()` / `hasClaimed()`
   SHALL be read and a used slot SHALL fail the slot check.

### Requirement 2: Deterministic scoring

**User Story:** As a hunter, I want the same on-chain state to always give
the same score, so verdicts are comparable and testable.

#### Acceptance Criteria

1. WHEN scoring runs THEN the score SHALL be a pure function of the check
   list (no network, no clock, no randomness).
2. WHEN the score is computed THEN it SHALL always be an integer in [0, 100].
3. WHEN any check worsens from `pass` to `fail` THEN the score SHALL NOT
   increase (monotonicity).
4. WHEN the score is ≥ 70 THEN the verdict SHALL be `SAFE`; 40–69 `RISKY`;
   < 40 `TRAP`.
5. WHEN penalties apply THEN they SHALL match the table: source unverified
   −25, source unknown −10, live owner −20, owner unknown −5, free lane
   closed −30, sold out −40, supply unknown −10, slot used −15.

### Requirement 3: Dashboard

**User Story:** As a hunter, I want a dashboard that shows every candidate
as a tombstone with verdict, score and the full check list, so I can judge
a mint in one glance.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN it SHALL fetch all data from `/api/*`
   and SHALL NOT contain hardcoded verdicts or scores.
2. WHEN the chain cannot answer THEN the UI SHALL display "unavailable"
   instead of inventing a number.
3. WHEN a user pastes any `0x` address THEN the dashboard SHALL vet it live
   via `/api/verdict/:address` and render the same tombstone view.
4. WHEN the audit log has entries THEN the dashboard SHALL show the latest
   patrol runs newest-first.
5. WHEN the page is open THEN it SHALL refresh data every 60 seconds.

### Requirement 4: Patrol + audit trail

**User Story:** As a hunter, I want the sentinel to re-check every 5 minutes
and keep a log, so I can see when a verdict changed and why.

#### Acceptance Criteria

1. WHEN the server runs THEN a patrol SHALL vet every seed candidate every
   5 minutes and on boot.
2. WHEN a patrol finishes THEN one JSON line per candidate SHALL be appended
   to `data/audit.jsonl` with timestamp, address, verdict, score, supply,
   free lane and checks.
3. WHEN the audit is requested THEN `GET /api/audit` SHALL return the latest
   entries newest-first.

### Requirement 5: MCP server

**User Story:** As an agent developer, I want the vetting engine exposed as
an MCP server, so any MCP client (including Kiro) can call it as a tool.

#### Acceptance Criteria

1. WHEN the MCP server starts THEN it SHALL speak JSON-RPC 2.0 over stdio
   and answer `initialize`, `tools/list` and `tools/call`.
2. WHEN `tools/list` is called THEN it SHALL expose `vet_mint` and
   `list_candidates`.
3. WHEN `vet_mint` is called with a valid address THEN it SHALL return the
   same verdict object as the HTTP API.
4. WHEN `vet_mint` is called with an invalid address THEN it SHALL return a
   JSON-RPC error (code −32602), not a crash.

### Requirement 6: Safety rails

**User Story:** As a hunter, I want a guarantee the sentinel can never spend
my money, so I can run it without a wallet connected.

#### Acceptance Criteria

1. WHEN the sentinel runs THEN it SHALL NEVER build, sign or broadcast a
   transaction — all chain reads are `eth_call` / `eth_getCode` only.
2. WHEN the repo is published THEN it SHALL contain no credentials, no
   private keys and no paid API keys.
3. WHEN the code is reviewed THEN the only dependency SHALL be `ethers`
   (plus Node built-ins and `node:test` for tests).

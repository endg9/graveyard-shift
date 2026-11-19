# Kiroween 2026 — Submission Draft: Graveyard Shift

> STATUS: DRAFT ONLY — DO NOT submit to Devpost yet.
> Deadline: **Friday, 5 Dec 2026, 05:00 WIB** (Dec 4, 2:00 PM PT).
> Category: **Frankenstein** ($5,000) — also eligible for Overall (1st $30,000 / 2nd $20,000 / 3rd $10,000)
> and Best Demo ($1,000, no extra steps).

## Links (fill in as they land)

| Field | Value | Status |
|---|---|---|
| GitHub repo (public) | https://github.com/endg9/graveyard-shift | ⏳ BLOCKED — needs browser: `gh auth login` device code **E98F-AF17** at https://github.com/login/device (signed in as endg9), then create repo + push. 4 local commits ready: 0173738, 3e3a756, ff20855, 7074f72. `.kiro/` IS tracked (8 files), LICENSE present. |
| Live app URL | _(Vercel URL after deploy)_ | ⏳ BLOCKED — needs joko to authorize Vercel connect: https://agent.meta.ai/connectors/connect/vercel, then deploy via `vercel call-tool create_deployment`. Serverless adaptation done + tested (`api/`, `vercel.json`). |
| Demo video | https://muse.ai/files/1458570017330911/1711001027303489/9qyfnfgtd9moi1jbmq20s54c/graveyard-shift-demo.mp4 | ✅ READY — 93 s, 1280×720, 24 fps, TTS narration (EN) + subtitles. **Expires 21 Nov 2026 08:51 WIB.** ⚠️ Devpost requires the video **on YouTube, made PUBLIC** — joko must upload `demo/graveyard-shift-demo.mp4` (also committed in the repo) to his YouTube and paste the YouTube link here before submitting. |
| Devpost entry | https://kiroween.devpost.com/ → "Enter a Submission" | ⏳ joko's step (Devpost account; try GitHub OAuth with endg9 — untested). |

## Title

**Graveyard Shift — Don't trust a free mint. Make the sentinel dig first.**

## Tagline (one line)

Autonomous free-mint sentinel for Binance Agent ID hunters on BSC: every candidate vetted live on-chain, scored 0–100, before you spend a single wei of gas.

## Description (paste into Devpost)

Thousands of Agent ID holders hunt free mints on BSC — but "free" is often a trap: a live owner who can still admin the contract, a hidden fee, a fake free lane, or a supply that's already gone. Checking contracts one by one wastes time and gas.

**Graveyard Shift** is a sentinel that digs up the truth before you spend anything. It patrols a watchlist of BSC mint contracts and vets each one with read-only `eth_call` probes — never a transaction, never a wallet connection, never a cent of gas:

- **Contract code present** — is there actually code at the address?
- **Source verified** — does the bytecode match the published source (Sourcify)?
- **No single owner/admin** — can one address still rug or admin the contract?
- **Supply remaining** — how much is actually left to mint?
- **Probe wallet slot unused** — is your free slot still free?
- **Free lane callable with 0 value** — does a free-mint entry point really answer a 0-value static call, or does it revert (lane closed, paid-only, or gated)?

Each candidate becomes a tombstone with a deterministic 0–100 score and a verdict: **SAFE ≥ 70, RISKY 40–69, TRAP < 40, UNKNOWN**. A patrol re-vets everything every 5 minutes and writes an audit trail, so you can see when a verdict changed and why. Any contract can be vetted on demand through the dashboard — and the same engine is an **MCP server** (`vet_mint`, `list_candidates`), so any agent, including Kiro, can call it as a tool.

**Live demo data (real, from the chain):** MOSSMINDS scored 50 — RISKY (live owner, free lane reverts with exact value, so it wants payment). Rulz Share scored 55 — RISKY (free lane gated behind an Agent ID proof, so the sentinel reports "not detected" instead of pretending it's safe). Nothing is hardcoded — every number on the dashboard came from BSC seconds before the recording.

## How Kiro was used (write-up for the Devpost form)

Built **spec-driven, the Kiro way**, with Kiro CLI (logged in via GitHub endg9 / Builder ID ruslindg9@gmail.com):

- **Specs** (`.kiro/specs/mint-sentinel/`): `requirements.md` → `design.md` → `tasks.md`. The spec was written first; implementation followed the task list. The deterministic scoring rules and the "never send a transaction" constraint were requirements before they were code — the opposite of vibe coding, and the reason the sentinel can't accidentally spend money.
- **Steering** (`.kiro/steering/`): `product.md`, `tech.md`, `structure.md` kept every session on the same architecture (read-only probes, Node 24, no new dependencies) without re-explaining it each time.
- **Agent hooks** (`.kiro/hooks/on-agent-change.json`): runs `npm test` automatically on agent file changes — 9/9 tests green, so regressions surface while the agent is still working, not after.
- **MCP** (`.kiro/settings/mcp.json` + `agent/mcp-server.mjs`): the vetting engine is exposed as a local MCP server with `vet_mint` and `list_candidates` tools, so Kiro itself (and any MCP client) can vet contracts as part of its own workflow — the same code that powers the dashboard, reused as an agent capability.
- **Kiro CLI**: the whole build — spec, implementation, tests, serverless adaptation for Vercel, demo script — was done in Kiro CLI sessions.

## Built with

Node.js 24 · ethers.js · BSC (BNB Smart Chain) · Sourcify · MCP (Model Context Protocol) · Kiro CLI (specs, steering, hooks) · Vercel (serverless deploy)

## Bonus prizes (optional, decide before submitting)

- **Best Demo** ($1,000): no extra steps — all eligible submissions are considered.
- **Social Blitz Prize** (3-month Kiro Pro+, 5 winners): post on any social platform during the Submission Period with **#KiroweenHackathon26** at the beginning, about your favorite thing about Kiro and how it changed your approach. Add the post URL to the submission. (Needs joko's X @flynq9 post.)
- **Bonus Blog Prize** (2,000 Kiro credits, 100 winners): publish a public blog post about Kiro + this project on any third-party blog platform during the Submission Period, stating it is written as part of the Kiroween 2026 hackathon. Add the post URL to the submission.
- Not applicable: Best Startup (not a startup), Best Student (not students), Best Ghost of Kiroween Past (did not register 2025), Best Kiro Crew App (not a Crew app).

## Pre-submit checklist

- [ ] GitHub repo `endg9/graveyard-shift` public, pushed (4 commits), LICENSE visible, `.kiro/` at root
- [ ] Vercel deploy live — paste public URL
- [ ] Demo video uploaded to **YouTube, public** — paste YouTube URL (remote-storage link expires 21 Nov 08:51 WIB, do NOT submit that link)
- [ ] Devpost account registered (joko) — try GitHub OAuth (endg9)
- [ ] Category: **Frankenstein** selected
- [ ] Description + "How Kiro was used" pasted from above
- [ ] (Optional) Social Blitz post + Blog post URLs added
- [ ] Submit before **5 Dec 2026 05:00 WIB**

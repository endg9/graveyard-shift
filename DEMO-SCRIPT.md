# DEMO SCRIPT — Graveyard Shift (< 3 minutes)

Video demo for Kiroween 2026 (Frankenstein). Record the running app at
http://localhost:3000 (start with `npm start` first). Narration in
English; on-screen text mirrors the narration. Total target: ~2:40.

## Scene 1 — The problem (0:00–0:25) — dashboard hero

**On screen:** Dashboard hero + graveyard of 5 tombstones.
**Narration:**
> "Thousands of Agent ID holders hunt free mints on BSC. But free is often
> a trap — a live owner, a hidden fee, a fake free lane, or a supply that's
> already gone. Checking contracts one by one wastes time and gas. So we
> built a sentinel that digs up the truth before you spend anything."

## Scene 2 — Live verdicts (0:25–1:05) — tombstones

**On screen:** Scroll the graveyard; hover MOSSMINDS; expand its check list.
**Narration:**
> "Every candidate is a tombstone, vetted live on-chain. MOSSMINDS: fifty
> out of a hundred — RISKY. The owner is still live, and its free lane
> reverts with 'exact value' — meaning it wants payment. Rulz Share: also
> risky — its free lane is gated behind an Agent ID proof, so the sentinel
> reports 'not detected' instead of pretending it's safe. Nothing here is
> hardcoded — every number came from the chain seconds ago."

## Scene 3 — Vet any contract (1:05–1:35) — vet form

**On screen:** Paste `0x5b49b06a2e25fce0bca865be70f3c62b6319367a` (or any
contract) into "Vet any contract", submit, show the new tombstone.
**Narration:**
> "Paste any contract and the sentinel digs it up on the spot — code,
> verified source, owner, supply, slot, free lane — all read-only static
> calls. It never sends a transaction. It cannot spend your money, by
> construction."

## Scene 4 — Audit trail + MCP (1:35–2:10) — audit table, then terminal

**On screen:** Audit table on the dashboard; cut to terminal:
`printf ... tools/call vet_mint ... | node agent/mcp-server.mjs` showing
the JSON verdict.
**Narration:**
> "A patrol re-vets everything every five minutes and writes an audit
> trail — so you can see when a verdict changed and why. And the same
> engine is an MCP server: any agent, including Kiro, can call vet_mint
> as a tool."

## Scene 5 — Kiro spec-driven build (2:10–2:40) — .kiro folder

**On screen:** File tree: `.kiro/specs/mint-sentinel/` (requirements,
design, tasks), `.kiro/steering/`, `.kiro/hooks/`,
`.kiro/settings/mcp.json`; end on the dashboard.
**Narration:**
> "It was built spec-driven, the Kiro way: requirements, then design,
> then tasks — with steering rules, an auto-test hook, and a local MCP
> server, all shipped in .kiro. Graveyard Shift: don't trust a free mint.
> Make the sentinel dig first."

**End card (2:40):** "Graveyard Shift — Kiroween 2026 · Frankenstein ·
github.com/endg9/graveyard-shift" (repo URL to be filled at push time).

## Recording checklist

- [ ] `npm start` running; dashboard loaded with live data (not the loading state)
- [ ] Wait for the boot patrol to finish so the audit table is populated
- [ ] Terminal font large enough to read the MCP JSON on video
- [ ] Keep each scene in one continuous take; cut on narration pauses
- [ ] No wallet, no keys, no accounts visible anywhere on screen

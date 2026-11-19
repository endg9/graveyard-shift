# Structure steering — Graveyard Shift

```
.
├── server.mjs                 # HTTP server (built-in http): static + /api/*
├── agent/
│   ├── vet.mjs                # vetting engine: RPC failover, probes, pure scoring
│   ├── candidates.mjs         # seed candidate list (real public contracts)
│   ├── watch.mjs              # patrol loop → data/audit.jsonl
│   └── mcp-server.mjs         # MCP server (stdio JSON-RPC 2.0, no SDK)
├── public/
│   ├── index.html             # dashboard shell
│   ├── styles.css             # graveyard theme
│   └── app.js                 # fetches /api/*, renders tombstones
├── test/
│   └── vet.test.mjs           # property tests + MCP smoke tests (node:test)
├── data/
│   ├── audit.jsonl            # live patrol log (git-ignored, generated)
│   └── audit-sample.jsonl     # small committed sample for reference
├── .kiro/
│   ├── specs/mint-sentinel/   # requirements.md, design.md, tasks.md
│   ├── steering/              # product.md, tech.md, structure.md
│   ├── hooks/                 # agent hooks (JSON)
│   └── settings/mcp.json      # local MCP server registration
├── README.md
├── DEMO-SCRIPT.md
├── BUILD-LOG.md
├── LICENSE                    # MIT
├── .env.example
└── package.json               # ESM, ethers only
```

## Rules

1. **One engine, three surfaces.** `agent/vet.mjs` is the only module that
   touches the chain. The HTTP server, the patrol and the MCP server are
   thin callers of `vetMint()`. Never duplicate vetting logic.
2. **`.kiro/` is source, not generated noise.** It is committed and NEVER
   git-ignored — the hackathon requires specs/hooks/steering in the repo.
3. **Keep files small and single-purpose.** If a file grows past ~300
   lines, split it.
4. **No code copied from other workspace projects.** Endpoints and ABIs
   may be read as reference; every line here is written for this project.
5. **Audit data stays out of git.** `data/audit.jsonl` is runtime output;
   only `data/audit-sample.jsonl` is committed.
6. **Public assets have no build step.** What is in `public/` is what is
   served.

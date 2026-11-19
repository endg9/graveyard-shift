// mcp-server.mjs — Model Context Protocol server (stdio, JSON-RPC 2.0).
// Zero MCP-SDK dependency: the wire protocol is small enough to implement
// directly (initialize / tools/list / tools/call / ping), which keeps the
// dependency tree at exactly one package (ethers).
//
// Tools:
//   vet_mint        — vet one BSC contract address live, return verdict+score
//   list_candidates — return the seed candidate list (addresses + names)
//
// Smoke test:  printf '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"vet_mint","arguments":{"address":"0x08e3…"}}}\n' | node agent/mcp-server.mjs
// Registered for Kiro in .kiro/settings/mcp.json.

import { vetMint } from "./vet.mjs";
import { CANDIDATES } from "./candidates.mjs";

const TOOLS = [
  {
    name: "vet_mint",
    description:
      "Vet a BSC free-mint contract live on-chain. Checks contract code, Sourcify source verification, owner/admin, totalSupply/maxSupply, probe-wallet slot, and whether a free-mint entry point answers a 0-value static call. Returns a deterministic score (0-100) and verdict (SAFE / RISKY / TRAP / INVALID / UNKNOWN) with a full check list. Read-only: never sends a transaction.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "BSC contract address (0x…)" },
        name: { type: "string", description: "Optional human-readable name" },
      },
      required: ["address"],
    },
  },
  {
    name: "list_candidates",
    description: "List the sentinel's seed free-mint candidates on BSC (name + contract address).",
    inputSchema: { type: "object", properties: {} },
  },
];

function result(id, payload) {
  return JSON.stringify({ jsonrpc: "2.0", id, result: payload });
}
function error(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg ?? {};
  if (method === "initialize") {
    return result(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "graveyard-shift", version: "0.1.0" },
    });
  }
  if (method === "notifications/initialized" || method === "ping") {
    return method === "ping" ? result(id, {}) : null;
  }
  if (method === "tools/list") {
    return result(id, { tools: TOOLS });
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments ?? {};
    try {
      if (name === "vet_mint") {
        if (!/^0x[0-9a-fA-F]{40}$/.test(args.address ?? "")) {
          return error(id, -32602, "vet_mint requires a valid 0x address");
        }
        const r = await vetMint(args.address, { name: args.name ?? null });
        return result(id, {
          content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
          structuredContent: r,
        });
      }
      if (name === "list_candidates") {
        return result(id, {
          content: [{ type: "text", text: JSON.stringify(CANDIDATES, null, 2) }],
          structuredContent: { candidates: CANDIDATES },
        });
      }
      return error(id, -32602, `unknown tool: ${name}`);
    } catch (err) {
      return error(id, -32603, String(err?.message ?? err));
    }
  }
  return error(id, -32601, `method not found: ${method}`);
}

// Line-delimited JSON over stdio.
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(error(null, -32700, "parse error") + "\n");
      continue;
    }
    const out = await handle(msg);
    if (out) process.stdout.write(out + "\n");
  }
});

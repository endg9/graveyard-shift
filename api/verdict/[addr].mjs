// api/verdict/[addr].mjs — Vercel serverless: vet one contract live.
import { vetMint } from "../../agent/vet.mjs";

export default async function handler(req, res) {
  const addr = req.query.addr;
  if (typeof addr !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return res.status(400).json({ error: "invalid address — expected 0x + 40 hex chars" });
  }
  try {
    const result = await vetMint(addr);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) });
  }
}

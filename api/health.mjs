// api/health.mjs — Vercel serverless health check.
import { CANDIDATES } from "../agent/candidates.mjs";

export default async function handler(req, res) {
  return res.status(200).json({ ok: true, service: "graveyard-shift", runtime: "vercel-serverless", candidates: CANDIDATES.length });
}

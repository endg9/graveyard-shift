// api/audit.mjs — Vercel serverless: no persistent audit log on serverless
// (no writable disk between invocations), so this returns an empty trail
// honestly instead of stale data. The 5-minute patrol runs on the local
// server (agent/watch.mjs); see data/audit-sample.jsonl for its format.
export default async function handler(req, res) {
  return res.status(200).json({ entries: [], note: "audit trail lives on the local patrol server; serverless deployment is stateless" });
}

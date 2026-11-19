// app.js — Graveyard Shift dashboard. All numbers come from the live API;
// nothing is hardcoded. If the chain cannot answer, the UI says so.
const $ = (s) => document.querySelector(s);
const VERDICT_CLASS = { SAFE: "safe", RISKY: "risky", TRAP: "trap", UNKNOWN: "unknown", INVALID: "invalid" };
const CHECK_ICON = { pass: ["ok", "✓"], warn: ["warn", "⚠"], fail: ["bad", "✗"], unknown: ["unk", "?"] };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function tombstone(r) {
  const cls = VERDICT_CLASS[r.verdict] ?? "unknown";
  const score = r.score === null || r.score === undefined ? "—" : r.score;
  const supply = r.supply
    ? r.supply.max !== null
      ? `${Number(r.supply.remaining).toLocaleString()} / ${Number(r.supply.max).toLocaleString()} left`
      : `${Number(r.supply.total).toLocaleString()} minted (max unknown)`
    : "supply unavailable";
  const lane = r.freeLane ? `Free lane: ${esc(r.freeLane.join(", "))}` : "Free lane: not detected";
  const checks = (r.checks ?? []).map((c) => {
    const [iconCls, icon] = CHECK_ICON[c.status] ?? CHECK_ICON.unknown;
    return `<li><span class="${iconCls}">${icon}</span> <strong>${esc(c.label)}</strong><small>${esc(c.detail)}</small></li>`;
  }).join("");
  return `<article class="tombstone">
    <h3>🪦 ${esc(r.name ?? "Unnamed contract")}</h3>
    <div class="addr">${esc(r.address)}</div>
    <div class="score-row"><span class="score">${score}</span><span class="badge ${cls}">${esc(r.verdict)}</span></div>
    <div class="meta">${esc(supply)} · ${lane}</div>
    <ul class="checks">${checks}</ul>
    <div class="meta">checked ${esc(r.checkedAt ?? "?")} · ${r.rpcOk ? "RPC ok" : "RPC unavailable"}</div>
  </article>`;
}

async function loadCandidates() {
  const el = $("#graveyard");
  try {
    const res = await fetch("/api/candidates");
    const data = await res.json();
    const list = data.candidates ?? [];
    $("#count").textContent = `(${list.length} souls)`;
    $("#lastRun").textContent = data.cachedAt ? `last vetting: ${new Date(data.cachedAt).toLocaleString()}` : "";
    $("#health").textContent = list.some((c) => c.rpcOk) ? "⛓️ BSC RPC reachable" : "⚠️ BSC RPC unavailable — showing last known state";
    el.innerHTML = list.length ? list.map(tombstone).join("") : `<p class="loading">No candidates yet.</p>`;
  } catch (err) {
    el.innerHTML = `<p class="loading">Could not reach the API (${esc(err.message)}). Is the server running?</p>`;
  }
}

async function loadAudit() {
  try {
    const res = await fetch("/api/audit?limit=15");
    const { entries } = await res.json();
    if (!entries?.length) return;
    $("#audit").innerHTML = `<table class="audit-table">
      <thead><tr><th>Time</th><th>Candidate</th><th>Verdict</th><th>Score</th><th>Supply</th></tr></thead>
      <tbody>${entries.map((e) => `<tr>
        <td class="mono">${esc(e.ts)}</td><td>${esc(e.name ?? e.address.slice(0, 10))}</td>
        <td><span class="badge ${VERDICT_CLASS[e.verdict] ?? "unknown"}">${esc(e.verdict)}</span></td>
        <td>${e.score ?? "—"}</td>
        <td class="mono">${e.supply?.remaining != null ? `${e.supply.remaining} left` : "—"}</td>
      </tr>`).join("")}</tbody></table>`;
  } catch { /* audit is best-effort */ }
}

async function vetOne(addr) {
  const box = $("#vetResult");
  box.innerHTML = `<p class="loading">⛏️ Digging… static calls only, no transaction.</p>`;
  try {
    const res = await fetch(`/api/verdict/${encodeURIComponent(addr)}`);
    const r = await res.json();
    if (!res.ok) { box.innerHTML = `<p class="loading">${esc(r.error ?? "vetting failed")}</p>`; return; }
    box.innerHTML = `<div class="graveyard" style="margin-top:1rem">${tombstone(r)}</div>`;
  } catch (err) {
    box.innerHTML = `<p class="loading">Vetting failed: ${esc(err.message)}</p>`;
  }
}

$("#vetForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const addr = $("#vetAddr").value.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) vetOne(addr);
  else $("#vetResult").innerHTML = `<p class="loading">That doesn't look like a 0x address (40 hex chars).</p>`;
});
$("#refreshBtn").addEventListener("click", async () => {
  $("#graveyard").innerHTML = `<p class="loading">🦇 Re-vetting all tombstones live…</p>`;
  await loadCandidates(); await loadAudit();
});

loadCandidates();
loadAudit();
setInterval(() => { loadCandidates(); loadAudit(); }, 60_000);

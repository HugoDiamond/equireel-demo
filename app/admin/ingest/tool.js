"use client";

/* Entries ingest — upload an entries sheet (CSV) for events that can't be
   scraped (pony club, unaffiliated, FFE...). Writes straight into the
   platform's canonical events + results tables via /api/ingest
   (source='INGEST'); the catalogue refresh then puts the event on the site.
   Flow: paste/upload CSV → auto-mapped columns (adjustable) → preview →
   ingest. Same team key as the order queue. */

import { useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";
const KEY_STORE = "equireel_admin_key";

/* tiny CSV parser: quotes, commas, CRLF */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const FIELDS = [
  ["bib", ["bib", "number", "no", "no.", "#", "start no"]],
  ["horse", ["horse", "pony", "horse name", "mount"]],
  ["rider", ["rider", "competitor", "name", "rider name", "athlete", "member"]],
  ["section", ["section", "class", "division", "level", "arena"]],
  ["day", ["day", "xc day", "date"]],
  ["time", ["time", "xc time", "start time", "xc start"]],
];

function guessMapping(header) {
  const map = {};
  header.forEach((h, i) => {
    const lh = h.trim().toLowerCase();
    for (const [field, alts] of FIELDS) {
      if (map[field] == null && (alts.includes(lh) || alts.some((a) => lh.includes(a) && a.length > 2))) {
        map[field] = i;
        break;
      }
    }
  });
  return map;
}

export default function IngestTool() {
  const [key, setKey] = useState("");
  const [entered, setEntered] = useState("");
  const [authed, setAuthed] = useState(false);
  const [csv, setCsv] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [map, setMap] = useState({});
  const [ev, setEv] = useState({ name: "", date: "", country: "GBR", organization: "" });
  const [replace, setReplace] = useState(false);
  const [state, setState] = useState("");

  useMemo(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(KEY_STORE) || "";
      if (saved) { setKey(saved); setAuthed(true); }
    }
  }, []);

  const grid = useMemo(() => (csv.trim() ? parseCSV(csv) : []), [csv]);
  const header = hasHeader && grid.length ? grid[0] : (grid[0] || []).map((_, i) => "Column " + (i + 1));
  const dataRows = hasHeader ? grid.slice(1) : grid;

  function onCsvChange(text) {
    setCsv(text);
    const g = text.trim() ? parseCSV(text) : [];
    if (g.length) setMap(guessMapping(g[0]));
  }
  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onCsvChange(String(r.result || ""));
    r.readAsText(f);
  }

  const mapped = useMemo(() => dataRows.map((r) => ({
    bib: map.bib != null ? (r[map.bib] || "").trim() : "",
    horse: map.horse != null ? (r[map.horse] || "").trim() : "",
    rider: map.rider != null ? (r[map.rider] || "").trim() : "",
    section: map.section != null ? (r[map.section] || "").trim() : "",
    day: map.day != null ? (r[map.day] || "").trim() : "",
    time: map.time != null ? (r[map.time] || "").trim() : ""
  })).filter((r) => r.horse && r.rider), [dataRows, map]);

  async function submit() {
    setState("busy");
    try {
      const r = await fetch(API + "/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": key },
        body: JSON.stringify({ event: { ...ev, replace }, rows: mapped })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setState("done:" + d.inserted + (d.replaced ? " (replaced previous ingest)" : ""));
      else setState("err:" + (d.message || d.error || r.status));
    } catch (e) { setState("err:network problem — try again"); }
  }

  if (!API) return <div className="aq-gate"><h1>Entries ingest</h1><p>Not available on the demo — use the live site.</p></div>;

  if (!authed) {
    return (
      <div className="aq-gate">
        <h1>Entries ingest</h1>
        <p>Enter the team key to upload an entries sheet.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (entered.trim()) { localStorage.setItem(KEY_STORE, entered.trim()); setKey(entered.trim()); setAuthed(true); } }}>
          <input type="password" autoFocus value={entered} placeholder="Team key" onChange={(e) => setEntered(e.target.value)} />
          <button className="btn primary" type="submit">Open</button>
        </form>
      </div>
    );
  }

  const canSubmit = ev.name.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && mapped.length > 0 && state !== "busy";

  return (
    <div className="aq ig">
      <h1>Entries ingest</h1>
      <p className="ig-sub">For events we can&rsquo;t scrape — pony club, unaffiliated, FFE. Writes straight into the platform
        database (<code>source=INGEST</code>); the event appears on the site at the next catalogue refresh.</p>

      <h2 className="aq-sec">1 · Event</h2>
      <div className="ig-event">
        <input placeholder="Event name, e.g. Cotswold Cup Waverton" value={ev.name}
          onChange={(e) => setEv({ ...ev, name: e.target.value })} style={{ flex: 2, minWidth: 220 }} />
        <input type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} />
        <select value={ev.country} onChange={(e) => setEv({ ...ev, country: e.target.value })}>
          <option value="GBR">UK</option><option value="IRL">Ireland</option>
          <option value="FRA">France</option><option value="USA">USA</option><option value="BEL">Belgium</option>
        </select>
        <input placeholder="Organiser (optional)" value={ev.organization}
          onChange={(e) => setEv({ ...ev, organization: e.target.value })} />
      </div>

      <h2 className="aq-sec">2 · Entries sheet (CSV)</h2>
      <div className="ig-src">
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        <label className="ig-check"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> first row is headers</label>
      </div>
      <textarea rows={5} placeholder={"...or paste CSV here\nBib,Horse,Rider,Class\n1,My Pony,Jane Smith,Minimus A"}
        value={csv} onChange={(e) => onCsvChange(e.target.value)} />

      {grid.length > 0 && (
        <>
          <h2 className="aq-sec">3 · Column mapping</h2>
          <div className="ig-map">
            {FIELDS.map(([field]) => (
              <label key={field}>
                <span>{field}{(field === "horse" || field === "rider") ? " *" : ""}</span>
                <select value={map[field] ?? ""} onChange={(e) => setMap({ ...map, [field]: e.target.value === "" ? null : Number(e.target.value) })}>
                  <option value="">—</option>
                  {header.map((h, i) => <option key={i} value={i}>{h || "Column " + (i + 1)}</option>)}
                </select>
              </label>
            ))}
          </div>

          <h2 className="aq-sec">4 · Preview — {mapped.length} valid entries</h2>
          <div className="ig-preview">
            <table>
              <thead><tr><th>Bib</th><th>Horse</th><th>Rider</th><th>Section</th><th>Day</th><th>Time</th></tr></thead>
              <tbody>
                {mapped.slice(0, 8).map((r, i) => (
                  <tr key={i}><td>{r.bib}</td><td>{r.horse}</td><td>{r.rider}</td><td>{r.section}</td><td>{r.day}</td><td>{r.time}</td></tr>
                ))}
              </tbody>
            </table>
            {mapped.length > 8 && <p className="ig-more">…and {mapped.length - 8} more</p>}
          </div>

          <label className="ig-check" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            replace existing (if this event was ingested before)
          </label>
          <div style={{ marginTop: 14 }}>
            <button className="btn primary big" disabled={!canSubmit} onClick={submit}>
              {state === "busy" ? "Ingesting…" : `Ingest ${mapped.length} entries`}
            </button>
          </div>
        </>
      )}

      {state.startsWith("done:") && <p className="notify-done">✓ Ingested {state.slice(5)} entries into the platform database. The event goes live on the site at the next catalogue refresh (Mondays 9am) — or ask Claude/David to run it now.</p>}
      {state.startsWith("err:") && <p className="aq-err">Couldn&rsquo;t ingest: {state.slice(4)}</p>}
    </div>
  );
}

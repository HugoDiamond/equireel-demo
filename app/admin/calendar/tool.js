"use client";

/* Filming calendar manager — the interim front door for the filming_calendar
   table (the machine-readable "we are doing this event" declaration; see
   docs/DATA-COLLECTION-PLAN.md). Adding an event here puts it on the public
   /calendar page immediately. Later this table is fed by the feed matcher /
   a calendar connector; this screen stays as the manual override. */

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";
const KEY_STORE = "equireel_admin_key";
const COUNTRIES = [["GBR", "UK"], ["IRL", "Ireland"], ["FRA", "France"], ["USA", "USA"], ["BEL", "Belgium"], ["GER", "Germany"]];

const BLANK = { event_name: "", start_date: "", end_date: "", venue: "", country: "GBR", organiser: "" };

export default function CalendarTool() {
  const [key, setKey] = useState("");
  const [entered, setEntered] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [state, setState] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORE) || "";
    if (saved) { setKey(saved); setAuthed(true); }
  }, []);

  useEffect(() => { if (authed) refresh(); }, [authed]);

  async function refresh() {
    try {
      const r = await fetch(API + "/calendar?t=" + Date.now());
      const d = await r.json();
      setRows(d.events || []);
    } catch (e) { setRows([]); }
  }

  async function add(e) {
    e.preventDefault();
    setState("busy");
    try {
      const r = await fetch(API + "/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": key },
        body: JSON.stringify(form)
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setState("done"); setForm(BLANK); refresh(); }
      else setState("err:" + (d.error || r.status));
    } catch (err) { setState("err:network problem"); }
  }

  async function remove(id, name) {
    if (!window.confirm("Remove “" + name + "” from the calendar?")) return;
    await fetch(API + "/calendar?id=" + id, { method: "DELETE", headers: { "X-Admin-Key": key } });
    refresh();
  }

  if (!API) return <div className="aq-gate"><h1>Filming calendar</h1><p>Not available on the demo — use the live site.</p></div>;

  if (!authed) {
    return (
      <div className="aq-gate">
        <h1>Filming calendar</h1>
        <p>Enter the team key to manage the calendar.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (entered.trim()) { localStorage.setItem(KEY_STORE, entered.trim()); setKey(entered.trim()); setAuthed(true); } }}>
          <input type="password" autoFocus value={entered} placeholder="Team key" onChange={(e) => setEntered(e.target.value)} />
          <button className="btn primary" type="submit">Open</button>
        </form>
      </div>
    );
  }

  const canAdd = form.event_name.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(form.start_date) && state !== "busy";

  return (
    <div className="aq ig">
      <h1>Filming calendar</h1>
      <p className="ig-sub">Every event added here appears on the public <a href="/calendar">/calendar</a> page immediately
        (&ldquo;Where we&rsquo;ll be&rdquo;), with notify-me capture until its videos go on sale.</p>

      <h2 className="aq-sec">Add an event</h2>
      <form onSubmit={add}>
        <div className="ig-event">
          <input placeholder="Event name, e.g. Aston le Walls (2)" value={form.event_name}
            onChange={(e) => setForm({ ...form, event_name: e.target.value })} style={{ flex: 2, minWidth: 220 }} />
          <input type="date" title="First day" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <input type="date" title="Last day (optional)" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            {COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
        </div>
        <div className="ig-event" style={{ marginTop: 8 }}>
          <input placeholder="Venue (optional)" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} style={{ flex: 1 }} />
          <input placeholder="Organiser (optional)" value={form.organiser} onChange={(e) => setForm({ ...form, organiser: e.target.value })} style={{ flex: 1 }} />
          <button className="btn primary" disabled={!canAdd} type="submit">{state === "busy" ? "Adding…" : "Add to calendar"}</button>
        </div>
      </form>
      {state === "done" && <p className="notify-done">✓ Added — it&rsquo;s on the public calendar now.</p>}
      {state.startsWith("err:") && <p className="aq-err">Couldn&rsquo;t add: {state.slice(4)}</p>}

      <h2 className="aq-sec">Upcoming &amp; recent</h2>
      {rows === null ? <p>Loading…</p> : !rows.length ? <p>Nothing on the calendar yet.</p> : (
        <div className="ig-preview">
          <table>
            <thead><tr><th>Dates</th><th>Event</th><th>Venue</th><th>Country</th><th>On site</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.start_date}{r.end_date && r.end_date !== r.start_date ? " → " + r.end_date : ""}</td>
                  <td>{r.event_name}</td>
                  <td>{r.venue || "—"}</td>
                  <td>{r.country}</td>
                  <td>{r.site_slug ? "✓ entries live" : "coming soon"}</td>
                  <td><button className="btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => remove(r.id, r.event_name)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

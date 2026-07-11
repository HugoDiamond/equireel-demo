"use client";

/* Where we'll be — the published filming calendar. Never edited here: reads
   the filming_calendar table via /api/calendar, which the team (and later
   the feed matcher) keeps current. Events with entries live link straight
   into the catalogue; future ones capture notify-me demand. */

import { useEffect, useState } from "react";
import { href } from "../../lib/eq";
import { track } from "../../lib/track";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";
const FLAG = { GBR: "gb", IRL: "ie", FRA: "fr", USA: "us", BEL: "be" };
const COUNTRY = { GBR: "UK", IRL: "Ireland", FRA: "France", USA: "USA", BEL: "Belgium" };
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function d(iso) { return new Date(iso + "T12:00:00"); }
function fmtRange(ev) {
  const s = d(ev.start_date);
  let out = DAYS[s.getDay()] + " " + s.getDate();
  if (ev.end_date && ev.end_date !== ev.start_date) {
    const e = d(ev.end_date);
    out += " – " + DAYS[e.getDay()] + " " + e.getDate();
    if (e.getMonth() !== s.getMonth()) out += " " + MONTHS[e.getMonth()].slice(0, 3);
  }
  return out;
}

function Notify({ ev }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");

  async function submit(e) {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) { setState("err"); return; }
    setState("busy");
    try {
      const r = await fetch(API + "/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, e: "cal-" + ev.id, evName: ev.event_name })
      });
      if (!r.ok) { setState("err"); return; }
      track("notify_signup", { ev: "cal-" + ev.id });
      setState("done");
    } catch (err) { setState("err"); }
  }

  if (state === "done") return <p className="cal-notify-done">✓ On the list — one email when videos from {ev.event_name} can be ordered.</p>;
  if (!open) return <button className="btn ghost cal-notify-btn" onClick={() => setOpen(true)}>🔔 Notify me</button>;
  return (
    <form className="cal-notify" onSubmit={submit}>
      <input type="email" autoFocus placeholder="you@example.com" value={email}
        className={state === "err" ? "field-err" : ""}
        onChange={(e) => { setEmail(e.target.value); if (state === "err") setState("idle"); }} />
      <button className="btn primary" disabled={state === "busy"} type="submit">
        {state === "busy" ? "Saving…" : "Notify me"}
      </button>
    </form>
  );
}

export default function Calendar() {
  const [events, setEvents] = useState(null); // null = loading, [] = empty
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!API) { setEvents([]); return; }
    fetch(API + "/calendar").then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => { setErr(true); setEvents([]); });
  }, []);

  if (events === null) return <p className="cal-empty">Loading the calendar…</p>;
  if (err) return <p className="cal-empty">The calendar couldn&rsquo;t load — please try again in a moment.</p>;
  if (!events.length) {
    return <p className="cal-empty">The next season&rsquo;s dates are being confirmed now — follow
      <a href="https://www.facebook.com/Equireel" target="_blank" rel="noopener"> our Facebook</a> or
      check back soon.</p>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const groups = [];
  for (const ev of events) {
    const s = d(ev.start_date);
    const key = s.getFullYear() + "-" + s.getMonth();
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, label: MONTHS[s.getMonth()] + " " + s.getFullYear(), evs: [] }; groups.push(g); }
    g.evs.push(ev);
  }

  return (
    <div className="cal">
      {groups.map((g) => (
        <section key={g.key} className="cal-month">
          <h2>{g.label}</h2>
          {g.evs.map((ev) => {
            const past = (ev.end_date || ev.start_date) < today;
            return (
              <div className={"cal-row" + (past ? " past" : "")} key={ev.id}>
                <div className="cal-date">{fmtRange(ev)}</div>
                <div className="cal-main">
                  <div className="cal-name">
                    <img src={"https://flagcdn.com/w40/" + (FLAG[ev.country] || "gb") + ".png"} alt={COUNTRY[ev.country] || ""} />
                    {ev.event_name}
                  </div>
                  {(ev.venue || ev.organiser) && (
                    <div className="cal-meta">{[ev.venue, ev.organiser].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
                <div className="cal-act">
                  {ev.site_slug
                    ? <a className="btn primary" href={href("/event?id=" + encodeURIComponent(ev.site_slug))}>{past ? "Order your video" : "Find your horse"}</a>
                    : past
                      ? <span className="cal-soon">Videos in the edit</span>
                      : <Notify ev={ev} />}
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <p className="cal-foot">Competing at an event that isn&rsquo;t listed? Email <a href="mailto:info@equireel.com">info@equireel.com</a> — we add events all season.</p>
    </div>
  );
}

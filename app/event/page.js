"use client";

/* Event page — search + section filter, horse placards, free clip / event
   preview / purchased states. Audit additions: sticky toolbar, section
   group headings, price up front, links to other editions of the fixture. */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header, Footer, Crumbs } from "../../components/Chrome";
import HorseCard from "../../components/HorseCard";
import {
  href, icons, EVENTS, getCountry, getEvent, getEntries, fmtRange,
  siblingEditions, eventYear, onDataLoaded, sectionsOf
} from "../../lib/eq";

function EventInner() {
  const params = useSearchParams();
  const ev = getEvent(params.get("id")) || EVENTS[0];
  const country = getCountry(ev.country);
  const entries = getEntries(ev.id);

  const [q, setQ] = useState(params.get("q") || "");
  const [sec, setSec] = useState("");
  /* purchased state lives in localStorage — start false so the first client
     render matches the server, then flip after mount (avoids hydration mismatch) */
  const [mounted, setMounted] = useState(false);
  const [, dataTick] = useState(0);

  useEffect(() => onDataLoaded(() => dataTick((n) => n + 1)), []);

  useEffect(() => {
    setMounted(true);
    /* set after hydration settles so Next's streamed metadata can't overwrite it */
    const t = setTimeout(() => { document.title = ev.name + " " + eventYear(ev) + " — Equireel"; }, 300);
    try { localStorage.setItem("equireel_last_event", JSON.stringify({ id: ev.id, at: Date.now() })); } catch (e) {}
    return () => clearTimeout(t);
  }, [ev.id, ev.name]);

  const f = q.trim().toLowerCase();
  const rows = entries.filter((en) =>
    (!sec || en.section === sec) &&
    (!f || String(en.bib) === f || en.horse.toLowerCase().includes(f) ||
      en.rider.toLowerCase().includes(f) || en.section.toLowerCase().includes(f))
  );

  const grouped = !sec && !f;
  const editions = siblingEditions(ev).slice(0, 7);

  let lastSection = null;

  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[
          { label: country.name, flag: country.code, href: href("/events?country=" + country.code) },
          { label: ev.name },
        ]} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <h1>{ev.name}</h1>
            <div className="event-meta">
              <span className="em-chip em-date">
                <span dangerouslySetInnerHTML={{ __html: icons.cal }} style={{ display: "contents" }} />
                {fmtRange(ev.date, ev.dateEnd, "long")}
              </span>
              <span className="em-chip em-org">
                <span dangerouslySetInnerHTML={{ __html: icons.rosette }} style={{ display: "contents" }} />
                {ev.body}
              </span>
              <span className="em-chip em-venue">
                <span dangerouslySetInnerHTML={{ __html: icons.pin }} style={{ display: "contents" }} />
                {ev.venue}
              </span>
              <span className="em-chip em-combos">
                <span dangerouslySetInnerHTML={{ __html: icons.user }} style={{ display: "contents" }} />
                <span>{rows.length}</span> combinations
              </span>
            </div>
          </div>
        </div>
        {editions.length > 0 && (
          <p className="editions">
            Also filmed here:{" "}
            {editions.map((s, i) => (
              <span key={s.id}>
                {i > 0 && " · "}
                <a href={href("/event?id=" + s.id)}>{eventYear(s)}</a>
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="container" style={{ paddingBottom: "56px" }}>
        <div className="toolbar toolbar-sticky">
          <div className="searchwrap">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input type="text" placeholder="Search horse, rider or bib number..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {sectionsOf(ev).length > 0 && (
            <select aria-label="Filter by section" value={sec} onChange={(e) => setSec(e.target.value)}>
              <option value="">All sections</option>
              {sectionsOf(ev).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        <div className="horse-list event-placards">
          {rows.map((en) => {
            const showHead = grouped && en.section && en.section !== lastSection;
            lastSection = en.section;
            return (
              <div key={en.id} style={{ display: "contents" }}>
                {showHead && <div className="list-sec-head">{en.section}</div>}
                <HorseCard en={en} ev={ev} mounted={mounted} riderLink={false} />
              </div>
            );
          })}
        </div>
        {rows.length === 0 && (
          <div className="empty-rescue">
            <p className="empty-note">No results — but if you ran here, we filmed you.</p>
            <a className="btn primary" href={href("/horse?ev=" + ev.id + "&new=1")}>Order Without a Listing</a>
          </div>
        )}

        {rows.length > 0 && (
          <div className="notlisted-card">
            <div>
              <strong>Can't find your horse?</strong>
              <p>Late waitlist entries aren't always on our list — but we film every rider on course.</p>
            </div>
            <a className="btn" href={href("/horse?ev=" + ev.id + "&new=1")}>Order Without a Listing</a>
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}

export default function EventPage() {
  return (
    <Suspense>
      <EventInner />
    </Suspense>
  );
}

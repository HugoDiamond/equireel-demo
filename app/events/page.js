"use client";

/* Country page — recent events prominent, year selector for the archive
   (footage back to 2019), cross-year search. */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header, Footer, Crumbs } from "../../components/Chrome";
import HorseCard from "../../components/HorseCard";
import {
  href, icons, COUNTRIES, EVENTS, getCountry, getEntries, eventsForCountry,
  eventsForCountryYear, yearsForCountry, liveEventsForCountry, eventYear,
  fmtDate, fmtRange, closestMatches, onDataLoaded
} from "../../lib/eq";

/* a two-day event can straddle a month boundary — it belongs to both */
function monthsOf(e) {
  const m1 = +e.date.slice(5, 7);
  const m2 = e.dateEnd ? +e.dateEnd.slice(5, 7) : m1;
  return m1 === m2 ? [m1] : [m1, m2];
}

/* full search — horses, riders, owners and events — across EVERY country and
   year, ranked so the current country's matches lead. A lost visitor on the
   wrong country page still finds their horse, and the foreign flag corrects
   them at a glance. */
function searchEverywhere(q, code) {
  const f = q.trim().toLowerCase();
  if (f.length < 2) return { events: [], entries: [] };
  const sorted = EVENTS.slice().sort((a, b) => {
    const ac = a.country === code ? 0 : 1, bc = b.country === code ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return b.date.localeCompare(a.date);
  });
  const events = sorted.filter(
    (e) => e.name.toLowerCase().includes(f) || e.venue.toLowerCase().includes(f) || String(eventYear(e)) === f
  ).slice(0, 12);
  const entries = [];
  for (const ev of sorted) {
    for (const en of getEntries(ev.id)) {
      if (en._s.includes(f) || String(en.bib) === f) {
        entries.push({ en, ev });
        if (entries.length >= 40) break;
      }
    }
    if (entries.length >= 40) break;
  }
  /* exact name matches outrank partial ones; local stays above foreign */
  entries.forEach((m) => {
    m.exact = (m.en.horse.toLowerCase() === f || m.en.rider.toLowerCase() === f) ? 1 : 0;
    m.local = m.ev.country === code ? 1 : 0;
  });
  entries.sort((a, b) => (b.exact - a.exact) || (b.local - a.local) || b.ev.date.localeCompare(a.ev.date));
  const out = { events, entries: entries.slice(0, 12) };
  /* nothing at all? offer the closest names — labelled, never mixed in */
  if (!out.events.length && !out.entries.length) out.suggestions = closestMatches(f, code, 6);
  return out;
}

function EventCard({ e, showYear, showFlag }) {
  const dt = fmtDate(e.date, "parts");
  const entries = getEntries(e.id);
  let day = String(dt.d), rng = "";
  if (e.dateEnd && e.dateEnd !== e.date) {
    const de = new Date(e.dateEnd + "T12:00:00");
    if (de.getMonth() === new Date(e.date + "T12:00:00").getMonth()) {
      day = dt.d + "–" + de.getDate();
      rng = " rng";
    }
  }
  return (
    <a className="event-card" href={href("/event?id=" + e.id)}>
      <div className="event-date">
        <div className={"d" + rng}>{day}</div>
        <div className="m">{dt.m}</div>
        <div className="y">{dt.y}</div>
      </div>
      <div className="event-info">
        <h3>
          {showFlag && <img src={"https://flagcdn.com/w40/" + e.country + ".png"} alt="" style={{ width: "24px", height: "17px", objectFit: "cover", borderRadius: "3px", verticalAlign: "-3px", marginRight: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }} />}
          {e.name}{showYear ? " · " + eventYear(e) : ""}
        </h3>
        <div className="meta">
          <span><span dangerouslySetInnerHTML={{ __html: icons.pin }} style={{ display: "contents" }} />{e.venue}</span>
          <span><span dangerouslySetInnerHTML={{ __html: icons.rosette }} style={{ display: "contents" }} />{e.body}</span>
          <span><span dangerouslySetInnerHTML={{ __html: icons.user }} style={{ display: "contents" }} />{entries.length} combinations</span>
        </div>
      </div>
      <div className="event-cta">
        <span className="chev" dangerouslySetInnerHTML={{ __html: icons.chevR }} />
      </div>
    </a>
  );
}

function EventsInner() {
  const params = useSearchParams();
  const code = params.get("country") || "gb";
  const country = getCountry(code) || COUNTRIES[0];

  const years = yearsForCountry(country.code);
  /* state initialises from the URL so back-navigation and shared links
     restore the exact search / year / month the visitor was looking at */
  const [year, setYear] = useState(() => {
    const y = +(params.get("year") || 0);
    return years.includes(y) ? y : years[0];
  });
  const [month, setMonth] = useState(() => Math.min(12, Math.max(0, +(params.get("month") || 0)))); /* 0 = all months */
  const [q, setQ] = useState(params.get("q") || "");

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* re-render when the real entries arrive (counts, search, sub-line) */
  const [, dataTick] = useState(0);
  useEffect(() => onDataLoaded(() => dataTick((n) => n + 1)), []);

  useEffect(() => {
    const t = setTimeout(() => { document.title = country.name + " events — Equireel"; }, 300);
    /* warm the archive's entry cache while the page is idle so the first
       search keystroke doesn't pay the generation cost */
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 800));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const w = idle(() => { EVENTS.forEach((e) => getEntries(e.id)); });
    return () => { clearTimeout(t); cancelIdle(w); };
  }, [country.name]);

  /* mirror state into the URL (replace, not push — pills shouldn't stack history) */
  useEffect(() => {
    const sp = new URLSearchParams();
    sp.set("country", country.code);
    if (year !== years[0]) sp.set("year", String(year));
    if (month) sp.set("month", String(month));
    if (q.trim()) sp.set("q", q.trim());
    try { window.history.replaceState(null, "", href("/events?" + sp.toString())); } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country.code, year, month, q]);

  /* "Latest events" = only genuinely live fixtures — today (anchored to the
     newest event in the catalogue) within a day either side of the event.
     No fallback: on a quiet week the strip disappears and the archive below,
     which already leads newest-first, is the single source of truth. */
  const recent = liveEventsForCountry(country.code, 1).slice(0, 6);
  const isCurrent = recent.length > 0;
  const thisYear = new Date().getFullYear();

  const searching = q.trim().length > 0;
  const yearEvents = eventsForCountryYear(country.code, year);
  /* months that actually have events in the selected year, calendar order;
     an event straddling a month boundary counts in both months */
  const monthsAvailable = [...new Set(yearEvents.flatMap(monthsOf))].sort((a, b) => a - b);
  const shownEvents = month ? yearEvents.filter((e) => monthsOf(e).includes(month)) : yearEvents;
  const results = searching ? searchEverywhere(q, country.code) : { events: [], entries: [] };
  const resultCount = results.events.length + results.entries.length;
  const suggesting = searching && resultCount === 0 && results.suggestions && results.suggestions.length > 0;
  const shownEntries = suggesting ? results.suggestions : results.entries;
  const totalOnRecord = eventsForCountry(country.code).length;

  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: country.name, flag: country.code }]} />
        <h1>
          <img className="flagimg" src={"https://flagcdn.com/w80/" + country.code + ".png"} alt="" />
          {country.name}
        </h1>
        <p className="sub">
          {(function () {
            const total = eventsForCountry(country.code).reduce((s, e) => s + getEntries(e.id).length, 0);
            const since = "Filming here since " + years[years.length - 1];
            return total > 0
              ? since + " · " + (Math.max(500, Math.floor(total / 500) * 500)).toLocaleString("en-GB") + "+ rounds filmed across " + totalOnRecord + " events"
              : since + " · " + totalOnRecord + " events on record";
          })()}
        </p>
      </div>

      <div className="container" style={{ paddingBottom: "56px" }}>

        {isCurrent && (
          <>
            <p className="eyebrow" style={{ marginTop: "8px" }}>
              <span className="live-dot" aria-hidden="true"></span>Latest events
            </p>
            <div className="live-grid" style={{ marginBottom: "30px" }}>
              {recent.map((e) => (
                <a key={e.id} className="live-card" href={href("/event?id=" + e.id)}>
                  <div className="live-info">
                    <h3>{e.name}</h3>
                    <p>
                      <span className="d">{fmtRange(e.date, e.dateEnd)}{eventYear(e) !== thisYear ? " " + eventYear(e) : ""}</span>
                      {" · "}{e.body}
                    </p>
                  </div>
                  <span className="go" dangerouslySetInnerHTML={{ __html: icons.chevR }} />
                </a>
              ))}
            </div>
          </>
        )}

        <p className="eyebrow">All events</p>
        <div className="toolbar-sticky">
          <div className="toolbar" style={{ margin: 0 }}>
            <div className="year-pills" aria-label="Choose a year">
              {years.map((y) => (
                <button key={y} aria-pressed={!searching && y === year}
                  className={"year-pill" + (!searching && y === year ? " active" : "")}
                  onClick={() => { setQ(""); setMonth(0); setYear(y); }}>
                  {y}
                </button>
              ))}
            </div>
            <div className="searchwrap">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input type="text" aria-label="Search horse, rider, owner or event"
                placeholder="Search horse, rider, owner or event..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {!searching && monthsAvailable.length > 1 && (
            <div className="month-pills" aria-label="Filter by month">
              <button aria-pressed={month === 0}
                className={"month-pill" + (month === 0 ? " active" : "")}
                onClick={() => setMonth(0)}>
                All
              </button>
              {monthsAvailable.map((m) => (
                <button key={m} aria-pressed={month === m}
                  className={"month-pill" + (month === m ? " active" : "")}
                  onClick={() => setMonth(m)}>
                  {MONTH_NAMES[m - 1]}
                </button>
              ))}
            </div>
          )}
        </div>

        {searching ? (
          <>
            <p className="result-note">
              {suggesting
                ? "No exact matches for “" + q.trim() + "” — did you mean:"
                : resultCount + " match" + (resultCount === 1 ? "" : "es") + " across all years and countries"}
            </p>
            {(function () {
              /* group placards under event/year headers, preserving the
                 local-first, newest-first order of the results */
              const groups = [];
              shownEntries.forEach(({ en, ev }) => {
                const last = groups[groups.length - 1];
                if (last && last.ev.id === ev.id) last.items.push(en);
                else groups.push({ ev, items: [en] });
              });
              return groups.map((g, gi) => (
                <div key={g.ev.id + "-" + gi} className="result-group">
                  <a className="result-ev-head" href={href("/event?id=" + g.ev.id)}>
                    <img src={"https://flagcdn.com/w40/" + g.ev.country + ".png"} alt="" width="22" />
                    <strong>{g.ev.name}</strong> · {fmtDate(g.ev.date, "parts").m} {eventYear(g.ev)}
                    {g.ev.country !== country.code ? <span className="rg-country"> · {getCountry(g.ev.country).name}</span> : null}
                  </a>
                  <div className="horse-list">
                    {g.items.map((en) => <HorseCard key={en.id} en={en} ev={g.ev} />)}
                  </div>
                </div>
              ));
            })()}
            {results.events.length > 0 && (
              <>
                <div className="list-sec-head" style={{ marginTop: "24px" }}>Matching events</div>
                <div className="event-list">
                  {results.events.map((e) => <EventCard key={e.id} e={e} showYear={true} showFlag={e.country !== country.code} />)}
                </div>
              </>
            )}
            {resultCount === 0 && !suggesting && <p className="empty-note">No matches — try a horse, rider, owner or event name.</p>}
          </>
        ) : (
          <>
            <p className="result-note">
              {shownEvents.length} event{shownEvents.length === 1 ? "" : "s"} in {month ? MONTH_NAMES[month - 1] + " " : ""}{year}
            </p>
            <div className="event-list">
              {shownEvents.map((e) => <EventCard key={e.id} e={e} />)}
            </div>
            {shownEvents.length === 0 && <p className="empty-note">No events on record for {month ? MONTH_NAMES[month - 1] + " " : ""}{year}.</p>}
          </>
        )}
      </div>

      <Footer />
    </>
  );
}

export default function EventsPage() {
  return (
    <Suspense>
      <EventsInner />
    </Suspense>
  );
}

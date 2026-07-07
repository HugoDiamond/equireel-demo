"use client";

/* Rider page — every round we've filmed for a rider, newest first,
   grouped by event. Each placard leads to its horse page to order. */

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Header, Footer, Crumbs } from "../../components/Chrome";
import HorseCard from "../../components/HorseCard";
import Checkout from "../../components/Checkout";
import { useState } from "react";
import { href, getCountry, riderRounds, eventYear, fmtDate, icons, onDataLoaded, entriesLoaded, defaultFlagFor, tidyName } from "../../lib/eq";

function RiderInner() {
  const params = useSearchParams();
  const name = params.get("name") || "";
  /* context from the page they came from — with duplicate rider names, the
     same horse or country pushes the likeliest matches to the top */
  const ctx = { comboField: "horse", combo: params.get("h") || "", country: params.get("c") || "" };
  const rounds = name ? riderRounds(name, ctx) : [];
  const [, dataTick] = useState(0);
  const [checkout, setCheckout] = useState(null);

  useEffect(() => onDataLoaded(() => dataTick((n) => n + 1)), []);

  useEffect(() => {
    const t = setTimeout(() => { document.title = tidyName(name) + " — Equireel"; }, 300);
    return () => clearTimeout(t);
  }, [name]);

  /* group by event (whole — a rider's horses at one event stay together),
     newest event first; likelihood only breaks same-date ties */
  const groupsMap = new Map();
  rounds.forEach(({ en, ev, score }) => {
    const g = groupsMap.get(ev.id) || { ev, items: [], score: 0 };
    g.items.push(en);
    g.score = Math.max(g.score, score || 0);
    groupsMap.set(ev.id, g);
  });
  const groups = [...groupsMap.values()].sort(
    (a, b) => b.ev.date.localeCompare(a.ev.date) || (b.score - a.score)
  );

  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: tidyName(name) }]} />
        <h1>{tidyName(name)}</h1>
        <p className="sub">{rounds.length} round{rounds.length === 1 ? "" : "s"} on record across {groups.length} event{groups.length === 1 ? "" : "s"}</p>
        {rounds.length > 1 && (
          <button className="btn primary bundle-btn" onClick={() => setCheckout({
            items: rounds.map(({ en, ev }) => ({ ev, en, product: "xc" })),
            flag: defaultFlagFor(rounds[0].ev, rounds[0].en)
          })}>
            Order All {rounds.length} Videos — one payment
          </button>
        )}
      </div>

      <div className="container" style={{ paddingBottom: "56px" }}>
        {groups.map((g) => (
          <div key={g.ev.id} className="result-group">
            <a className="result-ev-head" href={href("/event?id=" + g.ev.id)}>
              <img src={"https://flagcdn.com/w40/" + g.ev.country + ".png"} alt="" width="22" />
              <strong>{g.ev.name}</strong> · {fmtDate(g.ev.date, "parts").m} {eventYear(g.ev)}
              <span className="rg-country"> · {getCountry(g.ev.country).name}</span>
            </a>
            <div className="horse-list">
              {g.items.map((en) => <HorseCard key={en.id} en={en} ev={g.ev} />)}
            </div>
          </div>
        ))}
        {rounds.length === 0 && (
          <p className="empty-note">{entriesLoaded() ? "No rounds on record for this rider." : "Loading…"}</p>
        )}
      </div>

      <Footer />

      {checkout && <Checkout order={checkout} onClose={() => setCheckout(null)} />}
    </>
  );
}

export default function RiderPage() {
  return (
    <Suspense>
      <RiderInner />
    </Suspense>
  );
}

"use client";

/* Horse runs page — every round we've filmed of a horse, newest first,
   grouped by event. Each placard leads to its horse page to order. */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header, Footer, Crumbs } from "../../components/Chrome";
import HorseCard from "../../components/HorseCard";
import Checkout from "../../components/Checkout";
import { href, horseRounds, onDataLoaded, entriesLoaded, defaultFlagFor } from "../../lib/eq";

function HorseRunsInner() {
  const params = useSearchParams();
  const name = params.get("name") || "";
  /* context from the page they came from — with duplicate horse names, the
     same rider or country pushes the likeliest matches to the top */
  const rider = params.get("r") || "";
  const country = params.get("c") || "";
  const ctx = { comboField: "rider", combo: rider, country };
  const rounds = name ? horseRounds(name, ctx) : [];
  const [, dataTick] = useState(0);
  const [checkout, setCheckout] = useState(null);

  useEffect(() => onDataLoaded(() => dataTick((n) => n + 1)), []);

  useEffect(() => {
    const t = setTimeout(() => { document.title = name + " — Equireel"; }, 300);
    return () => clearTimeout(t);
  }, [name]);

  const eventCount = new Set(rounds.map(({ ev }) => ev.id)).size;

  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[{ label: name }]} />
        <h1>{name}</h1>
        <p className="sub">{rounds.length} run{rounds.length === 1 ? "" : "s"} on record across {eventCount} event{eventCount === 1 ? "" : "s"}</p>
        {rider && (
          <a className="also-link" href={href("/rider?name=" + encodeURIComponent(rider) + "&h=" + encodeURIComponent(name) + "&c=" + country)}>
            Also see all of {rider}&rsquo;s rounds &rarr;
          </a>
        )}
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
        {/* they arrived via the horse's name — each placard leads with the
            EVENT, the detail that differentiates and upsells */}
        <div className="horse-list">
          {rounds.map(({ en, ev }) => <HorseCard key={en.id} en={en} ev={ev} showEvent={true} />)}
        </div>
        {rounds.length === 0 && (
          <p className="empty-note">{entriesLoaded() ? "No runs on record for this horse." : "Loading…"}</p>
        )}
      </div>

      <Footer />

      {checkout && <Checkout order={checkout} onClose={() => setCheckout(null)} />}
    </>
  );
}

export default function HorseRunsPage() {
  return (
    <Suspense>
      <HorseRunsInner />
    </Suspense>
  );
}

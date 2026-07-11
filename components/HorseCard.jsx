"use client";

/* The horse placard — thumbnail left, bib/section/horse/rider/owner right.
   Used on event pages, country-page search results, rider pages and the
   horse-page archive shelves. The card leads to the horse page (the shop);
   the rider name leads to the rider page. Ordering is always open — even
   events still in edit take orders. */

import { useState } from "react";
import { icons, purchases, href, eventYear, fmtDate, basket, tidyName } from "../lib/eq";

/* result: optional [position, statusCode] from results-lite — renders a
   small placing badge ("5th") or status chip ("EL") on career pages */
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function HorseCard({ en, ev, mounted = true, showEvent = false, riderLink = true, result = null }) {
  const [, tick] = useState(0);
  const inBasket = mounted && basket.has(en.id);
  function quickAdd(e) {
    e.preventDefault();
    if (inBasket) basket.remove(en.id); else basket.add(en.id);
    tick((n) => n + 1);
  }
  /* an event still in edit behaves like a clips-off one: sample plays,
     ordering is open — there is no "come back later" state */
  const sample = en.generic || ev.status !== "ready";
  const owned = mounted && purchases.has(en.id);
  const tagText = owned ? "PURCHASED"
    : sample ? "SAMPLE ROUND"
    : "FREE CLIP · FENCE " + en.fence;

  const horseUrl = href("/horse?id=" + en.id);
  /* placards are small — pull the light 512px WebP, not the 1280 hero size */
  const thumbSm = en.thumb && en.thumb.endsWith(".webp") ? en.thumb.replace(".webp", "-sm.webp") : null;

  return (
    <div className={"horse-card" + (owned ? " owned" : "")}>
      <a className="thumb" aria-label={"View and order " + en.horse} href={horseUrl}>
        <img className="still" src={thumbSm || en.thumb}
          srcSet={thumbSm ? thumbSm + " 512w, " + en.thumb + " 1280w" : undefined}
          sizes={thumbSm ? "(max-width: 640px) 45vw, 240px" : undefined}
          alt="" loading="lazy" />
        <span className="freetag">{tagText}</span>
        <span className="owned-tick" dangerouslySetInnerHTML={{ __html: icons.check }} />
        <span className="playbtn" dangerouslySetInnerHTML={{ __html: icons.play }} />
      </a>
      {showEvent ? (
        /* archive-shelf mode: the EVENT and its date are the upsell — they
           lead the card; section and start time step back */
        <div className="horse-info">
          <div className="topline">
            <span className="bib">{en.bib}</span>
            {en.section && <span className="sec-label">{en.section}</span>}
            {result && result[0] > 0 && <span className="pos-badge">{ordinal(result[0])}</span>}
            {result && !result[0] && result[1] && <span className="pos-badge dnf">{result[1]}</span>}
          </div>
          <h3 className="ev-title">
            <img src={"https://flagcdn.com/w40/" + ev.country + ".png"} alt="" />
            <a className="horse-link" href={horseUrl}>{ev.name}</a>
          </h3>
          <div className="people">
            <span className="ev-when">{fmtDate(ev.date, "parts").m} {eventYear(ev)}</span>
            <span><span dangerouslySetInnerHTML={{ __html: icons.user }} style={{ display: "contents" }} />
              <a className="rider-link" href={href("/rider?name=" + encodeURIComponent(tidyName(en.rider)) + "&h=" + encodeURIComponent(en.horse) + "&c=" + ev.country)}>{tidyName(en.rider)}</a>
            </span>
          </div>
        </div>
      ) : (
        <div className="horse-info">
          <div className="topline">
            <span className="bib">{en.bib}</span>
            {en.section && <span className="sec-label">{en.section}</span>}
          </div>
          <h3><a className="horse-link" href={horseUrl}>{en.horse}</a></h3>
          <div className="people">
            <span><span dangerouslySetInnerHTML={{ __html: icons.user }} style={{ display: "contents" }} />
              {riderLink
                ? <a className="rider-link" href={href("/rider?name=" + encodeURIComponent(tidyName(en.rider)) + "&h=" + encodeURIComponent(en.horse) + "&c=" + ev.country)}>{tidyName(en.rider)}</a>
                : <span className="rider-name">{tidyName(en.rider)}</span>}
            </span>
            {en.owner && (
              <span><span dangerouslySetInnerHTML={{ __html: icons.rosette }} style={{ display: "contents" }} />{en.owner}</span>
            )}
            {!en.owner && en.xcTime && (
              <span className="xc-when"><span dangerouslySetInnerHTML={{ __html: icons.cal }} style={{ display: "contents" }} />XC {en.xcDay ? en.xcDay + " " : ""}{en.xcTime}</span>
            )}
          </div>
        </div>
      )}
      {!owned && (
        <button
          className={"qadd" + (inBasket ? " added" : "")}
          title={inBasket ? "In your order — click to remove" : "Add to order and keep browsing"}
          aria-label={(inBasket ? "Remove " : "Add ") + en.horse + (inBasket ? " from" : " to") + " your order"}
          onClick={quickAdd}
        >{inBasket ? "✓" : "+"}</button>
      )}
      <a className={"btn " + (owned ? "owned-btn" : "")} href={horseUrl}>
        {owned ? "Watch" : sample ? "Order Video" : "View & Order"}
      </a>
    </div>
  );
}

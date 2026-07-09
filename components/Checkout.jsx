"use client";

/* Checkout sheet — order summary, add-ons already chosen on the horse page,
   video preferences (defaults: music on, course sounds on, public), simulated
   express/card payment, then a confirmation that carries the delivery promise,
   the spam warning and the next-order path.

   Handles one video or many: each video gets its own line (with SJ/Reel add-on
   chips) and a remove button, and everything settles in a single payment.
   "Add Another Video" keeps the order (parks it in the browse-basket) and sends
   the visitor back out to that horse & rider's runs pages to pick more.
   Pages can also open the sheet pre-filled via order.items (rider/horse
   "order all" bundles). */

import { useEffect, useMemo, useState } from "react";
import {
  href, money, purchases, prefs, productPrices, deliveryOf, DELIVERY, FLAGS,
  eventYear, basket, tidyName
} from "../lib/eq";

const PRODUCT_NAMES = { xc: "Cross Country Video", sj: "Show Jumping Video", fence: "Single Fence Video" };
const TIER_RANK = { instant: 0, fast: 1, standard: 2 };
const CUR = { us: "$", ie: "€", fr: "€", be: "€" };

/* When a checkout API is configured (Vercel deploy), "pay" hands off to Stripe
   Checkout — cards never touch this site. Without it (GitHub Pages demo) the
   simulated flow below runs unchanged. */
const CHECKOUT_API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";

function promiseDate(tier) {
  if (tier === "instant") return "ready now";
  if (tier === "fast") return "within the hour";
  const d = new Date(Date.now() + 5 * 86400000);
  return "by " + d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

const horseOf = (it) => (it.en ? it.en.horse : it.manual.horse);
const riderOf = (it) => (it.en ? it.en.rider : it.manual.rider);
const tierOf = (it) => (it.manual ? "standard" : deliveryOf(it.ev));
const itemKey = (it) => (it.en ? it.en.id : "manual:" + it.ev.id + ":" + it.manual.horse.trim().toLowerCase().replace(/\s+/g, "-")) + (it.product === "xc" ? "" : ":" + it.product);

function itemLines(it) {
  const prices = productPrices(it.ev);
  const ls = [];
  if (it.product === "xc") {
    ls.push([PRODUCT_NAMES.xc, prices.xc]);
    if (it.addSJ) ls.push(["Show Jumping add-on", prices.sjAdd]);
    if (it.addReel) ls.push(["Social Reel add-on", prices.reelAdd]);
  } else if (it.product === "sj") {
    ls.push([PRODUCT_NAMES.sj, prices.sjAlone]);
  } else {
    ls.push([PRODUCT_NAMES.fence + (it.fence && it.fence.num ? " — fence " + it.fence.num : ""), prices.fence]);
  }
  return ls;
}

export default function Checkout({ order, onClose, onComplete }) {
  const [items, setItems] = useState(() =>
    order.items
      ? order.items.map((it) => ({ addSJ: false, addReel: false, ...it }))
      : [{
          ev: order.ev, en: order.en, manual: order.manual, product: order.product,
          addSJ: order.addSJ, addReel: order.addReel, fence: order.fence
        }]
  );
  const [step, setStep] = useState("pay");
  const [flag, setFlag] = useState(order.flag || "gb");
  const [email, setEmail] = useState("");
  const [dvd, setDvd] = useState(false);
  const [address, setAddress] = useState("");
  const [card, setCard] = useState(""), [exp, setExp] = useState(""), [cvc, setCvc] = useState("");
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState("");
  const [p, setP] = useState({ faults: true, music: true, sounds: true, public: true });

  useEffect(() => {
    setEmail(purchases.email());
    const saved = prefs.get();
    setP({ faults: saved.faults, music: saved.music, sounds: saved.sounds, public: saved.public });
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const first = items[0];
  const multi = items.length > 1;
  const tier = items.reduce((w, it) => (TIER_RANK[tierOf(it)] > TIER_RANK[w] ? tierOf(it) : w), "instant");

  /* totals grouped by currency — a UK + Irish bundle honestly shows £ + € */
  const totalStr = useMemo(() => {
    const sums = new Map();
    const bump = (country, amt) => {
      const s = CUR[country] || "£";
      sums.set(s, (sums.get(s) || 0) + amt);
    };
    items.forEach((it) => itemLines(it).forEach(([, amt]) => bump(it.ev.country, amt)));
    if (dvd) bump(first.ev.country, productPrices(first.ev).dvd);
    return [...sums.entries()].map(([s, n]) => s + n).join(" + ");
  }, [items, dvd, first]);

  /* "Add Another Video" parks the whole order in the browse-basket and sends
     the visitor to that horse & rider's runs pages — the real listing, where
     every placard has quick-add and the order bar carries them back here. */
  const browseTarget = items.find((it) => it.en) || null;
  function addAnother() {
    items.forEach((it) => { if (it.en) basket.add(it.en.id); });
    const { en, ev } = browseTarget;
    window.location.href = href(
      "/horses?name=" + encodeURIComponent(en.horse) +
      "&r=" + encodeURIComponent(en.rider) + "&c=" + ev.country
    );
  }
  function removeItem(idx) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }
  function toggleAddon(idx, key) {
    setItems(items.map((it, i) => (i === idx ? { ...it, [key]: !it[key] } : it)));
  }

  /* per-video personalisation: an item without .pref inherits the order-wide
     defaults (flag + p); personalising snapshots those defaults so the video
     keeps its own flag / faults / music / sounds / public from then on */
  const orderPref = () => ({ flag, faults: p.faults, music: p.music, sounds: p.sounds, public: p.public });
  function personalise(idx) {
    setItems(items.map((it, i) => (i === idx ? { ...it, pref: it.pref || orderPref() } : it)));
  }
  function clearPref(idx) {
    setItems(items.map((it, i) => (i === idx ? { ...it, pref: undefined } : it)));
  }
  function setPref(idx, patch) {
    setItems(items.map((it, i) => (i === idx ? { ...it, pref: { ...it.pref, ...patch } } : it)));
  }

  const wantsDVD = dvd;

  /* real payment: server re-prices everything and returns a Stripe Checkout
     URL; personalisation travels in session metadata to the order record */
  async function payLive() {
    const e2 = {};
    if (!/.+@.+\..+/.test(email)) e2.email = 1;
    if (wantsDVD && address.trim().length < 8) e2.address = 1;
    if (Object.keys(e2).length) { setErrs(e2); return; }
    setErrs({});
    purchases.setEmail(email);
    prefs.set(Object.assign(prefs.get(), { faults: p.faults, music: p.music, sounds: p.sounds, public: p.public, flag }));
    setBusy("card");
    try {
      const payload = {
        email, dvd: wantsDVD, address: wantsDVD ? address : "",
        items: items.map((it) => {
          const rp = it.pref || orderPref();
          return {
            e: it.ev.id,
            b: it.en ? it.en.bib : "", h: horseOf(it), r: riderOf(it),
            d: it.en ? it.en.xcDay : "", t: it.en ? it.en.xcTime : "",
            p: it.product, sjAdd: it.product === "xc" && !!it.addSJ, rl: it.product === "xc" && !!it.addReel,
            f: it.fence && it.fence.num ? it.fence.num : "",
            pr: { fl: rp.flag, fa: rp.faults, mu: rp.music, so: rp.sounds, pu: rp.public }
          };
        })
      };
      const r = await fetch(CHECKOUT_API + "/create-checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.url) {
        items.forEach((it) => { if (it.en) basket.remove(it.en.id); });
        window.location.href = data.url;
        return;
      }
      setBusy("");
      setErrs({ api: data.message || "We couldn't start the payment — please try again in a moment." });
    } catch (err) {
      setBusy("");
      setErrs({ api: "We couldn't reach the payment service — please check your connection and try again." });
    }
  }

  function complete(express) {
    const e2 = {};
    if (wantsDVD && address.trim().length < 8) e2.address = 1;
    if (!express) {
      if (card.replace(/\D/g, "").length < 12) e2.card = 1;
      if (exp.length < 5) e2.exp = 1;
      if (cvc.length < 3) e2.cvc = 1;
      if (!/.+@.+\..+/.test(email)) e2.email = 1;
    }
    if (Object.keys(e2).length) { setErrs(e2); return; }
    if (!express) purchases.setEmail(email);
    setErrs({});
    setBusy(express ? "express" : "card");
    setTimeout(() => {
      prefs.set(Object.assign(prefs.get(), { faults: p.faults, music: p.music, sounds: p.sounds, public: p.public, flag }));
      items.forEach((it, i) => {
        /* the item's own settings if personalised, else the order defaults */
        const rp = it.pref || orderPref();
        purchases.add(itemKey(it), {
          horse: horseOf(it), rider: riderOf(it), event: it.ev.name, product: it.product,
          total: itemLines(it).reduce((s, l) => s + l[1], 0) + (i === 0 && dvd ? productPrices(first.ev).dvd : 0),
          sj: it.product === "xc" && it.addSJ, reel: it.product === "xc" && it.addReel,
          dvd: i === 0 && dvd, address: i === 0 && dvd ? address : undefined,
          fence: it.product === "fence" ? it.fence : undefined,
          manual: it.manual || undefined,
          faults: rp.faults, music: rp.music, sounds: rp.sounds, public: rp.public, flag: rp.flag
        });
      });
      /* paid videos leave the browse-basket — the bar disappears once settled */
      items.forEach((it) => { if (it.en) basket.remove(it.en.id); });
      setBusy("");
      setStep("done");
      if (onComplete) onComplete(itemKey(first));
    }, express ? 900 : 1500);
  }

  return (
    <div className="co2-overlay" onClick={(e) => { if (e.target === e.currentTarget && step === "pay") onClose(); }}>
      <div className="co2-sheet" role="dialog" aria-modal="true" aria-label="Checkout">
        {step === "pay" ? (
          <>
            <div className="co2-head">
              <h3>Complete Your Order</h3>
              <button className="co2-x" aria-label="Close" onClick={onClose}>✕</button>
            </div>
            <p className="co2-context">
              {multi
                ? items.length + " videos in this order"
                : horseOf(first) + (riderOf(first) ? " · " + tidyName(riderOf(first)) : "") + " · " + first.ev.name}
            </p>

            <div className="co2-lines">
              {items.map((it, idx) => (
                <div key={itemKey(it)} className="co2-item">
                  {multi && (
                    <div className="co2-item-head">
                      <span className="co2-item-horse">{horseOf(it)}</span>
                      <span className="co2-item-ev">{it.ev.name} · {eventYear(it.ev)}</span>
                      <button className="co2-item-x" aria-label={"Remove " + horseOf(it)} onClick={() => removeItem(idx)}>✕</button>
                    </div>
                  )}
                  {itemLines(it).map(([label, amt]) => (
                    <div key={label} className="co2-line"><span>{label}</span><span>{money(amt, it.ev.country)}</span></div>
                  ))}
                  {it.product === "xc" && (
                    <div className="co2-addons">
                      {!multi && <span className="co2-addons-label">Add to your video</span>}
                      <button className={"co2-addon-chip" + (it.addSJ ? " on" : "")} onClick={() => toggleAddon(idx, "addSJ")}>
                        {it.addSJ ? "✓ " : "+ "}Show Jumping {money(productPrices(it.ev).sjAdd, it.ev.country)}
                      </button>
                      <button className={"co2-addon-chip" + (it.addReel ? " on" : "")} onClick={() => toggleAddon(idx, "addReel")}>
                        {it.addReel ? "✓ " : "+ "}Social Reel {money(productPrices(it.ev).reelAdd, it.ev.country)}
                      </button>
                    </div>
                  )}
                  {multi && (
                    it.pref ? (
                      <div className="co2-itemprefs">
                        <div className="co2-itemprefs-head">
                          <span>Personalised for this video</span>
                          <button className="co2-reset" onClick={() => clearPref(idx)}>Use order settings</button>
                        </div>
                        <div className="co2-flagrow">
                          <span>Flag on video</span>
                          <span className="hp-flag">
                            <img src={"https://flagcdn.com/w40/" + it.pref.flag + ".png"} alt="" width="22" />
                            <select aria-label="Flag for this video" value={it.pref.flag} onChange={(e) => setPref(idx, { flag: e.target.value })}>
                              {FLAGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                            </select>
                          </span>
                        </div>
                        <label><input type="checkbox" checked={it.pref.faults} onChange={(e) => setPref(idx, { faults: e.target.checked })} /> Faults included (if incurred)</label>
                        <label><input type="checkbox" checked={it.pref.music} onChange={(e) => setPref(idx, { music: e.target.checked })} /> Music</label>
                        <label><input type="checkbox" checked={it.pref.sounds} onChange={(e) => setPref(idx, { sounds: e.target.checked })} /> Course sounds</label>
                        <label><input type="checkbox" checked={it.pref.public} onChange={(e) => setPref(idx, { public: e.target.checked })} /> Public video</label>
                      </div>
                    ) : (
                      <button className="co2-personalise-link" onClick={() => personalise(idx)}>+ Personalise this video</button>
                    )
                  )}
                </div>
              ))}
              {dvd && <div className="co2-line"><span>DVD copy (posted)</span><span>{money(productPrices(first.ev).dvd, first.ev.country)}</span></div>}
              <div className="co2-line total"><span>Total</span><span>{totalStr}</span></div>
            </div>

            {browseTarget && (
              <button className="co2-addmore" onClick={addAnother}>+ Add Another Video</button>
            )}

            <p className="co2-promise">
              {DELIVERY[tier].label}
              {items.some((it) => it.manual) ? " — unlisted orders take a little longer while we locate your round" : ""}
            </p>

            <div className="co2-prefs">
              <div className="co2-prefs-title">{multi ? "Default for all videos" : "Your video"}</div>
              {multi && items.some((it) => it.pref) && (
                <p className="co2-prefs-sub">Videos marked “personalised” keep their own settings.</p>
              )}
              <div className="co2-flagrow">
                <span>Flag on video</span>
                <span className="hp-flag">
                  <img src={"https://flagcdn.com/w40/" + flag + ".png"} alt="" width="22" />
                  <select aria-label="Rider nationality" value={flag} onChange={(e) => setFlag(e.target.value)}>
                    {FLAGS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </span>
              </div>
              <label><input type="checkbox" checked={p.faults} onChange={(e) => setP({ ...p, faults: e.target.checked })} /> Faults included (if incurred)</label>
              <label><input type="checkbox" checked={p.music} onChange={(e) => setP({ ...p, music: e.target.checked })} /> Music</label>
              <label><input type="checkbox" checked={p.sounds} onChange={(e) => setP({ ...p, sounds: e.target.checked })} /> Course sounds</label>
              <label><input type="checkbox" checked={p.public} onChange={(e) => setP({ ...p, public: e.target.checked })} /> Public video{multi ? "s" : ""}</label>
              <label className="co2-dvd"><input type="checkbox" checked={dvd} onChange={(e) => setDvd(e.target.checked)} /> DVD copy posted to you <span>+{money(productPrices(first.ev).dvd, first.ev.country)}</span></label>
              {dvd && (
                <textarea className={"co2-address" + (errs.address ? " field-err" : "")} rows={2}
                  placeholder="Postal address: house, street, town, postcode" value={address}
                  onChange={(e) => setAddress(e.target.value)} />
              )}
              <p className="co2-note">{p.public ? "Public videos may be featured on our social media." : "Private — only you receive the link."}</p>
            </div>

            {CHECKOUT_API ? (
              <>
                <label className="co2-label">Email for your video{multi ? "s" : ""}</label>
                <input type="email" className={errs.email ? "field-err" : ""} value={email} placeholder="you@example.com"
                  autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                {errs.api && <p className="co2-apierr" role="alert">{errs.api}</p>}
                <button className="btn primary big co2-pay" disabled={!!busy} onClick={payLive}>
                  {busy ? "Opening secure checkout…" : "Pay " + totalStr}
                </button>
                <p className="co2-note" style={{ textAlign: "center" }}>
                  Secure payment by Stripe — card, Apple Pay and Google Pay.
                </p>
              </>
            ) : (
              <>
                <button className="co2-express" disabled={!!busy} onClick={() => complete(true)}>
                  {busy === "express" ? "Confirming…" : "⚡ Express Checkout"}
                </button>
                <div className="co2-divider">or pay with card</div>
                <label className="co2-label">Email for your video{multi ? "s" : ""}</label>
                <input type="email" className={errs.email ? "field-err" : ""} value={email} placeholder="you@example.com"
                  autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                <label className="co2-label">Card details</label>
                <div className="co2-cardrow">
                  <input type="text" inputMode="numeric" className={errs.card ? "field-err" : ""} placeholder="1234 5678 9012 3456"
                    value={card} onChange={(e) => setCard(e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim())} />
                  <input type="text" inputMode="numeric" className={errs.exp ? "field-err" : ""} placeholder="MM/YY"
                    value={exp} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setExp(v.length > 2 ? v.slice(0, 2) + "/" + v.slice(2) : v); }} />
                  <input type="text" inputMode="numeric" className={errs.cvc ? "field-err" : ""} placeholder="CVC"
                    value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </div>
                <button className="btn primary big co2-pay" disabled={!!busy} onClick={() => complete(false)}>
                  {busy === "card" ? "Processing…" : "Pay " + totalStr}
                </button>
              </>
            )}
          </>
        ) : (
          <div className="co2-done">
            <div className="co2-tick">✓</div>
            <h3>Order Confirmed</h3>
            {multi ? (
              <ul className="co2-done-list">
                {items.map((it) => (
                  <li key={itemKey(it)}>{itemLines(it).map((l) => l[0]).join(" + ")} — <strong>{horseOf(it)}</strong> at {it.ev.name}</li>
                ))}
              </ul>
            ) : (
              <p className="co2-done-line">{itemLines(first).map((l) => l[0]).join(" + ")} — {horseOf(first)} at {first.ev.name}</p>
            )}
            <p className="co2-done-promise">
              {tier === "instant"
                ? "Your video is ready to watch right now."
                : "Your video" + (multi ? "s" : "") + " will arrive " + promiseDate(tier) + "."}
            </p>
            <p className="co2-done-spam">
              {multi ? "They" : "It"} will come from <strong>info@equireel.com</strong>{email ? " to " + email : ""} — check your spam folder if you don't see {multi ? "them" : "it"}.
              {wantsDVD ? " Your DVD will be posted within 14 days." : ""}
            </p>
            <div className="co2-done-actions">
              {tier === "instant" && !multi && first.en && first.product === "xc" && (
                <button className="btn primary big" onClick={() => { onClose(); order.onWatch && order.onWatch(); }}>Watch Your Video</button>
              )}
              <button className="btn big" onClick={onClose}>View Order Status</button>
              <a className="btn big" href={href("/event?id=" + first.ev.id)}>Order Another Horse</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/* Horse page — the shop. One horse at one event: identity confirmation,
   free clip (where the event has clips enabled), the order panel with
   add-ons and the delivery promise, and the archive shelves for upsell.
   Also serves unlisted orders (?ev=<id>&new=1) for late waitlist entries. */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Header, Footer, Crumbs } from "../../components/Chrome";
import HorseCard from "../../components/HorseCard";
import Checkout from "../../components/Checkout";
import NotifyMe from "../../components/NotifyMe";
import {
  href, asset, icons, EVENTS, getCountry, getEvent, findEntry, fmtRange, money,
  productPrices, deliveryOf, DELIVERY, FLAGS, defaultFlagFor, prefs,
  purchases, horseHistory, riderHistory, eventYear, onDataLoaded, entriesLoaded,
  showcaseFor, basket, tidyName, loadArchiveEntries
} from "../../lib/eq";
import * as player from "../../lib/player";

const ADDON_SAMPLES = {
  xc: { title: "Cross Country Video", desc: "Sample — Sarah Ennis & Onceuponatime, full round", video: asset("/assets/video/xc-sample.mp4?v=2"), thumb: asset("/assets/video/thumb-xc.jpg?v=3") },
  sj: { title: "Show Jumping Video", desc: "Sample — Alexander Bragg & Shannondale Bindi", video: asset("/assets/video/sj-sample.mp4?v=2"), thumb: asset("/assets/video/thumb-sj.jpg?v=3") },
  reel: { title: "Social Reel", desc: "Sample — Daniel Alderson & Annestown Royal Blue", video: asset("/assets/video/reel.mp4?v=3"), thumb: asset("/assets/video/thumb-reel.jpg?v=3") }
};

function HorseInner() {
  const params = useSearchParams();
  const isNew = params.get("new") === "1";
  const found = !isNew ? findEntry(params.get("id")) : null;
  const ev = isNew ? (getEvent(params.get("ev")) || EVENTS[0]) : (found ? found.ev : EVENTS[0]);
  const en = found ? found.en : null;
  const country = getCountry(ev.country);
  const ready = ev.status === "ready";
  const prices = productPrices(ev);

  const [mounted, setMounted] = useState(false);
  const [product, setProduct] = useState("xc");
  const [addSJ, setAddSJ] = useState(false);
  const [addReel, setAddReel] = useState(false);
  const [fenceNum, setFenceNum] = useState("");
  const [fenceDesc, setFenceDesc] = useState("");
  const [flag, setFlag] = useState(defaultFlagFor(ev, en));
  const [manual, setManual] = useState({ horse: "", rider: "", bib: "", start: "" });
  const [manualErr, setManualErr] = useState(false);
  const [checkout, setCheckout] = useState(null);
  const [pubVideo, setPubVideo] = useState(null);
  const [, forceRender] = useState(0);

  useEffect(() => { loadArchiveEntries(); return onDataLoaded(() => forceRender((n) => n + 1)); }, []);

  /* a delivered customer video for this exact round, made public by its
     owner — the site plays the real thing instead of a sample */
  const CHECKOUT_API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";
  useEffect(() => {
    setPubVideo(null);
    if (!CHECKOUT_API || !en || !en.bib) return;
    const ctrl = new AbortController();
    fetch(CHECKOUT_API + "/public-videos?e=" + encodeURIComponent(ev.id) +
          "&b=" + encodeURIComponent(String(en.bib)) +
          "&h=" + encodeURIComponent(en.horse), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const v = d && d.videos && d.videos.find(
          (x) => (x.h || "").toLowerCase() === en.horse.toLowerCase());
        if (v) setPubVideo(v.url);
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.id, en && en.id]);

  const horseName = en ? en.horse : manual.horse;
  const owned = mounted && en && purchases.has(en.id);
  const tier = isNew ? "standard" : deliveryOf(ev);

  useEffect(() => {
    setMounted(true);
    /* the flag default must follow the resolved event/entry (on direct loads
       the initial state was computed against a placeholder before entries
       arrived); a saved preference still wins — the flag belongs to the
       rider, not the event */
    const saved = prefs.get();
    setFlag(saved.flag || defaultFlagFor(ev, en));
    const t = setTimeout(() => {
      document.title = (en ? en.horse : "Order a Video") + " — " + ev.name + " — Equireel";
    }, 300);
    try { localStorage.setItem("equireel_last_event", JSON.stringify({ id: ev.id, at: Date.now() })); } catch (e) {}
    player.setOrderHandler(() => openCheckout("xc"));
    return () => { clearTimeout(t); player.setOrderHandler(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.id, en && en.id]);

  function openCheckout(prod) {
    if (isNew && !manual.horse.trim()) { setManualErr(true); return; }
    /* an order-in-progress rides along — one payment settles everything */
    const extras = basket.ids()
      .filter((id) => !en || id !== en.id)
      .map((id) => findEntry(id)).filter(Boolean)
      .map(({ en: e2, ev: v2 }) => ({ ev: v2, en: e2, product: "xc", addSJ: false, addReel: false }));
    setCheckout({
      items: [
        {
          ev, en, manual: isNew ? manual : null,
          product: prod || product, addSJ, addReel,
          fence: { num: fenceNum, desc: fenceDesc }
        },
        ...extras
      ],
      flag,
      onWatch: en ? () => player.open(en, ev) : null
    });
  }

  let total = prices.xc + (addSJ ? prices.sjAdd : 0) + (addReel ? prices.reelAdd : 0);
  if (product === "sj") total = prices.sjAlone;
  if (product === "fence") total = prices.fence;

  const historyHorse = en ? horseHistory(en.horse, ev.id, 4, { comboField: "rider", combo: en.rider, country: ev.country }) : [];
  const historyRider = en ? riderHistory(en.rider, ev.id, 5, { country: ev.country }).filter((h) => h.en.horse !== en.horse).slice(0, 4) : [];

  const PRODUCT_TITLES = { xc: "Cross Country Video", sj: "Show Jumping Video", fence: "Single Fence Video" };

  /* The static export prerenders this route with no query params, so the
     server HTML is the loading shell. The FIRST client render must match
     it exactly or hydration is discarded (and event handlers with it) —
     hence gate on `mounted`, not just on whether entries are loaded. */
  if (!mounted || (!isNew && !en && !entriesLoaded())) {
    return (
      <>
        <Header />
        <div className="container page-head"><p className="sub">Loading…</p></div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <div className="container page-head">
        <Crumbs trail={[
          { label: country.name, flag: country.code, href: href("/events?country=" + country.code) },
          { label: ev.name, href: href("/event?id=" + ev.id) },
          { label: en ? en.horse : "Order a Video" },
        ]} />
        <h1>
          {en ? (
            <a className="h1-link" href={href("/horses?name=" + encodeURIComponent(en.horse) + "&r=" + encodeURIComponent(en.rider) + "&c=" + ev.country)}
              title={"All of " + en.horse + "'s runs"}>
              {en.horse}
            </a>
          ) : "Order Without a Listing"}
        </h1>
        {en ? (
          <div className="hp-idrow">
            <a className="idchip idchip-link" href={href("/rider?name=" + encodeURIComponent(tidyName(en.rider)) + "&h=" + encodeURIComponent(en.horse) + "&c=" + ev.country)}>
              <span dangerouslySetInnerHTML={{ __html: icons.user }} style={{ display: "contents" }} />{tidyName(en.rider)}
            </a>
            <span className="idchip idchip-bib">Bib {en.bib}</span>
            {en.section && <span className="idchip"><span dangerouslySetInnerHTML={{ __html: icons.rosette }} style={{ display: "contents" }} />{en.section}</span>}
            {en.xcTime && <span className="idchip"><span dangerouslySetInnerHTML={{ __html: icons.cal }} style={{ display: "contents" }} />XC {en.xcDay ? en.xcDay + " " : ""}{en.xcTime}</span>}
            {en.owner && <span className="idchip"><span dangerouslySetInnerHTML={{ __html: icons.rosette }} style={{ display: "contents" }} />{en.owner}</span>}
            <a className="idchip idchip-link" href={href("/event?id=" + ev.id)}>
              <span dangerouslySetInnerHTML={{ __html: icons.pin }} style={{ display: "contents" }} />{ev.name} · {fmtRange(ev.date, ev.dateEnd)} {eventYear(ev)}
            </a>
          </div>
        ) : (
          <p className="sub">
            Ran here but not on our list? Late waitlist entries happen — we still filmed you.
            {" · "}{ev.name}, {fmtRange(ev.date, ev.dateEnd, "long")}
          </p>
        )}
      </div>

      <div className="container" style={{ paddingBottom: "56px" }}>
        <div className="hp-grid">

          {/* ---- media ---- */}
          <div className="hp-media">
            {en ? (
              <button className="hp-thumb" aria-label={pubVideo ? "Watch this round" : owned ? "Watch full round" : en.generic || !ready ? "Watch a sample round" : "Watch free clip"}
                onClick={() => player.open(en, ev, pubVideo ? { publicUrl: pubVideo } : undefined)}>
                <img src={en.thumb} alt=""
                  srcSet={en.thumb && en.thumb.endsWith(".webp") ? en.thumb.replace(".webp", "-sm.webp") + " 512w, " + en.thumb + " 1280w" : undefined}
                  sizes={en.thumb && en.thumb.endsWith(".webp") ? "(min-width: 900px) 640px, 100vw" : undefined} />
                <span className="freetag">
                  {pubVideo && !owned ? "FULL ROUND · WATCH FREE" : owned ? "PURCHASED" : en.generic || !ready ? "SAMPLE ROUND" : "FREE CLIP · FENCE " + en.fence}
                </span>
                <span className="playbtn" dangerouslySetInnerHTML={{ __html: icons.play }} />
              </button>
            ) : (
              <div className="hp-thumb hp-thumb-flat">
                <div className="hp-noimg">
                  <span dangerouslySetInnerHTML={{ __html: icons.rosette }} />
                  <p>Filmed at every fence — tell us who you are and we'll find your round.</p>
                </div>
              </div>
            )}
            {en && !owned && (
              <p className="hp-media-note">
                {pubVideo
                  ? "This round's official Equireel video is public — watch the real thing, start to finish."
                  : en.generic || !ready
                  ? "Watch a full sample round from start to finish — your own is waiting to be ordered."
                  : "Watch your free clip of fence " + en.fence + " — no purchase needed."}
              </p>
            )}
            {owned && (
              <p className="hp-media-note owned-note">You own this video — click to watch the full round any time.</p>
            )}
            {!ready && !owned && <NotifyMe ev={ev} en={en} />}
          </div>

          {/* ---- order panel ---- */}
          <div className="hp-panel">
            {isNew && (
              <div className="hp-manual">
                <label>Horse name <span className="req">required</span>
                  <input type="text" className={manualErr && !manual.horse.trim() ? "field-err" : ""} value={manual.horse}
                    placeholder="e.g. Cooley Firecracker"
                    onChange={(e) => { setManual({ ...manual, horse: e.target.value }); setManualErr(false); }} />
                </label>
                <label>Rider name <span className="opt">recommended</span>
                  <input type="text" value={manual.rider} placeholder="e.g. Sarah Whitfield"
                    onChange={(e) => setManual({ ...manual, rider: e.target.value })} />
                </label>
                <div className="hp-manual-row">
                  <label>Bib number <span className="opt">recommended</span>
                    <input type="text" inputMode="numeric" value={manual.bib} placeholder="e.g. 118"
                      onChange={(e) => setManual({ ...manual, bib: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                  </label>
                  {ev.askStartTime && (
                    <label>Approx. XC start time <span className="opt">optional</span>
                      <input type="text" value={manual.start} placeholder="e.g. 11:45"
                        onChange={(e) => setManual({ ...manual, start: e.target.value })} />
                    </label>
                  )}
                </div>
                {ev.askStartTime && <p className="hp-hint">Even a rough time helps us find you faster.</p>}
              </div>
            )}

            <div className="hp-product">
              <div className="hp-product-head">
                <h2>{PRODUCT_TITLES[product]}</h2>
                <span className="hp-price">{money(product === "sj" ? prices.sjAlone : product === "fence" ? prices.fence : prices.xc, ev.country)}</span>
              </div>
              {ADDON_SAMPLES[product] && (
                <button type="button" className="addon-sample hp-product-sample"
                  onClick={() => {
                    /* the XC sample is the section-relevant winner where one
                       exists; the credited global sample only as fallback */
                    if (product === "xc" && en && showcaseFor(ev, en)) player.open(en, ev);
                    else player.openSample(ADDON_SAMPLES[product]);
                  }}>
                  See a sample {product === "xc" ? "XC video" : ""}
                </button>
              )}

              {product === "xc" && (
                <div className="hp-addons">
                  <label className="addon-card">
                    <img className="addon-img port" src={ADDON_SAMPLES.reel.thumb} alt="" loading="lazy" />
                    <span className="addon-info">
                      <span className="addon-name">Add Social Reel</span>
                      <span className="addon-desc">Portrait edit, ready for Instagram &amp; TikTok</span>
                      <button type="button" className="addon-sample"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); player.openSample(ADDON_SAMPLES.reel); }}>
                        See sample
                      </button>
                    </span>
                    <span className="addon-price">+{money(prices.reelAdd, ev.country)}</span>
                    <input type="checkbox" checked={addReel} onChange={(e) => setAddReel(e.target.checked)} />
                  </label>
                  <label className="addon-card">
                    <img className="addon-img land" src={ADDON_SAMPLES.sj.thumb} alt="" loading="lazy" />
                    <span className="addon-info">
                      <span className="addon-name">Add Show Jumping</span>
                      <span className="addon-desc">Your full show jumping round</span>
                      <button type="button" className="addon-sample"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); player.openSample(ADDON_SAMPLES.sj); }}>
                        See sample
                      </button>
                    </span>
                    <span className="addon-price">+{money(prices.sjAdd, ev.country)}</span>
                    <input type="checkbox" checked={addSJ} onChange={(e) => setAddSJ(e.target.checked)} />
                  </label>
                </div>
              )}

              {product === "fence" && (
                <div className="hp-fence">
                  <label>Fence number
                    <input type="number" min="1" max="45" value={fenceNum} placeholder="e.g. 9"
                      onChange={(e) => setFenceNum(e.target.value)} />
                  </label>
                  <label>Description
                    <input type="text" value={fenceDesc} placeholder="Describe fence type, i.e. water, and/or incident"
                      onChange={(e) => setFenceDesc(e.target.value)} />
                  </label>
                </div>
              )}

              {owned && product === "xc" ? (
                <button className="btn primary big hp-order owned-btn" onClick={() => player.open(en, ev)}>Watch Your Video</button>
              ) : (
                <button className="btn primary big hp-order" onClick={() => openCheckout()}>
                  Order Now · {money(total, ev.country)}
                </button>
              )}
              {!owned && en && product === "xc" && (
                <button
                  className={"btn big hp-keep" + (basket.has(en.id) ? " added" : "")}
                  onClick={() => { if (basket.has(en.id)) basket.remove(en.id); else basket.add(en.id); forceRender((n) => n + 1); }}
                >
                  {basket.has(en.id) ? "✓ In your order — keep browsing" : "+ Add & keep browsing"}
                </button>
              )}
              <p className="hp-promise">
                {DELIVERY[tier].label}
                {isNew ? " — unlisted orders take a little longer while we locate your round" : ""}
              </p>

              <div className="hp-tiles-label">{product === "xc" ? "Also available on its own" : "Also available"}</div>
              <div className="hp-tiles">
                {["xc", "sj", "fence"].filter((k) => k !== product).map((k) => (
                  <button key={k} className="hp-tile" onClick={() => setProduct(k)}>
                    <span className="hp-tile-name">{PRODUCT_TITLES[k]}</span>
                    <span className="hp-tile-price">
                      {money(k === "xc" ? prices.xc : k === "sj" ? prices.sjAlone : prices.fence, ev.country)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="hp-details">
              <div className="hp-details-title">On your video</div>
              <div className="hp-details-row"><span>Rider</span><strong>{en ? tidyName(en.rider) : manual.rider || "—"}</strong></div>
              <div className="hp-details-row"><span>Horse</span><strong>{horseName || "—"}</strong></div>
              <div className="hp-details-row">
                <span>Flag</span>
                <span className="hp-flag">
                  <img src={"https://flagcdn.com/w40/" + flag + ".png"} alt="" width="22" />
                  <strong>{(FLAGS.find((f) => f[0] === flag) || ["", ""])[1]}</strong>
                </span>
              </div>
              <p className="hp-details-note">Wrong flag? You can change it at checkout. Name fixes are free — just reply to your confirmation email.</p>
            </div>
          </div>
        </div>

        {/* ---- archive shelves ---- */}
        {en && historyHorse.length > 0 && (
          <div className="hp-shelf">
            <p className="eyebrow">
              More of {en.horse}
              <a className="shelf-more" href={href("/horses?name=" + encodeURIComponent(en.horse) + "&r=" + encodeURIComponent(en.rider) + "&c=" + ev.country)}>View all →</a>
            </p>
            <div className="horse-list">
              {historyHorse.map(({ en: hen, ev: hev }) => (
                <HorseCard key={hen.id + hev.id} en={hen} ev={hev} showEvent={true} />
              ))}
            </div>
          </div>
        )}
        {en && historyRider.length > 0 && (
          <div className="hp-shelf">
            <p className="eyebrow">
              Also ridden by {tidyName(en.rider)}
              <a className="shelf-more" href={href("/rider?name=" + encodeURIComponent(tidyName(en.rider)) + "&h=" + encodeURIComponent(en.horse) + "&c=" + ev.country)}>View all →</a>
            </p>
            <div className="horse-list">
              {historyRider.map(({ en: ren, ev: rev }) => (
                <HorseCard key={ren.id + rev.id} en={ren} ev={rev} showEvent={true} />
              ))}
            </div>
          </div>
        )}
      </div>

      {checkout && (
        <Checkout order={checkout} onClose={() => setCheckout(null)} onComplete={() => forceRender((n) => n + 1)} />
      )}

      <Footer />
    </>
  );
}

export default function HorsePage() {
  return (
    <Suspense>
      <HorseInner />
    </Suspense>
  );
}

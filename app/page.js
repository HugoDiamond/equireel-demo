"use client";

/* Homepage — markup ported 1:1 from the static site's index.html. */

import { useEffect, useRef, useState } from "react";
import { Header, Footer } from "../components/Chrome";
import {
  asset, href, icons, COUNTRIES, currentEvents, getCountry, getEvent,
  fmtRange, purchases, searchResultsHTML
} from "../lib/eq";
import * as player from "../lib/player";

const REGION_PRICES = {
  gb: { xc: "From £60", reel: "Add-on £10", sj: "From £20" },
  ie: { xc: "From €70", reel: "Add-on €10", sj: "Selected events" },
  fr: { xc: "From €70", reel: "Add-on €20", sj: "Selected events" },
  us: { xc: "From $159", reel: "Add-on $20", sj: "Selected events" }
};
const PRICE_REGION = { gb: "gb", ie: "ie", fr: "fr", us: "us", be: "fr" };

const SAMPLES = [
  { key: "xc", title: "Cross Country Video", desc: "Every fence of your round — multi-camera, professionally edited.", video: asset("/assets/video/xc-sample.mp4?v=2"), thumb: asset("/assets/video/thumb-xc.jpg?v=3") },
  { key: "reel", title: "Social Reel", desc: "An add-on to your cross country video — a quicker edit of your footage in portrait, optimised for sharing on reels and stories.", video: asset("/assets/video/reel.mp4?v=3"), thumb: asset("/assets/video/thumb-reel.jpg?v=3") },
  { key: "sj", title: "Show Jumping Video", desc: "Add your show jumping video to your cross country order, or order it on its own.", video: asset("/assets/video/sj-sample.mp4?v=2"), thumb: asset("/assets/video/thumb-sj.jpg?v=3") }
];

function langCountry() {
  const l = (navigator.language || "").toLowerCase();
  if (l === "en-gb") return "gb";
  if (l === "en-us") return "us";
  if (l === "en-ie" || l === "ga-ie") return "ie";
  if (l === "fr-be" || l === "nl-be") return "be";
  if (l.indexOf("fr") === 0) return "fr";
  return null;
}

const DAY = 86400000;

function PartnerLogos() {
  return (
    <>
      <span className="partner-label">We proudly film with</span>
      <img src={asset("/assets/logos/fei.png")} alt="FEI — International Federation for Equestrian Sports" loading="lazy" />
      <img src={asset("/assets/logos/british-eventing.png")} alt="British Eventing" loading="lazy" />
      <img className="tall" src={asset("/assets/logos/usea.svg")} alt="United States Eventing Association" loading="lazy" />
      <img src={asset("/assets/logos/eventing-ireland.svg")} alt="Eventing Ireland" loading="lazy" />
      <img className="tall" src={asset("/assets/logos/ffe.svg")} alt="Fédération Française d'Équitation" loading="lazy" />
      <img src={asset("/assets/logos/pony-club-uk.png")} alt="The Pony Club" loading="lazy" />
      <img src={asset("/assets/logos/irish-pony-club.png")} alt="Irish Pony Club" loading="lazy" />
      <img src={asset("/assets/logos/british-team-chasing.png")} alt="British Team Chasing" loading="lazy" />
      <img className="tall" src={asset("/assets/logos/cotswold-cup.png")} alt="The Cotswold Cup" loading="lazy" />
    </>
  );
}

export default function Home() {
  const [country, setCountry] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const [hsHtml, setHsHtml] = useState("");
  const [placeholder, setPlaceholder] = useState("Search horse, rider, owner or event...");
  const hsRef = useRef(null);
  const heroSearchRef = useRef(null);
  const heroImgRef = useRef(null);

  /* region detection — same storage keys and fallbacks as v1 */
  useEffect(() => {
    const stored = sessionStorage.getItem("eq_country");
    if (stored) { setCountry(stored === "none" ? null : stored); }
    else {
      setCountry(langCountry());
      fetch("https://ipwho.is/?fields=country_code", { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined })
        .then((r) => r.json())
        .then((d) => {
          const map = { GB: "gb", IE: "ie", FR: "fr", US: "us", BE: "be" };
          const c = map[d.country_code] || null;
          sessionStorage.setItem("eq_country", c || "none");
          setCountry(c);
        })
        .catch(() => {});
    }
    if (window.matchMedia("(max-width: 480px)").matches) {
      setPlaceholder("Search horse, rider or event...");
    }
  }, []);

  /* continue bar — mission-aware, same rules as v1 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("equireel_last_event");
      let last = null;
      if (raw) {
        try { last = JSON.parse(raw); } catch (e2) { last = { id: raw, at: Date.now() }; }
      }
      let lastEv = last && getEvent(last.id);
      if (lastEv && Date.now() - (last.at || 0) > 30 * DAY) lastEv = null;
      if (lastEv) {
        const boughtAt = Object.keys(purchases.all())
          .filter((k) => k.indexOf(lastEv.id + "-") === 0)
          .map((k) => +new Date(purchases.all()[k].at));
        if (boughtAt.length && Date.now() - Math.max.apply(null, boughtAt) > 5 * DAY) lastEv = null;
      }
      if (lastEv) setLastEvent(lastEv);
    } catch (e) {}
  }, []);

  /* ambient hero footage loop — desktop only, respects reduced motion */
  useEffect(() => {
    if (!window.matchMedia("(min-width: 900px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hv = document.createElement("video");
    hv.className = "hero-bg";
    hv.muted = true; hv.loop = true; hv.playsInline = true; hv.autoplay = true;
    hv.setAttribute("aria-hidden", "true");
    hv.src = asset("/assets/video/hero-loop3.mp4");
    const swap = () => {
      hv.removeEventListener("canplaythrough", swap);
      if (heroImgRef.current) heroImgRef.current.replaceWith(hv);
      const p = hv.play(); if (p) p.catch(() => {});
    };
    hv.addEventListener("canplaythrough", swap);
    hv.load();
    return () => hv.removeEventListener("canplaythrough", swap);
  }, []);

  function hsInput(e) { setHsHtml(searchResultsHTML(e.target.value)); }
  function hsKey(e) {
    if (e.key === "Enter" && hsRef.current) {
      const a = hsRef.current.querySelector("a");
      if (a) window.location.href = a.href;
    }
    if (e.key === "Escape") setHsHtml("");
  }
  useEffect(() => {
    const onDoc = (e) => { if (!e.target.closest(".hero-search")) setHsHtml(""); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const evs = currentEvents(14);
  const liveList = (country
    ? evs.filter((e) => e.country === country).concat(evs.filter((e) => e.country !== country))
    : evs
  ).slice(0, 6);
  const countryList = country
    ? COUNTRIES.filter((c) => c.code === country).concat(COUNTRIES.filter((c) => c.code !== country))
    : COUNTRIES;
  const prices = REGION_PRICES[PRICE_REGION[country] || "gb"] || REGION_PRICES.gb;

  return (
    <>
      <Header hideSearchInitially={true} />

      {lastEvent && (
        <div className="continue-bar">
          <a href={href("/event?id=" + lastEvent.id)}>
            <span className="cb-label">Continue where you left off</span>
            <span className="cb-event">{lastEvent.name}</span>
            <span dangerouslySetInnerHTML={{ __html: icons.chevR }} style={{ display: "contents" }} />
          </a>
          <button className="cb-close" aria-label="Dismiss"
            onClick={() => { localStorage.removeItem("equireel_last_event"); setLastEvent(null); }}
            dangerouslySetInnerHTML={{ __html: icons.x }} />
        </div>
      )}

      <section className="eq-hero">
        <img ref={heroImgRef} className="hero-bg" src={asset("/assets/hero.jpg")}
          srcSet={asset("/assets/hero-mobile.jpg") + " 800w, " + asset("/assets/hero.jpg") + " 2400w"}
          sizes="100vw" fetchPriority="high" alt="" />
        <div className="hero-shade"></div>
        <div className="container hero-inner">
          <p className="kicker">Professional cross country videos</p>
          <h1>EVERY RIDER.<br /><span className="accent">EVERY FENCE.</span></h1>
          <p className="tag">No pre-booking. If we were at your event, we have your round — professionally filmed, edited and ready to watch.</p>
          <div className="hero-search" ref={heroSearchRef}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input id="hq" type="text" placeholder={placeholder} autoComplete="off"
              aria-label="Search horse, rider, owner or event" onInput={hsInput} onKeyDown={hsKey} />
            <div ref={hsRef} className="hs-results" style={{ display: hsHtml ? "block" : "none" }}
              dangerouslySetInnerHTML={{ __html: hsHtml }} />
          </div>
          <div className="hero-cta">
            <a className="btn primary big" href="#live">Find Your Event</a>
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div className="container">
          <div className="proof-items">
            <span className="proof-item"><strong>88%</strong> of riders recommend us <span className="proof-src">· Facebook reviews</span></span>
            <span className="proof-item"><strong>50,000+</strong> rounds delivered</span>
            <span className="proof-item"><strong>200+</strong> events filmed each season</span>
          </div>
          <div className="partner-row partner-top"><PartnerLogos /></div>
        </div>
      </section>

      <section className="container section-block" id="live">
        <p className="eyebrow"><span className="live-dot" aria-hidden="true"></span>Latest events</p>
        <h2 className="section-title">Just ran — order your round</h2>
        <div className="live-grid">
          {liveList.map((e) => (
            <a key={e.id} className="live-card" href={href("/event?id=" + e.id)}>
              <img className="flagimg" src={"https://flagcdn.com/w80/" + e.country + ".png"} alt={getCountry(e.country).name} />
              <div className="live-info">
                <h3>{e.name}</h3>
                <p><span className="d">{fmtRange(e.date, e.dateEnd)}</span> · {e.body}</p>
              </div>
              <span className="go" dangerouslySetInnerHTML={{ __html: icons.chevR }} />
            </a>
          ))}
        </div>
      </section>

      <section className="container section-block" id="countries">
        <p className="eyebrow">All events</p>
        <h2 className="section-title">Browse by country</h2>
        <div className="country-grid">
          {countryList.map((c) => (
            <a key={c.code} className="country-card" href={href("/events?country=" + c.code)}>
              <img className="flagimg" src={"https://flagcdn.com/w80/" + c.code + ".png"} alt="" width="46" />
              <h3>{c.name}</h3>
              <span className="go" dangerouslySetInnerHTML={{ __html: icons.chevR }} />
            </a>
          ))}
        </div>
      </section>

      <section className="container section-block" id="samples">
        <p className="eyebrow">Our videos</p>
        <h2 className="section-title">What you get</h2>
        <div className="sample-grid">
          {SAMPLES.map((s) => (
            <button key={s.key} className="sample-tile" onClick={() => player.openSample(s)}>
              <span className="st-img">
                <img src={s.thumb} alt="" loading="lazy" />
                <span className="freetag">SAMPLE</span>
                <span className="playbtn" dangerouslySetInnerHTML={{ __html: icons.play }} />
              </span>
              <span className="st-body">
                <strong>{s.title} <span className="price-chip">{prices[s.key]}</span></strong>
                <small>{s.desc}</small>
              </span>
            </button>
          ))}
        </div>

        <p className="eyebrow" style={{ marginTop: "34px" }}>What Eventers say</p>
        <div className="quotes" style={{ marginTop: 0 }}>
          <figure className="quote">
            <blockquote>&ldquo;I received the video today after only competing yesterday. The cameras are set up at good angles and the video itself is very well edited — I highly recommend!&rdquo;</blockquote>
            <figcaption>Kelly Jane Dunnington · Rider</figcaption>
          </figure>
          <figure className="quote">
            <blockquote>&ldquo;We were unable to watch our horse event in the week, but seeing his full round of XC makes it feel like we were there.&rdquo;</blockquote>
            <figcaption>Gemma Cornick · Owner</figcaption>
          </figure>
          <figure className="quote">
            <blockquote>&ldquo;So helpful to see yourself as a training aid and to relive your round. If you are considering it, don't hesitate — really good value for money.&rdquo;</blockquote>
            <figcaption>Dr Maggie Wilson · Rider</figcaption>
          </figure>
        </div>
      </section>

      <section className="how-band" id="how">
        <div className="container">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title" style={{ color: "#fff" }}>From the start box to your inbox</h2>
          <div className="how-grid">
            <a className="how-card" href="#countries">
              <span className="num">01</span>
              <h3>Find your video</h3>
              <p>Search the horse, rider or bib number — or browse the latest events and countries.</p>
            </a>
            <a className="how-card" href="#countries">
              <span className="num">02</span>
              <h3>Order in seconds</h3>
              <p>Tap the horse and check out in under a minute — express pay or card, no account needed.</p>
            </a>
            <a className="how-card" href="#countries">
              <span className="num">03</span>
              <h3>Watch your round</h3>
              <p>Your full round, professionally filmed and edited — delivered to your inbox, yours to keep and share.</p>
            </a>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container">
          <h2>Ready to watch your round?</h2>
          <p>Find your event, tap your horse, and it&rsquo;s yours in minutes.</p>
          <a className="btn big cta-btn" href="#live">Find Your Event</a>
        </div>
      </section>

      <div className="partner-strip">
        <div className="container">
          <div className="partner-row partner-bottom"><PartnerLogos /></div>
        </div>
      </div>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Equireel",
          url: "https://hugodiamond.github.io/equireel-demo/",
          logo: "https://hugodiamond.github.io/equireel-demo/assets/logo-camera.png",
          email: "info@equireel.com",
          sameAs: [
            "https://www.facebook.com/Equireel",
            "https://www.instagram.com/equireel_official/",
            "https://x.com/equireel"
          ]
        }) }}
      />
    </>
  );
}

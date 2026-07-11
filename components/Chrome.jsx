"use client";

/* Header (with global search overlay) and Footer — markup identical to v1's
   renderHeader/renderFooter in js/app.js. */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { asset, href, icons, searchResultsHTML, loadRealEntries, loadArchiveEntries } from "../lib/eq";
import { track, pageview } from "../lib/track";
import OrderBar from "./OrderBar";
import ChatWidget from "./ChatWidget";

export function Header({ hideSearchInitially = false }) {
  const pathname = usePathname();
  const [gsOpen, setGsOpen] = useState(false);
  const [gsHtml, setGsHtml] = useState("");
  const [btnHidden, setBtnHidden] = useState(hideSearchInitially);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  /* the header is on every page — kick off the real-entries fetch once,
     log the pageview (first-party, no cookies), and idle-prefetch the
     2019-22 archive so search covers every season without slowing paint */
  useEffect(() => {
    loadRealEntries();
    pageview();
    const t = setTimeout(() => loadArchiveEntries(), 2500);
    return () => clearTimeout(t);
  }, []);

  /* search queries are marketing gold — log what settles, not every key */
  const searchTimer = useRef(null);

  useEffect(() => {
    if (!hideSearchInitially) return;
    const heroSearch = document.querySelector(".hero-search");
    if (!heroSearch || !("IntersectionObserver" in window)) { setBtnHidden(false); return; }
    const io = new IntersectionObserver(
      (en) => setBtnHidden(en[0].isIntersecting),
      { rootMargin: "-70px 0px 0px 0px" }
    );
    io.observe(heroSearch);
    return () => io.disconnect();
  }, [hideSearchInitially]);

  useEffect(() => {
    if (gsOpen && inputRef.current) {
      const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
      document.body.style.overflow = "hidden";
      return () => { clearTimeout(t); document.body.style.overflow = ""; };
    }
  }, [gsOpen]);

  function onInput(e) {
    const q = e.target.value;
    setGsHtml(searchResultsHTML(q));
    clearTimeout(searchTimer.current);
    if (q.trim().length >= 3) {
      searchTimer.current = setTimeout(() => track("search", { q: q.trim().slice(0, 80) }), 900);
    }
  }
  function onKey(e) {
    if (e.key === "Enter" && resultsRef.current) {
      const a = resultsRef.current.querySelector("a");
      if (a) window.location.href = a.href;
    }
    if (e.key === "Escape") setGsOpen(false);
  }

  return (
    <>
      <header className="eq-header">
        <div className="container">
          <a className="eq-logo" href={href("/")} aria-label="Equireel home">
            <img src={asset("/assets/logo-camera.png")} alt="" />
            <span className="wordmark">EQUIREEL</span>
          </a>
          <nav className="eq-nav">
            <a className="nav-link" href={href("/#how")}>How it works</a>
            <a className={"nav-link" + (pathname && pathname.startsWith("/calendar") ? " active" : "")} href={href("/calendar")}>Calendar</a>
            <a className={"nav-link" + (pathname && pathname.startsWith("/faq") ? " active" : "")} href={href("/faq")}>FAQ</a>
            <button
              className={"gs-btn" + (btnHidden ? " hidden" : "")}
              aria-label="Search"
              onClick={() => { setGsHtml(""); setGsOpen(true); loadArchiveEntries(); }}
              dangerouslySetInnerHTML={{ __html: icons.search }}
            />
            <a className="pill" href={href("/#live")}>Order Videos</a>
          </nav>
        </div>
      </header>

      {gsOpen && (
        <div className="gs-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setGsOpen(false); }}>
          <div className="gs-panel">
            <div className="gs-bar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                ref={inputRef}
                id="gs-input"
                type="text"
                placeholder="Search horse, rider or event..."
                autoComplete="off"
                aria-label="Search"
                onInput={onInput}
                onKeyDown={onKey}
              />
              <button className="gs-close" aria-label="Close search" onClick={() => setGsOpen(false)}
                dangerouslySetInnerHTML={{ __html: icons.x }} />
            </div>
            <div
              ref={resultsRef}
              className="hs-results gs-results"
              style={{ display: gsHtml ? "block" : "none" }}
              dangerouslySetInnerHTML={{ __html: gsHtml }}
            />
          </div>
        </div>
      )}

      <OrderBar />
      <ChatWidget />
    </>
  );
}

/* Breadcrumb trail — home icon chip, chevron separators, pill links.
   trail: [{ label, href?, flag? }] — last item is usually the current page. */
export function Crumbs({ trail }) {
  const chev = (
    <svg className="crumb-sep" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
  );
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <a className="crumb crumb-home" href={href("/")} aria-label="Home" title="Home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10.5 9-7.5 9 7.5" /><path d="M5 9v11h14V9" /></svg>
      </a>
      {trail.map((c, i) => {
        const inner = (
          <>
            {c.flag && <img src={"https://flagcdn.com/w40/" + c.flag + ".png"} alt="" />}
            <span className="crumb-label">{c.label}</span>
          </>
        );
        return (
          <span className="crumb-step" key={i}>
            {chev}
            {c.href
              ? <a className="crumb" href={c.href}>{inner}</a>
              : <span className="crumb here" aria-current="page">{inner}</span>}
          </span>
        );
      })}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="eq-footer">
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={asset("/assets/logo-camera.png")} alt="" style={{ height: "34px", width: "auto" }} />
          <div>
            <div className="brand">EQUIREEL</div>
            <div>Every Rider. Every Fence.</div>
          </div>
        </div>
        <div className="f-right">
          <div className="socials">
            <a href="https://www.facebook.com/Equireel" aria-label="Equireel on Facebook" target="_blank" rel="noopener"
              dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6c-.3-.04-1.3-.13-2.5-.13-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13H10v8z"/></svg>' }} />
            <a href="https://www.instagram.com/equireel_official/" aria-label="Equireel on Instagram" target="_blank" rel="noopener"
              dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none"/></svg>' }} />
          </div>
          <span className="f-countries">
            <a href={href("/events?country=gb")}>UK</a> · <a href={href("/events?country=us")}>USA</a> · <a href={href("/events?country=fr")}>France</a> · <a href={href("/events?country=ie")}>Ireland</a> · <a href={href("/events?country=be")}>Belgium</a>
          </span>
          <span className="f-meta"><a href={href("/calendar")}>Calendar</a> · <a href={href("/faq")}>FAQ</a> · <a href={href("/terms")}>Terms</a> · <a href={href("/privacy")}>Privacy</a> · <a href="mailto:info@equireel.com">info@equireel.com</a></span>
        </div>
      </div>
    </footer>
  );
}

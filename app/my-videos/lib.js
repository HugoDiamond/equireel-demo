"use client";

/* My Videos — the passwordless account. Email in → sign-in link → library.
   The 12-month session token lives in localStorage ("keep me signed in",
   default on) or sessionStorage (shared computer). */

import { useEffect, useState } from "react";
import { href } from "../../lib/eq";
import { track } from "../../lib/track";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";
const KEY = "equireel_session";

function getSession() {
  return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "";
}
function setSession(tok, keep) {
  (keep ? localStorage : sessionStorage).setItem(KEY, tok);
  (keep ? sessionStorage : localStorage).removeItem(KEY);
}
function clearSession() {
  localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
}

const CUR = { GBP: "£", EUR: "€", USD: "$" };

function Item({ it }) {
  const links = [["Watch your video", it.video], ["Social reel", it.reel], ["Show jumping", it.sj]]
    .filter(([, u]) => u);
  return (
    <div className="mv-item">
      <div className="mv-item-main">
        <div className="mv-horse">{it.horse}</div>
        <div className="mv-meta">{[it.rider, it.event, it.product].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="mv-act">
        {links.length
          ? links.map(([label, u], i) => (
            <a key={i} className={"btn" + (i === 0 ? " primary" : "")} href={u} target="_blank" rel="noopener"
              onClick={() => track("video_play", { src: "my_videos" })}>{label}</a>
          ))
          : <span className="cal-soon">In the edit — delivered by email soon</span>}
      </div>
    </div>
  );
}

export default function MyVideos() {
  const [phase, setPhase] = useState("boot"); // boot | ask | sent | lib
  const [email, setEmail] = useState("");
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lib, setLib] = useState(null);

  useEffect(() => {
    if (!API) { setPhase("ask"); return; }
    const url = new URL(window.location.href);
    const t = url.searchParams.get("t");
    const tok = t || getSession();
    if (!tok) { setPhase("ask"); return; }
    fetch(API + "/my-videos?t=" + encodeURIComponent(tok))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (t) {
          if (d.session) setSession(d.session, true);
          url.searchParams.delete("t");
          window.history.replaceState({}, "", url.pathname);
          track("signin", {});
        }
        setLib(d); setPhase("lib");
      })
      .catch(() => { clearSession(); setPhase("ask"); if (t) setErr("That link has expired — enter your email for a fresh one."); });
  }, []);

  async function request(e) {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) { setErr("Enter the email you order with."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(API + "/my-videos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!r.ok) throw new Error();
      try { localStorage.setItem("equireel_keep", keep ? "1" : "0"); } catch (e2) {}
      setPhase("sent");
    } catch (e2) { setErr("Couldn't send just now — try again in a minute."); }
    setBusy(false);
  }

  if (phase === "boot") return <p className="cal-empty">Opening your library…</p>;

  if (phase === "sent") {
    return (
      <div className="mv-gate">
        <p className="notify-done">✓ If we&rsquo;ve filmed for <strong>{email}</strong>, a sign-in link is on its way —
          check your inbox (and spam) and click it on this device.</p>
      </div>
    );
  }

  if (phase === "ask") {
    return (
      <div className="mv-gate">
        <p>Enter the email you order with — we&rsquo;ll send a sign-in link. No password, nothing to remember.</p>
        <form onSubmit={request} className="cal-notify" style={{ maxWidth: 440 }}>
          <input type="email" autoFocus placeholder="you@example.com" value={email}
            onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
          <button className="btn primary" disabled={busy} type="submit">{busy ? "Sending…" : "Email me a link"}</button>
        </form>
        <label className="ig-check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Keep me signed in on this device
        </label>
        {err && <p className="aq-err">{err}</p>}
      </div>
    );
  }

  const orders = (lib && lib.orders) || [];
  return (
    <div className="mv">
      <div className="mv-bar">
        <span>Signed in as <strong>{lib.email}</strong></span>
        <button className="mv-signout" onClick={() => { clearSession(); setLib(null); setPhase("ask"); }}>Sign out</button>
      </div>
      {!orders.length && (
        <p className="cal-empty">No videos on this email yet — if you&rsquo;ve ordered under a different address,
          sign in with that one, or <a href={href("/")}>find your horse</a> to order your first.</p>
      )}
      {orders.map((o) => (
        <section className="mv-order" key={o.id}>
          <h2>{new Date(o.at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            <span className="mv-oid"> · order #{o.id} · {(CUR[o.currency] || "£") + o.charged}</span></h2>
          {o.items.map((it, i) => <Item key={i} it={it} />)}
        </section>
      ))}
    </div>
  );
}

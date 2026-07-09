"use client";

/* Editor order queue — read-only view of paid website orders.
   Outstanding = any item without a delivered video (video_link empty);
   the upload webhook flips items to Delivered automatically.
   Auth: the shared ADMIN_KEY, asked once and kept in this browser. */

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";
const KEY_STORE = "equireel_admin_key";
const CUR = { GBP: "£", EUR: "€", USD: "$" };

function age(iso) {
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (days < 1) return { label: "today", cls: "ok" };
  const d = Math.floor(days);
  return { label: d + (d === 1 ? " day" : " days"), cls: d >= 4 ? "late" : d >= 3 ? "warn" : "ok" };
}

export default function OrdersQueue() {
  const [key, setKey] = useState("");
  const [entered, setEntered] = useState("");
  const [state, setState] = useState("init"); // init | need-key | loading | ok | badkey | error | demo
  const [orders, setOrders] = useState([]);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!API) { setState("demo"); return; }
    const saved = localStorage.getItem(KEY_STORE) || "";
    if (saved) { setKey(saved); load(saved); } else setState("need-key");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(k) {
    setState("loading");
    try {
      const r = await fetch(API + "/admin-orders", { headers: { "X-Admin-Key": k } });
      if (r.status === 401) { localStorage.removeItem(KEY_STORE); setState("badkey"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json();
      localStorage.setItem(KEY_STORE, k);
      setOrders(d.orders || []);
      setState("ok");
    } catch (e) { setState("error"); }
  }

  function copy(label) {
    navigator.clipboard.writeText(label).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    }).catch(() => {});
  }

  if (state === "demo") return <div className="aq-gate"><h1>Order queue</h1><p>Not available on the demo — use the live site.</p></div>;
  if (state === "init") return null;

  if (state === "need-key" || state === "badkey") {
    return (
      <div className="aq-gate">
        <h1>Order queue</h1>
        {state === "badkey" && <p className="aq-err">That key wasn&rsquo;t right — try again.</p>}
        <p>Enter the team key to view orders.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (entered.trim()) load(entered.trim()); }}>
          <input type="password" autoFocus value={entered} placeholder="Team key"
            onChange={(e) => setEntered(e.target.value)} />
          <button className="btn primary" type="submit">Open queue</button>
        </form>
      </div>
    );
  }
  if (state === "loading") return <div className="aq-gate"><p>Loading orders…</p></div>;
  if (state === "error") return <div className="aq-gate"><h1>Order queue</h1><p>Couldn&rsquo;t load orders — try refreshing.</p></div>;

  const outstanding = orders.filter((o) => o.items.some((i) => !i.delivered));
  const delivered = orders.filter((o) => o.items.length && o.items.every((i) => i.delivered));

  const Row = ({ o }) => (
    <div className={"aq-order" + (o.status === "Test" ? " test" : "")}>
      <div className="aq-order-head">
        <strong>#{o.id}</strong>
        <span>{(CUR[o.currency] || "") + (o.charged || 0)}</span>
        <span className={"aq-age " + age(o.at).cls}>{age(o.at).label}</span>
        {o.status === "Test" && <span className="aq-test">TEST</span>}
        <span className="aq-email">{o.email}</span>
      </div>
      {o.items.map((it, i) => (
        <div key={i} className={"aq-item" + (it.delivered ? " done" : "")}>
          <span className="aq-status">{it.delivered ? "✓" : "•"}</span>
          <div className="aq-item-main">
            <button className="aq-label" title="Click to copy — use as the upload filename"
              onClick={() => copy(it.label)}>
              {it.label}{copied === it.label ? "  ✓ copied" : ""}
            </button>
            <div className="aq-item-sub">
              {it.product} — {(CUR[o.currency] || "")}{it.price}
              {it.day || it.time ? <> · {it.day} {it.time}</> : null}
              {it.delivered && it.url && <> · <a href={it.url} target="_blank" rel="noopener">watch</a></>}
            </div>
            <div className="aq-prefs">
              {it.prefs ? (
                <>
                  <span className="aq-pref"><img src={"https://flagcdn.com/w20/" + it.prefs.flag + ".png"} alt="" width="16" /> {String(it.prefs.flag).toUpperCase()} flag</span>
                  <span className={"aq-pref" + (it.prefs.faults === "exclude" ? " off" : "")}>faults {it.prefs.faults === "exclude" ? "EXCLUDED" : "in"}</span>
                  <span className={"aq-pref" + (it.prefs.music === "off" ? " off" : "")}>music {it.prefs.music}</span>
                  <span className={"aq-pref" + (it.prefs.sounds === "off" ? " off" : "")}>sounds {it.prefs.sounds}</span>
                  <span className={"aq-pref" + (it.prefs.public === "no" ? " off" : "")}>{it.prefs.public === "no" ? "PRIVATE" : "public ok"}</span>
                </>
              ) : (
                <>
                  <span className={"aq-pref" + (o.faults === "no" ? " off" : "")}>faults {o.faults === "no" ? "EXCLUDED" : "in"}</span>
                  <span className={"aq-pref" + (!o.public ? " off" : "")}>{o.public ? "public ok" : "PRIVATE"}</span>
                  <span className="aq-pref">full prefs in the order email</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="aq">
      <div className="aq-head">
        <h1>Order queue</h1>
        <p className="aq-counts">
          <strong>{outstanding.length}</strong> outstanding · {delivered.length} delivered
          <button className="aq-refresh" onClick={() => load(key)}>Refresh</button>
        </p>
      </div>
      <h2 className="aq-sec">Outstanding</h2>
      {outstanding.length ? outstanding.map((o) => <Row key={o.id} o={o} />) : <p className="aq-empty">Nothing owed — queue clear. 🎉</p>}
      <h2 className="aq-sec">Delivered</h2>
      {delivered.length ? delivered.map((o) => <Row key={o.id} o={o} />) : <p className="aq-empty">None yet.</p>}
      <p className="aq-note">Click any order label to copy it — save the finished video with that exact filename and
        delivery happens automatically (email to the customer, queue updates itself).</p>
    </div>
  );
}

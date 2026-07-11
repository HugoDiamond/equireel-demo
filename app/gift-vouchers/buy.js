"use client";

/* Gift vouchers — variable-amount, either currency, optional direct-to-
   recipient email with a personal message. Paid through the same regional
   Stripe accounts; the webhook mints the code after payment. */

import { useEffect, useState } from "react";
import { track } from "../../lib/track";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";
const PRESETS = { GBP: [30, 60, 90, 150], EUR: [30, 70, 100, 160] };
const SYM = { GBP: "£", EUR: "€" };

export default function BuyVoucher() {
  const [done, setDone] = useState(false);
  const [cur, setCur] = useState("GBP");
  const [amount, setAmount] = useState(60);
  const [custom, setCustom] = useState("");
  const [toThem, setToThem] = useState(false);
  const [f, setF] = useState({ email: "", recipientName: "", recipientEmail: "", message: "" });
  const [state, setState] = useState("idle");
  const [err, setErr] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("done")) { setDone(true); track("voucher_done", {}); }
  }, []);

  const sym = SYM[cur];
  const amt = custom !== "" ? Math.round(Number(custom)) : amount;
  const amtOk = Number.isFinite(amt) && amt >= 10 && amt <= 500;
  const can = amtOk && /.+@.+\..+/.test(f.email) &&
    (!toThem || /.+@.+\..+/.test(f.recipientEmail)) && state !== "busy";

  async function buy(e) {
    e.preventDefault();
    if (!API) { setErr("Ordering runs on the live site."); return; }
    setState("busy"); setErr("");
    try {
      const r = await fetch(API + "/vouchers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkout",
          amount: amt, currency: cur, email: f.email,
          recipientName: toThem ? f.recipientName : "",
          recipientEmail: toThem ? f.recipientEmail : "",
          message: toThem ? f.message : ""
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) { setErr(d.message || d.error || "Couldn't start checkout — try again."); setState("idle"); return; }
      track("voucher_checkout", { amt, cur });
      window.location.href = d.url;
    } catch (e2) { setErr("Network problem — try again."); setState("idle"); }
  }

  if (done) {
    return (
      <div className="gv-done">
        <p className="notify-done">✓ Voucher paid — it&rsquo;s on its way by email (check spam the first time).
          The code is valid for 24 months on any Equireel video.</p>
      </div>
    );
  }

  return (
    <form className="gv" onSubmit={buy}>
      <div className="gv-row">
        <div className="gv-cur" role="group" aria-label="Currency">
          {["GBP", "EUR"].map((c) => (
            <button key={c} type="button" className={"gv-pill" + (cur === c ? " on" : "")}
              onClick={() => { setCur(c); setCustom(""); setAmount(PRESETS[c][1]); }}>{SYM[c]} {c}</button>
          ))}
        </div>
      </div>
      <div className="gv-amounts">
        {PRESETS[cur].map((a) => (
          <button key={a} type="button" className={"gv-amt" + (custom === "" && amount === a ? " on" : "")}
            onClick={() => { setAmount(a); setCustom(""); }}>{sym}{a}</button>
        ))}
        <input className={"gv-custom" + (custom !== "" ? " on" : "")} placeholder={"Other " + sym}
          inputMode="numeric" value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ""))} />
      </div>
      {custom !== "" && !amtOk && <p className="aq-err">Choose between {sym}10 and {sym}500.</p>}

      <label className="gv-field">Your email (for the receipt{toThem ? "" : " and the voucher"})
        <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" />
      </label>

      <label className="ig-check" style={{ margin: "10px 0" }}>
        <input type="checkbox" checked={toThem} onChange={(e) => setToThem(e.target.checked)} />
        Email it straight to the recipient with a message
      </label>

      {toThem && (
        <div className="gv-them">
          <div className="gv-2col">
            <label className="gv-field">Their name<input value={f.recipientName}
              onChange={(e) => setF({ ...f, recipientName: e.target.value })} /></label>
            <label className="gv-field">Their email<input type="email" value={f.recipientEmail}
              onChange={(e) => setF({ ...f, recipientEmail: e.target.value })} /></label>
          </div>
          <label className="gv-field">Your message (goes at the top of their email)
            <textarea rows={2} maxLength={400} value={f.message}
              onChange={(e) => setF({ ...f, message: e.target.value })}
              placeholder="Happy birthday! Treat yourself to your round at..." />
          </label>
        </div>
      )}

      <button className="btn primary big" disabled={!can} type="submit" style={{ marginTop: 14 }}>
        {state === "busy" ? "Opening secure checkout…" : `Buy ${sym}${amtOk ? amt : "—"} gift voucher`}
      </button>
      {err && <p className="aq-err">{err}</p>}
      <p className="gv-fine">Valid 24 months · spends like cash on any video · any remaining balance stays on the code.</p>
    </form>
  );
}

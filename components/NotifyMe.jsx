"use client";

/* "Email me when it's ready" — capture for events whose videos are still in
   the edit. The highest-intent marketing list there is: riders asking to be
   sold to at the exact right moment. Silent no-op on the static demo. */

import { useState } from "react";
import { track } from "../lib/track";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";

export default function NotifyMe({ ev, en }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | busy | done | err

  if (!API) return null;

  async function submit(e) {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) { setState("err"); return; }
    setState("busy");
    try {
      const r = await fetch(API + "/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email, e: ev.id, evName: ev.name,
          h: en ? en.horse : "", r: en ? en.rider : "", b: en ? String(en.bib || "") : ""
        })
      });
      if (!r.ok) { setState("err"); return; }
      track("notify_signup", { ev: ev.id, h: en ? en.horse : "" });
      setState("done");
    } catch (err) { setState("err"); }
  }

  if (state === "done") {
    return <p className="notify-done">✓ You&rsquo;re on the list — we&rsquo;ll email you the moment {en ? "this video" : "these videos"} can be ordered.</p>;
  }
  return (
    <form className="notify" onSubmit={submit}>
      <p className="notify-title">🎥 Videos from {ev.name} are being edited now.</p>
      <div className="notify-row">
        <input type="email" placeholder="you@example.com" value={email}
          className={state === "err" ? "field-err" : ""}
          onChange={(e) => { setEmail(e.target.value); if (state === "err") setState("idle"); }} />
        <button className="btn primary" disabled={state === "busy"} type="submit">
          {state === "busy" ? "Saving…" : "Email me when ready"}
        </button>
      </div>
      <p className="notify-sub">One email when {en ? "your round" : "the videos"} can be ordered — nothing else.</p>
    </form>
  );
}

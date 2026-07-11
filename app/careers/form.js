"use client";

/* Camera-technician application — data capture for future roles (David:
   keep it small and quiet). Fields ported from the old Work with Us page. */

import { useState } from "react";
import { track } from "../../lib/track";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";

const BLANK = { country: "UK", name: "", email: "", phone: "", age: "", location: "",
  licence: "", availableFrom: "", weekends: "", experience: "", consent: false };

export default function CareersForm() {
  const [f, setF] = useState(BLANK);
  const [state, setState] = useState("idle");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!API) { setState("err"); return; }
    setState("busy");
    try {
      const r = await fetch(API + "/notify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, kind: "careers" })
      });
      if (!r.ok) { setState("err"); return; }
      track("careers_apply", { c: f.country });
      setState("done");
    } catch (err) { setState("err"); }
  }

  if (state === "done") {
    return <p className="notify-done">✓ Thanks — you&rsquo;re on file. We&rsquo;ll be in touch when a role opens near you.</p>;
  }

  const can = f.name.trim().length >= 2 && /.+@.+\..+/.test(f.email) && f.consent && state !== "busy";

  return (
    <form className="cr-form" onSubmit={submit}>
      <div className="cr-grid">
        <label>Country
          <select value={f.country} onChange={set("country")}>
            <option>UK</option><option>IRL</option><option>USA</option>
          </select>
        </label>
        <label>Full name *<input value={f.name} onChange={set("name")} autoComplete="name" /></label>
        <label>Email *<input type="email" value={f.email} onChange={set("email")} autoComplete="email" /></label>
        <label>Phone<input value={f.phone} onChange={set("phone")} autoComplete="tel" /></label>
        <label>Age<input value={f.age} onChange={set("age")} inputMode="numeric" /></label>
        <label>Where are you based?<input value={f.location} onChange={set("location")} /></label>
        <label>Driving licence
          <select value={f.licence} onChange={set("licence")}>
            <option value="">—</option>
            <option>Full — car</option>
            <option>Full — car + trailer</option>
            <option>None</option>
          </select>
        </label>
        <label>Available from<input type="date" value={f.availableFrom} onChange={set("availableFrom")} /></label>
        <label>Weekends free per month
          <select value={f.weekends} onChange={set("weekends")}>
            <option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option>
          </select>
        </label>
      </div>
      <label className="cr-wide">Any horse or eventing experience? (a bonus, not required)
        <textarea rows={3} value={f.experience} onChange={set("experience")} />
      </label>
      <label className="ig-check"><input type="checkbox" checked={f.consent} onChange={set("consent")} />
        Keep my details on file and contact me about future roles *</label>
      <div style={{ marginTop: 12 }}>
        <button className="btn primary" disabled={!can} type="submit">
          {state === "busy" ? "Sending…" : "Register interest"}
        </button>
        {state === "err" && <span className="aq-err" style={{ marginLeft: 12 }}>Couldn&rsquo;t send — try again or email info@equireel.com</span>}
      </div>
    </form>
  );
}

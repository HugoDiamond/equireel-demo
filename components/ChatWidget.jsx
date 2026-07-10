"use client";

/* Floating "Ask us anything" assistant — grounded on Equireel's real FAQ via
   /api/ask. Hidden entirely on the static demo (no API). Deliberately small:
   no external deps, sessionStorage history, graceful failure. */

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("eq_chat") || "[]");
      if (saved.length) setMsgs(saved);
    } catch (e) {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem("eq_chat", JSON.stringify(msgs.slice(-12))); } catch (e) {}
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);

  if (!API) return null;

  async function send(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    const next = [...msgs, { role: "user", text: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const sid = (() => { try { return sessionStorage.getItem("eq_sid") || ""; } catch (e) { return ""; } })();
      const r = await fetch(API + "/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, sid, hist: next.slice(-7, -1) })
      });
      const d = await r.json().catch(() => ({}));
      setMsgs((m) => [...m, { role: "assistant", text: d.a || d.error || "Something went wrong — email info@equireel.com and a human will help." }]);
    } catch (err) {
      setMsgs((m) => [...m, { role: "assistant", text: "I couldn't connect just now — email info@equireel.com and a human will help." }]);
    }
    setBusy(false);
  }

  return (
    <>
      <button className={"cw-fab" + (open ? " open" : "")} aria-label={open ? "Close chat" : "Ask a question"}
        onClick={() => setOpen(!open)}>
        {open ? "✕" : "💬"}
      </button>
      {open && (
        <div className="cw-panel" role="dialog" aria-label="Equireel assistant">
          <div className="cw-head">
            <strong>Equireel assistant</strong>
            <span>Ordering &amp; delivery questions — instant answers</span>
          </div>
          <div className="cw-body" ref={bodyRef}>
            {msgs.length === 0 && (
              <div className="cw-msg assistant">
                Hi! Ask me anything about finding your horse, ordering a video, pricing or delivery. 🐎
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={"cw-msg " + m.role}>{m.text}</div>
            ))}
            {busy && <div className="cw-msg assistant cw-typing">…</div>}
          </div>
          <form className="cw-input" onSubmit={send}>
            <input value={input} placeholder="e.g. How long until my video arrives?"
              onChange={(e) => setInput(e.target.value)} maxLength={600} />
            <button className="btn primary" disabled={busy} type="submit">Send</button>
          </form>
        </div>
      )}
    </>
  );
}

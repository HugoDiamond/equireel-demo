"use client";

/* Floating Equireel assistant — instant, grounded, and free to run forever.
   Answers come from lib/assistant.js (intent engine + live catalogue search),
   entirely in the browser: no API, no per-question cost, works everywhere
   including the static demo. Questions are logged for product insight when
   analytics is available. */

import { useEffect, useRef, useState } from "react";
import { answer, STARTERS } from "../lib/assistant";
import { track } from "../lib/track";
import { href, loadRealEntries } from "../lib/eq";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const bodyRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("eq_chat") || "[]");
      if (saved.length) setMsgs(saved);
    } catch (e) {}
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem("eq_chat", JSON.stringify(msgs.slice(-16))); } catch (e) {}
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);

  /* make sure the catalogue is loaded so name lookups work */
  useEffect(() => { if (open) loadRealEntries(); }, [open]);

  function ask(q) {
    const question = q.trim();
    if (!question) return;
    setInput("");
    const a = answer(question);
    setMsgs((m) => [...m, { role: "user", text: question },
      { role: "assistant", text: a.text, links: a.links, followups: a.followups }]);
    track("chat", { q: question.slice(0, 120) });
  }

  const Msg = ({ m }) => (
    <div className={"cw-msg " + m.role}>
      {m.text}
      {m.links && m.links.length > 0 && (
        <span className="cw-links">
          {m.links.map((l, i) => (
            <a key={i} href={l.to.startsWith("mailto:") ? l.to : href(l.to)}>{l.label}</a>
          ))}
        </span>
      )}
      {m.followups && m.followups.length > 0 && (
        <span className="cw-chips">
          {m.followups.map((f, i) => (
            <button key={i} type="button" onClick={() => ask(f)}>{f}</button>
          ))}
        </span>
      )}
    </div>
  );

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
            <span>Instant answers — prices, delivery, finding your horse</span>
          </div>
          <div className="cw-body" ref={bodyRef}>
            {msgs.length === 0 && (
              <div className="cw-msg assistant">
                Hi! Ask me anything — or type a horse or rider&rsquo;s name and I&rsquo;ll find them. 🐎
                <span className="cw-chips">
                  {STARTERS.map((s, i) => (
                    <button key={i} type="button" onClick={() => ask(s)}>{s}</button>
                  ))}
                </span>
              </div>
            )}
            {msgs.map((m, i) => <Msg key={i} m={m} />)}
          </div>
          <form className="cw-input" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input value={input} placeholder="e.g. How long until my video arrives?"
              onChange={(e) => setInput(e.target.value)} maxLength={200} />
            <button className="btn primary" type="submit">Send</button>
          </form>
        </div>
      )}
    </>
  );
}

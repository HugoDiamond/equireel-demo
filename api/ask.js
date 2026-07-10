/* POST /api/ask — the site's support chatbot.
   Grounded on Equireel's real FAQ/terms/pricing; refuses everything else.
   Cost-bounded: per-visitor daily cap + global daily cap (counted from
   web_events), short max_tokens, no thinking. Model: claude-opus-4-8.
   Body: { q: string, hist?: [{role:"user"|"assistant", text}] , sid?: string } */

const { cors, supabase } = require("./_lib");

const SYSTEM = `You are the Equireel website assistant. Equireel films eventing (horse trials) cross country in the UK, Ireland, France and the USA, and sells professionally edited videos of each rider's own round.

Answer ONLY questions about Equireel: finding a video, ordering, pricing, delivery, refunds, personalisation, filming. For anything else, politely say you can only help with Equireel questions. Never invent facts not listed here. Keep answers to 2-4 friendly sentences. If someone needs a human, give info@equireel.com.

FACTS (the only facts you may use):
- Find your ride: search horse, rider or bib number from the homepage, or browse the event. Every competitor at a filmed event is listed - no pre-booking needed.
- Every horse page has a free sample round to watch before buying.
- Pricing: Cross Country Video £60 UK / €70 Europe / $159 USA. Social Reel add-on (portrait, for Instagram/TikTok) +£10/+€10/+$20. Show Jumping add-on +£20/+€20/+$20. Show Jumping video alone £30/€30/$40. Single fence video £25/€25/$35. DVD posted +£5.
- Personalisation at checkout: country flag on the video, music on/off, course sounds on/off, faults included or excluded, public or private video.
- Payment: card, Apple Pay or Google Pay via Stripe. No account needed.
- Delivery: by email, within 5 days - many events within the hour or instantly. Comes from info@equireel.com (check spam).
- Refunds: full refund any time before delivery. Withdrew before cross country: full refund or credit. Eliminated or retired on course: video of your day up to that point, or a refund. If we didn't capture your round: full refund. Edit requests are free after delivery.
- Public videos may be featured on Equireel's social media; private videos go only to the buyer. Consent can be withdrawn by email.
- Horse not listed? Use the "not listed" option on the event page - tell us horse and rider and we'll find the round.
- Full pages: /faq, /terms, /privacy.`;

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "assistant offline" });

  try {
    const b = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const q = String(b.q || "").trim().slice(0, 600);
    const sid = String(b.sid || "").slice(0, 48);
    if (!q) return res.status(400).json({ error: "empty question" });

    // cost guard: per-visitor and global daily caps from our own event log
    const db = supabase();
    const since = new Date(Date.now() - 86400000).toISOString();
    const { count: mine } = await db.from("web_events")
      .select("id", { count: "exact", head: true })
      .eq("event", "chat").eq("sid", sid).gte("at", since);
    if ((mine || 0) >= 20) return res.status(429).json({ error: "That's a lot of questions for one day — email info@equireel.com and a human will help." });
    const { count: all } = await db.from("web_events")
      .select("id", { count: "exact", head: true })
      .eq("event", "chat").gte("at", since);
    if ((all || 0) >= 500) return res.status(429).json({ error: "The assistant is very busy today — email info@equireel.com." });

    // short history: last 6 turns, text only
    const hist = Array.isArray(b.hist) ? b.hist.slice(-6) : [];
    const messages = [];
    for (const h of hist) {
      if ((h.role === "user" || h.role === "assistant") && h.text) {
        messages.push({ role: h.role, content: String(h.text).slice(0, 600) });
      }
    }
    messages.push({ role: "user", content: q });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 300,
        system: SYSTEM,
        messages
      })
    });
    if (!r.ok) {
      console.error("anthropic error:", r.status, (await r.text()).slice(0, 200));
      return res.status(502).json({ error: "The assistant is having a moment — email info@equireel.com and a human will help." });
    }
    const data = await r.json();
    let answer = "";
    if (data.stop_reason !== "refusal") {
      for (const blk of data.content || []) {
        if (blk.type === "text") answer += blk.text;
      }
    }
    if (!answer) answer = "I can only help with questions about Equireel videos — for anything else, email info@equireel.com.";

    // log Q/A (analytics + the rate-limit counter)
    try {
      await db.from("web_events").insert({
        sid, event: "chat", path: "/api/ask", ref: null,
        data: { q, a: answer.slice(0, 500), in: data.usage && data.usage.input_tokens, out: data.usage && data.usage.output_tokens }
      });
    } catch (e) { /* analytics only */ }

    return res.status(200).json({ a: answer });
  } catch (err) {
    console.error("ask failed:", err);
    return res.status(500).json({ error: "assistant unavailable" });
  }
};

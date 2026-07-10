/* POST /api/track — first-party behaviour events. No cookies, no third-party
   trackers: an anonymous session id from the browser's sessionStorage, the
   event name, and a small data payload into our own web_events table.
   Fire-and-forget by design: never blocks or breaks the page. */

const { cors, supabase } = require("./_lib");

const EVENTS = new Set([
  "pageview", "search", "video_play", "basket_add", "checkout_open",
  "pay_click", "purchase_demo", "notify_signup", "chat"
]);

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const event = String(b.e || "").slice(0, 40);
    if (!EVENTS.has(event)) return res.status(200).json({ ok: false });
    await supabase().from("web_events").insert({
      sid: String(b.sid || "").slice(0, 48),
      event,
      path: String(b.p || "").slice(0, 500),
      ref: String(b.r || "").slice(0, 500),
      data: b.d && typeof b.d === "object" ? b.d : null
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false });
  }
};

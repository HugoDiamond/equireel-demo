/* POST /api/notify — "email me when the videos are ready" capture.
   The marketing-at-the-right-moment list: riders who wanted a video before it
   existed. Rows land in notify_requests; notified_at stays null until used. */

const { cors, supabase } = require("./_lib");
const careers = require("./_handlers/careers");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    // careers applications share this function (12-function Hobby cap)
    if (b.kind === "careers") { req.body = b; return careers(req, res); }
    const email = String(b.email || "").trim().toLowerCase().slice(0, 255);
    if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: "valid email required" });
    await supabase().from("notify_requests").insert({
      email,
      event_id: String(b.e || "").slice(0, 120),
      event_name: String(b.evName || "").slice(0, 255),
      horse: String(b.h || "").slice(0, 255),
      rider: String(b.r || "").slice(0, 255),
      bib: String(b.b || "").slice(0, 24)
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("notify failed:", e);
    return res.status(500).json({ error: "unavailable" });
  }
};

/* /api/calendar — the published filming calendar ("Where we'll be").
   The calendar is never edited on the site; it reads the filming_calendar
   table, which is the machine-readable declaration of what Equireel is
   filming (see docs/DATA-COLLECTION-PLAN.md — filming calendar as authority).

   GET            — public: published entries from ~2 weeks back onward
   POST           — team (X-Admin-Key): add an entry
   DELETE ?id=N   — team (X-Admin-Key): remove an entry */

const { cors, supabase } = require("./_lib");

const COUNTRIES = ["GBR", "IRL", "FRA", "USA", "BEL", "GER"];
const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Brussels", "Europe/Berlin"];

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const db = supabase();

  if (req.method === "GET") {
    try {
      const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await db.from("filming_calendar")
        .select("id, event_name, start_date, end_date, venue, country, organiser, site_slug")
        .eq("published", true).gte("start_date", since)
        .order("start_date", { ascending: true }).limit(200);
      if (error) return res.status(500).json({ error: "calendar lookup failed" });
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
      return res.status(200).json({ events: data || [] });
    } catch (e) {
      console.error("calendar GET failed:", e);
      return res.status(500).json({ error: "unavailable" });
    }
  }

  const key = process.env.ADMIN_KEY;
  if (!key || req.headers["x-admin-key"] !== key) return res.status(401).json({ error: "unauthorised" });

  if (req.method === "POST") {
    try {
      const b = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
      const name = String(b.event_name || "").trim().slice(0, 255);
      const start = String(b.start_date || "").trim();
      if (name.length < 3) return res.status(400).json({ error: "event name required" });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return res.status(400).json({ error: "start_date must be YYYY-MM-DD" });
      const end = /^\d{4}-\d{2}-\d{2}$/.test(String(b.end_date || "")) ? b.end_date : null;
      const country = COUNTRIES.includes(b.country) ? b.country : "GBR";
      const { data, error } = await db.from("filming_calendar").insert({
        event_name: name, start_date: start, end_date: end,
        venue: String(b.venue || "").trim().slice(0, 255) || null,
        country, organiser: String(b.organiser || "").trim().slice(0, 255) || null,
        notes: String(b.notes || "").trim().slice(0, 2000) || null,
        // venue timezone drives the 18:00-local evening collection;
        // blank = country default (USA defaults Eastern)
        timezone: TIMEZONES.includes(b.timezone) ? b.timezone : null,
        published: b.published !== false
      }).select("id").single();
      if (error) return res.status(500).json({ error: "insert failed" });
      return res.status(200).json({ ok: true, id: data.id });
    } catch (e) {
      console.error("calendar POST failed:", e);
      return res.status(500).json({ error: "unavailable" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const id = parseInt(String((req.query && req.query.id) || ""), 10);
      if (!id) return res.status(400).json({ error: "id required" });
      const { error } = await db.from("filming_calendar").delete().eq("id", id);
      if (error) return res.status(500).json({ error: "delete failed" });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("calendar DELETE failed:", e);
      return res.status(500).json({ error: "unavailable" });
    }
  }

  return res.status(405).json({ error: "method not allowed" });
};

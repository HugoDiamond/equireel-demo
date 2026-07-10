/* POST /api/ingest — entries-sheet upload into the platform database.
   Writes to the CANONICAL relational tables (events + results), exactly like
   the scrapers do, with source='INGEST' — this is the entry path for events
   that can't be scraped (pony club, unaffiliated, FFE...). The catalogue
   generator then flows them onto the site.

   Auth: X-Admin-Key = ADMIN_KEY.
   Body: {
     event: { name, date: "YYYY-MM-DD", country: "GBR|IRL|FRA|USA|BEL",
              organization?, replace?: bool },
     rows: [{ bib, horse, rider, section?, day?, time? }, ...]   (max 2000)
   }
   Duplicate handling: same event_name+event_date+source=INGEST →
   409 unless replace:true (then its old results rows are replaced). */

const { cors, supabase } = require("./_lib");

const COUNTRIES = new Set(["GBR", "IRL", "FRA", "USA", "BEL"]);

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ADMIN_KEY;
  if (!key || req.headers["x-admin-key"] !== key) return res.status(401).json({ error: "unauthorised" });

  try {
    const b = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const ev = b.event || {};
    const name = String(ev.name || "").trim().slice(0, 255);
    const date = String(ev.date || "").trim();
    const country = String(ev.country || "").trim().toUpperCase();
    const org = String(ev.organization || "").trim().slice(0, 100) || null;
    if (!name || name.length < 3) return res.status(400).json({ error: "event name required" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "event date must be YYYY-MM-DD" });
    if (!COUNTRIES.has(country)) return res.status(400).json({ error: "country must be one of GBR, IRL, FRA, USA, BEL" });

    const rowsIn = Array.isArray(b.rows) ? b.rows.slice(0, 2000) : [];
    const rows = [];
    for (const r of rowsIn) {
      const horse = String(r.horse || "").trim().slice(0, 255);
      const rider = String(r.rider || "").trim().slice(0, 255);
      if (!horse || !rider) continue;
      rows.push({
        bib: String(r.bib == null ? "" : r.bib).trim().slice(0, 20),
        horse, rider,
        section: String(r.section || "").trim().slice(0, 255) || null,
        day: String(r.day || "").trim().slice(0, 20) || null,
        time: String(r.time || "").trim().slice(0, 10) || null
      });
    }
    if (rows.length < 1) return res.status(400).json({ error: "no valid rows (need horse + rider per row)" });

    const db = supabase();

    // duplicate check within the INGEST source
    const { data: existing } = await db.from("events")
      .select("id").eq("event_name", name).eq("event_date", date).eq("source", "INGEST").limit(1);
    let eventId;
    if (existing && existing.length) {
      if (!b.event.replace) {
        return res.status(409).json({ error: "already ingested", message: "This event (same name + date) was already ingested. Tick 'replace existing' to overwrite its entries." });
      }
      eventId = existing[0].id;
      const { error: derr } = await db.from("results").delete()
        .eq("event_id", eventId).eq("source", "INGEST");
      if (derr) return res.status(500).json({ error: "could not replace: " + derr.message });
    } else {
      const { data: created, error: eerr } = await db.from("events").insert({
        event_name: name, event_date: date, event_country: country, source: "INGEST"
      }).select("id").single();
      if (eerr) return res.status(500).json({ error: "event insert failed: " + eerr.message });
      eventId = created.id;
    }

    // results rows — same shape the scrapers write, source-tagged
    const out = rows.map((r) => ({
      event_id: eventId,
      event_name: name,
      event_date: date,
      event_country: country,
      bib_number: r.bib || null,
      horse_name: r.horse,
      rider_full_name: r.rider,
      section_name: r.section,
      xc_day: r.day,
      xc_start_time: r.time ? `${date}T${r.time.length === 4 ? "0" + r.time : r.time}:00` : null,
      organization: org,
      source: "INGEST"
    }));
    // batch inserts (Supabase limit safety)
    for (let i = 0; i < out.length; i += 500) {
      const { error: ierr } = await db.from("results").insert(out.slice(i, i + 500));
      if (ierr) return res.status(500).json({ error: "results insert failed at row " + i + ": " + ierr.message });
    }

    return res.status(200).json({ ok: true, event_id: eventId, inserted: out.length, replaced: !!(existing && existing.length) });
  } catch (err) {
    console.error("ingest failed:", err);
    return res.status(500).json({ error: "ingest failed" });
  }
};

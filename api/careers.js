/* POST /api/careers — camera-technician application capture (ported from the
   old equireel.co.uk "Work with Us" page). Writes careers_applications and
   notifies the team inbox. Deliberately quiet on the site — a data capture
   for when roles open, not a live vacancy board. */

const { cors, supabase } = require("./_lib");
const { sendFulfilmentNote, esc } = require("./_email");

const COUNTRIES = ["UK", "IRL", "USA"];

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const name = String(b.name || "").trim().slice(0, 160);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 255);
    if (name.length < 2) return res.status(400).json({ error: "name required" });
    if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: "valid email required" });
    if (b.consent !== true) return res.status(400).json({ error: "consent required" });

    const row = {
      country: COUNTRIES.includes(b.country) ? b.country : "UK",
      full_name: name,
      email,
      phone: String(b.phone || "").trim().slice(0, 64) || null,
      age: String(b.age || "").trim().slice(0, 16) || null,
      location: String(b.location || "").trim().slice(0, 255) || null,
      licence: String(b.licence || "").trim().slice(0, 64) || null,
      available_from: String(b.availableFrom || "").trim().slice(0, 64) || null,
      weekends_per_month: String(b.weekends || "").trim().slice(0, 16) || null,
      experience: String(b.experience || "").trim().slice(0, 4000) || null,
      consent: true
    };
    const { error } = await supabase().from("careers_applications").insert(row);
    if (error) { console.error("careers insert failed:", error.message); return res.status(500).json({ error: "unavailable" }); }

    try {
      await sendFulfilmentNote(`Careers application — ${name} (${row.country})`,
        `<p><strong>New camera-technician application</strong></p>
         <ul>
           <li>Name: ${esc(name)} (${esc(row.age || "?")})</li>
           <li>Email: ${esc(email)} · Phone: ${esc(row.phone || "—")}</li>
           <li>Country: ${esc(row.country)} · Location: ${esc(row.location || "—")}</li>
           <li>Licence: ${esc(row.licence || "—")} · Available from: ${esc(row.available_from || "—")}
               · Weekends/month: ${esc(row.weekends_per_month || "—")}</li>
         </ul>
         <p>${esc(row.experience || "(no experience notes)")}</p>`);
    } catch (e) { console.error("careers notify failed:", e.message); }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("careers failed:", e);
    return res.status(500).json({ error: "unavailable" });
  }
};

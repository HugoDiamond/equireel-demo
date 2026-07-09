/* GET /api/public-videos?e=<site event id>[&b=<bib>]
   Delivered customer videos whose order consented to public sharing —
   the site plays these on the matching entry pages. */

const { cors, supabase } = require("./_lib");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const e = (req.query && req.query.e || "").slice(0, 120);
  const b = (req.query && req.query.b || "").slice(0, 20);
  if (!e) return res.status(400).json({ error: "e required" });

  try {
    const db = supabase();
    let q = db.from("shop_order_items")
      .select("bib_number, horse, rider_name, product, video_link, order_id")
      .eq("event_name_orig", e).not("video_link", "is", null);
    if (b) q = q.eq("bib_number", b);
    const { data: items, error } = await q.limit(50);
    if (error) return res.status(500).json({ error: "lookup failed" });

    const out = [];
    for (const it of items || []) {
      const { data: ord } = await db.from("shop_orders")
        .select("share_consent, status").eq("id", it.order_id).limit(1);
      if (ord && ord.length && ord[0].share_consent) {
        out.push({ b: it.bib_number, h: it.horse, r: it.rider_name, p: it.product, url: it.video_link });
      }
    }
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).json({ videos: out });
  } catch (err) {
    console.error("public-videos failed:", err);
    return res.status(500).json({ error: "unavailable" });
  }
};

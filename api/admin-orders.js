/* GET /api/admin-orders — read-only order queue for editors.
   Auth: X-Admin-Key header must equal ADMIN_KEY env.
   Returns recent website orders with items; "delivered" is derived from
   video_link (filled by the upload webhook). */

const { cors, supabase } = require("./_lib");

const PAID = ["Processing", "Completed", "Test"];

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const key = process.env.ADMIN_KEY;
  if (!key || req.headers["x-admin-key"] !== key) return res.status(401).json({ error: "unauthorised" });

  try {
    const db = supabase();
    // new-storefront orders only: they carry a Stripe payment-intent id
    // (pi_...); legacy shop history synced from Mongo does not
    const { data: orders, error } = await db.from("shop_orders")
      .select("id, status, currency, charged, stripe_receipt_email, share_consent, include_faults, created_at")
      .eq("shop_order_source_id", 1).in("status", PAID)
      .like("stripe_charge_id", "pi_%")
      .order("id", { ascending: false }).limit(120);
    if (error) return res.status(500).json({ error: "orders lookup failed" });

    const ids = (orders || []).map((o) => o.id);
    let items = [];
    if (ids.length) {
      const { data, error: ierr } = await db.from("shop_order_items")
        .select("order_id, product, price, horse, horse_info, rider_name, bib_number, xc_day, xc_time, event_name, video_link")
        .in("order_id", ids);
      if (ierr) return res.status(500).json({ error: "items lookup failed" });
      items = data || [];
    }

    const out = (orders || []).map((o) => ({
      id: o.id, status: o.status, currency: o.currency, charged: o.charged,
      email: o.stripe_receipt_email, public: !!o.share_consent,
      faults: o.include_faults, at: o.created_at,
      items: items.filter((i) => i.order_id === o.id).map((i) => ({
        product: i.product, price: i.price, horse: i.horse, label: i.horse_info,
        rider: i.rider_name, bib: i.bib_number, day: i.xc_day, time: i.xc_time,
        event: i.event_name, delivered: !!i.video_link, url: i.video_link
      }))
    }));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ orders: out });
  } catch (err) {
    console.error("admin-orders failed:", err);
    return res.status(500).json({ error: "unavailable" });
  }
};

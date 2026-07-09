/* POST /api/video-uploaded — fires when a finished video lands in the
   delivery bucket (Backblaze B2 event notification, or any pipeline POST).

   The filename IS the join key: editors already name files with the exact
   fulfilment label stored on the order item —
     "EQUIREEL 2 Kitty King & KANTANGO at OXSTALLS (1) 2025.mp4"
   matches shop_order_items.horse_info. On match: store the video URL on the
   item, email the customer their video, and (if the order consented) the
   round becomes publicly playable on the site via /api/public-videos.

   Auth: either X-Delivery-Key header equal to DELIVERY_WEBHOOK_SECRET, or a
   Backblaze signature (X-Bz-Event-Notification-Signature: v1=<hmac-sha256>).

   Accepted bodies:
     B2:     { "events": [{ "eventType": "b2:ObjectCreated:...", "objectName": "...", "bucketName": "..." }] }
     simple: { "file": "EQUIREEL ... 2025.mp4", "url": "https://..." }

   Env: DELIVERY_WEBHOOK_SECRET, B2_PUBLIC_BASE (e.g.
   https://f005.backblazeb2.com/file/equireel-deliveries) */

const crypto = require("crypto");
const { supabase, readRawBody } = require("./_lib");
const { sendVideoDelivery, sendFulfilmentNote } = require("./_email");

const PAID = ["Processing", "Completed", "Test"];

function authed(req, raw) {
  const secret = process.env.DELIVERY_WEBHOOK_SECRET;
  if (!secret) return false;
  if (req.headers["x-delivery-key"] === secret) return true;
  const sig = req.headers["x-bz-event-notification-signature"] || "";
  if (sig.startsWith("v1=")) {
    const mac = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    try { return crypto.timingSafeEqual(Buffer.from(sig.slice(3)), Buffer.from(mac)); }
    catch (e) { return false; }
  }
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const raw = await readRawBody(req);
  if (!authed(req, raw)) return res.status(401).json({ error: "unauthorised" });

  let body;
  try { body = JSON.parse(raw.toString("utf8")); } catch (e) { return res.status(400).json({ error: "bad json" }); }

  // normalise both payload shapes into [{name, url}]
  const files = [];
  if (Array.isArray(body.events)) {
    for (const ev of body.events) {
      if (!/ObjectCreated/i.test(ev.eventType || "")) continue;
      const name = ev.objectName || "";
      const base = (process.env.B2_PUBLIC_BASE || "").replace(/\/$/, "");
      files.push({ name, url: base ? base + "/" + encodeURI(name) : null });
    }
  } else if (body.file) {
    files.push({ name: body.file, url: body.url || null });
  }
  if (!files.length) return res.status(200).json({ ok: true, matched: 0, note: "no created-object events" });

  const db = supabase();
  const results = [];
  for (const f of files) {
    const stem = decodeURI(f.name).split("/").pop().replace(/\.[a-z0-9]+$/i, "").replace(/\s+/g, " ").trim();
    if (!f.url) { results.push({ file: f.name, status: "no url (set B2_PUBLIC_BASE)" }); continue; }

    const { data: items, error } = await db.from("shop_order_items")
      .select("id, order_id, horse, horse_info, product, rider_name, video_link, event_name")
      .ilike("horse_info", stem)
      .order("id", { ascending: false }).limit(5);
    if (error) { results.push({ file: f.name, status: "db error: " + error.message }); continue; }

    // newest paid order wins
    let hit = null;
    for (const it of items || []) {
      const { data: ord } = await db.from("shop_orders")
        .select("id, status, customer_id, stripe_receipt_email, share_consent")
        .eq("id", it.order_id).limit(1);
      if (ord && ord.length && PAID.includes(ord[0].status)) { hit = { it, ord: ord[0] }; break; }
    }
    if (!hit) {
      results.push({ file: f.name, status: "no matching paid order" });
      try { await sendFulfilmentNote(`Upload matched no order`, `<p>File: <code>${stem}</code></p><p>No paid order item with this label. If this is a real order, check the filename against the work-order email.</p>`); } catch (e) {}
      continue;
    }

    if (hit.it.video_link === f.url) { results.push({ file: f.name, status: "already delivered" }); continue; }

    const { error: uerr } = await db.from("shop_order_items")
      .update({ video_link: f.url }).eq("id", hit.it.id);
    if (uerr) { results.push({ file: f.name, status: "update failed: " + uerr.message }); continue; }

    let email = hit.ord.stripe_receipt_email;
    if (!email && hit.ord.customer_id) {
      const { data: c } = await db.from("shop_customers").select("email").eq("id", hit.ord.customer_id).limit(1);
      if (c && c.length) email = c[0].email;
    }
    let emailed = false;
    if (email) {
      try {
        await sendVideoDelivery({ to: email, url: f.url, label: hit.it.horse_info, horse: hit.it.horse, product: hit.it.product, event: hit.it.event_name });
        emailed = true;
      } catch (e) { console.error("delivery email failed:", e.message); }
    }
    results.push({ file: f.name, status: "delivered", order: hit.ord.id, item: hit.it.id, emailed });
  }
  return res.status(200).json({ ok: true, results });
};

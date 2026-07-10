/* POST /api/stripe-webhook — Stripe checkout.session.completed handler.
   Verifies the signature against both regional webhook secrets, then writes
   the order into the platform DB (Supabase Postgres) in the legacy-compatible
   shape: shop_customers (guest upsert by email) → shop_orders
   (status='Processing' = PAID, source WEBSITE) → shop_order_items (one per
   video, product label + EQUIREEL fulfilment label). Emails: confirmation to
   the customer, work order to fulfilment. */

const {
  EVENTS, itemLines, PRODUCT_LABEL, COUNTRY_LABEL, CURRENCY_ID,
  equireelLabel, supabase, readRawBody
} = require("./_lib");
const { sendCustomerConfirmation, sendFulfilmentOrder } = require("./_email");

function verify(raw, sig) {
  const Stripe = require("stripe");
  for (const [secretEnv, keyEnv] of [
    ["STRIPE_WEBHOOK_SECRET_GBP", "STRIPE_SECRET_KEY_GBP"],
    ["STRIPE_WEBHOOK_SECRET_EUR", "STRIPE_SECRET_KEY_EUR"]
  ]) {
    const secret = process.env[secretEnv], key = process.env[keyEnv];
    if (!secret || !key) continue;
    try {
      const stripe = new Stripe(key);
      return { event: stripe.webhooks.constructEvent(raw, sig, secret), stripe };
    } catch (e) { /* try the other account */ }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const raw = await readRawBody(req);
  const hit = verify(raw, req.headers["stripe-signature"]);
  if (!hit) return res.status(400).json({ error: "signature verification failed" });
  const { event, stripe } = hit;

  if (event.type !== "checkout.session.completed") return res.status(200).json({ ignored: event.type });
  const session = event.data.object;

  try {
    const md = session.metadata || {};
    const items = [];
    for (let i = 0; i < Number(md.n || 0); i++) {
      try { items.push(JSON.parse(md["i" + i])); } catch (e) { /* skip corrupt */ }
    }
    if (!items.length) { console.error("webhook: no items in metadata", session.id); return res.status(200).json({ ok: false }); }

    const currency = (session.currency || "gbp").toUpperCase();
    const email = (session.customer_details && session.customer_details.email) || session.customer_email || "";
    const name = (session.customer_details && session.customer_details.name) || "";

    // receipt + card details from the payment intent's charge
    let receiptUrl = null, card = {};
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ["latest_charge"] });
      const ch = pi.latest_charge;
      if (ch) {
        receiptUrl = ch.receipt_url || null;
        const c = ch.payment_method_details && ch.payment_method_details.card;
        if (c) card = { brand: c.brand, last4: c.last4, country: c.country, funding: c.funding };
      }
    } catch (e) { console.error("pi retrieve failed:", e.message); }

    const db = supabase();

    // guest customer upsert by email
    let customerId = null;
    if (email) {
      const { data: existing } = await db.from("shop_customers").select("id").eq("email", email.toLowerCase()).limit(1);
      if (existing && existing.length) customerId = existing[0].id;
      else {
        const [first, ...rest] = name.split(" ");
        const { data: created, error } = await db.from("shop_customers").insert({
          email: email.toLowerCase(), first_name: first || "", last_name: rest.join(" "),
          customer_type: "guest", created_at: new Date().toISOString()
        }).select("id").single();
        if (error) console.error("customer insert failed:", error.message);
        else customerId = created.id;
      }
    }

    const anyPublic = items.some((it) => it.pr && it.pr.pu !== false);
    const faults = items.some((it) => !it.pr || it.pr.fa !== false);

    // idempotency: skip if this session was already recorded
    const { data: dup } = await db.from("shop_orders").select("id").eq("stripe_charge_id", String(session.payment_intent)).limit(1);
    if (dup && dup.length) return res.status(200).json({ ok: true, duplicate: dup[0].id });

    // test-mode payments are recorded but must never count as real revenue:
    // status 'Processing' means PAID in reporting, so test events get 'Test'
    const paidStatus = event.livemode ? "Processing" : "Test";
    const { data: order, error: oerr } = await db.from("shop_orders").insert({
      status: paidStatus, currency,
      charged: Math.round((session.amount_total || 0) / 100),
      share_consent: anyPublic, include_faults: faults ? "yes" : "no",
      stripe_charge_id: String(session.payment_intent), stripe_status: "succeeded",
      stripe_paid: true, stripe_receipt_url: receiptUrl, stripe_receipt_email: email,
      card_brand: card.brand, card_last4: card.last4, card_country: card.country, card_funding: card.funding,
      created_at: new Date().toISOString(),
      customer_id: customerId, shop_currency_id: CURRENCY_ID[currency] || null,
      shop_order_source_id: 1
    }).select("id").single();
    if (oerr) { console.error("order insert failed:", oerr.message); return res.status(500).json({ error: "order write failed" }); }

    // full per-video personalisation, persisted on the item so the editor
    // queue can always show it (otherwise it lives only in Stripe metadata).
    // Stored in the spare horse_info_orig column with a PREFS prefix.
    const prefString = (pr) => {
      const p = pr || {};
      return "PREFS flag=" + (p.fl || "gb") +
        " faults=" + (p.fa === false ? "exclude" : "in") +
        " music=" + (p.mu === false ? "off" : "on") +
        " sounds=" + (p.so === false ? "off" : "on") +
        " public=" + (p.pu === false ? "no" : "yes");
    };

    const rows = items.map((it) => {
      const ev = EVENTS[it.e] || { c: "gb", n: it.e, y: "", p: 0, sj: 0 };
      const price = itemLines(it, ev).reduce((s, l) => s + l[1], 0);
      return {
        order_id: order.id, season: ev.y, country: COUNTRY_LABEL[ev.c] || "UK",
        event_name: `${(ev.n || "").toUpperCase()} ${ev.y}`.trim(),
        horse: it.h, horse_info: equireelLabel(it, ev),
        product: PRODUCT_LABEL(it) + (md.dvd ? " & DVD" : ""),
        price, bib_number: String(it.b || ""), rider_name: it.r,
        xc_day: it.d || null, xc_time: it.t || null,
        event_name_orig: it.e, horse_info_orig: prefString(it.pr),
        created_at: new Date().toISOString(),
        shop_product_id: null
      };
    });
    const { error: ierr } = await db.from("shop_order_items").insert(rows);
    if (ierr) console.error("items insert failed:", ierr.message);

    // funnel: the purchase itself, server-side truth (never breaks the order)
    try {
      await db.from("web_events").insert({
        sid: null, event: "purchase", path: null, ref: null,
        data: { order: order.id, total: Math.round((session.amount_total || 0) / 100), currency, n: rows.length, test: !event.livemode }
      });
    } catch (e) { /* analytics only */ }

    // emails — never fail the webhook over them
    const ctx = { session, items, order, rows, email, name, currency, receiptUrl, md, EVENTS };
    try { await sendCustomerConfirmation(ctx); } catch (e) { console.error("customer email failed:", e.message); }
    try { await sendFulfilmentOrder(ctx); } catch (e) { console.error("fulfilment email failed:", e.message); }

    return res.status(200).json({ ok: true, order: order.id });
  } catch (err) {
    console.error("webhook processing failed:", err);
    return res.status(500).json({ error: "processing failed" });
  }
};

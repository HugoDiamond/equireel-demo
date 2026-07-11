/* POST /api/voucher-pay — an order FULLY covered by a gift voucher: no card,
   no Stripe. Body matches /create-checkout ({email, items, voucher}).
   Sequence: server-side pricing → atomic balance deduct (double-spend guard)
   → order write in the same legacy-compatible shape as the webhook → emails.
   If the order write fails after deduction, the balance is restored and
   fulfilment alerted. */

const {
  EVENTS, CURRENCY_OF, itemLines, PRODUCT_LABEL, COUNTRY_LABEL, CURRENCY_ID,
  equireelLabel, cors, supabase
} = require("./_lib");
const { checkVoucher, deductVoucher, normCode } = require("./_vouchers");
const { sendCustomerConfirmation, sendFulfilmentOrder, sendFulfilmentNote } = require("./_email");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    if (!items.length) return res.status(400).json({ error: "empty order" });
    const email = String(body.email || "").trim().toLowerCase();
    if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: "valid email required" });

    const resolved = [];
    for (const it of items) {
      const ev = EVENTS[it.e];
      if (!ev) return res.status(400).json({ error: "unknown event: " + it.e });
      if (!it.h || !it.r) return res.status(400).json({ error: "item missing horse/rider" });
      resolved.push({ it, ev });
    }
    const currencies = [...new Set(resolved.map(({ ev }) => CURRENCY_OF[ev.c] || "GBP"))];
    if (currencies.length > 1) return res.status(400).json({ error: "mixed-currency order" });
    const currency = currencies[0];
    const total = resolved.reduce((s, { it, ev }) => s + itemLines(it, ev).reduce((x, l) => x + l[1], 0), 0);

    const db = supabase();
    const chk = await checkVoucher(db, body.voucher, currency);
    if (!chk.ok) return res.status(400).json({ error: "voucher", message: "Voucher can't be used (" + chk.reason + ")." });
    if (chk.voucher.balance < total) {
      return res.status(400).json({ error: "voucher", message: "Voucher doesn't cover this order — pay the difference by card instead." });
    }

    // deduct FIRST (atomic); restore on any later failure
    if (!(await deductVoucher(db, chk.voucher.id, total, null))) {
      return res.status(409).json({ error: "voucher", message: "That voucher was just used elsewhere — check its balance." });
    }

    try {
      // guest customer upsert (same as the webhook)
      let customerId = null;
      const { data: existing } = await db.from("shop_customers").select("id").eq("email", email).limit(1);
      if (existing && existing.length) customerId = existing[0].id;
      else {
        const { data: created } = await db.from("shop_customers").insert({
          email, customer_type: "guest", first_name: "", last_name: "",
          created_at: new Date().toISOString()
        }).select("id").single();
        if (created) customerId = created.id;
      }

      const anyPublic = items.some((it) => it.pr && it.pr.pu !== false);
      const faults = items.some((it) => !it.pr || it.pr.fa !== false);
      const isTest = chk.voucher.status === "test";
      const chargeId = "vch_" + normCode(body.voucher).replace(/-/g, "") + "_" + Date.now();

      const { data: order, error: oerr } = await db.from("shop_orders").insert({
        status: isTest ? "Test" : "Processing", currency, charged: total,
        share_consent: anyPublic, include_faults: faults ? "yes" : "no",
        stripe_charge_id: chargeId, stripe_status: "voucher", stripe_paid: true,
        stripe_receipt_email: email, promo: "GIFT VOUCHER " + normCode(body.voucher),
        created_at: new Date().toISOString(),
        customer_id: customerId, shop_currency_id: CURRENCY_ID[currency] || null,
        shop_order_source_id: 1
      }).select("id").single();
      if (oerr) throw new Error("order write failed: " + oerr.message);

      const prefString = (pr) => {
        const p = pr || {};
        return "PREFS flag=" + (p.fl || "gb") +
          " faults=" + (p.fa === false ? "exclude" : "in") +
          " music=" + (p.mu === false ? "off" : "on") +
          " sounds=" + (p.so === false ? "off" : "on") +
          " public=" + (p.pu === false ? "no" : "yes");
      };
      const rows = resolved.map(({ it, ev }) => ({
        order_id: order.id, season: ev.y, country: COUNTRY_LABEL[ev.c] || "UK",
        event_name: `${(ev.n || "").toUpperCase()} ${ev.y}`.trim(),
        horse: it.h, horse_info: equireelLabel(it, ev),
        product: PRODUCT_LABEL(it),
        price: itemLines(it, ev).reduce((s, l) => s + l[1], 0),
        bib_number: String(it.b || ""), rider_name: it.r,
        xc_day: it.d || null, xc_time: it.t || null,
        event_name_orig: it.e, horse_info_orig: prefString(it.pr),
        created_at: new Date().toISOString(), shop_product_id: null
      }));
      const { error: ierr } = await db.from("shop_order_items").insert(rows);
      if (ierr) console.error("voucher-pay items insert failed:", ierr.message);

      await db.from("voucher_redemptions").update({ order_id: order.id })
        .eq("voucher_id", chk.voucher.id).is("order_id", null);

      try {
        await db.from("web_events").insert({
          sid: null, event: "purchase", path: null, ref: null,
          data: { order: order.id, total, currency, n: rows.length, voucher: true, test: isTest }
        });
      } catch (e) { /* analytics only */ }

      const ctx = {
        session: { amount_total: total * 100, id: chargeId }, items, order, rows,
        email, name: "", currency, receiptUrl: null, md: {}, EVENTS
      };
      try { await sendCustomerConfirmation(ctx); } catch (e) { console.error("confirm email failed:", e.message); }
      try { await sendFulfilmentOrder(ctx); } catch (e) { console.error("fulfilment email failed:", e.message); }

      return res.status(200).json({ ok: true, order: order.id });
    } catch (err) {
      // restore the balance — the customer was not served
      try {
        const { data: v } = await db.from("gift_vouchers").select("balance").eq("id", chk.voucher.id).single();
        if (v) await db.from("gift_vouchers").update({ balance: v.balance + total }).eq("id", chk.voucher.id);
        await sendFulfilmentNote("VOUCHER-PAY FAILED — balance restored",
          `<p>voucher ${normCode(body.voucher)} deducted ${total} ${currency} but the order write failed
           (${String(err.message)}). Balance restored; customer ${email} saw an error.</p>`);
      } catch (e2) { console.error("restore failed:", e2.message); }
      throw err;
    }
  } catch (err) {
    console.error("voucher-pay failed:", err);
    return res.status(500).json({ error: "unavailable" });
  }
};

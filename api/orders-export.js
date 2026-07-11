/* GET /api/orders-export — interim CSV for the manual-editing workflow.
   Byte-compatible with the legacy shop's orders export (same 24 columns,
   including its blank spacer columns and duplicated Video Format column),
   so whatever consumes that sheet keeps working during the transition.
   One row per order item, newest first. Auth: X-Admin-Key = ADMIN_KEY. */

const { cors, supabase } = require("./_lib");

const PAID = ["Processing", "Completed", "Test"];

const HEADER = [
  "Order Date", "Customer Full Name", "Customer Email", "Event Name",
  "Horse Name", "", "Share on Facebook Yes/No", "Include Faults",
  "Video Format (Video/DVD)", "", "Video Format (Video/DVD)", "",
  "Order Notes", "", "Phone (Billing)", "Company (Billing)",
  "Address 1 (Billing)", "Address 2 (Billing)", "City (Billing)",
  "Country Name (Billing)", "State Name (Billing)", "Zip (Billing)",
  "Address 1&2 (Billing)", "Address 1&2 (Shipping)"
];

const esc = (v) => {
  const s = String(v == null ? "" : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  // header auth for scripts; ?key= for direct browser downloads (Safari
  // blocks script-triggered downloads after an async fetch, so the queue's
  // button navigates here natively instead)
  const key = process.env.ADMIN_KEY;
  const provided = req.headers["x-admin-key"] || (req.query && req.query.key) || "";
  if (!key || provided !== key) return res.status(401).json({ error: "unauthorised" });

  try {
    const db = supabase();
    const { data: orders, error } = await db.from("shop_orders")
      .select("id, status, customer_id, stripe_receipt_email, share_consent, include_faults, created_at")
      .eq("shop_order_source_id", 1).in("status", PAID)
      .or("stripe_charge_id.like.pi_%,stripe_charge_id.like.vch_%")
      .order("id", { ascending: false }).limit(1000);
    if (error) return res.status(500).json({ error: "orders lookup failed" });

    const oids = (orders || []).map((o) => o.id);
    const cids = [...new Set((orders || []).map((o) => o.customer_id).filter(Boolean))];
    let items = [], customers = {};
    if (oids.length) {
      const { data } = await db.from("shop_order_items")
        .select("order_id, product, horse, event_name").in("order_id", oids);
      items = data || [];
    }
    if (cids.length) {
      const { data } = await db.from("shop_customers")
        .select("id, first_name, last_name").in("id", cids);
      for (const c of data || []) customers[c.id] = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
    }

    const lines = [HEADER.map(esc).join(",")];
    for (const o of orders || []) {
      const name = customers[o.customer_id] || "";
      const share = o.share_consent ? "Yes" : "No";
      const faults = o.include_faults === "no" ? "no" : "yes";
      for (const it of items.filter((i) => i.order_id === o.id)) {
        lines.push([
          new Date(o.created_at).toISOString(),        // Order Date
          name,                                        // Customer Full Name
          o.stripe_receipt_email || "",                // Customer Email
          it.event_name || "",                         // Event Name
          it.horse || "",                              // Horse Name
          "",                                          // (spacer)
          share,                                       // Share on Facebook Yes/No
          faults,                                      // Include Faults
          it.product || "",                            // Video Format
          "",                                          // (spacer)
          it.product || "",                            // Video Format (duplicate, as legacy)
          "",                                          // (spacer)
          it.horse || "",                              // Order Notes (legacy auto-filled horse name)
          "",                                          // (spacer)
          "", "",                                      // Phone / Company (not collected)
          "", "", "", "", "", "",                      // Billing address fields (not collected)
          "", ""                                       // Address 1&2 billing / shipping
        ].map(esc).join(","));
      }
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition",
      `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(lines.join("\r\n") + "\r\n");
  } catch (err) {
    console.error("orders-export failed:", err);
    return res.status(500).json({ error: "unavailable" });
  }
};

/* POST /api/create-checkout
   Body: { email, dvd, address, items: [{ e, b, h, r, d, t, p, sjAdd, rl, f, pr }] }
     e=event id (site slug), b=bib, h=horse, r=rider, d=xc day, t=xc time,
     p=product (xc|sj|fence), sjAdd/rl=add-ons, f=fence number,
     pr=personalisation {fl,fa,mu,so,pu} (flag, faults, music, sounds, public)
   Creates a Stripe Checkout Session on the regional account, all prices
   recomputed server-side. Cart travels in session metadata; the webhook writes
   the order to the platform DB only after payment succeeds. */

const { EVENTS, CURRENCY_OF, stripeFor, itemLines, productPrices, cors } = require("./_lib");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    if (!items.length) return res.status(400).json({ error: "empty order" });
    if (!/.+@.+\..+/.test(body.email || "")) return res.status(400).json({ error: "valid email required" });

    // resolve + validate every item against the server-side event index
    const resolved = [];
    for (const it of items) {
      const ev = EVENTS[it.e];
      if (!ev) return res.status(400).json({ error: "unknown event: " + it.e });
      if (!it.h || !it.r) return res.status(400).json({ error: "item missing horse/rider" });
      resolved.push({ it, ev });
    }

    // one settlement currency per payment
    const currencies = [...new Set(resolved.map(({ ev }) => CURRENCY_OF[ev.c] || "GBP"))];
    if (currencies.length > 1) {
      return res.status(400).json({
        error: "mixed-currency order",
        message: "These videos are billed in different currencies — please order them in separate payments."
      });
    }
    const currency = currencies[0];
    const stripe = stripeFor(currency);

    const line_items = [];
    for (const { it, ev } of resolved) {
      for (const [label, amount] of itemLines(it, ev)) {
        line_items.push({
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(amount * 100),
            product_data: { name: label, description: `${it.h} · ${it.r} · ${ev.n} ${ev.y}` }
          }
        });
      }
    }
    if (body.dvd) {
      const pr = productPrices(resolved[0].ev);
      line_items.push({
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(pr.dvd * 100),
          product_data: { name: "DVD copy (posted)" }
        }
      });
    }

    const site = process.env.SITE_URL || "https://hugodiamond.github.io/equireel-demo";
    const metadata = { v: "1", n: String(resolved.length) };
    if (body.dvd) { metadata.dvd = "1"; metadata.addr = String(body.address || "").slice(0, 450); }
    resolved.forEach(({ it }, i) => {
      metadata["i" + i] = JSON.stringify({
        e: it.e, b: it.b || "", h: (it.h || "").slice(0, 80), r: (it.r || "").slice(0, 80),
        d: it.d || "", t: it.t || "", p: it.p || "xc",
        sjAdd: it.sjAdd ? 1 : 0, rl: it.rl ? 1 : 0, f: it.f || "",
        pr: it.pr || {}
      }).slice(0, 500);
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: body.email,
      line_items,
      metadata,
      success_url: site + "/order-confirmed?sid={CHECKOUT_SESSION_ID}",
      cancel_url: site + "/order-confirmed?cancelled=1"
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout failed:", err);
    return res.status(500).json({ error: "checkout unavailable" });
  }
};

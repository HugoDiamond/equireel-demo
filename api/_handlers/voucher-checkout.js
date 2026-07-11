/* POST /api/voucher-checkout — buy a gift voucher.
   Body: { amount (whole units), currency "GBP"|"EUR", email (buyer),
           recipientName?, recipientEmail?, message? }
   Creates a Stripe Checkout Session on the matching regional account with
   metadata gv=1; the webhook mints the code + sends the emails after payment. */

const { stripeFor, cors } = require("../_lib");

const MIN = 10, MAX = 500;

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const b = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const amount = Math.round(Number(b.amount));
    const currency = b.currency === "EUR" ? "EUR" : "GBP";
    if (!Number.isFinite(amount) || amount < MIN || amount > MAX) {
      return res.status(400).json({ error: `amount must be ${MIN}-${MAX}` });
    }
    if (!/.+@.+\..+/.test(b.email || "")) return res.status(400).json({ error: "valid email required" });
    const recipientEmail = String(b.recipientEmail || "").trim().toLowerCase().slice(0, 255);
    if (recipientEmail && !/.+@.+\..+/.test(recipientEmail)) {
      return res.status(400).json({ error: "recipient email looks wrong" });
    }

    const stripe = stripeFor(currency);
    const site = process.env.SITE_URL || "https://hugodiamond.github.io/equireel-demo";
    const sym = currency === "EUR" ? "€" : "£";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: b.email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: amount * 100,
          product_data: {
            name: `Equireel Gift Voucher — ${sym}${amount}`,
            description: recipientEmail ? `For ${b.recipientName || recipientEmail}` : "Emailed to you to give"
          }
        }
      }],
      metadata: {
        gv: "1", amt: String(amount), cur: currency,
        rn: String(b.recipientName || "").slice(0, 120),
        re: recipientEmail,
        msg: String(b.message || "").slice(0, 400)
      },
      success_url: site + "/gift-vouchers?done=1",
      cancel_url: site + "/gift-vouchers?cancelled=1"
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("voucher-checkout failed:", err);
    return res.status(500).json({ error: "checkout unavailable" });
  }
};

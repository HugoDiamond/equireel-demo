/* GET /api/voucher-check?code=EQR-XXXX-XXXX[&currency=GBP] — checkout-time
   validation. The code itself is the bearer secret. */

const { cors, supabase } = require("../_lib");
const { checkVoucher } = require("../_vouchers");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "GET") return res.status(405).end();
  try {
    const q = req.query || {};
    const out = await checkVoucher(supabase(), q.code, q.currency || null);
    res.setHeader("Cache-Control", "no-store");
    if (!out.ok) return res.status(200).json({ ok: false, reason: out.reason, currency: out.currency });
    return res.status(200).json({ ok: true, balance: out.voucher.balance, currency: out.voucher.currency });
  } catch (e) {
    console.error("voucher-check failed:", e);
    return res.status(500).json({ error: "unavailable" });
  }
};

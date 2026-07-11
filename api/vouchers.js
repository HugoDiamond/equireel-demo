/* /api/vouchers — single function for all voucher operations (the Hobby plan
   caps deployments at 12 serverless functions, so the three handlers live in
   _handlers/ and dispatch here).
     GET  ?code=&currency=          -> balance check
     POST {action:"checkout", ...}  -> buy a voucher (Stripe session)
     POST {action:"pay", ...}       -> order fully paid from voucher balance */

const check = require("./_handlers/voucher-check");
const checkout = require("./_handlers/voucher-checkout");
const pay = require("./_handlers/voucher-pay");

module.exports = async (req, res) => {
  if (req.method === "GET" || req.method === "OPTIONS") return check(req, res);
  if (req.method === "POST") {
    const b = typeof req.body === "object" && req.body ? req.body : (() => {
      try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; }
    })();
    req.body = b;
    if (b.action === "pay") return pay(req, res);
    return checkout(req, res);
  }
  return res.status(405).json({ error: "method not allowed" });
};

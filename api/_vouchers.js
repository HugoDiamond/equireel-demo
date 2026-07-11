/* Gift voucher helpers — code generation, validation, atomic deduction.
   Money model: whole currency units (matches shop_orders.charged), one
   currency per voucher (GBP or EUR), 24-month expiry (recorded in terms). */

const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function makeCode() {
  const pick = () => ALPHABET[crypto.randomInt(ALPHABET.length)];
  const block = () => pick() + pick() + pick() + pick();
  return `EQR-${block()}-${block()}`;
}

const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  .replace(/^EQR/, "").replace(/(.{4})(.{4})/, "EQR-$1-$2");

/* -> {ok, voucher} | {ok:false, reason} */
async function checkVoucher(db, code, currency) {
  const c = normCode(code);
  if (!/^EQR-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c)) return { ok: false, reason: "invalid" };
  const { data, error } = await db.from("gift_vouchers")
    .select("id, code, currency, balance, status, expires_at").eq("code", c).limit(1);
  if (error || !data || !data.length) return { ok: false, reason: "not_found" };
  const v = data[0];
  if (!["active", "test"].includes(v.status) || v.balance <= 0) return { ok: false, reason: "used" };
  if (v.expires_at && v.expires_at < new Date().toISOString().slice(0, 10)) return { ok: false, reason: "expired" };
  if (currency && v.currency !== currency) return { ok: false, reason: "currency", currency: v.currency };
  return { ok: true, voucher: v };
}

/* Atomic: only succeeds if the balance is still sufficient (double-spend guard).
   Returns true on success. */
async function deductVoucher(db, voucherId, amount, orderId) {
  // optimistic read + conditional match on the read balance: an interleaved
  // spend changes balance, the match fails, and we report failure instead of
  // silently double-spending. checkVoucher rejects balance<=0, so no status
  // flip is needed here.
  const { data: cur } = await db.from("gift_vouchers").select("balance").eq("id", voucherId).single();
  if (!cur || cur.balance < amount) return false;
  const { data: upd, error: uerr } = await db.from("gift_vouchers")
    .update({ balance: cur.balance - amount })
    .eq("id", voucherId).eq("balance", cur.balance)
    .select("id");
  if (uerr || !upd || !upd.length) return false;
  await db.from("voucher_redemptions").insert({ voucher_id: voucherId, order_id: orderId || null, amount });
  return true;
}

module.exports = { makeCode, normCode, checkVoucher, deductVoucher };

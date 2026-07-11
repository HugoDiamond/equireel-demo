/* My Videos — passwordless account ("email IS the account").
   POST {email}  -> if we know the address, email a sign-in link (30-min
                    token). Always responds ok — no account enumeration.
   GET  ?t=      -> validate token; link tokens ("l") also mint a 12-month
                    session token ("s"). Returns the customer's full library
                    (legacy orders included — matched via shop_customers).
   Tokens: base64url(email|exp|kind) + "." + HMAC-SHA256, MAGIC_LINK_SECRET. */

const crypto = require("crypto");
const { cors, supabase } = require("./_lib");
const { send, esc } = require("./_email");

const LINK_TTL = 30 * 60 * 1000;            // sign-in link: 30 minutes
const SESSION_TTL = 365 * 24 * 3600 * 1000; // session: 12 months

function secret() {
  const s = process.env.MAGIC_LINK_SECRET;
  if (!s) throw new Error("MAGIC_LINK_SECRET unset");
  return s;
}
const b64u = (s) => Buffer.from(s).toString("base64url");
const sign = (payload) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

function makeToken(email, kind) {
  const exp = Date.now() + (kind === "l" ? LINK_TTL : SESSION_TTL);
  const payload = b64u(`${email}|${exp}|${kind}`);
  return payload + "." + sign(payload);
}

function readToken(t) {
  const [payload, sig] = String(t || "").split(".");
  if (!payload || !sig) return null;
  const want = sign(payload);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  const [email, exp, kind] = Buffer.from(payload, "base64url").toString().split("|");
  if (!email || Date.now() > Number(exp)) return null;
  return { email, kind };
}

const PAID = ["Processing", "Completed", "Test"];

async function library(db, email) {
  const { data: customers } = await db.from("shop_customers").select("id").ilike("email", email);
  const ids = (customers || []).map((c) => c.id);

  let q = db.from("shop_orders")
    .select("id, status, currency, charged, created_at, stripe_receipt_email, customer_id")
    .in("status", PAID).order("id", { ascending: false }).limit(500);
  q = ids.length
    ? q.or(`customer_id.in.(${ids.join(",")}),stripe_receipt_email.ilike.${email}`)
    : q.ilike("stripe_receipt_email", email);
  const { data: orders, error } = await q;
  if (error) throw new Error("orders lookup failed: " + error.message);

  const oids = (orders || []).map((o) => o.id);
  let items = [];
  if (oids.length) {
    // chunk the IN list — a long customer history can exceed URL limits
    for (let i = 0; i < oids.length; i += 100) {
      const { data, error: ierr } = await db.from("shop_order_items")
        .select("order_id, product, price, horse, rider_name, event_name, season, video_link, reel_link, sj_link")
        .in("order_id", oids.slice(i, i + 100));
      if (ierr) throw new Error("items lookup failed: " + ierr.message);
      items = items.concat(data || []);
    }
  }
  const byOrder = {};
  for (const it of items) (byOrder[it.order_id] = byOrder[it.order_id] || []).push(it);

  return (orders || []).map((o) => ({
    id: o.id, status: o.status, currency: o.currency, charged: o.charged, at: o.created_at,
    items: (byOrder[o.id] || []).map((it) => ({
      product: it.product, price: it.price, horse: it.horse, rider: it.rider_name,
      event: it.event_name, season: it.season,
      video: it.video_link || null, reel: it.reel_link || null, sj: it.sj_link || null
    }))
  })).filter((o) => o.items.length);
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const db = supabase();

  if (req.method === "POST") {
    try {
      const b = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
      const email = String(b.email || "").trim().toLowerCase().slice(0, 255);
      if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: "valid email required" });

      // only send if we actually know this address (customer or past order)
      const { data: c } = await db.from("shop_customers").select("id").ilike("email", email).limit(1);
      let known = c && c.length > 0;
      if (!known) {
        const { data: o } = await db.from("shop_orders").select("id").ilike("stripe_receipt_email", email).limit(1);
        known = o && o.length > 0;
      }
      if (known) {
        const site = process.env.SITE_URL || "https://equireel-demo.vercel.app";
        const url = site + "/my-videos?t=" + encodeURIComponent(makeToken(email, "l"));
        await send(email, "Your Equireel sign-in link", `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <div style="border-top:4px solid #C11836;padding:24px 0 8px"><strong style="font-size:20px">EQUIREEL</strong></div>
    <h2 style="font-weight:600">Your videos are waiting</h2>
    <p>Click below to open your video library — every Equireel video you&rsquo;ve ever ordered, in one place.</p>
    <p style="margin:26px 0">
      <a href="${esc(url)}" style="background:#C11836;color:#fff;text-decoration:none;
        padding:13px 26px;border-radius:8px;font-weight:700;display:inline-block">Open my videos</a>
    </p>
    <p style="color:#777;font-size:13px">The link works for 30 minutes and keeps you signed in on this device.
    Didn&rsquo;t request it? You can safely ignore this email.</p>
  </div>`);
      }
      return res.status(200).json({ ok: true }); // identical answer either way
    } catch (e) {
      console.error("my-videos POST failed:", e);
      return res.status(500).json({ error: "unavailable" });
    }
  }

  if (req.method === "GET") {
    try {
      const tok = readToken((req.query && req.query.t) || "");
      if (!tok) return res.status(401).json({ error: "expired" });
      const out = { email: tok.email, orders: await library(db, tok.email) };
      if (tok.kind === "l") out.session = makeToken(tok.email, "s");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(out);
    } catch (e) {
      console.error("my-videos GET failed:", e);
      return res.status(500).json({ error: "unavailable" });
    }
  }

  return res.status(405).json({ error: "method not allowed" });
};

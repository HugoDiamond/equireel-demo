/* Shared helpers for the checkout API (Vercel Node functions, CommonJS).
   The static site never sees any of this — it POSTs to these endpoints only.

   Env (set in Vercel, never committed):
     STRIPE_SECRET_KEY_GBP / STRIPE_SECRET_KEY_EUR   — regional Stripe accounts
     STRIPE_WEBHOOK_SECRET_GBP / STRIPE_WEBHOOK_SECRET_EUR
     SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY        — platform DB (order writes)
     SITE_URL                                        — canonical site origin
     ALLOWED_ORIGINS                                 — comma-separated CORS allowlist
     RESEND_API_KEY / ORDERS_EMAIL_FROM / FULFILMENT_EMAIL — email delivery */

const EVENTS = require("./_events-index.json");

/* pricing mirrors lib/eq.js productPrices() — server is the authority */
function productPrices(ev) {
  const us = ev.c === "us";
  return { xc: ev.p, sjAdd: ev.sj - ev.p, reelAdd: us ? 20 : 10, sjAlone: us ? 40 : 30, fence: us ? 35 : 25, dvd: 5 };
}

/* one Stripe account per settlement currency; USD settles on the UK account */
const CURRENCY_OF = { gb: "GBP", ie: "EUR", fr: "EUR", be: "EUR", us: "USD" };
function stripeFor(currency) {
  const key = currency === "EUR" ? process.env.STRIPE_SECRET_KEY_EUR : process.env.STRIPE_SECRET_KEY_GBP;
  if (!key) throw new Error("stripe key missing for " + currency);
  return new (require("stripe"))(key);
}

const PRODUCT_LABEL = (it) => {
  if (it.p === "sj") return "SJ VIDEO";
  if (it.p === "fence") return "SINGLE FENCE VIDEO";
  let s = it.sjAdd ? "XC & SJ VIDEO" : "XC VIDEO";
  if (it.rl) s += " & SOCIAL REEL";
  return s;
};

/* item → [label, amount] lines, server-priced */
function itemLines(it, ev) {
  const pr = productPrices(ev);
  const ls = [];
  if (it.p === "sj") ls.push(["Show Jumping Video", pr.sjAlone]);
  else if (it.p === "fence") ls.push(["Single Fence Video" + (it.f ? " — fence " + it.f : ""), pr.fence]);
  else {
    ls.push(["Cross Country Video", pr.xc]);
    if (it.sjAdd) ls.push(["Show Jumping add-on", pr.sjAdd]);
    if (it.rl) ls.push(["Social Reel add-on", pr.reelAdd]);
  }
  return ls;
}

const COUNTRY_LABEL = { gb: "UK", ie: "IRL", us: "USA", fr: "FRA", be: "BEL" };
const CURRENCY_ID = { GBP: 1, EUR: 2, USD: 3 };

function equireelLabel(it, ev) {
  const bits = ["EQUIREEL", it.b || "", it.r || "", "&", (it.h || "").toUpperCase(), "at", (ev.n || "").toUpperCase(), ev.y];
  return bits.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function cors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin || "";
  if (allowed.includes(origin) || allowed.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

function supabase() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

module.exports = {
  EVENTS, productPrices, CURRENCY_OF, stripeFor, itemLines, PRODUCT_LABEL,
  COUNTRY_LABEL, CURRENCY_ID, equireelLabel, cors, supabase, readRawBody
};

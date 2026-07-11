/* Order emails via Resend (https://resend.com). Graceful no-op when
   RESEND_API_KEY is unset — the webhook still records the order and logs what
   it would have sent, so payments are never blocked on email config.

   Env: RESEND_API_KEY, ORDERS_EMAIL_FROM (e.g. "Equireel <orders@equireel.com>"),
        FULFILMENT_EMAIL (internal work-order inbox). */

const PREF_LABEL = (pr) => {
  if (!pr) return "defaults (faults in, music on, course sounds on, public)";
  const bits = [];
  bits.push(pr.fa === false ? "EXCLUDE faults" : "faults in");
  bits.push(pr.mu === false ? "NO music" : "music on");
  bits.push(pr.so === false ? "NO course sounds" : "course sounds on");
  bits.push(pr.pu === false ? "PRIVATE" : "public ok");
  if (pr.fl) bits.push("flag: " + String(pr.fl).toUpperCase());
  return bits.join(", ");
};

async function send(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ORDERS_EMAIL_FROM || "Equireel <onboarding@resend.dev>";
  if (!key) { console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject=${subject}`); return; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
}

const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const CUR = { GBP: "£", EUR: "€", USD: "$" };

async function sendCustomerConfirmation({ session, items, order, rows, email, name, currency, receiptUrl }) {
  if (!email) return;
  const sym = CUR[currency] || "£";
  const total = Math.round((session.amount_total || 0) / 100);
  const lines = rows.map((r) =>
    `<tr><td style="padding:6px 12px 6px 0">${esc(r.product)}</td>` +
    `<td style="padding:6px 12px 6px 0">${esc(r.horse)} · ${esc(r.rider_name)}<br>` +
    `<span style="color:#777">${esc(r.event_name)}</span></td>` +
    `<td style="padding:6px 0;text-align:right">${sym}${r.price}</td></tr>`).join("");
  const html = `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <div style="border-top:4px solid #C11836;padding:24px 0 8px"><strong style="font-size:20px">EQUIREEL</strong></div>
    <h2 style="font-weight:600">Thanks${name ? ", " + esc(name.split(" ")[0]) : ""} — your order is in.</h2>
    <p>Our editors are on it. Your video${items.length > 1 ? "s" : ""} will be delivered to this email address
    within <strong>5 days</strong> (usually much sooner).</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${lines}</table>
    <p style="font-size:15px"><strong>Total: ${sym}${total}</strong></p>
    ${receiptUrl ? `<p><a href="${esc(receiptUrl)}" style="color:#C11836">View your card receipt</a></p>` : ""}
    <p style="color:#777;font-size:13px">Add orders@equireel.com to your contacts so the delivery email
    doesn't land in spam. Reply to this email with any question — a human reads it.</p>
  </div>`;
  await send(email, `Your Equireel order — ${rows.length} video${rows.length > 1 ? "s" : ""}`, html);
}

async function sendFulfilmentOrder({ session, items, order, rows, email, currency, md }) {
  const to = process.env.FULFILMENT_EMAIL;
  if (!to) { console.log("[fulfilment email skipped — no FULFILMENT_EMAIL]"); return; }
  const sym = CUR[currency] || "£";
  const lines = rows.map((r, i) => {
    const pr = items[i] && items[i].pr;
    return `<li style="margin-bottom:10px"><code>${esc(r.horse_info)}</code><br>` +
      `${esc(r.product)} — ${sym}${r.price}` +
      (r.xc_day || r.xc_time ? ` — ${esc(r.xc_day || "")} ${esc(r.xc_time || "")}` : "") +
      `<br><em>${esc(PREF_LABEL(pr))}</em></li>`;
  }).join("");
  const html = `
  <div style="font-family:monospace;font-size:14px">
    <p><strong>NEW WEBSITE ORDER #${order ? order.id : "?"}</strong> — ${sym}${Math.round((session.amount_total || 0) / 100)} ${currency}</p>
    <p>Customer: ${esc(email)}</p>
    <ol>${lines}</ol>
    ${md.dvd ? `<p><strong>DVD requested.</strong> Post to: ${esc(md.addr || "(no address!)")}</p>` : ""}
    <p>Stripe session: ${esc(session.id)}</p>
  </div>`;
  await send(to, `Order #${order ? order.id : "?"}: ${rows.length} video${rows.length > 1 ? "s" : ""} (${sym}${Math.round((session.amount_total || 0) / 100)})`, html);
}

async function sendVideoDelivery({ to, url, label, horse, product, event }) {
  const html = `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <div style="border-top:4px solid #C11836;padding:24px 0 8px"><strong style="font-size:20px">EQUIREEL</strong></div>
    <h2 style="font-weight:600">Your video is ready 🎥</h2>
    <p><strong>${esc(horse)}</strong> at ${esc(event)} — ${esc(product)}.</p>
    <p style="margin:26px 0">
      <a href="${esc(url)}" style="background:#C11836;color:#fff;text-decoration:none;
        padding:13px 26px;border-radius:8px;font-weight:700;display:inline-block">Watch your video</a>
    </p>
    <p style="color:#777;font-size:13px">Direct link (save it — it's yours to keep):<br>
      <a href="${esc(url)}" style="color:#C11836;word-break:break-all">${esc(url)}</a></p>
    <p style="color:#777;font-size:13px">All your videos, any time — no password needed:
      <a href="${esc((process.env.SITE_URL || "https://equireel-demo.vercel.app") + "/my-videos")}" style="color:#C11836">My Videos</a></p>
    <p style="color:#777;font-size:13px">Edit requests are free — just reply to this email.</p>
  </div>`;
  await send(to, `Your video is ready — ${horse}`, html);
}

async function sendVoucherEmails({ code, amount, currency, buyerEmail, recipientEmail, recipientName, message, test }) {
  const sym = CUR[currency] || "£";
  const site = process.env.SITE_URL || "https://equireel-demo.vercel.app";
  const testTag = test ? " [TEST]" : "";
  const giftHtml = (greeting) => `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <div style="border-top:4px solid #C11836;padding:24px 0 8px"><strong style="font-size:20px">EQUIREEL</strong></div>
    <h2 style="font-weight:600">${greeting}</h2>
    ${message ? `<p style="font-style:italic;border-left:3px solid #C11836;padding-left:12px">&ldquo;${esc(message)}&rdquo;</p>` : ""}
    <div style="background:#F7F6F7;border-radius:12px;padding:22px;text-align:center;margin:20px 0">
      <div style="font-size:13px;color:#777;letter-spacing:1px">GIFT VOUCHER</div>
      <div style="font-size:30px;font-weight:800;margin:6px 0">${sym}${amount}</div>
      <div style="font-size:20px;font-weight:700;letter-spacing:2px;font-family:monospace">${esc(code)}</div>
    </div>
    <p>Spend it on any Equireel video — find the horse at <a href="${esc(site)}" style="color:#C11836">${esc(site.replace(/^https?:\/\//, ""))}</a>
    and enter the code at checkout. Valid 24 months; any remaining balance stays on the code.</p>
  </div>`;

  if (recipientEmail) {
    await send(recipientEmail, `${recipientName ? esc(recipientName) + ", someone" : "Someone"} sent you an Equireel gift voucher${testTag}`,
      giftHtml(`${recipientName ? esc(recipientName) + " — a" : "A"} gift for you 🎥`));
    await send(buyerEmail, `Your Equireel gift voucher was sent${testTag}`, `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <div style="border-top:4px solid #C11836;padding:24px 0 8px"><strong style="font-size:20px">EQUIREEL</strong></div>
    <h2 style="font-weight:600">Gift sent ✓</h2>
    <p>Your ${sym}${amount} voucher <strong style="font-family:monospace">${esc(code)}</strong> has been emailed to
    <strong>${esc(recipientEmail)}</strong>. Keep this email as your receipt — if it doesn't arrive, just forward
    them the code.</p>
  </div>`);
  } else {
    await send(buyerEmail, `Your Equireel gift voucher — ${sym}${amount}${testTag}`,
      giftHtml("Your gift voucher is ready to give 🎁"));
  }
}

async function sendFulfilmentNote(subject, html) {
  const to = process.env.FULFILMENT_EMAIL;
  if (!to) return;
  await send(to, subject, `<div style="font-family:monospace;font-size:14px">${html}</div>`);
}

module.exports = { send, esc, sendCustomerConfirmation, sendFulfilmentOrder, sendVideoDelivery, sendFulfilmentNote, sendVoucherEmails };

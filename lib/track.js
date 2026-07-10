/* First-party analytics — the site's own funnel, in the site's own database.
   No cookies (anonymous per-tab-session id in sessionStorage), no third-party
   scripts. Silently inert on the static demo (no API configured). */

const API = process.env.NEXT_PUBLIC_CHECKOUT_API || "";

function sid() {
  if (typeof window === "undefined") return "";
  try {
    let s = sessionStorage.getItem("eq_sid");
    if (!s) {
      s = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("eq_sid", s);
    }
    return s;
  } catch (e) { return ""; }
}

export function track(event, data) {
  if (!API || typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      e: event, sid: sid(),
      p: location.pathname + location.search,
      r: document.referrer || "",
      d: data || null
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API + "/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch(API + "/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch (e) { /* never break the page over analytics */ }
}

/* one pageview per page load */
let sent = false;
export function pageview() {
  if (sent) return;
  sent = true;
  track("pageview");
  /* window hook so modules that can't import this one (cycles) still track */
  try { window.__eqTrack = track; } catch (e) {}
}

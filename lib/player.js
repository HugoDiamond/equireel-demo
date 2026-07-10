/* Equireel video player — free clip, paywall, frictionless checkout.
   Ported verbatim from the static site's js/player.js as an imperative
   singleton; client-side only. */

import { icons, money, purchases, showcaseFor, SAMPLE_XC } from "./eq";
import { track } from "./track";

const FREE_SECONDS = 8;
let el = null, video = null, entry = null, event = null, mode = "preview";
let embedReady = false, embedTimer = null;
let embedDropbox = null, embedThumb = null, embedTag = null;
let onPurchaseCb = null;
/* pages with their own checkout (the horse page) register a handler so the
   paywall CTA opens it instead of the modal's built-in fallback checkout */
let orderHandler = null;

export function onPurchase(cb) { onPurchaseCb = cb; }
export function setOrderHandler(fn) { orderHandler = fn; }

function build() {
  if (el) return;
  el = document.createElement("div");
  el.className = "vm-overlay";
  el.innerHTML =
    '<div class="vm-modal" role="dialog" aria-modal="true" aria-label="Video player">' +
      '<div class="vm-head">' +
        '<div class="t"><span id="vm-title"></span><small id="vm-sub"></small></div>' +
        '<button class="vm-close" aria-label="Close">' + icons.x + "</button>" +
      "</div>" +
      '<div class="vm-stage">' +
        '<video id="vm-video" playsinline preload="auto"></video>' +
        '<div class="vm-embed" id="vm-embed"></div>' +
        '<div class="vm-tag" id="vm-tag">Free preview</div>' +

        '<div class="vm-pay" id="vm-pay">' +
          '<h3 id="pay-headline">Loved that? Watch the whole round.</h3>' +
          '<p id="pay-sub"></p>' +
          '<div class="row">' +
            '<button class="btn primary big" id="pay-cta"></button>' +
            '<button class="btn big replay" id="pay-replay">Replay free clip</button>' +
          "</div>" +
          '<div class="secure">' + icons.lock + " Secure checkout &nbsp;·&nbsp; Instant access &nbsp;·&nbsp; Free re-edits</div>" +
        "</div>" +

        '<div class="vm-checkout" id="vm-checkout">' +
          '<div class="inner">' +
            '<h3>Complete your order</h3>' +
            '<p class="sub" id="co-summary"></p>' +
            '<button class="express" id="co-express">' +
              '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5z"/></svg>' +
              "Express checkout" +
            "</button>" +
            '<div class="divider">or pay with card</div>' +
            '<label for="co-email">Email for your video</label>' +
            '<input type="email" id="co-email" placeholder="you@example.com" autocomplete="email">' +
            '<label for="co-card">Card details</label>' +
            '<div class="cardrow">' +
              '<input type="text" id="co-card" inputmode="numeric" placeholder="1234 5678 9012 3456" autocomplete="cc-number">' +
              '<input type="text" id="co-exp" inputmode="numeric" placeholder="MM/YY" autocomplete="cc-exp">' +
              '<input type="text" id="co-cvc" inputmode="numeric" placeholder="CVC" autocomplete="cc-csc">' +
            "</div>" +
            '<label style="display:flex;align-items:center;gap:8px;font-weight:500;margin-top:14px;cursor:pointer">' +
              '<input type="checkbox" id="co-sj" style="width:auto;accent-color:#C11836"> <span id="co-sj-label"></span>' +
            "</label>" +
            '<button class="btn primary big paybtn" id="co-pay"></button>' +
            '<button class="back" id="co-back">&larr; Back to preview</button>' +
          "</div>" +
        "</div>" +

        '<div class="vm-success" id="vm-success">' +
          '<div class="tick">' + icons.check + "</div>" +
          "<h3>You're all set!</h3>" +
          '<p id="succ-sub"></p>' +
          '<button class="btn primary big" id="succ-watch">Watch the full round</button>' +
        "</div>" +
      "</div>" +
    "</div>";
  document.body.appendChild(el);

  video = el.querySelector("#vm-video");

  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  el.querySelector(".vm-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el.classList.contains("open")) close(); });

  video.addEventListener("timeupdate", () => {
    if (mode === "preview" && video.currentTime >= FREE_SECONDS) {
      video.pause();
      showPaywall();
    }
  });
  video.addEventListener("ended", () => { if (mode === "preview" || mode === "eventsample") showPaywall(); });

  /* the real winner samples are Vimeo embeds — listen for their finish
     so the end-card appears exactly as it does for local video */
  window.addEventListener("message", (e) => {
    if (typeof e.origin !== "string" || e.origin.indexOf("vimeo.com") === -1) return;
    let d = e.data;
    try { if (typeof d === "string") d = JSON.parse(d); } catch (err) { return; }
    if (!d || !d.event) return;
    const frame = el && el.querySelector("#vm-embed iframe");
    if (!frame) return;
    if (d.event === "ready") {
      embedReady = true;
      if (embedTimer) { clearTimeout(embedTimer); embedTimer = null; }
      frame.contentWindow.postMessage(JSON.stringify({ method: "addEventListener", value: "finish" }), "*");
    } else if (d.event === "error" && mode === "eventsample") {
      /* 'Sorry, this video doesn't exist' — swap to the real Dropbox XC file
         (or Ennis) immediately, no waiting out the timeout */
      doEmbedFallback();
    } else if (d.event === "finish" && mode === "eventsample") {
      showPaywall();
    }
  });

  el.querySelector("#pay-cta").addEventListener("click", () => {
    if (orderHandler) { close(); orderHandler(); } else showCheckout();
  });
  el.querySelector("#pay-replay").addEventListener("click", () => {
    hidePanels();
    if (entry && entry.generic) mode = "eventsample"; else if (mode === "paywall") mode = "preview";
    const frame = el.querySelector("#vm-embed iframe");
    if (frame) { frame.src = frame.src; return; }
    video.currentTime = 0; video.play();
  });
  el.querySelector("#co-back").addEventListener("click", () => { hidePanels(); showPaywall(); });
  el.querySelector("#co-express").addEventListener("click", () => completePurchase(true));
  el.querySelector("#co-pay").addEventListener("click", () => completePurchase(false));
  el.querySelector("#succ-watch").addEventListener("click", playFull);
  el.querySelector("#co-sj").addEventListener("change", updatePayButton);

  const card = el.querySelector("#co-card"), exp = el.querySelector("#co-exp"), cvc = el.querySelector("#co-cvc");
  card.addEventListener("input", () => {
    let v = card.value.replace(/\D/g, "").slice(0, 16);
    card.value = v.replace(/(.{4})/g, "$1 ").trim();
    card.classList.remove("field-err");
    if (v.length === 16) exp.focus();
  });
  exp.addEventListener("input", () => {
    let v = exp.value.replace(/\D/g, "").slice(0, 4);
    exp.value = v.length > 2 ? v.slice(0, 2) + "/" + v.slice(2) : v;
    exp.classList.remove("field-err");
    if (v.length === 4) cvc.focus();
  });
  cvc.addEventListener("input", () => {
    cvc.value = cvc.value.replace(/\D/g, "").slice(0, 4);
    cvc.classList.remove("field-err");
  });
  [card, exp, cvc, el.querySelector("#co-email")].forEach((f) =>
    f.addEventListener("keydown", (e) => { if (e.key === "Enter") completePurchase(false); })
  );
}

function hidePanels() {
  ["vm-pay", "vm-checkout", "vm-success"].forEach((id) => el.querySelector("#" + id).classList.remove("show"));
}

function resetEmbed() {
  if (!el) return;
  embedReady = false;
  if (embedTimer) { clearTimeout(embedTimer); embedTimer = null; }
  const embed = el.querySelector("#vm-embed");
  embed.innerHTML = "";
  embed.style.display = "none";
  video.style.display = "";
}

/* A working Vimeo embed is never replaced. Only if the embed fails to come up
   (deleted, or embedding blocked on this domain) do we fall back — to the real
   Dropbox XC file for this exact winner where we have one, else the Ennis
   sample. This runs per-domain at runtime, so it self-corrects wherever the
   broken cohort happens to be. */
function doEmbedFallback() {
  if (embedReady || mode !== "eventsample") return;
  resetEmbed();
  embedReady = true;   /* latch settled AFTER resetEmbed (which clears it) so a
                          later timer/error fire is a no-op */
  video.style.display = "";
  if (embedDropbox) {
    video.poster = embedThumb || SAMPLE_XC.thumb || "";
    video.src = embedDropbox;
  } else {
    video.poster = SAMPLE_XC.thumb || "";
    video.src = SAMPLE_XC.video;
    if (embedTag) embedTag.textContent = "Sample · " + SAMPLE_XC.rider + " & " + SAMPLE_XC.horse;
  }
  video.controls = true;
  const p = video.play();
  if (p) p.catch(() => {});
}

function armEmbedFallback(tag, dropboxUrl, thumb) {
  embedReady = false;
  embedDropbox = dropboxUrl || null;
  embedThumb = thumb || null;
  embedTag = tag;
  if (embedTimer) clearTimeout(embedTimer);
  /* backstop: if the embed never signals ready OR error (some blocked embeds
     go silent), fall back after a moment anyway */
  embedTimer = setTimeout(doEmbedFallback, 4500);
}

function showPaywall() {
  mode = "paywall";
  const price = money(event.price, event.country);
  if (entry.generic) {
    el.querySelector("#pay-headline").textContent = "That's what your video looks like.";
    el.querySelector("#pay-sub").innerHTML =
      "Order <strong style='color:#fff'>" + entry.horse + "</strong>'s own complete cross&#8209;country round — every fence, professionally filmed &amp; edited.";
    el.querySelector("#pay-cta").innerHTML = "Order the full round · <span class='price'>" + price + "</span>";
    el.querySelector("#pay-replay").textContent = "Replay sample";
  } else {
    el.querySelector("#pay-replay").textContent = "Replay free clip";
    el.querySelector("#pay-headline").textContent = "That was just one fence.";
    el.querySelector("#pay-sub").innerHTML =
      "Get <strong style='color:#fff'>" + entry.horse + "</strong>'s complete cross&#8209;country round — every fence, professionally filmed &amp; edited.";
    el.querySelector("#pay-cta").innerHTML = "Get the full round · <span class='price'>" + price + "</span>";
  }
  el.querySelector("#vm-pay").classList.add("show");
}

function showCheckout() {
  mode = "checkout";
  hidePanels();
  el.querySelector("#co-summary").textContent =
    entry.horse + " · " + entry.rider + " · " + event.name;
  el.querySelector("#co-sj-label").textContent =
    "Add show jumping round (+" + money(event.priceSJ - event.price, event.country) + ")";
  const em = el.querySelector("#co-email");
  if (!em.value) em.value = purchases.email();
  updatePayButton();
  el.querySelector("#vm-checkout").classList.add("show");
}

function updatePayButton() {
  const withSJ = el.querySelector("#co-sj").checked;
  const total = withSJ ? event.priceSJ : event.price;
  el.querySelector("#co-pay").textContent = "Pay " + money(total, event.country);
}

function completePurchase(express) {
  const emailField = el.querySelector("#co-email");
  if (!express) {
    let ok = true;
    const card = el.querySelector("#co-card"), exp = el.querySelector("#co-exp"), cvc = el.querySelector("#co-cvc");
    if (card.value.replace(/\D/g, "").length < 12) { card.classList.add("field-err"); ok = false; }
    if (exp.value.length < 4) { exp.classList.add("field-err"); ok = false; }
    if (cvc.value.length < 3) { cvc.classList.add("field-err"); ok = false; }
    if (!/.+@.+\..+/.test(emailField.value)) { emailField.classList.add("field-err"); ok = false; }
    else emailField.classList.remove("field-err");
    if (!ok) return;
    purchases.setEmail(emailField.value);
  }
  const btn = express ? el.querySelector("#co-express") : el.querySelector("#co-pay");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>' + (express ? "Confirming…" : "Processing…");

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = original;
    const withSJ = el.querySelector("#co-sj").checked;
    purchases.add(entry.id, {
      horse: entry.horse, rider: entry.rider, event: event.name,
      total: withSJ ? event.priceSJ : event.price, sj: withSJ
    });
    hidePanels();
    el.querySelector("#succ-sub").textContent =
      "The full round of " + entry.horse + " is yours" +
      (purchases.email() ? " — a copy has been sent to " + purchases.email() : "") + ".";
    el.querySelector("#vm-success").classList.add("show");
    if (onPurchaseCb) onPurchaseCb(entry.id);
  }, express ? 900 : 1500);
}

function playFull() {
  mode = "full";
  hidePanels();
  resetEmbed();
  const tag = el.querySelector("#vm-tag");
  tag.textContent = "Full round";
  tag.classList.add("full");
  video.controls = true;
  /* the sample may be loaded — switch back to the buyer's own round */
  if (entry && !video.currentSrc.endsWith(entry.video.split("/").pop())) {
    video.poster = entry.thumb || "";
    video.src = entry.video;
  }
  video.currentTime = 0;
  video.play();
}

export function open(theEntry, theEvent, opts) {
  build();
  entry = theEntry;
  event = theEvent;
  track("video_play", {
    id: theEntry && theEntry.id, ev: theEvent && theEvent.id,
    kind: opts && opts.publicUrl ? "public" : purchases.has(theEntry.id) ? "owned" : "sample"
  });
  hidePanels();
  resetEmbed();
  el.querySelector("#vm-title").textContent = entry.horse + " — bib " + entry.bib;
  el.querySelector("#vm-sub").textContent = entry.rider + " · " + entry.section + " · " + event.name;
  const tag = el.querySelector("#vm-tag");
  video.poster = entry.thumb || "";
  video.src = entry.video;

  if (opts && opts.publicUrl) {
    /* a delivered customer video whose owner made it public — the real round */
    mode = "full";
    video.style.display = "";
    video.poster = entry.thumb || "";
    video.src = opts.publicUrl;
    tag.textContent = "Full round · Official Equireel video";
    tag.classList.add("full");
    video.controls = true;
    el.classList.add("open");
    document.body.style.overflow = "hidden";
    video.currentTime = 0;
    const pp = video.play();
    if (pp) pp.catch(() => {});
    return;
  }

  if (purchases.has(entry.id)) {
    mode = "full";
    tag.textContent = "Full round";
    tag.classList.add("full");
    video.controls = true;
  } else if (entry.generic || (event && event.status !== "ready")) {
    /* no personal clip — play a full sample uninterrupted: the winner's
       real published video for this class, else the global sample round */
    mode = "eventsample";
    const sc = showcaseFor(event, entry);
    /* Try the real Vimeo embed FIRST — working links (the large majority) keep
       playing and are never switched. Only if the embed fails to come up
       (deleted / embedding-disabled cohort) do we fall back to the Dropbox XC
       file, then the Ennis sample. */
    if (sc && sc.vimeo) {
      const [vid, h] = sc.vimeo.split("/");
      video.style.display = "none";
      video.removeAttribute("src");
      const embed = el.querySelector("#vm-embed");
      embed.style.display = "block";
      embed.innerHTML = '<iframe src="https://player.vimeo.com/video/' + vid +
        "?" + (h ? "h=" + h + "&" : "") +
        'autoplay=1&title=0&byline=0&portrait=0&api=1&player_id=vm-embed-frame" ' +
        'id="vm-embed-frame" allow="autoplay; fullscreen" allowfullscreen></iframe>';
      armEmbedFallback(tag, sc.dropbox || null, sc.thumb);
    } else if (sc && sc.dropbox) {
      /* no Vimeo (or demo) — play the real XC file inline */
      resetEmbed();
      video.style.display = "";
      video.poster = sc.thumb || SAMPLE_XC.thumb || "";
      video.src = sc.dropbox;
    } else {
      video.poster = SAMPLE_XC.thumb || "";
      video.src = SAMPLE_XC.video;
    }
    tag.textContent = sc
      ? (sc.cls ? "Sample · Winning " + sc.cls + " round" : "Sample · Winning round at this event")
      : "Sample · " + SAMPLE_XC.rider + " & " + SAMPLE_XC.horse;
    tag.classList.add("full");
    video.controls = true;
  } else {
    mode = "preview";
    tag.textContent = "Free preview · Fence " + entry.fence;
    tag.classList.remove("full");
    video.controls = false;
  }
  el.classList.add("open");
  document.body.style.overflow = "hidden";
  if (video.getAttribute("src")) {
    video.currentTime = 0;
    const p = video.play();
    if (p) p.catch(() => {});
  }
}

export function openSample(s) {
  build();
  entry = null;
  event = null;
  mode = "sample";
  hidePanels();
  resetEmbed();
  el.querySelector("#vm-title").textContent = s.title;
  el.querySelector("#vm-sub").textContent = s.desc;
  const tag = el.querySelector("#vm-tag");
  tag.textContent = "Sample";
  tag.classList.add("full");
  video.poster = s.thumb || "";
  video.src = s.video;
  video.controls = true;
  el.classList.add("open");
  document.body.style.overflow = "hidden";
  video.currentTime = 0;
  const p = video.play();
  if (p) p.catch(() => {});
}

export function close() {
  if (!el) return;
  el.classList.remove("open");
  document.body.style.overflow = "";
  resetEmbed();
  video.pause();
  video.removeAttribute("src");
  video.load();
}

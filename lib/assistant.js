/* The Equireel assistant — grounded, instant, and free forever.
   No API, no per-question cost: a scored intent engine over the shop's real
   facts, plus LIVE catalogue search (the full events/entries data is already
   in the browser), so "find Dassett Choice" returns actual links.
   Every answer is deterministic and true — nothing is generated. */

import { href, searchAll, tidyName } from "./eq";

/* ---------- intents: keywords score, best intent answers ---------- */

const INTENTS = [
  {
    id: "pricing",
    kw: ["price", "cost", "how much", "pricing", "pay", "fee", "expensive", "cheap", "€", "$", "£"],
    a: () => ({
      text: "A Cross Country Video is £60 (UK), €70 (Europe) or $159 (USA). Add-ons: Social Reel +£10/€10/$20, Show Jumping +£20/€20/$20, DVD posted +£5. A Show Jumping video on its own is £30/€30/$40, and a single fence video £25/€25/$35. The exact price always shows on the horse's page before you pay.",
      followups: ["When will my video arrive?", "What can I personalise?"]
    })
  },
  {
    id: "delivery",
    kw: ["deliver", "arrive", "how long", "when will", "ready", "wait", "turnaround", "receive", "email me the video", "get my video"],
    a: () => ({
      text: "Your video is delivered by email, within 5 days — and many events are much faster (within the hour, or instantly). The exact promise for your event is shown under the order button before you pay. Delivery comes from info@equireel.com, so check spam if you don't see it.",
      followups: ["What if I withdrew?", "How much does it cost?"]
    })
  },
  {
    id: "refunds",
    kw: ["refund", "withdrew", "withdraw", "eliminated", "retired", "cancel", "money back", "fell", "fall", "didn't complete", "did not complete"],
    a: () => ({
      text: "Our refund policy is simple: cancel any time before delivery for a full refund. If you withdrew before the cross country, choose a full refund or a credit. If you were eliminated or retired on course, we can send your video up to where your day ended — or refund you. And if we didn't capture your round at all, you're refunded in full.",
      links: [{ label: "Full terms", to: "/terms" }],
      followups: ["Can I get edits after delivery?"]
    })
  },
  {
    id: "find",
    kw: ["find", "search", "my horse", "my video", "my round", "looking for", "where is", "locate", "bib"],
    a: () => ({
      text: "Search your horse, your name or your bib number from the homepage — or just type the horse or rider's name right here in this chat and I'll look it up for you. Every competitor at a filmed event is listed; no pre-booking was needed.",
      followups: ["Is my event covered?"]
    })
  },
  {
    id: "notlisted",
    kw: ["not listed", "can't find", "cant find", "missing", "isn't there", "isnt there", "not there", "no results", "not showing"],
    a: () => ({
      text: "If your horse isn't listed, use the \"can't find my horse\" option on the event page — tell us the horse and rider and we'll locate your round from the footage. Unlisted orders take a little longer while we find you, but we film every competitor at every fence.",
      followups: ["How long does delivery take?"]
    })
  },
  {
    id: "personalise",
    kw: ["personalise", "personalize", "music", "flag", "sound", "faults", "customise", "customize", "options", "edit the video"],
    a: () => ({
      text: "At checkout you choose: the country flag shown on your video, music on or off, course sounds on or off, faults included or excluded, and whether the video is public or private. Ordering more than one? Each video can have its own settings.",
      followups: ["Is my video public or private?"]
    })
  },
  {
    id: "privacy_video",
    kw: ["public", "private", "social media", "facebook", "instagram", "share", "featured"],
    a: () => ({
      text: "Your choice at checkout. Public videos may be featured on our social media — most riders love the shout-out. Prefer privacy? Untick \"Public video\" and only you receive the link. You can change your mind later by emailing us.",
      followups: ["What can I personalise?"]
    })
  },
  {
    id: "samples",
    kw: ["sample", "example", "look like", "quality", "preview", "watch first", "see a video", "demo"],
    a: () => ({
      text: "Every horse page has a free sample round you can watch before buying — and the homepage has examples of a cross country video, a social reel and a show jumping video. What you see is what you get: professionally filmed at every fence and edited.",
      links: [{ label: "Watch the samples", to: "/#samples" }]
    })
  },
  {
    id: "payment",
    kw: ["card", "apple pay", "google pay", "stripe", "payment method", "paypal", "account", "sign up", "register", "login"],
    a: () => ({
      text: "Card, Apple Pay or Google Pay — handled securely by Stripe. No account needed; the whole order takes about a minute, and your video arrives by email.",
      followups: ["How much does it cost?"]
    })
  },
  {
    id: "reel",
    kw: ["reel", "instagram format", "tiktok", "portrait", "vertical", "social reel", "story"],
    a: () => ({
      text: "The Social Reel is a portrait edit of your round's best moments, sized for Instagram and TikTok — add it to a Cross Country Video for £10/€10/$20. There's a sample on the homepage.",
      links: [{ label: "See a sample reel", to: "/#samples" }]
    })
  },
  {
    id: "sj",
    kw: ["show jumping", "showjumping", "sj video", "jumping phase"],
    a: () => ({
      text: "Show jumping is available two ways: as an add-on to your Cross Country Video (+£20/€20/$20) or on its own (£30/€30/$40) — your full round, both where we filmed it.",
      followups: ["How much is everything?"]
    })
  },
  {
    id: "dvd",
    kw: ["dvd", "disc", "posted", "physical copy"],
    a: () => ({
      text: "Yes — add a DVD copy at checkout for £5 and we'll post it to you (you'll be asked for a postal address). The video itself still arrives by email as normal.",
    })
  },
  {
    id: "edits",
    kw: ["edit request", "change the video", "re-edit", "wrong", "mistake", "fix"],
    a: () => ({
      text: "Edit requests are free after delivery — just reply to your delivery email or write to info@equireel.com and tell us what to change.",
    })
  },
  {
    id: "coverage",
    kw: ["do you film", "were you at", "are you at", "cover", "which events", "what events", "attend", "coming to", "filming"],
    a: () => ({
      text: "We film eventing across the UK, Ireland, France and the USA — type your event's name here and I'll check it for you, or browse everything by country.",
      links: [
        { label: "UK events", to: "/events?country=gb" },
        { label: "Ireland", to: "/events?country=ie" },
        { label: "USA", to: "/events?country=us" }
      ]
    })
  },
  {
    id: "how",
    kw: ["how does it work", "how it works", "booking", "pre-book", "prebook", "before my event", "sign up before"],
    a: () => ({
      text: "No booking needed — if Equireel is at your event, every competitor is filmed at every fence automatically. Afterwards, find your horse on the site, watch the free sample, order in about a minute, and your edited round arrives by email.",
      followups: ["Find my horse", "How much does it cost?"]
    })
  },
  {
    id: "human",
    kw: ["human", "person", "talk to someone", "phone", "contact", "email you", "speak to", "complaint", "help me"],
    a: () => ({
      text: "A human reads every email at info@equireel.com — we reply fast. For order problems, include the horse's name and the event and we'll sort it.",
      links: [{ label: "Email info@equireel.com", to: "mailto:info@equireel.com" }]
    })
  },
  {
    id: "greeting",
    kw: ["hello", "hi", "hey", "morning", "afternoon", "thanks", "thank you", "cheers"],
    a: () => ({
      text: "Hello! 🐎 Ask me anything about finding your horse, prices, delivery or refunds — or type a horse or rider's name and I'll look it up.",
      followups: ["How much is a video?", "When will it arrive?"]
    })
  }
];

/* ---------- live catalogue lookup ---------- */

function lookup(q) {
  const res = searchAll(q);
  const links = [];
  for (const e of res.events.slice(0, 2)) {
    links.push({ label: "📅 " + e.name + " " + e.date.slice(0, 4), to: "/event?id=" + e.id });
  }
  for (const x of res.entries.slice(0, 3)) {
    if (x.kind === "rider") {
      links.push({
        label: "🏇 " + tidyName(x.en.rider) + " (rider)",
        to: "/rider?name=" + encodeURIComponent(x.en.rider) + "&c=" + x.ev.country
      });
    } else {
      links.push({
        label: "🐴 " + x.en.horse + " — " + x.ev.name,
        to: "/horses?name=" + encodeURIComponent(x.en.horse) + "&c=" + x.ev.country
      });
    }
  }
  return links;
}

/* extract a possible name to search: strip intent-ish words, keep the rest */
const STOP = new Set(("find search my video horse rider round for the a an of at in on is are was were you your do does can i me it and or please where when how much what which event events show me looking watch buy order get").split(" "));
function nameResidual(q) {
  const words = q.replace(/[^a-z0-9\s'-]/gi, " ").split(/\s+/).filter(Boolean);
  const keep = words.filter((w) => !STOP.has(w.toLowerCase()));
  const s = keep.join(" ").trim();
  return s.length >= 3 ? s : "";
}

/* ---------- the answer engine ---------- */

export function answer(q) {
  const raw = String(q || "").trim();
  const lq = " " + raw.toLowerCase() + " ";

  // score intents
  let best = null, bestScore = 0;
  for (const it of INTENTS) {
    let score = 0;
    for (const k of it.kw) {
      if (lq.includes(k)) score += k.includes(" ") ? 2 : 1;
    }
    if (score > bestScore) { best = it; bestScore = score; }
  }

  // catalogue lookup on whatever name-like residue the question carries
  const residual = nameResidual(raw);
  const found = residual ? lookup(residual) : [];

  if (best && bestScore >= 2) {
    const out = best.a();
    if ((best.id === "find" || best.id === "coverage") && found.length) {
      return {
        text: "Here's what I found for \"" + residual + "\" — tap through to watch the sample and order:",
        links: found
      };
    }
    return out;
  }

  // no strong intent — if the words match the catalogue, that IS the answer
  if (found.length) {
    return {
      text: "I searched the site for \"" + residual + "\" — is this what you're after?",
      links: found,
      followups: ["How much is a video?", "When will it arrive?"]
    };
  }
  if (best && bestScore >= 1) return best.a();

  return {
    text: "I'm not sure about that one — but I can help with prices, delivery, refunds, personalisation, or finding a horse or rider (just type the name). For anything else, a human reads info@equireel.com.",
    links: [{ label: "Read the FAQ", to: "/faq" }],
    followups: ["How much is a video?", "Find my horse", "Refund policy"]
  };
}

export const STARTERS = ["How much is a video?", "When will it arrive?", "What if I withdrew?", "Find my horse"];
export { href as assistantHref };

/* Equireel core — data, helpers and shared renderers.
   Ported verbatim from the static site's js/data.js + js/app.js; paths are
   base-path aware so the same build serves / locally and /equireel-demo on Pages. */

import { REAL_EVENTS } from "./events-real";
import { PROMOS } from "./promos";

export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const asset = (p) => BASE + p;
export const href = (p) => BASE + p;

export const COUNTRIES = [
  { code: "gb", name: "United Kingdom" },
  { code: "us", name: "United States" },
  { code: "fr", name: "France" },
  { code: "ie", name: "Ireland" },
  { code: "be", name: "Belgium" }
];

export const VIDEOS = [
  "/assets/video/round1.mp4",
  "/assets/video/round2.mp4",
  "/assets/video/round3.mp4",
  "/assets/video/round4.mp4"
];
export const THUMBS = [
  "/assets/video/thumb1.jpg?v=2",
  "/assets/video/thumb2.jpg?v=2",
  "/assets/video/thumb3.jpg?v=2",
  "/assets/video/thumb4.jpg?v=2"
];

/* Real events (2023 onwards) come from the entries dump + web research.
   The mock fixtures below survive only as TEMPLATES for the 2019-2022
   archive, which stays generated until that data arrives. */
export const EVENTS = [...REAL_EVENTS];
const REAL_IDS = new Set(REAL_EVENTS.map((e) => e.id));

const TEMPLATE_EVENTS = [
  /* ---- United Kingdom ---- */
  { id: "aston-2", country: "gb", name: "Aston-le-Walls (2)", venue: "Northamptonshire", date: "2026-06-27", dateEnd: "2026-06-28", body: "British Eventing",
    sections: ["BE80 Section A", "BE90 Section B", "BE100 Section C"], status: "ready", price: 60, priceSJ: 80, delivery: "instant" },
  { id: "tweseldown-3", country: "gb", name: "Tweseldown (3)", venue: "Hampshire", date: "2026-06-20", body: "Unaffiliated",
    sections: ["BE80 Section A", "BE90 Section B", "BE100 Section C", "Novice Section D"], status: "ready", price: 60, priceSJ: 80, clips: false, askStartTime: true, showcase: true },
  { id: "bicton-1", country: "gb", name: "Bicton Arena (1)", venue: "Devon", date: "2026-06-13", dateEnd: "2026-06-14", body: "British Eventing",
    sections: ["BE90 Section A", "BE100 Section B", "Novice Section C"], status: "ready", price: 60, priceSJ: 80, delivery: "fast" },
  { id: "little-downham", country: "gb", name: "Little Downham (1)", venue: "Cambridgeshire", date: "2026-05-30", dateEnd: "2026-05-31", body: "British Eventing",
    sections: ["BE80 Section A", "BE90 Section B", "BE100 Section C"], status: "ready", price: 60, priceSJ: 80 },
  { id: "chatsworth", country: "gb", name: "Chatsworth International", venue: "Derbyshire", date: "2026-05-16", dateEnd: "2026-05-17", body: "British Eventing",
    sections: ["BE100 Section A", "Novice Section B", "Intermediate Section C"], status: "ready", price: 60, priceSJ: 80 },
  { id: "kelsall-hill", country: "gb", name: "Kelsall Hill (1)", venue: "Cheshire", date: "2026-05-02", dateEnd: "2026-05-03", body: "British Eventing",
    sections: ["BE80 Section A", "BE90 Section B", "BE100 Section C", "Novice Section D"], status: "ready", price: 60, priceSJ: 80 },
  { id: "burnham-market", country: "gb", name: "Burnham Market International", venue: "Norfolk", date: "2026-04-17", dateEnd: "2026-04-19", body: "British Eventing",
    sections: ["Novice Section A", "Intermediate Section B", "Advanced Section C"], status: "ready", price: 60, priceSJ: 80 },
  { id: "aston-upcoming", country: "gb", name: "Aston-le-Walls (3)", venue: "Northamptonshire", date: "2026-06-30", dateEnd: "2026-07-01", body: "British Eventing",
    sections: ["BE90 Section A", "BE100 Section B"], status: "processing", price: 60, priceSJ: 80, delivery: "fast" },

  /* ---- Ireland ---- */
  { id: "tattersalls", country: "ie", name: "Tattersalls June HT", venue: "Co. Meath", date: "2026-06-21", dateEnd: "2026-06-22", body: "Eventing Ireland",
    sections: ["EI90 Section A", "EI100 Section B", "EI110 Section C"], status: "ready", price: 60, priceSJ: 80, delivery: "fast", defaultFlag: "ie" },
  { id: "kilguilkey", country: "ie", name: "Kilguilkey House HT", venue: "Co. Cork", date: "2026-06-07", body: "Eventing Ireland",
    sections: ["EI90 Section A", "EI100 Section B"], status: "ready", price: 60, priceSJ: 80 },
  { id: "ballindenisk", country: "ie", name: "Ballindenisk International", venue: "Co. Cork", date: "2026-05-24", dateEnd: "2026-05-26", body: "Eventing Ireland",
    sections: ["EI100 Section A", "EI110 Section B", "CCI2*-S"], status: "ready", price: 60, priceSJ: 80 },
  { id: "punchestown", country: "ie", name: "Punchestown HT", venue: "Co. Kildare", date: "2026-05-10", dateEnd: "2026-05-11", body: "Eventing Ireland",
    sections: ["EI90 Section A", "EI100 Section B", "EI110 Section C"], status: "ready", price: 60, priceSJ: 80 },

  /* ---- France ---- */
  { id: "haras-du-pin", country: "fr", name: "Le Grand Complet — Haras du Pin", venue: "Normandie", date: "2026-06-19", dateEnd: "2026-06-21", body: "FFE",
    sections: ["Amateur 1", "CCI2*-S", "CCI3*-S"], status: "ready", price: 60, priceSJ: 80, clips: false },
  { id: "saumur", country: "fr", name: "Saumur International", venue: "Pays de la Loire", date: "2026-05-29", dateEnd: "2026-05-31", body: "FFE",
    sections: ["CCI2*-S", "CCI3*-L"], status: "ready", price: 60, priceSJ: 80, clips: false },
  { id: "pompadour", country: "fr", name: "Pompadour HT", venue: "Nouvelle-Aquitaine", date: "2026-05-08", dateEnd: "2026-05-09", body: "FFE",
    sections: ["Amateur 1", "Amateur Elite", "CCI2*-S"], status: "ready", price: 60, priceSJ: 80, clips: false },

  /* ---- Belgium ---- */
  { id: "arville", country: "be", name: "Arville International", venue: "Gaume", date: "2026-06-26", dateEnd: "2026-06-28", body: "Eventing Belgium",
    sections: ["CCI2*-S", "CCI3*-S", "CCI4*-S"], status: "ready", price: 60, priceSJ: 80, clips: false, showcase: true },
  { id: "minderhout", country: "be", name: "Minderhout HT", venue: "Antwerp", date: "2026-05-17", body: "Eventing Belgium",
    sections: ["EB90 Section A", "EB100 Section B"], status: "ready", price: 60, priceSJ: 80, clips: false },

  /* ---- United States ---- */
  { id: "stable-view", country: "us", name: "Stable View Summer HT", venue: "Aiken, SC", date: "2026-06-14", dateEnd: "2026-06-15", body: "USEA",
    sections: ["Beginner Novice A", "Novice B", "Training C"], status: "ready", price: 75, priceSJ: 95, delivery: "instant" },
  { id: "rocking-horse-w1", country: "us", name: "Rocking Horse Winter I", venue: "Altoona, FL", date: "2026-01-23", dateEnd: "2026-01-25", body: "USEA",
    sections: ["Open Intermediate (Friday)", "Open Preliminary (Friday)"], status: "ready", price: 75, priceSJ: 95 },
  { id: "carolina", country: "us", name: "Carolina International", venue: "Raeford, NC", date: "2026-03-21", dateEnd: "2026-03-22", body: "USEA",
    sections: ["Training A", "Preliminary B", "Intermediate C"], status: "ready", price: 75, priceSJ: 95 },
  { id: "kentucky-may", country: "us", name: "May-Daze at the Park", venue: "Lexington, KY", date: "2026-05-22", dateEnd: "2026-05-24", body: "USEA",
    sections: ["Beginner Novice A", "Novice B", "Training C"], status: "ready", price: 75, priceSJ: 95 }
];

/* ---------- deterministic entry generation (ported verbatim) ---------- */

const HORSES = [
  "My Little Pony", "Midnight Runner", "Copper Beech", "Faithful Friend", "Silver Lining II",
  "Bally's Last Stand", "Monbeg Whisper", "Cooley Firecracker", "Ardeo Sunrise", "Kilcandra Blue",
  "Ringwood Star", "Ballypatrick Rebel", "Greylands Gatsby", "Ashfield Cruise", "Newmarket Jack",
  "Loughview Lass", "Templar Justice", "Rock On Ruby", "Clover Hill Dancer", "Fernhill Phantom",
  "Dassett Gold", "Chilli Morning Dew", "Vendredi Nights", "Master Chuckles", "Bonza Superstar",
  "Cavalier Crystal", "Dromgurrihy Blue", "Killossery Kruise", "Luska Candy Clover", "Mr Fahrenheit",
  "Shannondale Percy", "Ballingowan Pizazz", "Creevagh Silver", "Highway Frolic", "Imperial Striker",
  "Jefferson Bay", "Knockmullen Duchess", "Lakeview Lad", "Monarch's Mission", "Native Speaker",
  "Opposition Aviator", "Primitive Star", "Quality Time III", "Redwood Ranger", "Springpower",
  "Tullabeg Flamenco", "Urban Legend II", "Valentine Vixen", "Westwood Poppy", "Zara's Promise"
];
const FIRST = ["David", "Sarah", "Emily", "Tom", "Grace", "Jack", "Lucy", "Oliver", "Katie", "James",
  "Hannah", "Will", "Sophie", "Harry", "Amelia", "Charlie", "Isla", "George", "Ella", "Sam",
  "Rosie", "Ben", "Megan", "Freddie", "Alice", "Padraig", "Niamh", "Cian", "Aoife", "Boyd"];
const LAST = ["Bambrick", "Whitfield", "Harte", "O'Callaghan", "Pemberton", "Morrissey", "Townend",
  "Collett", "French", "Canter", "Kavanagh", "Levett", "Murphy", "O'Connor", "Watson", "Brennan",
  "Fox-Pitt", "Ryan", "Nicholson", "Price", "Burton", "Jung", "Hoy", "Tait", "Llewellyn",
  "Doyle", "Walsh", "McCarthy", "Hughes", "Stanhope"];
const OWNER_STYLES = [
  (r) => r,
  (r) => r,
  () => "JP McManus",
  (r) => "The " + r.split(" ").pop() + " Syndicate",
  (r) => r.split(" ").pop() + " Sport Horses",
  () => "M & K Stables",
  (r) => (r[0] + " " + r.split(" ").pop()),
  () => "Hazeldene Farm",
  () => "The Monbeg Partnership",
  (r) => r.split(" ").pop() + " Family"
];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return h;
}

const entryCache = {};

/* ---------- real entries (fetched once from /data/entries.json) ---------- */

let realEntries = null, loadPromise = null;
const dataCbs = [];
export const entriesLoaded = () => !!realEntries;
export function onDataLoaded(cb) {
  if (realEntries) { cb(); return () => {}; }
  dataCbs.push(cb);
  return () => { const i = dataCbs.indexOf(cb); if (i >= 0) dataCbs.splice(i, 1); };
}
export function loadRealEntries() {
  if (loadPromise || typeof window === "undefined") return loadPromise;
  loadPromise = fetch(asset("/data/entries.json"))
    .then((r) => r.json())
    .then((j) => { realEntries = j; dataCbs.splice(0).forEach((cb) => { try { cb(); } catch (e) {} }); })
    .catch(() => { loadPromise = null; });
  return loadPromise;
}

export function getEntries(eventId) {
  if (entryCache[eventId]) return entryCache[eventId];
  const ev = EVENTS.find((e) => e.id === eventId);
  if (!ev) return [];

  if (REAL_IDS.has(eventId)) {
    const rows = realEntries && realEntries[eventId];
    if (!rows) return []; /* not loaded yet — pages re-render via onDataLoaded */
    const generic = ev.clips === false;
    const evIdx = (hashCode(eventId) >>> 0) % VIDEOS.length;
    const entries = rows.map((r, i) => {
      const id = eventId + "-e" + i;
      const vidx = generic ? evIdx : (hashCode(id) >>> 0) % VIDEOS.length;
      return {
        id, bib: r[0], horse: r[1], rider: r[2], owner: "", section: r[5] || "",
        xcDay: r[3] || "", xcTime: r[4] || "",
        generic, video: asset(VIDEOS[vidx]), thumb: asset(THUMBS[vidx]),
        fence: 4 + ((i * 5 + (hashCode(eventId) >>> 0)) % 14),
        _s: (r[1] + " " + r[2]).toLowerCase()
      };
    });
    /* programme order: sections sort by their section letter where one
       exists (BE runs Section A, B, C… as the day's order), else
       alphabetically; unsectioned entries last; numeric bib within */
    if (entries.some((en) => en.section)) {
      const secKey = (s) => {
        if (!s) return "￿";
        const m = /section\s+([a-z])\s*(\d*)/i.exec(s);
        return m ? m[1].toLowerCase() + (m[2] || "0").padStart(3, "0") + " " + s.toLowerCase() : "zz " + s.toLowerCase();
      };
      entries.sort((a, b) =>
        secKey(a.section).localeCompare(secKey(b.section)) ||
        ((+String(a.bib).replace(/\D/g, "") || 0) - (+String(b.bib).replace(/\D/g, "") || 0)));
    }
    /* every thumbnail belongs to the sample that will actually play: the
       section-relevant winner's REAL published video, else the global
       sample round */
    const promoPairs = PROMOS[eventId] || [];
    const byId = new Map(entries.map((e) => [e.id, e]));
    const promoEntries = promoPairs.map(([i, vim, dropbox, thumb]) => {
      const p = byId.get(eventId + "-e" + i);
      if (p) {
        p.vimeo = vim || null;
        p.dropbox = dropbox || null;            /* real XC file, plays reliably */
        p.vthumb = thumb ? asset("/assets/promo-thumbs/" + thumb) : null;
      }
      return p;
    }).filter(Boolean);
    entries.forEach((en) => {
      const pick = pickPromo(en, promoEntries);
      if (pick && (pick.dropbox || pick.vimeo)) {
        /* the winner's real video plays — Dropbox XC file where we have it
           (with its own frame as the thumbnail), else the Vimeo embed */
        en.sampleVimeo = pick.vimeo;
        en.sampleDropbox = pick.dropbox;
        en.thumb = pick.vthumb || asset(THUMBS[(hashCode(pick.id) >>> 0) % THUMBS.length]);
      } else {
        en.sampleVimeo = null;
        en.sampleDropbox = null;
        en.thumb = SAMPLE_XC.thumb;
      }
    });
    entryCache[eventId] = entries;
    return entries;
  }

  const rand = mulberry32(hashCode(eventId));
  const entries = [];
  let bib = 1;
  const usedHorses = new Set();

  ev.sections.forEach((section, si) => {
    const n = 30 + Math.floor(rand() * 15);
    if (eventId === "aston-2" && si === 0) {
      entries.push(
        { bib: 1, section, horse: "My Little Pony", rider: "David Bambrick", owner: "JP McManus" },
        { bib: 2, section, horse: "Midnight Runner", rider: "Sarah Whitfield", owner: "Sarah Whitfield" },
        { bib: 3, section, horse: "Copper Beech", rider: "Emily Harte", owner: "The Beech Syndicate" }
      );
      usedHorses.add("My Little Pony"); usedHorses.add("Midnight Runner"); usedHorses.add("Copper Beech");
      bib = 4;
    }
    for (let i = 0; i < n; i++) {
      let horse = HORSES[Math.floor(rand() * HORSES.length)];
      let guard = 0;
      while (usedHorses.has(horse) && guard++ < 60) horse = HORSES[Math.floor(rand() * HORSES.length)];
      /* pool is smaller than a real start list — reuse names with the
         numeral suffix convention (Silver Lining II) to stay unique */
      const NUM = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      for (let ni = 0; usedHorses.has(horse) && ni < NUM.length; ni++) {
        const cand = horse.replace(/ (II|III|IV|V|VI|VII|VIII|IX|X)$/, "") + " " + NUM[ni];
        if (!usedHorses.has(cand)) horse = cand;
      }
      usedHorses.add(horse);
      const rider = FIRST[Math.floor(rand() * FIRST.length)] + " " + LAST[Math.floor(rand() * LAST.length)];
      const owner = OWNER_STYLES[Math.floor(rand() * OWNER_STYLES.length)](rider);
      entries.push({ bib: bib++, section, horse, rider, owner });
    }
    bib += 2 + Math.floor(rand() * 4);
  });

  const generic = ev.clips === false;
  const evIdx = (hashCode(eventId) >>> 0) % VIDEOS.length;
  entries.forEach((en) => {
    en.id = eventId + "-" + en.bib;
    en.generic = generic;
    /* archive events play the global sample — thumbnails match it */
    en.video = generic ? SAMPLE_XC.video : asset(VIDEOS[(hashCode(en.id) >>> 0) % VIDEOS.length]);
    en.thumb = generic ? SAMPLE_XC.thumb : asset(THUMBS[(hashCode(en.id) >>> 0) % THUMBS.length]);
    en.fence = 4 + ((en.bib * 5 + (hashCode(eventId) >>> 0)) % 14);
    en._s = (en.horse + " " + en.rider).toLowerCase();
  });

  entryCache[eventId] = entries;
  return entries;
}

/* ---------- historical archive 2019–2022 ----------
   Generated deterministically from the template fixtures until the real
   pre-2023 data arrives. Not every fixture runs every year, 2020 is mostly
   empty, the US archive starts 2021. */

const COUNTRY_SINCE = { gb: 2019, ie: 2019, us: 2021, fr: 2024, be: 2024 };

(function buildArchive() {
  const templates = TEMPLATE_EVENTS.slice();
  templates.forEach((t) => { t.baseId = t.id; });
  const hist = [];
  templates.forEach((t) => {
    const since = COUNTRY_SINCE[t.country] || 2019;
    for (let y = since; y <= 2022; y++) {
      const h = hashCode(t.id + ":" + y) >>> 0;
      if (y === 2020 && h % 5 !== 0) continue; /* covid year: most events cancelled */
      if (h % 4 === 0) continue;               /* fixtures skip years sometimes */
      hist.push(Object.assign({}, t, {
        id: t.id + "-" + y,
        baseId: t.id,
        date: String(y) + t.date.slice(4),
        dateEnd: t.dateEnd ? String(y) + t.dateEnd.slice(4) : undefined,
        status: "ready",
        clips: false,
        delivery: "standard", /* archive rounds are edited on order */
        askStartTime: true    /* old time sheets — a rough start time helps */
      }));
    }
  });
  EVENTS.push(...hist);
})();

export const eventYear = (e) => +e.date.slice(0, 4);

export const getEvent = (id) => EVENTS.find((e) => e.id === id);
export const getCountry = (code) => COUNTRIES.find((c) => c.code === code);
export const eventsForCountry = (code) =>
  EVENTS.filter((e) => e.country === code).sort((a, b) => b.date.localeCompare(a.date));

export function yearsForCountry(code) {
  const ys = new Set(EVENTS.filter((e) => e.country === code).map(eventYear));
  return [...ys].sort((a, b) => b - a);
}

export function eventsForCountryYear(code, year) {
  return EVENTS
    .filter((e) => e.country === code && eventYear(e) === year)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* sections for an event — declared on the event, else derived from entries */
export function sectionsOf(ev) {
  if (!ev) return [];
  if (ev.sections && ev.sections.length) return ev.sections;
  return [...new Set(getEntries(ev.id).map((en) => en.section).filter(Boolean))];
}

/* other editions of the same fixture, newest first */
export function siblingEditions(ev) {
  if (!ev.baseId) return [];
  return EVENTS
    .filter((e) => e.baseId === ev.baseId && e.id !== ev.id)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function currentEvents(days) {
  /* recency judged by when the event FINISHED — a three-day fixture that
     ended yesterday is more current than a one-day that ran three days ago */
  const win = (days || 14) * 86400000;
  const ends = (e) => e.dateEnd || e.date;
  const newest = Math.max.apply(null, EVENTS.map((e) => +new Date(ends(e) + "T12:00:00")));
  return EVENTS
    .filter((e) => newest - new Date(ends(e) + "T12:00:00") <= win)
    .sort((a, b) => ends(b).localeCompare(ends(a)) || b.date.localeCompare(a.date));
}

/* Homepage "Latest events" — the events of the current week, where a week runs
   Wednesday→Wednesday. So each fixture appears from the Wednesday of its week
   (a couple of days before a weekend event) until the next Wednesday (a couple
   of days after), and the whole strip turns over every Wednesday.

   "Now" is pinned to the newest fixture's start date rather than the wall
   clock: the seeded demo data never goes stale, and in production — where new
   fixtures land every week — the anchor advances a week at a time, giving the
   same Wednesday refresh against live data. Multi-day fixtures that straddle a
   week boundary show in both of their weeks (range-overlap, not start-of). */
export function latestEvents(max = 6) {
  const DAY = 86400000;
  const at = (d) => new Date(d + "T12:00:00");
  const ends = (e) => e.dateEnd || e.date;
  const nowStr = EVENTS.reduce((a, e) => (e.date > a ? e.date : a), EVENTS[0].date);
  const now = at(nowStr);
  /* snap back to this week's Wednesday (getDay: Sun 0 … Wed 3 … Sat 6) */
  const weekStart = at(nowStr);
  weekStart.setDate(now.getDate() - ((now.getDay() - 3 + 7) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return EVENTS
    .filter((e) => at(e.date) < weekEnd && at(ends(e)) >= weekStart)
    .sort((a, b) => ends(b).localeCompare(ends(a)) || b.date.localeCompare(a.date))
    .slice(0, max);
}

export function searchAll(q) {
  q = (q || "").trim().toLowerCase();
  if (q.length < 2) return { events: [], entries: [] };
  const sorted = EVENTS.slice().sort((a, b) => b.date.localeCompare(a.date));
  const events = sorted.filter(
    (e) => e.name.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q)
  );
  /* Collapse matches by identity: a rider search returns ONE row per rider
     (→ the rider page, all their rounds across horses), a horse search ONE row
     per horse (→ all its videos). Each row is the most recent matching ride, so
     a prolific rider no longer floods the list with — or gets reduced to — a
     single horse. */
  const riders = new Map(), horses = new Map();
  let scanned = 0;
  for (const ev of sorted) {
    for (const en of getEntries(ev.id)) {
      if (!(en._s.includes(q) || String(en.bib) === q)) continue;
      const rHit = en.rider.toLowerCase().includes(q);
      const hHit = en.horse.toLowerCase().includes(q) || String(en.bib) === q;
      /* key by lower-case identity so "Tom Rowland" and "Tom ROWLAND" collapse
         to a single row (most recent ride kept as representative) */
      const rk = en.rider.toLowerCase(), hk = en.horse.toLowerCase();
      if (rHit && !riders.has(rk)) riders.set(rk, { en, ev, kind: "rider" });
      if (hHit && !horses.has(hk)) horses.set(hk, { en, ev, kind: "horse" });
      /* a match with no direct name hit — represent by the horse */
      if (!rHit && !hHit && !horses.has(hk)) horses.set(hk, { en, ev, kind: "horse" });
      if (++scanned >= 400) break;
    }
    if (scanned >= 400) break;
  }
  /* exact name matches first — duplicate names make partials ambiguous */
  const mark = (x) => Object.assign(x, {
    exact: (x.kind === "rider" ? x.en.rider : x.en.horse).toLowerCase() === q ? 1 : 0
  });
  const entries = [...riders.values(), ...horses.values()].map(mark)
    .sort((a, b) => (b.exact - a.exact) || b.ev.date.localeCompare(a.ev.date));
  return { events: events.slice(0, 4), entries: entries.slice(0, 8) };
}

/* ---------- closest-match fallback ----------
   Horse names are hostile to spelling and the searcher often isn't the
   rider. When exact/partial search returns nothing, offer the nearest
   names — always labelled "did you mean", never mixed into real results. */

function lev(a, b) {
  const m = a.length, n = b.length;
  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

export function closestMatches(q, code, cap) {
  q = (q || "").trim().toLowerCase();
  if (q.length < 3) return [];
  const tol = Math.max(1, Math.floor(q.length / 4));
  const sorted = EVENTS.slice().sort((a, b) => {
    if (code) {
      const ac = a.country === code ? 0 : 1, bc = b.country === code ? 0 : 1;
      if (ac !== bc) return ac - bc;
    }
    return b.date.localeCompare(a.date);
  });
  const tested = new Set(), out = [];
  for (const ev of sorted) {
    for (const en of getEntries(ev.id)) {
      for (const name of [en.horse, en.rider]) {
        const nl = name.toLowerCase();
        if (tested.has(nl)) continue;
        tested.add(nl);
        /* compare against the whole name and against its start (short queries) */
        const d = Math.min(lev(q, nl), lev(q, nl.slice(0, q.length + 1)));
        if (d > 0 && d <= tol) out.push({ en, ev, dist: d });
      }
    }
  }
  out.sort((a, b) => a.dist - b.dist || b.ev.date.localeCompare(a.ev.date));
  return out.slice(0, cap || 6);
}

/* ---------- formatting ---------- */

export const money = (n, country) => ({ us: "$", ie: "€", fr: "€", be: "€" }[country] || "£") + n;

/* Tidy a SHOUTED name to Title Case ("Tom ROWLAND" → "Tom Rowland") so
   case-variant spellings present consistently. Only whole-uppercase words are
   touched — mixed-case names (McDonald) and normal casing pass through. */
export function tidyName(s) {
  return String(s || "").replace(/\S+/g, (w) =>
    (w === w.toUpperCase() && /[A-Z]/.test(w))
      ? w.toLowerCase().replace(/(^|[-'’ ])([a-z])/g, (m, p, c) => p + c.toUpperCase())
      : w
  );
}

export function fmtRange(start, end, style) {
  const s = new Date(start + "T12:00:00");
  if (!end || end === start) {
    if (style === "long") return s.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return s.getDate() + " " + s.toLocaleString("en-GB", { month: "short" });
  }
  const e = new Date(end + "T12:00:00");
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (style === "long") {
    const mL = (d) => d.toLocaleString("en-GB", { month: "long" });
    return sameMonth
      ? s.getDate() + "–" + e.getDate() + " " + mL(s) + " " + s.getFullYear()
      : s.getDate() + " " + mL(s) + " – " + e.getDate() + " " + mL(e) + " " + e.getFullYear();
  }
  const mS = (d) => d.toLocaleString("en-GB", { month: "short" });
  return sameMonth
    ? s.getDate() + "–" + e.getDate() + " " + mS(s)
    : s.getDate() + " " + mS(s) + " – " + e.getDate() + " " + mS(e);
}

export function fmtDate(iso, style) {
  const d = new Date(iso + "T12:00:00");
  if (style === "parts") {
    return { d: d.getDate(), m: d.toLocaleString("en-GB", { month: "short" }), y: d.getFullYear() };
  }
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/* ---------- clips-off events: what plays instead of a personal clip ----------
   Hierarchy: the event's showcase round (the winner's — free winner videos
   already exist to showcase footage) → the global full sample round. Both
   play uninterrupted; the buy prompt is an end-card, never a mid-clip gate. */

export const SAMPLE_XC = {
  horse: "Onceuponatime", rider: "Sarah Ennis",
  video: asset("/assets/video/xc-sample.mp4?v=2"),
  thumb: asset("/assets/video/thumb-xc.jpg?v=3")
};

/* class token from a section label — "BE80 Open Section I1" and
   "GO BE80 Section I2" share the BE80 course */
const promoClassKey = (s) => (s || "").toLowerCase().split(/section|,|:/)[0]
  .replace(/\b(go|open|restricted|under ?18|u18|riders?)\b/g, " ")
  .replace(/[^a-z0-9*]+/g, "");

/* the winner's video closest to THIS entry's ride: same section, else same
   class on the same day, else same class, else same day, else any winner */
function pickPromo(en, promos) {
  if (!promos || !promos.length) return null;
  let pick = null;
  if (en && en.section) {
    pick = promos.find((p) => p.section === en.section) ||
      promos.find((p) => p.section && promoClassKey(p.section) === promoClassKey(en.section) && p.xcDay && p.xcDay === en.xcDay) ||
      promos.find((p) => p.section && promoClassKey(p.section) === promoClassKey(en.section));
  }
  if (!pick && en && en.xcDay) pick = promos.find((p) => p.xcDay === en.xcDay) || null;
  return pick || promos[0];
}

/* the showcase for a viewer is the free winner's video closest to THEIR
   ride — same selection the entry's own thumbnail was assigned from */
export function showcaseFor(ev, en) {
  if (!ev) return null;
  const promos = getEntries(ev.id).filter((e) => e.vimeo || e.dropbox);
  const pick = pickPromo(en, promos);
  if (!pick || !(pick.vimeo || pick.dropbox)) return null;
  const cls = (pick.section || "").split(/\s+section\s+/i)[0].split(/[,:]/)[0].trim();
  return { horse: pick.horse, rider: pick.rider, section: pick.section, cls,
           vimeo: pick.vimeo, dropbox: pick.dropbox, thumb: pick.vthumb };
}

/* ---------- delivery promise (backend-controlled per event) ---------- */

export const DELIVERY = {
  instant: { label: "Watch instantly after purchase", when: "ready the moment you pay" },
  fast: { label: "Delivered within 1 hour", when: "within the hour" },
  standard: { label: "Delivered within 5 days", when: "within 5 days" }
};
export const deliveryOf = (ev) => (ev && ev.delivery) || "standard";

/* ---------- products & prices (per event region) ---------- */

export function productPrices(ev) {
  const us = ev.country === "us";
  return {
    xc: ev.price,
    sjAdd: ev.priceSJ - ev.price,
    reelAdd: us ? 20 : 10,
    sjAlone: us ? 40 : 30,
    fence: us ? 35 : 25,
    dvd: 5
  };
}

/* ---------- rider nationality flags ----------
   Default comes from the flag file hierarchy: entry override → event-level
   rule (defaultFlag, e.g. an Irish Pony Club fixture) → event country. */

/* every ISO 3166-1 country — our markets pinned first, the rest alphabetical.
   Names come from Intl so the list never needs hand-maintenance. */
const FLAG_CODES = ("ad ae af ag al am ao ar at au az ba bb bd be bf bg bh bi bj bn bo br bs bt bw by bz ca cd cf cg ch ci cl cm cn co cr cu cv cy cz de dj dk dm do dz ec ee eg er es et fi fj fm fr ga gb gd ge gh gm gn gq gr gt gw gy hn hr ht hu id ie il in iq ir is it jm jo jp ke kg kh ki km kn kp kr kw kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mr mt mu mv mw mx my mz na ne ng ni nl no np nr nz om pa pe pg ph pk pl pt pw py qa ro rs ru rw sa sb sc sd se sg si sk sl sm sn so sr ss st sv sy sz td tg th tj tl tm tn to tr tt tv tw tz ua ug us uy uz va vc ve vn vu ws ye za zm zw").split(" ");
const PRIORITY_FLAGS = ["gb", "ie", "us", "fr", "be"];
let regionNames = null;
try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) {}
const regionName = (c) => {
  try { return (regionNames && regionNames.of(c.toUpperCase())) || c.toUpperCase(); }
  catch (e) { return c.toUpperCase(); }
};
export const FLAGS = [
  ...PRIORITY_FLAGS.map((c) => [c, regionName(c)]),
  ...FLAG_CODES.filter((c) => !PRIORITY_FLAGS.includes(c))
    .map((c) => [c, regionName(c)])
    .sort((a, b) => a[1].localeCompare(b[1]))
];
export const defaultFlagFor = (ev, en) => (en && en.flag) || (ev && ev.defaultFlag) || (ev && ev.country) || "gb";

/* ---------- entry lookup & cross-event history ---------- */

/* ---------- order-in-progress (sessionStorage, entry ids) ----------
   The "add & keep browsing" basket. Session-scoped on purpose: this is an
   in-the-moment shop — no stale baskets resurfacing next season. */
const basketListeners = [];
export const basket = {
  key: "equireel_basket",
  ids() {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(sessionStorage.getItem(this.key)) || []; } catch (e) { return []; }
  },
  has(id) { return this.ids().includes(id); },
  add(id) { if (id && !this.has(id)) this._save([...this.ids(), id]); },
  remove(id) { this._save(this.ids().filter((x) => x !== id)); },
  clear() { this._save([]); },
  _save(a) {
    try { sessionStorage.setItem(this.key, JSON.stringify(a)); } catch (e) {}
    basketListeners.forEach((fn) => { try { fn(); } catch (e) {} });
  },
  onChange(fn) {
    basketListeners.push(fn);
    return () => { const i = basketListeners.indexOf(fn); if (i >= 0) basketListeners.splice(i, 1); };
  }
};

export function findEntry(entryId) {
  if (!entryId) return null;
  const cut = entryId.lastIndexOf("-");
  const evId = entryId.slice(0, cut);
  const ev = getEvent(evId);
  if (!ev) return null;
  const en = getEntries(evId).find((e) => e.id === entryId);
  return en ? { en, ev } : null;
}

/* Names collide — different riders and horses share names. Until records
   carry IDs, rank likelihood: the same horse-and-rider combination is
   near-certainly the same one (+4); the same country is strongly likely (+2);
   recency breaks ties. */
function likelihood(m, ctx) {
  if (!ctx) return 0;
  return (ctx.combo && ctx.comboField && m.en[ctx.comboField] === ctx.combo ? 4 : 0) +
         (ctx.country && m.ev.country === ctx.country ? 2 : 0);
}

function historyBy(field, value, excludeEventId, cap, ctx) {
  const matches = [];
  const nv = String(value).toLowerCase();
  const sorted = EVENTS.slice().sort((a, b) => b.date.localeCompare(a.date));
  for (const ev of sorted) {
    if (ev.id === excludeEventId) continue;
    for (const en of getEntries(ev.id)) {
      if (en[field].toLowerCase() === nv) { matches.push({ en, ev }); break; }
    }
  }
  matches.forEach((m) => { m.score = likelihood(m, ctx); });
  matches.sort((a, b) => (b.score - a.score) || b.ev.date.localeCompare(a.ev.date));
  return matches.slice(0, cap);
}
export const horseHistory = (horse, excludeEventId, cap, ctx) => historyBy("horse", horse, excludeEventId, cap || 4, ctx);
export const riderHistory = (rider, excludeEventId, cap, ctx) => historyBy("rider", rider, excludeEventId, cap || 4, ctx);

export function riderRounds(rider, ctx) {
  return roundsBy("rider", rider, ctx);
}
export function horseRounds(horse, ctx) {
  return roundsBy("horse", horse, ctx);
}
function roundsBy(field, value, ctx) {
  const out = [];
  const nv = String(value).toLowerCase();
  const sorted = EVENTS.slice().sort((a, b) => b.date.localeCompare(a.date));
  for (const ev of sorted) {
    for (const en of getEntries(ev.id)) {
      /* case-insensitive: "Tom Rowland" and "Tom ROWLAND" are one person */
      if (en[field].toLowerCase() === nv) out.push({ en, ev });
    }
    if (out.length >= 400) break;
  }
  out.forEach((m) => { m.score = likelihood(m, ctx); });
  /* newest first; likelihood only breaks same-date ties (duplicate names) */
  out.sort((a, b) => b.ev.date.localeCompare(a.ev.date) || (b.score - a.score) || a.ev.id.localeCompare(b.ev.id));
  return out.slice(0, 300);
}

/* ---------- order preferences (defaults: music on, sounds on, public) ---------- */

export const prefs = {
  key: "equireel_prefs",
  get() {
    const d = { faults: true, music: true, sounds: true, public: true, flag: "" };
    try { return Object.assign(d, JSON.parse(localStorage.getItem(this.key)) || {}); }
    catch (e) { return d; }
  },
  set(p) { try { localStorage.setItem(this.key, JSON.stringify(p)); } catch (e) {} }
};

/* ---------- purchases (localStorage, same keys as v1 site) ---------- */

export const purchases = {
  key: "equireel_purchases",
  all() { try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch (e) { return {}; } },
  has(id) { try { return !!this.all()[id]; } catch (e) { return false; } },
  add(id, info) {
    const p = this.all();
    p[id] = Object.assign({ at: new Date().toISOString() }, info || {});
    localStorage.setItem(this.key, JSON.stringify(p));
  },
  email() { try { return localStorage.getItem("equireel_email") || ""; } catch (e) { return ""; } },
  setEmail(e) { localStorage.setItem("equireel_email", e); }
};

/* ---------- icons (inline SVG strings, ported verbatim) ---------- */

export const icons = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6"/></svg>',
  rosette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="m9 14.5-2 6 5-2.7 5 2.7-2-6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4.5 4.5L19 8"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
};

/* ---------- shared search results renderer (HTML string, as v1) ---------- */

function suggestionRowsHTML(list) {
  /* a horse search lands on ALL of its videos; a rider search on ALL their
     rounds — never a single most-recent ride */
  return list.map(function (x) {
    if (x.kind === "rider") {
      const rider = tidyName(x.en.rider);
      const to = href("/rider?name=" + encodeURIComponent(rider) +
        "&h=" + encodeURIComponent(x.en.horse) + "&c=" + x.ev.country);
      return '<a class="hs-row" href="' + to + '">' +
        '<span class="hs-bib rider" aria-hidden="true">' + icons.user + "</span>" +
        "<span><strong>" + rider + "</strong><small>Rider · see all rounds</small></span>" +
      "</a>";
    }
    const to = href("/horses?name=" + encodeURIComponent(x.en.horse) +
      "&r=" + encodeURIComponent(tidyName(x.en.rider)) + "&c=" + x.ev.country);
    return '<a class="hs-row" href="' + to + '">' +
      '<span class="hs-bib">' + x.en.bib + "</span>" +
      "<span><strong>" + x.en.horse + "</strong><small>" + tidyName(x.en.rider) + " · " + x.ev.name + "</small></span>" +
    "</a>";
  }).join("");
}

export function searchResultsHTML(q) {
  const r = searchAll(q);
  if (!r.events.length && !r.entries.length) {
    if ((q || "").trim().length < 2) return "";
    const close = closestMatches(q, null, 4);
    if (close.length) return '<div class="hs-label">No exact matches — did you mean</div>' + suggestionRowsHTML(close);
    return '<div class="hs-empty">No matches — try a horse, rider or event name</div>';
  }
  let html = "";
  if (r.events.length) {
    html += '<div class="hs-label">Events</div>' + r.events.map(function (e) {
      return '<a class="hs-row" href="' + href("/event?id=" + e.id) + '">' +
        '<img src="https://flagcdn.com/w40/' + e.country + '.png" alt="" width="22">' +
        "<span><strong>" + e.name + "</strong><small>" + fmtRange(e.date, e.dateEnd) + " · " + e.body + "</small></span>" +
      "</a>";
    }).join("");
  }
  if (r.entries.length) {
    html += '<div class="hs-label">Horses &amp; riders</div>' + suggestionRowsHTML(r.entries);
  }
  return html;
}

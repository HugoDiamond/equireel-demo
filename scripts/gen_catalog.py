# Production catalogue generator: merge NEW events from the platform database
# (scraped `events` + `results` on Supabase Postgres) into the site catalogue.
#
# Incremental and non-destructive by design: existing events in
# lib/events-real.js and existing entry arrays in public/data/entries.json are
# never modified or reordered (sample/promo wiring is keyed to them).
#
# DATABASE_URL comes from the environment, or falls back to the local platform
# clone's .env. Read-only session; never prints secrets.
#
# Usage:  python scripts/gen_catalog.py [--dry-run]
import io, json, os, re, sys, unicodedata, collections, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EVENTS_JS = os.environ.get("EVENTS_JS") or os.path.join(ROOT, "lib", "events-real.js")
ENTRIES_JSON = os.environ.get("ENTRIES_JSON") or os.path.join(ROOT, "public", "data", "entries.json")
PLATFORM_ENV = r"C:\Users\Equireel 1\Documents\equireel_clean\xc-start-times\.env"

DRY = "--dry-run" in sys.argv

# ---- conventions shared with parse_entries.py / gen_events.py ----
def clean(s):
    s = unicodedata.normalize("NFKC", s or "").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()

SMALL = {"of","the","at","and","de","du","la","le","in","on"}
ROMAN = {"ii","iii","iv","vi","vii","viii","ix","xi","xii"}
def title_horse(s):
    words = clean(s).lower().split(" ")
    out = []
    for i, w in enumerate(words):
        if w in ROMAN: out.append(w.upper())
        elif w in SMALL and i > 0: out.append(w)
        else: out.append(w[:1].upper() + w[1:] if w else w)
    return " ".join(out)

def slugify(s):
    s = clean(s).lower()
    s = re.sub(r"[()\.']", " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

MONTHWORDS = r"january|february|march|april|may|june|july|august|september|october|november|december"
def base_id(name):
    s = re.sub(r"\(\d+\)", " ", name.lower())
    s = re.sub(MONTHWORDS, " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

PRICES = {"gb": (60, 80), "ie": (70, 90), "fr": (70, 90), "be": (70, 90), "us": (159, 179)}
COUNTRY = {"GBR": "gb", "UK": "gb", "GB": "gb", "USA": "us", "US": "us",
           "IRL": "ie", "IE": "ie", "FRA": "fr", "FR": "fr", "BEL": "be", "BE": "be"}
ORG_LABEL = {"USEA": "USEA", "BE": "British Eventing", "BRITISH EVENTING": "British Eventing",
             "EI": "Eventing Ireland", "EVENTING IRELAND": "Eventing Ireland"}

# ---- load current site catalogue ----
js = io.open(EVENTS_JS, encoding="utf-8").read()
line_re = re.compile(r'^(  \{ id: "([^"]+)", baseId: "([^"]+)".*?date: "([^"]+)".*\},)$', re.M)
site_lines = []           # (line, id, baseId, date)
for m in line_re.finditer(js):
    site_lines.append((m.group(1), m.group(2), m.group(3), m.group(4)))
if not site_lines:
    print("FATAL: could not parse events-real.js"); sys.exit(1)
site_ids = {l[1] for l in site_lines}
site_base_year = {(l[2], l[3][:4]) for l in site_lines}

entries = json.load(io.open(ENTRIES_JSON, encoding="utf-8"))

# entry-fingerprint per site event: {(bib, horse.lower()), ...} grouped by year
# bib normalized to leading digits ("92 OP" == "92") — USA site rows embed codes
def norm_bib(b):
    m = re.match(r"\s*(\d+)", str(b or ""))
    return m.group(1) if m else clean(str(b or "")).lower()

site_year = {l[1]: l[3][:4] for l in site_lines}
site_fp = {}
for eid, rows in entries.items():
    site_fp[eid] = {(norm_bib(r[0]), (r[1] or "").lower()) for r in rows}

def find_by_entries(year, fp):
    """Return (site_event_id, overlap) if an existing same-year event shares
    a significant fraction of (bib, horse) entry keys."""
    best, best_ov = None, 0.0
    for eid, keys in site_fp.items():
        if site_year.get(eid) != year or not keys:
            continue
        inter = len(fp & keys)
        if not inter:
            continue
        ov = inter / min(len(fp), len(keys))
        if ov > best_ov:
            best, best_ov = eid, ov
    return (best, best_ov) if best_ov >= 0.25 else (None, best_ov)

# ---- connect (read-only) ----
url = os.environ.get("DATABASE_URL")
if not url and os.path.exists(PLATFORM_ENV):
    for line in io.open(PLATFORM_ENV, encoding="utf-8-sig"):
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'"); break
if not url:
    print("FATAL: no DATABASE_URL"); sys.exit(1)

import psycopg2
conn = psycopg2.connect(url)
conn.set_session(readonly=True, autocommit=True)
cur = conn.cursor()

# coverage gate: 'discovered' rows are feed-calendar knowledge only (the
# daily discovery sweep ingests whole federations) — they must never reach
# the shop. Only events on the filming path get published.
cur.execute("""
    SELECT e.id, e.event_name, e.event_date, e.event_country, e.source, e.venue
    FROM events e
    WHERE e.event_date IS NOT NULL
      AND COALESCE(e.coverage_status, 'filmed') <> 'discovered'
    ORDER BY e.event_date DESC""")
db_events = cur.fetchall()

added_events, added_entries, skipped = [], 0, 0
new_lines = []

for ev_id, name, date, country_raw, source, db_venue in db_events:
    name = clean(name)
    year = str(date.year)
    if int(year) < 2023:
        continue
    raw = name if re.search(r"20\d\d\s*$", name) else f"{name} {year}"
    cand_id = slugify(raw)
    bid = base_id(re.sub(r"\s*20\d\d\s*$", "", raw))
    if cand_id in site_ids or (bid, year) in site_base_year:
        skipped += 1
        continue

    country = COUNTRY.get((country_raw or "").upper(), "gb")
    price, price_sj = PRICES[country]

    cur.execute("""
        SELECT bib_number, horse_name, rider_full_name, xc_day, xc_start_time,
               section_name, organization
        FROM results WHERE event_id = %s ORDER BY section_name, id""", (ev_id,))
    rows = cur.fetchall()
    if not rows:
        continue

    # entry-fingerprint match: same-year event with overlapping (bib, horse)
    fp = {(norm_bib(r[0]), title_horse(r[1] or "").lower()) for r in rows if r[1]}
    match, ov = find_by_entries(year, fp)
    if match:
        skipped += 1
        print(f"  = matched by entries ({ov:.0%}): {name!r} -> {match}")
        continue

    orgs = collections.Counter(clean(r[6] or "") for r in rows if r[6])
    body = ORG_LABEL.get(orgs.most_common(1)[0][0].upper(), orgs.most_common(1)[0][0]) if orgs \
        else ("USEA" if source == "EE" else "Unaffiliated")

    ev_entries, seen = [], set()
    for bib, horse, rider, day, start, section, _org in rows:
        bib = clean(str(bib or "")); horse = title_horse(horse or ""); rider = clean(rider or "")
        if not horse or not rider: continue
        key = (bib, horse.lower())
        if key in seen: continue
        seen.add(key)
        tm = start.strftime("%H:%M") if start else ""
        dy = clean(day or "") or (start.strftime("%a") if start else "")
        ev_entries.append([bib, horse, rider, dy, tm, clean(section or "")])
    if not ev_entries:
        continue

    def bibkey(x):
        try: return (0, int(re.sub(r"\D", "", x[0]) or 0), x[0])
        except Exception: return (1, 0, x[0])
    ev_entries.sort(key=lambda r: (r[5], bibkey(r)))

    # ensure id unique
    eid, n = cand_id, 2
    while eid in site_ids: eid = f"{cand_id}-{n}"; n += 1
    site_ids.add(eid)

    disp_name = clean(re.sub(r"\s*20\d\d\s*$", "", name))
    parts = [
        'id: %s' % json.dumps(eid),
        'baseId: %s' % json.dumps(bid),
        'country: %s' % json.dumps(country),
        'name: %s' % json.dumps(disp_name),
        'venue: %s' % json.dumps(clean(db_venue or "")),
        'date: %s' % json.dumps(date.isoformat()),
        'body: %s' % json.dumps(body),
        'sections: []',
        'status: "ready"',
        'price: %d, priceSJ: %d' % (price, price_sj),
        'clips: false',
    ]
    new_lines.append(("  { " + ", ".join(parts) + " },", eid, bid, date.isoformat()))
    entries[eid] = ev_entries
    added_events.append((eid, len(ev_entries), country, body))
    added_entries += len(ev_entries)

cur.close(); conn.close()

print(f"DB events considered: {len(db_events)} | already on site: {skipped} | new: {len(added_events)}")
for eid, n, c, b in added_events:
    print(f"  + {eid}  ({n} entries, {c}, {b})")
print(f"new entries total: {added_entries}")

if DRY or not added_events:
    print("dry-run or nothing to do — files untouched"); sys.exit(0)

# merge lines, sort by date desc (existing lines byte-identical)
all_lines = site_lines + new_lines
all_lines.sort(key=lambda l: l[3], reverse=True)
body_js = "\n".join(l[0] for l in all_lines)
header = ("/* Real Equireel events 2023-2026, generated from the entries dump +\n"
          "   web research (org, country, dates). Incrementally extended from the\n"
          "   platform DB. Regenerate: python scripts/gen_catalog.py */\n\n")
io.open(EVENTS_JS, "w", encoding="utf-8", newline="\n").write(
    header + "export const REAL_EVENTS = [\n" + body_js + "\n];\n")
json.dump(entries, io.open(ENTRIES_JSON, "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print(f"wrote events-real.js ({len(all_lines)} events) + entries.json ({sum(len(v) for v in entries.values())} entries)")

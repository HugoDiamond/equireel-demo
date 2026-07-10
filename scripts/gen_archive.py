# Archive expansion: import 2019-2022 events + entries from the legacy shop
# domain (shop_events / shop_event_entries) into the site catalogue.
#
# - Events append to lib/events-real.js (same line format; dates are
#   season-estimated YYYY-06-15 — the archive UI groups by year, so the year
#   is what matters). Existing events/entries are never touched.
# - Entries write to public/data/entries-archive.json — a SEPARATE file the
#   site lazy-loads, so the main payload stays fast.
#
# Idempotent: skips events already in events-real.js. Run once; safe to rerun.
import io, json, os, re, sys, unicodedata, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EVENTS_JS = os.path.join(ROOT, "lib", "events-real.js")
ARCHIVE_JSON = os.path.join(ROOT, "public", "data", "entries-archive.json")
PLATFORM_ENV = r"C:\Users\Equireel 1\Documents\equireel_clean\xc-start-times\.env"
SEASONS = ("2019", "2020", "2021", "2022")
DRY = "--dry-run" in sys.argv

def clean(s):
    s = unicodedata.normalize("NFKC", s or "").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()

SMALL = {"of","the","at","and","de","du","la","le","in","on"}
ROMAN = {"ii","iii","iv","vi","vii","viii","ix","xi","xii"}
def title_words(s):
    words = clean(s).lower().split(" ")
    out = []
    for i, w in enumerate(words):
        if w in ROMAN: out.append(w.upper())
        elif w in SMALL and i > 0: out.append(w)
        elif w in ("pc", "ode", "bs", "xc", "ipc", "rc"): out.append(w.upper())
        else: out.append(w[:1].upper() + w[1:] if w else w)
    return " ".join(out)

def slugify(s):
    s = clean(s).lower()
    s = re.sub(r"[()\.']", " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

COUNTRY = {"United Kingdom": "gb", "Ireland": "ie", "France": "fr",
           "Belgium": "be", "United States": "us", "USA": "us"}
PRICES = {"gb": (60, 80), "ie": (70, 90), "fr": (70, 90), "be": (70, 90), "us": (159, 179)}

# current site events (never touched; used for dedup + final merge/sort)
js = io.open(EVENTS_JS, encoding="utf-8").read()
line_re = re.compile(r'^(  \{ id: "([^"]+)".*?date: "([^"]+)".*\},)$', re.M)
site_lines = [(m.group(1), m.group(2), m.group(3)) for m in line_re.finditer(js)]
site_ids = {l[1] for l in site_lines}
print(f"site events now: {len(site_lines)}")

url = os.environ.get("DATABASE_URL")
if not url:
    for line in io.open(PLATFORM_ENV, encoding="utf-8-sig"):
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"'); break
import psycopg2
conn = psycopg2.connect(url)
conn.set_session(readonly=True, autocommit=True)
cur = conn.cursor()

cur.execute("""
SELECT e.id, e.name, c.name, en.season
FROM shop_events e
LEFT JOIN shop_countries c ON e.country_id = c.id
JOIN shop_event_entries en ON en.shop_event_id = e.id
WHERE en.season IN %s
GROUP BY e.id, e.name, c.name, en.season""", (SEASONS,))
rows = cur.fetchall()

new_lines, archive, added_entries, skipped = [], {}, 0, 0
def bibkey(x):
    try: return (0, int(re.sub(r"\D", "", str(x[0])) or 0), str(x[0]))
    except Exception: return (1, 0, str(x[0]))

for sev_id, name, country_name, season in rows:
    raw = clean(name)
    eid = slugify(raw)
    if eid in site_ids:
        skipped += 1
        continue
    year = season
    country = COUNTRY.get(country_name or "", "gb")
    price, psj = PRICES[country]

    cur.execute("""SELECT bib_number, horse_name, rider_name, xc_day, xc_time
        FROM shop_event_entries WHERE shop_event_id = %s AND season = %s""", (sev_id, season))
    ev_entries, seen = [], set()
    for bib, horse, rider, day, tm in cur.fetchall():
        horse = title_words(horse or ""); rider = clean(rider or "")
        if not horse or not rider: continue
        b = "" if bib is None else str(bib)
        key = (b, horse.lower())
        if key in seen: continue
        seen.add(key)
        ev_entries.append([b, horse, rider, clean(day or ""), clean(tm or ""), ""])
    if len(ev_entries) < 3:
        continue  # skip degenerate imports
    ev_entries.sort(key=bibkey)

    disp = title_words(re.sub(r"\s*20\d\d\s*$", "", raw))
    date = f"{year}-06-15"
    parts = [
        'id: %s' % json.dumps(eid),
        'baseId: %s' % json.dumps(slugify(disp)),
        'country: %s' % json.dumps(country),
        'name: %s' % json.dumps(disp),
        'venue: ""',
        'date: %s' % json.dumps(date),
        'body: "Unaffiliated"',
        'sections: []',
        'status: "ready"',
        'price: %d, priceSJ: %d' % (price, psj),
        'clips: false',
    ]
    site_ids.add(eid)
    new_lines.append(("  { " + ", ".join(parts) + " },", eid, date))
    archive[eid] = ev_entries
    added_entries += len(ev_entries)

cur.close(); conn.close()

print(f"archive events to add: {len(new_lines)} | entries: {added_entries:,} | already on site: {skipped}")
by_year = collections.Counter(l[2][:4] for l in new_lines)
print("by year:", dict(sorted(by_year.items())))

if DRY:
    print("dry run — nothing written"); sys.exit(0)

merged = site_lines + [(l, i, d) for l, i, d in new_lines]
merged.sort(key=lambda x: x[2], reverse=True)
body = "\n".join(x[0] for x in merged)
header = ("/* Real Equireel events 2019-2026: 2023+ from the entries dump + web\n"
          "   research; 2019-2022 archive imported from the legacy shop domain\n"
          "   (dates are season-estimated). Extend: scripts/gen_catalog.py /\n"
          "   scripts/gen_archive.py */\n\n")
io.open(EVENTS_JS, "w", encoding="utf-8", newline="\n").write(
    header + "export const REAL_EVENTS = [\n" + body + "\n];\n")
json.dump(archive, io.open(ARCHIVE_JSON, "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print(f"wrote events-real.js ({len(merged)} events) + entries-archive.json "
      f"({os.path.getsize(ARCHIVE_JSON):,} bytes)")

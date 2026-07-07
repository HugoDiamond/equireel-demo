# Merge agent research (scripts/out/research-*.json) with the parsed event list
# and emit lib/events-real.js for the site.
import io, json, os, glob, re, datetime

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "out")

with io.open(os.path.join(OUT, "events-list.json"), encoding="utf-8") as f:
    listing = {e["id"]: e for e in json.load(f)}

research = {}
for path in sorted(glob.glob(os.path.join(OUT, "research-*.json"))):
    with io.open(path, encoding="utf-8") as f:
        try:
            arr = json.load(f)
        except Exception as ex:
            print("BAD JSON:", path, ex); continue
    for r in arr:
        if r.get("id"): research[r["id"]] = r

missing = [i for i in listing if i not in research]
print("researched:", len(research), "| missing:", len(missing))
for m in missing: print("  MISSING:", m)

PRICES = {"gb": (60, 80), "ie": (70, 90), "fr": (70, 90), "be": (70, 90), "us": (159, 179)}
MONTHWORDS = r"january|february|march|april|may|june|july|august|september|october|november|december"

def base_id(name):
    s = re.sub(r"\(\d+\)", " ", name.lower())
    s = re.sub(MONTHWORDS, " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

events = []
warnings = []
for eid, meta in listing.items():
    r = research.get(eid)
    if not r:
        continue
    year = meta["year"]
    country = (r.get("country") or "gb").lower()
    if country not in PRICES: country = "gb"; warnings.append((eid, "country"))
    date = r.get("date") or ""
    if not re.match(r"^20\d\d-\d\d-\d\d$", date):
        date = "%d-06-15" % year; warnings.append((eid, "date"))
    if not date.startswith(str(year)):
        date = str(year) + date[4:]; warnings.append((eid, "year-mismatch"))
    dateEnd = r.get("dateEnd") or None
    if dateEnd and (not re.match(r"^20\d\d-\d\d-\d\d$", dateEnd) or dateEnd < date):
        dateEnd = None
    p, psj = PRICES[country]
    events.append({
        "id": eid,
        "baseId": base_id(r.get("name") or meta["raw"]),
        "country": country,
        "name": (r.get("name") or meta["raw"]).strip(),
        "venue": (r.get("venue") or "").strip(),
        "date": date,
        "dateEnd": dateEnd,
        "body": (r.get("body") or "Unaffiliated").strip(),
        "price": p, "priceSJ": psj,
        "count": meta["count"],
        "estimated": r.get("confidence") != "exact",
    })

events.sort(key=lambda e: e["date"], reverse=True)

# current model: every event plays sample rounds (no per-fence free clips)
# and every order is delivered on the standard 5-day promise.

lines = []
for e in events:
    parts = [
        'id: %s' % json.dumps(e["id"]),
        'baseId: %s' % json.dumps(e["baseId"]),
        'country: %s' % json.dumps(e["country"]),
        'name: %s' % json.dumps(e["name"]),
        'venue: %s' % json.dumps(e["venue"]),
        'date: %s' % json.dumps(e["date"]),
    ]
    if e["dateEnd"]: parts.append('dateEnd: %s' % json.dumps(e["dateEnd"]))
    parts.append('body: %s' % json.dumps(e["body"]))
    parts.append('sections: []')
    parts.append('status: "ready"')
    parts.append('price: %d, priceSJ: %d' % (e["price"], e["priceSJ"]))
    parts.append('clips: false')
    lines.append("  { " + ", ".join(parts) + " },")

js = ("/* Real Equireel events 2023-2026, generated from the entries dump +\n"
      "   web research (org, country, dates). Regenerate: python scripts/gen_events.py */\n\n"
      "export const REAL_EVENTS = [\n" + "\n".join(lines) + "\n];\n")

with io.open(os.path.join(HERE, "..", "lib", "events-real.js"), "w", encoding="utf-8", newline="\n") as f:
    f.write(js)

print("wrote lib/events-real.js:", len(events), "events | flag warnings:", len(warnings))
from collections import Counter
print("by country:", dict(Counter(e["country"] for e in events)))
print("by year:", dict(Counter(e["date"][:4] for e in events)))
print("estimated dates:", sum(1 for e in events if e["estimated"]))

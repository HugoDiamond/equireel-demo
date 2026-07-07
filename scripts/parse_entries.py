# Parse the Equireel entries dump into site data.
# Outputs:
#   scripts/out/events-list.json  - unique 2023-2026 events + counts + hints (for research)
#   public/data/entries.json      - {eventId: [[bib, horse, rider, xcDay, xcTime], ...]}
#   scripts/out/event-ids.json    - {rawName: eventId}
import csv, io, json, os, re, unicodedata, collections

SRC = r"A:\Downloads\New Orders File - Entries Data Dump.csv"
OUT_DIR = os.path.join(os.path.dirname(__file__), "out")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

def clean(s):
    s = unicodedata.normalize("NFKC", s or "").replace(" ", " ").replace("�", " ")
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

events = collections.OrderedDict()  # raw name -> {count, riders sample, days}
entries = collections.defaultdict(dict)  # raw name -> {(bib,horse): row}

with io.open(SRC, encoding="utf-8", errors="replace") as f:
    r = csv.reader(f)
    next(r)
    for row in r:
        if len(row) < 12: continue
        ev = clean(row[2])
        if not ev: continue
        m = re.search(r"(20\d\d)\s*$", ev)
        if not m: continue
        year = int(m.group(1))
        if year < 2023 or year > 2026: continue
        bib = clean(row[3])
        horse = title_horse(row[4])
        rider = clean(row[5]) or clean(row[8])
        if not horse or not rider: continue
        day = clean(row[9])
        time = clean(row[10])
        e = events.setdefault(ev, {"count": 0, "year": year, "days": collections.Counter(), "riders": []})
        key = (bib, horse.lower())
        if key in entries[ev]: continue  # dedupe (multiple videos per entry)
        entries[ev][key] = [bib, horse, rider, day, time]
        e["count"] += 1
        if day: e["days"][day] += 1
        if len(e["riders"]) < 3: e["riders"].append(rider)

# stable, unique event ids
used = {}
event_ids = {}
for ev in events:
    base = slugify(ev)
    eid = base
    n = 2
    while eid in used: eid = base + "-" + str(n); n += 1
    used[eid] = ev
    event_ids[ev] = eid

# entries.json keyed by event id, sorted by numeric bib where possible
def bibkey(x):
    try: return (0, int(re.sub(r"\D", "", x[0]) or 0), x[0])
    except: return (1, 0, x[0])
out_entries = {}
for ev, d in entries.items():
    rows = sorted(d.values(), key=bibkey)
    out_entries[event_ids[ev]] = rows

with io.open(os.path.join(DATA_DIR, "entries.json"), "w", encoding="utf-8") as f:
    json.dump(out_entries, f, ensure_ascii=False, separators=(",", ":"))

listing = [
    {"raw": ev, "id": event_ids[ev], "year": e["year"], "count": e["count"],
     "days": dict(e["days"]), "sampleRiders": e["riders"]}
    for ev, e in sorted(events.items(), key=lambda kv: (kv[1]["year"], kv[0]))
]
with io.open(os.path.join(OUT_DIR, "events-list.json"), "w", encoding="utf-8") as f:
    json.dump(listing, f, ensure_ascii=False, indent=1)

size = os.path.getsize(os.path.join(DATA_DIR, "entries.json"))
print("events:", len(events), "| entries:", sum(len(v) for v in out_entries.values()),
      "| entries.json: %.1f MB" % (size / 1048576))

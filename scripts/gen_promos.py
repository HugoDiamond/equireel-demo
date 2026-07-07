# Extract "For Promotion" (free winner video) orders and map them to entry
# indexes in public/data/entries.json, emitting lib/promos.js:
#   export const PROMOS = { "<eventId>": [entryIdx, ...], ... }
# The entry carries its own section + XC day, giving class/day-relevant
# showcase samples on the site.
import csv, io, json, os, re, unicodedata, collections

HERE = os.path.dirname(__file__)
ORDERS = r"A:\Downloads\New Orders File - Orders.csv"

def clean(s):
    s = unicodedata.normalize("NFKC", s or "").replace(" ", " ").replace("�", " ")
    return re.sub(r"\s+", " ", s).strip()

def norm(s):
    return re.sub(r"[^a-z0-9]+", "", clean(s).lower())

listing = json.load(io.open(os.path.join(HERE, "out", "events-list.json"), encoding="utf-8"))
raw2id = {norm(e["raw"]): e["id"] for e in listing}

entries = json.load(io.open(os.path.join(HERE, "..", "public", "data", "entries.json"), encoding="utf-8"))
# per event: lookups by horse-norm and by bib
idx_horse, idx_bib = {}, {}
for evId, rows in entries.items():
    h, b = {}, {}
    for i, r in enumerate(rows):
        h.setdefault(norm(r[1]), []).append(i)
        bib = re.sub(r"\D", "", r[0] or "").lstrip("0")
        if bib: b.setdefault(bib, []).append(i)
    idx_horse[evId] = h
    idx_bib[evId] = b

promos = collections.defaultdict(list)   # evId -> [entryIdx]
stats = collections.Counter()
unmatched = []
with io.open(ORDERS, encoding="utf-8", errors="replace") as f:
    r = csv.reader(f); next(r)
    for row in r:
        tag = (clean(row[0]) + " " + clean(row[13])).lower()
        if "promo" not in tag: continue
        evId = raw2id.get(norm(row[2]))
        if not evId: stats["event_not_on_site"] += 1; continue
        stats["promo_rows_on_site_events"] += 1
        horse = norm(row[4])
        bib = re.sub(r"\D", "", clean(row[3])).lstrip("0")
        cand = None
        hs = idx_horse[evId].get(horse, [])
        if len(hs) == 1: cand = hs[0]
        elif len(hs) > 1 and bib:
            both = [i for i in hs if i in idx_bib[evId].get(bib, [])]
            cand = both[0] if both else hs[0]
        elif not hs and bib:
            bs = idx_bib[evId].get(bib, [])
            if len(bs) == 1: cand = bs[0]
        if cand is None:
            stats["unmatched"] += 1
            if len(unmatched) < 400: unmatched.append({"event": evId, "horse": clean(row[4]), "bib": clean(row[3])})
            continue
        link = clean(row[23]) if len(row) > 23 else ""
        m2 = re.match(r"https?://vimeo\.com/(\d+(?:/[0-9a-f]+)?)", link)
        vim = m2.group(1) if m2 else None
        if not vim:
            stats["matched_no_video_link"] += 1
            continue  # a sample must be the real winner video
        if cand not in [p[0] for p in promos[evId]]:
            promos[evId].append([cand, vim])
            sec = entries[evId][cand][5] if len(entries[evId][cand]) > 5 else ""
            stats["matched_with_section" if sec else "matched_no_section"] += 1

js = ("/* Free winner (promotion) videos per event: [entryIdx, vimeoPath] pairs.\n"
      "   The vimeo path is the winner's real published video.\n"
      "   Regenerate: python scripts/gen_promos.py */\n\n"
      "export const PROMOS = " + json.dumps({k: sorted(v) for k, v in sorted(promos.items())}, separators=(",", ":")) + ";\n")
with io.open(os.path.join(HERE, "..", "lib", "promos.js"), "w", encoding="utf-8", newline="\n") as f:
    f.write(js)

json.dump(unmatched, io.open(os.path.join(HERE, "out", "promos-unmatched.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

evs_with = len(promos)
total_events = len({e["id"] for e in listing})
print(stats)
print("events with promos: %d / %d" % (evs_with, total_events))
no_promo = [e["id"] for e in listing if e["id"] not in promos]
print("events WITHOUT any promo:", len(no_promo))
json.dump(no_promo, io.open(os.path.join(HERE, "out", "events-no-promo.json"), "w", encoding="utf-8"), indent=1)

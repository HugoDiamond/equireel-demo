# Match scraped section listings (scripts/out/sections-*.json) against the
# real entries and bake the section label into public/data/entries.json
# as each row's 6th element. Matching order: bib -> horse -> horse+surname.
import io, json, os, glob, re, collections

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "out")
ENTRIES = os.path.join(HERE, "..", "public", "data", "entries.json")

def norm(s):
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())

def bibkey(s):
    d = re.sub(r"\D", "", s or "")
    return d.lstrip("0") or d

with io.open(ENTRIES, encoding="utf-8") as f:
    entries = json.load(f)

scraped = {}
for p in sorted(glob.glob(os.path.join(OUT, "sections-*.json"))):
    try:
        j = json.load(io.open(p, encoding="utf-8"))
    except Exception as ex:
        print("BAD JSON:", p, ex); continue
    for evId, rows in j.items():
        if rows: scraped.setdefault(evId, []).extend(rows)

def clean_label(s):
    s = re.sub(r"\s+", " ", (s or "")).strip(" -–·")
    # "HT 1-Star, CCI1-S" / "3-Day 2-Star, CCI2-L" -> just the CCI code
    m = re.match(r"^(?:HT|3-Day)\s+\d-Star,\s*(CCI.*)$", s, re.I)
    if m: s = m.group(1)
    return s[:60]

stats = collections.Counter()
per_event = {}
for evId, rows in entries.items():
    src = scraped.get(evId)
    if not src:
        stats["events_without_scrape"] += 1
        continue
    by_bib, by_horse, by_combo = {}, {}, {}
    for r in src:
        sec = clean_label(r.get("section"))
        if not sec: continue
        b = bibkey(r.get("bib"))
        h = norm(r.get("horse"))
        rid = norm((r.get("rider") or "").split(" ")[-1])
        if b: by_bib.setdefault(b, set()).add(sec)
        if h: by_horse.setdefault(h, set()).add(sec)
        if h and rid: by_combo.setdefault((h, rid), set()).add(sec)
    matched = 0
    for row in rows:
        b, h = bibkey(row[0]), norm(row[1])
        rid = norm((row[2] or "").split(" ")[-1])
        sec = None
        for cand in (by_bib.get(b), by_combo.get((h, rid)), by_horse.get(h)):
            if cand and len(cand) == 1: sec = next(iter(cand)); break
        if sec:
            while len(row) < 6: row.append("")
            row[5] = sec
            matched += 1
    per_event[evId] = (matched, len(rows))
    stats["events_scraped"] += 1
    stats["entries_matched"] += matched
    stats["entries_in_scraped_events"] += len(rows)

with io.open(ENTRIES, "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))

total = sum(len(v) for v in entries.values())
print(stats)
print("overall: %d/%d entries have sections (%.0f%%)" % (
    stats["entries_matched"], total, 100.0 * stats["entries_matched"] / max(1, total)))
worst = sorted(((m / max(1, n), e) for e, (m, n) in per_event.items()))[:8]
print("lowest coverage among scraped events:")
for pct, e in worst: print("  %3.0f%%  %s" % (pct * 100, e))

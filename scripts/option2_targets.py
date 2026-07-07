"""Option 2 stage 1 (CLASS-AWARE): for every promo without a winner match,
gather SAME-EVENT, SAME-CLASS candidate clips. A clip's class comes from our own
entry list (match the clip's horse -> the event's entry -> its section), not from
the filename. Only same-class clips become candidates, so a BE80 sample can only
be filled by another BE80 clip.

Outputs:
  scripts/out/option2_candidates.json  { evid: { promoIdx: classKey } }
  scripts/out/option2_probe.json        [ {href,name} ]  (dedup same-class clips)
"""
import json, re, os, unicodedata, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")

def _d(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()
def norm(s): return re.sub(r"[^a-z0-9]", "", _d(s))
def toks(s): return set(w for w in re.findall(r"[a-z0-9]+", _d(s)) if len(w) >= 4)
YEAR = re.compile(r"^\d{4}$")

# class key — mirrors promoClassKey in lib/eq.js
def class_key(s):
    s = (s or "").lower().split("section")[0].split(",")[0].split(":")[0]
    s = re.sub(r"\b(go|open|restricted|under ?18|u18|riders?)\b", " ", s)
    return re.sub(r"[^a-z0-9*]+", "", s)

# combined dropbox index
files = []
for fn in ("dropbox_index.jsonl", "dropbox_index_2.jsonl"):
    p = os.path.join(OUT, fn)
    if os.path.exists(p):
        for l in open(p, encoding="utf-8-sig"):
            l = l.strip()
            if l:
                try: files.append(json.loads(l))
                except: pass
for r in files:
    stem = re.sub(r"\.mp4$", "", r["name"], flags=re.I)
    horse = None; ev = None
    if " & " in stem:
        after = stem.split(" & ", 1)[1]
        if " at " in after: horse, ev = after.split(" at ", 1)
        else: horse = after
    r["_horse"] = norm(horse) if horse else None
    r["_ev"] = toks(ev) if ev else set()

evsets = set(frozenset(r["_ev"]) for r in files)
df = collections.Counter()
for s in evsets:
    for t in s: df[t] += 1
def dist(ts): return set(t for t in ts if not YEAR.match(t) and df.get(t, 0) <= 15)
def yr(ts):
    for t in ts:
        if YEAR.match(t): return t
    return None
by_tok = collections.defaultdict(list)
for r in files:
    for t in dist(r["_ev"]):
        by_tok[t].append(r)
def event_files(evid, evname):
    et = toks(evname + " " + evid); ed = dist(et); oy = yr(et)
    seen = set(); out = []
    for t in ed:
        for r in by_tok.get(t, []):
            if r["href"] in seen: continue
            fy = yr(r["_ev"])
            if oy and fy and oy != fy: continue
            seen.add(r["href"]); out.append(r)
    return out

PROMOS = json.loads(re.search(r"export const PROMOS\s*=\s*(\{.*\});",
        open(os.path.join(ROOT, "lib", "promos.js"), encoding="utf-8").read(), re.S).group(1))
ENTRIES = json.load(open(os.path.join(ROOT, "public", "data", "entries.json"), encoding="utf-8"))
amap = json.load(open(os.path.join(OUT, "promo_dropbox_map.json"), encoding="utf-8"))
EVNAME = {m.group(1): m.group(2) for m in re.finditer(
    r'id:\s*"([^"]+)"[^\n]*?name:\s*"([^"]+)"',
    open(os.path.join(ROOT, "lib", "events-real.js"), encoding="utf-8").read())}

candidates = {}          # evid -> {idx: classKey}
probe = {}               # href -> name
targets = 0
fillable = 0
events_covered = set()

for evid, pairs in PROMOS.items():
    byidx = amap.get(evid, {})
    tgt = [p for p in pairs if str(p[0]) not in byidx]
    if not tgt:
        continue
    rows = ENTRIES.get(evid, [])
    # this event's entries: horse -> classKey (from real section data)
    horse_class = {}
    for row in rows:
        if len(row) > 5 and row[5]:
            horse_class.setdefault(norm(row[1]), class_key(row[5]))
    # event clips grouped by class (via horse match into our entries)
    clips_by_class = collections.defaultdict(list)
    for r in event_files(evid, EVNAME.get(evid, evid)):
        ck = horse_class.get(r["_horse"])
        if ck:
            clips_by_class[ck].append(r)
    for p in tgt:
        idx = p[0]
        targets += 1
        section = rows[idx][5] if idx < len(rows) and len(rows[idx]) > 5 else ""
        ck = class_key(section)
        clips = clips_by_class.get(ck, [])
        if not clips:
            continue                  # no same-class clip -> leave as Ennis
        fillable += 1
        events_covered.add(evid)
        candidates.setdefault(evid, {})[str(idx)] = ck
        for r in clips[:10]:          # bound probe set per (event,class)
            probe[r["href"]] = r["name"]

json.dump(candidates, open(os.path.join(OUT, "option2_candidates.json"), "w"))
json.dump([{"href": h, "name": n} for h, n in probe.items()],
          open(os.path.join(OUT, "option2_probe.json"), "w"))
print("promos without a winner match:        ", targets)
print("  fillable with SAME-CLASS clip:      ", fillable, "across", len(events_covered), "events")
print("  distinct same-class clips to probe: ", len(probe))

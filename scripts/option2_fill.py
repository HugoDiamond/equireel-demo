"""Option 2 stage 3 (CLASS-AWARE): fill each target promo with a SAME-EVENT,
SAME-CLASS FINISHER clip. Class comes from our entry/section data; duration only
filters out falls/retirements. Adds fills to promo_dropbox_map.json.

Run after option2_durations.json is complete, then gen_promo_thumbs.py + gen_promos_v2.py.
"""
import json, re, os, unicodedata, collections, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")

def _d(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()
def norm(s): return re.sub(r"[^a-z0-9]", "", _d(s))
def toks(s): return set(w for w in re.findall(r"[a-z0-9]+", _d(s)) if len(w) >= 4)
YEAR = re.compile(r"^\d{4}$")
def class_key(s):
    s = (s or "").lower().split("section")[0].split(",")[0].split(":")[0]
    s = re.sub(r"\b(go|open|restricted|under ?18|u18|riders?)\b", " ", s)
    return re.sub(r"[^a-z0-9*]+", "", s)

# coarse competition LEVEL (bucket) — tolerates age/formatting suffixes but
# separates genuinely different levels (cci1 vs cci3, amateur1 vs amateur3)
def level_bucket(s):
    s = _d(s)
    m = re.search(r"cci\s?p?\s?(\d)", s)
    if m: return "cci" + m.group(1)
    m = re.search(r"amateur\s?(\d)", s)
    if m: return "am" + m.group(1)
    m = re.search(r"\bpro\s?(\d)", s)
    if m: return "pro" + m.group(1)
    if "poney" in s or "pony" in s.replace(" ", ""): return "poney"
    if "club" in s: return "club"
    m = re.search(r"\b(be|ei|ua|pc)\s?(\d{2,3})", s)
    if m: return m.group(1) + m.group(2)
    for w in ("beginnernovice", "intermediate", "advanced", "preliminary",
              "prelim", "training", "novice", "intro", "minimus"):
        if w in s.replace(" ", ""): return w
    return None

def clip_fn_bucket(name):
    pre = re.sub(r"\.mp4$", "", name, flags=re.I).split(" & ", 1)[0]
    pre = re.sub(r"^\s*equireel\s+\d+\s*", "", pre, flags=re.I)
    return level_bucket(pre)

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

durations = json.load(open(os.path.join(OUT, "option2_durations.json"), encoding="utf-8"))
PROMOS = json.loads(re.search(r"export const PROMOS\s*=\s*(\{.*\});",
        open(os.path.join(ROOT, "lib", "promos.js"), encoding="utf-8").read(), re.S).group(1))
ENTRIES = json.load(open(os.path.join(ROOT, "public", "data", "entries.json"), encoding="utf-8"))
EVNAME = {m.group(1): m.group(2) for m in re.finditer(
    r'id:\s*"([^"]+)"[^\n]*?name:\s*"([^"]+)"',
    open(os.path.join(ROOT, "lib", "events-real.js"), encoding="utf-8").read())}
amap = json.load(open(os.path.join(OUT, "promo_dropbox_map.json"), encoding="utf-8"))

fills = 0; events = set(); no_finisher = 0
for evid, pairs in PROMOS.items():
    byidx = amap.get(evid, {})
    tgt = [p for p in pairs if str(p[0]) not in byidx]
    if not tgt:
        continue
    rows = ENTRIES.get(evid, [])
    horse_class = {}
    for row in rows:
        if len(row) > 5 and row[5]:
            horse_class.setdefault(norm(row[1]), class_key(row[5]))
    clips_by_class = collections.defaultdict(list)
    for r in event_files(evid, EVNAME.get(evid, evid)):
        ck = horse_class.get(r["_horse"])
        if ck and durations.get(r["href"]):
            clips_by_class[ck].append(r)
    # per-class finisher pools
    finishers = {}
    for ck, clips in clips_by_class.items():
        ds = [durations[r["href"]] for r in clips]
        med = statistics.median(ds)
        floor = max(120.0, 0.55 * med)
        pool = [r for r in clips if durations[r["href"]] >= floor]
        if pool:
            finishers[ck] = (pool, med)
    for p in tgt:
        idx = p[0]; vim = p[1] if len(p) > 1 else None
        section = rows[idx][5] if idx < len(rows) and len(rows[idx]) > 5 else ""
        ck = class_key(section)
        if ck not in finishers:
            no_finisher += 1
            continue
        pool, med = finishers[ck]
        pb = level_bucket(section)
        # drop any clip whose own filename says a DIFFERENT level (horse that
        # ran two classes) — keeps a CCI3* sample off a CCI1 clip
        if pb:
            pool = [r for r in pool if (clip_fn_bucket(r["name"]) in (None, pb))]
        if not pool:
            no_finisher += 1
            continue
        best = min(pool, key=lambda r: abs(durations[r["href"]] - med))
        amap.setdefault(evid, {})[str(idx)] = {"vim": vim, "href": best["href"], "name": best["name"]}
        fills += 1; events.add(evid)

json.dump(amap, open(os.path.join(OUT, "promo_dropbox_map.json"), "w"))
print("option 2 SAME-CLASS finisher fills: %d across %d events" % (fills, len(events)))
print("  (no same-class finisher, kept Ennis: %d)" % no_finisher)
print("total promo_dropbox_map entries now: %d" % sum(len(v) for v in amap.values()))

"""Fill still-Ennis samples with a SAME-VENUE (any year) FINISHER, closest level
by duration. Adds to promo_dropbox_map.json. Run after durations are probed.
"""
import json, re, os, unicodedata, collections, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")

def _d(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()
def toks(s): return set(w for w in re.findall(r"[a-z0-9]+", _d(s)) if len(w) >= 4)
YEAR = re.compile(r"^\d{4}$")

def target_seconds(section):
    s = (section or "").lower()
    def has(*ks): return any(k in s for k in ks)
    if has("cci5", "5*", "badminton", "kentucky", "burghley"): return 660
    if has("cci4", "4*", "advanced"): return 400
    if has("cci3", "3*", "intermediate"): return 340
    if has("cci2", "2*", "novice", "preliminary", "prelim"): return 300
    if has("cci1", "1*", "be100", "ei100", "100", "training"): return 275
    if has("be90", "ei90", "90", "beginner novice"): return 250
    if has("be80", "ei80", "80", "intro", "amateur", "poney", "pony", "minimus", "70"): return 230
    return None

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
    ev = stem.split(" at ", 1)[1] if " at " in stem else ""
    r["_ev"] = toks(ev)
evsets = set(frozenset(r["_ev"]) for r in files)
df = collections.Counter()
for s in evsets:
    for t in s: df[t] += 1
def venue(ts): return set(t for t in ts if not YEAR.match(t) and df.get(t, 0) <= 15)
by_tok = collections.defaultdict(list)
for r in files:
    for t in venue(r["_ev"]):
        by_tok[t].append(r)
def venue_files(evid, evname):
    vt = venue(toks(evname + " " + evid))
    seen = set(); out = []
    for t in vt:
        for r in by_tok.get(t, []):
            if r["href"] in seen: continue
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
scan = json.load(open(os.path.join(OUT, "vimeo_scan.json"), encoding="utf-8"))
alive = set(scan["works"])

fills = 0; events = set()
for evid, pairs in PROMOS.items():
    byidx = amap.get(evid, {})
    tgt = [p for p in pairs if str(p[0]) not in byidx and (p[1] not in alive if len(p) > 1 else True)]
    if not tgt:
        continue
    vfiles = [r for r in venue_files(evid, EVNAME.get(evid, evid)) if durations.get(r["href"])]
    if not vfiles:
        continue
    ds = [durations[r["href"]] for r in vfiles]
    med = statistics.median(ds)
    floor = max(120.0, 0.5 * med)
    finishers = [r for r in vfiles if durations[r["href"]] >= floor]
    if not finishers:
        continue
    rows = ENTRIES.get(evid, [])
    for p in tgt:
        idx = p[0]; vim = p[1] if len(p) > 1 else None
        section = rows[idx][5] if idx < len(rows) and len(rows[idx]) > 5 else ""
        tsec = target_seconds(section) or med
        best = min(finishers, key=lambda r: abs(durations[r["href"]] - tsec))
        amap.setdefault(evid, {})[str(idx)] = {"vim": vim, "href": best["href"], "name": best["name"]}
        fills += 1; events.add(evid)

json.dump(amap, open(os.path.join(OUT, "promo_dropbox_map.json"), "w"))
print("same-venue (any year) fills added: %d across %d events" % (fills, len(events)))
print("total promo_dropbox_map entries now: %d" % sum(len(v) for v in amap.values()))

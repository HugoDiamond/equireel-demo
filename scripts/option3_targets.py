"""Hybrid stage: for promos still on Ennis (dead Vimeo + no same-class clip),
gather SAME-EVENT clips (any class) so a same-event finisher can fill them as a
second choice. Emits the dedup clips needing a duration probe.

Outputs:
  scripts/out/option3_candidates.json  { evid: [idx,...] }
  scripts/out/option3_probe.json        [ {href,name} ]
"""
import json, re, os, unicodedata, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")

def _d(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()
def toks(s): return set(w for w in re.findall(r"[a-z0-9]+", _d(s)) if len(w) >= 4)
YEAR = re.compile(r"^\d{4}$")

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
amap = json.load(open(os.path.join(OUT, "promo_dropbox_map.json"), encoding="utf-8"))
scan = json.load(open(os.path.join(OUT, "vimeo_scan.json"), encoding="utf-8"))
alive = set(scan["works"])
EVNAME = {m.group(1): m.group(2) for m in re.finditer(
    r'id:\s*"([^"]+)"[^\n]*?name:\s*"([^"]+)"',
    open(os.path.join(ROOT, "lib", "events-real.js"), encoding="utf-8").read())}

candidates = {}; probe = {}; targets = 0; fillable = 0; ev_ok = set()
for evid, pairs in PROMOS.items():
    byidx = amap.get(evid, {})
    tgt = [p for p in pairs if str(p[0]) not in byidx and (p[1] not in alive if len(p) > 1 else True)]
    if not tgt:
        continue
    efiles = event_files(evid, EVNAME.get(evid, evid))
    for p in tgt:
        targets += 1
        if not efiles:
            continue
        fillable += 1; ev_ok.add(evid)
        candidates.setdefault(evid, []).append(p[0])
    # spread the probe across the event's clips (variety of levels)
    for r in efiles[:30]:
        probe[r["href"]] = r["name"]

json.dump(candidates, open(os.path.join(OUT, "option3_candidates.json"), "w"))
json.dump([{"href": h, "name": n} for h, n in probe.items()],
          open(os.path.join(OUT, "option3_probe.json"), "w"))
print("Ennis promos:", targets, " fillable same-event:", fillable, "across", len(ev_ok), "events")
print("distinct clips to probe:", len(probe))

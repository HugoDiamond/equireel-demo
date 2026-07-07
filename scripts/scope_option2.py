"""Scope option 2: which broken samples can actually be filled from the Dropbox
folder? A broken promo is fillable only if its EVENT is present in the folder
(so a same-event finisher video exists). Output the events to scrape results for.
"""
import json, re, os, unicodedata, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")

def _deacc(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()
def toks(s):
    return set(w for w in re.findall(r"[a-z0-9]+", _deacc(s)) if len(w) >= 4)

# folder files -> event token sets + competitors per event-key
files = [json.loads(l) for l in open(os.path.join(OUT, "dropbox_index.jsonl"), encoding="utf-8-sig") if l.strip()]
file_evtoks = []
for r in files:
    stem = re.sub(r"\.mp4$", "", r["name"], flags=re.I)
    ev = stem.split(" at ", 1)[1] if " at " in stem else ""
    r["_ev"] = toks(ev)
    file_evtoks.append(r["_ev"])

# event-document-frequency for distinctive tokens
ev_sets = set(frozenset(t) for t in file_evtoks)
df = collections.Counter()
for s in ev_sets:
    for t in s:
        df[t] += 1
YEAR = re.compile(r"^\d{4}$")
def distinctive(ts):
    return set(t for t in ts if not YEAR.match(t) and df.get(t, 0) <= 3)

# index folder events by distinctive token -> file count
folder_by_tok = collections.defaultdict(int)
for r in files:
    for t in distinctive(r["_ev"]):
        folder_by_tok[t] += 1

scan = json.load(open(os.path.join(OUT, "vimeo_scan.json")))
broken = set(scan["broken"])
amap = json.load(open(os.path.join(OUT, "promo_dropbox_map.json"), encoding="utf-8"))
PROMOS = json.loads(re.search(r"export const PROMOS\s*=\s*(\{.*\});",
        open(os.path.join(ROOT, "lib", "promos.js"), encoding="utf-8").read(), re.S).group(1))
EVNAME = {m.group(1): m.group(2) for m in re.finditer(
        r'id:\s*"([^"]+)"[^\n]*?name:\s*"([^"]+)"',
        open(os.path.join(ROOT, "lib", "events-real.js"), encoding="utf-8").read())}

def folder_files_for(evid):
    d = distinctive(toks(EVNAME.get(evid, evid) + " " + evid))
    return sum(folder_files_by_event_tok(t) for t in d), d

def folder_files_by_event_tok(t):
    return folder_by_tok.get(t, 0)

fillable = collections.Counter()   # evid -> broken promos fillable
unfillable = 0
broken_total = 0
for evid, pairs in PROMOS.items():
    byidx = amap.get(evid, {})
    for p in pairs:
        vim = p[1] if len(p) > 1 else None
        if not vim or vim not in broken:
            continue
        if str(p[0]) in byidx:      # already has a dropbox match
            continue
        broken_total += 1
        cnt, d = folder_files_for(evid)
        if cnt > 0:
            fillable[evid] += 1
        else:
            unfillable += 1

print("broken samples without a dropbox match:", broken_total)
print("  FILLABLE (event is in the folder):   ", sum(fillable.values()), "across", len(fillable), "events")
print("  unfillable (event not in folder):    ", unfillable)
print("\ntop fillable events (broken samples each):")
for evid, n in fillable.most_common(30):
    print(f"  {n:3d}  {EVNAME.get(evid, evid)}")

json.dump({"fillable_events": list(fillable.keys())},
          open(os.path.join(OUT, "option2_scope.json"), "w"))

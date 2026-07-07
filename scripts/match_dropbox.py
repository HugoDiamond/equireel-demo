"""Match each promotion (winner) video to its real XC file in the Dropbox index.

Inputs:
  scripts/out/dropbox_index.jsonl   {name, bytes, href, path}
  lib/promos.js                     PROMOS = { evId: [[entryIdx, vimeoPath], ...] }
  public/data/entries.json          { evId: [[bib,horse,rider,day,time,section], ...] }
  lib/events-real.js                event id -> name (for tie-breaking)

Output:
  scripts/out/promo_dropbox_map.json  { evId: { entryIdx: {vim, href, name} } }
  scripts/out/promo_unmatched.json    list of promos with no XC file found
"""
import json, re, os, unicodedata, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")

def _deacc(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()

def norm(s):
    return re.sub(r"[^a-z0-9]", "", _deacc(s))

# real word tokens (split on non-alphanumeric BEFORE stripping spaces)
def ev_tokens(name):
    return set(w for w in re.findall(r"[a-z0-9]+", _deacc(name)) if len(w) >= 4)

# ---- load dropbox index (all crawled folders) ----
files = []
for fn in ("dropbox_index.jsonl", "dropbox_index_2.jsonl"):
    path = os.path.join(OUT, fn)
    if not os.path.exists(path):
        continue
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                files.append(json.loads(line))
            except Exception:
                pass

# parse each file: horse (between ' & ' and ' at '), full-norm, event-norm
horse_index = collections.defaultdict(list)   # horse_norm -> [rec]
for rec in files:
    name = rec["name"]
    stem = re.sub(r"\.mp4$", "", name, flags=re.I)
    horse = None
    event = None
    if " & " in stem:
        after = stem.split(" & ", 1)[1]
        if " at " in after:
            horse, evpart = after.split(" at ", 1)
            event = evpart
        else:
            horse = after
    rec["_full"] = norm(stem)
    rec["_horse"] = norm(horse) if horse else None
    rec["_evtok"] = ev_tokens(event) if event else set()
    if rec["_horse"]:
        horse_index[rec["_horse"]].append(rec)

# ---- load promos ----
with open(os.path.join(ROOT, "lib", "promos.js"), encoding="utf-8") as f:
    txt = f.read()
m = re.search(r"export const PROMOS\s*=\s*(\{.*\});", txt, re.S)
PROMOS = json.loads(m.group(1))

# ---- load entries ----
with open(os.path.join(ROOT, "public", "data", "entries.json"), encoding="utf-8") as f:
    ENTRIES = json.load(f)

# ---- load event names ----
with open(os.path.join(ROOT, "lib", "events-real.js"), encoding="utf-8") as f:
    evtxt = f.read()
EVNAME = {}
for mm in re.finditer(r'id:\s*"([^"]+)"[^\n]*?name:\s*"([^"]+)"', evtxt):
    EVNAME[mm.group(1)] = mm.group(2)

YEAR = re.compile(r"^\d{4}$")

# data-driven: a token identifies a venue if it appears in only a handful of
# distinct events in the folder ("ballindenisk" -> 1 event, "international" ->
# many). Build document-frequency over the distinct file event strings.
_ev_strings = set()
for rec in files:
    _ev_strings.add(frozenset(rec["_evtok"]))
_ev_df = collections.Counter()
for toks in _ev_strings:
    for t in toks:
        _ev_df[t] += 1

def distinctive(toks):
    # a venue token appears in few distinct events (even across editions/years);
    # generic words like "international" appear in dozens
    return set(t for t in toks if not YEAR.match(t) and _ev_df.get(t, 0) <= 15)

def year_of(toks):
    for t in toks:
        if YEAR.match(t):
            return t
    return None

def find_file(horse, rider, evname):
    hn, rn = norm(horse), norm(rider)
    if not hn or len(hn) < 3:
        return None
    # candidates: same horse (exact parsed horse, else horse substring)
    cands = list(horse_index.get(hn, []))
    if not cands and len(hn) >= 5:
        cands = [r for r in files if hn in r["_full"]]
    if not cands:
        return None
    etoks = ev_tokens(evname)
    edist = distinctive(etoks)
    our_year = year_of(etoks)
    def ev_match(r):
        # shared venue token AND same year (when both carry a year) — this is
        # the right horse AT this event, not the same horse elsewhere/another year
        if not (edist & distinctive(r["_evtok"])):
            return 0
        fy = year_of(r["_evtok"])
        if our_year and fy and our_year != fy:
            return 0
        return len(edist & distinctive(r["_evtok"]))
    def score(r):
        return ev_match(r) * 10 + (2 if (rn and rn in r["_full"]) else 0)
    best = max(cands, key=score)
    if ev_match(best) >= 1:
        return best
    return None

out = {}
unmatched = []
total = matched = 0
used_files = set()
for evid, pairs in PROMOS.items():
    rows = ENTRIES.get(evid, [])
    evname = EVNAME.get(evid, evid)
    for pair in pairs:
        idx = pair[0]
        vim = pair[1] if len(pair) > 1 else None
        total += 1
        if idx >= len(rows):
            unmatched.append({"ev": evid, "idx": idx, "reason": "idx-oob"})
            continue
        row = rows[idx]
        horse, rider = row[1], row[2]
        # the id slug reliably carries the venue even when the researched name
        # is worded differently (e.g. "ballindenisk-international-2-2025")
        rec = find_file(horse, rider, evname + " " + evid)
        if rec:
            out.setdefault(evid, {})[str(idx)] = {"vim": vim, "href": rec["href"], "name": rec["name"]}
            used_files.add(rec["href"])
            matched += 1
        else:
            unmatched.append({"ev": evid, "idx": idx, "horse": horse, "rider": rider, "event": evname, "vim": vim})

with open(os.path.join(OUT, "promo_dropbox_map.json"), "w", encoding="utf-8") as f:
    json.dump(out, f)
with open(os.path.join(OUT, "promo_unmatched.json"), "w", encoding="utf-8") as f:
    json.dump(unmatched, f, indent=1)

print(f"dropbox files indexed: {len(files)}")
print(f"promos total: {total}  matched: {matched}  unmatched: {len(unmatched)}")
print(f"distinct dropbox files used: {len(used_files)}")

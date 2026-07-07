"""Rewrite lib/promos.js so matched promos carry the real Dropbox XC video URL
and a real thumbnail filename.

New entry shape:
  matched:   [entryIdx, vimeoPath, dropboxPlayUrl, thumbFile]
  unmatched: [entryIdx, vimeoPath]                       (unchanged)
"""
import json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")

with open(os.path.join(ROOT, "lib", "promos.js"), encoding="utf-8") as f:
    txt = f.read()
PROMOS = json.loads(re.search(r"export const PROMOS\s*=\s*(\{.*\});", txt, re.S).group(1))
amap = json.load(open(os.path.join(OUT, "promo_dropbox_map.json"), encoding="utf-8"))
thumb_map = json.load(open(os.path.join(OUT, "thumb_map.json"), encoding="utf-8"))

def _load(name):
    p = os.path.join(OUT, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
scan = _load("vimeo_scan.json")
vstatus = scan.get("status", {})              # vim -> 200 alive / 404 dead / -1
vimeo_thumb = _load("vimeo_thumb_map.json")   # vim -> local vimeo thumbnail file

def play_url(href):
    # dl.dropboxusercontent.com serves the mp4 inline with range support so a
    # browser <video> can play & seek it (www.dropbox.com&raw=1 does NOT).
    return (href.replace("www.dropbox.com", "dl.dropboxusercontent.com")
                .replace("&dl=0", "&raw=1").replace("?dl=0", "?raw=1"))

matched = vimeo_thumbed = dropbox_thumbed = 0
newp = {}
for evid, pairs in PROMOS.items():
    rows = []
    byidx = amap.get(evid, {})
    for pair in pairs:
        idx = pair[0]
        vim = pair[1] if len(pair) > 1 else None
        rec = byidx.get(str(idx))
        url = play_url(rec["href"]) if rec else 0
        alive = vim and vstatus.get(vim) == 200
        vthumb = vimeo_thumb.get(vim) if vim else None
        dthumb = thumb_map.get(rec["href"]) if rec else None
        if rec:
            matched += 1
        # thumbnail must match what plays: a working Vimeo (alive) plays Vimeo,
        # so use its Vimeo still; otherwise the Dropbox clip plays -> its frame
        if alive and vthumb:
            vimeo_thumbed += 1
            rows.append([idx, vim, url, vthumb])          # Vimeo plays; keep Dropbox as fallback
        elif rec and dthumb:
            dropbox_thumbed += 1
            rows.append([idx, vim, url, dthumb])          # Dropbox plays; its frame
        elif rec:
            rows.append([idx, vim, url, 0])
        else:
            rows.append([idx, vim])                       # Ennis fallback (its own still)
    newp[evid] = rows

body = json.dumps(newp, separators=(",", ":"))
out = (
    "/* Free winner (promotion) videos per event.\n"
    "   Matched entries: [entryIdx, vimeoPath, dropboxPlayUrl, thumbFile]\n"
    "   Unmatched:       [entryIdx, vimeoPath]\n"
    "   Regenerate: python scripts/gen_promos_v2.py */\n\n"
    "export const PROMOS = " + body + ";\n"
)
with open(os.path.join(ROOT, "lib", "promos.js"), "w", encoding="utf-8") as f:
    f.write(out)

print(f"promos with dropbox video: {matched}")
print(f"thumbnails — vimeo (working samples): {vimeo_thumbed}")
print(f"thumbnails — dropbox (filled samples): {dropbox_thumbed}")

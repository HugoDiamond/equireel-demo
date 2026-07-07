"""Classify each promo Vimeo AND grab its real thumbnail in one pass via
vumbnail.com (Vimeo's oEmbed is 403-throttling our IP). A live video returns a
real still (tens of KB); a deleted one returns the fixed 3,278-byte placeholder.

Outputs:
  scripts/out/vimeo_scan.json        {status: {vim:200|404}, works, broken}
  scripts/out/vimeo_thumb_map.json   {vim: "v<hash>.jpg"}   (live samples only)
  public/assets/promo-thumbs/v<hash>.jpg
"""
import json, re, os, ssl, hashlib, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")
THUMBDIR = os.path.join(ROOT, "public", "assets", "promo-thumbs")
CTX = ssl._create_unverified_context()
os.makedirs(THUMBDIR, exist_ok=True)
PLACEHOLDER_MAX = 5000   # the dead-video placeholder is ~3278 bytes

txt = open(os.path.join(ROOT, "lib", "promos.js"), encoding="utf-8").read()
PROMOS = json.loads(re.search(r"export const PROMOS\s*=\s*(\{.*\});", txt, re.S).group(1))
vims = set()
for evid, pairs in PROMOS.items():
    for p in pairs:
        if len(p) > 1 and p[1]:
            vims.add(p[1])

def key(vim): return "v" + hashlib.sha1(vim.encode()).hexdigest()[:14]

def fetch(vim):
    vid = vim.split("/")[0]
    url = "https://vumbnail.com/%s.jpg" % vid
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
                data = r.read()
            if len(data) > PLACEHOLDER_MAX:          # real thumbnail -> alive
                fn = key(vim) + ".jpg"
                open(os.path.join(THUMBDIR, fn), "wb").write(data)
                return vim, 200, fn
            return vim, 404, None                    # placeholder -> dead
        except Exception:
            pass
    return vim, -1, None

status = {}; thumb = {}
done = 0
with ThreadPoolExecutor(max_workers=16) as ex:
    futs = [ex.submit(fetch, v) for v in vims]
    for f in as_completed(futs):
        vim, st, fn = f.result()
        status[vim] = st
        if fn: thumb[vim] = fn
        done += 1
        if done % 300 == 0:
            print("  %d/%d" % (done, len(vims)), flush=True)

works = [v for v, s in status.items() if s == 200]
broken = [v for v, s in status.items() if s == 404]
unknown = [v for v, s in status.items() if s == -1]
json.dump({"status": status, "works": works, "broken": broken}, open(os.path.join(OUT, "vimeo_scan.json"), "w"))
json.dump(thumb, open(os.path.join(OUT, "vimeo_thumb_map.json"), "w"))
print("distinct vims: %d" % len(vims))
print("  ALIVE (real thumb): %d" % len(works))
print("  DEAD (placeholder): %d" % len(broken))
print("  unknown:            %d" % len(unknown))
print("  vimeo thumbnails saved: %d" % len(thumb))

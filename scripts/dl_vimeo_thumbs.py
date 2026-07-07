"""Download the real Vimeo thumbnail for each ALIVE promo (from the oEmbed
thumbnail_url captured by scan_vimeo.py) so working-Vimeo samples show a still
from the exact Vimeo clip that plays.

Output: public/assets/promo-thumbs/v<hash>.jpg  +  scripts/out/vimeo_thumb_map.json {vim: file}
"""
import json, os, ssl, hashlib, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")
THUMBDIR = os.path.join(ROOT, "public", "assets", "promo-thumbs")
CTX = ssl._create_unverified_context()
os.makedirs(THUMBDIR, exist_ok=True)

scan = json.load(open(os.path.join(OUT, "vimeo_scan.json"), encoding="utf-8"))
thumbs = scan.get("thumbs", {})   # {vim: thumbnail_url}

def key(vim):
    return "v" + hashlib.sha1(vim.encode()).hexdigest()[:14]

def dl(item):
    vim, url = item
    # ask Vimeo for a larger crop than the default
    url2 = url
    fn = key(vim) + ".jpg"
    dst = os.path.join(THUMBDIR, fn)
    if os.path.exists(dst) and os.path.getsize(dst) > 1500:
        return vim, fn
    for u in (url2, url):
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
                data = r.read()
            if len(data) > 1500:
                open(dst, "wb").write(data)
                return vim, fn
        except Exception:
            pass
    return vim, None

out = {}
ok = fail = 0
items = list(thumbs.items())
print("vimeo thumbnails to download:", len(items), flush=True)
with ThreadPoolExecutor(max_workers=12) as ex:
    for vim, fn in ex.map(dl, items):
        if fn:
            out[vim] = fn; ok += 1
        else:
            fail += 1
json.dump(out, open(os.path.join(OUT, "vimeo_thumb_map.json"), "w"))
print("downloaded %d  failed %d" % (ok, fail))

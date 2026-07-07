"""Re-fetch the working-channel Vimeo stills at LARGE size (vumbnail _large) and
convert to 1280 WebP so they match the Dropbox frames' quality.

Updates scripts/out/vimeo_thumb_map.json to the .webp filenames; removes the old
.jpg versions.
"""
import json, os, ssl, hashlib, subprocess, tempfile, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")
THUMBDIR = os.path.join(ROOT, "public", "assets", "promo-thumbs")
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"
CTX = ssl._create_unverified_context()

tm = json.load(open(os.path.join(OUT, "vimeo_thumb_map.json"), encoding="utf-8"))  # {vim: old.jpg}
scan = json.load(open(os.path.join(OUT, "vimeo_scan.json"), encoding="utf-8"))
vims = list(scan.get("works", tm.keys()))

def key(vim): return "v" + hashlib.sha1(vim.encode()).hexdigest()[:14]

def one(vim):
    vid = vim.split("/")[0]
    dst = os.path.join(THUMBDIR, key(vim) + ".webp")
    if os.path.exists(dst) and os.path.getsize(dst) > 3000:
        return vim, key(vim) + ".webp"
    for suffix in ("_large", ""):
        url = "https://vumbnail.com/%s%s.jpg" % (vid, suffix)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
                data = r.read()
            if len(data) <= 5000:      # placeholder, not a real still
                continue
            tf = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            tf.write(data); tf.close()
            subprocess.run([FFMPEG, "-y", "-v", "error", "-i", tf.name, "-vf",
                            "scale='min(1280,iw)':-2", "-c:v", "libwebp",
                            "-quality", "82", dst], capture_output=True, timeout=60)
            os.unlink(tf.name)
            if os.path.exists(dst) and os.path.getsize(dst) > 3000:
                return vim, key(vim) + ".webp"
        except Exception:
            pass
    return vim, None

out = {}; ok = fail = 0
with ThreadPoolExecutor(max_workers=10) as ex:
    for vim, fn in ex.map(one, vims):
        if fn:
            out[vim] = fn; ok += 1
        else:
            fail += 1
json.dump(out, open(os.path.join(OUT, "vimeo_thumb_map.json"), "w"))
# drop the superseded .jpg vimeo thumbnails
for f in os.listdir(THUMBDIR):
    if f.startswith("v") and f.endswith(".jpg"):
        try: os.remove(os.path.join(THUMBDIR, f))
        except Exception: pass
print("vimeo large webp: ok %d  fail %d" % (ok, fail))

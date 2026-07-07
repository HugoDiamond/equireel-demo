"""Background job: once Vimeo stops throttling this IP, upgrade the 584
working-channel stills from 640 to full 1280 WebP and ship it. Safe to run
repeatedly — it no-ops while throttled and marks itself done on success.

Scheduled to run periodically; exits quietly until Vimeo's oEmbed answers 200.
"""
import json, os, ssl, hashlib, subprocess, tempfile, urllib.request, urllib.parse, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")
THUMBDIR = os.path.join(ROOT, "public", "assets", "promo-thumbs")
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"
CTX = ssl._create_unverified_context()
MARKER = os.path.join(OUT, "vimeo_1280_done.marker")

if os.path.exists(MARKER):
    print("already upgraded — nothing to do"); sys.exit(0)

scan = json.load(open(os.path.join(OUT, "vimeo_scan.json"), encoding="utf-8"))
vims = list(scan.get("works", []))
if not vims:
    print("no alive vims"); sys.exit(0)

def key(vim): return "v" + hashlib.sha1(vim.encode()).hexdigest()[:14]

def oembed(vim, width):
    vid = vim.split("/")[0]; h = vim.split("/")[1] if "/" in vim else None
    page = "https://vimeo.com/%s%s" % (vid, "/" + h if h else "")
    url = ("https://vimeo.com/api/oembed.json?width=%d&url=%s"
           % (width, urllib.parse.quote(page, safe="")))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
        return json.load(r)

# throttle probe — if oEmbed still 403s, leave everything untouched
try:
    oembed(vims[0], 1280)
except urllib.error.HTTPError as e:
    if e.code == 403:
        print("still throttled (403) — will retry next run"); sys.exit(0)
except Exception as ex:
    print("probe failed (%s) — retry next run" % ex); sys.exit(0)

def upgrade(vim):
    dst = os.path.join(THUMBDIR, key(vim) + ".webp")
    try:
        j = oembed(vim, 1280)
        turl = j.get("thumbnail_url")
        if not turl:
            return False
        # request a larger crop from the CDN where possible
        turl = turl.split("_")[0] if "_" in turl.split("/")[-1] else turl
        for u in (turl, j.get("thumbnail_url")):
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
                    data = r.read()
                if len(data) < 5000:
                    continue
                tf = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
                tf.write(data); tf.close()
                subprocess.run([FFMPEG, "-y", "-v", "error", "-i", tf.name, "-vf",
                                "scale='min(1280,iw)':-2", "-c:v", "libwebp",
                                "-quality", "82", dst], capture_output=True, timeout=60)
                subprocess.run([FFMPEG, "-y", "-v", "error", "-i", dst, "-vf",
                                "scale=512:-2", "-c:v", "libwebp", "-quality", "80",
                                dst[:-5] + "-sm.webp"], capture_output=True, timeout=60)
                os.unlink(tf.name)
                return os.path.exists(dst)
            except Exception:
                pass
    except Exception:
        pass
    return False

from concurrent.futures import ThreadPoolExecutor
ok = 0
with ThreadPoolExecutor(max_workers=8) as ex:
    for r in ex.map(upgrade, vims):
        ok += 1 if r else 0
print("vimeo stills upgraded to 1280: %d / %d" % (ok, len(vims)))

if ok >= len(vims) * 0.7:      # enough succeeded — ship it and stop retrying
    open(MARKER, "w").write("done %d/%d" % (ok, len(vims)))
    subprocess.run(["git", "-C", ROOT, "add", "public/assets/promo-thumbs"], check=False)
    subprocess.run(["git", "-C", ROOT, "commit", "-q", "-m",
                    "Upgrade working-Vimeo stills to full 1280 WebP"], check=False)
    subprocess.run(["git", "-C", ROOT, "push", "origin", "main"], check=False)
    print("committed + pushed (CI will deploy)")
else:
    print("too few succeeded — not shipping; will retry next run")

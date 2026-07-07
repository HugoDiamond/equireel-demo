"""Grab a real thumbnail frame from each matched Dropbox XC video (ffmpeg over
HTTP, no full download). Resumable and parallel.

Input:  scripts/out/promo_dropbox_map.json  (evId -> idx -> {vim, href, name})
Output: public/assets/promo-thumbs/<key>.jpg   (key = sha1(name)[:16])
        scripts/out/thumb_map.json             (href -> "<key>.jpg")
"""
import json, os, re, hashlib, subprocess, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")
THUMBDIR = os.path.join(ROOT, "public", "assets", "promo-thumbs")
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"
os.makedirs(THUMBDIR, exist_ok=True)

with open(os.path.join(OUT, "promo_dropbox_map.json"), encoding="utf-8") as f:
    amap = json.load(f)

# distinct files: href -> name
distinct = {}
for evid, byidx in amap.items():
    for idx, rec in byidx.items():
        distinct[rec["href"]] = rec["name"]

def key_for(name):
    return hashlib.sha1(name.encode("utf-8")).hexdigest()[:16]

def play_url(href):
    return href.replace("&dl=0", "&raw=1").replace("?dl=0", "?raw=1")

import time
# (mode, seconds): 'in' = fast input-seek (needs faststart); 'out' = output-seek
# (decodes from start, robust for non-faststart files but downloads a few MB)
ATTEMPTS = [("in", "15"), ("in", "5"), ("out", "6"), ("out", "1")]

# 1280-wide WebP at q82 — retina-crisp on the horse-page hero, and WebP keeps
# the file ~80KB (vs a same-quality JPEG that'd be much larger)
VF = "scale=1280:-2"
ENC = ["-c:v", "libwebp", "-quality", "82"]
def grab(href, name):
    key = key_for(name)
    dst = os.path.join(THUMBDIR, key + ".webp")
    if os.path.exists(dst) and os.path.getsize(dst) > 3000:
        return (href, key + ".webp", "cached")
    url = play_url(href)
    for mode, ss in ATTEMPTS:
        for attempt in range(2):
            try:
                if mode == "in":
                    cmd = [FFMPEG, "-y", "-v", "error", "-ss", ss, "-i", url,
                           "-frames:v", "1", "-vf", VF] + ENC + [dst]
                else:
                    cmd = [FFMPEG, "-y", "-v", "error", "-i", url, "-ss", ss,
                           "-frames:v", "1", "-vf", VF] + ENC + [dst]
                subprocess.run(cmd, capture_output=True, timeout=120)
                if os.path.exists(dst) and os.path.getsize(dst) > 3000:
                    return (href, key + ".webp", mode + "@" + ss)
            except Exception:
                pass
            time.sleep(1.5 * (attempt + 1))   # back off (Dropbox throttles)
    return (href, None, "FAIL")

thumb_map = {}
done = fail = 0
total = len(distinct)
print(f"distinct videos to thumbnail: {total}", flush=True)
with ThreadPoolExecutor(max_workers=5) as ex:
    futs = [ex.submit(grab, h, n) for h, n in distinct.items()]
    for fut in as_completed(futs):
        href, tf, status = fut.result()
        if tf:
            thumb_map[href] = tf
            done += 1
        else:
            fail += 1
        if (done + fail) % 100 == 0:
            print(f"  {done+fail}/{total}  ok={done} fail={fail}", flush=True)

with open(os.path.join(OUT, "thumb_map.json"), "w", encoding="utf-8") as f:
    json.dump(thumb_map, f)
print(f"DONE thumbnails ok={done} fail={fail} total={total}")

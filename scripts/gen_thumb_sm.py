"""Make a light 512-wide WebP next to each 1280 thumbnail (<key>-sm.webp) so
placards load ~20KB and only the horse-page hero pulls the full 1280. Downscales
the local 1280 files — no network."""
import os, subprocess
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THUMBDIR = os.path.join(ROOT, "public", "assets", "promo-thumbs")
FFMPEG = r"C:\ffmpeg\bin\ffmpeg.exe"

srcs = [f for f in os.listdir(THUMBDIR)
        if f.endswith(".webp") and not f.endswith("-sm.webp")]

def small(f):
    src = os.path.join(THUMBDIR, f)
    dst = os.path.join(THUMBDIR, f[:-5] + "-sm.webp")
    if os.path.exists(dst) and os.path.getsize(dst) > 1500:
        return True
    try:
        subprocess.run([FFMPEG, "-y", "-v", "error", "-i", src, "-vf",
                        "scale=512:-2", "-c:v", "libwebp", "-quality", "80", dst],
                       capture_output=True, timeout=60)
        return os.path.exists(dst)
    except Exception:
        return False

ok = 0
with ThreadPoolExecutor(max_workers=16) as ex:
    for r in ex.map(small, srcs):
        ok += 1 if r else 0
print("small versions made: %d / %d" % (ok, len(srcs)))

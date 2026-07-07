"""Option 2 stage 2: probe each candidate clip's duration (ffprobe over HTTP,
reads only the header). Resumable. A completed XC round runs the full course;
falls/retirements are short outliers we'll drop in stage 3.

Input:  scripts/out/option2_probe.json  [{href,name}]
Output: scripts/out/option2_durations.json  { href: seconds }
"""
import json, os, subprocess, time
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")
FFPROBE = r"C:\ffmpeg\bin\ffprobe.exe"

import sys
probe_file = sys.argv[1] if len(sys.argv) > 1 else "option2_probe.json"
probe = json.load(open(os.path.join(OUT, probe_file), encoding="utf-8"))
dst = os.path.join(OUT, "option2_durations.json")
dur = {}
if os.path.exists(dst):
    try: dur = json.load(open(dst, encoding="utf-8"))
    except: dur = {}

def play_url(href):
    return (href.replace("www.dropbox.com", "dl.dropboxusercontent.com")
                .replace("&dl=0", "&raw=1").replace("?dl=0", "?raw=1"))

def probe_dur(item):
    href = item["href"]
    if href in dur:
        return href, dur[href]
    url = play_url(href)
    for attempt in range(3):
        try:
            r = subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                                "format=duration", "-of", "csv=p=0", "-i", url],
                               capture_output=True, timeout=90, text=True)
            s = (r.stdout or "").strip()
            if s:
                return href, round(float(s), 1)
        except Exception:
            pass
        time.sleep(1.5 * (attempt + 1))
    return href, None

todo = [it for it in probe if it["href"] not in dur]
print("clips to probe: %d (cached %d)" % (len(todo), len(dur)), flush=True)
done = 0
with ThreadPoolExecutor(max_workers=5) as ex:
    futs = [ex.submit(probe_dur, it) for it in todo]
    for f in as_completed(futs):
        href, d = f.result()
        if d is not None:
            dur[href] = d
        done += 1
        if done % 200 == 0:
            print("  probed %d/%d" % (done, len(todo)), flush=True)
            json.dump(dur, open(dst, "w"))
json.dump(dur, open(dst, "w"))
vals = [v for v in dur.values() if v]
print("DONE durations: %d  (median %.0fs)" % (len(dur), sorted(vals)[len(vals)//2] if vals else 0))

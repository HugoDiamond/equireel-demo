"""Scan every promo Vimeo link: does it play (oEmbed 200) or is it the
'Sorry, this video doesn't exist' cohort (oEmbed 404)?

oEmbed status was validated against the browser Vimeo Player API:
  200 -> player posts 'ready' (plays)   404 -> player posts 'error' (gone)
"""
import json, re, os, ssl, urllib.request, urllib.parse, collections
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "scripts", "out")
CTX = ssl._create_unverified_context()

txt = open(os.path.join(ROOT, "lib", "promos.js"), encoding="utf-8").read()
PROMOS = json.loads(re.search(r"export const PROMOS\s*=\s*(\{.*\});", txt, re.S).group(1))

# distinct vimeo paths + which have a dropbox url already (len>=3 with a url)
vims = {}          # vimpath -> has_dropbox(any promo using it)
promo_index = []   # (evid, idx, vimpath, has_dropbox)
for evid, pairs in PROMOS.items():
    for p in pairs:
        vim = p[1] if len(p) > 1 else None
        if not vim:
            continue
        has_db = len(p) >= 3 and isinstance(p[2], str) and p[2].startswith("http")
        vims[vim] = vims.get(vim, False) or has_db
        promo_index.append((evid, p[0], vim, has_db))

def check(vim):
    """Return (vim, status, thumbnail_url). Retries so a rate-limit blip is not
    misread as 'dead'. Only a real HTTP 404 counts as gone."""
    vid = vim.split("/")[0]; h = vim.split("/")[1] if "/" in vim else None
    page = "https://vimeo.com/%s%s" % (vid, "/" + h if h else "")
    url = "https://vimeo.com/api/oembed.json?url=" + urllib.parse.quote(page, safe="")
    for attempt in range(4):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
                j = json.load(r)
                return vim, 200, j.get("thumbnail_url")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return vim, 404, None      # definitively gone
            time.sleep(1.5 * (attempt + 1))
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return vim, -1, None                    # unknown after retries (network)

import time
status = {}
thumbs = {}
done = 0
with ThreadPoolExecutor(max_workers=12) as ex:
    futs = [ex.submit(check, v) for v in vims]
    for f in as_completed(futs):
        vim, st, tu = f.result(); status[vim] = st
        if tu: thumbs[vim] = tu
        done += 1
        if done % 300 == 0:
            print("  scanned %d/%d" % (done, len(vims)), flush=True)

works = [v for v, s in status.items() if s == 200]
broken = [v for v, s in status.items() if s == 404]
other = [v for v, s in status.items() if s not in (200, 404)]
print("\ndistinct vimeo links: %d" % len(vims))
print("  PLAY (oEmbed 200):        %d" % len(works))
print("  DOES-NOT-EXIST (404):     %d" % len(broken))
print("  other/unknown:            %d" % len(other))

# per-promo view: how many shown samples are broken, and do broken have dropbox?
broken_set = set(broken)
tot = brk = brk_db = brk_nodb = 0
brk_events = collections.Counter()
for evid, idx, vim, has_db in promo_index:
    tot += 1
    if vim in broken_set:
        brk += 1
        if has_db: brk_db += 1
        else: brk_nodb += 1; brk_events[evid] += 1
print("\npromo samples total: %d" % tot)
print("  broken samples:                 %d" % brk)
print("  broken WITH dropbox already:    %d" % brk_db)
print("  broken WITHOUT dropbox (need):  %d across %d events" % (brk_nodb, len(brk_events)))

print("  vimeo thumbnails captured: %d" % len(thumbs))
json.dump({"works": works, "broken": broken, "other": other,
           "status": status, "thumbs": thumbs},
          open(os.path.join(OUT, "vimeo_scan.json"), "w"))

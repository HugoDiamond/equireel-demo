# Fetch the real Vimeo thumbnail URL for every promotion video via oEmbed
# (works for unlisted videos when the hash is included) and bake it into
# lib/promos.js as a third element: [entryIdx, vimeoPath, thumbUrl].
# Resumable: results cached in scripts/out/vthumbs.json.
import io, json, os, re, ssl, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# the office network TLS-intercepts outbound HTTPS; python doesn't trust the
# proxy root, so skip verification for this build-time metadata fetch
SSL_CTX = ssl._create_unverified_context()

HERE = os.path.dirname(__file__)
PROMOS_JS = os.path.join(HERE, "..", "lib", "promos.js")
CACHE = os.path.join(HERE, "out", "vthumbs.json")

src = io.open(PROMOS_JS, encoding="utf-8").read()
m = re.search(r"export const PROMOS = (\{.*\});", src, re.S)
promos = json.loads(m.group(1))

paths = sorted({p[1] for arr in promos.values() for p in arr})
cache = {}
if os.path.exists(CACHE):
    cache = json.load(io.open(CACHE, encoding="utf-8"))
todo = [p for p in paths if p not in cache]
print("videos:", len(paths), "| cached:", len(paths) - len(todo), "| to fetch:", len(todo))

def fetch(path):
    url = "https://vimeo.com/api/oembed.json?url=" + urllib.parse.quote("https://vimeo.com/" + path, safe="")
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Equireel-site-build/1.0 (info@equireel.com)"})
            with urllib.request.urlopen(req, timeout=20, context=SSL_CTX) as r:
                j = json.loads(r.read().decode("utf-8"))
            t = j.get("thumbnail_url") or ""
            # request a placard-sized variant
            t = re.sub(r"-d_\d+x\d+", "-d_640", t)
            return path, t or None
        except Exception as e:
            code = getattr(e, "code", None)
            if code == 429:
                time.sleep(10 * (attempt + 1)); continue
            if attempt == 2: return path, None
            time.sleep(2)
    return path, None

done = 0
with ThreadPoolExecutor(max_workers=6) as ex:
    futs = [ex.submit(fetch, p) for p in todo]
    for f in as_completed(futs):
        path, t = f.result()
        cache[path] = t
        done += 1
        if done % 200 == 0:
            json.dump(cache, io.open(CACHE, "w", encoding="utf-8"))
            print("fetched", done, "/", len(todo))
json.dump(cache, io.open(CACHE, "w", encoding="utf-8"))

ok = sum(1 for v in cache.values() if v)
print("thumbnails resolved:", ok, "/", len(paths))

out = {ev: [[p[0], p[1], cache.get(p[1])] for p in arr] for ev, arr in promos.items()}
js = ("/* Free winner (promotion) videos per event: [entryIdx, vimeoPath, thumbUrl].\n"
      "   Real videos + their real thumbnails via Vimeo oEmbed.\n"
      "   Regenerate: python scripts/gen_promos.py && python scripts/fetch_vthumbs.py */\n\n"
      "export const PROMOS = " + json.dumps(out, separators=(",", ":")) + ";\n")
io.open(PROMOS_JS, "w", encoding="utf-8", newline="\n").write(js)
print("wrote lib/promos.js with thumbnails")

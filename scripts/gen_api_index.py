# Emit api/_events-index.json — the server-side price/name authority for the
# checkout API. Regenerate whenever lib/events-real.js changes (gen_catalog.py).
import io, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
js = io.open(os.path.join(ROOT, "lib", "events-real.js"), encoding="utf-8").read()

idx = {}
for m in re.finditer(r'\{ id: "([^"]+)".*?country: "([^"]+)", name: "([^"]+)".*?date: "([^"]+)".*?price: (\d+), priceSJ: (\d+)', js):
    eid, country, name, date, p, psj = m.groups()
    idx[eid] = {"c": country, "n": name, "y": date[:4], "p": int(p), "sj": int(psj)}

out = os.path.join(ROOT, "api", "_events-index.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(idx, io.open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"wrote api/_events-index.json: {len(idx)} events")

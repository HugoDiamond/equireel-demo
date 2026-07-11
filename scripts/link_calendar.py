# Auto-link the filming calendar to the shop: when an event on
# filming_calendar has a matching event in the site catalogue (entries live),
# fill site_slug so the public /calendar page flips its row from "Notify me"
# to "Find your horse" — no human step. Runs after gen_catalog in
# catalog_refresh.ps1; safe to run any time (idempotent, fills NULLs only).
import io, os, re, sys, datetime

try:
    import truststore; truststore.inject_into_ssl()
except ImportError:
    pass
import psycopg2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EVENTS_JS = os.path.join(ROOT, "lib", "events-real.js")
PLATFORM_ENV = r"C:\Users\Equireel 1\Documents\equireel_clean\xc-start-times\.env"

url = os.environ.get("DATABASE_URL")
if not url and os.path.exists(PLATFORM_ENV):
    for line in io.open(PLATFORM_ENV, encoding="utf-8-sig"):
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip(); break
if not url:
    print("FATAL: no DATABASE_URL"); sys.exit(1)

STOP = {"the", "at", "of", "and", "horse", "trials", "trial", "international",
        "one", "day", "event", "ode", "pony", "club", "hunter", "equestrian",
        "centre", "center", "park", "farm", "house", "test"}

def toks(name):
    t = re.sub(r"[^a-z0-9 ]", " ", (name or "").lower()).split()
    return {w for w in t if w not in STOP and not w.isdigit()}

js = io.open(EVENTS_JS, encoding="utf-8").read()
site = []  # (slug, tokens, date, dateEnd)
for m in re.finditer(r'\{ id: "([^"]+)".*?name: "([^"]*)".*?date: "([^"]+)"(?:, dateEnd: "([^"]+)")?', js):
    site.append((m.group(1), toks(m.group(2)), m.group(3), m.group(4) or m.group(3)))

conn = psycopg2.connect(url); conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT id, event_name, start_date, end_date FROM filming_calendar WHERE site_slug IS NULL")
rows = cur.fetchall()
linked = 0
for cal_id, name, start, end in rows:
    want = toks(name)
    if not want:
        continue
    lo = (start - datetime.timedelta(days=3)).isoformat()
    hi = ((end or start) + datetime.timedelta(days=3)).isoformat()
    best, best_ov = None, 0.0
    for slug, have, d, de in site:
        if not (lo <= d <= hi or lo <= de <= hi):
            continue
        if not have:
            continue
        ov = len(want & have) / min(len(want), len(have))
        if ov > best_ov:
            best, best_ov = slug, ov
    if best and best_ov >= 0.6:
        cur.execute("UPDATE filming_calendar SET site_slug=%s WHERE id=%s", (best, cal_id))
        linked += 1
        print(f"  linked: {name!r} -> {best} ({best_ov:.0%})")

print(f"calendar rows unlinked: {len(rows)} | newly linked: {linked}")
cur.close(); conn.close()

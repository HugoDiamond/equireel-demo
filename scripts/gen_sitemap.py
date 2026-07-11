# Emit public/sitemap.xml — static pages + every event page.
# Regenerate after gen_catalog.py adds events (catalog_refresh runs both).
import io, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = "https://equireel-demo.vercel.app"  # update at domain cut-over

js = io.open(os.path.join(ROOT, "lib", "events-real.js"), encoding="utf-8").read()
events = re.findall(r'\{ id: "([^"]+)".*?date: "([^"]+)"', js)

urls = [(SITE + "/", "1.0"), (SITE + "/calendar", "0.9"), (SITE + "/gift-vouchers", "0.8"),
        (SITE + "/faq", "0.8"), (SITE + "/careers", "0.4"),
        (SITE + "/terms", "0.3"), (SITE + "/privacy", "0.3")]
for c in ("gb", "ie", "us", "fr", "be"):
    urls.append((SITE + "/events?country=" + c, "0.9"))
for eid, date in events:
    urls.append((SITE + "/event?id=" + eid, "0.7"))

out = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u, pr in urls:
    out.append(f"  <url><loc>{u.replace('&', '&amp;')}</loc><priority>{pr}</priority></url>")
out.append("</urlset>")

io.open(os.path.join(ROOT, "public", "sitemap.xml"), "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print(f"sitemap.xml: {len(urls)} urls")

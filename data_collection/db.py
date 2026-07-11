"""One place to open the platform DB. DATABASE_URL from the environment,
falling back to a local .env beside this package (gitignored)."""

import os

try:  # office AV intercepts TLS; harmless elsewhere
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

import psycopg2


def _load_dotenv():
    path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def connect():
    _load_dotenv()
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set (env or data_collection/.env)")
    return psycopg2.connect(url)


# --- cloud-safe key/value state (collection_state table) -------------------
# Runners are ephemeral (GitHub Actions); nothing may live on local disk.

def state_get(cur, key, default=None):
    cur.execute("SELECT value FROM collection_state WHERE key=%s", (key,))
    row = cur.fetchone()
    return row[0] if row else default


def state_set(cur, key, value):
    import json
    cur.execute("""INSERT INTO collection_state (key, value, updated_at)
                   VALUES (%s, %s::jsonb, now())
                   ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()""",
                (key, json.dumps(value)))

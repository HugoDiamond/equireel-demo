"""Self-healing groundwork: raw snapshot archiving (fetch/parse decoupled —
a broken parser never loses data) + contract checks (breakage is loud,
never silent garbage). The LLM repair loop plugs in on top of these."""

import json
import os
from datetime import date

from .config import SNAPSHOT_DIR

_STATE = os.path.join(os.path.dirname(__file__), SNAPSHOT_DIR, "_counts.json")


def snapshot(source, name, payload):
    """Archive the raw fetch before any parsing. Local dir for now; B2 in prod."""
    d = os.path.join(os.path.dirname(__file__), SNAPSHOT_DIR, date.today().isoformat())
    os.makedirs(d, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in str(name))[:80]
    path = os.path.join(d, f"{source}-{safe}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    return path


class ContractError(Exception):
    pass


def check_rows(source, kind, rows, required_keys, min_expected=0):
    """Schema + sanity + count-vs-history. Raises loudly on breakage."""
    if not isinstance(rows, list):
        raise ContractError(f"{source}/{kind}: expected list, got {type(rows).__name__}")
    for i, r in enumerate(rows[:200]):
        missing = [k for k in required_keys if r.get(k) in (None, "")]
        if missing:
            raise ContractError(f"{source}/{kind}: row {i} missing {missing}: {r}")
    # count vs history: alert if today's haul collapses vs the last run
    hist = {}
    if os.path.exists(_STATE):
        hist = json.load(open(_STATE, encoding="utf-8"))
    key = f"{source}/{kind}"
    last = hist.get(key, 0)
    if last and len(rows) < max(min_expected, last * 0.3):
        raise ContractError(f"{source}/{kind}: {len(rows)} rows vs {last} last run — structural break?")
    hist[key] = max(len(rows), last if len(rows) == 0 else len(rows))
    os.makedirs(os.path.dirname(_STATE), exist_ok=True)
    json.dump(hist, open(_STATE, "w", encoding="utf-8"))
    return rows

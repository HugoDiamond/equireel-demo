"""Eventing Ireland public JSON API — no auth, no scraping.
Base verified live 2026-07-11. Class results populate once day-of scoring
goes live; pre-event drawn times sit behind the member portal (EI login on
Mike's decision list)."""

import requests

BASE = "https://api.eventingireland.com/public"
H = {"User-Agent": "Mozilla/5.0 (Equireel data collection; info@equireel.com)"}


def _get(path, **params):
    r = requests.get(BASE + path, params=params or None, headers=H, timeout=40)
    r.raise_for_status()
    return r.json()


def list_events(when="future", limit=200):
    """-> [{ref, name, start, end, venue, entries, kind}] (dates ISO yyyy-mm-dd)."""
    d = _get("/event/search", limit=limit, when=when, type="default")
    out = []
    for e in d.get("records", []):
        out.append({
            "ref": e["id"],
            "name": (e.get("name") or "").strip(),
            "start": (e.get("startdate") or "")[:10],
            "end": (e.get("eventenddate") or "")[:10] or None,
            "venue": (e.get("venue_name") or "").strip() or None,
            "entries": e.get("numentries"),
            "kind": e.get("eventtype_name"),
        })
    return out


def event_classes(event_id):
    """-> [{class_id, class_name, entries}] (record.Eventclasses, verified live)"""
    d = _get(f"/event/id/{event_id}")
    recs = (d.get("record") or {}).get("Eventclasses") or []
    out = []
    for c in recs:
        if c.get("id") is None:
            continue
        out.append({
            "class_id": c["id"],
            "class_name": (c.get("classtype_name") or "").strip(),
            "entries": c.get("numentries"),
        })
    return out


def _num(v):
    """EI sends '-' pre-scoring and numbers as strings."""
    if v in (None, "", "-"):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _mmss(v):
    """'4:50' -> 290 seconds."""
    if not v or ":" not in str(v):
        return None
    try:
        m, s = str(v).split(":", 1)
        return int(m) * 60 + int(s)
    except ValueError:
        return None


def class_results(class_id):
    """-> entry/result rows. NOTE (verified live): this endpoint returns the
    ENTRY LIST as soon as entries close (scores '-'/0 until scoring runs),
    so EI entries are available PRE-event — better than the research memo."""
    d = _get(f"/event/class/results/{class_id}")
    out = []
    for r in d.get("records") or []:
        # 'place' carries elimination codes (EL/DNS/HC/RET/WD) for non-finishers
        place = str(r.get("place") or "").strip()
        position = int(place) if place.isdigit() and place != "0" else None
        code = None if (position or not place or place == "0") else place
        out.append({
            "bib": r.get("compnum"),
            "horse": (r.get("horsename") or "").strip(),
            "rider": (r.get("ridername") or "").strip(),
            "section": (r.get("classname") or "").strip() or None,
            "position": position,
            "status_code": (r.get("xcstatus") or "").strip() or code or None,
            "dressage_score": _num(r.get("drscore")),
            "sj_penalties": _num(r.get("sjjumppen")),
            "xc_penalties": _num(r.get("xcjumppen")),
            "xc_time_penalties": _num(r.get("xctimepen")),
            "total_score": _num(r.get("totalscore")),
            "optimum_xc_time": _mmss(r.get("xcoptimumtime")),
            "external_id": r.get("resultid"),
            "_raw": r,
        })
    return out

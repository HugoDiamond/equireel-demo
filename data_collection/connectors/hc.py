"""Horses & Competitions public JSON API — dominant French CCE organiser
platform (Boulerie Jump, Jardy, PEC...). No auth, no Cloudflare. Carries the
FFE concours number (federation_number) AND validated XC start times
(timetable endpoint) — the only feed with digital scheduled times today.
Base verified live 2026-07-11."""

import requests

BASE = "https://api.horses-and-competitions.com/fr/api/v1"
H = {"User-Agent": "Mozilla/5.0 (Equireel data collection; info@equireel.com)"}


def _get(path, **params):
    r = requests.get(BASE + path, params=params or None, headers=H, timeout=40)
    r.raise_for_status()
    return r.json()


def list_events():
    """-> [{ref, name, start, end, organiser, city, federation_number}] (CCE only)."""
    out = []
    for e in _get("/events", type="cce"):
        if e.get("type") != "cce":
            continue
        org = e.get("organizer") or {}
        loc = org.get("location") or {}
        out.append({
            "ref": e["id"],
            "name": (e.get("name") or "").strip(),
            "start": (e.get("date") or {}).get("start"),
            "end": (e.get("date") or {}).get("end"),
            "organiser": (org.get("name") or "").strip() or None,
            "city": loc.get("city"),
            "federation_number": e.get("federation_number"),
            "status": e.get("status"),
        })
    return out


def event_detail(event_id):
    return _get(f"/event/{event_id}")


def shows(event_id):
    """-> [{show, name, day, entries, live}] — one 'show' per class/épreuve.
    Verified live: detail['shows'] is a dict keyed by date, each a list."""
    d = event_detail(event_id)
    recs = d.get("shows") or {}
    if isinstance(recs, dict):
        flat = [s for day in sorted(recs) for s in recs[day]]
    else:
        flat = recs
    out = []
    for s in flat:
        if s.get("id") is None:
            continue
        out.append({"show": s["id"], "name": (s.get("name") or "").strip(),
                    "day": s.get("date"), "entries": s.get("entries"),
                    "live": s.get("live"), "_raw": s})
    return out


def ranking(event_id, show):
    """Startlist/results rows: bib, rider, horse, CCE phase scores."""
    d = _get(f"/event/{event_id}/show/{show}/ranking")
    recs = d.get("ranking") or []
    out = []
    for r in recs:
        rider = r.get("rider") or {}
        horse = r.get("horse") or {}
        name = " ".join(x for x in (rider.get("firstname"), rider.get("lastname")) if x).strip()
        rank = r.get("rank")
        total = (r.get("result") or {}).get("total")
        out.append({
            "bib": r.get("bib") or r.get("bib_ffe"),
            "rider": name,
            "horse": (horse.get("name") or "").strip(),
            "position": int(rank) if str(rank or "").isdigit() else None,
            "total_score": float(total) if str(total or "").replace(".", "", 1).isdigit() else None,
            # _raw keeps pedigree (pere/mere), club, nation — horse-profile fuel
            "_raw": r,
        })
    return out


def timetable(event_id, show, date, zone):
    """Validated cross start times for a show/day/zone."""
    return _get(f"/event/{event_id}/show/{show}/timetable/{date}/{zone}")

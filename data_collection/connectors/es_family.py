"""EventingScores-family CALENDAR discovery — three byte-identical
deployments (eventingscores.co.uk = BE + unaffiliated incl. Cotswold Cup;
ponyclubresults.co.uk = UKPC; horse-events-results.co.uk = Horse-Events).
Deep collection (entries/times/results) stays with the existing
unified_scraper — this module only feeds discovery. Verified 2026-07-11."""

import requests

H = {"User-Agent": "Mozilla/5.0 (Equireel data collection; info@equireel.com)"}


def list_events(domain):
    """-> [{ref, name, start, end, be_affiliated, abandoned}]"""
    r = requests.get(f"https://{domain}/uploads/calendar_cards.json", headers=H, timeout=40)
    r.raise_for_status()
    d = r.json()
    out = []
    for e in d.get("calendar", []):
        if (e.get("hide_calendar_yn") or "N") == "Y":
            continue
        out.append({
            "ref": e["id"],
            "name": (e.get("eventname") or "").strip(),
            "start": e.get("startdate"),
            "end": e.get("enddate") or None,
            "be_affiliated": (e.get("be_affiliated") or "N") == "Y",
            "abandoned": (e.get("abandoned_yn") or "N") == "Y",
            # cards carry no venue NAME, but fid_venue disambiguates
            # same-named events (generic PC qualifier names) per venue
            "venue_key": f"{domain}-venue-{e['fid_venue']}" if e.get("fid_venue") else None,
        })
    return out

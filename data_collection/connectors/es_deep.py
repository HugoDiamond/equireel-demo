"""EventingScores-family DEEP collection — entries, sections and results for
the three byte-identical deployments (eventingscores.co.uk = BE +
unaffiliated, ponyclubresults.co.uk = UKPC, horse-events-results.co.uk).

Discovered 2026-07-11: the "scraper target" is really a JSON gateway —
POST /ajax/publicGateway.php with:
  {Action: "getEntryList",       fid_competition: N}                -> entry JSON
  {Action: "JEvent",             fid_competition: N, options: ...}  -> event/sections/timetable JSON
  {Action: "getSectionResults",  fid_competition: N, section: "A"}  -> {html: scoreboard table}
Only the results table is HTML; everything else is structured JSON.
"""

import datetime
import re
import time

import requests

H = {"User-Agent": "Mozilla/5.0 (Equireel data collection; info@equireel.com)"}


def _gw(domain, data):
    time.sleep(0.5)  # this gateway powers live scoring — be polite
    # the bare domain 301s to www., and requests turns a redirected POST into
    # a GET (dropping the payload) — always hit the www host directly
    host = domain if domain.startswith("www.") else "www." + domain
    r = requests.post(f"https://{host}/ajax/publicGateway.php", data=data,
                      headers=H, timeout=60)
    r.raise_for_status()
    return r


def entries(domain, es_id):
    """-> [{bib, horse, rider, section, status, class_date, external_id}]
    section = "<class_name> Section <letter>" to match the site's convention."""
    d = _gw(domain, {"Action": "getEntryList", "fid_competition": es_id}).json()
    out = []
    for e in d or []:
        letter = (e.get("section_name") or "").strip()
        cls = (e.get("class_name") or "").strip()
        out.append({
            "bib": e.get("bridle_number"),
            "horse": (e.get("horse") or "").strip().title(),
            "rider": (e.get("rider") or "").strip(),
            "section": (cls + (f" Section {letter}" if letter else "")).strip() or None,
            "status_code": None if (e.get("status") or "") == "accepted" else (e.get("status") or None),
            "class_date": e.get("class_date"),
            "external_id": e.get("idhtrunner"),
            "_raw": e,
        })
    return out


def event_info(domain, es_id):
    """Event meta + timetable (scheduled phase blocks per section)."""
    d = _gw(domain, {"Action": "JEvent", "fid_competition": es_id,
                     "options": "ignore,sections,timetable"}).json()
    return d


def scheduled_starts(domain, es_id, phase_match=("cross", "xc")):
    """Per-section scheduled phase starts from the JEvent timetable.
    -> [{section_letter, start (datetime str), interval_min}]
    Per-rider times are derived by the caller (section start + running-order
    index * interval); v1 ignores mid-phase breaks — still a strong prior."""
    d = _gw(domain, {"Action": "JEvent", "fid_competition": es_id,
                     "options": "ignore,timetable"}).json()
    out = []
    blocks = (d.get("timetable") or {}).get("blocks") or {}
    for b in blocks.values():
        for s in (b.get("sections") or {}).values():
            for p in (s.get("phases") or {}).values():
                label = (p.get("phase_label") or p.get("phase_name") or "").lower()
                if not any(k in label for k in phase_match):
                    continue
                start = p.get("start_time")
                iv = p.get("phase_interval") or "00:03:00"
                try:
                    h, m, sec = (int(x) for x in iv.split(":"))
                    interval_min = h * 60 + m + sec / 60
                except ValueError:
                    interval_min = 3
                if start:
                    out.append({"section_letter": (s.get("section_name") or "").strip(),
                                "start": start, "interval_min": interval_min})
    return out


_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def running_to_time(domain, es_id, year):
    """OFFICIAL actual XC start times, from the running-to-time exporter
    (found by David 2026-07-13): /exporter/running_to_time.php?eventid=N.
    One <h3>Running to Time - XC on Day, Nth Mon</h3> + table per XC day;
    runner cell is '<section letter><bib> Rider Name', Started/Scored cell
    is HH:MM (minute precision, empty for non-starters).
    -> [{"bib": str, "actual": datetime}]"""
    host = domain if domain.startswith("www.") else "www." + domain
    r = requests.get(f"https://{host}/exporter/running_to_time.php?eventid={es_id}",
                     headers=H, timeout=60)
    if r.status_code != 200 or "Running to Time" not in r.text:
        return []
    out = []
    for part in re.split(r"Running to Time - ", r.text)[1:]:
        m = re.match(r"XC on \w+, (\d+)(?:st|nd|rd|th)? (\w+)", part)
        if not m:
            continue  # SJ/dressage tables — not ours
        month = _MONTHS.get(m.group(2)[:3].lower())
        if not month:
            continue
        day = datetime.date(year, month, int(m.group(1)))
        for tr in re.finditer(
                r"<tr><td[^>]*>[A-Za-z]+(\d+)\s[^<]*</td><td>[^<]*</td><td>(\d{1,2}):(\d{2})</td>",
                part):
            out.append({"bib": tr.group(1),
                        "actual": datetime.datetime.combine(
                            day, datetime.time(int(tr.group(2)), int(tr.group(3))))})
    return out


def section_letters(domain, es_id):
    return sorted({(e.get("section") or "").split("Section ")[-1].strip()
                   for e in entries(domain, es_id) if e.get("section")})


def section_results(domain, es_id, letter):
    """Parse the scoreboard HTML table -> result rows.
    Columns present vary by event; matched by header names."""
    from bs4 import BeautifulSoup
    d = _gw(domain, {"Action": "getSectionResults", "fid_competition": es_id,
                     "section": letter}).json()
    html = (d or {}).get("html") or ""
    if "<table" not in html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    heads = [th.get_text(" ", strip=True) or (th.get("data-fieldname") or "")
             for th in table.find_all("th")]

    def col(*names):
        for n in names:
            for i, h in enumerate(heads):
                if h.lower() == n.lower():
                    return i
        return None

    iN, iR, iH = col("No"), col("Rider"), col("Horse")
    iD, iSJ, iXC = col("Dressage"), col("Show Jumping", "SJ"), col("Cross Country", "XC")
    iT, iP = col("Total", "Score"), col("Place", "Pos", "Position")

    def num(s):
        s = re.sub(r"[^\d.]", "", s or "")
        try:
            return float(s) if s else None
        except ValueError:
            return None

    out = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 3:
            continue
        cells = [td.get_text(" ", strip=True) for td in tds]
        get = lambda i: cells[i] if i is not None and i < len(cells) else None
        bib = get(iN)
        if not bib or not re.match(r"^\d+", bib):
            continue
        status = None
        rowtext = " ".join(cells).upper()
        for code in ("WD", "W/D", "RET", "E ", "ELIM", "HC", "ABANDON"):
            if re.search(r"\b" + code.strip() + r"\b", rowtext):
                status = code.strip()
                break
        out.append({
            "bib": re.match(r"^\d+", bib).group(0),
            "rider": get(iR), "horse": (get(iH) or "").title() or None,
            "dressage_score": num(get(iD)),
            "sj_penalties": num(get(iSJ)),
            "xc_penalties": num(get(iXC)),
            "total_score": num(get(iT)),
            "position": int(re.sub(r"\D", "", get(iP) or "") or 0) or None,
            "status_code": status,
        })
    return out

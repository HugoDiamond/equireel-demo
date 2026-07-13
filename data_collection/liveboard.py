"""Fence-level XC capture — the day-of live-board poller.

The EventingScores live XC board is a rolling window (last ~10 starters)
that is overwritten all day and never archived in full. This poller is the
logbook the board never had: armed by the filming calendar, it polls each
filmed event's board through cross-country day, merges the windows, and
persists per-horse fence maps permanently:

  results.xc_penalty_details  <- JSON {"fences": {"5": "penalties", ...},
                                 "xct": "20/05:12", "first_seen": iso-ts}
  results.fence_penalties     <- count of penalised fences
  results.xc_elapsed_time     <- mm:ss from the board's XCT cell
  results.xc_start_time       <- ONLY when we caught the horse at fence 1-2
                                 (tight bound), via the 'timing' rung

Run:  python -m data_collection.liveboard [--once] [--date YYYY-MM-DD]
Scheduled daily (equireel-liveboard); exits at once when no filmed
ES-referenced event is running today.
"""

import datetime
import json
import re
import sys
import time

import psycopg2
import requests

from . import config
from .contracts import snapshot
from .db import connect
from .funnel import upsert_actual

H = {"User-Agent": "Mozilla/5.0 (Equireel data collection; info@equireel.com)"}
POLL_SECONDS = 60  # actual-start accuracy = one poll interval; editing needs tight
END_OF_DAY = datetime.time(19, 30)
DEFINITE = {"clear", "penalties", "ended", "refusal", "fall", "eliminated", "retired"}


def targets(cur, today):
    """Filmed events running today that carry an ES-family ref."""
    cur.execute("""
        SELECT DISTINCT fc.event_id, r.external_ref, fc.event_name
        FROM filming_calendar fc
        JOIN event_feed_refs r ON r.event_id = fc.event_id AND r.source = 'ES-CAL'
        WHERE fc.start_date <= %s AND COALESCE(fc.end_date, fc.start_date) >= %s
    """, (today, today))
    out = []
    for event_id, ext, name in cur.fetchall():
        domain, es_id = ext.split("#", 1)
        host = domain if domain.startswith("www.") else "www." + domain
        out.append((event_id, host, es_id, name, ext))
    return out


def fetch_board(host, es_id):
    url = f"https://{host}/uploads/events/{es_id}/live_xc_{es_id}.html"
    r = requests.get(url, headers=H, timeout=30)
    if r.status_code != 200 or "liveCell" not in r.text:
        return None
    return r.text


def parse_board(html):
    """-> [{bib, horse, cells: {fence: state}, pens: {fence: value}, xct}]

    Cells are walked positionally (bare liveCell tds included) so fence
    indices can never drift, and a penalties cell's inner text — the actual
    penalty value (20 refusal, 11 frangible pin, 60 third refusal) — is
    kept, not just the red flag."""
    fences = re.findall(r"<th>(\d+)</th>", html)
    rows = []
    for m in re.finditer(r"<tr><td>(\d+)</td><td>([^<]+)</td>(.*?)</tr>", html, re.S):
        cells, pens = {}, {}
        for i, c in enumerate(re.finditer(r"<td class='liveCell ?([\w-]*)'>([^<]*)</td>",
                                          m.group(3))):
            if i >= len(fences):
                break
            state, inner = c.group(1), c.group(2).strip()
            if state:
                cells[fences[i]] = state
                if state == "penalties" and inner.replace(".", "", 1).isdigit():
                    pens[fences[i]] = float(inner) if "." in inner else int(inner)
        xct = re.search(r"text-center'>([^<]+)<", m.group(3))
        rows.append({"bib": m.group(1), "horse": m.group(2).strip(), "cells": cells,
                     "pens": pens, "xct": xct.group(1).strip() if xct else None})
    return rows


def seed_from_db(cur, state, event_id, bib, now_iso):
    """Stateless across restarts and runners: a horse we haven't got in
    memory is seeded from its stored fence map, so a runner picking up
    mid-day (GitHub Actions job handover, crash recovery) continues
    exactly where the previous one stopped."""
    key = (event_id, bib)
    if key in state:
        return
    cur.execute("SELECT xc_penalty_details FROM results WHERE event_id=%s AND bib_number=%s",
                (event_id, bib))
    row = cur.fetchone()
    stored = {}
    if row and row[0]:
        try:
            stored = json.loads(row[0])
        except (ValueError, TypeError):
            stored = {}
    if stored.get("source") == "es_liveboard":
        state[key] = {"fences": stored.get("fences", {}), "xct": stored.get("xct"),
                      "pen_values": stored.get("penalty_values", {}),
                      "first_seen": stored.get("first_seen", now_iso),
                      "first_seen_progress": stored.get("first_seen_progress"),
                      "last_seen": stored.get("last_seen", stored.get("first_seen")),
                      "dirty": False}


def merge(state, event_id, rows, now_iso, first_tick=False):
    for r in rows:
        key = (event_id, r["bib"])
        was_tracked = key in state
        # a rider first seen on the run's FIRST poll may be stale frozen-board
        # content (yesterday's final window) — never derive a start time from
        # that sighting. From tick 2 on, a new bib is a genuine appearance.
        rec = state.setdefault(key, {"fences": {}, "xct": None, "first_seen": now_iso,
                                     "first_seen_progress": None if first_tick
                                     else len(r["cells"]),
                                     "last_seen": None, "dirty": True})
        for fence, cell in r["cells"].items():
            prev = rec["fences"].get(fence)
            # definite states win; latest definite wins (judges correct scores)
            if cell in DEFINITE or prev is None or prev == "assumedclear":
                if cell != "galloping" and prev != cell:
                    rec["fences"][fence] = cell
                    rec["dirty"] = True
                    # judges corrected a penalty away — drop its stale value
                    if cell != "penalties":
                        rec.get("pen_values", {}).pop(fence, None)
        for fence, val in r.get("pens", {}).items():
            # numeric penalty at that fence; latest board value wins
            if rec.setdefault("pen_values", {}).get(fence) != val:
                rec["pen_values"][fence] = val
                rec["dirty"] = True
        if r["xct"] and was_tracked and not rec.get("xct"):
            # we WITNESSED the transition to finished: finish ~= now (within
            # one poll), so actual start ~= now - elapsed. Only valid when
            # the horse was seen RECENTLY without a finish time — a stale
            # record (runner was down a while) proves nothing.
            recent = False
            if rec.get("last_seen"):
                try:
                    gap = (datetime.datetime.fromisoformat(now_iso)
                           - datetime.datetime.fromisoformat(rec["last_seen"])).total_seconds()
                    recent = gap <= POLL_SECONDS * 4
                except ValueError:
                    pass
            if recent:
                rec["finish_seen"] = now_iso
                rec["dirty"] = True
        if r["xct"] and rec.get("xct") != r["xct"]:
            rec["xct"] = r["xct"]
            rec["dirty"] = True
        rec["last_seen"] = now_iso


def _mmss_seconds(t):
    try:
        parts = [int(x) for x in t.strip().split(":")]
        return parts[0] * 60 + parts[1] if len(parts) == 2 else None
    except (ValueError, AttributeError):
        return None


def persist(cur, state, poll_started):
    """Write changed horses only, in deterministic key order. Ordering matters:
    a second poller (PC fallback) writing the same rows in a different order
    is a deadlock; same order is just a brief wait. Dirty-only writes keep the
    transaction small so lock waits stay under the statement timeout."""
    written = []
    for (event_id, bib), rec in sorted(state.items()):
        if not rec.get("dirty"):
            continue
        pens = sum(1 for s in rec["fences"].values() if s == "penalties")
        elapsed = None
        if rec["xct"] and "/" in rec["xct"]:
            elapsed = rec["xct"].split("/", 1)[1].strip()
        detail = json.dumps({"fences": rec["fences"], "xct": rec["xct"],
                             "penalty_values": rec.get("pen_values", {}),
                             "first_seen": rec["first_seen"],
                             "first_seen_progress": rec.get("first_seen_progress"),
                             "last_seen": rec.get("last_seen"),
                             "source": "es_liveboard"})
        # never overwrite the manual scraper's official fence record — its
        # text format ("Fence 5B: 1 Refusal") is richer than board states.
        # We only write over our own JSON ('{...') or an empty field.
        cur.execute("""UPDATE results SET xc_penalty_details=%s, fence_penalties=%s,
                              xc_elapsed_time=COALESCE(%s, xc_elapsed_time)
                       WHERE event_id=%s AND bib_number=%s
                         AND (xc_penalty_details IS NULL OR xc_penalty_details LIKE '{%%')""",
                    (detail, pens, elapsed, event_id, bib))
        written.append((event_id, bib))

        # ACTUAL start time (editing-essential), two derivations, 'timing' rung:
        #  a) caught leaving the box: first sighting with <=2 fences progressed
        #  b) derived from finish: start = first-finish-sighting - elapsed
        # both accurate to ~one poll interval; sheet-OCR/manual still outrank.
        actual = None
        fsp = rec.get("first_seen_progress")
        if fsp is not None and fsp <= 2:
            actual = datetime.datetime.fromisoformat(rec["first_seen"])
        elif rec.get("finish_seen") and elapsed:
            secs = _mmss_seconds(elapsed)
            if secs:
                actual = (datetime.datetime.fromisoformat(rec["finish_seen"])
                          - datetime.timedelta(seconds=secs))
        if actual and poll_started:
            upsert_actual(cur, event_id, [{"bib": bib, "actual": actual}], "timing")
    return written


def main():
    if config.ES_MANUAL_MODE and "--force" not in sys.argv:
        print("ES_MANUAL_MODE: manual scrapers own filmed ES events — liveboard off (--force overrides)")
        return
    once = "--once" in sys.argv
    today = datetime.date.today()
    if "--date" in sys.argv:
        today = datetime.date.fromisoformat(sys.argv[sys.argv.index("--date") + 1])
    end_of_day = END_OF_DAY
    if "--until" in sys.argv:  # cloud runners split the day into shifts
        h, m = sys.argv[sys.argv.index("--until") + 1].split(":")
        end_of_day = datetime.time(int(h), int(m))

    conn = connect()
    cur = conn.cursor()
    # a write blocked by a concurrent poller cancels quickly and is retried
    # next tick, instead of stalling into the pooler's own timeout
    cur.execute("SET statement_timeout = '30s'")
    conn.commit()
    tgts = targets(cur, today)
    if not tgts:
        print(f"{today}: no filmed ES events running — exiting")
        return
    print(f"{today}: polling {len(tgts)} event(s): {[t[3] for t in tgts]}")

    state = {}
    poll_started = datetime.datetime.now()
    first_tick = True
    while True:
        now_iso = datetime.datetime.now().isoformat(timespec="seconds")
        for event_id, host, es_id, name, ext in tgts:
            try:
                html = fetch_board(host, es_id)
            except Exception as e:
                print(f"  !! {name}: {e}")
                continue
            if not html:
                continue
            snapshot("ES-LIVE", f"{es_id}-{now_iso.replace(':', '')}", html)
            rows = parse_board(html)
            for r in rows:
                seed_from_db(cur, state, event_id, r["bib"], now_iso)
            merge(state, event_id, rows, now_iso, first_tick)
        first_tick = False
        # a failed persist (deadlock/lock timeout vs a concurrent poller) must
        # never kill the shift: roll back, keep rows dirty, retry next tick —
        # the merged in-memory state loses nothing.
        try:
            written = persist(cur, state, poll_started)
            conn.commit()
            for k in written:
                state[k]["dirty"] = False
            print(f"  {now_iso}: tracking {len(state)} horses, {len(written)} rows updated")
        except psycopg2.Error as e:
            conn.rollback()
            print(f"  !! persist deferred to next tick: {type(e).__name__}")
        if once or datetime.datetime.now().time() >= end_of_day:
            break
        time.sleep(POLL_SECONDS)

    # END-OF-SHIFT RESULTS SWEEP — editing starts the same evening, so today's
    # final results/placings must land tonight, not at tomorrow's morning run.
    if not once:
        from .collect import collect_es
        for event_id, host, es_id, name, ext in tgts:
            try:
                new, res = collect_es(cur, event_id, ext)
                conn.commit()
                print(f"  evening sweep {name}: +{new} entries, {res} results rows")
            except Exception as e:
                conn.rollback()
                print(f"  !! evening sweep {name}: {e}")

    cur.close()
    conn.close()
    print("done")


if __name__ == "__main__":
    main()

"""Deep collection: entries + results (+ times where the feed has them)
for events at coverage_status to_film/filmed (and, with WIDE_ENTRIES, for
discovered events too) that carry an EI, H&C or EventingScores-family ref.

Run: python -m data_collection.collect [--event-id N] [--wide]
"""

import sys

from . import config
from .db import connect
from datetime import datetime, timedelta

from .connectors import ei, hc, es_deep
from .contracts import snapshot
from .funnel import upsert_actual, upsert_entries, upsert_results, upsert_scheduled


def collect_es(cur, event_id, ext_ref):
    """ext_ref format: '<domain>#<es event id>'"""
    # A manual unified_scraper import replaces this event's rows (its rows
    # carry source NULL). From then on the manual record owns the event —
    # defer rather than write ES data over it.
    cur.execute("SELECT 1 FROM results WHERE event_id=%s AND source IS NULL LIMIT 1",
                (event_id,))
    if cur.fetchone():
        print("    manually-scraped event — ES collector deferring")
        return 0, 0
    domain, es_id = ext_ref.split("#", 1)
    rows = es_deep.entries(domain, es_id)
    snapshot(config.SRC_ES, f"entries-{es_id}", [r["_raw"] for r in rows])
    total_new = total_res = 0
    if rows:
        created, _ = upsert_entries(cur, event_id, rows, config.SRC_ES)
        total_new += created
    # results per section (post/during event; harmless empty before)
    letters = sorted({(r.get("_raw", {}).get("section_name") or "").strip()
                      for r in rows if r.get("_raw", {}).get("section_name")})
    for letter in letters:
        try:
            res = es_deep.section_results(domain, es_id, letter)
        except Exception as e:
            print(f"    !! section {letter}: {e}")
            continue
        if res:
            total_res += upsert_results(cur, event_id, res)

    # scheduled XC starts from the timetable: section phase start + running-
    # order index * interval (a plan — the funnel's scheduled phase may
    # overwrite freely; never touches actual xc_start_time)
    try:
        sched = es_deep.scheduled_starts(domain, es_id)
    except Exception as e:
        print(f"    !! timetable: {e}")
        sched = []
    n_sched = 0
    for s in sched:
        try:
            start = datetime.fromisoformat(s["start"])
        except ValueError:
            continue
        in_sec = sorted((r for r in rows
                         if (r.get("_raw", {}).get("section_name") or "").strip() == s["section_letter"]
                         and r.get("bib") is not None),
                        key=lambda r: int(r["bib"]))
        payload = [{"bib": r["bib"],
                    "scheduled": start + timedelta(minutes=i * s["interval_min"])}
                   for i, r in enumerate(in_sec)]
        n_sched += upsert_scheduled(cur, event_id, payload)
    if n_sched:
        print(f"    scheduled starts: {n_sched}")

    # OFFICIAL actual XC start times (running-to-time exporter, found by
    # David). Minute precision, but authoritative: the liveboard's
    # first-sighting runs systematically EARLY (the board lists riders
    # before they start — Aston validation showed up to ~2 min), so the
    # official record always overwrites 'timing' values. Same rank in the
    # ladder; manual/legacy stay protected as ever.
    cur.execute("SELECT event_date FROM events WHERE id=%s", (event_id,))
    row = cur.fetchone()
    year = (row[0].year if row and row[0] else datetime.now().year)
    try:
        rtt = es_deep.running_to_time(domain, es_id, year)
    except Exception as e:
        print(f"    !! running_to_time: {e}")
        rtt = []
    if rtt:
        snapshot(config.SRC_ES, f"rtt-{es_id}",
                 [{"bib": r["bib"], "actual": r["actual"].isoformat()} for r in rtt])
        wrote = upsert_actual(cur, event_id,
                              [{"bib": r["bib"], "actual": r["actual"]} for r in rtt],
                              "timing")
        print(f"    actual starts (official): {wrote}")
    return total_new, total_res


def collect_ei(cur, event_id, ext_ref):
    classes = ei.event_classes(ext_ref)
    snapshot(config.SRC_EI, f"classes-{ext_ref}", classes)
    total_new = total_res = 0
    for c in classes:
        rows = ei.class_results(c["class_id"])
        snapshot(config.SRC_EI, f"results-{ext_ref}-{c['class_id']}", [r["_raw"] for r in rows])
        if not rows:
            continue
        for r in rows:
            r["section"] = r.get("section") or c["class_name"]
        created, _ = upsert_entries(cur, event_id, rows, config.SRC_EI)
        total_new += created
        total_res += upsert_results(cur, event_id, rows)
    return total_new, total_res


def collect_hc(cur, event_id, ext_ref):
    shows = hc.shows(ext_ref)
    snapshot(config.SRC_HC, f"shows-{ext_ref}", [s["_raw"] for s in shows])
    total_new = total_res = 0
    for s in shows:
        try:
            rows = hc.ranking(ext_ref, s["show"])
        except Exception as e:  # a show 400s until the organiser publishes it
            print(f"    !! show {s['show']}: {e}")
            continue
        snapshot(config.SRC_HC, f"ranking-{ext_ref}-{s['show']}", [r["_raw"] for r in rows])
        if not rows:
            continue
        for r in rows:
            r["section"] = s["name"]
        created, _ = upsert_entries(cur, event_id, rows, config.SRC_HC)
        total_new += created
        total_res += upsert_results(cur, event_id, rows)
    return total_new, total_res


def main():
    only_event = None
    if "--event-id" in sys.argv:
        only_event = int(sys.argv[sys.argv.index("--event-id") + 1])
    wide = "--wide" in sys.argv or config.WIDE_ENTRIES

    statuses = ("to_film", "filmed", "published")
    conn = connect()
    cur = conn.cursor()
    q = ("SELECT r.event_id, r.source, r.external_ref, e.event_name, e.coverage_status"
         " FROM event_feed_refs r JOIN events e ON e.id = r.event_id"
         " WHERE r.source IN (%s, %s, %s)")
    args = [config.SRC_EI, config.SRC_HC, config.SRC_ES]
    if only_event:
        q += " AND r.event_id = %s"
        args.append(only_event)
    cur.execute(q, args)
    targets = cur.fetchall()

    filmed = set()
    if config.ES_MANUAL_MODE:
        cur.execute("SELECT event_id FROM filming_calendar WHERE event_id IS NOT NULL")
        filmed = {r[0] for r in cur.fetchall()}

    done = 0
    for event_id, source, ext_ref, name, coverage in targets:
        if not only_event and not wide and coverage not in statuses:
            continue
        if source == config.SRC_ES and event_id in filmed:
            print(f"  {name} [ES]: skipped — manual scraper owns filmed ES events (ES_MANUAL_MODE)")
            continue
        try:
            if source == config.SRC_EI:
                new, res = collect_ei(cur, event_id, ext_ref)
            elif source == config.SRC_ES:
                new, res = collect_es(cur, event_id, ext_ref)
            else:
                new, res = collect_hc(cur, event_id, ext_ref)
            conn.commit()
            print(f"  {name} [{source}]: +{new} entries, {res} results rows")
            done += 1
        except Exception as e:
            conn.rollback()
            print(f"  !! {name} [{source}]: {e}")
    print(f"collected {done} events")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()

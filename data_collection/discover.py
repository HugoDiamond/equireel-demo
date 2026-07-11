"""Daily discovery sweep: every feed's calendar -> events(coverage_status=
'discovered') + event_feed_refs, then the filming-calendar matcher upgrades
matched events to 'to_film' (and creates events for calendar entries no feed
knows — the IPC / riding-club case).

The published /calendar page and everything downstream read the DB, so this
job is what makes the whole surface self-maintaining.

Run: python -m data_collection.discover
"""

from datetime import date, timedelta

from . import config
from .db import connect
from .connectors import ei, hc, es_family
from .contracts import snapshot, check_rows, ContractError
from .funnel import ensure_event, fingerprint_match, set_coverage


def _in_window(start):
    if not start:
        return False
    try:
        d = date.fromisoformat(start[:10])
    except ValueError:
        return False
    return d >= date.today() - timedelta(days=config.DAYS_BACK)


def sweep(cur):
    from . import repair
    stats = {}

    # Eventing Ireland — future + recent past
    try:
        rows = ei.list_events("future") + [e for e in ei.list_events("past") if _in_window(e["start"])]
        snap = snapshot(config.SRC_EI, "calendar", rows)
        check_rows(config.SRC_EI, "calendar", rows, ("ref", "name", "start"))
        n = 0
        for e in rows:
            ensure_event(cur, config.SRC_EI, e["ref"], e["name"],
                         date.fromisoformat(e["start"]), "IRL", venue=e.get("venue"),
                         organiser="Eventing Ireland")
            n += 1
        stats["EI"] = n
    except ContractError as ex:
        stats["EI"] = "CONTRACT-BREAK"
        repair.attempt(config.SRC_EI, "calendar", snap, ex)

    # Horses & Competitions — French CCE
    try:
        rows = [e for e in hc.list_events() if _in_window(e["start"])]
        snap = snapshot(config.SRC_HC, "calendar", rows)
        check_rows(config.SRC_HC, "calendar", rows, ("ref", "name", "start"))
        n = 0
        for e in rows:
            venue = e.get("city")
            ensure_event(cur, config.SRC_HC, e["ref"], e["name"],
                         date.fromisoformat(e["start"]), "FRA", venue=venue,
                         organiser=e.get("organiser"))
            n += 1
        stats["HC"] = n
    except ContractError as ex:
        stats["HC"] = "CONTRACT-BREAK"
        repair.attempt(config.SRC_HC, "calendar", snap, ex)

    # EventingScores family — calendar only, three domains
    for domain, country in config.ES_DOMAINS.items():
        try:
            rows = [e for e in es_family.list_events(domain)
                    if _in_window(e["start"]) and not e["abandoned"]]
        except Exception as ex:  # one domain down must not kill the sweep
            print(f"  !! {domain}: {ex}")
            stats[domain] = "ERROR"
            continue
        snap = snapshot(config.SRC_ES, domain, rows)
        try:
            check_rows(config.SRC_ES, domain, rows, ("ref", "name", "start"))
        except ContractError as ex:
            stats[domain] = "CONTRACT-BREAK"
            repair.attempt(config.SRC_ES, domain, snap, ex)
            continue
        n = 0
        for e in rows:
            ensure_event(cur, config.SRC_ES, f"{domain}#{e['ref']}", e["name"],
                         date.fromisoformat(e["start"]), country,
                         match_venue=e.get("venue_key"))
            n += 1
        stats[domain] = n

    return stats


def match_filming_calendar(cur):
    """filming_calendar is the 'we are doing this event' authority: match its
    entries to discovered events (upgrade to to_film + link event_id), or
    create the event when no feed carries it."""
    cur.execute("SELECT id, event_name, start_date, country, venue, organiser"
                " FROM filming_calendar WHERE event_id IS NULL")
    matched = created = 0
    for cal_id, name, start, country, venue, organiser in cur.fetchall():
        eid = fingerprint_match(cur, name, start, window_days=2)
        if eid is None:
            cur.execute(
                "INSERT INTO events (event_name, event_date, event_country, source,"
                " venue, organiser, coverage_status) VALUES (%s,%s,%s,%s,%s,%s,'to_film')"
                " RETURNING id",
                (name, start, country, config.SRC_CALENDAR, venue, organiser),
            )
            eid = cur.fetchone()[0]
            created += 1
        else:
            set_coverage(cur, eid, "to_film")
            matched += 1
        cur.execute("UPDATE filming_calendar SET event_id=%s WHERE id=%s", (eid, cal_id))
    return matched, created


def main():
    conn = connect()
    cur = conn.cursor()
    try:
        stats = sweep(cur)
        m, c = match_filming_calendar(cur)
        conn.commit()
        print("discovered/refreshed:", stats)
        print(f"filming calendar: {m} matched to feeds, {c} created (feed-invisible)")
        cur.execute("SELECT coverage_status, COUNT(*) FROM events GROUP BY 1 ORDER BY 2 DESC")
        print("coverage now:", cur.fetchall())
    except ContractError as e:
        conn.rollback()
        print("CONTRACT BREAK — nothing written:", e)
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()

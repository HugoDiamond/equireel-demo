"""Evening collector — David's spec: collect each filmed event's results at
18:00 LOCAL TIME AT THE VENUE, then hourly until complete.

Runs every hour (task equireel-evening). Each tick:
  1. find filmed events running today (venue-local "today"),
  2. if venue-local time >= 18:00 and the event-day isn't marked complete,
     run a full collection for it (results/placings/statuses),
  3. completeness = scored-row count has PLATEAUED across two consecutive
     ticks with at least one scored row (organisers publish late sections
     at odd times; a plateau says "done" without needing their say-so),
  4. complete -> stop for that event-day. The 06:15 morning run remains the
     backstop for anything published overnight.

Venue timezone: filming_calendar.timezone when set (admin dropdown; Pacific
US venues etc), else a country default. State lives in the DB-adjacent
snapshots dir today; the file is the only thing to move for the cloud runner.

Run: python -m data_collection.evening [--force]
"""

import datetime
import json
import os
import sys
from zoneinfo import ZoneInfo

from . import config
from .db import connect

COUNTRY_TZ = {
    "GBR": "Europe/London", "IRL": "Europe/Dublin",
    "FRA": "Europe/Paris", "BEL": "Europe/Brussels", "GER": "Europe/Berlin",
    "USA": "America/New_York",  # default; per-event override for other zones
}
# state lives in the DB (collection_state) so any runner anywhere —
# this PC, GitHub Actions, a future worker — continues the same day
from .db import state_get, state_set


def scored_count(cur, event_id):
    cur.execute("""SELECT COUNT(*) FROM results
                   WHERE event_id=%s AND (position IS NOT NULL OR status_code IS NOT NULL)""",
                (event_id,))
    return cur.fetchone()[0]


def collect_event(conn, cur, event_id):
    """All-source collection for one event (same dispatch as collect.main)."""
    from .collect import collect_ei, collect_es, collect_hc
    cur.execute("""SELECT source, external_ref FROM event_feed_refs
                   WHERE event_id=%s AND source IN (%s, %s, %s)""",
                (event_id, config.SRC_EI, config.SRC_HC, config.SRC_ES))
    total = 0
    for source, ext in cur.fetchall():
        try:
            if source == config.SRC_EI:
                _, res = collect_ei(cur, event_id, ext)
            elif source == config.SRC_ES:
                _, res = collect_es(cur, event_id, ext)
            else:
                _, res = collect_hc(cur, event_id, ext)
            conn.commit()
            total += res
        except Exception as e:
            conn.rollback()
            print(f"    !! {source} {ext}: {e}")
    return total


def main():
    force = "--force" in sys.argv
    conn = connect()
    cur = conn.cursor()
    state = state_get(cur, "evening", {}) or {}
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    cur.execute("""SELECT fc.event_id, fc.event_name, fc.country, fc.timezone,
                          fc.start_date, COALESCE(fc.end_date, fc.start_date)
                   FROM filming_calendar fc WHERE fc.event_id IS NOT NULL""")
    acted = 0
    for event_id, name, country, tz_override, start, end in cur.fetchall():
        tz = ZoneInfo(tz_override or COUNTRY_TZ.get(country, "Europe/London"))
        local = now_utc.astimezone(tz)
        today = local.date()
        if not (start <= today <= end):
            continue
        key = f"{event_id}:{today.isoformat()}"
        st = state.get(key, {})
        if st.get("done") and not force:
            continue
        if local.hour < 18 and not force:
            continue

        print(f"  {name} [{country} {local:%H:%M} local] collecting...")
        collect_event(conn, cur, event_id)
        count = scored_count(cur, event_id)
        prev = st.get("count")
        done = prev is not None and count == prev and count > 0
        state[key] = {"count": count, "done": done,
                      "checked": now_utc.isoformat(timespec="seconds")}
        acted += 1
        print(f"    scored rows: {count} (prev {prev}) -> {'COMPLETE' if done else 'retry next hour'}")

    # keep only recent keys (last 7 days) so the blob stays small
    cutoff = (now_utc.date() - datetime.timedelta(days=7)).isoformat()
    state = {k: v for k, v in state.items() if k.split(":", 1)[-1] >= cutoff}
    state_set(cur, "evening", state)
    conn.commit()
    if not acted:
        print(f"{now_utc:%H:%M}Z: nothing due")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()

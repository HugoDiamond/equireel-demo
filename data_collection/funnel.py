"""THE shared upsert. Every collector hands records here; nothing else
writes events/results. Owns: which row (identity), which columns
(ownership matrix), who wins (precedence). Idempotent — any collector
re-runs safely.

Column ownership (from the plan):
  ENTRIES    -> bib_number, horse_name, rider_full_name, section_name (creates row)
  SCHEDULED  -> xc_scheduled_start (a plan; its owning feed may overwrite freely)
  ACTUAL     -> xc_start_time + xc_start_time_source (precedence ladder)
  RESULTS    -> scores, position, status_code
  NEVER      -> video/link columns, anything a human corrected
"""

import re
from datetime import date, timedelta

from .config import TIME_RANK

STOP = {"the", "at", "of", "and", "horse", "trials", "trial", "international",
        "one", "day", "event", "ode", "pony", "club", "hunter", "equestrian",
        "centre", "center", "park", "farm", "house", "(1)", "(2)", "(3)"}


def norm_tokens(name):
    toks = re.sub(r"[^a-z0-9 ]", " ", (name or "").lower()).split()
    return {t for t in toks if t not in STOP and not t.isdigit()}


def norm_ident(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def fingerprint_match(cur, name, event_date, window_days=3, venue=None):
    """Find an existing event by name-token overlap + date proximity.
    When BOTH sides know their venue and the venues differ, it is NOT a
    match — kills the 'Area 7 Qualifier at five different venues, same
    weekend' false-merge that generic pony-club names produce."""
    cur.execute(
        "SELECT id, event_name, event_date, venue FROM events "
        "WHERE event_date BETWEEN %s AND %s",
        (event_date - timedelta(days=window_days), event_date + timedelta(days=window_days)),
    )
    want = norm_tokens(name)
    vwant = norm_ident(venue)
    best = None
    for eid, ename, edate, evenue in cur.fetchall():
        vhave = norm_ident(evenue)
        if vwant and vhave and vwant != vhave:
            continue
        have = norm_tokens(ename)
        if not want or not have:
            continue
        overlap = len(want & have) / min(len(want), len(have))
        if overlap >= 0.6 and (best is None or overlap > best[1]):
            best = (eid, overlap)
    return best[0] if best else None


def ensure_event(cur, source, external_ref, name, event_date, country,
                 venue=None, organiser=None, coverage="discovered",
                 match_venue=None):
    """Return event_id for a feed event; create/match/enrich as needed.
    Never downgrades coverage_status; fills venue/organiser only when null.
    match_venue: opaque venue key used ONLY for disambiguation (e.g. ES
    fid_venue) — matched against, stored in venue only if venue is None."""
    cur.execute(
        "SELECT event_id FROM event_feed_refs WHERE source=%s AND external_ref=%s",
        (source, str(external_ref)),
    )
    row = cur.fetchone()
    if row:
        eid = row[0]
    else:
        eid = fingerprint_match(cur, name, event_date, venue=venue or match_venue)
        if eid is None:
            cur.execute(
                "INSERT INTO events (event_name, event_date, event_country, source,"
                " venue, organiser, coverage_status) VALUES (%s,%s,%s,%s,%s,%s,%s)"
                " RETURNING id",
                (name, event_date, country, source, venue or match_venue,
                 organiser, coverage),
            )
            eid = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO event_feed_refs (event_id, source, external_ref)"
            " VALUES (%s,%s,%s) ON CONFLICT (source, external_ref) DO NOTHING",
            (eid, source, str(external_ref)),
        )
    # enrich, never clobber
    cur.execute(
        "UPDATE events SET venue=COALESCE(venue,%s), organiser=COALESCE(organiser,%s),"
        " updated_at=now() WHERE id=%s",
        (venue, organiser, eid),
    )
    return eid


def set_coverage(cur, event_id, status):
    """Upgrade-only transitions (discovered may become anything;
    nothing ever returns to discovered)."""
    cur.execute(
        "UPDATE events SET coverage_status=%s, updated_at=now()"
        " WHERE id=%s AND coverage_status='discovered'",
        (status, event_id),
    )
    return cur.rowcount


def _find_row(cur, event_id, bib, horse, rider):
    if bib:
        cur.execute(
            "SELECT id, source FROM results WHERE event_id=%s AND bib_number=%s",
            (event_id, str(bib)),
        )
        r = cur.fetchone()
        if r:
            return r
    if horse and rider:
        cur.execute(
            "SELECT id, source, horse_name, rider_full_name FROM results WHERE event_id=%s",
            (event_id,),
        )
        h, ri = norm_ident(horse), norm_ident(rider)
        for rid, src, hn, rn in cur.fetchall():
            if norm_ident(hn) == h and norm_ident(rn) == ri:
                return (rid, src)
    return None


def upsert_entries(cur, event_id, rows, source):
    """rows: dicts {bib, horse, rider, section?, external_id?}. Creates rows;
    updates identity fields only on rows this same source created (INGEST /
    manual rows are never renamed by a feed)."""
    created = updated = 0
    cur.execute("SELECT event_name, event_date, event_country FROM events WHERE id=%s", (event_id,))
    ev_name, ev_date, ev_country = cur.fetchone()
    for r in rows:
        hit = _find_row(cur, event_id, r.get("bib"), r.get("horse"), r.get("rider"))
        if hit is None:
            cur.execute(
                "INSERT INTO results (event_id, event_name, event_date, event_country,"
                " bib_number, horse_name, rider_full_name, section_name, es_entry_id, source)"
                " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (event_id, ev_name, ev_date, ev_country,
                 str(r.get("bib") or ""), r.get("horse"), r.get("rider"),
                 r.get("section"), str(r.get("external_id") or "") or None, source),
            )
            created += 1
        elif hit[1] == source:
            cur.execute(
                "UPDATE results SET horse_name=%s, rider_full_name=%s,"
                " section_name=COALESCE(%s, section_name) WHERE id=%s",
                (r.get("horse"), r.get("rider"), r.get("section"), hit[0]),
            )
            updated += 1
    return created, updated


def upsert_scheduled(cur, event_id, rows):
    """rows: {bib?, horse?, rider?, scheduled (datetime)}. Scheduled is a
    plan — its owning feed overwrites freely. Never touches xc_start_time."""
    n = 0
    for r in rows:
        hit = _find_row(cur, event_id, r.get("bib"), r.get("horse"), r.get("rider"))
        if hit:
            cur.execute(
                "UPDATE results SET xc_scheduled_start=%s WHERE id=%s",
                (r["scheduled"], hit[0]),
            )
            n += cur.rowcount
    return n


def upsert_actual(cur, event_id, rows, time_source):
    """rows: {bib?, horse?, rider?, actual (datetime)}. Precedence ladder:
    write only if the new source outranks (or equals) what's there.
    Existing time with NULL source = legacy = protected (manual rank)."""
    rank = TIME_RANK[time_source]
    n = 0
    for r in rows:
        hit = _find_row(cur, event_id, r.get("bib"), r.get("horse"), r.get("rider"))
        if not hit:
            continue
        cur.execute("SELECT xc_start_time, xc_start_time_source FROM results WHERE id=%s", (hit[0],))
        cur_time, cur_src = cur.fetchone()
        cur_rank = TIME_RANK["manual"] if (cur_time and not cur_src) else TIME_RANK.get(cur_src, 0)
        if cur_time is None or rank >= cur_rank:
            cur.execute(
                "UPDATE results SET xc_start_time=%s, xc_start_time_source=%s WHERE id=%s",
                (r["actual"], time_source, hit[0]),
            )
            n += 1
    return n


RESULT_COLS = ("position", "dressage_score", "sj_penalties", "xc_penalties",
               "xc_time_penalties", "total_score", "status_code", "optimum_xc_time")


def upsert_results(cur, event_id, rows):
    """rows: entry-identity fields + any of RESULT_COLS. Writes score columns
    only; never identity, never times, never video links."""
    n = 0
    for r in rows:
        hit = _find_row(cur, event_id, r.get("bib"), r.get("horse"), r.get("rider"))
        if not hit:
            continue
        sets, vals = [], []
        for c in RESULT_COLS:
            if r.get(c) is not None:
                sets.append(c + "=%s")
                vals.append(r[c])
        if sets:
            vals.append(hit[0])
            cur.execute("UPDATE results SET " + ", ".join(sets) + " WHERE id=%s", vals)
            n += 1
    return n

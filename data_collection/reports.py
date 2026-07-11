"""Buyer-overlap report: rank UNFILMED events by how many past Equireel
buyers are entered — the filming expansion list, priced in proven customers.

Identity matching is deliberately conservative:
  - HORSE match (strong): the entered horse's normalised name appears in a
    past paid order. Horse names are distinctive; this is the primary signal.
  - RIDER match (weaker, reported separately): rider name appears as a past
    order's rider. Common names inflate this, so it never drives the rank.

Run: python -m data_collection.reports          (prints + writes markdown)
Output: data_collection/snapshots/buyer_overlap.md
"""

import os
import re
from datetime import date

from .db import connect

PAID = ("Processing", "Completed", "Refunded", "Test")


def norm(s):
    s = re.sub(r"\(.*?\)", " ", (s or "").lower())         # drop (ISH) etc
    return re.sub(r"[^a-z0-9]", "", s)


def main():
    conn = connect()
    cur = conn.cursor()

    # past buyers' horses and riders (full order history, legacy included).
    # Legacy items rarely fill i.horse — recover the horse from shop_horses
    # (shop_horse_id) and from the EQUIREEL fulfilment label
    # ("EQUIREEL <bib> <rider> & <HORSE> at <EVENT> <YEAR>").
    cur.execute("""SELECT DISTINCT i.horse, i.rider_name, sh.name, i.horse_info
                   FROM shop_order_items i
                   JOIN shop_orders o ON o.id = i.order_id
                   LEFT JOIN shop_horses sh ON sh.id = i.shop_horse_id
                   WHERE o.status IN %s""", (PAID,))
    buyer_horses, buyer_riders = set(), set()
    for h, r, sh_name, label in cur.fetchall():
        if h: buyer_horses.add(norm(h))
        if sh_name: buyer_horses.add(norm(sh_name))
        if label and "&" in label:
            m = re.search(r"&\s*(.+?)\s+at\s+", label, re.I)
            if m: buyer_horses.add(norm(m.group(1)))
        if r: buyer_riders.add(norm(r))
    buyer_horses.discard(""); buyer_riders.discard("")

    # unfilmed events with collected entries
    cur.execute("""
        SELECT e.id, e.event_name, e.event_date, e.event_country, e.venue,
               COUNT(r.id) AS entries
        FROM events e JOIN results r ON r.event_id = e.id
        WHERE e.coverage_status = 'discovered'
        GROUP BY e.id ORDER BY e.event_date""")
    events = cur.fetchall()

    rows = []
    for eid, name, edate, country, venue, n_entries in events:
        cur.execute("SELECT horse_name, rider_full_name FROM results WHERE event_id=%s", (eid,))
        h_hits = r_hits = 0
        for h, r in cur.fetchall():
            if norm(h) in buyer_horses: h_hits += 1
            elif norm(r) in buyer_riders: r_hits += 1
        rows.append((h_hits, r_hits, n_entries, name, edate, country, venue))
    rows.sort(key=lambda x: (-x[0], -x[1]))

    lines = [
        "# Buyer-overlap report — unfilmed events ranked by past-buyer presence",
        f"\nGenerated from {len(buyer_horses):,} distinct buyer horses / "
        f"{len(buyer_riders):,} buyer riders across the full order history, "
        f"against {len(events)} unfilmed events with collected entries.",
        "\n| Past-buyer horses | rider-only | entries | event | date | where |",
        "|---|---|---|---|---|---|",
    ]
    for h, r, n, name, edate, country, venue in rows:
        lines.append(f"| **{h}** | {r} | {n} | {name} | {edate} | {venue or country} |")
    lines.append("\nHorse match = that exact horse has been bought for before "
                 "(strong). Rider-only = name match only (treat as a hint). "
                 "The list deepens automatically as daily wide collection runs.")
    out = "\n".join(lines)
    path = os.path.join(os.path.dirname(__file__), "snapshots", "buyer_overlap.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(out + "\n")
    # console can choke on unicode — file first, ascii-safe echo after
    try:
        print(out)
    except UnicodeEncodeError:
        print(out.encode("ascii", "replace").decode())
    print(f"\nwritten: {path}")
    cur.close(); conn.close()


if __name__ == "__main__":
    main()

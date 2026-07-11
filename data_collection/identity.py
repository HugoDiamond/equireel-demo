"""Identity linking — attach results rows to canonical riders/horses.

Conservative v1 (horse-profile prerequisite):
  - normalise names (case/punctuation/suffixes like "(ISH)") and match
    exactly against the existing riders/horses tables;
  - prefer identities that carry a BE/FEI id when duplicates exist;
  - create a new identity only when nothing matches;
  - never relink a row that already has rider_id/horse_id (Mike's earlier
    pipeline filled 23k of those — untouched).

Run: python -m data_collection.identity [--dry-run]
"""

import re
import sys

from .db import connect


def norm(s):
    s = re.sub(r"\(.*?\)", " ", (s or "").lower())
    return re.sub(r"[^a-z0-9]", "", s)


def main():
    dry = "--dry-run" in sys.argv
    conn = connect()
    cur = conn.cursor()

    cur.execute("SELECT id, name, be_id FROM horses")
    horses = {}
    for hid, name, be in cur.fetchall():
        k = norm(name)
        if k and (k not in horses or be):   # id-carrying identity wins
            horses[k] = hid

    cur.execute("SELECT id, first_name, last_name, be_id, fei_id FROM riders")
    riders = {}
    for rid, fn, ln, be, fei in cur.fetchall():
        k = norm((fn or "") + (ln or ""))
        if k and (k not in riders or be or fei):
            riders[k] = rid

    cur.execute("""SELECT id, horse_name, rider_full_name FROM results
                   WHERE horse_id IS NULL OR rider_id IS NULL""")
    rows = cur.fetchall()

    linked_h = linked_r = new_h = new_r = 0
    for rid_, horse, rider in rows:
        hk, rk = norm(horse), norm(rider)
        h_id = horses.get(hk)
        if hk and h_id is None:
            if not dry:
                cur.execute("INSERT INTO horses (name) VALUES (%s) RETURNING id",
                            ((horse or "").strip(),))
                h_id = cur.fetchone()[0]
            horses[hk] = h_id or -1
            new_h += 1
        r_id = riders.get(rk)
        if rk and r_id is None:
            parts = (rider or "").strip().split()
            first, last = (parts[0], " ".join(parts[1:])) if len(parts) > 1 else ("", parts[0] if parts else "")
            if not dry:
                cur.execute("INSERT INTO riders (first_name, last_name) VALUES (%s,%s) RETURNING id",
                            (first, last))
                r_id = cur.fetchone()[0]
            riders[rk] = r_id or -1
            new_r += 1
        if not dry:
            cur.execute("UPDATE results SET horse_id=COALESCE(horse_id,%s), rider_id=COALESCE(rider_id,%s)"
                        " WHERE id=%s", (horses.get(hk), riders.get(rk), rid_))
        if h_id: linked_h += 1
        if r_id: linked_r += 1

    if not dry:
        conn.commit()
    cur.execute("SELECT COUNT(*), COUNT(rider_id), COUNT(horse_id) FROM results")
    print(f"rows processed {len(rows)} | matched-existing horses {linked_h - new_h}, riders {linked_r - new_r}"
          f" | new horses {new_h}, new riders {new_r}")
    print("results total/rider_id/horse_id now:", cur.fetchone())
    cur.close(); conn.close()


if __name__ == "__main__":
    main()

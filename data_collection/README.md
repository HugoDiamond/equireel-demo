# data_collection — feeds → canonical DB (single funnel)

Implements docs/scraper-sources.md + the storefront's DATA-COLLECTION-PLAN:
every collector is only a FETCHER; all records enter through one shared
upsert (`funnel.py`) that owns row identity, column ownership and conflict
precedence. Built overnight 2026-07-11 (David: "go with your recommendation,
add to morning report") — every decision below is reversible.

## Decisions taken (Mike: veto anything here)

1. **Schema (applied live, all additive/nullable — nothing breaks):**
   - `events.venue`, `events.organiser`
   - `events.coverage_status` DEFAULT `'filmed'` — existing 58 rows and your
     scraper inserts stay correct; discovery writes `'discovered'`,
     the calendar matcher upgrades to `'to_film'`. Lifecycle:
     `discovered → to_film → filmed → published → archived`.
   - `results.xc_scheduled_start` (published schedule; NEVER written to
     `xc_start_time`), `results.xc_start_time_source`
     (`manual|timing|sheet_ocr|footage|scheduled`; NULL = legacy, protected).
   - `event_feed_refs (source, external_ref → event_id, payload jsonb)` —
     generic cross-reference (generalises es_event_id / ee_event_hash;
     those keep working).
   - Rollback: `DROP TABLE event_feed_refs; ALTER TABLE events DROP COLUMN
     venue, organiser, coverage_status; ALTER TABLE results DROP COLUMN
     xc_scheduled_start, xc_start_time_source;`
2. **Upsert = Python module, not a PG function.** Faster to review/iterate;
   small enough to port to plpgsql later if you want DB-level enforcement.
3. **Actual-start-time precedence** (higher rank never overwritten by lower):
   manual(5) > timing(4) > sheet_ocr(3) > footage(2) > scheduled(1).
   Existing `xc_start_time` with NULL source = legacy = rank 5 (protected).
4. **Discovery window**: events starting ≥ 30 days ago (rolling) + all
   future. Keeps the events table clean of years of unfilmed history;
   widen in config.py if you want the full back-catalogue for analytics.
5. **ES-family = calendar discovery only here.** Entries/results for
   ES/PCR/HEV stay with your existing unified_scraper (just point it at the
   two extra domains); EI + H&C deep collection is fully handled here (JSON).
6. **Wide entries collection (unfilmed events) ships OFF**
   (`config.WIDE_ENTRIES = False`) — flip it to power buyer-overlap
   analysis per the plan's tiering.
7. Snapshots land in `data_collection/snapshots/` (gitignored) — move to B2
   for the cloud deployment.

## Modules

| file | job |
|---|---|
| `config.py` | window, flags, source names |
| `db.py` | connection (env `DATABASE_URL`, falls back to `.env`) |
| `funnel.py` | THE shared upsert: ensure_event, entries, scheduled, actual (ladder), results |
| `contracts.py` | contract checks + raw snapshot archiving (fetch/parse decoupling) |
| `connectors/ei.py` | Eventing Ireland public JSON API |
| `connectors/hc.py` | Horses & Competitions public JSON API (French CCE + XC start times) |
| `connectors/es_family.py` | EventingScores calendar JSON × 3 domains |
| `discover.py` | daily: all feeds → events(discovered) + refs; then filming_calendar matcher → to_film |
| `collect.py` | deep collection (entries/times/results) for to_film+ events with EI/HC refs |

## Run

```
python -m data_collection.discover          # daily sweep + matcher
python -m data_collection.collect           # deep-collect to_film events
python -m data_collection.collect --event-id 123   # one event
```

Interim scheduler: Windows task "equireel-feed-discovery" (daily 06:00) on
David's machine runs discover.py; replace with your cloud runner.

## Not built yet (from the plan)

FFE headless fallback (Cloudflare), LLM parser-repair loop (snapshots +
contract checks — the prerequisites — are in), identity linking,
IPC PDF assist, EI member-login schedules.

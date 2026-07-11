"""Knobs for the collection layer. Change here, not in module bodies."""

# Rolling discovery window: events starting on/after (today - DAYS_BACK).
# Widen for back-catalogue analytics; the funnel is idempotent either way.
DAYS_BACK = 30

# Deep-collect entries/results for UNFILMED (coverage='discovered') events
# on the JSON APIs — powers the buyer-overlap report (rank unfilmed events
# by how many past Equireel buyers are entered). Approved by David
# 2026-07-11 ("complete items 8-13", item 9).
WIDE_ENTRIES = True

# Source tags written to events.source / results.source / event_feed_refs.source
SRC_EI = "EI-API"
SRC_HC = "HC-API"
SRC_ES = "ES-CAL"       # calendar discovery only (deep = unified_scraper)
SRC_CALENDAR = "CALENDAR"  # events created directly from filming_calendar

# EventingScores-family deployments (same software, three domains)
ES_DOMAINS = {
    "eventingscores.co.uk": "GBR",
    "ponyclubresults.co.uk": "GBR",
    "horse-events-results.co.uk": "GBR",
}

# Actual-start-time precedence (higher never overwritten by lower).
# NULL xc_start_time_source on an existing row = legacy value = protected.
TIME_RANK = {"manual": 5, "timing": 4, "sheet_ocr": 3, "footage": 2, "scheduled": 1}

SNAPSHOT_DIR = "snapshots"  # relative to data_collection/; gitignored

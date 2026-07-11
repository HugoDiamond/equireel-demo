"""Self-healing repair agent — when a connector's contract breaks (site
redesign, field rename), this module:
  1. gathers the failing raw snapshot + the current parser source + the
     golden corpus (snapshot -> known-good parsed output pairs),
  2. asks Claude for a corrected parser,
  3. validates the candidate: it must reproduce EVERY golden pair exactly
     AND parse the failing snapshot contract-clean,
  4. on success writes a versioned parser to repaired/ and alerts the team;
     on failure (or no API key) it alerts with full diagnosis instead.

Fetching never stops during breakage (snapshots keep archiving), so a
repair — automatic or human — replays the gap with zero data loss.

Activation: set ANTHROPIC_API_KEY (with credits) in data_collection/.env.
Until then every contract break falls back to a loud email alert.

Manual run:   python -m data_collection.repair <source> <snapshot.json>
Golden setup: python -m data_collection.repair --capture-golden
"""

import importlib.util
import json
import os
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(__file__)
GOLDEN_DIR = os.path.join(HERE, "golden")
REPAIRED_DIR = os.path.join(HERE, "repaired")

PARSER_OF = {  # source tag -> connector module file to repair
    "EI-API": "connectors/ei.py",
    "HC-API": "connectors/hc.py",
    "ES-CAL": "connectors/es_family.py",
    "ES-DEEP": "connectors/es_deep.py",
}

MODEL = "claude-sonnet-5"


def _env(key):
    # .env beside this package (db.py loads it too, but repair may run first)
    path = os.path.join(HERE, ".env")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip()
    return os.environ.get(key)


def alert(subject, body):
    """Loud email via Resend; falls back to stderr."""
    key = _env("RESEND_API_KEY")
    print(f"[ALERT] {subject}\n{body[:500]}")
    if not key:
        return
    try:
        import requests
        requests.post("https://api.resend.com/emails", timeout=30,
                      headers={"Authorization": f"Bearer {key}"},
                      json={"from": _env("ALERT_FROM") or "Equireel <info@equireel.com>",
                            "to": [_env("ALERT_TO") or "info@equireel.com"],
                            "subject": "[data-collection] " + subject,
                            "html": "<pre>" + body.replace("<", "&lt;")[:6000] + "</pre>"})
    except Exception as e:
        print("alert email failed:", e)


def call_claude(prompt):
    key = _env("ANTHROPIC_API_KEY")
    mock = _env("REPAIR_MOCK_RESPONSE_FILE")
    if mock and os.path.exists(mock):  # harness testing without credits
        return open(mock, encoding="utf-8").read()
    if not key:
        return None
    import requests
    r = requests.post("https://api.anthropic.com/v1/messages", timeout=300,
                      headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                               "content-type": "application/json"},
                      json={"model": MODEL, "max_tokens": 16000,
                            "messages": [{"role": "user", "content": prompt}]})
    r.raise_for_status()
    return "".join(b.get("text", "") for b in r.json().get("content", []))


def extract_code(text):
    if "```" not in (text or ""):
        return text
    parts = text.split("```")
    block = parts[1]
    return block.split("\n", 1)[1] if block.startswith(("python", "py")) else block


def load_module(path, name="candidate"):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def validate(candidate_path, entry_fn, golden_pairs, failing_snapshot):
    """Candidate must reproduce every golden (input -> output) pair exactly
    and produce non-empty contract-shaped output for the failing snapshot."""
    mod = load_module(candidate_path)
    fn = getattr(mod, entry_fn, None)
    if fn is None:
        return False, f"candidate lacks function {entry_fn}"
    for pair in golden_pairs:
        got = fn(pair["input"])
        if got != pair["output"]:
            return False, f"golden mismatch on {pair.get('name', '?')}"
    got = fn(failing_snapshot)
    if not isinstance(got, list) or not got:
        return False, "failing snapshot still yields no rows"
    return True, f"golden {len(golden_pairs)}/{len(golden_pairs)} + failing snapshot parses ({len(got)} rows)"


def attempt(source, kind, failing_snapshot_path, error):
    parser_rel = PARSER_OF.get(source)
    if not parser_rel:
        alert(f"contract break: {source}/{kind} (no parser mapping)", str(error))
        return False
    parser_path = os.path.join(HERE, parser_rel)
    parser_src = open(parser_path, encoding="utf-8").read()
    failing = open(failing_snapshot_path, encoding="utf-8").read()

    golden_pairs = []
    gpath = os.path.join(GOLDEN_DIR, source + ".json")
    if os.path.exists(gpath):
        golden_pairs = json.load(open(gpath, encoding="utf-8"))

    prompt = f"""A production parser for the feed source "{source}" has broken —
its contract check failed with: {error}

Current parser module ({parser_rel}):
```python
{parser_src}
```

The raw snapshot that failed to parse (truncated):
```
{failing[:20000]}
```

Golden corpus (the parser MUST still produce EXACTLY these outputs for these
inputs): {json.dumps(golden_pairs)[:8000]}

Rewrite the FULL parser module so it (a) parses the failing snapshot into the
same row schema and (b) reproduces every golden pair byte-for-byte. Reply with
one python code block containing the complete module, nothing else."""

    reply = call_claude(prompt)
    if reply is None:
        alert(f"contract break: {source}/{kind} — repair agent inactive (no ANTHROPIC_API_KEY)",
              f"{error}\nsnapshot: {failing_snapshot_path}\nFetching continues; "
              f"fix the parser and re-run the gap from snapshots.")
        return False

    os.makedirs(REPAIRED_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    cand_path = os.path.join(REPAIRED_DIR, f"{source.replace('-', '_')}-{stamp}.py")
    open(cand_path, "w", encoding="utf-8").write(extract_code(reply))

    try:
        # golden pairs store the entry function name used for this source
        entry_fn = golden_pairs[0]["fn"] if golden_pairs else "parse"
        raw = json.loads(failing) if failing.lstrip().startswith(("[", "{")) else failing
        ok, why = validate(cand_path, entry_fn, golden_pairs, raw)
    except Exception as e:
        ok, why = False, f"candidate crashed: {e}"

    if ok:
        alert(f"AUTO-REPAIR CANDIDATE READY: {source}/{kind}",
              f"{why}\ncandidate: {cand_path}\nReview + promote by replacing "
              f"{parser_rel} (deliberately not auto-promoted in v1).")
        return True
    alert(f"repair FAILED for {source}/{kind}", f"{why}\ncandidate kept at {cand_path}")
    return False


if __name__ == "__main__":
    if "--capture-golden" in sys.argv:
        print("capture golden: store [{'name','fn','input','output'}] json per source in", GOLDEN_DIR)
        sys.exit(0)
    attempt(sys.argv[1], "manual", sys.argv[2], "manual invocation")

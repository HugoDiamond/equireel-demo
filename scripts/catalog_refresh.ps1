# Weekly catalogue refresh: pull new events from the platform DB into the site
# and publish. Conservative by design — gen_catalog.py only ever ADDS events;
# nothing existing is rewritten. Logs to scripts\out\catalog_refresh.log.
$ErrorActionPreference = "Stop"
$repo = "C:\Users\Equireel 1\Documents\Website"
$py = "C:\Users\Equireel 1\anaconda3\python.exe"
$log = Join-Path $repo "scripts\out\catalog_refresh.log"
function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m" | Out-File $log -Append -Encoding utf8 }

Set-Location $repo
try {
    $out = & $py "scripts\gen_catalog.py" 2>&1 | Out-String
    Log ("gen_catalog: " + ($out.Trim() -split "`n")[-1])
    $dirty = git status --porcelain lib/events-real.js public/data/entries.json
    if (-not $dirty) { Log "no new events - nothing to publish"; exit 0 }

    & $py "scripts\gen_api_index.py" | Out-Null
    & $py "scripts\gen_sitemap.py" | Out-Null
    git add lib/events-real.js public/data/entries.json api/_events-index.json public/sitemap.xml
    git commit -m "Catalogue refresh: new events from platform DB (automated weekly run)" | Out-Null
    git push origin main 2>&1 | Out-Null
    Log "published new events to main"
} catch {
    Log ("FAILED: " + $_.Exception.Message)
    exit 1
}

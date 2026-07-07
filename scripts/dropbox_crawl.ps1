# Crawl the shared Dropbox folder tree via the unauthenticated
# list_shared_link_folder_entries endpoint. Writes one JSON line per file to
# scripts/out/dropbox_index.jsonl  ({name, bytes, href, path}).
$ErrorActionPreference = "Stop"
$linkKey   = "t0c7bk311z0iiyjci72wn"
$rootHash  = "ABPLJH1L_YZyj_p2WUh0mbo"
$rlkey     = "i5etv8v8si2ltf3mpsueatu1g"
$shareUrl  = "https://www.dropbox.com/scl/fo/$linkKey/$rootHash?rlkey=$rlkey&dl=0"
$ep        = "https://www.dropbox.com/list_shared_link_folder_entries"
$outDir    = "C:\Users\Equireel 1\Documents\Website\scripts\out"
$outFile   = Join-Path $outDir "dropbox_index.jsonl"
$progFile  = Join-Path $outDir "dropbox_crawl.progress"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
Set-Content -Path $outFile -Value $null -Encoding utf8

# fresh session + csrf token
$g = Invoke-WebRequest -Uri $shareUrl -UseBasicParsing -SessionVariable sess -TimeoutSec 60
$t = ($sess.Cookies.GetCookies("https://www.dropbox.com") | Where-Object { $_.Name -eq 't' }).Value
$hdr = @{ "X-Requested-With" = "XMLHttpRequest" }

# queue of folders to crawl: each = @{ hash; path }
$queue = New-Object System.Collections.Queue
$queue.Enqueue(@{ hash = $rootHash; path = "" })
$fileCount = 0
$sb = New-Object System.Text.StringBuilder

while ($queue.Count -gt 0) {
  $folder = $queue.Dequeue()
  $voucher = $null
  do {
    $body = @{ t=$t; link_key=$linkKey; link_type="s"; secure_hash=$folder.hash; rlkey=$rlkey; sub_path="" }
    if ($voucher) { $body["voucher"] = $voucher }
    $ok = $false
    for ($try=1; $try -le 4 -and -not $ok; $try++) {
      try {
        $resp = Invoke-WebRequest -Uri $ep -Method Post -Body $body -WebSession $sess -Headers $hdr -UseBasicParsing -TimeoutSec 60
        $ok = $true
      } catch { Start-Sleep -Seconds (2*$try) }
    }
    if (-not $ok) { break }
    $j = $resp.Content | ConvertFrom-Json
    foreach ($e in $j.entries) {
      if ($e.is_dir) {
        # secure_hash is the 3rd path segment of the dir href after /scl/fo/<linkkey>/
        $m = [regex]::Match($e.href, '/scl/fo/[^/]+/([^/?]+)')
        if ($m.Success) { $queue.Enqueue(@{ hash = $m.Groups[1].Value; path = ($folder.path + "/" + $e.filename) }) }
      } else {
        $rec = [ordered]@{ name = $e.filename; bytes = $e.bytes; href = $e.href; path = $folder.path }
        [void]$sb.AppendLine(($rec | ConvertTo-Json -Compress))
        $fileCount++
      }
    }
    $voucher = if ($j.has_more_entries) { $j.next_request_voucher } else { $null }
    if ($sb.Length -gt 200000) { Add-Content -Path $outFile -Value $sb.ToString() -NoNewline -Encoding utf8; $sb.Clear() | Out-Null }
    Set-Content -Path $progFile -Value "files=$fileCount queued_folders=$($queue.Count) path=$($folder.path)" -Encoding utf8
  } while ($voucher)
}
if ($sb.Length -gt 0) { Add-Content -Path $outFile -Value $sb.ToString() -NoNewline -Encoding utf8 }
Set-Content -Path $progFile -Value "DONE files=$fileCount" -Encoding utf8
Write-Output "DONE files=$fileCount"

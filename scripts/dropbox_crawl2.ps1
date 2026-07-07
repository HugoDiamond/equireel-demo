# Crawl the ADDITIONAL shared Dropbox folders. Appends to dropbox_index_2.jsonl.
$ErrorActionPreference = "Stop"
$ep     = "https://www.dropbox.com/list_shared_link_folder_entries"
$hdr    = @{ "X-Requested-With" = "XMLHttpRequest" }
$outDir = "C:\Users\Equireel 1\Documents\Website\scripts\out"
$outFile = Join-Path $outDir "dropbox_index_2.jsonl"
$progFile = Join-Path $outDir "dropbox_crawl2.progress"
Set-Content -Path $outFile -Value $null -Encoding utf8

# link_key, secure_hash hint, rlkey
$folders = @(
  @{ lk="sv8u4ccljsb7q3wjnfwsm"; sh="AJ7NZSGgrIsnYILELoxQyRI"; rl="hw1v0v6toxvttqzpad8ebx4xt" },
  @{ lk="wp2n6oiaz0h8hlu8mvm73"; sh="ABv4qV26ISCQ-xgHy6yhJJQ"; rl="0q9xw3wralcmq5vbkozlf4srs" },
  @{ lk="d4718779wsyy6bk2r9zuc"; sh="AB8UhN9FroJ7KNjXdKkjGsg"; rl="lpped1224uvtovrz0rp1umr89" },
  @{ lk="ah7t2ekv3x5a9nh5h239k"; sh="h";                       rl="r1y0lg5s8b4kgs205475z0ge0" },
  @{ lk="qpixd59e3ec4t11fujer6"; sh="AHf36nkWYdCBKkcb3rAqYqI"; rl="ucugkzlyj5kb7rh3u5bnlyn0o" },
  @{ lk="pg9gk7dmf5q0lwcf90doe"; sh="ACTNxgmtZCofS2GW_1aysqk"; rl="ae00e6caabrlcgozbgbmrddzd" }
)

$total = 0
$sb = New-Object System.Text.StringBuilder
foreach ($fld in $folders) {
  # fresh session; derive the real secure_hash from the final redirected URL
  $g = Invoke-WebRequest -Uri "https://www.dropbox.com/scl/fo/$($fld.lk)/$($fld.sh)?rlkey=$($fld.rl)&dl=0" -UseBasicParsing -SessionVariable sess -TimeoutSec 60
  $m = [regex]::Match($g.BaseResponse.ResponseUri.AbsoluteUri, '/scl/fo/[^/]+/([^/?]+)')
  $rootHash = if ($m.Success) { $m.Groups[1].Value } else { $fld.sh }
  $t = ($sess.Cookies.GetCookies("https://www.dropbox.com") | Where-Object { $_.Name -eq 't' }).Value

  $queue = New-Object System.Collections.Queue
  $queue.Enqueue(@{ hash = $rootHash; path = "" })
  while ($queue.Count -gt 0) {
    $folder = $queue.Dequeue()
    $voucher = $null
    do {
      $body = @{ t=$t; link_key=$fld.lk; link_type="s"; secure_hash=$folder.hash; rlkey=$fld.rl; sub_path="" }
      if ($voucher) { $body["voucher"] = $voucher }
      $ok = $false
      for ($try=1; $try -le 4 -and -not $ok; $try++) {
        try { $resp = Invoke-WebRequest -Uri $ep -Method Post -Body $body -WebSession $sess -Headers $hdr -UseBasicParsing -TimeoutSec 60; $ok = $true }
        catch { Start-Sleep -Seconds (2*$try) }
      }
      if (-not $ok) { break }
      $j = $resp.Content | ConvertFrom-Json
      foreach ($e in $j.entries) {
        if ($e.is_dir) {
          $dm = [regex]::Match($e.href, '/scl/fo/[^/]+/([^/?]+)')
          if ($dm.Success) { $queue.Enqueue(@{ hash = $dm.Groups[1].Value; path = ($folder.path + "/" + $e.filename) }) }
        } else {
          $rec = [ordered]@{ name = $e.filename; bytes = $e.bytes; href = $e.href; path = $folder.path; folder = $fld.lk }
          [void]$sb.AppendLine(($rec | ConvertTo-Json -Compress))
          $total++
        }
      }
      $voucher = if ($j.has_more_entries) { $j.next_request_voucher } else { $null }
      if ($sb.Length -gt 200000) { Add-Content -Path $outFile -Value $sb.ToString() -NoNewline -Encoding utf8; $sb.Clear() | Out-Null }
      Set-Content -Path $progFile -Value "folder=$($fld.lk) files=$total" -Encoding utf8
    } while ($voucher)
  }
}
if ($sb.Length -gt 0) { Add-Content -Path $outFile -Value $sb.ToString() -NoNewline -Encoding utf8 }
Set-Content -Path $progFile -Value "DONE files=$total" -Encoding utf8
Write-Output "DONE files=$total"

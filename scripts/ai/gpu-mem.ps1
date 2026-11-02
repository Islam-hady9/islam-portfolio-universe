# Prints JSON: GPU memory (Windows "GPU Process Memory" counters) of the browser processes whose
# command line contains -Match (e.g. a Playwright profile directory). Used by bench-local.mjs.
param([string]$Match = 'ai-bench')
$pids = @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($Match) } | ForEach-Object { $_.ProcessId })
$shared = 0; $dedicated = 0; $perPid = @{}
foreach ($s in (Get-Counter '\GPU Process Memory(*)\Shared Usage', '\GPU Process Memory(*)\Dedicated Usage' -ErrorAction SilentlyContinue).CounterSamples) {
  if ($s.InstanceName -match '^pid_(\d+)_') {
    $procId = [int]$Matches[1]
    if ($pids -contains $procId) {
      if ($s.Path -match 'shared usage') { $shared += $s.CookedValue } else { $dedicated += $s.CookedValue }
      $perPid["$procId"] = ($perPid["$procId"] + $s.CookedValue)
    }
  }
}
[pscustomobject]@{ processes = $pids.Count; sharedBytes = [int64]$shared; dedicatedBytes = [int64]$dedicated } | ConvertTo-Json -Compress

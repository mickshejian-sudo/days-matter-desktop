$c1 = @{}
foreach ($p in (Get-Process electron -ErrorAction SilentlyContinue)) {
  $c1[[int]$p.Id] = $p.TotalProcessorTime.TotalMilliseconds
}
Start-Sleep -Seconds 10
$delta = 0
foreach ($p in (Get-Process electron -ErrorAction SilentlyContinue)) {
  $id = [int]$p.Id
  if ($c1.ContainsKey($id)) { $delta += ($p.TotalProcessorTime.TotalMilliseconds - $c1[$id]) }
}
$cores = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$pct = [math]::Round($delta / (10 * 1000 * $cores) * 100, 2)
Write-Output ("CPU over 10s: {0}% of machine ({1} logical cores)" -f $pct, $cores)

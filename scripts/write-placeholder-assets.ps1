$b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets"))
$bytes = [Convert]::FromBase64String($b64)
foreach ($name in @("icon.png", "splash-icon.png", "adaptive-icon.png")) {
  $path = Join-Path $root $name
  [IO.File]::WriteAllBytes($path, $bytes)
}
Write-Host "Wrote placeholder PNGs to $root"

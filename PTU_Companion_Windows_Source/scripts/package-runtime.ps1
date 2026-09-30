param(
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  Join-Path $projectRoot 'desktop/runtime_bundle.zip'
} else {
  [System.IO.Path]::GetFullPath($OutputPath)
}
$destinationDirectory = Split-Path -Parent $destination
New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
$tempPath = Join-Path ([System.IO.Path]::GetTempPath()) "ptu-runtime-$([Guid]::NewGuid().ToString('N')).zip"
$runtimePaths = @('definitions', 'persistence', 'rules', 'seed', 'static-preview', 'server.mjs', 'VERSION.txt')
$sourcePaths = foreach ($relativePath in $runtimePaths) {
  $path = Join-Path $projectRoot $relativePath
  if (-not (Test-Path -LiteralPath $path)) { throw "Runtime source is missing: $relativePath" }
  $path
}

try {
  Compress-Archive -Path $sourcePaths -DestinationPath $tempPath -CompressionLevel Optimal
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($tempPath)
  try {
    $entryNames = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($entry in $archive.Entries) { [void]$entryNames.Add($entry.FullName) }
    foreach ($requiredEntry in @('server.mjs', 'VERSION.txt', 'static-preview/app.js', 'static-preview/styles.css', 'seed/default-state.json', 'seed/definitions/ptu_seed_v1.0.sqlite3')) {
      if (-not $entryNames.Contains($requiredEntry)) { throw "Runtime bundle is missing: $requiredEntry" }
    }
  }
  finally { $archive.Dispose() }
  Move-Item -LiteralPath $tempPath -Destination $destination -Force
  Write-Host "Windows runtime bundle: $destination"
}
finally {
  if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
}

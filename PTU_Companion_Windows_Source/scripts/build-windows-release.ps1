$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$version = (Get-Content (Join-Path $projectRoot 'VERSION.txt') -Raw).Trim()
$outputDir = Join-Path $projectRoot 'dist'
$outputName = "PTU-Companion-Windows-v$version.exe"
$containerOutput = "/src/dist/$outputName"
& (Join-Path $PSScriptRoot 'package-runtime.ps1')

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
docker run --rm `
  --mount "type=bind,source=$projectRoot,target=/src" `
  --workdir /src/desktop `
  --env GOOS=windows `
  --env GOARCH=amd64 `
  --env CGO_ENABLED=0 `
  --env GO111MODULE=off `
  golang:1.24-alpine `
  go build -trimpath -o $containerOutput launcher.go

if ($LASTEXITCODE -ne 0) { throw 'Windows executable build failed.' }
Write-Host "Windows executable: $outputDir\$outputName"

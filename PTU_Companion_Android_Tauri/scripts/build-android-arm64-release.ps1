$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot\..
try {
  docker compose build android-arm64-release-apk
  if ($LASTEXITCODE -ne 0) { throw 'Android release builder image failed to build.' }

  docker compose run --rm android-arm64-release-apk
  if ($LASTEXITCODE -ne 0) { throw 'Android ARM64 release APK build failed.' }
}
finally {
  Pop-Location
}
Write-Host "APK em dist/android/PTU-Companion-v2.2.0-beta.36-arm64-release.apk"

$ErrorActionPreference = "Stop"
docker compose run --rm android-arm64-release-apk
Write-Host "APK em dist/android/PTU-Companion-v2.2.0-beta.18-arm64-release.apk"

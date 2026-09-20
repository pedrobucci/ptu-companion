# PTU Companion Android v2.2.0-beta.6

If you already have the beta.5 Tauri project, copy the files from the beta.6 patch over the project and allow overwrite.

Build the ARM64 APK with:

```powershell
docker compose run --rm android-arm64-release-apk
```

Expected output:

```text
dist\android\PTU-Companion-v2.2.0-beta.6-arm64-release.apk
```

The package keeps `com.ptu.companion` and increments Android `versionCode` to `2002006`, so it is intended to update beta.5 without deleting application data.

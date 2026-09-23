#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WINDOWS = ROOT / 'PTU_Companion_Windows_Source'
ANDROID = ROOT / 'PTU_Companion_Android_Tauri'

BELL = '<button>🔔<b>1</b></button>'


def patch_app(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(BELL)
    if count == 0:
        if '>🔔<' in text:
            raise SystemExit(f'{path}: an unexpected Notifications bell remains; refusing an unsafe broad edit.')
        print(f'{path}: Notifications bell already absent.')
        return
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one legacy Notifications button, found {count}.')
    text = text.replace(BELL, '', 1)
    path.write_text(text, encoding='utf-8')
    print(f'Patched {path.relative_to(ROOT)}')


def append_verify(package_path: Path, verifier: str) -> None:
    package = json.loads(package_path.read_text(encoding='utf-8'))
    scripts = package.setdefault('scripts', {})
    verify = str(scripts.get('verify', '')).strip()
    command = f'node {verifier}'
    if command not in verify:
        scripts['verify'] = f'{verify} && {command}' if verify else command
        package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Updated {package_path.relative_to(ROOT)}')
    else:
        print(f'{package_path.relative_to(ROOT)}: Stage A.2 verifier already registered.')


def main() -> None:
    patch_app(WINDOWS / 'static-preview' / 'app.js')
    patch_app(ANDROID / 'www' / 'app.js')
    append_verify(WINDOWS / 'package.json', 'scripts/verify_stage_a2_notifications.mjs')
    append_verify(ANDROID / 'package.json', 'scripts/verify-stage-a2-notifications.mjs')


if __name__ == '__main__':
    main()

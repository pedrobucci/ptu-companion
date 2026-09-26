#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
CLASSIFICATION = REPO / 'docs' / 'data' / 'PTU_FORMS_CLASSIFICATION.json'
INVENTORY = REPO / 'docs' / 'data' / 'PTU_FORMS_INVENTORY.json'
OUT_JSON = REPO / 'docs' / 'data' / 'PTU_FORM_ASSET_AUDIT.json'
OUT_MD = REPO / 'docs' / 'PTU_FORM_ASSET_AUDIT.md'
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.avif'}
KNOWN_ROOTS = (
    REPO / 'PTU_Companion_Android_Tauri' / 'www' / 'creatures',
    REPO / 'PTU_Companion_Windows_Source' / 'www' / 'creatures',
    REPO / 'PTU_Companion_Windows_Source' / 'creatures',
)


def slug(value: str) -> str:
    value = value.casefold().replace('♀', '-f').replace('♂', '-m')
    return re.sub(r'[^a-z0-9]+', '-', value).strip('-')


def collect_source_asset_references(node: Any, path: str = '$') -> list[dict]:
    refs: list[dict] = []
    if isinstance(node, dict):
        for key in sorted(node):
            value = node[key]
            child_path = f'{path}.{key}'
            lowered = key.casefold()
            if any(term in lowered for term in ('artwork', 'portrait', 'sprite', 'image')):
                if isinstance(value, str) and value.strip():
                    refs.append({'path': child_path, 'value': value.strip()})
                elif isinstance(value, list):
                    for index, item in enumerate(value):
                        if isinstance(item, str) and item.strip():
                            refs.append({'path': f'{child_path}[{index}]', 'value': item.strip()})
            refs.extend(collect_source_asset_references(value, child_path))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            refs.extend(collect_source_asset_references(value, f'{path}[{index}]'))
    return refs


def candidate_tokens(classification: dict, inventory: dict) -> set[str]:
    tokens: set[str] = set()
    for family in classification.get('families', []):
        tokens.add(slug(family.get('family', '')))
        for record in family.get('records', []):
            for key in ('species', 'family', 'formish_suffix'):
                value = record.get(key)
                if isinstance(value, str) and value.strip():
                    tokens.add(slug(value))
    for bucket in ('mega_forms', 'primal_forms', 'ultra_burst_forms'):
        for row in inventory.get(bucket, []):
            species = row.get('species')
            if isinstance(species, dict):
                species = species.get('name')
            if isinstance(species, str) and species.strip():
                tokens.add(slug(species))
            for key in ('name', 'form', 'form_name', 'header'):
                value = row.get(key)
                if isinstance(value, str) and value.strip():
                    tokens.add(slug(value))
    return {token for token in tokens if token}


def match_asset(stem: str, tokens: set[str]) -> dict | None:
    normalized = slug(stem)
    is_shiny = 'shiny' in normalized.split('-')
    without_shiny = '-'.join(part for part in normalized.split('-') if part != 'shiny')
    exact = sorted(token for token in tokens if without_shiny == token)
    prefixed = sorted(
        token for token in tokens
        if without_shiny.startswith(token + '-') or without_shiny.endswith('-' + token)
    )
    matches = exact or prefixed
    if not matches:
        return None
    return {
        'matched_token': max(matches, key=len),
        'kind': 'shiny' if is_shiny else ('normal' if exact else 'form'),
    }


def main() -> None:
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
    tokens = candidate_tokens(classification, inventory)

    scanned_roots: list[str] = []
    local_files: list[str] = []
    matched_assets: list[dict] = []
    for root in KNOWN_ROOTS:
        if not root.is_dir():
            continue
        scanned_roots.append(root.relative_to(REPO).as_posix())
        for path in sorted(root.rglob('*')):
            if not path.is_file() or path.suffix.casefold() not in IMAGE_EXTENSIONS:
                continue
            relative = path.relative_to(REPO).as_posix()
            local_files.append(relative)
            match = match_asset(path.stem, tokens)
            if match:
                matched_assets.append({'path': relative, **match})

    source_refs = collect_source_asset_references(inventory)
    payload = {
        'schema_version': 1,
        'policy': {
            'local_files_only_for_generated_artwork': True,
            'invent_urls': False,
            'shiny_is_independent': True,
            'note': 'Only explicit local files or explicit source metadata are inventoried. Missing normal/form/shiny artwork remains missing; no URL or filename is synthesized.'
        },
        'summary': {
            'scanned_roots': len(scanned_roots),
            'local_image_files': len(local_files),
            'candidate_asset_matches': len(matched_assets),
            'normal_matches': sum(1 for row in matched_assets if row['kind'] == 'normal'),
            'form_matches': sum(1 for row in matched_assets if row['kind'] == 'form'),
            'shiny_matches': sum(1 for row in matched_assets if row['kind'] == 'shiny'),
            'explicit_source_asset_references': len(source_refs),
        },
        'scanned_roots': scanned_roots,
        'local_image_files': local_files,
        'candidate_asset_matches': matched_assets,
        'explicit_source_asset_references': source_refs,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    lines = [
        '# PTU Form Asset Audit', '',
        'Deterministic audit of artwork available to the parametrized Forms catalog. It does not download artwork and does not invent remote URLs or filenames.', '',
        '## Summary', '',
        f'- Scanned local roots: **{len(scanned_roots)}**',
        f'- Local image files: **{len(local_files)}**',
        f'- Candidate normal matches: **{payload["summary"]["normal_matches"]}**',
        f'- Candidate form matches: **{payload["summary"]["form_matches"]}**',
        f'- Candidate shiny matches: **{payload["summary"]["shiny_matches"]}**',
        f'- Explicit inventory artwork/image references: **{len(source_refs)}**', '',
        '## Local roots', ''
    ]
    lines.extend(f'- `{root}`' for root in scanned_roots)
    if not scanned_roots:
        lines.append('- None found.')
    lines += ['', '## Candidate asset matches', '']
    if matched_assets:
        for row in matched_assets:
            lines.append(f'- `{row["path"]}` — {row["kind"]}; token `{row["matched_token"]}`')
    else:
        lines.append('- No local image filename safely matches an audited PTU form/species token.')
    lines += ['', '## Policy', '',
        '- Normal, form-specific, and shiny artwork are separate audit states.',
        '- Missing artwork remains unset so the Stage B resolver can use its existing fallback.',
        '- No remote URL is synthesized from Species number, name, form name, or third-party conventions.',
    ]
    OUT_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps(payload['summary'], sort_keys=True))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'scripts' / 'classify_ptu_form_families.py'

KNOWN_ANCHOR = "    'meowstic': ('permanent', 'baseFormId', 'source_explicit_variant', 'Male and Female are separately parameterized Species records in the supplied Pokédex.'),\n"
MELOETTA_KNOWN = "    'meloetta': ('transformation', 'activeFormId', 'source_explicit', 'Relic Song lets Meloetta switch between Aria Form and Step Form as a Swift Action when using the Move, or as a Standard Action otherwise; both forms use the same HP Stat.'),\n"
MELOETTA_DEFER = "    'meloetta': 'Aria/Step records exist, but the supplied audited sources did not establish the switching trigger/duration.',\n"
OLD_ASSERT = "    for family in ('wishiwashi', 'minior', 'eiscue'):\n"
NEW_ASSERT = "    for family in ('wishiwashi', 'minior', 'eiscue', 'meloetta'):\n"

text = TARGET.read_text(encoding='utf-8')

if MELOETTA_KNOWN not in text:
    if KNOWN_ANCHOR not in text:
        raise SystemExit('Meloetta patch anchor not found in KNOWN mapping')
    text = text.replace(KNOWN_ANCHOR, KNOWN_ANCHOR + MELOETTA_KNOWN, 1)

if MELOETTA_DEFER in text:
    text = text.replace(MELOETTA_DEFER, '', 1)

if OLD_ASSERT in text:
    text = text.replace(OLD_ASSERT, NEW_ASSERT, 1)
elif NEW_ASSERT not in text:
    raise SystemExit('Transformation assertion anchor not found')

if text.count("'meloetta':") != 1:
    raise SystemExit('Meloetta must appear exactly once in classifier mappings')
if MELOETTA_KNOWN not in text or NEW_ASSERT not in text:
    raise SystemExit('Meloetta source-backed classification patch incomplete')

TARGET.write_text(text, encoding='utf-8')
print('Meloetta classification resolved from PTU Core Relic Song rule.')

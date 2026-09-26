#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
DISCOVERY = REPO / 'docs' / 'data' / 'PTU_FORMS_DISCOVERY.json'
INVENTORY = REPO / 'docs' / 'data' / 'PTU_FORMS_INVENTORY.json'
SUPPLEMENTAL = REPO / 'docs' / 'data' / 'PTU_FORM_SUPPLEMENTAL_RULES.json'
OUT_JSON = REPO / 'docs' / 'data' / 'PTU_FORMS_CLASSIFICATION.json'
OUT_MD = REPO / 'docs' / 'PTU_FORMS_CLASSIFICATION.md'

# Classification is deliberately conservative. A separate source record proves that a
# variant exists, but does not by itself prove whether PTU treats switching as permanent,
# automatic, scene-limited, item-gated, etc. Unresolved runtime semantics stay deferred.
KNOWN = {
    'aegislash': ('transformation', 'activeFormId', 'source_explicit', 'Stance Change defines Shield/Sword switching and stat swaps.'),
    'arceus': ('runtime_state', 'runtime_resolver', 'source_explicit', 'Multitype changes Elemental Type directly; no separate Species record is needed.'),
    'basculin': ('permanent', 'baseFormId', 'source_explicit_variant', 'The supplied Species entry embeds Red/Blue Ability variants.'),
    'burmy': ('persistent_form', 'baseFormId', 'source_explicit', 'Quick Cloak creates Plant/Sandy/Trash cloaks; the cloak Typing becomes permanent on evolution to Wormadam.'),
    'castform': ('runtime_state', 'runtime_resolver', 'source_explicit', 'Forecast changes Type according to current weather.'),
    'cramorant': ('false_positive', 'none', 'source_explicit_non_form', 'The supplied Gulp Missile rule is a reaction effect and does not define a PTU Form state.'),
    'darmanitan': ('mixed', 'baseFormId+activeFormId', 'source_explicit', 'Standard is the base state; Zen Mode is an active transformation. Galarian Zen Snowed uses its own source action/duration.'),
    'deerling': ('persistent_form', 'baseFormId', 'source_explicit', 'Seasonal defines four source-backed seasonal states and a change action.'),
    'eiscue': ('transformation', 'activeFormId', 'source_explicit', 'Ice Face/Noice Face is controlled by Temporary HP from Ice Face.'),
    'furfrou': ('persistent_form', 'baseFormId', 'source_explicit', 'Fabulous Trim defines persistent hairstyle states changed at a hair parlor.'),
    'gourgeist': ('permanent', 'baseFormId', 'source_explicit_variant', 'The supplied entry embeds four size-specific Base Stat sets.'),
    'indeedee': ('permanent', 'baseFormId', 'source_explicit_variant', 'Male and Female are separately parameterized Species records in the supplied Pokédex.'),
    'lycanroc': ('permanent', 'baseFormId', 'source_explicit_variant', 'Midday, Midnight, and Dusk are separately parameterized evolution forms.'),
    'meowstic': ('permanent', 'baseFormId', 'source_explicit_variant', 'Male and Female are separately parameterized Species records in the supplied Pokédex.'),
    'meloetta': ('transformation', 'activeFormId', 'source_explicit', 'Relic Song lets Meloetta switch between Aria Form and Step Form as a Swift Action when using the Move, or as a Standard Action otherwise; both forms use the same HP Stat.'),
    'mimikyu': ('defer', 'none', 'source_insufficient', 'The supplied Species has Disguise, but the audited project sources do not yet define a separate PTU Form mechanic.'),
    'minior': ('transformation', 'activeFormId', 'source_explicit', 'Shields Down defines Meteor/Core switching by HP state.'),
    'morpeko': ('runtime_state', 'runtime_resolver', 'source_explicit', 'Hunger Switch defines per-turn Full Belly/Hangry bonuses but no separate stat block.'),
    'necrozma': ('mixed', 'baseFormId+activeFormId', 'source_explicit_effects', 'Base/Dusk Mane/Dawn Wings are persistent Viral Fusion states; Ultra Burst is a separate active transformation whose activation requirement is still source-insufficient.'),
    'nidoran-f': ('false_positive', 'none', 'distinct_species', 'Nidoran Female is already a distinct Species record, not a Form of Nidoran Male.'),
    'nidoran-m': ('false_positive', 'none', 'distinct_species', 'Nidoran Male is already a distinct Species record, not a Form of Nidoran Female.'),
    'oricorio': ('defer', 'none', 'source_insufficient', 'The Species references Nectar Dancer/Forme Change, but the switching rule was not found in the audited supplied sources.'),
    'pumpkaboo': ('permanent', 'baseFormId', 'source_explicit_variant', 'The supplied entry embeds four size-specific Base Stat sets.'),
    'sawsbuck': ('persistent_form', 'baseFormId', 'source_explicit', 'Seasonal defines four source-backed seasonal states and a change action.'),
    'silvally': ('runtime_state', 'runtime_resolver', 'source_explicit', 'RKS System changes Type to the held Memory Disc Type.'),
    'solosis': ('false_positive', 'none', 'no_independent_form_signal', 'The hardened audit found no independent Form signal beyond the first heuristic census.'),
    'wishiwashi': ('transformation', 'activeFormId', 'source_explicit', 'Schooling defines Solo/Schooling states with HP/Temporary HP rules.'),
    'wormadam': ('permanent', 'baseFormId', 'source_explicit', 'Plant/Sandy/Trash cloak Typing is permanent after Burmy evolves into Wormadam.'),
    'zacian': ('mixed', 'baseFormId+activeFormId', 'source_explicit', 'Hero is the base state; Weapon Bond with Ancestral Sword enters Crowned Sword until its source-defined end condition.'),
    'zamazenta': ('mixed', 'baseFormId+activeFormId', 'source_explicit', 'Hero is the base state; Weapon Bond with Ancestral Shield enters Crowned Shield until its source-defined end condition.'),
    'zygarde': ('mixed', 'baseFormId+activeFormId', 'source_explicit', 'Zygarde Cube manages persistent 10%/50% states; Power Construct creates Complete Forme as an active transformation.'),
}

DEFER_FAMILIES = {
    'deoxys': 'Forme Change/Multiform records exist, but the switching rule/duration was not found.',
    'giratina': 'Altered/Origin records exist, but the Origin switching requirement was not found.',
    'hoopa': 'Confined/Unbound records exist, but the switching requirement/duration was not found.',
    'kyurem': 'Normal/Black/White Fusion records exist, but Dragon Fusion rules were not found in the audited supplied sources.',
    'landorus': 'Incarnate/Therian records exist, but Therian Forme switching rules were not found.',
    'rotom': 'Normal/appliance records exist and are mechanically distinct, but the Forme Change requirement was not found.',
    'shaymin': 'Land/Sky records exist, but the Sky Forme switching requirement/duration was not found.',
    'thundurus': 'Incarnate/Therian records exist, but Therian Forme switching rules were not found.',
    'tornadus': 'Incarnate/Therian records exist, but Therian Forme switching rules were not found.',
}


def aggregate_signals(records: list[dict]) -> list[str]:
    return sorted({signal for row in records for signal in row.get('signals', [])})


def classify(family: str, records: list[dict]) -> dict:
    if family in KNOWN:
        classification, target, evidence, reason = KNOWN[family]
    elif family in DEFER_FAMILIES:
        classification, target, evidence, reason = 'defer', 'none', 'source_insufficient', DEFER_FAMILIES[family]
    else:
        signals = aggregate_signals(records)
        # Regional entries are independently parameterized PTU Species variants and can be
        # represented safely as persistent/base Forms without inventing a runtime trigger.
        if any(signal.startswith('regional_name:') for signal in signals):
            classification, target, evidence = 'permanent', 'baseFormId', 'source_explicit_variant'
            reason = 'The supplied Pokédex contains a separately parameterized regional variant. Preserve legacy Species IDs as aliases/import compatibility while moving selection to the generic base Form layer.'
        else:
            classification, target, evidence = 'defer', 'none', 'source_insufficient'
            reason = 'The source establishes a candidate variant signal, but the audited material is insufficient to assign safe base/transformation/runtime semantics.'
    return {
        'family': family,
        'classification': classification,
        'target_layer': target,
        'evidence_status': evidence,
        'records': records,
        'signals': aggregate_signals(records),
        'reason': reason,
        'preserve_legacy_ids': classification in {'permanent', 'persistent_form', 'mixed'} or any(r.get('variant_of') for r in records),
    }


def main() -> None:
    discovery = json.loads(DISCOVERY.read_text(encoding='utf-8'))
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8'))
    supplemental = json.loads(SUPPLEMENTAL.read_text(encoding='utf-8'))
    families = [classify(entry['family'], entry['records']) for entry in discovery.get('families', [])]

    # Synthetic transformation families are source blocks rather than candidate Species rows.
    synthetic = [
        {
            'family': 'mega-evolution',
            'classification': 'transformation',
            'target_layer': 'activeFormId',
            'evidence_status': 'source_explicit_effects',
            'form_count': len(inventory.get('mega_forms', [])),
            'species_count': len({row['species']['name'] for row in inventory.get('mega_forms', [])}),
            'requirement_status': 'generic_rule_explicit_specific_item_ids_incomplete',
            'reason': 'PTU Core defines Mega Evolution as a temporary transformation. Generic Form requirements should represent Mega Ring + species/form-specific Mega Stone without hardcoding Mega logic; missing stable item IDs are not fabricated.'
        },
        {
            'family': 'primal-reversion',
            'classification': 'transformation',
            'target_layer': 'activeFormId',
            'evidence_status': 'source_explicit_effects',
            'form_count': len(inventory.get('primal_forms', [])),
            'requirement_status': 'source_insufficient',
            'reason': 'Kyogre and Groudon have explicit Primal Reversion transformation blocks, but this audit does not invent an activation requirement not present in the supplied structured sources.'
        },
        {
            'family': 'ultra-burst',
            'classification': 'transformation',
            'target_layer': 'activeFormId',
            'evidence_status': 'source_explicit_effects_activation_missing',
            'form_count': len(inventory.get('ultra_burst_forms', [])),
            'requirement_status': 'source_insufficient',
            'reason': 'Dusk Mane and Dawn Wings both have explicit Ultra Burst effects; no activation requirement was found in the supplied project sources, so none is inferred.'
        }
    ]

    counts = Counter(row['classification'] for row in families)
    deferred = [row['family'] for row in families if row['classification'] == 'defer']
    false_positive = [row['family'] for row in families if row['classification'] == 'false_positive']
    candidate_ids = {record['id'] for family in families for record in family['records']}
    expected_ids = {record['id'] for entry in discovery.get('families', []) for record in entry['records']}
    if candidate_ids != expected_ids:
        raise SystemExit('Classification lost candidate records')
    if len(inventory.get('mega_forms', [])) != 48:
        raise SystemExit('Mega inventory must contain 48 forms')
    if len(inventory.get('primal_forms', [])) != 2:
        raise SystemExit('Primal inventory must contain 2 forms')
    if len(inventory.get('ultra_burst_forms', [])) != 2:
        raise SystemExit('Ultra Burst inventory must contain 2 source blocks')

    family_lookup = {row['family']: row for row in families}
    for family in ('cramorant', 'nidoran-f', 'nidoran-m', 'solosis'):
        if family in family_lookup and family_lookup[family]['classification'] != 'false_positive':
            raise SystemExit(f'{family} must remain a false positive until new supplied-source evidence exists')
    for family in ('wishiwashi', 'minior', 'eiscue', 'meloetta'):
        if family in family_lookup and family_lookup[family]['classification'] != 'transformation':
            raise SystemExit(f'{family} must be a source-backed transformation')
    for family in ('silvally', 'morpeko', 'arceus', 'castform'):
        if family in family_lookup and family_lookup[family]['classification'] != 'runtime_state':
            raise SystemExit(f'{family} must be a source-backed runtime state')

    payload = {
        'schema_version': 1,
        'policy': 'Conservative source-backed classification. Deferred families are not converted into automatic runtime Forms until supplied sources establish the missing semantics.',
        'summary': {
            'candidate_records': len(expected_ids),
            'candidate_families': len(families),
            'classification_counts': dict(sorted(counts.items())),
            'deferred_families': deferred,
            'false_positive_families': false_positive,
            'mega_forms': len(inventory.get('mega_forms', [])),
            'primal_forms': len(inventory.get('primal_forms', [])),
            'ultra_burst_forms': len(inventory.get('ultra_burst_forms', [])),
            'supplemental_rules': len(supplemental.get('rules', [])),
        },
        'families': families,
        'synthetic_transform_families': synthetic,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    lines = [
        '# PTU Forms Family Classification', '',
        'This is the conversion gate between source discovery and default `.ptucp` mutation. Classification is conservative: a separately parameterized record proves that a variant exists, but runtime switching semantics are not invented.', '',
        '## Summary', '',
        f'- Candidate records classified: **{len(expected_ids)}**',
        f'- Candidate families classified: **{len(families)}**',
        f'- Permanent/base families: **{counts.get("permanent", 0)}**',
        f'- Persistent-form families: **{counts.get("persistent_form", 0)}**',
        f'- Transformation families: **{counts.get("transformation", 0)}**',
        f'- Runtime-state families: **{counts.get("runtime_state", 0)}**',
        f'- Mixed base + transformation families: **{counts.get("mixed", 0)}**',
        f'- Deferred/source-insufficient families: **{counts.get("defer", 0)}**',
        f'- False-positive families: **{counts.get("false_positive", 0)}**',
        f'- Synthetic transform inventory: **48 Mega + 2 Primal + 2 Ultra Burst source blocks**.', '',
        '## Family decisions', '',
        '| Family | Classification | Target | Evidence | Records | Decision |',
        '|---|---|---|---|---:|---|'
    ]
    for row in families:
        lines.append(f'| {row["family"]} | {row["classification"]} | `{row["target_layer"]}` | {row["evidence_status"]} | {len(row["records"])} | {row["reason"]} |')
    lines += ['', '## Synthetic transformation families', '']
    for row in synthetic:
        count = row.get('form_count', '—')
        lines.append(f'- **{row["family"]}** — {row["classification"]} → `{row["target_layer"]}`; forms: {count}; requirement: `{row["requirement_status"]}`. {row["reason"]}')
    lines += ['', '## Deferred queue', '']
    if deferred:
        for family in deferred:
            lines.append(f'- `{family}` — requires additional supplied-source evidence before automatic conversion/runtime switching.')
    else:
        lines.append('- None.')
    lines += ['', '## False positives', '']
    if false_positive:
        for family in false_positive:
            lines.append(f'- `{family}` — not promoted to the generic Forms layer by the current supplied-source evidence.')
    else:
        lines.append('- None.')
    lines += ['', '## Conversion rule', '',
        'Default packs must only convert families whose target layer is established above. Deferred families may be inventoried/displayed, but automatic requirements, durations, item gates, stat swaps, or form transitions must not be fabricated. Legacy Species IDs should remain import aliases where a permanent/persistent family is consolidated into `baseFormId`.'
    ]
    OUT_MD.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps(payload['summary'], ensure_ascii=False, sort_keys=True))

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
DATA = REPO / 'docs' / 'data'
REVIEW = DATA / 'PTU_FORMS_DEFERRED_SOURCE_REVIEW_4.json'
CLASSIFICATION = DATA / 'PTU_FORMS_CLASSIFICATION.json'
STAGE_B = DATA / 'PTU_FORMS_STAGE_B.json'

EXPECTED_DEFERRED = {
    'deoxys', 'giratina', 'hoopa', 'kyurem', 'landorus',
    'oricorio', 'rotom', 'shaymin', 'thundurus', 'tornadus',
}
EXPECTED_CROSS_FINDINGS = {
    'forme-change-is-not-a-trigger',
    'gen8ish-special-capabilities-are-labels-only',
    'common-main-series-trigger-names-not-imported',
}


def main() -> None:
    review = json.loads(REVIEW.read_text(encoding='utf-8'))
    classification = json.loads(CLASSIFICATION.read_text(encoding='utf-8'))
    stage_b = json.loads(STAGE_B.read_text(encoding='utf-8'))

    assert review['schema_version'] == 2
    assert review['review_pass'] == 4
    assert review['result'] == {
        'families_reviewed': 10,
        'families_reclassified': 0,
        'families_still_deferred': 10,
    }
    assert set(review['deferred_families']) == EXPECTED_DEFERRED

    cross = {row['id']: row for row in review['cross_family_findings']}
    assert set(cross) == EXPECTED_CROSS_FINDINGS
    assert 'Move, Ability, or other effect' in cross['forme-change-is-not-a-trigger']['finding']
    assert 'not sufficient' in cross['forme-change-is-not-a-trigger']['consequence']
    assert all(cross[key].get('finding') and cross[key].get('consequence') for key in cross)

    reviewed = {row['family']: row for row in review['families']}
    assert set(reviewed) == EXPECTED_DEFERRED
    for family, row in reviewed.items():
        assert row['status'] == 'defer', (family, row)
        assert row['decision'] == 'remain_deferred', (family, row)
        assert row.get('positive_evidence'), family
        assert row.get('new_pass_4_finding'), family
        assert row.get('missing_semantics'), family

    classified = {row['family']: row for row in classification['families']}
    assert set(classification['summary']['deferred_families']) == EXPECTED_DEFERRED
    assert classification['summary']['classification_counts']['defer'] == 10
    for family in EXPECTED_DEFERRED:
        assert classified[family]['classification'] == 'defer', classified[family]
        assert classified[family]['target_layer'] == 'none', classified[family]

    emitted = {row['family'] for row in stage_b.get('candidate_families', [])}
    assert not (EXPECTED_DEFERRED & emitted), sorted(EXPECTED_DEFERRED & emitted)
    omitted = {row['family'] for row in stage_b.get('not_materialized', [])}
    assert EXPECTED_DEFERRED <= omitted, sorted(EXPECTED_DEFERRED - omitted)

    print(json.dumps({
        'review_pass': review['review_pass'],
        'reviewed': len(reviewed),
        'reclassified': review['result']['families_reclassified'],
        'still_deferred': len(EXPECTED_DEFERRED),
        'cross_family_findings': len(cross),
        'stage_b_deferred_emitted': len(EXPECTED_DEFERRED & emitted),
    }, sort_keys=True))


if __name__ == '__main__':
    main()

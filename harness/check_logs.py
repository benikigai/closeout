"""Independently check emitted observations against the published pass rules."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import sys

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
FIELDS = {
    'T-OPT-01': {'uniformity', 'cal_applied'},
    'T-TCH-01': {'baseline_drift', 'nest_closed_at_ms'},
    'T-AUD-01': {'snr_db', 'unit_temp_c'},
    'T-IMU-01': {'bias_dps'},
    'T-BLE-01': {'rssi_dbm'},
    'T-PWR-01': {'rail_mv'},
}


def expected_result(test_id, measured):
    # Deliberately independent of the generator's implementation.
    if test_id == 'T-OPT-01':
        valid = 0 <= measured['uniformity'] <= 1 and measured['cal_applied'] in (0, 1)
        passed = measured['uniformity'] < .05
    elif test_id == 'T-TCH-01':
        valid = measured['baseline_drift'] >= 0 and measured['nest_closed_at_ms'] >= 0
        passed = measured['baseline_drift'] < 30
    elif test_id == 'T-AUD-01':
        valid, passed = True, measured['snr_db'] > 18
    elif test_id == 'T-IMU-01':
        valid, passed = measured['bias_dps'] >= 0, measured['bias_dps'] < .5
    elif test_id == 'T-BLE-01':
        valid, passed = True, measured['rssi_dbm'] > -75
    elif test_id == 'T-PWR-01':
        valid, passed = True, 3250 <= measured['rail_mv'] <= 3350
    else:
        raise ValueError(f'Unknown test: {test_id}')
    if not valid:
        raise ValueError(f'Invalid measurement range for {test_id}')
    return 'pass' if passed else 'fail'


def check_records(records, known_bad, seed, units):
    schema = json.loads((ROOT / 'contracts/log-record.schema.json').read_text())
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    if (set(known_bad) != {'unit_ids', 'reason'} or known_bad['reason'] != 'dome_defect'
            or not isinstance(known_bad['unit_ids'], list) or not known_bad['unit_ids']
            or any(not isinstance(uid, str) for uid in known_bad['unit_ids'])
            or len(known_bad['unit_ids']) != len(set(known_bad['unit_ids']))):
        raise ValueError('Invalid known-bad manifest')
    by_unit = defaultdict(dict)
    failed = Counter()
    for row in records:
        validator.validate(row)
        uid, test_id = row['unit_id'], row['test_id']
        if row['seed'] != seed or row['station'] != 'S8-functional-pack':
            raise ValueError('Seed or station mismatch')
        if test_id not in FIELDS or set(row.get('measured', {})) != FIELDS[test_id]:
            raise ValueError(f'Measured field mismatch: {uid} {test_id}')
        if not row.get('timestamp') or datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00')).tzinfo is None:
            raise ValueError('Timestamp must be an explicit UTC offset time')
        if any(type(value) not in (int, float) or not math.isfinite(value)
               for value in row['measured'].values()):
            raise ValueError('Measurements must be finite numbers')
        if test_id in by_unit[uid]:
            raise ValueError(f'Duplicate test: {uid} {test_id}')
        if row['result'] != expected_result(test_id, row['measured']):
            raise ValueError(f'Result does not match pass rule: {uid} {test_id}')
        by_unit[uid][test_id] = row
        failed[test_id] += row['result'] == 'fail'
    if len(by_unit) != units or any(set(rows) != set(FIELDS) for rows in by_unit.values()):
        raise ValueError('Every unit must have exactly the six contracted tests')
    for uid in known_bad['unit_ids']:
        row = by_unit.get(uid, {}).get('T-OPT-01')
        if row is None or row['result'] != 'fail' or row['measured']['uniformity'] != .22:
            raise ValueError(f'Known-bad negative control failed: {uid}')
    unit_failures = sum(any(r['result'] == 'fail' for r in rows.values()) for rows in by_unit.values())
    return {
        'truth_label': 'simulated', 'seed': seed, 'units_tested': units,
        'records_checked': len(records), 'units_failed': unit_failures,
        'unit_failure_rate': unit_failures / units, 'known_bad_count': len(known_bad['unit_ids']),
        'tests': {test: {'tested': units, 'failed': failed[test], 'failure_rate': failed[test] / units}
                  for test in sorted(FIELDS)},
    }


def check_build(directory):
    directory = Path(directory)
    raw = (directory / 'logs.jsonl').read_bytes()
    manifest = json.loads((directory / 'build.json').read_text())
    if hashlib.sha256(raw).hexdigest() != manifest['logs_sha256']:
        raise ValueError('Log digest does not match manifest')
    records = [json.loads(line) for line in raw.splitlines()]
    if len(records) != manifest['records'] or manifest['truth_label'] != 'simulated':
        raise ValueError('Manifest record count or truth label mismatch')
    known_bad = json.loads((directory / 'sealed/known-bad.json').read_text())
    return check_records(records, known_bad, manifest['seed'], manifest['units'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    try:
        summary = check_build(args.directory)
    except Exception as error:
        print(f'Check failed: {error}', file=sys.stderr)
        return 1
    print(json.dumps(summary, indent=2, sort_keys=True, allow_nan=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())

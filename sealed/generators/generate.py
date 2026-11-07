"""Deterministic observations for the three published faults, never firmware code."""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import random

TEST_IDS = ('T-OPT-01', 'T-TCH-01', 'T-AUD-01', 'T-IMU-01', 'T-BLE-01', 'T-PWR-01')
KNOWN_BAD_IDS = ('U-0001', 'U-0002')
EPOCH = datetime(2026, 11, 7, 18, 45, tzinfo=timezone.utc)


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()


def expected_measurements(hal, calibration_applied=None):
    """Fixture expectations; the optional readback tests the physical negative control."""
    cal = int(hal['driver_ready_ms'] <= 50) if calibration_applied is None else calibration_applied
    if cal not in (0, 1):
        raise ValueError('Calibration readback must be 0 or 1')
    uniformity = 0.22 if hal['dome_defect'] else (0.02 if cal else 0.18)
    return {
        'T-OPT-01': {'uniformity': uniformity, 'cal_applied': cal},
        'T-TCH-01': {'baseline_drift': 85 if hal['nest_settle_ms'] > 40 else 8,
                     'nest_closed_at_ms': 0},
        'T-AUD-01': {'snr_db': 11 if hal['unit_temp_c'] > 45 else 24,
                     'unit_temp_c': hal['unit_temp_c']},
        'T-IMU-01': {'bias_dps': 0.12},
        'T-BLE-01': {'rssi_dbm': -48},
        'T-PWR-01': {'rail_mv': 3300},
    }


def result_for(test_id, measured):
    passed = {
        'T-OPT-01': lambda: measured['uniformity'] < 0.05,
        'T-TCH-01': lambda: measured['baseline_drift'] < 30,
        'T-AUD-01': lambda: measured['snr_db'] > 18,
        'T-IMU-01': lambda: measured['bias_dps'] < 0.5,
        'T-BLE-01': lambda: measured['rssi_dbm'] > -75,
        'T-PWR-01': lambda: 3250 <= measured['rail_mv'] <= 3350,
    }[test_id]()
    return 'pass' if passed else 'fail'


def build(seed, units=128, firmware_version='0.1.0-buggy'):
    if type(seed) is not int or type(units) is not int or units < 6 or units > 9999:
        raise ValueError('Seed must be an integer and unit count must be 6..9999')
    if not isinstance(firmware_version, str) or not firmware_version.strip():
        raise ValueError('Firmware version must be a nonempty string')
    rng = random.Random(seed)
    # Anchor examples keep small smoke builds useful; remaining assignments use the seed.
    faults = ['known_bad', 'known_bad', 'cold_dome', 'ghost_hold', 'hot_queue', 'nominal']
    for _ in range(units - len(faults)):
        p = rng.random()
        faults.append('cold_dome' if p < .25 else 'ghost_hold' if p < .45 else
                      'hot_queue' if p < .65 else 'nominal')
    # Known-bad identities are stable; seeded faults move among the remaining units.
    movable = faults[2:]
    rng.shuffle(movable)
    faults[2:] = movable
    records, hidden = [], []
    for index, fault in enumerate(faults):
        unit_id = f'U-{index + 1:04d}'
        temp = 18 if fault == 'cold_dome' else 52 if fault == 'hot_queue' else 24
        hal = {
            'unit_id': unit_id,
            'driver_ready_ms': 180 if fault == 'cold_dome' else 20,
            'nest_settle_ms': 120 if fault == 'ghost_hold' else 20,
            'unit_temp_c': temp,
            'dome_defect': int(fault == 'known_bad'),
        }
        hidden.append(hal)
        # Some warm units share lot B, so a lot alone is not proof of a cause.
        lot = 'LOT-B' if fault == 'cold_dome' or rng.random() < .45 else 'LOT-A'
        shift = 'early' if fault == 'cold_dome' else rng.choice(('early', 'middle', 'late'))
        observations = expected_measurements(hal)
        for test_index, test_id in enumerate(TEST_IDS):
            measured = observations[test_id]
            timestamp = EPOCH + timedelta(seconds=index * 60 + test_index)
            records.append({
                'unit_id': unit_id, 'station': 'S8-functional-pack', 'test_id': test_id,
                'result': result_for(test_id, measured), 'measured': measured,
                'lot_id': lot, 'shift': shift, 'firmware_version': firmware_version,
                'timestamp': timestamp.isoformat().replace('+00:00', 'Z'), 'seed': seed,
            })
    logs = b''.join(json_bytes(row) for row in records)
    return {
        'logs.jsonl': logs,
        'sealed/hal.json': json_bytes({'seed': seed, 'units': hidden}),
        'sealed/known-bad.json': json_bytes({'unit_ids': list(KNOWN_BAD_IDS), 'reason': 'dome_defect'}),
        'build.json': json_bytes({'generator_version': 1, 'truth_label': 'simulated',
                                  'seed': seed, 'units': units, 'records': len(records),
                                  'firmware_version': firmware_version,
                                  'logs_sha256': hashlib.sha256(logs).hexdigest()}),
    }


def write_build(output, files):
    output = Path(output)
    # Preflight all conflicts so a rejected write does not leave a partial build.
    for relative, data in files.items():
        target = output / relative
        if target.exists() and (not target.is_file() or target.read_bytes() != data):
            raise FileExistsError(f'Refusing to replace differing output: {target}')
    for relative, data in files.items():
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seed', type=int, required=True)
    parser.add_argument('--units', type=int, default=128)
    parser.add_argument('--firmware-version', default='0.1.0-buggy')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        files = build(args.seed, args.units, args.firmware_version)
        write_build(args.output, files)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(files['build.json'].decode(), end='')


if __name__ == '__main__':
    main()

import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gen = load('generator', 'sealed/generators/generate.py')
checker = load('checker', 'harness/check_logs.py')


class GeneratorTests(unittest.TestCase):
    def records(self, seed=7, units=128):
        files = gen.build(seed, units)
        return files, [json.loads(line) for line in files['logs.jsonl'].splitlines()]

    def test_seed_reproduces_all_files_across_processes(self):
        with tempfile.TemporaryDirectory() as directory:
            for suffix, hashseed in [('one', '1'), ('two', '987')]:
                subprocess.run([sys.executable, str(ROOT / 'sealed/generators/generate.py'),
                                '--seed', '7', '--output', str(Path(directory) / suffix)],
                               env={**os.environ, 'PYTHONHASHSEED': hashseed, 'TZ': 'UTC'},
                               check=True, capture_output=True)
            first, second = Path(directory) / 'one', Path(directory) / 'two'
            paths = sorted(p.relative_to(first) for p in first.rglob('*') if p.is_file())
            self.assertEqual(len(paths), 4)
            self.assertEqual(paths, sorted(p.relative_to(second) for p in second.rglob('*') if p.is_file()))
            for path in paths:
                self.assertEqual((first / path).read_bytes(), (second / path).read_bytes())

    def test_fresh_seed_changes_logs_and_preserves_negative_control(self):
        demo, _ = self.records(7)
        heldout, _ = self.records(29)
        self.assertNotEqual(demo['logs.jsonl'], heldout['logs.jsonl'])
        self.assertEqual(demo['sealed/known-bad.json'], heldout['sealed/known-bad.json'])

    def test_all_records_validate_and_all_faults_remain_visible(self):
        for seed in range(40):
            with self.subTest(seed=seed):
                files, records = self.records(seed)
                summary = checker.check_records(records, json.loads(files['sealed/known-bad.json']), seed, 128)
                self.assertEqual(summary['records_checked'], 768)
                self.assertEqual(summary['known_bad_count'], 2)
                for test in ('T-OPT-01', 'T-TCH-01', 'T-AUD-01'):
                    self.assertGreater(summary['tests'][test]['failed'], 0)
                    self.assertLess(summary['tests'][test]['failed'], 128)
                self.assertTrue(all('known_bad' not in r for r in records))
                self.assertTrue(all('hidden_cause' not in r and 'dome_defect' not in r for r in records))

    def test_contract_hal_values_and_physical_failure_after_calibration(self):
        files, _ = self.records()
        hals = json.loads(files['sealed/hal.json'])['units']
        cold = next(h for h in hals if h['driver_ready_ms'] == 180)
        self.assertEqual(gen.expected_measurements(cold)['T-OPT-01'], {'uniformity': .18, 'cal_applied': 0})
        slow = next(h for h in hals if h['nest_settle_ms'] == 120)
        self.assertEqual(gen.expected_measurements(slow)['T-TCH-01']['baseline_drift'], 85)
        hot = next(h for h in hals if h['unit_temp_c'] == 52)
        self.assertEqual(gen.expected_measurements(hot)['T-AUD-01']['snr_db'], 11)
        for h in hals:
            if h['dome_defect']:
                for cal in (0, 1):
                    measured = gen.expected_measurements(h, calibration_applied=cal)['T-OPT-01']
                    self.assertEqual(measured['uniformity'], .22)
                    self.assertEqual(gen.result_for('T-OPT-01', measured), 'fail')

    def test_checker_rejects_false_pass_missing_test_and_nonfinite_value(self):
        files, records = self.records()
        known = json.loads(files['sealed/known-bad.json'])
        bad_pass = copy.deepcopy(records)
        bad_pass[0]['result'] = 'pass'
        with self.assertRaisesRegex(ValueError, 'pass rule'):
            checker.check_records(bad_pass, known, 7, 128)
        with self.assertRaisesRegex(ValueError, 'six contracted tests'):
            checker.check_records(records[:-1], known, 7, 128)
        nonfinite = copy.deepcopy(records)
        nonfinite[0]['measured']['uniformity'] = float('nan')
        with self.assertRaisesRegex(ValueError, 'finite'):
            checker.check_records(nonfinite, known, 7, 128)

    def test_pass_rule_boundaries(self):
        for test, field, threshold, other, expected in [
            ('T-OPT-01', 'uniformity', .05, {'cal_applied': 1}, 'fail'),
            ('T-TCH-01', 'baseline_drift', 30, {'nest_closed_at_ms': 0}, 'fail'),
            ('T-AUD-01', 'snr_db', 18, {'unit_temp_c': 24}, 'fail'),
            ('T-IMU-01', 'bias_dps', .5, {}, 'fail'),
            ('T-BLE-01', 'rssi_dbm', -75, {}, 'fail'),
            ('T-PWR-01', 'rail_mv', 3250, {}, 'pass'),
            ('T-PWR-01', 'rail_mv', 3350, {}, 'pass'),
        ]:
            with self.subTest(test=test, threshold=threshold):
                measurement = {field: threshold, **other}
                self.assertEqual(checker.expected_result(test, measurement), expected)
                self.assertEqual(gen.result_for(test, measurement), expected)

    def test_write_is_idempotent_and_refuses_differing_build(self):
        with tempfile.TemporaryDirectory() as directory:
            files = gen.build(7)
            gen.write_build(directory, files)
            gen.write_build(directory, files)
            self.assertEqual(checker.check_build(directory)['units_tested'], 128)
            with self.assertRaises(FileExistsError):
                gen.write_build(directory, gen.build(29))
            self.assertEqual((Path(directory) / 'logs.jsonl').read_bytes(), files['logs.jsonl'])

    def test_saved_receipts_reproduce_from_their_seeds(self):
        receipt = json.loads((ROOT / 'harness/task-2-results.json').read_text())
        for saved in receipt['builds']:
            files, records = self.records(saved['seed'], saved['units_tested'])
            actual = checker.check_records(records, json.loads(files['sealed/known-bad.json']),
                                           saved['seed'], saved['units_tested'])
            actual['build_role'] = saved['build_role']
            actual['logs_sha256'] = json.loads(files['build.json'])['logs_sha256']
            self.assertEqual(actual, saved)

    def test_minimum_build_and_invalid_arguments(self):
        files, records = self.records(7, 6)
        self.assertEqual(checker.check_records(records, json.loads(files['sealed/known-bad.json']), 7, 6)['records_checked'], 36)
        for seed, units in [(True, 128), (1, 5), (1, 10000)]:
            with self.assertRaises(ValueError):
                gen.build(seed, units)


if __name__ == '__main__':
    unittest.main()

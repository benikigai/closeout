import json
from collections import Counter
from pathlib import Path
import unittest

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]


class FailureLibraryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = json.loads((ROOT / 'library/failure-library.json').read_text())
        cls.schema = json.loads((ROOT / 'contracts/failure-library.schema.json').read_text())

    def test_entries_match_published_schema(self):
        Draft202012Validator.check_schema(self.schema)
        validator = Draft202012Validator(self.schema)
        self.assertEqual(len(self.entries), 24)
        for entry in self.entries:
            with self.subTest(entry=entry['id']):
                validator.validate(entry)
                for value in entry.values():
                    if isinstance(value, str):
                        self.assertTrue(value.strip())
        self.assertEqual(len({e['id'] for e in self.entries}), 24)

    def test_category_coverage_and_stations(self):
        categories = set(self.schema['properties']['category_true']['enum'])
        stations = {
            'S1-shell', 'S2-pcba', 'S3-screws', 'S4-speaker-haptic',
            'S5-battery', 'S6-dome-bond', 'S7-flash-cal', 'S8-functional-pack',
        }
        for field in ('category_initial', 'category_true'):
            counts = Counter(entry[field] for entry in self.entries)
            self.assertEqual(set(counts), categories)
            self.assertGreaterEqual(min(counts.values()), 2)
        self.assertTrue(all(entry['station'] in stations for entry in self.entries))

    def test_only_contract_faults_are_seeded(self):
        seeded = {e['failure_name']: e for e in self.entries if e['seeded']}
        self.assertEqual(set(seeded), {'Cold Dome', 'Ghost Hold', 'Hot Queue'})
        self.assertEqual(seeded['Cold Dome']['category_initial'], 'Material')
        self.assertEqual(seeded['Ghost Hold']['category_initial'], 'Test Station')
        self.assertEqual(seeded['Hot Queue']['category_initial'], 'Material')
        self.assertTrue(all(e['category_true'] == 'Firmware' for e in seeded.values()))
        for name, tokens in {
            'Cold Dome': ('180', 't=50', '20', 'readback'),
            'Ghost Hold': ('t=40', '120'),
            'Hot Queue': ('45 C', '52 C'),
        }.items():
            for token in tokens:
                self.assertIn(token, seeded[name]['hidden_cause'])
        self.assertIn('0.18', seeded['Cold Dome']['symptom_in_logs'])
        self.assertIn('0.02', seeded['Cold Dome']['symptom_in_logs'])
        self.assertIn('0.22', seeded['Cold Dome']['fa_test_that_discriminates'])
        self.assertIn('85', seeded['Ghost Hold']['symptom_in_logs'])
        self.assertIn('8', seeded['Ghost Hold']['symptom_in_logs'])
        self.assertIn('11', seeded['Hot Queue']['symptom_in_logs'])
        self.assertIn('24', seeded['Hot Queue']['symptom_in_logs'])


if __name__ == '__main__':
    unittest.main()

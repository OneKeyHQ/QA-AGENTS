"""Offline contracts for compact fixtures; never connects to OneKey."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

BASE = Path(__file__).parent


class FixtureGenerationTests(unittest.TestCase):
    def run_generator(self, base, *args):
        return subprocess.run([sys.executable, '-B', str(base/'generate.py'), *args],
                              text=True, capture_output=True)

    def test_default_check_does_not_write_files(self):
        before = {p.name: p.read_bytes() for p in BASE.iterdir() if p.is_file()}
        result = self.run_generator(BASE)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((BASE/'indicators.json').exists())
        self.assertEqual(before, {p.name: p.read_bytes() for p in BASE.iterdir() if p.is_file()})

    def test_expansion_preserves_indicator_and_drawing_contracts(self):
        with tempfile.TemporaryDirectory() as out:
            result = self.run_generator(BASE, '--output', out)
            self.assertEqual(result.returncode, 0, result.stderr)
            indicators = json.loads((Path(out)/'indicators.json').read_text())
            self.assertEqual(set(indicators['variants']), {'mixed', 'short', 'zero-volume'})
            self.assertEqual(indicators['variants']['mixed']['expected']['MA']['line2'][2], 101)
            self.assertEqual(indicators['variants']['short']['expected']['MA']['line2'], [None, None])
            self.assertEqual(indicators['variants']['zero-volume']['expected']['VOL']['volume'], [0]*20)
            drawings = json.loads((Path(out)/'drawings.json').read_text())
            tools = {t['tool']: t for t in drawings['tool_oracles']}
            self.assertEqual(len(tools), 90)
            self.assertEqual(tools['trend']['anchors'], ['A', 'B'])
            self.assertEqual(tools['brush']['anchors'], list('ABCDEFGH'))
            self.assertFalse(tools['measure']['permanent'])
            self.assertEqual(tools['elliottTriple']['point_labels'], ['0', 'W', 'X', 'Y', 'X', 'Z'])

    def test_changed_fixture_is_rejected_before_writing_output(self):
        with tempfile.TemporaryDirectory() as root:
            copied, out = Path(root)/'source', Path(root)/'output'
            shutil.copytree(BASE, copied, ignore=shutil.ignore_patterns('__pycache__'))
            path = copied/'drawings.json'
            data = json.loads(path.read_text())
            data['anchors'][0]['price'] = 999
            path.write_text(json.dumps(data))
            result = self.run_generator(copied, '--output', str(out))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('drawings.json', result.stderr)
            self.assertFalse(out.exists())

    def test_output_cannot_overwrite_compact_source(self):
        before = (BASE/'drawings.json').read_bytes()
        result = self.run_generator(BASE, '--output', str(BASE))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(before, (BASE/'drawings.json').read_bytes())

    def test_numeric_fixture_cannot_change_to_string_with_same_fingerprint(self):
        with tempfile.TemporaryDirectory() as root:
            copied = Path(root)/'source'
            shutil.copytree(BASE, copied, ignore=shutil.ignore_patterns('__pycache__'))
            path = copied/'drawings.json'
            data = json.loads(path.read_text())
            example = data['examples']['A_to_B']
            example['screen_angle_degrees'] = format(example['screen_angle_degrees'], '.12g')
            path.write_text(json.dumps(data))
            result = self.run_generator(copied, '--check')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('drawings.json', result.stderr)


if __name__ == '__main__':
    unittest.main()

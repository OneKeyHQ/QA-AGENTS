#!/usr/bin/env python3
"""场景错误处理回归；先构建 sim，再运行 python3 tools/test_scenario.py。

SIM_TEST_BIN 可指定 AddressSanitizer 构建，复验非法 JSON 的输入生命周期。
测试通过真实 sim CLI 和临时文件系统检查退出码、报告及截图，不使用 mock。
"""
import json
import os
from pathlib import Path
import resource
import signal
import subprocess
import tempfile
import unittest


SIM_DIR = Path(__file__).resolve().parents[1]
SIM_BIN = Path(os.environ.get("SIM_TEST_BIN", str(SIM_DIR / "build/onekey-sim"))).resolve()


def reject_file_writes():
    signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))


class ScenarioErrorsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="pro2-scenario-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.out = self.root / "out"
        self.out.mkdir()

    def run_scenario(self, step=None, capture="none", raw=None, fail_writes=False):
        scenario = self.root / "scenario.json"
        config = {
            "name": "error-regression",
            "page": "settings_ms_warning",
            "capture": capture,
            "steps": [step if step is not None else {"wait": 10}],
        }
        scenario.write_text(raw if raw is not None else json.dumps(config))
        return subprocess.run(
            [str(SIM_BIN), "--scenario", str(scenario), "--out", str(self.out)],
            cwd=SIM_DIR,
            env={**os.environ, "SDL_VIDEODRIVER": "dummy"},
            preexec_fn=reject_file_writes if fail_writes else None,
            capture_output=True, text=True, timeout=15,
        )

    def assert_error(self, result):
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertNotIn("|PASS", result.stdout)

    def test_rejects_non_array_static_assertions(self):
        self.assert_error(self.run_scenario({"wait": 10, "assert_static": "missing_watch"}))

    def test_rejects_non_string_static_assertion_names(self):
        self.assert_error(self.run_scenario({"wait": 10, "assert_static": [123]}))

    def test_rejects_unknown_watch_names(self):
        self.assert_error(self.run_scenario({"wait": 10, "assert_static": ["missing_watch"]}))

    def test_rejects_non_boolean_compose_guard(self):
        for value in ("true", 1, None, []):
            with self.subTest(value=value):
                self.assert_error(self.run_scenario({"wait": 10, "expect_compose": value}))

    def test_accepts_explicit_disabled_guards(self):
        result = self.run_scenario({"wait": 10, "assert_static": [], "expect_compose": False})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads((self.out / "report.json").read_text())["passed"])

    def test_missing_required_compose_is_assertion_failure(self):
        result = self.run_scenario({"wait": 10, "expect_compose": True})
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        report = json.loads((self.out / "report.json").read_text())
        self.assertFalse(report["passed"])
        self.assertTrue(report["steps"][0]["compose_missing"])

    def test_rejects_malformed_json_without_invalid_memory_access(self):
        result = self.run_scenario(raw='{"name": "broken", "page": }')
        self.assert_error(result)
        self.assertIn("JSON", result.stderr)
        self.assertNotIn("AddressSanitizer", result.stderr)

    def test_report_open_failures_are_errors(self):
        for filename in ("report.json", "report.md"):
            with self.subTest(filename=filename):
                blocked = self.out / filename
                if blocked.exists():
                    blocked.unlink()
                blocked.mkdir()
                self.assert_error(self.run_scenario())
                blocked.rmdir()

    def test_report_buffer_flush_failures_are_errors(self):
        self.assert_error(self.run_scenario(fail_writes=True))

    def test_png_buffer_flush_failure_is_error(self):
        self.assert_error(self.run_scenario(capture="all", fail_writes=True))

    def test_png_open_failure_is_error(self):
        frames = self.out / "frames"
        frames.mkdir()
        (frames / "f00000_lvgl.png").mkdir()
        self.assert_error(self.run_scenario(capture="all"))
        self.assertFalse(json.loads((self.out / "report.json").read_text())["passed"])

    def test_valid_run_writes_reports_and_png(self):
        result = self.run_scenario(capture="all")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads((self.out / "report.json").read_text())
        self.assertTrue(report["passed"])
        self.assertGreater(report["frames"], 0)
        self.assertTrue((self.out / "report.md").read_text().startswith("# 场景"))
        png = next((self.out / "frames").glob("*.png"))
        self.assertEqual(png.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)

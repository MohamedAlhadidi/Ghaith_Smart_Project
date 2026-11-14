"""Regression tests for defects found when reviewing the V4 package (2026-11-14).

No network: CLI calls use fake executables, downloads use a local HTTP server.
"""
from pathlib import Path
import csv
import functools
import http.server
import importlib.util
import json
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load_file(relative, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pm = load_file("scripts/pm_runner.py", "ghaith_pm_fix")
release = load_file("scripts/check_release.py", "ghaith_release_fix")
books = load_file("scripts/fetch_books.py", "ghaith_books_fix")

# Excerpt of the real `claude --help` (Claude Code 2.1.325), which documents the
# file variant only in combined form.
REAL_HELP_EXCERPT = """
  --append-system-prompt <prompt>       Append a system prompt to the default
                                        --append-system-prompt[-file], --add-dir
  --max-budget-usd <amount>             Maximum dollar amount to spend on API
  --output-format <format>              Output format (only works with --print):
  --permission-mode <mode>              Permission mode to use for the session
  --permission-prompts <target>         Who answers permission prompts with
  --tools <tools...>                    Specify the list of available tools from
"""


class PreflightFlagTests(unittest.TestCase):
    def test_combined_file_form_is_accepted(self):
        self.assertTrue(pm.flag_in_help("--append-system-prompt-file", REAL_HELP_EXCERPT))

    def test_literal_flags_found(self):
        for flag in ("--tools", "--permission-mode", "--permission-prompts", "--max-budget-usd", "--output-format"):
            self.assertTrue(pm.flag_in_help(flag, REAL_HELP_EXCERPT), flag)

    def test_prefix_of_longer_flag_is_not_a_match(self):
        self.assertFalse(pm.flag_in_help("--tools", "  --tools-extra <x>  something"))
        self.assertFalse(pm.flag_in_help("--append-system-prompt-file", "  --append-system-prompt <p>"))

    def test_preflight_passes_with_real_help_format(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "fake-claude"
            fake.write_text("#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo '2.1.325 (Claude Code)'; "
                            "else cat <<'EOF'\n" + REAL_HELP_EXCERPT + "EOF\nfi\n")
            fake.chmod(0o755)
            cfg = dict(pm.load_config(ROOT), require_sandbox=False)
            self.assertEqual(pm.preflight_cli(str(fake), cfg), "2.1.325")


def write_release_fixture(base, baseline):
    (base / "release").mkdir()
    (base / "docs").mkdir()
    (base / "release" / "manifest.json").write_text(json.dumps({"gates": {}}))
    (base / "release" / "curriculum_baseline.json").write_text(json.dumps(baseline))
    pairs = [(s, sem) for s in sorted(release.SUBJECTS) for sem in ("1", "2") if (s, sem) != ("ict", "2")]
    with (base / "docs" / "CURRICULUM_MATRIX.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["subject", "semester", "lesson_id"])
        writer.writeheader()
        for i, (s, sem) in enumerate(pairs):
            writer.writerow({"subject": s, "semester": sem, "lesson_id": f"L{i}"})


class SemesterWaiverTests(unittest.TestCase):
    """The MOE site lists ICT grade 2 for semester 1 only; the gate must not force a fake S2 row."""

    def uncovered(self, baseline):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            write_release_fixture(base, baseline)
            return [e for e in release.check(base) if "Uncovered" in e or "not_applicable" in e]

    def test_without_waiver_ict_s2_is_uncovered(self):
        errors = self.uncovered({"status": "approved", "reviewer": "owner", "lessons": []})
        self.assertTrue(any("('ict', '2')" in e for e in errors), errors)

    def test_approved_waiver_with_reason_clears_ict_s2(self):
        errors = self.uncovered({"status": "approved", "reviewer": "owner", "lessons": [],
                                 "not_applicable": [{"subject": "ict", "semester": 2, "reason": "no S2 book published"}]})
        self.assertEqual(errors, [])

    def test_waiver_in_unapproved_baseline_is_ignored(self):
        errors = self.uncovered({"status": "draft_not_approved", "reviewer": "", "lessons": [],
                                 "not_applicable": [{"subject": "ict", "semester": 2, "reason": "x"}]})
        self.assertTrue(any("('ict', '2')" in e for e in errors), errors)

    def test_waiver_without_reason_is_rejected(self):
        errors = self.uncovered({"status": "approved", "reviewer": "owner", "lessons": [],
                                 "not_applicable": [{"subject": "ict", "semester": 2}]})
        self.assertTrue(any("Invalid not_applicable" in e for e in errors), errors)
        self.assertTrue(any("('ict', '2')" in e for e in errors), errors)


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class FetchBooksTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.web = Path(self.tmp.name) / "web"
        self.web.mkdir()
        self.pdf_bytes = b"%PDF-1.4\n" + b"x" * 5000 + b"\n%%EOF\n"
        (self.web / "book.pdf").write_bytes(self.pdf_bytes)
        (self.web / "page.pdf").write_bytes(b"<html>not a pdf</html>")
        handler = functools.partial(_QuietHandler, directory=str(self.web))
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.dest_dir = Path(self.tmp.name) / "books"
        self.dest_dir.mkdir()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def test_download_writes_exact_bytes(self):
        dest = self.dest_dir / "A.pdf"
        books.download(self.base + "/book.pdf", dest)
        self.assertEqual(dest.read_bytes(), self.pdf_bytes)
        self.assertFalse(dest.with_suffix(".part").exists())

    def test_stale_partial_is_replaced_when_server_ignores_range(self):
        dest = self.dest_dir / "B.pdf"
        dest.with_suffix(".part").write_bytes(b"garbage-from-interrupted-run")
        books.download(self.base + "/book.pdf", dest)  # test server answers 200, not 206
        self.assertEqual(dest.read_bytes(), self.pdf_bytes)

    def test_non_pdf_is_rejected_and_not_kept(self):
        dest = self.dest_dir / "C.pdf"
        with self.assertRaises(RuntimeError):
            books.download(self.base + "/page.pdf", dest)
        self.assertFalse(dest.exists())
        self.assertFalse(dest.with_suffix(".part").exists())

    def test_catalog_is_consistent(self):
        catalog = json.loads((ROOT / "docs" / "BOOK_SOURCES.json").read_text(encoding="utf-8"))
        ids = [b["book_id"] for b in catalog["books"]]
        self.assertEqual(len(ids), len(set(ids)))
        child = [b for b in catalog["books"] if b["in_child_scope"]]
        self.assertEqual({b["subject"] for b in child}, release.SUBJECTS)
        for b in catalog["books"]:
            self.assertTrue(b["pdf_url"].startswith("https://home.moe.gov.om/files/manaheg/"), b["book_id"])
            self.assertTrue(b["pdf_url"].endswith(".pdf"), b["book_id"])
            if b["in_child_scope"]:
                self.assertIn(b["semester"], (1, 2), b["book_id"])


if __name__ == "__main__":
    unittest.main()

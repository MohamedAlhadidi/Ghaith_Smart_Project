"""No network needed: verify initial content and launcher contracts."""
from pathlib import Path
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

def load_file(relative, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

pm = load_file("scripts/pm_runner.py", "ghaith_pm")
release = load_file("scripts/check_release.py", "ghaith_release")


class ProjectManagerContractTests(unittest.TestCase):
    def test_initial_queue_ready(self):
        ready, not_done, blocked = pm.queue_state(ROOT)
        self.assertGreaterEqual(ready, 1)
        self.assertGreater(not_done, 0)
        self.assertEqual(blocked, 0)

    def test_compose_safe_command(self):
        cfg = pm.load_config(ROOT)
        cmd = pm.build_command(ROOT, cfg, "claude")
        self.assertIn("--permission-mode", cmd)
        self.assertIn("--tools", cmd)
        self.assertIn("auto", cmd)
        self.assertIn("--permission-prompts", cmd)
        self.assertIn("none", cmd)
        self.assertNotIn("--dangerously-skip-permissions", cmd)
        self.assertIn("Bash", cfg["tools"])
        self.assertNotIn("--allowedTools", cmd)

    def test_release_not_pretend_complete(self):
        errors = release.check(ROOT)
        self.assertTrue(errors)
        self.assertTrue(any("Missing release/manifest" in item for item in errors))

    def test_all_10_prompts_exist(self):
        prompts = sorted((ROOT / "prompts").glob("*.md"))
        self.assertEqual(len(prompts), 10)

    def test_game_priority_in_main_agent(self):
        policy = (ROOT / "policies" / "INTENSIVE_GAME_POLICY.md").read_text(encoding="utf-8")
        self.assertIn("10–14", policy)
        self.assertIn("الرياضيات", policy)
        self.assertIn("الإنجليزية", policy)

    def test_progress_fingerprint_requires_real_artifact(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            docs = base / "docs"
            docs.mkdir()
            (docs / "RESUME.md").write_text("one")
            before = pm.progress_fingerprint(base)
            (docs / "RESUME.md").write_text("two")
            self.assertEqual(pm.progress_fingerprint(base), before)
            (docs / "ARCHITECTURE.md").write_text("real architecture changes")
            self.assertNotEqual(pm.progress_fingerprint(base), before)

    def test_release_requires_separate_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            release_dir = base / "release"
            release_dir.mkdir()
            (release_dir / "manifest.json").write_text(json.dumps({
                "gates": {f"G{i}": {"status": "PASS", "evidence_files": ["dummy.txt"]} for i in range(10)},
                "real_tests_executed": True, "deployment_verified": True, "expected_verified_lessons": 14
            }))
            (base / "dummy.txt").write_text("fabricated evidence")
            problems = release.check(base)
            self.assertTrue(any("baseline" in problem for problem in problems))
            self.assertTrue(any("Owner approval" in problem for problem in problems))

    def test_cli_success_with_no_artifact_change_is_not_progress(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            exe = root / "fake-claude"
            exe.write_text("#!/bin/sh\nprintf '{\"is_error\":false,\"permission_denials\":[]}'\n")
            exe.chmod(0o755)
            cfg = pm.load_config(ROOT)
            result = pm.one_cycle(root, cfg, str(exe), 1)
            self.assertEqual(result["status"], "no_progress")

    def test_permission_denial_is_not_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            exe = root / "fake-claude"
            exe.write_text("#!/bin/sh\nprintf '{\"is_error\":false,\"permission_denials\":[\"Bash\"]}'\n")
            exe.chmod(0o755)
            cfg = pm.load_config(ROOT)
            result = pm.one_cycle(root, cfg, str(exe), 1)
            self.assertEqual(result["status"], "failed")

    def test_dry_run_without_claude(self):
        proc = subprocess.run([sys.executable, str(ROOT / "scripts" / "pm_runner.py"), "--project", str(ROOT), "--dry-run"], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        config = json.loads(proc.stdout)
        self.assertIn("command", config)
        self.assertEqual(config["config"]["max_cycles_per_calendar_day"], 8)
        self.assertEqual(config["config"]["max_estimated_usd_per_day"], 12.0)


    def test_ready_status_is_not_deadlocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / 'tasks').mkdir()
            (base / 'tasks' / 'queue.json').write_text(json.dumps({'tasks': [
                {'id':'A','status':'done','depends_on':[]},
                {'id':'B','status':'ready','depends_on':['A']},
                {'id':'C','status':'needs_review','depends_on':['A'],'human_review_required':True}
            ]}))
            self.assertEqual(pm.queue_state(base), (1, 2, 1))

    def test_verified_status_remains_actionable(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / 'tasks').mkdir()
            (base / 'tasks' / 'queue.json').write_text(json.dumps({'tasks': [
                {'id':'A','status':'verified','depends_on':[]}
            ]}))
            self.assertEqual(pm.queue_state(base), (1,1,0))

    def test_daily_budget_counts_started_even_without_meta(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            logs = base / 'logs' / 'pm'
            logs.mkdir(parents=True)
            (logs / 'cycle-20261114-101010-111111-00001.started.json').write_text('{}')
            cfg = pm.load_config(ROOT)
            count, ceiling = pm.daily_usage(base, '20261114', cfg)
            self.assertEqual(count, 1)
            self.assertEqual(ceiling, cfg['max_budget_usd_per_cycle'])

    def test_invalid_version_preflight_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            fake = base / 'fake-claude'
            fake.write_text('#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2.1.200"; else echo "--tools --permission-mode --permission-prompts"; fi\n')
            fake.chmod(0o755)
            with self.assertRaises(RuntimeError):
                pm.preflight_cli(str(fake), pm.load_config(ROOT))

    def test_docs_only_and_no_done_task_cannot_fake_cycle_progress(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp)
            (base/'docs').mkdir()
            (base/'tasks').mkdir()
            (base/'tasks'/'queue.json').write_text(json.dumps({'tasks':[{'id':'A','status':'pending','depends_on':[]}]}))
            fake=base/'fake-claude'
            fake.write_text("""#!/bin/sh
echo "placeholder" > docs/ARCHITECTURE.md
printf '{"is_error":false,"permission_denials":[]}'
""")
            fake.chmod(0o755)
            outcome=pm.one_cycle(base,pm.load_config(ROOT),str(fake),2)
            self.assertEqual(outcome['status'],'no_progress')
            self.assertTrue(outcome['artifacts_changed'])
            self.assertFalse(outcome['new_done_task_ids'])

    def test_task_done_plus_artifact_change_meets_runner_progress_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp)
            (base/'docs').mkdir()
            (base/'tasks').mkdir()
            (base/'tasks'/'queue.json').write_text(json.dumps({'tasks':[{'id':'A','status':'pending','depends_on':[]}]}))
            fake=base/'fake-claude'
            fake.write_text("""#!/bin/sh
mkdir -p src; echo "code" > src/a.py
printf '{"tasks":[{"id":"A","status":"done","depends_on":[]}]}' > tasks/queue.json
printf '{"is_error":false,"permission_denials":[]}'
""")
            fake.chmod(0o755)
            outcome=pm.one_cycle(base,pm.load_config(ROOT),str(fake),3)
            self.assertEqual(outcome['status'],'ok')
            self.assertEqual(outcome['new_done_task_ids'],['A'])
            # The runner is not an educational content reviewer.


if __name__ == "__main__":
    unittest.main()

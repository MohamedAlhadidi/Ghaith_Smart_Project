"""Contract tests for scripts/queue_tool.py and the committed tasks/queue.json."""
from pathlib import Path
import copy
import importlib.util
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("queue_tool", ROOT / "scripts" / "queue_tool.py")
qt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qt)


def task(tid, status="pending", deps=(), **extra):
    t = {k: "" for k in qt.REQUIRED}
    t.update(id=tid, epic_id="E", phase="build", priority="P1", title=tid, depends_on=list(deps), owner="agent",
             status=status, acceptance_criteria=["ok"], artifacts=[], test_commands=[], evidence=[], attempt_count=0)
    t.update(extra)
    return t


def doc(*tasks):
    return {"epics": [{"id": "E"}], "tasks": list(tasks)}


class QueueToolTests(unittest.TestCase):
    def test_committed_queue_is_valid(self):
        queue = json.loads((ROOT / "tasks" / "queue.json").read_text(encoding="utf-8"))
        self.assertEqual(qt.validate(queue), [])

    def test_committed_queue_never_self_approves_human_tasks(self):
        queue = json.loads((ROOT / "tasks" / "queue.json").read_text(encoding="utf-8"))
        for t in queue["tasks"]:
            if t.get("human_review_required"):
                self.assertNotEqual(t["status"], "done", t["id"])
                self.assertIsNone(t.get("approval_actor"), t["id"])

    def test_valid_minimal_queue(self):
        self.assertEqual(qt.validate(doc(task("A", "done", evidence=["x"]), task("B", deps=["A"]))), [])

    def test_done_without_evidence_rejected(self):
        self.assertTrue(any("without evidence" in p for p in qt.validate(doc(task("A", "done")))))

    def test_done_with_open_dependency_rejected(self):
        problems = qt.validate(doc(task("A"), task("B", "done", deps=["A"], evidence=["x"])))
        self.assertTrue(any("dependencies not done" in p for p in problems))

    def test_unknown_dependency_and_status_rejected(self):
        problems = qt.validate(doc(task("A", "finished", deps=["ZZZ"])))
        self.assertTrue(any("unknown task" in p for p in problems))
        self.assertTrue(any("invalid status" in p for p in problems))

    def test_cycle_detected(self):
        problems = qt.validate(doc(task("A", deps=["B"]), task("B", deps=["A"])))
        self.assertTrue(any("cycle" in p for p in problems))

    def test_missing_fields_and_duplicates(self):
        t = task("A")
        del t["owner"]
        problems = qt.validate(doc(t, task("B"), task("B")))
        self.assertTrue(any("missing fields" in p for p in problems))
        self.assertTrue(any("duplicate" in p for p in problems))

    def test_human_task_cannot_be_closed_by_agent(self):
        t = task("H", "done", evidence=["agent says ok"], human_review_required=True, approval_actor=None)
        self.assertTrue(any("human approval_actor" in p for p in qt.validate(doc(t))))

    def test_blocked_needs_reason(self):
        self.assertTrue(any("blocker_type" in p for p in qt.validate(doc(task("A", "blocked_external")))))


if __name__ == "__main__":
    unittest.main()

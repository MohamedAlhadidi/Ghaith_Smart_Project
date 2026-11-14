#!/usr/bin/env python3
"""Validate and summarise tasks/queue.json (atomic task contract V4).

  python3 scripts/queue_tool.py validate   # exit 1 on any contract violation
  python3 scripts/queue_tool.py summary    # counts by status / subject, next ready tasks
"""
import argparse
import json
from collections import Counter
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "tasks" / "queue.json"

REQUIRED = (
    "id", "epic_id", "phase", "priority", "subject", "semester", "book_id", "unit_id", "lesson_id",
    "skill_id", "title", "depends_on", "owner", "status", "acceptance_criteria", "artifacts",
    "test_commands", "evidence", "attempt_count", "blocker_type", "updated_at",
)
STATUSES = {"pending", "ready", "in_progress", "needs_review", "blocked_external", "retry", "verified", "done"}
PRIORITIES = {"P0", "P1", "P2", "P3"}


def validate(doc):
    problems = []
    tasks = doc.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        return ["queue has no tasks"]
    epics = {e.get("id") for e in doc.get("epics", [])}
    ids = [t.get("id") for t in tasks]
    dupes = [i for i, n in Counter(ids).items() if n > 1]
    if dupes:
        problems.append(f"duplicate task ids: {dupes}")
    known = set(ids)
    for t in tasks:
        tid = t.get("id", "?")
        missing = [k for k in REQUIRED if k not in t]
        if missing:
            problems.append(f"{tid}: missing fields {missing}")
            continue
        if t["status"] not in STATUSES:
            problems.append(f"{tid}: invalid status {t['status']!r}")
        if t["priority"] not in PRIORITIES:
            problems.append(f"{tid}: invalid priority {t['priority']!r}")
        if epics and t["epic_id"] not in epics:
            problems.append(f"{tid}: unknown epic {t['epic_id']!r}")
        for dep in t["depends_on"]:
            if dep not in known:
                problems.append(f"{tid}: depends on unknown task {dep!r}")
        if not t["acceptance_criteria"]:
            problems.append(f"{tid}: no acceptance criteria")
        if t["status"] in ("done", "verified") and not t["evidence"]:
            problems.append(f"{tid}: status {t['status']} without evidence")
        if t["status"] == "done":
            open_deps = [d for d in t["depends_on"] if next((x for x in tasks if x["id"] == d), {}).get("status") != "done"]
            if open_deps:
                problems.append(f"{tid}: done while dependencies not done {open_deps}")
        if t["status"] == "blocked_external" and not t["blocker_type"]:
            problems.append(f"{tid}: blocked_external without blocker_type")
        if t.get("human_review_required") and t["status"] == "done" and not t.get("approval_actor"):
            problems.append(f"{tid}: human review task done without a recorded human approval_actor")
    # Cycle detection (DFS over depends_on).
    graph = {t["id"]: t.get("depends_on", []) for t in tasks if "id" in t}
    state = {}

    def visit(node, path):
        if state.get(node) == 1:
            problems.append("dependency cycle: " + " -> ".join(path + [node]))
            return
        if state.get(node) == 2:
            return
        state[node] = 1
        for dep in graph.get(node, []):
            if dep in graph:
                visit(dep, path + [node])
        state[node] = 2

    for node in graph:
        visit(node, [])
    return problems


def summary(doc):
    tasks = doc["tasks"]
    done = {t["id"] for t in tasks if t["status"] == "done"}
    print("by status:", dict(Counter(t["status"] for t in tasks)))
    print("by subject:", dict(Counter(t["subject"] for t in tasks)))
    ready = [t for t in tasks if t["status"] in ("ready", "pending", "retry")
             and not t.get("human_review_required") and all(d in done for d in t["depends_on"])]
    order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    ready.sort(key=lambda t: (order[t["priority"]], t["id"]))
    print(f"actionable now: {len(ready)}")
    for t in ready[:12]:
        print(f"  {t['priority']} {t['id']}: {t['title']}")
    human = [t for t in tasks if t.get("human_review_required") and t["status"] != "done"]
    print(f"waiting for human review/action: {len(human)}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["validate", "summary"])
    p.add_argument("--queue", type=Path, default=QUEUE)
    args = p.parse_args()
    doc = json.loads(args.queue.read_text(encoding="utf-8"))
    if args.command == "validate":
        problems = validate(doc)
        for prob in problems:
            print("INVALID", prob)
        print(f"{len(doc.get('tasks', []))} tasks; {len(problems)} problems")
        return 1 if problems else 0
    summary(doc)
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Independent, intentionally strict structural release gate. No sample data accepted."""
import argparse
import csv
import hashlib
import os
import re
import json
from pathlib import Path
import sys

SUBJECTS = {"math", "english", "arabic", "science", "islamic", "citizenship", "ict"}
GATES = {f"G{i}" for i in range(10)}


def check(root):
    errors = []
    manifest = root / "release" / "manifest.json"
    if not manifest.is_file():
        return ["Missing release/manifest.json; implementation not yet verified"]
    try:
        doc = json.loads(manifest.read_text(encoding="utf-8"))
    except Exception as e:
        return [f"Invalid manifest: {e}"]
    # This final flag is supplied by the human operator outside the repository.
    # It does not replace review; it stops unattended code from declaring its own acceptance.
    if os.environ.get("GHAITH_RELEASE_APPROVED") != "1":
        errors.append("Owner approval missing: set GHAITH_RELEASE_APPROVED=1 only after manual acceptance")
    baseline_path = root / "release" / "curriculum_baseline.json"
    baseline_map = {}
    # Subject/semester pairs that the human-approved baseline declares as having no
    # official book (e.g. the MOE site lists ICT grade 2 for semester 1 only).
    # Only an approved baseline can waive a pair, and each waiver needs a reason.
    waived_pairs = set()
    if not baseline_path.is_file():
        errors.append("Missing independently reviewed release/curriculum_baseline.json")
    else:
        try:
            baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
            approved = baseline.get("status") == "approved" and bool(baseline.get("reviewer"))
            if not approved:
                errors.append("Curriculum baseline lacks documented independent approval")
            for entry in baseline.get("not_applicable", []) or []:
                pair = (str(entry.get("subject", "")).strip().lower(), str(entry.get("semester", "")).strip())
                if pair[0] not in SUBJECTS or pair[1] not in ("1", "2") or not str(entry.get("reason", "")).strip():
                    errors.append(f"Invalid not_applicable entry (needs subject, semester 1|2, reason): {entry!r}")
                elif approved:
                    waived_pairs.add(pair)
            lessons = baseline.get("lessons")
            if not isinstance(lessons, list) or not lessons:
                errors.append("Curriculum baseline contains no independently enumerated lessons")
            else:
                for b in lessons:
                    ident = b.get("lesson_id", "")
                    if not ident or ident in baseline_map:
                        errors.append(f"Duplicate/missing baseline lesson id: {ident!r}")
                    baseline_map[ident] = b
        except Exception as exc:
            errors.append(f"Invalid baseline: {exc}")
    gates = doc.get("gates", {})
    for gate in sorted(GATES):
        detail = gates.get(gate, {})
        if detail.get("status") != "PASS":
            errors.append(f"{gate} not PASS")
        for evidence in detail.get("evidence_files", []):
            # evidence must be inside this repository
            path = (root / evidence).resolve()
            if not path.is_relative_to(root) or not path.is_file():
                errors.append(f"Missing/unsafe {gate} evidence: {evidence}")
        if not detail.get("evidence_files"):
            errors.append(f"{gate} has no evidence files")
    game_catalog_path = root / "release" / "game_manifest.json"
    game_catalog = {}
    if not game_catalog_path.is_file():
        errors.append("Missing independently reviewed release/game_manifest.json")
    else:
        try:
            catalog = json.loads(game_catalog_path.read_text(encoding="utf-8"))
            for game in catalog.get("games", []):
                key = game.get("game_id", "")
                if not key or key in game_catalog:
                    errors.append(f"Duplicate/missing game id {key!r}")
                else:
                    game_catalog[key] = game
            if not game_catalog:
                errors.append("Game catalog has no reviewed games")
        except (ValueError, OSError, TypeError) as exc:
            errors.append(f"Invalid game catalog: {exc}")
    matrix = root / "docs" / "CURRICULUM_MATRIX.csv"
    if not matrix.exists():
        errors.append("Missing curriculum matrix")
    else:
        with matrix.open(encoding="utf-8-sig", newline="") as file:
            rows = list(csv.DictReader(file))
        if not rows:
            errors.append("Curriculum matrix contains no verified lessons")
        subjects_semesters = set()
        ids = set()
        verified_book_hashes = {}
        unit_mechanics = {}
        unit_exceptions = {}
        for row in rows:
            sub = row.get("subject", "").strip().lower()
            sem = row.get("semester", "").strip()
            subjects_semesters.add((sub, sem))
            lesson_id = row.get("lesson_id", "")
            if not lesson_id or lesson_id in ids:
                errors.append(f"Duplicate/empty lesson id {lesson_id!r}")
            ids.add(lesson_id)
            b = baseline_map.get(lesson_id)
            if baseline_map and b is None:
                errors.append(f"Not in approved baseline: {lesson_id}")
            if b:
                for key in ("subject", "semester", "book_id", "source_file"):
                    if row.get(key, "").strip() != str(b.get(key, "")).strip():
                        errors.append(f"Baseline mismatch {key}: {lesson_id}")
                digest = str(b.get("source_sha256", ""))
                if not re.fullmatch(r"[0-9a-fA-F]{64}", digest):
                    errors.append(f"Invalid/missing baseline source SHA256 for {lesson_id}")
                else:
                    relative_file = row.get("source_file", "")
                    actual_source = (root / relative_file).resolve()
                    if actual_source.is_relative_to(root) and actual_source.is_file():
                        if relative_file not in verified_book_hashes:
                            with actual_source.open("rb") as stream:
                                h = hashlib.sha256()
                                for chunk in iter(lambda: stream.read(1 << 20), b""):
                                    h.update(chunk)
                            verified_book_hashes[relative_file] = h.hexdigest()
                        if verified_book_hashes[relative_file].lower() != digest.lower():
                            errors.append(f"Baseline/source checksum mismatch: {lesson_id}")
            if not all(row.get(x, "").strip() for x in ("book_id", "unit_id", "lesson_id", "source_page", "source_file", "skill_ids", "game_ids")):
                errors.append(f"Missing source/skill/game fields: {lesson_id}")
            if row.get("verified", "").lower() != "true" or row.get("approved", "").lower() != "true":
                errors.append(f"Not verified/approved: {lesson_id}")
            if row.get("test_status", "").upper() != "PASS":
                errors.append(f"Test gate not passed: {lesson_id}")
            source = (root / row.get("source_file", "")).resolve()
            if not source.is_relative_to(root) or not source.is_file():
                errors.append(f"Source book file unavailable for {lesson_id}")
            try:
                count = int(row.get("activities_count", "0") or 0)
            except (ValueError, TypeError):
                errors.append(f"Invalid activities_count: {lesson_id}")
                count = 0
            mechanics_set = {t.strip() for t in row.get("game_mechanics", "").split(";") if t.strip()}
            mechanics = len(mechanics_set)
            unit_key = (sub, sem, row.get("book_id", ""), row.get("unit_id", ""))
            unit_mechanics.setdefault(unit_key, set()).update(mechanics_set)
            exception = row.get("educational_exception", "").strip()
            if exception:
                if row.get("educational_exception_reviewed", "").strip().lower() != "true":
                    errors.append(f"Unreviewed educational exception: {lesson_id}")
                else:
                    unit_exceptions.setdefault(unit_key, set()).add(lesson_id)
            target, kinds = (10, 2) if sub in ("math", "english") else ((7, 2) if sub == "arabic" else (4, 1))
            if (count < target or mechanics < kinds) and not exception:
                errors.append(f"Insufficient activity density/diversity without reviewable exception: {lesson_id}")
            for game_id in (x.strip() for x in row.get("game_ids", "").split(";") if x.strip()):
                g = game_catalog.get(game_id)
                if not g:
                    errors.append(f"Game {game_id} missing from catalog: {lesson_id}")
                elif (g.get("lesson_id") != lesson_id or g.get("test_status") != "PASS"
                      or g.get("approval_status") != "approved"):
                    errors.append(f"Unapproved/untested/mismatched game {game_id}: {lesson_id}")
        for unit_key, mechanics_set in unit_mechanics.items():
            if unit_key[0] in ("math", "english") and len(mechanics_set) < 6 and unit_key not in unit_exceptions:
                errors.append(f"Insufficient unit-level mechanic diversity for {unit_key}: {len(mechanics_set)}<6")
        if not SUBJECTS.issubset({s for s, _ in subjects_semesters}):
            errors.append("Not all seven subjects present")
        missing = {(sub, str(s)) for sub in SUBJECTS for s in (1, 2)} - subjects_semesters - waived_pairs
        if missing:
            errors.append(f"Uncovered subject/semester pairs: {sorted(missing)}")
        if baseline_map:
            absent = set(baseline_map) - ids
            if absent:
                errors.append(f"{len(absent)} approved-baseline lessons missing from curriculum matrix")
        expected = doc.get("expected_verified_lessons")
        if not isinstance(expected, int) or expected <= 0 or expected != len(rows) or (baseline_map and expected != len(baseline_map)):
            errors.append("expected_verified_lessons does not match reviewed baseline and matrix")
    queue = root / "tasks" / "queue.json"
    if not queue.exists():
        errors.append("Missing task queue")
    else:
        try:
            tasks = json.loads(queue.read_text(encoding="utf-8"))["tasks"]
            if not tasks or any(t.get("status") != "done" for t in tasks):
                errors.append("Task queue still contains unfinished items")
        except Exception as e:
            errors.append(f"Invalid task queue: {e}")
    # This structural gate does not replace launching test suites and human review.
    if not doc.get("real_tests_executed", False):
        errors.append("real_tests_executed must be true with genuine evidence")
    if not doc.get("deployment_verified", False):
        errors.append("deployment_verified is not true")
    return errors


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, default=Path.cwd())
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args()
    root = args.root.resolve()
    errors = check(root)
    if not args.quiet:
        if errors:
            print("Release NOT verified:")
            for e in errors[:40]:
                print(" -", e)
            if len(errors) > 40:
                print(f" ... {len(errors)-40} additional errors")
        else:
            print("Structural release gate: PASS (still requires genuine test evidence and acceptance review)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

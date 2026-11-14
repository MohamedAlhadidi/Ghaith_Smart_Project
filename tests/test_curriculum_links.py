"""Cross-checks between lesson content, the curriculum matrix and the book inventory.

These are structural checks on the lineage chain (book SHA-256 -> page -> lesson ->
game). They do not prove pedagogical correctness and never replace human review.
"""
from pathlib import Path
import csv
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]


def read_csv(rel):
    with (ROOT / rel).open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


INVENTORY = {r["book_id"]: r for r in read_csv("docs/BOOK_INVENTORY.csv")}
MATRIX = read_csv("docs/CURRICULUM_MATRIX.csv")
LESSONS = {r["lesson_id"]: r for r in MATRIX}
CONTENT = sorted((ROOT / "content" / "games").rglob("*.json"))


class MatrixTests(unittest.TestCase):
    def test_lesson_ids_unique(self):
        self.assertEqual(len(LESSONS), len(MATRIX))

    def test_every_lesson_points_to_an_inventoried_book(self):
        for r in MATRIX:
            self.assertIn(r["book_id"], INVENTORY, r["lesson_id"])
            self.assertEqual(r["source_file"], INVENTORY[r["book_id"]]["local_file"], r["lesson_id"])

    def test_pdf_page_within_book_and_offset_consistent(self):
        offsets = {}
        for r in MATRIX:
            pages = int(INVENTORY[r["book_id"]]["pdf_pages"])
            pdf, printed = int(r["source_pdf_page"]), int(r["source_page"])
            self.assertTrue(1 <= pdf <= pages, r["lesson_id"])
            offsets.setdefault(r["book_id"], set()).add(pdf - printed)
        for book, found in offsets.items():
            self.assertEqual(len(found), 1, f"{book}: inconsistent printed->PDF offsets {found}")

    def test_units_are_contiguous_page_ranges(self):
        by_book = {}
        for r in MATRIX:
            by_book.setdefault(r["book_id"], []).append(r)
        for book, rows in by_book.items():
            rows.sort(key=lambda r: int(r["source_page"]))
            seen, prev = set(), None
            for r in rows:
                if r["unit_id"] != prev:
                    self.assertNotIn(r["unit_id"], seen, f"{book}: unit {r['unit_id']} split into two ranges")
                    seen.add(r["unit_id"])
                    prev = r["unit_id"]

    def test_math_s1_student_book_lesson_count(self):
        # 40 TOC entries (printed p4-p43), verified against page titles on 2026-11-14.
        rows = [r for r in MATRIX if r["book_id"] == "MATH-S1-STU"]
        self.assertEqual(len(rows), 40)
        self.assertEqual(sorted(int(r["source_page"]) for r in rows), list(range(4, 44)))

    def test_nothing_marked_verified_or_approved_without_review(self):
        for r in MATRIX:
            self.assertEqual(r["approved"], "false", r["lesson_id"])  # no human review has happened yet


class ContentLinkTests(unittest.TestCase):
    def test_content_files_exist(self):
        self.assertTrue(CONTENT)

    def test_content_matches_matrix_and_inventory(self):
        for path in CONTENT:
            doc = json.loads(path.read_text(encoding="utf-8"))
            lid = doc["lesson_id"]
            self.assertIn(lid, LESSONS, path.name)
            row, src = LESSONS[lid], doc["source"]
            book = INVENTORY[src["source_book_id"]]
            self.assertEqual(src["source_book_id"], row["book_id"], path.name)
            self.assertEqual(src["source_sha256"], book["sha256"], f"{path.name}: SHA-256 differs from inventory")
            self.assertEqual(str(src["source_printed_page"]), row["source_page"], path.name)
            self.assertEqual(str(src["source_pdf_page"]), row["source_pdf_page"], path.name)
            self.assertEqual(doc["unit_id"], row["unit_id"], path.name)

    def test_games_reference_declared_objectives_and_are_not_self_approved(self):
        for path in CONTENT:
            doc = json.loads(path.read_text(encoding="utf-8"))
            objectives = {o["objective_id"]: o["skill_id"] for o in doc["objectives"]}
            for g in doc["games"]:
                self.assertIn(g["objective_id"], objectives, g["game_id"])
                self.assertEqual(objectives[g["objective_id"]], g["skill_id"], g["game_id"])
                if g["content_review_status"] == "approved":
                    self.assertTrue(g.get("approval_actor"), f"{g['game_id']}: approved without a human approval_actor")


if __name__ == "__main__":
    unittest.main()


class MathCatalogTests(unittest.TestCase):
    """content/curriculum/math/s1/lessons.json must stay aligned with the matrix and inventory."""

    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads((ROOT / "content/curriculum/math/s1/lessons.json").read_text(encoding="utf-8"))

    def test_every_matrix_lesson_of_the_book_is_in_the_catalog(self):
        ids = [l["lesson_id"] for l in self.doc["lessons"]]
        matrix_ids = [r["lesson_id"] for r in MATRIX if r["book_id"] == "MATH-S1-STU"]
        self.assertEqual(sorted(ids), sorted(matrix_ids))

    def test_sources_match_matrix_and_inventory(self):
        sha = INVENTORY["MATH-S1-STU"]["sha256"]
        for l in self.doc["lessons"]:
            row = LESSONS[l["lesson_id"]]
            self.assertEqual(l["source"]["source_sha256"], sha, l["lesson_id"])
            self.assertEqual(str(l["source"]["source_printed_page"]), row["source_page"], l["lesson_id"])
            self.assertEqual(str(l["source"]["source_pdf_page"]), row["source_pdf_page"], l["lesson_id"])
            self.assertEqual(l["unit_id"], row["unit_id"], l["lesson_id"])
            self.assertEqual(l["lesson_name"], row["lesson_name"], l["lesson_id"])

    def test_every_lesson_has_objectives_skills_tasks_and_games(self):
        for l in self.doc["lessons"]:
            self.assertTrue(l["objectives"], l["lesson_id"])
            self.assertTrue(l["skills"], l["lesson_id"])
            self.assertTrue(l["book_tasks"], l["lesson_id"])
            self.assertTrue(l["games"], l["lesson_id"])
            skills = {s["id"] for s in l["skills"]}
            for g in l["games"]:
                self.assertIn(g["skill_id"], skills, g["game_id"])
                self.assertGreaterEqual(len(g["hint_levels"]), 2, g["game_id"])

    def test_no_lesson_is_marked_approved_without_a_human(self):
        for l in self.doc["lessons"]:
            if l["content_review_status"] == "approved":
                self.assertTrue(l.get("approval_actor"), l["lesson_id"])
            else:
                self.assertIsNone(l.get("approval_actor"), l["lesson_id"])


class EnglishCatalogTests(unittest.TestCase):
    """content/curriculum/english/s1 must stay aligned with the matrix, inventory and word bank."""

    @classmethod
    def setUpClass(cls):
        base = ROOT / "content/curriculum/english/s1"
        cls.doc = json.loads((base / "lessons.json").read_text(encoding="utf-8"))
        cls.words = json.loads((base / "wordbank.json").read_text(encoding="utf-8"))["words"]

    def test_lessons_match_matrix(self):
        ids = sorted(l["lesson_id"] for l in self.doc["lessons"])
        self.assertEqual(ids, sorted(r["lesson_id"] for r in MATRIX if r["subject"] == "english"))

    def test_sources_match_inventory_and_page_offsets(self):
        offsets = {"ENG-S1-CB": 1, "ENG-S1-SS": 1, "ENG-S1-AB": 2}
        for l in self.doc["lessons"]:
            src = l["source"]
            book = INVENTORY[src["source_book_id"]]
            self.assertEqual(src["source_sha256"], book["sha256"], l["lesson_id"])
            off = offsets[src["source_book_id"]]
            self.assertEqual(src["source_pdf_pages"], [p + off for p in src["source_printed_pages"]], l["lesson_id"])
            self.assertTrue(all(1 <= p <= int(book["pdf_pages"]) for p in src["source_pdf_pages"]), l["lesson_id"])

    def test_words_and_graphemes(self):
        for l in self.doc["lessons"]:
            for w in l["words"]:
                self.assertIn(w, self.words, f"{l['lesson_id']}: {w}")
        for w, e in self.words.items():
            if "graphemes" in e:
                self.assertEqual("".join(e["graphemes"]), w, w)

    def test_sixteen_sounds_each_with_a_tricky_word(self):
        ss = [l for l in self.doc["lessons"] if l["source"]["source_book_id"] == "ENG-S1-SS"]
        self.assertEqual(len(ss), 16)
        for l in ss:
            mechs = {g["mechanic"] for g in l["games"]}
            self.assertTrue({"missing-grapheme", "blend-build", "tricky-cloze"} <= mechs, l["lesson_id"])

    def test_no_self_approval(self):
        for l in self.doc["lessons"]:
            if l["content_review_status"] == "approved":
                self.assertTrue(l.get("approval_actor"), l["lesson_id"])
            else:
                self.assertIsNone(l.get("approval_actor"), l["lesson_id"])

# Release check and acceptance

`check_release.py` is now **fail closed** by default. It requires an independently reviewed `release/curriculum_baseline.json` with every in-scope lesson and the SHA256 of its authentic source book. A baseline created from the agent's own curriculum matrix without independent book inspection is not valid.

Each baseline lesson entry must include: `lesson_id`, `subject` (`math`, `english`, `arabic`, `science`, `islamic`, `citizenship`, `ict`), `semester` (`1` or `2`), `book_id`, `source_file` (path relative to repo), `source_sha256`.

Additionally, after actual release testing and human acceptance, the **human operator** must set environment variable `GHAITH_RELEASE_APPROVED=1` in the **runner's host environment**, not in any file written by the agent. Do not set this until reviewing real test results, curriculum coverage, safety, and deployment. No artifact or variable alone proves pedagogical correctness. This check is structural and must be complemented by live test suites and human review.

## V4
Release gate requires `release/game_manifest.json` with `games` array and `game_id`, `lesson_id`, `test_status=PASS`, `approval_status=approved`. Unit-level diversity is checked across math/English lessons, not 6 variants per lesson. Structural pass never substitutes human examination or an actual runnable application.

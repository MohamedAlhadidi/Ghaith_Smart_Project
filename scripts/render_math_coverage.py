#!/usr/bin/env python3
"""Render docs/<SUBJECT>_S1_COVERAGE.md from reports/<subject>_s1_coverage.json and the lesson catalogue.

Usage: python3 scripts/render_math_coverage.py [math|english|arabic]

The JSON report is produced by `npx vitest run test/math/coverage-report.test.ts`
(in src/games/core). This script only formats it for human review.
"""
import json
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[1]
SUBJECT = sys.argv[1] if len(sys.argv) > 1 else "math"
report = json.loads((ROOT / f"reports/{SUBJECT}_s1_coverage.json").read_text(encoding="utf-8"))
catalog = json.loads((ROOT / f"content/curriculum/{SUBJECT}/s1/lessons.json").read_text(encoding="utf-8"))
TITLE = {
    "math": "تغطية رياضيات الفصل الأول — كتاب الطالب (MATH-S1-STU)",
    "english": "تغطية الإنجليزية للفصل الأول — Team Together Oman 2A",
    "arabic": "تغطية العربية للفصل الأول — أحب لغتي (الجزآن 1 و2، طبعة 2026)",
}[SUBJECT]
games_by_lesson = {l["lesson_id"]: l["games"] for l in catalog["lessons"]}
notes = {l["lesson_id"]: l.get("interpretation_notes", "") for l in catalog["lessons"]}

t = report["totals"]
lines = [
    f"# {TITLE}",
    "",
    f"مولّد آليًا من `reports/{SUBJECT}_s1_coverage.json` (وقت التوليد: {report['generated_at']}). "
    "المقاييس منفصلة كما تشترط سياسة الألعاب: الجولات ≠ الآليات ≠ تغطية الأهداف. "
    "**لا يوجد أي درس معتمد بشريًا بعد.**",
    "",
    "| المقياس | القيمة |",
    "|---|---|",
    f"| الدروس | {t['lessons']} |",
    f"| دروس لها ألعاب قابلة للتشغيل | {t['lessons_with_playable_games']} |",
    f"| الألعاب (المعرّفة / القابلة للتشغيل) | {t['games_defined']} / {t['games_playable']} |",
    f"| activity_rounds_count (لعبة × مستوى) | {t['activity_rounds_count']} |",
    f"| آليات اللعب المستقلة المنفذة / المعرّفة | {t['mechanics_implemented']} / {t['mechanics_defined']} |",
    f"| objective_coverage_percent (مهارات لها لعبة) | {t['objective_coverage_percent']}% |",
    f"| الدروس المعتمدة بشريًا | {t['lessons_approved']} |",
    "",
    "## الوحدات",
    "",
    "| الوحدة | الدروس | آليات مستقلة في الوحدة |",
    "|---|---|---|",
]
for u in report["units"]:
    lines.append(f"| {u['title']} | {u['lessons']} | {u['distinct_mechanics_count']} |")
lines += [
    "",
    "## الدروس",
    "",
    "| الدرس | ص | الألعاب | الجولات | آليات | المهارات المغطاة | الآليات المستخدمة |",
    "|---|---|---|---|---|---|---|",
]
for l in report["lessons"]:
    mechs = "، ".join(sorted({g["mechanic"] for g in games_by_lesson[l["lesson_id"]]}))
    lines.append(
        f"| {l['lesson_name']} (`{l['lesson_id']}`) | {l['printed_page']} | {l['games_playable']}/{l['games_defined']} | "
        f"{l['activity_rounds_count']} | {l['distinct_mechanics_count']} | {l['skills_with_games']}/{l['skills']} | {mechs} |"
    )
if SUBJECT == "arabic":
    # Honest counting (policy: skins/templates are not separate mechanics): interaction families.
    FAMILY = {
        "ar-syllables": "ترتيب بطاقات", "ar-sentence-build": "ترتيب بطاقات", "ar-event-order": "ترتيب بطاقات",
        "ar-question": "اختيار من متعدد", "ar-fill-word": "اختيار من متعدد", "ar-word-relation": "اختيار من متعدد",
        "ar-poem-gap": "اختيار من متعدد", "ar-verb-pick": "اختيار من متعدد",
        "ar-letter-find": "تمييز الحرف", "ar-missing-letter": "تمييز الحرف",
        "ar-sun-moon": "تصنيف بقاعدة", "ar-taa": "تصنيف بقاعدة", "ar-tanween": "تصنيف بقاعدة", "ar-sort": "تصنيف بقاعدة", "ar-text-check": "تصنيف بقاعدة",
        "ar-count-words": "إدخال عدد",
    }
    lines += ["", "## عائلات التفاعل (عدّ صارم)", "",
              "بعض الآليات تتشارك طريقة اللعب نفسها وتختلف في المهارة والقاعدة؛ لذلك نعرض أيضًا عدد عائلات التفاعل في كل محور:", "",
              "| المحور | آليات مستقلة | عائلات تفاعل |", "|---|---|---|"]
    for u in report["units"]:
        ms = {g["mechanic"] for l in catalog["lessons"] if l["unit_id"] == u["unit_id"] for g in l["games"]}
        lines.append(f"| {u['title']} | {len(ms)} | {len({FAMILY.get(m, m) for m in ms})} ({'، '.join(sorted({FAMILY.get(m, m) for m in ms}))}) |")
    ng = [(l["lesson_id"], n) for l in catalog["lessons"] for n in l.get("not_gamed", [])]
    lines += ["", f"## تمارين الكتاب التي لم تتحول إلى لعبة ({len(ng)})", "", "| القسم | ص | التمرين | السبب |", "|---|---|---|---|"]
    lines += [f"| `{lid}` | {n['page']} | {n['what']} | {n['reason']} |" for lid, n in ng]
gaps = [(lid, n) for lid, n in notes.items() if n]
if gaps:
    lines += ["", "## ملاحظات التفسير والفجوات المعلنة", ""]
    lines += [f"- `{lid}`: {n}" for lid, n in gaps]
lines += [
    "",
    "## مراحل التعلم لكل مهارة",
    "",
    "- **استكشاف ومثال محلول:** زر «مثال محلول» في كل درس يعرض سؤالًا بمستوى ١ مع خطوات الحل.",
    "- **تدريب موجه:** تلميحات متدرجة ومحاولتان، ثم عرض الإجابة مع خطوات الحل.",
    "- **ممارسة مستقلة:** المستوى ٢ بعد نجاحين مستقلين متتاليين.",
    "- **تحدٍّ:** المستوى ٣ (حدود أصعب ضمن حدود الدرس).",
    "- **تقييم مستقل:** «مهمة الوحدة الختامية» بفضاء بذور منفصل، تتجنب الأسئلة التي تدرّب عليها الطفل، بلا تلميحات، محاولة واحدة.",
    "- **مراجعة متباعدة:** «مراجعة اليوم» حسب سلّم ١، ٣، ٧، ١٤، ٣٠ يومًا.",
    "",
    "النقص المعروف: لا يوجد علاج آلي من مهارة سابقة بعد (المرحلة ٨ في السياسة)، ولا تسجيلات صوتية معتمدة (القراءة الصوتية اختيارية من الجهاز).",
]
out = ROOT / f"docs/{SUBJECT.upper()}_S1_COVERAGE.md"
out.write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote", out.relative_to(ROOT))

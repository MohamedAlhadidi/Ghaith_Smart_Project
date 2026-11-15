#!/usr/bin/env python3
"""Build content/curriculum/arabic/s1/lessons.json from the page transcriptions.

The transcriptions (sources/transcriptions/arabic/*.json) are full copies of the book pages
and stay local (git-ignored: the repository is public). This script copies every word,
sentence, option and statement a game needs FROM those transcriptions by page and exercise
number, so nothing is retyped by hand, then checks that each config string really occurs in
the transcription of its section (``--check`` runs only that check).

Answers a game uses are either printed in the book or derived from the book's own text; the
derivations and any judgement (accepted alternative word orders, bank words that would also
fit) are listed per game in ``interpretation``.
"""
from __future__ import annotations

import itertools
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "sources" / "transcriptions" / "arabic"
OUT = ROOT / "content" / "curriculum" / "arabic" / "s1" / "lessons.json"

BOOKS = {
    "ARB-S1-P1": {"sha256": "50d07e27abd28b586c7b69385664387f714d73194a9348f6ef77a90cbdbff400", "offset": 2},
    "ARB-S1-P2": {"sha256": "590f8bb8225da26765f40986775327bc54a2b6ed770ab7b58c105f13e2d69e0e", "offset": 1},
}

# --------------------------------------------------------------------------- text helpers
TATWEEL = "ـ"
DIAC = re.compile("[ً-ْٰ]")


def bare(s: str) -> str:
    return DIAC.sub("", s).replace(TATWEEL, "")


def expand_shadda(s: str) -> str:
    return re.sub("([ء-ي])(?:ّ([ً-ِ]?)|([ً-ِ])ّ)", lambda m: m.group(1) + "ْ" + m.group(1) + (m.group(2) or m.group(3) or ""), s)


def spells(syll: list[str], word: str) -> bool:
    """Cards spell the word: tatweel ignored, shadda = letter+sukun+letter, and sukun marks ignored
    (the book's cards print «ـميْـ» with a sukun on the long ي; the text prints «جَميلَةً»)."""
    f = lambda t: expand_shadda(t.replace(TATWEEL, "")).replace("\u0652", "")
    return f("".join(syll)) == f(word)


LEAD = re.compile(r"^[\s\-–—•]*(?:[٠-٩0-9]+\s*[\-–)]?\s*|[أبج]\)\s*)?[\-–—]?\s*")


def clean(t: str) -> str:
    """Strip list markers and normalise blanks (…… / ......) to ___ ."""
    t = LEAD.sub("", t.strip())
    t = re.sub(r"(?:…|\.{3,}|·{3,})+", "___", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def norm(t: str) -> str:
    """For source checks: no tatweel, no list markers, single spaces, NFC."""
    t = unicodedata.normalize("NFC", t.replace(TATWEEL, ""))
    t = re.sub(r"(?:…|\.{3,}|·{3,}|_{3,})+", "___", t)
    return re.sub(r"\s+", " ", t).strip()


# --------------------------------------------------------------------------- transcription access
T: dict[str, dict] = {}


def load() -> None:
    if not SRC.exists():
        sys.exit(f"missing {SRC}: run the page transcription first (it is local-only)")
    for f in sorted(SRC.glob("ARB-S1-*.json")):
        T[f.stem] = json.loads(f.read_text(encoding="utf-8"))


def ex(sid: str, page: int, no: str | None = None, section: str | None = None, nth: int = 0) -> dict:
    hits = []
    for p in T[sid]["pages"]:
        if p["printed_page"] != page:
            continue
        for e in p["exercises"]:
            if no is not None and str(e["no"]) != no:
                continue
            if section is not None and section not in (e.get("section") or ""):
                continue
            hits.append(e)
    if len(hits) <= nth:
        raise KeyError(f"{sid} p{page} no={no} section={section}: not found")
    return hits[nth]


LATIN = re.compile(r"[A-Za-z]")


def answer(it: dict) -> str | None:
    """The printed answer when it is clean book text, else the answer derived from the text.
    (Transcribers sometimes annotate a field in English; such text never reaches a game.)"""
    book = it.get("answer_in_book")
    if isinstance(book, str) and book and not LATIN.search(book):
        return book
    return it.get("answer_derived")


def text_lines(sid: str, kind: str = "reading_text") -> list[tuple[int, str]]:
    return [(t["printed_page"], l) for t in T[sid]["texts"] if t["kind"] == kind for l in t["lines"]]


def page_of(sid: str, word: str, kinds=("reading_text", "poem")) -> int:
    for t in T[sid]["texts"]:
        if t["kind"] in kinds and any(norm(word) in norm(l) for l in t["lines"]):
            return t["printed_page"]
    raise KeyError(f"{sid}: «{word}» not found in text")


def order_tiles(tiles: list[str], word: str) -> list[str]:
    for perm in itertools.permutations(tiles):
        if spells(list(perm), word):
            return list(perm)
    raise ValueError(f"tiles {tiles} do not spell {word}")


def dedupe(entries: list[dict], key: str = "text") -> list[dict]:
    """Drop entries whose text (diacritics, sukun and punctuation ignored) repeats an earlier one."""
    seen, out = set(), []
    for e in entries:
        k = re.sub(r"[^\u0621-\u064A ]", "", bare(e[key])).strip()
        if k not in seen:
            seen.add(k)
            out.append(e)
    return out


def clusters(word: str) -> list[str]:
    """Letters of the shadda-expanded word, each with its diacritics (tatweel dropped)."""
    out: list[str] = []
    for ch in expand_shadda(word.replace(TATWEEL, "")):
        if "\u0621" <= ch <= "\u064A" or not out:
            out.append(ch)
        else:
            out[-1] += ch
    return out


def resplit(word: str, syllables: list[str]) -> list[str]:
    """A split worked out by a transcriber (not printed): keep its syllable BOUNDARIES but take
    every letter and diacritic from the word itself, so the cards always spell the printed word."""
    cl = clusters(word)
    sizes = [len(re.findall("[\u0621-\u064A]", expand_shadda(x.replace(TATWEEL, "")))) for x in syllables]
    if sum(sizes) != len(cl):
        raise ValueError(f"split {syllables} does not cover «{word}»")
    out, i = [], 0
    for n in sizes:
        out.append("".join(cl[i:i + n]))
        i += n
    return out


def split_slashes(s: str) -> list[str]:
    return [x.strip() for x in re.split(r"[/|]", s) if x.strip()]


# --------------------------------------------------------------------------- catalogue records
def game(lesson: str, n: int, title: str, skill: str, mech: str, config: dict, hints: list[str], interpretation: str = "") -> dict:
    g = {
        "game_id": f"{lesson}-G{n:02d}",
        "title": title,
        "skill_id": f"{lesson}-{skill}",
        "mechanic": mech,
        "config": config,
        "hint_levels": hints,
        "content_review_status": "draft_needs_human_review",
        "approval_actor": None,
    }
    if interpretation:
        g["interpretation"] = interpretation
    return g


def lesson(sid: str, unit: str, name: str, kind: str, skills: dict[str, str], games: list[dict], not_gamed: list[dict], notes: str) -> dict:
    d = T[sid]
    book = "ARB-S1-P1" if sid.startswith("ARB-S1-A1") else "ARB-S1-P2"
    lo, hi = d["printed_pages"]
    tasks = []
    for p in d["pages"]:
        for e in p["exercises"]:
            tasks.append(f"ص{p['printed_page']}: {clean(e['instruction'])[:140]}")
    return {
        "subject": "arabic",
        "lesson_id": sid,
        "unit_id": unit,
        "lesson_name": name,
        "kind": kind,
        "source": {
            "source_book_id": book,
            "source_sha256": BOOKS[book]["sha256"],
            "source_printed_page": lo,
            "source_printed_pages": list(range(lo, hi + 1)),
            "source_pdf_page": lo + BOOKS[book]["offset"],
            "core_activity": "",
            "core_activity_title": "",
        },
        "objectives": list(skills.values()),
        "vocabulary": [],
        "skills": [{"id": f"{sid}-{k}", "text": v} for k, v in skills.items()],
        "book_tasks": tasks,
        "games": games,
        "not_gamed": not_gamed,
        "interpretation_notes": notes,
        "content_review_status": "draft_needs_human_review",
        "approval_actor": None,
    }


H_TEXT = ["ارْجِعْ إِلى النَّصِّ وَاقْرَأِ الْفِقْرَةَ مَرَّةً أُخْرى.", "ابْحَثْ عَنِ الْكَلِماتِ نَفْسِها في النَّصِّ."]
H_SYL = ["اقْرَأِ الْمَقاطِعَ بِصَوْتٍ عالٍ.", "ابْدَأْ بِالْمَقْطَعِ الَّذي يَبْدَأُ بِهِ نُطْقُ الْكَلِمَةِ."]
H_SENT = ["ابْدَأْ بِالْكَلِمَةِ الَّتي تَبْدَأُ بِها الْجُمْلَةُ في النَّصِّ.", "اقْرَأِ الْجُمْلَةَ بَعْدَ التَّرْتيبِ: هَلْ مَعْناها مُفيدٌ؟"]
H_COUNT = ["ضَعْ إِصْبَعَكَ عَلى كُلِّ كَلِمَةٍ وَعُدَّ.", "الْكَلِمَةُ تَنْتَهي عِنْدَ الْمَسافَةِ."]
H_SUN = ["اقْرَأِ الْكَلِمَةَ: هَلْ تَسْمَعُ اللّامَ؟", "إِذا كانَ الْحَرْفُ بَعْدَ اللّامِ مُشَدَّدًا فَاللّامُ شَمْسِيَّةٌ."]
H_LETTER = ["انْظُرْ إِلى عَدَدِ النِّقاطِ وَمَكانِها.", "اقْرَأِ الْكَلِمَةَ حَرْفًا حَرْفًا."]
H_ORDER = ["ما الَّذي حَدَثَ أَوَّلًا في النَّصِّ؟", "اقْرَأِ النَّصَّ مِنْ جَديدٍ وَتَتَبَّعِ الْأَحْداثَ."]
H_VOCAB = ["اقْرَأِ الْجُمْلَةَ الَّتي وَرَدَتْ فيها الْكَلِمَةُ.", "ضَعْ كُلَّ خِيارٍ مَكانَ الْكَلِمَةِ: أَيُّها يَحْفَظُ الْمَعْنى؟"]
H_FILL = ["اقْرَأِ الْجُمْلَةَ كامِلَةً مَعَ كُلِّ كَلِمَةٍ.", "ارْجِعْ إِلى النَّصِّ: كَيْفَ وَرَدَتِ الْجُمْلَةُ؟"]
H_POEM = ["أَنْشِدِ الْبَيْتَ بِصَوْتٍ عالٍ.", "ارْجِعْ إِلى الْأُنْشودَةِ في الْكِتابِ."]
H_TAA = ["انْظُرْ إِلى آخِرِ الْكَلِمَةِ.", "هَلِ الْحَرْفُ قَبْلَ التّاءِ يَتَّصِلُ بِما بَعْدَهُ؟"]
H_TANWEEN = ["انْظُرْ إِلى الْحَرَكَةِ عَلى آخِرِ حَرْفٍ.", "تَنْوينُ الْفَتْحِ يَأْتي غالِبًا مَعَ أَلِفٍ في آخِرِ الْكَلِمَةِ."]
H_SORT = ["اقْرَأِ الْكَلِمَةَ جَيِّدًا.", "تَذَكَّرْ عُنْوانَ كُلِّ عَمودٍ."]


# --------------------------------------------------------------------------- shared builders
def q_from(sid: str, page: int, no: str | None = None, section: str | None = None, nth_item: int = 0, q: str | None = None, options: list[str] | None = None, ans: str | None = None) -> dict:
    e = ex(sid, page, no, section)
    it = e["items"][nth_item]
    return {
        "q": q or clean(it.get("text") or e["instruction"]),
        "options": options or it["options"],
        "answer": ans or answer(it),
        "page": page,
    }


def events_from(sid: str, page: int, no: str, section: str | None = None) -> list[dict]:
    e = ex(sid, page, no, section)
    its = sorted(e["items"], key=lambda it: int(str(answer(it)).strip()))
    return [{"text": clean(it["text"]), "page": page} for it in its]


def poem_halves(sid: str) -> list[dict]:
    out = []
    for t in T[sid]["texts"]:
        if t["kind"] != "poem":
            continue
        for v in t["verses"]:
            pg = v.get("printed_page", t["printed_page"])
            out.append({"text": v["sadr"], "page": pg})
            out.append({"text": v.get("ajz") or v.get("ajuz"), "page": pg})
    return out


def letter_words(sid: str, words: list[str], page: int | None = None) -> list[dict]:
    return [{"word": w, "page": page or page_of(sid, w)} for w in words]


# --------------------------------------------------------------------------- sections
def a1_rev() -> dict:
    sid, L = "ARB-S1-A1-REV", "ARB-S1-A1-REV"
    skills = {"S1": "يَفْهَمُ نَصَّ «ما هُوَ؟» وَمُفْرَداتِهِ", "S2": "يُمَيِّزُ الْحُروفَ (ج، ح، خ) في كَلِماتِ النَّصِّ", "S3": "يُحَلِّلُ الْكَلِمَةَ إِلى مَقاطِعَ وَالْجُمْلَةَ إِلى كَلِماتٍ"}
    cloud = ex(sid, 20, "٣")
    statements = [{"text": clean(it["text"]), "inText": answer(it) == "colour", "page": 20} for it in cloud["items"]]
    syn = ex(sid, 20, "٤")
    qs = [
        q_from(sid, 19, "٢", q=clean(ex(sid, 19, "٢")["instruction"])),
        {"q": "ما مُضادُّ كَلِمَةِ «السَّرَّاءُ»؟", "options": syn["items"][0]["options"], "answer": answer(syn["items"][0]), "page": 20},
        {"q": "ما مُرادِفُ كَلِمَةِ «الخِلَّانُ»؟", "options": syn["items"][1]["options"], "answer": answer(syn["items"][1]), "page": 20},
    ]
    find = ex(sid, 21, "١")
    jhk = [w for it in find["items"] for w in it["answer_derived"]]
    syl = ex(sid, 22, "٤")
    sylw = [{"word": clean(it["text"]), "syllables": resplit(clean(it["text"]), split_slashes(it["answer_derived"])), "page": 22} for it in syl["items"]]
    seg = ex(sid, 22, "٣")
    poem = [(p, l) for p, l in text_lines(sid, "poem")]
    count = dedupe([{"text": clean(seg["items"][0]["text"]), "page": 22}] + [
        {"text": l, "page": p} for p, l in poem if 3 <= len([w for w in re.split(r"[\s.،!؟:«»]+", l) if bare(w)]) <= 6
    ])
    games = [
        game(L, 1, "سَحاباتُ وَصْفِ الْكِتابِ", "S1", "ar-text-check", {
            "statements": statements,
            "prompts": {"in": "أَيُّ عِبارَةٍ تُناسِبُ وَصْفَ الْكِتابِ؟", "notIn": "أَيُّ عِبارَةٍ لا تُناسِبُ وَصْفَ الْكِتابِ؟", "allIn": "اخْتَرْ كُلَّ ما يُناسِبُ وَصْفَ الْكِتابِ."},
        }, H_TEXT, "ص20 تمرين 3: ما يناسب وصف الكتاب مستنتج من القصيدة (ص17–18)؛ «ذهب لماع» و«أوراق نقدية» لا تناسب لأن القصيدة تنفيها."),
        game(L, 2, "مَنِ الْمُتَحَدِّثُ؟ وَمَعاني الْكَلِماتِ", "S1", "ar-question", {"questions": qs}, H_VOCAB,
             "المتحدث «معلمتي» استنتاج من «رَنَّ الْجَرَسُ حانَ الدَّرْسُ / قُلْتُ: انْتَبِهوا»؛ «الأصدقاء» مرادف «الخِلّان» بالمعنى المعجمي. الخيار «الْضَّرّاءُ» منقول كما طُبع."),
        game(L, 3, "صَيّادُ الْحُروفِ: ج ح خ", "S2", "ar-letter-find", {"letters": ["ج", "ح", "خ"], "words": letter_words(sid, jhk)}, H_LETTER,
             "الكلمات من القصيدة (ص17–18)، وهي التي يطلبها تمرين ص21 «أبحث عن كلمتين تشتملان على الحروف»."),
        game(L, 4, "مَقاطِعُ الْكَلِماتِ", "S3", "ar-syllables", {"words": sylw}, H_SYL,
             "ص22 تمرين 4 بلا نموذج محلول؛ التقسيم وفق حركات الكلمة وعلى طريقة بطاقات الكتاب في درس «لعبتي» ص44 (مقطع قصير/طويل/مغلق)."),
        game(L, 5, "كَمْ كَلِمَةً؟", "S3", "ar-count-words", {"sentences": count}, H_COUNT,
             "ص22 تمرين 3 يحلّل سطرًا من القصيدة إلى كلمات؛ طُبّق الشيء نفسه على أسطر القصيدة الأخرى (3–6 كلمات)."),
    ]
    not_gamed = [
        {"page": 16, "what": "أتحدث (اختيار هواية)", "reason": "شفهي ورأي شخصي"},
        {"page": 19, "what": "تمرين 1: صور ما يتحدث عنه الشاعر", "reason": "يعتمد على صور الكتاب"},
        {"page": 21, "what": "تمرين 2: تكوين كلمات من ب ر ق", "reason": "إجابة مفتوحة"},
        {"page": 23, "what": "الخط: س، جليس", "reason": "كتابة يدوية"},
    ]
    return lesson(sid, "ARB-S1-A1", "مُراجَعَةٌ", "opening_review", skills, games, not_gamed, "مراجعة لمهارات الصف الأول؛ لم تُستعمل فيها أنماط هذا الفصل (مثل اللام الشمسية).")


def a1_lis() -> dict:
    sid = L = "ARB-S1-A1-LIS"
    skills = {"S1": "يُجيبُ عَنْ أَسْئِلَةٍ تَتَعَلَّقُ بِما اسْتَمَعَ إِلَيْهِ", "S2": "يُصَنِّفُ الْأَطْعِمَةَ إِلى صِحِّيَّةٍ وَغَيْرِ صِحِّيَّةٍ"}
    food = ex(sid, 31, "٢")
    cols = food["items"][0]["options"]
    items = [{"text": it["text"], "column": cols.index(answer(it)), "page": 31} for it in food["items"]]
    games = [
        game(L, 1, "إِلى أَيْنَ ذَهَبَتِ الْأُسْرَةُ؟", "S1", "ar-question", {"questions": [q_from(sid, 28, "١")]}, ["تَذَكَّرْ عُنْوانَ الدَّرْسِ.", "انْظُرْ إِلى الْمُخَطَّطِ في الصَّفْحَةِ التّالِيَةِ."],
             "نص الاستماع غير مطبوع في كتاب الطالب؛ الإجابة «السوق» مستنتجة من العنوان «أتسوق مع أسرتي» ومخطط المتجر ص29."),
        game(L, 2, "أَطْعِمَةٌ صِحِّيَّةٌ", "S2", "ar-sort", {"columns": cols, "items": items}, H_SORT,
             "تصنيف ص31 من المعرفة العامة (لا يطبع الكتاب الإجابة): الحليب والأرز واللحم صحية. يحتاج تأكيد ولي الأمر."),
    ]
    not_gamed = [
        {"page": 29, "what": "رسم مسار الأسرة في المتجر", "reason": "يحتاج نص الاستماع غير المطبوع"},
        {"page": 30, "what": "صل: ماذا اختار كل فرد", "reason": "الإجابة في نص الاستماع غير المطبوع"},
        {"page": 30, "what": "أحلل: قائمة التسوق", "reason": "كتابة مفتوحة"},
        {"page": 32, "what": "نصيحة لصديق", "reason": "رأي شخصي"},
    ]
    return lesson(sid, "ARB-S1-A1", "الِاسْتِماعُ: أَتَسَوَّقُ مَعَ أُسْرَتي", "listening", skills, games, not_gamed, "نص الاستماع يقرؤه المعلم ولا يوجد في كتاب الطالب؛ لذلك غطّت الألعاب سؤالين فقط.")


def a1_l1() -> dict:
    sid = L = "ARB-S1-A1-L1"
    skills = {
        "S1": "يَفْهَمُ نَصَّ «لُعْبَتي»: الْمَعْنى الصَّريحُ وَالضِّمْنِيُّ وَتَرْتيبُ الْأَحْداثِ",
        "S2": "يُحَدِّدُ مَعانِيَ الْكَلِماتِ وَمُضادَّها مِنَ السِّياقِ",
        "S3": "يُرَكِّبُ الْكَلِماتِ مِنَ الْمَقاطِعِ وَالْجُمْلَةَ مِنَ الْكَلِماتِ، وَيَعُدُّ كَلِماتِ الْجُمْلَةِ",
        "S4": "يُكْمِلُ الْجُمْلَةَ الْفِعْلِيَّةَ بِالْفِعْلِ الْمُناسِبِ",
        "S5": "يُمَيِّزُ اللّامَ الشَّمْسِيَّةَ مِنَ اللّامِ الْقَمَرِيَّةِ",
        "S6": "يُمَيِّزُ الْحُروفَ (ب، ت، ث) في الْكَلِماتِ",
    }
    p38 = ex(sid, 38, "2")
    faces = ex(sid, 42, "1", "الثَّالِثَةُ")
    qs = [
        {"q": clean(p38["items"][0]["text"]), "options": p38["items"][0]["options"], "answer": answer(p38["items"][0]), "page": 38},
        {"q": clean(p38["items"][1]["text"]), "options": p38["items"][1]["options"], "answer": answer(p38["items"][1]), "page": 38},
        q_from(sid, 40, "5"),
        {"q": clean(faces["instruction"]), "options": ["😀", "😢", "😠", "😕"], "answer": "😀", "page": 42},
    ]
    st = ex(sid, 39, "3")
    statements = [{"text": clean(it["text"]), "inText": answer(it) == "✔", "page": 39} for it in st["items"]]
    vocab = [
        q_from(sid, 41, "1", "الثَّانِيَةُ"),
        q_from(sid, 42, "2", "الثَّانِيَةُ"),
        q_from(sid, 42, "3", "الثَّانِيَةُ", q="«كانَتْ ناعِمَةً وَجَميلَةً»: ما مُضادُّ كَلِمَةِ «ناعِمَةً»؟"),
    ]
    syl = ex(sid, 44, "1")
    sylw = [{"word": answer(it), "syllables": order_tiles(it["options"], answer(it)), "page": 44} for it in syl["items"] if it["options"]]
    sentence = answer(syl["items"][-1])
    cnt = ex(sid, 44, "2")
    count = [{"text": clean(it["text"]), "page": 44} for it in cnt["items"]] + [{"text": sentence, "page": 44}]
    fill = ex(sid, 45, "1")
    fills = [{"text": clean(it["text"]), "answer": answer(it), "page": 45} for it in fill["items"]]
    sun = ex(sid, 46, "2")
    hw = T[sid]["handwriting"]
    hw_words = hw["words"] + [w for w in re.split(r"[\s،.]+", hw["sentences"][0]) if bare(w)]
    games = [
        game(L, 1, "أَسْئِلَةُ النَّصِّ", "S1", "ar-question", {"questions": qs}, H_TEXT,
             "الإجابات مستنتجة من النص ص35–37. سؤال الوجوه (ص42) رُسمت خياراته برموز وجوه تعبيرية بدل رسوم الكتاب."),
        game(L, 2, "قَرَأْتُها في النَّصِّ؟", "S1", "ar-text-check", {"statements": statements}, H_TEXT, "ما ورد/لم يرد مستنتج بمطابقة النص ص35–37."),
        game(L, 3, "رَتِّبْ أَحْداثَ الْقِصَّةِ", "S1", "ar-event-order", {"events": events_from(sid, 41, "6")}, H_ORDER, "الترتيب الصحيح مستنتج من تسلسل النص."),
        game(L, 4, "مَعاني الْكَلِماتِ", "S2", "ar-question", {"questions": vocab}, H_VOCAB,
             "الإجابات (غَمَسَتْها، سَحَبَها، خَشِنَةً) من المعنى والسياق؛ استُبعد سؤال «الغبطة» ص42 لأن الكتاب لا يحسم المقصود."),
        game(L, 5, "بِطاقاتُ الْمَقاطِعِ", "S3", "ar-syllables", {"words": sylw}, H_SYL, "البطاقات كما طُبعت ص44."),
        game(L, 6, "مِنَ الْكَلِماتِ جُمْلَةً", "S3", "ar-sentence-build", {"sentences": [{"text": sentence, "alt": ["عَمُّها أَهْداها دُمْيَةً جَميلَةً."], "page": 44}]}, H_SENT,
             "جملة ص44؛ يُقبل أيضًا تقديم الفاعل «عَمُّها أَهْداها…» لأنها جملة صحيحة."),
        game(L, 7, "كَمْ كَلِمَةً في الْجُمْلَةِ؟", "S3", "ar-count-words", {"sentences": count}, H_COUNT),
        game(L, 8, "أُكْمِلُ بِالْفِعْلِ", "S4", "ar-fill-word", {"bank": fill["word_bank"], "items": fills}, H_FILL,
             "المثال الأول مطبوع؛ بقية الإجابات تطابق جمل النص."),
        game(L, 9, "شَمْسِيَّةٌ أَمْ قَمَرِيَّةٌ؟", "S5", "ar-sun-moon", {"words": [{"word": it["text"], "page": 46} for it in sun["items"]]}, H_SUN),
        game(L, 10, "ب ت ث", "S6", "ar-letter-find", {"letters": ["ب", "ت", "ث"], "words": [{"word": w, "page": 47} for w in hw_words]}, H_LETTER,
             "كلمات صفحة الخط ص47."),
    ]
    not_gamed = [
        {"page": 33, "what": "أتحدث", "reason": "شفهي"},
        {"page": 38, "what": "تمرين 1: لوّن اللعبة", "reason": "رسوم الكتاب"},
        {"page": 39, "what": "تمرين 4: جملة لكل صورة", "reason": "صور الكتاب وكتابة"},
        {"page": 42, "what": "مرادف «الغبطة»", "reason": "الكتاب لا يحسم المقصود (السرور/الحسد)"},
        {"page": 43, "what": "أحاكي، ورأيي، وأحكي", "reason": "إنتاج مفتوح وشفهي"},
        {"page": 45, "what": "تمرين 2: أفعال للصورة", "reason": "يعتمد على الصورة وأكثر من فعل يصح"},
        {"page": 47, "what": "الخط", "reason": "كتابة يدوية؛ غُطّي تمييز الحروف"},
        {"page": 48, "what": "القصة المصورة", "reason": "يعتمد على ترتيب صور الكتاب"},
    ]
    return lesson(sid, "ARB-S1-A1", "الدَّرْسُ الْأَوَّلُ: لُعْبَتي", "reading_lesson", skills, games, not_gamed, "")


def a1_l2() -> dict:
    sid = L = "ARB-S1-A1-L2"
    skills = {
        "S1": "يَفْهَمُ نَصَّ «سَيَكْبُرونَ»: الْمَكانُ وَالزَّمانُ وَالْأَحْداثُ وَالتَّعْليلُ",
        "S2": "يُحَدِّدُ مُرادِفَ الْكَلِمَةِ مِنَ السِّياقِ",
        "S3": "يُمَيِّزُ الْحُروفَ (ص، ض، ط، ظ) في الْكَلِماتِ",
        "S4": "يُحَلِّلُ الْجُمْلَةَ إِلى كَلِماتٍ وَالْكَلِمَةَ إِلى مَقاطِعَ",
        "S5": "يَسْتَعْمِلُ ظَرْفَيِ الزَّمانِ وَالْمَكانِ",
        "S6": "يُمَيِّزُ التّاءَ الْمَفْتوحَةَ مِنَ الْمَرْبوطَةِ",
        "S7": "يُرَتِّبُ جُمَلًا لِلْحُصولِ عَلى فِقْرَةٍ",
    }
    place = ex(sid, 55, "1")
    lunch = ex(sid, 57, "1")
    qs = [
        {"q": "أَيْنَ وَقَعَتِ الْأَحْداثُ؟", "options": [re.sub(r"\s*\(.*\)", "", o) for o in place["items"][0]["options"]], "answer": "الْبَيْتُ", "page": 55},
        {"q": clean(lunch["instruction"]).split("؟")[0] + "؟", "options": lunch["word_bank"], "answer": answer(lunch["items"][0]), "page": 57},
        q_from(sid, 59, "1"),
    ]
    st = ex(sid, 56, "4")
    statements = [{"text": clean(it["text"]), "inText": answer(it) == "✔", "page": 56} for it in st["items"]]
    syn = ex(sid, 58, "2")
    syns = [
        {"q": "«نَسْمَعُها تَقولُ هامِسَةً»: ما مَعْنى «هامِسَةً»؟", "options": syn["items"][0]["options"], "answer": answer(syn["items"][0]), "page": 58},
        {"q": "«كُتُبُنا وَأَقْلامُنا تَحْتَ الْمِنْضَدَةِ»: ما مَعْنى «الْمِنْضَدَةِ»؟", "options": syn["items"][1]["options"], "answer": answer(syn["items"][1]), "page": 58},
    ]
    miss = ex(sid, 60, "1")
    mitems = []
    for it in miss["items"]:
        m = re.search(r"\((.+?)\)", it["answer_derived"])
        if not m or "،" in m.group(1):
            continue  # the last line has four blanks
        word = m.group(1)
        sentence = re.sub(r"\S*\.{3,}\S*", word, clean(it["text"]).replace("___", "....."), count=1)
        composed[sentence] = sid
        mitems.append({"word": word, "sentence": sentence, "page": 60})
    hw = T[sid]["handwriting"]
    hw_words = hw["words"] + [w for w in re.split(r"[\s،.]+", hw["sentences"][0]) if bare(w)]
    cnt = ex(sid, 61, "3")
    count = [{"text": clean(it["text"]), "page": 61} for it in cnt["items"]]
    sy = ex(sid, 61, "4")
    sylw = []
    for it in sy["items"]:
        parts = [x.strip(" .") for x in split_slashes(answer(it).split("—")[0]) if x.strip(" .")]
        printed = bool(it.get("answer_in_book")) and not LATIN.search(it["answer_in_book"])
        sylw.append({"word": clean(it["text"]), "syllables": parts if printed else resplit(clean(it["text"]), parts), "page": 61})
    adv = ex(sid, 62, "1")
    pick_adv = {1: ("بَعْدَ", ["قَبْلَ", "عِنْدَ"]), 2: ("عِنْدَ", ["قَبْلَ", "بَعْدَ"]), 5: ("قَبْلَ", [])}
    fills = [{"text": clean(adv["items"][i]["text"]), "answer": a, **({"alsoFits": f} if f else {}), "page": 62} for i, (a, f) in pick_adv.items()]
    taa = ex(sid, 64, "6")
    para = ex(sid, 66, "6", nth=0)
    games = [
        game(L, 1, "أَسْئِلَةُ النَّصِّ", "S1", "ar-question", {"questions": qs}, H_TEXT, "الإجابات من النص ص51–54؛ خيارات المكان ص55 صور في الكتاب وكُتبت أسماؤها هنا."),
        game(L, 2, "مُوافِقَةٌ لِلنَّصِّ؟", "S1", "ar-text-check", {
            "statements": statements,
            "prompts": {"in": "أَيُّ جُمْلَةٍ مُوافِقَةٌ لِلنَّصِّ؟", "notIn": "أَيُّ جُمْلَةٍ غَيْرُ مُوافِقَةٍ لِلنَّصِّ؟", "allIn": "اخْتَرْ كُلَّ جُمْلَةٍ مُوافِقَةٍ لِلنَّصِّ."},
        }, H_TEXT, "الموافقة مستنتجة من النص."),
        game(L, 3, "رَتِّبْ أَحْداثَ النَّصِّ", "S1", "ar-event-order", {"events": events_from(sid, 57, "5")}, H_ORDER),
        game(L, 4, "مَعاني الْكَلِماتِ", "S2", "ar-question", {"questions": syns}, H_VOCAB, "الإجابتان بالمعنى المعجمي؛ الكتاب لا يطبعهما."),
        game(L, 5, "الْحَرْفُ النّاقِصُ: ص ض ط ظ", "S3", "ar-missing-letter", {"letters": ["ص", "ض", "ط", "ظ"], "items": mitems}, H_LETTER,
             "جمل ص60 كما طُبعت، والكلمة الكاملة من النص؛ استُبعد السطر الأخير لأن فيه أربعة فراغات."),
        game(L, 6, "ص ض", "S3", "ar-letter-find", {"letters": ["ص", "ض"], "words": [{"word": w, "page": 65} for w in hw_words]}, H_LETTER, "كلمات صفحة الخط ص65."),
        game(L, 7, "كَمْ كَلِمَةً؟", "S4", "ar-count-words", {"sentences": count}, H_COUNT, "المثال الأول مطبوع (٦ كلمات)."),
        game(L, 8, "مَقاطِعُ الْكَلِماتِ", "S4", "ar-syllables", {"words": sylw}, H_SYL, "«الْمَدْرَسَةُ» مقسمة في الكتاب ص61؛ والكلمتان الأخريان على النموذج نفسه."),
        game(L, 9, "قَبْلَ، بَعْدَ، عِنْدَ…", "S5", "ar-fill-word", {"bank": adv["word_bank"], "items": fills, "prompt": "أَعِدِ الْكَلِمَةَ إِلى مَكانِها كَما في النَّصِّ."}, H_FILL,
             "جمل ص62 ذات الفراغ الواحد؛ الظروف التي تصح أيضًا لا تُعرض خيارًا خاطئًا."),
        game(L, 10, "ت أَمْ ـة أَمْ ة؟", "S6", "ar-taa", {"words": [{"word": w, "page": 64} for w in taa["word_bank"]]}, H_TAA),
        game(L, 11, "رَتِّبِ الْجُمَلَ", "S7", "ar-event-order", {"events": events_from(sid, 66, "6"), "prompt": "رَتِّبِ الْجُمَلَ لِتَحْصُلَ عَلى فِقْرَةٍ."}, H_ORDER,
             "الترتيب من إطار الفقرة المطبوع ص66 (في الصباح… ثم… فجأة… فرعته أمي… حتى…)."),
    ]
    not_gamed = [
        {"page": 49, "what": "أتحدث", "reason": "شفهي"},
        {"page": 50, "what": "العنوان والكاتب والتوقع", "reason": "كتابة وتوقع"},
        {"page": 55, "what": "عبارة لكل صورة", "reason": "صور الكتاب"},
        {"page": 56, "what": "أفراد أسرة الكاتب", "reason": "كتابة؛ الأخوان بأي ترتيب"},
        {"page": 59, "what": "أحاكي، وعبارة أعجبتني، وأحدث زملائي", "reason": "إنتاج ورأي"},
        {"page": 60, "what": "إكمال الكلمات بالمقاطع", "reason": "بطاقتان مطبوعتان بشكل غير واضح («نَْـ» و«ـئـ»)"},
        {"page": 63, "what": "جمل بالظروف من الصور", "reason": "إنتاج مفتوح"},
        {"page": 65, "what": "الخط", "reason": "كتابة يدوية؛ غُطّي تمييز الحرفين"},
        {"page": 66, "what": "إعادة كتابة الفقرة", "reason": "كتابة"},
    ]
    return lesson(sid, "ARB-S1-A1", "الدَّرْسُ الثّاني: سَيَكْبُرونَ", "reading_lesson", skills, games, not_gamed, "")


def fill_blanks(text: str, words: list[str]) -> str:
    """Replace each blanked word («صَبا......»، «الـ......ـديقَةِ.») by the full word, in order,
    keeping punctuation that follows the blank («فَـ......ـأَةً!» → «فَجْأَةً!»)."""
    it = iter(words)

    def sub(m: re.Match) -> str:
        after = re.split(r"\.{3,}|…+", m.group(0))[-1]  # what follows the dots, e.g. «ـأَةً!»
        tail = re.search(r"[!.،؟:]+$", after)
        return next(it, m.group(0)) + (tail.group(0) if tail else "")

    return re.sub(r"\S*(?:\.{3,}|…+)\S*", sub, text)


def a1_l3() -> dict:
    sid = L = "ARB-S1-A1-L3"
    skills = {
        "S1": "يَفْهَمُ نَصَّ «لَيْسَ هَذا ضَعْفًا»: الْعَلاقاتُ وَالْأَحْداثُ وَالْأَسْبابُ وَالْعِبْرَةُ",
        "S2": "يُحَدِّدُ مُرادِفَ الْكَلِمَةِ مِنَ السِّياقِ",
        "S3": "يُمَيِّزُ الْحُروفَ (ج، ح، خ) في الْكَلِماتِ",
        "S4": "يُحَلِّلُ الْجُمْلَةَ إِلى كَلِماتٍ وَالْكَلِمَةَ إِلى مَقاطِعَ",
        "S5": "يَسْتَعْمِلُ حُروفَ الْجَرِّ وَيُرَكِّبُ جُمْلَةً",
        "S6": "يَضَعُ عَلاماتِ التَّرْقيمِ (، . ؟) في الْحِوارِ",
        "S7": "يُكْمِلُ قِصَّةً بِكَلِماتٍ مُناسِبَةٍ",
    }
    pred = ex(sid, 68, "b2")
    qs = [
        {"q": "«لَيْسَ هَذا ضَعْفًا»: " + clean(pred["items"][0]["text"]), "options": pred["items"][0]["options"], "answer": answer(pred["items"][0]), "page": 68},
        q_from(sid, 72, "1", q="ما الْعَلاقَةُ الَّتي تَرْبُطُ سَليمًا بِفَهْدٍ؟"),
        q_from(sid, 72, "2"),
        q_from(sid, 72, "3"),
        q_from(sid, 73, "4"),
        q_from(sid, 76, "1"),
        q_from(sid, 76, "2"),
    ]
    ce = ex(sid, 74, "1")
    causes = [{"q": f"السَّبَبُ: «{clean(it['text'])}» فَما النَّتيجَةُ؟", "options": ce["word_bank"], "answer": answer(it), "page": 74} for it in ce["items"]]
    syn = [
        {"q": "«يُمْكِنُ أَنْ أَنْضَمَّ إِلَيْكُمْ»: ما مُرادِفُ «أَنْضَمَّ»؟", "options": ex(sid, 74, "2")["items"][0]["options"], "answer": answer(ex(sid, 74, "2")["items"][0]), "page": 74},
        {"q": "«أَكَلَ الشَّطيرَةَ بِشَراهَةٍ شَديدَةٍ»: ما مَعْنى «بِشَراهَةٍ»؟", "options": ex(sid, 75, "3")["items"][0]["options"], "answer": answer(ex(sid, 75, "3")["items"][0]), "page": 75},
    ]
    miss = ex(sid, 78, "1")
    group = ["ج", "ح", "خ"]
    mitems = []
    for it in miss["items"]:
        ws = [w.strip() for w in re.search(r"\((.+)\)", it["answer_derived"]).group(1).split("،")]
        sentence = clean(fill_blanks(it["text"], ws))
        composed[sentence] = sid
        for w in ws:
            if sum(len(letter_positions(w, g)) for g in group) == 1:
                mitems.append({"word": w, "sentence": sentence, "page": 78})
    hw = T[sid]["handwriting"]
    hw_words = hw["words"] + [w for w in re.split(r"[\s،.]+", hw["sentences"][0]) if bare(w)]
    cnt = ex(sid, 79, "3")
    count = [{"text": clean(it["text"]).replace("/", ""), "page": 79} for it in cnt["items"]]
    count = [dict(c, text=re.sub(r"\s+", " ", c["text"])) for c in count]
    sy = ex(sid, 79, "4")
    sylw = []
    for it in sy["items"]:
        parts = [x.strip(" .") for x in split_slashes(answer(it).split("—")[0]) if x.strip(" .")]
        sylw.append({"word": clean(it["text"]), "syllables": resplit(clean(it["text"]), parts), "page": 79})
    prep = ex(sid, 80, "1")
    bank = prep["word_bank"]
    to_bank = lambda a: next(b for b in bank if bare(b).replace("ـ", "") == bare(a).replace("ـ", ""))
    fits = {1: ["عن"], 2: ["في"], 3: ["في"]}
    pfills = []
    for i in range(5):
        it = prep["items"][i]
        pfills.append({"text": clean(it["text"]), "answer": to_bank(answer(it)), **({"alsoFits": fits[i]} if i in fits else {}), "page": 80})
    words2 = ex(sid, 80, "2")
    sent = answer(words2["items"][0])
    dlg = ex(sid, 81, "1")
    dq = []
    for it in dlg["items"]:
        marks = answer(it).split()
        line = clean(it["text"])
        k = len(marks) - 1  # only the slot that closes the utterance has a single right mark
        n = [0]
        def fill(m):
            j = n[0]
            n[0] += 1
            return f"( {marks[j]} )" if j < k else "( ؟ )"
        shown = re.sub(r"\(\s*\)", fill, line)
        composed[shown] = sid
        dq.append({"q": "ما الْعَلامَةُ الْمُناسِبَةُ مَكانَ ( ؟ )؟", "text": shown, "options": dlg["word_bank"], "answer": marks[k], "page": 81})
    cz = ex(sid, 83, "1")
    para = " ".join(it["text"] for it in cz["items"])
    answers = [w.strip() for it in cz["items"] for w in answer(it).split("،")]
    blanks = list(re.finditer(r"\.{3,}|…+", para))  # only the dots: letters and punctuation around them stay
    cloze = []
    for t, m in enumerate(blanks):
        if para[max(0, m.start() - 2):m.start()].endswith("بـ"):
            continue  # a blank glued to «بـ» would show a broken word
        pieces, last = [], 0
        for j, b in enumerate(blanks):
            pieces.append(para[last:b.start()])
            pieces.append("___" if j == t else answers[j])
            last = b.end()
        filled = re.sub(r"بـ(?=\S)", "بِ", "".join(pieces) + para[last:])
        # The book prints this story with few full stops: show the blank's clause (with the clause
        # before it when it is very short) instead of a 40-word run.
        clauses = [c for c in re.split(r"(?<=[.!؟،:])\s+", filled) if c.strip()]
        k = next(i for i, c in enumerate(clauses) if "___" in c)
        sentence = clauses[k] if len(clauses[k].split()) >= 5 or k == 0 else f"{clauses[k - 1]} {clauses[k]}"
        sentence = sentence.strip()
        composed[sentence] = sid
        item = {"text": sentence, "answer": answers[t], "page": 83}
        if answers[t] == "الْمَلْعَبِ":
            item["alsoFits"] = ["الْحَديقَةِ"]
        cloze.append(item)
    games = [
        game(L, 1, "أَسْئِلَةُ النَّصِّ", "S1", "ar-question", {"questions": qs}, H_TEXT, "الإجابات من النص ص69–71؛ «من الواقع» (ص76) استنتاج لأن أحداث القصة ممكنة الوقوع."),
        game(L, 2, "رَتِّبْ أَحْداثَ النَّصِّ", "S1", "ar-event-order", {"events": events_from(sid, 73, "5")}, H_ORDER),
        game(L, 3, "السَّبَبُ وَالنَّتيجَةُ", "S1", "ar-question", {"questions": causes}, H_TEXT, "صل السبب بالنتيجة ص74؛ النتائج من النص."),
        game(L, 4, "الْمُرادِفُ", "S2", "ar-question", {"questions": syn}, H_VOCAB, "بالمعنى المعجمي."),
        game(L, 5, "الْحَرْفُ النّاقِصُ: ج ح خ", "S3", "ar-missing-letter", {"letters": group, "items": mitems}, H_LETTER,
             "جمل ص78 بعد إكمالها من النص؛ تُخفى كلمة واحدة فيها حرف واحد من المجموعة («خَرَجَ» لا تُستعمل لأن فيها حرفين)."),
        game(L, 6, "ج ح خ", "S3", "ar-letter-find", {"letters": group, "words": [{"word": w, "page": 82} for w in hw_words]}, H_LETTER, "كلمات صفحة الخط ص82."),
        game(L, 7, "كَمْ كَلِمَةً؟", "S4", "ar-count-words", {"sentences": count}, H_COUNT, "المثال الأول مطبوع (٣ كلمات)."),
        game(L, 8, "مَقاطِعُ الْكَلِماتِ", "S4", "ar-syllables", {"words": sylw}, H_SYL, "«ساخِرًا» مقسمة في الكتاب ص79؛ والبقية على النموذج نفسه."),
        game(L, 9, "حُروفُ الْجَرِّ", "S5", "ar-fill-word", {"bank": bank, "items": pfills, "prompt": "اخْتَرْ حَرْفَ الْجَرِّ الْمُناسِبَ كَما في النَّصِّ."}, H_FILL,
             "جمل ص80؛ لا يُعرض خيارًا خاطئًا ما يصح أيضًا («عن أدب»، «في وجهه»، «في عنف»)."),
        game(L, 10, "مِنَ الْكَلِماتِ جُمْلَةً", "S5", "ar-sentence-build", {"sentences": [{"text": sent, "alt": ["في السَّاعَةِ الثَّانِيَةِ أَعودُ إِلى الْبَيْتِ.", "أَعودُ في السَّاعَةِ الثَّانِيَةِ إِلى الْبَيْتِ."], "page": 80}]}, H_SENT,
             "بطاقات ص80 (الجملة الأولى)؛ تُقبل ترتيبات صحيحة أخرى. لم تُستعمل الثانية لأن «بِـ» بطاقة منفصلة."),
        game(L, 11, "عَلاماتُ التَّرْقيمِ في الْحِوارِ", "S6", "ar-question", {"questions": dq}, ["الْجُمْلَةُ الَّتي تَسْأَلُ تَنْتَهي بِـ«؟».", "الْجُمْلَةُ الَّتي تُخْبِرُ تَنْتَهي بِـ«.»."],
             "حوار ص81؛ يُسأل عن العلامة التي تختم كل كلام فقط، لأن الفاصلة والنقطة قد تصحان في الموضع الأول."),
        game(L, 12, "أُكْمِلُ الْقِصَّةَ", "S7", "ar-fill-word", {"bank": cz["word_bank"], "items": cloze}, H_FILL,
             "قصة ص83؛ «الحديقة» تصح أيضًا بعد «خارج» فلا تُعرض خيارًا خاطئًا هناك."),
    ]
    not_gamed = [
        {"page": 67, "what": "أتحدث", "reason": "شفهي"},
        {"page": 75, "what": "أماكن الأحداث", "reason": "كتابة"},
        {"page": 76, "what": "هل أخذ أحد منك شيئًا", "reason": "رأي شخصي"},
        {"page": 77, "what": "تمثيل الأدوار، وعنوان آخر، والرأي", "reason": "شفهي وإنتاج ورأي"},
        {"page": 78, "what": "المقطع المناسب لإكمال الكلمة", "reason": "لم تُصمم له لعبة بعد"},
        {"page": 81, "what": "إعادة كتابة الحوار", "reason": "كتابة"},
        {"page": 82, "what": "الخط", "reason": "كتابة يدوية؛ غُطّي تمييز الحروف"},
        {"page": 83, "what": "رد ناجية", "reason": "توقع مفتوح"},
    ]
    return lesson(sid, "ARB-S1-A1", "الدَّرْسُ الثّالِثُ: لَيْسَ هَذا ضَعْفًا", "reading_lesson", skills, games, not_gamed, "")


def letter_positions(word: str, letter: str) -> list[int]:
    b = bare(word)
    return [i for i, ch in enumerate(b) if ch == letter]


def a1_poem() -> dict:
    sid = L = "ARB-S1-A1-POEM"
    skills = {"S1": "يَحْفَظُ أُنْشودَةَ «صَباحُ الْخَيْرِ» وَيُرَتِّبُ أَبْياتَها", "S2": "يَفْهَمُ مُفْرَداتِ الْأُنْشودَةِ"}
    halves = poem_halves(sid)
    games = [
        game(L, 1, "أُكْمِلُ الْبَيْتَ", "S1", "ar-poem-gap", {"lines": halves}, H_POEM),
        game(L, 2, "رَتِّبْ أَشْطُرَ الْأُنْشودَةِ", "S1", "ar-event-order", {"events": halves, "prompt": "رَتِّبْ أَشْطُرَ الْأُنْشودَةِ كَما حَفِظْتَها."}, H_POEM, "ترتيب الأشطر كما طُبعت ص84–85."),
        game(L, 3, "مَعْنى «ماضٍ»", "S2", "ar-question", {"questions": [q_from(sid, 86, "2", q=clean(ex(sid, 86, "2")["instruction"]))]}, H_VOCAB, "«ذاهب» بمعنى «ماضٍ» في «وداعًا إنني ماضٍ بدربي نحو مدرستي»."),
    ]
    not_gamed = [{"page": 86, "what": "الإنشاد وقول صباح الخير", "reason": "شفهي"}, {"page": 87, "what": "بيت لكل صورة، والبيت المفضل", "reason": "صور الكتاب ورأي"}]
    return lesson(sid, "ARB-S1-A1", "أُنْشِدُ وَأَحْفَظُ: صَباحُ الْخَيْرِ", "poem", skills, games, not_gamed, "")


def a1_arev() -> dict:
    sid = L = "ARB-S1-A1-AREV"
    skills = {
        "S1": "يَفْهَمُ نَصَّ «مِفْتاحُ الْقِراءَةِ»",
        "S2": "يَسْتَعْمِلُ ظُروفَ الْمَكانِ الْمُناسِبَةَ",
        "S3": "يُمَيِّزُ أَشْكالَ التّاءِ في آخِرِ الْكَلِمَةِ",
        "S4": "يُرَكِّبُ جُمْلَةً مِنْ كَلِماتٍ وَيُحَلِّلُ الْكَلِمَةَ إِلى مَقاطِعَ",
    }
    qs = [
        q_from(sid, 90, "1", q="ما عُمْرُ يَحْيى؟"),
        q_from(sid, 90, "2", q="ما مَوْضوعُ الْمُسابَقَةِ الَّتي أَقامَتْها الْمُعَلِّمَةُ؟"),
        q_from(sid, 91, "3", q=clean(ex(sid, 91, "3")["instruction"])),
    ]
    adv = ex(sid, 93, "6")
    fills = [
        {"text": clean(adv["items"][0]["text"]), "answer": "حَوْلَ", "alsoFits": ["قُرْبَ", "عِنْدَ"], "page": 93},
        {"text": clean(adv["items"][1]["text"]), "answer": "بَيْنَ", "alsoFits": ["عِنْدَ"], "page": 93},
    ]
    taa = ex(sid, 94, "8")
    taa_words = [it["text"] for it in taa["items"] if not str(answer(it)).startswith("none")]
    sb = ex(sid, 96, "10ب")
    sent = answer(sb["items"][0])
    syl = ex(sid, 95, "9")
    sylw = [{"word": clean(it["text"]), "syllables": resplit(clean(it["text"]), split_slashes(it["answer_derived"])), "page": 95} for it in syl["items"]]
    games = [
        game(L, 1, "أَسْئِلَةُ النَّصِّ", "S1", "ar-question", {"questions": qs}, H_TEXT, "الإجابات من النص ص88–89."),
        game(L, 2, "أَيْنَ؟ ظُروفُ الْمَكانِ", "S2", "ar-fill-word", {"bank": adv["word_bank"], "items": fills}, H_FILL,
             "الجملتان 1 و2 من ص93. «قُرْبَ/عِنْدَ» تصحّان أيضًا في الأولى و«عِنْدَ» في الثانية فلا تُعرض خيارًا خاطئًا. استُبعدت الجملة 3 (ترتيب السور) والجملة 4 (فراغان يتبادلان)."),
        game(L, 3, "ت أَمْ ـة أَمْ ة؟", "S3", "ar-taa", {"words": [{"word": w, "page": 94} for w in taa_words]}, H_TAA,
             "جدول ص94؛ استُبعدت «حَقَّهُ» و«سَنُيَسِّرُهُ» (تنتهيان بالهاء)."),
        game(L, 4, "جُمْلَةٌ مُفيدَةٌ", "S4", "ar-sentence-build", {"sentences": [{"text": sent, "alt": ["يَحْيى فازَ بِجائِزَتَيْ الكِتابَةِ وَالْقِراءَةِ."], "page": 96}]}, H_SENT,
             "بطاقات ص96؛ يُقبل تقديم الفاعل أيضًا."),
        game(L, 5, "مَقاطِعُ الْكَلِماتِ", "S4", "ar-syllables", {"words": sylw}, H_SYL,
             "ص95 بلا نموذج؛ التقسيم على طريقة بطاقات ص44 (الشدة حرفان، وهمزة الوصل مع الساكن)."),
    ]
    not_gamed = [
        {"page": 89, "what": "سورة الليل", "reason": "نص قرآني: لا يُستعمل في الألعاب دون مراجعة على مصحف معتمد"},
        {"page": 91, "what": "لماذا اختارت المعلمة السورة", "reason": "كتابة"},
        {"page": 92, "what": "كلمة لكل حرف من سورة الليل", "reason": "نص قرآني"},
        {"page": 94, "what": "حروف الجر في جمل من إنشائي", "reason": "إنتاج مفتوح"},
        {"page": 95, "what": "أربع كلمات من ع س ل", "reason": "إجابة مفتوحة"},
        {"page": 96, "what": "الخط (آيات)", "reason": "نص قرآني وكتابة يدوية"},
        {"page": 97, "what": "التعبير عن المشهد", "reason": "إنتاج مفتوح"},
    ]
    return lesson(sid, "ARB-S1-A1", "مُراجَعَةُ الْمِحْوَرِ: مِفْتاحُ الْقِراءَةِ", "axis_review", skills, games, not_gamed, "لا يُستعمل أي نص قرآني في الألعاب.")


def story(sid: str, unit: str, pages_note: str) -> dict:
    return lesson(sid, unit, "قِصَّةٌ أَعْجَبَتْني", "story", {"S1": "يُبْدي رَأْيَهُ في قِصَّةٍ قَرَأَها"}, [],
                  [{"page": T[sid]["printed_pages"][0], "what": "بطاقة قصة يختارها الطفل", "reason": "لا نص في الكتاب؛ نشاط حر ورأي شخصي"}],
                  f"لا قصة مطبوعة: الصفحة نموذج لقصة يختارها الطفل. {pages_note}")


def a2_l2() -> dict:
    sid = L = "ARB-S1-A2-L2"
    skills = {
        "S1": "يَفْهَمُ نَصَّ «لَيْلى تَرْسُمُ وَطَنًا»: الْأَحْداثُ وَالْأَماكِنُ وَالشَّخْصِيّاتُ وَالْفِكْرَةُ الرَّئيسَةُ",
        "S2": "يُحَدِّدُ مُرادِفَ الْكَلِمَةِ مِنَ السِّياقِ",
        "S3": "يُرَتِّبُ الْكَلِماتِ في جُمَلٍ مُفيدَةٍ وَيُحَلِّلُها إِلى كَلِماتٍ وَمَقاطِعَ",
        "S4": "يُمَيِّزُ الْكَلِماتِ الْمُنْتَهِيَةَ بِـ(ـه / ه) مِنَ الْمُنْتَهِيَةِ بِـ(ـة / ة)",
        "S5": "يُمَيِّزُ الْحَرْفَيْنِ (ف، ق) في الْكَلِماتِ",
        "S6": "يُرَتِّبُ مَقاطِعَ قِصَّةٍ قَصيرَةٍ",
    }
    place = ex(sid, 47, "4")
    qs = [q_from(sid, 46, "1"), q_from(sid, 47, "3"), q_from(sid, 50, "1")] + [
        {"q": f"{clean(it['text'])}: في أَيِّ مَكانٍ؟", "options": place["word_bank"], "answer": answer(it), "page": 47} for it in place["items"]
    ]
    chars = ex(sid, 48, "1")
    who = set([answer(chars["items"][0])] + [x.strip() for x in answer(chars["items"][1]).split("،")])
    statements = [{"text": o, "inText": o in who, "page": 48} for o in chars["items"][0]["options"]]
    syn = ex(sid, 49, "3")
    syns = [
        {"q": "«حَلَّ الْمَساءُ»: ما مُرادِفُ «حَلَّ»؟", "options": syn["items"][0]["options"], "answer": answer(syn["items"][0]), "page": 49},
        {"q": "«نَأْوي إِلَيْهِ»: ما مُرادِفُ «نَأْوي»؟", "options": syn["items"][1]["options"], "answer": answer(syn["items"][1]), "page": 49},
    ]
    cards = ex(sid, 54, "2")
    alts = {
        0: ["دَائِمًا تُحِبُّ أَنْ تَعودَ إِلى بَيتِها"],
        1: ["الْوَطَنُ الصَّغيرُ هُوَ الْبَيْتُ"],
        2: ["أَحْيانًا تَطْلُبُ مِنْ رُسومِها أَنْ تُحَقِّقَ أَحْلامَها", "تَطْلُبُ مِنْ رُسومِها أَحْيانًا أَنْ تُحَقِّقَ أَحْلامَها"],
    }
    sents = [{"text": answer(it), "alt": alts[i], "page": 54} for i, it in enumerate(cards["items"])]
    seg = ex(sid, 52, "1")
    count = dedupe([{"text": clean(seg["items"][0]["text"]), "page": 52}] + [{"text": s["text"], "page": 54} for s in sents])
    syl = ex(sid, 52, "2")
    sylw = [{"word": "الْبَيْتُ", "syllables": split_slashes(syl["items"][0]["answer_in_book"]), "page": 52}, {"word": "هُوَ", "syllables": resplit("هُوَ", split_slashes(answer(syl["items"][1]))), "page": 52}, {"word": "الْوَطَنُ", "syllables": resplit("الْوَطَنُ", split_slashes(answer(syl["items"][2]))), "page": 52}]
    ha = T[sid]["spelling_pattern"]["words"]
    cols = ["تَنْتَهي بِـ(ـه / ه)", "تَنْتَهي بِـ(ـة / ة)"]
    sort_items = [{"text": w, "column": 0 if bare(w).endswith("ه") else 1, "page": 55} for w in dict.fromkeys(ha)]
    hw = T[sid]["handwriting"]
    hw_words = hw["words"] + [w for w in re.split(r"[\s،.]+", hw["sentences"][0]) if bare(w) and ("ف" in bare(w) or "ق" in bare(w))]
    story_parts = events_from(sid, 57, "1")
    games = [
        game(L, 1, "أَسْئِلَةُ النَّصِّ", "S1", "ar-question", {"questions": qs}, H_TEXT, "الإجابات من النص ص43–45؛ أماكن الأحداث من صندوق ص47."),
        game(L, 2, "رَتِّبْ أَحْداثَ النَّصِّ", "S1", "ar-event-order", {"events": events_from(sid, 48, "5")}, H_ORDER),
        game(L, 3, "شَخْصِيّاتُ الْقِصَّةِ", "S1", "ar-text-check", {
            "statements": statements,
            "prompts": {"in": "أَيُّ هذِهِ شَخْصِيَّةٌ في الْقِصَّةِ؟", "notIn": "أَيُّ هذِهِ لَيْسَتْ شَخْصِيَّةً في الْقِصَّةِ؟", "allIn": "اخْتَرْ كُلَّ شَخْصِيّاتِ الْقِصَّةِ."},
        }, H_TEXT, "ص48: الشخصيات (ليلى، الجدة، السمكة، الحصان) من النص؛ الباقي ليس في القصة."),
        game(L, 4, "الْمُرادِفُ", "S2", "ar-question", {"questions": syns}, H_VOCAB, "المرادفان بالمعنى المعجمي؛ الكتاب لا يطبع الإجابة."),
        game(L, 5, "بِطاقاتُ الْجُمَلِ", "S3", "ar-sentence-build", {"sentences": sents}, H_SENT,
             "بطاقات ص54؛ تُقبل ترتيبات صحيحة أخرى (تقديم «دائمًا/أحيانًا»، وعكس المبتدأ والخبر في «البيت هو الوطن الصغير»)."),
        game(L, 6, "كَمْ كَلِمَةً؟", "S3", "ar-count-words", {"sentences": count}, H_COUNT),
        game(L, 7, "مَقاطِعُ الْكَلِماتِ", "S3", "ar-syllables", {"words": sylw}, H_SYL, "«الْبَيْتُ» مقسمة في الكتاب ص52؛ «هُوَ» و«الْوَطَنُ» على النموذج نفسه."),
        game(L, 8, "ـه أَمْ ـة؟", "S4", "ar-sort", {"columns": cols, "items": sort_items}, H_SORT, "كلمات ص55؛ العمود يحدده آخر حرف في الكلمة."),
        game(L, 9, "ف ق", "S5", "ar-letter-find", {"letters": ["ف", "ق"], "words": [{"word": w, "page": 56} for w in hw_words]}, H_LETTER, "كلمات صفحة الخط ص56."),
        game(L, 10, "صُنْدوقُ الْجَدَّةِ", "S6", "ar-event-order", {"events": story_parts, "prompt": "رَتِّبِ الْمَقاطِعَ لِتَحْصُلَ عَلى قِصَّةٍ قَصيرَةٍ."}, H_ORDER,
             "مقاطع ص57؛ الترتيب مستنتج من تسلسل المعنى (الجلوس، ثم دخول الجدة، ثم فتح الصندوق)."),
    ]
    not_gamed = [
        {"page": 41, "what": "أتحدث", "reason": "شفهي"},
        {"page": 46, "what": "المخلوقات التي حملت ليلى", "reason": "رسوم الكتاب"},
        {"page": 49, "what": "أعلل", "reason": "كتابة"},
        {"page": 50, "what": "كلمة بمعنى «تبحر بها»، واستبدال كلمات", "reason": "غير محسوم/مفتوح"},
        {"page": 51, "what": "أحاكي وخطوتي الرابعة", "reason": "إنتاج ورأي"},
        {"page": 53, "what": "تحويل الجملة (البدء بالفعل/بالاسم)", "reason": "تحويل كتابي؛ لم تُصمم له لعبة بعد"},
        {"page": 55, "what": "إكمال الفقرة بكلمات تنتهي بالهاء أو التاء", "reason": "فراغات متعددة في السطر"},
        {"page": 56, "what": "الخط", "reason": "كتابة يدوية"},
    ]
    return lesson(sid, "ARB-S1-A2", "الدَّرْسُ الثّاني: لَيْلى تَرْسُمُ وَطَنًا", "reading_lesson", skills, games, not_gamed, "")


def a2_lis() -> dict:
    sid = "ARB-S1-A2-LIS"
    not_gamed = [
        {"page": 18, "what": "أطراف الحوار", "reason": "الإجابة في نص الاستماع غير المطبوع"},
        {"page": 19, "what": "اسم الشخصية، وكم سنة، وأكمل", "reason": "الإجابة في نص الاستماع غير المطبوع"},
        {"page": 20, "what": "ماذا تحتاج شمساء، والمقارنة", "reason": "رأي ومقارنة كتابية"},
        {"page": 21, "what": "أبدي رأيي", "reason": "رأي شخصي"},
    ]
    return lesson(sid, "ARB-S1-A2", "الِاسْتِماعُ: الذِّكْرى الْخالِدَةُ", "listening", {"S1": "يُجيبُ عَنْ أَسْئِلَةٍ تَتَعَلَّقُ بِما اسْتَمَعَ إِلَيْهِ"}, [], not_gamed,
                  "نص الاستماع غير مطبوع في كتاب الطالب، فلا توجد إجابة يمكن التحقق منها آليًا.")


def a2_l1() -> dict:
    sid = L = "ARB-S1-A2-L1"
    skills = {
        "S1": "يَفْهَمُ نَصَّ «نورُ تُحِبُّ قَرْيَتَها»: الْمَعْنى الصَّريحُ وَالضِّمْنِيُّ وَالْفِكْرَةُ الرَّئيسَةُ",
        "S2": "يُرَتِّبُ الْأَحْداثَ: قَبْلَ الْحَدَثِ أَوْ بَعْدَهُ",
        "S3": "يُحَدِّدُ مُرادِفَ الْكَلِمَةِ مِنَ السِّياقِ",
        "S4": "يُمَيِّزُ الْحَرْفَيْنِ (س، ش) في كَلِماتِ النَّصِّ",
        "S5": "يُرَكِّبُ جُمْلَةً مُفيدَةً وَيُكْمِلُ الْجُمْلَةَ الِاسْمِيَّةَ",
        "S6": "يُمَيِّزُ تَنْوينَ الضَّمِّ وَالْفَتْحِ وَالْكَسْرِ",
    }
    yesno = ex(sid, 28, "4")
    qs = [
        q_from(sid, 27, "1"),
        q_from(sid, 27, "2"),
        q_from(sid, 27, "3"),
        {"q": clean(yesno["items"][0]["text"]), "options": yesno["items"][0]["options"], "answer": answer(yesno["items"][0]), "page": 28},
        q_from(sid, 30, "1"),
        q_from(sid, 32, "1"),
        q_from(sid, 33, "3"),
    ]
    tf = ex(sid, 28, "5")
    statements = [{"text": clean(re.sub(r"\(\s*[.…]+\s*\)", "", it["text"])), "inText": answer(it) == "صَحيحٌ", "page": 28} for it in tf["items"]]
    ba = ex(sid, 29, "6")
    ba_items = [{"text": clean(re.sub(r"\((?:قبل|\s*[.…]+\s*)\)", "", it["text"])), "column": 0 if bare(answer(it)) == "قبل" else 1, "page": 29} for it in ba["items"]]
    syn = ex(sid, 31, "2")
    syns = [
        {"q": "«ماءٌ عَذْبٌ مُنْسابٌ»: ما مُرادِفُ «مُنْسابٌ»؟", "options": syn["items"][0]["options"], "answer": answer(syn["items"][0]), "page": 31},
        {"q": "«تُدْخِلُ عَلى النّاسِ الْبَهْجَةَ والسُّرورَ»: ما مُرادِفُ «الْبَهْجَةَ»؟", "options": syn["items"][1]["options"], "answer": answer(syn["items"][1]), "page": 31},
    ]
    sh = ex(sid, 35, "1")
    sw = [w.strip() for it in sh["items"] for w in it["answer_derived"].split("/") if w.strip()]
    hw = T[sid]["handwriting"]["words"]
    words_ss = [{"word": w, "page": page_of(sid, w, ("reading_text",))} for w in dict.fromkeys(sw)] + [{"word": w, "page": 39} for w in hw if w != "مُنَساب"]
    cards = ex(sid, 36, "1")
    sent = answer(cards["items"][0])
    nom = ex(sid, 37, "2")
    fills = [{"text": clean(it["text"]), "answer": answer(it), "page": 37} for it in nom["items"] if "السَّماءُ." not in it["text"]]
    tan = ex(sid, 37, "1")
    forms = [f.strip() for it in tan["items"] for f in answer(it).split("/")]
    games = [
        game(L, 1, "أَسْئِلَةُ النَّصِّ", "S1", "ar-question", {"questions": qs}, H_TEXT, "الإجابات مستنتجة من النص ص24–26، ومنها أسئلة الاستنتاج ص30 و32 و33."),
        game(L, 2, "صَحيحٌ أَمْ خَطَأٌ؟", "S1", "ar-text-check", {
            "statements": statements,
            "prompts": {"in": "أَيُّ جُمْلَةٍ صَحيحَةٌ؟", "notIn": "أَيُّ جُمْلَةٍ خَطَأٌ؟", "allIn": "اخْتَرْ كُلَّ الْجُمَلِ الصَّحيحَةِ."},
        }, H_TEXT, "صحيح/خطأ ص28 مستنتج من النص."),
        game(L, 3, "قَبْلُ أَمْ بَعْدُ؟", "S2", "ar-sort", {"columns": ["قَبْلُ", "بَعْدُ"], "context": "«سَمِعَتْ ذاتَ يَوْمٍ جَرَسَ الْبابِ»", "items": ba_items}, H_ORDER,
             "المثال الأول مطبوع؛ «قرأت بيان بعض قصص نور» قبلُ لأنها تقول عند الزيارة «لقد قرأت بعض قصصك»."),
        game(L, 4, "الْمُرادِفُ", "S3", "ar-question", {"questions": syns}, H_VOCAB, "استُبعد البند الثالث لأن خياره «اسَتَمَرَّتْ» مطبوع بحركة خاطئة."),
        game(L, 5, "س ش", "S4", "ar-letter-find", {"letters": ["س", "ش"], "words": words_ss}, H_LETTER,
             "كلمات من النص كما يطلب تمرين ص35، وكلمات الخط ص39؛ لم تُستعمل جملة الخط لأنها مقتبسة من سورة الناس."),
        game(L, 6, "بِطاقاتُ الْجُمْلَةِ", "S5", "ar-sentence-build", {"sentences": [{"text": sent, "alt": ["نورُ تُعبِّرُ بِالقِصَصِ وَالأَشْعارِ عَنْ حُبِّهَا لِقَرْيَتِها"], "page": 36}]}, H_SENT, "بطاقات ص36؛ يُقبل تقديم «بالقصص والأشعار»."),
        game(L, 7, "أُكْمِلُ الْجُمْلَةَ الِاسْمِيَّةَ", "S5", "ar-fill-word", {"bank": nom["word_bank"], "items": fills}, H_FILL, "ص37؛ استُبعد بند «السماءُ.» لنقطة مطبوعة في وسطه."),
        game(L, 8, "نَوْعُ التَّنْوينِ", "S6", "ar-tanween", {"words": [{"word": f, "page": 37} for f in forms]}, H_TANWEEN,
             "المثال «سَماءٌ/سَماءً/سَماءٍ» مطبوع؛ بقية الصيغ مشتقة بالقاعدة نفسها من كلمات التمرين."),
    ]
    not_gamed = [
        {"page": 22, "what": "أتحدث", "reason": "شفهي"},
        {"page": 23, "what": "بطاقة الكاتبة والتوقع", "reason": "كتابة"},
        {"page": 32, "what": "لو قبلت نور العرض", "reason": "رأي"},
        {"page": 33, "what": "عنوان آخر، وصفات جديدة", "reason": "إنتاج مفتوح"},
        {"page": 34, "what": "تقييم القصة وسؤال لنور", "reason": "رأي"},
        {"page": 35, "what": "إكمال بـ(سو) أو (شو)", "reason": "بعض الكلمات تحتمل الحرفين دون صورة"},
        {"page": 36, "what": "عدد المقاطع", "reason": "لم يُعتمد بعد طريقة عدّ المقاطع"},
        {"page": 38, "what": "شبكة الحروف", "reason": "نشاط شبكة؛ لم تُصمم له لعبة"},
        {"page": 39, "what": "الخط", "reason": "كتابة يدوية؛ وجملته من سورة الناس"},
        {"page": 40, "what": "الجملة والرسم، والنص القصير", "reason": "صور الكتاب وكتابة"},
    ]
    return lesson(sid, "ARB-S1-A2", "الدَّرْسُ الْأَوَّلُ: نورُ تُحِبُّ قَرْيَتَها", "reading_lesson", skills, games, not_gamed, "")


def a2_l3() -> dict:
    sid = L = "ARB-S1-A2-L3"
    skills = {
        "S1": "يَفْهَمُ نَصَّ «الْبَحْرُ يَتَّسِعُ لِلْجَميعِ»: الْأَحْداثُ وَالْقَراراتُ وَالْفِكْرَةُ وَالدَّرْسُ الْمُسْتَفادُ",
        "S2": "يُحَدِّدُ مَعانِيَ الْكَلِماتِ مِنَ السِّياقِ",
        "S3": "يَكْتُبُ الْعَدَدَ (3–10) مُطابِقًا لِلْمَعْدودِ",
        "S4": "يَضَعُ عَلاماتِ التَّرْقيمِ (. ، :) في مَكانِها",
        "S5": "يُمَيِّزُ الْحَرْفَيْنِ (ع، غ) في الْكَلِماتِ",
        "S6": "يُرَتِّبُ الْكَلِماتِ في جُمَلٍ، وَالْجُمَلَ في نَصٍّ",
    }
    p63 = ex(sid, 63, "2")
    qs = [
        q_from(sid, 63, "1", q="ما الْعَمَلُ الَّذي قامَتْ بِهِ الْأَسْماكُ الصَّغيرَةُ؟"),
        {"q": clean(p63["items"][0]["text"]), "options": p63["word_bank"], "answer": answer(p63["items"][0]), "page": 63},
        q_from(sid, 64, "3"),
        q_from(sid, 64, "4", q="ما الْقَرارُ الَّذي أَخَذَتْهُ الْمَجْموعَةُ الثّالِثَةُ؟"),
        q_from(sid, 67, "1", q=clean(ex(sid, 67, "1")["instruction"])),
        q_from(sid, 68, "2", q=clean(ex(sid, 68, "2")["instruction"])),
        q_from(sid, 68, "3"),
    ]
    syn = ex(sid, 66, "2")
    vocab = [
        {"q": "«نُفاوِضَها لَعَلَّنا نَصِلُ مَعَها إِلَى اتِّفاقٍ»: ما مُرادِفُ «نُفاوِضَها»؟", "options": syn["items"][0]["options"], "answer": answer(syn["items"][0]), "page": 66},
        {"q": "«مَنْ تَنازَلَ عَنْ وَطَنِهِ يَعِشْ ذَليلاً»: ما مُرادِفُ «تَنازَلَ»؟", "options": syn["items"][1]["options"], "answer": answer(syn["items"][1]), "page": 66},
        q_from(sid, 66, "3", q="«بِضْعُ خُطُواتٍ»: ما الْمَسافَةُ الْأَقْرَبُ لِهذِهِ الْعِبارَةِ؟"),
    ]
    num = ex(sid, 71, "2")
    nitems = []
    for i in (0, 1, 2, 5, 6, 7):
        it = num["items"][i]
        text = clean(it["text"].split(":", 1)[1])
        nitems.append({"text": text, "answer": answer(it), "page": 71})
    bank = list(dict.fromkeys(x["answer"] for x in nitems))
    pun = ex(sid, 72, "1")
    marks = [answer(it) for it in pun["items"]]
    lines = [it["text"] for it in pun["items"]]
    pq = []
    for sent in ((0, 1), (2, 3), (4, 5)):
        for j in sent:
            shown = []
            for k in sent:
                t = lines[k]
                t = t.replace("( )", f"( {marks[k]} )" if k < j else "( ؟ )" if k == j else "(   )")
                shown.append(t)
            joined = " ".join(shown)
            composed[joined] = sid  # two printed lines joined: checked word by word
            pq.append({"q": "ما الْعَلامَةُ الْمُناسِبَةُ مَكانَ ( ؟ )؟", "text": joined, "options": pun["word_bank"], "answer": marks[j], "page": 72})
    hw = T[sid]["handwriting"]
    hw_words = hw["words"][0].split() + [w for w in re.split(r"[\s،.]+", hw["sentences"][0]) if bare(w)] if len(hw["words"]) == 1 else hw["words"] + [w for w in re.split(r"[\s،.]+", hw["sentences"][0]) if bare(w)]
    cards = ex(sid, 75, "أ")
    alts = [
        ["الْغُرابُ جاءَ وَسَكَنَ الْعُشَّ."],
        ["الْغُرابُ خافَ وَفَرَّ هارِبًا."],
        ["الْعُصْفورُ ذَهَبَ إِلى إِخْوانِهِ لِيَشْكُوَ حالَهُ،", "ذَهَبَ الْعُصْفورُ لِيَشْكُوَ حالَهُ إِلى إِخْوانِهِ،"],
        ["العُصْفورُ بَنى عُشًّا جَديدًا،"],
        ["العَصافِيرُ اجْتَمَعَتْ وَذَهَبَتْ مَعَهُ إِلى الْعُشِّ،"],
    ]
    sents = [{"text": answer(it), "alt": alts[i], "page": 75} for i, it in enumerate(cards["items"])]
    text_order = answer(ex(sid, 76, "ب")["items"][0])
    ordered = [x.strip() for x in re.split(r"(?<=[.،])\s+", text_order) if x.strip()]
    events = [{"text": t, "page": 76} for t in ordered]
    games = [
        game(L, 1, "أَسْئِلَةُ النَّصِّ", "S1", "ar-question", {"questions": qs}, H_TEXT, "الإجابات من النص ص60–62، ومنها أسئلة البطل والدرس المستفاد (ص67–68)."),
        game(L, 2, "رَتِّبْ أَحْداثَ النَّصِّ", "S1", "ar-event-order", {"events": events_from(sid, 65, "5")}, H_ORDER),
        game(L, 3, "مَعاني الْكَلِماتِ", "S2", "ar-question", {"questions": vocab}, H_VOCAB, "المرادفات بالمعنى المعجمي، و«بضع» بين ثلاثة وتسعة كما في الصندوق ص66."),
        game(L, 4, "الْعَدَدُ وَالْمَعْدودُ", "S3", "ar-fill-word", {"bank": bank, "items": nitems, "prompt": "اخْتَرِ الْعَدَدَ الْمَكْتوبَ بِالْكَلِماتِ."}, H_FILL,
             "جدول ص71؛ الإجابات بقاعدة الأمثلة المطبوعة في الجدول نفسه (ثلاث حمراء، أربعة قروش…). المحرّك لا يعرض صيغة لا تختلف عن الإجابة إلا في الحركة الأخيرة."),
        game(L, 5, "عَلاماتُ التَّرْقيمِ", "S4", "ar-question", {"questions": pq}, ["تَأْتي النُّقْطَتانِ بَعْدَ «قالَتْ».", "تَأْتي النُّقْطَةُ في آخِرِ الْجُمْلَةِ."], "فقرة ص72 مقسمة إلى جملها الثلاث."),
        game(L, 6, "ع غ", "S5", "ar-letter-find", {"letters": ["ع", "غ"], "words": [{"word": w, "page": 74} for w in hw_words]}, H_LETTER, "كلمات صفحة الخط ص74."),
        game(L, 7, "بِطاقاتُ الْجُمَلِ", "S6", "ar-sentence-build", {"sentences": sents}, H_SENT, "بطاقات ص75؛ يُقبل تقديم الفاعل لأن الجملة تبقى صحيحة."),
        game(L, 8, "مِنَ الْجُمَلِ نَصٌّ", "S6", "ar-event-order", {"events": events, "prompt": "رَتِّبِ الْجُمَلَ لِتَحْصُلَ عَلى نَصٍّ."}, H_ORDER, "ترتيب ص76 مستنتج من تسلسل المعنى."),
    ]
    not_gamed = [
        {"page": 58, "what": "أتحدث", "reason": "شفهي ورأي"},
        {"page": 59, "what": "العنوان والكاتب والتوقع", "reason": "كتابة وتوقع"},
        {"page": 65, "what": "السبب والنتيجة", "reason": "كتابة"},
        {"page": 67, "what": "صفة لكل مجموعة", "reason": "أكثر من صفة تصح، وإحدى المجموعات بلا صفة محسومة"},
        {"page": 68, "what": "عنوان آخر، ودليل من النص", "reason": "إنتاج مفتوح"},
        {"page": 69, "what": "أحاكي ورأيي", "reason": "إنتاج ورأي"},
        {"page": 70, "what": "كلمات فيها مقطع طويل، وجمل بعدد كلمات", "reason": "إجابات مفتوحة"},
        {"page": 71, "what": "عدد الأسماك في الصورة", "reason": "يعتمد على عدّ رسم الكتاب"},
        {"page": 73, "what": "نسخ الفقرة", "reason": "كتابة"},
        {"page": 74, "what": "الخط", "reason": "كتابة يدوية؛ غُطّي تمييز الحرفين"},
    ]
    return lesson(sid, "ARB-S1-A2", "الدَّرْسُ الثّالِثُ: الْبَحْرُ يَتَّسِعُ لِلْجَميعِ", "reading_lesson", skills, games, not_gamed, "")


def a2_poem() -> dict:
    sid = L = "ARB-S1-A2-POEM"
    skills = {"S1": "يَحْفَظُ أُنْشودَةَ «أَزْهارُ الْخَمائِلِ» وَيُرَتِّبُ أَبْياتَها", "S2": "يَفْهَمُ مَضْمونَ الْأُنْشودَةِ"}
    halves = poem_halves(sid)
    verses = [v for t in T[sid]["texts"] if t["kind"] == "poem" for v in t["verses"]]
    vtxt = lambda n: f"{verses[n - 1]['sadr']}   {verses[n - 1]['ajuz']}"
    q = {"q": "أَيُّ بَيْتٍ يُشيرُ إِلى أَنَّ الْأَطْفالَ الصِّغارَ هُمْ أَمَلُ هَذا الْوَطَنِ؟", "options": [vtxt(7), vtxt(3), vtxt(5), vtxt(6)], "answer": vtxt(7), "page": 79}
    games = [
        game(L, 1, "أُكْمِلُ الْبَيْتَ", "S1", "ar-poem-gap", {"lines": [dict(h, page=77) for h in halves]}, H_POEM),
        game(L, 2, "رَتِّبْ أَشْطُرَ الْأُنْشودَةِ", "S1", "ar-event-order", {"events": [dict(h, page=77) for h in halves], "prompt": "رَتِّبْ أَشْطُرَ الْأُنْشودَةِ كَما حَفِظْتَها."}, H_POEM),
        game(L, 3, "أَمَلُ الْوَطَنِ", "S2", "ar-question", {"questions": [q]}, H_POEM,
             "مصوغ من تمرين ص79 (5): البيت السابع «نَحْنُ نَبْتُ الأَمَلِ»؛ البيت الثامن لم يُعرض خيارًا لأنه يصح أيضًا."),
    ]
    not_gamed = [
        {"page": 78, "what": "معنى «خميلة»", "reason": "الكتاب لا يطبع الإجابة ولا سياق يحسمها"},
        {"page": 78, "what": "الإنشاد، وأحاكي «نحن…»", "reason": "شفهي ومفتوح"},
        {"page": 79, "what": "الصورة المناسبة", "reason": "رسوم الكتاب"},
    ]
    return lesson(sid, "ARB-S1-A2", "أُنْشِدُ وَأَحْفَظُ: أَزْهارُ الْخَمائِلِ", "poem", skills, games, not_gamed, "")


def a2_arev() -> dict:
    sid = L = "ARB-S1-A2-AREV"
    skills = {
        "S1": "يَفْهَمُ نَصَّ «ضِياءٌ في الْفَضاءِ»",
        "S2": "يُمَيِّزُ التَّنْوينَ وَأَشْكالَ التّاءِ في كَلِماتِ النَّصِّ",
        "S3": "يَضَعُ عَلاماتِ التَّرْقيمِ في مَكانِها",
        "S4": "يُحَلِّلُ الْجُمْلَةَ إِلى كَلِماتٍ وَمَقاطِعَ وَيُرَكِّبُها",
    }
    qs = [q_from(sid, 82, "1", q=clean(ex(sid, 82, "1")["instruction"])), q_from(sid, 83, "4", q="«شَغوفًا بِعُلومِ الْفَضاءِ»: كَلِمَةُ «شَغوفًا» تَعْني:")]
    jobs = ex(sid, 82, "2")
    chosen = [x.strip() for x in answer(jobs["items"][0]).split("،")]
    statements = [{"text": o, "inText": o in chosen, "page": 82} for o in jobs["items"][0]["options"]]
    sp = ex(sid, 87, "11")
    by = {clean(it["text"]): it["answer_derived"] for it in sp["items"]}
    tanween = [w for k, v in by.items() if "تنوين" in k for w in v.split("، ")]
    taa_words = [w for k, v in by.items() if k in ("ـة", "ت") for w in v.split("، ")]
    from_text = lambda ws: [w for w in dict.fromkeys(ws) if any(norm(w) in norm(l) for _, l in text_lines(sid))]
    punct = ex(sid, 87, "12")
    marks = [":", "،", "."]
    base = "قالَ ضِياءٌ {0} سَأَكونُ رائِدَ فَضاءٍ {1} وَسَأَكْتُبُ عَلى الْكَواكِبِ «مِنْ هُنا مَرَّ أَهْلُ عُمانَ» {2}"
    pq = []
    for i in range(3):
        shown = [marks[j] if j < i else "( ؟ )" if j == i else "(   )" for j in range(3)]
        pq.append({"q": "ما الْعَلامَةُ الْمُناسِبَةُ مَكانَ ( ؟ )؟", "text": base.format(*shown), "options": punct["word_bank"], "answer": marks[i], "page": 87})
    syl8 = ex(sid, 85, "8")
    sylw = [{"word": answer(it), "syllables": order_tiles(it["options"], answer(it)), "page": 85} for it in syl8["items"] if it["options"]]
    syl7 = {"هُنا": ["هُـ", "نا"], "مَرَّ": ["مَرْ", "رَ"], "أَهْلُ": ["أَهْـ", "لُ"], "عُمانَ": ["عُـ", "ما", "نَ"]}
    sylw += [{"word": w, "syllables": resplit(w, s), "page": 85} for w, s in syl7.items()]
    sent = answer(syl8["items"][-1])
    imit = ex(sid, 84, "5")
    count = [{"text": clean(ex(sid, 85, "7")["items"][0]["text"]), "page": 85}, {"text": clean(imit["items"][0]["text"]), "page": 84}]
    games = [
        game(L, 1, "أَسْئِلَةُ النَّصِّ", "S1", "ar-question", {"questions": qs}, H_TEXT, "الإجابات من النص ص80–81."),
        game(L, 2, "مِهَنٌ فَكَّرَ فيها ضِياءٌ", "S1", "ar-text-check", {
            "statements": statements,
            "prompts": {"in": "أَيُّ مِهْنَةٍ فَكَّرَ ضِياءٌ أَنْ يَعْمَلَ بِها؟", "notIn": "أَيُّ مِهْنَةٍ لَمْ يُفَكِّرْ ضِياءٌ أَنْ يَعْمَلَ بِها؟", "allIn": "اخْتَرْ كُلَّ الْمِهَنِ الَّتي فَكَّرَ ضِياءٌ أَنْ يَعْمَلَ بِها."},
        }, H_TEXT, "ص82: الطيار والطبيب والمهندس ورائد الفضاء وردت في النص ص81."),
        game(L, 3, "نَوْعُ التَّنْوينِ", "S2", "ar-tanween", {"words": [{"word": w, "page": page_of(sid, w, ("reading_text",))} for w in from_text(tanween)]}, H_TANWEEN,
             "تمرين ص87 «أستخرج من النص كلمات تتضمن تنوين الكسر/الفتح»؛ الكلمات من النص ص80–81."),
        game(L, 4, "ت أَمْ ـة أَمْ ة؟", "S2", "ar-taa", {"words": [{"word": w, "page": page_of(sid, w, ("reading_text",))} for w in from_text(taa_words) if bare(w)[-1] in "تة"]}, H_TAA,
             "تمرين ص87 (ـة، ت)؛ اللعبة تصنّف آخر الكلمة فقط."),
        game(L, 5, "عَلاماتُ التَّرْقيمِ", "S3", "ar-question", {"questions": pq}, ["تَأْتي النُّقْطَتانِ بَعْدَ «قالَ».", "تَأْتي النُّقْطَةُ في آخِرِ الْجُمْلَةِ."], "جملة ص87 (12) بفراغاتها الثلاثة."),
        game(L, 6, "بِطاقاتُ الْمَقاطِعِ", "S4", "ar-syllables", {"words": sylw}, H_SYL, "بطاقات ص85 (8) كما طُبعت؛ وكلمات ص85 (7) مقسمة على النموذج نفسه."),
        game(L, 7, "مِنَ الْكَلِماتِ جُمْلَةً", "S4", "ar-sentence-build", {"sentences": [{"text": sent, "alt": ["ضِياءُ رائِدُ الْفَضاءِ"], "page": 85}]}, H_SENT, "يُقبل الترتيبان لأن كليهما جملة صحيحة."),
        game(L, 8, "كَمْ كَلِمَةً؟", "S4", "ar-count-words", {"sentences": count}, H_COUNT),
    ]
    not_gamed = [
        {"page": 83, "what": "الورقة على النافذة", "reason": "كتابة"},
        {"page": 84, "what": "أحاكي، وجملة لكل صورة", "reason": "إنتاج مفتوح وصور"},
        {"page": 86, "what": "تحويل الجمل، والعدد بالحروف", "reason": "تحويل كتابي، وعدّ من صورة"},
        {"page": 88, "what": "الخط", "reason": "كتابة يدوية"},
        {"page": 89, "what": "تلوين العلم ووصفه", "reason": "رسم ووصف"},
    ]
    return lesson(sid, "ARB-S1-A2", "مُراجَعَةُ الْمِحْوَرِ: ضِياءٌ في الْفَضاءِ", "axis_review", skills, games, not_gamed, "")


# --------------------------------------------------------------------------- source check
def strings(v):
    if isinstance(v, str):
        yield v
    elif isinstance(v, list):
        for x in v:
            yield from strings(x)
    elif isinstance(v, dict):
        for k, x in v.items():
            # syllables are validated by the engine against their word, which is checked here
            if k in ("prompts", "prompt", "q", "text_composed", "alt", "alsoFits", "columns", "page", "inText", "column", "syllables"):
                continue
            yield from strings(x)


# Sentences completed from a book blank (e.g. «في الـ.....باحِ» → «في الصَّباحِ»): checked word by word.
composed: dict[str, str] = {}


def words_in_text(s: str, sid: str) -> bool:
    tokens = set(re.findall(r"[\u0621-\u064A]+", bare(json.dumps(T[sid], ensure_ascii=False))))
    return all(w in tokens for w in re.findall(r"[\u0621-\u064A]+", bare(s)))


def corpus(sid: str) -> str:
    return norm(json.dumps(T[sid], ensure_ascii=False))


def check(cat: dict) -> list[str]:
    problems = []
    for l in cat["lessons"]:
        c = corpus(l["lesson_id"])
        for g in l["games"]:
            for s in strings(g["config"]):
                if s in ("😀", "😢", "😠", "😕"):
                    continue
                if LATIN.search(s):
                    problems.append(f"{g['game_id']}: «{s}» contains Latin letters (a transcriber's note, not book text)")
                    continue
                if norm(s) in c or norm(s).rstrip(".") in c:
                    continue
                # A book sentence with its blanks shown as ( ؟ ) / filled with marks: compare its words only.
                loose = lambda t: re.sub(r"[()\s.:،؟«»\"]", "", norm(t))
                if "(" in s and loose(s) in loose(c):
                    continue
                if s in composed and composed[s] == l["lesson_id"] and words_in_text(s, l["lesson_id"]):
                    continue
                problems.append(f"{g['game_id']}: «{s}» not in the transcription of {l['lesson_id']}")
    return problems


SECTIONS = [
    a1_rev, a1_lis, a1_l1, a1_l2, a1_l3, a1_poem, a1_arev, lambda: story("ARB-S1-A1-STORY", "ARB-S1-A1", "الصفحات 100–102 بيانات الكتاب والغلاف."),
    a2_lis, a2_l1, a2_l2, a2_l3, a2_poem, a2_arev, lambda: story("ARB-S1-A2-STORY", "ARB-S1-A2", "الصفحتان 92–93 الغلاف."),
]


def main() -> None:
    load()
    units = [
        {"unit_id": "ARB-S1-A1", "title": "الْمِحْوَرُ الْأَوَّلُ: حَياتي", "outcomes": T.get("ARB-S1-A1-OUT", {}).get("outcomes", []), "outcomes_page": 27},
        {"unit_id": "ARB-S1-A2", "title": "الْمِحْوَرُ الثّاني: وَطَني", "outcomes": T.get("ARB-S1-A2-OUT", {}).get("outcomes", []), "outcomes_page": 17},
    ]
    lessons = [f() for f in SECTIONS]
    for l in lessons:  # a word listed twice would give two identical options
        for g in l["games"]:
            if g["mechanic"] == "ar-letter-find":
                seen: set[str] = set()
                g["config"]["words"] = [w for w in g["config"]["words"] if not (w["word"] in seen or seen.add(w["word"]))]
    cat = {
        "subject": "arabic",
        "semester": 1,
        "books": [{"book_id": b, "sha256": v["sha256"], "pdf_page_offset": v["offset"]} for b, v in BOOKS.items()],
        "note": "Draft built by scripts/build_arabic_s1.py from local page transcriptions; not reviewed by a human.",
        "units": units,
        "lessons": lessons,
    }
    problems = check(cat)
    for p in problems:
        print("SOURCE:", p)
    if "--check" in sys.argv:
        sys.exit(1 if problems else 0)
    if problems:
        sys.exit("refusing to write: config text not found in transcriptions")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n = sum(len(l["games"]) for l in lessons)
    print(f"wrote {OUT.relative_to(ROOT)}: {len(lessons)} sections, {n} games")


if __name__ == "__main__":
    main()

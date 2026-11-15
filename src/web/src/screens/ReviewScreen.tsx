import { useMemo, useState } from "react";
import { QUIZ_MECHANICS, type Difficulty } from "@ghaith/game-core";
import { SUBJECTS, bookName, findLesson, isLegacyGame, lessonsOfUnit, pagesLabel, type CatalogGame, type CatalogLesson } from "../catalog";
import { toArabicDigits } from "../lib/digits";
import { exportReviews, lessonReviewStatus, loadReviews, saveDecision, type ReviewBook, type ReviewStatus } from "../lib/reviews";
import { visualFor } from "../quiz/visuals";

const STATUS_LABEL = { not_reviewed: "لم يُراجَع", partial: "مراجعة جزئية", needs_changes: "يحتاج تعديل", approved: "معتمد" } as const;
const STATUS_CLASS = { not_reviewed: "bg-slate-100", partial: "bg-amber-100", needs_changes: "bg-rose-100", approved: "bg-emerald-100" } as const;

/** Simple adult gate so a child does not wander into the review area. */
function ParentGate({ onPass, onBack }: { onPass: () => void; onBack: () => void }) {
  const [a] = useState(() => 6 + Math.floor(Math.random() * 4));
  const [b] = useState(() => 6 + Math.floor(Math.random() * 4));
  const [value, setValue] = useState("");
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-10 text-center" data-testid="parent-gate">
      <h2 className="text-2xl font-extrabold">منطقة ولي الأمر</h2>
      <p className="text-lg">
        اكتب ناتج {toArabicDigits(a)} × {toArabicDigits(b)}
      </p>
      <input aria-label="الناتج" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className="h-14 w-40 rounded-xl border-2 text-center text-2xl" />
      <div className="flex gap-3">
        <button type="button" onClick={() => Number(value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))) === a * b && onPass()} className="rounded-xl bg-sky-600 px-6 py-3 font-bold text-white">
          دخول
        </button>
        <button type="button" onClick={onBack} className="rounded-xl bg-white px-6 py-3 font-bold shadow">
          رجوع
        </button>
      </div>
    </section>
  );
}

function SampleItems({ game }: { game: CatalogGame }) {
  const mech = QUIZ_MECHANICS.get(game.mechanic);
  const samples = useMemo(
    () => (mech ? ([1, 2, 3] as Difficulty[]).flatMap((d) => [1, 2].map((s) => mech.generate(s * 101 + d, d, game.config))) : []),
    [mech, game.config],
  );
  if (!mech) return <p className="text-sm text-slate-500">لعبة لوحة المائة: جرّبها من صفحة الدرس.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {samples.map((item, i) => {
        const solution = mech.solution(item);
        const Visual = visualFor(item.visual.type);
        const answerText =
          item.input.type === "number"
            ? String(solution)
            : item.input.type === "choice"
              ? item.input.options.find((o) => o.id === solution)?.label
              : item.input.type === "multi"
                ? item.input.options.filter((o) => (solution as string[]).includes(o.id)).map((o) => o.label).join("، ")
                : item.input.type === "order"
                  ? (solution as string[]).map((id) => (item.input.type === "order" ? item.input.items.find((o) => o.id === id)?.label : "")).join("، ")
                  : JSON.stringify(solution);
        return (
          <article key={i} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">المستوى {toArabicDigits(item.difficulty)}</p>
            <p className="font-bold" dir={item.lang === "en" ? "ltr" : undefined}>{item.lang === "en" ? item.prompt : toArabicDigits(item.prompt)}</p>
            {item.promptAr && <p className="text-sm text-slate-600">{item.promptAr}</p>}
            <div className="my-2 flex justify-center overflow-hidden">{Visual && <Visual visual={item.visual} item={item} reveal solution={solution} locked hintLevel={0} />}</div>
            {item.input.type !== "visual" && (item.input.type === "choice" || item.input.type === "multi") && (
              <p className="text-sm text-slate-600">الخيارات: <span dir={item.lang === "en" ? "ltr" : undefined}>{item.input.options.map((o) => (item.lang === "en" ? o.label : toArabicDigits(o.label))).join(" | ")}</span></p>
            )}
            <p className="mt-1 rounded bg-emerald-50 px-2 py-1 font-bold text-emerald-900">الإجابة: <span dir={item.lang === "en" ? "ltr" : undefined}>{item.lang === "en" ? answerText : toArabicDigits(answerText ?? "")}</span></p>
            <ol className="mt-1 list-inside list-decimal text-sm">
              {mech.explain(item).map((s, j) => (
                <li key={j}>{item.lang === "en" ? s : toArabicDigits(s)}</li>
              ))}
            </ol>
          </article>
        );
      })}
    </div>
  );
}

function DecisionBar({ lessonId, targetId, book, reviewer, onSaved }: { lessonId: string; targetId: string; book: ReviewBook; reviewer: string; onSaved: (b: ReviewBook) => void }) {
  const current = book[lessonId]?.[targetId];
  const [note, setNote] = useState(current?.note ?? "");
  const [error, setError] = useState("");
  const decide = (status: ReviewStatus) => {
    try {
      onSaved(saveDecision(lessonId, targetId, { status, note, reviewer, at: new Date().toISOString() }));
      setError("");
    } catch (e) {
      setError(e instanceof Error && e.message.includes("reviewer") ? "اكتب اسم المراجع أولًا (أعلى الصفحة)." : "اكتب ملاحظة توضّح التعديل المطلوب.");
    }
  };
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-slate-50 p-2" data-testid={`decision-${targetId}`}>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (مطلوبة عند طلب التعديل)" className="min-h-12 rounded-lg border p-2" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => decide("approved")} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white">
          ✓ معتمد
        </button>
        <button type="button" onClick={() => decide("needs_changes")} className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white">
          ✎ يحتاج تعديل
        </button>
        {current && (
          <span className="text-sm text-slate-600">
            القرار: {current.status === "approved" ? "معتمد" : "يحتاج تعديل"} — {current.reviewer}
          </span>
        )}
        {error && <span className="text-sm font-bold text-rose-700">{error}</span>}
      </div>
    </div>
  );
}

function LessonReview({ lesson, book, reviewer, onSaved, onBack }: { lesson: CatalogLesson; book: ReviewBook; reviewer: string; onSaved: (b: ReviewBook) => void; onBack: () => void }) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6" data-testid="lesson-review">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">مراجعة: <span dir={lesson.subject === "english" ? "ltr" : undefined}>{lesson.subject === "english" ? lesson.lesson_name : toArabicDigits(lesson.lesson_name)}</span></h2>
        <button type="button" onClick={onBack} className="rounded-xl bg-white px-4 py-2 font-bold shadow">
          → رجوع
        </button>
      </header>
      <article className="rounded-2xl bg-white p-4 shadow">
        <p className="text-sm text-slate-600">
          {bookName(lesson.source.source_book_id)} ص {toArabicDigits(pagesLabel(lesson))} (أول صفحة PDF {toArabicDigits(lesson.source.source_pdf_page)})
          {lesson.source.core_activity !== "none_printed" ? ` — النشاط ${toArabicDigits(lesson.source.core_activity)} ${lesson.source.core_activity_title}` : ""}
        </p>
        <h3 className="mt-2 font-bold">{lesson.subject === "english" ? "جمل الكتاب المستخدمة" : "مهام الكتاب كما قُرئت من الصفحة"}</h3>
        <ul className="list-inside list-disc">{lesson.book_tasks.map((t) => <li key={t} dir={lesson.subject === "english" ? "ltr" : undefined}>{lesson.subject === "english" ? t : toArabicDigits(t)}</li>)}</ul>
        {lesson.subject === "english" && lesson.vocabulary.length > 0 && (
          <p className="mt-2" dir="ltr">Words: {lesson.vocabulary.map((v) => v.term).join(", ")}</p>
        )}
        <h3 className="mt-2 font-bold">الأهداف (مسودة)</h3>
        <ul className="list-inside list-disc">{lesson.objectives.map((t) => <li key={t}>{toArabicDigits(t)}</li>)}</ul>
        {lesson.interpretation_notes && <p className="mt-2 rounded bg-amber-50 p-2 text-sm">ملاحظة التفسير: {lesson.interpretation_notes}</p>}
        <p className="mt-2 text-sm font-bold">هل تطابق المهام والأهداف صفحة كتاب غيث؟</p>
        <DecisionBar lessonId={lesson.lesson_id} targetId="_lesson" book={book} reviewer={reviewer} onSaved={onSaved} />
      </article>
      {lesson.games.map((g) => (
        <article key={g.game_id} className="rounded-2xl bg-white p-4 shadow">
          <h3 className="text-lg font-bold">
            {g.title} <span className="text-sm font-normal text-slate-500">({g.mechanic}{isLegacyGame(g) ? "" : ` — ${JSON.stringify(g.config)}`})</span>
          </h3>
          <p className="text-sm text-slate-600">التلميحات: {g.hint_levels.join(" / ")}</p>
          <SampleItems game={g} />
          <DecisionBar lessonId={lesson.lesson_id} targetId={g.game_id} book={book} reviewer={reviewer} onSaved={onSaved} />
        </article>
      ))}
    </section>
  );
}

export function ReviewScreen({ onBack }: { onBack: () => void }) {
  const [passed, setPassed] = useState(false);
  const [book, setBook] = useState<ReviewBook>(() => loadReviews());
  const [reviewer, setReviewer] = useState("");
  const [lessonId, setLessonId] = useState<string | null>(null);
  if (!passed) return <ParentGate onPass={() => setPassed(true)} onBack={onBack} />;
  const lesson = lessonId ? findLesson(lessonId) : undefined;
  if (lesson) return <LessonReview lesson={lesson} book={book} reviewer={reviewer} onSaved={setBook} onBack={() => setLessonId(null)} />;

  const download = () => {
    const blob = new Blob([exportReviews(book)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ghaith-content-review.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6" data-testid="review-screen">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">مراجعة المحتوى (ولي الأمر)</h2>
        <button type="button" onClick={onBack} className="rounded-xl bg-white px-4 py-2 font-bold shadow">
          → رجوع
        </button>
      </header>
      <p className="text-sm text-slate-600">
        راجع كل درس مقابل كتاب غيث: المهام والأهداف، ثم عينات الأسئلة والإجابات لكل لعبة. القرارات تُحفظ على هذا الجهاز، ثم صدّرها في ملف ليُطبَّق على المنهج.
        لا يعتمد التطبيق أي محتوى من تلقاء نفسه.
      </p>
      <label className="flex items-center gap-2">
        اسم المراجع:
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="rounded-lg border px-2 py-1" data-testid="reviewer-name" />
      </label>
      {SUBJECTS.flatMap((s) => s.units).map((u) => (
        <article key={u.unit_id} className="rounded-2xl bg-white p-4 shadow">
          <h3 className="mb-2 font-bold">
            {u.subject === "english" ? "الإنجليزية · " : u.subject === "arabic" ? "العربية · " : "الرياضيات · "}
            <span dir={u.subject === "english" ? "ltr" : undefined}>{u.subject === "english" ? u.title : toArabicDigits(u.title)}</span>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {lessonsOfUnit(u.unit_id).map((l) => {
              const st = lessonReviewStatus(book, l.lesson_id, l.games.map((g) => g.game_id));
              return (
                <button key={l.lesson_id} type="button" data-review-lesson={l.lesson_id} onClick={() => setLessonId(l.lesson_id)} className={`rounded-xl p-3 text-start ${STATUS_CLASS[st]}`}>
                  <span className="font-bold" dir={l.subject === "english" ? "ltr" : undefined}>{l.subject === "english" ? l.lesson_name : toArabicDigits(l.lesson_name)}</span> <span className="text-sm">— {STATUS_LABEL[st]}</span>
                </button>
              );
            })}
          </div>
        </article>
      ))}
      <button type="button" onClick={download} className="rounded-2xl bg-sky-700 px-4 py-3 text-lg font-bold text-white">
        ⬇️ تصدير قرارات المراجعة
      </button>
    </section>
  );
}

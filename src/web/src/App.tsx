import { useMemo, useRef, useState } from "react";
import { QUIZ_MECHANICS } from "@ghaith/game-core";
import { LESSON_L01 } from "./content";
import { SUBJECTS, bookName, findLesson, findUnit, isLegacyGame, isPlayable, lessonsOfUnit, pagesLabel, quizGamesForSkill, skillName, type CatalogGame, type CatalogLesson, type SubjectId } from "./catalog";
import type { AdaptState } from "./lib/adapt";
import { toArabicDigits } from "./lib/digits";
import { loadAttempts, masteryStatus, newId, summariseBySkill } from "./lib/progress";
import { dueForReview } from "./lib/review";
import { GameRunner } from "./games/GameRunner";
import { QuizPlayer, WorkedExample, type PlanSlot } from "./quiz/QuizPlayer";
import { ReviewScreen } from "./screens/ReviewScreen";

type Screen =
  | { name: "home" }
  | { name: "unit"; unitId: string }
  | { name: "lesson"; lessonId: string }
  | { name: "game"; lessonId: string; gameId: string }
  | { name: "example"; lessonId: string; gameId: string }
  | { name: "mission"; unitId: string; plan: PlanSlot[] }
  | { name: "review"; plan: PlanSlot[] }
  | { name: "done"; back: Screen; again?: Screen; firstTryCorrect: number; total: number; title: string }
  | { name: "progress" }
  | { name: "content-review" };

const MASTERY_LABEL = { not_started: "لم يبدأ", practising: "يتدرّب", secure_draft: "ثابت (مبدئيًا)" } as const;
const ROUND = 5;

/** Read optional ?seeds=1,2,3 so automated tests can replay exact items. */
function seedsFromUrl(): number[] | undefined {
  try {
    const raw = new URLSearchParams(window.location.search).get("seeds");
    return raw ? raw.split(",").map(Number).filter(Number.isFinite) : undefined;
  } catch {
    return undefined;
  }
}

function unitSkills(unitId: string): string[] {
  return [...new Set(lessonsOfUnit(unitId).flatMap((l) => l.skills.map((s) => s.id)))];
}

function missionPlan(unitId: string): PlanSlot[] {
  // One fresh assessment item per skill of the unit that has a quiz game.
  return unitSkills(unitId).flatMap((skillId) => {
    const games = quizGamesForSkill(skillId);
    const pick = games[games.length - 1];
    return pick ? [{ lessonId: pick.lesson.lesson_id, game: pick.game, difficulty: 2 as const }] : [];
  });
}

/** Optional deep link ?lesson=ID[&game=ID] (used by automated tests and for sharing a lesson). */
function screenFromUrl(): Screen {
  try {
    const q = new URLSearchParams(window.location.search);
    const lesson = q.get("lesson") ? findLesson(q.get("lesson")!) : undefined;
    if (!lesson) return { name: "home" };
    const game = lesson.games.find((g) => g.game_id === q.get("game"));
    return game ? { name: "game", lessonId: lesson.lesson_id, gameId: game.game_id } : { name: "lesson", lessonId: lesson.lesson_id };
  } catch {
    return { name: "home" };
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(screenFromUrl);
  const [sessionMinutes, setSessionMinutes] = useState(10);
  const [subject, setSubject] = useState<SubjectId>(() => {
    try {
      return (localStorage.getItem("ghaith.subject") as SubjectId) || "math";
    } catch {
      return "math";
    }
  });
  const chooseSubject = (s: SubjectId) => {
    setSubject(s);
    try {
      localStorage.setItem("ghaith.subject", s);
    } catch {
      // remembered choice is only a convenience
    }
  };
  const sessionId = useRef(newId()).current;
  const sessionStart = useRef(Date.now()).current;
  const levels = useRef(new Map<string, AdaptState>()).current;
  const seeds = useMemo(seedsFromUrl, []);
  const overTime = () => Date.now() - sessionStart > sessionMinutes * 60_000;

  const finish = (back: Screen, title: string, again?: Screen) => (s: { firstTryCorrect: number; total: number }) =>
    setScreen({ name: "done", back, again, title, ...s });

  return (
    <main className="min-h-screen pb-10">
      {screen.name === "home" && (
        <Home
          sessionMinutes={sessionMinutes}
          setSessionMinutes={setSessionMinutes}
          onUnit={(unitId) => setScreen({ name: "unit", unitId })}
          onProgress={() => setScreen({ name: "progress" })}
          onReview={(plan) => setScreen({ name: "review", plan })}
          onContentReview={() => setScreen({ name: "content-review" })}
          subject={subject}
          setSubject={chooseSubject}
        />
      )}

      {screen.name === "unit" && (
        <UnitView
          unitId={screen.unitId}
          onBack={() => setScreen({ name: "home" })}
          onLesson={(lessonId) => setScreen({ name: "lesson", lessonId })}
          onMission={() => setScreen({ name: "mission", unitId: screen.unitId, plan: missionPlan(screen.unitId) })}
        />
      )}

      {screen.name === "lesson" && (
        <LessonView
          lesson={findLesson(screen.lessonId)!}
          onBack={() => setScreen({ name: "unit", unitId: findLesson(screen.lessonId)!.unit_id })}
          onPlay={(gameId) => setScreen({ name: "game", lessonId: screen.lessonId, gameId })}
          onExample={(gameId) => setScreen({ name: "example", lessonId: screen.lessonId, gameId })}
        />
      )}

      {screen.name === "example" && (
        <WorkedExample game={findLesson(screen.lessonId)!.games.find((g) => g.game_id === screen.gameId)!} onClose={() => setScreen({ name: "lesson", lessonId: screen.lessonId })} />
      )}

      {screen.name === "game" &&
        (() => {
          const lesson = findLesson(screen.lessonId)!;
          const game = lesson.games.find((g) => g.game_id === screen.gameId)!;
          const back: Screen = { name: "lesson", lessonId: lesson.lesson_id };
          const onFinish = ({ firstTryCorrect, total, state }: { firstTryCorrect: number; total: number; state: AdaptState }) => {
            levels.set(game.game_id, state);
            finish(back, game.title, screen)({ firstTryCorrect, total });
          };
          if (isLegacyGame(game)) {
            const legacy = LESSON_L01.games.find((g) => g.game_id === game.game_id)!;
            return <GameRunner key={game.game_id} game={legacy} lessonId={lesson.lesson_id} sessionId={sessionId} initialState={levels.get(game.game_id)} seeds={seeds} onExit={() => setScreen(back)} onFinish={onFinish} />;
          }
          const plan: PlanSlot[] = Array.from({ length: ROUND }, () => ({ lessonId: lesson.lesson_id, game }));
          return <QuizPlayer key={`${game.game_id}-${Date.now()}`} title={game.title} mode="practice" plan={plan} sessionId={sessionId} initialState={levels.get(game.game_id)} seeds={seeds} onExit={() => setScreen(back)} onFinish={onFinish} />;
        })()}

      {screen.name === "mission" && (
        <QuizPlayer
          title="مهمة الوحدة"
          mode="assessment"
          plan={screen.plan}
          sessionId={sessionId}
          avoid={new Set(loadAttempts().filter((a) => a.mode !== "assessment" && a.fingerprint).map((a) => a.fingerprint!))}
          seeds={seeds}
          onExit={() => setScreen({ name: "unit", unitId: screen.unitId })}
          onFinish={finish({ name: "unit", unitId: screen.unitId }, "مهمة الوحدة")}
        />
      )}

      {screen.name === "review" && (
        <QuizPlayer title="مراجعة اليوم" mode="review" plan={screen.plan} sessionId={sessionId} seeds={seeds} onExit={() => setScreen({ name: "home" })} onFinish={finish({ name: "home" }, "مراجعة اليوم")} />
      )}

      {screen.name === "done" && (
        <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-10 text-center" data-testid="round-done">
          <div className="text-6xl">🌿</div>
          <h2 className="text-3xl font-extrabold">أحسنت! أنهيت: {screen.title}</h2>
          <p className="text-xl">
            صحيح من المحاولة الأولى: {toArabicDigits(screen.firstTryCorrect)} من {toArabicDigits(screen.total)}
          </p>
          <p className="rounded-2xl bg-white p-3 text-lg shadow">{overTime() ? "انتهى وقت الجلسة المقترح. وقت الراحة! 🧃" : "خذ نفَسًا عميقًا، ثم اختر ما تحب."}</p>
          <div className="flex gap-3">
            {screen.again && (
              <button type="button" onClick={() => setScreen(screen.again!)} className="rounded-2xl bg-sky-600 px-6 py-3 text-lg font-bold text-white shadow">
                جولة أخرى
              </button>
            )}
            <button type="button" onClick={() => setScreen(screen.back)} className="rounded-2xl bg-white px-6 py-3 text-lg font-bold shadow">
              رجوع
            </button>
          </div>
        </section>
      )}

      {screen.name === "progress" && <ProgressView onBack={() => setScreen({ name: "home" })} />}
      {screen.name === "content-review" && <ReviewScreen onBack={() => setScreen({ name: "home" })} />}
    </main>
  );
}

function Home(props: {
  sessionMinutes: number;
  setSessionMinutes: (m: number) => void;
  onUnit: (unitId: string) => void;
  onProgress: () => void;
  onReview: (plan: PlanSlot[]) => void;
  onContentReview: () => void;
  subject: SubjectId;
  setSubject: (s: SubjectId) => void;
}) {
  const due = dueForReview(loadAttempts(), Date.now());
  const reviewPlan: PlanSlot[] = due.flatMap((d) => {
    const games = quizGamesForSkill(d.skillId);
    return games.slice(0, 2).map((g) => ({ lessonId: g.lesson.lesson_id, game: g.game, difficulty: 2 as const }));
  });
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-sky-900">عالم غيث 🌟</h1>
        <button type="button" onClick={props.onProgress} className="rounded-xl bg-white px-4 py-2 font-bold shadow">
          📈 التقدّم
        </button>
      </header>

      {reviewPlan.length > 0 && (
        <button type="button" data-testid="review-today" onClick={() => props.onReview(reviewPlan)} className="rounded-3xl bg-amber-200 p-4 text-start shadow">
          <span className="text-xl font-extrabold">🔁 مراجعة اليوم</span>
          <span className="block text-base">{due.map((d) => skillName(d.skillId)).join("، ")}</span>
        </button>
      )}

      <div className="flex gap-2" role="tablist" aria-label="المادة">
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={props.subject === s.id}
            data-subject={s.id}
            onClick={() => props.setSubject(s.id)}
            className={`rounded-2xl px-5 py-3 text-lg font-extrabold shadow ${props.subject === s.id ? "bg-sky-700 text-white" : "bg-white text-sky-900"}`}
          >
            {s.id === "math" ? "🔢 " : "🔤 "}
            {s.title}
          </button>
        ))}
      </div>

      <article className="rounded-3xl bg-white p-5 shadow">
        {(() => {
          const subj = SUBJECTS.find((s) => s.id === props.subject)!;
          return (
            <>
              <p className="text-sm text-slate-500">{subj.title} · {subj.subtitle}</p>
              <h2 className="mt-1 text-2xl font-extrabold">الوحدات</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {subj.units.map((u) => {
                  const lessons = lessonsOfUnit(u.unit_id);
                  return (
                    <button key={u.unit_id} type="button" data-unit={u.unit_id} onClick={() => props.onUnit(u.unit_id)} className="rounded-2xl bg-sky-600 px-4 py-5 text-start text-white shadow-lg active:scale-95">
                      {u.title_ar && <span className="block text-sm opacity-90">{u.title_ar}</span>}
                      <span className="block text-xl font-bold" dir={u.subject === "english" ? "ltr" : undefined}>{u.subject === "english" ? u.title : toArabicDigits(u.title)}</span>
                      <span className="text-sm opacity-90">
                        {toArabicDigits(lessons.length)} دروس · {lessons[0] ? bookName(lessons[0].source.source_book_id) : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          );
        })()}
        <p className="mt-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-900" data-testid="review-banner">
          نسخة تجريبية: محتوى الدروس مستخرج من كتاب الطالب وبانتظار مراجعة ولي الأمر قبل اعتماده.
        </p>
      </article>

      <details className="rounded-2xl bg-white p-4 shadow">
        <summary className="cursor-pointer font-bold">⚙️ إعدادات ولي الأمر</summary>
        <label className="mt-3 flex items-center gap-3">
          مدة الجلسة المقترحة:
          <select value={props.sessionMinutes} onChange={(e) => props.setSessionMinutes(Number(e.target.value))} className="rounded-lg border px-2 py-1">
            {[8, 10, 12, 15].map((m) => (
              <option key={m} value={m}>
                {toArabicDigits(m)} دقائق
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-sm text-slate-500">لا يوجد مؤقت للأسئلة، ووقت الإجابة لا يؤثر في التقييم. تظهر للطفل لعبة قصيرة واحدة في كل مرة.</p>
        <button type="button" data-testid="open-content-review" onClick={props.onContentReview} className="mt-3 rounded-xl bg-slate-800 px-4 py-2 font-bold text-white">
          🧾 مراجعة المحتوى واعتماده
        </button>
      </details>
    </section>
  );
}

function UnitView({ unitId, onBack, onLesson, onMission }: { unitId: string; onBack: () => void; onLesson: (id: string) => void; onMission: () => void }) {
  const unit = findUnit(unitId)!;
  const en = unit.subject === "english";
  const lessons = lessonsOfUnit(unitId);
  const mechanics = new Set(lessons.flatMap((l) => l.games.map((g) => g.mechanic)));
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6" data-testid="unit">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-sky-900" dir={en ? "ltr" : undefined}>
          {en ? unit.title : toArabicDigits(unit.title)}
          {unit.title_ar && <span className="block text-base font-bold text-slate-500" dir="rtl">{unit.title_ar}</span>}
        </h2>
        <button type="button" onClick={onBack} className="rounded-xl bg-white px-4 py-2 font-bold shadow">
          → رجوع
        </button>
      </header>
      <p className="text-sm text-slate-600">
        {toArabicDigits(lessons.length)} دروس · {toArabicDigits(mechanics.size)} آلية لعب مختلفة في الوحدة
      </p>
      <ol className="grid gap-3 sm:grid-cols-2">
        {lessons.map((l, i) => (
          <li key={l.lesson_id}>
            <button type="button" data-lesson={l.lesson_id} onClick={() => onLesson(l.lesson_id)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-start shadow active:scale-95">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold">{toArabicDigits(i + 1)}</span>
              <span>
                <span className="block text-lg font-bold" dir={en ? "ltr" : undefined}>{en ? l.lesson_name : toArabicDigits(l.lesson_name)}</span>
                {l.lesson_name_ar && <span className="block text-sm font-bold text-slate-600">{l.lesson_name_ar}</span>}
                <span className="text-sm text-slate-500">
                  {bookName(l.source.source_book_id)} ص {toArabicDigits(pagesLabel(l))} · {toArabicDigits(l.games.length)} ألعاب
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" data-testid="mission" onClick={onMission} className="rounded-3xl bg-violet-600 px-4 py-5 text-xl font-extrabold text-white shadow-lg">
        🏁 مهمة الوحدة الختامية
      </button>
    </section>
  );
}

function LessonView({ lesson, onBack, onPlay, onExample }: { lesson: CatalogLesson; onBack: () => void; onPlay: (id: string) => void; onExample: (id: string) => void }) {
  const firstQuiz = lesson.games.find((g) => !isLegacyGame(g) && QUIZ_MECHANICS.has(g.mechanic));
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6" data-testid="lesson" data-lesson={lesson.lesson_id}>
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-sky-900">
          <span dir={lesson.subject === "english" ? "ltr" : undefined}>{lesson.subject === "english" ? lesson.lesson_name : toArabicDigits(lesson.lesson_name)}</span>
          {lesson.lesson_name_ar && <span className="block text-base text-slate-500">{lesson.lesson_name_ar}</span>}
        </h2>
        <button type="button" onClick={onBack} className="rounded-xl bg-white px-4 py-2 font-bold shadow">
          → رجوع
        </button>
      </header>
      <p className="text-sm text-slate-500" data-testid="source-ref">
        المصدر: {bookName(lesson.source.source_book_id)} ص {toArabicDigits(pagesLabel(lesson))}
        {lesson.source.core_activity && lesson.source.core_activity !== "none_printed" ? ` — النشاط ${toArabicDigits(lesson.source.core_activity)}` : ""}
      </p>
      <article className="rounded-2xl bg-white p-4 shadow">
        <h3 className="font-bold">ماذا سنتعلم؟</h3>
        <ul className="mt-1 list-inside list-disc space-y-1">
          {lesson.objectives.map((o) => (
            <li key={o}>{toArabicDigits(o)}</li>
          ))}
        </ul>
        {lesson.vocabulary.length > 0 && (
          <>
            <h3 className="mt-3 font-bold">مفردات الدرس</h3>
            <dl className="mt-1 space-y-1">
              {lesson.vocabulary.map((v) => (
                <div key={v.term}>
                  <dt className="inline font-bold text-rose-700" dir={lesson.subject === "english" ? "ltr" : undefined}>{v.term}:</dt>{" "}
                  <dd className="inline">{toArabicDigits(v.meaning)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </article>
      {firstQuiz && (
        <button type="button" data-testid="example" onClick={() => onExample(firstQuiz.game_id)} className="rounded-2xl bg-emerald-100 px-4 py-3 text-lg font-bold shadow">
          👀 مثال محلول
        </button>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {lesson.games.map((g: CatalogGame) => (
          <button
            key={g.game_id}
            type="button"
            data-game={g.game_id}
            data-mechanic={g.mechanic}
            disabled={!isPlayable(g)}
            onClick={() => onPlay(g.game_id)}
            className="rounded-2xl bg-sky-600 px-4 py-5 text-xl font-bold text-white shadow-lg active:scale-95 disabled:bg-slate-300"
          >
            <span dir={lesson.subject === "english" ? "ltr" : undefined}>{g.title}</span>
            {g.title_ar && <span className="block text-sm font-semibold opacity-90">{g.title_ar}</span>}
            {!isPlayable(g) && <span className="block text-sm">قيد البناء</span>}
          </button>
        ))}
      </div>
      <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-900">بانتظار مراجعة ولي الأمر قبل الاعتماد.</p>
    </section>
  );
}

function ProgressView({ onBack }: { onBack: () => void }) {
  const attempts = loadAttempts();
  const summaries = summariseBySkill(attempts);
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6" data-testid="progress">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold">📈 تقدّم المهارات</h2>
        <button type="button" onClick={onBack} className="rounded-xl bg-white px-4 py-2 font-bold shadow">
          → رجوع
        </button>
      </header>
      <p className="text-sm text-slate-600">
        القاعدة المبدئية للثبات (قابلة للتعديل): ٨٠٪ صحيح من المحاولة الأولى دون تلميح، في جلستين مختلفتين على الأقل، وبآليتي لعب مختلفتين. هذه مؤشرات تعلّم وليست تشخيصًا.
      </p>
      {summaries.length === 0 && <p className="rounded-2xl bg-white p-4 shadow">لا توجد محاولات بعد.</p>}
      {summaries.map((s) => (
        <article key={s.skillId} className="rounded-2xl bg-white p-4 shadow" data-skill={s.skillId}>
          <h3 className="text-lg font-bold">{skillName(s.skillId)}</h3>
          <p>
            المحاولات: {toArabicDigits(s.attempts)} · صحيح أولًا: {toArabicDigits(s.firstTryCorrect)}/{toArabicDigits(s.firstTryTotal)} · الجلسات: {toArabicDigits(s.sessions)} · الآليات:{" "}
            {toArabicDigits(s.mechanics)}
          </p>
          <p className="mt-1 font-bold text-sky-800">الحالة: {MASTERY_LABEL[masteryStatus(s)]}</p>
        </article>
      ))}
    </section>
  );
}

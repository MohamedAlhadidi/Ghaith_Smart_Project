import { useMemo, useRef, useState } from "react";
import { LESSON_L01, type GameDefinition } from "./content";
import type { AdaptState } from "./lib/adapt";
import { toArabicDigits } from "./lib/digits";
import { loadAttempts, masteryStatus, newId, summariseBySkill } from "./lib/progress";
import { GameRunner } from "./games/GameRunner";

type Screen =
  | { name: "home" }
  | { name: "game"; game: GameDefinition }
  | { name: "done"; game: GameDefinition; firstTryCorrect: number; total: number }
  | { name: "progress" };

const SKILL_NAMES: Record<string, string> = {
  "SK-HSQ-LOCATE": "تحديد موقع العدد في لوحة المائة",
  "SK-HSQ-NEIGHBOR": "الأعداد المجاورة (±١ و ±١٠)",
  "SK-HSQ-PATTERN": "وصف الأنماط في لوحة المائة",
};

const MASTERY_LABEL = {
  not_started: "لم يبدأ",
  practising: "يتدرّب",
  secure_draft: "ثابت (مبدئيًا)",
} as const;

/** Read optional ?seeds=1,2,3 so automated tests can replay exact items. */
function seedsFromUrl(): number[] | undefined {
  try {
    const raw = new URLSearchParams(window.location.search).get("seeds");
    return raw ? raw.split(",").map(Number).filter(Number.isFinite) : undefined;
  } catch {
    return undefined;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [sessionMinutes, setSessionMinutes] = useState(10);
  const sessionId = useRef(newId()).current;
  const sessionStart = useRef(Date.now()).current;
  const levels = useRef(new Map<string, AdaptState>()).current;
  const seeds = useMemo(seedsFromUrl, []);
  const lesson = LESSON_L01;

  const overTime = () => Date.now() - sessionStart > sessionMinutes * 60_000;

  return (
    <main className="min-h-screen pb-10">
      {screen.name === "home" && (
        <section className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
          <header className="flex items-center justify-between">
            <h1 className="text-3xl font-extrabold text-sky-900">عالم غيث 🌟</h1>
            <button type="button" onClick={() => setScreen({ name: "progress" })} className="rounded-xl bg-white px-4 py-2 font-bold shadow">
              📈 التقدّم
            </button>
          </header>

          <article className="rounded-3xl bg-white p-5 shadow">
            <p className="text-sm text-slate-500">الرياضيات · الفصل الأول · الوحدة ١أ</p>
            <h2 className="mt-1 text-2xl font-extrabold">{lesson.lesson_name}</h2>
            <p className="mt-1 text-sm text-slate-500" data-testid="source-ref">
              المصدر: كتاب الطالب ص {toArabicDigits(lesson.source.source_printed_page)} — النشاط {toArabicDigits(lesson.source.core_activity)}
            </p>
            {lesson.content_review_status !== "approved" && (
              <p className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900" data-testid="review-banner">
                نسخة تجريبية: محتوى هذا الدرس بانتظار مراجعة ولي الأمر قبل اعتماده.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {lesson.games.map((g) => (
                <button
                  key={g.game_id}
                  type="button"
                  data-game={g.game_mechanic_id}
                  onClick={() => setScreen({ name: "game", game: g })}
                  className="rounded-2xl bg-sky-600 px-4 py-5 text-xl font-bold text-white shadow-lg active:scale-95"
                >
                  {g.title}
                </button>
              ))}
            </div>
          </article>

          <details className="rounded-2xl bg-white p-4 shadow">
            <summary className="cursor-pointer font-bold">⚙️ إعدادات ولي الأمر</summary>
            <label className="mt-3 flex items-center gap-3">
              مدة الجلسة المقترحة:
              <select
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(Number(e.target.value))}
                className="rounded-lg border px-2 py-1"
              >
                {[8, 10, 12, 15].map((m) => (
                  <option key={m} value={m}>
                    {toArabicDigits(m)} دقائق
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-sm text-slate-500">لا يوجد مؤقت للأسئلة، ووقت الإجابة لا يؤثر في التقييم.</p>
          </details>
        </section>
      )}

      {screen.name === "game" && (
        <GameRunner
          key={screen.game.game_id}
          game={screen.game}
          lessonId={lesson.lesson_id}
          sessionId={sessionId}
          initialState={levels.get(screen.game.game_id)}
          seeds={seeds}
          onExit={() => setScreen({ name: "home" })}
          onFinish={({ firstTryCorrect, total, state }) => {
            levels.set(screen.game.game_id, state);
            setScreen({ name: "done", game: screen.game, firstTryCorrect, total });
          }}
        />
      )}

      {screen.name === "done" && (
        <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-10 text-center" data-testid="round-done">
          <div className="text-6xl">🌿</div>
          <h2 className="text-3xl font-extrabold">أحسنت! أنهيت الجولة</h2>
          <p className="text-xl">
            صحيح من المحاولة الأولى: {toArabicDigits(screen.firstTryCorrect)} من {toArabicDigits(screen.total)}
          </p>
          <p className="rounded-2xl bg-white p-3 text-lg shadow">
            {overTime() ? "انتهى وقت الجلسة المقترح. وقت الراحة! 🧃" : "خذ نفَسًا عميقًا، ثم اختر ما تحب."}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setScreen({ name: "game", game: screen.game })} className="rounded-2xl bg-sky-600 px-6 py-3 text-lg font-bold text-white shadow">
              جولة أخرى
            </button>
            <button type="button" onClick={() => setScreen({ name: "home" })} className="rounded-2xl bg-white px-6 py-3 text-lg font-bold shadow">
              الرئيسية
            </button>
          </div>
        </section>
      )}

      {screen.name === "progress" && <ProgressView onBack={() => setScreen({ name: "home" })} />}
    </main>
  );
}

function ProgressView({ onBack }: { onBack: () => void }) {
  const summaries = summariseBySkill(loadAttempts());
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
          <h3 className="text-lg font-bold">{SKILL_NAMES[s.skillId] ?? s.skillId}</h3>
          <p>
            المحاولات: {toArabicDigits(s.attempts)} · صحيح أولًا: {toArabicDigits(s.firstTryCorrect)}/{toArabicDigits(s.firstTryTotal)} · الجلسات:{" "}
            {toArabicDigits(s.sessions)} · الآليات: {toArabicDigits(s.mechanics)}
          </p>
          <p className="mt-1 font-bold text-sky-800">الحالة: {MASTERY_LABEL[masteryStatus(s)]}</p>
        </article>
      ))}
    </section>
  );
}

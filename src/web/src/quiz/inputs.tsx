/**
 * Answer widgets for quiz items. Labels are logical text rendered in the RTL page
 * with Arabic-Indic digits, so equations and < > signs look exactly as in the book
 * (the same mirroring applies to option buttons and to sentences).
 */
import { useState } from "react";
import type { ChoiceOption } from "@ghaith/game-core";
import { NumberPad } from "../components/NumberPad";
import { parseNumberInput, toArabicDigits } from "../lib/digits";

interface Common {
  locked: boolean;
  reveal: boolean;
  solution: unknown;
  onSubmit: (answer: unknown) => void;
  /** "en": labels are English (left-to-right, Western digits). */
  lang?: "ar" | "en";
}

const EMOJI_ONLY = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u;

/** Render an option label: Arabic → Arabic-Indic digits; English → as written, LTR; emoji → large. */
export function OptionLabel({ label, lang }: { label: string; lang?: "ar" | "en" }) {
  if (EMOJI_ONLY.test(label)) return <span className="text-6xl leading-none" role="img">{label}</span>;
  // A lone punctuation mark («.» «:» «،») must be big enough to see and tap.
  if (/^[.:،؛؟!]$/.test(label.trim())) return <span className="text-6xl leading-none">{label}</span>;
  if (lang === "en") return <span dir="ltr" lang="en">{label}</span>;
  return <>{toArabicDigits(label)}</>;
}

/** Text built from cards: tatweel removed, and «عَمْـ»+«ـمُـ» shown as the printed «عَمُّ» (shadda). */
export const builtText = (s: string) => s.replace(/\u0640/g, "").replace(/([\u0621-\u064A])\u0652\1/g, "$1\u0651");

const BTN = "min-h-14 rounded-2xl px-4 py-3 text-2xl font-extrabold shadow active:scale-95 disabled:cursor-default";

export function NumberAnswer({ locked, reveal, solution, onSubmit, unit }: Common & { unit?: string }) {
  const [raw, setRaw] = useState("");
  const shown = reveal ? String(solution) : raw;
  const submit = () => onSubmit(parseNumberInput(raw));
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <input
          aria-label="اكتب الإجابة"
          data-testid="number-answer"
          inputMode="numeric"
          autoComplete="off"
          readOnly={locked || reveal}
          value={toArabicDigits(shown)}
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9٠-٩۰-۹]/g, "").slice(0, 4))}
          onKeyDown={(e) => e.key === "Enter" && !locked && submit()}
          className={`h-16 w-40 rounded-2xl text-center text-4xl font-extrabold shadow-inner outline-none ring-4 ${
            reveal ? "bg-emerald-100 ring-emerald-400" : "bg-white ring-amber-300"
          }`}
        />
        {unit && <span className="text-2xl font-bold">{unit}</span>}
      </div>
      {!locked && !reveal && (
        <>
          <NumberPad onDigit={(d) => setRaw((r) => (r + d).slice(0, 4))} onDelete={() => setRaw((r) => r.slice(0, -1))} />
          <button type="button" onClick={submit} className={`${BTN} w-full max-w-xs bg-emerald-600 text-white`}>
            تحقّق ✓
          </button>
        </>
      )}
    </div>
  );
}

export function ChoiceAnswer({ options, locked, reveal, solution, onSubmit, lang }: Common & { options: ChoiceOption[] }) {
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  return (
    <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="الخيارات">
      {options.map((o) => {
        const isSolution = reveal && o.id === solution;
        return (
          <button
            key={o.id}
            type="button"
            data-option={o.id}
            disabled={locked || reveal}
            onClick={() => {
              setWrongPick(o.id);
              onSubmit(o.id);
            }}
            className={`${BTN} ${isSolution ? "bg-emerald-300" : wrongPick === o.id && !locked ? "bg-amber-100" : "bg-white"}`}
          >
            <OptionLabel label={o.label} lang={lang} />
          </button>
        );
      })}
    </div>
  );
}

export function MultiAnswer({ options, exactly, locked, reveal, solution, onSubmit, lang }: Common & { options: ChoiceOption[]; exactly?: number }) {
  const [picked, setPicked] = useState<string[]>([]);
  const sol = Array.isArray(solution) ? (solution as string[]) : [];
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : exactly && p.length >= exactly ? [...p.slice(1), id] : [...p, id]));
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-base text-slate-600">{exactly ? `اختر ${toArabicDigits(exactly)}` : "اختر كل الإجابات الصحيحة"}</p>
      <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2" role="group" aria-label="الخيارات">
        {options.map((o) => {
          const on = reveal ? sol.includes(o.id) : picked.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              data-option={o.id}
              aria-pressed={on}
              disabled={locked || reveal}
              onClick={() => toggle(o.id)}
              className={`${BTN} ${on ? (reveal ? "bg-emerald-300" : "bg-sky-200 ring-4 ring-sky-500") : "bg-white"}`}
            >
              {on ? "✓ " : ""}
              <OptionLabel label={o.label} lang={lang} />
            </button>
          );
        })}
      </div>
      {!locked && !reveal && (
        <button type="button" onClick={() => onSubmit(picked)} disabled={picked.length === 0} className={`${BTN} w-full max-w-xs bg-emerald-600 text-white disabled:opacity-40`}>
          تحقّق ✓
        </button>
      )}
    </div>
  );
}

export function OrderAnswer({ items, locked, reveal, solution, onSubmit, lang, joiner }: Common & { items: ChoiceOption[]; joiner?: string }) {
  const [order, setOrder] = useState<string[]>([]);
  const shown = reveal && Array.isArray(solution) ? (solution as string[]) : order;
  const raw = (id: string) => items.find((i) => i.id === id)?.label ?? "";
  const label = (id: string) => (lang === "en" ? raw(id) : toArabicDigits(raw(id)));
  /** Long cards (events of a story) are listed one per line, numbered. */
  const long = joiner === undefined && items.some((i) => i.label.length > 24);
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {joiner !== undefined ? (
        // Syllables → word, words → sentence: show the text being built (tatweel of the cards removed).
        <p data-testid="order-built" className={`min-h-20 w-full max-w-xl rounded-2xl bg-white/70 p-2 text-center text-4xl font-bold leading-[2] ${reveal ? "text-emerald-700" : "text-sky-900"}`} aria-label="الترتيب">
          {shown.length === 0 ? <span className="text-xl text-slate-400">المس البطاقات بالترتيب</span> : builtText(shown.map(label).join(joiner))}
        </p>
      ) : long ? (
        <ol className="flex min-h-16 w-full max-w-xl flex-col gap-2 rounded-2xl bg-white/70 p-2" aria-label="الترتيب">
          {shown.length === 0 && <li className="text-center text-slate-400">المس البطاقات بالترتيب</li>}
          {shown.map((id, i) => (
            <li key={id} className={`rounded-xl px-3 py-2 text-xl font-bold leading-loose ${reveal ? "bg-emerald-200" : "bg-sky-200"}`}>
              {toArabicDigits(i + 1)}. {label(id)}
            </li>
          ))}
        </ol>
      ) : (
      <div dir={lang === "en" ? "ltr" : undefined} lang={lang === "en" ? "en" : undefined} className="flex min-h-16 w-full max-w-xl flex-wrap items-center justify-center gap-2 rounded-2xl bg-white/70 p-2" aria-label="الترتيب">
        {shown.length === 0 && <span className="text-slate-400">المس البطاقات بالترتيب</span>}
        {shown.map((id, i) => (
          <span key={id} className={`rounded-xl px-3 py-2 text-2xl font-extrabold ${reveal ? "bg-emerald-200" : "bg-sky-200"}`}>
            {label(id)}
            {i < shown.length - 1 && lang !== "en" && <span className="mx-1 text-slate-400">،</span>}
          </span>
        ))}
      </div>
      )}
      {!locked && !reveal && (
        <>
          <div dir={lang === "en" ? "ltr" : undefined} className={long ? "flex w-full max-w-xl flex-col gap-2" : "flex flex-wrap justify-center gap-3"}>
            {items
              .filter((i) => !order.includes(i.id))
              .map((i) => (
                <button key={i.id} type="button" data-option={i.id} onClick={() => setOrder((o) => [...o, i.id])} className={`${BTN} bg-white`}>
                  <OptionLabel label={i.label} lang={lang} />
                </button>
              ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setOrder((o) => o.slice(0, -1))} disabled={order.length === 0} className={`${BTN} bg-slate-200 disabled:opacity-40`}>
              ⌫ تراجع
            </button>
            <button type="button" onClick={() => onSubmit(order)} disabled={order.length !== items.length} className={`${BTN} bg-emerald-600 text-white disabled:opacity-40`}>
              تحقّق ✓
            </button>
          </div>
        </>
      )}
    </div>
  );
}

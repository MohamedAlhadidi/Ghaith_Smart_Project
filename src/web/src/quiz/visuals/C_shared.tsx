/** Shared pieces for executor-C English renderers: English text, read-aloud buttons, pictures. */
import type { ReactNode } from "react";
import type { QuizItem } from "@ghaith/game-core";
import { canSpeak, speak } from "../../lib/speech";
import { DrawnThing } from "./C_drawings";

export const EN_FONT = "font-[Andika,'Comic_Sans_MS',system-ui]";

/** English text: always left-to-right, never digit-converted. */
export function En({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span dir="ltr" lang="en" className={`${EN_FONT} ${className}`}>
      {children}
    </span>
  );
}

/** 🔊 normal and 🐢 slow read-aloud (device speech only; never the microphone). Hidden if the device cannot speak. */
export function SpeakButtons({ text, size = "lg" }: { text: string; size?: "lg" | "sm" }) {
  if (!canSpeak()) return null;
  const big = size === "lg";
  return (
    <div className="flex gap-2" dir="ltr">
      <button
        type="button"
        aria-label="Listen"
        data-testid="listen"
        onClick={() => speak(text, "en-GB")}
        className={`rounded-full bg-sky-600 text-white shadow active:scale-95 ${big ? "px-5 py-3 text-3xl" : "px-3 py-1 text-xl"}`}
      >
        🔊
      </button>
      <button
        type="button"
        aria-label="Listen slowly"
        data-testid="listen-slow"
        onClick={() => speak(text, "en-GB", 0.55)}
        className={`rounded-full bg-sky-100 shadow active:scale-95 ${big ? "px-4 py-3 text-2xl" : "px-3 py-1 text-lg"}`}
      >
        🐢
      </button>
    </div>
  );
}

/** A word-bank picture: an emoji, or "draw:<word>" for a simple SVG drawing. */
export function Picture({ picture, size = "text-8xl", label }: { picture: string | null; size?: string; label?: string }) {
  if (!picture) return null;
  if (picture.startsWith("draw:")) return <DrawnThing word={picture.slice(5)} className={size === "text-8xl" ? "h-32 w-40" : "h-20 w-24"} />;
  return (
    <span className={`${size} leading-none`} role="img" aria-label={label ?? "picture"}>
      {picture}
    </span>
  );
}

/** The label of the solution option of a choice item (used to fill a blank on reveal). */
export function solutionLabel(item: QuizItem, solution: unknown): string | null {
  if (item.input.type !== "choice") return null;
  return item.input.options.find((o) => o.id === solution)?.label ?? null;
}

/** A sentence with a "___" blank; on reveal the blank shows the answer. */
export function BlankSentence({ text, fill }: { text: string; fill: string | null }) {
  const [before, after] = text.split("___");
  if (after === undefined) return <En className="text-3xl font-bold text-slate-900 sm:text-4xl">{text}</En>;
  return (
    <En className="text-3xl font-bold leading-relaxed text-slate-900 sm:text-4xl">
      {before}
      <span data-testid="blank" className={`mx-1 inline-block min-w-16 rounded-lg border-b-4 px-2 text-center ${fill ? "border-emerald-500 bg-emerald-100" : "border-sky-500 bg-sky-50"}`}>
        {fill ?? "   "}
      </span>
      {after}
    </En>
  );
}

/**
 * Renderers for Arabic («أحب لغتي») visuals. Vowelled book text is set in Noto Naskh Arabic
 * (bundled, OFL) at a large size with generous line height so every ḥaraka stays readable.
 */
import type { VisualProps } from "../types";

export const AR_FONT = "font-naskh";

type ArCard = { type: "ar-card"; text: string; size?: "word" | "sentence"; highlight?: string };

/** A word or a sentence copied from the book, optionally with one part coloured. */
export function ArCardView({ visual }: VisualProps<ArCard>) {
  const big = visual.size === "word";
  const parts = visual.highlight ? visual.text.split(visual.highlight) : [visual.text];
  return (
    <p
      lang="ar"
      dir="rtl"
      data-testid="ar-card"
      className={`${AR_FONT} max-w-2xl rounded-3xl bg-white px-6 py-4 text-center font-bold text-slate-900 shadow ${
        big ? "text-6xl leading-[1.9]" : "text-3xl leading-[2.1] sm:text-4xl"
      }`}
    >
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span className="rounded-lg bg-amber-200 px-1 text-rose-700">{visual.highlight}</span>}
        </span>
      ))}
    </p>
  );
}

export const VISUALS_AR = {
  "ar-card": ArCardView,
};

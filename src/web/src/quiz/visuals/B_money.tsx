/** Renderers for money (executor B): plain value cards only, never banknote pictures (p.30 notes are marked «نموذج»). */
import type { VisualProps } from "../types";
import { ar, isNum, rialsText, ValueCard } from "./B_shared";

type Tag = { name: string; text: string };

function PriceTag({ tag }: { tag: Tag }) {
  return (
    <div className="flex min-w-28 flex-col items-center gap-1 rounded-2xl bg-white p-3 shadow">
      <span className="text-2xl font-extrabold">{tag.name}</span>
      <span className="rounded-lg bg-amber-200 px-3 py-1 text-xl font-bold text-amber-900">{ar(tag.text)}</span>
    </div>
  );
}

function PriceTags({ visual, reveal, solution }: VisualProps<{ type: "b-price-tags"; items: Tag[] }>) {
  return (
    <figure className="flex flex-col items-center gap-3" aria-label="الأغراض وأثمانها">
      <div className="flex flex-wrap justify-center gap-3">
        {visual.items.map((t, i) => (
          <PriceTag key={i} tag={t} />
        ))}
      </div>
      {reveal && isNum(solution) && (
        <figcaption>
          <ValueCard text={`المجموع ${rialsText(solution)}`} tone="answer" />
        </figcaption>
      )}
    </figure>
  );
}

/** What was paid, what was bought, what came back; the unknown shows «؟». */
function Pay({ visual, reveal, solution }: VisualProps<{ type: "b-pay"; paid: string | null; items: Tag[]; change: string | null }>) {
  const solved =
    reveal && isNum(solution) ? rialsText(solution) : reveal && typeof solution === "string" && /^n\d+$/.test(solution) ? rialsText(Number(solution.slice(1))) : null;
  const slot = (known: string | null) =>
    known !== null ? <ValueCard text={ar(known)} /> : solved ? <ValueCard text={solved} tone="answer" /> : <ValueCard text="؟" tone="unknown" />;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-bold">دفعت</span>
        {slot(visual.paid)}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {visual.items.map((t, i) => (
          <PriceTag key={i} tag={t} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-bold">الباقي</span>
        {slot(visual.change)}
      </div>
    </div>
  );
}

function MoneyCards({ visual }: VisualProps<{ type: "b-money-cards"; cards: string[] }>) {
  return (
    <div className="flex max-w-2xl flex-wrap justify-center gap-2" role="img" aria-label={visual.cards.map((c) => ar(c)).join("، ")}>
      {visual.cards.map((c, i) => (
        <ValueCard key={i} text={ar(c)} />
      ))}
    </div>
  );
}

export const MONEY_VISUALS = {
  "b-price-tags": PriceTags,
  "b-pay": Pay,
  "b-money-cards": MoneyCards,
};

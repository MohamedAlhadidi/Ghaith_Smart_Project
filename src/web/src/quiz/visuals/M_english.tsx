/** Renderers for the reference English mechanics (listen-touch, missing-grapheme). */
import { useState } from "react";
import { canSpeak, speak } from "../../lib/speech";
import type { VisualProps, VisualRenderer } from "../types";

/** Speaker buttons: normal and slow. Falls back to showing the word if the device cannot speak. */
export function ListenButtons({ text, alwaysShow = false }: { text: string; alwaysShow?: boolean }) {
  const [played, setPlayed] = useState(false);
  const able = canSpeak();
  return (
    <div className="flex flex-col items-center gap-2" dir="ltr" lang="en">
      {able && (
        <div className="flex gap-3">
          <button type="button" aria-label="Listen" data-testid="listen" onClick={() => { speak(text, "en-GB"); setPlayed(true); }} className="rounded-full bg-sky-600 px-6 py-4 text-4xl text-white shadow-lg active:scale-95">
            🔊
          </button>
          <button type="button" aria-label="Listen slowly" onClick={() => { speak(text, "en-GB", 0.55); setPlayed(true); }} className="rounded-full bg-sky-100 px-5 py-4 text-3xl shadow active:scale-95">
            🐢
          </button>
        </div>
      )}
      {(!able || alwaysShow) && <p className="font-[Andika,'Comic_Sans_MS',system-ui] text-4xl font-bold text-sky-900">{text}</p>}
      {able && !played && <p className="text-sm text-slate-500" dir="rtl">اضغط 🔊 لتسمع الكلمة</p>}
    </div>
  );
}

function Listen({ visual, reveal }: VisualProps<{ type: "en-listen"; text: string }>) {
  return <ListenButtons text={visual.text} alwaysShow={reveal} />;
}

function Missing({ visual, reveal, item }: VisualProps<{ type: "en-missing"; hidden: string; picture: string | null; word: string | null }>) {
  const word = (item.params as { word: string }).word;
  return (
    <div className="flex flex-col items-center gap-3" dir="ltr" lang="en">
      {visual.picture && <span className="text-7xl" aria-hidden>{visual.picture}</span>}
      <p className="font-mono text-5xl font-extrabold tracking-[0.3em] text-sky-900" data-testid="hidden-word">
        {reveal ? word : visual.hidden}
      </p>
      <ListenButtons text={word} />
    </div>
  );
}

export const ENGLISH_VISUALS: Record<string, VisualRenderer> = { "en-listen": Listen, "en-missing": Missing };

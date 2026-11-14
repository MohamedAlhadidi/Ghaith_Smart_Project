/**
 * Renderers for executor-C English visuals ("en-c-*"). English text is always LTR with
 * Western digits; every read-aloud uses the device voice (🔊 / 🐢) and is optional.
 */
import { useState } from "react";
import { speak } from "../../lib/speech";
import type { VisualProps } from "../types";
import { Balloons, Face, Figure, Monster, PrepScene, Robot, RobotHand, Swatch, type FaceSpec } from "./C_drawings";
import { BlankSentence, EN_FONT, En, Picture, SpeakButtons, solutionLabel } from "./C_shared";

const EMOJI_ONLY = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|️|‍|\s)+$/u;

/* ------------------------------------------------------------------ */
/* en-c-word: a word to read (read-touch)                              */
/* ------------------------------------------------------------------ */

export function WordCard({ visual }: VisualProps<{ type: "en-c-word"; text: string; speak: boolean }>) {
  return (
    <div className="flex flex-col items-center gap-3" dir="ltr" lang="en">
      <p className={`${EN_FONT} rounded-3xl bg-white px-8 py-4 text-5xl font-extrabold text-sky-900 shadow sm:text-6xl`} data-testid="en-word">
        {visual.text}
      </p>
      {visual.speak && <SpeakButtons text={visual.text} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* en-c-scene: picture / drawing + optional sentence or speech bubble  */
/* ------------------------------------------------------------------ */

type Scene =
  | { kind: "thing"; picture: string | null; count: number }
  | { kind: "balloons"; n: number; colours: string[] }
  | { kind: "card"; text: string }
  | { kind: "swatch"; hex: string; outline: boolean; shape: string }
  | { kind: "prep"; object: string | null; place: string; prep: string }
  | { kind: "face"; face: FaceSpec; caption?: string }
  | { kind: "monster"; part: string; counts: { head: number; eye: number; arm: number; leg: number } }
  | { kind: "robot" }
  | { kind: "robotHand"; fingers: number };

function SceneView({ scene }: { scene: Scene }) {
  switch (scene.kind) {
    case "thing": {
      const n = Math.max(1, scene.count);
      const size = n === 1 ? "text-8xl" : n <= 3 ? "text-7xl" : "text-6xl";
      return (
        <div className="flex flex-wrap items-center justify-center gap-3" data-count={n} aria-label={`${n}`}>
          {Array.from({ length: n }, (_, i) => (
            <Picture key={i} picture={scene.picture} size={size} />
          ))}
        </div>
      );
    }
    case "balloons":
      return <Balloons colours={scene.colours} />;
    case "card":
      return (
        <p className={`${EN_FONT} rounded-3xl border-4 border-amber-300 bg-white px-10 py-4 text-7xl font-extrabold text-slate-900 shadow`} dir="ltr" lang="en" data-testid="en-card">
          {scene.text}
        </p>
      );
    case "swatch":
      return <Swatch hex={scene.hex} shape={scene.shape} />;
    case "prep":
      return <PrepScene object={scene.object} place={scene.place} prep={scene.prep} />;
    case "face":
      return (
        <div className="flex flex-col items-center gap-1">
          <Face face={scene.face} />
          {scene.caption && (
            <div className="flex items-center gap-2" dir="ltr">
              <En className="text-2xl font-bold">{scene.caption}</En>
              <SpeakButtons text={scene.caption} size="sm" />
            </div>
          )}
        </div>
      );
    case "monster":
      return <Monster counts={scene.counts} part={scene.part} />;
    case "robot":
      return <Robot />;
    case "robotHand":
      return <RobotHand fingers={scene.fingers} />;
  }
}

export function SceneCard({ visual, item, reveal, solution }: VisualProps<{ type: "en-c-scene"; scene: Scene | null; text: string | null; say: string | null; bubble?: boolean }>) {
  const label = reveal ? solutionLabel(item, solution) : null;
  const fill = label && !EMOJI_ONLY.test(label) ? label : null;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {visual.scene && <SceneView scene={visual.scene} />}
      {visual.text &&
        (visual.bubble ? (
          <div dir="ltr" lang="en" className="relative max-w-md rounded-3xl border-4 border-sky-300 bg-white px-6 py-4 text-left shadow" data-testid="speech-bubble">
            <En className="text-3xl font-bold text-slate-900">{visual.text}</En>
            <span className="absolute -bottom-4 left-10 h-6 w-6 rotate-45 border-b-4 border-r-4 border-sky-300 bg-white" aria-hidden />
          </div>
        ) : (
          <p className="text-center" dir="ltr" data-testid="en-sentence">
            <BlankSentence text={visual.text} fill={fill} />
          </p>
        ))}
      {visual.say && <SpeakButtons text={visual.say} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* en-c-tiles: cue for an ordering task (letters, sounds, words)       */
/* ------------------------------------------------------------------ */

export function TilesCue({
  visual,
}: VisualProps<{
  type: "en-c-tiles";
  picture: string | null;
  colour: string | null;
  outline: boolean;
  digit: string | null;
  say: string | null;
  gloss: string | null;
  before: string | null;
  after: string | null;
}>) {
  const hasCue = visual.picture || visual.colour || visual.digit;
  return (
    <div className="flex flex-col items-center gap-3">
      {visual.picture && <Picture picture={visual.picture} />}
      {visual.colour && (
        <span
          className="h-24 w-24 rounded-3xl shadow"
          style={{ backgroundColor: visual.colour, border: visual.outline ? "4px solid #64748b" : "4px solid transparent" }}
          role="img"
          aria-label="colour"
          data-colour={visual.colour}
        />
      )}
      {visual.digit && (
        <span className={`${EN_FONT} rounded-3xl border-4 border-amber-300 bg-white px-8 py-2 text-7xl font-extrabold`} dir="ltr" lang="en">
          {visual.digit}
        </span>
      )}
      {!hasCue && visual.gloss && !visual.before && !visual.after && <p className="rounded-2xl bg-white px-5 py-2 text-3xl font-bold text-slate-700">{visual.gloss}</p>}
      {(visual.before || visual.after) && (
        <p className="text-center" data-testid="order-context">
          <En className="text-2xl font-bold text-slate-700">
            {visual.before && <span>{visual.before} </span>}
            <span className="mx-1 inline-block min-w-24 rounded-lg border-b-4 border-dashed border-sky-400">&nbsp;</span>
            {visual.after && <span> {visual.after}</span>}
          </En>
        </p>
      )}
      {visual.say && <SpeakButtons text={visual.say} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* en-c-sound: the sound card for sound-sort                           */
/* ------------------------------------------------------------------ */

export function SoundCard({ visual }: VisualProps<{ type: "en-c-sound"; label: string; example: { word: string; picture: string | null } | null }>) {
  return (
    <div className="flex flex-col items-center gap-2" dir="ltr" lang="en">
      <span className={`${EN_FONT} rounded-3xl border-4 border-violet-300 bg-violet-50 px-8 py-2 text-6xl font-extrabold text-violet-900`} data-testid="sound-card">
        {visual.label}
      </span>
      {visual.example && (
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2 shadow">
          <En className="text-xl text-slate-500">like</En>
          <Picture picture={visual.example.picture} size="text-5xl" />
          <En className="text-3xl font-bold">{visual.example.word}</En>
          <SpeakButtons text={visual.example.word} size="sm" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* en-c-match: tap a word, then its picture (input: visual)            */
/* ------------------------------------------------------------------ */

const PAIR_COLOURS = ["bg-rose-200 ring-rose-500", "bg-sky-200 ring-sky-500", "bg-amber-200 ring-amber-500", "bg-emerald-200 ring-emerald-500", "bg-violet-200 ring-violet-500"];

export function MatchBoard({ visual, reveal, solution, locked, onAnswer }: VisualProps<{ type: "en-c-match"; words: string[]; pictures: string[]; speakOnTap: boolean }>) {
  const [selected, setSelected] = useState<number | null>(null);
  const [pairs, setPairs] = useState<Array<[number, number]>>([]);
  const shown: Array<[number, number]> = reveal && Array.isArray(solution) ? (solution as Array<[number, number]>) : pairs;
  const pairOfWord = (i: number) => shown.findIndex((p) => p[0] === i);
  const pairOfPic = (j: number) => shown.findIndex((p) => p[1] === j);
  const colourOf = (k: number) => (k >= 0 ? `${PAIR_COLOURS[shown[k]![0] % PAIR_COLOURS.length]} ring-4` : "bg-white");
  const disabled = locked || reveal;

  const tapWord = (i: number) => {
    if (disabled) return;
    if (visual.speakOnTap) speak(visual.words[i]!, "en-GB");
    setPairs((ps) => ps.filter((p) => p[0] !== i));
    setSelected(i);
  };
  const tapPic = (j: number) => {
    if (disabled || selected === null) return;
    setPairs((ps) => [...ps.filter((p) => p[0] !== selected && p[1] !== j), [selected, j]]);
    setSelected(null);
  };

  return (
    <div className="flex w-full flex-col items-center gap-4" dir="ltr" lang="en">
      <div className="grid w-full max-w-lg grid-cols-2 gap-x-6 gap-y-3">
        <div className="flex flex-col gap-3">
          {visual.words.map((w, i) => (
            <button
              key={w}
              type="button"
              data-match-word={i}
              aria-pressed={selected === i}
              disabled={disabled}
              onClick={() => tapWord(i)}
              className={`${EN_FONT} min-h-20 rounded-2xl px-3 text-2xl font-extrabold shadow active:scale-95 ${selected === i ? "bg-sky-100 ring-4 ring-sky-600" : colourOf(pairOfWord(i))}`}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {visual.pictures.map((p, j) => (
            <button
              key={`${p}-${j}`}
              type="button"
              data-match-pic={j}
              disabled={disabled}
              onClick={() => tapPic(j)}
              aria-label={`picture ${j + 1}`}
              className={`min-h-20 rounded-2xl shadow active:scale-95 ${colourOf(pairOfPic(j))}`}
            >
              <Picture picture={p} size="text-6xl" />
            </button>
          ))}
        </div>
      </div>
      {!disabled && (
        <p className="text-base text-slate-600" dir="rtl">
          {selected === null ? "المس كلمة أولًا." : "الآن المس صورتها."}
        </p>
      )}
      {!disabled && (
        <button
          type="button"
          data-testid="match-confirm"
          disabled={pairs.length !== visual.words.length}
          onClick={() => onAnswer?.(pairs)}
          className="min-h-14 w-full max-w-xs rounded-2xl bg-emerald-600 px-4 py-3 text-2xl font-extrabold text-white shadow active:scale-95 disabled:opacity-40"
          dir="rtl"
        >
          تحقّق ✓
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* en-c-command: hear/read a command, touch its picture (input: visual) */
/* ------------------------------------------------------------------ */

type CommandPicture = { emoji: string } | { figure: string };

export function CommandPick({ visual, reveal, solution, locked, onAnswer }: VisualProps<{ type: "en-c-command"; say: string; pictures: CommandPicture[] }>) {
  const [picked, setPicked] = useState<string | null>(null);
  const disabled = locked || reveal;
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <SpeakButtons text={visual.say} />
      <div className="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="الصور">
        {visual.pictures.map((p, i) => {
          const id = `o${i}`;
          const tone = reveal && id === solution ? "bg-emerald-300 ring-4 ring-emerald-600" : picked === id && !locked ? "bg-amber-100" : "bg-white";
          return (
            <button
              key={id}
              type="button"
              data-option={id}
              data-command-pic={i}
              disabled={disabled}
              onClick={() => {
                setPicked(id);
                onAnswer?.(id);
              }}
              className={`flex min-h-32 items-center justify-center rounded-2xl shadow active:scale-95 ${tone}`}
              aria-label={`picture ${i + 1}`}
            >
              {"emoji" in p ? (
                <span className="text-7xl leading-none" role="img">
                  {p.emoji}
                </span>
              ) : (
                <Figure figure={p.figure} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

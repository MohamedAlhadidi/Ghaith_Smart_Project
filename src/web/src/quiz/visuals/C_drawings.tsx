/**
 * Simple SVG drawings for executor-C English games: classroom furniture (U2), stick figures
 * for commands (W, U3), faces (U4), the funny monster (LC2), Gymbot (U3 story), balloons and
 * colour shapes (W). Kept plain and high-contrast so each picture can only mean one thing.
 */
import type { JSX } from "react";

const INK = "#0f172a";
const SKIN = "#f6d3b3";
const WOOD = "#b7793f";
const WOOD_DARK = "#7c4a1e";

/* ------------------------------------------------------------------ */
/* Furniture and things                                                */
/* ------------------------------------------------------------------ */

type Place = "desk" | "table" | "chair" | "cupboard" | "shelf";
type Prep = "in" | "on" | "under";

/** Baseline (x, y) of an object placed in / on / under each piece of furniture (viewBox 220×170). */
const SPOTS: Record<Place, Partial<Record<Prep, [number, number]>>> = {
  desk: { on: [110, 66], in: [110, 106], under: [110, 158] },
  table: { on: [110, 76], under: [110, 158] },
  chair: { on: [104, 92], under: [104, 158] },
  cupboard: { on: [110, 38], in: [110, 96] },
  shelf: { on: [110, 86] },
};

function Furniture({ place }: { place: Place }): JSX.Element {
  switch (place) {
    case "desk":
      return (
        <g stroke={INK} strokeWidth={3}>
          <rect x={30} y={68} width={160} height={10} rx={2} fill={WOOD} />
          {/* open compartment under the top: things can go IN the desk */}
          <rect x={44} y={78} width={132} height={32} fill="#fde7c7" />
          <line x1={44} y1={110} x2={176} y2={110} />
          <line x1={40} y1={78} x2={40} y2={160} strokeWidth={6} />
          <line x1={180} y1={78} x2={180} y2={160} strokeWidth={6} />
        </g>
      );
    case "table":
      return (
        <g stroke={INK} strokeWidth={3}>
          <rect x={24} y={78} width={172} height={10} rx={2} fill={WOOD} />
          <line x1={38} y1={88} x2={38} y2={160} strokeWidth={6} />
          <line x1={182} y1={88} x2={182} y2={160} strokeWidth={6} />
        </g>
      );
    case "chair":
      return (
        <g stroke={INK} strokeWidth={3} fill={WOOD}>
          <rect x={140} y={34} width={10} height={62} rx={2} />
          <rect x={62} y={94} width={92} height={9} rx={2} />
          <line x1={68} y1={103} x2={68} y2={160} strokeWidth={6} />
          <line x1={146} y1={103} x2={146} y2={160} strokeWidth={6} />
        </g>
      );
    case "cupboard":
      return (
        <g stroke={INK} strokeWidth={3}>
          <rect x={62} y={40} width={96} height={120} fill={WOOD} />
          <rect x={70} y={48} width={80} height={104} fill="#fde7c7" />
          <line x1={70} y1={98} x2={150} y2={98} strokeWidth={4} />
          {/* doors open outwards */}
          <polygon points="62,40 34,52 34,148 62,160" fill={WOOD_DARK} />
          <polygon points="158,40 186,52 186,148 158,160" fill={WOOD_DARK} />
        </g>
      );
    case "shelf":
      return (
        <g stroke={INK} strokeWidth={3}>
          <rect x={0} y={0} width={220} height={160} fill="#eef2ff" stroke="none" />
          <rect x={36} y={88} width={148} height={9} rx={2} fill={WOOD} />
          <polygon points="50,97 64,97 50,116" fill={WOOD_DARK} />
          <polygon points="170,97 156,97 170,116" fill={WOOD_DARK} />
        </g>
      );
  }
}

/** Object (emoji) in / on / under the place. */
export function PrepScene({ object, place, prep }: { object: string | null; place: string; prep: string }) {
  const spot = SPOTS[place as Place]?.[prep as Prep];
  return (
    <svg viewBox="0 0 220 170" className="h-52 w-72" role="img" aria-label={`${prep} the ${place}`} data-prep-scene={`${prep}:${place}`}>
      <line x1={0} y1={160} x2={220} y2={160} stroke="#94a3b8" strokeWidth={4} />
      <Furniture place={place as Place} />
      {spot && object && (
        <text x={spot[0]} y={spot[1]} fontSize={34} textAnchor="middle">
          {object}
        </text>
      )}
    </svg>
  );
}

/** Words with no emoji in the word bank. */
export function DrawnThing({ word, className = "h-32 w-40" }: { word: string; className?: string }) {
  if (word === "eraser")
    return (
      <svg viewBox="0 0 120 80" className={className} role="img" aria-label="eraser">
        <g transform="rotate(-12 60 40)" stroke={INK} strokeWidth={3}>
          <rect x={18} y={24} width={84} height={34} rx={6} fill="#f9a8d4" />
          <rect x={58} y={24} width={44} height={34} rx={0} fill="#60a5fa" />
        </g>
      </svg>
    );
  if (["desk", "table", "chair", "cupboard", "shelf"].includes(word))
    return (
      <svg viewBox="0 0 220 170" className={className} role="img" aria-label={word}>
        <line x1={0} y1={160} x2={220} y2={160} stroke="#94a3b8" strokeWidth={4} />
        <Furniture place={word as Place} />
      </svg>
    );
  return null;
}

/* ------------------------------------------------------------------ */
/* Stick figures for commands                                          */
/* ------------------------------------------------------------------ */

const L = (x1: number, y1: number, x2: number, y2: number, k?: string | number) => <line key={k ?? `${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
const P = (d: string) => <path key={d} d={d} fill="none" />;

export function Figure({ figure }: { figure: string }) {
  let body: JSX.Element[] = [];
  let head: [number, number] = [50, 20];
  let extra: JSX.Element | null = null;
  switch (figure) {
    case "stand":
      body = [L(50, 30, 50, 70), L(50, 40, 36, 64), L(50, 40, 64, 64), L(50, 70, 40, 106), L(50, 70, 60, 106)];
      extra = <path d="M86 96 V44 M78 54 L86 44 L94 54" fill="none" stroke="#16a34a" strokeWidth={4} />;
      break;
    case "sit":
      head = [44, 34];
      body = [L(44, 44, 44, 76), L(44, 52, 64, 66), L(44, 76, 72, 76), L(72, 76, 72, 106)];
      extra = (
        <g>
          <g stroke={WOOD_DARK} strokeWidth={4}>
            {L(30, 44, 30, 108, "c1")}
            {L(30, 80, 78, 80, "c2")}
            {L(78, 80, 78, 108, "c3")}
          </g>
          <path d="M92 44 V96 M84 86 L92 96 L100 86" fill="none" stroke="#dc2626" strokeWidth={4} />
        </g>
      );
      break;
    case "clap":
      body = [L(50, 30, 50, 70), P("M50 40 L30 52 L46 46"), P("M50 40 L70 52 L54 46"), L(50, 70, 40, 106), L(50, 70, 60, 106)];
      extra = (
        <g>
          <circle cx={46} cy={46} r={5} fill="#fde68a" stroke={INK} strokeWidth={2.5} />
          <circle cx={54} cy={46} r={5} fill="#fde68a" stroke={INK} strokeWidth={2.5} />
          <path d="M40 36 L34 30 M50 34 V26 M60 36 L66 30 M40 56 L34 62 M60 56 L66 62" stroke="#f59e0b" strokeWidth={3} />
        </g>
      );
      break;
    case "stamp":
      body = [L(50, 30, 50, 70), L(50, 40, 36, 62), L(50, 40, 64, 62), L(50, 70, 42, 106), P("M50 70 L66 82 L66 96")];
      extra = (
        <g stroke="#f59e0b" strokeWidth={3}>
          {L(60, 100, 56, 106, "s1")}
          {L(66, 100, 66, 108, "s2")}
          {L(72, 100, 76, 106, "s3")}
          <polygon points="66,104 62,112 70,112" fill="#f59e0b" />
        </g>
      );
      break;
    case "touch-toes":
      // Side view: straight legs, body folded forward, hands down at the toes.
      head = [72, 90];
      body = [L(36, 52, 36, 106), L(36, 52, 42, 106), L(36, 106, 50, 106), L(42, 106, 56, 106), L(36, 52, 64, 76), L(62, 76, 56, 104)];
      extra = <circle cx={55} cy={106} r={6} fill="none" stroke="#dc2626" strokeWidth={3} />;
      break;
    case "touch-head":
      body = [L(50, 30, 50, 70), P("M50 40 L32 30 L42 12"), P("M50 40 L68 30 L58 12"), L(50, 70, 40, 106), L(50, 70, 60, 106)];
      extra = <circle cx={50} cy={20} r={14} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 3" />;
      break;
    case "bend-knees":
      head = [50, 36];
      body = [L(50, 46, 50, 76), L(50, 54, 28, 58), L(50, 54, 72, 58), P("M50 76 L34 86 L40 108"), P("M50 76 L66 86 L60 108")];
      extra = (
        <g fill="none" stroke="#dc2626" strokeWidth={3}>
          <circle cx={34} cy={86} r={5} />
          <circle cx={66} cy={86} r={5} />
        </g>
      );
      break;
    case "stretch-legs":
      body = [L(50, 30, 50, 66), P("M50 40 L38 56 L48 64"), P("M50 40 L62 56 L52 64"), L(50, 66, 18, 106), L(50, 66, 82, 106)];
      extra = <path d="M14 96 L4 106 L14 112 M86 96 L96 106 L86 112" fill="none" stroke="#16a34a" strokeWidth={3} />;
      break;
    case "move-body":
      head = [58, 20];
      body = [L(56, 30, 48, 68), L(54, 38, 74, 18), L(53, 42, 30, 52), L(48, 68, 32, 100), L(48, 68, 66, 98)];
      extra = <path d="M22 28 Q16 36 22 44 M84 40 Q92 48 84 56 M18 76 Q12 84 18 92 M80 74 Q88 82 80 90" fill="none" stroke="#f59e0b" strokeWidth={3} />;
      break;
  }
  return (
    <svg viewBox="0 0 100 116" className="h-36 w-32" role="img" aria-label={figure} data-figure={figure}>
      <g stroke={INK} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        {body}
      </g>
      <circle cx={head[0]} cy={head[1]} r={10} fill="#fde68a" stroke={INK} strokeWidth={3} />
      {extra}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Faces (U4)                                                          */
/* ------------------------------------------------------------------ */

export interface FaceSpec {
  gender: "male" | "female";
  age: "child" | "adult" | "old" | "baby";
  hair: string;
  eyes: string;
  ears: string;
  mouth: string;
  nose: string;
}

const HAIR: Record<string, string> = { brown: "#7a4a21", black: "#1f1f1f", red: "#d9480f", fair: "#f2d27a", grey: "#b9b9b9" };
const IRIS: Record<string, string> = { blue: "#2563eb", green: "#16a34a", brown: "#6b3e1f" };

export function Face({ face }: { face: FaceSpec }) {
  const s = face.age === "baby" ? 0.78 : face.age === "child" ? 0.9 : 1;
  const hair = HAIR[face.hair] ?? "#1f1f1f";
  const iris = IRIS[face.eyes] ?? "#6b3e1f";
  const earR = face.ears === "big" ? 15 : 8;
  const eyeR = face.age === "baby" ? 9 : 7;
  const female = face.gender === "female";
  return (
    <svg viewBox="0 0 160 170" className="h-56 w-52" role="img" aria-label={`${face.gender} face`} data-face={JSON.stringify(face)}>
      <g transform={`translate(80 88) scale(${s}) translate(-80 -88)`}>
        {/* long hair behind the face for girls and women */}
        {female && face.age !== "baby" && <path d="M34 70 Q30 150 52 158 L108 158 Q130 150 126 70 Z" fill={hair} />}
        <circle cx={38} cy={88} r={earR} fill={SKIN} stroke={INK} strokeWidth={2} />
        <circle cx={122} cy={88} r={earR} fill={SKIN} stroke={INK} strokeWidth={2} />
        <ellipse cx={80} cy={88} rx={42} ry={50} fill={SKIN} stroke={INK} strokeWidth={2} />
        {/* hair on top */}
        {face.age === "baby" ? (
          <path d="M70 40 Q80 26 92 38" fill="none" stroke={hair} strokeWidth={5} strokeLinecap="round" />
        ) : (
          <path d={female ? "M38 78 Q40 30 80 32 Q120 30 122 78 Q110 52 80 50 Q50 52 38 78 Z" : "M40 72 Q42 32 80 34 Q118 32 120 72 Q106 54 80 54 Q54 54 40 72 Z"} fill={hair} stroke={INK} strokeWidth={1.5} />
        )}
        {female && (face.age === "baby" || face.age === "child") && <path d="M106 44 l14 -8 v16 z M106 44 l-2 -10 l-12 8 z" fill="#ec4899" />}
        {/* eyes */}
        {[62, 98].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={82} rx={eyeR + 4} ry={eyeR + 2} fill="#fff" stroke={INK} strokeWidth={1.5} />
            <circle cx={x} cy={82} r={eyeR} fill={iris} />
            <circle cx={x} cy={82} r={eyeR * 0.4} fill="#000" />
          </g>
        ))}
        {face.age === "old" && (
          <g fill="none" stroke={INK} strokeWidth={2}>
            <circle cx={62} cy={82} r={eyeR + 8} />
            <circle cx={98} cy={82} r={eyeR + 8} />
            <line x1={62 + eyeR + 8} y1={82} x2={98 - eyeR - 8} y2={82} />
          </g>
        )}
        {/* nose */}
        {face.nose === "small" ? <circle cx={80} cy={100} r={2} fill={INK} /> : <path d="M80 90 L74 106 L84 106" fill="none" stroke={INK} strokeWidth={2} />}
        {/* mouth */}
        {face.mouth === "big" ? (
          <path d="M56 116 Q80 148 104 116 Z" fill="#b91c1c" stroke={INK} strokeWidth={2} />
        ) : face.mouth === "small" ? (
          <path d="M75 120 Q80 124 85 120" fill="none" stroke={INK} strokeWidth={2.5} />
        ) : (
          <path d="M68 118 Q80 128 92 118" fill="none" stroke={INK} strokeWidth={2.5} />
        )}
        {face.gender === "male" && face.age === "old" && <path d="M66 110 Q80 104 94 110" fill="none" stroke={hair} strokeWidth={5} strokeLinecap="round" />}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Funny monster (LC2)                                                 */
/* ------------------------------------------------------------------ */

const MONSTER = "#4ade80";

export function Monster({ counts, part }: { counts: { head: number; eye: number; arm: number; leg: number }; part: string }) {
  const heads = Array.from({ length: counts.head }, (_, i) => 110 + (i - (counts.head - 1) / 2) * 46);
  const oneHead = counts.head === 1;
  const headR = oneHead ? 30 : 20;
  const eyeSpots = (cx: number, n: number): Array<[number, number]> => {
    if (n === 1) return [[cx, 52]];
    const perRow = n <= 3 ? n : Math.ceil(n / 2);
    return Array.from({ length: n }, (_, i) => {
      const row = Math.floor(i / perRow);
      const inRow = row === 0 ? Math.min(perRow, n) : n - perRow;
      const col = i % perRow;
      return [cx + (col - (inRow - 1) / 2) * (oneHead ? 16 : 11), (n <= 3 ? 52 : 44 + row * 16) as number] as [number, number];
    });
  };
  const leftArms = Math.ceil(counts.arm / 2);
  const rightArms = counts.arm - leftArms;
  const armY = (i: number, n: number) => 108 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 50);
  const legs = Array.from({ length: counts.leg }, (_, i) => 110 + (i - (counts.leg - 1) / 2) * (counts.leg > 4 ? 15 : 22));
  const hl = (p: string) => (part === p ? { stroke: "#b91c1c", strokeWidth: 4 } : { stroke: INK, strokeWidth: 2.5 });
  return (
    <svg viewBox="0 0 220 220" className="h-64 w-64" role="img" aria-label="monster" data-monster={JSON.stringify(counts)}>
      {/* legs */}
      {legs.map((x, i) => (
        <g key={`l${i}`}>
          <line x1={x} y1={150} x2={x} y2={200} stroke={MONSTER} strokeWidth={10} strokeLinecap="round" />
          <ellipse cx={x} cy={205} rx={9} ry={5} fill={MONSTER} {...hl("leg")} />
        </g>
      ))}
      {/* arms with hands */}
      {[...Array.from({ length: leftArms }, (_, i) => ({ side: -1, y: armY(i, leftArms) })), ...Array.from({ length: rightArms }, (_, i) => ({ side: 1, y: armY(i, rightArms) }))].map((a, i) => {
        const x0 = 110 + a.side * 40;
        const x1 = 110 + a.side * 86;
        const y1 = a.y - 18;
        return (
          <g key={`a${i}`}>
            <line x1={x0} y1={a.y} x2={x1} y2={y1} stroke={part === "arm" ? "#15803d" : MONSTER} strokeWidth={9} strokeLinecap="round" />
            <circle cx={x1} cy={y1} r={8} fill="#facc15" {...hl("hand")} />
          </g>
        );
      })}
      <ellipse cx={110} cy={115} rx={44} ry={44} fill={MONSTER} stroke={INK} strokeWidth={2.5} />
      {/* heads with eyes */}
      {heads.map((cx, i) => (
        <g key={`h${i}`}>
          <circle cx={cx} cy={52} r={headR} fill={MONSTER} {...hl("head")} />
          {(oneHead ? eyeSpots(cx, counts.eye) : eyeSpots(cx, 2)).map(([x, y], j) => (
            <g key={j}>
              <circle cx={x} cy={y} r={oneHead ? 6.5 : 5} fill="#fff" {...hl("eye")} />
              <circle cx={x} cy={y} r={2.5} fill={INK} />
            </g>
          ))}
          <path d={`M${cx - 8} ${oneHead ? 70 : 62} Q${cx} ${oneHead ? 76 : 67} ${cx + 8} ${oneHead ? 70 : 62}`} fill="none" stroke={INK} strokeWidth={2} />
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Gymbot (U3 story): a white head and a blue body; red arms           */
/* ------------------------------------------------------------------ */

export function Robot() {
  return (
    <svg viewBox="0 0 160 190" className="h-60 w-52" role="img" aria-label="robot with a white head and a blue body">
      <line x1={80} y1={6} x2={80} y2={22} stroke={INK} strokeWidth={3} />
      <circle cx={80} cy={6} r={5} fill="#facc15" stroke={INK} strokeWidth={2} />
      <rect x={52} y={22} width={56} height={44} rx={8} fill="#ffffff" stroke={INK} strokeWidth={3} />
      <circle cx={68} cy={42} r={6} fill={INK} />
      <circle cx={92} cy={42} r={6} fill={INK} />
      <rect x={70} y={54} width={20} height={4} fill={INK} />
      <rect x={42} y={72} width={76} height={66} rx={8} fill="#2563eb" stroke={INK} strokeWidth={3} />
      <rect x={14} y={78} width={26} height={12} rx={5} fill="#dc2626" stroke={INK} strokeWidth={2} />
      <rect x={120} y={78} width={26} height={12} rx={5} fill="#dc2626" stroke={INK} strokeWidth={2} />
      <circle cx={12} cy={84} r={7} fill="#94a3b8" stroke={INK} strokeWidth={2} />
      <circle cx={148} cy={84} r={7} fill="#94a3b8" stroke={INK} strokeWidth={2} />
      <rect x={54} y={138} width={16} height={40} fill="#94a3b8" stroke={INK} strokeWidth={2} />
      <rect x={90} y={138} width={16} height={40} fill="#94a3b8" stroke={INK} strokeWidth={2} />
    </svg>
  );
}

export function RobotHand({ fingers }: { fingers: number }) {
  const w = 14;
  return (
    <svg viewBox="0 0 180 150" className="h-48 w-56" role="img" aria-label={`robot hand with ${fingers} fingers`} data-fingers={fingers}>
      {Array.from({ length: fingers }, (_, i) => (
        <rect key={i} x={22 + i * (w + 4)} y={18 + (i % 2) * 8} width={w} height={60} rx={6} fill="#cbd5e1" stroke={INK} strokeWidth={2} />
      ))}
      <rect x={16} y={70} width={fingers * (w + 4) + 8} height={58} rx={12} fill="#94a3b8" stroke={INK} strokeWidth={3} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Balloons and colour shapes (Welcome unit)                           */
/* ------------------------------------------------------------------ */

export function Balloons({ colours }: { colours: string[] }) {
  const perRow = 5;
  const rows = Math.ceil(colours.length / perRow);
  return (
    <svg viewBox={`0 0 260 ${rows * 110}`} className="w-80 max-w-full" role="img" aria-label="balloons" data-balloons={colours.length}>
      {colours.map((c, i) => {
        const x = 30 + (i % perRow) * 50;
        const y = 10 + Math.floor(i / perRow) * 110;
        return (
          <g key={i}>
            <path d={`M${x} ${y + 64} q -6 14 4 30`} fill="none" stroke="#475569" strokeWidth={2} />
            <ellipse cx={x} cy={y + 32} rx={19} ry={25} fill={c} stroke={INK} strokeWidth={2} />
            <polygon points={`${x - 4},${y + 58} ${x + 4},${y + 58} ${x},${y + 64}`} fill={c} stroke={INK} strokeWidth={1.5} />
            <ellipse cx={x - 7} cy={y + 22} rx={4} ry={7} fill="#fff" opacity={0.6} />
          </g>
        );
      })}
    </svg>
  );
}

const SHAPE_PATH: Record<string, string> = {
  star: "M60 6 L74 44 L114 44 L82 68 L94 108 L60 84 L26 108 L38 68 L6 44 L46 44 Z",
  heart: "M60 104 C10 70 6 40 24 24 C40 10 56 18 60 32 C64 18 80 10 96 24 C114 40 110 70 60 104 Z",
  splash: "M60 8 C70 30 92 10 90 34 C112 30 104 54 112 62 C100 70 112 94 88 92 C86 114 66 100 60 112 C52 100 32 114 30 92 C8 94 20 70 8 62 C18 54 8 30 30 34 C28 10 50 30 60 8 Z",
  balloon: "M60 8 C88 8 100 32 100 52 C100 78 78 96 60 98 C42 96 20 78 20 52 C20 32 32 8 60 8 Z M54 98 L66 98 L60 108 Z",
  crayon: "M14 46 L86 46 L110 60 L86 74 L14 74 Z",
};

export function Swatch({ hex, shape }: { hex: string; shape: string }) {
  return (
    <svg viewBox="0 0 120 116" className="h-44 w-44" role="img" aria-label="colour" data-colour={hex}>
      <path d={SHAPE_PATH[shape] ?? SHAPE_PATH.splash} fill={hex} stroke="#334155" strokeWidth={3} strokeLinejoin="round" />
      {shape === "crayon" && <rect x={14} y={46} width={18} height={28} fill="#fff" opacity={0.5} />}
    </svg>
  );
}

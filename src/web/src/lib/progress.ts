import type { Difficulty, ErrorType } from "@ghaith/game-core";

/**
 * One submission by the child. Stored locally first (works offline); a later task
 * syncs these to the API. No name, voice or image of the child is stored here.
 */
export interface Attempt {
  id: string;
  at: string; // ISO time
  sessionId: string;
  lessonId: string;
  gameId: string;
  skillId: string;
  mechanicId: string;
  generatorId: string;
  generatorVersion: number;
  seed: number;
  difficulty: Difficulty;
  tryNumber: number; // 1 = first try on this item
  correct: boolean;
  errorTypes: ErrorType[];
  hintsUsed: number;
}

export interface SkillSummary {
  skillId: string;
  attempts: number;
  firstTryCorrect: number;
  firstTryTotal: number;
  sessions: number;
  mechanics: number;
  lastAt: string | null;
}

const KEY = "ghaith.attempts.v1";
// In-memory copy per storage (and one for "no storage"), used when storage fails.
const memoryByStorage = new WeakMap<Storage, Attempt[]>();
let memoryNoStorage: Attempt[] = [];

function memoryFor(storage: Storage | undefined): Attempt[] {
  return storage ? memoryByStorage.get(storage) ?? [] : memoryNoStorage;
}

function setMemory(storage: Storage | undefined, list: Attempt[]): void {
  if (storage) memoryByStorage.set(storage, list);
  else memoryNoStorage = list;
}

/** Storage can be missing (private mode, blocked site data) or corrupted; never throw. */
export function loadAttempts(storage: Storage | undefined = safeStorage()): Attempt[] {
  if (!storage) return [...memoryNoStorage];
  try {
    const raw = storage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed as Attempt[];
    preserveCorrupt(storage, raw);
    return [...memoryFor(storage)];
  } catch {
    try {
      preserveCorrupt(storage, storage.getItem(KEY));
    } catch {
      // storage unreadable
    }
    return [...memoryFor(storage)];
  }
}

/** Keep unreadable data under a backup key instead of silently overwriting it. */
function preserveCorrupt(storage: Storage, raw: string | null): void {
  if (!raw) return;
  try {
    storage.setItem(`${KEY}.corrupt-${Date.now()}`, raw);
    storage.removeItem(KEY);
  } catch {
    // best effort
  }
}

export function saveAttempt(attempt: Attempt, storage: Storage | undefined = safeStorage()): void {
  const all = [...loadAttempts(storage), attempt];
  setMemory(storage, all);
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(all));
  } catch {
    // quota or blocked storage: keep the in-memory copy for this session
  }
}

export function summariseBySkill(attempts: Attempt[]): SkillSummary[] {
  const bySkill = new Map<string, Attempt[]>();
  for (const a of attempts) bySkill.set(a.skillId, [...(bySkill.get(a.skillId) ?? []), a]);
  return [...bySkill.entries()].map(([skillId, list]) => {
    const firstTries = list.filter((a) => a.tryNumber === 1);
    return {
      skillId,
      attempts: list.length,
      firstTryCorrect: firstTries.filter((a) => a.correct && a.hintsUsed === 0).length,
      firstTryTotal: firstTries.length,
      sessions: new Set(list.map((a) => a.sessionId)).size,
      mechanics: new Set(list.map((a) => a.mechanicId)).size,
      lastAt: list.reduce<string | null>((max, a) => (max === null || a.at > max ? a.at : max), null),
    };
  });
}

/**
 * Draft mastery rule from the game policy (adjustable, not a diagnosis):
 * independent first-try accuracy >= 80% across >= 2 sessions and >= 2 mechanics,
 * with at least 8 first tries. One good round is never "mastered".
 */
export function masteryStatus(s: SkillSummary): "not_started" | "practising" | "secure_draft" {
  if (s.firstTryTotal === 0) return "not_started";
  const accuracy = s.firstTryCorrect / s.firstTryTotal;
  if (s.firstTryTotal >= 8 && accuracy >= 0.8 && s.sessions >= 2 && s.mechanics >= 2) return "secure_draft";
  return "practising";
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function newSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

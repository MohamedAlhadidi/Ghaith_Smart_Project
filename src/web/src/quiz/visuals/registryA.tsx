/** Visual renderers owned by executor A (number sense, place value & operations), keyed by visual.type. */
import type { VisualRenderer } from "../types";
import { BalancePans, CompareSentence, DecadeMidpoint, DecadeStrip, DigitSentence, EquivalenceMachine, LoopCard, OddOneOutCards, RangeBags, SentenceCard } from "./A_cards";
import { HundredPattern } from "./A_hundred";
import { RoundLine, TickLine } from "./A_numberLine";
import { BaseTenBlocks, DifferenceRows, DigitGroup, EstimateDots, ScatterCount } from "./A_objects";

export const VISUALS_A: Record<string, VisualRenderer> = {
  hundredPattern: HundredPattern,
  decadeStrip: DecadeStrip,
  decadeMidpoint: DecadeMidpoint,
  scatterCount: ScatterCount,
  rangeBags: RangeBags,
  tickLine: TickLine,
  roundLine: RoundLine,
  digitGroup: DigitGroup,
  equivalenceMachine: EquivalenceMachine,
  balancePans: BalancePans,
  baseTenBlocks: BaseTenBlocks,
  compareSentence: CompareSentence,
  digitSentence: DigitSentence,
  estimateDots: EstimateDots,
  oddOneOutCards: OddOneOutCards,
  sentenceCard: SentenceCard,
  loopCard: LoopCard,
  differenceRows: DifferenceRows,
};

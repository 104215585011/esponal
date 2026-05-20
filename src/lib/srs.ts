import {
  Rating,
  State,
  createEmptyCard,
  fsrs as createFsrs,
  generatorParameters,
  type Card
} from "ts-fsrs";

export type ReviewRating = "Again" | "Hard" | "Good" | "Easy";

export type SrsCardData = {
  srsState: string;
  srsDue: Date;
  srsStability: number;
  srsDifficulty: number;
  srsElapsedDays: number;
  srsScheduledDays: number;
  srsReps: number;
  srsLapses: number;
  srsLastReview: Date | null;
};

export const fsrs = createFsrs(generatorParameters());

const ratingMap: Record<ReviewRating, Rating> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy
};

const stateName = (state: State) => State[state];

function toSrsCard(card: Card): SrsCardData {
  return {
    srsState: stateName(card.state),
    srsDue: card.due,
    srsStability: card.stability,
    srsDifficulty: card.difficulty,
    srsElapsedDays: card.elapsed_days,
    srsScheduledDays: card.scheduled_days,
    srsReps: card.reps,
    srsLapses: card.lapses,
    srsLastReview: card.last_review ?? null
  };
}

export function initCard(now = new Date()): SrsCardData {
  return toSrsCard(createEmptyCard(now));
}

export function toFsrsCard(input: Partial<SrsCardData>, now = new Date()): Card {
  if (!input.srsState || !input.srsDue) {
    return createEmptyCard(now);
  }

  const state = State[input.srsState as keyof typeof State];
  if (typeof state !== "number") {
    return createEmptyCard(now);
  }

  return {
    due: input.srsDue,
    stability: input.srsStability ?? 0,
    difficulty: input.srsDifficulty ?? 0,
    elapsed_days: input.srsElapsedDays ?? 0,
    scheduled_days: input.srsScheduledDays ?? 0,
    learning_steps: 0,
    reps: input.srsReps ?? 0,
    lapses: input.srsLapses ?? 0,
    state,
    last_review: input.srsLastReview ?? undefined
  };
}

export function scheduleCard(
  card: Partial<SrsCardData>,
  rating: ReviewRating,
  now = new Date()
): SrsCardData {
  const grade = ratingMap[rating];
  if (!grade) {
    throw new Error(`Invalid SRS rating: ${rating}`);
  }

  const next = fsrs.next(toFsrsCard(card, now), now, grade).card;
  return toSrsCard(next);
}

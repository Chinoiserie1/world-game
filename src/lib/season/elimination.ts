import type { SurvivalRule } from "@/lib/games/types";

export interface RoundResult {
  readonly address: string;
  readonly score: number;
  readonly choice: string | null;
}

export interface EliminationOutcome {
  readonly survivors: readonly string[];
  readonly eliminated: readonly string[];
}

function byThreshold(results: readonly RoundResult[], minScore: number): Set<string> {
  return new Set(results.filter((r) => r.score >= minScore).map((r) => r.address));
}

function byTopPercent(results: readonly RoundResult[], percent: number): Set<string> {
  if (results.length === 0) return new Set();
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const keep = Math.max(1, Math.ceil((sorted.length * percent) / 100));
  const cutScore = sorted[keep - 1].score;
  return new Set(sorted.filter((r) => r.score >= cutScore).map((r) => r.address));
}

function byMinority(results: readonly RoundResult[]): Set<string> {
  const voters = results.filter((r) => r.choice !== null);
  const counts = voters.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.choice!]: (acc[r.choice!] ?? 0) + 1 }),
    {},
  );
  const sizes = Object.values(counts);
  const everyoneTied = sizes.length < 2 || sizes.every((n) => n === sizes[0]);
  if (everyoneTied) return new Set(voters.map((r) => r.address));
  const smallest = Math.min(...sizes);
  return new Set(voters.filter((r) => counts[r.choice!] === smallest).map((r) => r.address));
}

/**
 * Decide who survives a weekly round. Only players alive at the start of the
 * round and with a finished play are eligible; everyone else is eliminated.
 */
export function decideSurvivors(
  rule: SurvivalRule,
  aliveAddresses: readonly string[],
  results: readonly RoundResult[],
): EliminationOutcome {
  const alive = new Set(aliveAddresses);
  const eligible = results.filter((r) => alive.has(r.address));

  const kept =
    rule.type === "threshold"
      ? byThreshold(eligible, rule.minScore)
      : rule.type === "top-percent"
        ? byTopPercent(eligible, rule.percent)
        : byMinority(eligible);

  return {
    survivors: aliveAddresses.filter((a) => kept.has(a)),
    eliminated: aliveAddresses.filter((a) => !kept.has(a)),
  };
}

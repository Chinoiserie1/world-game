export interface PrizeSplit {
  readonly perWinner: bigint;
  /** Dust that cannot be split evenly; stays in the pool for the next season. */
  readonly remainder: bigint;
}

/** Splits the pool (USDC base units, 6 decimals) evenly among winners. */
export function splitPrize(poolUnits: bigint, winners: number): PrizeSplit {
  if (poolUnits < BigInt(0)) throw new RangeError("Pool cannot be negative");
  if (winners <= 0) return { perWinner: BigInt(0), remainder: poolUnits };
  const count = BigInt(winners);
  return { perWinner: poolUnits / count, remainder: poolUnits % count };
}

export const USDC_DECIMALS = 6;

export function usdcToUnits(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!match) throw new RangeError(`Invalid USDC amount: ${amount}`);
  const [, whole, frac = ""] = match;
  return BigInt(whole) * BigInt(10 ** USDC_DECIMALS) + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

export function formatUsdc(units: bigint): string {
  const base = BigInt(10 ** USDC_DECIMALS);
  const whole = units / base;
  const frac = (units % base).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : whole.toString();
}

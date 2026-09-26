import { createHash, createHmac } from "node:crypto";

/**
 * Deterministic, provably-fair randomness.
 *
 * The server derives a secret seed per play, publishes `commitment = sha256(seed)`
 * before the player acts, and reveals the seed once the play is finished so
 * anyone can recompute the board / house moves and check nothing was changed.
 */

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function deriveSeed(secret: string, playId: string): string {
  return createHmac("sha256", secret).update(`play:${playId}`).digest("hex");
}

export function commitmentFor(seed: string): string {
  return sha256Hex(seed);
}

/** Returns an integer in [0, max) derived from (seed, label). */
export function randomInt(seed: string, label: string, max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError(`max must be a positive integer, got ${max}`);
  }
  const digest = createHmac("sha256", seed).update(label).digest();
  // 48 bits is plenty for board sizes and keeps modulo bias negligible.
  const value = digest.readUIntBE(0, 6);
  return value % max;
}

/** Fisher–Yates shuffle driven by the seed; returns a new array. */
export function seededShuffle<T>(seed: string, label: string, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(seed, `${label}:${i}`, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

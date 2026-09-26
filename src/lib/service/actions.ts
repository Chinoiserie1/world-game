/** World ID action for season entry — must exist in the Developer Portal. */
export function entryActionFor(seasonId: number): string {
  return `world-game-s${seasonId}-entry`;
}

import type { z } from "zod";
import { GameError } from "./types";

export function parseWith<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new GameError(`Invalid move: ${result.error.issues[0]?.message ?? "bad input"}`);
  }
  return result.data;
}

import type { Db } from "@/lib/db/client";
import type { VerifyContext } from "@/lib/worldid/verify";

export interface ServiceDeps {
  readonly db: Db;
  readonly now: () => number;
  readonly newId: () => string;
  readonly seasonId: number;
  readonly entryFeeUnits: bigint;
  readonly prizePoolAddress: string;
  readonly gameSecret: string;
  readonly worldId: VerifyContext;
  readonly demoMode: boolean;
}

export type ServiceErrorCode =
  | "unauthorized"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid"
  | "pending"
  | "unavailable"
  | "rate_limited";

const STATUS: Record<ServiceErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid: 400,
  pending: 202,
  unavailable: 503,
  rate_limited: 429,
};

/** Business-rule failure with a user-facing message and an HTTP status. */
export class ServiceError extends Error {
  readonly status: number;
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = "ServiceError";
    this.status = STATUS[code];
  }
}

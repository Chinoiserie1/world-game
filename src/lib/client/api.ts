import type { SeasonOverview } from "@/lib/service/overview";

export interface SeasonResponse extends SeasonOverview {
  readonly viewer: string | null;
  readonly config: {
    appId: `app_${string}`;
    rpId: string;
    environment: "production" | "staging" | "sandbox";
    prizePoolAddress: string;
    demoMode: boolean;
  };
}

export type PlayView = NonNullable<NonNullable<SeasonOverview["me"]>["play"]>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code?: string;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError("Network error — check your connection", 0, "network");
  }
  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!envelope) throw new ApiError("Unexpected server response", response.status, "bad_response");
  if (!envelope.success || envelope.data === null) {
    throw new ApiError(envelope.error ?? "Request failed", response.status, envelope.code);
  }
  return envelope.data;
}

/** GET one of our API routes and unwrap the { success, data, error } envelope. */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

/** POST JSON to one of our API routes and unwrap the envelope. */
export function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

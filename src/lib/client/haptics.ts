import { MiniKit } from "@worldcoin/minikit-js";
import { inWorldApp } from "./world-app";

type Feel = "success" | "error" | "warning" | "tap";

/** Best-effort haptic feedback inside World App; silently no-op elsewhere. */
export function feel(kind: Feel): void {
  if (!inWorldApp()) return;
  const options =
    kind === "tap"
      ? ({ hapticsType: "selection-changed" } as const)
      : ({ hapticsType: "notification", style: kind } as const);
  MiniKit.sendHapticFeedback(options).catch(() => undefined);
}

/** True when running inside the World App webview (no console noise, unlike MiniKit.isInstalled()). */
export function inWorldApp(): boolean {
  return typeof window !== "undefined" && "WorldApp" in window && Boolean((window as { WorldApp?: unknown }).WorldApp);
}

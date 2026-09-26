"use client";

import { useEffect, useState } from "react";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Shows the pre-game commitment and, once revealed, checks sha256(seed) === commitment in the browser. */
export function Fairness({ commitment, seed }: { commitment: string; seed: string | null }) {
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (seed) sha256Hex(seed).then((h) => !cancelled && setValid(h === commitment));
    return () => {
      cancelled = true;
    };
  }, [seed, commitment]);

  return (
    <details className="rounded-2xl border border-line bg-bg/60 px-4 py-3 text-xs">
      <summary className="cursor-pointer font-mono uppercase tracking-wider text-muted">
        Provably fair {seed ? (valid ? "· verified ✓" : valid === false ? "· MISMATCH ✗" : "") : "· committed"}
      </summary>
      <div className="mt-2 space-y-1 break-all font-mono text-muted">
        <p>
          <span className="text-ink">commit</span> {commitment}
        </p>
        {seed ? (
          <p>
            <span className="text-ink">seed</span> {seed}
          </p>
        ) : (
          <p>The seed is revealed when your game ends: sha256(seed) must equal the commit.</p>
        )}
      </div>
    </details>
  );
}

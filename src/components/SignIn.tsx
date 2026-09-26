"use client";

import { MiniKit } from "@worldcoin/minikit-js";
import { useSyncExternalStore, useState } from "react";
import { inWorldApp } from "@/lib/client/world-app";
import { apiGet, apiPost, errorMessage } from "@/lib/client/api";
import { Button, ErrorNote } from "./ui";

interface Props {
  readonly demoMode: boolean;
  readonly onSignedIn: () => void;
}

const noopSubscribe = () => () => undefined;

/** Wallet sign-in via MiniKit walletAuth (SIWE), verified on our backend. */
export function SignIn({ demoMode, onSignedIn }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWorldApp = useSyncExternalStore(noopSubscribe, inWorldApp, () => false);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const { nonce } = await apiGet<{ nonce: string }>("/api/auth/nonce");
      const result = await MiniKit.walletAuth({
        nonce,
        statement: "Sign in to World Game",
        expirationTime: new Date(Date.now() + 60 * 60 * 1000),
      });
      if (result.executedWith === "fallback") throw new Error("Open World Game in World App to sign in");
      await apiPost("/api/auth/siwe", { payload: result.data });
      onSignedIn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/auth/demo");
      onSignedIn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button busy={busy} onClick={signIn} disabled={!isWorldApp && !demoMode}>
        Sign in with World App
      </Button>
      {!isWorldApp && (
        <p className="text-center text-sm text-muted">
          World Game is a mini app — open it in World App.
        </p>
      )}
      {demoMode && (
        <Button tone="ghost" busy={busy} onClick={demo}>
          Try the demo
        </Button>
      )}
      <ErrorNote message={error} />
    </div>
  );
}

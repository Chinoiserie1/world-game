"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, errorMessage, type SeasonResponse } from "@/lib/client/api";
import { Header } from "./Header";
import { PlayerPanel } from "./PlayerPanel";
import { Schedule } from "./Schedule";
import { SignIn } from "./SignIn";
import { TopUp } from "./TopUp";
import { TrustMoments } from "./TrustMoments";
import { inWorldApp } from "@/lib/client/world-app";
import { Card, ErrorNote, Eyebrow } from "./ui";

export function GameApp() {
  const [data, setData] = useState<SeasonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await apiGet<SeasonResponse>("/api/season"));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    // Initial load; the state updates happen after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
        {error ? <ErrorNote message={error} /> : <p className="text-center font-mono text-muted">Loading…</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <Header data={data} />
      <ErrorNote message={error} />
      {data.viewer ? (
        <PlayerPanel data={data} viewer={data.viewer} refresh={refresh} />
      ) : (
        <Card>
          <Eyebrow>Season {data.season.id}</Eyebrow>
          <h2 className="font-display mb-1 mt-2 text-3xl leading-tight">4 weeks. 4 games. Who&apos;s left standing?</h2>
          <p className="mb-4 text-sm text-muted">
            Pay a small USDC ticket, survive one mini-game per week, and split the prize pool with the last humans
            standing.
          </p>
          <SignIn demoMode={data.config.demoMode} onSignedIn={refresh} />
        </Card>
      )}
      {data.viewer && (
        <TopUp data={data} demo={data.config.demoMode && !inWorldApp()} refresh={refresh} />
      )}
      <Schedule rounds={data.rounds} />
      <TrustMoments />
    </main>
  );
}

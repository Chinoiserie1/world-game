"use client";

import { useState } from "react";
import { Button, Card, ErrorNote, Eyebrow } from "@/components/ui";

type Action = "open" | "close";

/** Game Master console: open the next weekly game, or close it and run eliminations. */
export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [minutes, setMinutes] = useState(60 * 24 * 7);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function run(action: Action) {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/round", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ action, durationMinutes: minutes }),
      });
      const body = (await response.json()) as { success: boolean; data: unknown; error: string | null };
      if (!body.success) throw new Error(body.error ?? "Failed");
      setResult(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="font-display text-2xl">Game Master</h1>
      <Card className="space-y-4">
        <label className="block space-y-1">
          <Eyebrow>Admin secret</Eyebrow>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2 font-mono"
          />
        </label>
        <label className="block space-y-1">
          <Eyebrow>Game duration (minutes)</Eyebrow>
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2 font-mono"
          />
        </label>
        <Button tone="teal" busy={busy === "open"} onClick={() => run("open")}>
          Open next game
        </Button>
        <Button tone="pink" busy={busy === "close"} onClick={() => run("close")}>
          Close &amp; eliminate
        </Button>
        <ErrorNote message={error} />
      </Card>
      {result !== null && (
        <pre className="overflow-x-auto rounded-2xl border border-line bg-panel p-4 text-xs">{JSON.stringify(result, null, 2)}</pre>
      )}
    </main>
  );
}

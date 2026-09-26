"use client";

import { useState } from "react";
import { apiPost, errorMessage, type SeasonResponse } from "@/lib/client/api";
import { formatUsdc } from "@/lib/season/prize";
import { GameBoard } from "./GameBoard";
import { PayEntry } from "./PayEntry";
import { WorldIdEntry } from "./WorldIdEntry";
import { WorldIdSession } from "./WorldIdSession";
import { Button, Card, ErrorNote, Eyebrow, Pill } from "./ui";

interface Props {
  readonly data: SeasonResponse;
  readonly viewer: string;
  readonly refresh: () => void;
}

type Me = NonNullable<SeasonResponse["me"]>;

function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Unique human", "Identity locked", "Ticket paid"];
  return (
    <ol className="mb-4 grid grid-cols-3 gap-2">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "text-teal border-teal/50" : n === current ? "text-pink border-pink" : "text-muted border-line";
        return (
          <li key={label} className={`rounded-xl border px-2 py-2 text-center ${state}`}>
            <p className="font-display text-lg">{n < current ? "✓" : n}</p>
            <p className="font-mono text-[10px] uppercase leading-tight">{label}</p>
          </li>
        );
      })}
    </ol>
  );
}

function DemoAction({ path, label, onDone }: { path: string; label: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        tone="ghost"
        busy={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await apiPost(path);
            onDone();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      <ErrorNote message={error} />
    </div>
  );
}

function Registration({ data, viewer, refresh }: Props) {
  if (data.season.status !== "registration") {
    return (
      <Card>
        <Eyebrow>Registrations closed</Eyebrow>
        <p className="mt-2">This season has already started. Come back for the next one — or sponsor the pool below!</p>
      </Card>
    );
  }
  return (
    <Card>
      <Steps current={1} />
      <h2 className="font-display text-2xl">One human, one seat.</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        World ID proves you&apos;re a unique person without revealing who you are. Nobody can buy extra lives with
        extra accounts.
      </p>
      <WorldIdEntry address={viewer} onVerified={refresh} />
      {data.config.demoMode && (
        <div className="mt-3">
          <DemoAction path="/api/demo/verify" label="Demo: simulate World ID" onDone={refresh} />
        </div>
      )}
    </Card>
  );
}

function Enrollment({ data, me, refresh }: { data: SeasonResponse; me: Me; refresh: () => void }) {
  if (!me.hasSession) {
    return (
      <Card>
        <Steps current={2} />
        <h2 className="font-display text-2xl">Lock your identity.</h2>
        <p className="mb-4 mt-1 text-sm text-muted">
          We bind a World ID session to your seat. Every week, before you can be eliminated or win, you&apos;ll prove
          it&apos;s still <em>you</em> — not a bot, not a sold account.
        </p>
        <WorldIdSession endpoint="/api/world-id/lock" sessionId={null} label="Create my World ID session" onDone={refresh} />
      </Card>
    );
  }
  return (
    <Card>
      <Steps current={3} />
      <h2 className="font-display text-2xl">Enter the arena.</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Your ticket goes straight into the on-chain prize pool on World Chain. The last survivors split it.
      </p>
      <PayEntry feeUnits={data.season.entryFeeUnits} demo={me.assurance === "demo"} onEntered={refresh} />
    </Card>
  );
}

function Alive({ data, me, refresh }: { data: SeasonResponse; me: Me; refresh: () => void }) {
  const round = data.rounds.find((r) => r.status === "open");
  if (!round) {
    const survived = data.rounds.filter((r) => r.status === "closed").length;
    return (
      <Card>
        <Pill tone="teal">Alive</Pill>
        <h2 className="font-display mt-3 text-2xl">{survived === 0 ? "You're in." : `You survived week ${survived}.`}</h2>
        <p className="mt-1 text-sm text-muted">The next game opens soon. Come back when it starts!</p>
      </Card>
    );
  }

  const closesAt = round.closesAt
    ? new Date(round.closesAt).toLocaleString("en-US", { weekday: "long", hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow>Week {round.number} · closes {closesAt}</Eyebrow>
        <Pill tone="pink">Live</Pill>
      </div>
      <h2 className="font-display mt-2 text-2xl">{round.title}</h2>
      <ul className="mb-4 mt-2 space-y-1 text-sm text-muted">
        {round.rules.map((rule) => (
          <li key={rule}>· {rule}</li>
        ))}
      </ul>
      {me.checkpointPassed ? (
        <GameBoard key={round.id} initial={me.play} onChange={refresh} />
      ) : me.assurance === "demo" ? (
        <DemoAction path="/api/demo/checkpoint" label="Demo: pass the checkpoint" onDone={refresh} />
      ) : (
        <div className="space-y-2">
          <p className="rounded-xl bg-panel-2 px-3 py-2 text-sm">
            🛂 <strong>Identity checkpoint</strong> — prove you&apos;re the same human who entered the season.
          </p>
          <WorldIdSession endpoint="/api/world-id/checkpoint" sessionId={me.sessionId} label="Pass the checkpoint" tone="pink" onDone={refresh} />
        </div>
      )}
    </Card>
  );
}

function Winner({ me, refresh }: { me: Me; refresh: () => void }) {
  const prize = formatUsdc(BigInt(me.claim?.amountUnits ?? me.prizeUnits ?? "0"));
  return (
    <Card className="border-gold/50 text-center">
      <p className="text-5xl">🏆</p>
      <h2 className="font-display mt-2 text-3xl text-gold">Last one standing.</h2>
      <p className="mt-1 text-muted">
        Your share of the pool: <span className="text-ink">{prize} USDC</span>
      </p>
      <div className="mt-4">
        {me.claim ? (
          <p className="font-mono text-sm text-teal">
            {me.claim.status === "paid" ? `Paid ✓ ${me.claim.txHash?.slice(0, 10)}…` : "Claimed — payout in progress"}
          </p>
        ) : me.assurance === "demo" ? (
          <DemoAction path="/api/claim" label="Claim (demo)" onDone={refresh} />
        ) : (
          <WorldIdSession endpoint="/api/claim" sessionId={me.sessionId} label="Prove it's me & claim" tone="gold" onDone={refresh} />
        )}
      </div>
    </Card>
  );
}

export function PlayerPanel({ data, viewer, refresh }: Props) {
  const me = data.me;
  if (!me) return <Registration data={data} viewer={viewer} refresh={refresh} />;
  if (me.status === "verified") return <Enrollment data={data} me={me} refresh={refresh} />;
  if (me.status === "alive") return <Alive data={data} me={me} refresh={refresh} />;
  if (me.status === "winner") return <Winner me={me} refresh={refresh} />;
  return (
    <Card className="border-pink/40 text-center">
      <p className="font-display text-6xl text-pink">✕</p>
      <h2 className="font-display mt-2 text-2xl">Eliminated in week {me.eliminatedRound}.</h2>
      <p className="mt-1 text-sm text-muted">Thanks for playing. The next season is waiting for you.</p>
    </Card>
  );
}

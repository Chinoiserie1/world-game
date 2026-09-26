import type { SeasonResponse } from "@/lib/client/api";
import { Card, Eyebrow, Pill } from "./ui";

const STATUS = {
  upcoming: { label: "Upcoming", tone: "muted" },
  open: { label: "Live", tone: "pink" },
  closed: { label: "Done", tone: "teal" },
} as const;

export function Schedule({ rounds }: { rounds: SeasonResponse["rounds"] }) {
  return (
    <Card>
      <Eyebrow>Season schedule</Eyebrow>
      <ol className="mt-3 space-y-3">
        {rounds.map((round) => {
          const status = STATUS[round.status as keyof typeof STATUS] ?? STATUS.upcoming;
          return (
            <li key={round.id} className="flex items-start gap-3">
              <span className="font-display mt-0.5 w-12 shrink-0 text-sm text-muted">W{round.number}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display truncate text-base">{round.title}</p>
                  <Pill tone={status.tone}>{status.label}</Pill>
                </div>
                <p className="text-sm text-muted">{round.tagline}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

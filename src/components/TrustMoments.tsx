import { Card, Eyebrow } from "./ui";

const MOMENTS = [
  {
    icon: "○",
    title: "At entry — uniqueness",
    text: "An Orb-verified World ID proof tied to your wallet, one per human per season. No multi-accounting to buy extra lives.",
  },
  {
    icon: "△",
    title: "Every week — continuity",
    text: "Before each elimination you re-prove your World ID session: the same human is playing, not a bot or a sold account.",
  },
  {
    icon: "□",
    title: "At payout — same human",
    text: "The winner proves their session one last time before the prize pool pays out on-chain.",
  },
] as const;

export function TrustMoments() {
  return (
    <Card>
      <Eyebrow>Why World ID</Eyebrow>
      <ul className="mt-3 space-y-4">
        {MOMENTS.map((m) => (
          <li key={m.title} className="flex gap-3">
            <span className="font-display text-2xl text-pink">{m.icon}</span>
            <div>
              <p className="font-display">{m.title}</p>
              <p className="text-sm text-muted">{m.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

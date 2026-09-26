"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "pink" | "teal" | "ghost" | "gold";

const TONES: Record<Tone, string> = {
  pink: "bg-pink text-white shadow-[0_6px_0_#a3134d] active:translate-y-[3px] active:shadow-[0_3px_0_#a3134d]",
  teal: "bg-teal text-black shadow-[0_6px_0_#0c7f60] active:translate-y-[3px] active:shadow-[0_3px_0_#0c7f60]",
  gold: "bg-gold text-black shadow-[0_6px_0_#9c7a17] active:translate-y-[3px] active:shadow-[0_3px_0_#9c7a17]",
  ghost: "border border-line bg-panel-2 text-ink active:bg-panel",
};

export function Button({
  tone = "pink",
  busy = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`font-display w-full rounded-2xl px-5 py-4 text-lg font-bold uppercase tracking-wide transition disabled:opacity-50 ${TONES[tone]} ${className}`}
    >
      {busy ? "…" : children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-panel p-5 ${className}`}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{children}</p>;
}

/** ○ △ □ — the game's visual signature. */
export function Shapes({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1.5 L12.8 12 H1.2 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
      <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1.5" y="1.5" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
    </span>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="animate-shake rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "teal" | "pink" | "gold" }) {
  const tones = {
    muted: "border-line text-muted",
    teal: "border-teal/40 text-teal",
    pink: "border-pink/40 text-pink",
    gold: "border-gold/40 text-gold",
  } as const;
  return <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase ${tones[tone]}`}>{children}</span>;
}

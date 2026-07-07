import React from "react";

// Deterministic pseudo-waveform amplitudes from a text seed, so the same
// message always renders the same "audio sample".
function seededAmps(seed: string, n: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const amps: number[] = [];
  for (let i = 0; i < n; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r = ((h >>> 0) % 1000) / 1000;
    // Quiet edges with bursts in the middle, like a recorded utterance
    const envelope = Math.pow(Math.sin((i / (n - 1)) * Math.PI), 0.55);
    amps.push(Math.max(0.05, r * envelope));
  }
  return amps;
}

export type WaveformVariant = "ink" | "spectral" | "dim";

function barColor(variant: WaveformVariant, amp: number): string {
  switch (variant) {
    case "ink":
      return "#1c2b52";
    case "dim":
      return "#5d77c4";
    case "spectral":
      // Loud = hot (red/orange), quiet = cool (blue) — heatmap feel
      return `hsl(${Math.round(225 - amp * 225)}, 88%, 52%)`;
  }
}

interface WaveformProps {
  seed: string;
  variant?: WaveformVariant;
  bars?: number;
  className?: string;
}

export function Waveform({
  seed,
  variant = "ink",
  bars = 72,
  className = "",
}: WaveformProps) {
  const amps = seededAmps(seed || "…", bars);
  const H = 32;
  return (
    <svg
      viewBox={`0 0 ${bars * 3} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <line
        x1="0"
        y1={H / 2}
        x2={bars * 3}
        y2={H / 2}
        stroke={variant === "dim" ? "#33415f" : "#94a3bf"}
        strokeWidth="0.5"
      />
      {amps.map((a, i) => (
        <rect
          key={i}
          x={i * 3}
          y={H / 2 - a * (H / 2 - 1)}
          width={1.8}
          height={Math.max(1, a * (H - 2))}
          fill={barColor(variant, a)}
        />
      ))}
    </svg>
  );
}

// Small animated "equalizer" in spectrogram colors — used as the
// translating/thinking indicator.
export function SpectralBars({ className = "" }: { className?: string }) {
  const COLORS = [
    "#2b5bd7",
    "#2b8fd7",
    "#2bc0c9",
    "#3bc96b",
    "#a8d23a",
    "#f0c62f",
    "#f08c2f",
    "#e2472f",
  ];
  return (
    <div className={`flex h-5 items-center gap-[2px] ${className}`}>
      {COLORS.map((c, i) => (
        <div
          key={i}
          className="hm-eq-bar h-full w-[3px] rounded-sm"
          style={{ backgroundColor: c, animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

"use client";

import { formatDate } from "@/lib/utils";

interface Point {
  date: string;
  weight?: number;
  bmi?: number;
}

export function WeightChart({ data, locale }: { data: Point[]; locale: string }) {
  const weights = data.map((d) => d.weight!).filter((w) => w != null);
  if (weights.length < 2) return null;

  const W = 560;
  const H = 180;
  const pad = { l: 36, r: 12, t: 16, b: 28 };
  const min = Math.min(...weights) - 1;
  const max = Math.max(...weights) + 1;
  const x = (i: number) =>
    pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
  const y = (w: number) =>
    pad.t + (1 - (w - min) / (max - min)) * (H - pad.t - pad.b);

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.weight!)}`)
    .join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1)} ${H - pad.b} L ${x(0)} ${H - pad.b} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#66BB6A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#66BB6A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* gridlines */}
      {[min, (min + max) / 2, max].map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#E5E7EB" strokeWidth="1" />
          <text x={4} y={y(v) + 3} fontSize="9" fill="#9CA3AF">
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="url(#wg)" />
      <path d={linePath} fill="none" stroke="#2E7D32" strokeWidth="2" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.weight!)} r="3.5" fill="#2E7D32" />
          <text x={x(i)} y={H - 10} fontSize="9" fill="#6B7280" textAnchor="middle">
            {formatDate(d.date, locale, { month: "short", day: "2-digit" })}
          </text>
        </g>
      ))}
    </svg>
  );
}

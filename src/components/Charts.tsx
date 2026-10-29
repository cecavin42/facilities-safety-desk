"use client";

import { useState } from "react";

// Validated categorical slots 1-4 (light surface); fixed order, never cycled.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

export type Stack = { label: string; values: number[] };

export function Legend({ names }: { names: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
      {names.map((n, i) => (
        <li key={n} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />
          {n}
        </li>
      ))}
    </ul>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="no-print mt-3 text-sm">
      <summary className="cursor-pointer text-xs text-teal-800">Show as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>{head.map((h) => <th key={h} className="px-2 py-1 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={String(r[0])}>{r.map((c, i) => <td key={i} className="px-2 py-1 tabular-nums">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function StackedColumns({ data, names, height = 180 }: { data: Stack[]; names: string[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.values.reduce((a, b) => a + b, 0)));
  const h = hover !== null ? data[hover] : null;
  return (
    <div>
      <div className="mb-2 flex min-h-5 flex-wrap items-center justify-between gap-2">
        {names.length > 1 ? <Legend names={names} /> : <span />}
        <p className="text-xs text-slate-700" aria-live="polite">
          {h
            ? `${h.label}: ${h.values.reduce((a, b) => a + b, 0)} total` +
              (names.length > 1 ? " (" + names.map((n, i) => `${n} ${h.values[i]}`).join(", ") + ")" : "")
            : "Hover a column for details"}
        </p>
      </div>
      <div className="relative flex items-end gap-1 border-b border-slate-300" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const total = d.values.reduce((a, b) => a + b, 0);
          return (
            <div key={d.label} className="flex h-full flex-1 cursor-default flex-col justify-end" onMouseEnter={() => setHover(i)}>
              <div className={`flex flex-col-reverse gap-[2px] ${hover === i ? "opacity-100" : hover === null ? "opacity-100" : "opacity-60"}`} style={{ height: `${(total / max) * 100}%` }}>
                {d.values.map((v, s) =>
                  v > 0 ? (
                    <div key={s} className={s === d.values.findLastIndex((x) => x > 0) ? "rounded-t-[4px]" : ""} style={{ flexGrow: v, background: SERIES[s], minHeight: 2 }} />
                  ) : null,
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => (
          <div key={d.label} className="flex-1 truncate text-center text-[10px] text-slate-500">
            {data.length > 14 && i % 2 ? "" : d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2 text-xs" title={`${d.label}: ${d.value}`}>
          <span className="truncate text-slate-700">{d.label}</span>
          <span className="h-3.5">
            <span className="block h-full rounded-r-[4px]" style={{ width: `${(d.value / max) * 100}%`, background: SERIES[0], minWidth: d.value ? 2 : 0 }} />
          </span>
          <span className="text-right tabular-nums text-slate-700">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

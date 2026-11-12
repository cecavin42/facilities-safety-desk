"use client";
import { useState } from "react";
export const SERIES = ["#2477c5", "#c35d28", "#128463", "#ab7400"];
export type Stack = { label: string; values: number[] };
export function Legend({ names }: { names: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700">
      {names.map((name, i) => (
        <li key={name} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-sm"
            style={{ background: SERIES[i] }}
          />
          {name}
        </li>
      ))}
    </ul>
  );
}
export function DataTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="mt-4 rounded-lg border border-slate-200">
      <summary className="min-h-11 cursor-pointer p-3 text-sm font-semibold text-teal-800">
        View exact values as a table
      </summary>
      <div
        className="data-table-scroll overflow-x-auto p-3"
        tabIndex={0}
        aria-label="Scrollable chart data"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              {head.map((h) => (
                <th scope="col" key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="p-2 tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
export function StackedColumns({
  data,
  names,
  height = 180,
  unit = "records",
}: {
  data: Stack[];
  names: string[];
  height?: number;
  unit?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = Math.max(
    1,
    ...data.map((d) => d.values.reduce((a, b) => a + b, 0)),
  );
  const current = data.find((d) => d.label === selected);
  return (
    <div className="min-w-0">
      <Legend names={names} />
      <p
        className="chart-instructions my-3 min-h-10 text-xs leading-5 text-slate-600"
        role="status"
      >
        {current
          ? `${current.label}: ${names.map((n, i) => `${n} ${current.values[i]}`).join(" · ")}`
          : "Select, focus, or hover a column to inspect counts. Scroll the chart to see every period."}
      </p>
      <p className="mb-2 text-xs text-slate-500">
        Scale: 0–{max} {unit}
      </p>
      <div
        className="chart-scroll max-w-full overflow-x-auto pb-2"
        role="group"
        aria-label="Interactive time-series chart"
      >
        <div className="flex gap-2" style={{ minWidth: data.length * 48 }}>
          {data.map((d) => {
            const total = d.values.reduce((a, b) => a + b, 0);
            return (
              <button
                type="button"
                key={d.label}
                onMouseEnter={() => setSelected(d.label)}
                onFocus={() => setSelected(d.label)}
                onClick={() => setSelected(d.label)}
                aria-label={`${d.label}: ${names.map((n, i) => `${n} ${d.values[i]}`).join(", ")}`}
                className={`flex min-w-10 flex-1 flex-col rounded px-1 focus-visible:outline-2 focus-visible:outline-teal-700 ${selected === d.label ? "bg-teal-50" : "hover:bg-slate-50"}`}
              >
                <span
                  className="chart-column flex w-full items-end border-b border-slate-300"
                  style={{ height }}
                >
                  <span
                    className="flex w-full flex-col-reverse overflow-hidden rounded-t"
                    style={{ height: `${(total / max) * 100}%` }}
                  >
                    {d.values.map((v, i) => (
                      <span
                        key={i}
                        style={{ flexGrow: v, background: SERIES[i] }}
                      />
                    ))}
                  </span>
                </span>
                <span className="mt-2 whitespace-nowrap text-[11px] text-slate-600">
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
export function HorizontalBars({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li
          key={d.label}
          className="grid grid-cols-[minmax(0,1fr)_5rem_2rem] items-center gap-3 text-sm"
        >
          <span className="text-slate-700">{d.label}</span>
          <span
            aria-hidden="true"
            className="h-3 overflow-hidden rounded bg-slate-100"
          >
            <span
              className="block h-full rounded bg-teal-700"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums">
            {d.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

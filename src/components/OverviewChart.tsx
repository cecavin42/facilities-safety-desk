import type { IncidentRecord } from "@/lib/options";
export default function OverviewChart({
  records,
}: {
  records: IncidentRecord[];
}) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1),
    );
    const key = d.toISOString().slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      value: records.filter((r) => r.eventDate.startsWith(key)).length,
    };
  });
  const max = Math.max(
    4,
    Math.ceil(Math.max(...months.map((m) => m.value)) / 4) * 4,
  );
  const points = months.map(
    (m, i) => `${i * 120 + 20},${160 - (m.value / max) * 140}`,
  );
  const line = `M ${points.join(" L ")}`;
  return (
    <div className="overview-chart">
      <div className="chart-y-axis">
        {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="chart-plot">
        <svg
          viewBox="0 0 640 180"
          preserveAspectRatio="none"
          role="img"
          aria-label={months
            .map((m) => `${m.label}: ${m.value} reports`)
            .join("; ")}
        >
          <defs>
            <linearGradient id="report-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#199c88" stopOpacity=".22" />
              <stop offset="100%" stopColor="#199c88" stopOpacity=".01" />
            </linearGradient>
          </defs>
          {[20, 55, 90, 125, 160].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="640"
              y2={y}
              stroke="#e9eef1"
              strokeDasharray="4 5"
            />
          ))}
          <path d={`${line} L 620,160 L 20,160 Z`} fill="url(#report-area)" />
          <path
            d={line}
            fill="none"
            stroke="#158b7b"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          {months.map((m, i) => (
            <circle
              key={m.key}
              cx={i * 120 + 20}
              cy={160 - (m.value / max) * 140}
              r="4"
              fill="white"
              stroke="#158b7b"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {m.label}: {m.value}
              </title>
            </circle>
          ))}
        </svg>
        <div className="chart-months">
          {months.map((m) => (
            <span key={m.key}>
              {m.label}
              <strong>{m.value}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

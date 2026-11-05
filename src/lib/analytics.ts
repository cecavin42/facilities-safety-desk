import type { IncidentRecord } from "./options";
import type { QuestionLogEntry } from "./data-types";
const iso = (d: Date) => d.toISOString().slice(0, 10);
export function monthSeries(
  records: IncidentRecord[],
  from = "",
  to = "",
  now = new Date(),
) {
  const dates = records.map((r) => r.eventDate).sort();
  const first = (from || dates[0] || iso(now)).slice(0, 7);
  const last = (to || dates.at(-1) || iso(now)).slice(0, 7);
  const start = new Date(first + "-01T00:00:00Z");
  const end = new Date(last + "-01T00:00:00Z");
  const count =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() +
    1;
  if (!Number.isFinite(count) || count < 1 || count > 60)
    return {
      months: [],
      warning:
        "Choose a range of up to 60 months for the monthly chart. The totals and CSV still include all matching records.",
    };
  const months = Array.from({ length: count }, (_, i) => {
    const d = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    );
    return {
      key: iso(d).slice(0, 7),
      label: d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
    };
  });
  return { months, warning: null };
}
export function assistantWindow(
  questions: QuestionLogEntry[],
  now = new Date(),
) {
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const first = new Date(monday);
  first.setUTCDate(first.getUTCDate() - 77);
  const end = new Date(monday);
  end.setUTCDate(end.getUTCDate() + 7);
  const selected = questions.filter((q) => {
    const d = new Date(q.askedAt);
    return d >= first && d < end && d <= now;
  });
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() + i * 7);
    const stop = new Date(start);
    stop.setUTCDate(stop.getUTCDate() + 7);
    const rows = selected.filter(
      (q) => new Date(q.askedAt) >= start && new Date(q.askedAt) < stop,
    );
    return {
      label: iso(start).slice(5),
      start: iso(start),
      values: [
        rows.filter((q) => q.answered).length,
        rows.filter((q) => !q.answered).length,
      ],
    };
  });
  const declined = new Map<string, number>();
  for (const q of selected)
    if (!q.answered) {
      const text = q.question.trim();
      declined.set(text, (declined.get(text) ?? 0) + 1);
    }
  return {
    selected,
    weeks,
    from: iso(first),
    to: iso(now),
    answered: selected.filter((q) => q.answered).length,
    declined: [...declined.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

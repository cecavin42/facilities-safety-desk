import { Circle, CircleCheck, Clock3 } from "lucide-react";
export default function StatusBadge({ status }: { status: string }) {
  const Icon =
    status === "Closed"
      ? CircleCheck
      : status === "Under review"
        ? Clock3
        : Circle;
  return (
    <span
      className={`status-badge ${status === "Closed" ? "status-closed" : status === "Under review" ? "status-review" : "status-open"}`}
    >
      <Icon size={12} aria-hidden="true" />
      {status}
    </span>
  );
}

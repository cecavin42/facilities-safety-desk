import Dashboard from "@/components/Dashboard";
// Preserve Catherine's last-updated indicator: this is the build date.
const lastUpdated = new Date().toLocaleDateString("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Chicago",
});
export default function Home() {
  return <Dashboard lastUpdated={lastUpdated} />;
}

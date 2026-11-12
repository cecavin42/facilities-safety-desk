import { Suspense } from "react";
import { redirect } from "next/navigation";
import SafetyAssistant from "@/components/SafetyAssistant";
import { activeCatalog } from "@/lib/sources";
import { pageUser } from "@/lib/server-access";
async function AssistantView() {
  if (!(await pageUser())) redirect("/sign-in");
  const catalog = await activeCatalog();
  return (
    <SafetyAssistant
      sources={catalog.documents.map(({ id, title, dated, url }) => ({
        id,
        title,
        dated,
        url,
      }))}
    />
  );
}
export default function AssistantPage() {
  return (
    <Suspense fallback={<p>Loading active sources…</p>}>
      <AssistantView />
    </Suspense>
  );
}

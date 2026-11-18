import { Suspense } from "react";
import { redirect } from "next/navigation";
import SafetyAssistant from "@/components/SafetyAssistant";
import { activeCatalog } from "@/lib/sources";
import { pageUser } from "@/lib/server-access";
import { claudeSettings } from "@/lib/assistant/claude-settings";
async function AssistantView() {
  if (!(await pageUser())) redirect("/sign-in");
  const catalog = await activeCatalog();
  return (
    <SafetyAssistant
      ownDocuments={catalog.documents.some((d) => d.origin === "upload")}
      aiWriting={claudeSettings().on}
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

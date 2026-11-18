import { Suspense } from "react";
import { redirect } from "next/navigation";
import SafetyAssistant from "@/components/SafetyAssistant";
import { activeCatalog } from "@/lib/sources";
import { pageUser } from "@/lib/server-access";
import { claudeSettings } from "@/lib/assistant/claude-settings";
import { embeddingSettings } from "@/lib/assistant/embedding-settings";
import { configuredSemantic } from "@/lib/assistant/semantic-search";
import type { Catalog } from "@/lib/source-types";
// Who a question is sent to for search by meaning, or undefined while that
// search is not in use: switched off, or switched on but not every active
// passage has its embedding yet (keyword search then answers alone and
// nothing is sent).
async function meaningSearch(catalog: Catalog) {
  const search = configuredSemantic();
  const settings = embeddingSettings();
  if (!search || !settings.on) return undefined;
  try {
    const indexed = (await search.vectors(catalog)).size;
    return indexed === catalog.passages.length ? settings.provider : undefined;
  } catch {
    return undefined;
  }
}
async function AssistantView() {
  if (!(await pageUser())) redirect("/sign-in");
  const catalog = await activeCatalog();
  return (
    <SafetyAssistant
      ownDocuments={catalog.documents.some((d) => d.origin === "upload")}
      aiWriting={claudeSettings().on}
      meaningSearch={await meaningSearch(catalog)}
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

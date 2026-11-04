import SafetyAssistant from "@/components/SafetyAssistant";
import { DOCUMENTS } from "@/lib/assistant/topics";

export default function AssistantPage() {
  return <SafetyAssistant sources={DOCUMENTS.map(({ id, title, dated, url }) => ({ id, title, dated, url }))} />;
}

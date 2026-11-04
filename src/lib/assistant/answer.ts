import { createHash } from "node:crypto";
import { ask as search } from "../search";
import { DOCUMENTS, LABELS, PASSAGES, TOPICS, matchTopics } from "./topics";

export type Evidence = { id: string; documentId: string; title: string; label: string; text: string; url: string; dated: string; credit: string };
export type AnswerSection = { id: string; title: string; scope: string; summary: string; evidenceIds: string[] };
export type AssistantAnswer = { outcome: "answer" | "partial" | "unsupported"; answered: boolean; message: string; sections: AnswerSection[]; evidence: Evidence[]; followUps: string[]; method: "source-guide" | "ai-assisted" | "source-search"; sourceVersion: string; notice?: string };
export const SOURCE_VERSION = createHash("sha256").update(JSON.stringify({ DOCUMENTS, PASSAGES, LABELS, TOPICS: TOPICS.map(t => ({ id: t.id, summary: t.summary, evidence: t.evidence })) })).digest("hex").slice(0, 12);

export function needsIndividualDecision(question: string) {
  return /(?:go|return|get).*(?:back to work|back to driving)|(?:certificate|clearance).*(?:enough|safe)|(?:enough|safe).*certificate/i.test(question);
}

export function evidenceFor(id: string): Evidence {
  const p = PASSAGES.find(p => p.id === id);
  if (!p) throw new Error("Unknown evidence ID");
  const d = DOCUMENTS.find(d => d.id === p.docId)!;
  return { id, documentId: d.id, title: d.title, label: LABELS[id] ?? p.label, text: p.text, url: d.url, dated: d.dated, credit: d.credit };
}

export function scopeGap(q: string): string | undefined {
  if (/ignore.*(?:instruct|rule)|system prompt|pretend|make up|fabricat|reveal.*(?:secret|key)/i.test(q)) return "I cannot fabricate a policy or change the source rules. Ask a question about the available safety documents.";
  if (/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|uk|canada)\b/i.test(q)) return "I do not have the requested jurisdiction's rules. Tennessee reporting requirements cannot establish another jurisdiction's deadline.";
  if (/lipscomb|our (?:campus|university|company)|this (?:campus|university)|current.*(?:director|officer)|who is.*(?:ehs|safety)|(?:phone|contact) number|\bSDS\b|safety data sheet|(?:chemical|acid|bleach|acetone).*(?:clean|spill|neutraliz)|(?:clean|neutraliz).*(?:chemical|acid|bleach|acetone)/i.test(q)) return "That requires a current local procedure, named contact, or product-specific safety data sheet that is not in this collection. The UT examples do not establish your institution's policy.";
  if (/\b(pay|paid|salary|wage|vacation|benefit|ibuprofen|diagnos|dosage|medicine|ER)\b|back (?:hurts|pain)|should I.*(?:doctor|hospital)|medical advice/i.test(q)) return "These sources cannot answer pay, benefits, diagnosis, or treatment questions. Use the appropriate HR or medical service. For an immediate emergency, contact emergency services.";
  if (/last (?:month|week)|yesterday|record R-|how many.*(?:incident|injur)|what happened.*incident/i.test(q)) return "I search policy documents, not individual incident records. Use Records or Reports for the demo's incident data.";
  return undefined;
}

export function answerFromTopics(question: string, selected = matchTopics(question)): AssistantAnswer {
  const gap = scopeGap(question);
  const base = { sections: [], evidence: [], followUps: ["How often does a forklift need inspection?", "Who should receive a near-miss report under UT's procedure?"], method: "source-guide" as const, sourceVersion: SOURCE_VERSION };
  if (gap) return { ...base, outcome: "unsupported", answered: false, message: gap };
  const topics = [...new Set(selected)].map(id => TOPICS.find(t => t.id === id)).filter((t): t is typeof TOPICS[number] => Boolean(t)).slice(0, 4);
  if (topics.length) {
    const ids = [...new Set(topics.flatMap(t => t.evidence))];
    const limited = needsIndividualDecision(question) || selected.length > 4;
    return { ...base, outcome: limited ? "partial" : "answer", answered: !limited, message: limited ? "These policy excerpts do not establish an individual's clearance to work or cover every part of the question. A responsible supervisor must assess the situation." : "Here is what the available sources support.", sections: topics.map(t => ({ id: t.id, title: t.title, scope: t.scope, summary: t.summary, evidenceIds: t.evidence })), evidence: ids.map(evidenceFor), followUps: topics.flatMap(t => t.followUp ? [t.followUp] : []).slice(0, 2) };
  }
  const related = search(question);
  if (related.answered) {
    const ids = related.citations.map(c => PASSAGES.find(p => p.docId === c.document.id && p.text === c.passage)?.id).filter((id): id is string => Boolean(id));
    return { ...base, outcome: "partial", answered: false, method: "source-search", message: "I found related passages, but have not established a complete answer to this question. Review the sources or ask a more specific question.", evidence: ids.map(evidenceFor) };
  }
  return { ...base, outcome: "unsupported", answered: false, message: "I could not establish an answer in these five documents. Try a specific question about forklift safety, UT incident reporting, or Tennessee employer reporting." };
}

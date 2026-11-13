import { createHash } from "node:crypto";
import { DOCUMENTS, PASSAGES, TOPICS } from "./assistant/topics";
export type SourceDocument = {
  id: string;
  title: string;
  owner: string;
  dated: string;
  url: string;
  credit: string;
  origin?: string;
  scope?: string;
  versionId?: string;
};
export type SourcePassage = {
  id: string;
  docId: string;
  label: string;
  text: string;
};
export type Catalog = {
  documents: SourceDocument[];
  passages: SourcePassage[];
  version: string;
};
export function catalogOf(
  documents: SourceDocument[],
  passages: SourcePassage[],
): Catalog {
  return {
    documents,
    passages,
    version: createHash("sha256")
      .update(
        JSON.stringify({
          documents,
          passages,
          guides: TOPICS.map((t) => [t.id, t.summary, t.evidence]),
        }),
      )
      .digest("hex")
      .slice(0, 16),
  };
}
export const BUILTIN_CATALOG = catalogOf(DOCUMENTS, PASSAGES);

// Some PDFs store a space as an invisible control character. Left in, the
// words run together on screen and a phrase copied from the page no longer
// matches the stored text. Tabs and line breaks are kept.
export function readableText(text: string) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out +=
      (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127
        ? " "
        : text[i];
  }
  return out;
}

export function eligiblePassages(question: string, catalog: Catalog) {
  const local =
    /lipscomb|our (?:campus|university|company)|this (?:campus|university)|current.*(?:director|officer)|who is.*(?:ehs|safety)|(?:phone|contact) number|\bSDS\b|safety data sheet|neutraliz|(?:chemical|acid|bleach|acetone).*(?:clean|spill)|(?:clean|spill).*(?:chemical|acid|bleach|acetone)/i.test(
      question,
    );
  const federal = /\bOSHA\b|\bfederal\b|\bCFR\b/i.test(question);
  const state = /\bTOSHA\b|Tennessee.*(?:report|rule)/i.test(question);
  return catalog.passages.filter((p) => {
    const d = catalog.documents.find((d) => d.id === p.docId);
    if (!d) return false;
    if (local) return d.origin === "upload";
    if (federal && !state) return d.id === "cfr-1910-178";
    if (state && !federal) return d.id === "tn-0800-01-03-05";
    return true;
  });
}

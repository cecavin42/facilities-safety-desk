import data from "@/data/documents.json";

export type SafetyDocument = {
  id: string;
  title: string;
  owner: string;
  dated: string;
  url: string;
  credit: string;
};

export type Passage = { id: string; docId: string; label: string; text: string };

export type Citation = { document: SafetyDocument; label: string; passage: string; excerpt: string };

export type AskResult =
  | { answered: true; citations: Citation[] }
  | { answered: false; message: string };

export const DOCUMENTS = data.documents as SafetyDocument[];
const PASSAGES = data.passages as Passage[];

const STOP = new Set(
  ("a an and are as at be been but by can could did do does for from had has have how i if in into is it its me my of on or our should so than that the their them then there these they this to us was we were what when where which who why will with would you your about any after before need needs must shall there here " +
    "often much many get got getting fast quickly soon long take go going someone somebody coworker coworkers co worker workers employee employees person people okay ok please tell know want am").split(" "),
);

// Word families the documents use for common questions ("inspected" vs "examined").
const SYNONYMS: Record<string, string> = {
  inspect: "examin",
  check: "examin",
  hospit: "hospitaliz",
  admit: "hospitaliz",
  retrain: "refresh",
  refresh: "refresh",
  forklift: "forklift",
  truck: "forklift",
  dead: "death",
  die: "death",
  kill: "death",
  hurt: "injur",
  injur: "injur",
  confidenti: "confidenti",
  anonym: "confidenti",
  trouble: "retaliat",
  punish: "retaliat",
  disciplin: "retaliat",
  retaliat: "retaliat",
  fired: "discharg",
  boss: "supervisor",
  manager: "supervisor",
};

function stem(word: string): string {
  let w = word.toLowerCase();
  for (const suf of ["ations", "ation", "ings", "ing", "edly", "ed", "ies", "es", "s", "ly", "al"]) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  for (const [k, v] of Object.entries(SYNONYMS)) if (w.startsWith(k)) return v;
  return w;
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t)).map(stem);
}

const indexed = PASSAGES.map((p) => {
  const toks = tokens(p.text);
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { p, tf, len: toks.length };
});
const avgLen = indexed.reduce((a, x) => a + x.len, 0) / indexed.length;
const df = new Map<string, number>();
for (const x of indexed) for (const t of x.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
const N = indexed.length;

function idf(t: string) {
  const n = df.get(t) ?? 0;
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

function bm25(qTerms: string[], x: (typeof indexed)[number]) {
  let s = 0;
  for (const t of qTerms) {
    const f = x.tf.get(t) ?? 0;
    if (!f) continue;
    s += idf(t) * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (x.len / avgLen))));
  }
  return s;
}

// Share of the question's meaning (weighted by rarity) that a passage covers.
function coverage(qTerms: string[], x: (typeof indexed)[number]) {
  const total = qTerms.reduce((a, t) => a + idf(t), 0);
  const hit = qTerms.filter((t) => x.tf.has(t)).reduce((a, t) => a + idf(t), 0);
  return total ? hit / total : 0;
}

// "How often" / "how fast" / "who" questions want sentences with a frequency, deadline or person in them.
function intentTerms(question: string): string[] {
  const q = question.toLowerCase();
  const words: string[] = [];
  if (/how often|how frequent|every|daily/.test(q)) words.push("daily", "shift", "year", "annual", "month", "least");
  if (/how (fast|soon|quick|long)|deadline|within|how many (hours|days)/.test(q)) words.push("hour", "within", "eight", "twenty");
  if (/\bwho\b|whom/.test(q)) words.push("supervisor", "immediate", "contact");
  if (/trouble|punish|retaliat|fired/.test(q)) words.push("free", "discharg");
  return words.map(stem);
}

const HEADER = /Effective Date|Version \d|Revision Date|Procedure AD-|Page \d+ of/i;

function bestExcerpt(text: string, qTerms: string[], intent: string[]): string {
  const sentences = text.split(/(?<=[.;:?])\s+(?=[A-Z0-9(•])/);
  let best = 0;
  let bestScore = -Infinity;
  sentences.forEach((s, i) => {
    const toks = new Set(tokens(s));
    const score =
      qTerms.reduce((a, t) => a + (toks.has(t) ? idf(t) : 0), 0) +
      intent.reduce((a, t) => a + (toks.has(t) ? 3 : 0), 0) -
      (HEADER.test(s) ? 10 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  const pick = sentences.slice(best, best + 2).join(" ");
  return pick.length > 420 ? pick.slice(0, 417) + "..." : pick;
}

// Tuned on the spec's example questions: answerable ones cover >= 0.56, off-topic ones <= 0.31.
const MIN_COVERAGE = 0.5;
const MIN_SCORE = 3;

export function retrieveCandidates(question: string, limit = 8): Passage[] {
  const qTerms = [...new Set(tokens(question))];
  const intent = intentTerms(question);
  return indexed.map(x => ({ x, score: bm25(qTerms, x) + 0.5 * bm25(intent, x) }))
    .filter(r => r.score >= MIN_SCORE && !HEADER.test(r.x.p.text.slice(0, 70)))
    .sort((a, b) => b.score - a.score).slice(0, limit).map(r => r.x.p);
}

export function ask(question: string): AskResult {
  const qTerms = [...new Set(tokens(question))];
  if (qTerms.length === 0) return { answered: false, message: declineMessage(question) };

  const intent = intentTerms(question);
  const ranked = indexed
    .map((x) => ({ x, score: bm25(qTerms, x) + 0.5 * bm25(intent, x), cov: coverage(qTerms, x) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const strong = ranked.filter((r) => r.cov >= MIN_COVERAGE && r.score >= MIN_SCORE);
  if (strong.length === 0) return { answered: false, message: declineMessage(question) };

  const picked: typeof strong = [];
  for (const r of strong) {
    if (picked.length >= 3) break;
    if (picked.some((p) => p.x.p.docId === r.x.p.docId && p.x.p.label === r.x.p.label)) continue;
    if (r.score < strong[0].score * 0.5) break;
    picked.push(r);
  }

  return {
    answered: true,
    citations: picked.map(({ x }) => ({
      document: DOCUMENTS.find((d) => d.id === x.p.docId)!,
      label: x.p.label,
      passage: x.p.text,
      excerpt: bestExcerpt(x.p.text, qTerms, intent),
    })),
  };
}

function declineMessage(question: string): string {
  const q = question.toLowerCase();
  const extra = /pay|paid|salary|wage|vacation|leave|benefit|holiday|raise/.test(q)
    ? " For pay, leave or benefits questions, contact Human Resources."
    : /pain|hurt|medic|ibuprofen|doctor|er\b|emergency|bleed|sick/.test(q)
      ? " For an injury, tell your supervisor. In an emergency, call 911."
      : "";
  return `I couldn't find that in the safety documents I have, so I won't guess.${extra}`;
}

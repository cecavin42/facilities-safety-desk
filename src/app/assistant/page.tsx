"use client";

import { useState } from "react";
import type { AskResult } from "@/lib/search";
import { useAppData } from "@/lib/store";

const HELP_TOPICS = [
  "Forklift inspections, training, refresher training and safe operation",
  "Reporting deaths, hospitalizations and serious injuries to TOSHA",
  "How to report an incident, accident, safety hazard or near miss",
  "Protection from retaliation when reporting a safety concern",
];

type Turn = { question: string; result?: AskResult; error?: string };

const EXAMPLES = [
  "How often does a forklift have to be inspected?",
  "I had a near miss on the forklift. Do I need retraining?",
  "A coworker was admitted to the hospital after a fall. How fast do we have to report it?",
  "Who do I report a near miss to, and could I get in trouble for it?",
];

export default function AssistantPage() {
  const { logQuestion } = useAppData();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function send(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setQuestion("");
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) });
      const data = await res.json();
      if (!res.ok) setTurns((t) => [{ question: text, error: data.error ?? "Something went wrong." }, ...t]);
      else {
        logQuestion(text, data.answered);
        setTurns((t) => [{ question: text, result: data }, ...t]);
      }
    } catch {
      setTurns((t) => [{ question: text, error: "Could not reach the assistant. Check your connection and try again." }, ...t]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Safety assistant</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Answers come only from five documents: the federal forklift standard, Tennessee&apos;s injury-reporting rule, and
          three University of Tennessee safety procedures. This draft shows the best matching passages; it does not use an
          AI model yet. Not medical, legal or HR advice.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(question); }} className="flex gap-2">
        <label htmlFor="q" className="sr-only">Your question</label>
        <input id="q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="Ask a safety question..." className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none" />
        <button disabled={busy || !question.trim()} className="rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">
          {busy ? "Searching..." : "Ask"}
        </button>
      </form>

      {turns.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Try one of these:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => send(e)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-left text-xs hover:border-teal-600">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {turns.map((t, i) => (
          <article key={turns.length - i} className="rounded-lg border border-slate-200 bg-white p-5">
            <p className="font-medium">{t.question}</p>
            {t.error && <p className="mt-2 text-sm text-red-700">{t.error}</p>}
            {t.result && !t.result.answered && (
              <div className="mt-3 space-y-2 text-sm">
                <p className="rounded-md bg-amber-50 p-3 text-amber-900">{t.result.message}</p>
                <p className="text-slate-600">I can help with:</p>
                <ul className="list-disc pl-5 text-slate-600">
                  {HELP_TOPICS.map((h) => <li key={h}>{h}</li>)}
                </ul>
              </div>
            )}
            {t.result?.answered && (
              <div className="mt-3 space-y-4">
                <p className="text-xs text-slate-500">Most relevant passages, best match first:</p>
                {t.result.citations.map((c, j) => (
                  <div key={j} className="border-l-4 border-teal-600 pl-4">
                    <blockquote className="text-sm text-slate-800">&ldquo;{c.excerpt}&rdquo;</blockquote>
                    <p className="mt-1 text-xs text-slate-600">
                      <a href={c.document.url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-800 underline">
                        {c.document.title}
                      </a>
                      , {c.label}. {c.document.dated}. {c.document.credit}
                    </p>
                    <details className="mt-1 text-xs text-slate-600">
                      <summary className="cursor-pointer">Show full passage</summary>
                      <p className="mt-1 whitespace-pre-wrap">{c.passage}</p>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

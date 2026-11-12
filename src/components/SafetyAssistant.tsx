"use client";

import { useRef, useState } from "react";
import type { AssistantAnswer } from "@/lib/assistant/answer";

type Source = { id: string; title: string; dated: string; url: string };
type Turn = { id: number; question: string; result?: AssistantAnswer; error?: string };
const EXAMPLES = [
  { title: "Inspect equipment", question: "How often does a forklift used around the clock need inspection?" },
  { title: "Report a near miss", question: "Who do I report a near miss to, and could I get in trouble for it?" },
  { title: "Check a reporting deadline", question: "Does hospitalization only for observation have to be reported to TOSHA?" },
  { title: "Understand training", question: "I had a near miss on the forklift. Do I need retraining?" },
];

export default function SafetyAssistant({ sources }: { sources: Source[] }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  async function send(value: string) {
    const text = value.trim();
    if (!text || busy || text.length > 500) return;
    const id = ++sequence.current;
    const controller = new AbortController(); request.current = controller;
    setQuestion(text); setBusy(true); setStatus("Checking the available sources. You can cancel without losing your question.");
    try {
      const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }), signal: controller.signal });
      const data = await response.json();
      if (id !== sequence.current) return;
      if (!response.ok) throw new Error(data.error ?? "The assistant could not complete this request.");
      if (!Array.isArray(data.sections) || !Array.isArray(data.evidence) || typeof data.answered !== "boolean") throw new Error("The assistant returned an incomplete response. Please retry.");
      setTurns(t => [{ id, question: text, result: data }, ...t].slice(0, 20));
      setQuestion(""); setStatus("Response ready. Sources and limitations are included below.");
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch (error) {
      if (id !== sequence.current || controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Could not reach the assistant. Please retry.";
      setTurns(t => [{ id, question: text, error: message }, ...t].slice(0, 20));
      setStatus("The question was not completed. Your text has been kept for retry.");
    } finally { if (id === sequence.current) { setBusy(false); request.current = null; } }
  }

  function cancel() {
    sequence.current++; request.current?.abort(); request.current = null;
    setBusy(false); setStatus("Canceled. Your question is still in the box."); input.current?.focus();
  }

  async function copy(turn: Turn) {
    if (!turn.result) return;
    const r = turn.result;
    const text = [turn.question, r.message, ...r.sections.map(s => `${s.title} — ${s.scope}\n${s.summary}`), "Sources:", ...r.evidence.map(e => `${e.title}, ${e.label}\n${e.url}`), `Classroom source snapshot ${r.sourceVersion}. Verify current local policy before acting.`].join("\n\n");
    try { await navigator.clipboard.writeText(text); setStatus("Copied the response with source links and limitations."); }
    catch { setStatus("Copy was unavailable. Select the response text to copy it manually."); }
  }

  return <div className="mx-auto max-w-6xl space-y-8">
    <header className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-widest text-teal-800">Safety knowledge desk</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Safety assistant</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">Ask about forklift safety, incident reporting, or near misses. Each response separates what the documents support from what still needs checking.</p>
    </header>

    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <form onSubmit={e => { e.preventDefault(); void send(question); }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-busy={busy}>
          <label htmlFor="safety-question" className="block text-lg font-semibold">What would you like to check?</label>
          <p id="question-help" className="mt-1 text-sm leading-6 text-slate-600">Include the event and the rule you need. Use fictional examples; leave out names and personal medical details.</p>
          <textarea ref={input} id="safety-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={500} rows={3} readOnly={busy} aria-describedby="question-help question-count" placeholder="For example: Does a hospital visit just for observation need to be reported?" className="mt-4 w-full resize-y rounded-xl border border-slate-400 px-4 py-3 text-base leading-6 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span id="question-count" className="text-xs text-slate-500">{question.length}/500 characters</span>
            <div className="flex gap-2">
              {busy && <button type="button" onClick={cancel} className="min-h-11 rounded-lg border border-slate-400 px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2">Cancel</button>}
              <button disabled={busy || !question.trim()} className="min-h-11 rounded-lg bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50">{busy ? "Checking sources…" : "Check sources"}</button>
            </div>
          </div>
        </form>
        <p role="status" aria-live="polite" className="text-sm text-slate-600">{status}</p>

        {turns.length === 0 && <section aria-label="Example questions" className="grid gap-3 sm:grid-cols-2">
          {EXAMPLES.map(example => <button key={example.title} disabled={busy} onClick={() => void send(example.question)} className="min-h-28 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-teal-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"><span className="block text-sm font-semibold text-teal-800">{example.title} <span aria-hidden="true">↗</span></span><span className="mt-2 block text-sm leading-6 text-slate-600">{example.question}</span></button>)}
        </section>}

        {turns.length > 0 && <div className="flex items-center justify-between gap-4"><h2 ref={resultHeading} tabIndex={-1} className="text-xl font-semibold outline-none">Your source checks</h2><button disabled={busy} type="button" onClick={() => { setTurns([]); setStatus("Conversation cleared from this page."); input.current?.focus(); }} className="min-h-11 rounded px-2 text-sm text-slate-600 underline focus-visible:outline-2">Clear conversation</button></div>}

        {turns.map(turn => <article key={turn.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your question</p><h3 className="mt-2 break-words text-lg font-semibold">{turn.question}</h3></div>
          {turn.error ? <div className="space-y-3 p-5" role="alert"><p>{turn.error}</p><button disabled={busy} onClick={() => void send(turn.question)} className="min-h-11 rounded-lg border border-teal-700 px-4 text-teal-800">Retry question</button></div> : turn.result && <div className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span className={`rounded-full px-3 py-1.5 ${turn.result.outcome === "answer" ? "bg-teal-50 text-teal-900" : "bg-amber-50 text-amber-900"}`}>{turn.result.outcome === "answer" ? "Supported by these sources" : turn.result.outcome === "partial" ? "Partial coverage — check the limits" : "Not covered by these sources"}</span><span className="text-slate-500">{turn.result.method === "ai-assisted" ? "AI-assisted interpretation · source-backed text" : turn.result.method === "source-guide" ? "Source guide" : "Related-source search"}</span></div>
            <p className="text-sm leading-6 text-slate-600">{turn.result.message}</p>
            {turn.result.notice && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{turn.result.notice}</p>}
            {turn.result.sections.map(section => <section key={section.id} className="border-l-4 border-teal-600 pl-4"><p className="text-xs font-semibold text-teal-800">{section.scope}</p><h4 className="mt-1 font-semibold">{section.title}</h4><p className="mt-2 text-sm leading-7 text-slate-700">{section.summary}</p><div className="mt-2 flex flex-wrap gap-2">{section.evidenceIds.map(id => { const number = turn.result!.evidence.findIndex(e => e.id === id) + 1; return <a key={id} className="inline-flex min-h-11 items-center rounded-lg bg-teal-50 px-3 text-xs font-semibold text-teal-900 underline focus-visible:outline-2" onClick={() => { const detail = document.getElementById(`source-${turn.id}-${id}`); if (detail instanceof HTMLDetailsElement) detail.open = true; }} href={`#source-${turn.id}-${id}`}>Source {number}</a>; })}</div></section>)}
            {turn.result.evidence.length > 0 && <section aria-label="Supporting sources"><h4 className="font-semibold">Check the evidence</h4><p className="mt-1 text-xs leading-5 text-slate-500">Open a source to see the exact passage. Document dates and jurisdictions matter.</p><div className="mt-3 space-y-3">{turn.result.evidence.map((e, index) => <details key={e.id} id={`source-${turn.id}-${e.id}`} className="scroll-mt-4 rounded-lg border border-slate-200 open:border-teal-600"><summary className="min-h-11 cursor-pointer p-3 text-sm leading-6 focus-visible:outline-2"><span className="font-semibold">{index + 1}. {e.title}</span><span className="block pl-4 text-xs text-slate-500">{e.label} · {e.dated}</span></summary><div className="space-y-3 border-t border-slate-200 p-4"><blockquote className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{e.text}</blockquote><p className="text-xs leading-5 text-slate-500">{e.credit}</p><a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-800 underline">Open original source <span className="sr-only">in a new tab</span></a></div></details>)}</div></section>}
            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-950">Classroom reference. UT procedures do not establish Lipscomb policy. This collection is not continuously updated and cannot determine an individual incident&apos;s legal or medical outcome.</p>
            <div className="flex flex-wrap items-center justify-between gap-3"><button onClick={() => void copy(turn)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium">Copy answer and sources</button><span className="text-xs text-slate-500">Source snapshot {turn.result.sourceVersion}</span></div>
            {turn.result.followUps.length > 0 && <div className="border-t border-slate-100 pt-4"><p className="text-xs font-semibold text-slate-500">Related questions</p>{turn.result.followUps.map(q => <button key={q} disabled={busy} onClick={() => void send(q)} className="mt-2 block min-h-11 text-left text-sm text-teal-800 underline disabled:opacity-50">{q}</button>)}</div>}
          </div>}
        </article>)}
      </div>

      <aside className="space-y-5 lg:pt-1">
        <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-5"><h2 className="font-semibold text-teal-950">Know what you&apos;re checking</h2><ul className="mt-3 space-y-3 text-sm leading-6 text-teal-950"><li><strong>Federal:</strong> powered industrial truck safety.</li><li><strong>Tennessee:</strong> employer injury and fatality reporting.</li><li><strong>UT Knoxville:</strong> example campus procedures.</li></ul><p className="mt-4 border-t border-teal-200 pt-4 text-sm leading-6 text-teal-950">Need to record an event? <a href="/report" className="font-semibold underline">Open the incident form.</a></p></div>
        <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold">Source library · {sources.length} documents</summary><ul className="mt-3 space-y-4">{sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-800 underline">{source.title}<span className="sr-only"> opens in a new tab</span></a><p className="mt-1 text-xs leading-5 text-slate-500">{source.dated}</p></li>)}</ul></details>
        <p className="px-1 text-xs leading-6 text-slate-500">Each question is checked on its own. Responses stay on this page. Questions and whether they were answered are saved with the demo&apos;s existing statistics; clearing this view does not delete those records.</p>
      </aside>
    </div>
  </div>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/components/SessionUser";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/client-api";
type Source = {
  id: string;
  documentId: string;
  version: number;
  title: string;
  publisher: string;
  revision: string;
  sourceUrl: string;
  scope: string;
  credit: string;
  state: string;
  passageCount: number;
  fileName?: string;
  passages?: { id: string; label: string; text: string }[];
};
export default function SourcesPage() {
  const user = useCurrentUser();
  const admin = user.role === "admin";
  const [rows, setRows] = useState<Source[]>([]);
  const [viewState, setViewState] = useState("active");
  const [selected, setSelected] = useState<Source | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const inspection = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  async function load() {
    setRows(await api<Source[]>("/api/sources"));
  }
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (selected && window.matchMedia("(max-width: 1279px)").matches)
      detailHeading.current?.focus();
  }, [selected]);
  async function inspect(id: string) {
    const request = ++inspection.current;
    setError("");
    setReviewed(false);
    try {
      const source = await api<Source>(`/api/sources/${id}`);
      if (request === inspection.current) setSelected(source);
    } catch (e) {
      if (request === inspection.current)
        setError(e instanceof Error ? e.message : "Could not read source.");
    }
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/sources/upload", {
        method: "POST",
        body: new FormData(form),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Upload failed.");
      form.reset();
      setViewState("draft");
      await load();
      await inspect(data.id);
      setMessage(
        "Draft extracted. Review its metadata and text before activation.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function transition(state: "active" | "retired") {
    if (!selected || !reviewed) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/sources/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ state, reviewed }),
      });
      setMessage(
        state === "active"
          ? "This version is active. Any previous active version was retired."
          : "This version is retired and cannot support new answers.",
      );
      setViewState(state);
      await load();
      await inspect(selected.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Source change failed.");
    } finally {
      setBusy(false);
    }
  }
  const unique = new Map<string, Source>();
  for (const row of rows)
    if (!unique.has(row.documentId)) unique.set(row.documentId, row);
  const current = [...unique.values()];
  const visible = rows.filter(
    (r) => !admin || viewState === "all" || r.state === viewState,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge management"
        title="Source library"
        description="Inspect the exact documents available to the assistant. New or replacement files remain drafts until an administrator reviews and activates them."
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-900"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-teal-50 p-4 text-sm text-teal-900"
        >
          {message}
        </p>
      )}
      {admin && (
        <details className="surface p-5">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Upload a source or new version
          </summary>
          <form onSubmit={upload} className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              ["title", "Document title"],
              ["publisher", "Publisher / owner"],
              ["revision", "Revision or publication date"],
              ["sourceUrl", "Original source URL"],
              ["scope", "Scope / applicability"],
              ["credit", "Usage permission / attribution"],
            ].map(([name, label]) => (
              <label className="text-sm" key={name}>
                {label}
                <input
                  className="control mt-2"
                  name={name}
                  required
                  maxLength={500}
                  type={name === "sourceUrl" ? "url" : "text"}
                />
              </label>
            ))}
            <label className="text-sm">
              Version of
              <select name="documentId" className="control mt-2">
                <option value="">New source</option>
                {current.map((r) => (
                  <option key={r.documentId} value={r.documentId}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Source file
              <input
                className="control mt-2"
                type="file"
                name="file"
                accept=".pdf,.txt,.md"
                required
              />
            </label>
            <p className="text-xs leading-6 text-slate-500 md:col-span-2">
              Text PDF, TXT or Markdown; maximum 5 MB / 100 pages. Scanned PDFs
              need OCR first. Activation makes the version available to all
              signed-in users and the assistant.
            </p>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Processing…" : "Upload as draft"}
            </button>
          </form>
        </details>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="surface overflow-hidden">
          <div className="border-b p-5">
            <h2 className="font-semibold">
              {admin ? "Source versions" : "Active sources"}
            </h2>
            {admin && (
              <div className="mt-3 flex flex-wrap gap-2">
                {["active", "draft", "retired", "all"].map((state) => (
                  <button
                    className="btn-secondary"
                    aria-pressed={viewState === state}
                    key={state}
                    onClick={() => setViewState(state)}
                  >
                    {state} (
                    {
                      rows.filter((r) => state === "all" || r.state === state)
                        .length
                    }
                    )
                  </button>
                ))}
              </div>
            )}
          </div>
          {loading && (
            <p role="status" className="p-5 text-sm text-slate-500">
              Loading sources…
            </p>
          )}
          {!loading && visible.length === 0 && (
            <p className="p-5 text-sm text-slate-500">
              No {viewState === "all" ? "" : `${viewState} `}sources to show.
            </p>
          )}
          {visible.map((r) => (
            <button
              key={r.id}
              onClick={() => void inspect(r.id)}
              className={`block w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${selected?.id === r.id ? "bg-teal-50" : ""}`}
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">{r.title}</strong>
                <span className="subtle-tag">
                  {r.state} · v{r.version}
                </span>
              </span>
              <span className="mt-2 block text-xs text-slate-500">
                {r.publisher} · {r.revision} · {r.passageCount} passages
              </span>
            </button>
          ))}
        </section>
        <section className="surface p-5">
          {selected ? (
            <>
              <h2
                ref={detailHeading}
                tabIndex={-1}
                className="text-lg font-semibold"
              >
                {selected.title}
              </h2>
              <span className="subtle-tag mt-3 inline-flex">
                {selected.state} · version {selected.version}
              </span>
              <dl className="mt-4 grid gap-3 text-sm">
                {[
                  ["Publisher", selected.publisher],
                  ["Revision", selected.revision],
                  ["Scope", selected.scope],
                  ["Credit", selected.credit],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-500">{k}</dt>
                    <dd className="mt-1 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <a
                className="text-action mt-4"
                href={selected.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open original source
              </a>
              {selected.fileName && (
                <a
                  className="text-action ml-4"
                  href={`/api/sources/${selected.id}/file`}
                >
                  Download this version
                </a>
              )}
              <h3 className="mt-6 font-semibold">Extracted text</h3>
              <div
                className="mt-3 max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 p-4"
                tabIndex={0}
                aria-label="Extracted source passages"
              >
                {selected.passages?.map((p) => (
                  <div key={p.id} className="mb-5">
                    <p className="text-xs font-semibold text-teal-800">
                      {p.label}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">
                      {p.text}
                    </p>
                  </div>
                ))}
              </div>
              {admin && (
                <div className="mt-5 space-y-3">
                  <label className="flex items-start gap-2 text-sm leading-6">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />
                    I reviewed the publisher, scope, revision, extracted text
                    and usage rights.
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary"
                      disabled={
                        !reviewed || busy || selected.state === "active"
                      }
                      onClick={() => void transition("active")}
                    >
                      Activate this version
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={
                        !reviewed || busy || selected.state === "retired"
                      }
                      onClick={() => void transition("retired")}
                    >
                      Retire this version
                    </button>
                  </div>
                  <p className="text-xs leading-6 text-slate-500">
                    Changes are audited. Retired versions remain available here
                    for review but are excluded from new answers.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-sm text-slate-500">
              Choose a source to inspect its version, applicability and exact
              text.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

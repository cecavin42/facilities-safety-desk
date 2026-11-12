import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { database } from "./database";
import { transaction } from "./db/repository";
import { HttpError } from "./server-access";
import {
  catalogOf,
  type SourceDocument,
  type SourcePassage,
} from "./source-types";
export async function activeCatalog() {
  const { rows } = await database().query(
    "SELECT id,document_id,title,publisher,revision,version,source_url,scope,credit,origin,passages FROM source_versions WHERE state='active' ORDER BY document_id",
  );
  return catalogOf(
    rows.map(
      (r) =>
        ({
          id: r.document_id,
          title: r.title,
          owner: r.publisher,
          dated: `${r.revision} · version ${r.version}`,
          url: r.source_url,
          credit: r.credit,
          origin: r.origin,
          scope: r.scope,
          versionId: r.id,
        }) satisfies SourceDocument,
    ),
    rows.flatMap((r) => r.passages as SourcePassage[]),
  );
}
export async function listSources(admin: boolean) {
  return (
    await database().query(
      `SELECT id,document_id AS "documentId",version,title,publisher,revision,source_url AS "sourceUrl",scope,credit,origin,state,file_name AS "fileName",created_at AS "createdAt",activated_at AS "activatedAt",jsonb_array_length(passages) AS "passageCount" FROM source_versions ${admin ? "" : "WHERE state='active'"} ORDER BY title,version DESC`,
    )
  ).rows;
}
export async function sourceDetail(id: string, admin: boolean) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new HttpError("Source not found.", 404);
  const {
    rows: [row],
  } = await database().query(
    `SELECT id,document_id AS "documentId",title,publisher,revision,source_url AS "sourceUrl",scope,credit,state,version,passages,file_name AS "fileName" FROM source_versions WHERE id=$1 AND ($2::boolean OR state='active')`,
    [id, admin],
  );
  if (!row) throw new HttpError("Source not found.", 404);
  return row;
}
export async function extractPages(bytes: Uint8Array, type: string) {
  if (type === "text/plain" || type === "text/markdown") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true })
        .decode(bytes)
        .replace(/^\uFEFF/, "");
      return [{ page: 1, text }];
    } catch {
      throw new HttpError("Save text documents as UTF-8 and retry.");
    }
  }
  if (
    type !== "application/pdf" ||
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  )
    throw new HttpError("Choose a text PDF, TXT, or Markdown file.");
  // Loaded only when a PDF is uploaded. The PDF library needs native files
  // that are not present on every server, and nothing else in the app, the
  // assistant included, should fail when it cannot load.
  let PDFParse: typeof import("pdf-parse").PDFParse;
  try {
    ({ PDFParse } = await import("pdf-parse"));
  } catch {
    throw new HttpError(
      "PDF reading is not available on this server. Upload a TXT or Markdown file instead.",
    );
  }
  const parser = new PDFParse({ data: bytes });
  try {
    const info = await parser.getInfo();
    if (info.total > 100)
      throw new HttpError("Choose a document of 100 pages or fewer.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      parser.getText(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new HttpError(
                "PDF extraction took too long. Use a smaller text PDF.",
              ),
            ),
          20000,
        );
      }),
    ]).finally(() => clearTimeout(timer));
    return result.pages.map((p) => ({ page: p.num, text: p.text }));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // The reason is logged for whoever runs the server. It is not shown to the user.
    console.error(
      "PDF extraction failed:",
      e instanceof Error ? e.message.slice(0, 300) : "unknown error",
    );
    throw new HttpError(
      "The PDF could not be read. Use an unlocked, text-based PDF.",
    );
  } finally {
    await parser.destroy();
  }
}
export function chunkPages(
  documentId: string,
  versionId: string,
  pages: { page: number; text: string }[],
): SourcePassage[] {
  const total = pages.reduce((n, p) => n + p.text.length, 0);
  if (total > 200_000)
    throw new HttpError("The extracted text is too large. Split the document.");
  if (total < 40)
    throw new HttpError(
      "No usable text was found. Scanned PDFs need OCR before upload.",
    );
  const chunks: SourcePassage[] = [];
  for (const page of pages) {
    const text = page.text.replace(/\r/g, "").trim();
    if (!text) continue;
    const paragraphs = text.split(/\n\s*\n/);
    let chunk = "";
    const push = () => {
      if (chunk.trim())
        chunks.push({
          id: `${versionId}:${chunks.length + 1}`,
          docId: documentId,
          label: `page ${page.page}`,
          text: chunk.trim(),
        });
      chunk = "";
    };
    for (const paragraph of paragraphs) {
      if (chunk.length + paragraph.length > 1600) push();
      if (paragraph.length > 1600) {
        for (let start = 0; start < paragraph.length; start += 1400) {
          chunk = paragraph.slice(start, start + 1600);
          push();
        }
      } else chunk += (chunk ? "\n\n" : "") + paragraph;
    }
    push();
  }
  return chunks;
}
export async function createSource(
  actorId: string,
  fields: Record<string, string>,
  file: File,
) {
  // Vercel refuses request bodies over 4.5 MB with its own error page, so the
  // app's limit stays below that and the user sees this message instead.
  if (file.size > 4_000_000 || file.size === 0)
    throw new HttpError("Choose a nonempty file up to 4 MB.");
  for (const key of [
    "title",
    "publisher",
    "revision",
    "sourceUrl",
    "scope",
    "credit",
  ])
    if (!fields[key]?.trim() || fields[key].length > 500)
      throw new HttpError(
        "Complete the title, publisher, revision, source URL, scope and usage credit.",
      );
  let url: URL;
  try {
    url = new URL(fields.sourceUrl);
  } catch {
    throw new HttpError("Enter an HTTPS source URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new HttpError("Enter an HTTPS source URL.");
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const type =
    extension === "pdf"
      ? "application/pdf"
      : extension === "txt"
        ? "text/plain"
        : extension === "md"
          ? "text/markdown"
          : "";
  if (!type) throw new HttpError("Use PDF, TXT, or MD format.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pages = await extractPages(bytes, type);
  const id = randomUUID();
  const documentId = fields.documentId || randomUUID();
  const passages = chunkPages(documentId, id, pages);
  const hash = createHash("sha256").update(bytes).digest("hex");
  return transaction(database(), async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(5563,4)");
    const actor = await client.query(
      "SELECT id FROM \"user\" WHERE id=$1 AND role='admin' AND COALESCE(banned,false)=false FOR SHARE",
      [actorId],
    );
    if (!actor.rowCount)
      throw new HttpError("Administrator access is required.", 403);
    if (
      fields.documentId &&
      !(
        await client.query(
          "SELECT id FROM source_versions WHERE document_id=$1",
          [documentId],
        )
      ).rowCount
    )
      throw new HttpError("Choose an existing source to replace.");
    const {
      rows: [next],
    } = await client.query(
      "SELECT COALESCE(max(version),0)+1 AS version FROM source_versions WHERE document_id=$1",
      [documentId],
    );
    if (
      (
        await client.query(
          "SELECT id FROM source_versions WHERE document_id=$1 AND content_hash=$2",
          [documentId, hash],
        )
      ).rowCount
    )
      throw new HttpError(
        "This file is already a version of that source.",
        409,
      );
    await client.query(
      "INSERT INTO source_versions(id,document_id,version,title,publisher,revision,source_url,scope,credit,origin,state,passages,content_hash,file_name,file_type,file_bytes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'upload','draft',$10,$11,$12,$13,$14,$15)",
      [
        id,
        documentId,
        next.version,
        fields.title.trim(),
        fields.publisher.trim(),
        fields.revision.trim(),
        url.toString(),
        fields.scope.trim(),
        fields.credit.trim(),
        JSON.stringify(passages),
        hash,
        file.name.slice(0, 180),
        type,
        Buffer.from(bytes),
        actorId,
      ],
    );
    await client.query(
      "INSERT INTO audit_log(actor_id,action,target_id) VALUES($1,'source.draft_created',$2)",
      [actorId, id],
    );
    return { id, version: next.version, passageCount: passages.length };
  });
}
export async function transitionSource(
  actorId: string,
  id: string,
  state: "active" | "retired",
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new HttpError("Source not found.", 404);
  await transaction(database(), async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(5563,4)");
    const actor = await client.query(
      "SELECT id FROM \"user\" WHERE id=$1 AND role='admin' AND COALESCE(banned,false)=false FOR SHARE",
      [actorId],
    );
    if (!actor.rowCount)
      throw new HttpError("Administrator access is required.", 403);
    const {
      rows: [row],
    } = await client.query(
      "SELECT document_id,state FROM source_versions WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!row) throw new HttpError("Source not found.", 404);
    if (state === "active")
      await client.query(
        "UPDATE source_versions SET state='retired',retired_at=now() WHERE document_id=$1 AND state='active' AND id<>$2",
        [row.document_id, id],
      );
    await client.query(
      "UPDATE source_versions SET state=$2,activated_at=CASE WHEN $2='active' THEN now() ELSE activated_at END,retired_at=CASE WHEN $2='retired' THEN now() ELSE NULL END WHERE id=$1",
      [id, state],
    );
    await client.query(
      "INSERT INTO audit_log(actor_id,action,target_id) VALUES($1,$2,$3)",
      [actorId, `source.${state === "active" ? "activated" : "retired"}`, id],
    );
  });
}

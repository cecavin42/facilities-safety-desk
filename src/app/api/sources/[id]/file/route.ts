import { requireUser, failure, HttpError } from "@/lib/server-access";
import { database } from "@/lib/database";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const id = (await context.params).id;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      throw new HttpError("Source not found.", 404);
    const {
      rows: [row],
    } = await database().query(
      "SELECT file_name,file_type,file_bytes FROM source_versions WHERE id=$1 AND ($2::boolean OR state='active')",
      [id, user.role === "admin"],
    );
    if (!row?.file_bytes)
      throw new HttpError("Original uploaded file not found.", 404);
    const filename = encodeURIComponent(row.file_name || "source").replace(
      /['()*]/g,
      (c) => "%" + c.charCodeAt(0).toString(16),
    );
    return new Response(new Uint8Array(row.file_bytes), {
      headers: {
        "Content-Type": row.file_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

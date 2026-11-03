import { database } from "@/lib/database";
import { changeStatus } from "@/lib/db/repository";
import { failure, isObject, readJson, RequestError } from "@/lib/api";
import { STATUSES, type Status } from "@/lib/options";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[RS]-\d{1,20}$/.test(id)) throw new RequestError("Invalid record ID.");
    const body = await readJson(request);
    if (!isObject(body) || !STATUSES.includes(body.status as Status)) throw new RequestError("Invalid status.");
    const record = await changeStatus(database(), id, body.status as Status);
    if (!record) throw new RequestError("Record not found.", 404);
    return Response.json({ record });
  } catch (error) { return failure(error); }
}

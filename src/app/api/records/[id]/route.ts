import {
  requireUser,
  readBody,
  json,
  failure,
  HttpError,
} from "@/lib/server-access";
import { scopedRecord, updateStatus } from "@/lib/authorized-data";
import { STATUSES, type Status } from "@/lib/options";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return json(
      await scopedRecord(await requireUser(request), (await context.params).id),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireUser(request, true);
    const body = await readBody(request, 2048);
    if (
      !STATUSES.includes(body.status as Status) ||
      typeof body.expectedUpdatedAt !== "string" ||
      !Number.isFinite(Date.parse(body.expectedUpdatedAt))
    )
      throw new HttpError("A status and current report version are required.");
    return json(
      await updateStatus(
        user,
        (await context.params).id,
        body.status as Status,
        body.expectedUpdatedAt,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

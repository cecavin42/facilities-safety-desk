import {
  requireFreshAdmin,
  readBody,
  json,
  failure,
  HttpError,
} from "@/lib/server-access";
import { updateAccount } from "@/lib/authorized-data";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireFreshAdmin(request);
    const body = await readBody(request, 2048);
    if (typeof body.role !== "string" || typeof body.active !== "boolean")
      throw new HttpError("Role and active status are required.");
    await updateAccount(
      actor,
      (await context.params).id,
      body.role,
      body.active,
    );
    return json({ success: true });
  } catch (error) {
    return failure(error);
  }
}

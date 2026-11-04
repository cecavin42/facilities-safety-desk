import {
  requireUser,
  requireFreshAdmin,
  readBody,
  json,
  failure,
  HttpError,
} from "@/lib/server-access";
import { sourceDetail, transitionSource } from "@/lib/sources";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    return json(
      await sourceDetail((await context.params).id, user.role === "admin"),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireFreshAdmin(request);
    const body = await readBody(request, 2048);
    if (
      !["active", "retired"].includes(body.state as string) ||
      body.reviewed !== true
    )
      throw new HttpError("Review the source and choose activate or retire.");
    await transitionSource(
      user.id,
      (await context.params).id,
      body.state as "active" | "retired",
    );
    return json({ success: true });
  } catch (error) {
    return failure(error);
  }
}

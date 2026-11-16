import {
  requireUser,
  requireFreshAdmin,
  readBody,
  json,
  failure,
  HttpError,
} from "@/lib/server-access";
import { sourceDetail, transitionSource } from "@/lib/sources";
// With semantic search on, activating a version may spend up to 20 seconds
// making embeddings that are still missing.
export const maxDuration = 60;
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

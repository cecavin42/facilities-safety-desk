import { requireUser, json, failure } from "@/lib/server-access";
import { listSources } from "@/lib/sources";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return json(await listSources(user.role === "admin"));
  } catch (error) {
    return failure(error);
  }
}

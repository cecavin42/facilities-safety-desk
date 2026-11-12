import {
  requireFreshAdmin,
  readBody,
  json,
  failure,
} from "@/lib/server-access";
import { issueRecovery } from "@/lib/recovery";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireFreshAdmin(request);
    await readBody(request, 1024);
    return json(await issueRecovery(actor.id, (await context.params).id));
  } catch (error) {
    return failure(error);
  }
}

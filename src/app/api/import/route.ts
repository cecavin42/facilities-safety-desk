import { requireUser, readBody, json, failure } from "@/lib/server-access";
import { createRecords } from "@/lib/authorized-data";
import { recordRequest } from "@/lib/record-request";
export async function POST(request: Request) {
  try {
    const user = await requireUser(request, true);
    const raw = await readBody(request);
    const body = recordRequest(raw, 5000);
    return json(
      await createRecords(
        user,
        body.records,
        body.requestId,
        true,
        raw.allowDuplicates === true,
      ),
      201,
    );
  } catch (error) {
    return failure(error);
  }
}

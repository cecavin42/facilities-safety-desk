import { requireUser, readBody, json, failure } from "@/lib/server-access";
import { createRecords } from "@/lib/authorized-data";
import { recordRequest } from "@/lib/record-request";
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = recordRequest(await readBody(request, 16_384), 1);
    return json(await createRecords(user, body.records, body.requestId), 201);
  } catch (error) {
    return failure(error);
  }
}

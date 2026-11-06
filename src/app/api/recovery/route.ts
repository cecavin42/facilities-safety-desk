import { readBody, json, failure, HttpError } from "@/lib/server-access";
import { redeemRecovery } from "@/lib/recovery";
export async function POST(request: Request) {
  try {
    const body = await readBody(request, 4096);
    if (typeof body.token !== "string" || typeof body.password !== "string")
      throw new HttpError("A recovery link and new password are required.");
    await redeemRecovery(body.token, body.password);
    return json({ success: true });
  } catch (error) {
    return failure(error);
  }
}

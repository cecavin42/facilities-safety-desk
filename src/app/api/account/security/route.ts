import { requireUser, json, failure } from "@/lib/server-access";
import { database } from "@/lib/database";
import { mfaAvailable } from "@/lib/mfa";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const {
      rows: [row],
    } = await database().query(
      'SELECT COALESCE("twoFactorEnabled",false) AS enabled FROM "user" WHERE id=$1',
      [user.id],
    );
    return json({ ...row, available: mfaAvailable() });
  } catch (error) {
    return failure(error);
  }
}

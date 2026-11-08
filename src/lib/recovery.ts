import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { database } from "./database";
import { transaction } from "./db/repository";
import { HttpError } from "./server-access";
import { authOrigins } from "./auth-url";
export async function issueRecovery(actorId: string, userId: string) {
  if (authOrigins().preview)
    throw new HttpError(
      "Recovery links are issued on the live site, not on a preview.",
      403,
    );
  if (actorId === userId)
    throw new HttpError("Another administrator must authorize your recovery.");
  return transaction(database(), async (client) => {
    const actor = await client.query(
      "SELECT id FROM \"user\" WHERE id=$1 AND role='admin' AND COALESCE(banned,false)=false FOR SHARE",
      [actorId],
    );
    if (!actor.rowCount)
      throw new HttpError("Administrator access is required.", 403);
    const target = await client.query(
      'SELECT id FROM "user" WHERE id=$1 AND COALESCE(banned,false)=false FOR UPDATE',
      [userId],
    );
    if (!target.rowCount)
      throw new HttpError("Choose an active approved account.", 400);
    await client.query(
      "DELETE FROM account_recovery WHERE user_id=$1 AND used_at IS NULL",
      [userId],
    );
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    const {
      rows: [row],
    } = await client.query(
      "INSERT INTO account_recovery(token_hash,user_id,issued_by,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes') RETURNING expires_at",
      [hash, userId, actorId],
    );
    await client.query(
      "INSERT INTO audit_log(actor_id,action,target_id) VALUES($1,'account.recovery_issued',$2)",
      [actorId, userId],
    );
    return {
      url: `${new URL(authOrigins().base!).origin}/recover#token=${token}`,
      expiresAt: row.expires_at,
    };
  });
}
export async function redeemRecovery(token: string, password: string) {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    password.length < 15 ||
    password.length > 128
  )
    throw new HttpError(
      "Use a valid recovery link and a password of 15–128 characters.",
    );
  const hash = createHash("sha256").update(token).digest("hex");
  await transaction(database(), async (client) => {
    const {
      rows: [row],
    } = await client.query(
      'SELECT r.user_id FROM account_recovery r JOIN "user" u ON u.id=r.user_id WHERE r.token_hash=$1 AND r.used_at IS NULL AND r.expires_at>now() AND COALESCE(u.banned,false)=false FOR UPDATE OF r,u',
      [hash],
    );
    if (!row)
      throw new HttpError(
        "This recovery link is invalid, expired, or already used.",
        400,
      );
    const passwordHash = await hashPassword(password);
    const result = await client.query(
      'UPDATE "account" SET password=$2,"updatedAt"=now() WHERE "userId"=$1 AND "providerId"=\'credential\'',
      [row.user_id, passwordHash],
    );
    if (!result.rowCount)
      throw new HttpError("This account cannot use password recovery.");
    await client.query('DELETE FROM "session" WHERE "userId"=$1', [
      row.user_id,
    ]);
    await client.query(
      "UPDATE account_recovery SET used_at=now() WHERE user_id=$1 AND used_at IS NULL",
      [row.user_id],
    );
    await client.query(
      "INSERT INTO audit_log(action,target_id) VALUES('account.password_recovered',$1)",
      [row.user_id],
    );
  });
}

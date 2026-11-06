import { requireUser, json, failure } from "@/lib/server-access";
import { database } from "@/lib/database";
export async function GET(request: Request) {
  try {
    await requireUser(request, true);
    return json(
      (
        await database().query(
          'SELECT a.id,a.action,COALESCE(t.name,sv.title,a.target_id) AS "targetId",a.details,a.occurred_at AS "occurredAt",u.name AS actor FROM audit_log a LEFT JOIN "user" u ON u.id=a.actor_id LEFT JOIN "user" t ON t.id=a.target_id LEFT JOIN source_versions sv ON sv.id::text=a.target_id ORDER BY a.id DESC LIMIT 100',
        )
      ).rows,
    );
  } catch (error) {
    return failure(error);
  }
}

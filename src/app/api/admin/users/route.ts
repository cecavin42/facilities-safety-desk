import {
  requireUser,
  requireFreshAdmin,
  readBody,
  json,
  failure,
  HttpError,
} from "@/lib/server-access";
import { database } from "@/lib/database";
import { auth } from "@/lib/auth";
export async function GET(request: Request) {
  try {
    await requireUser(request, true);
    return json(
      (
        await database().query(
          'SELECT id,name,email,role,COALESCE(banned,false) AS banned FROM "user" ORDER BY name',
        )
      ).rows,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requireFreshAdmin(request);
    const body = await readBody(request, 4096);
    if (
      typeof body.name !== "string" ||
      body.name.trim().length < 2 ||
      body.name.length > 80 ||
      typeof body.email !== "string" ||
      body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
      typeof body.password !== "string" ||
      body.password.length < 15 ||
      body.password.length > 128 ||
      !["user", "admin"].includes(body.role as string)
    )
      throw new HttpError(
        "Enter a name, email, allowed role and password of 15–128 characters.",
      );
    const email = body.email.trim().toLowerCase();
    if (
      (await database().query('SELECT id FROM "user" WHERE email=$1', [email]))
        .rowCount
    )
      throw new HttpError("An account with that email already exists.", 409);
    const created = await auth().api.createUser({
      headers: request.headers,
      body: {
        name: body.name.trim(),
        email,
        password: body.password,
        role: body.role as "user" | "admin",
      },
    });
    await database().query(
      "INSERT INTO audit_log(actor_id,action,target_id) VALUES($1,'account.created',$2)",
      [actor.id, created.user.id],
    );
    return json({ id: created.user.id }, 201);
  } catch (error) {
    return failure(error);
  }
}

import { ask } from "@/lib/search";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 500) {
    return Response.json({ error: "Please enter a question of 1 to 500 characters." }, { status: 400 });
  }
  return Response.json(ask(question));
}

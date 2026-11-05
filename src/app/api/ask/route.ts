import { ask } from "@/lib/search";
import { database } from "@/lib/database";
import { saveQuestion } from "@/lib/db/repository";
import { failure, isObject, readJson, RequestError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const question = isObject(body) && typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 500) throw new RequestError("Please enter a question of 1 to 500 characters.");
    const result = ask(question);
    await saveQuestion(database(), question, result.answered);
    return Response.json(result);
  } catch (error) {
    return failure(error);
  }
}

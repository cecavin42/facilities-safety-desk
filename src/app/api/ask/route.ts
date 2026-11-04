import { answerQuestion } from "@/lib/assistant/service";
import {
  requireUser,
  readBody,
  json,
  failure,
  HttpError,
} from "@/lib/server-access";
import { database } from "@/lib/database";
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readBody(request, 4096);
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 500)
      throw new HttpError("Please enter a question of 1 to 500 characters.");
    const result = await answerQuestion(question, request.signal);
    try {
      await database().query(
        "INSERT INTO question_log(question,answered,asked_by) VALUES($1,$2,$3)",
        [question, result.answered, user.id],
      );
    } catch {
      return json({
        ...result,
        notice: [
          result.notice,
          "This response could not be added to the question statistics.",
        ]
          .filter(Boolean)
          .join(" "),
      });
    }
    return json(result);
  } catch (error) {
    return failure(error);
  }
}

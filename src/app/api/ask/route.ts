import { answerWithTrace } from "@/lib/assistant/service";
import {
  requireUser,
  readBody,
  json,
  failure,
  HttpError,
} from "@/lib/server-access";
import { activeCatalog } from "@/lib/sources";
import { answerFromTopics } from "@/lib/assistant/answer";
import { database } from "@/lib/database";
// A model-written answer waits on one outside request (15 seconds at most by
// default). Without a model key the route answers in milliseconds.
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readBody(request, 4096);
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 500)
      throw new HttpError("Please enter a question of 1 to 500 characters.");
    const catalog = await activeCatalog();
    const { answer, trace } = await answerWithTrace(
      question,
      request.signal,
      catalog,
    );
    let result = answer;
    const latest = await activeCatalog();
    if (latest.version !== catalog.version)
      result = {
        ...answerFromTopics(question, undefined, latest),
        notice:
          "The source collection changed while this request was running. This response uses the latest active sources.",
      };
    try {
      // The model columns record what each question cost, whether or not the
      // written answer was used.
      await database().query(
        "INSERT INTO question_log(question,answered,asked_by,model_written,model,model_outcome,input_tokens,output_tokens) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          question,
          result.answered,
          user.id,
          result.method === "ai-written",
          trace?.model || null,
          trace ? trace.outcome : null,
          trace ? trace.inputTokens : null,
          trace ? trace.outputTokens : null,
        ],
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

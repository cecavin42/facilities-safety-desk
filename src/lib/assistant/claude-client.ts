import "server-only";
import { claudeSettings, type ClaudeSettings } from "./claude-settings";
import { WriterError, type ModelUsage, type Transport } from "./written-answer";

// Room for the model's own reasoning plus a short structured answer. A reply
// that runs out of room is discarded, never shown half-finished.
const MAX_OUTPUT_TOKENS = 4096;

// The only file that loads the Claude SDK, and only once a key is set.
export function claudeTransport(
  settings: Extract<ClaudeSettings, { on: true }>,
): Transport {
  let ready: Promise<{
    client: import("@anthropic-ai/sdk").default;
    sdk: typeof import("@anthropic-ai/sdk");
  }>;
  const load = () =>
    (ready ??= import("@anthropic-ai/sdk").then((sdk) => ({
      sdk,
      client: new sdk.default({
        apiKey: settings.apiKey,
        // Always passed, so ANTHROPIC_BASE_URL in the environment is ignored.
        baseURL: settings.baseURL,
        timeout: settings.timeoutMs,
        // A retry would outlast the request. A failed call falls back to the
        // passages instead.
        maxRetries: 0,
      }),
    })));

  return async (call, signal) => {
    const { client, sdk } = await load();
    const Anthropic = sdk.default;
    let response: import("@anthropic-ai/sdk").default.Message;
    try {
      response = await client.messages.create(
        {
          model: settings.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: call.system,
          messages: [{ role: "user", content: call.user }],
          output_config: {
            effort: settings.effort,
            format: { type: "json_schema", schema: call.schema },
          },
        },
        { signal },
      );
    } catch (error) {
      // Most specific first. The message text is never read or logged.
      if (error instanceof Anthropic.APIUserAbortError)
        throw new WriterError("aborted");
      if (error instanceof Anthropic.APIConnectionTimeoutError)
        throw new WriterError("timeout");
      if (error instanceof Anthropic.APIConnectionError)
        throw new WriterError("network");
      if (
        error instanceof Anthropic.AuthenticationError ||
        error instanceof Anthropic.PermissionDeniedError
      )
        throw new WriterError("auth");
      if (error instanceof Anthropic.NotFoundError)
        throw new WriterError("model-not-found");
      if (error instanceof Anthropic.RateLimitError)
        throw new WriterError("rate-limit");
      if (error instanceof Anthropic.BadRequestError)
        throw new WriterError("bad-request");
      if (error instanceof Anthropic.InternalServerError)
        throw new WriterError("server");
      if (error instanceof Anthropic.APIError)
        throw new WriterError("api-error");
      throw new WriterError("error");
    }
    const usage: ModelUsage = {
      model: response.model,
      inputTokens:
        response.usage.input_tokens +
        (response.usage.cache_creation_input_tokens ?? 0) +
        (response.usage.cache_read_input_tokens ?? 0),
      outputTokens: response.usage.output_tokens,
    };
    // Check why the model stopped before reading what it wrote.
    if (response.stop_reason === "refusal")
      throw new WriterError("refusal", usage);
    if (response.stop_reason !== "end_turn")
      throw new WriterError("cut-off", usage);
    // A reply can begin with reasoning blocks; the answer is the text.
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("");
    if (!text.trim()) throw new WriterError("empty", usage);
    return { text, ...usage };
  };
}

let cached: { key: string; transport: Transport } | undefined;

// The transport the running app uses, or null when the feature is off.
export function configuredTransport(
  env: NodeJS.ProcessEnv = process.env,
): Transport | null {
  const settings = claudeSettings(env);
  if (!settings.on) return null;
  const key = [
    settings.apiKey,
    settings.baseURL,
    settings.model,
    settings.effort,
    settings.timeoutMs,
  ].join("\0");
  if (cached?.key !== key)
    cached = { key, transport: claudeTransport(settings) };
  return cached.transport;
}

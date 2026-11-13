// Settings for model-written answers. The feature is off unless
// ASSISTANT_CLAUDE_API_KEY is set. The names are this app's own, so a key that
// happens to be on a developer's machine is never picked up by a test run.
// Values are read here and never printed.
export const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const EFFORTS = ["low", "medium", "high"] as const;

export type ClaudeSettings =
  | { on: false; problems: string[] }
  | {
      on: true;
      problems: [];
      apiKey: string;
      baseURL: string;
      model: string;
      effort: (typeof EFFORTS)[number];
      timeoutMs: number;
    };

export function claudeSettings(
  env: NodeJS.ProcessEnv = process.env,
): ClaudeSettings {
  const problems: string[] = [];
  // A browser-visible setting would publish the key to every visitor.
  for (const name of Object.keys(env))
    if (/^NEXT_PUBLIC_.*(CLAUDE|ANTHROPIC)/i.test(name) && env[name])
      problems.push(
        `${name} would be sent to every browser; remove it and use ASSISTANT_CLAUDE_API_KEY`,
      );
  const apiKey = env.ASSISTANT_CLAUDE_API_KEY?.trim();
  if (!apiKey) return { on: false, problems };

  let baseURL = DEFAULT_BASE_URL;
  const base = env.ASSISTANT_CLAUDE_BASE_URL?.trim();
  if (base) {
    try {
      const url = new URL(base);
      const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
      // Plain http would send the key unencrypted. Only a stand-in on this
      // machine may use it.
      if (url.protocol === "https:" || (url.protocol === "http:" && local))
        baseURL = url.toString().replace(/\/$/, "");
      else problems.push("ASSISTANT_CLAUDE_BASE_URL must start with https://");
    } catch {
      problems.push("ASSISTANT_CLAUDE_BASE_URL is not a valid URL");
    }
  }
  const model = env.ASSISTANT_CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL;
  if (!/^[a-z0-9][a-z0-9.:@_-]{2,80}$/i.test(model))
    problems.push("ASSISTANT_CLAUDE_MODEL is not a model name");
  const effort = env.ASSISTANT_CLAUDE_EFFORT?.trim().toLowerCase() || "low";
  if (!(EFFORTS as readonly string[]).includes(effort))
    problems.push("ASSISTANT_CLAUDE_EFFORT must be low, medium or high");
  const timeout = env.ASSISTANT_CLAUDE_TIMEOUT_MS?.trim();
  const timeoutMs = timeout ? Number(timeout) : 15_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 25_000)
    problems.push("ASSISTANT_CLAUDE_TIMEOUT_MS must be 1000 to 25000");
  if (problems.length) return { on: false, problems };
  return {
    on: true,
    problems: [],
    apiKey,
    baseURL,
    model,
    effort: effort as (typeof EFFORTS)[number],
    timeoutMs,
  };
}

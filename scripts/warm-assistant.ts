export async function warmAssistant() {
  const model = process.env.ASSISTANT_OLLAMA_MODEL;
  if (!model) return false;
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "",
        stream: false,
        keep_alive: "15m",
        options: { num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(60000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

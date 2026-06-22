import { getPrisma } from "$lib/server/db/index.js";

export interface LlmConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function getSettingsBlob(): Promise<Record<string, unknown>> {
  try {
    const row = await getPrisma().settings.findFirst({ where: { id: "singleton" } });
    return (row?.data ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function resolveLlmConfig(): Promise<LlmConfig> {
  const settings = await getSettingsBlob();

  const apiKey =
    (settings.llmApiKey as string | undefined)?.trim() ||
    process.env.LLM_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "";

  const model =
    (settings.model as string | undefined)?.trim() ||
    process.env.MODEL?.trim() ||
    "openai/gpt-4o-mini";

  const baseUrl =
    (settings.llmBaseUrl as string | undefined)?.trim() ||
    process.env.LLM_BASE_URL?.trim() ||
    "https://openrouter.ai/api/v1";

  return { apiKey, model, baseUrl };
}

export async function* streamChat(
  messages: ChatMessage[],
  config: LlmConfig,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      max_tokens: 2048,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM error ${res.status}: ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // Skip malformed lines
      }
    }
  }
}

export function buildGhostwriterSystemPrompt(job: {
  title: string | null;
  employer: string | null;
  jobDescription: string | null;
  scoreReasoning: string | null;
  tailoredSummary: string | null;
}): string {
  const descPreview = job.jobDescription
    ? job.jobDescription.slice(0, 3000)
    : "Not available";

  return [
    "You are Ghostwriter, a career writing assistant embedded in Job-Ops.",
    "You help the user craft compelling job application materials: cover letters, emails, LinkedIn messages, interview prep, and any other application content.",
    "",
    "## Job Context",
    `Title: ${job.title ?? "Unknown"}`,
    `Employer: ${job.employer ?? "Unknown"}`,
    job.tailoredSummary ? `AI Tailored Summary: ${job.tailoredSummary}` : "",
    job.scoreReasoning ? `AI Reasoning: ${job.scoreReasoning.slice(0, 500)}` : "",
    "",
    "## Job Description (excerpt)",
    descPreview,
    "",
    "## Instructions",
    "- Be concise and direct. Lead with the strongest points.",
    "- Use active voice and avoid business jargon.",
    "- Tailor all output specifically to this job and employer.",
    "- Ask clarifying questions only if truly necessary.",
  ]
    .filter((l) => l !== null)
    .join("\n")
    .trim();
}

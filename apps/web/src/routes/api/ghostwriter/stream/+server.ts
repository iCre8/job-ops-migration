/**
 * GET /api/ghostwriter/stream?runId=<id>
 *
 * SSE endpoint. Picks up a ChatRun by ID, calls the LLM with the thread's
 * message history, streams tokens to the client, and persists the full
 * assistant reply to the ChatThread when done.
 *
 * The tRPC `chat.sendMessage` mutation creates the ChatRun and returns its ID.
 * The client then opens this SSE connection to receive the streamed response.
 *
 * SSE events:
 *   data: {"type":"token","token":"…"}
 *   data: {"type":"done","messageId":"…"}
 *   data: {"type":"error","message":"…"}
 */

import { randomUUID } from "node:crypto";
import { getPrisma } from "$lib/server/db/index.js";
import {
  buildGhostwriterSystemPrompt,
  resolveLlmConfig,
  streamChat,
} from "$lib/server/services/llm/index.js";
import type { RequestHandler } from "./$types.js";

const enc = new TextEncoder();

function sse(data: object): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const GET: RequestHandler = async ({ url, request, locals }) => {
  if (!locals.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const runId = url.searchParams.get("runId");
  if (!runId) {
    return new Response("Missing runId", { status: 400 });
  }

  const run = await getPrisma().chatRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "running") {
    return new Response("Run not found or already completed", { status: 404 });
  }

  const thread = await getPrisma().chatThread.findUnique({
    where: { id: run.threadId },
    include: { job: true },
  });
  if (!thread) {
    return new Response("Thread not found", { status: 404 });
  }

  const config = await resolveLlmConfig();
  const systemPrompt = buildGhostwriterSystemPrompt(thread.job);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...thread.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(enc.encode(": ok\n\n"));

      const tokens: string[] = [];
      const abortController = new AbortController();

      request.signal.addEventListener("abort", () => abortController.abort());

      try {
        for await (const token of streamChat(messages, config, abortController.signal)) {
          tokens.push(token);
          controller.enqueue(sse({ type: "token", token }));
        }

        const fullContent = tokens.join("");
        const assistantMessageId = randomUUID();
        const now = new Date();

        await Promise.all([
          getPrisma().chatThread.update({
            where: { id: thread.id },
            data: {
              messages: {
                push: {
                  id: assistantMessageId,
                  role: "assistant",
                  content: fullContent,
                  createdAt: now,
                },
              },
            },
          }),
          getPrisma().chatRun.update({
            where: { id: runId },
            data: {
              status: "completed",
              model: config.model,
              outputTokens: tokens.length,
              completedAt: now,
            },
          }),
        ]);

        controller.enqueue(sse({ type: "done", messageId: assistantMessageId }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "LLM error";
        controller.enqueue(sse({ type: "error", message }));
        await getPrisma().chatRun.update({
          where: { id: runId },
          data: { status: "failed", error: message, completedAt: new Date() },
        }).catch(() => undefined);
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
};

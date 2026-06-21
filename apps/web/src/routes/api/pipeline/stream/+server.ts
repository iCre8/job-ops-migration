/**
 * GET /api/pipeline/stream
 *
 * Server-Sent Events endpoint. Streams PipelineEvent objects to the client
 * as long as the connection is held open.
 *
 * Query params:
 *   ?runId=<id>  — filter to a specific pipeline run (optional; omit to receive all)
 *
 * SSE wire format:
 *   data: {"type":"progress","runId":"…","message":"…"}\n\n
 *
 * The connection is closed when:
 *   - The client closes the EventSource (request signal aborts), or
 *   - A "complete" or "error" event is received for the subscribed runId.
 */

import { getPipelineEvents, type PipelineEvent } from "$lib/server/infra/pipeline-events.js";
import type { RequestHandler } from "./$types";

const enc = new TextEncoder();

function sseChunk(data: PipelineEvent): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const GET: RequestHandler = ({ url, request }) => {
  const runId = url.searchParams.get("runId") ?? null;
  const emitter = getPipelineEvents();

  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;

      // Flush HTTP headers immediately — Node.js delays sending headers until
      // the first write. Without this, clients see no response until an event
      // fires (which may never happen if no pipeline is running).
      c.enqueue(enc.encode(": ok\n\n"));

      const listener = (event: PipelineEvent) => {
        if (runId !== null && event.runId !== runId) return;
        try {
          controller.enqueue(sseChunk(event));
        } catch {
          // Controller already closed — remove listener silently
          emitter.off("event", listener);
        }
        // Auto-close on terminal events for the watched run
        if (runId !== null && (event.type === "complete" || event.type === "error")) {
          emitter.off("event", listener);
          try { controller.close(); } catch { /* already closed */ }
        }
      };

      emitter.on("event", listener);

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        emitter.off("event", listener);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering when reverse-proxied
    },
  });
};

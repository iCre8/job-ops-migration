/**
 * Pipeline event emitter — singleton EventEmitter that broadcasts real-time
 * progress events to all active SSE connections.
 *
 * Usage (server-side pipeline code):
 *   import { emitPipelineEvent } from "$lib/server/infra/pipeline-events.js";
 *   emitPipelineEvent({ type: "progress", runId, message: "Scraping LinkedIn…" });
 *
 * The SSE route subscribes/unsubscribes via pipelineEvents.on/off("event", …).
 */

import { EventEmitter } from "node:events";

export type PipelineEventType = "start" | "progress" | "complete" | "error";

export type PipelineEvent = {
  type: PipelineEventType;
  runId: string;
  message: string;
  jobsFound?: number;
  jobsScored?: number;
};

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance: EventEmitter | null = null;

export function getPipelineEvents(): EventEmitter {
  if (!_instance) {
    _instance = new EventEmitter();
    // Allow many concurrent SSE connections without Node's "possible memory leak"
    // warning — each active client adds one listener.
    _instance.setMaxListeners(200);
  }
  return _instance;
}

/** Reset singleton — for use in tests only. */
export function resetPipelineEvents(): void {
  _instance = null;
}

// ── Convenience emitter ───────────────────────────────────────────────────────

export function emitPipelineEvent(data: PipelineEvent): void {
  getPipelineEvents().emit("event", data);
}

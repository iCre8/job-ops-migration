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
  _replayBuffer.clear();
}

// ── Replay buffer ─────────────────────────────────────────────────────────────
// Stores the last REPLAY_MAX events per runId so new SSE connections can
// receive recent history rather than starting from a blank slate.

const REPLAY_MAX = 50;
const _replayBuffer = new Map<string, PipelineEvent[]>();

function bufferEvent(data: PipelineEvent): void {
  const events = _replayBuffer.get(data.runId) ?? [];
  events.push(data);
  if (events.length > REPLAY_MAX) events.shift();
  _replayBuffer.set(data.runId, events);
  // Clear buffer after a terminal event — run is done, no need to keep history
  if (data.type === "complete" || data.type === "error") {
    setTimeout(() => _replayBuffer.delete(data.runId), 30_000);
  }
}

/** Returns buffered events for a run, oldest-first. */
export function getReplayEvents(runId: string): PipelineEvent[] {
  return _replayBuffer.get(runId) ?? [];
}

// ── Convenience emitter ───────────────────────────────────────────────────────

export function emitPipelineEvent(data: PipelineEvent): void {
  bufferEvent(data);
  getPipelineEvents().emit("event", data);
}

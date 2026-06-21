/**
 * Unit tests — pipeline-events singleton
 *
 * Verifies the EventEmitter singleton lifecycle, typed emit/subscribe, and
 * the resetPipelineEvents() test helper.
 */

import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitPipelineEvent,
  getPipelineEvents,
  resetPipelineEvents,
  type PipelineEvent,
} from "../../../src/lib/server/infra/pipeline-events.js";

afterEach(() => {
  resetPipelineEvents();
});

// ── Singleton ─────────────────────────────────────────────────────────────────

describe("getPipelineEvents — singleton", () => {
  it("returns an EventEmitter instance", () => {
    const emitter = getPipelineEvents();
    expect(emitter).toBeInstanceOf(EventEmitter);
  });

  it("returns the same instance on repeated calls", () => {
    const a = getPipelineEvents();
    const b = getPipelineEvents();
    expect(a).toBe(b);
  });

  it("sets maxListeners to 200", () => {
    const emitter = getPipelineEvents();
    expect(emitter.getMaxListeners()).toBe(200);
  });
});

// ── resetPipelineEvents ───────────────────────────────────────────────────────

describe("resetPipelineEvents", () => {
  it("creates a new instance after reset", () => {
    const before = getPipelineEvents();
    resetPipelineEvents();
    const after = getPipelineEvents();
    expect(after).not.toBe(before);
  });
});

// ── emitPipelineEvent ─────────────────────────────────────────────────────────

describe("emitPipelineEvent", () => {
  it("triggers listeners registered on the 'event' channel", () => {
    const listener = vi.fn();
    getPipelineEvents().on("event", listener);

    const evt: PipelineEvent = { type: "start", runId: "run1", message: "Pipeline started" };
    emitPipelineEvent(evt);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(evt);
  });

  it("delivers correct event payload", () => {
    const received: PipelineEvent[] = [];
    getPipelineEvents().on("event", (e: PipelineEvent) => received.push(e));

    const evt: PipelineEvent = {
      type: "progress",
      runId: "run2",
      message: "Scraped 10 jobs",
      jobsFound: 10,
    };
    emitPipelineEvent(evt);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("progress");
    expect(received[0].jobsFound).toBe(10);
  });

  it("delivers to multiple listeners", () => {
    const a = vi.fn();
    const b = vi.fn();
    const emitter = getPipelineEvents();
    emitter.on("event", a);
    emitter.on("event", b);

    emitPipelineEvent({ type: "complete", runId: "run3", message: "Done" });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("does not deliver to removed listeners", () => {
    const listener = vi.fn();
    const emitter = getPipelineEvents();
    emitter.on("event", listener);
    emitter.off("event", listener);

    emitPipelineEvent({ type: "error", runId: "run4", message: "Failed" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("supports all PipelineEventType values", () => {
    const received: string[] = [];
    getPipelineEvents().on("event", (e: PipelineEvent) => received.push(e.type));

    const types = ["start", "progress", "complete", "error"] as const;
    for (const type of types) {
      emitPipelineEvent({ type, runId: "run5", message: type });
    }

    expect(received).toEqual(["start", "progress", "complete", "error"]);
  });
});

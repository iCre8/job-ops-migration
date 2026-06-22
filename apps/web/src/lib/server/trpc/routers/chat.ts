import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getPrisma } from "$lib/server/db/index.js";
import { protectedProcedure, router } from "../init.js";

export const chatRouter = router({
  threads: router({
    list: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        return getPrisma().chatThread.findMany({
          where: { jobId: input.jobId },
          orderBy: { updatedAt: "desc" },
          select: { id: true, jobId: true, createdAt: true, updatedAt: true, messages: true },
        });
      }),

    create: protectedProcedure
      .input(z.object({ jobId: z.string() }))
      .mutation(async ({ input }) => {
        const job = await getPrisma().job.findUnique({ where: { id: input.jobId } });
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        return getPrisma().chatThread.create({ data: { jobId: input.jobId } });
      }),

    reset: protectedProcedure
      .input(z.object({ threadId: z.string() }))
      .mutation(async ({ input }) => {
        const thread = await getPrisma().chatThread.findUnique({ where: { id: input.threadId } });
        if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
        return getPrisma().chatThread.update({ where: { id: input.threadId }, data: { messages: [] } });
      }),

    delete: protectedProcedure
      .input(z.object({ threadId: z.string() }))
      .mutation(async ({ input }) => {
        await getPrisma().chatThread.delete({ where: { id: input.threadId } });
        return { ok: true };
      }),
  }),

  sendMessage: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      content: z.string().min(1).max(8000),
      // Optional context — note/doc IDs whose content is prepended to the system prompt
      contextNoteIds: z.array(z.string()).optional(),
      contextDocumentIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const thread = await getPrisma().chatThread.findUnique({
        where: { id: input.threadId },
        include: { job: true },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });

      const userMessage = {
        id: randomUUID(),
        role: "user" as const,
        content: input.content,
        createdAt: new Date(),
      };

      const run = await getPrisma().chatRun.create({
        data: {
          threadId: input.threadId,
          jobId: thread.jobId,
          status: "running",
          model: "pending",
          startedAt: new Date(),
        },
      });

      await getPrisma().chatThread.update({
        where: { id: input.threadId },
        data: { messages: { push: userMessage } },
      });

      return { runId: run.id, userMessageId: userMessage.id };
    }),

  // Regenerate the last assistant message (creates a new run)
  regenerate: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input }) => {
      const thread = await getPrisma().chatThread.findUnique({
        where: { id: input.threadId },
        include: { job: true },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });

      // Drop the last assistant message so the SSE handler re-generates it
      const withoutLast = thread.messages.filter((m, i) => {
        if (i === thread.messages.length - 1 && m.role === "assistant") return false;
        return true;
      });
      await getPrisma().chatThread.update({
        where: { id: input.threadId },
        data: { messages: withoutLast },
      });

      const run = await getPrisma().chatRun.create({
        data: {
          threadId: input.threadId,
          jobId: thread.jobId,
          status: "running",
          model: "pending",
          startedAt: new Date(),
        },
      });

      return { runId: run.id };
    }),

  // Edit a user message (removes all messages after it and queues a new run)
  editMessage: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      messageId: z.string(),
      newContent: z.string().min(1).max(8000),
    }))
    .mutation(async ({ input }) => {
      const thread = await getPrisma().chatThread.findUnique({
        where: { id: input.threadId },
        include: { job: true },
      });
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });

      const msgIdx = thread.messages.findIndex((m) => m.id === input.messageId);
      if (msgIdx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });

      // Truncate to the edited message (inclusive), update content
      const truncated = thread.messages.slice(0, msgIdx + 1).map((m, i) =>
        i === msgIdx ? { ...m, content: input.newContent } : m,
      );
      await getPrisma().chatThread.update({ where: { id: input.threadId }, data: { messages: truncated } });

      const run = await getPrisma().chatRun.create({
        data: {
          threadId: input.threadId,
          jobId: thread.jobId,
          status: "running",
          model: "pending",
          startedAt: new Date(),
        },
      });

      return { runId: run.id };
    }),

  // Cancel a running chat run
  cancelRun: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .mutation(async ({ input }) => {
      const run = await getPrisma().chatRun.findUnique({ where: { id: input.runId } });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      if (run.status !== "running") return { ok: true };
      await getPrisma().chatRun.update({
        where: { id: input.runId },
        data: { status: "failed", error: "cancelled", completedAt: new Date() },
      });
      return { ok: true };
    }),
});

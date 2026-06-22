import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateJobPdf } from "$lib/server/services/pdf/index.js";
import { getStorageProvider } from "$lib/server/services/storage/index.js";
import { protectedProcedure, publicProcedure, router } from "../init.js";

export const jobsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(500).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { status, page, pageSize } = input;
      const where = status ? { status } : undefined;
      const [jobs, total] = await Promise.all([
        ctx.prisma.job.findMany({
          where,
          orderBy: { crawledAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            title: true,
            employer: true,
            location: true,
            status: true,
            scoreOverall: true,
            crawledAt: true,
            appliedAt: true,
            source: true,
            isRemote: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            pdfPublicUrl: true,
            applicationStage: true,
          },
        }),
        ctx.prisma.job.count({ where }),
      ]);
      return { jobs, total, page, pageSize };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return job;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          status: z.string().optional(),
          applicationStage: z.string().optional(),
          applicationNote: z.string().optional(),
          applicationOutcome: z.string().optional(),
          tracerLinksEnabled: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const exists = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return ctx.prisma.job.update({ where: { id: input.id }, data: input.data });
    }),

  generatePdf: publicProcedure
    .input(
      z.object({
        jobId: z.string(),
        resumeData: z.record(z.string(), z.unknown()),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });

      try {
        return await generateJobPdf(
          { jobId: input.jobId, resumeData: input.resumeData, title: input.title },
          ctx.prisma,
        );
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "PDF generation failed",
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      // Best-effort: remove PDF from storage if present
      if (job.pdfStorageKey) {
        try { await getStorageProvider().delete(job.pdfStorageKey); } catch { /* ignore */ }
      }
      await ctx.prisma.job.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  markApplied: protectedProcedure
    .input(z.object({ id: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const now = new Date();
      const stageEvent = { id: randomUUID(), stage: "applied", timestamp: now, note: input.note ?? null };
      return ctx.prisma.job.update({
        where: { id: input.id },
        data: {
          status: "applied",
          appliedAt: now,
          applicationStage: "applied",
          applicationNote: input.note,
          stageEvents: { push: stageEvent },
        },
      });
    }),

  verify: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return ctx.prisma.job.update({ where: { id: input.id }, data: { status: "ready" } });
    }),

  moveStage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        stage: z.string(),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const stageEvent = {
        id: randomUUID(),
        stage: input.stage,
        timestamp: new Date(),
        note: input.note ?? null,
      };
      return ctx.prisma.job.update({
        where: { id: input.id },
        data: {
          applicationStage: input.stage,
          stageEvents: { push: stageEvent },
        },
      });
    }),

  addNote: protectedProcedure
    .input(z.object({ jobId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const now = new Date();
      const note = { id: randomUUID(), content: input.content, createdAt: now, updatedAt: now };
      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { notes: { push: note } },
      });
    }),

  updateNote: protectedProcedure
    .input(z.object({ jobId: z.string(), noteId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const noteIdx = job.notes.findIndex((n) => n.id === input.noteId);
      if (noteIdx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      const updatedNotes = job.notes.map((n) =>
        n.id === input.noteId ? { ...n, content: input.content, updatedAt: new Date() } : n,
      );
      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { notes: updatedNotes },
      });
    }),

  deleteNote: protectedProcedure
    .input(z.object({ jobId: z.string(), noteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { notes: job.notes.filter((n) => n.id !== input.noteId) },
      });
    }),

  addDocumentMeta: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        title: z.string().min(1),
        storageKey: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const doc = {
        id: randomUUID(),
        title: input.title,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes ?? null,
        uploadedAt: new Date(),
      };
      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { documents: { push: doc } },
      });
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ jobId: z.string(), documentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const doc = job.documents.find((d) => d.id === input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      try { await getStorageProvider().delete(doc.storageKey); } catch { /* ignore */ }
      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { documents: job.documents.filter((d) => d.id !== input.documentId) },
      });
    }),

  getDocumentUrl: protectedProcedure
    .input(z.object({ jobId: z.string(), documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const doc = job.documents.find((d) => d.id === input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      const url = await getStorageProvider().signedDownloadUrl(doc.storageKey, 3600);
      return { url, title: doc.title, mimeType: doc.mimeType };
    }),

  // ── Status actions ───────────────────────────────────────────────────────────

  skip: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return ctx.prisma.job.update({ where: { id: input.id }, data: { status: "skipped" } });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const restoreStatus = job.scoreOverall !== null ? "ready" : "discovered";
      return ctx.prisma.job.update({ where: { id: input.id }, data: { status: restoreStatus } });
    }),

  // Bulk action across multiple jobs
  bulkAction: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(200),
        action: z.enum(["skip", "restore", "markApplied", "delete"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: { id: string; ok: boolean; error?: string }[] = [];
      await Promise.all(
        input.ids.map(async (id) => {
          try {
            const job = await ctx.prisma.job.findUnique({ where: { id } });
            if (!job) { results.push({ id, ok: false, error: "not_found" }); return; }
            switch (input.action) {
              case "skip":
                await ctx.prisma.job.update({ where: { id }, data: { status: "skipped" } });
                break;
              case "restore":
                await ctx.prisma.job.update({
                  where: { id },
                  data: { status: job.scoreOverall !== null ? "ready" : "discovered" },
                });
                break;
              case "markApplied": {
                const now = new Date();
                const stageEvent = { id: randomUUID(), stage: "applied", timestamp: now, note: null };
                await ctx.prisma.job.update({
                  where: { id },
                  data: { status: "applied", appliedAt: now, applicationStage: "applied", stageEvents: { push: stageEvent } },
                });
                break;
              }
              case "delete":
                if (job.pdfStorageKey) {
                  try { await getStorageProvider().delete(job.pdfStorageKey); } catch { /* ignore */ }
                }
                await ctx.prisma.job.delete({ where: { id } });
                break;
            }
            results.push({ id, ok: true });
          } catch (e) {
            results.push({ id, ok: false, error: e instanceof Error ? e.message : "unknown" });
          }
        }),
      );
      return { results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
    }),

  // ── Tasks ────────────────────────────────────────────────────────────────────

  addTask: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        type: z.enum(["prep", "todo", "follow_up", "check_status"]),
        title: z.string().min(1),
        dueDate: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const task = {
        id: randomUUID(),
        type: input.type,
        title: input.title,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        completedAt: null,
        createdAt: new Date(),
      };
      return ctx.prisma.job.update({ where: { id: input.jobId }, data: { tasks: { push: task } } });
    }),

  updateTask: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        taskId: z.string(),
        title: z.string().min(1).optional(),
        dueDate: z.string().nullable().optional(),
        completedAt: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const idx = job.tasks.findIndex((t) => t.id === input.taskId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      const updatedTasks = job.tasks.map((t) => {
        if (t.id !== input.taskId) return t;
        return {
          ...t,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
          ...(input.completedAt !== undefined ? { completedAt: input.completedAt ? new Date(input.completedAt) : null } : {}),
        };
      });
      return ctx.prisma.job.update({ where: { id: input.jobId }, data: { tasks: updatedTasks } });
    }),

  deleteTask: protectedProcedure
    .input(z.object({ jobId: z.string(), taskId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { tasks: job.tasks.filter((t) => t.id !== input.taskId) },
      });
    }),

  // ── Interviews ───────────────────────────────────────────────────────────────

  addInterview: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        type: z.enum(["recruiter_screen", "technical", "onsite", "panel", "behavioral", "final"]),
        scheduledAt: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const interview = {
        id: randomUUID(),
        type: input.type,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        completedAt: null,
        outcome: null,
        notes: input.notes ?? null,
        createdAt: new Date(),
      };
      return ctx.prisma.job.update({ where: { id: input.jobId }, data: { interviews: { push: interview } } });
    }),

  updateInterview: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        interviewId: z.string(),
        scheduledAt: z.string().nullable().optional(),
        completedAt: z.string().nullable().optional(),
        outcome: z.enum(["pass", "fail", "pending", "cancelled"]).nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      if (!job.interviews.find((i) => i.id === input.interviewId)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Interview not found" });
      }
      const updated = job.interviews.map((i) => {
        if (i.id !== input.interviewId) return i;
        return {
          ...i,
          ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null } : {}),
          ...(input.completedAt !== undefined ? { completedAt: input.completedAt ? new Date(input.completedAt) : null } : {}),
          ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        };
      });
      return ctx.prisma.job.update({ where: { id: input.jobId }, data: { interviews: updated } });
    }),

  deleteInterview: protectedProcedure
    .input(z.object({ jobId: z.string(), interviewId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { interviews: job.interviews.filter((i) => i.id !== input.interviewId) },
      });
    }),

  // ── Stage events (edit / delete) ─────────────────────────────────────────────

  deleteStageEvent: protectedProcedure
    .input(z.object({ jobId: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      return ctx.prisma.job.update({
        where: { id: input.jobId },
        data: { stageEvents: job.stageEvents.filter((e) => e.id !== input.eventId) },
      });
    }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getPrisma } from "$lib/server/db/index.js";
import { protectedProcedure, router } from "../init.js";

export const manualJobsRouter = router({
  // Parse a job posting URL and extract structured data
  fetchFromUrl: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const extractor = process.env.EXTRACTOR_URL ?? "http://localhost:8000";
      try {
        const res = await fetch(`${extractor}/fetch-job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input.url }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`Extractor returned ${res.status}`);
        return (await res.json()) as {
          title?: string;
          employer?: string;
          location?: string;
          jobDescription?: string;
          salaryMin?: number;
          salaryMax?: number;
          salaryCurrency?: string;
          jobType?: string;
          isRemote?: boolean;
        };
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: e instanceof Error ? e.message : "Failed to fetch job from URL",
        });
      }
    }),

  // Parse pasted job description text and extract structured data
  parseFromText: protectedProcedure
    .input(z.object({ text: z.string().min(50).max(20_000) }))
    .mutation(async ({ input }) => {
      const extractor = process.env.EXTRACTOR_URL ?? "http://localhost:8000";
      try {
        const res = await fetch(`${extractor}/infer-job`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: input.text }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`Extractor returned ${res.status}`);
        return (await res.json()) as {
          title?: string;
          employer?: string;
          location?: string;
          jobDescription?: string;
        };
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: e instanceof Error ? e.message : "Failed to parse job description",
        });
      }
    }),

  // Import a manually composed job into the workspace
  import: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        employer: z.string().optional(),
        location: z.string().optional(),
        jobDescription: z.string().optional(),
        url: z.string().url().optional(),
        salaryMin: z.number().optional(),
        salaryMax: z.number().optional(),
        salaryCurrency: z.string().optional(),
        jobType: z.string().optional(),
        isRemote: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return getPrisma().job.create({
        data: {
          source: "manual",
          title: input.title,
          employer: input.employer,
          location: input.location,
          jobDescription: input.jobDescription,
          url: input.url,
          salaryMin: input.salaryMin,
          salaryMax: input.salaryMax,
          salaryCurrency: input.salaryCurrency,
          jobType: input.jobType,
          isRemote: input.isRemote ?? false,
          status: "ready",
          crawledAt: new Date(),
        },
      });
    }),
});

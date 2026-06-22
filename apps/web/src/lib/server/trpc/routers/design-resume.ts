import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { login } from "$lib/server/services/rxresume/client.js";
import { protectedProcedure, router } from "../init.js";

function getRxResumeConfig() {
  const url = process.env.RXRESUME_URL ?? "https://rxresu.me";
  const email = process.env.RXRESUME_EMAIL ?? "";
  const password = process.env.RXRESUME_PASSWORD ?? "";
  return { url, email, password };
}

async function getToken(): Promise<{ token: string; baseUrl: string }> {
  const { url, email, password } = getRxResumeConfig();
  if (!email || !password) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "RXRESUME_EMAIL and RXRESUME_PASSWORD must be configured",
    });
  }
  const token = await login(email, password, url);
  return { token, baseUrl: url };
}

export const designResumeRouter = router({
  list: protectedProcedure.query(async () => {
    const { token, baseUrl } = await getToken();
    const res = await fetch(`${baseUrl}/api/resume`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `Authentication=${token}`,
      },
    });
    if (!res.ok) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list resumes" });
    }
    const data = (await res.json()) as unknown[];
    return data as Array<{ id: string; title: string; updatedAt?: string }>;
  }),

  get: protectedProcedure
    .input(z.object({ resumeId: z.string() }))
    .query(async ({ input }) => {
      const { token, baseUrl } = await getToken();
      const res = await fetch(`${baseUrl}/api/resume/${encodeURIComponent(input.resumeId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `Authentication=${token}`,
        },
      });
      if (!res.ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Resume not found" });
      }
      return (await res.json()) as Record<string, unknown>;
    }),

  update: protectedProcedure
    .input(
      z.object({
        resumeId: z.string(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async ({ input }) => {
      const { token, baseUrl } = await getToken();
      const res = await fetch(`${baseUrl}/api/resume/${encodeURIComponent(input.resumeId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Cookie: `Authentication=${token}`,
        },
        body: JSON.stringify(input.data),
      });
      if (!res.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update resume" });
      }
      return (await res.json()) as Record<string, unknown>;
    }),

  exportPdfUrl: protectedProcedure
    .input(z.object({ resumeId: z.string() }))
    .query(async ({ input }) => {
      const { token, baseUrl } = await getToken();
      const res = await fetch(`${baseUrl}/api/resume/print/${encodeURIComponent(input.resumeId)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `Authentication=${token}`,
        },
      });
      if (!res.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get PDF URL" });
      }
      const data = (await res.json()) as { url?: string; href?: string };
      const url = data.url ?? data.href ?? null;
      if (!url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No PDF URL returned" });
      return { url };
    }),
});

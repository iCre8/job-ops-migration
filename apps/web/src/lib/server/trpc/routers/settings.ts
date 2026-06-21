import { z } from "zod";
import { publicProcedure, router } from "../init.js";

export const settingsRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.settings.findFirst({
      where: { id: "singleton" },
    });
    return (settings?.data ?? {}) as Record<string, unknown>;
  }),

  update: publicProcedure
    .input(z.record(z.string(), z.unknown()))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.prisma.settings.findFirst({
        where: { id: "singleton" },
      });
      const merged = {
        ...((current?.data as Record<string, unknown>) ?? {}),
        ...input,
      };
      return ctx.prisma.settings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", data: merged },
        update: { data: merged },
      });
    }),
});

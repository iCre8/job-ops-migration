import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { blacklistToken, signToken } from "$lib/server/auth/jwt.js";
import { hashPassword, verifyPassword } from "$lib/server/auth/password.js";
import { getPrisma } from "$lib/server/db/index.js";
import { protectedProcedure, publicProcedure, router } from "../init.js";

export const authRouter = router({
  bootstrapStatus: publicProcedure.query(async () => {
    const count = await getPrisma().user.count();
    return { setupRequired: count === 0 };
  }),

  setup: publicProcedure
    .input(
      z.object({
        username: z.string().min(1).max(50).trim(),
        password: z.string().min(8).max(500),
        displayName: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getPrisma().user.count();
      if (existing > 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Setup already completed" });
      }

      const { passwordHash, passwordSalt } = await hashPassword(input.password);
      const user = await getPrisma().user.create({
        data: {
          username: input.username.toLowerCase(),
          displayName: input.displayName ?? input.username,
          passwordHash,
          passwordSalt,
          isSystemAdmin: true,
        },
      });

      const { token, expiresIn } = await signToken({
        userId: user.id,
        username: user.username,
        isSystemAdmin: user.isSystemAdmin,
      });

      ctx.event.cookies.set("jobops_token", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: expiresIn,
        secure: process.env.NODE_ENV === "production",
      });

      return { username: user.username };
    }),

  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1).trim(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getPrisma().user.findUnique({
        where: { username: input.username.toLowerCase() },
      });

      if (!user || user.isDisabled) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }

      const valid = await verifyPassword(input.password, user.passwordHash, user.passwordSalt);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }

      const { token, expiresIn } = await signToken({
        userId: user.id,
        username: user.username,
        isSystemAdmin: user.isSystemAdmin,
      });

      ctx.event.cookies.set("jobops_token", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: expiresIn,
        secure: process.env.NODE_ENV === "production",
      });

      return { username: user.username };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const cookie = ctx.event.cookies.get("jobops_token");
    if (cookie) {
      try {
        const { verifyToken } = await import("$lib/server/auth/jwt.js");
        const payload = await verifyToken(cookie);
        await blacklistToken(payload.jti);
      } catch {
        // Token already invalid — still clear the cookie
      }
    }
    ctx.event.cookies.delete("jobops_token", { path: "/" });
    return { ok: true };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await getPrisma().user.findUnique({ where: { id: ctx.user.id } });
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return { id: user.id, username: user.username, displayName: user.displayName, isSystemAdmin: user.isSystemAdmin };
  }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
    return getPrisma().user.findMany({
      select: { id: true, username: true, displayName: true, isSystemAdmin: true, isDisabled: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }),

  createUser: protectedProcedure
    .input(
      z.object({
        username: z.string().min(1).max(50).trim(),
        password: z.string().min(8).max(500),
        displayName: z.string().trim().max(120).optional(),
        isSystemAdmin: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const exists = await getPrisma().user.findUnique({ where: { username: input.username.toLowerCase() } });
      if (exists) throw new TRPCError({ code: "CONFLICT", message: "Username already taken" });
      const { passwordHash, passwordSalt } = await hashPassword(input.password);
      return getPrisma().user.create({
        data: {
          username: input.username.toLowerCase(),
          displayName: input.displayName ?? input.username,
          passwordHash,
          passwordSalt,
          isSystemAdmin: input.isSystemAdmin,
        },
        select: { id: true, username: true, displayName: true, isSystemAdmin: true },
      });
    }),

  toggleUserDisabled: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.isSystemAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot disable yourself" });
      const user = await getPrisma().user.findUnique({ where: { id: input.userId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return getPrisma().user.update({
        where: { id: input.userId },
        data: { isDisabled: !user.isDisabled },
        select: { id: true, username: true, isDisabled: true },
      });
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getPrisma().user.findUnique({ where: { id: ctx.user.id } });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

      const valid = await verifyPassword(input.currentPassword, user.passwordHash, user.passwordSalt);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }

      const { passwordHash, passwordSalt } = await hashPassword(input.newPassword);
      await getPrisma().user.update({
        where: { id: ctx.user.id },
        data: { passwordHash, passwordSalt },
      });

      return { ok: true };
    }),
});

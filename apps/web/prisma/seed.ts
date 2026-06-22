import "dotenv/config";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";


const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password: string): Promise<{ passwordHash: string; passwordSalt: string }> {
  const passwordSalt = randomBytes(16).toString("base64url");
  const derived = (await scryptAsync(password, passwordSalt, KEY_LENGTH)) as Buffer;
  return { passwordHash: derived.toString("base64url"), passwordSalt };
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for database seeding.`);
  }
  return value;
}

async function main(): Promise<void> {
  const username = (process.env.SEED_ADMIN_USERNAME?.trim() || "admin").toLowerCase();
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME?.trim() || username;
  const password = readRequiredEnv("SEED_ADMIN_PASSWORD");

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required for database seeding.");
  }

  const prisma = new PrismaClient({ log: ["error"] });

  try {
    const { passwordHash, passwordSalt } = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { username },
      create: {
        username,
        displayName,
        passwordHash,
        passwordSalt,
        isSystemAdmin: true,
        isDisabled: false,
      },
      update: {
        displayName,
        passwordHash,
        passwordSalt,
        isSystemAdmin: true,
        isDisabled: false,
      },
      select: { id: true, username: true, isSystemAdmin: true },
    });

    console.log(`Seeded admin user ${user.username} (${user.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

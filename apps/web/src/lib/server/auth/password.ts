import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<{
  passwordHash: string;
  passwordSalt: string;
}> {
  const passwordSalt = randomBytes(16).toString("base64url");
  const derived = (await scryptAsync(password, passwordSalt, KEY_LENGTH)) as Buffer;
  return {
    passwordHash: derived.toString("base64url"),
    passwordSalt,
  };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  try {
    const derived = (await scryptAsync(password, storedSalt, KEY_LENGTH)) as Buffer;
    const stored = Buffer.from(storedHash, "base64url");
    if (derived.length !== stored.length) return false;
    return timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

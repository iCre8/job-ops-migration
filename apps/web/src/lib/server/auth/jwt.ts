import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getPrisma } from "$lib/server/db/index.js";
import { SignJWT, jwtVerify } from "jose";

const DEFAULT_EXPIRY_SECONDS = 86400;
const MIN_SECRET_LENGTH = 32;
const SECRET_FILE = join(process.cwd(), "data", "jwt-secret");

let cachedSecret: Uint8Array | null = null;

async function getSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret;

  const explicit = process.env.JWT_SECRET?.trim();
  if (explicit) {
    if (explicit.length < MIN_SECRET_LENGTH) {
      throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    cachedSecret = new TextEncoder().encode(explicit);
    return cachedSecret;
  }

  // Auto-generate and persist a secret to disk if none configured.
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  try {
    const stored = (await readFile(SECRET_FILE, "utf8")).trim();
    if (stored.length >= MIN_SECRET_LENGTH) {
      cachedSecret = new TextEncoder().encode(stored);
      return cachedSecret;
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  const generated = randomBytes(48).toString("base64url");
  await writeFile(SECRET_FILE, `${generated}\n`, { flag: "wx", mode: 0o600 }).catch(
    () => undefined,
  );
  cachedSecret = new TextEncoder().encode(generated);
  return cachedSecret;
}

function expirySeconds(): number {
  const raw = process.env.JWT_EXPIRY_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXPIRY_SECONDS;
}

export interface TokenPayload {
  sub: string;
  jti: string;
  exp: number;
  userId: string;
  username: string;
  isSystemAdmin: boolean;
}

export async function signToken(args: {
  userId: string;
  username: string;
  isSystemAdmin: boolean;
}): Promise<{ token: string; expiresIn: number }> {
  const secret = await getSecret();
  const expiresIn = expirySeconds();
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  await getPrisma().authSession.create({
    data: {
      jti,
      userId: args.userId,
      expiresAt,
    },
  });

  const token = await new SignJWT({
    userId: args.userId,
    username: args.username,
    isSystemAdmin: args.isSystemAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(args.username)
    .setJti(jti)
    .setExpirationTime(`${expiresIn}s`)
    .setIssuedAt()
    .sign(secret);

  return { token, expiresIn };
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const secret = await getSecret();
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });

  if (
    !payload.sub ||
    !payload.jti ||
    !payload.exp ||
    typeof payload.userId !== "string" ||
    typeof payload.username !== "string"
  ) {
    throw new Error("Token missing required claims");
  }

  const session = await getPrisma().authSession.findUnique({ where: { jti: payload.jti } });
  if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
    throw new Error("Token has been revoked or expired");
  }

  return {
    sub: payload.sub,
    jti: payload.jti,
    exp: payload.exp,
    userId: payload.userId as string,
    username: payload.username as string,
    isSystemAdmin: payload.isSystemAdmin === true,
  };
}

export async function blacklistToken(jti: string): Promise<void> {
  await getPrisma().authSession.update({
    where: { jti },
    data: { revokedAt: new Date() },
  });
}

export function clearSecretCache(): void {
  cachedSecret = null;
}

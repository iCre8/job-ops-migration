/**
 * RxResume v4 HTTP client — standalone fetch functions.
 *
 * Each function is pure (no module-level state) to keep them easily testable.
 * Token caching, if needed, should be layered on top by the caller.
 *
 * API endpoints used:
 *   POST /api/auth/login           → access token
 *   POST /api/resume/import        → resume ID
 *   GET  /api/resume/print/:id     → PDF URL
 *   DELETE /api/resume/:id         → void
 */

type AnyObj = Record<string, unknown>;
const MAX_SNIPPET = 300;

function snippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET);
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Cookie: `Authentication=${token}`,
  };
}

// ── login ─────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
  baseUrl: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `RxResume login failed: HTTP ${res.status} ${snippet(text)}`,
    );
  }

  const data = (await res.json()) as AnyObj;
  const token =
    data?.accessToken ??
    data?.access_token ??
    data?.token ??
    (data?.data as AnyObj | undefined)?.accessToken ??
    (data?.data as AnyObj | undefined)?.token;

  if (!token || typeof token !== "string") {
    throw new Error(
      "RxResume login succeeded but no access token found in response",
    );
  }

  return token;
}

// ── importResume ──────────────────────────────────────────────────────────────

export type ImportResumePayload = {
  name?: string;
  data: unknown;
};

export async function importResume(
  token: string,
  baseUrl: string,
  payload: ImportResumePayload,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/resume/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({
      name: payload.name ?? "JobOps Resume",
      data: payload.data,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `RxResume importResume failed: HTTP ${res.status} ${snippet(text)}`,
    );
  }

  const d = (await res.json()) as AnyObj;
  const id =
    d?.id ??
    (d?.data as AnyObj | undefined)?.id ??
    (d?.resume as AnyObj | undefined)?.id;

  if (!id || typeof id !== "string") {
    throw new Error("RxResume importResume: no resume ID in response");
  }

  return id;
}

// ── printResume ───────────────────────────────────────────────────────────────

export async function printResume(
  token: string,
  baseUrl: string,
  resumeId: string,
): Promise<string> {
  const res = await fetch(
    `${baseUrl}/api/resume/print/${encodeURIComponent(resumeId)}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(token),
      },
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `RxResume printResume failed: HTTP ${res.status} ${snippet(text)}`,
    );
  }

  const d = (await res.json()) as AnyObj;
  const url =
    d?.url ??
    d?.href ??
    (d?.data as AnyObj | undefined)?.url ??
    (d?.data as AnyObj | undefined)?.href;

  if (!url || typeof url !== "string") {
    throw new Error("RxResume printResume: no PDF URL in response");
  }

  return url;
}

// ── deleteResume ──────────────────────────────────────────────────────────────

export async function deleteResume(
  token: string,
  baseUrl: string,
  resumeId: string,
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/api/resume/${encodeURIComponent(resumeId)}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    },
  );

  // 204 No Content is a success response for DELETE
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `RxResume deleteResume failed: HTTP ${res.status} ${snippet(text)}`,
    );
  }
}

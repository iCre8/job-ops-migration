/**
 * Gmail API helpers — Phase 11.
 *
 * Covers the three operations used by the sync service:
 *   1. resolveAccessToken  — refresh OAuth token when near-expiry
 *   2. listMessageIds      — fetch matching message IDs from the Gmail API
 *   3. getMessageMetadata  — fetch subject, from, date, snippet for one message
 *
 * All external HTTP calls go through gmailFetch(), which adds:
 *   - 15 s timeout via AbortSignal.timeout()
 *   - Authorization: Bearer header
 */

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 15_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type GmailCredentials = {
  refreshToken: string;
  accessToken?: string | null;
  tokenExpiry?: Date | null;
};

export type ResolvedToken = {
  accessToken: string;
  tokenExpiry: Date;
};

export type MessageMetadata = {
  id: string;
  subject: string | null;
  from: string | null;
  receivedAt: Date | null;
  snippet: string;
};

// ── Internal fetch ────────────────────────────────────────────────────────────

async function gmailFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

// ── resolveAccessToken ────────────────────────────────────────────────────────

/**
 * Return a valid access token, refreshing from Google's token endpoint if the
 * stored token is missing or expires within 60 seconds.
 */
export async function resolveAccessToken(
  creds: GmailCredentials,
): Promise<ResolvedToken> {
  const now = Date.now();
  const bufferMs = 60_000;

  if (
    creds.accessToken &&
    creds.tokenExpiry &&
    creds.tokenExpiry.getTime() > now + bufferMs
  ) {
    return {
      accessToken: creds.accessToken,
      tokenExpiry: creds.tokenExpiry,
    };
  }

  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET must be set to refresh Gmail tokens.",
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Gmail token refresh failed (HTTP ${res.status}): ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  const accessToken = typeof data.access_token === "string" ? data.access_token : null;
  if (!accessToken) {
    throw new Error(
      "Gmail token refresh response did not include access_token.",
    );
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;

  return {
    accessToken,
    tokenExpiry: new Date(now + expiresIn * 1000),
  };
}

// ── listMessageIds ────────────────────────────────────────────────────────────

/** Return up to maxResults Gmail message IDs matching the given query. */
export async function listMessageIds(
  accessToken: string,
  query: string,
  maxResults = 100,
): Promise<string[]> {
  const url = new URL(`${GMAIL_BASE}/messages`);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(Math.min(maxResults, 500)));

  const res = await gmailFetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return (data.messages ?? []).map((m) => m.id);
}

// ── getMessageMetadata ────────────────────────────────────────────────────────

function headerValue(
  headers: Array<{ name?: string; value?: string }>,
  name: string,
): string | null {
  const h = headers.find(
    (h) => (h.name ?? "").toLowerCase() === name.toLowerCase(),
  );
  return h?.value?.trim() || null;
}

/** Fetch subject, from, date, and snippet for a single Gmail message. */
export async function getMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<MessageMetadata> {
  const url = `${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;

  const res = await gmailFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  type GmailMsg = {
    id: string;
    snippet?: string;
    payload?: { headers?: Array<{ name?: string; value?: string }> };
  };
  const msg = (await res.json()) as GmailMsg;
  const headers = msg.payload?.headers ?? [];

  const dateStr = headerValue(headers, "date");
  const receivedAt = dateStr ? new Date(dateStr) : null;

  return {
    id: msg.id,
    subject: headerValue(headers, "subject"),
    from: headerValue(headers, "from"),
    receivedAt: receivedAt instanceof Date && !isNaN(receivedAt.getTime())
      ? receivedAt
      : null,
    snippet: msg.snippet ?? "",
  };
}

// ── buildSearchQuery ──────────────────────────────────────────────────────────

/** Build a Gmail search query that targets job application related emails. */
export function buildSearchQuery(searchDays = 90): string {
  const subjectTerms = [
    "application",
    "interview",
    "assessment",
    "offer",
    "offer letter",
    "regret to inform",
    "not moving forward",
    "not selected",
    "application unsuccessful",
    "thank you for applying",
    "your application",
  ];
  const fromTerms = [
    "careers@",
    "jobs@",
    "recruiting@",
    "talent@",
    "@greenhouse.io",
    "@ashbyhq.com",
    "@workablemail.com",
    "@hire.lever.co",
    "@myworkday.com",
  ];

  const q = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
  const subjectBlock = subjectTerms.map((t) => `subject:${q(t)}`).join(" OR ");
  const fromBlock = fromTerms.map((t) => `from:${q(t)}`).join(" OR ");

  return `newer_than:${searchDays}d ((${subjectBlock}) OR (${fromBlock}))`;
}

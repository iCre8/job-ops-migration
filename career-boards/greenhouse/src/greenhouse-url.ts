export type GreenhouseUrlParseErrorCode =
  | "EMPTY_URL"
  | "INVALID_URL"
  | "UNSUPPORTED_HOST"
  | "MISSING_BOARD_TOKEN"
  | "INVALID_JOB_ID";

export interface GreenhouseSourceConfig {
  inputUrl: string;
  host: string;
  boardToken: string;
  canonicalCareersUrl: string;
  listUrl: string;
}

export interface GreenhouseJobSourceConfig extends GreenhouseSourceConfig {
  jobId: string;
  canonicalJobUrl: string;
  detailUrl: string;
}

export class GreenhouseUrlParseError extends Error {
  readonly code: GreenhouseUrlParseErrorCode;
  readonly input: string;

  constructor(code: GreenhouseUrlParseErrorCode, message: string, input: string) {
    super(message);
    this.name = "GreenhouseUrlParseError";
    this.code = code;
    this.input = input;
  }
}

export function isGreenhouseUrl(input: string): boolean {
  try {
    parseGreenhouseUrl(input);
    return true;
  } catch {
    return false;
  }
}

export function parseGreenhouseUrl(input: string): GreenhouseSourceConfig {
  if (!input.trim()) {
    throw new GreenhouseUrlParseError("EMPTY_URL", "URL cannot be empty.", input);
  }

  const url = toUrl(input);
  const host = url.hostname.toLowerCase();
  
  const isGreenhouseHost =
    host.endsWith("greenhouse.io") ||
    host.endsWith("greenhouse.co");

  if (
    !isGreenhouseHost &&
    !url.searchParams.has("gh_jid") &&
    !url.searchParams.has("board_id")
  ) {
    throw new GreenhouseUrlParseError(
      "UNSUPPORTED_HOST",
      `Unsupported Greenhouse host: ${host}`,
      input,
    );
  }

  let boardToken = "";
  const segments = getPathSegments(url.pathname);

  // Check if it's an embed URL
  if (segments[0]?.toLowerCase() === "embed") {
    const boardIdParam = url.searchParams.get("board_id");
    if (boardIdParam?.trim()) {
      boardToken = boardIdParam.trim();
    }
  } else if (host === "boards-api.greenhouse.io") {
    // API format: /v1/boards/{board_token}/jobs...
    if (segments[0]?.toLowerCase() === "v1" && segments[1]?.toLowerCase() === "boards") {
      boardToken = segments[2] || "";
    }
  } else if (isGreenhouseHost) {
    // Standard format: /{board_token}/jobs...
    boardToken = segments[0] || "";
  } else {
    // Non-greenhouse host (redirected)
    const boardIdParam = url.searchParams.get("board_id") || url.searchParams.get("board");
    if (boardIdParam?.trim()) {
      boardToken = boardIdParam.trim();
    } else {
      const parts = host.split(".");
      if (parts.length >= 2) {
        boardToken = parts[parts.length - 2];
      }
    }
  }

  if (!boardToken) {
    throw new GreenhouseUrlParseError(
      "MISSING_BOARD_TOKEN",
      "Greenhouse URL is missing the board token / company identifier.",
      input,
    );
  }

  const canonicalCareersUrl = `https://boards.greenhouse.io/${boardToken}`;

  return {
    inputUrl: input,
    host,
    boardToken,
    canonicalCareersUrl,
    listUrl: `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`,
  };
}

export function parseGreenhouseJobUrl(input: string): GreenhouseJobSourceConfig {
  const source = parseGreenhouseUrl(input);
  const url = toUrl(input);
  const segments = getPathSegments(url.pathname);
  let maybeJobId: string | null = null;

  if (segments[0]?.toLowerCase() === "embed") {
    maybeJobId = url.searchParams.get("job_id");
  } else if (source.host === "boards-api.greenhouse.io") {
    // /v1/boards/{board_token}/jobs/{job_id}
    if (segments[3]?.toLowerCase() === "jobs") {
      maybeJobId = segments[4] || null;
    }
  } else {
    // /{board_token}/jobs/{job_id}
    if (segments[1]?.toLowerCase() === "jobs") {
      maybeJobId = segments[2] || null;
    }
  }

  // Fallback: search for gh_jid in query parameters (some companies redirect to their site but keep gh_jid)
  if (!maybeJobId) {
    const ghJid = url.searchParams.get("gh_jid");
    if (ghJid?.trim()) {
      maybeJobId = ghJid.trim();
    }
  }

  if (!maybeJobId || !/^\d+$/.test(maybeJobId)) {
    throw new GreenhouseUrlParseError(
      "INVALID_JOB_ID",
      "Greenhouse job URLs must include a numeric job id.",
      input,
    );
  }

  return buildGreenhouseJobSource(source, maybeJobId);
}

export function greenhouseUrlToCompanyLabel(input: string): string {
  const parsed = parseGreenhouseUrl(input);
  return formatCompanySlug(parsed.boardToken);
}

export function greenhouseUrlToSourceKey(input: string): string {
  const parsed = parseGreenhouseUrl(input);
  return `greenhouse:${toSourceKeyPart(parsed.boardToken)}`;
}

export function greenhouseUrlToJobDetailsUrl(
  input: string,
  jobId: string,
): string {
  return buildGreenhouseJobSource(parseGreenhouseUrl(input), jobId).detailUrl;
}

export function greenhouseUrlToJobUrl(input: string, jobId: string): string {
  return buildGreenhouseJobSource(parseGreenhouseUrl(input), jobId).canonicalJobUrl;
}

function buildGreenhouseJobSource(
  source: GreenhouseSourceConfig,
  jobId: string,
): GreenhouseJobSourceConfig {
  if (!/^\d+$/.test(jobId)) {
    throw new GreenhouseUrlParseError(
      "INVALID_JOB_ID",
      `Invalid Greenhouse job id: ${jobId}`,
      source.inputUrl,
    );
  }

  return {
    ...source,
    jobId,
    canonicalJobUrl: `https://boards.greenhouse.io/${source.boardToken}/jobs/${jobId}`,
    detailUrl: `https://boards-api.greenhouse.io/v1/boards/${source.boardToken}/jobs/${jobId}`,
  };
}

function toUrl(input: string): URL {
  try {
    let cleanInput = input.trim();
    if (!/^https?:\/\//i.test(cleanInput)) {
      cleanInput = `https://${cleanInput}`;
    }
    return new URL(cleanInput);
  } catch {
    throw new GreenhouseUrlParseError(
      "INVALID_URL",
      `Invalid URL: ${input}`,
      input,
    );
  }
}

function getPathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function formatCompanySlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toSourceKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

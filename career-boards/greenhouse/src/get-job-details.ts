import {
  type GreenhouseSourceConfig,
  greenhouseUrlToJobUrl,
  parseGreenhouseJobUrl,
} from "./greenhouse-url";

export interface NormalizedGreenhouseJobDetails {
  source: string;
  externalId: string;
  title: string;
  jobUrl: string;
  locationText?: string;
  postedOn?: string;
  employmentStatus?: string;
  minimumExperience?: string;
  jobDescriptionHtml: string;
  jobDescriptionText: string;
  raw: unknown;
}

export interface FetchGreenhouseJobDetailsOptions {
  jobUrl: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  headers?: HeadersInit;
  userAgent?: string;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

export async function getJobDetails(
  options: FetchGreenhouseJobDetailsOptions,
): Promise<{ job: NormalizedGreenhouseJobDetails }> {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error(
      "No fetch implementation available. Pass fetchImpl or use Node 18+.",
    );
  }

  const parsed = parseGreenhouseJobUrl(options.jobUrl);
  const response = await fetchGreenhouseJson<any>(fetchFn, {
    url: parsed.detailUrl,
    signal: options.signal,
    headers: {
      accept: "application/json",
      referer: parsed.canonicalJobUrl,
      "user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
      ...options.headers,
    },
  });

  const sourceName = `greenhouse:${parsed.boardToken.toLowerCase()}`;
  const descriptionHtml = response.content || "";

  return {
    job: {
      source: sourceName,
      externalId: parsed.jobId,
      title: response.title || "",
      jobUrl: response.absolute_url || parsed.canonicalJobUrl,
      locationText: response.location?.name || undefined,
      postedOn: response.updated_at || undefined,
      employmentStatus: undefined,
      minimumExperience: undefined,
      jobDescriptionHtml: descriptionHtml,
      jobDescriptionText: htmlToText(descriptionHtml),
      raw: response,
    },
  };
}

function htmlToText(html: string): string {
  // Decode HTML entities
  let text = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Normal HTML elements removal
  text = text
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

async function fetchGreenhouseJson<T>(
  fetchFn: typeof fetch,
  input: {
    url: string;
    signal?: AbortSignal;
    headers?: HeadersInit;
  },
): Promise<T> {
  const response = await fetchFn(input.url, {
    method: "GET",
    signal: input.signal,
    headers: input.headers,
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Greenhouse request failed with HTTP ${response.status} for ${input.url}.`,
    );
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(`Greenhouse response was not valid JSON for ${input.url}.`);
  }
}

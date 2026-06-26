import { parseGreenhouseUrl } from "./greenhouse-url";

export interface GreenhouseCompanyInfoResponse {
  name: string;
  content?: string;
  [key: string]: unknown;
}

export interface NormalizedGreenhouseCompanyInfo {
  name: string;
  logoUrl?: string;
  raw: GreenhouseCompanyInfoResponse;
}

export interface FetchGreenhouseCompanyInfoOptions {
  careersUrl: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  headers?: HeadersInit;
  userAgent?: string;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

export async function getCompanyInfo(
  options: FetchGreenhouseCompanyInfoOptions,
): Promise<{ company: NormalizedGreenhouseCompanyInfo }> {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error(
      "No fetch implementation available. Pass fetchImpl or use Node 18+.",
    );
  }

  const parsed = parseGreenhouseUrl(options.careersUrl);
  const infoUrl = `https://boards-api.greenhouse.io/v1/boards/${parsed.boardToken}`;

  const response = await fetchGreenhouseJson<GreenhouseCompanyInfoResponse>(
    fetchFn,
    {
      url: infoUrl,
      signal: options.signal,
      headers: {
        accept: "application/json",
        referer: parsed.canonicalCareersUrl,
        "user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
        ...options.headers,
      },
    },
  );

  return {
    company: {
      name: response.name || parsed.boardToken,
      // Clearbit provides a free public logo endpoint for companies if we want it, or we can use a fallback.
      logoUrl: `https://logo.clearbit.com/${parsed.boardToken}.com`,
      raw: response,
    },
  };
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

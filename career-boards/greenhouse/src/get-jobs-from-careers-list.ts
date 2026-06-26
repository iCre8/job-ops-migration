import {
  type GreenhouseSourceConfig,
  greenhouseUrlToJobUrl,
  parseGreenhouseUrl,
} from "./greenhouse-url";

export interface GreenhouseLocation {
  name: string;
}

export interface GreenhouseListJob {
  id: number | string;
  internal_job_id?: number | string;
  title: string;
  updated_at?: string;
  requisition_id?: string;
  location?: GreenhouseLocation | null;
  absolute_url: string;
  language?: string;
  content?: string;
  [key: string]: unknown;
}

export interface GreenhouseListResponse {
  jobs: GreenhouseListJob[];
  meta?: {
    total: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface NormalizedGreenhouseJob {
  source: string; // "greenhouse:<company>"
  externalId: string;
  title: string;
  jobUrl: string;
  locationText?: string;
  employmentStatus?: string;
  raw: GreenhouseListJob;
}

export interface FetchGreenhouseJobsOptions {
  careersUrl: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  headers?: HeadersInit;
  userAgent?: string;
}

export interface FetchGreenhouseJobsResult {
  total: number;
  fetched: number;
  jobs: NormalizedGreenhouseJob[];
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

export async function getJobsFromCareersList(
  options: FetchGreenhouseJobsOptions,
): Promise<FetchGreenhouseJobsResult> {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error(
      "No fetch implementation available. Pass fetchImpl or use Node 18+.",
    );
  }

  const source = parseGreenhouseUrl(options.careersUrl);
  // Fetch with content=true so we get the HTML job descriptions in the list too!
  const listUrlWithContent = `${source.listUrl}?content=true`;

  const response = await fetchGreenhouseJson<GreenhouseListResponse>(fetchFn, {
    url: listUrlWithContent,
    signal: options.signal,
    headers: {
      accept: "application/json",
      referer: source.canonicalCareersUrl,
      "user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
      ...options.headers,
    },
  });

  const rows = Array.isArray(response.jobs) ? response.jobs : [];
  const jobs = rows.map((job) => normalizeGreenhouseListJob(job, source));
  const total =
    typeof response.meta?.total === "number"
      ? response.meta.total
      : jobs.length;

  return {
    total,
    fetched: jobs.length,
    jobs,
  };
}

export function normalizeGreenhouseListJob(
  job: GreenhouseListJob,
  source: GreenhouseSourceConfig,
): NormalizedGreenhouseJob {
  const externalId = String(job.id).trim();
  if (!externalId) {
    throw new Error(
      `Greenhouse response is missing required field id for ${source.listUrl}.`,
    );
  }
  
  const title = job.title?.trim();
  if (!title) {
    throw new Error(
      `Greenhouse response is missing required field title for ${source.listUrl}.`,
    );
  }

  // Use the company specific source name: e.g. "greenhouse:stripe"
  const sourceName = `greenhouse:${source.boardToken.toLowerCase()}`;

  return {
    source: sourceName,
    externalId,
    title,
    // absolute_url can sometimes point to company's customized site (e.g. stripe.com/jobs/search?gh_jid=...)
    // so we use it directly or fallback to standard greenhouse job URL
    jobUrl: job.absolute_url || greenhouseUrlToJobUrl(source.canonicalCareersUrl, externalId),
    locationText: job.location?.name?.trim() || undefined,
    employmentStatus: undefined, // Greenhouse list doesn't explicitly return employmentStatus in the root response objects
    raw: job,
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

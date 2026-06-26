import {
  greenhouseUrlToCompanyLabel,
  greenhouseUrlToSourceKey,
  getCompanyInfo,
  getJobDetails,
  getJobsFromCareersList,
  parseGreenhouseUrl,
} from "@career-boards/greenhouse";
import { upstreamError } from "@infra/errors";
import type { ManualJobDraft, WatchlistSelectedSource } from "@shared/types";
import { z } from "zod";
import type { WatchlistCatalogSourceAdapter } from "./types";

const GREENHOUSE_LOGO_MAX_BYTES = 1_000_000;
const GREENHOUSE_WATCHLIST_MAX_JOBS = 50;

const greenhouseSourceSchema = z.object({
  label: z.string().trim().min(1).max(200),
  greenhouseUrl: z.string().trim().url().max(2000),
});

export const greenhouseWatchlistAdapter: WatchlistCatalogSourceAdapter = {
  sourceType: "greenhouse",
  descriptor: {
    sourceType: "greenhouse",
    label: "Greenhouse",
    catalogLabel: "Greenhouse company",
    customSourceOptionLabel: "Choose your own Greenhouse URL",
    customSourceSearchText: "custom greenhouse url",
    customSourceInputLabel: "Custom Greenhouse URL",
    customSourcePlaceholder: "https://boards.greenhouse.io/company",
    customSourceHelpText:
      "Use the public Greenhouse careers URL, not an individual job posting URL.",
    emptyCatalogText: "No Greenhouse companies found.",
    fetchingLabel: "Fetching from Greenhouse...",
    invalidUrlMessage: "Invalid Greenhouse URL",
    supportsCustomSource: true,
    supportsBranding: true,
  },
  catalogSchema: greenhouseSourceSchema,
  parseCatalogSources(entries) {
    return z
      .array(greenhouseSourceSchema)
      .parse(entries)
      .map((entry) => {
        const parsed = parseGreenhouseUrl(entry.greenhouseUrl);
        return {
          id: buildSourceId(parsed.canonicalCareersUrl),
          label: entry.label,
          sourceType: "greenhouse",
          careersUrl: parsed.canonicalCareersUrl,
          cxsJobsUrl: null,
        };
      });
  },
  hydrateSelectedSource(source) {
    const parsed = parseGreenhouseUrl(source.careersUrl);
    return {
      ...source,
      label: getHydratedGreenhouseLabel(source),
      careersUrl: parsed.canonicalCareersUrl,
      cxsJobsUrl: null,
    };
  },
  normalizeCustomSelection(input) {
    const parsed = parseGreenhouseUrl(input.careersUrl);
    const canonicalCareersUrl = parsed.canonicalCareersUrl;
    const trimmedLabel = input.label?.trim();
    const label =
      trimmedLabel && trimmedLabel !== input.careersUrl.trim()
        ? trimmedLabel
        : greenhouseUrlToCompanyLabel(canonicalCareersUrl);

    return {
      label,
      careersUrl: canonicalCareersUrl,
    };
  },
  async fetchJobs(input) {
    const response = await getJobsFromCareersList({
      careersUrl: input.source.careersUrl,
      signal: input.signal,
    });
    const source = greenhouseUrlToSourceKey(input.source.careersUrl);
    const jobs = await Promise.all(
      response.jobs.map(async (job) => {
        const details = await getJobDetails({
          jobUrl: job.jobUrl,
          signal: input.signal,
        });

        return {
          jobRef: details.job.jobUrl,
          source,
          sourceJobId: job.externalId,
          sourceType: input.source.sourceType,
          title: details.job.title,
          employer: input.source.label,
          jobUrl: details.job.jobUrl,
          applicationLink: details.job.jobUrl,
          location: details.job.locationText ?? job.locationText ?? null,
          postedAt: details.job.postedOn ?? null,
        };
      }),
    );
    const sortedJobs = jobs
      .sort((left, right) => comparePostedAtDesc(left.postedAt, right.postedAt))
      .slice(0, GREENHOUSE_WATCHLIST_MAX_JOBS);

    return {
      total: response.total,
      fetched: sortedJobs.length,
      jobs: sortedJobs,
    };
  },
  async fetchJobDetails(input) {
    const details = await getJobDetails({
      jobUrl: input.jobRef,
      signal: input.signal,
    });

    return {
      jobRef: input.jobRef,
      jobUrl: details.job.jobUrl,
      descriptionHtml: details.job.jobDescriptionHtml,
    };
  },
  async prepareImportDraft(input) {
    const details = await getJobDetails({
      jobUrl: input.jobRef,
      signal: input.signal,
    });
    const source = greenhouseUrlToSourceKey(input.source.careersUrl);
    const draft = buildManualDraft(input.source, source, details.job);

    return {
      draft,
      source: draft.source ?? null,
      sourceHost:
        getSourceHost(input.source.careersUrl) ?? getSourceHost(input.jobRef),
    };
  },
  async fetchBranding(input) {
    const companyInfo = await getCompanyInfo({
      careersUrl: input.source.careersUrl,
      signal: input.signal,
    });
    const logoUrl = companyInfo.company.logoUrl;
    if (!logoUrl) {
      throw upstreamError("Greenhouse company info did not include a logo URL", {
        careersUrl: input.source.careersUrl,
      });
    }

    const response = await fetch(logoUrl, {
      method: "GET",
      redirect: "follow",
      signal: input.signal,
    });

    if (!response.ok) {
      throw upstreamError(
        `Failed to fetch Greenhouse logo with HTTP ${response.status}.`,
        {
          url: logoUrl,
          status: response.status,
        },
      );
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > GREENHOUSE_LOGO_MAX_BYTES
    ) {
      throw upstreamError("Greenhouse company logo exceeded size limit", {
        url: logoUrl,
        contentLength,
        maxBytes: GREENHOUSE_LOGO_MAX_BYTES,
      });
    }

    const contentType = response.headers.get("content-type");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > GREENHOUSE_LOGO_MAX_BYTES) {
      throw upstreamError("Greenhouse company logo exceeded size limit", {
        url: logoUrl,
        contentLength: bytes.byteLength,
        maxBytes: GREENHOUSE_LOGO_MAX_BYTES,
      });
    }
    const mimeType = detectLogoMimeType(bytes, contentType);
    if (!mimeType) {
      throw upstreamError("Greenhouse logo response was not an image.", {
        url: logoUrl,
        contentType: contentType?.trim() || null,
      });
    }

    return {
      careersUrl: parseGreenhouseUrl(input.source.careersUrl).canonicalCareersUrl,
      logoUrl,
      mimeType,
      imageDataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    };
  },
};

function buildSourceId(careersUrl: string): string {
  return `greenhouse:${careersUrl}`;
}

function getHydratedGreenhouseLabel(source: {
  sourceType: string;
  label: string;
  careersUrl: string;
}): string {
  if (
    source.sourceType === "greenhouse" &&
    (!source.label.trim() || source.label.trim() === source.careersUrl.trim())
  ) {
    return greenhouseUrlToCompanyLabel(source.careersUrl);
  }

  return source.label;
}

function buildManualDraft(
  selectedSource: WatchlistSelectedSource,
  source: string,
  details: {
    externalId: string;
    title: string;
    jobUrl: string;
    locationText?: string;
    jobDescriptionText: string;
    employmentStatus?: string;
  },
): ManualJobDraft {
  return {
    source,
    sourceJobId: details.externalId,
    title: details.title,
    employer: selectedSource.label,
    jobUrl: details.jobUrl,
    applicationLink: details.jobUrl,
    location: details.locationText,
    jobDescription: details.jobDescriptionText,
    jobType: details.employmentStatus,
  };
}

function getSourceHost(value: string): string | null {
  try {
    return new URL(value).hostname || null;
  } catch {
    return null;
  }
}

function detectLogoMimeType(
  bytes: Buffer,
  contentTypeHeader: string | null,
): string | null {
  const normalizedContentType = contentTypeHeader?.trim().toLowerCase() ?? "";
  if (normalizedContentType.startsWith("image/")) {
    return contentTypeHeader?.trim() ?? normalizedContentType;
  }

  if (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.byteLength >= 6 &&
    (bytes.subarray(0, 6).toString("ascii") === "GIF87a" ||
      bytes.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return "image/gif";
  }

  if (
    bytes.byteLength >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  const text = bytes
    .toString("utf8", 0, Math.min(bytes.byteLength, 512))
    .trim()
    .replace(/^\uFEFF/, "");
  if (text.startsWith("<svg") || text.startsWith("<?xml")) {
    return "image/svg+xml";
  }

  return null;
}

function comparePostedAtDesc(
  left: string | null,
  right: string | null,
): number {
  const leftTime = left ? Date.parse(left) : Number.NaN;
  const rightTime = right ? Date.parse(right) : Number.NaN;
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);

  if (leftValid && rightValid) return rightTime - leftTime;
  if (leftValid) return -1;
  if (rightValid) return 1;
  return 0;
}

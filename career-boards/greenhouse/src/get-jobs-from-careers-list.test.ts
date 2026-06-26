import { describe, expect, it, vi } from "vitest";
import { getJobsFromCareersList } from "./get-jobs-from-careers-list";

describe("getJobsFromCareersList", () => {
  it("normalizes Greenhouse list payloads correctly", async () => {
    const mockJobsResponse = {
      jobs: [
        {
          id: 7417090,
          title: "Technical Program Manager",
          absolute_url: "https://stripe.com/jobs/search?gh_jid=7417090",
          location: { name: "Remote in the US" },
          updated_at: "2026-06-19T12:11:02-04:00",
        },
      ],
      meta: { total: 1 },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockJobsResponse),
    });

    const result = await getJobsFromCareersList({
      careersUrl: "https://boards.greenhouse.io/stripe",
      fetchImpl: mockFetch as any,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true",
      expect.objectContaining({ method: "GET" }),
    );

    expect(result.total).toBe(1);
    expect(result.fetched).toBe(1);
    expect(result.jobs[0]).toEqual({
      source: "greenhouse:stripe",
      externalId: "7417090",
      title: "Technical Program Manager",
      jobUrl: "https://stripe.com/jobs/search?gh_jid=7417090",
      locationText: "Remote in the US",
      employmentStatus: undefined,
      raw: mockJobsResponse.jobs[0],
    });
  });
});

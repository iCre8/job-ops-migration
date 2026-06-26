import { describe, expect, it } from "vitest";
import {
  isGreenhouseUrl,
  parseGreenhouseJobUrl,
  parseGreenhouseUrl,
  greenhouseUrlToCompanyLabel,
  greenhouseUrlToSourceKey,
} from "./greenhouse-url";

describe("greenhouse-url", () => {
  describe("isGreenhouseUrl", () => {
    it("returns true for valid Greenhouse URLs", () => {
      expect(isGreenhouseUrl("https://boards.greenhouse.io/stripe")).toBe(true);
      expect(isGreenhouseUrl("https://boards-api.greenhouse.io/v1/boards/stripe")).toBe(true);
      expect(isGreenhouseUrl("boards.greenhouse.io/stripe")).toBe(true);
    });

    it("returns false for non-Greenhouse URLs", () => {
      expect(isGreenhouseUrl("https://company.bamboohr.com/careers")).toBe(false);
      expect(isGreenhouseUrl("")).toBe(false);
    });
  });

  describe("parseGreenhouseUrl", () => {
    it("parses standard careers page URLs", () => {
      const parsed = parseGreenhouseUrl("https://boards.greenhouse.io/stripe");
      expect(parsed.boardToken).toBe("stripe");
      expect(parsed.canonicalCareersUrl).toBe("https://boards.greenhouse.io/stripe");
      expect(parsed.listUrl).toBe("https://boards-api.greenhouse.io/v1/boards/stripe/jobs");
    });

    it("parses embed board URLs", () => {
      const parsed = parseGreenhouseUrl("https://boards.greenhouse.io/embed/job_board?board_id=stripe");
      expect(parsed.boardToken).toBe("stripe");
    });

    it("parses API board URLs", () => {
      const parsed = parseGreenhouseUrl("https://boards-api.greenhouse.io/v1/boards/stripe/jobs");
      expect(parsed.boardToken).toBe("stripe");
    });
  });

  describe("parseGreenhouseJobUrl", () => {
    it("parses standard job URLs", () => {
      const parsed = parseGreenhouseJobUrl("https://boards.greenhouse.io/stripe/jobs/7417090");
      expect(parsed.boardToken).toBe("stripe");
      expect(parsed.jobId).toBe("7417090");
      expect(parsed.detailUrl).toBe("https://boards-api.greenhouse.io/v1/boards/stripe/jobs/7417090");
    });

    it("parses embedded job URLs", () => {
      const parsed = parseGreenhouseJobUrl("https://boards.greenhouse.io/embed/job_detail?board_id=stripe&job_id=7417090");
      expect(parsed.boardToken).toBe("stripe");
      expect(parsed.jobId).toBe("7417090");
    });

    it("parses redirected job URLs containing gh_jid", () => {
      const parsed = parseGreenhouseJobUrl("https://stripe.com/jobs/search?gh_jid=7417090");
      expect(parsed.boardToken).toBe("stripe");
      expect(parsed.jobId).toBe("7417090");
    });
  });

  describe("label and sourceKey helpers", () => {
    it("formats boardToken correctly for company labels", () => {
      expect(greenhouseUrlToCompanyLabel("https://boards.greenhouse.io/stripe")).toBe("Stripe");
      expect(greenhouseUrlToCompanyLabel("https://boards.greenhouse.io/some-cool-startup_co")).toBe("Some Cool Startup Co");
    });

    it("generates correct source keys", () => {
      expect(greenhouseUrlToSourceKey("https://boards.greenhouse.io/stripe")).toBe("greenhouse:stripe");
      expect(greenhouseUrlToSourceKey("https://boards.greenhouse.io/some-cool-startup")).toBe("greenhouse:some-cool-startup");
    });
  });
});

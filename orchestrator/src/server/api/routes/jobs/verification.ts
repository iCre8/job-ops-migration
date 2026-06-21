import { AppError } from "@infra/errors";
import { fail, ok } from "@infra/http";
import { logger } from "@infra/logger";
import * as jobsRepo from "@server/repositories/jobs";
import { type Request, type Response, Router } from "express";

export const jobsVerificationRouter = Router();

/**
 * Trigger verification for a job posting.
 * Marks the job's verificationStatus as "unverified", which will enqueue it
 * to be processed by the background polling worker.
 */
jobsVerificationRouter.post("/:id/verify", async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const currentJob = await jobsRepo.getJobById(jobId);

    if (!currentJob) {
      const err = new AppError({
        status: 404,
        code: "NOT_FOUND",
        message: "Job not found",
      });
      logger.warn("Job verification trigger failed - job not found", {
        route: "POST /api/jobs/:id/verify",
        jobId,
        status: err.status,
      });
      fail(res, err);
      return;
    }

    logger.info("Triggering job verification", {
      route: "POST /api/jobs/:id/verify",
      jobId,
    });

    // Mark job as unverified to queue it for the background polling agent
    const updatedJob = await jobsRepo.updateJob(jobId, {
      verificationStatus: "unverified",
      verificationVerdict: null,
      verificationScore: null,
      verificationPriority: null,
      verificationDetails: null,
      verificationOutreachMessage: null,
      verificationRunAt: null,
    });

    if (!updatedJob) {
      const err = new AppError({
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Failed to update job verification status",
      });
      fail(res, err);
      return;
    }

    ok(res, updatedJob);
  } catch (error: any) {
    const err = new AppError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: error.message || "Failed to trigger job verification",
    });
    logger.error("Job verification trigger failed", {
      route: "POST /api/jobs/:id/verify",
      jobId: req.params.id,
      error,
    });
    fail(res, err);
  }
});

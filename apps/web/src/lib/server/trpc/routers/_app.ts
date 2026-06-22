import { router } from "../init.js";
import { analyticsRouter } from "./analytics.js";
import { authRouter } from "./auth.js";
import { chatRouter } from "./chat.js";
import { designResumeRouter } from "./design-resume.js";
import { jobsRouter } from "./jobs.js";
import { manualJobsRouter } from "./manual-jobs.js";
import { pipelineRouter } from "./pipeline.js";
import { settingsRouter } from "./settings.js";
import { tracerRouter } from "./tracer.js";
import { trackingRouter } from "./tracking.js";
import { watchlistRouter } from "./watchlist.js";

export const appRouter = router({
  analytics: analyticsRouter,
  auth: authRouter,
  chat: chatRouter,
  designResume: designResumeRouter,
  jobs: jobsRouter,
  manualJobs: manualJobsRouter,
  pipeline: pipelineRouter,
  settings: settingsRouter,
  tracer: tracerRouter,
  tracking: trackingRouter,
  watchlist: watchlistRouter,
});

export type AppRouter = typeof appRouter;

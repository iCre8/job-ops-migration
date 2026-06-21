import { router } from "../init.js";
import { authRouter } from "./auth.js";
import { jobsRouter } from "./jobs.js";
import { pipelineRouter } from "./pipeline.js";
import { settingsRouter } from "./settings.js";
import { trackingRouter } from "./tracking.js";

export const appRouter = router({
  auth: authRouter,
  jobs: jobsRouter,
  settings: settingsRouter,
  pipeline: pipelineRouter,
  tracking: trackingRouter,
});

export type AppRouter = typeof appRouter;

/**
 * GET /health
 *
 * Liveness probe used by Docker Compose health checks and load balancers.
 * Returns 200 immediately — does NOT check database connectivity (that would
 * make the probe stateful and cause container restarts on transient DB issues).
 *
 * For a readiness probe that checks DB connectivity, add a separate
 * GET /ready endpoint in a future phase.
 */
export function GET() {
  return Response.json(
    {
      ok: true,
      service: "job-ops-web",
      version: "0.1.0",
    },
    { status: 200 },
  );
}

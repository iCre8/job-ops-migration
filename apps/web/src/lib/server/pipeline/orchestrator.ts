/**
 * Pipeline orchestrator — mirrors the original orchestrator/src/server/pipeline/orchestrator.ts.
 *
 * Runs five sequential stages in the background (fire-and-forget from the tRPC trigger):
 *   1. Discover  — scrape job boards via the Python extractor sidecar
 *   2. Import    — deduplicate and upsert discovered jobs into MongoDB
 *   3. Score     — LLM-score each job for suitability
 *   4. Select    — filter by minScore, sort, take topN
 *   5. Process   — generate tailored summary (+ optionally PDF) for each selected job
 *
 * Progress is broadcast via emitPipelineEvent → SSE → client.
 */

import { getPrisma } from "$lib/server/db/index.js";
import { emitPipelineEvent } from "$lib/server/infra/pipeline-events.js";
import { scrapeJobSpy, type RawJob } from "$lib/server/services/extractors/jobspy.js";
import { resolveLlmConfig, type ChatMessage } from "$lib/server/services/llm/index.js";

// ── Cancellation registry ─────────────────────────────────────────────────────

const runningPipelines = new Map<string, AbortController>();

/**
 * Signal an active pipeline to stop. The orchestrator checks this at each
 * stage boundary; when aborted it throws, ending the run with status "failed".
 * Returns false if no active run with that ID was found.
 */
export function cancelPipeline(runId: string): boolean {
  const controller = runningPipelines.get(runId);
  if (!controller) return false;
  controller.abort();
  return true;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PipelineConfig {
  /** Run ID of the already-created PipelineRun record. */
  runId: string;
  /** Search terms; falls back to settings.searchTerms. */
  searchTerms?: string[];
  /** Location string passed to the extractor. */
  location?: string;
  /** Country code (e.g. "uk", "us"). */
  country?: string;
  /** Remote-only filter. */
  isRemote?: boolean;
  /** Results per search term from the extractor. */
  resultsWanted?: number;
  /** Job boards to query. */
  sites?: string[];
  /** Minimum LLM suitability score (0–100) for a job to be selected. */
  minSuitabilityScore?: number;
  /** Maximum jobs to process (score + tailor). */
  topN?: number;
  /** Custom scoring instructions appended to the LLM scorer prompt. */
  scoringInstructions?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emit(runId: string, type: "start" | "progress" | "complete" | "error", message: string, extra?: { jobsFound?: number; jobsScored?: number }) {
  emitPipelineEvent({ type, runId, message, ...extra });
}

async function resolveConfig(partial: PipelineConfig): Promise<Required<Omit<PipelineConfig, "runId">> & { runId: string }> {
  const prisma = getPrisma();
  let settings: Record<string, unknown> = {};
  try {
    const row = await prisma.settings.findFirst({ where: { id: "singleton" } });
    settings = (row?.data ?? {}) as Record<string, unknown>;
  } catch { /* ignore */ }

  const searchTerms = partial.searchTerms?.length
    ? partial.searchTerms
    : ((settings.searchTerms as string | undefined)?.split(",").map((t) => t.trim()).filter(Boolean) ?? ["software engineer"]);

  return {
    runId: partial.runId,
    searchTerms,
    location: partial.location ?? (settings.searchLocation as string | undefined) ?? "",
    country:  partial.country  ?? (settings.searchCountry  as string | undefined) ?? "us",
    isRemote: partial.isRemote ?? (settings.searchRemote  as boolean | undefined) ?? false,
    resultsWanted: partial.resultsWanted ?? (settings.resultsWanted as number | undefined) ?? 25,
    sites:    partial.sites    ?? ["linkedin", "indeed", "glassdoor"],
    minSuitabilityScore: partial.minSuitabilityScore ?? (settings.scoreThreshold as number | undefined) ?? 60,
    topN:     partial.topN     ?? 10,
    scoringInstructions: partial.scoringInstructions ?? (settings.promptScorer as string | undefined) ?? "",
  };
}

/** Normalise raw extractor output into Job create-input. */
function normaliseJob(raw: RawJob, source: string) {
  return {
    title:       raw.title?.trim()   ?? "Untitled",
    employer:    raw.company?.trim() ?? null,
    url:         raw.job_url         ?? null,
    location:    raw.location        ?? null,
    isRemote:    raw.is_remote       ?? false,
    jobType:     raw.job_type        ?? null,
    jobDescription: raw.description  ?? null,
    salaryMin:   raw.min_amount      ?? null,
    salaryMax:   raw.max_amount      ?? null,
    salaryCurrency: raw.currency     ?? null,
    salaryPeriod:   raw.interval     ?? null,
    source,
    status:      "discovered",
    postedAt:    raw.date_posted ? new Date(raw.date_posted) : null,
  };
}

/** Deduplicate by (title, employer) — same logic as the original fuzzy merge. */
function deduplicateJobs(jobs: ReturnType<typeof normaliseJob>[]) {
  const seen = new Map<string, boolean>();
  return jobs.filter((j) => {
    const key = `${(j.title ?? "").toLowerCase().slice(0, 40)}::${(j.employer ?? "").toLowerCase().slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.set(key, true);
    return true;
  });
}

/** LLM call: score a single job 0–100 with a short reasoning note. */
async function scoreJob(
  job: { title: string; employer: string | null; jobDescription: string | null; location: string | null },
  instructions: string,
  signal: AbortSignal,
): Promise<{ score: number; reasoning: string }> {
  const config = await resolveLlmConfig();
  if (!config.apiKey) return { score: 50, reasoning: "LLM not configured — default score applied." };

  const systemPrompt = [
    "You are a job suitability scorer. Given a job posting, return a JSON object with two fields:",
    '  "score": integer 0-100 (100 = perfect fit)',
    '  "reasoning": one or two sentences explaining the score',
    "Return ONLY valid JSON. No markdown, no code fences.",
    instructions ? `\nAdditional scoring criteria:\n${instructions}` : "",
  ].filter(Boolean).join("\n");

  const userMessage = [
    `Title: ${job.title}`,
    `Employer: ${job.employer ?? "Unknown"}`,
    `Location: ${job.location ?? "Unknown"}`,
    `Description (excerpt): ${(job.jobDescription ?? "").slice(0, 1500)}`,
  ].join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user",   content: userMessage },
  ];

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages, stream: false, max_tokens: 256 }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    });
    if (!res.ok) throw new Error(`LLM error ${res.status}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(content) as { score?: number; reasoning?: string };
    return {
      score:     Math.min(100, Math.max(0, Math.round(Number(parsed.score ?? 50)))),
      reasoning: parsed.reasoning ?? "",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return { score: 50, reasoning: "Scoring failed — default score applied." };
  }
}

/** LLM call: generate a tailored 2–3 sentence summary for the job. */
async function tailorJob(
  job: { title: string; employer: string | null; jobDescription: string | null },
  signal: AbortSignal,
): Promise<string> {
  const config = await resolveLlmConfig();
  if (!config.apiKey) return "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "Write a concise 2–3 sentence summary of why this job is worth applying to and what makes it stand out. Focus on the role, key responsibilities, and growth opportunity. Return plain text only.",
    },
    {
      role: "user",
      content: `Title: ${job.title}\nEmployer: ${job.employer ?? "Unknown"}\nDescription:\n${(job.jobDescription ?? "").slice(0, 2000)}`,
    },
  ];

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages, stream: false, max_tokens: 200 }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    return "";
  }
}

// ── Concurrency helper ────────────────────────────────────────────────────────

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runPipelineOrchestrator(partial: PipelineConfig): Promise<void> {
  const config = await resolveConfig(partial);
  const { runId } = config;
  const prisma = getPrisma();

  const controller = new AbortController();
  const { signal } = controller;
  runningPipelines.set(runId, controller);

  function checkCancelled() {
    if (signal.aborted) throw new Error("Pipeline cancelled by user");
  }

  async function updateRun(data: Parameters<typeof prisma.pipelineRun.update>[0]["data"]) {
    await prisma.pipelineRun.update({ where: { id: runId }, data }).catch(() => {});
  }

  try {
    emit(runId, "start", "Pipeline started");

    // ── Stage 1: Discover ──────────────────────────────────────────────────
    emit(runId, "progress", `Searching for jobs: ${config.searchTerms.join(", ")} in ${config.location || config.country}`);

    const rawJobs = await scrapeJobSpy({
      searchTerms:    config.searchTerms,
      location:       config.location,
      country:        config.country,
      isRemote:       config.isRemote,
      resultsWanted:  config.resultsWanted,
      sites:          config.sites,
      signal,
    });

    checkCancelled();
    emit(runId, "progress", `Discovered ${rawJobs.length} raw job listings`, { jobsFound: rawJobs.length });

    // ── Stage 2: Import ────────────────────────────────────────────────────
    emit(runId, "progress", "Importing and deduplicating jobs…");

    const normalised = rawJobs.map((r) => normaliseJob(r, "jobspy"));
    const deduped    = deduplicateJobs(normalised);

    let created = 0;
    let skipped = 0;

    for (const jobData of deduped) {
      checkCancelled();
      try {
        const existing = await prisma.job.findFirst({
          where: {
            title:    { equals: jobData.title,    mode: "insensitive" },
            employer: { equals: jobData.employer ?? "", mode: "insensitive" },
          },
          select: { id: true, status: true },
        });

        if (existing) {
          skipped++;
        } else {
          await prisma.job.create({
            data: {
              ...jobData,
              notes:       [],
              documents:   [],
              stageEvents: [],
              tasks:       [],
              interviews:  [],
            },
          });
          created++;
        }
      } catch (err) {
        if (err instanceof Error && err.message === "Pipeline cancelled by user") throw err;
        skipped++;
      }
    }

    await updateRun({ jobsFound: created + skipped });
    emit(runId, "progress", `Imported ${created} new jobs (${skipped} duplicates skipped)`, { jobsFound: created });

    if (created === 0) {
      emit(runId, "complete", "Pipeline complete — no new jobs found.");
      await updateRun({ status: "completed", completedAt: new Date(), jobsFound: 0 });
      return;
    }

    // ── Stage 3: Score ─────────────────────────────────────────────────────
    checkCancelled();
    emit(runId, "progress", `Scoring ${created} jobs with AI…`);

    const newJobs = await prisma.job.findMany({
      where: { status: "discovered", scoreOverall: null },
      orderBy: { createdAt: "desc" },
      take: created,
      select: { id: true, title: true, employer: true, jobDescription: true, location: true },
    });

    let scored = 0;
    await runWithConcurrency(newJobs, 3, async (job) => {
      checkCancelled();
      const { score, reasoning } = await scoreJob(job, config.scoringInstructions, signal);
      await prisma.job.update({
        where: { id: job.id },
        data:  { scoreOverall: score, scoreReasoning: reasoning },
      }).catch(() => {});
      scored++;
      if (scored % 5 === 0 || scored === newJobs.length) {
        emit(runId, "progress", `Scored ${scored}/${newJobs.length} jobs…`, { jobsScored: scored });
      }
    });

    await updateRun({ jobsScored: scored });
    emit(runId, "progress", `Scoring complete — ${scored} jobs scored`, { jobsScored: scored });

    // ── Stage 4: Select ────────────────────────────────────────────────────
    checkCancelled();
    const topJobs = await prisma.job.findMany({
      where: {
        status:       "discovered",
        scoreOverall: { gte: config.minSuitabilityScore },
      },
      orderBy: { scoreOverall: "desc" },
      take:    config.topN,
      select:  { id: true, title: true, employer: true, jobDescription: true },
    });

    emit(runId, "progress", `Selected ${topJobs.length} jobs above score ${config.minSuitabilityScore} for processing`);

    if (topJobs.length === 0) {
      emit(runId, "complete", `Pipeline complete — no jobs met the minimum score of ${config.minSuitabilityScore}.`);
      await updateRun({ status: "completed", completedAt: new Date() });
      return;
    }

    await prisma.job.updateMany({
      where: { id: { in: topJobs.map((j) => j.id) } },
      data:  { status: "ready" },
    });

    // ── Stage 5: Process ───────────────────────────────────────────────────
    checkCancelled();
    emit(runId, "progress", `Generating tailored summaries for ${topJobs.length} jobs…`);

    let processed = 0;
    await runWithConcurrency(topJobs, 3, async (job) => {
      checkCancelled();
      const summary = await tailorJob(job, signal);
      if (summary) {
        await prisma.job.update({
          where: { id: job.id },
          data:  { tailoredSummary: summary },
        }).catch(() => {});
      }
      processed++;
      emit(runId, "progress", `Processed ${processed}/${topJobs.length}: ${job.title}`);
    });

    // ── Complete ───────────────────────────────────────────────────────────
    await updateRun({
      status:      "completed",
      completedAt: new Date(),
      jobsFound:   created,
      jobsScored:  scored,
    });

    emit(runId, "complete",
      `Pipeline complete — ${created} new jobs found, ${scored} scored, ${topJobs.length} ready to apply.`,
      { jobsFound: created, jobsScored: scored },
    );

  } catch (err) {
    const cancelled = signal.aborted || (err instanceof Error && err.message === "Pipeline cancelled by user");
    const message = cancelled ? "Cancelled by user" : (err instanceof Error ? err.message : "Unknown error");
    await updateRun({ status: "failed", completedAt: new Date(), error: message }).catch(() => {});
    if (cancelled) {
      emit(runId, "error", "Pipeline cancelled by user");
    } else {
      emit(runId, "error", `Pipeline failed: ${message}`);
      throw err;
    }
  } finally {
    runningPipelines.delete(runId);
  }
}

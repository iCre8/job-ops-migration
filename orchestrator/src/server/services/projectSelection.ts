/**
 * Service for AI-powered project selection for resumes.
 */

import { logger } from "@infra/logger";
import type { JsonSchemaDefinition } from "./llm/types";
import { createConfiguredLlmService, resolveLlmModel } from "./modelSelection";
import type { ResumeProjectSelectionItem } from "./resumeProjects";

const PROJECT_SELECTION_TRACE = "PROJECT_SELECTION_TRACE";

/** JSON schema for project selection response */
const PROJECT_SELECTION_SCHEMA: JsonSchemaDefinition = {
  name: "project_selection",
  schema: {
    type: "object",
    properties: {
      selectedProjectIds: {
        type: "array",
        items: { type: "string" },
        description: "List of project IDs to include on the resume",
      },
    },
    required: ["selectedProjectIds"],
    additionalProperties: false,
  },
};

export async function pickProjectIdsForJob(args: {
  jobDescription: string;
  eligibleProjects: ResumeProjectSelectionItem[];
  desiredCount: number;
}): Promise<string[]> {
  const desiredCount = Math.max(0, Math.floor(args.desiredCount));
  if (desiredCount === 0) {
    logger.info(`${PROJECT_SELECTION_TRACE} skipped selector`, {
      marker: PROJECT_SELECTION_TRACE,
      phase: "pickProjectIdsForJob.skipped",
      reason: "desired-count-zero",
      requestedDesiredCount: args.desiredCount,
      eligibleProjectCount: args.eligibleProjects.length,
      eligibleProjectIds: args.eligibleProjects.map((project) => project.id),
    });
    return [];
  }

  const eligibleIds = new Set(args.eligibleProjects.map((p) => p.id));
  if (eligibleIds.size === 0) {
    logger.info(`${PROJECT_SELECTION_TRACE} skipped selector`, {
      marker: PROJECT_SELECTION_TRACE,
      phase: "pickProjectIdsForJob.skipped",
      reason: "no-eligible-projects",
      requestedDesiredCount: args.desiredCount,
      desiredCount,
      eligibleProjectCount: args.eligibleProjects.length,
    });
    return [];
  }

  const model = await resolveLlmModel("projectSelection");
  logger.info(`${PROJECT_SELECTION_TRACE} calling selector model`, {
    marker: PROJECT_SELECTION_TRACE,
    phase: "pickProjectIdsForJob.llm.start",
    model,
    desiredCount,
    eligibleProjectCount: args.eligibleProjects.length,
    eligibleProjectIds: args.eligibleProjects.map((project) => project.id),
  });

  const prompt = buildProjectSelectionPrompt({
    jobDescription: args.jobDescription,
    projects: args.eligibleProjects,
    desiredCount,
  });

  const llm = await createConfiguredLlmService("projectSelection");
  const result = await llm.callJson<{ selectedProjectIds: string[] }>({
    model,
    messages: [{ role: "user", content: prompt }],
    jsonSchema: PROJECT_SELECTION_SCHEMA,
  });

  if (!result.success) {
    const fallback = fallbackPickProjectIds(
      args.jobDescription,
      args.eligibleProjects,
      desiredCount,
    );
    logger.warn(`${PROJECT_SELECTION_TRACE} selector model failed`, {
      marker: PROJECT_SELECTION_TRACE,
      phase: "pickProjectIdsForJob.llm.failed",
      model,
      desiredCount,
      eligibleProjectCount: args.eligibleProjects.length,
      fallbackProjectIds: fallback,
      fallbackProjectCount: fallback.length,
      error: result.error ?? "unknown",
    });
    return fallback;
  }

  const selectedProjectIds = Array.isArray(result.data?.selectedProjectIds)
    ? result.data.selectedProjectIds
    : [];

  // Validate and dedupe the returned IDs
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedProjectIds) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed) continue;
    if (!eligibleIds.has(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
    if (unique.length >= desiredCount) break;
  }

  if (unique.length === 0) {
    const fallback = fallbackPickProjectIds(
      args.jobDescription,
      args.eligibleProjects,
      desiredCount,
    );
    logger.warn(`${PROJECT_SELECTION_TRACE} selector returned no valid ids`, {
      marker: PROJECT_SELECTION_TRACE,
      phase: "pickProjectIdsForJob.llm.empty",
      model,
      desiredCount,
      eligibleProjectCount: args.eligibleProjects.length,
      rawSelectedProjectIds: selectedProjectIds,
      fallbackProjectIds: fallback,
      fallbackProjectCount: fallback.length,
    });
    return fallback;
  }

  logger.info(`${PROJECT_SELECTION_TRACE} selector returned ids`, {
    marker: PROJECT_SELECTION_TRACE,
    phase: "pickProjectIdsForJob.llm.success",
    model,
    desiredCount,
    eligibleProjectCount: args.eligibleProjects.length,
    rawSelectedProjectIds: selectedProjectIds,
    selectedProjectIds: unique,
    selectedProjectCount: unique.length,
  });
  return unique;
}

function buildProjectSelectionPrompt(args: {
  jobDescription: string;
  projects: ResumeProjectSelectionItem[];
  desiredCount: number;
}): string {
  const projects = args.projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    date: p.date,
    summary: truncate(p.summaryText, 500),
  }));

  return `
You are selecting which projects to include on a resume for a specific job.

Rules:
- Choose up to ${args.desiredCount} project IDs.
- Only choose IDs from the provided list.
- Prefer projects that strongly match the job description keywords/tech stack.
- Prefer projects that signal impact and real-world engineering.
- Do NOT invent projects or skills.

Job description:
${args.jobDescription}

Candidate projects (pick from these IDs only):
${JSON.stringify(projects, null, 2)}

Respond with JSON only, in this exact shape:
{
  "selectedProjectIds": ["id1", "id2"]
}
`.trim();
}

function fallbackPickProjectIds(
  jobDescription: string,
  eligibleProjects: ResumeProjectSelectionItem[],
  desiredCount: number,
): string[] {
  const jd = (jobDescription || "").toLowerCase();

  const signals = [
    "react",
    "typescript",
    "javascript",
    "node",
    "next",
    "nextjs",
    "python",
    "c++",
    "c#",
    "java",
    "kotlin",
    "sql",
    "mongodb",
    "aws",
    "docker",
    "graphql",
    "php",
    "unity",
    "tailwind",
  ];

  const activeSignals = signals.filter((s) => jd.includes(s));

  const scored = eligibleProjects
    .map((p) => {
      const text = `${p.name} ${p.description} ${p.summaryText}`.toLowerCase();
      let score = 0;
      for (const signal of activeSignals) {
        if (text.includes(signal)) score += 5;
      }
      if (/\b(open source|oss)\b/.test(text)) score += 2;
      if (/\b(api|backend|frontend|full[- ]?stack)\b/.test(text)) score += 1;
      return { id: p.id, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, desiredCount).map((s) => s.id);
}

function truncate(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input;
  return `${input.slice(0, maxChars - 1).trimEnd()}…`;
}

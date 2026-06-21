/**
 * Keyword-based email classifier — Phase 11.
 *
 * Classifies incoming emails by subject and snippet without an LLM call.
 * LLM-based classification can be layered on top in a later phase.
 *
 * Classification priority (first match wins):
 *   interview_invite > offer > rejection > follow_up > other
 */

export type EmailClassification =
  | "interview_invite"
  | "offer"
  | "rejection"
  | "follow_up"
  | "other";

export type EmailRelevance = "high" | "medium" | "low";

type Rule = { pattern: RegExp; classification: EmailClassification };

const RULES: Rule[] = [
  {
    pattern:
      /interview|screening|schedule.*call|call.*schedule|meeting.*request|technical.*round|assessment|take.?home|coding.*challenge/i,
    classification: "interview_invite",
  },
  {
    pattern:
      /offer|congratulation|pleased to offer|compensation package|start date|sign.*offer/i,
    classification: "offer",
  },
  {
    pattern:
      /unfortunately|regret to inform|not.*moving forward|other candidates|not selected|application.*unsuccessful|unable to proceed|position.*filled|not.*right fit|we.*won't be/i,
    classification: "rejection",
  },
  {
    pattern:
      /follow.?up|checking in|any update|status.*application|wanted to reach out|circling back/i,
    classification: "follow_up",
  },
];

/**
 * Classify an email based on its subject and snippet text.
 * Returns "other" when no rule matches.
 */
export function classifyEmail(
  subject: string | null,
  snippet: string,
): EmailClassification {
  const text = `${subject ?? ""} ${snippet}`;
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.classification;
  }
  return "other";
}

/**
 * Map a classification to a relevance tier.
 *   high   — interview invites and offers (require immediate action)
 *   medium — rejections and follow-ups
 *   low    — everything else
 */
export function classifyRelevance(cls: EmailClassification): EmailRelevance {
  if (cls === "interview_invite" || cls === "offer") return "high";
  if (cls === "rejection" || cls === "follow_up") return "medium";
  return "low";
}

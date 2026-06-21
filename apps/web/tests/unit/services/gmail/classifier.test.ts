/**
 * Unit tests — keyword email classifier
 */

import { describe, expect, it } from "vitest";
import {
  classifyEmail,
  classifyRelevance,
} from "../../../../src/lib/server/services/gmail/classifier.js";

describe("classifyEmail", () => {
  it("classifies interview keywords", () => {
    expect(classifyEmail("Interview invitation", "")).toBe("interview_invite");
    expect(classifyEmail("Schedule a call", "")).toBe("interview_invite");
    expect(classifyEmail(null, "technical round for your application")).toBe("interview_invite");
    expect(classifyEmail("Take-home assessment", "")).toBe("interview_invite");
    expect(classifyEmail("Coding challenge", "")).toBe("interview_invite");
  });

  it("classifies offer keywords", () => {
    expect(classifyEmail("Offer letter", "")).toBe("offer");
    expect(classifyEmail("Congratulations on your offer", "")).toBe("offer");
    expect(classifyEmail(null, "compensation package and start date")).toBe("offer");
  });

  it("classifies rejection keywords", () => {
    expect(classifyEmail("Unfortunately, we won't be moving forward", "")).toBe("rejection");
    expect(classifyEmail("Application unsuccessful", "")).toBe("rejection");
    expect(classifyEmail(null, "regret to inform you")).toBe("rejection");
    expect(classifyEmail("Other candidates selected", "")).toBe("rejection");
  });

  it("classifies follow-up keywords", () => {
    expect(classifyEmail("Follow-up on your application", "")).toBe("follow_up");
    expect(classifyEmail(null, "checking in on your application status")).toBe("follow_up");
    expect(classifyEmail("Circling back", "")).toBe("follow_up");
  });

  it("returns other for unmatched emails", () => {
    expect(classifyEmail("Monthly newsletter", "Top stories this week")).toBe("other");
    expect(classifyEmail(null, "Your order has shipped")).toBe("other");
    expect(classifyEmail(null, "")).toBe("other");
  });

  it("prioritises interview over other patterns (interview matches first)", () => {
    // Both interview and offer words present — interview wins (first rule)
    expect(classifyEmail("Interview and offer details", "")).toBe("interview_invite");
  });

  it("handles null subject gracefully", () => {
    expect(() => classifyEmail(null, "some snippet")).not.toThrow();
  });
});

describe("classifyRelevance", () => {
  it("returns high for interview_invite", () => {
    expect(classifyRelevance("interview_invite")).toBe("high");
  });

  it("returns high for offer", () => {
    expect(classifyRelevance("offer")).toBe("high");
  });

  it("returns medium for rejection", () => {
    expect(classifyRelevance("rejection")).toBe("medium");
  });

  it("returns medium for follow_up", () => {
    expect(classifyRelevance("follow_up")).toBe("medium");
  });

  it("returns low for other", () => {
    expect(classifyRelevance("other")).toBe("low");
  });
});

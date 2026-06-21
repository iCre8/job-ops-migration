import type { Job } from "@shared/types.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type VerificationCardProps = {
  job: Job;
  isVerifying: boolean;
  onVerify: () => Promise<void>;
  className?: string;
};

export const VerificationCard: React.FC<VerificationCardProps> = ({
  job,
  isVerifying,
  onVerify,
  className
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const status = job.verificationStatus || "unverified";
  const verdict = job.verificationVerdict;
  const score = job.verificationScore;
  const priority = job.verificationPriority;
  const details = job.verificationDetails as any;
  const outreach = job.verificationOutreachMessage;
  const runAt = job.verificationRunAt;

  const handleCopyOutreach = async () => {
    if (!outreach) return;
    try {
      await navigator.clipboard.writeText(outreach);
      setCopied(true);
      toast.success("Outreach message copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy outreach message.");
    }
  };

  const getVerdictStyle = (v: typeof verdict) => {
    switch (v) {
      case "likely_real":
        return {
          icon: ShieldCheck,
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
          bg: "bg-emerald-500/5",
          label: "Likely Real"
        };
      case "needs_verification":
        return {
          icon: Info,
          color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
          bg: "bg-blue-500/5",
          label: "Needs Verification"
        };
      case "possible_ghost":
        return {
          icon: AlertTriangle,
          color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
          bg: "bg-amber-500/5",
          label: "Possible Ghost"
        };
      case "likely_scam":
        return {
          icon: ShieldAlert,
          color: "text-rose-400 bg-rose-500/10 border-rose-500/20",
          bg: "bg-rose-500/5",
          label: "Likely Scam"
        };
      default:
        return {
          icon: Shield,
          color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
          bg: "bg-zinc-500/5",
          label: "Insufficient Evidence"
        };
    }
  };

  const verdictStyle = getVerdictStyle(verdict);
  const Icon = verdictStyle.icon;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-card/75 p-5 shadow-sm transition-all duration-300",
        verdictStyle.bg,
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg border p-2", verdictStyle.color)}>
            {status === "verifying" || isVerifying ? (
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Icon className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Hermes Posting Verification
            </h3>
            <p className="text-xs text-muted-foreground">
              {status === "unverified" && "This job has not been verified yet."}
              {(status === "verifying" || isVerifying) &&
                "Hermes is auditing source careers pages, ATS domains, and scam databases..."}
              {status === "completed" &&
                `Verified ${
                  runAt ? new Date(runAt).toLocaleDateString() : "recently"
                }`}
              {status === "failed" && "Verification failed. Please retry."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {status === "completed" && score !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence:</span>
              <Badge
                variant="outline"
                className={cn(
                  "font-mono font-bold text-xs py-0.5 px-2",
                  score >= 75
                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    : score >= 55
                      ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                      : "border-rose-500/30 text-rose-400 bg-rose-500/10"
                )}
              >
                {score}%
              </Badge>
            </div>
          )}

          {status === "completed" && priority && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Priority:</span>
              <Badge variant="secondary" className="capitalize text-xs">
                {priority.replace("_", " ")}
              </Badge>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            disabled={status === "verifying" || isVerifying}
            onClick={onVerify}
            className="flex items-center gap-1.5 text-xs h-8"
          >
            {status === "verifying" || isVerifying ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Verifying
              </>
            ) : status === "completed" ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Re-verify
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Verify
              </>
            )}
          </Button>
        </div>
      </div>

      {status === "completed" && verdict && (
        <div className="mt-4 border-t border-border/40 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Verdict:</span>
              <span className={cn("text-sm font-bold uppercase tracking-wider", verdictStyle.color.split(" ")[0])}>
                {verdictStyle.label}
              </span>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>
                  Collapse Audit Details
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Expand Audit Details
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4 text-sm border-t border-dashed border-border/45 pt-4">
                  {details?.recommendedNextStep && (
                    <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                      <span className="block font-semibold text-xs text-primary uppercase tracking-wide mb-1">
                        Recommended Next Step
                      </span>
                      <p className="text-foreground/90 leading-relaxed">
                        {details.recommendedNextStep}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    {details?.evidence && details.evidence.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="block font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                          Supporting Evidence
                        </span>
                        <ul className="space-y-1 text-foreground/80">
                          {details.evidence.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-emerald-400 mt-1 select-none">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {details?.redFlags && details.redFlags.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="block font-semibold text-xs text-rose-400 uppercase tracking-wide">
                          Red Flags / Signals
                        </span>
                        <ul className="space-y-1 text-foreground/80">
                          {details.redFlags.map((item: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-rose-400 mt-1 select-none">⚠</span>
                              <span className="text-rose-300">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {details?.missingEvidence && details.missingEvidence.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="block font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                        Missing Verification Context
                      </span>
                      <ul className="space-y-1 text-foreground/75">
                        {details.missingEvidence.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {outreach && (
                    <div className="space-y-2 border-t border-border/40 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="block font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                          Hiring Manager / Recruiter Outreach Message
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCopyOutreach}
                          className="h-7 px-2 text-xs flex items-center gap-1 hover:bg-muted"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy Message
                            </>
                          )}
                        </Button>
                      </div>
                      <pre className="rounded-lg border border-border/60 bg-background/50 p-3 font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed select-text">
                        {outreach}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
};

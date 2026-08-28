import { z } from "zod";

export const CriterionStatusSchema = z.enum(["MET", "PARTIAL", "MISSING", "INCORRECT"]);
export type CriterionStatus = z.infer<typeof CriterionStatusSchema>;

export const ApproachEvidenceSchema = z.object({
  score: z.number().min(0).max(10),
  criteria: z.record(z.string(), CriterionStatusSchema),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  misconceptions: z.array(z.string()),
});
export type ApproachEvidence = z.infer<typeof ApproachEvidenceSchema>;

export const PythonImplementationEvidenceSchema = z.object({
  source: z.literal("pyodide"),
  executionLocation: z.literal("browser"),
  finalCode: z.string(),
  deterministicStatus: z.enum(["pass", "partial", "fail", "error", "timeout"]),
  testsPassed: z.number(),
  testsTotal: z.number(),
  failedTestIds: z.array(z.string()),
  runtimeError: z
    .object({
      type: z.string(),
      line: z.number().optional(),
    })
    .optional(),
  durationMs: z.number(),
  runCount: z.number(),
});
export type PythonImplementationEvidence = z.infer<typeof PythonImplementationEvidenceSchema>;

export const ConsistencyEvidenceSchema = z.object({
  status: z.enum(["matched", "partially_matched", "contradicted", "insufficient_evidence"]),
  contradictions: z.array(
    z.object({
      candidateClaim: z.string(),
      observedImplementationEvidence: z.string(),
    }),
  ),
});
export type ConsistencyEvidence = z.infer<typeof ConsistencyEvidenceSchema>;

export const FollowupEvidenceSchema = z.object({
  status: CriterionStatusSchema,
  covered: z.array(z.string()),
  gaps: z.array(z.string()),
  misconceptions: z.array(z.string()),
  evidence: z.array(z.string()),
});
export type FollowupEvidence = z.infer<typeof FollowupEvidenceSchema>;

export const InterviewEvidenceSchema = z.object({
  domain: z.enum(["sql", "python"]),
  approach: ApproachEvidenceSchema,
  implementation: z.object({
    deterministicStatus: z.enum(["pass", "partial", "fail"]),
    detectedMistakes: z.array(z.string()),
    runCount: z.number(),
  }),
  consistency: ConsistencyEvidenceSchema,
  followups: z.tuple([FollowupEvidenceSchema, FollowupEvidenceSchema]),
  correctiveTags: z.array(z.string()),
  semanticStatus: z.enum(["complete", "partial", "unavailable"]),
});
export type InterviewEvidence = z.infer<typeof InterviewEvidenceSchema>;

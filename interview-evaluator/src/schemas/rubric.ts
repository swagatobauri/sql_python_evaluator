import { z } from 'zod';

export const FollowUpRubricSchema = z.object({
  question: z.string(),
  expectedConcepts: z.array(z.string()),
  acceptablePoints: z.array(z.string()),
  criticalMisconceptions: z.array(z.string()),
});
export type FollowUpRubric = z.infer<typeof FollowUpRubricSchema>;

export const QuestionRubricSchema = z.object({
  questionId: z.string(),
  domain: z.enum(["sql", "python"]),
  expectedApproaches: z.array(z.string()),
  expectedComplexity: z.string().optional(),
  tradeoffRelevant: z.boolean(),
  commonMistakes: z.array(z.string()),
  practiceTags: z.array(z.string()),
  followUps: z.tuple([FollowUpRubricSchema, FollowUpRubricSchema]),
});
export type QuestionRubric = z.infer<typeof QuestionRubricSchema>;

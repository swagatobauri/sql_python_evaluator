import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  ApproachEvidenceSchema, 
  InterviewEvidenceSchema,
  PythonImplementationEvidenceSchema
} from '../src/schemas/evidence.js';
import { 
  QuestionRubricSchema 
} from '../src/schemas/rubric.js';

test('ApproachEvidenceSchema should pass valid objects', () => {
  const valid = {
    score: 8,
    criteria: { "Workable approach": "MET" },
    strengths: ["good logic"],
    improvements: [],
    misconceptions: []
  };
  const result = ApproachEvidenceSchema.safeParse(valid);
  assert.ok(result.success, result.error?.message ?? "Validation failed");
});

test('ApproachEvidenceSchema should fail on missing required fields', () => {
  const invalid = {
    score: 8,
    // missing criteria, strengths, etc.
  };
  const result = ApproachEvidenceSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('PythonImplementationEvidenceSchema should pass valid objects', () => {
  const valid = {
    source: "pyodide",
    executionLocation: "browser",
    finalCode: "print('hello')",
    deterministicStatus: "pass",
    testsPassed: 5,
    testsTotal: 5,
    failedTestIds: [],
    durationMs: 120,
    runCount: 2
  };
  const result = PythonImplementationEvidenceSchema.safeParse(valid);
  assert.ok(result.success, result.error?.message ?? "Validation failed");
});

test('InterviewEvidenceSchema should pass valid objects', () => {
  const valid = {
    domain: "sql",
    approach: {
      score: 10,
      criteria: { "Workable plan": "MET" },
      strengths: [],
      improvements: [],
      misconceptions: []
    },
    implementation: {
      deterministicStatus: "pass",
      detectedMistakes: [],
      runCount: 1
    },
    consistency: {
      status: "matched",
      contradictions: []
    },
    followups: [
      {
        status: "MET",
        covered: [],
        gaps: [],
        misconceptions: [],
        evidence: []
      },
      {
        status: "PARTIAL",
        covered: [],
        gaps: [],
        misconceptions: [],
        evidence: []
      }
    ],
    correctiveTags: ["joins"],
    semanticStatus: "complete"
  };
  const result = InterviewEvidenceSchema.safeParse(valid);
  assert.ok(result.success, result.error?.message ?? "Validation failed");
});

test('InterviewEvidenceSchema should fail with missing followups', () => {
  const invalid = {
    domain: "sql",
    approach: {
      score: 10,
      criteria: { "Workable plan": "MET" },
      strengths: [],
      improvements: [],
      misconceptions: []
    },
    implementation: {
      deterministicStatus: "pass",
      detectedMistakes: [],
      runCount: 1
    },
    consistency: {
      status: "matched",
      contradictions: []
    },
    // missing followups tuple
    correctiveTags: ["joins"],
    semanticStatus: "complete"
  };
  const result = InterviewEvidenceSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test('QuestionRubricSchema should pass valid objects', () => {
  const valid = {
    questionId: "py_hash_001",
    domain: "python",
    expectedApproaches: ["one-pass hash map"],
    expectedComplexity: "O(n) time, O(n) space",
    tradeoffRelevant: true,
    commonMistakes: ["O(n^2) loops"],
    practiceTags: ["hash-map"],
    followUps: [
      {
        question: "What if it doesn't fit in memory?",
        expectedConcepts: ["batching"],
        acceptablePoints: [],
        criticalMisconceptions: []
      },
      {
        question: "Can we sort it?",
        expectedConcepts: ["sort then two pointers"],
        acceptablePoints: [],
        criticalMisconceptions: []
      }
    ]
  };
  const result = QuestionRubricSchema.safeParse(valid);
  assert.ok(result.success, result.error?.message ?? "Validation failed");
});

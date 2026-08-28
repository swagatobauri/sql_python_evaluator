# Design Document — Interview Evaluator

> **This is the single source of truth for every architectural decision in this service.**
> Before building any new module, read this document first.
> If a decision conflicts with this doc, update the doc and get a review — don't silently diverge.

---

## 1. What We Are Actually Building

CareerCafe's `interview-evaluator` is a **semantic reasoning grader** for SQL and Python mock interviews. It is not a code executor, not a chatbot, and not a general-purpose AI tutor.

Its job: take structured evidence from deterministic code runners, evaluate whether the *student's reasoning* was sound at each step of the interview, and return a structured verdict the frontend can display.

Most AI interview tools today are black boxes — they send a transcript to an LLM and get back a free-text paragraph. That approach fails in three specific ways: it hallucinates numeric scores, it cannot distinguish between a student who got lucky with code and one who actually understood the problem, and it gives vague feedback that students cannot act on.

We solve all three.

---

## 2. Core Design Principles — Why We Built It This Way

These are the architectural decisions that govern every module in this service.
They do not change when a feature ships. For what is currently built vs. pending, see [`CHANGELOG.md`](./CHANGELOG.md).

---

### Principle 1: Deterministic systems own correctness. We own reasoning only.

Two systems external to this service decide whether code is correct: the `sql-rule-engine-node` and the Pyodide test runner. This service never contradicts, overrides, or re-evaluates code correctness. The fields `deterministicStatus`, `testsPassed`, `testsTotal`, and `failedTestIds` arrive already set and this service has no code path that modifies them.

Every other AI interview tool we analyzed evaluates code correctness and reasoning in the same LLM call — meaning a hallucinating model can pass a student who wrote broken code. We structurally cannot do that.

---

### Principle 2: Exactly 2 LLM calls per session. No exceptions.

- **Call 1** evaluates the student's approach explanation in the background immediately after submission. The student is not blocked.
- **Call 2** evaluates consistency (approach vs. implementation) AND both follow-up answers in a single bundled prompt, after the student answers both follow-ups.

No LLM calls happen while the student runs code. No LLM call happens at debrief time. If a feature request requires a third call, it is rejected by default — raise it explicitly with a written cost/latency argument.

Bundling Call 2 is a deliberate decision: three separate calls for consistency and two follow-ups at ~2s each would add 6 seconds of perceived wait at the moment students are most eager for feedback. One call costs 66% less and completes in approximately the same time.

---

### Principle 3: The LLM classifies. The backend scores.

The LLM returns only one of four statuses per criterion: `MET`, `PARTIAL`, `MISSING`, `INCORRECT`. The 0–10 numeric score is computed by deterministic backend math using a fixed weighted formula. The LLM never sees, outputs, or reasons about a numeric score.

LLMs are unreliable at calibrated numeric scoring — two calls with identical inputs frequently produce different numbers. By constraining the LLM to classification and computing the score ourselves, the final grade is always deterministic given the same evidence.

---

### Principle 4: Chain-of-thought before status.

Every LLM output schema includes a `reasoning` field populated *before* any status fields. The model writes its justification first, then commits to a classification. This pattern (from the LLM-as-a-judge research literature) significantly reduces hallucination by grounding the verdict in explicit evidence before locking it in.

The `reasoning` content is not discarded — it surfaces as the qualitative explanation in the student's debrief, replacing AI-generated prose.

---

### Principle 5: Model tier routing — cheap for classification, frontier for synthesis.

Call 1 is a narrow, well-defined classification task (does this text describe the expected approaches?). It routes to a smaller, cheaper, faster model tier (e.g. GPT-4o-mini, Claude Haiku).

Call 2 requires simultaneous cross-referencing of four inputs: the original approach text, the final code, and two follow-up answers. It routes to a frontier model (GPT-4o, Claude Sonnet). Routing is implemented in `src/llm/` and is swappable via the `LLM_PROVIDER` env var — not hardcoded.

---

### Principle 6: System prompt prefix caching from day one.

The rubric injected into each LLM system prompt is static per `questionId`. Modern provider APIs cache identical token prefixes — they are not re-billed or re-processed. Our prompt construction always places the rubric as a stable, deterministic prefix. The student's evidence is appended as user-turn content only.

For any question receiving more than ~5 student attempts, the system prompt tokens are effectively free after the first call.

---

### Principle 7: Fail silently on LLM error. Never crash.

If any LLM call fails, times out, or returns malformed output: mark `semanticStatus: "unavailable"`, exclude those dimensions from the scoring formula, and return a partial-but-honest debrief. There is no unhandled exception path that surfaces to the student. Every failure mode is an expected runtime condition, not an exception.

---

### Principle 8: Debrief is a template engine. Never an LLM.

No additional AI call happens at debrief time. The debrief builder in `src/debrief/` assembles the student-facing report entirely from the structured evidence already collected. Each debrief section maps one-to-one to an evidence field. The same evidence always produces the same report — deterministic, auditable, and shareable.

---

## 3. The Two LLM Calls — Exact Design

### Call 1 — Approach Evaluation

**Fires:** Immediately after student submits their approach text (Step 2), in the background while they code.

**Input to LLM:**
- System prompt: The rubric for this `questionId` — `expectedApproaches`, `commonMistakes`, `tradeoffRelevant`
- User content: The student's raw approach text

**Output from LLM (Zod-validated):**
```
{
  reasoning: string,          // Chain-of-thought justification — model writes this FIRST
  criteria: {
    [criterionName]: {
      status: "MET" | "PARTIAL" | "MISSING" | "INCORRECT",
      evidence: string        // Exact quote or paraphrase from the student's text
    }
  },
  misconceptions: string[]    // Any factually wrong statements detected
}
```

**Cost profile:** Short prompt (rubric + approach text), short output. Routes to a cheaper model tier (e.g. GPT-4o-mini or Claude Haiku) because the classification task is well-defined and narrow.

---

### Call 2 — Consistency + Follow-up Evaluation

**Fires:** After the student answers both follow-up questions (Step 5).

**Input to LLM:**
- System prompt: The full rubric — `expectedApproaches`, follow-up `expectedConcepts`, `criticalMisconceptions`
- User content (bundled in one prompt):
  1. The student's approach text (from Step 2)
  2. The student's final code (from Step 4)
  3. The deterministic test result summary (e.g. "3/5 tests passed, failed: test_edge_nulls")
  4. Follow-up answer 1
  5. Follow-up answer 2

**Output from LLM (Zod-validated):**
```
{
  reasoning: string,                   // CoT justification written before any verdict
  consistency: {
    status: "matched" | "partially_matched" | "contradicted" | "insufficient_evidence",
    contradictions: [{ candidateClaim, observedImplementationEvidence }]
  },
  followup1: {
    status: "MET" | "PARTIAL" | "MISSING" | "INCORRECT",
    covered: string[],
    gaps: string[],
    misconceptions: string[],
    evidence: string[]
  },
  followup2: { ... same shape ... }
}
```

**Cost profile:** Longer prompt (full context bundled), but still a single call. Routes to a frontier model (GPT-4o, Claude Sonnet) because it requires multi-context reasoning across approach + implementation + follow-ups simultaneously.

---

## 4. Scoring Formula — Deterministic, Never LLM

The numeric score is computed in `src/evaluators/scoring.ts`, not produced by the LLM. The LLM exclusively outputs statuses.

### Status → Points Mapping

| Status | Points |
|---|---|
| `MET` | 1.0 |
| `PARTIAL` | 0.5 |
| `MISSING` | 0.0 |
| `INCORRECT` | -0.25 (penalty for confident wrong answer) |

### Weighted Dimension Scores

| Dimension | Weight | Source |
|---|---|---|
| Approach quality | 35% | Call 1 criteria statuses |
| Code correctness (deterministic) | 30% | `deterministicStatus` from code runner |
| Consistency (approach vs. implementation) | 15% | Call 2 consistency status |
| Follow-up 1 | 10% | Call 2 followup1 status |
| Follow-up 2 | 10% | Call 2 followup2 status |

### Score Cap Rules

| Condition | Cap Applied |
|---|---|
| Approach status has any `INCORRECT` criterion | Score ≤ 4.0 (hard ceiling) |
| `deterministicStatus: "fail"` | Score ≤ 5.0 |
| `semanticStatus: "unavailable"` | Approach and consistency dimensions excluded from formula |

Final score is always a number in `[0, 10]`, computed in the backend. The LLM never sees or produces this number.

---

## 5. Optimizations That Make Us Different

### Optimization 1: Bundled Call 2 (3-in-1)
Most systems would make three separate calls: one for consistency, one for follow-up 1, one for follow-up 2. We bundle all three into a single prompt. This halves latency and reduces cost by ~66% on the second evaluation step.

**The trade-off we accepted:** A single long prompt has slightly higher per-token cost than three short ones. We validated that the context bundling does not degrade output quality because the rubric criteria are independent dimensions in the structured output — the model evaluates each in isolation.

### Optimization 2: Model Tier Routing
Call 1 (Approach) is simple binary classification against a rubric. It routes to a cheaper, faster model (Haiku/mini tier). Call 2 (Consistency) requires cross-referencing three different pieces of evidence simultaneously — it uses a frontier model. The `LLM_PROVIDER` adapter in `src/llm/` implements this routing logic.

### Optimization 3: System Prompt Prefix Caching
The rubric injected into the system prompt for each call is largely static per `questionId`. Modern LLM APIs (OpenAI, Anthropic) support prompt caching — identical prefix tokens are not re-processed, reducing token cost by 50–90% on the system prompt portion.

**Implementation:** The rubric system prompt is constructed as a stable, cacheable prefix. The student's evidence is appended as user-turn content. This pattern maximizes cache hit rate.

### Optimization 4: In-Memory Rubric Store
All rubrics are loaded, validated, and stored in a `Map<string, QuestionRubric>` at process boot. Zero disk I/O per request. Retrieval is `O(1)`.

### Optimization 5: Zero LLM Calls During Code Runs
The student may run their code against tests dozens of times. We make zero LLM calls during this phase. The LLM is only involved after the student deliberately submits their approach (Step 2) and their final answers (Step 5). This is the single biggest source of cost saving compared to systems that evaluate every code run.

### Optimization 6: Chain-of-Thought Before Status
The `reasoning` field in our LLM output schema forces the model to write its justification *before* it assigns a status. This is a well-established technique (from the LLM-as-a-judge literature) that significantly reduces status hallucination. The reasoning field is stored and surfaced in the debrief — it becomes the qualitative explanation the student reads, not AI-generated prose.

---

## 6. LLM Failure Matrix

Every failure scenario has a defined outcome. No failure crashes the interview.

| Scenario | Detected By | Outcome |
|---|---|---|
| Call 1 times out | Timeout wrapper in `src/llm/` | `approach.semanticStatus = "unavailable"`. Score formula excludes approach dimension. Interview continues unblocked. |
| Call 1 returns malformed JSON | Zod `.safeParse()` | Same as timeout. Error logged, not thrown. |
| Call 1 returns valid JSON but with impossible status value | Zod enum validation | Rejected. Treated as malformed. |
| Call 2 times out | Timeout wrapper | `consistency` and `followups` marked `"unavailable"`. Score computed from deterministic + approach dimensions only. |
| Call 2 contradicts deterministic result | Trust Boundary guard | Deterministic result is ground truth. LLM's `consistency.status` is stored as-is (it's about reasoning, not code correctness) but the `deterministicStatus` field is never overwritten. |
| LLM returns a numeric score | Zod schema rejection | Schema does not include a numeric field. Any LLM attempt to output a score is structurally impossible to propagate. |

---

## 7. What the Debrief Contains (Template-Only)

The debrief is assembled by `src/debrief/` from the structured evidence. No additional LLM call. The following sections are generated:

| Section | Source |
|---|---|
| Overall score (0–10) | Scoring formula output |
| Approach quality summary | `approach.criteria` statuses + `approach.reasoning` text |
| Code result | `implementation.deterministicStatus` (pass/partial/fail) + `detectedMistakes[]` |
| Did your explanation match your code? | `consistency.status` + `contradictions[]` |
| Follow-up 1 feedback | `followup1.status` + `gaps[]` + `evidence[]` |
| Follow-up 2 feedback | `followup2.status` + `gaps[]` + `misconceptions[]` |
| Corrective tags | Tags like `"wrong-join-type"`, `"missed-null-handling"` (matched by `src/corrective-tags/`) |
| Practice suggestions | Derived from `practiceTags` in the rubric |

---

## 8. Data Flow — Request Lifecycle

```
Student Submits Approach Text
         │
         ▼
POST /evaluate/approach
   Body: { questionId, approachText, domain }
         │
         ├── getRubric(questionId) → QuestionRubric (from memory)
         ├── Build system prompt from rubric
         ├── Send to LLM (Call 1 — cheap model tier)
         ├── .safeParse() Zod validation on response
         │     ├─ FAIL → return { semanticStatus: "unavailable" }
         │     └─ PASS → return ApproachEvidence
         └── Return 200 with ApproachEvidence JSON
                          │
                          │ (frontend stores this, student now coding)
                          │
Student Answers Both Follow-ups
         │
         ▼
POST /evaluate/defence
   Body: { questionId, approachText, finalCode, implementationEvidence, followup1Answer, followup2Answer }
         │
         ├── getRubric(questionId) → QuestionRubric
         ├── Validate implementationEvidence (Zod) → reject if deterministicStatus fields are wrong type
         ├── Build bundled system + user prompt
         ├── Send to LLM (Call 2 — frontier model tier)
         ├── .safeParse() Zod validation
         │     ├─ FAIL → return partial evidence with "unavailable" semantic status
         │     └─ PASS → ConsistencyEvidence + FollowupEvidence × 2
         ├── computeScore(allEvidence) → numeric 0–10
         ├── matchCorrectiveTags(allEvidence, rubric) → string[]
         ├── buildDebrief(allEvidence, score, tags) → Debrief
         └── Return 200 with InterviewEvidence + score + debrief
```

---

## 9. External Dependencies — Risk Register

These are the integration risks that exist regardless of how much of this service is built. They do not resolve when we ship a module — they resolve when the external dependency delivers a stable, tested interface.

For current resolution status of each risk, see the linked GitHub Issues in the [Feature Roadmap](https://github.com/swagatobauri/sql_python_evaluator/issues).

| Dependency | Risk Level | What Can Go Wrong |
|---|---|---|
| Python Playground (Pyodide + Web Worker) | 🔴 **HIGH** | This service accepts `PythonImplementationEvidence` payloads. Until the playground ships and is integration-tested, the Python evaluation path runs against mocked fixtures only. Any breaking change in the playground's evidence shape is a silent contract violation. |
| SQL rule engine payload format | 🟡 **MEDIUM** | `SqlImplementationEvidence` shape is derived from architecture docs. If the rule engine team changes field names or adds required fields, our Zod schema will reject valid payloads. Requires a formal contract handshake before v1.0. |
| LLM provider structured output support | 🟡 **MEDIUM** | Both OpenAI and Anthropic support constrained JSON generation, but our specific nested Zod schema must be validated end-to-end against real API calls. Schema complexity can occasionally cause provider-side failures. |
| Rubric reconciliation | 🟡 **MEDIUM** | All SQL rubrics are currently placeholder-plausible and flagged with `"_comment": "TODO: Reconcile"`. If the real CareerCafe question bank uses different question framing, rubric criteria may not map correctly. |
| Benchmark / calibration suite | 🟡 **MEDIUM** | Without a ground-truth dataset of labeled student answers, there is no systematic way to verify that the evaluator grades consistently. Inconsistent grading at scale is the most likely quality failure mode. |

---

*Last updated: August 2026 — Swagato Bauri*

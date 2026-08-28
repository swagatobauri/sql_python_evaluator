# Repository Rules for AI Agents

> This file governs how AI agents must behave when working inside this repository.
> Every rule here has a reason. If a rule feels wrong for a task, raise it with the human developer — do not silently skip it.

---

## 1. Architecture Boundaries — What This Service Is and Is Not

This is a **single Node.js backend service**. It is not a monorepo. It has no frontend. It does not own a database schema yet (Drizzle is configured, schema is pending).

**What lives here:**
- The Express API (`src/index.ts`)
- Zod schemas for all data contracts (`src/schemas/`)
- Rubric store — in-memory, loaded at boot (`src/rubric-store/`)
- Rubric JSON files (`src/rubrics/sql/`, `src/rubrics/python/`)
- Evaluator logic, debrief builder, LLM adapter (all pending)

**What does NOT live here and must not be added:**
- Frontend code of any kind
- SQL rule engine — it is a separate existing service
- Python Pyodide playground — it is a separate frontend component, not yet built
- Any direct calls to external systems other than the LLM provider

**Hosting target:** A single Render or Railway Node.js instance. Do NOT introduce Kubernetes, Helm, Nginx, or any orchestration tooling. Docker Compose is for **local dev only**.

---

## 2. The Trust Boundary — The Single Most Important Rule

> **Deterministic systems own correctness. This service owns reasoning only.**

The fields `deterministicStatus`, `testsPassed`, `testsTotal`, and `failedTestIds` inside any evidence payload are **read-only** from the perspective of every module in this service. They are written by the SQL rule engine or the Pyodide test runner before the payload reaches us. No evaluator, no route handler, no debrief builder may overwrite or reinterpret them — even if the LLM output contradicts them.

If you find yourself writing code that modifies one of these fields, **stop**. That is a bug, not a feature.

**Concrete enforcement:** The `InterviewEvidenceSchema` in `src/schemas/evidence.ts` is the gate. Any incoming payload that doesn't match it is rejected before any logic runs.

---

## 3. LLM Usage Constraints — Hard Rules

| Rule | Detail |
|---|---|
| Maximum 2 LLM calls per interview question | Call 1: Approach evaluation (Step 2). Call 2: Consistency + both follow-ups bundled (Step 5). No exceptions. |
| LLM never outputs a numeric score | The 0–10 score is computed by backend math. The LLM only classifies: `MET`, `PARTIAL`, `MISSING`, `INCORRECT`. |
| LLM never writes debrief prose | The debrief builder is a template engine. The LLM is not involved in debrief generation. |
| Structured output only | All LLM responses must be parsed against a Zod schema. Free-form text responses that are not inside a schema-validated field must never be passed directly to the student. |
| Fail gracefully on LLM error | If a call fails, times out, or returns malformed JSON: mark `semanticStatus: "unavailable"`, continue the interview, score from deterministic signals only. Never crash the request. |

---

## 4. Schema & Validation Rules

- **All data contracts live in `src/schemas/`**. Do not define inline Zod schemas inside route handlers or evaluators — always import from the schemas directory.
- **Every Zod schema must have a matching exported TypeScript type** using `z.infer<typeof Schema>`. One-to-one. No exceptions.
- **Any change to a schema requires updating the tests in `test/schemas.test.ts`** before the commit is valid.
- **LLM response parsing must use `.safeParse()`**, never `.parse()`. A bad LLM response is an expected runtime condition, not an exception.

---

## 5. Rubric Rules

- **All rubrics live in `src/rubrics/sql/` or `src/rubrics/python/`** as JSON files.
- **Every rubric is validated at boot** by the rubric store. If a rubric fails schema validation, the server crashes immediately with a clear error. This is intentional.
- **Never hardcode rubric content inside TypeScript source files.** Rubrics are data, not code.
- **Every new rubric JSON must include a `"_comment"` field** flagging it as a placeholder until reconciled with the real CareerCafe question bank.
- **Rubric follow-ups must always be a tuple of exactly 2** — the schema enforces this, the evaluator depends on it.

---

## 6. Environment & Configuration

- **All env var access goes through `src/config/env.ts`**. Do not call `process.env.ANYTHING` directly anywhere else in the codebase.
- **Required variables:** `DATABASE_URL`, `LLM_API_KEY`, `LLM_PROVIDER`. If any are missing, the server must refuse to boot with a clear Zod validation error.
- **Keep `.env` in `.gitignore`**. The only env file that gets committed is `.env.sample` with placeholder values.
- **The LLM provider is swappable** via the `LLM_PROVIDER` env var. When implementing the LLM adapter in `src/llm/`, it must be designed as a provider interface — not hardcoded to OpenAI or Anthropic.

---

## 7. Git Workflow & Agent Permissions

| Action | Permitted for AI Agents? |
|---|---|
| Create local branch | ✅ Yes |
| Write and modify code | ✅ Yes |
| Run tests | ✅ Yes |
| Build TypeScript | ✅ Yes |
| Create local commits | ✅ Yes — must use Conventional Commit format |
| `git push` to remote | ⛔ **Only when the human explicitly says "push"** |
| Open a Pull Request | ⛔ **Only when the human explicitly says "open a PR"** |
| Merge a PR | ⛔ **Never. Human only.** |
| Delete branches | ⛔ **Only on explicit human instruction** |

**Branch naming:** `<github-username>/main/<feature-in-kebab-case>`
Example: `swagatobauri/main/approach-evaluator`

**Commit format:** `<type>(<scope>): <what you did>`
Example: `feat(evaluator): implement approach evaluator with Zod response parser`

---

## 8. Verification Checklist

Before finishing any task, the following must pass:

```bash
# All unit tests green
./node_modules/.bin/tsx --test test/**/*.test.ts

# TypeScript compiles without errors
./node_modules/.bin/tsc --noEmit

# Server boots successfully
./node_modules/.bin/tsx src/index.ts &
sleep 2 && curl -s http://localhost:3000/health
```

If any of the above fail, the task is not complete. Fix before reporting done.

---

## 9. What to Never Do

- ❌ Do not add Redis, BullMQ, a message queue, or a cache layer unless the human explicitly requests it and there is a measured reason.
- ❌ Do not add a third LLM call anywhere. If a use case feels like it needs one, raise it with the human first.
- ❌ Do not write a numeric score inside an evaluator. Scores are computed in a dedicated scoring module.
- ❌ Do not let a failing LLM call crash a request. Always handle gracefully.
- ❌ Do not write rubric content as TypeScript objects — they are JSON files.
- ❌ Do not access `process.env` directly. Always use `src/config/env.ts`.
- ❌ Do not push to remote or open a PR without being explicitly told to.

---

*Last updated: August 2026 — Swagato Bauri*

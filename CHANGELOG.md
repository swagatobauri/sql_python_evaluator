# Changelog — interview-evaluator

All notable changes to this service are documented here.
One entry per PR, appended at the top of `## [Unreleased]` as work progresses.
When a version is released, the unreleased block is stamped with a version and date.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Pending
- Approach evaluator (`src/evaluators/approach.ts`) — AI Call 1 handler with model tier routing
- Consistency + follow-up evaluator (`src/evaluators/defence.ts`) — bundled AI Call 2 handler
- LLM adapter (`src/llm/`) — swappable provider interface with model tier selection and prefix caching
- Scoring module (`src/evaluators/scoring.ts`) — deterministic 0–10 formula with cap rules
- Corrective tag matcher (`src/corrective-tags/`) — rule-based, no AI
- Debrief builder (`src/debrief/`) — template engine, no AI
- API routes (`src/routes/approach.ts`, `src/routes/defence.ts`)
- Python rubrics (5 question types) — schema locked, authoring next
- Benchmark suite (`benchmark/`) — 15 labeled smoke cases for calibration

---

## [0.2.0] — 2026-08-27

### Added
- **SQL Rubrics (8 questions)** — `src/rubrics/sql/` — covers joins, GROUP BY/HAVING, window functions (DENSE_RANK), subqueries (EXISTS vs IN), multi-table joins, NULL handling, date aggregation, and ratio/ranking patterns. Each file includes `"_comment"` flagging for reconciliation with the real question bank.
- **Rubric store** (`src/rubric-store/index.ts`) — boot-time loader that reads, validates, and caches all rubric JSON files in memory. Exposes `getRubric(questionId)` and `listRubrics(domain?)`. Fails fast at boot if any rubric is invalid.
- **Rubric store unit tests** (`test/rubric-store.test.ts`) — confirms 8 SQL rubrics load at boot and are retrievable by ID.

---

## [0.1.0] — 2026-08-27

### Added
- **Express scaffold** (`src/index.ts`) — server boots on configured port, exposes `GET /health → { status: "ok" }`.
- **Environment validation** (`src/config/env.ts`) — Zod-validated env vars: `DATABASE_URL`, `LLM_API_KEY`, `LLM_PROVIDER`, `PORT`, `NODE_ENV`. Server refuses to boot if any required var is missing.
- **Evidence schemas** (`src/schemas/evidence.ts`) — `CriterionStatus`, `ApproachEvidence`, `PythonImplementationEvidence`, `ConsistencyEvidence`, `FollowupEvidence`, `InterviewEvidence`. All exported as Zod schemas + inferred TypeScript types.
- **Rubric schemas** (`src/schemas/rubric.ts`) — `FollowUpRubric`, `QuestionRubric`. Exported as Zod schemas + inferred TypeScript types.
- **Schema unit tests** (`test/schemas.test.ts`) — 8 tests covering valid object pass and missing-field fail cases for all schemas.
- **Dockerfile** — multi-stage production build.
- **docker-compose.yml** — local dev environment with app + PostgreSQL.
- **drizzle.config.ts** — ORM configuration.
- **Directory scaffold** — `src/routes/`, `src/evaluators/`, `src/llm/`, `src/debrief/`, `src/corrective-tags/`, `src/queue/`, `src/db/`, `src/lib/`, `benchmark/`, `test/`.
- **Root documentation** — `README.md`, `DESIGN.md`, `WORKFLOW.md`, `BRANCHING.md`, `AGENTS.md`, `CHANGELOG.md`.

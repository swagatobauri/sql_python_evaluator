# Engineering Workflow — interview-evaluator

> This document defines the complete development lifecycle for all contributors.
> Every step exists for a reason. Read it once, follow it always.

---

## 1. The Workflow Pipeline

```
┌──────────────────────────────────────────────────┐
│  1. BRANCH CREATION                              │
│     git switch -c <username>/main/<feature>      │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│  2. DEVELOPMENT                                  │
│     Write code. Update docs in the same commit.  │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│  3. TEST BEFORE YOU COMMIT                       │
│     pnpm test  →  all tests must pass            │
│     pnpm build →  TypeScript must compile clean  │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│  4. LOCAL COMMIT                                 │
│     Conventional Commit format (see below)       │
└─────────────────────────┬────────────────────────┘
                          │
          ════════════════════════════════
              [HUMAN REVIEW BOUNDARY]
          ════════════════════════════════
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│  5. REVIEW YOUR OWN DIFF                         │
│     git diff main...HEAD                         │
│     git log -n 5 --stat                          │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│  6. PUSH (on explicit request only)              │
│     git push origin <branch>                     │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────┐
│  7. PULL REQUEST → main                          │
│     All PRs target main. No exceptions.          │
└──────────────────────────────────────────────────┘
```

---

## 2. Branch Naming

```
<github-username>/main/<short-feature-name>

Examples:
  swagatobauri/main/rubric-store
  swagatobauri/main/approach-evaluator
  swagatobauri/main/debrief-builder
```

Always branch off an up-to-date `main`:
```bash
git checkout main && git pull origin main
git switch -c swagatobauri/main/<feature>
```

---

## 3. Commit Message Format

We follow Conventional Commits. Keep messages short and honest.

```
<type>(<scope>): <what you did>

Types:
  feat      → new capability added
  fix       → bug fixed
  docs      → documentation only
  refactor  → code restructured, no behavior change
  test      → tests added or updated
  chore     → config, build, tooling

Examples:
  feat(rubric-store): add boot-time validation for all SQL rubrics
  fix(schemas): make runtimeError field optional in PythonImplementationEvidence
  docs(readme): add LLM failure handling table
  test(schemas): add missing-followups failure case
```

---

## 4. What to Run Before Every Commit

```bash
# Run all unit tests — must be 100% green
./node_modules/.bin/tsx --test test/**/*.test.ts

# Ensure TypeScript compiles without errors
pnpm build
```

If either of these fails, do not commit. Fix first.

---

## 5. Human Review Safety Boundary

| Action | Who | Notes |
|---|---|---|
| Create branch | Contributor / AI agent | Local only |
| Write code | Contributor / AI agent | Follow schemas and rubric contracts |
| Run tests & build | Contributor / AI agent | Must pass before commit |
| Local commit | Contributor / AI agent | Must use conventional commit format |
| **Review diff** | **Human Developer** | `git diff main...HEAD` before pushing |
| **Remote push** | **Human (or AI on explicit request)** | Only when human says "push" |
| **Open PR** | **Human (or AI on explicit request)** | Always target `main` |
| **Merge PR** | **Human Developer only** | Never auto-merge |

> AI agents commit locally and do not push or open PRs unless the developer explicitly instructs them to.

---

## 6. Pull Request Rules

- **All PRs target `main`** — no other base branch.
- PR title must follow the same Conventional Commit format as the commit.
- Include in the PR description:
  - What changed and why.
  - Which tests cover the change.
  - Any open questions or follow-ups.

---

## 7. The Trust Boundary — Always Respect It in Code

This is not just a doc rule — it is a code contract. When contributing evaluator logic, follow this without exception:

> The `deterministicStatus`, `testsPassed`, `testsTotal`, and `failedTestIds` fields in any evidence payload are **read-only** from the perspective of this service. They are set by the SQL rule engine or the Pyodide test runner before we receive the payload. Our evaluators must never reassign or override these values, even if the LLM output disagrees.

If you find yourself writing code that modifies a deterministic field, stop. That is a bug, not a feature.

---

## 8. Adding a New Rubric

1. Create a new JSON file in `src/rubrics/sql/` or `src/rubrics/python/`.
2. Follow the exact shape in `src/schemas/rubric.ts` — the rubric store validates on boot and will crash if the schema is wrong.
3. Include the `"_comment"` field flagging it as a placeholder until reconciled with the real question bank.
4. Run `./node_modules/.bin/tsx --test test/**/*.test.ts` to confirm boot-time validation passes.

---

## 9. Adding a New Evaluator

1. Create the file in `src/evaluators/`.
2. The evaluator must accept a `QuestionRubric` and an evidence input — it must never fetch rubrics from disk itself (use `getRubric()` from the rubric store).
3. The evaluator must never assign a numeric score — it must return only classified statuses (`CriterionStatus`). Score computation lives in a separate scoring module.
4. Write at least one happy-path and one failure-path test in `test/`.

---

*Last updated: August 2026 — Swagato Bauri*

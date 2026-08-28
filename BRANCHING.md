# Git Branching Strategy — interview-evaluator

> Defines the branch lifecycle, naming conventions, and permission boundaries
> for all contributors and AI agents working on this repository.

---

## 1. Core Principles

- **Branch-first always.** Every change — feature, fix, docs, rubric — lives on its own branch. Nothing goes directly to `main`.
- **`main` is the sole production branch.** All PRs target `main`. No other integration branches exist.
- **No Git worktrees.** Use `git switch -c` on the primary clone. Worktrees are prohibited unless explicitly requested by the developer.
- **Agents commit locally, humans push.** AI agents create branches and commit. They do not push or open PRs unless the developer explicitly says so.

---

## 2. Branch Structure

```
main  (stable, always deployable)
│
├── swagatobauri/main/approach-evaluator        ← AI Call 1 evaluator
├── swagatobauri/main/consistency-evaluator     ← AI Call 2 + follow-ups
├── swagatobauri/main/debrief-builder           ← Template-driven debrief
├── swagatobauri/main/python-rubrics            ← 5 Python rubric files
├── swagatobauri/main/llm-adapter               ← Swappable LLM provider
└── swagatobauri/main/scoring-module            ← 0-10 numeric score logic
```

---

## 3. Branch Naming Convention

```
<github-username>/main/<feature-in-kebab-case>
```

| Part | Rule | Example |
|---|---|---|
| `github-username` | Your exact GitHub username | `swagatobauri` |
| `main` | Always the parent branch | `main` |
| `feature` | 2–4 words, lowercase, hyphen-separated | `approach-evaluator` |

**Good:**
```
swagatobauri/main/rubric-store
swagatobauri/main/fix-env-validation
swagatobauri/main/add-python-rubrics
```

**Bad:**
```
feature/evaluator          ← missing username and parent
swagatobauri/ApproachEval  ← not kebab-case
fix-2026-08-28             ← don't use dates
```

---

## 4. Step-by-Step Workflow

### For Human Contributors

```bash
# 1. Sync main before branching
git checkout main
git pull origin main

# 2. Create your feature branch
git switch -c swagatobauri/main/<feature>

# 3. Develop, then validate
./node_modules/.bin/tsx --test test/**/*.test.ts
./node_modules/.bin/tsc --noEmit

# 4. Commit with Conventional Commit format
git add <files>
git commit -m "<type>(<scope>): <description>"

# 5. Push and open PR when ready
git push -u origin swagatobauri/main/<feature>
gh pr create --base main --title "<type>(<scope>): <description>"
```

### For AI Agents

```bash
# 1. Verify you are on the right base
git status
git switch main
git pull origin main

# 2. Create feature branch
git switch -c swagatobauri/main/<feature>

# 3. Make changes, run tests, commit locally
./node_modules/.bin/tsx --test test/**/*.test.ts
git add <modified-files>
git commit -m "<type>(<scope>): <description>"

# 4. STOP HERE — notify developer
# Push and PR only when the developer explicitly says so
```

---

## 5. Handling Merge Conflicts

If `main` moves ahead while your branch is in progress:

```bash
# Bring your branch up to date with main
git fetch origin
git rebase origin/main

# Re-run tests after rebase
./node_modules/.bin/tsx --test test/**/*.test.ts

# Push with lease (safer than --force)
git push --force-with-lease origin swagatobauri/main/<feature>
```

> Prefer rebase over merge for feature branches to keep the commit history linear and readable.

---

## 6. Pull Request Rules

- **All PRs must target `main`** — never another feature branch.
- PR title must follow Conventional Commit format: `feat(scope): description`.
- Before opening a PR, the following must pass locally:
  - All unit tests green
  - TypeScript compiles without errors
  - `/health` endpoint responds 200
- PRs that fail tests or introduce inline `process.env` calls, inline Zod schemas, or numeric scores inside evaluators will be rejected.

---

## 7. Agent Permission Summary

| Action | AI Agent Allowed? | Notes |
|---|---|---|
| Create local branch | ✅ Yes | Must follow naming convention |
| Switch local branch | ✅ Yes | `git switch` only, no worktrees |
| Create local commit | ✅ Yes | Conventional Commit format required |
| `git push` to remote | ⛔ On explicit request only | Developer must say "push" |
| Open a Pull Request | ⛔ On explicit request only | Must target `main` |
| `--force` push | ⛔ Never | Use `--force-with-lease` if needed |
| Create Git worktree | ⛔ Never | Unless explicitly requested by developer |
| Delete remote branch | ⛔ Never | Human developer only |

---

*Last updated: August 2026 — Swagato Bauri*

# [PROJECT NAME] — Claude Code Instructions

This file is the source of truth for how work gets done on this project.
Read it before every session. Rules are not suggestions.

---

## Non-negotiables (if you read nothing else)

1. Branch from main, squash-merge to main, never branch-to-branch.
2. No secrets in code, comments, or logs. Ever.
3. Triage before work: Trivial / Standard / Significant (Section 2).
4. Stop conditions are real — see Section 8.
5. Tests required per Section 6 matrix. No exceptions.
6. No AI attribution in commits, PRs, or metadata.

---

## 1. Project Context

- **What:** [one sentence]
- **Spec:** [path — read before any feature work]
- **Stack:** [language] / [framework] / [database] / [hosting]
- **Phase:** [optional milestone tracker — delete if not used]
- **Commands:** test=`X` lint=`Y` typecheck=`Z` build=`W`

---

## 2. Session Start

Before any work, run `git status` and `git branch` and report both.
If either shows something unexpected (uncommitted changes, wrong branch,
files you didn't create), stop and report — do not proceed.

### Definition of Ready
Before starting, you should be able to state in one sentence each:
- The acceptance criterion (what "done" looks like)
- The blast radius (what this could affect outside the obvious files)

If either is unclear, ask before starting.

### Triage
- **Trivial** (typo, comment, rename, formatting): proceed directly.
- **Standard** (one feature, ≲10 files, no schema or dep changes): produce
  the Standard plan (Section 4) and wait for approval.
- **Significant** (>10 files, multiple domains, schema/dep changes,
  new architectural patterns): discuss the approach in chat *before*
  writing the Significant plan or creating a branch. The discussion
  should produce an ADR in `docs/decisions/` if the choice is
  non-obvious or hard to reverse.

When in doubt, treat the task as one tier larger than it looks.

---

## 3. Architecture Invariants

Violating any of these requires explicit written approval *before* the
code is written.

### 3.1 Data access
- [where DB queries live and where they don't]
- [ORM/client conventions]

### 3.2 External calls
- [where they live, auth requirements, error contract]

### 3.3 State
- [client vs server boundary, state library policy]

### 3.4 Configuration
- All env vars read from [config path]. `process.env` / `os.environ`
  appears nowhere else.
- New env vars require a corresponding `.env.example` entry in the same PR.
- No secrets, tokens, or keys in code, comments, or logs. Ever.

### 3.5 Data integrity
- [delete policy, validation layer, migration policy]

### 3.6 Schema and migrations
- Any change to persistent schema requires a migration in the same PR.
- Schema changes without migrations are rejected.

### 3.7 Dependencies and lockfile
- New dependencies require approval. Provide: name, version, justification,
  why existing deps don't solve the problem, weekly downloads, last publish.
- **Version changes to existing deps require the same approval.** Major
  bumps require a changelog review.
- Unexplained lockfile drift from main is a stop-and-report condition.
- Wait for approval before running any install command.

### 3.8 Logging and errors
- Use the project logger, never `console.log` / `print` in committed code.
- Never catch an exception without logging it or re-raising.
- Never swallow an error to make a test pass.

---

## 4. Implementation Plan Format

The plan's weight scales with the task tier.

### Standard plan (lightweight)
```
Branch: {type}/{scope}-{description}

What: [1 sentence]
Files: [paths — create/modify]
Approach: [2–4 bullets]
Tests: [what behavior, where]
Manual steps: [or "none"]
```

### Significant plan (full)
```
Branch: {type}/{scope}-{description}

Understanding: [2–3 sentences: what and why]

Files to create:
- path — [purpose]

Files to modify:
- path — [change and why]

Approach:
1. [step]
2. [step]

Blast radius:
- [what this could break outside the files above —
   consumers, schemas, types, tests, runtime behavior]

Tests:
- [behavior] in [path]

Risks / open questions:
- [anything that might require a decision mid-implementation]

Manual steps required:
- [migrations, env vars, dashboard changes, etc. — or "none"]

ADR:
- [link to docs/decisions/NNNN-*.md, or "not needed because …"]
```

If a risk surfaces mid-implementation that wasn't in the plan, stop
and report. Do not make unilateral architectural decisions.

---

## 5. Git Protocol

**Invariant:** every branch is born from the tip of main and dies by
squash-merge into main. Branches never touch other branches. A merge
conflict means this rule was broken — stop and report, do not attempt
to resolve.

### Starting a branch
```
git checkout main && git pull origin main
git checkout -b {type}/{scope}-{description}
```

### Branch and commit format
- Branch: `{type}/{scope}-{description}` — kebab-case, descriptive.
- Commit messages within a branch are working notes; aim to be descriptive.
- PR title is the squash commit on main and **must** follow Conventional
  Commits: `{type}({scope}): {imperative description, ≤72 chars}`
- Types: `feat` `fix` `chore` `test` `docs` `refactor` `perf`

### Before every commit
Verify `git status` shows only intentional changes. No `.env`, no
build artifacts, no `node_modules`. Stage explicitly when in doubt.

### Pre-PR checklist
Run in order. Do not open the PR until all pass.
1. On the feature branch, not main
2. Working tree clean
3. Tests pass: `[test command]`
4. Types pass: `[typecheck command]`
5. Lint passes: `[lint command]` (warnings ok if pre-existing)
6. Build succeeds: `[build command]`
7. Push: `git push -u origin {branch}`

### Aborting a branch
If a branch is abandoned (not merging), close the PR and delete the branch:
```
git checkout main && git branch -D {branch}
```
No recovery protocol beyond this — unmerged work is simply discarded.

### Attribution
Commit messages, PR titles, and PR descriptions contain **no** AI
attribution, co-author tags, or agent signatures of any kind. The tools
used are not recorded in git history.

---

## 6. Testing

Tests are not optional. A PR without appropriate tests is not done.

| What you built | Required |
|---|---|
| Pure function / utility | Unit tests: happy path + edge cases |
| API endpoint / server action | Unit tests with mocked boundaries |
| Data transformation | Unit tests with realistic inputs |
| Bug fix | Regression test that would have caught the bug |
| Refactor | All pre-existing tests still pass |
| UI component (no logic) | None — note in PR |
| Wiring / config | None — verify manually, note in PR |

### Quality bar
Each test must:
- Test behavior, not implementation
- Have a sentence-shaped name: `"createNote returns error when unauthenticated"`
- Cover the unhappy path
- Use realistic inputs, not `"test"` / `1` / `true`

### Anti-patterns — stop if you find yourself doing any of these
- Mocking the thing under test
- Loosening an assertion to make a test pass
- Adding `skip` or `only` to commit
- Writing a test that passes against both the bug and the fix
- Deleting a failing test rather than fixing the underlying cause

### Mocking
Mock at the boundary (DB client, HTTP client), never deep inside.
Reset mocks between tests. Never make real network calls or write to
a real database in unit tests.

---

## 7. PR Protocol

One PR = one logical unit of work. Signs a PR is too large: touches
multiple domains, >~15 files changed, hard to write a single-sentence
title. If scope expands mid-implementation, stop and report — do not
expand unilaterally.

### PR description
```markdown
## What
[2–3 sentences. Purpose understood in 30 seconds.]

## Changes
- `path` — [what changed and why]

## How to test
1. [specific step]
2. Verify: [observable outcome]

## Manual steps
- [ ] [migrations, env vars, etc. — or "None"]

## Test results
- All tests: X passing, 0 failing
- New tests: [list]

## Screenshots
[Required for UI changes. Delete if backend-only.]

## Out of scope
[What was intentionally not built and why.]

## Checklist
- [ ] Tests / types / lint / build all green
- [ ] No secrets or env vars in code
- [ ] `.env.example` updated if new env vars
- [ ] No debug statements committed
- [ ] PR title follows Conventional Commits
- [ ] No AI attribution in commits or metadata
- [ ] Schema changes have migrations (if applicable)
```

### Issue linking
If the PR resolves an issue, reference it using GitHub's auto-closing
syntax: `Fixes #123`

### After opening the PR
Post the URL and wait.

---

## 8. GitHub Issues

Issues are a **capture mechanism for work that isn't the current task**,
not a prerequisite for starting one. Do not file an issue for every
feature — if it's the task you were handed, just build it.

### When to file an issue
File one when, mid-implementation, you notice something that is:
- Unrelated to the current task and would expand scope if fixed now
- A bug, broken invariant, or inconsistency you can't address in-scope
- Tech debt worth tracking (dead code, duplicated logic, missing tests,
  outdated dep, fragile pattern)

**Do not** silently fix these. **Do not** expand the current PR to cover
them. File the issue, link it from the PR's "Out of scope" section if
relevant, and move on.

### When *not* to file an issue
- The current task itself — just start the plan
- Trivial fixes you're already authorized to make (typos, formatting)
- Vague feelings ("this could be cleaner") without a concrete problem

---

## 9. Stop Conditions

Stop and surface — do not work around — when any of these occur:

- A test passes when you expected it to fail
- `git status` shows files you didn't touch
- A file is much larger or differently structured than expected
- A dependency is in the project that you didn't know about
- The spec contradicts the code, or promises something that doesn't exist
- An approach can't meet a stated performance target
- You've tried two attempts at a blocker without progress
- You're about to silently do something adjacent to what was asked
  because the literal request seems impossible
- A merge conflict appears (see Section 5 invariant)

When stopping, report: what you were trying, what happened, what the
options look like, what you'd recommend.

---

## 10. Hard Prohibitions

These are absolute. Stop and tell me before doing any of them.

**Git:** commit to main, manual `merge`/`rebase`, force-push, branch
from anything but main, AI attribution in commits.

**Code:** add a dependency without approval, change a dep version
without approval, read env vars outside the config layer, hard-delete
when soft-delete is policy, suppress a type/lint error without an
explanatory comment, leave debug statements committed, use `console.log`
/ `print` in committed code (use the logger), catch exceptions without
logging, swallow errors to make a test pass, write comments that
describe *what* the code does (comments explain *why*).

**Scope:** build anything not in the current task, refactor unrelated
files, fix unrelated bugs without asking, introduce new architectural
patterns without approval.

**Process:** open a PR with failing checks, skip the PR template, mark
work done before merge is confirmed.

---

## 11. Definition of Done

Done means **all** of:
- Feature works as specified
- Tests written and passing; types, lint, build all green
- PR description complete with manual steps documented
- PR open, URL shared, reviewed, merged
- I have confirmed we're ready for the next task

Code written ≠ done. Tests passing ≠ done. PR opened ≠ done.
Merged and confirmed = done.

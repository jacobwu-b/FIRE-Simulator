# Developer Handbook

This document is for me, not the AI. It covers the pipelines, quality
gates, and habits that keep this project shippable over the long haul.

`CLAUDE.md` governs how code gets *written*. This document governs how
code gets *delivered* and how the project stays maintainable.

---

## 1. Local environment

### Setup
Every repo should have a single command that takes a clean clone to a
working dev environment. Typically a `Makefile` or `justfile` target:

```makefile
setup:   # install deps, set up hooks, copy .env.example to .env
dev:     # start the dev server
test:    # run the test suite
lint:    # run the linter
typecheck: # run the type checker
build:   # build the production artifact
```

If I come back to this project in six months, I should not have to
remember the exact commands. The Makefile is the memory.

### Pre-commit hooks
Use `lefthook`, `husky` + `lint-staged`, or `pre-commit` (Python).

- **On pre-commit:** format + lint staged files only. Fast. Must not
  slow the commit loop down.
- **On pre-push:** run the full test suite. Slow is fine — it's the
  last chance before CI.

Hooks catch ~90% of CI failures before they ship. The goal is that
red CI is rare and meaningful, not routine.

---

## 2. CI pipeline

Every PR and every push to `main` runs the same checks. One workflow
file: `.github/workflows/ci.yml`.

### Required jobs (run in parallel)
1. **Lint** — style and common bugs
2. **Typecheck** — if the language has types
3. **Test** — unit tests with coverage reporting
4. **Build** — produce the deployable artifact

### Principles
- Fail fast. Each job independent where possible.
- Cache aggressively (deps, build artifacts) — slow CI erodes discipline.
- No step takes a flag that makes it optional. If a check is flaky,
  fix it or delete it. Never ignore it.
- Target: full pipeline under 5 minutes for anything reasonably sized.
  Past 10 minutes, people (me) start skipping local checks.

### Quality gates
Branch protection (see `GITHUB.md`) makes these required. A PR cannot
merge unless all four jobs pass. This is the hard enforcement behind
the Section 10 "Definition of Done" in `CLAUDE.md`.

### Skeleton workflow

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # setup language + deps with caching
      - run: [lint command]

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # setup
      - run: [typecheck command]

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # setup
      - run: [test command]

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - # setup
      - run: [build command]
```

---

## 3. Deployment pipeline

### Principle
Deploys are boring. Every merge to `main` deploys automatically after
CI passes. Manual deploy steps are process debt — each one is a chance
to forget.

### Platform choice
Lean on a PaaS. For personal projects, the right answer is almost
always one of: Vercel, Netlify, Fly.io, Render, or Railway. They handle
the boring parts (build, TLS, rollback, preview environments) for free
or near-free. Roll your own only when the project genuinely requires it.

### Preview environments
Every PR should get a preview URL. This is the single highest-leverage
feature of modern PaaS platforms — it turns "looks good to me" reviews
into "I clicked the preview and it works" reviews.

### Production gates
For anything with real users or irreversible side effects:
- Use a GitHub **Environment** with required reviewers (see `GITHUB.md`)
- The reviewer can be me — the pause is the point
- Staging environment between merge and prod if the project grows that
  far. Not needed for early-stage personal work.

### Rollback
Prefer platforms with one-click rollback to a previous deploy. If the
platform doesn't support this, revert the PR on GitHub; CI re-deploys
the previous state. Explicitly not a concern for projects without real
users — see `CLAUDE.md` for the minimal stance.

---

## 4. Observability

Wire this in on day one. It's cheap to set up early and painful to
retrofit after the first production incident.

### Logging
- Pick one logger. Use it everywhere.
- Structured JSON to stdout. The platform aggregates from there.
- Log levels: `debug` (dev only), `info` (notable events),
  `warn` (recoverable issues), `error` (needs attention).
- Never log secrets, tokens, or PII. Include request IDs when available.

### Error tracking
- Sentry's free tier covers most solo projects. Wire it in alongside
  the logger.
- Errors should tag: environment, release/commit SHA, user (if applicable).
- Set up at least one alert: new errors in production notify me
  somewhere I actually check.

### Metrics
- Don't over-engineer. For most personal projects, the platform's
  built-in metrics (response time, error rate, memory) are enough.
- Add custom metrics only when a specific question needs them.

### Uptime monitoring
- For anything with a public URL: a free uptime monitor (UptimeRobot,
  BetterStack, etc.) hitting a `/health` endpoint every 5 minutes.
- `/health` returns 200 when the app is up and can reach its critical
  dependencies (DB, primary API). Nothing more.

---

## 5. Data and state

### Database migrations
- Every schema change ships as a migration in the same PR (enforced by
  `CLAUDE.md § 3.6`).
- Migrations run automatically on deploy. Never manually.
- Forward-only by default. Write rollback migrations only for changes
  you genuinely expect might need rolling back.

### Backups
- If the project has a database with data that matters, enable
  automated daily backups through the platform.
- **Do one manual restore drill when you set it up.** An untested
  backup is a rumor. Write the restore procedure in the README.
- Retention: 7 days is usually enough for personal projects. 30 for
  anything with users.

### Local dev data
- Seed data lives in `scripts/seed.*` or equivalent, committed to the repo.
- `make reset` (or equivalent) tears down and rebuilds local DB + seed.
  Use it freely — local data is disposable.

---

## 6. Documentation habits

### ADRs — the single highest-ROI doc habit
When you make an architectural decision that's non-obvious or hard to
reverse, write an ADR. Three paragraphs:

1. **Context** — what's the situation, what's forcing a decision
2. **Decision** — what we're doing
3. **Consequences** — what this implies, what we give up

Location: `docs/decisions/NNNN-short-title.md`, numbered sequentially.
A template ships with this repo.

Future-you will read these more than any other docs in the project.

### Project journal
`docs/journal.md`, one dated entry per session, 2–4 sentences:
- What I worked on
- What I learned / what surprised me
- What's next

This is the single highest-leverage habit for solo work. It compensates
for not having standups or a teammate to explain things to. Don't
overthink the format — the act of writing is 90% of the value.

### README
The README answers: what is this, how do I run it, how do I deploy it.
If a new contributor (including future-me) can't go from clone to
running in under 10 minutes using only the README, the README is
broken.

### What NOT to document
- Things the code already says clearly
- Every function signature (types do this)
- Process that's already codified in `CLAUDE.md` / `DEV.md` / `GITHUB.md`

Documentation that duplicates code or other docs drifts and lies.
Less is more.

---

## 7. Dependency discipline

From `CLAUDE.md § 3.7`: new deps and version changes require approval.
On the developer side, the habits that make this work:

- **Weekly Dependabot review.** Block 20 minutes. Merge the boring ones,
  read changelogs for the interesting ones, reject the ones you don't
  need.
- **Audit before adding.** Does an existing dep solve this? Is this
  package actively maintained (last publish recent, weekly downloads
  healthy)? Is it plausibly going to be around in 2 years?
- **Prefer standard library** when it's close enough. The best
  dependency is no dependency.
- **Prefer small, focused packages** over frameworks-of-frameworks.
  They're easier to replace.

---

## 8. Security baseline

- Secrets in GitHub Actions secrets or the platform's secret manager.
  Never in code, never in commits.
- `SECURITY.md` at repo root — even three lines is enough. GitHub
  surfaces it automatically.
- Secret scanning enabled (see `GITHUB.md`). Push protection blocks
  accidental commits of detected secrets.
- Enable 2FA on GitHub and the deploy platform. Non-negotiable.
- If the project handles user data: think about it for 15 minutes before
  you write the schema. What's the minimum you can store? What happens
  if the DB leaks?

---

## 9. The weekly review (15 minutes)

Once a week, a short ritual to keep entropy in check:

- Review Dependabot PRs
- Skim `docs/journal.md` from the week — any patterns? any recurring
  frustrations that suggest a refactor?
- Check error tracking for new issues in production
- Close or groom any issues that went stale
- One ADR's worth of decisions piled up? Write it now, not later.

Most weeks this is 5 minutes. When it starts being 30, something's
drifting — address it before it compounds.

---

## 10. When something breaks

Order of operations:

1. **Confirm it's broken.** Reproduce it. Check error tracking.
2. **Assess blast radius.** Affecting users? Data at risk? If yes,
   stabilize first (roll back, disable feature, whatever buys time).
3. **Understand before fixing.** What changed? Check recent deploys,
   recent merges, recent config changes. `git log --since="24 hours ago"`
   is your friend.
4. **Fix with a test.** The regression test that would have caught it
   is the deliverable; the fix is a side effect. Per `CLAUDE.md § 6`.
5. **Write it up.** An ADR or journal entry. What happened, what we
   learned, what changes (if any) prevent recurrence.

Resist the urge to skip step 4 when the pressure is on. That's how
the same bug ships three times.

---

## 11. Anti-patterns I catch myself doing

A running list. Add to it when I notice myself slipping.

- Skipping the plan for a "Standard" task because it "feels trivial" —
  it rarely is.
- Letting the test suite get slow until I stop running it locally.
- Merging a Dependabot PR without reading the changelog.
- Writing comments that describe *what* instead of *why*.
- Postponing the ADR until "later" — later never comes.
- Treating `main` as a scratch branch when tired.

Every item on this list has cost me time at least twice.

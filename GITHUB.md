# GitHub Repository Configuration

Run this checklist once when creating a repo from this template.
These settings make the invariants in `CLAUDE.md` physically enforced
rather than aspirational.

---

## Branch protection on `main`

**Settings → Branches → Add rule for `main`:**

- [x] Require a pull request before merging
  - [x] Require approvals: **0** (solo dev; the PR itself is the guardrail)
  - [x] Dismiss stale approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Required checks: `test`, `typecheck`, `lint`, `build`
- [x] Require conversation resolution before merging
- [x] Require linear history
  - Enforces the squash-merge invariant at the platform level.
- [x] Block force pushes
- [x] Block deletions
- [ ] **Do not** check "Allow administrators to bypass." The whole point
      is the guardrail catches you on a tired Tuesday.

---

## Merge settings

**Settings → General → Pull Requests:**

- [x] Allow squash merging
  - Default commit message: **Pull request title and description**
- [ ] Allow merge commits — **disabled**
- [ ] Allow rebase merging — **disabled**
- [x] Always suggest updating pull request branches
- [x] Automatically delete head branches

These map directly to the Section 5 invariant in `CLAUDE.md`.

---

## Actions permissions

**Settings → Actions → General:**

- Actions permissions: **Allow [owner], and select non-[owner] actions
  and reusable workflows**
  - For personal projects, "Allow all actions" is also acceptable.
- Workflow permissions: **Read repository contents and packages permissions**
  - Grant write permissions per-workflow with `permissions:` blocks,
    not globally.
- [x] Require approval for first-time contributors

---

## Secrets

**Settings → Secrets and variables → Actions:**

- Repository secrets for CI-only values.
- Never commit `.env`. The `.env.example` in the repo root is the
  contract: every key the app reads is listed there with a dummy value.
- For production deploys, use an **Environment** (Settings → Environments)
  with required reviewers — even if the reviewer is you. The pause
  is the point.

---

## Dependabot

**Settings → Code security → Dependabot:**

- [x] Dependabot alerts
- [x] Dependabot security updates
- [x] Dependabot version updates (requires `.github/dependabot.yml`)

Suggested `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"     # or pip / cargo / gomod / etc.
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

Dependabot PRs are the approval venue for the "dep version changes
require approval" rule in `CLAUDE.md § 3.7`. Read the changelog before
merging. Major bumps get their own PR.

---

## Code security

**Settings → Code security:**

- [x] Secret scanning
- [x] Push protection (blocks pushes containing detected secrets)
- [x] CodeQL analysis (if language is supported — free for public repos
      and for private repos on paid plans)

---

## Repository settings

**Settings → General:**

- Default branch: `main`
- Features: disable Wikis and Projects unless actively used. Keep Issues on.
- Pull Requests: see "Merge settings" above.
- Archives: default is fine.

---

## Required files at repo root

These ship in this template. Verify they exist after forking:

- `README.md` — what the project does, how to run it locally, how to deploy
- `CLAUDE.md` — instructions to Claude Code
- `DEV.md` — developer handbook (human-facing)
- `GITHUB.md` — this file
- `SECURITY.md` — vulnerability reporting policy
- `.env.example` — every env var the app reads, dummy values
- `.gitignore` — language-appropriate; must include `.env`
- `.editorconfig` — ends the tabs-vs-spaces debate for every tool
- `docs/decisions/` — ADRs (one file per architectural decision)
- `.github/dependabot.yml` — dependency update config
- `.github/workflows/ci.yml` — CI pipeline (see `DEV.md`)
- `.github/pull_request_template.md` — PR template matching `CLAUDE.md § 7`

---

## One-time verification

After applying the above:

```bash
# Confirm .env is gitignored
git check-ignore .env

# Confirm main is protected: this should fail
git push origin main --force-with-lease --dry-run
```

If the force-push dry-run succeeds, branch protection is not configured
correctly — fix it before writing any code.

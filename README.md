# [Project Name]

[One paragraph: what this is, who it's for, what problem it solves]

---

## Getting Started

### Prerequisites
- [Runtime + version — e.g. Node.js ≥20]
- [Database — e.g. Postgres 15]
- [Other — e.g. Docker for local services]

### Setup
```bash
# 1. Clone
git clone [repo-url]
cd [project]

# 2. Install dependencies
[install command]

# 3. Configure environment
cp .env.example .env
# Edit .env — see Environment Variables section below

# 4. Set up database
[migration command]

# 5. Start development server
[dev command]
```

Open [http://localhost:[port]] in your browser.

### Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string | `postgresql://...` |
| `[KEY]` | Yes/No | [What it's for] | [Safe example value] |

All variables are documented in `.env.example`.

---

## Development

### Running tests
```bash
[test command]              # All tests
[test command] [file]       # Single file
[coverage command]          # With coverage
```

### Project structure
```
[annotated directory tree]
```

### Key conventions
- [Convention 1 — link to CLAUDE.md or relevant doc]
- [Convention 2]

---

## Deployment

[How to deploy. Link to more detailed docs if needed.]

---

## Contributing

This project uses AI-assisted development. See `CLAUDE.md` for the full development workflow.

Branch → PR → Review → Merge. Nothing goes directly to main.
```

---

## Quick Reference Card

Print this and keep it visible during sessions.
```
┌─────────────────────────────────────────────────────┐
│         AI SESSION CHECKLIST                        │
├─────────────────────────────────────────────────────┤
│ START                                               │
│  □ Give Claude the right prompt template            │
│  □ Confirm Claude has read CLAUDE.md + spec         │
│  □ Approve branch name before work starts          │
│  □ Approve implementation plan before code starts  │
├─────────────────────────────────────────────────────┤
│ DURING                                              │
│  □ Review proposed file list before Claude writes  │
│  □ Ask Claude to flag decisions / ambiguities       │
│  □ Check in at natural breakpoints                  │
├─────────────────────────────────────────────────────┤
│ END                                                 │
│  □ Tests written and passing                        │
│  □ PR description generated from template          │
│  □ No direct push to main                          │
│  □ Review PR before merging                        │
│  □ Update DECISIONS.md if a significant call made  │
├─────────────────────────────────────────────────────┤
│ BRANCH NAMES                                        │
│  feat/scope-description                             │
│  fix/scope-description                              │
│  chore/scope-description                            │
│  test/scope-description                             │
│  refactor/scope-description                         │
│  docs/scope-description                             │
└─────────────────────────────────────────────────────┘
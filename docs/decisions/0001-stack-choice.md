# 0001 — Stack Choice: Vite + React + TypeScript

**Date:** 2026-05-01  
**Status:** Accepted  
**Deciders:** Jacob Wu

## Context

The FIRE Simulator requires a modern frontend stack that can:
- Support rapid iteration with hot module replacement (HMR)
- Enforce type safety across React components
- Provide industry-standard testing and linting
- Scale to medium-complexity UI with parameter controls and visualizations

## Decision

Use **Vite + React 19 + TypeScript 5.6** for the primary stack, with **Vitest** for testing, **ESLint 9** for linting, and **Prettier 3** for formatting.

## Rationale

### Vite (build tool)
- **Speed:** Near-instant HMR for React development; bundle times <100ms for incremental changes
- **Modern:** Uses native ESM in dev, optimized rollup builds for production
- **Minimal config:** Works out-of-box with sensible defaults
- **Alternative rejected:** Webpack adds >30s to bundling and requires extensive configuration

### React 19 (UI framework)
- **Industry standard:** Largest ecosystem, battle-tested at scale
- **v19 updates:** Improved server component foundations, form actions, compiler directives
- **Component model:** Composable, declarative approach fits financial UI well (parameter controls → results)
- **Alternative rejected:** Vue adds no value; Solid.js is less mature

### TypeScript 5.6 (language)
- **Type safety:** Catches bugs at compile time; aligns with project's emphasis on correctness
- **Latest features:** Const type parameters, JSDoc async/await completion
- **Strict mode:** Enforces explicit types per CLAUDE.md values
- **Alternative rejected:** Plain JavaScript risks runtime errors in complex simulation logic

### Vitest (test runner)
- **Speed:** Native ESM support, parallelizes by default, <100ms per test file
- **Vite integration:** Shares config, understands TypeScript out-of-box
- **Jest compatibility:** Can incrementally migrate Jest tests if needed later
- **Alternative rejected:** Jest requires preprocessing, slower on Vite projects

### ESLint 9 + Prettier 3
- **Flat config:** ESLint 9's new format eliminates nesting verbosity
- **React rules:** Enforces hooks rules, detects missing dependencies
- **Formatter consensus:** Prettier removes formatting debates; ESLint focuses on logic

## Trade-offs

### Performance
- **Pro:** Vite's HMR is instant for most changes
- **Con:** Monte Carlo simulations (heavy computation) may block the main thread; worker threads TBD for future versions

### Bundle size
- **Pro:** React 19 is ~42KB gzipped; Vite's tree-shaking eliminates unused code
- **Con:** No aggressive optimization attempted until metrics show need

### Future flexibility
- **Pro:** Vite supports eject if needed; React ecosystem is modular (state management, charting libs)
- **Con:** Switching away from TypeScript later would require rewrite

## Consequences

1. All components and utilities are typed; type errors surface before runtime
2. New developers must be comfortable with TypeScript and React Hooks
3. Development requires Node.js 18+; CI/CD runs against 20.x and 22.x
4. Test authorship is mandatory for all non-trivial changes (Section 6, CLAUDE.md)

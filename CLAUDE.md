# SEAL Hackathon Project Developer Guide

## Build & Run Commands
- **Server (Backend)**:
  - Install dependencies: `cd server && npm install`
  - Run development server: `cd server && npm start` (or `node ./bin/www`)
- **Client (Frontend Web)**:
  - Install dependencies: `cd client && npm install`
  - Run development server: `cd client && npm run dev`

## Code Style & Architecture
- **Backend (NodeJS/Express/MongoDB)**:
  - Use Mongoose for database schemas.
  - Follow the 20 models defined in `schema.dbml`.
  - Use modular route files in `/routes` and service classes in `/services`.
  - Handle asynchronous tasks like GitHub repository creation and AI commit analysis using node-cron.
- **Frontend (ReactJS/TypeScript/TailwindCSS v4)**:
  - Use TailwindCSS v4 for styling.
  - Use React Router for navigation.
  - Keep components modular, typing all props and states.
  - Implement dynamic Glassmorphism layouts.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **seal-management-system** (2664 symbols, 3369 relationships, 66 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/seal-management-system/context` | Codebase overview, check index freshness |
| `gitnexus://repo/seal-management-system/clusters` | All functional areas |
| `gitnexus://repo/seal-management-system/processes` | All execution flows |
| `gitnexus://repo/seal-management-system/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

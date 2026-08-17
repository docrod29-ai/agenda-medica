<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Shared agent policy

Before planning, reviewing, or modifying this repository:
1. Read `CLAUDE.md` completely.
2. Treat `CLAUDE.md` as the canonical project/product policy.
3. Preserve all existing architecture, safety rules, product decisions, and prohibitions defined there.
4. Search the repository before creating a new component, hook, service, utility, route, schema, or abstraction.
5. Do not create parallel/V2/replacement implementations when a canonical implementation already exists.
6. Never undo or overwrite work from another agent unless explicitly instructed.
7. Before modifying code, inspect `git status` and recent `git log`.
8. Keep changes strictly within the requested task.
9. Never merge to `main`, deploy to production, or perform destructive Git operations without explicit owner authorization.
10. When handing work to another agent, leave a clean Git checkpoint and summarize what changed and what remains.

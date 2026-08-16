# AUSCULTA-AUTONOMOUS-CONTROL-PLANE-001 — Baseline

## Status

`ACP-000` — READ-ONLY BASELINE / AUTHORITY RECONCILIATION

This file records the initial facts that the cloud control plane must respect before any autonomous writer or judge is allowed to run.

## Immutable starting point

- Accepted V15 candidate SHA: `317c6c5695b69e1a543d99d65e897f638db563a8`
- Control-plane branch: `control-plane/autonomous-001`
- Production deployment: **NOT AUTHORIZED**
- Merge to `main`: **NOT AUTHORIZED**
- PHI: **FORBIDDEN**
- Destructive changes: **FORBIDDEN**
- Clinical-policy changes: **FORBIDDEN without owner approval**

## Repository facts found in the baseline

1. `CLAUDE.md` remains the project policy authority and explicitly forbids production deployment, main merge, destructive production changes, identifiable patient data, real patient communications, real prescriptions, live Stripe actions, and other consequential operations without explicit owner authorization.
2. `AGENTS.md` requires reading `CLAUDE.md`, inspecting repository state before modification, keeping scope bounded, and leaving clean checkpoints between agents.
3. The repository currently has one GitHub Actions workflow: `.github/workflows/ci.yml`.
4. Current CI already provides useful independent gates: clinical safety, tenant isolation against the emulator, typecheck, full Vitest, production build, lint ratchet, and public/security E2E against the PR build.
5. `agent-state/MASTER_STATE.json` is **stale legacy state and is unsafe as an execution authority**. It still contains historical autonomous permissions that allow production deployment and merge to `main`, and therefore directly conflicts with current owner governance.
6. `agent-state/BACKLOG.json` contains useful historical findings, but it is not the execution order for the new control plane.
7. GitHub currently exposes `Preview` and `Production` environments. At baseline, both have no protection rules configured and administrators can bypass them. Therefore the Control Plane must not infer safety merely from environment existence.
8. Repository secret values and even the repository-secret list are not accessible to the current GitHub integration. The bootstrap cannot assume that `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `PERPLEXITY_API_KEY` exists until a workflow performs a fail-closed preflight.

## External capability facts verified against current primary documentation

### Claude Code

Claude Code supports non-interactive execution (`claude -p`) and GitHub Actions automation. Anthropic's official `anthropics/claude-code-action@v1` can run a prompt in a GitHub-hosted runner and can be bounded with allowed/disallowed tools and max turns. A cloud writer still requires authenticated provider credentials, normally supplied through GitHub secrets or a configured enterprise provider.

### Codex

OpenAI provides `openai/codex-action@v1` and `codex exec` for GitHub/CI automation. The official action supports restricted permission profiles and is appropriate for a read-only independent judge. It requires an API credential such as `OPENAI_API_KEY` unless another explicitly supported provider is configured.

### Perplexity

Perplexity exposes Agent, Search, Sonar, and asynchronous Sonar APIs. It is suitable for read-only external research packets, but it is not required for the first autonomous writer→judge proof.

### GitHub Actions

GitHub Actions supports concurrency control, workflow/repository dispatch, scheduled execution, and protected environments with required reviewers. Those primitives are sufficient to keep one active writer, serialize the state machine, and stop at owner-only gates. Existing `Production` environment protection is currently insufficient and must not be treated as an owner gate until protections are explicitly configured and verified.

## Architectural decision for the MVP

The first autonomous proof will be GitHub-native and deliberately small:

`MASTER_BOARD.json`
→ deterministic selector
→ one Claude writer job
→ existing CI
→ immutable SHA freeze
→ one Codex read-only judge job
→ structured verdict
→ deterministic state transition
→ next allowed item

No Redis, Kafka, Kubernetes, Temporal, microservices, or separate control-plane database is justified for the bootstrap. Durable state starts in Git/GitHub because that is already the authoritative engineering system and gives immutable SHA evidence for free.

If GitHub-native orchestration later proves insufficient for long-running state, retries, observability, or scale, that becomes an evidence-backed architecture decision instead of an assumed prerequisite.

## Required fail-closed bootstrap preflight

Before any AI agent is invoked automatically, the future workflow must verify:

- canonical board parses and validates against schema;
- exactly one task is eligible;
- no other writer lock is active;
- branch and expected SHA are explicit;
- worktree is clean;
- production/main/PHI/destructive flags are false;
- required provider secret is present without printing its value;
- task has bounded max turns / runtime / retry budget;
- writer permissions do not include production deployment or main merge;
- judge runs only after writer SHA is frozen;
- judge receives read-only repository permissions;
- `UNVERIFIABLE` cannot transition to `PASS`;
- P2/P3 cannot auto-create a repair loop;
- owner-gated actions stop in `OWNER_APPROVAL_REQUIRED`.

If any preflight condition fails, the program transitions to `BLOCKED`; it does not guess, weaken policy, or continue.

## Bootstrap credential boundary

One-time cloud credential provisioning is an unavoidable external dependency. The control plane may reference secrets but must never create, expose, print, rotate, or infer them.

Expected secret names for the initial proof:

- `ANTHROPIC_API_KEY` — writer
- `OPENAI_API_KEY` — independent judge

Optional later:

- `PERPLEXITY_API_KEY` — research scout

The implementation must detect missing credentials and stop with a precise `MISSING_REQUIRED_SECRET_OR_EXTERNAL_CREDENTIAL` result.

## Closure criteria for ACP-000

`ACP-000` may close when:

- the new machine-readable Master Board is canonical;
- its schema exists;
- stale legacy authority is explicitly invalidated;
- cloud capabilities and credential boundaries are documented;
- the next item is unambiguous: `ACP-001`.

## Next allowed action

`ACP-001 — Executable state contract and validator`

Implement only deterministic board parsing, schema validation, state-transition guards, lock semantics, and next-item selection. Do **not** invoke Claude, Codex, Perplexity, merge, or production deployment in ACP-001.

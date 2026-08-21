# Ausculta n8n Dev Autopilot v1

Purpose: remove idle time between GitHub CI, the independent Codex judge, and the bounded Claude repair writer while preserving the existing exact-SHA gates.

## Scope

This is **development orchestration only**.

- No PHI or patient data.
- No production deployment.
- No product merge to `main`.
- No clinical-policy mutation.
- No autonomous prescribing/signing.
- No weakening of CI/Codex/Clinical Truth gates.
- No duplicate judge/writer launch for the same exact SHA.
- Only same-repository `product/*` pull requests in `docrod29-ai/agenda-medica` are eligible.

The workflow is intentionally fail-closed. A stale SHA, foreign repository, untrusted comment actor, malformed verdict, `action_required`, repeated CI failure, or missing credential produces a stop/recovery result instead of mutating product code.

## Event loop

```text
product writer pushes new SHA
        ↓
GitHub CI completes
        ↓
CI SUCCESS ── exact-SHA command already exists? ── yes → stop
        │
        no
        ↓
/ausculta-codex-judge <exact SHA>
        ↓
independent verdict published by github-actions[bot]
        ↓
PASS / no blocking P0/P1 → gate_passed → stop
        │
blocking P0/P1
        ↓
/ausculta-claude-writer <same exact SHA>
        ↓
writer pushes repair SHA
        ↓
CI starts again
```

For a normal CI `failure`, `cancelled`, or `timed_out`, v1 makes at most one GitHub `rerun-failed-jobs` request. It does **not** auto-retry `action_required`, `startup_failure`, or repeated failures because those require transport diagnosis rather than an infinite loop.

## Files

- `workflows/ausculta-dev-autopilot-v1.json`: importable n8n workflow, inactive by default.
- `docker-compose.dev.yml`: isolated self-hosted development instance. It contains no secrets.
- `.env.example`: names of required variables only; never commit real values.

## Required credentials

The dedicated dev n8n instance receives only development-control credentials:

- `AUSCULTA_GITHUB_WEBHOOK_SECRET`: random webhook HMAC secret.
- `AUSCULTA_GITHUB_TOKEN`: fine-grained GitHub token limited to this repository with only the permissions required to read PRs/comments/actions, add PR issue comments, and rerun failed Actions jobs.
- `N8N_ENCRYPTION_KEY`: long random n8n encryption key.
- `N8N_WEBHOOK_URL`: public HTTPS base URL of the isolated n8n dev instance.

Do not expose Firebase production secrets, PHI, Anthropic/OpenAI keys, or application production credentials to this n8n instance. Claude/Codex continue to run through the existing GitHub Actions secrets and workflows.

## GitHub webhook

Once the instance has a stable HTTPS URL, create one repository webhook pointing to:

`<N8N_WEBHOOK_URL>/webhook/ausculta-dev-autopilot-v1`

Content type: `application/json`.

Secret: the exact `AUSCULTA_GITHUB_WEBHOOK_SECRET` value.

Events required by v1:

- Workflow runs
- Issue comments

Do not select patient/application events.

## Security model

The Webhook node keeps the raw body. The Code node validates GitHub `X-Hub-Signature-256` with HMAC-SHA256 and timing-safe comparison **before parsing or acting on the event**. The repository full name is then pinned to `docrod29-ai/agenda-medica`.

The self-hosted development instance permits only Node's built-in `crypto` module in Code nodes. Environment access is enabled only because this dedicated instance contains development-control secrets and no production/application secrets. Dangerous shell/SSH nodes are excluded in the compose file.

## Activation checklist

1. Start the isolated dev n8n instance with real values supplied outside Git.
2. Import `workflows/ausculta-dev-autopilot-v1.json`.
3. Keep the workflow inactive while testing the webhook signature with a GitHub test delivery.
4. Confirm a foreign repository payload is ignored.
5. Confirm a stale SHA is ignored.
6. Confirm an already-existing exact-SHA Codex command is not duplicated.
7. Confirm a blocking exact-SHA verdict creates at most one Claude writer command.
8. Activate the workflow.
9. Run `n8n audit` and retain the result before relying on the instance unattended.

## Deliberate v1 exclusions

- No product merges.
- No production deploys.
- No automatic `action_required` close/reopen recovery yet.
- No provider-credit purchase or billing mutations.
- No direct Anthropic/OpenAI API calls.
- No patient-facing automations.
- No Hospital/UCI automations.

Those exclusions keep this first n8n slice reversible and useful immediately without creating another platform project.
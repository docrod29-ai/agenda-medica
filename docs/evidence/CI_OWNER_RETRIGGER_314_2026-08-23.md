# Evidence #314 runtime repair — owner CI retrigger — 2026-08-23

PR: #346  
Prepared parent: #341  
Repaired bot checkpoint: `2b45e6101eef8cb8d5cf6b139847350aaecd9c55`

The bounded runtime repair is present at the checkpoint above. The existing physician-facing `/api/consultor-evidencia` path now consumes the canonical Evidence integration semantics and preserves the operational distinction between a successful PubMed query that returns zero results and a provider/network failure where PubMed was not successfully consulted. The repair preserves provenance and explicitly prevents unavailable retrieval from being presented as an evidence finding.

Focused regression coverage is present in `src/__tests__/evidence-runtime-consultor.test.ts`, including zero-results versus unavailable, failure-copy semantics, partial/provenance behavior, physician-decision boundary, and production reachability without increasing the reachability ceiling or adding fake imports.

CI run #1194 on the bot-authored checkpoint concluded `action_required`; no product PASS or FAIL is inferred from that transport state. This documentation-only owner-connector checkpoint exists solely to produce a normal pull-request synchronization event and retrigger canonical CI. It does not change Evidence behavior, retrieval policy, clinical policy, auth/tenant rules, PHI handling, dependencies, providers, credentials, cost policy, or deployment configuration.

Required next gate: canonical CI must execute on the new exact SHA. If it fails, repair only the concrete failing gate. No merge to `main`, no production deploy, no PHI, no new paid evidence provider, and no scope expansion.

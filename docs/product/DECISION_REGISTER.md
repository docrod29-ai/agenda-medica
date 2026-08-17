# AUSCULTA DECISION REGISTER

This register prevents implicit decisions and context drift. Product assertions not supported here or in `CONTEXT_CANONICAL.md` remain UNKNOWN until resolved.

| ID | Decision | State |
|---|---|---|
| D-001 | Accepted V15 baseline is `317c6c5695b69e1a543d99d65e897f638db563a8`. | ACCEPTED |
| D-002 | Issue #296 is the visible Product Board and product execution is the primary objective. | ACCEPTED |
| D-003 | Product work begins with CONTEXT-CANONICALIZATION and follows the exact canonical work order. | ACCEPTED |
| D-004 | One clinical truth -> structured facts/encounter model -> multiple document renderers/downstream workflows. | ACCEPTED |
| D-005 | Absolute NO INVENTAR; preserve NEGADO, NO_INTERROGADO, NO_DOCUMENTADO, DESCONOCIDO, INFERIDO, INCIERTO, CONFLICTIVO. | ACCEPTED |
| D-006 | Preserve provenance and document draft/signed lifecycle. | ACCEPTED |
| D-007 | Physician corrections may train preference/style behavior but must not rewrite clinical truth. | ACCEPTED |
| D-008 | Documentation accepts dictation/free text/mixed input, disorder, abbreviations, spelling errors, medical terminology, Spanish/English/Spanglish without requiring re-dictation. | ACCEPTED |
| D-009 | Minimum document renderer set is the 15 outputs enumerated in CONTEXT_CANONICAL.md. | ACCEPTED |
| D-010 | One writer at a time for overlapping product slice files; independent audit/research/preparation may proceed in parallel. | ACCEPTED |
| D-011 | Claude/Opus is preferred writer when available; Codex is independent read-only judge for frozen slices where appropriate. | ACCEPTED |
| D-012 | Non-blocking Control Plane P2/P3 are deferred; only blocking P0/P1 may interrupt product execution. | ACCEPTED |
| D-013 | NO-GOLD-PLATING: mandatory acceptance criteria close the slice; optional refactors/cosmetic infrastructure are deferred. | ACCEPTED |
| D-014 | Merge to main, production deployment, PHI use/exposure, production-secret rotation, clinical-policy changes, weakened gates, destructive/irreversible changes, and billing/spending changes outside limits require explicit owner approval. | OWNER_APPROVAL_REQUIRED |
| D-015 | Specific commercial integrations/providers not yet explicitly accepted are not assumed. | UNKNOWN |
| D-016 | Exact production scale/SLO targets must be defined and validated in the Reliability/Scale slice rather than invented now. | DEFERRED |
| D-017 | Competitive superiority claims require Evaluation Kernel evidence; target ambition is not proof. | ACCEPTED |

## Conflict rule
If repository prose, stale Control Plane state, or an agent output conflicts with this canonical product context, do not silently reconcile it. Classify the conflict as CONFLICTIVO/UNKNOWN as appropriate and escalate only when it blocks safe execution.

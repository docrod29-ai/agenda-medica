# R-06 — Receta design capability / issue #350

Status: ACTIVE P0 REPAIR DIRECTIVE
Parent board: #296

## Problem
`GET /api/receta/diseno?path=` reaches Firebase Storage through Admin SDK. The current signed-token helper authenticates `path|exp`; it does not bind the capability to canonical owner/clinic identity. A path is never authorization.

## Required repair
1. Mint a design capability only after Firebase authentication plus canonical clinic membership/tenant verification. Caller-provided clinic/path identity is not authoritative.
2. Use a versioned HMAC capability binding at minimum `version + path + ownerUid + clinicId + exp`; tampering with any field fails closed and signature comparison remains constant-time.
3. For legacy `receta-diseno/{uid}/...`, the path owner must equal the authenticated/minted owner. Do not guess ownership for opaque/new namespaces.
4. Before any Admin SDK download, require and verify the bound capability. Plain `path` must not be authorization.
5. Do not silently retain unsigned access in production-equivalent behavior. Any temporary legacy compatibility must be explicit, bounded and tested; missing required secret/binding fails closed.
6. Do not assume an `<img>` request carries `Authorization`: the authenticated application first mints a short-lived scoped URL; the image request then presents only that bound expiring capability.

## Mandatory tests
- same-clinic authenticated owner can mint/use a capability;
- unauthenticated mint fails;
- clinic A cannot mint/use clinic B capability;
- owner A cannot use owner B legacy path;
- tampered path/ownerUid/clinicId/exp/signature fails;
- expired/stale capability fails;
- missing secret fails closed in production-equivalent mode;
- plain unsigned `?path=` cannot reach Admin SDK in strict/production-equivalent mode;
- valid prescription design rendering remains compatible through the mint flow;
- no clinical-photo namespace/lifecycle changes here; R-05 belongs to #353.

## Ownership / exclusions
Narrowly required `src/app/api/receta/diseno/**`, authenticated mint route if needed, `src/lib/receta-diseno-token.ts`, existing image/config integration only if strictly required, and focused tests. Reuse `verificarUsuario`, canonical membership/authz and existing server primitives. Do not touch Voice, Reasoning, Migration/R-05, Hospital/UCI, workflows, dependencies, Firebase rules, production config or clinical policy. No PHI, secrets, deploy, destructive migration or gate weakening.

Persist one exact-SHA checkpoint, run focused verification and canonical CI, then stop. No paid Codex audit is authorized for this lane by this directive.

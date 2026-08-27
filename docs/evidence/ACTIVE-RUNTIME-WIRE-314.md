# ACTIVE RUNTIME WIRE — Evidence #314

Stacked repair over prepared Evidence PR #341.

The only purpose of this branch is to close the real runtime/reachability P1 without weakening gates.

## Current defect

The new `src/lib/evidence-integrations/**` architecture exists but is not reached by the physician runtime. The existing `src/app/api/consultor-evidencia/route.ts` still calls PubMed directly and collapses retrieval failures to `[]`, which makes "PubMed returned zero results" indistinguishable from "PubMed was unavailable".

## Required repair

- Reuse `adaptadorPubMed` and the canonical Evidence contracts from #341.
- Integrate them into the existing physician-facing evidence endpoint; no dummy route and no unused/fake import.
- Preserve auth, tenant isolation, PHI minimization, credit/cost accounting and streaming behavior.
- Never raise `FUERA_DEL_CAMINO_HOY` to make CI pass.
- Keep UpToDate/OpenEvidence/Cochrane licensing-safe and unconfigured until legitimate access exists.
- Perplexity remains discovery-only; clinician private knowledge remains distinct from external canonical evidence.
- Evidence never silently becomes diagnosis, order or prescription.

## Acceptance

Tests must distinguish successful zero-result retrieval from retrieval failure, preserve provenance on successful/partial retrieval, prevent false claims that an unavailable source was searched, and prove real physician-runtime reachability without weakening the gate.

No merge to main, no deploy, no PHI, no clinical-policy change, no broad refactor.

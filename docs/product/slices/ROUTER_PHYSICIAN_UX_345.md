# ROUTER_PHYSICIAN_UX_345 — manual Claude lane

Parent board: #296. Source prepared lane: #345. This lane is reserved for MANUAL Claude/Opus work by the owner; do not trigger the automated writer on this PR unless the owner later asks.

## Problem
Current physician-facing plan/engine semantics still expose provider/model brands such as Haiku/Sonnet/Opus/GPT. The product rule is that the physician chooses clinical/task intent, not vendor/model internals; the router selects the minimum sufficient compute automatically.

## Bounded implementation
- Remove provider/model-brand choice from physician-facing routing semantics and copy.
- Preserve clinically meaningful task/risk/complexity intent only where it changes behavior.
- Map that intent to the existing canonical router metadata; do not create a second router.
- Preserve audit provenance of the model/provider actually used underneath.
- Preserve pricing/credit transparency without turning provider names into physician controls.
- Add focused negative tests proving provider/model brands cannot become the physician routing contract.

## Ownership boundaries
Do not touch Voice #302, Reasoning #303, Migration #353, R-06 #355, Scale #356, Evidence #346, Hospital/UCI, workflows, dependencies, Firebase/Storage rules, production config or deployment. Avoid broad Consultorio UI redesign; change only the minimum shared/domain + directly related physician-facing copy/tests required for this blocker.

## Stop conditions
Run focused tests, typecheck and relevant canonical verification. Commit/push one checkpoint to this branch and stop. No merge to main, no deploy, no PHI, no clinical-policy change, no gate weakening, no new paid provider.

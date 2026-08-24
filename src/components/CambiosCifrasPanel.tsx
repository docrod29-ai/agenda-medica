'use client'

/**
 * CambiosCifrasPanel — provenance-only surface for deterministic rewrites.
 *
 * Golden Path Consultorio rule: safe deterministic presentation normalization
 * (for example, writing a spoken unit in its canonical form) must not turn into
 * a debugging/audit task for the physician. The underlying `cambios` list stays
 * intact in the transcription pipeline and therefore remains available to
 * provenance/audit code; this component simply does not expose that routine
 * ledger in the primary clinical workflow.
 *
 * Clinically material uncertainty is NOT hidden here. Rejected/unsafe rewrites
 * are surfaced by the existing `AlertasDictado`/ambiguity path before signing.
 * That path remains the place for dose, unit, negation, laterality and other
 * meaning-changing exceptions. Do not reintroduce confidence/debug plumbing in
 * this component as a substitute for contextual clinical review.
 */

import type { CambioVisible } from '@/lib/asr/cambios-visibles'

interface Props {
  cambios: CambioVisible[]
  /** Kept for API compatibility with the consultation surface and audit tooling. */
  onRevertir: (c: CambioVisible) => void
}

export function CambiosCifrasPanel(_props: Props) {
  return null
}

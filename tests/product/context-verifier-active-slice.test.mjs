import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyContext } from '../../scripts/product/context-verifier.mjs'

const canonicalBase = `# CONTEXT\nActive slice: VOICE ENGINE.\nOne clinical truth -> structured facts/encounter model -> multiple document renderers\nNO INVENTAR\nNEGADO NO_INTERROGADO NO_DOCUMENTADO DESCONOCIDO INFERIDO INCIERTO CONFLICTIVO\nPreserve draft/signed lifecycle. Spanish, English, or Spanglish.`
const decisions = `ACCEPTED DEFERRED UNKNOWN OWNER_APPROVAL_REQUIRED`
const board = `
| Order | Slice | Status |
|---:|---|---|
| 1 | CONTEXT-CANONICALIZATION | COMPLETE |
| 2 | DOCUMENTATION ENGINE / CLINICAL TRUTH | COMPLETE |
| 3 | VOICE ENGINE | ACTIVE |
| 4 | CLINICAL REASONING + EVIDENCE + SAFETY | QUEUED |
| 5 | CONSULTORIO / AGENDA / RECETA / PAGOS / SECRETARIA | QUEUED |
| 6 | WHATSAPP / PATIENT EXPERIENCE | QUEUED |
| 7 | HOSPITAL / UCI | QUEUED |
| 8 | SPECIALTY PACKAGES | QUEUED |
| 9 | MOBILE FIRST + BRAND / UI | QUEUED |
| 10 | RELIABILITY / SCALE / OBSERVABILITY / DR / SECURITY / PRODUCTION READINESS | QUEUED |
| 11 | EVALUATION KERNEL / competitive benchmark | QUEUED |
`

const files = (canonical = canonicalBase) => ({
  'CONTEXT_CANONICAL.md': canonical,
  'PRODUCT_BOARD.md': board,
  'DECISION_REGISTER.md': decisions,
})

test('accepts when canonical active slice matches the board', () => {
  assert.deepEqual(verifyContext({ files: files() }), { ok: true, errors: [] })
})

test('rejects a contradictory canonical active-slice declaration', () => {
  const canonical = canonicalBase.replace('Active slice: VOICE ENGINE.', 'Active slice: CONTEXT-CANONICALIZATION.')
  const result = verifyContext({ files: files(canonical) })
  assert.equal(result.ok, false)
  assert.ok(result.errors.includes('CANONICAL_ACTIVE_SLICE_MISMATCH:CONTEXT-CANONICALIZATION:VOICE ENGINE'))
})

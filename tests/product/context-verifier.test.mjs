import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyContext } from '../../scripts/product/context-verifier.mjs'

const canonical = `# CONTEXT\nOne clinical truth -> structured facts/encounter model -> multiple document renderers\nNO INVENTAR\nNEGADO NO_INTERROGADO NO_DOCUMENTADO DESCONOCIDO INFERIDO INCIERTO CONFLICTIVO\nPreserve draft/signed lifecycle. Spanish, English, or Spanglish.`
const decisions = `ACCEPTED DEFERRED UNKNOWN OWNER_APPROVAL_REQUIRED`
const board = `
| Order | Slice | Status |
|---:|---|---|
| 1 | CONTEXT-CANONICALIZATION | COMPLETE |
| 2 | DOCUMENTATION ENGINE / CLINICAL TRUTH | ACTIVE |
| 3 | VOICE ENGINE | QUEUED |
| 4 | CLINICAL REASONING + EVIDENCE + SAFETY | QUEUED |
| 5 | CONSULTORIO / AGENDA / RECETA / PAGOS / SECRETARIA | QUEUED |
| 6 | WHATSAPP / PATIENT EXPERIENCE | QUEUED |
| 7 | HOSPITAL / UCI | QUEUED |
| 8 | SPECIALTY PACKAGES | QUEUED |
| 9 | MOBILE FIRST + BRAND / UI | QUEUED |
| 10 | RELIABILITY / SCALE / OBSERVABILITY / DR / SECURITY / PRODUCTION READINESS | QUEUED |
| 11 | EVALUATION KERNEL / competitive benchmark | QUEUED |
`

const good = () => ({
  'CONTEXT_CANONICAL.md': canonical,
  'PRODUCT_BOARD.md': board,
  'DECISION_REGISTER.md': decisions,
})

test('accepts canonical context after advancing to the next slice', () => {
  assert.deepEqual(verifyContext({ files: good() }), { ok: true, errors: [] })
})

test('rejects missing truth state', () => {
  const files = good(); files['CONTEXT_CANONICAL.md'] = canonical.replace('CONFLICTIVO', '')
  assert.equal(verifyContext({ files }).ok, false)
})

test('rejects duplicate active slices', () => {
  const files = good(); files['PRODUCT_BOARD.md'] = board.replace('| 3 | VOICE ENGINE | QUEUED |', '| 3 | VOICE ENGINE | ACTIVE |')
  assert.ok(verifyContext({ files }).errors.some(e => e.startsWith('ACTIVE_SLICE_COUNT:')))
})

test('rejects active slice when a prior slice is not complete', () => {
  const files = good(); files['PRODUCT_BOARD.md'] = board.replace('| 1 | CONTEXT-CANONICALIZATION | COMPLETE |', '| 1 | CONTEXT-CANONICALIZATION | QUEUED |')
  assert.ok(verifyContext({ files }).errors.some(e => e.startsWith('WRONG_ACTIVE_SLICE:') || e.startsWith('PRIOR_SLICE_NOT_COMPLETE:')))
})

test('rejects wrong work order', () => {
  const files = good(); files['PRODUCT_BOARD.md'] = board.replace('| 2 | DOCUMENTATION ENGINE / CLINICAL TRUTH | ACTIVE |\n| 3 | VOICE ENGINE | QUEUED |', '| 2 | VOICE ENGINE | ACTIVE |\n| 3 | DOCUMENTATION ENGINE / CLINICAL TRUTH | QUEUED |')
  assert.ok(verifyContext({ files }).errors.includes('WRONG_PRODUCT_WORK_ORDER'))
})

test('rejects contradictory UNVERIFIABLE pass assertion', () => {
  const files = good(); files['DECISION_REGISTER.md'] += '\nUNVERIFIABLE == PASS'
  assert.ok(verifyContext({ files }).errors.some(e => e.startsWith('CONTRADICTORY_CANONICAL_ASSERTION:')))
})

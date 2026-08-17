import fs from 'node:fs'
import path from 'node:path'

export const WORK_ORDER = [
  'CONTEXT-CANONICALIZATION',
  'DOCUMENTATION ENGINE / CLINICAL TRUTH',
  'VOICE ENGINE',
  'CLINICAL REASONING + EVIDENCE + SAFETY',
  'CONSULTORIO / AGENDA / RECETA / PAGOS / SECRETARIA',
  'WHATSAPP / PATIENT EXPERIENCE',
  'HOSPITAL / UCI',
  'SPECIALTY PACKAGES',
  'MOBILE FIRST + BRAND / UI',
  'RELIABILITY / SCALE / OBSERVABILITY / DR / SECURITY / PRODUCTION READINESS',
  'EVALUATION KERNEL / competitive benchmark',
]

const REQUIRED_TRUTH_STATES = ['NEGADO','NO_INTERROGADO','NO_DOCUMENTADO','DESCONOCIDO','INFERIDO','INCIERTO','CONFLICTIVO']
const REQUIRED_DOCS = ['CONTEXT_CANONICAL.md','PRODUCT_BOARD.md','DECISION_REGISTER.md']
const ALLOWED_STATUSES = new Set(['COMPLETE','ACTIVE','QUEUED'])

export function verifyContext({ root = process.cwd(), files } = {}) {
  const read = (name) => files?.[name] ?? fs.readFileSync(path.join(root, 'docs/product', name), 'utf8')
  const canonical = read('CONTEXT_CANONICAL.md')
  const board = read('PRODUCT_BOARD.md')
  const decisions = read('DECISION_REGISTER.md')
  const errors = []

  for (const name of REQUIRED_DOCS) {
    const content = name === 'CONTEXT_CANONICAL.md' ? canonical : name === 'PRODUCT_BOARD.md' ? board : decisions
    if (!content?.trim()) errors.push(`MISSING_OR_EMPTY:${name}`)
  }

  for (const state of REQUIRED_TRUTH_STATES) {
    if (!canonical.includes(state)) errors.push(`MISSING_TRUTH_STATE:${state}`)
  }

  for (const phrase of ['NO INVENTAR', 'One clinical truth', 'draft/signed', 'Spanish, English, or Spanglish']) {
    if (!canonical.toLowerCase().includes(phrase.toLowerCase())) errors.push(`MISSING_CANONICAL_REQUIREMENT:${phrase}`)
  }

  const rows = [...board.matchAll(/\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g)]
    .map(m => ({ order: Number(m[1]), slice: m[2].trim(), status: m[3].trim() }))
    .filter(row => Number.isFinite(row.order))

  const boardOrder = rows.map(row => row.slice)
  if (JSON.stringify(boardOrder) !== JSON.stringify(WORK_ORDER)) errors.push('WRONG_PRODUCT_WORK_ORDER')

  for (const row of rows) {
    if (!ALLOWED_STATUSES.has(row.status)) errors.push(`INVALID_SLICE_STATUS:${row.slice}:${row.status}`)
  }

  const active = rows.filter(row => row.status === 'ACTIVE')
  if (active.length !== 1) errors.push(`ACTIVE_SLICE_COUNT:${active.length}`)

  const firstIncomplete = rows.find(row => row.status !== 'COMPLETE')
  if (active.length === 1 && firstIncomplete && active[0].slice !== firstIncomplete.slice) {
    errors.push(`WRONG_ACTIVE_SLICE:${active[0].slice}`)
  }

  const activeIndex = rows.findIndex(row => row.status === 'ACTIVE')
  if (activeIndex >= 0) {
    const priorNotComplete = rows.slice(0, activeIndex).find(row => row.status !== 'COMPLETE')
    if (priorNotComplete) errors.push(`PRIOR_SLICE_NOT_COMPLETE:${priorNotComplete.slice}`)
    const laterNotQueued = rows.slice(activeIndex + 1).find(row => row.status !== 'QUEUED')
    if (laterNotQueued) errors.push(`FUTURE_SLICE_NOT_QUEUED:${laterNotQueued.slice}`)
  }

  for (const state of ['ACCEPTED','DEFERRED','UNKNOWN','OWNER_APPROVAL_REQUIRED']) {
    if (!decisions.includes(state)) errors.push(`MISSING_DECISION_STATE:${state}`)
  }

  if (canonical.includes('UNVERIFIABLE == PASS') || decisions.includes('UNVERIFIABLE == PASS')) {
    errors.push('CONTRADICTORY_CANONICAL_ASSERTION:UNVERIFIABLE_PASS')
  }

  return { ok: errors.length === 0, errors }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = verifyContext()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exit(result.ok ? 0 : 1)
}

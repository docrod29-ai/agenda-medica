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

  const active = [...board.matchAll(/\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*ACTIVE\s*\|/g)].map(m => m[1].trim())
  if (active.length !== 1) errors.push(`ACTIVE_SLICE_COUNT:${active.length}`)
  if (active.length === 1 && active[0] !== WORK_ORDER[0]) errors.push(`WRONG_ACTIVE_SLICE:${active[0]}`)

  const boardOrder = [...board.matchAll(/\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*(?:ACTIVE|QUEUED)\s*\|/g)].map(m => m[1].trim())
  if (JSON.stringify(boardOrder) !== JSON.stringify(WORK_ORDER)) errors.push('WRONG_PRODUCT_WORK_ORDER')

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

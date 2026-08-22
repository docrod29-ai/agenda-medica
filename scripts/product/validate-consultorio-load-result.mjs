#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import process from 'node:process'

const [resultPath] = process.argv.slice(2)
if (!resultPath) {
  console.error('usage: node scripts/product/validate-consultorio-load-result.mjs <result.json>')
  process.exit(2)
}

const fail = (message) => {
  console.error(`INVALID CONSULTORIO LOAD EVIDENCE: ${message}`)
  process.exit(1)
}

const assert = (condition, message) => {
  if (!condition) fail(message)
}

const isFiniteNonNegative = (value) => Number.isFinite(value) && value >= 0
const isPositiveInteger = (value) => Number.isInteger(value) && value > 0
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0

let result
try {
  result = JSON.parse(await readFile(resultPath, 'utf8'))
} catch (error) {
  fail(`cannot parse JSON: ${error.message}`)
}

assert(result && typeof result === 'object' && !Array.isArray(result), 'root must be an object')
assert(result.syntheticNonPhi === true, 'syntheticNonPhi must be true')
assert(typeof result.candidateSha === 'string' && /^[0-9a-f]{40}$/i.test(result.candidateSha), 'candidateSha must be an exact 40-character commit SHA')
assert(typeof result.environment === 'string' && result.environment.trim().length > 0, 'environment is required')
assert(typeof result.scenario === 'string' && result.scenario.trim().length > 0, 'scenario is required')
assert(typeof result.seed === 'string' || Number.isInteger(result.seed), 'seed must be a string or integer')
assert(isPositiveInteger(result.registeredPhysicians), 'registeredPhysicians must be a positive integer')
assert(isPositiveInteger(result.concurrentConsultations), 'concurrentConsultations must be a positive integer')
assert(result.concurrentConsultations <= result.registeredPhysicians, 'concurrentConsultations cannot exceed registeredPhysicians')
assert(isPositiveInteger(result.requestCount), 'requestCount must be a positive integer')
assert(isNonNegativeInteger(result.successCount), 'successCount must be a non-negative integer')
assert(isNonNegativeInteger(result.errorCount), 'errorCount must be a non-negative integer')
assert(result.successCount + result.errorCount === result.requestCount, 'successCount + errorCount must equal requestCount')

assert(result.latencyMs && typeof result.latencyMs === 'object', 'latencyMs object is required')
for (const percentile of ['p50', 'p95', 'p99']) {
  assert(isFiniteNonNegative(result.latencyMs[percentile]), `latencyMs.${percentile} must be a finite non-negative number`)
}
assert(result.latencyMs.p50 <= result.latencyMs.p95 && result.latencyMs.p95 <= result.latencyMs.p99, 'latency percentiles must be ordered p50 <= p95 <= p99')

for (const key of [
  'lostDraftCount',
  'blankScreenCount',
  'crossTenantLeakageCount',
  'unboundedReadCount',
  'idempotencyViolationCount',
  'silentProviderFailureCount',
]) {
  assert(isNonNegativeInteger(result[key]), `${key} must be a non-negative integer`)
}

assert(typeof result.durableSavePassed === 'boolean', 'durableSavePassed must be boolean')
assert(typeof result.recoveryPassed === 'boolean', 'recoveryPassed must be boolean')

assert(result.queues && typeof result.queues === 'object', 'queues object is required')
for (const queueName of ['transcription', 'reasoning', 'evidence', 'document']) {
  const queue = result.queues[queueName]
  assert(queue && typeof queue === 'object', `queues.${queueName} is required`)
  assert(isNonNegativeInteger(queue.maxDepth), `queues.${queueName}.maxDepth must be a non-negative integer`)
  assert(isNonNegativeInteger(queue.retryCount), `queues.${queueName}.retryCount must be a non-negative integer`)
  assert(isNonNegativeInteger(queue.duplicateCount), `queues.${queueName}.duplicateCount must be a non-negative integer`)
}

if (result.providerUsage !== undefined) {
  assert(Array.isArray(result.providerUsage), 'providerUsage must be an array when present')
  for (const [index, usage] of result.providerUsage.entries()) {
    assert(usage && typeof usage === 'object', `providerUsage[${index}] must be an object`)
    assert(typeof usage.providerClass === 'string' && usage.providerClass.trim().length > 0, `providerUsage[${index}].providerClass is required`)
    assert(isNonNegativeInteger(usage.invocationCount), `providerUsage[${index}].invocationCount must be a non-negative integer`)
    if (usage.testCost !== undefined) assert(isFiniteNonNegative(usage.testCost), `providerUsage[${index}].testCost must be non-negative when present`)
  }
}

const forbiddenKeyPattern = /(patient.?name|patient.?email|patient.?phone|date.?of.?birth|dob|medical.?record|mrn|address)/i
const inspectKeys = (value, path = '$') => {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectKeys(item, `${path}[${index}]`))
    return
  }
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeyPattern.test(key)) fail(`potential PHI field is forbidden in evidence output: ${path}.${key}`)
    inspectKeys(child, `${path}.${key}`)
  }
}
inspectKeys(result)

const unconditionalBlockers = [
  ['lostDraftCount', result.lostDraftCount],
  ['blankScreenCount', result.blankScreenCount],
  ['crossTenantLeakageCount', result.crossTenantLeakageCount],
  ['unboundedReadCount', result.unboundedReadCount],
  ['idempotencyViolationCount', result.idempotencyViolationCount],
  ['silentProviderFailureCount', result.silentProviderFailureCount],
].filter(([, count]) => count > 0)

const summary = {
  validEvidence: true,
  candidateSha: result.candidateSha,
  scenario: result.scenario,
  concurrentConsultations: result.concurrentConsultations,
  requestCount: result.requestCount,
  latencyMs: result.latencyMs,
  durableSavePassed: result.durableSavePassed,
  recoveryPassed: result.recoveryPassed,
  unconditionalBlockers: unconditionalBlockers.map(([name, count]) => ({ name, count })),
  capacityPassDeclared: false,
  note: 'This validator checks evidence integrity and unconditional blockers only. It does not invent or approve capacity/SLO thresholds.',
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)

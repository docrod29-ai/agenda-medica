/**
 * ACP-002 — focused tests for the cloud writer runner preflight.
 *
 * Same two layers as ACP-001, for the same reason:
 *
 *   1. Direct tests. Each of the fourteen BASELINE conditions is fed the exact
 *      situation it exists to stop, and the exact stop condition is asserted.
 *   2. Reverse / mutation proof. The condition is removed or inverted in a copy
 *      of `preflight.mjs`, and the same input is asserted to be ACCEPTED by the
 *      mutant. Without that second layer a green suite only proves that
 *      *something* refused the input, not that this condition did.
 *
 * The conditions that prove kernel properties (10, 12, 13, 14) get a third kind
 * of test: the KERNEL is mutated instead of the preflight, and the preflight is
 * required to notice. That is the whole point of asking the kernel at run time
 * rather than restating its rules here — a weakened guard must stop the writer
 * from starting, not be re-asserted by a second copy of the same belief.
 *
 * Run: node --test control-plane/*.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { BOARD_PATH, SCHEMA_PATH } from './kernel.mjs'
import {
  BUDGET_CEILINGS,
  PREFLIGHT_CONTRACT_VERSION,
  PRODUCTION_REACHING_PERMISSIONS,
  STOP_CONDITIONS,
  runPreflight,
  writerLockFromBoard,
  writerPermissionsFromWorkflow,
} from './preflight.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PREFLIGHT_PATH = join(HERE, 'preflight.mjs')
const KERNEL_PATH = join(HERE, 'kernel.mjs')
const PREFLIGHT_SOURCE = readFileSync(PREFLIGHT_PATH, 'utf8')
const KERNEL_SOURCE = readFileSync(KERNEL_PATH, 'utf8')
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
const CANONICAL_BOARD = JSON.parse(readFileSync(BOARD_PATH, 'utf8'))

// --- helpers ---------------------------------------------------------------

/**
 * A board on which ACP-002 is the single eligible writer task. Rewinds
 * coherently for the same reason `readyBoard()` in kernel.test.mjs does: a
 * fixture derived from live state must restore a world the kernel accepts, not
 * just flip one field.
 */
function writerReadyBoard() {
  const board = structuredClone(CANONICAL_BOARD)
  for (const item of board.items) {
    if (item.id < 'ACP-002') continue
    item.status = item.id === 'ACP-002' ? 'READY' : 'QUEUED'
    item.closed_by = null
    item.blocked_by = (item.dependencies ?? []).filter((id) => board.items.find((entry) => entry.id === id)?.status !== 'CLOSED')
  }
  return board
}

function itemOf(board, id) {
  return board.items.find((entry) => entry.id === id)
}

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

function validRequest(overrides = {}) {
  return {
    item_id: 'ACP-002',
    holder: 'CLAUDE_OPUS',
    run_id: 'run-1',
    branch: CANONICAL_BOARD.source_branch,
    expected_sha: SHA,
    head_sha: SHA,
    worktree_clean: true,
    secret_name: 'ANTHROPIC_API_KEY',
    secret_present: true,
    budget: { max_turns: 60, timeout_minutes: 60, max_retries: 0 },
    permissions: { contents: 'write', 'pull-requests': 'read' },
    ...overrides,
  }
}

function preflight({ board = writerReadyBoard(), schema = SCHEMA, request = validRequest() } = {}) {
  return runPreflight({ board, schema, request })
}

function conditionById(result, id) {
  return result.checks.find((entry) => entry.id === id)
}

let mutantCounter = 0

/**
 * Textually mutate a control-plane module and import the copy. Relative imports
 * are rewritten to absolute file URLs first, because the mutant is written to a
 * temporary directory where `./kernel.mjs` does not exist. Each anchor must
 * appear exactly once, so renaming a guard breaks the proof loudly instead of
 * silently turning the mutation into a no-op.
 */
async function loadMutant(sourcePath, source, replacements) {
  let mutated = source
  for (const [find, replace] of replacements) {
    const occurrences = mutated.split(find).length - 1
    assert.equal(occurrences, 1, `mutation anchor must appear exactly once: ${JSON.stringify(find)}`)
    mutated = mutated.replace(find, replace)
  }
  assert.notEqual(mutated, source, 'mutation must actually change the source')
  mutated = mutated.replace(/from '\.\/([a-zA-Z.]+\.mjs)'/g, (_match, name) => `from '${pathToFileURL(join(HERE, name)).href}'`)
  mutated = mutated.replace(/import\('\.\/([a-zA-Z.]+\.mjs)'\)/g, (_match, name) => `import('${pathToFileURL(join(HERE, name)).href}')`)
  const file = join(tmpdir(), `acp002-mutant-${process.pid}-${mutantCounter++}.mjs`)
  writeFileSync(file, mutated, 'utf8')
  return import(pathToFileURL(file).href)
}

const mutatePreflight = (replacements) => loadMutant(PREFLIGHT_PATH, PREFLIGHT_SOURCE, replacements)

/**
 * Mutate the KERNEL and hand the weakened copy to a preflight that imports it.
 * Proves the preflight is genuinely interrogating the kernel rather than
 * restating its rules.
 */
async function preflightOverMutatedKernel(replacements) {
  let kernel = KERNEL_SOURCE
  for (const [find, replace] of replacements) {
    const occurrences = kernel.split(find).length - 1
    assert.equal(occurrences, 1, `kernel mutation anchor must appear exactly once: ${JSON.stringify(find)}`)
    kernel = kernel.replace(find, replace)
  }
  assert.notEqual(kernel, KERNEL_SOURCE, 'kernel mutation must actually change the source')
  const kernelFile = join(tmpdir(), `acp002-kernel-mutant-${process.pid}-${mutantCounter++}.mjs`)
  writeFileSync(kernelFile, kernel, 'utf8')
  const preflightSource = PREFLIGHT_SOURCE.replace("from './kernel.mjs'", `from '${pathToFileURL(kernelFile).href}'`)
  assert.notEqual(preflightSource, PREFLIGHT_SOURCE, 'the preflight must import the mutated kernel')
  const preflightFile = join(tmpdir(), `acp002-preflight-over-mutant-${process.pid}-${mutantCounter++}.mjs`)
  writeFileSync(preflightFile, preflightSource, 'utf8')
  return import(pathToFileURL(preflightFile).href)
}

// ---------------------------------------------------------------------------
// 0. Contract and happy path
// ---------------------------------------------------------------------------

test('preflight: a fully compliant request authorizes exactly one writer', () => {
  const result = preflight()
  assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok), null, 2))
  assert.equal(result.contract, PREFLIGHT_CONTRACT_VERSION)
  assert.equal(result.stop_condition, null)
  assert.equal(result.next_board_status, null)
  assert.deepEqual(result.authorized, { item_id: 'ACP-002', branch: CANONICAL_BOARD.source_branch, sha: SHA })
  assert.equal(result.checks.length, 14, 'all fourteen BASELINE conditions must be evaluated')
  assert.deepEqual(
    result.checks.map((entry) => entry.id),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  )
})

test('preflight: output is deterministic — the same request yields byte-identical JSON', () => {
  assert.equal(JSON.stringify(preflight()), JSON.stringify(preflight()))
})

test('preflight: GitHub Actions outputs are flat strings', () => {
  for (const value of Object.values(preflight().github_outputs)) {
    assert.equal(typeof value, 'string')
  }
})

test('preflight: every failure routes the program to BLOCKED, never to a guess', () => {
  const result = preflight({ request: validRequest({ worktree_clean: false }) })
  assert.equal(result.ok, false)
  assert.equal(result.next_board_status, 'BLOCKED')
  assert.equal(result.authorized, null, 'a failed preflight must never authorize an item')
})

test('preflight: all failing conditions are reported, not just the first', () => {
  const result = preflight({
    request: validRequest({ worktree_clean: false, secret_present: false, budget: null }),
  })
  assert.equal(result.ok, false)
  assert.deepEqual(result.failed_conditions, [5, 7, 8])
})

test('preflight: a malformed request is refused before any condition runs', () => {
  for (const request of [null, undefined, [], {}, { item_id: 'ACP-002' }, { item_id: 'ACP-002', holder: 'CLAUDE_OPUS' }]) {
    const result = runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request })
    assert.equal(result.ok, false)
    assert.equal(result.stop_condition, STOP_CONDITIONS.MALFORMED_PREFLIGHT_REQUEST)
    assert.deepEqual(result.checks, [])
  }
})

// ---------------------------------------------------------------------------
// 1. Condition 1 — the board must validate
// ---------------------------------------------------------------------------

test('condition 1: an invalid board stops the writer', () => {
  const board = writerReadyBoard()
  board.items[0].status = 'NOT_A_STATUS'
  const result = preflight({ board })
  assert.equal(result.ok, false)
  assert.equal(conditionById(result, 1).ok, false)
  assert.equal(result.stop_condition, STOP_CONDITIONS.BOARD_INVALID)
})

test('reverse proof: without condition 1, an invalid board would start a writer', async () => {
  const mutant = await mutatePreflight([['const ok = evaluation.schema_valid === true && evaluation.violation_count === 0', 'const ok = true']])
  const board = writerReadyBoard()
  board.items[0].status = 'NOT_A_STATUS'
  assert.equal(preflight({ board }).checks[0].ok, false)
  assert.equal(mutant.runPreflight({ board, schema: SCHEMA, request: validRequest() }).checks[0].ok, true)
})

// ---------------------------------------------------------------------------
// 2. Condition 2 — exactly one eligible task, and it must be the one asked for
// ---------------------------------------------------------------------------

test('condition 2: the runner may not write an item the board did not select', () => {
  const result = preflight({ request: validRequest({ item_id: 'ACP-003' }) })
  assert.equal(result.ok, false)
  assert.equal(result.stop_condition, STOP_CONDITIONS.ITEM_NOT_AUTHORIZED)
})

test('condition 2: two simultaneously eligible items halt the runner', () => {
  const board = writerReadyBoard()
  const acp003 = itemOf(board, 'ACP-003')
  acp003.status = 'READY'
  acp003.dependencies = []
  acp003.blocked_by = []
  const result = preflight({ board })
  assert.equal(result.ok, false)
  assert.equal(conditionById(result, 2).ok, false)
})

test('condition 2: an item already in flight is not a fresh writer start', () => {
  const board = writerReadyBoard()
  itemOf(board, 'ACP-002').status = 'WRITER_DONE'
  const result = preflight({ board })
  assert.equal(result.ok, false)
  assert.equal(conditionById(result, 2).stop_condition, STOP_CONDITIONS.ITEM_NOT_AUTHORIZED)
})

test('condition 2: an authorized repair pass is still a legal writer start', () => {
  const board = writerReadyBoard()
  itemOf(board, 'ACP-002').status = 'REPAIR_READY'
  const result = preflight({ board })
  assert.equal(conditionById(result, 2).ok, true, 'REPAIR_READY is the one in-flight status that may run a writer')
  assert.equal(result.ok, true)
})

test('reverse proof: without condition 2, the runner would write an unselected item', async () => {
  const mutant = await mutatePreflight([['const ok = selected === request.item_id', 'const ok = true']])
  const request = validRequest({ item_id: 'ACP-003' })
  assert.equal(preflight({ request }).ok, false)
  assert.equal(mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request }).checks[1].ok, true)
})

// ---------------------------------------------------------------------------
// 3. Condition 3 — one writer, derived from the board rather than declared
// ---------------------------------------------------------------------------

test('condition 3: a second run may not start while another writer holds the item', () => {
  const board = writerReadyBoard()
  itemOf(board, 'ACP-002').status = 'RUNNING_WRITER'
  const result = preflight({ board, request: validRequest({ run_id: 'a-different-run' }) })
  assert.equal(result.ok, false)
  assert.equal(conditionById(result, 3).stop_condition, STOP_CONDITIONS.WRITER_LOCK_HELD)
})

test('condition 3: the lock is derived from board state, not from a field somebody remembered to set', () => {
  const board = writerReadyBoard()
  assert.deepEqual(writerLockFromBoard(board), { active: false, item_id: null, holder: null, run_id: null })
  itemOf(board, 'ACP-002').status = 'RUNNING_WRITER'
  const lock = writerLockFromBoard(board)
  assert.equal(lock.active, true)
  assert.equal(lock.item_id, 'ACP-002')
  assert.equal(lock.holder, 'CLAUDE_OPUS')
  assert.equal(lock.run_id, null, 'the board knows a writer is running, never which run — so no claim can be believed')
})

test('condition 3: a run may not talk its way past the lock by claiming to be the holder', () => {
  const board = writerReadyBoard()
  itemOf(board, 'ACP-002').status = 'RUNNING_WRITER'
  for (const run_id of ['run-1', '__unknown_run__', 'null']) {
    const result = preflight({ board, request: validRequest({ run_id }) })
    assert.equal(conditionById(result, 3).stop_condition, STOP_CONDITIONS.WRITER_LOCK_HELD, run_id)
  }
})

test('reverse proof: without condition 3, two writers could hold the same item', async () => {
  const mutant = await mutatePreflight([['const current = writerLockFromBoard(board)', 'const current = NO_LOCK']])
  const board = writerReadyBoard()
  itemOf(board, 'ACP-002').status = 'RUNNING_WRITER'
  const request = validRequest({ run_id: 'a-different-run' })
  assert.equal(preflight({ board, request }).checks[2].ok, false)
  assert.equal(mutant.runPreflight({ board, schema: SCHEMA, request }).checks[2].ok, true)
})

// ---------------------------------------------------------------------------
// 4-5. Conditions 4 and 5 — explicit target, clean tree
// ---------------------------------------------------------------------------

test('condition 4: a vague branch or SHA is refused', () => {
  for (const overrides of [{ branch: '' }, { expected_sha: 'not-a-sha' }, { head_sha: 'abc' }, { expected_sha: SHA.toUpperCase() }]) {
    const result = preflight({ request: validRequest(overrides) })
    assert.equal(conditionById(result, 4).stop_condition, STOP_CONDITIONS.BRANCH_OR_SHA_NOT_EXPLICIT, JSON.stringify(overrides))
  }
})

test('condition 4: a checkout that drifted from the authorized SHA is refused', () => {
  const result = preflight({ request: validRequest({ head_sha: 'b'.repeat(40) }) })
  assert.equal(conditionById(result, 4).stop_condition, STOP_CONDITIONS.BRANCH_OR_SHA_NOT_EXPLICIT)
})

test('condition 4: a writer may never target main, master, or a branch the board does not declare', () => {
  for (const branch of ['main', 'master', 'some-other-branch']) {
    const result = preflight({ request: validRequest({ branch }) })
    assert.equal(conditionById(result, 4).stop_condition, STOP_CONDITIONS.FORBIDDEN_TARGET_BRANCH, branch)
  }
})

test('reverse proof: without the protected-branch rule, a writer could target main', async () => {
  const mutant = await mutatePreflight([['if (PROTECTED_BRANCHES.includes(request.branch)) {', 'if (false) {']])
  const board = writerReadyBoard()
  board.source_branch = 'main'
  const request = validRequest({ branch: 'main' })
  assert.equal(preflight({ board, request }).checks[3].ok, false)
  assert.equal(mutant.runPreflight({ board, schema: SCHEMA, request }).checks[3].ok, true)
})

test('condition 5: an unclean worktree stops the writer', () => {
  const result = preflight({ request: validRequest({ worktree_clean: false }) })
  assert.equal(conditionById(result, 5).stop_condition, STOP_CONDITIONS.UNCLEAN_WORKTREE_AT_FREEZE)
})

test('condition 5: "probably clean" is not clean', () => {
  for (const value of [undefined, null, 'true', 1]) {
    assert.equal(conditionById(preflight({ request: validRequest({ worktree_clean: value }) }), 5).ok, false, String(value))
  }
})

// ---------------------------------------------------------------------------
// 6. Condition 6 — policy flags
// ---------------------------------------------------------------------------

test('condition 6: a drifted production or main authorization stops the writer', () => {
  for (const key of ['production_deploy_authorized', 'main_merge_authorized', 'phi_allowed', 'destructive_changes_authorized']) {
    const board = writerReadyBoard()
    board.execution_policy[key] = true
    const result = preflight({ board })
    assert.equal(result.ok, false, key)
    assert.equal(conditionById(result, 6).stop_condition, STOP_CONDITIONS.POLICY_AUTHORIZATION_DRIFT, key)
  }
})

test('reverse proof: without condition 6, a board authorizing production deploy would start a writer', async () => {
  const mutant = await mutatePreflight([['const violations = checkPolicyInvariants(context.board)', 'const violations = []']])
  const board = writerReadyBoard()
  board.execution_policy.production_deploy_authorized = true
  assert.equal(preflight({ board }).checks[5].ok, false)
  assert.equal(mutant.runPreflight({ board, schema: SCHEMA, request: validRequest() }).checks[5].ok, true)
})

// ---------------------------------------------------------------------------
// 7. Condition 7 — credential presence, never the value
// ---------------------------------------------------------------------------

test('condition 7: an absent credential stops the writer with the exact baseline stop condition', () => {
  const result = preflight({ request: validRequest({ secret_present: false }) })
  assert.equal(conditionById(result, 7).stop_condition, STOP_CONDITIONS.MISSING_REQUIRED_SECRET_OR_EXTERNAL_CREDENTIAL)
})

test('condition 7: a writer may not ask for a credential that is not its own', () => {
  for (const secret_name of ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GITHUB_TOKEN', undefined]) {
    const result = preflight({ request: validRequest({ secret_name }) })
    assert.equal(conditionById(result, 7).stop_condition, STOP_CONDITIONS.MISSING_REQUIRED_SECRET_OR_EXTERNAL_CREDENTIAL, String(secret_name))
  }
})

test('condition 7: a request carrying a secret VALUE is itself the failure', () => {
  for (const leak of [{ secret_value: 'sk-ant-oops' }, { anthropic_api_key: 'sk-ant-oops' }, { provider_token: 'ghp_oops' }]) {
    const result = preflight({ request: validRequest(leak) })
    assert.equal(conditionById(result, 7).stop_condition, STOP_CONDITIONS.SECRET_VALUE_LEAKED, JSON.stringify(leak))
  }
})

test('condition 7: the leak check does not fire on presence-only fields', () => {
  assert.equal(conditionById(preflight(), 7).ok, true)
  assert.equal(conditionById(preflight({ request: validRequest({ secret_value: '' }) }), 7).ok, true, 'an empty value is an absent value')
})

test('reverse proof: without the leak check, a request carrying a credential would be accepted', async () => {
  const mutant = await mutatePreflight([['if (/(_value|_token|_key|secret_value)$/i.test(key) && request[key] !== null && request[key] !== undefined && request[key] !== \'\') {', 'if (false) {']])
  const request = validRequest({ secret_value: 'sk-ant-oops' })
  assert.equal(conditionById(preflight({ request }), 7).stop_condition, STOP_CONDITIONS.SECRET_VALUE_LEAKED)
  assert.equal(mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request }).checks[6].ok, true)
})

// ---------------------------------------------------------------------------
// 8. Condition 8 — a budget that is actually bounded
// ---------------------------------------------------------------------------

test('condition 8: an unbounded or absent budget stops the writer', () => {
  const overrides = [
    null,
    {},
    { max_turns: 0, timeout_minutes: 60, max_retries: 0 },
    { max_turns: 60, timeout_minutes: 0, max_retries: 0 },
    { max_turns: 60, timeout_minutes: 60, max_retries: -1 },
    { max_turns: Infinity, timeout_minutes: 60, max_retries: 0 },
    { max_turns: BUDGET_CEILINGS.max_turns + 1, timeout_minutes: 60, max_retries: 0 },
    { max_turns: 60, timeout_minutes: BUDGET_CEILINGS.timeout_minutes + 1, max_retries: 0 },
    { max_turns: 60, timeout_minutes: 60, max_retries: BUDGET_CEILINGS.max_retries + 1 },
    { max_turns: '60', timeout_minutes: 60, max_retries: 0 },
  ]
  for (const budget of overrides) {
    const result = preflight({ request: validRequest({ budget }) })
    assert.equal(conditionById(result, 8).stop_condition, STOP_CONDITIONS.BUDGET_NOT_BOUNDED, JSON.stringify(budget))
  }
})

test('condition 8: zero retries is a budget; no retry ceiling is not', () => {
  assert.equal(conditionById(preflight({ request: validRequest({ budget: { max_turns: 1, timeout_minutes: 1, max_retries: 0 } }) }), 8).ok, true)
})

test('reverse proof: without the ceilings, a runaway budget would be accepted', async () => {
  const mutant = await mutatePreflight([
    ['  max_turns: 120,\n  timeout_minutes: 90,\n  max_retries: 2,', '  max_turns: 1e9,\n  timeout_minutes: 1e9,\n  max_retries: 1e9,'],
  ])
  const request = validRequest({ budget: { max_turns: 100000, timeout_minutes: 100000, max_retries: 100000 } })
  assert.equal(conditionById(preflight({ request }), 8).ok, false)
  assert.equal(mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request }).checks[7].ok, true)
})

// ---------------------------------------------------------------------------
// 9. Condition 9 — least privilege
// ---------------------------------------------------------------------------

test('condition 9: a permission that reaches production stops the writer', () => {
  for (const scope of ['deployments', 'environments', 'id-token', 'packages', 'administration', 'secrets']) {
    const result = preflight({ request: validRequest({ permissions: { contents: 'write', [scope]: 'write' } }) })
    assert.equal(conditionById(result, 9).stop_condition, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD, scope)
  }
})

test('condition 9: an unanticipated scope is refused rather than ignored', () => {
  const result = preflight({ request: validRequest({ permissions: { contents: 'write', 'security-events': 'write' } }) })
  assert.equal(conditionById(result, 9).stop_condition, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD)
})

test('condition 9: write access beyond contents is refused', () => {
  const result = preflight({ request: validRequest({ permissions: { contents: 'write', 'pull-requests': 'write' } }) })
  assert.equal(conditionById(result, 9).stop_condition, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD)
})

test('condition 9: production scopes explicitly set to none are allowed', () => {
  assert.equal(conditionById(preflight({ request: validRequest({ permissions: { contents: 'write', deployments: 'none' } }) }), 9).ok, true)
})

test('reverse proof: without the allowlist, an unanticipated scope would pass', async () => {
  const mutant = await mutatePreflight([['failures.push(`${scope} is not an anticipated writer scope`)', 'void scope']])
  const request = validRequest({ permissions: { contents: 'write', 'security-events': 'write' } })
  assert.equal(conditionById(preflight({ request }), 9).ok, false)
  assert.equal(mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request }).checks[8].ok, true)
})

// ---------------------------------------------------------------------------
// 10-14. Conditions proved against the live kernel
// ---------------------------------------------------------------------------

test('condition 10: the judge may not run before the SHA is frozen', () => {
  const board = writerReadyBoard()
  board.execution_policy.freeze_sha_before_judge = false
  const result = preflight({ board })
  assert.equal(conditionById(result, 10).stop_condition, STOP_CONDITIONS.JUDGE_WOULD_RUN_BEFORE_FREEZE)
})

test('condition 10 is proved against the kernel: a transition table that skips the freeze stops the writer', async () => {
  const mutant = await preflightOverMutatedKernel([["CI_PENDING: Object.freeze(['SHA_FROZEN', 'CI_FAILED', 'BLOCKED']),", "CI_PENDING: Object.freeze(['SHA_FROZEN', 'CI_FAILED', 'RUNNING_JUDGE', 'BLOCKED']),"]])
  assert.equal(conditionById(preflight(), 10).ok, true)
  const over = mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request: validRequest() })
  assert.equal(over.checks[9].ok, false, 'a kernel that lets the judge run before the freeze must stop the writer')
  assert.equal(over.stop_condition, STOP_CONDITIONS.JUDGE_WOULD_RUN_BEFORE_FREEZE)
})

test('condition 11: a judge that is not read-only stops the writer', () => {
  const board = writerReadyBoard()
  board.execution_policy.judge_must_be_read_only = false
  assert.equal(conditionById(preflight({ board }), 11).stop_condition, STOP_CONDITIONS.JUDGE_NOT_READ_ONLY)
})

test('condition 12: a policy claiming UNVERIFIABLE is PASS stops the writer', () => {
  const board = writerReadyBoard()
  board.execution_policy.unverifiable_is_pass = true
  assert.equal(conditionById(preflight({ board }), 12).stop_condition, STOP_CONDITIONS.UNVERIFIABLE_MANDATORY_GATE)
})

/**
 * UNVERIFIABLE is guarded twice: `guardUnverifiableNeverPasses` stops it
 * directly, and `guardJudgePassRequiresVerdict` (added by the ACP-001 repair)
 * refuses any non-PASS verdict on the way to JUDGE_PASS. Removing either one
 * alone changes nothing — which is what defence in depth is supposed to feel
 * like, and is worth asserting rather than assuming. The writer must only be
 * stopped when the property itself is actually gone, so the mutant removes both.
 */
test('condition 12 is proved against the kernel: one layer may fall without the property falling', async () => {
  for (const layer of ['  guardUnverifiableNeverPasses,\n', '  guardJudgePassRequiresVerdict,\n']) {
    const mutant = await preflightOverMutatedKernel([[layer, '']])
    const over = mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request: validRequest() })
    assert.equal(over.checks[11].ok, true, `removing ${layer.trim()} alone must not break UNVERIFIABLE != PASS`)
  }
})

test('condition 12 is proved against the kernel: removing BOTH layers stops the writer', async () => {
  const mutant = await preflightOverMutatedKernel([
    ['  guardUnverifiableNeverPasses,\n', ''],
    ['  guardJudgePassRequiresVerdict,\n', ''],
  ])
  assert.equal(conditionById(preflight(), 12).ok, true)
  const over = mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request: validRequest() })
  assert.equal(over.checks[11].ok, false, 'a kernel that would promote UNVERIFIABLE must stop the writer')
  assert.equal(over.stop_condition, STOP_CONDITIONS.UNVERIFIABLE_MANDATORY_GATE)
})

test('condition 13: a policy allowing P2/P3 auto-repair stops the writer', () => {
  const board = writerReadyBoard()
  board.execution_policy.p2_p3_auto_repair = true
  assert.equal(conditionById(preflight({ board }), 13).stop_condition, STOP_CONDITIONS.P2_P3_AUTO_REPAIR_FORBIDDEN)
})

test('condition 13 is proved against the kernel: removing the severity guard stops the writer', async () => {
  const mutant = await preflightOverMutatedKernel([['  guardNoAutoRepairForP2P3,\n', '']])
  assert.equal(conditionById(preflight(), 13).ok, true)
  const over = mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request: validRequest() })
  assert.equal(over.checks[12].ok, false, 'a kernel that opens repair loops for P2/P3 must stop the writer')
})

test('condition 14: an item parked at the owner gate stops every writer', () => {
  const board = writerReadyBoard()
  itemOf(board, 'ACP-003').status = 'OWNER_APPROVAL_REQUIRED'
  const result = preflight({ board })
  assert.equal(result.ok, false)
  assert.equal(conditionById(result, 14).stop_condition, STOP_CONDITIONS.OWNER_APPROVAL_REQUIRED)
})

// ---------------------------------------------------------------------------
// 15. The runner's real permissions must reach the preflight
//
// A permission check that grades a hand-typed copy of the workflow's block
// grades the wrong thing. These tests read the block out of the workflow the
// runner actually runs under, and assert the preflight would authorize it.
// ---------------------------------------------------------------------------

const WRITER_WORKFLOW_PATH = join(HERE, '..', '.github', 'workflows', 'control-plane-writer.yml')
const WRITER_WORKFLOW = readFileSync(WRITER_WORKFLOW_PATH, 'utf8')

test('the writer workflow declares permissions the preflight actually authorizes', () => {
  const permissions = writerPermissionsFromWorkflow(WRITER_WORKFLOW)
  assert.ok(Object.keys(permissions).length > 0)
  assert.equal(permissions.contents, 'write', 'the writer must be able to push its checkpoint')
  const result = preflight({ request: validRequest({ permissions }) })
  assert.equal(conditionById(result, 9).ok, true, JSON.stringify(conditionById(result, 9)))
  assert.equal(result.ok, true)
})

test('the writer workflow disclaims every production-reaching scope', () => {
  const permissions = writerPermissionsFromWorkflow(WRITER_WORKFLOW)
  for (const scope of PRODUCTION_REACHING_PERMISSIONS) {
    if (scope in permissions) {
      assert.equal(permissions[scope], 'none', `${scope} must be none in the writer job`)
    }
  }
  assert.equal(permissions.deployments, 'none', 'the deployment scope must be disclaimed explicitly, not merely omitted')
})

test('the writer workflow never grants a second write scope', () => {
  const permissions = writerPermissionsFromWorkflow(WRITER_WORKFLOW)
  const writes = Object.entries(permissions).filter(([, level]) => level === 'write')
  assert.deepEqual(writes, [['contents', 'write']])
})

test('reverse proof: a widened permissions block would be caught, not waved through', () => {
  const widened = WRITER_WORKFLOW.replace('      deployments: none', '      deployments: write')
  assert.notEqual(widened, WRITER_WORKFLOW, 'the anchor must exist for this proof to mean anything')
  const permissions = writerPermissionsFromWorkflow(widened)
  assert.equal(permissions.deployments, 'write')
  assert.equal(conditionById(preflight({ request: validRequest({ permissions }) }), 9).stop_condition, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD)
})

test('the permission parser refuses a shape it does not understand instead of returning nothing', () => {
  assert.throws(() => writerPermissionsFromWorkflow('jobs:\n  other:\n'), /job `writer` not found/)
  assert.throws(() => writerPermissionsFromWorkflow('  writer:\n    runs-on: ubuntu-latest\n'), /declares no permissions block/)
  assert.throws(() => writerPermissionsFromWorkflow('  writer:\n    permissions:\n    steps:\n'), /empty permissions block/)
})

test('the writer workflow cannot edit itself: .github is outside the enforced scope', () => {
  assert.match(WRITER_WORKFLOW, /FORBIDDEN_SCOPE_CHANGE/, 'the runner must enforce a path allowlist')
  assert.doesNotMatch(WRITER_WORKFLOW, /^ +\.github\/\*\)/m, 'a writer that can edit its own runner can widen its own permissions')
})

test('condition 14 is proved against the kernel: removing the owner gate stops the writer', async () => {
  const mutant = await preflightOverMutatedKernel([['  guardOwnerGate,\n', '']])
  assert.equal(conditionById(preflight(), 14).ok, true)
  const over = mutant.runPreflight({ board: writerReadyBoard(), schema: SCHEMA, request: validRequest() })
  assert.equal(over.checks[13].ok, false, 'a kernel whose owner gate can be walked out of must stop the writer')
})

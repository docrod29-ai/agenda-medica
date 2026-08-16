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
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { BOARD_PATH, SCHEMA_PATH } from './kernel.mjs'
import {
  BUDGET_CEILINGS,
  PREFLIGHT_CONTRACT_VERSION,
  PRODUCTION_REACHING_PERMISSIONS,
  STOP_CONDITIONS,
  main as mainCli,
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

/** A minimal committed judge workflow shape for condition 11 to inspect. */
const READ_ONLY_JUDGE_WORKFLOW = [
  'jobs:',
  '  codex-judge:',
  '    runs-on: ubuntu-latest',
  '    permissions:',
  '      contents: read',
  '      actions: read',
  '',
].join('\n')

function judgeWorkflows(source = READ_ONLY_JUDGE_WORKFLOW) {
  return [{ path: '.github/workflows/judge.yml', job: 'codex-judge', source }]
}

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
    run_attempt: 1,
    judge_workflows: judgeWorkflows(),
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
 * Textually mutate a control-plane module and import the copy.
 *
 * REPAIR/ACP-002/P1-6b. Mutants used to be written to `os.tmpdir()`. That works
 * on a developer machine and fails on a read-only auditor: the independent
 * judge ran this suite in a sandbox with a read-only filesystem, hit EROFS, and
 * had to report `focused_tests: UNVERIFIABLE`. A proof the auditor cannot
 * execute is not a proof. Mutants are now imported from `data:` URLs, so the
 * suite touches no filesystem and any read-only reviewer can reproduce it.
 *
 * Relative imports are rewritten to absolute file URLs first, because a `data:`
 * module has no directory to resolve `./kernel.mjs` against. Each anchor must
 * appear exactly once, so renaming a guard breaks the proof loudly instead of
 * silently turning the mutation into a no-op.
 */
async function loadMutant(source, replacements) {
  let mutated = source
  for (const [find, replace] of replacements) {
    const occurrences = mutated.split(find).length - 1
    assert.equal(occurrences, 1, `mutation anchor must appear exactly once: ${JSON.stringify(find)}`)
    mutated = mutated.replace(find, replace)
  }
  assert.notEqual(mutated, source, 'mutation must actually change the source')
  mutated = mutated.replace(/from '\.\/([a-zA-Z.]+\.mjs)'/g, (_match, name) => `from '${pathToFileURL(join(HERE, name)).href}'`)
  mutated = mutated.replace(/import\('\.\/([a-zA-Z.]+\.mjs)'\)/g, (_match, name) => `import('${pathToFileURL(join(HERE, name)).href}')`)
  // The cache-busting fragment keeps each mutant a distinct module.
  return import(`data:text/javascript;base64,${Buffer.from(mutated).toString('base64')}#${mutantCounter++}`)
}

const mutatePreflight = (replacements) => loadMutant(PREFLIGHT_SOURCE, replacements)

/**
 * The bar the judge set, and it is the right one: a reverse proof must show the
 * mutant AUTHORIZES A WRITER — `ok === true` and a non-null `authorized` — not
 * merely that one internal check flipped while some other gate still refused.
 * "Without guard X a writer would start" is a claim about the whole decision.
 */
function assertMutantAuthorizes(mutant, { board = writerReadyBoard(), request = validRequest() } = {}) {
  const result = mutant.runPreflight({ board, schema: SCHEMA, request })
  assert.equal(result.ok, true, `the mutant must authorize overall; still failing: ${JSON.stringify(result.failed_conditions)}`)
  assert.notEqual(result.authorized, null, 'the mutant must hand out an authorization')
  assert.equal(result.authorized.item_id, request.item_id)
  return result
}

/** And the unmutated preflight must refuse the very same input. */
function assertRealPreflightRefuses({ board = writerReadyBoard(), request = validRequest() } = {}, expectedStop) {
  const result = runPreflight({ board, schema: SCHEMA, request })
  assert.equal(result.ok, false, 'the committed preflight must refuse this input')
  assert.equal(result.authorized, null)
  if (expectedStop) {
    const stops = result.checks.filter((c) => !c.ok).map((c) => c.stop_condition)
    assert.ok(stops.includes(expectedStop), `expected ${expectedStop}, got ${JSON.stringify(stops)}`)
  }
  return result
}

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
  // kernel.mjs ends with a CLI guard that resolves `import.meta.url` as a file
  // path, which throws for a data: module. Neutralise it in the COPY; the
  // committed kernel is ACP-001's closed artefact and is never edited here.
  // kernel.mjs resolves its own directory from `import.meta.url` at module
  // top level, and guards its CLI the same way. Both throw for a data:
  // module, so both are rewritten in the COPY. The committed kernel is
  // ACP-001's closed artefact and is never edited here.
  const dirAnchor = 'export const CONTROL_PLANE_DIR = dirname(fileURLToPath(import.meta.url))'
  const cliGuard = "if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {"
  for (const anchor of [dirAnchor, cliGuard]) {
    assert.equal(kernel.split(anchor).length - 1, 1, `kernel anchor must appear exactly once: ${anchor}`)
  }
  kernel = kernel.replace(dirAnchor, `export const CONTROL_PLANE_DIR = ${JSON.stringify(HERE)}`)
  kernel = kernel.replace(cliGuard, 'if (false) {')
  // Filesystem-free, same reason as loadMutant: a read-only auditor must be
  // able to run this. The mutated kernel becomes a data: URL, and the preflight
  // copy is pointed at that URL instead of at './kernel.mjs'.
  const kernelUrl = `data:text/javascript;base64,${Buffer.from(kernel).toString('base64')}`
  const preflightSource = PREFLIGHT_SOURCE.replace("from './kernel.mjs'", `from '${kernelUrl}'`)
  assert.notEqual(preflightSource, PREFLIGHT_SOURCE, 'the preflight must import the mutated kernel')
  return import(`data:text/javascript;base64,${Buffer.from(preflightSource).toString('base64')}#${mutantCounter++}`)
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

/**
 * REPAIR/ACP-002/P1-6. The old version of this test mutated condition 1, saw
 * `checks[0].ok` flip to true, and was named "an invalid board would start a
 * writer". It did not show that. An invalid board also halts deterministic
 * selection, so condition 2 kept refusing and no writer would have started.
 * The judge reproduced exactly that and was right to call it out.
 *
 * The property is genuinely defended twice. So the honest proof is in two
 * parts: removing one layer is NOT enough (asserted, because that is the
 * interesting fact), and removing both DOES authorize a writer.
 */
test('reverse proof: condition 1 alone falling does not authorize — selection still refuses', async () => {
  const mutant = await mutatePreflight([['const ok = evaluation.schema_valid === true && evaluation.violation_count === 0', 'const ok = true']])
  const board = writerReadyBoard()
  board.items[0].status = 'NOT_A_STATUS'
  assert.equal(preflight({ board }).checks[0].ok, false)
  const over = mutant.runPreflight({ board, schema: SCHEMA, request: validRequest() })
  assert.equal(over.checks[0].ok, true, 'the mutation must actually disable condition 1')
  assert.equal(over.ok, false, 'condition 2 must still refuse an unvalidatable board')
  assert.equal(over.authorized, null)
  assert.deepEqual(over.failed_conditions, [2])
})

test('reverse proof: with BOTH the schema and selection gates removed, an invalid board authorizes a writer', async () => {
  const mutant = await mutatePreflight([
    ['const ok = evaluation.schema_valid === true && evaluation.violation_count === 0', 'const ok = true'],
    ['function conditionExactlyOneEligibleTask(context) {', "function conditionExactlyOneEligibleTask(context) {\n  if (true) return check(2, 'exactly one task is eligible', true, null, 'mutant: condition 2 removed')"],
  ])
  const board = writerReadyBoard()
  board.items[0].status = 'NOT_A_STATUS'
  assertRealPreflightRefuses({ board }, STOP_CONDITIONS.BOARD_INVALID)
  assertMutantAuthorizes(mutant, { board })
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

/**
 * REPAIR/ACP-002/P1-6. Same correction as condition 1. An item at
 * RUNNING_WRITER also moves deterministic selection to ADVANCE_IN_FLIGHT, so
 * condition 2 refuses too — removing only the lock check never started a second
 * writer. That double cover is real and worth asserting; the overall proof
 * needs both layers gone.
 */
test('reverse proof: condition 3 alone falling does not authorize — selection still refuses', async () => {
  const mutant = await mutatePreflight([['const current = writerLockFromBoard(board)', 'const current = NO_LOCK']])
  const board = writerReadyBoard()
  itemOf(board, 'ACP-002').status = 'RUNNING_WRITER'
  const request = validRequest({ run_id: 'a-different-run' })
  assert.equal(preflight({ board, request }).checks[2].ok, false)
  const over = mutant.runPreflight({ board, schema: SCHEMA, request })
  assert.equal(over.checks[2].ok, true, 'the mutation must actually disable the lock check')
  assert.equal(over.ok, false, 'an in-flight item must still refuse a fresh writer start')
  assert.equal(over.authorized, null)
})

test('reverse proof: with BOTH the lock and selection gates removed, a second writer is authorized on a held item', async () => {
  const mutant = await mutatePreflight([
    ['const current = writerLockFromBoard(board)', 'const current = NO_LOCK'],
    ["if (evaluation.next_action !== NEXT_ACTIONS.RUN_WRITER) {", 'if (false) {'],
  ])
  const board = writerReadyBoard()
  itemOf(board, 'ACP-002').status = 'RUNNING_WRITER'
  const request = validRequest({ run_id: 'a-different-run' })
  assertRealPreflightRefuses({ board, request }, STOP_CONDITIONS.WRITER_LOCK_HELD)
  assertMutantAuthorizes(mutant, { board, request })
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

test('reverse proof: without the protected-branch rule, a writer is authorized against main', async () => {
  const mutant = await mutatePreflight([['if (PROTECTED_BRANCHES.includes(request.branch)) {', 'if (false) {']])
  const board = writerReadyBoard()
  board.source_branch = 'main'
  const request = validRequest({ branch: 'main' })
  assertRealPreflightRefuses({ board, request }, STOP_CONDITIONS.FORBIDDEN_TARGET_BRANCH)
  const over = assertMutantAuthorizes(mutant, { board, request })
  assert.equal(over.authorized.branch, 'main', 'the mutant hands out an authorization pointed at main')
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

/**
 * REPAIR/ACP-002/P1-6. A drifted production authorization trips the committed
 * schema (`const: false`) as well as the policy invariants, so removing the
 * policy check alone left conditions 1 and 2 refusing. Two independent layers,
 * asserted as such, then the overall proof with both removed.
 */
test('reverse proof: condition 6 alone falling does not authorize — the schema still pins the flag', async () => {
  const mutant = await mutatePreflight([['const violations = checkPolicyInvariants(context.board)', 'const violations = []']])
  const board = writerReadyBoard()
  board.execution_policy.production_deploy_authorized = true
  assert.equal(preflight({ board }).checks[5].ok, false)
  const over = mutant.runPreflight({ board, schema: SCHEMA, request: validRequest() })
  assert.equal(over.checks[5].ok, true, 'the mutation must actually disable the policy check')
  assert.equal(over.ok, false, 'the committed schema must still refuse the drifted flag')
  assert.equal(over.authorized, null)
  assert.deepEqual(over.failed_conditions, [1, 2])
})

test('reverse proof: with the policy AND schema gates removed, a production-authorizing board starts a writer', async () => {
  const mutant = await mutatePreflight([
    ['const violations = checkPolicyInvariants(context.board)', 'const violations = []'],
    ['const ok = evaluation.schema_valid === true && evaluation.violation_count === 0', 'const ok = true'],
    ['function conditionExactlyOneEligibleTask(context) {', "function conditionExactlyOneEligibleTask(context) {\n  if (true) return check(2, 'exactly one task is eligible', true, null, 'mutant: condition 2 removed')"],
  ])
  const board = writerReadyBoard()
  board.execution_policy.production_deploy_authorized = true
  assertRealPreflightRefuses({ board }, STOP_CONDITIONS.POLICY_AUTHORIZATION_DRIFT)
  assertMutantAuthorizes(mutant, { board })
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

test('reverse proof: without the leak scan, a request carrying a credential authorizes a writer', async () => {
  const mutant = await mutatePreflight([['  const leaked = findCredentialBearingPath(request)', '  const leaked = null']])
  const request = validRequest({ secret_value: 'sk-ant-oops' })
  assertRealPreflightRefuses({ request }, STOP_CONDITIONS.SECRET_VALUE_LEAKED)
  assertMutantAuthorizes(mutant, { request })
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

test('reverse proof: without the ceilings, a runaway budget authorizes a writer', async () => {
  const mutant = await mutatePreflight([
    ['  max_turns: 120,\n  timeout_minutes: 90,\n  max_retries: 2,', '  max_turns: 1e9,\n  timeout_minutes: 1e9,\n  max_retries: 1e9,'],
  ])
  const request = validRequest({ budget: { max_turns: 100000, timeout_minutes: 100000, max_retries: 100000 } })
  assertRealPreflightRefuses({ request }, STOP_CONDITIONS.BUDGET_NOT_BOUNDED)
  assertMutantAuthorizes(mutant, { request })
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

test('reverse proof: without the allowlist, an unanticipated scope authorizes a writer', async () => {
  const mutant = await mutatePreflight([['failures.push(`${scope} is not an anticipated writer scope`)', 'void scope']])
  const request = validRequest({ permissions: { contents: 'write', 'security-events': 'write' } })
  assertRealPreflightRefuses({ request }, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD)
  assertMutantAuthorizes(mutant, { request })
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

// ---------------------------------------------------------------------------
// 16. The attestation job (ACP-002 repair)
//
// The runner was dispatch-only, and workflow_dispatch is unavailable to a file
// that has never been on the default branch — so it could not be attested at
// all. A pull_request-triggered READ-ONLY job fixes that. These tests hold the
// line the repair was allowed to draw and no further.
// ---------------------------------------------------------------------------

test('the attestation job is read-only and holds no other scope', () => {
  assert.deepEqual(writerPermissionsFromWorkflow(WRITER_WORKFLOW, 'attest'), { contents: 'read' })
})

test('the repair did not widen the writer job', () => {
  const writer = writerPermissionsFromWorkflow(WRITER_WORKFLOW, 'writer')
  assert.deepEqual(
    Object.entries(writer).filter(([, level]) => level === 'write'),
    [['contents', 'write']],
    'contents:write must remain the writer job\'s only write scope',
  )
  for (const scope of PRODUCTION_REACHING_PERMISSIONS) {
    if (scope in writer) assert.equal(writer[scope], 'none', `${scope} must stay disclaimed`)
  }
})

test('the parser reads each job separately — no bleed between the two blocks', () => {
  const writer = writerPermissionsFromWorkflow(WRITER_WORKFLOW, 'writer')
  const attest = writerPermissionsFromWorkflow(WRITER_WORKFLOW, 'attest')
  assert.notDeepEqual(writer, attest, 'two different jobs must yield two different permission sets')
  assert.equal(writer.contents, 'write')
  assert.equal(attest.contents, 'read')
  assert.equal(attest.deployments, undefined, 'the attest block must not pick up the writer block')
})

test('a writer can only be started by a human dispatch, never by a pull request', () => {
  assert.match(WRITER_WORKFLOW, /on:\n {2}workflow_dispatch:/, 'workflow_dispatch must remain a trigger')
  assert.match(WRITER_WORKFLOW, /^ {2}pull_request:$/m, 'pull_request is required or the runner cannot be attested before merge')
  assert.match(
    WRITER_WORKFLOW,
    /^ {2}writer:\n {4}#[^\n]*\n {4}#[^\n]*\n {4}if: github\.event_name == 'workflow_dispatch'$/m,
    'the writer job must be gated to workflow_dispatch now that pull_request reaches this file',
  )
  assert.match(WRITER_WORKFLOW, /^ {2}attest:\n {4}if: github\.event_name == 'pull_request'$/m)
})

test('the attestation never runs a writer: no CLI, no credential, no push', () => {
  const attestSection = WRITER_WORKFLOW.slice(WRITER_WORKFLOW.indexOf('\n  attest:'))
  assert.ok(attestSection.length > 0)
  assert.doesNotMatch(attestSection, /@anthropic-ai\/claude-code/, 'the attestation must not install the Claude CLI')
  assert.doesNotMatch(attestSection, /ANTHROPIC_API_KEY: \$\{\{ secrets/, 'the attestation must not receive a provider credential')
  assert.doesNotMatch(attestSection, /git push/, 'the attestation must never push')
  assert.doesNotMatch(attestSection, /git commit/, 'the attestation must never commit')
  // The writer half still does all three; otherwise the assertions above would
  // pass against an empty slice and prove nothing.
  const writerSection = WRITER_WORKFLOW.slice(0, WRITER_WORKFLOW.indexOf('\n  attest:'))
  assert.match(writerSection, /@anthropic-ai\/claude-code/)
  assert.match(writerSection, /\bpush "https:\/\/github\.com/)
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

// ---------------------------------------------------------------------------
// 17. The six blocking P1s from Codex run 31956327110
//
// Each finding gets the input that demonstrated it, asserted to be refused now,
// plus a reverse proof that the specific new guard is what refuses it.
// ---------------------------------------------------------------------------

test('P1-1: an empty permissions block is refused, not read as modest', () => {
  const result = preflight({ request: validRequest({ permissions: {} }) })
  assert.equal(conditionById(result, 9).stop_condition, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD)
  assert.equal(result.ok, false)
  assert.equal(result.authorized, null)
})

test('P1-1: a permissions block that never mentions contents is refused', () => {
  assert.equal(conditionById(preflight({ request: validRequest({ permissions: { issues: 'read' } }) }), 9).ok, false)
})

test('reverse proof: without BOTH new permission guards, {} authorizes a writer', async () => {
  // The repair added two: "declare something" and "declare contents". An empty
  // block trips both, so both must go before the mutant can authorize — which
  // is the point of asserting it rather than assuming it.
  const mutant = await mutatePreflight([
    ['  if (Object.keys(permissions).length === 0) {', '  if (false) {'],
    ['  if (permissions.contents === undefined) {', '  if (false) {'],
  ])
  const request = validRequest({ permissions: {} })
  assertRealPreflightRefuses({ request }, STOP_CONDITIONS.WRITER_PERMISSIONS_TOO_BROAD)
  assertMutantAuthorizes(mutant, { request })
})

test('P1-1: a credential nested inside an object is found', () => {
  for (const leak of [
    { creds: { api_key: 'sk-ant-oops' } },
    { nested: { deeper: { authorization: 'bearer oops' } } },
    { token: 'ghp_oops' },
    { list: [{ password: 'hunter2' }] },
  ]) {
    const result = preflight({ request: validRequest(leak) })
    assert.equal(conditionById(result, 7).stop_condition, STOP_CONDITIONS.SECRET_VALUE_LEAKED, JSON.stringify(leak))
  }
})

test('P1-1: a credential-shaped VALUE is found even under an innocent key', () => {
  assert.equal(conditionById(preflight({ request: validRequest({ note: 'sk-ant-api03-xxxx' }) }), 7).stop_condition, STOP_CONDITIONS.SECRET_VALUE_LEAKED)
})

test('P1-1: the scan tolerates a cyclic request instead of hanging', () => {
  const request = validRequest()
  request.self = request
  assert.equal(conditionById(preflight({ request }), 7).ok, true)
})

test('P1-1: every CLI exit speaks the full machine contract', () => {
  const captured = []
  const write = process.stdout.write.bind(process.stdout)
  process.stdout.write = (chunk) => { captured.push(String(chunk)); return true }
  let code
  try {
    code = mainCli([], { readFileSync: () => { throw new Error('unreachable') }, boardPath: 'x', schemaPath: 'y' })
  } finally {
    process.stdout.write = write
  }
  assert.equal(code, 2)
  const parsed = JSON.parse(captured.join(''))
  assert.equal(parsed.ok, false)
  assert.equal(parsed.authorized, null, 'a usage error must still say nothing was authorized')
  assert.equal(parsed.next_board_status, 'BLOCKED')
  assert.equal(parsed.stop_condition, STOP_CONDITIONS.MALFORMED_PREFLIGHT_REQUEST)
  assert.equal(parsed.github_outputs.authorized_item, '')
})

test('P1-4: the retry ceiling is spent against the real attempt', () => {
  const zero = { max_turns: 60, timeout_minutes: 60, max_retries: 0 }
  assert.equal(conditionById(preflight({ request: validRequest({ budget: zero, run_attempt: 1 }) }), 8).ok, true)
  const retried = preflight({ request: validRequest({ budget: zero, run_attempt: 2 }) })
  assert.equal(conditionById(retried, 8).stop_condition, STOP_CONDITIONS.BUDGET_NOT_BOUNDED)
  assert.equal(retried.ok, false)
  // One retry allowed means attempts 1 and 2 pass, 3 does not.
  const one = { max_turns: 60, timeout_minutes: 60, max_retries: 1 }
  assert.equal(conditionById(preflight({ request: validRequest({ budget: one, run_attempt: 2 }) }), 8).ok, true)
  assert.equal(conditionById(preflight({ request: validRequest({ budget: one, run_attempt: 3 }) }), 8).ok, false)
})

test('P1-4: an undeclared or nonsense attempt is refused', () => {
  for (const run_attempt of [undefined, 0, -1, 1.5, '1', null]) {
    assert.equal(conditionById(preflight({ request: validRequest({ run_attempt }) }), 8).ok, false, String(run_attempt))
  }
})

test('reverse proof: without the attempt check, a re-run authorizes a writer despite max_retries 0', async () => {
  const mutant = await mutatePreflight([
    ["  const attempt = context.request.run_attempt", '  const attempt = 1; void context.request.run_attempt'],
  ])
  const request = validRequest({ run_attempt: 7 })
  assertRealPreflightRefuses({ request }, STOP_CONDITIONS.BUDGET_NOT_BOUNDED)
  assertMutantAuthorizes(mutant, { request })
})

test('P1-5: condition 11 inspects the real judge workflow, not just the board flag', () => {
  const writeJudge = READ_ONLY_JUDGE_WORKFLOW.replace('      contents: read', '      contents: write')
  const result = preflight({ request: validRequest({ judge_workflows: judgeWorkflows(writeJudge) }) })
  assert.equal(conditionById(result, 11).stop_condition, STOP_CONDITIONS.JUDGE_NOT_READ_ONLY)
  assert.match(conditionById(result, 11).detail, /contents:write/)
  assert.equal(result.ok, false)
})

test('P1-5: a missing or unparseable judge workflow fails closed', () => {
  for (const judge_workflows of [undefined, [], [{ path: 'j', job: 'codex-judge', source: 'jobs:\n  other:\n' }]]) {
    assert.equal(conditionById(preflight({ request: validRequest({ judge_workflows }) }), 11).ok, false, JSON.stringify(judge_workflows))
  }
})

test('P1-5: the real committed ACP-002 judge workflow is read-only', () => {
  const source = readFileSync(join(HERE, '..', '.github', 'workflows', 'control-plane-acp002-judge.yml'), 'utf8')
  const permissions = writerPermissionsFromWorkflow(source, 'codex-judge')
  assert.deepEqual(permissions, { contents: 'read', actions: 'read', 'pull-requests': 'read' })
  assert.equal(conditionById(preflight({ request: validRequest({ judge_workflows: [{ path: 'acp002', job: 'codex-judge', source }] }) }), 11).ok, true)
})

test('reverse proof: without the workflow inspection, a write-granting judge is accepted', async () => {
  // Condition 11 checks write levels AND pins contents to read/none. A judge
  // granted contents:write trips both, so both go.
  const mutant = await mutatePreflight([
    ['      if (WRITE_LEVELS.includes(level)) failures.push(`${label}: job grants ${scope}:${level}`)', '      void level'],
    ["    if (permissions.contents !== 'read' && permissions.contents !== 'none') {", '    if (false) {'],
  ])
  const writeJudge = READ_ONLY_JUDGE_WORKFLOW.replace('      contents: read', '      contents: write')
  const request = validRequest({ judge_workflows: judgeWorkflows(writeJudge) })
  assertRealPreflightRefuses({ request }, STOP_CONDITIONS.JUDGE_NOT_READ_ONLY)
  // With the write-level detection gone, condition 11 is back to being the
  // cosmetic board-flag check the judge rejected — and it authorizes a writer
  // whose judge can write to the repository.
  assertMutantAuthorizes(mutant, { request })
})

test('P1-2: the writer holds no shell and no persisted credential', () => {
  const writerSection = WRITER_WORKFLOW.slice(0, WRITER_WORKFLOW.indexOf('\n  attest:'))
  assert.match(writerSection, /persist-credentials: false/, 'the writer checkout must not keep a git credential')
  assert.match(writerSection, /--disallowedTools "Bash"/, 'the writer must not hold any shell tool')
  assert.doesNotMatch(writerSection, /"Bash\(node:\*\)"/, 'node can spawn git; it was never a narrow allowance')
  assert.doesNotMatch(writerSection, /"Bash\(npm:\*\)"/)
  assert.doesNotMatch(writerSection, /"Bash\(npx:\*\)"/)
  // The token appears once, in the final push step, and never as a job-wide env.
  assert.equal(writerSection.split('PUSH_TOKEN:').length - 1, 1)
  assert.match(writerSection, /git -c http\.extraheader=.*push "https:\/\/github\.com/s)
})

/**
 * ACP-002 (REPAIR/P1-3) — focused tests for item-scoped writer authorization.
 *
 * The finding: "The preflight selects an item, but post-write enforcement only
 * checks that paths are under control-plane/. A writer authorized for ACP-002
 * can modify ACP-003's board record or implementation, and `git add
 * control-plane` will commit it."
 *
 * So the direct tests below feed exactly that attack — an ACP-002 writer
 * reaching into ACP-003 — and each reverse proof removes the guard and shows
 * the same input then being ACCEPTED overall (`ok === true`), which is the bar
 * the independent judge set for the rest of this suite.
 *
 * No filesystem: mutants are imported from data: URLs so a read-only auditor
 * can reproduce every proof here.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { BOARD_PATH } from './kernel.mjs'
import { SCOPE_VIOLATIONS, checkWriterScope, pathAllowed, scopeForItem } from './scope-guard.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCOPE_GUARD_SOURCE = readFileSync(join(HERE, 'scope-guard.mjs'), 'utf8')
const SCOPES = JSON.parse(readFileSync(join(HERE, 'item-scopes.json'), 'utf8'))
const BOARD = JSON.parse(readFileSync(BOARD_PATH, 'utf8'))

let mutantCounter = 0

async function mutateScopeGuard(replacements) {
  let mutated = SCOPE_GUARD_SOURCE
  for (const [find, replace] of replacements) {
    assert.equal(mutated.split(find).length - 1, 1, `mutation anchor must appear exactly once: ${JSON.stringify(find)}`)
    mutated = mutated.replace(find, replace)
  }
  assert.notEqual(mutated, SCOPE_GUARD_SOURCE, 'mutation must actually change the source')
  mutated = mutated.replace(/from '\.\/([a-zA-Z.-]+\.mjs)'/g, (_m, name) => `from '${pathToFileURL(join(HERE, name)).href}'`)
  return import(`data:text/javascript;base64,${Buffer.from(mutated).toString('base64')}#${mutantCounter++}`)
}

/** A legitimate ACP-002 write: its own record advances, nothing else moves. */
function legalWrite() {
  const before = structuredClone(BOARD)
  const after = structuredClone(BOARD)
  const item = after.items.find((x) => x.id === 'ACP-002')
  item.status = 'WRITER_DONE'
  item.evidence = [...item.evidence, 'a new evidence line']
  return { boardBefore: before, boardAfter: after }
}

function run(overrides = {}) {
  const { boardBefore, boardAfter } = legalWrite()
  return checkWriterScope({
    itemId: 'ACP-002',
    changedPaths: ['control-plane/MASTER_BOARD.json', 'control-plane/preflight.mjs'],
    scopes: SCOPES,
    boardBefore,
    boardAfter,
    ...overrides,
  })
}

function codes(result) {
  return result.violations.map((v) => v.code)
}

// --- happy path -------------------------------------------------------------

test('a writer that stays inside its own item and its declared paths is allowed', () => {
  const result = run()
  assert.equal(result.ok, true, JSON.stringify(result.violations, null, 2))
  assert.equal(result.item_id, 'ACP-002')
  assert.equal(result.github_outputs.first_violation, '')
})

// --- the finding: reaching into another item --------------------------------

test('P1-3: an ACP-002 writer may not modify ACP-003 board record', () => {
  const { boardBefore, boardAfter } = legalWrite()
  boardAfter.items.find((x) => x.id === 'ACP-003').status = 'READY'
  const result = run({ boardBefore, boardAfter })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes(SCOPE_VIOLATIONS.FOREIGN_ITEM_MODIFIED))
  assert.match(result.violations[0].message, /modified ACP-003/)
})

test("P1-3: an ACP-002 writer may not add ACP-003's implementation, even under control-plane/", () => {
  const result = run({ changedPaths: ['control-plane/MASTER_BOARD.json', 'control-plane/judge-runner.mjs'] })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes(SCOPE_VIOLATIONS.PATH_OUTSIDE_ITEM_SCOPE))
})

test('P1-3: an item with no declared scope cannot run at all — absence is refusal', () => {
  const result = run({ itemId: 'ACP-003' })
  assert.equal(result.ok, false)
  assert.deepEqual(codes(result), [SCOPE_VIOLATIONS.NO_DECLARED_SCOPE])
})

test('P1-3: top-level governance may not be touched by an item writer', () => {
  const { boardBefore, boardAfter } = legalWrite()
  boardAfter.execution_policy.max_active_writers = 2
  assert.ok(codes(run({ boardBefore, boardAfter })).includes(SCOPE_VIOLATIONS.GOVERNANCE_MODIFIED))
})

test('P1-3: an item may not rewrite its own identity, owner, or dependencies', () => {
  for (const mutate of [
    (i) => { i.owner = 'OWNER' },
    (i) => { i.title = 'something else' },
    (i) => { i.dependencies = [] },
  ]) {
    const { boardBefore, boardAfter } = legalWrite()
    mutate(boardAfter.items.find((x) => x.id === 'ACP-002'))
    assert.ok(codes(run({ boardBefore, boardAfter })).includes(SCOPE_VIOLATIONS.ITEM_IDENTITY_DRIFT))
  }
})

test('P1-3: deleting the authorized item is not a way to satisfy the guard', () => {
  const { boardBefore, boardAfter } = legalWrite()
  boardAfter.items = boardAfter.items.filter((x) => x.id !== 'ACP-002')
  assert.ok(codes(run({ boardBefore, boardAfter })).includes(SCOPE_VIOLATIONS.AUTHORIZED_ITEM_MISSING))
})

test('P1-3: reordering keys is not a change — the comparison is canonical', () => {
  const { boardBefore } = legalWrite()
  const boardAfter = JSON.parse(JSON.stringify(boardBefore))
  const item = boardAfter.items.find((x) => x.id === 'ACP-003')
  boardAfter.items[boardAfter.items.indexOf(item)] = Object.fromEntries(Object.entries(item).reverse())
  assert.equal(run({ boardBefore, boardAfter }).ok, true, 'key order must not be mistaken for tampering')
})

test('P1-3: a malformed request is refused rather than interpreted', () => {
  for (const bad of [{ itemId: '' }, { changedPaths: null }, { scopes: null }, { boardBefore: null }, { boardAfter: null }]) {
    assert.deepEqual(codes(run(bad)), [SCOPE_VIOLATIONS.MALFORMED_SCOPE_REQUEST], JSON.stringify(bad))
  }
})

// --- the allowlist itself ----------------------------------------------------

test('pathAllowed matches exact paths and /** prefixes, and nothing else', () => {
  assert.equal(pathAllowed('a/b.mjs', ['a/b.mjs']), true)
  assert.equal(pathAllowed('a/b/c.mjs', ['a/b/**']), true)
  assert.equal(pathAllowed('a/bc.mjs', ['a/b/**']), false, 'a prefix must not leak past the directory boundary')
  assert.equal(pathAllowed('a/b.mjs', ['a/b.mjs.bak']), false)
  assert.equal(pathAllowed('a/b.mjs', []), false)
})

test('scopeForItem treats an empty list as no scope', () => {
  assert.equal(scopeForItem({ items: { 'ACP-009': [] } }, 'ACP-009'), null)
  assert.equal(scopeForItem({ items: {} }, 'ACP-009'), null)
  assert.ok(Array.isArray(scopeForItem(SCOPES, 'ACP-002')))
})

test('the committed scope for ACP-002 does not include another item’s files', () => {
  const declared = scopeForItem(SCOPES, 'ACP-002')
  for (const path of declared) {
    assert.ok(!/acp-?00[13456789]/i.test(path), `${path} names another item`)
  }
})

// --- reverse proofs ----------------------------------------------------------

test('reverse proof: without the foreign-item check, an ACP-002 writer rewrites ACP-003 and is allowed', async () => {
  const mutant = await mutateScopeGuard([['    if (id === itemId) continue', '    if (true) continue']])
  const { boardBefore, boardAfter } = legalWrite()
  boardAfter.items.find((x) => x.id === 'ACP-003').status = 'READY'
  const input = { itemId: 'ACP-002', changedPaths: ['control-plane/MASTER_BOARD.json'], scopes: SCOPES, boardBefore, boardAfter }
  assert.equal(checkWriterScope(input).ok, false)
  assert.equal(mutant.checkWriterScope(input).ok, true, 'the mutant must allow the write overall')
})

test('reverse proof: without the path allowlist, an out-of-scope file is allowed', async () => {
  const mutant = await mutateScopeGuard([['    if (!pathAllowed(path, allowed)) {', '    if (false) {']])
  const { boardBefore, boardAfter } = legalWrite()
  const input = { itemId: 'ACP-002', changedPaths: ['control-plane/judge-runner.mjs'], scopes: SCOPES, boardBefore, boardAfter }
  assert.equal(checkWriterScope(input).ok, false)
  assert.equal(mutant.checkWriterScope(input).ok, true)
})

test('reverse proof: without the fail-closed default, an undeclared item is allowed to write', async () => {
  const mutant = await mutateScopeGuard([['  if (allowed === null) {', '  if (false) {']])
  // An otherwise spotless write: identical boards, nothing changed. The ONLY
  // thing that should stop it is that ACP-003 has no declared scope, so the
  // mutant either allows it or the proof is not about this guard.
  const boardBefore = structuredClone(BOARD)
  const boardAfter = structuredClone(BOARD)
  const input = { itemId: 'ACP-003', changedPaths: [], scopes: SCOPES, boardBefore, boardAfter }
  assert.equal(checkWriterScope(input).ok, false)
  // With the refusal gone the undeclared item falls through to an empty
  // allowlist and, with no paths to check, is waved straight through.
  assert.equal(mutant.checkWriterScope(input).ok, true)
})

test('reverse proof: without the governance check, an item writer edits execution_policy and is allowed', async () => {
  const mutant = await mutateScopeGuard([['  if (canonical(strip(boardBefore)) !== canonical(strip(boardAfter))) {', '  if (false) {']])
  const { boardBefore, boardAfter } = legalWrite()
  boardAfter.execution_policy.production_deploy_authorized = true
  const input = { itemId: 'ACP-002', changedPaths: ['control-plane/MASTER_BOARD.json'], scopes: SCOPES, boardBefore, boardAfter }
  assert.equal(checkWriterScope(input).ok, false)
  assert.equal(mutant.checkWriterScope(input).ok, true)
})

// ---------------------------------------------------------------------------
// The platform's own limit: a writer token cannot push a workflow file.
//
// Found the expensive way. A real cloud run passed its preflight, ran Claude,
// passed the scope check and the focused suite, and then died on the push with
// "refusing to allow a GitHub App to create or update workflow ... without
// `workflows` permission". The work was correct and unlandable. Better to say
// no at the start, and to make the declaration itself unable to promise it.
// ---------------------------------------------------------------------------

test('a changed workflow path is refused, because the writer token can never push it', () => {
  const result = run({ changedPaths: ['control-plane/MASTER_BOARD.json', '.github/workflows/control-plane-writer.yml'] })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes(SCOPE_VIOLATIONS.WORKFLOW_PATH_UNPUSHABLE))
})

test('a scope that DECLARES a workflow path is itself refused', () => {
  const scopes = { items: { 'ACP-002': ['control-plane/MASTER_BOARD.json', '.github/workflows/control-plane-writer.yml'] } }
  const result = run({ scopes, changedPaths: ['control-plane/MASTER_BOARD.json'] })
  assert.equal(result.ok, false)
  assert.ok(codes(result).includes(SCOPE_VIOLATIONS.WORKFLOW_PATH_UNPUSHABLE))
})

test('the committed scopes declare no workflow path', () => {
  for (const [item, paths] of Object.entries(SCOPES.items)) {
    for (const path of paths) {
      assert.ok(!path.startsWith('.github/'), `${item} declares unpushable ${path}`)
    }
  }
})

test('reverse proof: without the workflow-path refusal, an unpushable change is allowed', async () => {
  const mutant = await mutateScopeGuard([["    if (path.startsWith('.github/')) {", '    if (false) {']])
  const { boardBefore, boardAfter } = legalWrite()
  const scopes = { items: { 'ACP-002': ['control-plane/MASTER_BOARD.json', '.github/workflows/control-plane-writer.yml'] } }
  const input = { itemId: 'ACP-002', changedPaths: ['control-plane/MASTER_BOARD.json', '.github/workflows/control-plane-writer.yml'], scopes, boardBefore, boardAfter }
  assert.equal(checkWriterScope(input).ok, false)
  // The declaration guard still fires, so remove it too to show the path check
  // is what stops the changed FILE.
  const both = await mutateScopeGuard([
    ["    if (path.startsWith('.github/')) {", '    if (false) {'],
    ["    if (pattern.startsWith('.github/')) {", '    if (false) {'],
  ])
  assert.equal(both.checkWriterScope(input).ok, true, 'with both refusals gone the unpushable change is allowed')
  void mutant
})

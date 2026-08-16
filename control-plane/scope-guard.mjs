#!/usr/bin/env node
/**
 * AUSCULTA-AUTONOMOUS-CONTROL-PLANE-001 — ACP-002 (REPAIR/P1-3)
 * Item-scoped write enforcement for the cloud writer.
 *
 * The runner used to prove one thing about a writer's output: every changed
 * path sits under `control-plane/`. The independent judge pointed out what that
 * misses — a writer authorized for ACP-002 could rewrite ACP-003's board record,
 * or drop ACP-003's implementation into place, and `git add control-plane` would
 * commit all of it. "Inside the right directory" is not "inside the right job".
 *
 * So authorization is per item and declared in advance:
 *
 *   1. `control-plane/item-scopes.json` lists the paths each item may touch.
 *      An item with no entry has no scope and cannot run. Absence is a refusal.
 *   2. The board may change, but ONLY the authorized item's record. Every other
 *      item, and every top-level governance field, must be structurally
 *      identical before and after.
 *
 * Deterministic, dependency-free, and read-only over its inputs — it decides,
 * it does not fix.
 */

export const SCOPE_GUARD_CONTRACT_VERSION = 'control-plane/scope-guard/1'

export const SCOPE_VIOLATIONS = Object.freeze({
  NO_DECLARED_SCOPE: 'NO_DECLARED_SCOPE',
  PATH_OUTSIDE_ITEM_SCOPE: 'PATH_OUTSIDE_ITEM_SCOPE',
  WORKFLOW_PATH_UNPUSHABLE: 'WORKFLOW_PATH_UNPUSHABLE',
  FOREIGN_ITEM_MODIFIED: 'FOREIGN_ITEM_MODIFIED',
  GOVERNANCE_MODIFIED: 'GOVERNANCE_MODIFIED',
  AUTHORIZED_ITEM_MISSING: 'AUTHORIZED_ITEM_MISSING',
  ITEM_IDENTITY_DRIFT: 'ITEM_IDENTITY_DRIFT',
  MALFORMED_SCOPE_REQUEST: 'MALFORMED_SCOPE_REQUEST',
})

function violation(code, path, message) {
  return { code, path, message, severity: 'FATAL' }
}

/** Stable, key-sorted serialisation so field order can never fake a difference. */
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
    .join(',')}}`
}

/**
 * `a/b/**` matches anything under `a/b/`. Everything else is an exact path.
 * Deliberately not a glob engine: a pattern language nobody can hold in their
 * head is how an allowlist grows a hole.
 */
export function pathAllowed(path, patterns) {
  for (const pattern of patterns) {
    if (pattern === path) return true
    if (pattern.endsWith('/**') && path.startsWith(pattern.slice(0, -2))) return true
  }
  return false
}

export function scopeForItem(scopes, itemId) {
  const declared = scopes?.items?.[itemId]
  return Array.isArray(declared) && declared.length > 0 ? declared : null
}

/**
 * @param {{itemId: string, changedPaths: string[], scopes: object, boardBefore: object, boardAfter: object}} input
 * @returns {{contract: string, ok: boolean, item_id: string, violations: object[], github_outputs: object}}
 */
export function checkWriterScope({ itemId, changedPaths, scopes, boardBefore, boardAfter } = {}) {
  const violations = []

  const malformed =
    typeof itemId !== 'string' ||
    itemId.length === 0 ||
    !Array.isArray(changedPaths) ||
    scopes === null ||
    typeof scopes !== 'object' ||
    boardBefore === null ||
    typeof boardBefore !== 'object' ||
    boardAfter === null ||
    typeof boardAfter !== 'object'

  if (malformed) {
    return finish(itemId, [violation(SCOPE_VIOLATIONS.MALFORMED_SCOPE_REQUEST, 'scope-guard', 'itemId, changedPaths, scopes, boardBefore and boardAfter are all required')])
  }

  const allowed = scopeForItem(scopes, itemId)
  if (allowed === null) {
    // Fail closed. A future item with no declared scope stops here rather than
    // inheriting a permissive default.
    return finish(itemId, [violation(SCOPE_VIOLATIONS.NO_DECLARED_SCOPE, `item-scopes.json/items/${itemId}`, `${itemId} declares no write scope, so no writer may run for it`)])
  }

  for (const path of changedPaths) {
    // A writer can never land a workflow change, and GitHub is the one that
    // says so: `GITHUB_TOKEN` is refused at the server with "refusing to allow
    // a GitHub App to create or update workflow ... without `workflows`
    // permission". Learned from a real run that did the whole job and then died
    // on the push. Refuse here instead, at the start, with a reason — a late
    // rejection after a writer has spent its budget is a worse version of the
    // same no. It also makes "a writer cannot edit its own runner" a property
    // the platform enforces, not just an allowlist we maintain.
    if (path.startsWith('.github/')) {
      violations.push(violation(SCOPE_VIOLATIONS.WORKFLOW_PATH_UNPUSHABLE, path, `${path} is a workflow-scope path; the writer's token can never push it, so it may not be changed by a writer`))
      continue
    }
    if (!pathAllowed(path, allowed)) {
      violations.push(violation(SCOPE_VIOLATIONS.PATH_OUTSIDE_ITEM_SCOPE, path, `${path} is not in ${itemId}'s declared scope`))
    }
  }

  // The declaration itself must not promise something unpushable.
  for (const pattern of allowed ?? []) {
    if (pattern.startsWith('.github/')) {
      violations.push(violation(SCOPE_VIOLATIONS.WORKFLOW_PATH_UNPUSHABLE, `item-scopes.json/items/${itemId}`, `${itemId} declares ${pattern}, which a writer's token can never push`))
    }
  }

  // --- the board: only the authorized item's record may differ --------------

  const beforeItems = Array.isArray(boardBefore.items) ? boardBefore.items : []
  const afterItems = Array.isArray(boardAfter.items) ? boardAfter.items : []
  const beforeById = new Map(beforeItems.map((item) => [item?.id, item]))
  const afterById = new Map(afterItems.map((item) => [item?.id, item]))

  const authorizedBefore = beforeById.get(itemId)
  const authorizedAfter = afterById.get(itemId)
  if (!authorizedAfter) {
    violations.push(violation(SCOPE_VIOLATIONS.AUTHORIZED_ITEM_MISSING, `/items/${itemId}`, `${itemId} is absent from the board after the write`))
  }

  const ids = new Set([...beforeById.keys(), ...afterById.keys()])
  for (const id of [...ids].sort()) {
    if (id === itemId) continue
    if (canonical(beforeById.get(id)) !== canonical(afterById.get(id))) {
      violations.push(violation(SCOPE_VIOLATIONS.FOREIGN_ITEM_MODIFIED, `/items/${id}`, `${itemId}'s writer modified ${id}`))
    }
  }

  // Everything on the board that is not the items array is governance.
  const strip = (board) => {
    const { items: _items, ...rest } = board
    return rest
  }
  if (canonical(strip(boardBefore)) !== canonical(strip(boardAfter))) {
    violations.push(violation(SCOPE_VIOLATIONS.GOVERNANCE_MODIFIED, '/', 'top-level board governance changed; a writer may only change its own item record'))
  }

  // The authorized item may change status and evidence, never who it is.
  if (authorizedBefore && authorizedAfter) {
    for (const field of ['id', 'title', 'owner', 'dependencies']) {
      if (canonical(authorizedBefore[field]) !== canonical(authorizedAfter[field])) {
        violations.push(violation(SCOPE_VIOLATIONS.ITEM_IDENTITY_DRIFT, `/items/${itemId}/${field}`, `${field} may not be rewritten by the item's own writer`))
      }
    }
  }

  return finish(itemId, violations)
}

function finish(itemId, violations) {
  const ok = violations.length === 0
  return {
    contract: SCOPE_GUARD_CONTRACT_VERSION,
    ok,
    item_id: typeof itemId === 'string' ? itemId : '',
    violations,
    github_outputs: {
      ok: String(ok),
      violation_count: String(violations.length),
      first_violation: ok ? '' : violations[0].code,
    },
  }
}

// ---------------------------------------------------------------------------
// CLI — scope-guard.mjs --item <id> --before <board.json> --changed <list.txt>
// ---------------------------------------------------------------------------

export function main(argv, { readFileSync, scopesPath, boardPath }) {
  const arg = (name) => {
    const index = argv.indexOf(name)
    return index === -1 ? null : argv[index + 1] ?? null
  }
  const itemId = arg('--item')
  const beforePath = arg('--before')
  const changedPath = arg('--changed')

  if (!itemId || !beforePath || !changedPath) {
    const result = finish(itemId ?? '', [violation(SCOPE_VIOLATIONS.MALFORMED_SCOPE_REQUEST, 'scope-guard', 'usage: scope-guard.mjs --item <id> --before <board.json> --changed <paths.txt>')])
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return 2
  }

  let scopes
  let boardBefore
  let boardAfter
  let changedPaths
  try {
    scopes = JSON.parse(readFileSync(scopesPath, 'utf8'))
    boardBefore = JSON.parse(readFileSync(beforePath, 'utf8'))
    boardAfter = JSON.parse(readFileSync(boardPath, 'utf8'))
    changedPaths = readFileSync(changedPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  } catch (error) {
    const result = finish(itemId, [violation(SCOPE_VIOLATIONS.MALFORMED_SCOPE_REQUEST, 'scope-guard', String(error.message ?? error))])
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return 1
  }

  const result = checkWriterScope({ itemId, changedPaths, scopes, boardBefore, boardAfter })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url.startsWith('file:')) {
  const { readFileSync } = await import('node:fs')
  const { dirname, join, resolve } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const here = dirname(fileURLToPath(import.meta.url))
    process.exitCode = main(process.argv.slice(2), {
      readFileSync,
      scopesPath: join(here, 'item-scopes.json'),
      boardPath: join(here, 'MASTER_BOARD.json'),
    })
  }
}

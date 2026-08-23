# Scale hot paths — accepted P1 repair from #342

Status: ACTIVE P1 REPAIR DIRECTIVE
Parent board: #296
Source evidence: #342 / #310

## Accepted findings
1. `src/lib/firestore.ts:getPatients()` performs an unbounded full-tenant patient collection read and caches the complete result. Cache frequency does not bound read volume, memory, payload or search cost.
2. `src/lib/expediente/firestore.ts:findNotaByIdInClinic()` lists all patients and probes the note document once per patient until a match is found. The malformed-URL rescue path is O(N) Firestore reads.

## Required bounded repair
### Patient listing/search
Replace the launch-path full-tenant read with a bounded pagination/query contract. Preserve deterministic ordering and existing caller behavior through a compatibility surface where needed, but do not materialize the whole tenant by default. Return/propagate an explicit continuation cursor. Search must use an indexed/bounded strategy or an explicit bounded candidate window; never silently scan all patients client-side/server-side.

### Note lookup rescue
Remove the per-patient probe loop. Prefer a canonical direct/indexed lookup contract keyed by clinic + note identity, or a bounded indexed query that proves tenant ownership. If legacy data lacks the required index/reference, fail to a bounded compatibility path/human-safe error rather than O(N) tenant traversal. Cross-tenant ambiguity fails closed.

## Mandatory tests
- first page has a hard limit and deterministic order;
- cursor retrieves the next page without duplicates/omissions in synthetic fixtures;
- no default path calls unbounded `getDocs` over all patients;
- search does not fetch the complete tenant to filter in memory;
- note lookup does not enumerate all patients / issue one read per patient;
- correct clinic note resolves; foreign clinic note fails closed;
- malformed/unknown note does not trigger O(N) fallback;
- compatibility callers keep their clinical semantics and no patient is invented/dropped inside a returned page;
- focused scale invariant proves reads are bounded by page/query limit, not total tenant size.

## Ownership / exclusions
Narrowly required patient listing/search and note-lookup backend primitives plus focused tests. Do not modify Voice #302, Reasoning #303, Migration/Media #353, Receta R-06 #355, Evidence, Hospital/UCI, workflows, dependencies, Firebase rules or production config. Consultorio #306 will consume these primitives later and must not duplicate them.

No PHI, production deploy, main merge, destructive data migration, clinical-policy change or gate weakening. Persist one exact-SHA checkpoint, run focused verification + canonical CI, then stop. No paid Codex audit is authorized for this lane by this directive.

## Implemented contract

### Patient listing/search — `src/lib/firestore.ts`

| Symbol | Bound | Meaning |
|---|---|---|
| `listarPacientesPagina(clinicId, {limite, cursor})` | `limite + 1` reads, `limite ≤ 200`, default 50 | Canonical page. Order is `(nombre asc, __name__ asc)` so homonyms cannot duplicate/omit across a cursor boundary. Returns `{pacientes, cursor, hayMas, limite}`; `cursor` is `{nombre, id}` by value, not a snapshot. |
| `buscarPacientes(clinicId, texto, {ventana})` | `ventana` reads per prefix query, `ventana ≤ 200`, default 100 | Bounded candidate window built from indexed prefix range queries on the fields the typed term can plausibly be (`nombre`, `telefono`, `email`, `curp`). Reports `truncada` and the `estrategias` used. Empty term issues zero reads. |
| `listarPacientesCompat(clinicId, {force, techo})` | `TECHO_COMPAT_PACIENTES = 500` reads | Compatibility surface for the ~14 existing list screens. Pages up to the hard ceiling and **declares** `truncada` when it stops short. |
| `getPatients(clinicId, {force})` | same ceiling | Unchanged signature, unchanged callers. Delegates to `listarPacientesCompat`. |

Consultorio #306 consumes `listarPacientesPagina` / `buscarPacientes`. It must not
re-implement pagination, cursors or search.

### Note lookup — `src/lib/expediente/firestore.ts`

`buscarNotaEnClinica(clinicId, notaId)` returns
`encontrada | no-encontrada | ambigua | no-resoluble`, in two bounded steps:

1. **Indexed** — `collectionGroup('notas')` filtered by `clinicId` +
   `metadata.id`, `limit(2)`. At most 2 reads. Tenant ownership is proven from
   the document **path**, not from the `clinicId` field, so a mislabelled foreign
   document cannot resolve. Two in-tenant candidates return `ambigua`.
2. **Bounded compatibility probe** — at most `TECHO_SONDEO_NOTA = 50` patients,
   probed in parallel. Exhaustive (and therefore semantics-preserving) for a
   clinic at or below the ceiling; above it the answer is `no-resoluble`, never a
   guess and never an unproven claim of absence.

`findNotaByIdInClinic` keeps its old `{patientId, nota} | null` shape.

**Operational note (owner action, not done here).** Step 1 only activates in
production once the owner deploys the `notas` collection-group security rule and
the composite index `(clinicId ASC, metadata.id ASC)`. Rules, indexes and
deployment configuration are outside this lane's mutation scope. Until then the
lookup falls through — caught, not crashed — to step 2, which is still O(ceiling)
and never O(tenant). A regression test pins that fallthrough.

Verification: `src/__tests__/scale-342-lecturas-acotadas.test.ts` (synthetic
non-PHI fixtures; counts documents read and asserts the counts are identical for
100-patient and 8 000-patient tenants).

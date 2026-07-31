# E0-11 — Clinical Safety CI gate · DISEÑO (no implementado)

> **Objetivo (backlog):** «El CI bloquea el merge si cae un invariante clínico o de seguridad.»
> **Aceptación:** «Un PR que rompe un invariante clínico no puede mergearse.»
> **Entregables:** workflow CI · gate documentado. **Riesgo:** bajo. **Validación clínica:** no.
> **Depende de:** E0-02 (property-based de dosis) y E0-03 (Clinical Engine Registry) — **ambas cerradas.**

---

## 0. Qué YA existe (no se construye de cero)

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Workflow CI | `.github/workflows/ci.yml:11-30` | job único `verificar` en `push:[main]` y en **todo** `pull_request`: `npm ci` → `npx tsc --noEmit` → `npx vitest run` → `npm run build` |
| Golden de fórmulas | `src/__tests__/clinical-safety-harness.test.ts` | 43 casos que fijan el **valor exacto** de CKD-EPI, Cockcroft-Gault, MELD, FIB-4, Apfel, SOFA, APACHE-II, RCRI, Caprini, NE-equivalente, VExUS, dosis pediátrica |
| Invariantes property-based (E0-02) | `src/__tests__/dosis-invariantes-property.test.ts` | 37 casos; mallas deterministas sobre todo el catálogo, sin `fast-check` (`src/__tests__/_harness/property.ts`) |
| Registro de motores (E0-03) | `src/lib/clinical/registry.ts` | 56 motores; **cada entrada declara `goldenTests: string[]`** (`registry.ts:91-92`) |
| Trinquete de ADRs (E0-03) | `src/lib/clinical/adr-cobertura.ts:33` + `src/__tests__/clinical-registry-adr.test.ts` | `DEUDA_ADR_CONGELADA = 52`; un motor nuevo sin ADR sube la deuda y tumba el CI |
| Guardas de seguridad | `firestore-rules-guard`, `log-secrets-guard`, `claims-guard`, `grupo-e-guardas`, `uci-guards-auditoria`, `guardas-unidad-clinica` | invariantes no-clínicos que también deben bloquear merge |
| Ledger de regresiones | `docs/audit/regression-ledger.md` | 47 entradas CLOSED, cada una **cita el archivo de test que la cierra** |

**Medido hoy (2026-07-28), para que el gate nazca en verde:**
- 167 archivos `*.test.ts`, ~2051 casos.
- **0** ocurrencias de `.skip(` / `.only(` / `.todo(` en `src/__tests__`.
- 65 archivos distintos citados en `goldenTests` del registro — **los 65 existen**.
- 14 archivos distintos citados en el regression-ledger — **los 14 existen**.
- Unión de ambos conjuntos: **75 archivos** = el conjunto «invariantes clínicos y de seguridad».

## 0-bis. Entonces, ¿qué falta realmente?

El CI **ya corre** los invariantes en cada PR. Los tres huecos que impiden dar por cumplido el criterio de aceptación son:

1. **Nada bloquea el merge.** No hay *branch protection* ni *required status checks* en `main`, y no hay `CODEOWNERS`. Un PR con el CI en rojo se puede mergear igual. **Esto no es código**: es un ajuste en la consola de GitHub y sale en §5.
2. **Un invariante se puede apagar en silencio.** `npx vitest run` mide *los tests que quedan*, no *los que deben existir*. Hoy queda verde si alguien borra `clinical-safety-harness.test.ts`, si le pone `describe.skip`, o si deja un `it.only` que excluye al resto del archivo. Ese es el agujero real y lo cierra este diseño.
3. **No hay un check con nombre estable ni documento del gate.** *Branch protection* exige nombrar el check; y el entregable «gate documentado» no existe.

---

## 1. Cambio mínimo propuesto

Cinco archivos nuevos, dos modificados. **Cero archivos de producción tocados.**

### 1.1 `src/lib/clinical/safety-gate.ts` (NUEVO) — el manifiesto es *derivado*, no escrito a mano

El conjunto protegido no se lista a mano (se pudre). Se **deriva** de dos fuentes que ya son la verdad del repo:

```ts
/** Un archivo de test cuya desaparición o desactivación debe romper el CI. */
export interface InvarianteProtegido {
  archivo: string            // repo-relativo, p.ej. 'src/__tests__/clinical-safety-harness.test.ts'
  origen: 'registry' | 'ledger' | 'meta'
  porQue: string             // motor(es) o REG-xxx que dependen de él
}

/** Deriva de CLINICAL_ENGINE_REGISTRY[].goldenTests ∪ regression-ledger ∪ metagates. */
export function invariantesProtegidos(ledgerMd: string): InvarianteProtegido[]

/** Patrones de desactivación. Regex ancladas a inicio de línea; es una COTA, no un parser. */
export const PATRONES_DESACTIVACION: readonly { nombre: string; re: RegExp }[]

/** Cuenta casos declarados en un fuente de test. Cota inferior deliberada. */
export function contarCasos(fuente: string): number
```

Los tres metagates que no salen de ninguna de las dos fuentes se declaran explícitos:
`clinical-registry.test.ts`, `clinical-registry-adr.test.ts`, `clinical-safety-gate.test.ts`.

### 1.2 `src/lib/clinical/invariantes-clinicos.json` (NUEVO) — el sello congelado

```jsonc
{
  "sellado": "2026-07-28",
  "porQue": "Trinquete: la cobertura de invariantes puede subir, nunca bajar en silencio.",
  "totalCasos": 0,                       // suma medida al sellar
  "archivos": [ { "archivo": "…", "minCasos": 43 } ]
}
```

Sirve para dos cosas: (a) el trinquete por archivo, (b) es la lista que lee el runner de CI (§1.4) sin necesidad de transpilar TS.

**Trinquete monótono, NO bidireccional.** E0-03 usa comparación exacta (`adr-cobertura.ts:33`) porque vigila **un** número. Aquí serían 75 números y la comparación exacta cobraría un peaje en cada PR clínico que añade un `it`. Decisión: **falla si baja** (o si el archivo desaparece); subir es libre. Es la desviación de estilo consciente respecto a E0-03 y queda escrita en el doc del gate.

### 1.3 `src/__tests__/clinical-safety-gate.test.ts` (NUEVO) — el metagate

| # | Aserción | Qué ataque cierra |
|---|---|---|
| 1 | Cada archivo del manifiesto **existe** | borrar el golden de un motor |
| 2 | Ningún archivo del manifiesto contiene `describe.skip` / `it.skip` / `test.skip` / `.only` / `.todo` / `xit` / `xdescribe` | apagar un invariante sin borrarlo |
| 3 | `contarCasos(archivo) >= minCasos` y `Σ >= totalCasos` | vaciar un archivo dejando un `it` verde |
| 4 | Todo `goldenTests` del registro y todo test citado en el ledger están en el manifiesto | registrar un motor nuevo cuyo golden nadie protege |
| 5 | `.github/workflows/ci.yml` (leído como **texto**, sin dependencia YAML nueva) contiene el job `clinical-safety` y el paso que corre el manifiesto | quitar el gate del workflow en el mismo PR que rompe el invariante |
| 6 | Autotest: las regex de §2 detectan `it.skip(`/`describe.only(` en una cadena fixture y **no** en `it('no salta pasos', …)` | que el gate parezca proteger y no proteja |

La aserción 5 es la que hace el gate **autoprotegido**: modificar el YAML para saltarse el gate rompe el propio gate, que corre dentro de `verificar`.

### 1.4 `scripts/invariantes-clinicos.mjs` (NUEVO) — runner del check rápido

~15 líneas, sin dependencias: lee el JSON y escribe las rutas separadas por espacio en stdout. `scripts/` ya está excluido de `tsconfig.json` (`exclude: ['node_modules','scripts']`), así que no entra al typecheck.

### 1.5 `.github/workflows/ci.yml` (MODIFICADO) — se **añade** un job, no se toca `verificar`

```yaml
  clinical-safety:                     # ← nombre estable: es el required status check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - name: Invariantes clínicos y de seguridad
        run: npx vitest run src/__tests__/clinical-safety-gate.test.ts $(node scripts/invariantes-clinicos.mjs)
```

Corre **sin** `tsc` ni `next build`: ~1–2 min contra los ~8–10 del job completo. Su rojo significa una sola cosa —«se rompió un invariante clínico»— y por eso se puede exigir sin que nadie sienta la tentación de desactivarlo por lentitud. `verificar` queda **idéntico** y sigue corriendo la suite completa.

### 1.6 `docs/ci/clinical-safety-gate.md` (NUEVO) — el entregable «gate documentado»

Qué es un invariante protegido · cómo se deriva la lista · qué hacer cuando el gate cae (las **tres** salidas legítimas: arreglar el código, o justificar la baja de cobertura en el ledger con REG nuevo, o —si el invariante era incorrecto— ADR que lo diga; **nunca** bajar el número «para pasar el CI») · por qué el trinquete es monótono aquí y exacto en E0-03 · qué parte del gate vive fuera del repo (§5).

### 1.7 `.github/CODEOWNERS` (NUEVO, opcional)

`src/lib/clinical/ src/lib/uci/ src/lib/expediente/ src/lib/seguridad/ firestore.rules docs/clinical-decisions/ → @<handle>`.
Fuerza revisión humana del dueño en todo cambio clínico. **Bloqueado por un dato**: el handle real de GitHub (el `git user` local es `docrod29-ai`, hay que confirmarlo). No es clínico; si no se confirma, se omite sin afectar el resto.

---

## 2. Contrato de las regex de desactivación

```
skip:  /^\s*(?:x)?(?:describe|it|test)(?:\.each\([^)]*\))?\.skip\s*[(`]/m   +  /^\s*x(?:it|describe)\s*[(`]/m
only:  /^\s*(?:describe|it|test)(?:\.each\([^)]*\))?\.only\s*[(`]/m
todo:  /^\s*(?:describe|it|test)\.todo\s*[(`]/m
casos: /^\s*(?:it|test)(?:\.each)?\s*[(`]/gm   → cota inferior del nº de casos
```

Ancladas a inicio de línea para no disparar con menciones dentro de strings o comentarios. Se documenta explícitamente que **es una cota, no un parser de TypeScript**: un `it` generado en runtime no se cuenta. Aceptable — el objetivo es que apagar un invariante requiera un acto visible en el diff, no ser infalible contra un adversario interno.

---

## 3. Tests que lo prueban

- `src/__tests__/clinical-safety-gate.test.ts` — las 6 aserciones de §1.3, incluido el autotest de las regex (aserción 6), que es el que impide un gate de cartón.
- Verificación manual antes de commitear (no se deja en el repo): meter `it.skip` en `clinical-safety-harness.test.ts` y en `uci-sofa.test.ts` → confirmar que el gate cae; revertir. Igual borrando `funcion-renal.test.ts` → confirmar rojo por aserción 1 y por el runner (vitest sale ≠0 con una ruta inexistente).

## 4. Riesgo de regresión sobre producción

**Bajo, y acotado a herramientas.** No se toca `src/app/**`, ni `src/components/**`, ni rutas de API, ni `firestore.rules`, ni impresión, ni cobros, ni firma. Riesgos reales:

| Riesgo | Mitigación |
|---|---|
| Falso positivo de las regex tumba PRs legítimos | anclaje a inicio de línea + autotest (aserción 6); el mensaje de fallo cita archivo y línea |
| Fricción: refactor que fusiona tests baja `minCasos` y rompe el CI | es intencional; se resuelve con una línea en el JSON **más** la razón; el doc §1.6 lo explica |
| Minutos de GitHub Actions (segundo `npm ci`) | el job nuevo no corre `tsc` ni `build`; ~1–2 min. Alternativa más barata si molesta: un solo job con el gate como primer paso, a costa de perder el check con nombre propio |
| El JSON sellado se desincroniza al registrar un motor nuevo | aserción 4 lo detecta y el mensaje imprime el JSON corregido listo para pegar |
| Un PR con el gate en rojo se mergea igual | **no lo resuelve el código** → §5 |

## 5. Lo que este diseño NO puede cumplir desde el repo

El criterio literal —«no puede **mergearse**»— lo decide GitHub, no el CI. Para el Dr., en `github.com/<repo> → Settings → Branches → Add branch ruleset` sobre `main`:

1. **Require a pull request before merging** (así `push:[main]` deja de ser una puerta trasera).
2. **Require status checks to pass** → marcar exactamente `verificar` **y** `clinical-safety`.
3. **Require branches to be up to date before merging** (evita el merge que rompe el invariante solo al combinarse).
4. **Do not allow bypassing the above settings** (incluir administradores; si no, el dueño se salta su propio gate).

Sin el paso 2 el gate avisa pero no bloquea. Esto se añade a `docs/pendientes-externos.md` (MODIFICADO) y el RESULTADO.json debe declararlo: **el código queda completo; la aceptación se cierra del todo cuando el Dr. active la protección de rama.** No se marca cumplido a ciegas.

## 6. NEEDS_CLINICAL_REVIEW

**Ninguno.** El backlog marca `validacionClinica: false` y este diseño es coherente con eso: no fija ningún umbral, dosis ni respuesta clínica de oro. Todos los números que congela (`minCasos`, `totalCasos`) son **conteos medidos del propio repo**, no criterios médicos. El único dato externo pendiente es de infraestructura, no clínico: el handle de GitHub para `CODEOWNERS` (§1.7).

## 7. Orden de ejecución sugerido

1. `safety-gate.ts` + autotest de regex (§1.3 aserción 6) — primero el gate se prueba a sí mismo.
2. Sellar `invariantes-clinicos.json` con los conteos medidos; confirmar que nace **verde**.
3. `clinical-safety-gate.test.ts` con las aserciones 1–5.
4. `scripts/invariantes-clinicos.mjs` + job `clinical-safety` en el YAML (activa la aserción 5).
5. `docs/ci/clinical-safety-gate.md` + entrada en `docs/pendientes-externos.md`.
6. Verificación manual destructiva de §3 y revert.
7. Gates de cierre: `tsc --noEmit`, `vitest run` completo, `next build`.

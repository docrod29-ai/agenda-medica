/**
 * GATE DEL COMPILADOR de E2-01 — NO es un test de vitest.
 *
 * La aceptación de la unidad es literal: «una afirmación sin pasaje de respaldo
 * NO PUEDE CONSTRUIRSE». Eso no lo prueba un `expect()`: lo prueba `tsc`. Este
 * archivo lista los casos que DEBEN fallar la compilación, cada uno con
 * `@ts-expect-error`. Si alguno dejara de fallar, TypeScript emite
 * `TS2578 Unused '@ts-expect-error' directive` y tumba `npx tsc --noEmit` Y
 * `npm run build` — es decir, el CI. Ese es el mecanismo de aceptación.
 *
 * Termina en `.tipos.ts` a propósito: NO empareja con el `include` de vitest
 * (`src/__tests__/**\/*.test.ts`) pero SÍ con el `**\/*.ts` de tsconfig.json.
 * Vitest lo ignora; el compilador lo verifica.
 *
 * Su integridad la vigila el guardián de src/__tests__/evidence-model.test.ts
 * (borrar este archivo o comentar los casos no debe ser una forma de "arreglar"
 * el CI).
 */
import {
  fuente, pasaje, claim, estudio,
  type Source, type Passage, type Claim, type Estudio,
  type Declarado, type DisenoDeEstudio, type FechaPublicacion, type NoVacio,
} from '@/types/evidence'

// ── Fixtures SINTÉTICOS (cero PHI, cero red) ────────────────────────────────

const rf = fuente({
  proveedor: 'pubmed',
  idExterno: '00000001',
  titulo: 'Estudio ficticio para el gate de tipos',
  publicado: { precision: 'anio', iso: '2024' },
  recuperadoEn: '2026-07-29T00:00:00.000Z',
  textoRecuperado: 'En esta cohorte ficticia de trescientos pacientes sintéticos, el desenlace primario se observó con menor frecuencia en el grupo de intervención.',
})
if (!rf.ok) throw new Error('fixture inválido')
const src: Source = rf.valor

const rp = pasaje(src, 'el desenlace primario se observó con menor frecuencia en el grupo de intervención')
if (!rp.ok) throw new Error('fixture inválido')
const p: Passage = rp.valor

// ── CASOS NEGATIVOS: cada uno DEBE ser un error de compilación ──────────────

// 1 — LA ACEPTACIÓN, en su forma textual: afirmación sin ningún pasaje.
// @ts-expect-error una afirmación sin pasaje de respaldo no puede construirse
claim('afirmación sin respaldo', [])

// 2 — arreglo suelto (posiblemente vacío) donde se exige tupla no vacía
const quizaVacio: Passage[] = [p]
// @ts-expect-error Passage[] puede estar vacío: NoVacio<Passage> exige probar el primer elemento
claim('afirmación con arreglo que podría estar vacío', quizaVacio)

// 3 — pasaje FABRICADO A MANO (sin pasar por la verificación de literalidad)
// @ts-expect-error falta la marca fantasma: la única puerta es pasaje()
claim('afirmación respaldada por un pasaje inventado', [{ id: 'x', sourceId: 'pubmed:1', texto: 'x', inicio: 0, fin: 1 }])

// 4 — claim FABRICADO A MANO
// @ts-expect-error falta la marca fantasma: la única puerta es claim()/claimDesde()
const claimFalso: Claim = { id: 'c1', texto: 'afirmación', apoyos: [p] }

// 5 — el Resultado de la fábrica no se cuela sin comprobar `ok`
// @ts-expect-error pasaje() devuelve Resultado<Passage,…>, no Passage
claim('afirmación', [pasaje(src, 'un fragmento que no existe en la fuente')])

// 6 — proveedor con licencia desconocida (decisión D1 del Dr.)
fuente({
  // @ts-expect-error 'uptodate' es LICENSE_UNKNOWN: no es un ProveedorHabilitado
  proveedor: 'uptodate',
  idExterno: 'x',
  titulo: 'x',
  publicado: { precision: 'desconocida' },
  recuperadoEn: '2026-07-29T00:00:00.000Z',
  textoRecuperado: 'x',
})

// 7 — Source fabricado a mano
// @ts-expect-error falta la marca fantasma: la única puerta es fuente()
const fuenteFalsa: Source = {
  id: 'pubmed:1', proveedor: 'pubmed', idExterno: '1', titulo: 't',
  publicado: { precision: 'desconocida' }, recuperadoEn: '2026-07-29T00:00:00.000Z',
  textoRecuperado: 'texto',
}

// 8 — dato "conocido" sin decir DE QUÉ PASAJE salió
// @ts-expect-error un Declarado conocido exige pasajeId: la procedencia no es opcional
const sinProcedencia: Declarado<number> = { conocido: true, valor: 300 }

// 9 — dato ausente sin motivo (el `undefined` que significa "normal" es el bug)
// @ts-expect-error declarar la ausencia exige un MotivoAusencia del catálogo
const sinMotivo: Declarado<number> = { conocido: false }

// 10 — diseño de estudio fuera de la taxonomía cerrada
// @ts-expect-error 'ensayo_clinico' (sin decir si fue aleatorizado) no está en DisenoDeEstudio
const disenoInventado: Declarado<DisenoDeEstudio> = { conocido: true, valor: 'ensayo_clinico', pasajeId: p.id }

// 11 — Estudio fabricado a mano
// @ts-expect-error falta la marca fantasma: la única puerta es estudio()
const estudioFalso: Estudio = {
  source: src,
  poblacion: { conocido: false, motivo: 'no_extraido_todavia' },
  diseno: { conocido: false, motivo: 'no_extraido_todavia' },
  efecto: { conocido: false, motivo: 'no_aplica_a_este_diseno' },
  limitaciones: { conocido: false, motivo: 'no_reportado_en_la_fuente' },
}

// 12 — fecha con precisión mentida: 'anio' con un ISO de mes
// @ts-expect-error precision 'anio' exige `${number}`, no '2024-03'
const fechaMentida: FechaPublicacion = { precision: 'anio', iso: '2024-03' }

// ── CASOS POSITIVOS: DEBEN compilar ────────────────────────────────────────

const apoyos: NoVacio<Passage> = [p]
const rc = claim('En este estudio ficticio el desenlace fue menos frecuente con la intervención.', apoyos)
const re = estudio({
  source: src,
  poblacion: { conocido: true, valor: { descripcion: 'cohorte ficticia', n: 300 }, pasajeId: p.id },
  diseno: { conocido: false, motivo: 'no_extraido_todavia' },
  efecto: { conocido: false, motivo: 'no_extraido_todavia' },
  limitaciones: { conocido: false, motivo: 'no_reportado_en_la_fuente' },
  pasajes: [p],
})

// Referencias para que nada quede como declaración muerta.
export const _positivos = {
  rc, re, claimFalso, fuenteFalsa, sinProcedencia, sinMotivo,
  disenoInventado, estudioFalso, fechaMentida, quizaVacio,
}

/**
 * GATE DEL COMPILADOR de E2-02 — NO es un test de vitest.
 *
 * La aceptación de la unidad es literal: «la búsqueda se arma desde PICO, no
 * desde embeddings del texto crudo». La mitad de "no desde el texto crudo" no la
 * prueba un `expect()`: la prueba `tsc`. Este archivo lista los casos que DEBEN
 * fallar la compilación, cada uno con `@ts-expect-error`. Si alguno dejara de
 * fallar, TypeScript emite `TS2578 Unused '@ts-expect-error' directive` y tumba
 * `npx tsc --noEmit` Y `npm run build` — es decir, el CI. Ese es el mecanismo.
 *
 * Termina en `.tipos.ts` a propósito: NO empareja con el `include` de vitest
 * (`src/__tests__/**\/*.test.ts`) pero SÍ con el `**\/*.ts` de tsconfig.json.
 * Vitest lo ignora; el compilador lo verifica.
 *
 * Su integridad la vigila el guardián de src/__tests__/pico-extractor.test.ts
 * (borrar este archivo o comentar los casos no debe ser una forma de "arreglar"
 * el CI).
 */
import {
  termino, pico, consultaDesdePICO,
  type TerminoPICO, type PICO, type ConsultaPubMed,
} from '@/lib/evidencia/pico'
import { buscarConPICO } from '@/lib/evidencia/buscar-con-pico'
import type { NoVacio } from '@/types/evidence'

// ── Fixtures SINTÉTICOS (cero PHI, cero red) ────────────────────────────────

const rt = termino({
  faceta: 'P',
  original: 'IVU recurrente',
  busqueda: 'recurrent urinary tract infection',
  origen: 'diccionario',
})
if (!rt.ok) throw new Error('fixture inválido')
const tP: TerminoPICO = rt.valor

const picoOk = pico({ poblacion: [tP], preguntaOriginal: 'pregunta ficticia' })

// ── CASOS NEGATIVOS: cada uno DEBE ser un error de compilación ──────────────

// 1 — LA ACEPTACIÓN, en su forma textual: una CADENA no es un PICO.
// @ts-expect-error la consulta no se arma desde texto crudo: consultaDesdePICO sólo acepta un PICO
consultaDesdePICO('recurrent urinary tract infection')

// 2 — la búsqueda tampoco admite cadenas.
// @ts-expect-error buscarConPICO sólo acepta ConsultaPubMed, nunca una query escrita a mano
buscarConPICO(['recurrent urinary tract infection'])

// 3 — término FABRICADO A MANO (sin pasar por la validación de §5.2)
// @ts-expect-error falta la marca fantasma: la única puerta es termino()
const terminoFalso: TerminoPICO = { faceta: 'P', original: 'x', busqueda: 'x', sinonimos: [], origen: 'modelo' }

// 4 — PICO sin ninguna faceta: eso es la cadena cruda otra vez, disfrazada.
// @ts-expect-error [] no es NoVacio<TerminoPICO>: sin población no hay pregunta que buscar
pico({ poblacion: [], preguntaOriginal: 'pregunta ficticia' })

// 5 — PICO fabricado a mano
// @ts-expect-error falta la marca fantasma: la única puerta es pico()
const picoFalso: PICO = {
  poblacion: [tP], intervencion: [], comparador: [], outcome: [],
  preguntaOriginal: 'q', degradado: false,
}

// 6 — EL CASO CLAVE: disfrazar texto crudo de consulta ya armada.
// @ts-expect-error falta la marca fantasma: una ConsultaPubMed sólo sale del ensamblador
const consultaFalsa: ConsultaPubMed = {
  texto: 'cualquier cosa AND lo que sea',
  facetas: ['P'], procedencia: [tP], degradada: false,
}

// 7 — arreglo suelto (posiblemente vacío) donde se exige tupla no vacía
const quizaVacio: TerminoPICO[] = [tP]
// @ts-expect-error TerminoPICO[] puede estar vacío: NoVacio exige probar el primer elemento
pico({ poblacion: quizaVacio, preguntaOriginal: 'q' })

// 8 — faceta fuera de la taxonomía cerrada
// @ts-expect-error 'X' no es una Faceta: P | I | C | O
termino({ faceta: 'X', original: 'x', busqueda: 'x', origen: 'modelo' })

// 9 — el Resultado de la fábrica no se cuela sin comprobar `ok`
// @ts-expect-error termino() devuelve Resultado<TerminoPICO,…>, no TerminoPICO
pico({ poblacion: [termino({ faceta: 'P', original: 'x', busqueda: 'x', origen: 'modelo' })], preguntaOriginal: 'q' })

// ── CASOS POSITIVOS: DEBEN compilar ────────────────────────────────────────

const consultaOk: ConsultaPubMed = consultaDesdePICO(picoOk)
const facetasOk: NoVacio<'P' | 'I' | 'C' | 'O'> = consultaOk.facetas

// Referencias para que nada quede como declaración muerta.
export const _positivos = {
  consultaOk, facetasOk, terminoFalso, picoFalso, consultaFalsa, quizaVacio,
}

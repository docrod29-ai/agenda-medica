/**
 * DE INCIDENTE RESUELTO A PRUEBA DE REGRESIÓN — y no al revés.
 *
 * ── LO QUE NO SE HACE AQUÍ ───────────────────────────────────────────────────
 *
 * No se genera una prueba automáticamente. Una prueba escrita por una máquina
 * para cerrar un ticket es, casi siempre, una tautología con nombre largo: mide
 * lo que el arreglo hace en vez de lo que el sistema debe garantizar, pasa
 * siempre y se borra a los seis meses por parecer trivial. La regla de este
 * repositorio es explícita: **una prueba que no puede fallar no es una prueba.**
 *
 * Lo que sí se hace es preparar el expediente para que una persona la escriba
 * bien, y **negarse a emitir el candidato** cuando falta lo que hace que una
 * prueba valga: la reproducción mínima y el invariante esperado. Un candidato
 * incompleto que se acepta es exactamente cómo nace la prueba inútil.
 *
 * ── POR QUÉ SE REUTILIZA LA TAXONOMÍA DE FAMILIAS ────────────────────────────
 *
 * `src/lib/calidad/familias-de-defecto.ts` ya clasifica los 142 defectos del
 * ledger por causa raíz, y su guardián falla si un REG se queda sin familia.
 * Meter aquí una segunda clasificación haría que un mismo defecto tuviera dos
 * causas raíz según quién lo mirara.
 *
 * Módulo PURO.
 */
import { FAMILIAS } from '@/lib/calidad/familias-de-defecto'
import type { GrupoIncidente } from './agrupacion'
import type { EstadoRemediacion } from './maquina'

/** Las claves de familia que existen, leídas del módulo que manda. */
export const CLAVES_DE_FAMILIA: readonly string[] = FAMILIAS.map(f => f.clave)

export interface CandidatoDeRegresion {
  readonly firma: string
  readonly familia: string
  /** Clave de `calidad/familias-de-defecto.ts`. Nunca una inventada aquí. */
  readonly claseDeCausaRaiz: string
  /** Los pasos mínimos, sin PHI. Etiquetas y cifras, no una historia clínica. */
  readonly reproduccionMinima: readonly string[]
  /** Qué tiene que seguir siendo cierto DESPUÉS. Es lo que la prueba comprueba. */
  readonly invarianteEsperado: string
  /** Quién escribe la prueba: el carril dueño del código, no «alguien». */
  readonly duenoDeLaPrueba: string
  /** Ruta propuesta. Se marca TODO porque el archivo todavía no existe. */
  readonly rutaDePruebaTODO: string
  /** Versión donde se arregló. `null` mientras no se haya arreglado. */
  readonly versionArreglada: string | null
  readonly primeraVez: string
  readonly ultimaVez: string
  readonly vecesVisto: number
}

export type MotivoDeRechazo =
  | 'sin_reproduccion'
  | 'sin_invariante'
  | 'familia_inexistente'
  | 'no_resuelto'
  | 'invariante_trivial'

export type ResultadoCandidato =
  | { readonly ok: true; readonly candidato: CandidatoDeRegresion }
  | { readonly ok: false; readonly motivos: readonly MotivoDeRechazo[]; readonly porQue: string }

export interface EntradaDeCandidato {
  readonly grupo: GrupoIncidente
  readonly estado: EstadoRemediacion
  readonly claseDeCausaRaiz: string
  readonly reproduccionMinima: readonly string[]
  readonly invarianteEsperado: string
  readonly duenoDeLaPrueba: string
  readonly versionArreglada?: string | null
}

/**
 * Un invariante que no dice nada.
 *
 * «No debe fallar», «debe funcionar», «no debe romperse»: son deseos, no
 * invariantes. Un invariante nombra QUÉ tiene que seguir siendo cierto y sobre
 * QUÉ. La heurística es tosca a propósito —caza las frases más comunes y exige
 * longitud— y su trabajo no es juzgar la calidad sino frenar el candidato vacío
 * que alguien rellena para cerrar un ticket.
 */
function invarianteTrivial(s: string): boolean {
  const t = s.trim().toLowerCase()
  if (t.length < 25) return true
  return /^(no debe fallar|debe funcionar|no debe romperse|que no vuelva a pasar)\.?$/.test(t)
}

/**
 * Convierte un incidente resuelto en candidato a prueba de regresión.
 *
 * Se NIEGA cuando falta lo que hace que una prueba valga. Devolver un candidato
 * a medias sería peor que no devolver nada: alguien escribiría la prueba desde
 * él y quedaría una prueba que pasa siempre.
 */
export function candidatoDeRegresion(e: EntradaDeCandidato): ResultadoCandidato {
  const motivos: MotivoDeRechazo[] = []

  const resuelto = e.estado.fase === 'resuelto'
    || e.estado.fase === 'regresion_pendiente'
    || e.estado.fase === 'regresion_enlazada'
  if (!resuelto) motivos.push('no_resuelto')

  if (!e.reproduccionMinima.length) motivos.push('sin_reproduccion')
  if (!e.invarianteEsperado.trim()) motivos.push('sin_invariante')
  else if (invarianteTrivial(e.invarianteEsperado)) motivos.push('invariante_trivial')
  if (!CLAVES_DE_FAMILIA.includes(e.claseDeCausaRaiz)) motivos.push('familia_inexistente')

  if (motivos.length) {
    return {
      ok: false,
      motivos,
      porQue:
        'No se emite candidato: ' + motivos.map(m => ({
          no_resuelto: 'el incidente todavía no está resuelto',
          sin_reproduccion: 'falta la reproducción mínima — sin ella la prueba no puede fallar sin el arreglo',
          sin_invariante: 'falta el invariante — sin él la prueba mide el arreglo, no la garantía',
          invariante_trivial: 'el invariante es un deseo («no debe fallar»), no una garantía comprobable',
          familia_inexistente: `«${e.claseDeCausaRaiz}» no es una familia de calidad/familias-de-defecto.ts`,
        })[m]).join('; '),
    }
  }

  return {
    ok: true,
    candidato: {
      firma: e.grupo.firma,
      familia: e.grupo.familia,
      claseDeCausaRaiz: e.claseDeCausaRaiz,
      reproduccionMinima: e.reproduccionMinima,
      invarianteEsperado: e.invarianteEsperado.trim(),
      duenoDeLaPrueba: e.duenoDeLaPrueba,
      /**
       * Nombre derivado de la firma, con `TODO` delante: el archivo NO existe.
       * Un nombre que parece existir se cita en el ledger y luego nadie encuentra
       * el archivo — que es la forma en que una prueba prometida deja de existir.
       */
      rutaDePruebaTODO: `TODO:src/__tests__/incidente-${e.grupo.categoria}-${e.grupo.subtipo}.test.ts`,
      versionArreglada: e.versionArreglada ?? null,
      primeraVez: e.grupo.firstSeen,
      ultimaVez: e.grupo.lastSeen,
      vecesVisto: e.grupo.count,
    },
  }
}

/**
 * La línea que se pega en `docs/audit/regression-ledger.md`.
 *
 * No la escribe sola: la deja lista. El ledger lo edita una persona porque su
 * valor está en la explicación de la causa raíz, y eso no se genera.
 */
export function borradorDeLedger(c: CandidatoDeRegresion): string {
  return [
    `**Firma.** \`${c.firma}\``,
    `**Familia de defecto.** ${c.claseDeCausaRaiz}`,
    `**Visto.** ${c.vecesVisto} vez/veces, de ${c.primeraVez} a ${c.ultimaVez}.`,
    `**Reproducción mínima.**`,
    ...c.reproduccionMinima.map(p => `  - ${p}`),
    `**Invariante que la prueba debe comprobar.** ${c.invarianteEsperado}`,
    `**Dueño de la prueba.** ${c.duenoDeLaPrueba}`,
    `**Prueba.** ${c.rutaDePruebaTODO} — pendiente de escribir; probar AL REVÉS antes de darla por buena.`,
    `**Arreglado en.** ${c.versionArreglada ?? 'PENDIENTE'}`,
    `**Qué NO cubre.** PENDIENTE de declarar por quien escriba la prueba.`,
  ].join('\n')
}

export const POR_QUE_NO_SE_GENERA_LA_PRUEBA_SOLA =
  'Porque una prueba escrita por una máquina para cerrar un ticket mide lo que ' +
  'el arreglo hace, no lo que el sistema debe garantizar. Pasa siempre, no puede ' +
  'fallar, y a los seis meses alguien la borra por trivial — llevándose con ella ' +
  'la única defensa contra ese defecto.'

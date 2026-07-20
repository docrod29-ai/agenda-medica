import type { InterpretacionAntibiograma, ResultadoAntibiograma } from './tipos'
import { norm, casaAlguno } from './util'
import { esIntrinsecamenteResistente } from './intrinseca'

/**
 * Comprueba que el texto del LLM no contradiga al motor determinista.
 *
 * POR QUÉ HACE FALTA: la regla anti-contradicción existía **solo como texto del
 * prompt** ("NO contradigas las categorías del motor"). El texto que devolvía el
 * modelo se mostraba tal cual, sin ninguna verificación posterior. Nada impedía
 * que recomendara un fármaco que el panel reporta R, que el motor puso en su lista
 * de "evitar", o al que la especie es intrínsecamente resistente — y con la segunda
 * opinión activada se muestran dos narrativas que además podían divergir entre sí.
 *
 * El motor es la autoridad sobre los HECHOS; el modelo aporta juicio. Esta función
 * no reescribe el texto ni lo censura: **anota** las contradicciones para que se
 * muestren junto al razonamiento. Suprimir el texto sería peor —el médico perdería
 * el razonamiento entero por una frase— y reescribirlo sería poner al validador a
 * hacer clínica.
 *
 * Puro y determinista → testeable.
 */

export interface ContradiccionIA {
  agente: string
  motivo: string
}

/** Aparece el fármaco recomendado como línea de tratamiento en el texto del LLM. */
function mencionadoComoTratamiento(texto: string, agente: string): boolean {
  const t = norm(texto)
  const a = norm(agente)
  if (!a || a.length < 4) return false
  if (!t.includes(a)) return false
  /**
   * Se descartan las menciones que son justamente la advertencia. Si el texto dice
   * "evitar ceftriaxona", eso NO es una contradicción: es el modelo coincidiendo
   * con el motor.
   */
  const i = t.indexOf(a)
  const contexto = t.slice(Math.max(0, i - 60), i)
  return !/(evitar|no usar|no dar|contraindic|no se recomienda|descartar|en contra de|salvo|excepto)/.test(contexto)
}

/**
 * Devuelve las contradicciones detectadas entre el texto del modelo y los hechos
 * del motor. Lista vacía = coherente.
 */
export function validarRazonamiento(
  texto: string,
  interpretacion: InterpretacionAntibiograma,
  entrada: { organismo: string; resultados: ResultadoAntibiograma[] },
): ContradiccionIA[] {
  if (!texto?.trim()) return []
  const out: ContradiccionIA[] = []
  const vistos = new Set<string>()

  const anotar = (agente: string, motivo: string) => {
    const k = norm(agente)
    if (!k || vistos.has(k)) return
    vistos.add(k)
    out.push({ agente, motivo })
  }

  // 1. Fármacos que el panel reporta R y el texto propone como tratamiento.
  for (const fila of entrada.resultados) {
    if (fila.interpretacion !== 'R') continue
    if (mencionadoComoTratamiento(texto, fila.antibiotico)) {
      anotar(fila.antibiotico, `el panel lo reporta R`)
    }
  }

  // 2. Fármacos que el motor puso explícitamente en "evitar".
  for (const t of interpretacion.terapiaDirigida ?? []) {
    if (t.linea !== 'evitar') continue
    if (mencionadoComoTratamiento(texto, t.agente)) {
      anotar(t.agente, `el motor lo marcó como "evitar": ${t.razon}`)
    }
  }

  // 3. Resistencia intrínseca de la especie.
  for (const fila of entrada.resultados) {
    if (!esIntrinsecamenteResistente(entrada.organismo, fila.antibiotico)) continue
    if (mencionadoComoTratamiento(texto, fila.antibiotico)) {
      anotar(fila.antibiotico, `${entrada.organismo} es intrínsecamente resistente`)
    }
  }

  return out
}

/** ¿El texto recogió las alertas críticas del motor? */
export function omiteAlertasCriticas(texto: string, interpretacion: InterpretacionAntibiograma): boolean {
  const criticas = (interpretacion.alertas ?? []).filter(a => a.nivel === 'critica')
  if (!criticas.length) return false
  const t = norm(texto)
  // Basta con que mencione el concepto central de alguna de ellas.
  return !criticas.some(a => {
    const claves = norm(a.mensaje).split(/[^a-z0-9]+/).filter(w => w.length >= 6)
    return claves.slice(0, 6).some(w => t.includes(w))
  })
}

/** Reexport para que los consumidores no tengan que importar de util. */
export { casaAlguno }

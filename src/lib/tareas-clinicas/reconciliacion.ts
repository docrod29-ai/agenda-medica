/**
 * RECONCILIACIÓN DE MEDICAMENTOS — §F3 del charter.
 *
 *     DISCREPANCIA → DUEÑO → REVISIÓN → RESOLUCIÓN → CERRADA
 *
 * ── EL AGUJERO QUE TAPA ─────────────────────────────────────────────────────
 *
 * El paciente dice en la consulta:
 *
 *     «el losartán ya lo dejé»
 *     «la metformina me la subieron a 850»
 *     «también estoy tomando algo para la tiroides»
 *
 * Y el expediente **sigue diciendo lo de antes**. Para siempre. Porque nada en
 * el sistema convierte «lo dejé» en un cambio de la lista.
 *
 * A partir de la siguiente consulta esa lista es la que alimenta:
 *
 *   · el cruce de interacciones
 *   · el cruce alergia ↔ fármaco
 *   · el motor de dosis
 *   · la receta que se imprime
 *
 * Una lista de medicamentos desactualizada **no es un dato viejo: es un motor de
 * seguridad razonando sobre un paciente que no existe.**
 *
 * ── POR QUÉ ES UNA TAREA Y NO UN CAMBIO AUTOMÁTICO ──────────────────────────
 *
 * El sistema **no corrige la lista solo**. Detecta la discrepancia, le pone
 * dueño y la deja abierta hasta que un humano decida. Tres razones:
 *
 * 1. El paciente puede equivocarse: «ya lo dejé» dicho del genérico cuando sigue
 *    tomando la marca.
 * 2. El reconocedor puede transcribir mal el nombre.
 * 3. Suspender un anticoagulante o un antiepiléptico **es un acto médico**.
 *
 * El charter lo dice en §C3: *no elegir la verdad automáticamente*. Aquí se
 * cumple al pie de la letra.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
 *
 * No decide si el paciente debe o no seguir con el fármaco. No calcula
 * equivalencias. No juzga la dosis nueva. **Sólo dice: esto que oí no coincide
 * con lo que está escrito, y alguien tiene que mirarlo.**
 *
 * Módulo PURO, sin dependencias de red ni de framework.
 */
import { esIncierto } from '@/lib/expediente/certeza'
import { deQuienEs } from '@/lib/expediente/experienciador'

/** Qué clase de desacuerdo hay entre lo dicho y lo escrito. */
export type ClaseDeDiscrepancia =
  /** El paciente dice que ya no lo toma y la lista lo tiene vigente. */
  | 'ya_no_lo_toma'
  /** El paciente nombra una dosis distinta de la registrada. */
  | 'dosis_distinta'
  /** El paciente menciona un fármaco que no está en la lista. */
  | 'no_esta_en_la_lista'

export interface Discrepancia {
  clase: ClaseDeDiscrepancia
  /** El fármaco, tal como se pudo identificar. */
  farmaco: string
  /** Lo que dice la lista hoy, cuando aplica. */
  enLaLista?: string
  /** Lo que se oyó en la consulta. */
  loQueSeDijo: string
  /** La frase completa, para que el médico juzgue con el contexto. */
  frase: string
}

/** Un medicamento de la lista vigente del paciente. */
export interface MedicamentoVigente {
  nombre: string
  dosis?: string
  unidad?: string
}

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * «ya no lo toma»: las formas en que un paciente mexicano dice que suspendió.
 *
 * Se reutiliza el vocabulario que el motor de temporalidad ya tenía probado, en
 * vez de escribir un cuarto parser de lo mismo — que es la familia de defecto
 * más cara de este repositorio (ADR-001).
 */
const CESE = /\b(?:ya\s+no\s+(?:lo\s+|la\s+|las\s+|los\s+)?(?:tomo|toma|estoy\s+tomando|uso)|(?:lo|la|los|las)\s+dej[eé]|dej[eé]\s+de\s+(?:tomar|usar)|me\s+(?:(?:lo|la)\s+)?(?:quitaron|suspendieron|cambiaron)|suspend[ií](?:eron)?|ya\s+no\s+me\s+(?:lo|la)\s+dan)/iu

/** «me la subieron a 850», «ahora tomo 50». */
const CAMBIO_DE_DOSIS = /\b(?:me\s+(?:lo|la)\s+(?:subieron|bajaron|cambiaron)\s+a|ahora\s+(?:tomo|son|es)|me\s+dijeron\s+que\s+tomara)\b/iu

/**
 * Una cifra de dosis, **con unidad o sin ella**.
 *
 * Medido con frases reales: «la metformina me la subieron a 850» es la forma
 * normal de decirlo, y **no lleva unidad**. Exigirla dejaba pasar el caso más
 * frecuente de cambio de dosis entero.
 *
 * La unidad se captura cuando está, porque sirve para el texto del aviso; pero
 * no se exige, porque el paciente no la dice.
 */
const DOSIS_EN_TEXTO = /(\d+(?:[.,]\d+)?)\s*(mg|g|mcg|ml|ui|miligramos?|gramos?|microgramos?|mililitros?|unidades)?/iu

/**
 * ¿Este fármaco se menciona en esta frase?
 *
 * Por raíz de 5 letras: el paciente dice «el losartán» y la lista guarda
 * «Losartán 50 mg», y una comparación exacta no encuentra nada.
 */
function mencionaAlFarmaco(frase: string, nombre: string): boolean {
  const f = norm(frase)
  const n = norm(nombre)
  if (!n) return false
  const raiz = n.split(/\s+/)[0]
  if (raiz.length < 5) return f.includes(raiz)
  return f.includes(raiz.slice(0, 5))
}

/** Parte el dictado en frases, igual que los demás motores del expediente. */
function frasesDe(texto: string): string[] {
  return String(texto ?? '')
    .split(/(?<=[.;:!?])\s+|\n+/u)
    .map(f => f.trim())
    .filter(Boolean)
}

/**
 * Compara lo que se dijo en la consulta contra la lista vigente.
 *
 * ── LOS TRES FILTROS QUE EVITAN EL AVISO INÚTIL ─────────────────────────────
 *
 * Un worklist que se llena de tareas que nadie pidió se abandona en una semana
 * —y entonces tampoco se ve la que sí importaba—. Así que **no** genera
 * discrepancia cuando:
 *
 * 1. La frase habla de un FAMILIAR («a mi mamá le quitaron el losartán»).
 * 2. La frase está dicha con DUDA («creo que ya no lo tomo»): eso es una
 *    pregunta para el médico, no un hecho que contradiga la lista.
 * 3. El fármaco se está recetando HOY: si el médico lo tiene delante y lo
 *    prescribe, ya lo reconcilió con su criterio.
 */
export function discrepanciasDeMedicacion(p: {
  dictado: string
  vigentes: readonly MedicamentoVigente[]
  /** Lo que el médico prescribe en ESTA consulta: ya está reconciliado. */
  recetadosHoy?: readonly { nombre: string }[]
}): Discrepancia[] {
  const { dictado, vigentes } = p
  const recetadosHoy = p.recetadosHoy ?? []
  if (!dictado?.trim() || !vigentes.length) return []

  const out: Discrepancia[] = []
  const yaVisto = new Set<string>()

  for (const frase of frasesDe(dictado)) {
    // Filtro 1 y 2: no es del paciente, o no es un hecho.
    if (deQuienEs(frase).quien === 'familiar') continue
    if (esIncierto(frase)) continue

    for (const med of vigentes) {
      if (!mencionaAlFarmaco(frase, med.nombre)) continue
      // Filtro 3: el médico lo está recetando hoy.
      if (recetadosHoy.some(r => mencionaAlFarmaco(r.nombre, med.nombre))) continue

      const clave = `${norm(med.nombre)}`
      if (yaVisto.has(clave)) continue

      if (CESE.test(frase)) {
        yaVisto.add(clave)
        out.push({
          clase: 'ya_no_lo_toma',
          farmaco: med.nombre,
          enLaLista: [med.dosis, med.unidad].filter(Boolean).join(' ') || undefined,
          loQueSeDijo: 'lo suspendió',
          frase,
        })
        continue
      }

      const dosisDicha = DOSIS_EN_TEXTO.exec(frase)
      if (CAMBIO_DE_DOSIS.test(frase) && dosisDicha && med.dosis) {
        const dichaNum = dosisDicha[1].replace(',', '.')
        if (norm(dichaNum) !== norm(med.dosis)) {
          yaVisto.add(clave)
          out.push({
            clase: 'dosis_distinta',
            farmaco: med.nombre,
            enLaLista: [med.dosis, med.unidad].filter(Boolean).join(' ') || undefined,
            loQueSeDijo: `${dosisDicha[1]}${dosisDicha[2] ? ' ' + dosisDicha[2] : ''}`,
            frase,
          })
        }
      }
    }
  }

  return out
}

/** El texto del aviso y de la tarea. Se escribe una vez y se usa en los dos. */
export function comoSeDice(d: Discrepancia): string {
  switch (d.clase) {
    case 'ya_no_lo_toma':
      return `El paciente dice que ya no toma ${d.farmaco}` +
        (d.enLaLista ? `, y sigue en su lista como ${d.enLaLista}` : ', y sigue en su lista') +
        '. Confírmalo antes de que los motores sigan contando con él.'
    case 'dosis_distinta':
      return `El paciente refiere ${d.farmaco} ${d.loQueSeDijo}` +
        (d.enLaLista ? `, y en su lista está como ${d.enLaLista}` : '') +
        '. Reconcilia cuál es la vigente.'
    case 'no_esta_en_la_lista':
      return `El paciente menciona ${d.farmaco} y no está en su lista de medicamentos.`
  }
}

export const POR_QUE_IMPORTA =
  'Una lista de medicamentos desactualizada no es un dato viejo: es un motor de ' +
  'seguridad razonando sobre un paciente que no existe. De esa lista cuelgan el ' +
  'cruce de interacciones, el de alergias, el motor de dosis y la receta.'

export const POR_QUE_NO_SE_CORRIGE_SOLO =
  'El paciente puede equivocarse, el reconocedor puede transcribir mal el ' +
  'nombre, y suspender un anticoagulante o un antiepiléptico es un acto médico. ' +
  'El §C3 lo dice: no elegir la verdad automáticamente.'

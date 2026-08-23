/**
 * CONCILIAR — comparar lo que había con lo que volvió, documento a documento.
 *
 * ── LO QUE `simulacro.ts` YA HACE, Y LO QUE LE FALTABA ───────────────────────
 *
 * `simularRestauracion` corre el archivo entero por el camino de vuelta con las
 * MISMAS funciones que usa la importación, y cuenta: líneas, restaurables,
 * excluidos, rechazadas, cabecera, pie, y documentos por colección. Es la
 * comprobación de que el archivo se puede volver a leer.
 *
 * Lo que no puede hacer —porque sólo ve un lado— es responder a la pregunta que
 * importa el día malo: **¿volvió lo que había?** Para eso hacen falta dos
 * fotografías y compararlas:
 *
 *     BASE (antes del incidente)  ⟷  DESPUÉS (tras la restauración)
 *
 * De esa comparación salen las cinco pérdidas que #312 exige detectar y que un
 * recuento nunca ve:
 *
 *   FALTA        estaba y no volvió.
 *   SOBRA        volvió algo que no estaba (duplicado con otra identidad).
 *   DIFIERE      volvió con otro contenido.
 *   RANCIO       volvió una versión ANTERIOR encima de una posterior.
 *   FORASTERO    volvió con referencias a otro consultorio.
 *
 * ── POR QUÉ NO SE COMPARA CONTENIDO, SINO HUELLAS ───────────────────────────
 *
 * Porque el arnés se corre sobre datos que, el día que se use con un respaldo
 * de verdad, serán PHI. Comparando huellas se puede decir «este documento
 * cambió» sin sacar ni una letra del expediente al informe. Es la misma regla
 * que `scripts/verificar-invariantes-de-datos.md`: sobre datos reales se
 * cuentan recuentos, nunca contenido.
 *
 * Módulo PURO.
 */

/** La foto de un documento: su identidad, su contenido y su frescura. */
export interface FotoDeDocumento {
  /** Identidad: la ruta completa. */
  ruta: string
  /** Contenido: huella. Nunca el documento. */
  huella: string
  /** Colección en punto, para agrupar. */
  coleccion: string
  /** Marca de tiempo del documento, si la tiene (ISO). */
  fecha: string | null
  /** El documento es firmado o de sólo-añadir. */
  esInmutable: boolean
}

export type ClaseDePerdida = 'FALTA' | 'SOBRA' | 'DIFIERE' | 'RANCIO' | 'FORASTERO'

export interface Perdida {
  clase: ClaseDePerdida
  ruta: string
  coleccion: string
  /** Grave cuando toca verdad firmada o linaje. */
  severidad: 'P0' | 'P1' | 'P2'
  porQue: string
}

export interface Reconciliacion {
  /** Cuántos documentos había y cuántos hay. */
  base: number
  despues: number
  /** Volvieron idénticos. */
  intactos: number
  perdidas: Perdida[]
  /** Por colección: base, después, y diferencia. */
  porColeccion: Record<string, { base: number; despues: number; delta: number }>
  /** Resumen por clase de pérdida. */
  porClase: Record<ClaseDePerdida, number>
  /** `true` si no hay ninguna pérdida de ninguna clase. */
  limpia: boolean
}

/**
 * ¿Un documento de esta colección merece P0 cuando algo le pasa?
 *
 * La lista es corta a propósito: son las tres cosas cuya pérdida no se puede
 * compensar con otra cosa. Una cita perdida se vuelve a agendar; una adenda
 * perdida es una corrección legal que ya no existe.
 */
export function severidadDe(coleccion: string, esInmutable: boolean): 'P0' | 'P1' | 'P2' {
  if (coleccion === 'patients.notas.adendas') return 'P0'
  if (coleccion === 'patients.notas' && esInmutable) return 'P0'
  if (coleccion === 'patients.notas.versions') return 'P1'
  if (coleccion === 'audit_log') return 'P1'
  if (coleccion.startsWith('patients')) return 'P1'
  if (coleccion === 'appointments') return 'P1'
  return 'P2'
}

/**
 * Compara las dos fotografías.
 *
 * @param base lo que había antes del incidente.
 * @param despues lo que hay tras restaurar.
 * @param forasteras rutas que el análisis de aislamiento marcó como
 *   contaminadas. Se pasan aparte porque esa comprobación mira DENTRO del
 *   documento y ésta sólo compara huellas.
 */
export function reconciliar(
  base: readonly FotoDeDocumento[],
  despues: readonly FotoDeDocumento[],
  forasteras: readonly string[] = [],
): Reconciliacion {
  const antes = new Map(base.map(f => [f.ruta, f]))
  const ahora = new Map(despues.map(f => [f.ruta, f]))
  const perdidas: Perdida[] = []
  let intactos = 0

  for (const [ruta, a] of antes) {
    const d = ahora.get(ruta)
    if (!d) {
      perdidas.push({
        clase: 'FALTA', ruta, coleccion: a.coleccion,
        severidad: severidadDe(a.coleccion, a.esInmutable),
        porQue: 'estaba antes del incidente y no volvió con la restauración.',
      })
      continue
    }
    if (d.huella === a.huella) { intactos++; continue }

    /**
     * ── EL RANCIO ES PEOR QUE EL QUE DIFIERE ────────────────────────────────
     *
     * «Difiere» puede ser una restauración incompleta. «Rancio» es que la
     * restauración escribió una versión ANTERIOR encima de una posterior: no
     * es una pérdida del incidente, es una pérdida que causó la recuperación.
     */
    const tA = a.fecha ? Date.parse(a.fecha) : NaN
    const tD = d.fecha ? Date.parse(d.fecha) : NaN
    if (Number.isFinite(tA) && Number.isFinite(tD) && tD < tA) {
      perdidas.push({
        clase: 'RANCIO', ruta, coleccion: a.coleccion,
        severidad: severidadDe(a.coleccion, a.esInmutable),
        porQue: `volvió una versión anterior (${d.fecha}) encima de la que había (${a.fecha}): la restauración retrocedió el documento.`,
      })
      continue
    }
    perdidas.push({
      clase: 'DIFIERE', ruta, coleccion: a.coleccion,
      severidad: severidadDe(a.coleccion, a.esInmutable),
      porQue: a.esInmutable
        ? 'documento firmado o de sólo-añadir cuyo contenido cambió al restaurar. Eso es una alteración, no una recuperación.'
        : 'volvió con contenido distinto del que había.',
    })
  }

  for (const [ruta, d] of ahora) {
    if (antes.has(ruta)) continue
    perdidas.push({
      clase: 'SOBRA', ruta, coleccion: d.coleccion,
      severidad: d.coleccion === 'appointments' ? 'P1' : severidadDe(d.coleccion, d.esInmutable),
      porQue: 'apareció un documento que no estaba antes del incidente: o es un duplicado con otra identidad, o la restauración trajo algo de otro sitio.',
    })
  }

  const forasterasSet = new Set(forasteras)
  for (const ruta of forasterasSet) {
    const d = ahora.get(ruta)
    perdidas.push({
      clase: 'FORASTERO', ruta, coleccion: d?.coleccion ?? '(desconocida)',
      severidad: 'P0',
      porQue: 'el documento quedó escrito en este consultorio con referencias internas a otro. La ruta se re-enraizó; el contenido, no.',
    })
  }

  const porColeccion: Reconciliacion['porColeccion'] = {}
  for (const f of base) {
    porColeccion[f.coleccion] ??= { base: 0, despues: 0, delta: 0 }
    porColeccion[f.coleccion].base++
  }
  for (const f of despues) {
    porColeccion[f.coleccion] ??= { base: 0, despues: 0, delta: 0 }
    porColeccion[f.coleccion].despues++
  }
  for (const v of Object.values(porColeccion)) v.delta = v.despues - v.base

  const porClase: Record<ClaseDePerdida, number> = {
    FALTA: 0, SOBRA: 0, DIFIERE: 0, RANCIO: 0, FORASTERO: 0,
  }
  for (const p of perdidas) porClase[p.clase]++

  return {
    base: base.length, despues: despues.length, intactos,
    perdidas, porColeccion, porClase,
    limpia: perdidas.length === 0,
  }
}

/**
 * Duplicados por CONTENIDO dentro de una misma colección.
 *
 * Distinto de `SOBRA`: aquí las dos copias tienen identidades legítimas
 * distintas y el mismo contenido. Es el modo en que se duplica una cita cuando
 * un reintento la vuelve a crear con otro identificador — el caso que #320
 * llama «duplicate-booking rate» y que un recuento total nunca ve, porque el
 * total sube y parece que se restauró de más.
 */
export function duplicadosPorContenido(
  fotos: readonly FotoDeDocumento[], colecciones: readonly string[] = ['appointments', 'cobros'],
): { coleccion: string; huella: string; rutas: string[] }[] {
  const porHuella = new Map<string, FotoDeDocumento[]>()
  for (const f of fotos) {
    if (!colecciones.includes(f.coleccion)) continue
    const k = `${f.coleccion}|${f.huella}`
    const lista = porHuella.get(k) ?? []
    lista.push(f)
    porHuella.set(k, lista)
  }
  const out: { coleccion: string; huella: string; rutas: string[] }[] = []
  for (const [k, lista] of porHuella) {
    if (lista.length < 2) continue
    const [coleccion, huella] = k.split('|')
    out.push({ coleccion, huella, rutas: lista.map(f => f.ruta).sort() })
  }
  return out.sort((a, b) => a.rutas[0].localeCompare(b.rutas[0]))
}

export const POR_QUE_LOS_CONTEOS_NO_BASTAN =
  'Faltan tres citas y sobran tres notas duplicadas: el total cuadra y el ' +
  'expediente está roto. Conciliar es comparar identidad por identidad, no ' +
  'sumar. El recuento sirve para saber que hay que mirar; la comparación, para ' +
  'saber qué.'

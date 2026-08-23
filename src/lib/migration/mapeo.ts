/**
 * DE LAS COLUMNAS DEL ARCHIVO A LOS CAMPOS DEL EXPEDIENTE.
 *
 * ── LO QUE ESTE MÓDULO **NO** HACE ───────────────────────────────────────────
 *
 * No inventa una tabla de sinónimos nueva. `csv-pacientes.ts` ya tiene la suya y
 * la usa la pantalla de Migración desde hace versiones; duplicarla aquí crearía
 * dos definiciones de «cómo se llama la columna del teléfono» que se separarían
 * al primer arreglo. Se llama a `mapearEncabezados` y se construye ENCIMA.
 *
 * ── LO QUE SÍ AÑADE, Y POR QUÉ HACE FALTA ────────────────────────────────────
 *
 *  1. **La columna desconocida se CONSERVA.** El mapeo de base devuelve `null` y
 *     ahí se acababa: la columna «Padecimiento actual» de un sistema viejo
 *     desaparecía sin que nadie supiera que existió. Aquí `null` produce una
 *     columna `desconocida` que viaja hasta la procedencia — el dato de origen
 *     se guarda tal cual, sin interpretarlo, y el informe la nombra.
 *
 *  2. **Dos columnas al mismo campo son un CONFLICTO, no un ganador.** Un export
 *     con «Celular» y «Teléfono» mapea las dos a `telefono`; quedarse con la
 *     última —que es lo que hace un `Object.assign` -- tira la primera en
 *     silencio. Se marcan las dos y decide el médico.
 *
 *  3. **El mapeo tiene VERSIÓN.** Es lo que hace que el ensayo sea reproducible:
 *     «mismo archivo + mismo mapeo → mismo resultado» no significa nada si el
 *     mapeo no se puede nombrar y guardar.
 *
 * Módulo PURO.
 */
import type { Patient } from '@/types'
import { mapearEncabezados } from '@/lib/csv-pacientes'

/**
 * Los campos del paciente que la migración sabe llenar hoy.
 *
 * Es un subconjunto ESTRECHO a propósito. `Patient` tiene consentimientos,
 * versiones de token del portal y contadores de inasistencia: nada de eso puede
 * salir de un CSV de otro sistema, y dejar que el mapeo apunte ahí permitiría
 * que una columna llamada «consentimiento» fabricara un consentimiento que el
 * paciente nunca dio.
 */
export const CAMPOS_MIGRABLES = [
  'nombre', 'telefono', 'whatsapp', 'email', 'fechaNacimiento',
  'sexo', 'curp', 'seguroMedico', 'alergias', 'notas',
] as const satisfies readonly (keyof Patient)[]

export type CampoMigrable = (typeof CAMPOS_MIGRABLES)[number]

const ES_MIGRABLE = new Set<string>(CAMPOS_MIGRABLES)

/**
 * Versión del mapeo automático. Sube cuando cambien los sinónimos o los campos.
 *
 * Se guarda con el trabajo de importación: un informe de hace seis meses tiene
 * que poder decir con qué reglas se produjo, o no se puede reproducir ni
 * discutir.
 */
export const VERSION_MAPEO = '2026-08-23.1'

/** Qué se hizo con una columna del archivo. */
export type ColumnaMapeada =
  | { readonly clase: 'campo'; readonly indice: number; readonly encabezado: string; readonly campo: CampoMigrable }
  | { readonly clase: 'desconocida'; readonly indice: number; readonly encabezado: string }
  | { readonly clase: 'conflicto'; readonly indice: number; readonly encabezado: string; readonly campo: CampoMigrable; readonly compiteCon: readonly number[] }
  /** Columna sin encabezado. No se adivina a qué corresponde por su posición. */
  | { readonly clase: 'sin-encabezado'; readonly indice: number }

export interface Mapeo {
  readonly version: string
  readonly columnas: readonly ColumnaMapeada[]
  /** Campos que quedaron mapeados sin conflicto. Ordenado, para poder compararlo. */
  readonly camposResueltos: readonly CampoMigrable[]
  /** Encabezados que no correspondieron a nada. Van al informe, no al olvido. */
  readonly desconocidas: readonly string[]
  /** `true` si hay algún conflicto sin resolver: el ensayo lo señala y no avanza solo. */
  readonly hayConflictos: boolean
}

/**
 * Mapeo automático de un encabezado, con las decisiones dudosas marcadas.
 *
 * `forzado` permite al médico decir «esta columna es la fecha de nacimiento»
 * después de mirar el ensayo. Manda sobre lo automático SIEMPRE: es un dato
 * suyo, no una heurística nuestra.
 */
export function mapear(
  encabezados: readonly string[],
  forzado: Readonly<Record<number, CampoMigrable | 'ignorar'>> = {},
): Mapeo {
  const automatico = mapearEncabezados([...encabezados])

  // 1. Primera pasada: qué querría ser cada columna.
  const intencion: (CampoMigrable | null)[] = encabezados.map((_, i) => {
    const f = forzado[i]
    if (f === 'ignorar') return null
    if (f) return f
    const a = automatico[i]
    return a && ES_MIGRABLE.has(a) ? (a as CampoMigrable) : null
  })

  // 2. Quién compite con quién. Se agrupa por campo ANTES de decidir nada: un
  //    conflicto sólo se ve mirando todas las columnas a la vez.
  const porCampo = new Map<CampoMigrable, number[]>()
  intencion.forEach((campo, i) => {
    if (!campo) return
    const l = porCampo.get(campo)
    if (l) l.push(i)
    else porCampo.set(campo, [i])
  })

  /**
   * Un forzado GANA un conflicto: si el médico dijo cuál es el teléfono, la otra
   * columna deja de competir. Sin esto, el conflicto sería irresoluble desde la
   * pantalla y el archivo se quedaría atascado para siempre.
   */
  for (const [campo, indices] of porCampo) {
    if (indices.length < 2) continue
    const forzados = indices.filter(i => forzado[i] === campo)
    if (forzados.length === 1) porCampo.set(campo, forzados)
  }

  const columnas: ColumnaMapeada[] = encabezados.map((encabezado, indice) => {
    if (encabezado.trim() === '') return { clase: 'sin-encabezado', indice }
    const campo = intencion[indice]
    if (!campo) return { clase: 'desconocida', indice, encabezado }
    const grupo = porCampo.get(campo) ?? []
    if (!grupo.includes(indice)) return { clase: 'desconocida', indice, encabezado }
    if (grupo.length > 1) {
      return { clase: 'conflicto', indice, encabezado, campo, compiteCon: grupo.filter(i => i !== indice) }
    }
    return { clase: 'campo', indice, encabezado, campo }
  })

  const camposResueltos = columnas
    .filter((c): c is Extract<ColumnaMapeada, { clase: 'campo' }> => c.clase === 'campo')
    .map(c => c.campo)
    .sort()

  return {
    version: VERSION_MAPEO,
    columnas,
    camposResueltos,
    desconocidas: columnas
      .filter((c): c is Extract<ColumnaMapeada, { clase: 'desconocida' }> => c.clase === 'desconocida')
      .map(c => c.encabezado),
    hayConflictos: columnas.some(c => c.clase === 'conflicto'),
  }
}

/**
 * El nombre es lo ÚNICO sin lo cual no se puede abrir un expediente.
 *
 * No es una opinión de producto: sin nombre no hay a quién atribuirle la nota, y
 * un expediente anónimo no se puede buscar, ni entregar en un ARCO, ni fusionar
 * después. Lo demás falta y ya; esto impide empezar.
 */
export function faltaIdentidad(m: Mapeo): boolean {
  return !m.camposResueltos.includes('nombre')
}

/**
 * Huella del mapeo — para atar un ensayo a la decisión que lo produjo.
 *
 * Dos ensayos con la misma huella y el mismo archivo TIENEN que dar el mismo
 * resultado. Esa es la propiedad que se prueba, y sin una huella estable no hay
 * forma de comprobarla.
 */
export function huellaDeMapeo(m: Mapeo): string {
  const partes = m.columnas.map(c =>
    c.clase === 'campo' ? `${c.indice}=${c.campo}`
      : c.clase === 'conflicto' ? `${c.indice}!${c.campo}`
        : c.clase === 'sin-encabezado' ? `${c.indice}~`
          : `${c.indice}?`,
  )
  return `${m.version}|${partes.join(',')}`
}

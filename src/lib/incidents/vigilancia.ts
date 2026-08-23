/**
 * QUÉ INCIDENTES DE PLATAFORMA DEBE ESCALAR EL VIGILANTE.
 *
 * `platform_incidentes` ya agrupa los fallos por proveedor/clase/hora. Este
 * módulo decide qué grupos son NUEVOS para el vigilante sin guardar PHI ni
 * convertir cada ejecución de 15 minutos en otra alerta del mismo incidente.
 *
 * Regla: se consideran sólo la hora UTC actual y la anterior. Un grupo nuevo se
 * avisa una vez; si el mismo fallo continúa en una hora nueva, obtiene otro id y
 * puede volver a avisarse. La marca que se guarda en el latido contiene sólo ids
 * técnicos, nunca contenido clínico.
 *
 * Módulo puro: el acceso a Firestore y el envío viven en cron/vigilante.
 */

export const MAX_INCIDENTES_RECORDADOS = 100

export interface IncidentePersistidoParaVigilar {
  id?: unknown
  hora?: unknown
  urgente?: unknown
  titulo?: unknown
  proveedor?: unknown
  clase?: unknown
  veces?: unknown
}

export interface IncidenteVigilable {
  id: string
  hora: string
  urgente: boolean
  titulo: string
  proveedor: string
  clase: string
  veces: number
}

function etiqueta(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const limpia = v.replace(/[\r\n\t]/g, ' ').trim().slice(0, 120)
  return limpia || fallback
}

function idSeguro(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const id = v.trim()
  if (!id || id.length > 180 || /[,\r\n]/.test(id)) return null
  return id
}

function horasVigentes(ahoraMs: number): ReadonlySet<string> {
  return new Set([
    new Date(ahoraMs).toISOString().slice(0, 13),
    new Date(ahoraMs - 60 * 60_000).toISOString().slice(0, 13),
  ])
}

function leerMarca(marca: unknown): string[] {
  if (typeof marca !== 'string' || !marca.trim()) return []
  return marca.split(',').map(x => x.trim()).filter(Boolean).slice(-MAX_INCIDENTES_RECORDADOS)
}

/**
 * Devuelve los grupos recientes que todavía no habían sido avisados y una marca
 * PHI-safe para persistir en el siguiente latido del vigilante.
 */
export function incidentesNuevosParaAlerta(
  registros: readonly IncidentePersistidoParaVigilar[],
  marcaAnterior: unknown,
  ahoraMs: number,
): { nuevos: IncidenteVigilable[]; marca: string; activos: number } {
  const horas = horasVigentes(ahoraMs)
  const previos = new Set(leerMarca(marcaAnterior))
  const activos = new Map<string, IncidenteVigilable>()

  for (const r of registros) {
    const id = idSeguro(r.id)
    const hora = typeof r.hora === 'string' ? r.hora.trim() : ''
    if (!id || !horas.has(hora)) continue
    activos.set(id, {
      id,
      hora,
      urgente: r.urgente === true,
      titulo: etiqueta(r.titulo, 'Incidente de plataforma'),
      proveedor: etiqueta(r.proveedor, 'plataforma'),
      clase: etiqueta(r.clase, 'fallo'),
      veces: typeof r.veces === 'number' && Number.isFinite(r.veces) && r.veces > 0
        ? Math.floor(r.veces)
        : 1,
    })
  }

  const nuevos = [...activos.values()]
    .filter(i => !previos.has(i.id))
    .sort((a, b) => a.id.localeCompare(b.id))

  // Conserva memoria reciente aun si una lectura intermedia viene vacía. Los ids
  // incluyen la hora, así que un fallo persistente obtiene un id nuevo al cambiar
  // de hora y puede escalarse otra vez sin repetir cada 15 minutos.
  const recordados = [...new Set([...previos, ...activos.keys()])]
    .slice(-MAX_INCIDENTES_RECORDADOS)

  return { nuevos, marca: recordados.join(','), activos: activos.size }
}

/** Resumen deliberadamente PHI-safe para el webhook del dueño. */
export function resumenIncidentesParaOps(nuevos: readonly IncidenteVigilable[]): string {
  return nuevos
    .slice(0, 20)
    .map(i => `· ${i.proveedor}/${i.clase}: ${i.titulo} (${i.veces} evento${i.veces === 1 ? '' : 's'})`)
    .join('\n')
}

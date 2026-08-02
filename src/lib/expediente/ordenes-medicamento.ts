/**
 * QUÉ ESTÁ TOMANDO EL PACIENTE HOY.
 *
 * ── LA PREGUNTA QUE NADIE PODÍA CONTESTAR ────────────────────────────────────
 *
 * Es la primera pregunta de cualquier consulta, y el expediente no la respondía.
 * Los medicamentos viven dentro de cada nota, así que «lo que toma» era «lo que
 * escribí la última vez que lo vi» — y si en la nota anterior le suspendí el
 * ibuprofeno, esa suspensión no aparecía en ningún sitio salvo leyendo la nota
 * entera.
 *
 * Ahora que la orden tiene estado (`EstadoOrdenMedicamento`), la lista vigente se
 * puede derivar: se recorren las notas de la más nueva a la más vieja y, por cada
 * fármaco, manda **lo que se dijo por última vez**.
 *
 * ── LA REGLA QUE ORDENA ESTE MÓDULO ──────────────────────────────────────────
 *
 * **La nota más reciente que menciona un fármaco es la que manda sobre ese
 * fármaco.** No la más reciente en general: si hoy escribo una nota sin
 * mencionar la metformina, eso no significa que el paciente la haya dejado —
 * significa que hoy no hablé de ella. Interpretar el silencio como suspensión
 * borraría medicación crónica de la lista, que es exactamente el error que
 * produce una interacción no vista.
 *
 * Módulo PURO.
 */
import type { Medicamento, EstadoOrdenMedicamento } from '@/types/expediente'

/**
 * El estado de una orden, tratando la ausencia como «activa».
 *
 * Todo lo prescrito antes de que el campo existiera no lo lleva, y cuando se
 * escribió significaba justamente «está tomando esto». Suponer otra cosa
 * vaciaría de golpe la medicación de todos los expedientes históricos.
 */
export function estadoDeOrden(m: Pick<Medicamento, 'estado'>): EstadoOrdenMedicamento {
  return m.estado ?? 'activa'
}

/** ¿El paciente lo está tomando ahora mismo? */
export function estaVigente(m: Pick<Medicamento, 'estado'>): boolean {
  return estadoDeOrden(m) === 'activa'
}

/** Clave para reconocer «el mismo fármaco» entre notas distintas. */
function claveFarmaco(m: Pick<Medicamento, 'nombre'>): string {
  return String(m.nombre ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Una nota, reducida a lo que hace falta aquí. */
export interface NotaConMedicamentos {
  /** ISO. Ordena qué es «lo último que se dijo». */
  fecha: string
  medicamentos?: Medicamento[]
}

export interface OrdenVigente {
  medicamento: Medicamento
  /** De qué nota salió la última palabra sobre este fármaco. */
  dichoEn: string
}

/**
 * Lo que el paciente está tomando, según la última vez que se habló de cada
 * fármaco.
 *
 * Los borradores se ignoran: una nota sin firmar es lo que el médico está
 * escribiendo ahora, no un hecho del expediente. Incluirla haría que la lista
 * vigente cambiara mientras se teclea.
 */
export function medicamentosVigentes(notas: readonly NotaConMedicamentos[]): OrdenVigente[] {
  const ultimaPalabra = new Map<string, OrdenVigente>()

  // De la más NUEVA a la más vieja: la primera vez que se ve un fármaco es la
  // última cosa que se dijo de él.
  const orden = [...notas].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
  for (const nota of orden) {
    for (const med of nota.medicamentos ?? []) {
      const k = claveFarmaco(med)
      if (!k) continue
      if (estadoDeOrden(med) === 'borrador') continue
      if (ultimaPalabra.has(k)) continue   // ya habló una nota más reciente
      ultimaPalabra.set(k, { medicamento: med, dichoEn: nota.fecha })
    }
  }

  return [...ultimaPalabra.values()]
    .filter(o => estaVigente(o.medicamento))
    .sort((a, b) => claveFarmaco(a.medicamento).localeCompare(claveFarmaco(b.medicamento)))
}

/** Frase corta para el encabezado de la consulta. */
export function resumenVigentes(vigentes: readonly OrdenVigente[]): string {
  if (!vigentes.length) return 'Sin medicación registrada'
  const nombres = vigentes.map(v => v.medicamento.nombre.trim()).filter(Boolean)
  if (nombres.length <= 3) return nombres.join(' · ')
  return `${nombres.slice(0, 3).join(' · ')} y ${nombres.length - 3} más`
}

export const POR_QUE_EL_SILENCIO_NO_SUSPENDE =
  'Porque si hoy escribo una nota sin mencionar la metformina, eso no significa ' +
  'que el paciente la haya dejado: significa que hoy no hablé de ella. ' +
  'Interpretar el silencio como suspensión borraría medicación crónica de la ' +
  'lista, que es exactamente el error que produce una interacción no vista.'

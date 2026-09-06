/**
 * ¿EL IMPORTE TECLEADO SE ALEJA DEMASIADO DEL PRECIO DE LISTA?
 *
 * ── EL FALLO (ASC-010, Panel de Lujo 2026-09, P2) ────────────────────────────
 * El importe se teclea a mano en cada cobro y no había ningún freno de
 * magnitud: $8,000 por una consulta de $800 pasaba igual que $800. Los tres
 * controles que existían (modal, lib, reglas) eran de SIGNO, no de tamaño. La
 * vez de las cuarenta que sale mal, sale mal en silencio.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * Si hay precio de lista y el importe es mayor que `veces` veces ese precio o
 * menor que `1/veces`, se PREGUNTA («¿Seguro que son $8,000? La consulta cuesta
 * $800»). No se bloquea: un cobro grande legítimo existe (paquete, varios
 * procedimientos). Sin precio de lista no hay contra qué comparar y no se
 * pregunta nada: preguntar siempre es lo mismo que no preguntar.
 *
 * El umbral (2× / 0.5×) es la propuesta del auditor aplicada por omisión; es
 * política del dueño, no clínica, y se cambia aquí en un solo sitio
 * (`decisiones-DINERO.md`). Un tope absoluto por consultorio validado en reglas
 * queda como decisión abierta.
 *
 * Módulo PURO.
 */

export const VECES_POR_OMISION = 2

export interface DesvioDeImporte {
  /** ¿Hay que preguntar antes de guardar? */
  preguntar: boolean
  /** Cuántas veces el precio de lista es el importe (redondeado a una decimal). */
  veces: number
  /** La pregunta, lista para enseñar. Vacía cuando no hay que preguntar. */
  pregunta: string
}

const mxn = (n: number): string =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function desvioDeImporte(
  precioLista: number | null | undefined,
  monto: number,
  veces: number = VECES_POR_OMISION,
): DesvioDeImporte {
  const lista = Number(precioLista)
  const m = Number(monto)
  if (!Number.isFinite(lista) || lista <= 0 || !Number.isFinite(m) || m <= 0) {
    return { preguntar: false, veces: 0, pregunta: '' }
  }
  const razon = m / lista
  const vecesRedondeadas = Math.round(razon * 10) / 10
  if (razon > veces) {
    return {
      preguntar: true, veces: vecesRedondeadas,
      pregunta: `¿Seguro que son ${mxn(m)}? El precio de lista es ${mxn(lista)} (esto es ${vecesRedondeadas} veces más).`,
    }
  }
  if (razon < 1 / veces) {
    return {
      preguntar: true, veces: vecesRedondeadas,
      pregunta: `¿Seguro que son ${mxn(m)}? El precio de lista es ${mxn(lista)}. Si es un pago parcial, usa el concepto «Abono a saldo».`,
    }
  }
  return { preguntar: false, veces: vecesRedondeadas, pregunta: '' }
}

export const POR_QUE_SE_PREGUNTA_Y_NO_SE_BLOQUEA =
  'Porque un cobro grande legítimo existe (un paquete, varios procedimientos) y ' +
  'bloquearlo obligaría a partirlo en mentiras pequeñas. Preguntar cuesta un clic ' +
  'y atrapa el cero de más; y sin precio de lista no se pregunta nada, porque ' +
  'preguntar siempre es lo mismo que no preguntar.'

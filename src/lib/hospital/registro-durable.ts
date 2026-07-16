/**
 * Registro clínico DURABLE del internamiento.
 *
 * Los arrays balanceHidrico/escalas/sbar del doc de internamiento se limitan
 * por tamaño (tope de 1 MB por documento Firestore) y son solo CACHÉ DE DISPLAY.
 * El registro clínico-legal COMPLETO se persiste append-only en la subcolección
 * `registros` (sin truncar) → ningún registro se pierde en silencio (NOM-004).
 *
 * Esta función (pura) devuelve el evento a persistir, o null si la acción no
 * necesita registro durable aparte.
 */
type Any = Record<string, unknown>

export function registroDurable(accion: string, p: Any, now: string): Any | null {
  switch (accion) {
    case 'balance': return { tipo: 'balance', fecha: now, ingresos: p.ingresos, egresos: p.egresos, por: p.por }
    case 'escala':  return { tipo: 'escala', fecha: now, escala: p.tipo, score: p.score, riesgo: p.riesgo, por: p.por }
    case 'sbar':    return { tipo: 'sbar', fecha: now, texto: p.texto, por: p.por }
    default:        return null
  }
}

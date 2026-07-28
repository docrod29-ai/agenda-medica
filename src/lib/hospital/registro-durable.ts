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

export function registroDurable(accion: string, p: Any, now: string, por: string): Any | null {
  // `por` = AUTOR REAL sellado por el servidor (usuario en sesión), NO `p.por` del
  // cliente (auditoría P1): este registro es append-only NOM-004; atribuirlo a otro
  // médico falsearía el expediente legal permanente.
  switch (accion) {
    case 'balance': return { tipo: 'balance', fecha: now, ingresos: p.ingresos, egresos: p.egresos, por }
    case 'escala':  return { tipo: 'escala', fecha: now, escala: p.tipo, score: p.score, riesgo: p.riesgo, por }
    case 'sbar':    return { tipo: 'sbar', fecha: now, texto: p.texto, por }
    default:        return null
  }
}

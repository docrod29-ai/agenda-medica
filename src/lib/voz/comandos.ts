/**
 * Detección de comandos de voz para el modo manos libres de la consulta.
 *
 * El médico dice "iniciar consulta" para grabar y "cerrar consulta" para terminar
 * (la nota se llena sola). Tolerante a variantes y a errores de reconocimiento.
 *
 * PURO (string → comando) → testeable sin micrófono.
 */

export type ComandoVoz = 'iniciar' | 'cerrar' | null

const INICIAR_VERBOS = [
  'iniciar', 'inicia', 'inicie', 'inicio',
  'empezar', 'empieza', 'empieza',
  'comenzar', 'comienza', 'comienza',
  'arrancar', 'arranca', 'abrir', 'abre', 'nueva',
]

const CERRAR_VERBOS = [
  'cerrar', 'cierra', 'cierre',
  'terminar', 'termina', 'terminá',
  'finalizar', 'finaliza',
  'acabar', 'acaba',
  'detener', 'deten', 'detén', 'para', 'parar',
  'guardar', 'guarda',
]

function regexDe(verbos: string[]): RegExp {
  // <verbo> [la] consulta   (ej. "iniciar consulta", "cerrar la consulta")
  const alt = verbos.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return new RegExp(`\\b(?:${alt})\\s+(?:la\\s+|mi\\s+)?consulta\\b`)
}

const RE_INICIAR = regexDe(INICIAR_VERBOS)
const RE_CERRAR = regexDe(CERRAR_VERBOS)

/** Quita acentos, baja a minúsculas y colapsa espacios. */
export function normalizarTexto(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Devuelve el comando reconocido en el texto, o null. Si por alguna razón el
 * texto contuviera ambos, gana "cerrar" (más seguro terminar que reabrir).
 */
export function detectarComando(texto: string): ComandoVoz {
  const t = normalizarTexto(texto)
  if (!t) return null
  const cerrar = RE_CERRAR.test(t)
  const iniciar = RE_INICIAR.test(t)
  if (cerrar) return 'cerrar'
  if (iniciar) return 'iniciar'
  return null
}

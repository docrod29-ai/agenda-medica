/**
 * «EDAD: 1 AÑOS» — C-018.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * Ocho sitios concatenaban `${edad} años` sin condicional, y dos de ellos son
 * documentos que salen del consultorio con una cédula profesional impresa: la
 * nota (`nota/[patientId]/[notaId]/page.tsx:441`) y la carta de referencia
 * (`referencia/[patientId]/page.tsx:239`), que viaja a otro médico.
 *
 * Un paciente de un año recibía un documento clínico que decía «Edad: 1 años».
 * No hace daño clínico; hace daño a la única cosa que un impreso tiene que
 * transmitir sin esfuerzo: que está cuidado.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Una sola función para las ocho. No decide qué es una edad válida ni la
 * calcula: `edadParaDosificar` y `edadEnAnios` ya hacen eso. Ésta sólo escribe
 * el número en español.
 *
 * Módulo PURO.
 */

/**
 * «1 año», «34 años», «0 años» (un recién nacido en años cumplidos), y cadena
 * vacía cuando no hay edad — para que el llamador decida si escribe «sin edad»,
 * omite el renglón o pinta otra cosa. Nunca devuelve «undefined años».
 */
export function edadLegible(edad: number | string | null | undefined): string {
  // Cadena vacía NO es cero: `Number('')` da 0, y «0 años» es una afirmación
  // (un recién nacido) donde lo que hay es un campo sin llenar.
  if (typeof edad === 'string' && !edad.trim()) return ''
  const n = typeof edad === 'string' ? Number(edad.trim()) : edad
  if (n == null || !Number.isFinite(n) || (n as number) < 0) return ''
  const entero = Math.floor(n as number)
  return `${entero} ${entero === 1 ? 'año' : 'años'}`
}

/** Igual, con la etiqueta delante: «Edad: 1 año». Vacío si no hay edad. */
export function conEtiquetaDeEdad(edad: number | string | null | undefined): string {
  const t = edadLegible(edad)
  return t ? `Edad: ${t}` : ''
}

export const POR_QUE_UNA_SOLA_FUNCION =
  'Porque el mismo texto vivía escrito a mano en ocho sitios, y arreglar uno ' +
  'dejaba los otros siete diciendo «1 años». Es el patrón de «se arregla uno y ' +
  'se deja el de al lado», en su forma más barata de cerrar.'

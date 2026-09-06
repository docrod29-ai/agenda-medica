/**
 * ACOTAR EL `meta` DE UN ASIENTO DE BITÁCORA SIN PERDERLO ENTERO — REG-521.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `api/auditoria/registrar` recortaba `meta` así:
 *
 *     const recortada = JSON.stringify(body.meta).slice(0, 2000)
 *     try { meta = JSON.parse(recortada) } catch { meta = undefined }
 *
 * Cortar un JSON por la mitad casi siempre lo deja inválido, y entonces se
 * descartaba **todo** `meta`. En `receta_generada` y `receta_descargada`, `meta`
 * es la huella de lo que se imprimió (`huellaImpreso`): folio, la lista de
 * fármacos con su dosis, el total y el hash. Una receta larga —o con
 * indicaciones largas en cada renglón— pasaba de los 2 000 caracteres, y el
 * asiento quedaba con `meta: null`: **el único rastro de qué decía el papel
 * desaparecía, sin error**, justo en las recetas más largas, que son las que
 * más falta hace poder reconstruir.
 *
 * Es «el dato tiene que LLEGAR» en la bitácora: la pantalla llamaba a
 * `logAudit`, la ruta contestaba `ok: true`, y el hash no estaba.
 *
 * ── LO QUE HACE ──────────────────────────────────────────────────────────────
 *
 * Acota por CAMPO, no por carácter. Se conservan primero los valores cortos
 * (números, booleanos, cadenas cortas —el hash, el folio, el total—), después
 * las listas de cadenas elemento a elemento hasta donde quepa, y lo que no
 * cabe se OMITE y se DECLARA: `_truncada: true` y `_camposOmitidos`. El
 * resultado siempre es un objeto válido que cabe en el tope, y siempre dice
 * si le falta algo.
 *
 * No es criptografía ni compresión: es no tirar el hash porque la lista de
 * fármacos era larga. Módulo puro.
 */

export const TOPE_META = 2000

/** Longitud máxima de una cadena suelta para que cuente como «corta». */
const CADENA_CORTA = 200

type Plano = string | number | boolean | null

function esPlano(v: unknown): v is Plano {
  return v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string'
}

function pesa(o: Record<string, unknown>): number {
  return JSON.stringify(o).length
}

export function acotarMeta(meta: unknown, tope = TOPE_META): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  const entrada = meta as Record<string, unknown>
  // Lo que ya cabe, se guarda tal cual. La forma de siempre para el caso de siempre.
  if (pesa(entrada) <= tope) return entrada

  const salida: Record<string, unknown> = { _truncada: true, _camposOmitidos: [] as string[] }
  const omitidos: string[] = []

  // 1. Primitivos cortos primero: son los que identifican (hash, folio, total).
  for (const [k, v] of Object.entries(entrada)) {
    if (!esPlano(v)) continue
    if (typeof v === 'string' && v.length > CADENA_CORTA) { omitidos.push(k); continue }
    const candidato = { ...salida, [k]: v }
    if (pesa(candidato) <= tope) salida[k] = v
    else omitidos.push(k)
  }

  // 2. Listas de cadenas, elemento a elemento, en su orden; lo demás se omite.
  for (const [k, v] of Object.entries(entrada)) {
    if (esPlano(v)) continue
    if (Array.isArray(v) && v.every(x => typeof x === 'string')) {
      const parcial: string[] = []
      for (const x of v as string[]) {
        const candidato = { ...salida, [k]: [...parcial, x] }
        if (pesa(candidato) > tope) break
        parcial.push(x)
      }
      if (parcial.length) salida[k] = parcial
      if (parcial.length < v.length) omitidos.push(parcial.length ? `${k}[${parcial.length}…]` : k)
      continue
    }
    // Objetos anidados y listas mixtas: no se intenta partirlos, se declaran.
    omitidos.push(k)
  }

  salida._camposOmitidos = omitidos
  // La propia lista de omitidos puede empujar el tamaño: si pasa, se recorta
  // la lista de fármacos (u otra lista) por el final hasta que quepa.
  while (pesa(salida) > tope) {
    const listas = Object.entries(salida).filter(([k, v]) => k !== '_camposOmitidos' && Array.isArray(v) && (v as unknown[]).length > 0)
    if (!listas.length) break
    const [k, v] = listas[listas.length - 1]
    salida[k] = (v as unknown[]).slice(0, -1)
  }
  return salida
}

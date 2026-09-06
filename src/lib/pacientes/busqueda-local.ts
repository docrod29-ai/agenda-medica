/**
 * BUSCAR EN LO QUE YA ESTÁ CARGADO — y unirlo con lo que contesta el servidor.
 *
 * ── EL FALLO QUE ESTO REPARA (ASE-001) ───────────────────────────────────────
 *
 * REG-347 mandó la búsqueda al servidor, y con razón: filtrar en memoria sobre
 * una lista con techo (REG-341) busca dentro de un RECORTE, y decir «no está»
 * de un paciente que existe es la peor respuesta posible en la pantalla donde
 * se le busca.
 *
 * Pero se aplicó como SUSTITUCIÓN, no como unión:
 *
 *     if (busquedaServidor && busquedaServidor.q === search.trim())
 *       return busquedaServidor.pacientes
 *
 * Y el servidor no sabe «contiene»: su sondeo principal es por PREFIJO sobre
 * `nombre`. Teclear «iparraguirre» buscando a «Tadeo Iparraguirre Nolasco»
 * devolvía `[]` del servidor, ese vacío pisaba el `includes` local que SÍ lo
 * encontraba, y la pantalla imprimía «Ninguno de los 6 expedientes coincide».
 *
 * **El vacío del servidor no significa «no está»: significa «no empieza por».**
 * Es la regla 4 de seguridad clínica en clave de directorio —ausencia de
 * resultado no es resultado de ausencia— y aquí un «no está» falso abre un
 * segundo expediente, que es partir en dos las alergias de alguien.
 *
 * ── POR QUÉ NO SE ARREGLA BAJANDO EL UMBRAL DE PARECIDOS ─────────────────────
 *
 * `similitudNombre('iparraguirre', 'Tadeo Iparraguirre Nolasco')` da 0.667
 * contra un `UMBRAL_NOMBRE` de 0.8, así que el rescate por parecidos no lo
 * caza. Y NO debe cazarlo: 0.667 es exactamente lo que da «María» contra
 * «María López García», que es el nombre de pila de media consulta. Bajar el
 * umbral para arreglar la búsqueda rompería el detector de duplicados, que es
 * quien lo usa para decidir si dos expedientes son la misma persona.
 *
 * Buscar y comparar identidades son dos trabajos distintos. Este módulo hace el
 * primero, con la regla del primero: **una palabra de la búsqueda casa si es
 * parte de cualquier palabra del nombre**, que es lo que hace una persona con
 * los ojos.
 *
 * Módulo PURO: sin red, sin reloj, sin Firestore.
 */

/** Lo mínimo que se necesita de un paciente para buscarlo en memoria. */
export interface PacienteBuscable {
  id: string
  nombre: string
  telefono?: string | null
  whatsapp?: string | null
  email?: string | null
  curp?: string | null
}

/** Minúsculas y sin acentos. La ñ sí se conserva: «Peña» no es «Pena». */
export function normalizarParaBuscar(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/ñ/g, '\uE000').replace(/Ñ/g, '\uE000')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\uE000/g, 'ñ')
    .trim()
}

/**
 * ¿Este paciente responde a lo que se tecleó?
 *
 * TODAS las palabras del término tienen que aparecer en algún sitio de la
 * ficha: «barquin salcedo» encuentra a «Ramona Barquín Salcedo», y «juan lopez»
 * no encuentra a «Juan Pérez». Cada palabra casa por SUBCADENA, que es lo que
 * hace que un apellido de en medio —o el principio de uno— siga encontrando.
 *
 * Un término de sólo dígitos se compara además contra el teléfono ignorando
 * espacios, guiones y lada.
 */
export function coincideConLaBusqueda(p: PacienteBuscable, termino: string): boolean {
  const q = normalizarParaBuscar(termino)
  if (!q) return false

  const digitos = termino.replace(/\D/g, '')
  if (digitos.length >= 3) {
    const tel = String(p.telefono ?? '').replace(/\D/g, '')
    const wa = String(p.whatsapp ?? '').replace(/\D/g, '')
    if (tel.includes(digitos) || wa.includes(digitos)) return true
  }

  const heno = [p.nombre, p.email, p.curp].map(normalizarParaBuscar).join(' ')
  return q.split(/\s+/).filter(Boolean).every(palabra => heno.includes(palabra))
}

/** Los pacientes YA CARGADOS que responden al término. */
export function filtrarPacientesEnMemoria<T extends PacienteBuscable>(
  pacientes: readonly T[],
  termino: string,
): T[] {
  return pacientes.filter(p => coincideConLaBusqueda(p, termino))
}

/**
 * EL RESULTADO ES LA UNIÓN, NO LA SUSTITUCIÓN.
 *
 * El servidor aporta lo que está por encima del techo de la lista; la memoria
 * aporta lo que el servidor no sabe buscar (el apellido que no es la primera
 * palabra). Ninguno de los dos es «la» respuesta: la respuesta es lo que
 * cualquiera de los dos encontró.
 *
 * Se dedupica por `id` —un paciente puede venir por los dos caminos— y se
 * ordena por nombre en español, que es como se lee una lista de personas.
 */
export function unirResultadosDeBusqueda<T extends PacienteBuscable>(
  delServidor: readonly T[],
  deLaMemoria: readonly T[],
): T[] {
  const vistos = new Set<string>()
  const salida: T[] = []
  for (const p of [...delServidor, ...deLaMemoria]) {
    if (!p?.id || vistos.has(p.id)) continue
    vistos.add(p.id)
    salida.push(p)
  }
  return salida.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

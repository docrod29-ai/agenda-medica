/**
 * EL MISMO PACIENTE, DOS EXPEDIENTES.
 *
 * ── POR QUÉ IMPORTA MÁS QUE UN REGISTRO REPETIDO ─────────────────────────────
 *
 * Un duplicado no se ve como un error: se ve como un paciente nuevo. Y lo que se
 * parte en dos no es una fila de una tabla — son las alergias, los antecedentes y
 * las notas previas. El médico abre el expediente equivocado, ve «sin alergias
 * conocidas» porque la penicilina quedó anotada en el otro, y prescribe. El
 * sistema funciona perfectamente todo el tiempo.
 *
 * ── LO QUE HABÍA ─────────────────────────────────────────────────────────────
 *
 * Una comprobación de igualdad exacta al momento de guardar: mismo teléfono, o
 * mismo nombre si no había teléfono. Fallaba en las dos direcciones:
 *
 *  - **Se le escapaban duplicados reales.** «María López» y «Maria Lopez» son
 *    cadenas distintas. «López García, María» y «María López García» también.
 *    Y si el segundo registro traía el teléfono de la hija, el nombre ni se
 *    comparaba: la condición del nombre sólo corría cuando NO había teléfono.
 *  - **Avisaba de cosas que no eran duplicados.** En México una familia entera
 *    comparte un celular. La madre registra a sus tres hijos y cada alta
 *    disparaba la alerta. Un aviso que salta cuando no pasa nada enseña a
 *    ignorar los avisos — y el que sí importaba se ignora igual.
 *
 * ── LAS DOS REGLAS QUE LO ORDENAN TODO ───────────────────────────────────────
 *
 *  1. **El teléfono NUNCA basta por sí solo.** Es un dato de contacto, no de
 *     identidad: lo comparte la familia. Aquí sólo refuerza un parecido de
 *     nombre que ya existe.
 *  2. **La fecha de nacimiento SEPARA.** Dos personas con el mismo nombre y
 *     distinta fecha de nacimiento son dos personas — punto. Ese descarte es lo
 *     que permite ser generoso al comparar nombres sin llenar la pantalla de
 *     falsas alarmas.
 *
 * La EDAD guardada no se usa igual, y a propósito: es una foto que envejece mal
 * (un niño registrado a los 6 sigue diciendo 6 al año siguiente). Sirve para
 * confirmar, y sólo descarta cuando la diferencia es tan grande que ya no puede
 * explicarse por el paso del tiempo.
 *
 * Módulo PURO: sin red, sin reloj, sin Firestore. Decide y devuelve; quien llama
 * decide qué hacer con eso.
 */

/** Lo mínimo que se necesita de un paciente para compararlo con otro. */
export interface PacienteComparable {
  id?: string
  nombre?: string | null
  telefono?: string | null
  whatsapp?: string | null
  curp?: string | null
  fechaNacimiento?: string | null
  edad?: number | null
}

/**
 * Qué tan seguro es que sea la misma persona.
 *
 * `seguro` frena y pregunta; `probable` sólo ofrece el atajo. La diferencia es
 * deliberada: interrumpir a un médico cuesta, y sólo se paga cuando la
 * probabilidad de estar partiendo un expediente es alta.
 */
export type Certeza = 'seguro' | 'probable'

export interface Coincidencia<T = PacienteComparable> {
  paciente: T
  certeza: Certeza
  /** En español llano, para pintarlo tal cual. */
  motivo: string
  /** 0-100. Sólo ordena; no se enseña. */
  puntaje: number
}

/** Palabras que en un nombre no distinguen a nadie. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'san', 'santa'])

/**
 * Un nombre reducido a lo que de verdad lo identifica.
 *
 * Sin acentos, sin puntuación, sin partículas, y con las palabras ORDENADAS —
 * eso último es lo que hace que «López García, María» y «María López García»
 * sean el mismo nombre, que es el caso más común de todos: el mismo mostrador
 * captura al mismo paciente en dos órdenes distintos.
 */
export function normalizarNombre(s: string | null | undefined): string {
  return String(s ?? '')
    // La ñ se aparta ANTES de descomponer. En NFD «ñ» es «n» + virgulilla, y el
    // barrido de acentos la dejaría en «n»: «Peña» y «Pena» pasarían a ser el
    // mismo apellido. No hace falta sacrificarla — quien escribe «Munoz» sin
    // teclado español lo recupera igual por el lado del dedazo.
    .replace(/ñ/g, '').replace(/Ñ/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // acentos fuera
    .replace(//g, 'ñ')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')                      // puntos, comas, guiones
    .split(/\s+/)
    .filter(t => t && !PARTICULAS.has(t))
    .sort()
    .join(' ')
}

/** Los 10 dígitos finales — así «+52 664 123 4567» y «6641234567» son el mismo. */
export function telefonoComparable(t: string | null | undefined): string {
  const d = String(t ?? '').replace(/\D/g, '')
  return d.length >= 10 ? d.slice(-10) : ''
}

/** Distancia de edición. Sirve para los dedazos: «Rodriguez» / «Rodriquez». */
function distancia(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m || !n) return m || n
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const fila = [i]
    for (let j = 1; j <= n; j++) {
      fila[j] = Math.min(
        prev[j] + 1,
        fila[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = fila
  }
  return prev[n]
}

/** Cuánto dedazo se le tolera a una palabra según su largo. */
function tolerancia(largo: number): number {
  if (largo >= 7) return 2
  if (largo >= 5) return 1
  return 0            // en palabras cortas, un cambio ya es otra palabra («ana»/«ena»)
}

/**
 * Parecido entre dos nombres, de 0 a 1.
 *
 * Se emparejan palabras (tolerando dedazos) y se mezclan DOS proporciones: la de
 * la lista corta y la de la larga. Con una sola no alcanza:
 *
 *  - sólo la corta → «María» contra «María López García» daría 1.0, y ese es el
 *    nombre de pila de media consulta;
 *  - sólo la larga → «María López» contra «María López García» daría 0.67, y ese
 *    SÍ es el mismo paciente capturado una vez sin el segundo apellido.
 *
 * El promedio deja el segundo caso en 0.83 y el primero en 0.67, que es
 * exactamente el orden que hace falta.
 */
export function similitudNombre(a: string | null | undefined, b: string | null | undefined): number {
  const ta = normalizarNombre(a).split(' ').filter(Boolean)
  const tb = normalizarNombre(b).split(' ').filter(Boolean)
  if (!ta.length || !tb.length) return 0

  const libres = [...tb]
  let iguales = 0
  for (const p of ta) {
    let mejor = -1, mejorD = Infinity
    for (let i = 0; i < libres.length; i++) {
      const d = distancia(p, libres[i])
      if (d <= tolerancia(Math.max(p.length, libres[i].length)) && d < mejorD) { mejor = i; mejorD = d }
    }
    if (mejor >= 0) { iguales++; libres.splice(mejor, 1) }
  }
  if (!iguales) return 0
  return (iguales / Math.min(ta.length, tb.length) + iguales / Math.max(ta.length, tb.length)) / 2
}

/** A partir de aquí dos nombres se consideran «el mismo, escrito distinto». */
export const UMBRAL_NOMBRE = 0.8

/** Cuántos años de diferencia deja de explicar el paso del tiempo. */
const AÑOS_QUE_YA_NO_SON_LA_MISMA_PERSONA = 5

type Edades = 'igual' | 'dudosa' | 'distinta' | 'desconocida'

function compararEdades(a?: number | null, b?: number | null): Edades {
  const x = Number(a), y = Number(b)
  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return 'desconocida'
  const d = Math.abs(x - y)
  if (d <= 2) return 'igual'                                        // margen por la edad que envejece mal
  if (d <= AÑOS_QUE_YA_NO_SON_LA_MISMA_PERSONA) return 'dudosa'
  return 'distinta'
}

function fechaNac(p: PacienteComparable): string {
  return String(p.fechaNacimiento ?? '').slice(0, 10)
}

function curpDe(p: PacienteComparable): string {
  const c = String(p.curp ?? '').trim().toUpperCase()
  return c.length === 18 ? c : ''
}

function telefonosDe(p: PacienteComparable): string[] {
  return [telefonoComparable(p.telefono), telefonoComparable(p.whatsapp)].filter(Boolean)
}

/**
 * ¿Estos dos son la misma persona? Devuelve `null` cuando no hay caso.
 *
 * El orden importa: primero lo que IDENTIFICA (CURP), luego lo que SEPARA
 * (fecha de nacimiento, edad imposible) y sólo al final lo que se PARECE.
 * Descartar antes de comparar es lo que mantiene la pantalla limpia.
 */
export function compararPacientes(
  nuevo: PacienteComparable,
  existente: PacienteComparable,
): Omit<Coincidencia, 'paciente'> | null {
  // 1. CURP. Es el único dato de la ficha que identifica a una persona y sólo a
  //    ella; si coincide, no hay nada más que discutir.
  const cA = curpDe(nuevo), cB = curpDe(existente)
  if (cA && cB) {
    return cA === cB
      ? { certeza: 'seguro', motivo: 'Mismo CURP', puntaje: 100 }
      : null   // dos CURP distintos son dos personas distintas, se llamen como se llamen
  }

  // 2. Lo que SEPARA. Con fecha de nacimiento distinta ya no hace falta mirar el
  //    nombre: son dos personas.
  const fA = fechaNac(nuevo), fB = fechaNac(existente)
  const mismaFecha = !!fA && fA === fB
  if (fA && fB && !mismaFecha) return null

  const edades = compararEdades(nuevo.edad, existente.edad)
  if (edades === 'distinta' && !mismaFecha) return null

  // 3. El parecido del nombre. Es condición NECESARIA: sin él no hay aviso,
  //    aunque compartan el teléfono — ese es el celular de la familia.
  const sim = similitudNombre(nuevo.nombre, existente.nombre)
  if (sim < UMBRAL_NOMBRE) return null

  const mismoTelefono = telefonosDe(nuevo).some(t => telefonosDe(existente).includes(t))
  const idéntico = sim >= 0.999

  if (mismaFecha) {
    return {
      certeza: 'seguro',
      motivo: idéntico ? 'Mismo nombre y misma fecha de nacimiento' : 'Nombre muy parecido y misma fecha de nacimiento',
      puntaje: idéntico ? 95 : 88,
    }
  }
  if (idéntico && edades === 'igual') {
    return { certeza: 'seguro', motivo: 'Mismo nombre y la misma edad', puntaje: 85 }
  }
  if (mismoTelefono) {
    return {
      certeza: 'probable',
      motivo: idéntico ? 'Mismo nombre y mismo teléfono' : 'Nombre muy parecido y mismo teléfono',
      puntaje: 75,
    }
  }
  if (edades === 'igual') {
    return { certeza: 'probable', motivo: 'Nombre muy parecido y la misma edad', puntaje: 65 }
  }
  return {
    certeza: 'probable',
    motivo: idéntico ? 'Mismo nombre' : 'Nombre muy parecido',
    puntaje: idéntico ? 60 : 50,
  }
}

/** Cuántas se enseñan. Más de tres deja de ser una ayuda y pasa a ser una lista. */
export const MAXIMO_SUGERENCIAS = 3

/**
 * Los posibles duplicados de un paciente que se está capturando, ordenados.
 *
 * Se excluye a sí mismo por `id` (al editar, un paciente siempre es idéntico a
 * sí mismo) y se recorta: esto alimenta un aviso, no un reporte.
 */
export function buscarPosiblesDuplicados<T extends PacienteComparable>(
  nuevo: PacienteComparable,
  existentes: readonly T[],
  limite = MAXIMO_SUGERENCIAS,
): Coincidencia<T>[] {
  const salida: Coincidencia<T>[] = []
  for (const p of existentes) {
    if (p.id && nuevo.id && p.id === nuevo.id) continue
    const r = compararPacientes(nuevo, p)
    if (r) salida.push({ paciente: p, ...r })
  }
  return salida.sort((a, b) => b.puntaje - a.puntaje).slice(0, limite)
}

/** ¿Hay alguna tan segura como para detenerse a preguntar? */
export function hayQuePreguntar(c: readonly Coincidencia[]): boolean {
  return c.some(x => x.certeza === 'seguro')
}

/* ════════════════════════════════════════════════════════════════════════════
   BARRIDO DE LO QUE YA ESTÁ DENTRO
   ════════════════════════════════════════════════════════════════════════════

   Todo lo de arriba evita duplicados NUEVOS. No hace nada con los que ya se
   acumularon durante meses — y ésos son los que tienen historial partido: el
   paciente lleva dos expedientes desde hace tiempo, con las alergias en uno y
   las notas recientes en el otro.

   ── POR QUÉ NO SE COMPARAN TODOS CONTRA TODOS ──────────────────────────────

   Con mil pacientes, todos contra todos son medio millón de comparaciones, y
   cada una hace distancia de edición sobre varias palabras. En el navegador del
   médico eso congela la pantalla; con tres mil pacientes ya no termina.

   La solución es la de siempre en emparejamiento de registros: **BLOQUEAR**. Dos
   personas que son la misma comparten alguna señal barata —el teléfono, la fecha
   de nacimiento, el principio de un apellido—, así que sólo se comparan las
   parejas que caen en el mismo bloque. Se pasa de cuadrático a casi lineal.

   Los bloques se solapan a propósito: un duplicado con el teléfono de un
   familiar no cae en el bloque del teléfono, pero sí en el del apellido. Basta
   con que caiga en UNO.
*/

/** Un par de expedientes que parecen la misma persona. */
export interface ParDuplicado<T = PacienteComparable> {
  a: T
  b: T
  certeza: Certeza
  motivo: string
  puntaje: number
}

/**
 * Las señales por las que dos expedientes pueden acabar comparándose.
 *
 * Ninguna decide nada: sólo sirven para no comparar a todo el mundo con todo el
 * mundo. Quien decide sigue siendo `compararPacientes`, con sus mismas reglas.
 */
function clavesDeBloqueo(p: PacienteComparable): string[] {
  const claves: string[] = []
  for (const t of telefonosDe(p)) claves.push(`t:${t}`)
  const f = fechaNac(p)
  if (f) claves.push(`f:${f}`)
  const c = curpDe(p)
  if (c) claves.push(`c:${c}`)
  // Las primeras letras de cada palabra del nombre. Aguanta el apellido que
  // falta, el orden invertido y los acentos, porque el nombre ya viene
  // normalizado — y aguanta el dedazo del final, que es el más común.
  for (const palabra of normalizarNombre(p.nombre).split(' ')) {
    if (palabra.length >= 4) claves.push(`n:${palabra.slice(0, 4)}`)
  }
  return claves
}

/**
 * Cuántos expedientes puede tener un bloque antes de considerarse inútil.
 *
 * Un bloque enorme —«todos los que empiezan por GARC»— no ahorra nada y sí
 * vuelve a costar tiempo cuadrático. Se descarta entero: los duplicados que
 * vivan sólo ahí se pierden, y eso es preferible a una pantalla congelada. Se
 * declara en `bloquesIgnorados` para que no sea un silencio.
 */
export const MAXIMO_POR_BLOQUE = 60

export interface BarridoDuplicados<T = PacienteComparable> {
  pares: ParDuplicado<T>[]
  /** Cuántos expedientes se revisaron. Para poder decir «de N». */
  revisados: number
  /** Bloques demasiado grandes que se saltaron. Vacío casi siempre. */
  bloquesIgnorados: string[]
}

/**
 * Encuentra los duplicados que YA están en la lista.
 *
 * Cada par sale UNA vez (A-B, nunca también B-A) y ordenados por certeza, así
 * que lo primero de la lista es lo primero que hay que mirar.
 */
export function barrerDuplicados<T extends PacienteComparable>(
  pacientes: readonly T[],
): BarridoDuplicados<T> {
  const bloques = new Map<string, T[]>()
  for (const p of pacientes) {
    for (const k of clavesDeBloqueo(p)) {
      const l = bloques.get(k)
      if (l) l.push(p)
      else bloques.set(k, [p])
    }
  }

  const bloquesIgnorados: string[] = []
  const yaVistos = new Set<string>()
  const pares: ParDuplicado<T>[] = []

  for (const [clave, grupo] of bloques) {
    if (grupo.length < 2) continue
    if (grupo.length > MAXIMO_POR_BLOQUE) { bloquesIgnorados.push(clave); continue }
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const a = grupo[i], b = grupo[j]
        if (!a.id || !b.id || a.id === b.id) continue
        // Un par puede caer en varios bloques (teléfono Y apellido): se compara
        // una vez. Sin esto, el mismo duplicado saldría repetido en la pantalla
        // y parecería que hay más de los que hay.
        const par = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
        if (yaVistos.has(par)) continue
        yaVistos.add(par)
        const r = compararPacientes(a, b)
        if (r) pares.push({ a, b, ...r })
      }
    }
  }

  pares.sort((x, y) => y.puntaje - x.puntaje)
  return { pares, revisados: pacientes.length, bloquesIgnorados }
}

/* ════════════════════════════════════════════════════════════════════════════
   FUNDIR CONTRA UN EXPEDIENTE EXISTENTE — la decisión MÁS peligrosa de todas
   ════════════════════════════════════════════════════════════════════════════

   Todo lo anterior avisa. Esto DECIDE, y sin nadie delante: cuando alguien
   agenda desde el asistente, hay que resolver solo si es un paciente que ya
   existe o uno nuevo.

   ── LOS DOS ERRORES NO SON COMPARABLES ─────────────────────────────────────

   · **Crear un duplicado** parte el historial. Es malo, es recuperable, y el
     barrido de la pantalla de Pacientes lo encuentra.
   · **Fundir con quien no es** cuelga la cita —y después la nota, y la receta—
     del expediente de OTRA PERSONA. No hay barrido que lo encuentre, porque no
     se ve como un error: se ve como un paciente que vino a consulta.

   Por eso ante la duda se CREA. Siempre.

   ── EL FALLO QUE ESTO REPARA ───────────────────────────────────────────────

   La regla anterior fundía por TELÉFONO A SOLAS, sin mirar el nombre. En México
   el celular es de la casa: con la madre registrada con el número de casa, su
   hijo agendaba y la cita se colgaba del expediente de la madre. Lo que se
   escribiera después —diagnóstico, alergias, prescripción— quedaba en la
   persona equivocada, con su firma encima.
*/

/**
 * ¿Con qué expediente existente se funde esta reserva? `null` = crear uno nuevo.
 *
 * DOS condiciones, las dos necesarias:
 *
 *  1. El motor tiene que reconocerlos como la misma persona — o sea, los nombres
 *     se parecen. El teléfono NUNCA basta por sí solo.
 *  2. Los teléfonos no pueden CONTRADECIRSE. Si los dos tienen número y no
 *     coinciden, se crea uno nuevo aunque el nombre sea idéntico: sin nadie a
 *     quien preguntar, dos homónimos con números distintos son dos personas
 *     hasta que alguien diga lo contrario.
 *
 * La segunda condición hace que a veces se cree un duplicado del mismo paciente
 * —el que llamó desde otro número—. Es el error barato, y es el que se elige.
 */
export function elegirExpedienteParaCita<T extends PacienteComparable>(
  reserva: PacienteComparable,
  existentes: readonly T[],
): T | null {
  const telReserva = telefonosDe(reserva)
  const candidatos: { p: T; puntaje: number }[] = []

  for (const p of existentes) {
    const r = compararPacientes(reserva, p)
    if (!r) continue                                    // los nombres no se parecen
    const telExistente = telefonosDe(p)
    const seContradicen =
      telReserva.length > 0 && telExistente.length > 0 &&
      !telReserva.some(t => telExistente.includes(t))
    if (seContradicen) continue
    candidatos.push({ p, puntaje: r.puntaje })
  }

  if (candidatos.length === 0) return null
  /**
   * DOS candidatos igual de buenos → se crea uno nuevo.
   *
   * Elegir «el primero» entre dos expedientes indistinguibles es echarlo a
   * cara o cruz con el expediente de alguien. Un duplicado se arregla; escribir
   * en el paciente equivocado, no.
   */
  candidatos.sort((a, b) => b.puntaje - a.puntaje)
  if (candidatos.length > 1 && candidatos[0].puntaje === candidatos[1].puntaje) return null
  return candidatos[0].p
}

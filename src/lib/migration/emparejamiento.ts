/**
 * ¿ESTA FILA ES ALGUIEN QUE YA TENGO?
 *
 * ── LAS DOS FORMAS DE FALLAR NO SON COMPARABLES ──────────────────────────────
 *
 * Es la misma asimetría que ya está escrita en `pacientes/duplicados.ts`, y aquí
 * se multiplica por cincuenta mil:
 *
 *  · **Crear un duplicado** parte el historial. Es malo, es visible y el barrido
 *    de la pantalla de Pacientes lo encuentra.
 *  · **Fundir a dos personas distintas** mete las alergias de una en el
 *    expediente de la otra. No hay barrido que lo encuentre, porque no se ve
 *    como un error: se ve como un paciente con más antecedentes.
 *
 * Por eso `LIKELY_MATCH` y `AMBIGUOUS` **nunca** se funden solos. Van a revisión.
 * Y por eso la cuarentena es el producto y no el fallo.
 *
 * ── LO QUE ESTE MÓDULO NO HACE: UNA REGLA NUEVA ──────────────────────────────
 *
 * Quien decide si dos expedientes son la misma persona es `compararPacientes`, y
 * seguirá siendo él. Tener dos definiciones de «el mismo paciente» —una para el
 * alta y otra para la importación— es exactamente cómo se llega a que la
 * pantalla avise de un duplicado que el importador acaba de crear.
 *
 * Lo que se añade aquí son los CUATRO CUBOS y la EXPLICACIÓN LEGIBLE POR
 * MÁQUINA. El motor de abajo devuelve un motivo en español para pintarlo; un
 * informe de reconciliación de 50 000 filas necesita algo que se pueda agrupar,
 * contar y comparar entre dos ejecuciones.
 *
 * ── POR QUÉ NO SE COMPARA TODO CONTRA TODO ───────────────────────────────────
 *
 * 50 000 filas contra 50 000 existentes son 2 500 millones de comparaciones, y
 * cada una hace distancia de edición. Se reutiliza la idea de BLOQUEO que ya usa
 * `barrerDuplicados`: sólo se comparan los que comparten una señal barata.
 *
 * Módulo PURO.
 */
import {
  compararPacientes, normalizarNombre, telefonoComparable,
  MAXIMO_POR_BLOQUE as TOPE_BLOQUE,
  type PacienteComparable, type Certeza,
} from '@/lib/pacientes/duplicados'

/* ═══════════════════════ LOS CUATRO CUBOS ═══════════════════════ */

/**
 * `EXACT_MATCH` — el mismo, sin discusión. No se vuelve a crear.
 * `LIKELY_MATCH` — casi seguro que el mismo. **A revisión**, no se funde.
 * `AMBIGUOUS`   — se parece a MÁS DE UNO, o se parece a medias. A revisión.
 * `NEW_RECORD`  — nadie se le parece. Se crea.
 */
export type ClaseEmparejamiento = 'EXACT_MATCH' | 'LIKELY_MATCH' | 'AMBIGUOUS' | 'NEW_RECORD'

/**
 * Las señales que sostienen un veredicto. Legibles por máquina, agrupables.
 *
 * Cada una responde a un dato del expediente y NINGUNA es clínica: nombre,
 * teléfono, fecha de nacimiento y CURP. Deliberado — emparejar por diagnóstico o
 * por medicación sería usar el contenido del expediente para decidir de quién es
 * el expediente, que es circular y además se equivoca con las familias.
 */
export type Senal =
  | 'CURP_IGUAL'
  | 'CURP_DISTINTO'
  | 'NOMBRE_IDENTICO'
  | 'NOMBRE_PARECIDO'
  | 'FECHA_NACIMIENTO_IGUAL'
  | 'FECHA_NACIMIENTO_DISTINTA'
  | 'TELEFONO_IGUAL'
  | 'EDAD_IGUAL'
  | 'VARIOS_CANDIDATOS'

export interface Candidato<T extends PacienteComparable = PacienteComparable> {
  readonly paciente: T
  readonly certeza: Certeza
  /** En español, para pintarlo. Viene del motor de duplicados sin retocar. */
  readonly motivo: string
  readonly puntaje: number
  /** El mismo veredicto, en señales que una máquina puede contar. */
  readonly senales: readonly Senal[]
}

export interface Emparejamiento<T extends PacienteComparable = PacienteComparable> {
  readonly clase: ClaseEmparejamiento
  /** Ordenados por puntaje. Vacío sólo en `NEW_RECORD`. */
  readonly candidatos: readonly Candidato<T>[]
  /**
   * Por qué salió esta clase y no otra. Legible por máquina.
   *
   * No es el motivo del candidato: es el motivo de la DECISIÓN. «Hay dos
   * candidatos empatados» no es una propiedad de ninguno de los dos.
   */
  readonly porQue: readonly Senal[]
}

/* ═══════════════════════ LAS SEÑALES ═══════════════════════ */

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
 * Traduce un veredicto del motor a señales contables.
 *
 * Se derivan de los datos, NO se parsea el motivo en español. Parsear el texto
 * ataría el informe al idioma y a la redacción: cambiar «Mismo CURP» por «CURP
 * idéntico» rompería silenciosamente las cuentas de todos los informes.
 */
function senalesDe(a: PacienteComparable, b: PacienteComparable): Senal[] {
  const s: Senal[] = []
  const cA = curpDe(a), cB = curpDe(b)
  if (cA && cB) s.push(cA === cB ? 'CURP_IGUAL' : 'CURP_DISTINTO')

  const nA = normalizarNombre(a.nombre), nB = normalizarNombre(b.nombre)
  if (nA && nB) s.push(nA === nB ? 'NOMBRE_IDENTICO' : 'NOMBRE_PARECIDO')

  const fA = fechaNac(a), fB = fechaNac(b)
  if (fA && fB) s.push(fA === fB ? 'FECHA_NACIMIENTO_IGUAL' : 'FECHA_NACIMIENTO_DISTINTA')

  const tA = telefonosDe(a), tB = telefonosDe(b)
  if (tA.some(t => tB.includes(t))) s.push('TELEFONO_IGUAL')

  const eA = Number(a.edad), eB = Number(b.edad)
  if (Number.isFinite(eA) && Number.isFinite(eB) && eA > 0 && eB > 0 && Math.abs(eA - eB) <= 2) {
    s.push('EDAD_IGUAL')
  }
  return s
}

/* ═══════════════════════ EL BLOQUEO ═══════════════════════ */

/**
 * Señales baratas por las que dos expedientes MERECEN compararse.
 *
 * Ninguna decide nada. Se solapan a propósito: un duplicado registrado con el
 * teléfono de un familiar no cae en el bloque del teléfono, pero sí en el del
 * apellido. Basta con que caiga en UNO.
 *
 * Es la misma idea que `clavesDeBloqueo` en `duplicados.ts`, replanteada para
 * comparar DOS conjuntos (lo que llega contra lo que hay) en vez de un conjunto
 * consigo mismo.
 */
function clavesDeBloqueo(p: PacienteComparable): string[] {
  const claves: string[] = []
  for (const t of telefonosDe(p)) claves.push(`t:${t}`)
  const f = fechaNac(p)
  if (f) claves.push(`f:${f}`)
  const c = curpDe(p)
  if (c) claves.push(`c:${c}`)
  for (const palabra of normalizarNombre(p.nombre).split(' ')) {
    if (palabra.length >= 4) claves.push(`n:${palabra.slice(0, 4)}`)
  }
  return claves
}

/**
 * Índice de lo que YA hay en el consultorio, para no recorrerlo entero por fila.
 *
 * Se construye una vez y se consulta 50 000 veces. Construirlo dentro del bucle
 * —que es lo que hace `clasificarFilas` hoy, recorriendo el arreglo entero por
 * cada fila— es lo que convierte una importación grande en algo que no termina.
 */
/**
 * Cuántos expedientes puede tener un bloque antes de dejar de servir.
 *
 * ── POR QUÉ EXISTE ESTE TOPE, MEDIDO ─────────────────────────────────────────
 *
 * Sin él, un bloque enorme —«todos los apellidos que empiezan por GARC»— vuelve
 * a costar tiempo cuadrático DENTRO del bloque, y el bloqueo deja de ahorrar
 * nada. El arnés de escala lo destapó: sin tope, el coste por fila subía de
 * 577 µs con 10 000 filas a 2 510 µs con 50 000 — más de cuatro veces por sólo
 * cinco veces más datos. Eso es la curva cuadrática asomando.
 *
 * `duplicados.ts` ya había aprendido esto y usa el mismo número para su barrido.
 * Se importa de allí en vez de repetirlo: dos topes que se separan producen dos
 * comportamientos distintos para «el mismo paciente» según quién pregunte.
 */
export { MAXIMO_POR_BLOQUE } from '@/lib/pacientes/duplicados'

export class IndicePacientes<T extends PacienteComparable = PacienteComparable> {
  private readonly bloques = new Map<string, T[]>()
  /**
   * Bloques que se llenaron y se dejaron de usar.
   *
   * **Se declaran, no se silencian.** Un duplicado que viviera SÓLO en un bloque
   * saturado no se detecta, y eso tiene que poder decirse en el informe: es la
   * diferencia entre «no hay duplicados» y «no los busqué todos». La misma
   * decisión que toma `barrerDuplicados` con `bloquesIgnorados`.
   */
  private readonly saturados = new Set<string>()

  constructor(existentes: readonly T[] = []) {
    for (const p of existentes) this.agregar(p)
  }

  /**
   * Mete un paciente al índice.
   *
   * Se usa también con las filas YA aceptadas del propio archivo: dos filas
   * iguales dentro del mismo CSV son un duplicado tan real como uno contra la
   * base, y un export de otro sistema los trae con frecuencia.
   */
  agregar(p: T): void {
    for (const k of clavesDeBloqueo(p)) {
      const l = this.bloques.get(k)
      if (!l) { this.bloques.set(k, [p]); continue }
      if (l.length >= TOPE_BLOQUE) { this.saturados.add(k); continue }
      l.push(p)
    }
  }

  /** Los que merecen compararse con éste. Sin repetir. */
  vecinos(p: PacienteComparable): T[] {
    const vistos = new Set<T>()
    for (const k of clavesDeBloqueo(p)) {
      const l = this.bloques.get(k)
      if (!l) continue
      /**
       * Un bloque saturado NO se recorre.
       *
       * Recorrer 50 000 candidatos por fila es justo lo que el bloqueo existe
       * para evitar, y además no encuentra nada útil: un bloque de ese tamaño
       * significa que la señal (el prefijo del apellido) no distingue a nadie.
       * Las señales fuertes —CURP, teléfono, fecha— siguen funcionando, y son
       * las que de verdad deciden.
       */
      if (this.saturados.has(k)) continue
      for (const c of l) vistos.add(c)
    }
    return [...vistos]
  }

  /** Las señales que dejaron de vigilarse por saturación. Van al informe. */
  bloquesSaturados(): string[] {
    return [...this.saturados].sort()
  }
}

/* ═══════════════════════ LA DECISIÓN ═══════════════════════ */

/**
 * A qué cubo va esta fila.
 *
 * El orden de las reglas es la política:
 *
 *  1. **Nadie se le parece** → se crea. Es el caso mayoritario de una migración.
 *  2. **Más de un candidato «seguro»** → `AMBIGUOUS`. Elegir el de mayor puntaje
 *     entre dos expedientes indistinguibles es echar a cara o cruz el expediente
 *     de alguien; `duplicados.ts` ya toma esa misma decisión al agendar.
 *  3. **Un solo candidato «seguro»** → `EXACT_MATCH`. No se vuelve a crear.
 *  4. **Sólo «probables»** → `LIKELY_MATCH`. A revisión: NO se funde.
 *
 * Fíjate en que `EXACT_MATCH` no funde nada tampoco. Sólo dice «éste ya está»:
 * la fila no se escribe y el informe la cuenta como duplicado. Fundir contenido
 * de dos expedientes es una operación distinta, con su propia aprobación, y no
 * es de este carril.
 */
export function emparejar<T extends PacienteComparable>(
  fila: PacienteComparable,
  indice: IndicePacientes<T>,
): Emparejamiento<T> {
  const candidatos: Candidato<T>[] = []
  for (const p of indice.vecinos(fila)) {
    const r = compararPacientes(fila, p)
    if (!r) continue
    candidatos.push({ paciente: p, certeza: r.certeza, motivo: r.motivo, puntaje: r.puntaje, senales: senalesDe(fila, p) })
  }

  if (candidatos.length === 0) return { clase: 'NEW_RECORD', candidatos: [], porQue: [] }

  candidatos.sort((a, b) => b.puntaje - a.puntaje)
  const seguros = candidatos.filter(c => c.certeza === 'seguro')

  if (seguros.length > 1) {
    return { clase: 'AMBIGUOUS', candidatos, porQue: ['VARIOS_CANDIDATOS', ...seguros[0].senales] }
  }
  if (seguros.length === 1) {
    return { clase: 'EXACT_MATCH', candidatos, porQue: seguros[0].senales }
  }
  /**
   * Varios «probables» son MÁS dudosos que uno, no menos.
   *
   * Un solo parecido es un candidato; tres parecidos significa que el nombre es
   * común en ese consultorio y que ninguna de las tres coincidencias vale gran
   * cosa. Se distingue para que la pantalla pueda decirlo.
   */
  if (candidatos.length > 1) {
    return { clase: 'AMBIGUOUS', candidatos, porQue: ['VARIOS_CANDIDATOS', ...candidatos[0].senales] }
  }
  return { clase: 'LIKELY_MATCH', candidatos, porQue: candidatos[0].senales }
}

/**
 * ¿Esta clase permite escribir un expediente nuevo?
 *
 * Sólo `NEW_RECORD`. Es una función de una línea y existe para que la respuesta
 * viva en un solo sitio: si algún día se quiere que `LIKELY_MATCH` entre solo,
 * se cambia aquí y falla la prueba que lo vigila — en vez de aparecer repetida
 * en tres llamadores y cambiar en dos de ellos.
 */
export function puedeCrearse(c: ClaseEmparejamiento): boolean {
  return c === 'NEW_RECORD'
}

/** Las clases que exigen que una persona mire. */
export function requiereRevision(c: ClaseEmparejamiento): boolean {
  return c === 'LIKELY_MATCH' || c === 'AMBIGUOUS'
}

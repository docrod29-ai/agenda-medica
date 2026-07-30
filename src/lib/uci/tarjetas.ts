/**
 * LANDING DE UCI — charter §3, la tarjeta por paciente.
 *
 * ── QUÉ PONE Y QUÉ NO ────────────────────────────────────────────────────────
 *
 * Sólo hechos que ya están registrados: quién, en qué cama, desde cuándo, y
 * cuándo fue la última vez que alguien anotó algo. **Ningún veredicto clínico.**
 * La tarjeta no dice si el paciente está mejor o peor: eso lo dicen los motores
 * que sí tienen la dirección de beneficio declarada (`morning-brief`), y sólo
 * para las métricas donde está declarada.
 *
 * ── EL ORDEN ES LA FUNCIÓN ───────────────────────────────────────────────────
 *
 * Las tarjetas se ordenan por **antigüedad de la última toma**, no por número de
 * cama. En una UCI, el paciente del que hace más rato que no se anota nada es el
 * que hay que mirar; ordenarlas por cama esconde justo a ese.
 *
 * ── DÍA DE UCI: LA CONVENCIÓN ESTÁ DECLARADA ─────────────────────────────────
 *
 * Se cuenta por **bloques de 24 h transcurridas**: día 1 son las primeras 24 h
 * desde el ingreso. Es la única forma de contarlo sin depender de la zona
 * horaria del navegador (lección REG-011). Si la unidad cuenta por día de
 * calendario, es otra convención y la fija el médico — ver el ADR.
 *
 * Módulo PURO: el instante entra como parámetro, no hay reloj propio.
 */

export interface EntradaTarjeta {
  internamientoId: string
  pacienteNombre: string
  /** Cama del episodio. Puede faltar. */
  cama?: string | null
  servicio?: string | null
  dxIngreso?: string | null
  /** Ingreso al episodio, ISO. */
  ingresoEn: string
  /** La toma VIGENTE más reciente (ya filtrada por `serieTomas`). */
  ultimaTomaEn?: string | null
  ultimaTomaPor?: string | null
  ultimaTomaFuente?: string | null
}

export interface TarjetaUci {
  internamientoId: string
  pacienteNombre: string
  cama: string | null
  servicio: string | null
  dxIngreso: string | null
  /** Día de estancia por bloques de 24 h: día 1 = primeras 24 h. */
  diaUci: number
  horasDesdeIngreso: number
  ultimaTomaEn: string | null
  /** Horas desde la última toma. `null` si no hay ninguna. */
  horasDesdeUltimaToma: number | null
  ultimaTomaPor: string | null
  ultimaTomaFuente: string | null
  /** Huecos de documentación. Nunca se callan. */
  avisos: string[]
}

const H = 3_600_000

export const SIN_TOMAS =
  'Sin ninguna toma registrada en este episodio: la tarjeta no puede decir nada ' +
  'del estado actual.'

/**
 * Arma la tarjeta de un paciente.
 *
 * @param ahoraIso instante de referencia. Entra como parámetro para que el
 *   módulo sea puro y la pantalla sea reproducible en un test.
 */
export function construirTarjeta(e: EntradaTarjeta, ahoraIso: string): TarjetaUci {
  const ahora = Date.parse(ahoraIso)
  if (Number.isNaN(ahora)) throw new Error(`construirTarjeta: fecha inválida «${ahoraIso}»`)

  const ingreso = Date.parse(e.ingresoEn)
  const avisos: string[] = []

  let horasDesdeIngreso = 0
  let diaUci = 1
  if (Number.isNaN(ingreso)) {
    avisos.push('No consta la fecha de ingreso: no se puede calcular el día de UCI.')
  } else {
    horasDesdeIngreso = (ahora - ingreso) / H
    // Día 1 = primeras 24 h. Un ingreso en el futuro no produce un día 0 ni
    // negativo: se declara y se queda en 1.
    if (horasDesdeIngreso < 0) {
      avisos.push('La fecha de ingreso es posterior al momento actual.')
      horasDesdeIngreso = 0
    }
    diaUci = Math.floor(horasDesdeIngreso / 24) + 1
  }

  const tomaMs = e.ultimaTomaEn ? Date.parse(e.ultimaTomaEn) : NaN
  const hayToma = !Number.isNaN(tomaMs)
  if (!hayToma) avisos.push(SIN_TOMAS)

  if (!e.cama || e.cama.trim() === '') {
    avisos.push('Sin cama registrada en el episodio: el tablero de camas no puede ubicarlo.')
  }

  return {
    internamientoId: e.internamientoId,
    pacienteNombre: e.pacienteNombre,
    cama: e.cama?.trim() || null,
    servicio: e.servicio ?? null,
    dxIngreso: e.dxIngreso ?? null,
    diaUci,
    horasDesdeIngreso,
    ultimaTomaEn: hayToma ? e.ultimaTomaEn! : null,
    horasDesdeUltimaToma: hayToma ? (ahora - tomaMs) / H : null,
    ultimaTomaPor: e.ultimaTomaPor ?? null,
    ultimaTomaFuente: e.ultimaTomaFuente ?? null,
    avisos,
  }
}

/**
 * Ordena por lo que hay que mirar primero.
 *
 * 1. Los que **no tienen ninguna toma** — de esos no se sabe nada.
 * 2. Los de toma más antigua.
 * 3. A igualdad, por cama, para que la lista no baile entre recargas.
 *
 * Ordenar por cama escondería justo al paciente del que hace horas que nadie
 * anota nada, que es el que la pantalla existe para señalar.
 */
export function ordenarTarjetas(tarjetas: readonly TarjetaUci[]): TarjetaUci[] {
  return [...tarjetas].sort((a, b) => {
    const ha = a.horasDesdeUltimaToma, hb = b.horasDesdeUltimaToma
    if (ha === null && hb !== null) return -1
    if (hb === null && ha !== null) return 1
    if (ha !== null && hb !== null && ha !== hb) return hb - ha
    return (a.cama ?? '').localeCompare(b.cama ?? '', 'es', { numeric: true })
  })
}

/** Tarjetas sin ninguna toma: el hueco de documentación más grave. */
export function sinNingunaToma(tarjetas: readonly TarjetaUci[]): TarjetaUci[] {
  return tarjetas.filter(t => t.horasDesdeUltimaToma === null)
}

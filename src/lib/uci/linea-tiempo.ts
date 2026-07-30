/**
 * LÍNEA DE TIEMPO ÚNICA — charter §33.
 *
 *   «Crear única línea temporal:
 *      07:00 labs · 07:20 ABG · 08:00 rounds · 08:15 PEEP ↑ · 08:20 MAP ↓
 *      08:27 NE ↑ · 09:10 POCUS · 09:30 VTI ↓ · 10:00 culture positive
 *      10:15 antibiotic change»
 *
 * ── QUÉ APORTA, Y POR QUÉ NO LO DABA NINGUNA PANTALLA ────────────────────────
 *
 * Cada fuente ya tenía su propia vista: las tomas en la gráfica, la titulación en
 * su tabla, los cultivos en microbiología, los traslados en el episodio. Todas
 * ciertas y todas separadas.
 *
 * El intensivista que llega a las 11:00 quiere saber **qué pasó en orden**, no
 * abrir seis pantallas y reconstruirlo de memoria. La secuencia
 * «PEEP ↑ → MAP ↓ → NE ↑» sólo se ve cuando las tres viven en la misma línea.
 *
 * ── LO QUE NO HACE ───────────────────────────────────────────────────────────
 *
 * **No interpreta.** La correlación temporal ya existe en `correlacion.ts`, que
 * detecta asociaciones y —correctamente— *nunca afirma causalidad*. Este módulo
 * es anterior a eso: sólo ORDENA y declara de dónde vino cada cosa.
 *
 * **No inventa eventos.** Si una fuente no dio nada en una hora, esa hora no
 * aparece. Un hueco en la línea es información: significa que nadie documentó.
 *
 * Módulo PURO.
 */

/** De dónde vino el evento. Se conserva: es la mitad de la información. */
export const ORIGENES_EVENTO = [
  'toma',           // lectura del panel de UCI
  'titulacion',     // cambio de velocidad/dosis de una infusión
  'laboratorio',
  'gasometria',
  'microbiologia',
  'imagen',         // POCUS, rayos, tomografía
  'nota',           // evolución, ingreso, interconsulta
  'orden',          // medicamento, estudio, procedimiento
  'cama',           // ingreso, traslado, egreso
  'dispositivo',    // colocación o retiro de un invasivo
] as const
export type OrigenEvento = (typeof ORIGENES_EVENTO)[number]

/** Dirección de un cambio numérico. Sin interpretación clínica. */
export type DireccionEvento = 'sube' | 'baja' | 'estable'

export interface EventoLinea {
  /** ISO. Cuándo OCURRIÓ, no cuándo se capturó. */
  en: string
  origen: OrigenEvento
  /** Lo que se muestra: «PEEP», «hemocultivo», «traslado a UCI-04». */
  etiqueta: string
  /** Sólo si es un cambio numérico. */
  direccion?: DireccionEvento
  valor?: number | string
  unidad?: string
  /** Quién lo hizo o documentó. */
  por?: string
  /** id del documento de origen, para poder abrirlo desde la línea. */
  refId?: string
}

/** Un tramo de la línea, agrupado por hora de reloj. */
export interface TramoLinea {
  /** «08:00» en la zona que pase quien llama. */
  hora: string
  eventos: EventoLinea[]
}

/** Marca visual de la dirección. Igual que la del charter: ↑ ↓. */
export function flecha(d?: DireccionEvento): string {
  return d === 'sube' ? '↑' : d === 'baja' ? '↓' : ''
}

/**
 * Junta eventos de varias fuentes en UNA línea ordenada.
 *
 * Descarta los de fecha inválida —y los DEVUELVE aparte— en vez de tirarlos en
 * silencio: un evento que no se pudo ubicar en el tiempo sigue siendo un hecho
 * clínico, y esconderlo sería peor que mostrarlo mal colocado.
 */
export function unirLinea(
  ...fuentes: readonly (readonly EventoLinea[])[]
): { linea: EventoLinea[]; sinFecha: EventoLinea[] } {
  const todos = fuentes.flat()
  const sinFecha = todos.filter(e => Number.isNaN(Date.parse(e.en)))
  const linea = todos
    .filter(e => !Number.isNaN(Date.parse(e.en)))
    .sort((a, b) => {
      const d = Date.parse(a.en) - Date.parse(b.en)
      if (d !== 0) return d
      // Empate: orden estable por origen, para que dos corridas den lo mismo.
      return ORIGENES_EVENTO.indexOf(a.origen) - ORIGENES_EVENTO.indexOf(b.origen)
    })
  return { linea, sinFecha }
}

/**
 * Agrupa por hora de reloj, como en el ejemplo del charter.
 *
 * @param formatoHora Lo pasa quien llama: la zona del hospital es suya, y este
 *   módulo no debe elegirla (fue la causa real de REG-011, el corte de caja que
 *   usaba la zona equivocada para el norte del país).
 */
export function porHora(
  linea: readonly EventoLinea[],
  formatoHora: (iso: string) => string,
): TramoLinea[] {
  const tramos: TramoLinea[] = []
  for (const e of linea) {
    const hora = formatoHora(e.en)
    const ultimo = tramos[tramos.length - 1]
    if (ultimo !== undefined && ultimo.hora === hora) ultimo.eventos.push(e)
    else tramos.push({ hora, eventos: [e] })
  }
  return tramos
}

/** Sólo un rango. Para «las últimas 12 horas» del Morning Brief (§30). */
export function entre(
  linea: readonly EventoLinea[],
  desdeIso: string,
  hastaIso: string,
): EventoLinea[] {
  const d = Date.parse(desdeIso), h = Date.parse(hastaIso)
  if (Number.isNaN(d) || Number.isNaN(h)) {
    throw new Error('entre: rango inválido; se esperan dos fechas ISO')
  }
  if (d > h) throw new Error('entre: la fecha inicial es posterior a la final')
  return linea.filter(e => {
    const t = Date.parse(e.en)
    return t >= d && t <= h
  })
}

/** Filtra por origen, para las vistas que sólo quieren una fuente. */
export function deOrigen(
  linea: readonly EventoLinea[],
  origenes: readonly OrigenEvento[],
): EventoLinea[] {
  return linea.filter(e => origenes.includes(e.origen))
}

/**
 * Huecos de documentación mayores a `horas`.
 *
 * NO dice que sea malo —la frecuencia de registro es política del hospital, y la
 * decisión ICU-Q4.1 lo dice explícitamente—; sólo señala dónde la línea está
 * vacía. Un turno sin registros puede ser un paciente estable o una omisión, y
 * este módulo no sabe cuál.
 */
export function huecosDeDocumentacion(
  linea: readonly EventoLinea[],
  horas: number,
): { desde: string; hasta: string; horas: number }[] {
  if (!Number.isFinite(horas) || horas <= 0) {
    throw new Error('huecosDeDocumentacion: `horas` debe ser un número positivo')
  }
  const ms = horas * 3_600_000
  const salida: { desde: string; hasta: string; horas: number }[] = []
  for (let i = 1; i < linea.length; i++) {
    const a = Date.parse(linea[i - 1].en), b = Date.parse(linea[i].en)
    if (b - a > ms) {
      salida.push({
        desde: linea[i - 1].en,
        hasta: linea[i].en,
        horas: Math.round(((b - a) / 3_600_000) * 10) / 10,
      })
    }
  }
  return salida
}

// ── Adaptadores desde las formas que ya existen ───────────────────────────

/** Cambios de titulación (§19) → eventos. */
export function desdeTitulacion(
  medicamento: string,
  cambios: readonly { en: string; velocidad: number; dosisCalculada?: number; unidadDosis?: string; por: string }[],
): EventoLinea[] {
  return cambios.map((c, i) => {
    const previo = cambios[i - 1]
    const direccion: DireccionEvento | undefined =
      previo === undefined ? undefined
      : c.velocidad > previo.velocidad ? 'sube'
      : c.velocidad < previo.velocidad ? 'baja'
      : 'estable'
    return {
      en: c.en,
      origen: 'titulacion' as const,
      etiqueta: medicamento,
      ...(direccion !== undefined ? { direccion } : {}),
      ...(c.dosisCalculada !== undefined ? { valor: c.dosisCalculada } : { valor: c.velocidad }),
      ...(c.unidadDosis !== undefined ? { unidad: c.unidadDosis } : { unidad: 'mL/h' }),
      por: c.por,
    }
  })
}

/** Tomas del panel (ICU-003) → un evento por toma. */
export function desdeTomas(
  tomas: readonly { id: string; medidoEn: string; por: string }[],
): EventoLinea[] {
  return tomas.map(t => ({
    en: t.medidoEn,
    origen: 'toma' as const,
    etiqueta: 'Registro de parámetros',
    por: t.por,
    refId: t.id,
  }))
}

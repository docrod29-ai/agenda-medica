/**
 * LEER UNA FECHA SUELTA COMO EL DÍA QUE ES.
 *
 * ── EL FALLO, EN UNA LÍNEA ───────────────────────────────────────────────────
 *
 * `new Date('2020-03-15')` NO es el 15 de marzo. El estándar obliga a leer una
 * fecha sin hora como medianoche **UTC**, y al oeste de Greenwich eso cae el día
 * ANTERIOR en hora local. Como `getDate()`, `getMonth()` y las restas de
 * milisegundos contra `Date.now()` sí son locales, todo lo que se derive de esa
 * fecha se corre un día.
 *
 * En México (UTC−6) el efecto es sistemático, no ocasional.
 *
 * ── DÓNDE DOLÍA ──────────────────────────────────────────────────────────────
 *
 *  · **Edad del paciente.** Un niño nacido el 15 «cumplía años» el 14 — todos
 *    los años. De esa edad comen la dosis pediátrica por bandas, las
 *    contraindicaciones por edad y el calendario de vacunación.
 *  · **Días post-trasplante.** Las fases de riesgo infeccioso están en los días
 *    30, 100 y 180: un paciente en el día 29 podía reportarse en el 30 y saltar
 *    de fase, cambiando los patógenos esperados que se listan.
 *
 * Ninguno de los dos se ve raro en pantalla. Ése es el problema.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 *
 * Sólo se corrige la fecha SUELTA (`YYYY-MM-DD`), que es la que escribe una
 * persona en un campo de fecha. Una marca de tiempo completa lleva su propia
 * hora y su propio huso: se respeta tal cual, porque ahí el instante SÍ es el
 * dato.
 *
 * Módulo PURO.
 */

/** ¿Es una fecha de calendario sin hora? */
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Convierte a `Date` respetando el día de calendario.
 *
 * Una entrada inválida devuelve una fecha inválida —no una de hoy, ni el epoch—
 * para que quien llama pueda distinguir «no hay dato» de «hay un dato».
 */
export function fechaLocalDesdeISO(iso: string | null | undefined): Date {
  const s = String(iso ?? '').trim()
  const m = SOLO_FECHA.exec(s)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(s)
}

/**
 * Días completos transcurridos entre una fecha y un instante. `null` si no se sabe.
 *
 * `null` y no `0`: un cero significa «hoy», y en días post-trasplante eso
 * colocaría al paciente en la fase más aguda por no tener el dato.
 */
export function diasDesde(fechaISO: string | null | undefined, ahoraMs: number): number | null {
  const d = fechaLocalDesdeISO(fechaISO)
  const t = d.getTime()
  if (!Number.isFinite(t)) return null
  const dias = Math.floor((ahoraMs - t) / 86_400_000)
  return Number.isFinite(dias) ? dias : null
}

/**
 * ESCRIBIR UNA FECHA DE CALENDARIO COMO EL DÍA QUE ES — Y SIN INVENTARLE HORA.
 *
 * ── QUÉ FALLABA, Y DÓNDE ────────────────────────────────────────────────────
 *
 * Tres pantallas pintaban la fecha de una nota así:
 *
 *     new Date(nota.fechaConsulta).toLocaleString('es-MX',
 *       { dateStyle: 'medium', timeStyle: 'short' })
 *
 * `fechaConsulta` es una fecha SUELTA (`YYYY-MM-DD`). Medido en
 * `America/Mexico_City`, un encuentro del **1 sep 2026** se pintaba
 * **«31 ago 2026, 6:00 p.m.»**. Dos errores en una línea:
 *
 *  1. **El día está mal.** Es el fallo que este módulo existe para arreglar,
 *     en la superficie donde más importa: el eje sobre el que se lee la
 *     historia clínica de un paciente.
 *  2. **La hora es inventada.** Pedir `timeStyle` a un valor que no tiene hora
 *     no deja el hueco vacío: rellena con la medianoche desplazada. Un dato que
 *     nadie registró, escrito con la misma tipografía que los que sí.
 *
 * La tercera de esas pantallas es `/nota/[patientId]/[notaId]`, el visor del
 * documento firmado. Ahí la fecha no es una etiqueta: es parte de lo que se
 * sostiene medicolegalmente.
 *
 * ── POR QUÉ NO SE VIO ANTES ─────────────────────────────────────────────────
 *
 * `fechaLocalDesdeISO` lleva escrito el fallo completo desde que se creó — para
 * la edad pediátrica y los días post-trasplante — y su único consumidor era
 * `pediatria.ts`. La lección se aprendió en un módulo y no en el de al lado.
 * Y en el emulador no se veía: con **un** encuentro sembrado no hay línea de
 * tiempo que leer, así que nadie miraba estas fechas.
 *
 * ── LA REGLA ────────────────────────────────────────────────────────────────
 *
 * Una fecha suelta se escribe como día, y **sin hora**. Si el instante importa,
 * el dato tiene que ser una marca de tiempo completa — y entonces esta función
 * la respeta tal cual, porque ahí la hora sí es el dato.
 */
export function fechaLegible(
  iso: string | null | undefined,
  estilo: 'medium' | 'long' | 'short' = 'medium',
): string {
  if (!iso) return ''
  const soloDia = SOLO_FECHA.test(iso.trim())
  const d = fechaLocalDesdeISO(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-MX', soloDia
    ? { dateStyle: estilo }
    // Marca de tiempo completa: la hora es un dato, se enseña.
    : { dateStyle: estilo, timeStyle: 'short' })
}

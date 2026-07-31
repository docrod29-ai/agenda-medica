/**
 * Utilidades de fecha/hora ancladas a zona horaria — fix del bug "hoy salta
 * a mañana".
 *
 * PROBLEMA: `new Date().toISOString().slice(0,10)` devuelve la fecha en UTC.
 * En México (UTC-6), después de las ~18:00 hora local el UTC ya es el día
 * siguiente → la agenda mostraba "mañana" como "hoy", los recordatorios se
 * desfasaban 6h y la validación de "no agendar en el pasado" fallaba.
 *
 * SOLUCIÓN: Intl.DateTimeFormat con timeZone explícito da la fecha/hora
 * correcta en la zona del consultorio sin importar dónde corra el servidor
 * (Vercel corre en UTC).
 *
 * Default: America/Mexico_City (México abolió el horario de verano en 2022,
 * así que es UTC-6 estable en casi todo el país). Acepta override por si una
 * clínica está en otra zona (config.zonaHoraria).
 */

/**
 * Zona de ÚLTIMO RECURSO: sólo se usa cuando no hay ninguna publicada ni pasada.
 *
 * La auditoría del 26-jul lo confirmó: las funciones aceptaban `tz` pero 32
 * llamadas NO se lo pasaban, así que todo el consultorio de Hermosillo (UTC-7) o
 * Tijuana (UTC-8) —zonas que la propia interfaz ofrece— quedaba corrido 1-2 h en
 * recordatorios, corte de caja y en la validación de «no agendar en el pasado».
 * Y era SILENCIOSO: nadie veía un error, sólo citas raras.
 *
 * (Este comentario llegó a decir que `tz` era obligatoria. Nunca lo fue: era la
 * intención de un intento que se revirtió. Corregido el 30-jul-2026.)
 */
export const TZ_DEFAULT = 'America/Mexico_City'

/* ════════════════════════════════════════════════════════════════════════
   La zona del consultorio, publicada una vez
   ════════════════════════════════════════════════════════════════════════ */

/**
 * ── POR QUÉ ESTO Y NO PASAR `tz` EN CADA LLAMADA ─────────────────────────────
 *
 * Ya se intentó lo otro. Hacer `tz` obligatoria y perseguir las 43 llamadas
 * significa añadir `useConfig()` a diez páginas de producción y mover
 * declaraciones para que la zona quede **por encima** de un `useState(hoyISO())`.
 * Se hizo, se rompió (`tzClinica` usada antes de declararse, un bloque movido
 * dentro de la función equivocada) y se revirtió entero. El problema no era la
 * paciencia: es que el arreglo tocaba más superficie que el error.
 *
 * En el NAVEGADOR la zona del consultorio es, de verdad, un dato de sesión: una
 * pestaña, un médico, un consultorio. Así que se publica **una vez** cuando la
 * configuración llega, y las 40 llamadas de cliente pasan a ser correctas **sin
 * tocar ni una línea en el sitio de la llamada**.
 *
 * ── LA PARTE QUE NO ES NEGOCIABLE ────────────────────────────────────────────
 *
 * En el SERVIDOR esto sería un error grave: una función de Vercel atiende a
 * muchos consultorios, y una variable de módulo se compartiría entre peticiones
 * — el corte de caja de Tijuana calculado con la zona del que entró antes.
 *
 * Por eso `fijarZonaConsultorio` **no es una convención, es una guarda**: fuera
 * del navegador no hace nada. En el servidor `zonaActiva()` devuelve siempre
 * `TZ_DEFAULT`, igual que hoy, y quien necesite la zona real tiene que pasarla.
 * Las rutas de API la pasan explícitamente.
 */
let zonaPublicada: string | null = null

/** ¿Estamos en el navegador? Único sitio donde la zona puede ser global. */
const enNavegador = () => typeof window !== 'undefined'

/**
 * Se recuerda entre cargas, y esto NO es una optimización.
 *
 * La configuración llega por un `onSnapshot` de Firestore, o sea **después** del
 * primer render. Y hay pantallas que congelan la fecha justo en ese primer
 * render (`useState(hoyISO())` en finanzas y en corte de caja): cuando la zona
 * real llegara, el valor ya estaría fijado. En Tijuana, entre las 22:00 y la
 * medianoche, eso abre la pantalla en el día siguiente.
 *
 * Guardarla deja la zona disponible **de forma síncrona** desde la segunda carga
 * de ese navegador, que es el caso normal. No es un dato de paciente: es un
 * ajuste del consultorio, y se borra al cerrar sesión igual que lo demás.
 */
const CLAVE = 'nx.tz.consultorio'

/** Lee la zona recordada. Tolera modo privado y cuota llena sin romper nada. */
function zonaRecordada(): string | null {
  if (!enNavegador()) return null
  try { return window.localStorage.getItem(CLAVE) } catch { return null }
}

/**
 * Publica la zona del consultorio para las llamadas que no la pasan.
 *
 * Sólo surte efecto en el navegador. En el servidor es **deliberadamente** un
 * no-op: ver arriba.
 *
 * @param tz zona IANA (`config.zonaHoraria`). Vacío o inválido → se ignora.
 * @returns `true` si quedó publicada.
 */
export function fijarZonaConsultorio(tz: string | null | undefined): boolean {
  if (!enNavegador()) return false
  if (!tz || typeof tz !== 'string') return false
  // Una zona inválida reventaría TODAS las fechas de la app. Se comprueba una vez
  // aquí en lugar de dejar que Intl lance en cada render.
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }) } catch { return false }
  zonaPublicada = tz
  try { window.localStorage.setItem(CLAVE, tz) } catch { /* modo privado: da igual */ }
  return true
}

/** Olvida la zona publicada. Para el cierre de sesión y para los tests. */
export function limpiarZonaConsultorio(): void {
  zonaPublicada = null
  if (!enNavegador()) return
  try { window.localStorage.removeItem(CLAVE) } catch { /* nada que limpiar */ }
}

/**
 * La zona que se usa cuando la llamada no pasa ninguna.
 *
 * Orden: la publicada en esta sesión → la recordada de la carga anterior →
 * `TZ_DEFAULT`. En el servidor sólo existe la última, a propósito.
 */
export function zonaActiva(): string {
  if (zonaPublicada) return zonaPublicada
  const recordada = zonaRecordada()
  if (recordada) {
    // Se valida antes de usarla: el usuario puede haber tocado localStorage, y
    // una zona inválida haría lanzar a Intl en cada render de la app.
    try { new Intl.DateTimeFormat('en-CA', { timeZone: recordada }); zonaPublicada = recordada; return recordada }
    catch { try { window.localStorage.removeItem(CLAVE) } catch { /* — */ } }
  }
  return TZ_DEFAULT
}

/* ════════════════════════════════════════════════════════════════════════ */

/** Fecha de HOY en la zona dada, formato YYYY-MM-DD. */
export function hoyISO(tz: string = zonaActiva()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/**
 * Fecha de un Date ARBITRARIO en la zona dada, formato YYYY-MM-DD.
 * Usar en lugar de `date.toISOString().slice(0,10)`, que da el día en UTC y
 * corre las fechas un día por las tardes en México (UTC-6).
 */
export function fechaISOLocal(date: Date, tz: string = zonaActiva()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

/** Hora actual en la zona dada como minutos desde medianoche (0-1439). */
export function ahoraMinutosDelDia(tz: string = zonaActiva()): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const h = Number(partes.find(p => p.type === 'hour')?.value ?? 0)
  const m = Number(partes.find(p => p.type === 'minute')?.value ?? 0)
  // Intl puede devolver "24" a medianoche en algunos motores; normalizar.
  return ((h % 24) * 60) + m
}

/**
 * Suma (o resta) días a una fecha YYYY-MM-DD de forma segura.
 * Ancla a mediodía para que ningún cambio de zona/DST cruce el día.
 */
export function sumarDiasISO(fechaISO: string, n: number): string {
  const d = new Date(fechaISO + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/**
 * Offset (en minutos, + = adelante de UTC) de una IANA time zone en un instante.
 * Reconstruye la hora de pared que la zona muestra para ese `date` y la compara
 * contra el mismo `date` en UTC. Maneja DST (la franja fronteriza MX sí lo tiene:
 * Tijuana sigue el horario del Pacífico de EE.UU.).
 */
function offsetZonaMin(tz: string, date: Date): number {
  const p: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date)) p[part.type] = part.value
  const comoUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second)
  return Math.round((comoUTC - date.getTime()) / 60000)
}

/**
 * Convierte una hora de PARED (YYYY-MM-DD + HH:MM) en la zona de la clínica al
 * instante UTC real. L5 auditoría maestra 2026-07: antes el offset -06:00 estaba
 * QUEMADO, así que Tijuana (UTC-8, con DST) y Hermosillo (UTC-7) quedaban corridas
 * 1–2 h en recordatorios, corte de caja y bloqueos de agenda. Ahora se calcula el
 * offset real de `tz` en esa fecha vía Intl (maneja DST). Default: Mexico City
 * (UTC-6 estable). El parámetro `tz` sale de config.zonaHoraria.
 *
 * Antes el cron hacía new Date(`${fecha}T${hora}:00`) que se interpretaba en la
 * zona del SERVIDOR (UTC en Vercel) → las ventanas de recordatorio disparaban 6h corridas.
 */
export function instanteMX(fechaISO: string, horaHHMM: string, tz: string = zonaActiva()): Date {
  const [Y, M, D] = fechaISO.split('-').map(Number)
  const [h, m] = horaHHMM.split(':').map(Number)
  const comoSiUTC = Date.UTC(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0)
  // El offset se calcula sobre el instante aproximado (exacto salvo en la hora del
  // salto de DST, caso rarísimo para una cita) y se resta para obtener el UTC real.
  const off = offsetZonaMin(tz, new Date(comoSiUTC))
  return new Date(comoSiUTC - off * 60000)
}

/**
 * Compara dos instantes contra "ahora" en la zona dada para saber si una
 * fecha+hora local ya pasó. fechaISO = YYYY-MM-DD, horaHHMM = "HH:MM".
 */
export function yaPaso(fechaISO: string, horaHHMM: string, tz: string = zonaActiva()): boolean {
  const hoy = hoyISO(tz)
  if (fechaISO < hoy) return true
  if (fechaISO > hoy) return false
  // mismo día: comparar minutos
  const [h, m] = horaHHMM.split(':').map(Number)
  const minSlot = (h || 0) * 60 + (m || 0)
  return minSlot < ahoraMinutosDelDia(tz)
}

/**
 * VOLVER DEVUELVE EL CONTEXTO — V9 · NAVIGATION-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El requisito de la directiva es literal: «Agenda → Paciente → Consulta →
 * Resultados → Consulta debe devolver exactamente el contexto anterior».
 *
 * No lo hacía, por dos motivos que se sumaban:
 *
 * 1. **La consulta no volvía atrás: empujaba.** Su botón hacía `push` a un
 *    destino FIJO (el expediente). Entrando desde la agenda —que es como se
 *    entra a una consulta— el historial quedaba `/citas → /consulta →
 *    /expediente` y el médico oscilaba entre las dos últimas. Volver a la agenda
 *    era renavegar, **por cada paciente del día**.
 * 2. **Y aunque volviera, la agenda se reiniciaba.** `useState(hoy)` y
 *    `useState('todas')`: el App Router remonta la pantalla, así que quien
 *    trabajaba el jueves desde el martes volvía a poner la fecha cada vez. El
 *    navegador restaura el scroll; el estado de React no lo restaura nadie.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * `NAVIGATION_STATE_AUDIT.md` §2 nº 7 y §3 nº 10, siguiendo el historial que
 * deja cada pantalla. `useSmartBack` ya existía y lo usaban **diez** pantallas;
 * la consulta —la única a la que se entra desde la agenda— era de las que no.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una pantalla a la que se llega desde varios sitios **no tiene un destino de
 * vuelta fijo**: tiene el sitio del que se vino. `router.back()` es además lo
 * único que hace que el navegador restaure la posición de la lista anterior.
 * El destino fijo se queda como respaldo para quien llega por enlace directo, y
 * el rótulo dice cuál de las dos cosas va a pasar.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * `hayPantallaAnterior()` se prueba con `idx` 0, ausente y > 0 — los tres casos
 * que deciden entre retroceder y empujar. Y el estado recordado se prueba con
 * el almacenamiento vacío, con un valor guardado y con un valor corrupto.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No abre un navegador.** Comprueba que la pantalla use el mecanismo
 *   correcto, no que el ciclo completo se vea bien. Eso sigue siendo
 *   `NAV-NAVEGADOR-001`, y la directiva V9 §4 no aprueba interfaz leyendo
 *   código.
 * - No cubre el resto del estado que muere al navegar: turnos diarizados,
 *   evidencia, NER, roles de hablante (audit §2 nº 8), el panel de laboratorio
 *   sin confirmar (nº 11) ni la herramienta clínica seleccionada (nº 17).
 * - El buscador de la agenda **sigue sin recordarse, a propósito**: su texto es
 *   el nombre de un paciente, y `limpiarBorradoresLocales()` sólo purga las
 *   claves declaradas en `PREFIJOS_PHI`. Recordarlo exige declararlo ahí
 *   primero, y eso es una decisión de la regla de privacidad.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hayPantallaAnterior } from '@/hooks/useSmartBack'
import { leerRecordado } from '@/hooks/useEstadoRecordado'

const leer = (...ruta: string[]) => readFileSync(join(process.cwd(), ...ruta), 'utf8')

const CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const CITAS = leer('src', 'app', '(dashboard)', 'citas', 'page.tsx')
const CALENDARIO = leer('src', 'app', '(dashboard)', 'calendario', 'page.tsx')

describe('«atrás» distingue entre retroceder y empujar', () => {
  const historiaOriginal = globalThis.window

  afterEach(() => {
    if (historiaOriginal === undefined) Reflect.deleteProperty(globalThis, 'window')
    vi.unstubAllGlobals()
  })

  it('sin ventana (servidor) no hay pantalla anterior', () => {
    expect(hayPantallaAnterior()).toBe(false)
  })

  it('idx 0 significa que se llegó por enlace directo: no hay a dónde volver', () => {
    vi.stubGlobal('window', { history: { state: { idx: 0 } } })
    expect(hayPantallaAnterior()).toBe(false)
  })

  it('sin `idx` tampoco se retrocede', () => {
    // Una recarga completa puede dejar el estado sin índice. Retroceder ahí
    // saca al médico de la aplicación entera.
    vi.stubGlobal('window', { history: { state: null } })
    expect(hayPantallaAnterior()).toBe(false)
  })

  it('idx > 0 significa que hay pantalla anterior dentro de la app', () => {
    vi.stubGlobal('window', { history: { state: { idx: 3 } } })
    expect(hayPantallaAnterior()).toBe(true)
  })
})

describe('la consulta ya no empuja a un destino fijo', () => {
  it('usa el «atrás» inteligente, como las otras diez pantallas', () => {
    expect(CONSULTA).toContain('useVolverConNombre(')
  })

  it('su botón de volver NO hace push a un destino fijo', () => {
    /**
     * Es la prueba que falla sin el arreglo: mientras exista este `push`, entrar
     * desde la agenda deja el historial creciendo y no hay vuelta a la agenda.
     */
    expect(CONSULTA).not.toContain('router.push(volverA)}')
  })

  it('conserva el destino lógico para quien llega por enlace directo', () => {
    // Quitar el respaldo dejaría a quien abre la consulta desde WhatsApp o
    // desde una notificación sin ningún sitio a dónde ir.
    expect(CONSULTA).toMatch(/volverA\s*=\s*esNotaHospital/)
  })
})

describe('la agenda recuerda el encuadre al volver', () => {
  it('el día que estás viendo no se reinicia a hoy', () => {
    expect(CITAS).toContain("useEstadoRecordado('nx.agenda.dia'")
    // Sobre el código, no sobre la prosa: el comentario que explica el arreglo
    // cita el `useState` viejo, y buscarlo a secas se cazaría a sí mismo.
    expect(CITAS).not.toMatch(/const \[selectedDate, setSelectedDate\] = useState\(/)
  })

  it('el filtro de estado tampoco', () => {
    expect(CITAS).toContain("useEstadoRecordado<AppointmentStatus | 'todas' | 'por-cobrar'>('nx.agenda.filtro'")
  })

  it('el calendario recuerda su día y su vista', () => {
    expect(CALENDARIO).toContain("useEstadoRecordado('nx.calendario.dia'")
    expect(CALENDARIO).toContain("useEstadoRecordado<View>('nx.calendario.vista'")
  })

  it('NADA de lo recordado es PHI', () => {
    /**
     * Un día y un filtro son preferencias de encuadre. El texto del buscador es
     * el nombre de un paciente, y ninguna clave `nx.agenda.*` está en
     * `PREFIJOS_PHI`, así que no se purgaría al cerrar sesión: quedaría en el
     * disco de un dispositivo compartido.
     *
     * Si algún día se quiere recordar, primero se declara el prefijo.
     */
    const recordados = [...CITAS.matchAll(/useEstadoRecordado[^(]*\('([^']+)'/g)].map(m => m[1])
    expect(recordados.sort()).toEqual(['nx.agenda.dia', 'nx.agenda.filtro'])
    expect(CITAS).not.toContain("useEstadoRecordado('nx.agenda.busqueda'")
  })
})

describe('el estado recordado se comporta con un almacenamiento hostil', () => {
  /**
   * Se prueba la función PURA del hook, no una copia de su lógica escrita aquí:
   * una prueba que reimplementa lo que dice comprobar no comprueba nada.
   */
  it('sin nada guardado, el valor inicial', () => {
    expect(leerRecordado(null, '2026-08-09')).toBe('2026-08-09')
  })

  it('con un valor guardado, ése', () => {
    expect(leerRecordado('"2026-08-13"', '2026-08-09')).toBe('2026-08-13')
    expect(leerRecordado('"por-cobrar"', 'todas')).toBe('por-cobrar')
  })

  it('un valor corrupto no rompe la pantalla', () => {
    expect(leerRecordado('{no es json', '2026-08-09')).toBe('2026-08-09')
  })

  it('un valor de OTRO TIPO se ignora', () => {
    /**
     * Guardado por una versión anterior con otra forma. Sin esta comprobación,
     * un número donde ahora hay una cadena entraría al estado y la pantalla
     * reventaría al llamar a `.slice()` sobre él.
     */
    expect(leerRecordado('42', '2026-08-09')).toBe('2026-08-09')
    expect(leerRecordado('null', 'todas')).toBe('todas')
    expect(leerRecordado('{"a":1}', 'todas')).toBe('todas')
  })
})

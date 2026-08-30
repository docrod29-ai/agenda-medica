/**
 * GOLDEN — el estado de una cita llega por un canal que no es el ojo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * En la rejilla del calendario el estado de una cita vivía en tres sitios y
 * ninguno servía a todo el mundo:
 *
 *   · `title=` — sólo aparece al posar el ratón. En una tableta no existe.
 *   · `opacity` — 1 confirmada, 0,85 pendiente, 0,45 cancelada.
 *   · `text-decoration: line-through` — sólo la cancelada.
 *
 * Los tres son canales visuales o de puntero. El nombre accesible decía
 * literalmente «Cita de Nadia Ferreiro Ocampo a las 13:00» de una cita
 * CANCELADA, sin una palabra que lo dijera. Y la vista de MES no pintaba el
 * estado por ningún canal: cancelada y confirmada, idénticas.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Sonda de Playwright sobre el calendario del arnés, leyendo `aria-label`,
 * `title`, `opacity` y `text-decoration` de cada bloque. Los `aria-label` de las
 * cinco citas del día eran indistinguibles entre sí salvo por el nombre y la
 * hora.
 *
 * De paso corrigió un error MÍO: la siembra escribía `estado: 'programada'`,
 * que no es miembro de `AppointmentStatus`. El producto la pintaba por el
 * `else` («el resto → sólido»), es decir, como CONFIRMADA — y eso me hizo creer
 * un rato que confirmada y pendiente se veían igual. No: era el arnés
 * inventando un estado. Misma familia que el `urgencia` por `urgente` de la
 * unidad 16.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * `etiqueta:` se escribió como «quién y a qué hora», que es lo que se necesita
 * para IDENTIFICAR la cita. El estado se consideró decoración del bloque. Pero
 * el estado es justo lo que el médico va a buscar en la rejilla: quién no ha
 * confirmado todavía.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Ningún estado de cita puede comunicarse SÓLO por opacidad, color o tachado.
 * Va en el nombre accesible. Es §19 y §22 de este encargo, y la regla 4 de
 * `clinical-safety` dicha en lenguaje de interfaz.
 *
 * Y un estado que el catálogo no conozca **se dice crudo**, no se calla: la
 * regla 5 de `clinical-safety` — que falte un término significa que ese caso no
 * se vigila, no que se dé por bueno.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Devolviendo `etiquetaDeCita` a `Cita de ${nombre} a las ${hora}` falla el
 * primer caso; quitando el `?? a.estado` falla el del estado desconocido;
 * quitando la clase de una de las tres vistas falla el caso de las tres vistas.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No prueba que un lector de pantalla real lo pronuncie: comprueba el árbol
 *   accesible, no el audio. Ningún lector real se ha usado en este carril.
 * · No juzga si «Pendiente confirmar» es el término que el médico espera oír.
 * · No cubre el resto de la aplicación: sólo las tres vistas del calendario.
 *   Que aquí esté bien no dice nada de `/citas` ni del portal del paciente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { APPOINTMENT_STATUS_CONFIG, type AppointmentStatus } from '@/types'
import { etiquetaDeCita } from '@/lib/agenda/etiqueta-de-cita'

const FUENTE = 'src/app/(dashboard)/calendario/page.tsx'
const src = readFileSync(FUENTE, 'utf8')
/** Sin comentarios: un comentario que cite el defecto satisfaría `toContain`. */
const cuerpo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('el estado de la cita no vive sólo en el pixel', () => {
  /**
   * SE LLAMA A LA FUNCIÓN, no se lee su fuente.
   *
   * La primera versión de este caso comprobaba que `etiquetaDeCita` MENCIONARA
   * el catálogo. Probado al revés —quitándole el estado a la cadena devuelta—
   * seguía en verde: mencionar no es devolver. Una prueba que no puede fallar
   * no es una prueba (`testing-gates.md`), y por eso la función se sacó a
   * `@/lib/agenda/etiqueta-de-cita`, donde se la puede llamar.
   */
  it('el nombre accesible de un bloque incluye el estado', () => {
    const dicha = etiquetaDeCita({
      pacienteNombre: 'Nadia Ferreiro Ocampo',
      fechaHora: '2026-08-30 13:00',
      estado: 'cancelada',
    })
    expect(dicha).toContain('Nadia Ferreiro Ocampo')
    expect(dicha).toContain('13:00')
    expect(dicha).toContain('Cancelada')
  })

  it('dos citas que sólo difieren en el estado NO suenan igual', () => {
    const base = { pacienteNombre: 'Rosalía Mendieta Cuevas', fechaHora: '2026-08-30 09:00' }
    const confirmada = etiquetaDeCita({ ...base, estado: 'confirmada' })
    const pendiente = etiquetaDeCita({ ...base, estado: 'pendiente-confirmar' })
    expect(confirmada).not.toBe(pendiente)
  })

  it('las TRES vistas usan esa etiqueta, no una propia', () => {
    // Semana, día y mes. Si una se queda fuera, el estado desaparece en ella.
    const usos = [...cuerpo.matchAll(/etiqueta: etiquetaDeCita\(a\)/g)]
    expect(usos.length, 'semana + día + mes').toBe(3)
    // Y ninguna vista reconstruye la etiqueta a mano.
    expect(cuerpo).not.toMatch(/etiqueta: `Cita de \$\{a\.pacienteNombre\}`/)
  })

  it('un estado que el catálogo no conoce se dice, no se calla', () => {
    const dicha = etiquetaDeCita({
      pacienteNombre: 'Tadeo Iparraguirre Nolasco',
      fechaHora: '2026-08-30 12:00',
      // El `programada` que la siembra inventaba: no es miembro del tipo.
      estado: 'programada' as never,
    })
    expect(dicha).toContain('programada')
  })

  it('todo estado del tipo tiene etiqueta en el catálogo', () => {
    // Si el catálogo pierde una, `etiquetaDeCita` cae al slug crudo — correcto,
    // pero feo; que se entere aquí y no el médico.
    const estados: AppointmentStatus[] = [
      'solicitada', 'pendiente-datos', 'pendiente-confirmar', 'confirmada',
      'recordatorio-enviado', 'en-sala', 'en-consulta', 'atendida', 'finalizada',
      'cancelada', 'reagendada', 'no-asistio', 'pendiente-pago', 'pagada',
    ]
    for (const e of estados) {
      expect(APPOINTMENT_STATUS_CONFIG[e]?.label, e).toBeTruthy()
    }
  })

  it('la vista de mes también pinta el estado, no sólo semana y día', () => {
    const mes = src.slice(src.indexOf('function MonthView'))
    expect(mes).toContain('estiloEstadoCita(a.estado)')
    expect(mes).toContain('est.tachado')
  })

  /**
   * EL «HOY» DE LA SIEMBRA ES EL DEL CONSULTORIO.
   *
   * La siembra usaba `new Date().getDate()`, la fecha LOCAL DEL PROCESO. Aquí el
   * proceso corre en UTC y el consultorio está en UTC-6: entre las 18:00 y la
   * medianoche de México el contenedor ya está en el día siguiente, así que las
   * citas «de hoy» se sembraban en MAÑANA. La agenda del día salía vacía y el
   * marcador de «hoy» señalaba una columna sin nada — y nada de eso era un
   * defecto del producto.
   *
   * Es el mismo error que `lib/timezone.ts` impide dentro del producto,
   * cometido en la herramienta que lo audita. Probado al revés devolviendo
   * `getFullYear/getMonth/getDate`: cae.
   */
  it('la siembra fecha en la zona del consultorio, no en la del proceso', () => {
    const semilla = readFileSync('scripts/design/sembrar-emulador.mjs', 'utf8')
    const codigo = semilla.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(codigo).toContain("timeZone: TZ_CONSULTORIO")
    // Y ya no deriva el día del reloj local del proceso.
    expect(codigo).not.toMatch(/hoy\.getFullYear\(\)/)
    expect(codigo).not.toMatch(/d\.setDate\(d\.getDate\(\)/)
  })

  it('la siembra del arnés no inventa estados fuera del tipo', () => {
    // El defecto que me hizo perder el rastro. Que no vuelva.
    const semilla = readFileSync('scripts/design/sembrar-emulador.mjs', 'utf8')
    const bloque = semilla.slice(semilla.indexOf('const CITAS = ['), semilla.indexOf(']\n', semilla.indexOf('const CITAS = [')))
    const usados = [...bloque.matchAll(/estado:\s*'([^']+)'/g)].map(m => m[1])
    expect(usados.length).toBeGreaterThan(0)
    const desconocidos = usados.filter(e => !(e in APPOINTMENT_STATUS_CONFIG))
    expect(desconocidos, `estados fuera de AppointmentStatus: ${desconocidos.join(', ')}`).toEqual([])
  })
})

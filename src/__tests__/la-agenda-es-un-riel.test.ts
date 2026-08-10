/**
 * AGENDA-IDENTITY-001 — la agenda es un RIEL, no una tabla con botones.
 *
 * QUÉ FALLABA: /citas era la pantalla más genérica del producto y la peor
 * puntuada (5.4–5.5/10 por dos corridas ciegas entre sí; generic-AI 3.5–6):
 * hasta 4 CTA de 4 colores por fila (teal Cobrar / azul Consulta / verde
 * Recordar / morado Unirse) + 3 iconos, filtros por triplicado (12 chips),
 * la píldora «Ana» —el propio médico— en cada fila de un consultorio de una
 * sola médica, avatar-círculo genérico, fecha en formato US, y a 390 px los
 * botones se PINTABAN ENCIMA del nombre partido palabra por palabra (P0).
 *
 * CÓMO SE DESCUBRIÓ: capturas reales del arnés (agenda--390.png,
 * citas--mobile.png) — TRES corridas independientes vieron lo mismo. El
 * 10-ago el dueño lo elevó a P0 de identidad de producto (directiva
 * NEXUSMED_ORIGINAL_PRODUCT_IDENTITY).
 *
 * CAUSA RAÍZ: la fila conservaba su estructura de escritorio a todo ancho y
 * cada acción era un botón visible con su propio color — no había noción de
 * «siguiente acción» ni gramática móvil propia.
 *
 * LA REGLA QUE LO HACE SEGURO (Visual DNA R1/R2/R3): la agenda se organiza
 * sobre un riel temporal con el momento actual visible; cada entrada muestra
 * UNA acción primaria derivada del estado y el resto vive en su menú; el
 * estado se dice con tipografía; la identidad del paciente es tipográfica.
 * NINGUNA función se pierde: cobro, consulta, WhatsApp, recordatorio,
 * teleconsulta, cortesía, estados y eliminar siguen, en el menú.
 *
 * PROBADO AL REVÉS contra e797b49e (la versión anterior de la página): los
 * casos 1, 2, 3, 5, 6 y 7 FALLAN con aquel código.
 *
 * QUÉ NO CUBRE: cómo se VE — esto lee fuente, no píxeles. La evidencia
 * visual son las capturas del arnés y su revisión independiente (V10 §33:
 * nunca aprobar una pantalla sólo leyendo JSX/CSS). Tampoco cubre que la
 * acción primaria elegida sea la clínicamente correcta en cada estado — eso
 * lo cubren los casos de `accionPrimaria` aquí abajo, sólo para los estados
 * que existen hoy.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pagina = readFileSync(join(process.cwd(), 'src/app/(dashboard)/citas/page.tsx'), 'utf8')
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('AGENDA-IDENTITY-001 — el riel del día', () => {
  it('1 · el muro de botones de colores murió: sin literales teal/verde/morado por fila', () => {
    expect(pagina).not.toContain('rgba(20,184,166')   // Cobrar teal
    expect(pagina).not.toContain('rgba(37,211,102')   // Recordar verde
    expect(pagina).not.toContain('rgba(167,139,250')  // Unirse morado
  })

  it('2 · una sola acción primaria por entrada, derivada del estado', () => {
    expect(pagina).toContain('function accionPrimaria(')
    // El único botón primario del cuerpo de la página es el de la entrada:
    // «Nueva cita» usa <Button> del sistema, no la clase suelta.
    const primarios = pagina.split('btn-primary').length - 1
    expect(primarios, 'más de un botón primario por entrada rompe R2').toBeLessThanOrEqual(1)
  })

  it('3 · sin avatar-círculo: la identidad del paciente es tipográfica (R3)', () => {
    // Se vigila el patrón del AVATAR (la inicial del PACIENTE en un círculo),
    // no cualquier charAt: la mayúscula inicial de la fecha es legítima.
    expect(pagina).not.toContain('pacienteNombre.charAt(0)')
    expect(pagina).toContain('riel-nombre')
  })

  it('4 · el riel existe y tiene marcador de AHORA', () => {
    expect(pagina).toContain('riel-entrada')
    expect(pagina).toContain('riel-ahora')
    expect(pagina).toContain('data-momento')
    expect(css).toContain('.riel::before')       // la línea continua del día
    expect(css).toContain('.riel-ahora-linea')   // la línea del momento actual
  })

  it('5 · filtros en UN renglón: segmentos + selector con nombre, sin sopa de chips', () => {
    expect(pagina).toContain('riel-filtros')
    expect(pagina).toMatch(/aria-label="Filtrar por estado/)
    // La sopa de chips pintaba cada estado como botón con teal-glow.
    expect(pagina).not.toContain('teal-glow')
  })

  it('6 · fechas SIEMPRE es-MX: sin eco ISO y sin input nativo visible (formato US)', () => {
    expect(pagina).not.toMatch(/>\{selectedDate\}</)
    expect(pagina).toContain("'de' MMMM 'de' yyyy")
    expect(pagina).toContain('riel-fecha-input')  // el input vive oculto
    expect(pagina).toContain('Elegir una fecha en el calendario')
  })

  it('7 · el estado se dice con tipografía (nx-estado), no con píldora', () => {
    expect(pagina).not.toContain('<StatusBadge')
    expect(pagina).toContain('nx-estado')
    expect(css).toContain('.nx-estado::before')
  })

  it('8 · el médico sólo aparece cuando hay MÁS de un médico', () => {
    expect(pagina).toContain('multiMedico &&')
  })

  it('9 · el marcador de AHORA nace tras montar (sin mismatch de hidratación)', () => {
    expect(pagina).toContain('useState<string | null>(null)')
    expect(pagina).toContain('ahoraMinutosDelDia')
  })

  it('10 · ninguna función se perdió: todo vive en el menú de la entrada', () => {
    for (const fn of [
      'Registrar cobro', 'Abrir consulta', 'Unirse a videollamada',
      'WhatsApp: confirmar cita', 'WhatsApp: recordatorio', 'Quitar cortesía',
      'Editar cita', 'Cambiar estado', 'Eliminar cita',
    ]) expect(pagina, `función perdida en el rediseño: ${fn}`).toContain(fn)
  })

  it('11 · la gramática móvil existe: riel apilado bajo 640px, no escritorio encogido', () => {
    const movil = css.slice(css.indexOf('EL RIEL DEL DÍA'))
    expect(movil).toContain('@media (max-width: 640px)')
    expect(movil).toContain('--riel-tiempo-m')
    expect(movil).toMatch(/grid-template-areas:\s*\n?\s*'tiempo nodo cuerpo'\s*\n?\s*'\.\s+\.\s+accion'/)
  })
})

describe('accionPrimaria — la siguiente acción segura por estado', () => {
  // Se importa la función real (está exportada para esto).
  it('atendida sin cobro → Cobrar; cobrada → nada; en sala → Iniciar consulta; pendiente → Confirmar', async () => {
    const { accionPrimaria } = await import('../app/(dashboard)/citas/page')
    const base = { pacienteId: 'p1', pacienteTelefono: '55', tipo: 'consulta', cobroId: undefined, cobroExento: undefined }
    const casos: Array<[Record<string, unknown>, string | null]> = [
      [{ ...base, estado: 'atendida' }, 'cobrar'],
      [{ ...base, estado: 'finalizada', cobroId: 'c1' }, null],
      [{ ...base, estado: 'en-sala' }, 'consulta'],
      [{ ...base, estado: 'en-consulta' }, 'consulta'],
      [{ ...base, estado: 'pendiente-confirmar' }, 'confirmar'],
      [{ ...base, estado: 'confirmada' }, 'consulta'],        // hoy → iniciar
      [{ ...base, estado: 'cancelada' }, null],
      [{ ...base, estado: 'no-asistio' }, null],
      [{ ...base, estado: 'confirmada', tipo: 'teleconsulta' }, 'unirse'],
    ]
    for (const [appt, esperado] of casos) {
      const a = accionPrimaria(appt as never, true)
      expect(a?.tipo ?? null, `estado ${appt.estado} (${appt.tipo})`).toBe(esperado)
    }
    // Viendo OTRO día: la confirmada ofrece recordar, no iniciar.
    const manana = accionPrimaria({ ...base, estado: 'confirmada' } as never, false)
    expect(manana?.tipo).toBe('recordar')
  })
})

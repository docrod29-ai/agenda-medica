/**
 * GOLDEN — «¿quién entró al expediente de este paciente?»
 *
 * Es LA pregunta de la trazabilidad: la que hace un auditor, y la que puede
 * hacer el propio paciente al ejercer sus derechos ARCO. Y la pantalla de
 * cumplimiento **no podía contestarla**: enseñaba los últimos 200 asientos de
 * toda la clínica, revueltos, sin ningún filtro, y con el paciente reducido a
 * ocho caracteres de su id.
 *
 * ── EL ERROR QUE HABRÍA SIDO FÁCIL COMETER ───────────────────────────────────
 *
 * Filtrar esos 200 en el navegador es peor que no filtrar: contestaría «no hay
 * accesos» cuando en realidad los hay, sólo que más viejos que la ventana. Un
 * fallo que se lee como una respuesta tranquilizadora es el peor de todos —es el
 * mismo patrón que este repositorio lleva reparando toda la semana—.
 *
 * Por eso el filtro por paciente PREGUNTA AL SERVIDOR, y la cabecera dice cuál
 * de las dos cosas se está viendo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const s = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'cumplimiento', 'page.tsx'), 'utf8')

describe('el filtro por paciente va al SERVIDOR', () => {
  it('consulta por patientId, no recorta los 200 ya traídos', () => {
    expect(s).toContain("where('patientId', '==', pacienteFiltro)")
    expect(s).toContain('fbLimit(500)')
  })

  it('vuelve a preguntar al cambiar de paciente', () => {
    expect(s).toContain('}, [clinicId, pacienteFiltro])')
  })

  it('la consulta por paciente NO lleva orderBy', () => {
    /**
     * Igualdad + orderBy exigiría un índice compuesto, y desplegar índices es
     * una operación aparte que puede borrar los que no estén declarados. Sin
     * `orderBy` basta el índice automático; el orden se hace en memoria.
     */
    const i = s.indexOf("where('patientId'")
    const linea = s.slice(s.lastIndexOf('\n', i), s.indexOf('\n', i))
    expect(linea).not.toContain('orderBy')
    expect(s).toContain("filas.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))")
  })
})

describe('la pantalla DICE qué conjunto está mirando', () => {
  it('distingue «todos los del paciente» de «últimos 200 de la clínica»', () => {
    // Un filtro que parece completo y sólo mira una ventana contesta «no hay
    // accesos» cuando los hay.
    expect(s).toContain('TODOS los asientos de ')
    expect(s).toContain('últimos 200 de toda la clínica')
  })

  it('el vacío del paciente no afirma que nadie entró, sin más', () => {
    expect(s).toContain('Sin asientos para este paciente')
    expect(s).toContain('los asientos son anteriores a que existiera la bitácora')
  })

  it('y avisa cuando además se filtró por tipo', () => {
    expect(s).toContain("eventoFiltro && ' · filtrado por tipo'")
  })
})

describe('se lee como español, no como base de datos', () => {
  it('el paciente sale por su NOMBRE cuando se puede', () => {
    // Ocho caracteres de un id no le dicen nada a quien revisa quién tocó a quién.
    expect(s).toContain('nombrePaciente(e.patientId) || `paciente ${e.patientId.slice(0, 8)}`')
  })

  it('el selector de tipos usa las etiquetas y sólo los tipos presentes', () => {
    expect(s).toContain('{etiquetaEvento(t)}')
    expect(s).toContain('const tiposPresentes = [...new Set(entries.map(e => e.evento))].sort()')
  })

  it('los dos selectores son accesibles', () => {
    expect(s).toContain('aria-label="Filtrar por paciente"')
    expect(s).toContain('aria-label="Filtrar por tipo de evento"')
  })
})

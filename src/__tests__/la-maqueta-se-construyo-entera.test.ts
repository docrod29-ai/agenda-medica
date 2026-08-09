/**
 * LA MAQUETA SE CONSTRUYÓ ENTERA — REG-236.
 *
 * ── LO QUE PASÓ ─────────────────────────────────────────────────────────────
 *
 * Se le enseñó al médico una maqueta de la pantalla de consulta con dos mitades:
 *
 *   · Arriba: los diez botones de tipo de nota reducidos a **una línea**.
 *   · Abajo: un **botón grande y centrado** para grabar, y una frase. Nada más.
 *
 * La de arriba se construyó y se desplegó. **La de abajo se quedó en dibujo** —
 * y lo notó él, mirando su iPhone: «¿y por qué no se ve así? no has desplegado».
 *
 * Enseñar un diseño y entregar la mitad es peor que no enseñarlo: el médico se
 * queda esperando algo que nunca sale, y se entera solo.
 *
 * ── LO QUE HABÍA ANTES DE PODER HABLAR ──────────────────────────────────────
 *
 * Seis cosas, contadas sobre su captura: el rótulo de modo, «Manos libres», el
 * micrófono, un título, una descripción y un «Procesar con IA» apagado. **Tres
 * de ellas decían lo mismo** —que graba a los dos y separa las voces— con
 * distintas palabras.
 *
 * ── LO QUE NO SE HACE, Y ES LO IMPORTANTE ───────────────────────────────────
 *
 * **No se borra nada.** La fila entera vuelve en cuanto hay algo grabado, que es
 * cuando pausar, cancelar y procesar significan algo. Lo que cambia no es qué
 * existe: es **cuándo aparece**.
 *
 * Esconder controles de verdad sería el error opuesto y también le costaría caro
 * — ya pasó al diseñar `QueNotaEs`, donde la primera idea fue esconder ocho de
 * los diez tipos de nota y él contestó que usa los diez.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { POR_QUE_UN_SOLO_BOTON, POR_QUE_96_PX } from '@/components/EmpezarAGrabar'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const comp = leer('src', 'components', 'EmpezarAGrabar.tsx')
const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

describe('el botón de la maqueta existe', () => {
  it('el componente está escrito', () => {
    expect(comp).toContain('export function EmpezarAGrabar')
  })

  it('mide 96 px, y se dice por qué', () => {
    expect(comp).toMatch(/width: 96, height: 96/)
    expect(POR_QUE_96_PX).toMatch(/sin mirar/)
  })

  it('usa el azul SÓLIDO, que es el que pasa contraste con blanco', () => {
    expect(comp).toMatch(/background: 'var\(--nexus-solido\)', color: '#fff'/)
  })

  it('y --r-pill, no un valor nuevo en la escala', () => {
    expect(comp).toMatch(/borderRadius: 'var\(--r-pill\)'/)
  })

  it('tiene nombre accesible que explica qué hace', () => {
    expect(comp).toMatch(/aria-label="Grabar la consulta: capta al médico y al paciente/)
  })

  it('dice UNA línea, no tres', () => {
    // El rótulo de modo, el título y la descripción decían lo mismo.
    expect(comp).toContain('Capta a los dos y separa las voces')
    expect(POR_QUE_UN_SOLO_BOTON).toMatch(/tres decían lo mismo/)
  })
})

describe('está montado, y sólo al principio', () => {
  it('la consulta lo importa y lo usa', () => {
    expect(page).toContain("import { EmpezarAGrabar } from '@/components/EmpezarAGrabar'")
    expect(page).toContain('<EmpezarAGrabar')
  })

  it('«al principio» se define mirando el grabador Y la transcripción', () => {
    /**
     * Si el médico vuelve a una consulta con algo ya dictado, tiene que ver los
     * controles aunque el grabador esté parado.
     */
    expect(page).toMatch(/const esElPrincipio = audio\.estado === 'inactivo'/)
    expect(page).toMatch(/&& !voz\.transcripcion\.trim\(\)/)
  })

  it('el rótulo de modo duplicado YA NO ESTÁ', () => {
    expect(page).not.toContain('Modo: <b style={{ color: \'var(--text2)\' }}>Conversación completa</b>')
  })
})

describe('no se borra nada: la fila vuelve', () => {
  it('los controles se ocultan SÓLO al principio', () => {
    /**
     * `!esElPrincipio && (…)`. En cuanto hay algo grabado vuelve la fila entera
     * —pausar, cancelar, el tiempo, procesar—, que es cuando significan algo.
     */
    expect(page).toMatch(/!esElPrincipio && \(/)
  })

  it('«Procesar con IA» sigue existiendo para cuando hay algo que procesar', () => {
    expect(page).toContain('Procesar con IA')
  })

  it('«Manos libres» sigue existiendo', () => {
    expect(page).toContain('Manos libres')
  })

  it('y queda escrito que esconder de verdad sería el error opuesto', () => {
    /**
     * Ya pasó al diseñar `QueNotaEs`: la primera idea fue esconder ocho de los
     * diez tipos de nota, y él contestó que usa los diez. La lección está
     * escrita ahí y no se repite aquí — se comprueba que siga escrita.
     */
    const q = leer('src', 'components', 'QueNotaEs.tsx')
    expect(q).toMatch(/usa los diez/)
  })
})

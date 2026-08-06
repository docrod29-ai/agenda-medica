/**
 * CON UN PACIENTE ENFRENTE SÓLO SE INTERRUMPE POR LO QUE IMPIDE ATENDERLO.
 *
 * El 5-ago-2026 el Dr. mandó la captura de una consulta real: debajo de su nota,
 * en rojo y a lo ancho, «5 trabajo(s) automático(s) dejaron de correr». Era el
 * octavo bloque de aviso de esa pantalla, y ninguno de esos trabajos se arregla
 * desde la consulta ni afecta al paciente que tenía delante.
 *
 * La franja YA había aprendido esta lección el 4-ago con los timeouts. Volvió a
 * fallar porque el filtro se escribió sobre la URGENCIA — y un trabajo muerto es
 * urgente. Por eso estas pruebas van sobre la pregunta correcta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  hayPacienteEnfrente,
  visiblesEn,
  PANTALLAS_CON_PACIENTE,
} from '@/lib/ops/interrumpe-la-consulta'

const cronMudo = {
  titulo: '5 trabajo(s) automático(s) dejaron de correr',
  queHacer: 'reminders: No hay ni un latido…',
  urgente: true,
  interrumpeConsulta: false,
}
const iaCaida = {
  titulo: 'La llave de IA fue rechazada',
  queHacer: 'Renueva la llave en el tablero',
  urgente: true,
  interrumpeConsulta: true,
}

describe('dónde hay un paciente esperando', () => {
  it('la consulta lo tiene', () => {
    expect(hayPacienteEnfrente('/consulta/abc123')).toBe(true)
  })
  it('el expediente lo tiene', () => {
    expect(hayPacienteEnfrente('/expediente/abc123')).toBe(true)
  })
  it('la UCI lo tiene', () => {
    expect(hayPacienteEnfrente('/uci')).toBe(true)
  })
  it('hospitalización lo tiene', () => {
    expect(hayPacienteEnfrente('/hospitalizacion/xyz')).toBe(true)
  })
  it('la agenda NO — ahí sí puede enterarse de todo', () => {
    expect(hayPacienteEnfrente('/agenda')).toBe(false)
  })
  it('finanzas NO', () => {
    expect(hayPacienteEnfrente('/finanzas')).toBe(false)
  })
  it('una ruta que sólo EMPIEZA parecido no cuenta', () => {
    // `/consultas-guardadas` no es una consulta en curso.
    expect(hayPacienteEnfrente('/consultas-guardadas')).toBe(false)
  })
  it('sin ruta no se asume paciente', () => {
    expect(hayPacienteEnfrente(null)).toBe(false)
    expect(hayPacienteEnfrente(undefined)).toBe(false)
  })
  it('están las cuatro pantallas donde se atiende', () => {
    expect(PANTALLAS_CON_PACIENTE).toHaveLength(4)
  })
})

describe('el caso exacto de su captura', () => {
  it('el cron mudo NO sale en la consulta', () => {
    expect(visiblesEn([cronMudo], '/consulta/abc123')).toHaveLength(0)
  })
  it('pero SÍ sale en la agenda, donde puede hacer algo', () => {
    expect(visiblesEn([cronMudo], '/agenda')).toHaveLength(1)
  })
  it('la IA caída SÍ corta la consulta: es lo que le va a fallar al procesar', () => {
    expect(visiblesEn([iaCaida], '/consulta/abc123')).toHaveLength(1)
  })
  it('mezclados, en consulta sólo pasa el que impide atender', () => {
    const v = visiblesEn([cronMudo, iaCaida], '/consulta/abc123')
    expect(v).toHaveLength(1)
    expect(v[0].titulo).toBe(iaCaida.titulo)
  })
  it('fuera de consulta pasan los dos', () => {
    expect(visiblesEn([cronMudo, iaCaida], '/agenda')).toHaveLength(2)
  })
})

describe('el silencio es el valor seguro', () => {
  it('un incidente que no declara nada se calla en consulta', () => {
    // Un aviso de más con alguien delante cuesta la atención del médico; el
    // mismo aviso cinco minutos después, en la agenda, no cuesta nada.
    const sinDeclarar = { titulo: 'algo', queHacer: 'algo', urgente: true }
    expect(visiblesEn([sinDeclarar], '/consulta/abc')).toHaveLength(0)
  })
  it('y aun así aparece fuera de la consulta', () => {
    const sinDeclarar = { titulo: 'algo', queHacer: 'algo', urgente: true }
    expect(visiblesEn([sinDeclarar], '/agenda')).toHaveLength(1)
  })
  it('no se pierde nada: sin incidentes, nada que pintar', () => {
    expect(visiblesEn([], '/agenda')).toHaveLength(0)
  })
})

describe('está conectado de verdad, no sólo escrito', () => {
  const comp = readFileSync(
    join(process.cwd(), 'src', 'components', 'AvisoIncidenteIA.tsx'), 'utf8',
  )
  const ruta = readFileSync(
    join(process.cwd(), 'src', 'app', 'api', 'superadmin', 'incidentes', 'route.ts'), 'utf8',
  )

  it('el componente filtra por la ruta en la que está', () => {
    expect(comp).toContain('visiblesEn(todos, ruta)')
    expect(comp).toContain('usePathname()')
  })
  it('el cron mudo se marca como que NO interrumpe', () => {
    expect(ruta).toContain('interrumpeConsulta: false')
  })
  it('el fallo de IA vigente se marca como que SÍ', () => {
    expect(ruta).toContain('interrumpeConsulta: true')
  })
})

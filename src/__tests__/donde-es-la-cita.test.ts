/**
 * GOLDEN — a la videoconsulta se le mandaba la dirección del consultorio.
 *
 * La confirmación y los dos recordatorios se escribieron cuando todas las citas
 * eran presenciales y nunca miraron el tipo. A un paciente de TELECONSULTA le
 * llegaba «📍 Consultorio, Av. …» y «Te esperamos / Favor de acudir
 * puntualmente», sin el enlace de la sala por ningún lado: en el mejor caso
 * llama para preguntar, en el peor conduce hasta allá.
 */
import { describe, it, expect } from 'vitest'
import { dondeEsLaCita, SIN_ENLACE } from '@/lib/telesalud/donde-es'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'https://agenda-medica-one.vercel.app'
const PRESENCIAL = { tipo: 'seguimiento', direccion: 'Av. Universidad 100', googleMapsUrl: 'https://maps.example/x' }
const VIDEO = { tipo: 'teleconsulta', citaId: 'cita-1', clinicId: 'clin-1', direccion: 'Av. Universidad 100', baseUrl: BASE }

describe('dondeEsLaCita', () => {
  it('una cita presencial sigue llevando dirección y mapa', () => {
    const l = dondeEsLaCita(PRESENCIAL)
    expect(l.esVideo).toBe(false)
    expect(l.lineas.join('\n')).toContain('Av. Universidad 100')
    expect(l.lineas.join('\n')).toContain('maps.example')
    expect(l.cierre).toBe('Te esperamos.')
  })

  it('una teleconsulta lleva el ENLACE y NO la dirección', () => {
    // Mandar las dos cosas deja que el paciente elija mal, y el que se equivoca
    // pierde la consulta.
    const l = dondeEsLaCita(VIDEO)
    expect(l.esVideo).toBe(true)
    const texto = l.lineas.join('\n')
    expect(texto).toContain(`${BASE}/teleconsulta/cita-1?c=clin-1`)
    expect(texto).not.toContain('Av. Universidad')
    expect(texto).toMatch(/videoconsulta/i)
  })

  it('el cierre no le dice «te esperamos» a quien no tiene que venir', () => {
    expect(dondeEsLaCita(VIDEO).cierre).not.toMatch(/esperamos/i)
  })

  it('el enlace del paciente NO lleva `dr=1`', () => {
    expect(dondeEsLaCita(VIDEO).lineas.join('\n')).not.toContain('dr=1')
  })

  it('sin URL base se DICE que es videoconsulta, no se calla', () => {
    // Un mensaje que no menciona el video es el que hace que el paciente se
    // presente en el consultorio.
    const l = dondeEsLaCita({ ...VIDEO, baseUrl: '' })
    expect(l.esVideo).toBe(true)
    expect(l.lineas.join('\n')).toContain(SIN_ENLACE)
    expect(l.lineas.join('\n')).not.toContain('Av. Universidad')
  })

  it('sin dirección capturada no se inventa una línea vacía', () => {
    expect(dondeEsLaCita({ tipo: 'primera-vez' }).lineas).toEqual([])
  })
})

/**
 * Y que llegue al BOT, que es el tercer sitio donde se agenda — y el único que
 * confirma la cita en el momento, sin que nadie del consultorio lo lea antes.
 */
describe('el bot de WhatsApp usa el mismo criterio', () => {
  const bot = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts'), 'utf8')

  it('ofrece teleconsulta en su menú (por eso hay que cubrirlo)', () => {
    expect(bot).toContain("key: 'teleconsulta'")
  })

  it('el resumen previo NO manda la dirección a una videoconsulta', () => {
    expect(bot).toContain("datos.tipo === 'teleconsulta'")
    expect(bot).toContain('no necesita acudir al consultorio')
  })

  it('los dos mensajes de cita agendada pasan por el módulo', () => {
    // Uno es el alta normal y otro el de lista de espera: los dos confirman.
    expect(bot.match(/dondeEsLaCita\(/g) ?? []).toHaveLength(2)
  })

  it('el enlace se arma con el id REAL de la cita, no con uno inventado', () => {
    expect(bot).toContain('citaId: nuevoFolio')
    expect(bot).toContain('citaIdListaEspera = refLE.id')
  })
})

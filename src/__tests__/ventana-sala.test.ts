/**
 * GOLDEN — el paciente no tenía por dónde entrar a su videoconsulta.
 *
 * La teleconsulta se agenda, se cobra y el consultorio tiene su botón «Unirse».
 * En el portal del paciente, `teleconsulta` era sólo una etiqueta en el mapa de
 * tipos de cita, y ni la confirmación ni los recordatorios llevan el enlace de
 * la sala: se podía vender, agendar y cobrar una videoconsulta a la que el
 * paciente no puede llegar.
 *
 * La ventana no se inventa aquí: son los mismos 30 min / 2 h que el servidor ya
 * aplica al crear la sala en Daily (`nbf` / `exp`). Un botón que abre una sala
 * caducada es peor que no tener botón — el paciente cree que el problema es suyo.
 */
import { describe, it, expect } from 'vitest'
import {
  ventanaDeSala, enlaceSalaPaciente, MINUTOS_ANTES, HORAS_DESPUES,
} from '@/lib/telesalud/ventana-sala'
import { instanteMX } from '@/lib/timezone'

const TZ = 'America/Mexico_City'
const CITA = '2026-08-10 10:00'
const inicio = instanteMX('2026-08-10', '10:00', TZ).getTime()
const MIN = 60_000

describe('ventanaDeSala', () => {
  it('a la hora de la cita, abierta', () => {
    expect(ventanaDeSala(CITA, inicio, TZ)).toEqual({ estado: 'abierta', mensaje: '' })
  })

  it('abre exactamente 30 minutos antes', () => {
    expect(ventanaDeSala(CITA, inicio - MINUTOS_ANTES * MIN, TZ).estado).toBe('abierta')
    expect(ventanaDeSala(CITA, inicio - (MINUTOS_ANTES + 1) * MIN, TZ).estado).toBe('todavia-no')
  })

  it('cierra 2 horas después, y lo DICE', () => {
    expect(ventanaDeSala(CITA, inicio + HORAS_DESPUES * 60 * MIN, TZ).estado).toBe('abierta')
    const tarde = ventanaDeSala(CITA, inicio + (HORAS_DESPUES * 60 + 1) * MIN, TZ)
    expect(tarde.estado).toBe('caducada')
    // Esconder el botón sin explicación deja al paciente sin saber a quién llamar.
    expect(tarde.mensaje).toMatch(/Llama al consultorio/)
  })

  it('la hora es la del CONSULTORIO, no la del servidor', () => {
    // El servidor de Vercel corre en UTC: parsear a mano dejaba la sala abierta
    // seis horas antes de tiempo. Es el mismo fallo que ya se reparó en la ruta.
    const utcMismaPared = Date.parse('2026-08-10T10:00:00.000Z')
    expect(ventanaDeSala(CITA, utcMismaPared, TZ).estado).toBe('todavia-no')
  })

  it('sin fecha no se afirma nada', () => {
    expect(ventanaDeSala(undefined, inicio, TZ).estado).toBe('sin-fecha')
    expect(ventanaDeSala('', inicio, TZ).estado).toBe('sin-fecha')
  })

  it('el enlace del paciente NO lleva `dr=1`', () => {
    // `dr=1` abre el panel lateral con la nota y la receta: es la vista del médico.
    // El tercer argumento —el token— pasó a ser obligatorio en REG-265: sin él,
    // el enlace contestaba 404 al propio dueño de la cita. Aquí se pasa vacío
    // porque lo que se comprueba es OTRA cosa; que el token llegue lo vigila
    // `enlace-de-videoconsulta-lleva-token.test.ts`.
    const url = enlaceSalaPaciente('cita-1', 'clinica-1', '')
    expect(url).toBe('/teleconsulta/cita-1?c=clinica-1')
    expect(url).not.toContain('dr=1')
  })
})

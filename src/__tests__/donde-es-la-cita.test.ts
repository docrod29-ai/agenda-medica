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
    //
    // REG-265 añadió el token: el enlace SIN él contestaba «Cita no encontrada»
    // al propio dueño de la cita, porque `/api/telesalud/sala` exige prueba de
    // titularidad. Este caso pasa a mandarlo — lo que se comprueba aquí sigue
    // siendo lo de siempre: que haya enlace y no haya dirección.
    const l = dondeEsLaCita({ ...VIDEO, tokenPaciente: 'tok.abc' })
    expect(l.esVideo).toBe(true)
    const texto = l.lineas.join('\n')
    expect(texto).toContain(`${BASE}/teleconsulta/cita-1?c=clin-1`)
    expect(texto).not.toContain('Av. Universidad')
    expect(texto).toMatch(/videoconsulta/i)
  })

  it('SIN token no manda enlace: prefiere no darlo a darlo roto', () => {
    /**
     * REG-265. El módulo sigue degradando con gracia si algún día un llamador
     * no trae token (p. ej. `lib/whatsapp.ts`, que se importa desde el
     * navegador y no puede firmar — ver el bloque de abajo). Los dos
     * llamadores de SERVIDOR ya no caen aquí desde REG-306: acuñan el token
     * antes de llamar. Ver 'PATIENT-TELE-002' más abajo.
     */
    const texto = dondeEsLaCita(VIDEO).lineas.join('\n')
    expect(texto).not.toContain('/teleconsulta/')
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

/**
 * GOLDEN — REG-306, PATIENT-TELE-002.
 *
 * REG-265 cerró el camino del portal (el botón del médico ya llevaba `&t=`),
 * pero dejó sin token los DOS caminos que se disparan solos, sin que nadie del
 * consultorio los revise: el cron de recordatorios y la confirmación del bot.
 * `dondeEsLaCita` ya sabía qué hacer sin token —mandar "recibirás el enlace" en
 * vez de un enlace roto—, así que el defecto no rompía ninguna prueba: era
 * honesto y aun así incompleto. El paciente seguía sin enlace.
 *
 * Cómo se descubrió: auditoría PATIENT-UX-TRUTH-001 (8-ago-2026), siguiendo los
 * tres archivos que llama `dondeEsLaCita` sin `tokenPaciente`.
 *
 * La regla: los dos llamadores de SERVIDOR acuñan el token con
 * `crearTokenPaciente(clinicId, patientId, 1, 'agenda', portalTokenVersion)`
 * antes de construir el mensaje. `lib/whatsapp.ts` NO — ese módulo se importa
 * desde el navegador (`window.open` en `openWhatsApp`) y firmar ahí filtraría
 * el secreto HMAC al bundle del cliente.
 *
 * Qué NO cubre: esto lee el TEXTO fuente de las tres rutas, no ejecuta
 * Firestore ni Next.js — no prueba que `portalTokenVersion` viaje con el valor
 * correcto en producción, sólo que el código lo pide antes de firmar. La
 * prueba de extremo a extremo (¿el paciente recibe un enlace que abre?) sigue
 * pendiente de verse en un navegador real.
 */
describe('PATIENT-TELE-002 — los dos caminos automáticos acuñan token (REG-306)', () => {
  const cron = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'cron', 'reminders', 'route.ts'), 'utf8')
  const bot = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts'), 'utf8')
  const browserModule = readFileSync(join(process.cwd(), 'src', 'lib', 'whatsapp.ts'), 'utf8')

  it('el cron de recordatorios importa y usa crearTokenPaciente', () => {
    expect(cron).toContain("import { crearTokenPaciente } from '@/lib/patient-token'")
    expect(cron).toContain('crearTokenPaciente(clinicId, appt.pacienteId, 1,')
  })

  it('el cron pasa tokenPaciente a dondeEsLaCita', () => {
    expect(cron).toMatch(/dondeEsLaCita\(\{[\s\S]{0,400}tokenPaciente/)
  })

  it('el bot acuña token en LOS DOS caminos de confirmación (alta directa y lista de espera)', () => {
    expect(bot).toContain("import { crearTokenPaciente } from '@/lib/patient-token'")
    expect(bot.match(/crearTokenPaciente\(clinicId, pacienteId/g) ?? []).toHaveLength(2)
  })

  it('los dos mensajes de cita agendada del bot pasan tokenPaciente', () => {
    expect(bot.match(/tokenPaciente: tokenPacienteTele/g) ?? []).toHaveLength(1)
    expect(bot.match(/tokenPaciente: tokenPacienteLE/g) ?? []).toHaveLength(1)
  })

  it('lib/whatsapp.ts NO firma: es el módulo que abre WhatsApp en el navegador', () => {
    // Prueba al revés: si alguien acuña el token aquí, el secreto de firma
    // viaja al bundle del cliente. `window.open` es la prueba de que este
    // módulo corre en el navegador, no en el servidor.
    expect(browserModule).not.toContain('crearTokenPaciente')
    expect(browserModule).toContain('window.open')
  })
})

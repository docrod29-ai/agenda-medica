/**
 * GOLDEN — el paciente que reagenda desde su enlace tampoco pisa el Google
 * Calendar del médico.
 *
 * ── EL HUECO QUE QUEDABA ─────────────────────────────────────────────────────
 *
 * Cuatro caminos escriben sobre la misma agenda: el panel del consultorio, el
 * booking público, el bot de WhatsApp y el **reagendado del paciente desde su
 * enlace**. Los tres primeros ya descontaban el calendario personal del médico
 * (v875-v876); el cuarto miraba sólo las citas de NexusMED y los bloqueos
 * capturados a mano.
 *
 * Así que el paciente que movía su cita del martes al jueves podía caer justo
 * encima de la cirugía que el médico tiene apuntada en su Google Calendar. Y
 * peor que reservar encima: **la reserva se aceptaba** —el reagendado no falla,
 * confirma— y el consultorio se enteraba el jueves.
 *
 * Es el mismo patrón que ya salió tres veces en este repositorio: un camino
 * nuevo que se salta la guarda del camino viejo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const portal = leer('src', 'app', 'api', 'portal', 'route.ts')

describe('el portal descuenta el calendario del médico', () => {
  it('usa la consulta compartida, no una propia', () => {
    // Cinco implementaciones del cálculo de huecos, cuatro desactualizadas: por
    // eso `ocupado-servidor.ts` existe y por eso nadie escribe la suya.
    expect(portal).toContain("from '@/lib/calendario/ocupado-servidor'")
    expect(portal).toContain('ocupadoEnGoogle(clinicId, medicoId, fecha')
  })

  it('los bloqueos locales y los de Google entran juntos', () => {
    expect(portal).toContain('return [...locales, ...g.bloqueos]')
  })

  it('mira el calendario de ESE médico, no el del dueño', () => {
    // `ocupadoEnGoogle` no adivina sin `medicoId`; el portal le pasa el de la cita.
    expect(portal).toContain('bloquesDelDia(clinicId, body.fecha, cita.medicoId, config)')
    expect(portal).toContain('bloquesDelDia(clinicId, fecha, cita.medicoId, config)')
  })
})

describe('en los DOS caminos, que es el punto', () => {
  it('al ofrecer los huecos', () => {
    // Validar sin ofrecer bien es ofrecer horas que no existen.
    const i = portal.indexOf("case 'slots'")
    expect(portal.slice(i, i + 900)).toContain('bloquesDelDia(')
  })

  it('y al confirmar el cambio', () => {
    // Ofrecer y rechazar al confirmar es un formulario que miente.
    const i = portal.indexOf("case 'reagendar'")
    expect(portal.slice(i, i + 2600)).toContain('bloquesDelDia(')
  })

  it('ya no queda ninguna llamada que pase sólo los bloqueos locales', () => {
    expect(portal).not.toContain('await leerBloques(clinicId), cita.medicoId)')
    expect(portal).not.toContain('const bloques = await leerBloques(clinicId)')
  })
})

describe('lo que NO puede hacer', () => {
  it('la consulta a Google va FUERA de la transacción', () => {
    /**
     * Una transacción de Firestore puede reintentarse, y una llamada de red
     * dentro se repetiría con ella — además de alargar la ventana en la que el
     * centinela del día está tomado.
     */
    const iBloques = portal.indexOf('const bloques = await bloquesDelDia(')
    const iTx = portal.indexOf('adminDb.runTransaction', iBloques)
    expect(iBloques).toBeGreaterThan(0)
    expect(iTx).toBeGreaterThan(iBloques)
  })

  it('un fallo de Google no esconde el día entero', () => {
    // Dejaría al consultorio sin agenda para el paciente sin que nadie se
    // entere. Se sigue como antes y queda dicho en el registro.
    expect(portal).toContain('if (g.fallo)')
    expect(portal).toContain('los huecos NO lo tienen en cuenta')
  })
})

describe('los cuatro caminos miran lo mismo', () => {
  const CAMINOS: [string, string[]][] = [
    ['booking público', ['src', 'app', 'api', 'public', 'booking', 'route.ts']],
    ['huecos públicos', ['src', 'app', 'api', 'public', 'availability', '[clinicId]', 'route.ts']],
    ['bot de WhatsApp', ['src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts']],
    ['portal del paciente', ['src', 'app', 'api', 'portal', 'route.ts']],
  ]

  for (const [nombre, ruta] of CAMINOS) {
    it(`${nombre}: consulta el calendario del médico`, () => {
      expect(leer(...ruta), nombre).toContain('ocupadoEnGoogle')
    })
  }
})

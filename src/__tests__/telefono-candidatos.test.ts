/**
 * GOLDEN — «no encontré ninguna cita» no puede significar «no supe reconocer tu número».
 *
 * ── EL FALLO, DE LA AUDITORÍA DE LANZAMIENTO ─────────────────────────────────
 *
 * WhatsApp identifica a quien escribe con un `wa_id` (`5215512345678`), y el
 * mismo número puede estar guardado de cuatro formas según por dónde entró: el
 * panel guarda **10 dígitos**, la reserva pública los **dígitos crudos**, el bot
 * la **forma canónica**, y México mete un `1` extra en los móviles.
 *
 * `resolverPacienteBot` ya lo sabía y preguntaba por todos los formatos, con un
 * comentario que lo explica. Pero **buscar las citas para cancelar** y **dar de
 * baja de la lista de espera** comparaban con `==` contra el `wa_id` pelado.
 *
 * O sea que un paciente cuya cita se dio de alta en el mostrador escribía
 * «cancelar» y el bot le contestaba **«no encontré ninguna cita»** — que se lee
 * como «no tienes ninguna», no como «no supe reconocer tu número». Y a quien
 * pedía la baja de la lista de espera se le prometía una baja que no ocurría, dos
 * líneas debajo de un comentario que dice que eso es lo peor que se puede hacer.
 *
 * El criterio existía y estaba bien; sólo lo usaba uno de los tres sitios.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  candidatosDeTelefono, TOPE_IN_FIRESTORE, POR_QUE_NO_BASTA_UN_IGUAL,
} from '@/lib/whatsapp/telefono-candidatos'

describe('candidatosDeTelefono', () => {
  it('cubre las cuatro formas en que se guarda el mismo número', () => {
    const c = candidatosDeTelefono('5215512345678')
    expect(c).toContain('5512345678')      // el panel
    expect(c).toContain('525512345678')    // la forma canónica
    expect(c).toContain('5215512345678')   // el móvil con el 1 de México
  })

  it('el PRIMERO es la forma de 10 dígitos', () => {
    // De ella depende cómo se guarda un paciente nuevo, para que el siguiente
    // match funcione.
    expect(candidatosDeTelefono('5215512345678')[0]).toBe('5512345678')
    expect(candidatosDeTelefono('5512345678')[0]).toBe('5512345678')
  })

  it('acepta el número tecleado con espacios y guiones', () => {
    expect(candidatosDeTelefono('55 1234 5678')).toContain('5512345678')
    expect(candidatosDeTelefono('+52 1 55-1234-5678')).toContain('5512345678')
  })

  it('no repite candidatos', () => {
    const c = candidatosDeTelefono('5512345678')
    expect(new Set(c).size).toBe(c.length)
  })

  it('nunca se pasa del tope del `in` de Firestore', () => {
    // Pasarse hace que la consulta falle ENTERA, y una consulta que falla se lee
    // como «no hay nada» — el mismo fallo que esto viene a cerrar.
    expect(candidatosDeTelefono('5215512345678').length).toBeLessThanOrEqual(TOPE_IN_FIRESTORE)
  })

  it('una entrada sin dígitos devuelve lista vacía, para no reventar el `in`', () => {
    expect(candidatosDeTelefono('')).toEqual([])
    expect(candidatosDeTelefono('sin número')).toEqual([])
  })
})

describe('los TRES sitios que buscan por teléfono usan el mismo criterio', () => {
  const webhook = readFileSync(
    join(process.cwd(), 'src', 'app', 'api', 'whatsapp', 'webhook', 'route.ts'), 'utf8')

  it('las citas para cancelar', () => {
    expect(webhook).toContain("where('pacienteTelefono', 'in', candidatosDeTelefono(from))")
  })

  it('la baja de la lista de espera', () => {
    // El primer `collection('waitlist')` del archivo es el `.doc(id).update()`
    // del alta; la CONSULTA por teléfono es la del final.
    expect(webhook).toContain("collection('waitlist')\n          .where('pacienteTelefono', 'in', candidatosDeTelefono(from))")
  })

  it('y el que ya estaba bien, ahora desde el módulo compartido', () => {
    expect(webhook).toContain('const candidatos = candidatosDeTelefono(telefonoRaw)')
    // Ya no queda la copia local que podía divergir.
    expect(webhook).not.toContain('[diez, canonico, `521${diez}`')
  })

  it('no queda ninguna comparación cruda contra el wa_id por teléfono', () => {
    expect(webhook).not.toContain("where('pacienteTelefono', '==', from)")
    expect(POR_QUE_NO_BASTA_UN_IGUAL).toMatch(/se lee como una respuesta/)
  })
})

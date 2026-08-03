/**
 * GOLDEN (reglas) — una solicitud ARCO de la calle no puede señalar un expediente.
 *
 * `patientId` no estaba constreñido en `arco_requests`, y el panel de
 * Cumplimiento enseña «Ejecutar cancelación…» EXACTAMENTE cuando la solicitud
 * trae uno. Cualquiera desde internet podía crear una solicitud de cancelación
 * con el `patientId` de un paciente real —con un nombre plausible en la
 * tarjeta— y el panel le ofrecía al médico suprimir ese expediente de un clic.
 *
 * Se lee el archivo de reglas: el emulador cubre el comportamiento, esto cubre
 * que la condición no desaparezca en una edición futura.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const reglas = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')

/** El bloque de una colección, hasta su cierre. */
function bloqueDe(coleccion: string): string {
  const i = reglas.indexOf(`match /${coleccion}/`)
  expect(i, `no existe el bloque de ${coleccion}`).toBeGreaterThan(-1)
  // 5000 y no 3000: el bloque creció al documentar por qué el `update`
  // congela lo que declaró el solicitante (v918).
  return reglas.slice(i, i + 5000)
}

describe('arco_requests — creación pública', () => {
  const bloque = bloqueDe('arco_requests')

  it('quien no es miembro NO puede mandar `patientId`', () => {
    expect(bloque).toContain("!('patientId' in request.resource.data.keys())")
  })

  it('una solicitud pública no puede declararse verificada a sí misma', () => {
    expect(bloque).toContain("request.resource.data.get('identidadVerificada', false) == false")
  })

  it('y tiene que declarar de dónde viene', () => {
    expect(bloque).toContain("request.resource.data.get('origen', '') == 'portal-publico'")
  })

  it('un MIEMBRO sí puede ligar el expediente', () => {
    // Ligar la solicitud a un paciente es un acto de la clínica, con la
    // identificación delante; el portal público no lo puede hacer.
    expect(bloque).toContain('isMember(clinicId)')
  })

  it('sigue sin poder borrarse: es registro legal', () => {
    expect(bloque).toContain('allow delete: if false')
  })
})

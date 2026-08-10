/**
 * CERROJO — la aplicación se llama AUSCULTA de cara al usuario.
 *
 * ORIGEN: orden EN VIVO del dueño, 10-ago-2026, registrada como V10-D2 en
 * agent-state/V10_DECISION_LOG.md: «la app ahora se va llamar ausculta».
 *
 * QUÉ PROTEGE: que las superficies que el usuario VE digan Ausculta — y que
 * los IDENTIFICADORES de contrato NO se hayan renombrado por accidente. El
 * renombre rompió dos cosas en el primer intento y este archivo recuerda
 * ambas lecciones:
 *   1. Dos motores UCI sellados cambiaron de huella por un comentario y el
 *      guardián de versiones (A6) lo cazó — los motores sellados NO se tocan
 *      por cosmética; se revirtieron.
 *   2. La matriz de acceso publicada se regenera (REGENERAR_MATRIZ=1), no se
 *      edita a mano.
 *
 * QUÉ NO CUBRE: los textos LEGALES (terminos, privacidad, aviso-privacidad,
 * contrato-encargo) conservan «NexusMED» a propósito hasta que el dueño
 * confirme el nombre LEGAL a imprimir en contratos — está en
 * agent-state/V10_OWNER_DECISIONS_REQUIRED.md. Cuando lo decida, esa
 * excepción se borra de aquí y se renombra también allí.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const raiz = path.resolve(__dirname, '..')
const leer = (p: string) => readFileSync(path.join(raiz, p), 'utf8')

describe('la app se llama Ausculta donde el usuario mira', () => {
  it.each([
    ['app/layout.tsx'],
    ['app/manifest.ts'],
    ['app/login/page.tsx'],
    ['components/Sidebar.tsx'],
    ['components/OnboardingTour.tsx'],
    ['app/page.tsx'],
  ])('%s dice Ausculta y no NexusMED', (archivo) => {
    const src = leer(archivo)
    expect(src).toContain('Ausculta')
    // Probado al revés: reponer la marca vieja hace fallar exactamente aquí.
    expect(src).not.toContain('NexusMED')
  })

  it('la cabecera móvil del dashboard ya no dice «Agenda Médica»', () => {
    const layout = leer('app/(dashboard)/layout.tsx')
    expect(layout).not.toContain('>Agenda Médica<')
    expect(layout).toContain('>Ausculta<')
  })

  it('los identificadores de CONTRATO no se renombraron', () => {
    // El global de versión es contrato con public/sw.js (desplegado aparte):
    expect(leer('components/ServiceWorkerRegister.tsx')).toContain('__NEXUSMED_VERSION')
    // El sending-application de HL7 y el id de facturación son interfaces con
    // sistemas EXTERNOS: cambian con el dueño y sus contrapartes, no por sed.
    expect(leer('lib/hl7/v2.ts')).toContain('NEXUSMED')
    expect(leer('lib/facturama.ts')).toContain("'NEXUSMED'")
  })

  it('los motores clínicos sellados no cambiaron por el renombre', () => {
    // Lección 1 de arriba: la huella de un motor sellado manda sobre la marca.
    expect(leer('lib/uci/copilot.ts')).toContain('NexusMED')
    expect(leer('lib/uci/tendencias.ts')).toContain('NexusMED')
  })
})

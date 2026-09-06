/**
 * ASE-010 · ASE-015 · ASE-024 · PC-014 · Panel de Lujo — los derechos ARCO
 * estaban escritos y a medias: no se podían ligar a un expediente (P1), la
 * supresión borraba citas pasadas y dejaba cobros con nombre, el plazo tiene
 * una duda legal abierta, y el portal ofrecía «Oposición (no usar para X)».
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * · ASE-010: `crearSolicitudArco` siempre escribía origen 'portal-publico' sin
 *   patientId; ninguna pantalla ni ruta ligaba la solicitud al expediente
 *   aunque las reglas lo permitían a un miembro. El panel mandaba a «ejecutar
 *   desde su expediente», donde no hay acción ARCO.
 * · ASE-015: `api/arco/cancelar` borraba TODAS las citas y no tocaba `cobros`.
 * · ASE-024: 20 días hábiles saltando sólo sábados y domingos.
 * · PC-014: una «X» de plantilla en la etiqueta del portal público.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * · `documentoDeSolicitudArco` distingue portal (sin expediente, sin
 *   verificar) de consultorio (ligada y verificada por quien vio la
 *   identificación); `/api/arco/ligar` liga en servidor con bitácora, y
 *   `parcheDeLigado` no toca lo que declaró el ciudadano.
 * · `supresion.ts` aplica PL-L5 por omisión: cita futura → borrar; pasada →
 *   sin nombre; cobro → sin nombre. `queOcurre` lo dice.
 * · El plazo queda conservador y marcado NEEDS_LEGAL_REVIEW (PL-L6a).
 * · Las etiquetas no llevan marcadores de plantilla.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La pantalla de Cumplimiento («Ligar expediente», EXPEDIENTES: handoff) ni el
 * enlace desde /mi (PORTAL: handoff). No ejecuta la ruta con Firestore. La
 * política por colección es del asesor fiscal-legal (NEEDS_LEGAL_REVIEW).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ARCO_TIPO_LABEL, documentoDeSolicitudArco, calcularFechaLimite } from '@/lib/arco'
import { parcheDeLigado, CAMPOS_QUE_LIGAR_NO_TOCA } from '@/lib/arco/ligar'
import { destinoDeCita, citaAnonimizada, cobroAnonimizado, NOMBRE_SUPRIMIDO } from '@/lib/arco/supresion'
import { caminoDeCancelacion } from '@/lib/arco/cancelacion'

const AHORA = '2026-09-06T12:00:00.000Z'
const base = {
  clinicId: 'c1', tipo: 'cancelacion' as const, descripcion: 'Quiero que borren mis datos',
  solicitante: { nombre: 'Titular Sintético', telefono: '5500000000' },
}

describe('PC-014 · las etiquetas del portal no llevan marcadores de plantilla', () => {
  it('ninguna etiqueta dice «X» ni deja llaves', () => {
    for (const [tipo, texto] of Object.entries(ARCO_TIPO_LABEL)) {
      expect(texto, tipo).not.toMatch(/\bX\b|\{|\}|TODO/)
      expect(texto.length, tipo).toBeGreaterThan(10)
    }
    expect(ARCO_TIPO_LABEL.oposicion).toMatch(/fin concreto/)
  })
})

describe('ASE-010 · una solicitud se puede ligar a un expediente', () => {
  it('del portal nace sin expediente ni verificación, aunque el cuerpo traiga patientId', () => {
    const d = documentoDeSolicitudArco({ ...base, patientId: 'inyectado' } as never, AHORA, { desde: 'portal-publico' })
    expect('patientId' in d).toBe(false)
    expect(d.origen).toBe('portal-publico')
    expect(d.identidadVerificada).toBe(false)
    expect(d.estado).toBe('recibida')
  })

  it('desde el consultorio nace ligada y verificada por quien vio la identificación', () => {
    const d = documentoDeSolicitudArco(base, AHORA, { desde: 'consultorio', patientId: 'p1', verificadaPor: 'u-medico' })
    expect(d.patientId).toBe('p1')
    expect(d.origen).toBe('consultorio')
    expect(d.identidadVerificada).toBe(true)
    expect(d.identidadVerificadaPor).toBe('u-medico')
    expect(d.identidadVerificadaEn).toBe(AHORA)
  })

  it('ligar sólo AÑADE: no toca lo que declaró el ciudadano', () => {
    const parche = parcheDeLigado({ patientId: 'p1', uid: 'u-admin', ahoraIso: AHORA })
    for (const c of CAMPOS_QUE_LIGAR_NO_TOCA) expect(c in parche, c).toBe(false)
    expect(parche).toEqual({ patientId: 'p1', identidadVerificada: true, identidadVerificadaPor: 'u-admin', identidadVerificadaEn: AHORA, estado: 'en_proceso' })
  })

  it('la ruta existe, exige `administrar`, la identificación vista y que el expediente sea del consultorio', () => {
    const ruta = readFileSync(resolve(process.cwd(), 'src/app/api/arco/ligar/route.ts'), 'utf8')
    expect(ruta).toContain("verificarCapacidad(req, clinicId, 'administrar')")
    expect(ruta).toMatch(/identidadVerificada !== true/)
    expect(ruta).toMatch(/collection\('patients'\)\.doc\(patientId\)\.get\(\)/)
    expect(ruta).toContain("evento: 'arco_solicitud_ligada'")
  })
})

describe('ASE-015 · la supresión conserva sin nombre lo que la ley y la agenda exigen', () => {
  it('cita futura se borra; cita pasada (o de hoy) se anonimiza; sin fecha legible se borra', () => {
    expect(destinoDeCita({ fechaHora: '2026-09-07 10:00' }, AHORA)).toBe('borrar')
    expect(destinoDeCita({ fechaHora: '2026-09-06 18:00' }, AHORA)).toBe('anonimizar')
    expect(destinoDeCita({ fechaHora: '2026-01-15 09:00' }, AHORA)).toBe('anonimizar')
    expect(destinoDeCita({}, AHORA)).toBe('borrar')
  })

  it('lo anonimizado no conserva nombre, teléfono, motivo ni notas — y queda marcado', () => {
    const marca = { arcoSuprimidaEn: AHORA, arcoSolicitudId: 's1' }
    const cita = citaAnonimizada(marca)
    expect(cita.pacienteNombre).toBe(NOMBRE_SUPRIMIDO)
    expect(cita.pacienteTelefono).toBe('')
    expect(cita.motivo).toBe('')
    expect(cita.notasInternas).toBe('')
    expect(cita.arcoSolicitudId).toBe('s1')
    const cobro = cobroAnonimizado(marca)
    expect(cobro.patientNombre).toBe(NOMBRE_SUPRIMIDO)
    expect('monto' in cobro).toBe(false)   // el importe no se toca: registro fiscal
  })

  it('la ruta aplica la política antes del borrado y el veredicto lo cuenta', () => {
    const ruta = readFileSync(resolve(process.cwd(), 'src/app/api/arco/cancelar/route.ts'), 'utf8')
    expect(ruta).toContain("from '@/lib/arco/supresion'")
    expect(ruta).toMatch(/collection\('cobros'\)\.where\('patientId', '==', patientId\)/)
    expect(ruta).toMatch(/citasABorrar\.map\(d => d\.ref\)/)
    expect(ruta).not.toMatch(/\.\.\.citasSnap\.docs\.map\(d => d\.ref\)/)
    expect(caminoDeCancelacion(0).queOcurre).toMatch(/cobros .* se conservan sin nombre/)
  })
})

describe('ASE-024 · el plazo es conservador y está marcado para revisión legal', () => {
  it('20 días hábiles saltando fines de semana: avisa antes, nunca después', () => {
    // Lunes 7-sep-2026 + 20 hábiles = lunes 5-oct-2026.
    expect(calcularFechaLimite('2026-09-07T12:00:00.000Z').slice(0, 10)).toBe('2026-10-05')
  })
  it('la duda legal está escrita donde se calcula', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/lib/arco.ts'), 'utf8')
    expect(src).toMatch(/NEEDS_LEGAL_REVIEW[\s\S]{0,200}art\. 74 LFT/)
  })
})

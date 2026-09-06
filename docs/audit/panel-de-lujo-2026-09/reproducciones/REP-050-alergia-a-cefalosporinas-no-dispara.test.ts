/**
 * REP-050 · MI-004 (M-internista) — una alergia escrita como «Cefalosporinas»
 * no dispara nada al recetar ceftriaxona: ni en la receta ni en la compuerta
 * de firma. El copiloto de la consulta SÍ la ve.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/expediente/medical-dictionary.ts:147-149`
 *   `FAMILIA_BETALACTAMICOS.some(f => a.includes(f) || a.includes('beta'))`
 * contra la lista de la línea 69, que sólo tiene PRINCIPIOS ACTIVOS. El
 * disparador de clase «cefalosporina» existe en el otro motor
 * (`copiloto.ts:143`, `dispara: [... 'betalactam', 'cefalosporina', 'peni']`)
 * pero no aquí, y éste es el que imprime y el que gatea la firma
 * (`nom004.ts:81`). Tampoco hay red de respaldo: la compuerta por token de
 * nom004.ts:57-72 hace `'Ceftriaxona 1 g'.includes('cefalosporinas')` → false.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-internista, MI-004; equipo rojo confirmado P1 con jiti:
 * `validarAlergiasVsMedicamentos([{alergeno:'Cefalosporinas'}],[{nombre:
 * 'Ceftriaxona 1 g'}])` → `[]`. «Penicilinas» sí funciona, y sólo porque
 * «penicilina» es subcadena suya; con «cefalosporinas» no hay subcadena.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Dos vocabularios sobre la misma entidad clínica: el repositorio alineó los
 * MIEMBROS de la familia (comentario de :64-68) pero no los DISPARADORES.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * CLAUDE.md, invariantes: «UN MODELO … DE MEDICAMENTO … nunca duplicar la
 * fuente de verdad». clinical-safety §5: un vocabulario es vocabulario, no
 * criterio — y aquí el término de CLASE, que es como lo escribe el médico,
 * falta justo en el motor que decide la firma.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: motor real del diccionario y compuerta NOM-004 real.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No decide QUÉ términos de clase entran (NEEDS_CLINICAL_REVIEW, lo dice el
 * hallazgo): sólo exige que el que el copiloto ya reconoce lo reconozca también
 * la receta. No toca alérgenos que ningún vocabulario contempla (yodo, látex).
 * No prueba «quinolonas», «sulfas» ni «AINEs» en plural: MI-004 sólo reproduce
 * cefalosporinas, y el resto queda para la tabla que el hallazgo pide.
 */
import { describe, it, expect } from 'vitest'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'
import { validarNOM004 } from '@/lib/expediente/nom004'
import type { NotaMedica } from '@/types/expediente'

const criticas = (alergeno: string, med: string) =>
  validarAlergiasVsMedicamentos([{ alergeno }], [{ nombre: med }]).filter(a => a.severidad === 'critica')

function nota(alergeno: string, med: string): NotaMedica {
  return {
    id: 'n-rep050', clinicId: 'c-sintetica', pacienteId: 'p-sintetico', pacienteNombre: 'Paciente Sintético',
    tipo: 'consulta_externa',
    metadata: {
      id: 'n-rep050', tipoNota: 'consulta_externa', clinicId: 'c-sintetica', pacienteId: 'p-sintetico',
      medicoId: 'm-sintetico', cedulaProfesional: '00000000', especialidad: 'Medicina Interna',
      establecimiento: 'Consultorio sintético', fechaCreacion: '2026-09-06T10:00:00Z',
      fechaModificacion: '2026-09-06T10:00:00Z', hashIntegridad: '', version: 1,
      estado: 'borrador', fuenteGeneracion: 'manual',
    },
    fechaConsulta: '2026-09-06T10:00:00Z',
    secciones: [],
    diagnosticos: [{ descripcion: 'Dx sintético', codigoCIE10: 'A00.0' }],
    medicamentos: [{ nombre: med, dosis: '1 g', via: 'IV', frecuencia: 'c/24 h', duracion: '7 días' }],
    alergias: [{ alergeno }],
  } as unknown as NotaMedica
}

describe('REP-050 · «Cefalosporinas» como alérgeno dispara contra una cefalosporina en la receta', () => {
  it('Cefalosporinas + Ceftriaxona 1 g → al menos una alerta crítica (hoy: ninguna)', () => {
    const c = criticas('Cefalosporinas', 'Ceftriaxona 1 g')
    expect(c.length, 'sin alerta: el vocabulario de la receta no conoce la clase').toBeGreaterThan(0)
  })

  it('la compuerta de firma (validarNOM004) lo dice en sus errores (hoy: calla)', () => {
    const r = validarNOM004(nota('Cefalosporinas', 'Ceftriaxona 1 g'))
    const menciona = r.errores.filter(e => /ceftriaxona/i.test(e))
    expect(menciona, r.errores.join(' | ')).not.toHaveLength(0)
  })

  it('control: «Penicilinas» + Amoxicilina SÍ dispara hoy (la familia sigue vigilada)', () => {
    expect(criticas('Penicilinas', 'Amoxicilina 500 mg').length).toBeGreaterThan(0)
  })

  it('control: una alergia sin relación (polen) no dispara contra ceftriaxona', () => {
    expect(criticas('Polen', 'Ceftriaxona 1 g')).toHaveLength(0)
  })
})

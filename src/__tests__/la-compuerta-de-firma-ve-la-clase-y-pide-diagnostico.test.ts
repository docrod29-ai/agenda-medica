/**
 * GOLDEN — la compuerta de firma lee la alergia por CLASE y pide diagnóstico en
 * las notas quirúrgicas.
 *
 * Dos hallazgos del Panel de Lujo (sep-2026) que caen en el mismo archivo,
 * `src/lib/expediente/nom004.ts`:
 *
 *   · MC-010 (auditor M-cirujano, CONFIRMADO, P2) — una nota postoperatoria o
 *     una valoración preoperatoria se podían FIRMAR sin un solo diagnóstico
 *     estructurado.
 *   · MI-004 (auditor M-internista, CONFIRMADO, P1) — parte de compuerta: una
 *     alergia escrita como «Cefalosporinas» no disparaba nada al prescribir
 *     ceftriaxona.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * MC-010: `requiereDx` listaba historia_clinica, primera_vez, ingreso y egreso.
 * Las dos notas quirúrgicas no estaban, así que «Diagnóstico postoperatorio:
 * apendicitis aguda perforada» vivía sólo en la prosa de la sección. De la
 * prosa no lee nadie: el `Condition` de FHIR sale de `diagnosticos[]`, y la
 * carta de referencia se prellena de `nota.diagnosticos`. El expediente
 * interoperable del paciente no sabía que lo habían operado.
 *
 * MI-004: el cruce exacto comparaba por TOKEN —la primera palabra del
 * alérgeno— contra el nombre del fármaco:
 * `'ceftriaxona 1 g'.includes('cefalosporinas')` es `false`. El equipo rojo lo
 * midió con el motor real y además comprobó que no había red de respaldo. Con
 * «Penicilinas» funcionaba de casualidad (es subcadena de la palabra); con las
 * cefalosporinas no hay subcadena posible.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 *
 * MC-010: la lista de tipos se escribió cuando el módulo quirúrgico no existía
 * y nadie volvió a ella al añadirlo.
 * MI-004: dos vocabularios sobre la misma entidad clínica —el del copiloto, que
 * conoce las clases, y el de la compuerta, que sólo conocía principios
 * activos—, y el débil era el que gatea la firma.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * «El dato tiene que LLEGAR»: un diagnóstico en prosa no llega a FHIR ni a la
 * referencia. Y clinical-safety §5: señalar de menos, nunca de más — la
 * cobertura por clase se SUMA al token, no lo sustituye.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `validarNOM004`, que es la compuerta real. Probada al
 * revés: la nota postoperatoria CON diagnóstico sigue pasando, y una alergia
 * que no toca al fármaco no inventa un error.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre `nota_anestesia` ni `consentimiento`, donde el diagnóstico puede
 * venir heredado de la nota quirúrgica. No decide la reactividad CRUZADA entre
 * subfamilias (que una alergia a cefalosporinas alerte también sobre
 * penicilinas): eso es criterio clínico y vive en `medical-dictionary.ts`
 * marcado NEEDS_CLINICAL_REVIEW. No cubre alérgenos que ningún vocabulario
 * contempla (yodo/contraste, látex, mariscos): ahí sigue sin haber cruce, y
 * está declarado.
 */
import { describe, it, expect } from 'vitest'
import { validarNOM004 } from '@/lib/expediente/nom004'
import type { NotaMedica } from '@/types/expediente'

function nota(over: Partial<NotaMedica> = {}): NotaMedica {
  return {
    id: 'n-sintetica', clinicId: 'c-sintetica', pacienteId: 'p-sintetico',
    pacienteNombre: 'Paciente Sintético',
    tipo: 'nota_postoperatoria',
    metadata: {
      id: 'n-sintetica', tipoNota: 'nota_postoperatoria', clinicId: 'c-sintetica',
      pacienteId: 'p-sintetico', medicoId: 'm-sintetico', cedulaProfesional: '00000000',
      especialidad: 'Cirugía General', establecimiento: 'Consultorio sintético',
      fechaCreacion: '2026-09-06T10:00:00Z', fechaModificacion: '2026-09-06T10:00:00Z',
      hashIntegridad: '', version: 1, estado: 'borrador', fuenteGeneracion: 'manual',
    },
    fechaConsulta: '2026-09-06T10:00:00Z',
    secciones: [],
    diagnosticos: [], medicamentos: [], alergias: [],
    ...over,
  } as unknown as NotaMedica
}

describe('MC-010 · las notas quirúrgicas piden diagnóstico estructurado', () => {
  it('una nota postoperatoria sin diagnóstico NO se puede firmar', () => {
    const r = validarNOM004(nota({ tipo: 'nota_postoperatoria' }))
    expect(r.errores).toContain('Falta al menos un diagnóstico')
  })

  it('una valoración preoperatoria sin diagnóstico tampoco', () => {
    const r = validarNOM004(nota({ tipo: 'valoracion_preoperatoria' }))
    expect(r.errores).toContain('Falta al menos un diagnóstico')
  })

  it('al revés: con el diagnóstico estructurado, ese error desaparece', () => {
    const r = validarNOM004(nota({
      tipo: 'nota_postoperatoria',
      diagnosticos: [{ descripcion: 'Apendicitis aguda sintética', tipo: 'definitivo' }] as never,
    }))
    expect(r.errores).not.toContain('Falta al menos un diagnóstico')
  })

  it('control: una nota de seguimiento sigue sin exigirlo (puede heredar)', () => {
    const r = validarNOM004(nota({ tipo: 'seguimiento' }))
    expect(r.errores).not.toContain('Falta al menos un diagnóstico')
  })
})

describe('MI-004 · la alergia escrita como CLASE gatea la firma', () => {
  const conAlergia = (alergeno: string, farmaco: string) => validarNOM004(nota({
    tipo: 'seguimiento',
    alergias: [{ alergeno }] as never,
    medicamentos: [{ nombre: farmaco, dosis: '1 g', via: 'iv', frecuencia: 'cada 12 horas', duracion: '7 días' }] as never,
  }))

  it('«Cefalosporinas» + ceftriaxona bloquea la firma (antes: ni una señal)', () => {
    const r = conAlergia('Cefalosporinas', 'Ceftriaxona 1 g')
    expect(r.valida).toBe(false)
    expect(r.errores.join(' ')).toMatch(/Ceftriaxona/i)
  })

  it('«Betalactámicos» —el término paraguas— también', () => {
    expect(conAlergia('Betalactámicos', 'Amoxicilina 500 mg').valida).toBe(false)
  })

  it('el caso de siempre sigue cazándose por el nombre exacto', () => {
    expect(conAlergia('Tramadol', 'Tramadol 100 mg').valida).toBe(false)
  })

  it('al revés: una alergia que NO toca al fármaco no inventa un error', () => {
    // El falso amigo que costó MI-005: «beta» suelto convertía la betametasona
    // en una alergia a betalactámicos y bloqueaba la firma.
    const r = conAlergia('Betametasona', 'Amoxicilina 500 mg')
    expect(r.errores.some(e => /Amoxicilina/i.test(e))).toBe(false)
  })
})

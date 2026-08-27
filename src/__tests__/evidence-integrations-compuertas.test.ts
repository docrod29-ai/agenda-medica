/**
 * GOLDEN — evidencia ↛ acción clínica, caché y frescura (#314 puntos 4 y 8).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Nada impedía que un resultado de evidencia acabara en un diagnóstico, una
 * orden o una receta. El riesgo real no es que el médico se confunda: es que un
 * flujo automático «ayude» —un botón de aplicar sugerencia, un prellenado, un
 * agente que rellena el plan— y salga una receta que nadie decidió.
 *
 * Y para la caché: nada distinguía material abierto de material propietario, ni
 * material del consultorio de material compartible.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Puntos 4 y 8 del checkpoint de #314, leídos junto a la regla del tablero #296
 * («historia ≠ plan ≠ receta»), que ya había sido necesaria para medicamentos.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * La prohibición vivía en el prompt. Un prompt no es una compuerta: sólo pide
 * que el modelo se porte bien y no impide nada al código que lo rodea.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Convertir evidencia en acción exige `decisionDelMedico`, que exige identidad
 * y acto explícito, y cuyo resultado lleva marca fantasma: no se puede escribir
 * a mano (la mitad de compilación está en tipos/evidence-integrations.tipos.ts).
 * Y una caché por inquilino sin `clinicId` FALLA, no degrada a global.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * NO comprueba que las pantallas usen estas compuertas — hoy no hay pantalla
 * conectada; es el handoff de docs/evidence/HANDOFF-ARCHIVOS-CENTRALES.md.
 * NO valida los umbrales de frescura como criterio clínico: son operativos y
 * están declarados como tales en frescura.ts.
 */
import { describe, it, expect } from 'vitest'
import {
  decisionDelMedico, propuestaDesdeEvidencia, propuestasDeSintesis,
  puedeCachearse, claveDeCache,
} from '@/lib/evidence-integrations/compuertas'
import {
  frescuraDeFuente, frescuraDeNota, instanteComparable, UMBRAL_DIAS, tasaDeFrescura,
} from '@/lib/evidence-integrations/frescura'
import { corpusParaSintesis, mapaDeSoporte } from '@/lib/evidence-integrations/soporte'
import { sobreConMaterial } from '@/lib/evidence-integrations/contrato'
import { fuente, fechaPublicacionDesde, type Source } from '@/types/evidence'

const AHORA = '2026-08-22T10:00:00.000Z'
const TEXTO = 'Objetivo: comparar dos duraciones de tratamiento en una cohorte simulada. Resultado: la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales.'

function src(anio: string, id = 'A'): Source {
  const r = fuente({
    proveedor: 'pubmed', idExterno: id, titulo: `Documento ${id}`,
    publicado: fechaPublicacionDesde(anio), recuperadoEn: AHORA, textoRecuperado: TEXTO,
  })
  if (!r.ok) throw new Error('fixture inválido')
  return r.valor
}

function unaAfirmacionRespaldada() {
  const s = sobreConMaterial({
    proveedor: 'pubmed', estado: 'available', intentadoEn: AHORA,
    correlacion: 'corr-compuertas', telemetria: { latenciaMs: 10 }, fuentes: [src('2024')],
  })
  if (!s.ok) throw new Error('fixture inválido')
  const m = mapaDeSoporte([{
    texto: 'La diferencia observada cruzó el nulo.', citas: [1],
    pasajes: ['la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales'],
  }], corpusParaSintesis([s.valor]))
  expect(m.respaldadas).toHaveLength(1)
  return m
}

describe('la evidencia NUNCA origina una acción clínica por su cuenta', () => {
  it('sin acto explícito del médico, no hay acción — ni con evidencia perfecta', () => {
    const m = unaAfirmacionRespaldada()
    const propuesta = propuestaDesdeEvidencia(m.respaldadas[0], 'receta')

    const r = decisionDelMedico({
      accion: 'receta', decidioUid: 'medico-1', decidioEn: AHORA,
      actoExplicito: false, informadaPor: propuesta,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('NO_ES_ACTO_EXPLICITO')
      expect(r.detalle).toMatch(/NUNCA origina/)
    }
  })

  it('sin médico identificado tampoco, aunque el acto sea explícito', () => {
    const r = decisionDelMedico({ accion: 'orden', decidioUid: '  ', decidioEn: AHORA, actoExplicito: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('SIN_MEDICO')
  })

  it('con médico y acto explícito, sí — y queda registrado de qué propuesta salió', () => {
    const m = unaAfirmacionRespaldada()
    const propuesta = propuestaDesdeEvidencia(m.respaldadas[0], 'receta')
    const r = decisionDelMedico({
      accion: 'receta', decidioUid: 'medico-1', decidioEn: AHORA,
      actoExplicito: true, informadaPor: propuesta,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.valor.decidioUid).toBe('medico-1')
      expect(r.valor.informadaPor?.clase).toBe('propuesta_informativa')
    }
  })

  it('una propuesta NO trae dosis, vía ni código: sería una receta esperando un clic', () => {
    const m = unaAfirmacionRespaldada()
    const p = propuestaDesdeEvidencia(m.respaldadas[0], 'receta')
    expect(p.clase).toBe('propuesta_informativa')
    // Lo que la propuesta NO tiene es la mitad del invariante.
    expect(Object.keys(p).sort()).toEqual(['afirmacion', 'clase', 'informaSobre', 'quedaPorDecidir'])
    expect(p.quedaPorDecidir).toMatch(/dosis, vía, frecuencia/)
  })

  it('sólo las afirmaciones RESPALDADAS llegan a proponer', () => {
    const s = sobreConMaterial({
      proveedor: 'pubmed', estado: 'available', intentadoEn: AHORA,
      correlacion: 'corr-compuertas', telemetria: { latenciaMs: 10 }, fuentes: [src('2024')],
    })
    if (!s.ok) throw new Error('fixture inválido')
    const m = mapaDeSoporte([
      { texto: 'Buena.', citas: [1], pasajes: ['la diferencia observada en el desenlace primario fue de 1.4 puntos porcentuales'] },
      { texto: 'Inventada.', citas: [1], pasajes: ['la mortalidad se redujo un cincuenta por ciento en el grupo'] },
    ], corpusParaSintesis([s.valor]))
    expect(propuestasDeSintesis(m, 'plan_terapeutico')).toHaveLength(1)
  })
})

describe('la caché no puede convertirse en redistribución ni en fuga entre consultorios', () => {
  it('material abierto: caché global', () => {
    const v = puedeCachearse('pubmed')
    expect(v.permitido).toBe(true)
    if (v.permitido) expect(v.alcance).toBe('global')
  })

  it('material propietario sin derecho verificado: NO se cachea', () => {
    for (const p of ['uptodate', 'cochrane', 'openevidence'] as const) {
      const v = puedeCachearse(p)
      expect(v.permitido, p).toBe(false)
      if (!v.permitido) expect(v.porQue).toMatch(/UNVERIFIABLE/)
    }
  })

  it('conocimiento personal: sólo dentro del consultorio', () => {
    const v = puedeCachearse('conocimiento_personal')
    expect(v.permitido).toBe(true)
    if (v.permitido) expect(v.alcance).toBe('por_consultorio')
  })

  it('una caché por consultorio SIN clinicId falla; NO degrada a una clave global', () => {
    // Ésta es la fuga entre inquilinos con forma de optimización: si degradara,
    // dos consultorios compartirían material del médico.
    const r = claveDeCache('conocimiento_personal', 'huella123')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/fuga entre inquilinos/)
  })

  it('con clinicId, la clave lo incluye', () => {
    const r = claveDeCache('conocimiento_personal', 'huella123', 'clinica-7')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.valor).toContain('clinica-7')
  })

  it('dos consultorios NUNCA comparten clave', () => {
    const a = claveDeCache('conocimiento_personal', 'h', 'clinica-1')
    const b = claveDeCache('conocimiento_personal', 'h', 'clinica-2')
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) expect(a.valor).not.toBe(b.valor)
  })
})

describe('frescura: recuperar hoy no hace nuevo lo viejo', () => {
  it('un artículo de 2016 recuperado hoy es ANTIGUO', () => {
    const v = frescuraDeFuente(src('2016'), AHORA)
    expect(v.clase).toBe('antigua')
    if (v.clase === 'antigua') expect(v.base).toBe('publicacion')
  })

  it('una revisión declarada RECIENTE gana a una publicación vieja', () => {
    // Una guía de 2016 revisada en 2026 es material vigente.
    const v = frescuraDeFuente(src('2016'), AHORA, { revisadoEn: '2026-06-01T00:00:00.000Z' })
    expect(v.clase).toBe('reciente')
    if (v.clase === 'reciente') expect(v.base).toBe('revision_declarada')
  })

  it('sin fecha utilizable el veredicto es INDETERMINADO, no «reciente»', () => {
    // Regla 4 de seguridad clínica: ausencia de dato no es dato de ausencia.
    const sinFecha = fuente({
      proveedor: 'pubmed', idExterno: 'Z', titulo: 'Sin fecha',
      publicado: fechaPublicacionDesde(undefined), recuperadoEn: AHORA, textoRecuperado: TEXTO,
    })
    expect(sinFecha.ok).toBe(true)
    if (!sinFecha.ok) return
    expect(frescuraDeFuente(sinFecha.valor, AHORA).clase).toBe('indeterminada')
  })

  it('una fecha en el FUTURO es dato corrupto, no «muy reciente»', () => {
    expect(frescuraDeFuente(src('2030'), AHORA).clase).toBe('indeterminada')
  })

  it('el año se compara por su 31 de diciembre, para no envejecer la fuente de gratis', () => {
    expect(instanteComparable({ precision: 'anio', iso: '2024' })).toBe('2024-12-31T23:59:59.999Z')
  })

  it('una nota personal envejece ANTES que un artículo', () => {
    // 2 años: dentro del umbral de literatura (5 años), fuera del de notas (18 meses).
    const haceDosAnios = '2024-08-22T10:00:00.000Z'
    expect(UMBRAL_DIAS.conocimientoPersonal).toBeLessThan(UMBRAL_DIAS.literatura)
    const nota = frescuraDeNota({ titulo: 'Mi esquema', fechaDeAutoria: haceDosAnios }, AHORA)
    expect(nota.clase).toBe('antigua')
    if (nota.clase === 'antigua') expect(nota.aviso).toMatch(/dosis o esquemas pueden estar desactualizados/)
    // El mismo intervalo, para un artículo, todavía es reciente.
    expect(frescuraDeFuente(src('2024'), AHORA).clase).toBe('reciente')
  })

  it('«no sé si es reciente» NUNCA suma a favor de la frescura', () => {
    // Un lote entero sin fechas da 0, no 1.
    const veredictos = [
      { veredicto: { clase: 'indeterminada', porQue: 'x' } as const },
      { veredicto: { clase: 'indeterminada', porQue: 'y' } as const },
    ]
    expect(tasaDeFrescura(veredictos)).toBe(0)
  })
})

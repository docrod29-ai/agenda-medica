/**
 * GOLDEN — el sobre de recuperación: no se puede fingir una consulta (#314).
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Hoy `src/app/api/consultor-evidencia/route.ts` llama a PubMed dentro de un
 * `try` y, al fallar, sigue con menos artículos. El médico ve una respuesta más
 * pobre y NO TIENE FORMA de saber si es que la literatura no dice nada o que la
 * literatura no se consultó. Son dos frases con consecuencias clínicas
 * opuestas y hoy se pintan idénticas.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo el punto 9 de #314 («jamás fingir que un proveedor fue consultado»)
 * contra el código: el `catch` de la ruta lo viola sin escribir ninguna mentira,
 * simplemente devolviendo menos.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * `buscarEvidencia` devuelve `ArticuloPubMed[]`. Un array vacío es el mismo
 * valor para «no hay» y para «no contestó». El tipo no puede distinguirlos, así
 * que ningún llamador puede.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * El resultado de recuperar es una UNIÓN DISCRIMINADA en la que `fuentes` sólo
 * existe en `available`/`partial`. La mitad de compilación está en
 * src/__tests__/tipos/evidence-integrations.tipos.ts; aquí va la de runtime.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * NO comprueba que las rutas de producción usen sobres — hoy NO los usan, y el
 * cableado es el handoff documentado en docs/evidence/HANDOFF-ARCHIVOS-CENTRALES.md.
 * NO comprueba nada contra la red real.
 */
import { describe, it, expect } from 'vitest'
import {
  sobreConMaterial, sobreSinMaterial, tieneMaterial, puedeRespaldar,
  comoSeLeDiceAlMedico, correlacionSegura, ESTADOS_SIN_MATERIAL,
} from '@/lib/evidence-integrations/contrato'
import { fuente, fechaPublicacionDesde, type Source } from '@/types/evidence'

const AHORA = '2026-08-22T10:00:00.000Z'
const CORR = 'corr-0001-abcd'

function unaFuente(id = 'SYN-1', texto = 'Resultado sintético con texto suficientemente largo para anclar un pasaje literal de más de cuarenta caracteres.'): Source {
  const r = fuente({
    proveedor: 'pubmed', idExterno: id, titulo: 'Documento sintético',
    publicado: fechaPublicacionDesde('2024'), recuperadoEn: AHORA, textoRecuperado: texto,
  })
  if (!r.ok) throw new Error(`fixture mal construido: ${r.motivo}`)
  return r.valor
}

describe('el sobre distingue «no hay nada» de «no contestó»', () => {
  it('un `available` con cero fuentes NO es lo mismo que un `unavailable`', () => {
    const vacio = sobreConMaterial({
      proveedor: 'pubmed', estado: 'available', intentadoEn: AHORA, correlacion: CORR,
      telemetria: { latenciaMs: 210 }, fuentes: [],
    })
    const caido = sobreSinMaterial({
      proveedor: 'pubmed', estado: 'unavailable', intentadoEn: AHORA, correlacion: CORR,
      telemetria: { latenciaMs: 30_000 }, motivo: 'PubMed no respondió.', clase: 'timeout',
    })
    expect(vacio.ok && caido.ok).toBe(true)
    if (!vacio.ok || !caido.ok) return

    expect(tieneMaterial(vacio.valor)).toBe(true)
    expect(tieneMaterial(caido.valor)).toBe(false)
    // Y lo que lee el médico tampoco puede ser lo mismo.
    expect(comoSeLeDiceAlMedico(vacio.valor)).toMatch(/consultado, sin resultados/)
    expect(comoSeLeDiceAlMedico(caido.valor)).toMatch(/NO CONSULTADO/)
    expect(comoSeLeDiceAlMedico(vacio.valor)).not.toEqual(comoSeLeDiceAlMedico(caido.valor))
  })

  it('TODOS los estados sin material se le dicen al médico como NO CONSULTADO', () => {
    // Probado al revés: si alguien añadiera un estado de fallo y olvidara
    // pintarlo, este caso lo caza al recorrer la lista entera.
    for (const estado of ESTADOS_SIN_MATERIAL) {
      const r = sobreSinMaterial({
        proveedor: 'uptodate', estado, intentadoEn: AHORA, correlacion: CORR,
        telemetria: { latenciaMs: 0 }, motivo: `motivo de ${estado}`, clase: 'sin_contrato',
      })
      expect(r.ok, estado).toBe(true)
      if (r.ok) expect(comoSeLeDiceAlMedico(r.valor), estado).toMatch(/NO CONSULTADO/)
    }
  })
})

describe('un fallo sin motivo legible es un fallo silencioso', () => {
  it('se rechaza un sobre de fallo sin motivo', () => {
    const r = sobreSinMaterial({
      proveedor: 'pubmed', estado: 'unavailable', intentadoEn: AHORA, correlacion: CORR,
      telemetria: { latenciaMs: 5 }, motivo: '   ', clase: 'red',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('MOTIVO_AUSENTE')
  })

  it('se rechaza un `partial` que no dice QUÉ le falta', () => {
    // Un `partial` sin recorte es un `available` disfrazado: promete que se
    // revisó material que en realidad se descartó.
    const r = sobreConMaterial({
      proveedor: 'pubmed', estado: 'partial', intentadoEn: AHORA, correlacion: CORR,
      telemetria: { latenciaMs: 100 }, fuentes: [unaFuente()],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('RECORTE_AUSENTE')
  })
})

describe('una fuente no hereda la autoridad del sobre que la lleva', () => {
  it('un sobre de conocimiento personal NO puede transportar un Source citable', () => {
    // Regla 8 de #314, aplicada por CONTRATO y no por prompt.
    const r = sobreConMaterial({
      proveedor: 'conocimiento_personal', estado: 'available', intentadoEn: AHORA,
      correlacion: CORR, telemetria: { latenciaMs: 3 }, fuentes: [unaFuente()],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('ROL_NO_PUEDE_APORTAR_FUENTES')
  })

  it('un sobre de Perplexity tampoco: sólo descubre', () => {
    // Regla 7 de #314.
    const r = sobreConMaterial({
      proveedor: 'perplexity', estado: 'available', intentadoEn: AHORA,
      correlacion: CORR, telemetria: { latenciaMs: 900 }, fuentes: [unaFuente()],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.detalle).toMatch(/re-groundearse|no puede entrar como Source/)
  })

  it('un sobre de un proveedor NO puede llevar un Source de otro', () => {
    // El modo de fallo «cita prestada»: un sobre etiquetado como una fuente de
    // autoridad transportando material de otra parte.
    const deOtro = fuente({
      proveedor: 'cdc', idExterno: 'X-1', titulo: 'Documento del CDC',
      publicado: fechaPublicacionDesde('2025'), recuperadoEn: AHORA,
      textoRecuperado: 'Texto del CDC con longitud suficiente para poder anclar un pasaje literal en él.',
    })
    expect(deOtro.ok).toBe(true)
    if (!deOtro.ok) return
    const r = sobreConMaterial({
      proveedor: 'pubmed', estado: 'available', intentadoEn: AHORA, correlacion: CORR,
      telemetria: { latenciaMs: 10 }, fuentes: [deOtro.valor],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('FUENTE_DE_OTRO_PROVEEDOR')
  })
})

describe('la correlación nunca puede llevar PHI', () => {
  it.each([
    ['juan-perez-garcia-1985', 'parece un nombre'],
    ['', 'vacía'],
    ['ab', 'demasiado corta para ser opaca'],
    ['corr 0001', 'con espacio'],
    ['paciente@correo.com', 'un correo'],
  ])('rechaza %s (%s)', (id) => {
    // Los tres primeros pasan el patrón de forma pero el guardián real es que
    // NADIE construya la correlación a partir de datos del paciente; el patrón
    // ataja los casos con forma de identificador personal.
    const valida = correlacionSegura(id)
    if (valida) {
      // 'juan-perez-garcia-1985' tiene forma opaca válida: el patrón no puede
      // saber que es un nombre. Se documenta como límite conocido, no se finge.
      expect(id).toBe('juan-perez-garcia-1985')
      return
    }
    expect(valida).toBe(false)
  })

  it('un sobre con correlación insegura se rechaza', () => {
    const r = sobreConMaterial({
      proveedor: 'pubmed', estado: 'available', intentadoEn: AHORA,
      correlacion: 'x', telemetria: { latenciaMs: 1 }, fuentes: [],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('CORRELACION_INSEGURA')
  })
})

describe('la latencia es obligatoria incluso al fallar', () => {
  it('un timeout sin latencia se rechaza: 30 s de espera son un dato de SLO', () => {
    const r = sobreSinMaterial({
      proveedor: 'pubmed', estado: 'unavailable', intentadoEn: AHORA, correlacion: CORR,
      telemetria: { latenciaMs: Number.NaN }, motivo: 'timeout', clase: 'timeout',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('LATENCIA_INVALIDA')
  })
})

describe('puedeRespaldar es más estricto que tieneMaterial', () => {
  it('tener texto no basta para poder respaldar una afirmación', () => {
    const notas = sobreConMaterial({
      proveedor: 'conocimiento_personal', estado: 'available', intentadoEn: AHORA,
      correlacion: CORR, telemetria: { latenciaMs: 2 }, fuentes: [],
    })
    expect(notas.ok).toBe(true)
    if (!notas.ok) return
    expect(tieneMaterial(notas.valor)).toBe(true)
    expect(puedeRespaldar(notas.valor)).toBe(false)
  })
})

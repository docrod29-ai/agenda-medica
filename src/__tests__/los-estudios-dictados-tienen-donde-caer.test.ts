/**
 * LOS ESTUDIOS DICTADOS TIENEN DÓNDE CAER: `estudiosSolicitados`, ESTRUCTURADO.
 *
 * Panel de Lujo (sep-2026), ortopedista: MO-004 (P2, confirmado). La parte de
 * EXTRACCIÓN es de PROMPTS-ASR; poblar `estudiosOrden` en la consulta antes de
 * firmar es handoff a CONSULTA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * «Solicito radiografía AP y lateral de tobillo izquierdo» no llegaba a ningún
 * sitio: `RespuestaExtraccion` devolvía resumen, secciones, diagnósticos,
 * medicamentos, alergias y signos — sin estudios. `estudiosOrden` sólo lo
 * llenaba la valoración del inmunocomprometido; con receta y sin estudios, la
 * consulta iba directo a /receta y la orden se quedaba en el tintero.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * El rojo verificó que el hueco llega a producción (`aDondeIrDirecto` empuja a
 * /receta) y REFUTÓ que fuera REG-244 viva: lo que falta es aguas arriba —
 * extraer los estudios del dictado— y nunca estuvo en su alcance.
 *
 * ── LA REGLA ─────────────────────────────────────────────────────────────────
 * Región, lateralidad y proyección van aparte del nombre, con `source_quote`,
 * porque son lo que se revisa antes de firmar una orden de imagen y porque la
 * lateralidad se coteja con un motor. `soloPropuesto` separa la orden de la
 * posibilidad (ORDER_INTENT ≠ ORDER). Nunca se inventa una lateralidad.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No garantiza que el modelo llene el campo (corpus). No cubre que la consulta
 * lo consuma (`setEstudiosOrden`) ni que `queFaltaParaCerrar` devuelva receta Y
 * orden: eso es CONSULTA, con el contrato de `estudiosParaLaOrden`.
 */
import { describe, it, expect } from 'vitest'
import {
  RespuestaExtraccion, EstudioSolicitado, textoDeEstudioSolicitado, estudiosParaLaOrden,
} from '@/lib/expediente/extraction-schema'
import { buildSystemPrompt } from '@/lib/expediente/prompts'
import { estudiosSoloPropuestos } from '@/lib/asr/intencion-de-orden'

describe('MO-004 · el esquema conserva región, lateralidad y proyección', () => {
  it('EL CASO: radiografía AP y lateral de tobillo izquierdo', () => {
    const r = RespuestaExtraccion.parse({
      estudiosSolicitados: [{
        nombre: 'Radiografía', tipo: 'imagen', region: 'tobillo', lateralidad: 'izquierdo',
        proyeccion: 'AP y lateral', source_quote: 'solicito radiografía AP y lateral de tobillo izquierdo', speaker: 'medico',
      }],
    })
    expect(r.estudiosSolicitados).toHaveLength(1)
    expect(r.estudiosSolicitados[0]).toMatchObject({ region: 'tobillo', lateralidad: 'izquierdo', proyeccion: 'AP y lateral', soloPropuesto: false })
    // Crítico por defecto: se revisa antes de ir a la orden.
    expect(r.estudiosSolicitados[0].needs_review).toBe(true)
  })

  it('sin lateralidad dictada, queda vacía: nunca se rellena', () => {
    const e = EstudioSolicitado.parse({ nombre: 'Radiografía de tórax', tipo: 'imagen' })
    expect(e.lateralidad).toBe('')
    expect(() => EstudioSolicitado.parse({ nombre: 'x', lateralidad: 'ambos' })).toThrow()
  })

  it('una respuesta vieja sin el campo sigue siendo válida', () => {
    expect(RespuestaExtraccion.parse({}).estudiosSolicitados).toEqual([])
  })
})

describe('MO-004 · el renglón que va a la orden', () => {
  it('se arma con nombre, proyección, región y lado', () => {
    const e = EstudioSolicitado.parse({ nombre: 'Radiografía', proyeccion: 'AP y lateral', region: 'tobillo', lateralidad: 'izquierdo' })
    expect(textoDeEstudioSolicitado(e)).toBe('Radiografía AP y lateral de tobillo izquierdo')
    expect(textoDeEstudioSolicitado(EstudioSolicitado.parse({ nombre: 'Biometría hemática' }))).toBe('Biometría hemática')
  })

  it('lo sólo propuesto NO va a la orden: va aparte, para preguntar', () => {
    const r = estudiosParaLaOrden([
      EstudioSolicitado.parse({ nombre: 'Biometría hemática', tipo: 'laboratorio' }),
      EstudioSolicitado.parse({ nombre: 'Tomografía', region: 'abdomen', soloPropuesto: true }),
      EstudioSolicitado.parse({ nombre: 'biometría hemática' }),   // repetido, distinta caja
    ])
    expect(r.orden).toEqual(['Biometría hemática'])
    expect(r.propuestos).toEqual(['Tomografía de abdomen'])
  })

  it('y el motor determinista de intención vuelve a comprobarlo sobre el dictado', () => {
    const dictado = 'Solicito biometría hemática. Si no mejora en 48 horas pedimos tomografía de abdomen.'
    const r = estudiosParaLaOrden([EstudioSolicitado.parse({ nombre: 'Tomografía', region: 'abdomen' })])
    // El modelo no lo marcó; el motor sí lo ve como sólo propuesto.
    expect(estudiosSoloPropuestos(dictado, r.orden)).toEqual(['Tomografía de abdomen'])
  })
})

describe('MO-004 · el prompt lo pide con las mismas palabras', () => {
  const p = buildSystemPrompt('primera_vez')
  it('la regla y el JSON declaran el campo con región, lateralidad y proyección', () => {
    expect(p).toMatch(/6-quater\. LOS ESTUDIOS QUE EL MÉDICO SOLICITA van en "estudiosSolicitados"/)
    expect(p).toMatch(/"estudiosSolicitados": \[\{ "nombre": "", "tipo": "laboratorio\|imagen\|otro", "region": "", "lateralidad": "derecho\|izquierdo\|bilateral\|"/)
  })
  it('y prohíbe inventar la lateralidad del estudio', () => {
    expect(p).toMatch(/Nunca inventes la lateralidad de un estudio/)
  })
})

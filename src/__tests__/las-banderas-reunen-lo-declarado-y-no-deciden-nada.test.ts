/**
 * GUARDIÁN — el eje de banderas REÚNE lo declarado; no decide qué es un riesgo.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * El §10 del pliego del dueño manda que Patient State represente
 * longitudinalmente los RIESGOS. No existía nada: ni eje, ni proyección. Las
 * alergias vivían en un sitio, los problemas crónicos en otro y las etiquetas
 * del paciente en un tercero, y ninguna pantalla los ponía juntos.
 *
 * ── POR QUÉ ESTE GUARDIÁN VIGILA SOBRE TODO LO QUE NO SE HACE ───────────────
 *
 * El censo del programa ya traía escrito el diagnóstico del carril A: «el
 * catálogo de qué condición cuenta como bandera es POLÍTICA CLÍNICA y no está
 * decidido; lo que sí se puede hacer sin decidirla es reunir lo que YA está
 * declarado en el árbol».
 *
 * Así que el riesgo de esta unidad no es que falte una bandera: es que el
 * módulo se ponga a decidir cuáles cuentan. Estos casos existen para que eso
 * falle en rojo:
 *
 *   · **sin umbral de severidad** — filtrar por «grave o anafilaxia» es un punto
 *     de corte clínico y ninguno está validado aquí;
 *   · **sin fecha fabricada** — la etiqueta del paciente no guarda cuándo se
 *     puso, y se dice vacío en vez de rellenarlo con hoy;
 *   · **sin etiqueta sin clasificar** — la partición clínico/administrativo es
 *     exhaustiva, y una etiqueta nueva que nadie clasifique rompe el CI en vez
 *     de colarse en silencio por un lado o por el otro.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Reglas 1 y 5 de seguridad clínica: ninguna cifra ni criterio se inventa, y el
 * vocabulario se declara en el módulo. Una bandera sólo existe si alguien con
 * autoridad —el médico o el consultorio— ya la declaró, y viaja con quién lo
 * dijo y cuándo.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que las banderas sean las correctas.** No hay catálogo con
 *   el que comparar; ése es el punto.
 * · **No mide la pantalla.** Que el eje llegue al expediente se comprueba por
 *   substring, igual que en WS-09, y con la misma advertencia: es más que nada
 *   y no es una medición de punta a punta.
 * · **No cubre las otras dos partes de WS-10.banderas-y-respuesta.** Respuesta
 *   al tratamiento (el dato no existe) y compromisos (bloqueado por el sello
 *   v4) siguen abiertos, y el censo dice por qué.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PATIENT_TAG_CONFIG, type PatientTag } from '@/types'
import {
  estadoDeBanderas, avisoDeBanderasIncompletas, ETIQUETA_ES_CLINICA,
  VERSION_PROYECCION_BANDERAS,
  POR_QUE_NO_HAY_UMBRAL_DE_SEVERIDAD, POR_QUE_EL_CATALOGO_ES_DEL_DUENO,
} from '@/lib/expediente/banderas-de-riesgo'

const AHORA = '2026-08-30T12:00:00.000Z'

function alergia(alergeno: string, severidad?: 'leve' | 'moderada' | 'grave', reaccion?: string) {
  return {
    alergeno,
    registros: severidad
      ? [{ fecha: '2026-03-01T10:00:00.000Z', alergia: { alergeno, severidad, ...(reaccion ? { reaccion } : {}) } }]
      : [],
    selladaEn: '2026-03-01T10:00:00.000Z',
    desde: '2026-03-01T10:00:00.000Z',
    notasQueLaAfirman: severidad ? 1 : 0,
    enLaListaDeHoy: true,
    negadaHoy: false,
  }
}

function problema(descripcion: string, estado: 'activo' | 'cronico', codigoCIE10?: string) {
  return {
    diagnostico: { descripcion, estado, tipo: 'definitivo' as const, ...(codigoCIE10 ? { codigoCIE10 } : {}) },
    dichoEn: '2026-05-04T09:00:00.000Z',
  }
}

const SIN_NADA = { alergias: [], historialIncompleto: false }
const SIN_PROBLEMAS = { problemas: [], historialRecortado: false }

describe('reúne lo que alguien con autoridad ya declaró', () => {
  it('una alergia con severidad registrada entra, con la severidad que el médico escribió', () => {
    const e = estadoDeBanderas(
      { alergias: [alergia('penicilina', 'grave', 'edema de glotis')], historialIncompleto: false },
      SIN_PROBLEMAS, undefined, AHORA,
    )
    expect(e.banderas).toHaveLength(1)
    expect(e.banderas[0]).toMatchObject({
      origen: 'alergia_con_severidad',
      texto: 'penicilina',
      detalle: 'grave · edema de glotis',
      declaradoPor: 'nota firmada',
    })
    expect(e.banderas[0].desde).toBe('2026-03-01T10:00:00.000Z')
  })

  it('un diagnóstico que el médico marcó crónico entra; uno activo NO', () => {
    const e = estadoDeBanderas(
      SIN_NADA,
      { problemas: [problema('Diabetes mellitus tipo 2', 'cronico', 'E11'), problema('Faringitis', 'activo')], historialRecortado: false },
      undefined, AHORA,
    )
    expect(e.banderas.map(b => b.texto)).toEqual(['Diabetes mellitus tipo 2'])
    expect(e.banderas[0].detalle).toBe('E11')
  })

  it('las etiquetas CLÍNICAS entran y las administrativas no', () => {
    const e = estadoDeBanderas(SIN_NADA, SIN_PROBLEMAS,
      ['alto-riesgo', 'pendiente-pago', 'embarazo', 'requiere-factura'], AHORA)
    expect(e.banderas.map(b => b.texto)).toEqual(['Alto riesgo', 'Embarazo'])
  })

  it('el eje se declara con su versión y su instante, como las otras proyecciones', () => {
    const e = estadoDeBanderas(SIN_NADA, SIN_PROBLEMAS, undefined, AHORA)
    expect(e.asOf).toBe(AHORA)
    expect(e.version).toBe(VERSION_PROYECCION_BANDERAS)
  })
})

describe('lo que este módulo se niega a decidir', () => {
  it('NO hay umbral de severidad: una alergia leve declarada también entra', () => {
    /**
     * Éste es el caso que se pone rojo si alguien «mejora» el módulo filtrando
     * por gravedad. Ese filtro es un punto de corte clínico, y no hay ninguno
     * validado en este repositorio.
     */
    const e = estadoDeBanderas(
      { alergias: [alergia('AINE', 'leve')], historialIncompleto: false },
      SIN_PROBLEMAS, undefined, AHORA,
    )
    expect(e.banderas).toHaveLength(1)
    expect(e.banderas[0].detalle).toBe('leve')
  })

  it('una alergia SIN severidad registrada no entra — y no porque se dé por leve', () => {
    const e = estadoDeBanderas(
      { alergias: [alergia('polvo')], historialIncompleto: false },
      SIN_PROBLEMAS, undefined, AHORA,
    )
    expect(e.banderas).toHaveLength(0)
    expect(POR_QUE_NO_HAY_UMBRAL_DE_SEVERIDAD).toMatch(/no porque se dé por leve/)
  })

  it('no se fabrica la fecha de una etiqueta: la etiqueta no guarda cuándo se puso', () => {
    const e = estadoDeBanderas(SIN_NADA, SIN_PROBLEMAS, ['cronico'], AHORA)
    expect(e.banderas[0].desde).toBe('')
    expect(e.banderas[0].desde).not.toBe(AHORA)
  })

  it('el catálogo de riesgo sigue siendo del dueño, y está dicho', () => {
    expect(POR_QUE_EL_CATALOGO_ES_DEL_DUENO).toMatch(/política clínica/)
    expect(POR_QUE_EL_CATALOGO_ES_DEL_DUENO).toMatch(/cuarto origen/)
  })
})

describe('la partición de etiquetas es EXHAUSTIVA', () => {
  it('toda etiqueta del producto está clasificada — una nueva sin clasificar rompe esto', () => {
    /**
     * El modo de fallo que evita: alguien añade `PatientTag` nueva, nadie decide
     * si es clínica, y se cuela en silencio por uno de los dos lados.
     */
    const todas = Object.keys(PATIENT_TAG_CONFIG) as PatientTag[]
    const sinClasificar = todas.filter(t => typeof ETIQUETA_ES_CLINICA[t] !== 'boolean')
    expect(sinClasificar, 'etiquetas sin clasificar como clínica o administrativa').toEqual([])
    expect(todas.length).toBeGreaterThanOrEqual(13)
  })

  it('la clasificación no está vacía ni es toda que sí: sería no clasificar', () => {
    const valores = Object.values(ETIQUETA_ES_CLINICA)
    expect(valores.some(v => v === true)).toBe(true)
    expect(valores.some(v => v === false)).toBe(true)
  })
})

describe('el recorte del historial viaja, porque el silencio no es ausencia', () => {
  it('lo hereda de cualquiera de las dos proyecciones', () => {
    expect(estadoDeBanderas({ alergias: [], historialIncompleto: true }, SIN_PROBLEMAS, undefined, AHORA).historialRecortado).toBe(true)
    expect(estadoDeBanderas(SIN_NADA, { problemas: [], historialRecortado: true }, undefined, AHORA).historialRecortado).toBe(true)
    expect(estadoDeBanderas(SIN_NADA, SIN_PROBLEMAS, undefined, AHORA).historialRecortado).toBe(false)
  })

  it('el aviso sale sólo cuando hay algo que decir — uno que sale siempre deja de leerse', () => {
    expect(avisoDeBanderasIncompletas(estadoDeBanderas(SIN_NADA, SIN_PROBLEMAS, undefined, AHORA))).toBe('')
    expect(avisoDeBanderasIncompletas(estadoDeBanderas({ alergias: [], historialIncompleto: true }, SIN_PROBLEMAS, undefined, AHORA)))
      .toMatch(/recortado/)
  })
})

describe('conexión — SUBSTRING, no punta a punta (ver cabecera)', () => {
  it('el expediente construye el eje: un módulo que nadie llama no le llega a nadie', () => {
    const pagina = readFileSync('src/app/(dashboard)/expediente/[patientId]/page.tsx', 'utf8')
    expect(pagina).toContain('estadoDeBanderas')
  })
})

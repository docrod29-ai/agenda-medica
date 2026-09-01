/**
 * CONSULTORIO GOLDEN PATH #4 — sólo ambigüedad clínicamente material.
 *
 * El ASR puede conservar mucha incertidumbre para auditoría. Eso no significa
 * que el médico deba verla toda. Estas pruebas fijan la frontera de producto:
 * ruido genérico no interrumpe; una ambigüedad capaz de cambiar medicación,
 * dosis, negación, lateralidad o una orden sí llega a revisión.
 */
import { describe, expect, it } from 'vitest'
import {
  esMotivoClinicamenteMaterial,
  motivosClinicamenteMateriales,
  textosDeMotivos,
} from '@/lib/expediente/motivos-confirmacion-texto'

describe('Consultorio GP4 — filtro de ambigüedad visible', () => {
  it('una palabra de relleno con baja confianza no crea una interrupción', () => {
    const motivos = [
      'palabra_relleno_baja_confianza',
      'confianza_baja_generica',
      'proveedor_asr_alterno',
      'normalizacion_segura',
    ]

    expect(motivosClinicamenteMateriales(motivos)).toEqual([])
    expect(textosDeMotivos(motivos)).toEqual([])
  })

  it.each([
    'dos_o_mas_farmacos_plausibles',
    'dosis_o_unidad_ambigua',
    'negacion_incierta',
    'lateralidad_incierta',
    'sigla_de_modo_o_dispositivo_incierta',
    'farmaco_solo_propuesto',
    'estudio_solo_propuesto',
    'confianza_baja_con_termino_critico',
  ])('%s sí se considera clínicamente material', (motivo) => {
    expect(esMotivoClinicamenteMaterial(motivo)).toBe(true)
    expect(textosDeMotivos([motivo])).toHaveLength(1)
  })

  it('mezcla ruido y riesgo sin dejar que el ruido llegue a la interfaz', () => {
    const visibles = textosDeMotivos([
      'confianza_baja_generica',
      'dosis_o_unidad_ambigua',
      'palabra_relleno_baja_confianza',
      'negacion_incierta',
      'diarizacion_no_disponible',
    ])

    expect(visibles).toHaveLength(2)
    expect(visibles.join(' ')).toMatch(/dosis|unidad/i)
    expect(visibles.join(' ')).toMatch(/afirmó|negó/i)
    expect(visibles.join(' ')).not.toMatch(/confianza|proveedor|diariz|relleno/i)
  })

  it('un nombre de máquina desconocido no se imprime al médico', () => {
    expect(textosDeMotivos(['motivo_nuevo_sin_contrato_de_ux'])).toEqual([])
  })

  it('la UX no expone porcentajes ni nombres de proveedor en los textos materiales', () => {
    const todos = textosDeMotivos([
      'confianza_baja_con_termino_critico',
      'dos_o_mas_farmacos_plausibles',
      'dosis_o_unidad_ambigua',
      'negacion_incierta',
      'lateralidad_incierta',
      'sigla_de_modo_o_dispositivo_incierta',
      'farmaco_solo_propuesto',
      'estudio_solo_propuesto',
    ]).join(' ')

    expect(todos).not.toMatch(/AssemblyAI|Whisper|Claude|GPT|\d+%/i)
  })
})

import { describe, it, expect } from 'vitest'
import { PAPER_SIZES, detectarPaperSize, areaSegura, GUARDA_IMPRESION_MM } from '@/lib/receta-template'
import { dimensionesImpresion, paperEfectivo, admiteHojaCarta } from '@/components/RecetaDocumento'
import type { RecetaConfig } from '@/types'

/**
 * Receta continua APAISADA de 250 × 150 mm (forma continua de matriz de puntos).
 *
 * El defecto que reportó el Dr.: al imprimir, la vista previa de macOS mostraba
 * una hoja VERTICAL grande con la receta pequeña dentro. Causa: el papel se
 * "hospedaba" en carta. Una hoja más ANCHA que la carta no puede hospedarse ahí;
 * debe salir a su tamaño real, al 100 %, sin escalar.
 *
 * Esto aplica SOLO a receta y orden médica. Las notas (evolución, ingreso…) usan
 * otro camino de impresión y no deben verse afectadas.
 */

const base: RecetaConfig = {
  paperSize: 'receta-25x15',
  estilo: 'minimalista',
} as RecetaConfig

describe('papel de receta 250 × 150 mm', () => {
  it('está en el catálogo, apaisado y con su @page en mm', () => {
    const p = PAPER_SIZES['receta-25x15']
    expect(p.widthMm).toBe(250)
    expect(p.heightMm).toBe(150)
    expect(p.widthMm).toBeGreaterThan(p.heightMm)   // apaisado
    expect(p.cssPage).toBe('250mm 150mm')
  })

  it('NO se hospeda en carta ni siquiera con imprimirEn="carta" (es más ancho)', () => {
    const cfg = { ...base, imprimirEn: 'carta' as const }
    const d = dimensionesImpresion(cfg)
    expect(d.esHostCarta).toBe(false)
    expect(d.widthMm).toBe(250)
    expect(d.heightMm).toBe(150)
    expect(d.cssPage).toBe('250mm 150mm')
  })

  it('la UI no ofrece "hoja carta + corte" para este papel', () => {
    expect(admiteHojaCarta({ ...base, imprimirEn: 'carta' as const })).toBe(false)
  })

  it('el área segura descuenta la guarda en los cuatro lados (244 × 144)', () => {
    const a = areaSegura(PAPER_SIZES['receta-25x15'])
    expect(a.widthMm).toBe(250 - GUARDA_IMPRESION_MM * 2)   // 244
    expect(a.heightMm).toBe(150 - GUARDA_IMPRESION_MM * 2)  // 144
  })

  it('detecta un membrete de 250 × 150 subido en cualquier orientación', () => {
    expect(detectarPaperSize(250, 150)).toBe('receta-25x15')
    expect(detectarPaperSize(150, 250)).toBe('receta-25x15')
  })

  it('paperEfectivo respeta las dimensiones reales de un membrete custom', () => {
    const cfg = {
      ...base,
      disenoCompletoDataUrl: 'data:image/png;base64,xx',
      disenoWidthMm: 250,
      disenoHeightMm: 150,
    } as RecetaConfig
    const p = paperEfectivo(cfg)
    expect(p.widthMm).toBe(250)
    expect(p.heightMm).toBe(150)
  })
})

describe('no hay regresión en los tamaños que ya funcionaban', () => {
  it('media carta sigue hospedándose en carta con línea de corte', () => {
    const d = dimensionesImpresion({ ...base, paperSize: 'media-carta', imprimirEn: 'carta' } as RecetaConfig)
    expect(d.esHostCarta).toBe(true)
    expect(d.cssPage).toBe('letter')
  })

  it('media carta en papel-real sale a su tamaño exacto', () => {
    const d = dimensionesImpresion({ ...base, paperSize: 'media-carta', imprimirEn: 'papel-real' } as RecetaConfig)
    expect(d.esHostCarta).toBe(false)
    expect(d.widthMm).toBe(140)
    expect(d.heightMm).toBe(215)
  })

  it('carta nunca se hospeda dentro de sí misma', () => {
    const d = dimensionesImpresion({ ...base, paperSize: 'carta', imprimirEn: 'carta' } as RecetaConfig)
    expect(d.esHostCarta).toBe(false)
  })

  it('los tamaños verticales previos se siguen detectando', () => {
    expect(detectarPaperSize(140, 215)).toBe('media-carta')
    expect(detectarPaperSize(148, 210)).toBe('a5')
    expect(detectarPaperSize(216, 279)).toBe('carta')
  })
})

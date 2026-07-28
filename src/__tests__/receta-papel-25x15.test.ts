import { describe, it, expect } from 'vitest'
import { PAPER_SIZES, detectarPaperSize, areaSegura, GUARDA_IMPRESION_MM, PAPEL_NOTA, papelNota, NOTA_PAPER_SIZES, papelPersonalizado, PAPEL_MIN_MM } from '@/lib/receta-template'
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

/**
 * La receta de 13 × 23 cm existe en las DOS orientaciones porque la hoja física
 * puede estar cortada de pie o acostada, y de eso depende todo lo demás.
 */
describe('receta de 13 × 23 cm en sus dos orientaciones', () => {
  it('la VERTICAL mide 130 × 230 (es la hoja cortada a tamaño de receta)', () => {
    const p = PAPER_SIZES['receta-13x23']
    expect(p.widthMm).toBe(130)
    expect(p.heightMm).toBe(230)
    expect(p.heightMm).toBeGreaterThan(p.widthMm)
    expect(p.cssPage).toBe('130mm 230mm')
  })

  it('la ACOSTADA es la misma medida volteada (230 × 130)', () => {
    const p = PAPER_SIZES['receta-23x13']
    expect(p.widthMm).toBe(230)
    expect(p.heightMm).toBe(130)
  })

  it('la VERTICAL cabe en carta → admite el modo hoja carta + corte', () => {
    const cfg = { ...base, paperSize: 'receta-13x23', imprimirEn: 'carta' } as RecetaConfig
    expect(admiteHojaCarta(cfg)).toBe(true)
    expect(dimensionesImpresion(cfg).esHostCarta).toBe(true)
  })

  it('la VERTICAL en papel-real sale a 130 × 230 exactos', () => {
    const d = dimensionesImpresion({ ...base, paperSize: 'receta-13x23', imprimirEn: 'papel-real' } as RecetaConfig)
    expect(d.esHostCarta).toBe(false)
    expect(d.widthMm).toBe(130)
    expect(d.heightMm).toBe(230)
    expect(d.cssPage).toBe('130mm 230mm')
  })

  it('la ACOSTADA no cabe en carta (230 > 216) y nunca se hospeda', () => {
    const d = dimensionesImpresion({ ...base, paperSize: 'receta-23x13', imprimirEn: 'carta' } as RecetaConfig)
    expect(d.esHostCarta).toBe(false)
    expect(d.widthMm).toBe(230)
  })

  /**
   * La autodetección normaliza a vertical, así que NO puede distinguir la
   * orientación: 230×130 y 130×230 son el mismo papel medido de dos formas.
   * Devuelve la vertical como canónica; la orientación la decide el médico.
   */
  it('un membrete de 13 × 23 se detecta como la vertical, en cualquier orden', () => {
    expect(detectarPaperSize(130, 230)).toBe('receta-13x23')
    expect(detectarPaperSize(230, 130)).toBe('receta-13x23')
  })
})

describe('papel PERSONALIZADO (medidas escritas por el médico)', () => {
  const custom = (w?: number, h?: number) => ({
    ...base, paperSize: 'personalizado', paperCustomWidthMm: w, paperCustomHeightMm: h,
  }) as RecetaConfig

  it('usa exactamente las medidas escritas', () => {
    const p = paperEfectivo(custom(237, 127))
    expect(p.widthMm).toBe(237)
    expect(p.heightMm).toBe(127)
    expect(p.cssPage).toBe('237mm 127mm')
  })

  it('una medida inválida NO produce una hoja rota (caería en blanco sin avisar)', () => {
    for (const malo of [custom(0, 0), custom(undefined, undefined), custom(-5, 130), custom(9999, 130), custom(NaN, 130)]) {
      const p = paperEfectivo(malo)
      expect(p.widthMm).toBeGreaterThanOrEqual(PAPEL_MIN_MM)
      expect(p.heightMm).toBeGreaterThanOrEqual(PAPEL_MIN_MM)
    }
    expect(papelPersonalizado(0, 0)).toBeNull()
    expect(papelPersonalizado(230, undefined)).toBeNull()
  })

  it('un personalizado que SÍ cabe en carta sigue pudiendo hospedarse', () => {
    const d = dimensionesImpresion({ ...custom(140, 100), imprimirEn: 'carta' } as RecetaConfig)
    expect(d.esHostCarta).toBe(true)
  })

  it("'personalizado' nunca se devuelve en la autodetección", () => {
    expect(detectarPaperSize(230, 130)).not.toBe('personalizado')
  })
})

describe('receta y nota son ajustes independientes', () => {
  it('la nota viene en CARTA por defecto (sin configurar)', () => {
    expect(papelNota(undefined).widthMm).toBe(216)
    expect(papelNota(undefined).heightMm).toBe(279)
    expect(PAPEL_NOTA.cssPage).toBe('letter')
  })

  it('el médico puede cambiar el papel de la nota', () => {
    expect(papelNota('a4').widthMm).toBe(210)
    expect(papelNota('oficio').heightMm).toBe(330)
  })

  it('un valor inválido cae a carta, nunca a un tamaño raro', () => {
    expect(papelNota('receta-25x15').widthMm).toBe(216)  // apaisado NO se ofrece para notas
    expect(papelNota('basura').widthMm).toBe(216)
  })

  it('poner la receta en 25 × 15 NO mueve el papel de la nota', () => {
    const cfg = { ...base, paperSize: 'receta-25x15' } as RecetaConfig
    expect(dimensionesImpresion(cfg).widthMm).toBe(250)      // la receta cambia
    expect(papelNota(cfg.notaPaperSize).widthMm).toBe(216)   // la nota sigue en carta
  })

  it('cambiar el papel de la nota NO mueve el de la receta', () => {
    const cfg = { ...base, paperSize: 'receta-25x15', notaPaperSize: 'a4' } as RecetaConfig
    expect(papelNota(cfg.notaPaperSize).widthMm).toBe(210)   // la nota cambia
    expect(dimensionesImpresion(cfg).widthMm).toBe(250)      // la receta sigue en 25 × 15
  })

  it('a las notas solo se les ofrecen tamaños verticales de texto', () => {
    for (const k of NOTA_PAPER_SIZES) {
      const p = PAPER_SIZES[k]
      expect(p.heightMm).toBeGreaterThan(p.widthMm)
    }
  })
})

/**
 * Un diseño propio subido lleva sus propias medidas, y esas son las que se
 * imprimen. Antes eso hacía que elegir un tamaño no sirviera de nada y sin
 * explicación. Ahora el selector RE-ENCAJA el diseño al tamaño elegido, así que
 * elegir 25 × 15 imprime 25 × 15. Aquí se fija ese comportamiento.
 */
describe('el tamaño elegido manda, también con diseño subido', () => {
  const conDiseno = (w: number, h: number) => ({
    ...base,
    paperSize: 'receta-25x15',
    disenoCompletoDataUrl: 'data:image/png;base64,xx',
    disenoWidthMm: w,
    disenoHeightMm: h,
  }) as RecetaConfig

  it('un diseño A5 ignora el 25 × 15 elegido (por eso hace falta el aviso)', () => {
    const p = paperEfectivo(conDiseno(148, 210))
    expect(p.widthMm).toBe(148)
    expect(p.heightMm).toBe(210)
  })

  it('tras aplicar el tamaño elegido al diseño, ya imprime 250 × 150', () => {
    const p = paperEfectivo(conDiseno(250, 150))
    expect(p.widthMm).toBe(250)
    expect(p.heightMm).toBe(150)
    expect(dimensionesImpresion(conDiseno(250, 150)).esHostCarta).toBe(false)
  })

  /**
   * "Sale descuadrada": la hoja blanca se dibujaba con las medidas del CATÁLOGO
   * mientras el contenedor de la vista previa y el @page usaban las del DISEÑO.
   * Dos tamaños para la misma receta → contenido corrido fuera de la hoja.
   * Aquí se fija que hoja, vista previa e impresión salgan de la misma fuente.
   */
  it('la hoja, la vista previa y el @page usan la MISMA medida', () => {
    // Diseño con medidas propias que NO son las del catálogo elegido (25 × 15).
    // En papel-real no hay hospedaje, así que se ve la medida en crudo.
    const cfg = { ...conDiseno(216, 140), imprimirEn: 'papel-real' } as RecetaConfig
    const p = paperEfectivo(cfg)
    const d = dimensionesImpresion(cfg)
    expect(p.widthMm).toBe(216)
    expect(p.heightMm).toBe(140)
    // dimensionesImpresion parte de paperEfectivo, NO del catálogo:
    expect(d.widthMm).toBe(p.widthMm)
    expect(d.heightMm).toBe(p.heightMm)
    expect(d.cssPage).toBe('216mm 140mm')
  })
})

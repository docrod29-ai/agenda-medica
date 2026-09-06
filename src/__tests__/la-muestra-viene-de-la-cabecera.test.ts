/**
 * GOLDEN — REG-604. La muestra sale de la hoja, no sólo del nombre del renglón.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * REG-601 cerró el defecto de que «Glucosa urinaria» cayera en la serie de la
 * glucosa sérica: la muestra se decide sobre el nombre del renglón. Y dejó
 * declarado, con todas las letras, lo que esa regla NO podía resolver:
 *
 *     Una hoja que pone «Examen general de orina» en la cabecera y luego escribe
 *     «Glucosa» a secas sigue cayendo en la serie de suero.
 *
 * Es el caso normal de un examen general de orina: los renglones se llaman igual
 * que los de una química sanguínea, y lo que los distingue está arriba.
 *
 * Una glucosuria de 250 archivada como glucemia es una urgencia diabética que
 * nadie tuvo. Una glucosa de LCR de 35 —hipoglucorraquia, meningitis
 * bacteriana— archivada como glucemia es una cifra baja sin importancia.
 *
 * ── LA REGLA QUE HACE SEGURO EL CAMPO NUEVO ─────────────────────────────────
 *
 * El campo **sólo rellena el hueco. Nunca contradice.**
 *
 * Si el nombre del renglón nombra una muestra, ésa manda y el campo no puede
 * cambiarla. El campo decide sólo cuando el nombre calla.
 *
 * Es monótono a propósito: puede AÑADIR información donde no había, nunca
 * quitarla ni darle la vuelta. Un campo capaz de contradecir al nombre
 * convertiría un error de lectura del modelo en una glucosa urinaria archivada
 * como glucemia — o sea, reabriría por la puerta de atrás justo el defecto que
 * REG-601 vino a cerrar.
 *
 * ── Y NO ROMPE EL FOSO DE «SÓLO TRANSCRIBE» ─────────────────────────────────
 *
 * La muestra está IMPRESA en el documento, igual que la unidad o la fecha.
 * Pedirla es transcribir. Lo que el prompt prohíbe con todas las letras es
 * DEDUCIRLA —del analito, del valor, de las unidades—: si no está escrita, se
 * devuelve vacía y manda el nombre del renglón, como antes.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **No comprueba que el modelo lo lea bien.** Comprueba que el prompt lo pida
 *    como transcripción y que el código trate la respuesta con desconfianza. Lo
 *    otro necesita imágenes y llamadas de API — la mitad que sigue pendiente.
 *  · **No hay campo de confianza** (§32): «la hoja no lo dijo» y «el modelo no lo
 *    leyó» siguen llegando igual, como muestra vacía.
 *  · **La muestra es por RENGLÓN, no por hoja.** Una hoja mixta —química y orina
 *    en el mismo papel— depende de que cada renglón traiga la suya.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validarPanel } from '@/lib/expediente/laboratorio/extraccion'
import { analitoDe, especimenDe, especimenDeclarado } from '@/lib/expediente/laboratorio/analitos'
import { LAB_VISION_SYSTEM, buildLabVisionPrompt } from '@/lib/expediente/laboratorio/vision'

const RAIZ = process.cwd()

describe('EL CASO QUE FALTABA — la cabecera manda cuando el renglón calla', () => {
  it('«Glucosa» de una hoja de orina ya NO cae en la glucemia', () => {
    const p = validarPanel({
      fecha: '2026-09-02',
      filas: [{ estudio: 'Glucosa', valor: '250', unidad: 'mg/dL', muestra: 'orina' }],
    })
    expect(p.resultados[0].clave).toBe('glucosaUrinaria')
    expect(p.resultados[0].clave).not.toBe('glucosa')
  })

  it('ni la de un LCR, que es la que más engaña', () => {
    /**
     * Una glucosa de LCR de 35 es hipoglucorraquia —meningitis bacteriana hasta
     * que se demuestre lo contrario—. En la serie de glucemia es una cifra baja
     * sin ninguna importancia.
     */
    const p = validarPanel({
      fecha: '2026-09-02',
      filas: [{ estudio: 'Glucosa', valor: '35', unidad: 'mg/dL', muestra: 'lcr' }],
    })
    expect(p.resultados[0].clave).toBe('lcrGlucosa')
  })

  it('y sin el campo, todo sigue exactamente como antes', () => {
    // Contraprueba: el campo AÑADE. Su ausencia no cambia nada.
    expect(analitoDe('Glucosa', 'mg/dL')!.clave).toBe('glucosa')
    expect(especimenDe('Glucosa')).toBe('suero')
    expect(especimenDe('Glucosa urinaria')).toBe('orina')
  })
})

describe('EL CAMPO NUNCA CONTRADICE AL RENGLÓN', () => {
  it('si el nombre dice orina y el campo dice suero, gana el nombre', () => {
    /**
     * La regla que impide que un error de lectura del modelo reabra el defecto de
     * REG-601. El nombre impreso en el renglón es la señal más específica que
     * hay; el campo puede venir de una cabecera mal leída.
     */
    expect(especimenDe('Creatinina urinaria', 'suero')).toBe('orina')
    expect(analitoDe('Creatinina urinaria', 'mg/dL', 'suero')!.clave).toBe('creatinina_orina')
  })

  it('y al revés tampoco: el nombre de suero no se vuelve orina por el campo… salvo cuando calla', () => {
    /**
     * «Creatinina» a secas NO nombra muestra, así que ahí el campo sí decide —y
     * es exactamente para lo que está—. Lo que no puede es contradecir a un
     * nombre que sí la nombra.
     */
    expect(especimenDe('Creatinina', 'orina')).toBe('orina')
    expect(especimenDe('Creatinina en orina', 'suero')).toBe('orina')
  })

  it('una muestra que no está en la lista es como si no viniera', () => {
    /**
     * El campo llega de un modelo de lenguaje: no se usa en crudo. Lo que no case
     * con la lista cerrada se ignora, y manda el nombre. Inventar una muestra
     * nueva desde una cadena libre sería confiar en el modelo para decidir dónde
     * va un dato clínico.
     */
    expect(especimenDeclarado('sangre entera del brazo izquierdo')).toBeNull()
    expect(especimenDeclarado('')).toBeNull()
    expect(especimenDeclarado(undefined)).toBeNull()
    expect(especimenDe('Glucosa', 'lo que sea')).toBe('suero')
  })

  it('la lista cerrada acepta las formas razonables y nada más', () => {
    expect(especimenDeclarado('orina')).toBe('orina')
    expect(especimenDeclarado('ORINA')).toBe('orina')
    expect(especimenDeclarado('LCR')).toBe('lcr')
    expect(especimenDeclarado('líquido pleural')).toBe('liquido')
    expect(especimenDeclarado('suero')).toBe('suero')
    expect(especimenDeclarado('orinal')).toBeNull()
  })
})

describe('EL PROMPT PIDE TRANSCRIBIR, NO DEDUCIR', () => {
  it('pide la muestra sólo si está impresa, y prohíbe deducirla', () => {
    expect(LAB_VISION_SYSTEM).toMatch(/"muestra"/)
    expect(LAB_VISION_SYSTEM).toMatch(/SÓLO si está impreso/)
    expect(LAB_VISION_SYSTEM).toMatch(/NO lo deduzcas del nombre del estudio, ni del valor/)
    expect(buildLabVisionPrompt()).toMatch(/si no lo dice, déjalo vacío/i)
  })

  it('y da la lista cerrada, no texto libre', () => {
    expect(LAB_VISION_SYSTEM).toMatch(/"suero", "orina", "lcr", "liquido"/)
  })

  it('el foso sigue en pie: sólo transcribe', () => {
    // Añadir un campo no podía aflojar la regla que sostiene todo el módulo.
    expect(LAB_VISION_SYSTEM).toMatch(/NO interpretas, NO calculas, NO deduces/)
    expect(LAB_VISION_SYSTEM).toMatch(/Si un renglón es ilegible, OMÍTELO — no inventes/)
  })

  it('y la privacidad tampoco se tocó', () => {
    expect(LAB_VISION_SYSTEM).toMatch(/NO transcribas CURP, folio/)
  })
})

describe('SOBRE EL CORPUS — dos hojas nuevas que el nombre no podía resolver', () => {
  const corpus = () => readFileSync(join(RAIZ, 'synthetic-data/laboratorio-hojas/HOJAS.jsonl'), 'utf8')
    .split('\n').filter(Boolean)
    .map(l => JSON.parse(l) as { id: string; contexto: string; filas: Parameters<typeof validarPanel>[0]['filas'] })

  it('el examen general de orina entero cae donde debe', () => {
    const hoja = corpus().find(h => h.id === 'LAB-009')!
    const p = validarPanel({ fecha: '2026-09-01', filas: hoja.filas })
    expect(p.resultados.map(r => r.clave).sort()).toEqual([
      'creatinina_orina', 'densidadUrinaria', 'glucosaUrinaria', 'phUrinario', 'proteinaUrinaria',
    ])
    expect(p.noReconocidas, 'ni un renglón fuera').toEqual([])
  })

  it('y el LCR igual', () => {
    const hoja = corpus().find(h => h.id === 'LAB-010')!
    const p = validarPanel({ fecha: '2026-09-01', filas: hoja.filas })
    expect(p.resultados.map(r => r.clave).sort()).toEqual(['lcrGlucosa', 'lcrLeucocitos', 'lcrProteinas'])
  })

  it('el pH urinario entra, y eso destapó una cautela mal puesta', () => {
    /**
     * REG-601 descartaba el nombre pelado de menos de tres caracteres, para que
     * un patrón de dos letras no casara con demasiado. Y dejaba fuera el pH
     * urinario, que es un renglón de verdad de cualquier examen general de orina.
     *
     * Aquel riesgo no existía aquí: el pelado sólo se consulta DESPUÉS del filtro
     * de muestra, o sea entre los doce analitos de orina, donde «ph» identifica
     * sin ambigüedad. La cautela estaba puesta contra un peligro que la capa de
     * al lado ya había quitado.
     */
    expect(analitoDe('pH', 'pH', 'orina')!.clave).toBe('phUrinario')
    // Y en suero sigue sin resolver: «pH arterial» y «pH venoso» son distintos y
    // no se adivina cuál es.
    expect(analitoDe('pH', 'pH')).toBeNull()
  })

  it('las hojas nuevas dicen POR QUÉ existen', () => {
    for (const id of ['LAB-009', 'LAB-010']) {
      const h = corpus().find(x => x.id === id)!
      expect(h.contexto.length, id).toBeGreaterThan(60)
      expect(h.contexto, id).toMatch(/cabecera/)
    }
  })
})

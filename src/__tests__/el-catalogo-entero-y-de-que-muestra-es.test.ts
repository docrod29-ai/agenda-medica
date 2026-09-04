/**
 * GOLDEN — REG-453. El catálogo entero, y el defecto vivo que apareció al cargarlo.
 *
 * ── EL DEFECTO, QUE YA ESTABA PASANDO ────────────────────────────────────────
 *
 * Medido el 2-sep-2026, ANTES de tocar nada, con el catálogo de 32 analitos que
 * había:
 *
 *     «Glucosa urinaria»    → serie de glucosa SÉRICA
 *     «LCR glucosa»         → serie de glucosa SÉRICA
 *     «Sodio urinario»      → serie de sodio SÉRICO
 *     «LCR leucocitos»      → serie de leucocitos en SANGRE
 *     «Creatinina urinaria» → serie de creatinina SÉRICA
 *
 * El último **pese a que su patrón ya excluía «orina»**: la exclusión no cubría
 * «urinaria». Una defensa escrita a mano, analito por analito, y con un hueco.
 *
 * Un sodio urinario de 20 dibujado como sodio sérico se lee como una
 * hiponatremia mortal. Una glucosuria de 500, como una urgencia diabética. Y no
 * se ve: la cifra es real, el analito se llama igual, la gráfica es continua.
 *
 * ── LA REGLA QUE LO CIERRA ───────────────────────────────────────────────────
 *
 * La muestra se decide **una vez, sobre el nombre del renglón**, y no con una
 * exclusión por analito. Si el renglón nombra la orina, sólo puede casar con
 * analitos de orina — y si no hay ninguno, no casa con nada, que es lo correcto:
 * mejor sin reconocer que en la serie equivocada.
 *
 * Es el §26 del catálogo del dueño («no deben mezclarse estas cuatro capas») y
 * su §27.3 («no mapear un analito únicamente por el nombre escrito en el PDF»).
 *
 * ── POR QUÉ LOS NÚMEROS NO ESTÁN TECLEADOS ───────────────────────────────────
 *
 * 220 analitos con dos cifras cada uno. Teclearlos es una tarea mecánica larga y
 * ahí es donde se cuela el dígito cambiado: una ferritina con un cero de menos no
 * rompe nada, no falla ninguna prueba, y convierte un límite de captura en otro.
 *
 * Se leen por máquina del documento del médico dueño. La frase «estas cifras son
 * las suyas» deja de ser una promesa y pasa a ser algo que esta prueba refuta.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **La muestra se decide por RENGLÓN, no por sección.** Una hoja que pone
 *    «Química urinaria» en la cabecera y luego escribe «Glucosa» a secas sigue
 *    cayendo en la serie de suero. Cerrarlo pide el espécimen como CAMPO desde la
 *    lectura de la hoja (§27.3), que es otra unidad de trabajo.
 *  · **No valida los números del médico.** Comprueba que son los suyos y que
 *    están citados, no que sean correctos. Eso es su firma.
 *  · **Ninguno de los 187 trae LOINC** (§27.3, §35). Elegirlo no es mecánico y un
 *    código equivocado viaja al exterior dentro de un `Observation` de FHIR.
 *  · **La prosa sigue leyéndose con los 32 de siempre.** Ver abajo: es una
 *    decisión, no un olvido.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import {
  ANALITOS, ANALITOS_EN_TEXTO, CLAVES_DEL_CATALOGO, analitoDe, analitoPorClave, especimenDe,
  LO_QUE_LA_MUESTRA_NO_RESUELVE,
} from '@/lib/expediente/laboratorio/analitos'
import CATALOGO from '@/lib/expediente/laboratorio/catalogo-d032.json'

const RAIZ = process.cwd()

describe('LA MUESTRA — el defecto que estaba vivo', () => {
  it('un renglón de orina NO cae en la serie de suero', () => {
    expect(analitoDe('Glucosa urinaria', 'mg/dL')!.clave).not.toBe('glucosa')
    expect(analitoDe('Sodio urinario', 'mmol/L')!.clave).not.toBe('sodio')
    expect(analitoDe('Creatinina urinaria', 'mg/dL')!.clave).not.toBe('creatinina')
  })

  it('ni uno de LCR, ni uno de otro líquido', () => {
    expect(analitoDe('LCR glucosa', 'mg/dL')!.clave).not.toBe('glucosa')
    expect(analitoDe('LCR leucocitos', 'células/µL')!.clave).not.toBe('leucocitos')
    expect(analitoDe('Glucosa en líquido', 'mg/dL')!.clave).not.toBe('glucosa')
  })

  it('y el de suero sigue siendo el de suero', () => {
    /**
     * La contraprueba. Si la regla de muestra rompiera el caso normal, habría
     * cambiado un defecto por otro peor: todas las series vacías.
     */
    expect(analitoDe('Glucosa', 'mg/dL')!.clave).toBe('glucosa')
    expect(analitoDe('Creatinina', 'mg/dL')!.clave).toBe('creatinina')
    expect(analitoDe('Sodio', 'mEq/L')!.clave).toBe('sodio')
    expect(especimenDe('Glucosa')).toBe('suero')
  })

  it('dentro de su muestra, el nombre pelado ya no es ambiguo', () => {
    /**
     * «Creatinina en orina» no casaba con nada antes. Ahora sí: el filtro de
     * espécimen ya corrió, así que ahí «creatinina» a secas identifica sin riesgo.
     */
    expect(analitoDe('Creatinina en orina', 'mg/dL')!.clave).toBe('creatinina_orina')
  })

  it('el nombre pelado NO vive en `patron`, y eso tiene motivo', () => {
    /**
     * ── EL PIE DE BANCO QUE CACÉ, Y ME LO CACÓ UNA PRUEBA DE UCI ─────────────
     *
     * Al principio metí el nombre pelado dentro de `patron`. Hay TRES sitios que
     * recorren analitos mirando `patron` a pelo sobre texto libre, sin pasar por
     * `analitoDe` — o sea, sin el filtro de muestra. Con «glucosa» ahí dentro, un
     * «glucosa» dictado en el pase de UCI casaba con la glucosa de LCR.
     *
     * Un patrón que sólo es seguro detrás de un filtro no puede vivir donde se
     * lee sin el filtro. Va en `patronEnSuMuestra` y `analitoDe` lo consulta
     * DESPUÉS de decidir la muestra.
     */
    const sinPelado: string[] = []
    for (const a of ANALITOS) {
      if (a.especimen === 'suero') continue
      if (!a.patronEnSuMuestra) sinPelado.push(a.clave)
      // El pelado no puede estar en el patrón general: ahí sería una trampa.
      expect(a.patron.test('glucosa'), a.clave).toBe(false)
    }
    /**
     * El único sin nombre pelado es `pH urinario`: quitarle «urinario» deja
     * «pH», dos caracteres. Un patrón de dos letras casa con demasiado, así que
     * el constructor lo descarta a propósito. Esa hoja tendrá que escribir «pH
     * urinario» entero, y eso es señalar de menos y declararlo.
     */
    expect(sinPelado).toEqual(['phUrinario'])
  })

  it('la prosa se sigue leyendo con los 32 de siempre, y se declara', () => {
    /**
     * Buscar cifras en PROSA es otro problema y falla distinto: en una hoja, un
     * renglón que dice «Ferritina» es una ferritina; en un dictado, «ratio»,
     * «bandas», «pH» o «s» aparecen sin ser un resultado. Meter 219 nombres en
     * la lectura de prosa es un cambio que nadie pidió y que nadie midió.
     */
    expect(ANALITOS_EN_TEXTO.length).toBe(32)
    expect(ANALITOS.length).toBeGreaterThan(200)
    for (const a of ANALITOS_EN_TEXTO) expect(a.especimen).toBe('suero')
    const uci = readFileSync(join(RAIZ, 'src/lib/uci/labs-nota.ts'), 'utf8')
    expect(uci).toMatch(/ANALITOS_EN_TEXTO\.find/)
  })

  it('lo que la muestra NO resuelve queda dicho', () => {
    expect(LO_QUE_LA_MUESTRA_NO_RESUELVE).toMatch(/por RENGLÓN/)
    expect(LO_QUE_LA_MUESTRA_NO_RESUELVE).toMatch(/§27\.3/)
  })
})

describe('LOS NÚMEROS SON LOS DEL DOCUMENTO, y se puede refutar', () => {
  it('el JSON derivado está al día con el documento', () => {
    /**
     * Si alguien edita el documento del dueño y no regenera, o edita el JSON a
     * mano, esto se pone rojo. Es la misma mecánica que el tablero derivado.
     */
    const salida = execFileSync('node', ['scripts/laboratorio/catalogo-d032.mjs', '--verificar'], {
      cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })
    expect(salida).toMatch(/Catálogo al día/)
  })

  it('cada analito generado lleva EXACTAMENTE las cifras de su fila', () => {
    /**
     * El invariante que hace falsable «no tecleé ninguna cifra». Se comprueba
     * uno por uno contra el JSON, que a su vez se comprueba contra el documento.
     */
    type Fila = { nombre: string; unidad: string; min: number; max: number }
    const porNombre = new Map((CATALOGO.filas as Fila[]).map(f => [f.nombre, f]))
    let comprobados = 0
    for (const a of ANALITOS) {
      if (!CLAVES_DEL_CATALOGO.has(a.clave)) continue
      const fila = porNombre.get(a.etiqueta)
      expect(fila, `«${a.etiqueta}» no está en el documento`).toBeDefined()
      expect(a.unidad, a.clave).toBe(fila!.unidad)
      expect(a.min, a.clave).toBe(fila!.min)
      expect(a.max, a.clave).toBe(fila!.max)
      comprobados += 1
    }
    expect(comprobados).toBeGreaterThan(180)
  })

  it('y NINGUNO trae banda de referencia inventada', () => {
    // §1: el intervalo de referencia lo pone el laboratorio, no este archivo.
    for (const a of ANALITOS) {
      if (!CLAVES_DEL_CATALOGO.has(a.clave)) continue
      expect(a.refMin, a.clave).toBeUndefined()
      expect(a.refMax, a.clave).toBeUndefined()
    }
  })

  it('el documento no se contradice, y si lo hiciera NO se elegiría una', () => {
    /**
     * Repite doce analitos entre secciones —la LDH está en hígado y en
     * hemólisis— y las cifras coinciden en los doce. El script lo comprueba y
     * falla si divergen; el módulo revienta al cargarse. Un catálogo que se
     * contradice no se resuelve por descarte: se le pregunta al dueño.
     */
    const modulo = readFileSync(join(RAIZ, 'src/lib/expediente/laboratorio/analitos.ts'), 'utf8')
    expect(modulo).toMatch(/se contradice en/)
    expect(modulo).toMatch(/no se elige una/)
    const script = readFileSync(join(RAIZ, 'scripts/laboratorio/catalogo-d032.mjs'), 'utf8')
    expect(script).toMatch(/se contradice a sí mismo/)
  })

  it('ninguna clave está repetida', () => {
    const claves = ANALITOS.map(a => a.clave)
    expect(claves.length - new Set(claves).size, 'claves duplicadas').toBe(0)
  })

  it('los 32 escritos a mano conservan SUS rangos, más estrechos', () => {
    /**
     * El catálogo del dueño ensancha los que ya existían: la glucosa va de 1 a
     * 3000 donde aquí hay 20 a 1500. No se adoptaron, y no por descuido: sin
     * `MISSING_UNIT` (§33), una glucosa de 7,2 SIN unidad pasaría como 7,2 mg/dL.
     * Mientras el hueco de la unidad ausente siga abierto, el rango estrecho es
     * la única defensa. Hay guardián en REG-450 y éste lo repite desde el otro
     * lado: el catálogo entero cargado NO tocó estos números.
     */
    expect(analitoPorClave('glucosa')!.min).toBe(20)
    expect(analitoPorClave('glucosa')!.max).toBe(1500)
    expect(analitoPorClave('sodio')!.unidad).toBe('mEq/L')   // el documento dice mmol/L
  })
})

describe('NO SE CREÓ UNA SEGUNDA CLAVE PARA LO MISMO', () => {
  it('la creatinina urinaria reusa la clave que el vocabulario ya tenía', () => {
    /**
     * `creatinina_orina` nació en E1-02 como concepto sin analito detrás. El
     * catálogo del dueño trae la creatinina urinaria de verdad — y en vez de
     * `creatininaUrinaria`, se reusa la clave que llevaba meses escrita, con sus
     * sinónimos declarados y su pregunta abierta al médico.
     */
    expect(analitoPorClave('creatinina_orina')).not.toBeNull()
    expect(analitoPorClave('creatininaUrinaria')).toBeNull()
    expect(analitoPorClave('creatinina_orina')!.especimen).toBe('orina')
  })
})

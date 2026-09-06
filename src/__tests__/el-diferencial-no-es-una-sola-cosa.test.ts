/**
 * GOLDEN — REG-598. Los analitos que faltaban, con los números del médico.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-597 midió y salió rojo: 7 de 46 filas de hoja de laboratorio no llegaban
 * al panel — 15,2 % contra un techo del 5 %. **Seis de las siete eran cobertura
 * del catálogo**: ácido úrico, ferritina, vitamina D, VCM, neutrófilos y
 * linfocitos no existían en `analitos.ts`, que cubría 24 analitos, y una hoja de
 * rutina de un laboratorio mexicano trae más.
 *
 * No se pudo arreglar ese mismo día porque un analito necesita su **rango
 * plausible**, y un rango plausible es una cifra clínica: la regla 1 prohíbe
 * inventarla.
 *
 * ── CÓMO SE RESOLVIÓ ─────────────────────────────────────────────────────────
 *
 * El médico dueño entregó el 2-sep-2026 un catálogo maestro de plausibilidad
 * (D-045), que vive íntegro en
 * `docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md`. Los ocho números salen
 * de su §31, citado. **No se arregló el umbral: se arregló la causa.**
 *
 * ── EL HALLAZGO QUE TRAÍA SU DOCUMENTO ───────────────────────────────────────
 *
 * Su §25.2 dice algo que este código no sabía: **el diferencial leucocitario no
 * es una sola entidad.**
 *
 *     «Neutrófilos 75 %» y «Neutrófilos 7.5 ×10³/µL» son resultados DISTINTOS.
 *
 * Y el nombre impreso en la hoja es **el mismo**. `analitoDe` sólo miraba el
 * nombre, así que habría metido el 75 en la serie del absoluto. Eso no es un
 * analito perdido: es un **valor mal leído**, y ése es el eje que el propio
 * médico puso en CERO el día anterior (D-044).
 *
 * O sea que añadir el diferencial sin mirar la unidad habría cambiado un defecto
 * declarado —una fila que se conserva como texto— por uno silencioso con la
 * forma correcta. Peor que no añadirlo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Cuando el nombre no basta, **la unidad decide**. Y si no viene unidad, **no se
 * adivina**: `analitoDe` devuelve `null` y la fila se conserva como texto en
 * `noReconocidas`. Señalar de menos y declararlo (seguridad clínica §5) es
 * preferible a colocar un número en la serie equivocada.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **No valida los números del médico.** Comprueba que son los suyos y que
 *    están citados, no que sean correctos. Eso es su firma, no la nuestra.
 *  · **Sin `refMin`/`refMax` a propósito.** El §1 de su catálogo dice que el
 *    intervalo de referencia lo pone el laboratorio, con su método, sexo, edad y
 *    población. Estos ocho analitos entran sin banda de referencia.
 *  · **No arregla la glucosa en mmol/L.** Ese analito ya estaba; lo tira el rango
 *    plausible. Pide normalización de unidad (§27 del catálogo), que es otra
 *    unidad de trabajo y otra decisión.
 *  · **No carga el catálogo entero.** El documento trae ~200 analitos y este
 *    cambio mete OCHO. Los demás siguen sin vigilarse, que no es lo mismo que
 *    estar bien.
 *  · **No adopta los rangos NUEVOS de los analitos que ya existían.** Su
 *    catálogo los ensancha (glucosa 1–3000 donde hoy hay 20–1500), y ensanchar
 *    sin normalizar la unidad haría que 7,2 mmol/L pasara como 7,2 mg/dL: un
 *    valor imposible aceptado en silencio. Se comprueba abajo que NO se hizo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ANALITOS, analitoDe, analitoPorClave, valorPlausible } from '@/lib/expediente/laboratorio/analitos'
import { validarPanel } from '@/lib/expediente/laboratorio/extraccion'

const RAIZ = process.cwd()
const CATALOGO = join(RAIZ, 'docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md')

describe('LOS OCHO ANALITOS, CON LOS NÚMEROS DEL MÉDICO', () => {
  /** Exactamente el §31 del catálogo del dueño. Si cambia allí, cambia aquí. */
  const D032: readonly { clave: string; unidad: string; min: number; max: number }[] = [
    { clave: 'acidoUrico', unidad: 'mg/dL', min: 0.1, max: 40 },
    { clave: 'ferritina', unidad: 'ng/mL', min: 0.1, max: 1000000 },
    { clave: 'vitaminaD', unidad: 'ng/mL', min: 0.1, max: 500 },
    { clave: 'vcm', unidad: 'fL', min: 30, max: 200 },
    { clave: 'neutrofilosAbs', unidad: '10³/µL', min: 0, max: 500 },
    { clave: 'linfocitosAbs', unidad: '10³/µL', min: 0, max: 500 },
    { clave: 'neutrofilosPct', unidad: '%', min: 0, max: 100 },
    { clave: 'linfocitosPct', unidad: '%', min: 0, max: 100 },
  ]

  it.each(D032)('$clave entra con el rango exacto de D-045', ({ clave, unidad, min, max }) => {
    const a = analitoPorClave(clave)
    expect(a, `falta ${clave}`).not.toBeNull()
    expect(a!.unidad).toBe(unidad)
    expect(a!.min).toBe(min)
    expect(a!.max).toBe(max)
  })

  it('y NINGUNO trae banda de referencia', () => {
    /**
     * El §1 del catálogo: el intervalo de referencia lo pone el laboratorio, con
     * su método, sexo, edad, embarazo y población. Pintar una banda inventada en
     * la gráfica sería exactamente lo que ese documento prohíbe, y saldría con
     * aspecto de venir de él.
     */
    for (const { clave } of D032) {
      const a = analitoPorClave(clave)!
      expect(a.refMin, clave).toBeUndefined()
      expect(a.refMax, clave).toBeUndefined()
    }
  })

  it('el documento está en el repositorio y dice de quién es', () => {
    /**
     * Un número sin fuente es una preferencia disfrazada. Si el documento
     * desaparece, esto se pone rojo y los ocho rangos se quedan sin respaldo.
     */
    const doc = readFileSync(CATALOGO, 'utf8')
    expect(doc).toMatch(/Dr\. David Alonso Rodríguez Luna/)
    expect(doc).toMatch(/D-045/)
    expect(doc).toMatch(/Plausibility ≠ normalidad ≠ valor crítico ≠ decisión clínica/)
    // Y los ocho números del §31 están ahí, no sólo en el código.
    for (const { clave, max } of D032) {
      expect(doc, clave).toMatch(new RegExp(String(max).replace(/(\d)(?=(\d{3})+$)/g, '$1[  ]?')))
    }
  })

  it('el módulo CITA el documento, no se lo apropia', () => {
    const modulo = readFileSync(join(RAIZ, 'src/lib/expediente/laboratorio/analitos.ts'), 'utf8')
    expect(modulo).toMatch(/CATALOGO-PLAUSIBILIDAD-LABORATORIO/)
    expect(modulo).toMatch(/D-045/)
    expect(modulo).toMatch(/NO se inventaron/)
  })
})

describe('§25.2 — EL DIFERENCIAL NO ES UNA SOLA COSA', () => {
  it('NINGUNA de las dos claves es la palabra desnuda', () => {
    /**
     * Si una se llamara `neutrofilos`, esa palabra tendría dueño — y la hoja que
     * imprime «Neutrófilos» no dice cuál de las dos es. Los nombres salen del
     * propio §25.2: `neutrophils_percent` / `neutrophils_absolute`.
     */
    const claves = ANALITOS.map(a => a.clave)
    expect(claves).not.toContain('neutrofilos')
    expect(claves).not.toContain('linfocitos')
    expect(claves).toContain('neutrofilosPct')
    expect(claves).toContain('neutrofilosAbs')
  })

  it('«Neutrófilos» con % es el porcentaje', () => {
    expect(analitoDe('Neutrófilos', '%')!.clave).toBe('neutrofilosPct')
    expect(analitoDe('Linfocitos', '%')!.clave).toBe('linfocitosPct')
  })

  it('«Neutrófilos» con 10³/µL es el absoluto — MISMO nombre, otra serie', () => {
    /**
     * Éste es el defecto que el documento del médico evitó. Con sólo el nombre,
     * 75 y 7,5 caían en la misma serie temporal y la gráfica mezclaba escalas.
     */
    expect(analitoDe('Neutrófilos', '10³/µL')!.clave).toBe('neutrofilosAbs')
    expect(analitoDe('Linfocitos', '10³/µL')!.clave).toBe('linfocitosAbs')
    expect(analitoDe('Neutrófilos', 'células/µL')!.clave).toBe('neutrofilosAbs')
  })

  it('SIN unidad no se adivina: la fila se conserva como texto', () => {
    /**
     * Señalar de menos y declararlo. Un 75 colocado en la serie del absoluto es
     * un valor mal leído —el eje que el médico puso en CERO— y no se ve, porque
     * tiene la forma correcta.
     */
    expect(analitoDe('Neutrófilos')).toBeNull()
    expect(analitoDe('Linfocitos', '')).toBeNull()

    const panel = validarPanel({
      fecha: '2026-09-02',
      filas: [{ estudio: 'Neutrófilos', valor: '75' }],
    })
    expect(panel.resultados).toEqual([])
    expect(panel.noReconocidas[0].estudio).toBe('Neutrófilos')
  })

  it('el 75 % NUNCA cae en la serie del absoluto', () => {
    /**
     * La prueba que define este cambio, dicha del lado del panel y no del mapeo.
     * Si alguien quita `exigeUnidad`, el primer analito que case por nombre gana
     * y esto se pone rojo.
     */
    const panel = validarPanel({
      fecha: '2026-09-02',
      filas: [
        { estudio: 'Neutrófilos', valor: '75', unidad: '%' },
        { estudio: 'Neutrófilos absolutos', valor: '7.5', unidad: '10³/µL' },
      ],
    })
    const pct = panel.resultados.find(r => r.clave === 'neutrofilosPct')
    const abs = panel.resultados.find(r => r.clave === 'neutrofilosAbs')
    expect(pct?.valor, 'el porcentaje se fue a otra serie').toBe(75)
    expect(abs?.valor, 'el absoluto se fue a otra serie').toBe(7.5)
  })

  it('y los rangos NO son intercambiables: 75 no es un absoluto plausible… ', () => {
    /**
     * Ojo: 75 SÍ está dentro de 0–500, así que el rango plausible NO habría
     * cazado la confusión. Por eso hizo falta la unidad y no bastaba con los
     * límites: un neutrófilo absoluto de 75 ×10³/µL es una leucocitosis brutal,
     * pero es creíble — el catálogo llega a 500 a propósito (§30).
     */
    expect(valorPlausible('neutrofilosAbs', 75)).toBe(true)
    expect(valorPlausible('neutrofilosPct', 75)).toBe(true)
    // El rango no distingue. La unidad sí. Ésa es toda la lección.
    expect(analitoDe('Neutrófilos', '%')!.clave)
      .not.toBe(analitoDe('Neutrófilos', '10³/µL')!.clave)
  })
})

describe('LO QUE NO SE TOCÓ, Y POR QUÉ', () => {
  it('los rangos de los analitos que YA existían siguen igual', () => {
    /**
     * El catálogo del médico los ensancha —glucosa 1–3000 donde aquí hay
     * 20–1500—. Adoptarlos hoy, SIN normalizar la unidad, haría que una glucosa
     * de 7,2 mmol/L pasara como 7,2 mg/dL: un valor imposible, aceptado en
     * silencio, con la forma correcta. Sería cambiar un defecto declarado por
     * uno invisible.
     *
     * Su §28 lo dice: primero se normaliza la unidad, DESPUÉS se comprueba la
     * plausibilidad. Mientras no exista ese paso, los rangos estrechos son la
     * única defensa que queda.
     */
    expect(analitoPorClave('glucosa')!.min).toBe(20)
    expect(analitoPorClave('glucosa')!.max).toBe(1500)
    expect(valorPlausible('glucosa', 7.2), 'una glucosa de 7,2 mg/dL no es posible').toBe(false)
  })

  it('el catálogo entero YA está cargado (REG-601)', () => {
    /**
     * ── LA PREMISA CAMBIÓ, Y EN VEINTICUATRO HORAS ───────────────────────────
     *
     * Cuando se escribió esto, el documento traía ~200 analitos y aquí había
     * ocho: se comprobaba que el hueco estuviera DECLARADO, porque un vocabulario
     * es vocabulario y lo que falta no se vigila.
     *
     * REG-601 lo cargó entero, leído por máquina del propio documento. Se
     * comprueba lo contrario: que no falte ninguna fila. Si el dueño añade
     * analitos a su catálogo y nadie regenera, esto se pone rojo.
     */
    const doc = readFileSync(CATALOGO, 'utf8')
    const filasDelDoc = doc.split('\n').filter(l => /^\| [A-ZÁÉÍÓÚa-z]/.test(l)).length
    expect(filasDelDoc).toBeGreaterThan(150)
    expect(ANALITOS.length).toBeGreaterThan(200)
  })
})

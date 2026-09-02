/**
 * GOLDEN — REG-451. Primero se normaliza la unidad; después se juzga el número.
 *
 * ── QUÉ FALLABA, Y ERAN DOS COSAS ────────────────────────────────────────────
 *
 * **1. El valor correcto en otra unidad desaparecía.** El validador tenía una
 * sola respuesta para dos preguntas: si el número no era plausible en la unidad
 * convencional, la fila salía del panel. Bien para un disparate; mal para una
 * glucosa de 7,2 mmol/L, que es una glucosa normal reportada en el sistema
 * internacional. El paciente cuyo laboratorio reporta en SI se quedaba sin serie
 * y sin aviso — y eso se ve como una gráfica corta, que es como no verse.
 *
 * **2. Y el peor, que nadie había mirado: el valor equivocado que SÍ es
 * plausible.** Lo encontró la misma medición, en la hoja LAB-008:
 *
 *     PCR 84 mg/dL. La unidad canónica es mg/L. 84 mg/dL son 840 mg/L.
 *
 * 84 es un valor perfectamente plausible en mg/L (el rango es 0–600), así que el
 * límite de plausibilidad **no lo caza y no puede cazarlo**. Entraba a la serie
 * temporal como un 84 al lado de valores en mg/L: una PCR de sepsis dibujada
 * como una PCR de resfriado, en la misma gráfica, sin una marca.
 *
 * El primer defecto se ve. El segundo no, y por eso es el caro.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Al medir el corpus después de meter la normalización de unidad. Yo iba a por
 * la glucosa; la PCR salió sola en la misma lista. La glucosa era el caso que
 * sabíamos, la PCR es el que estaba pasando.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * El §28 del catálogo del médico dueño fija el ORDEN: normalizar la unidad
 * primero, comprobar la plausibilidad después. Y su §1 fija la salida: fuera de
 * rango se **acepta provisionalmente** y se marca; nunca truncar, nunca
 * sustituir, nunca corregir en silencio, y conservar siempre valor y unidad
 * originales (§27.1).
 *
 * Un límite de plausibilidad compara magnitudes. La unidad no es una magnitud:
 * es lo que dice qué significa la magnitud. Por eso ningún rango, por estrecho
 * que sea, puede sustituir a mirar la unidad.
 *
 * ── LO QUE ESTA PRUEBA **NO** CUBRE ──────────────────────────────────────────
 *
 *  · **Sólo hay DOS conversiones.** Un factor es una equivalencia, y la regla 1
 *    las nombra: o salen de una fuente citada, o no existen. Viven las dos que
 *    el documento del dueño sostiene —vitamina D (§6, literal) y creatinina
 *    (§27.1, del ejemplo trabajado)—. La de la glucosa, que es la que abrió
 *    todo esto, **no está**: se queda en `VERIFY_UNIT` hasta que él la dé.
 *  · **No detecta el decimal desplazado** (§29). Mirar ×10, ÷10, ×100 y sugerir
 *    revisión es otra unidad de trabajo.
 *  · **No distingue «sin unidad» de «unidad canónica»**: las dos se tratan
 *    igual, como antes. Su §33 tiene `MISSING_UNIT` y todavía no está.
 *  · **No trae LOINC ni UCUM** (§27.2, §27.3). Un LOINC equivocado viaja al
 *    exterior dentro de un `Observation` de FHIR, donde otro sistema lo lee como
 *    verdad; elegirlo lo valida el médico, no yo.
 *  · **No mide la visión.** Sigue siendo el foso determinista.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validarPanel, seriesDesdeHistorial } from '@/lib/expediente/laboratorio/extraccion'
import { analitoPorClave } from '@/lib/expediente/laboratorio/analitos'
import {
  dictaminar, claveDeUnidad, CONVERSIONES, CONVERSIONES_QUE_FALTAN,
  LO_QUE_ESTA_CAPA_NO_HACE, POR_QUE_NO_SE_TIRA_LA_FILA, POR_QUE_TAN_POCAS_CONVERSIONES,
} from '@/lib/expediente/laboratorio/unidades'

const RAIZ = process.cwd()
const CATALOGO = join(RAIZ, 'docs/clinical/CATALOGO-PLAUSIBILIDAD-LABORATORIO.md')

describe('EL DEFECTO QUE NINGÚN RANGO PODÍA CAZAR — PCR en mg/dL', () => {
  it('84 mg/dL es plausible en mg/L, así que el límite NO lo distingue', () => {
    /**
     * Ésta es la prueba que justifica toda la capa. Si el rango bastara, no
     * haría falta mirar la unidad. El rango de la PCR es 0–600 mg/L y 84 cabe
     * dentro con holgura — pero 84 mg/dL son 840 mg/L.
     */
    const pcr = analitoPorClave('pcr')!
    expect(pcr.unidad).toBe('mg/L')
    expect(84 >= pcr.min && 84 <= pcr.max, 'el límite no ve nada raro').toBe(true)
  })

  it('y ahora se marca en vez de entrar a la gráfica', () => {
    const panel = validarPanel({
      fecha: '2026-09-02',
      filas: [{ estudio: 'PCR', valor: '84', unidad: 'mg/dL', referencia: '<0.5' }],
    })
    const r = panel.resultados[0]
    expect(r.estado).toBe('VERIFY_UNIT')
    expect(r.graficable, 'un 84 mg/dL en la serie de mg/L es una PCR de sepsis dibujada como un resfriado').toBe(false)
    expect(r.valorOriginal).toBe(84)
    expect(r.unidadOriginal).toBe('mg/dL')
  })

  it('AL REVÉS: si `graficable` no lo respetara, el punto falso llegaría a la serie', () => {
    /**
     * Se comprueba del lado del consumidor y no del validador: la serie temporal
     * es donde el daño ocurre. `seriesDesdeHistorial` filtra por `graficable`, y
     * ésta es la prueba de que ese filtro es el que separa las dos escalas.
     */
    const panel = validarPanel({
      fecha: '2026-09-02',
      filas: [
        { estudio: 'PCR', valor: '3', unidad: 'mg/L' },
        { estudio: 'PCR', valor: '84', unidad: 'mg/dL' },
      ],
    })
    const series = seriesDesdeHistorial([{ fecha: '2026-09-02', resultados: panel.resultados }])
    const pcr = series.find(s => s.clave === 'pcr')
    expect(pcr?.puntos.map(p => p.valor), 'sólo el que está en la unidad buena').toEqual([3])
  })
})

describe('EL ORDEN DEL §28 — normalizar, y DESPUÉS juzgar', () => {
  it('la creatinina en µmol/L se convierte con el factor CITADO', () => {
    /**
     * 80 µmol/L / 88.4 = 0,905 mg/dL. El factor no viene de fuera: reproduce el
     * ejemplo trabajado del propio §27.1 del médico (140 → 1,58).
     */
    const cr = analitoPorClave('creatinina')!
    const d = dictaminar(cr, 80, 'umol/L')
    expect(d.estado).toBe('ACCEPTED')
    expect(d.valor).toBeCloseTo(0.905, 3)
    expect(d.unidad).toBe('mg/dL')
    expect(d.graficable).toBe(true)
    // Y el ejemplo del documento, tal cual.
    expect(dictaminar(cr, 140, 'µmol/L').valor).toBeCloseTo(1.58, 2)
  })

  it('sin normalizar, ese mismo 80 parecía imposible', () => {
    // 80 mg/dL de creatinina está fuera de 0,1–25. El orden del §28 es la
    // diferencia entre convertir un valor correcto y tirarlo por raro.
    const cr = analitoPorClave('creatinina')!
    expect(80 > cr.max).toBe(true)
  })

  it('la vitamina D en nmol/L, igual, con el factor literal del §6', () => {
    const vd = analitoPorClave('vitaminaD')!
    const d = dictaminar(vd, 75, 'nmol/L')
    expect(d.estado).toBe('ACCEPTED')
    expect(d.valor).toBeCloseTo(30.05, 2)   // 75 / 2.496
    expect(d.conversion?.fuente).toMatch(/§6/)
  })

  it('el ORIGINAL nunca se pierde (§27.1)', () => {
    const d = dictaminar(analitoPorClave('creatinina')!, 80, 'umol/L')
    expect(d.valorOriginal).toBe(80)
    expect(d.unidadOriginal).toBe('umol/L')
    expect(d.conversion?.fuente).toMatch(/§27\.1/)
  })

  it('µ, μ y u son la misma unidad', () => {
    expect(claveDeUnidad('µmol/L')).toBe(claveDeUnidad('umol/L'))
    expect(claveDeUnidad('μmol/L')).toBe(claveDeUnidad('umol/L'))
    expect(claveDeUnidad(' MG/DL ')).toBe('mg/dl')
  })
})

describe('LO QUE NO SE INVENTA', () => {
  it('la glucosa en mmol/L NO se convierte: el factor no está en el catálogo', () => {
    /**
     * Es el caso que abrió todo esto y el que más apetecía cerrar. 18,0182 se
     * sabe de memoria — y por eso mismo es la clase de cifra que la regla 1
     * prohíbe escribir sin fuente: no rompe nada, no falla ninguna prueba, y sale
     * impresa con cédula profesional.
     */
    const d = dictaminar(analitoPorClave('glucosa')!, 7.2, 'mmol/L')
    expect(d.estado).toBe('VERIFY_UNIT')
    expect(d.valor, 'no se toca el número').toBe(7.2)
    expect(d.graficable).toBe(false)
    expect(d.conversion).toBeUndefined()
  })

  it('y falta declarado, con nombre', () => {
    const faltan = CONVERSIONES_QUE_FALTAN.map(c => c.analito)
    expect(faltan).toContain('glucosa')
    for (const c of CONVERSIONES_QUE_FALTAN) {
      expect(c.porQue, c.analito).toMatch(/NEEDS_CLINICAL_REVIEW/)
    }
  })

  it('TODA conversión que existe cita su fuente, y la fuente está en el documento', () => {
    /**
     * El invariante que hace falsable la frase «aquí no se inventó ningún
     * factor». Si alguien añade uno sin fuente, o con una fuente que el
     * documento no contiene, esto se pone rojo.
     */
    const doc = readFileSync(CATALOGO, 'utf8')
    let cuantas = 0
    for (const porAnalito of Object.values(CONVERSIONES)) {
      for (const conv of Object.values(porAnalito)) {
        cuantas += 1
        expect(conv.fuente).toMatch(/D-032 §/)
        expect(Number.isFinite(conv.factor) && conv.factor > 0).toBe(true)
      }
    }
    expect(cuantas, 'hoy son exactamente dos').toBe(2)
    // Las dos citas son comprobables contra el documento real.
    expect(doc).toMatch(/ng\/mL × 2\.496 ≈ nmol\/L/)
    expect(doc).toMatch(/original_unit: µmol\/L/)
    expect(doc).toMatch(/canonical_value: 1\.58/)
  })

  it('nunca se trunca ni se sustituye por el límite (§1)', () => {
    /**
     * Un valor extraordinario NO es un error (§30): una ferritina de 200 000 en
     * un HLH es verdad. Se conserva entero y se marca; no se recorta al máximo.
     */
    const fe = analitoPorClave('ferritina')!
    const d = dictaminar(fe, 2000000, 'ng/mL')
    expect(d.estado).toBe('VERIFY_VALUE_OR_UNIT')
    expect(d.valor, 'NO se recortó a max').toBe(2000000)
    expect(d.valor).not.toBe(fe.max)
    expect(d.graficable).toBe(false)
  })
})

describe('AL REVÉS POR EL OTRO LADO — no se pasa de frenada', () => {
  it('la unidad canónica pasa sin ruido', () => {
    const d = dictaminar(analitoPorClave('glucosa')!, 92, 'mg/dL')
    expect(d.estado).toBe('ACCEPTED')
    expect(d.graficable).toBe(true)
    expect(d.conversion).toBeUndefined()
  })

  it('la unidad ausente se sigue tratando como la canónica, igual que antes', () => {
    // Cambiar esto sería una decisión de producto, no un arreglo: hay pacientes
    // con series ya construidas así. Queda declarado en LO_QUE_ESTA_CAPA_NO_HACE.
    const d = dictaminar(analitoPorClave('glucosa')!, 92)
    expect(d.estado).toBe('ACCEPTED')
    expect(d.unidadOriginal).toBe('mg/dL')
  })

  it('una hoja entera en unidades canónicas no marca NADA', () => {
    /**
     * Si marcara, el médico aprendería a cerrar el aviso sin leerlo y ahí se
     * pierde la defensa entera. Es el mismo argumento con el que descartó el 2 %
     * en la voz.
     */
    const panel = validarPanel({
      fecha: '2026-09-02',
      filas: [
        { estudio: 'Glucosa', valor: '92', unidad: 'mg/dL' },
        { estudio: 'Creatinina', valor: '0.9', unidad: 'mg/dL' },
        { estudio: 'Hemoglobina', valor: '13.4', unidad: 'g/dL' },
        { estudio: 'Plaquetas', valor: '245', unidad: '10³/µL' },
      ],
    })
    expect(panel.resultados.every(r => r.estado === 'ACCEPTED')).toBe(true)
    expect(panel.resultados.every(r => r.graficable)).toBe(true)
  })
})

describe('EL DATO TIENE QUE LLEGAR — la pantalla enseña el estado', () => {
  const PANEL = () => readFileSync(join(RAIZ, 'src/components/laboratorio/PanelLaboratorios.tsx'), 'utf8')

  it('el aviso ámbar se enciende con el ESTADO, no sólo con `noEvaluable`', () => {
    /**
     * `noEvaluable` sólo se enciende cuando la unidad no cuadra con la del
     * umbral de criticidad. Una ferritina de 2 000 000 ng/mL —unidad correcta,
     * valor fuera de los límites de captura— NO lo enciende: se veía como una
     * fila normal, sin marca, y encima ya no entra a la gráfica.
     *
     * Marcado sin avisar es lo mismo que no marcado.
     */
    expect(PANEL()).toMatch(/r\.noEvaluable \|\| \(r\.estado && r\.estado !== 'ACCEPTED'\)/)
  })

  it('y el motivo es TEXTO VISIBLE, no un `title` (REG-433)', () => {
    /**
     * Un aviso que sólo existe al pasar el ratón no existe en el teléfono. Se
     * comprueba que la explicación va dentro de un `<span style={{ display:
     * 'block' …` y no colgada de un atributo `title`.
     */
    const panel = PANEL()
    expect(panel).toMatch(/No entra a la gráfica hasta que lo confirmes/)
    expect(panel).toMatch(/display: 'block', fontSize: 12/)
    // El viejo `title={r.motivoNoEvaluable}` ya no es el único canal.
    const bloque = panel.slice(panel.indexOf('r.etiqueta'), panel.indexOf('r.censurada'))
    expect(bloque).not.toMatch(/title=\{r\.motivoNoEvaluable\}/)
  })

  it('la conversión también se dice: de dónde salió el número', () => {
    // Una corrección automática que no se puede ver es una edición que alguien
    // le hizo al dato sin decírselo (seguridad clínica §3).
    expect(PANEL()).toMatch(/Convertido de \{r\.valorOriginal\} \{r\.unidadOriginal\}/)
  })
})

describe('LO QUE ESTA CAPA NO HACE, dicho a tiempo', () => {
  it('está declarado, y nombra el decimal desplazado y el LOINC', () => {
    const texto = LO_QUE_ESTA_CAPA_NO_HACE.join(' ')
    expect(texto).toMatch(/decimal desplazado/)
    expect(texto).toMatch(/MISSING_UNIT/)
    expect(texto).toMatch(/LOINC/)
    expect(LO_QUE_ESTA_CAPA_NO_HACE.length).toBeGreaterThanOrEqual(4)
  })

  it('y la política dice de quién es', () => {
    expect(POR_QUE_NO_SE_TIRA_LA_FILA).toMatch(/§1/)
    expect(POR_QUE_TAN_POCAS_CONVERSIONES).toMatch(/regla 1/)
  })
})

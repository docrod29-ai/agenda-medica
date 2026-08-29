/**
 * GOLDEN — LOS LABORATORIOS DEL PACIENTE NO LLEGABAN A LOS MOTORES.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Es REG-188 otra vez, en el eje que aquella reparación dejó fuera.
 *
 * REG-188 encontró que los motores clínicos recibían **sólo la receta de hoy** —
 * warfarina de marzo + ketorolaco de hoy no disparaba la regla de sangrado— y lo
 * arregló para la medicación y para los problemas (`cuadro-completo.ts`). Los
 * **laboratorios** siguieron igual:
 *
 *     entradaCopiloto.labs = labsDesdeEstudios(extraction.tests)
 *                            ↑ sólo lo dictado o extraído HOY
 *
 * Los paneles del paciente —creatinina, AST/ALT, plaquetas, LDL, potasio— viven
 * en `laboratorio/firestore.ts` y los leía **un solo componente**:
 * `PanelLaboratorios`, que se pinta en la pestaña de Laboratorios **de esta
 * misma pantalla**. El número estaba a la vista del médico y el motor que
 * produce el aviso no lo veía.
 *
 * ── LO QUE SE REPRODUCE AQUÍ, CON EL MOTOR REAL ─────────────────────────────
 *
 *     creatinina 2.4 mg/dL en un panel del mes pasado
 *     + hoy se prescribe metformina, sin volver a dictar la creatinina
 *     → `ajusteRenal` no corría: sin `labs.creatinina` sale por la primera línea
 *     → ni TFG estimada, ni aviso de metformina por debajo de 30
 *
 * `AJUSTE_RENAL` existe, está probada y dice qué hacer. No llegaba el número.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo WS-10 (laboratorios clave y tendencias) y preguntando lo de
 * siempre: **¿quién lee esto?**. `seriesDesdeHistorial` y `listarPanelesLab`
 * tenían un único llamador, y no era el motor.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia «escrito y sin conectar», sobre el dato que alimenta las fórmulas que
 * producen conducta. Y la variante peor: el dato estaba **en la misma pantalla**,
 * en otra pestaña, lo cual hace que el hueco sea invisible mirando la interfaz.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Hoy manda (si el médico acaba de dictar una creatinina, está mirando un
 * resultado nuevo); el expediente completa; y **lo que viene del expediente
 * viaja con su fecha**, que el motor dice en el aviso. Un «TFG estimada 28
 * (creatinina 2.4)» sin decir de cuándo es esa creatinina afirma una vigencia
 * que nadie comprobó.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No filtra por antigüedad, y es deliberado.** Cuánto puede tener una
 *   creatinina para seguir sirviendo para dosificar es un **umbral clínico**, y
 *   aquí no se inventa (regla 1): queda `NEEDS_CLINICAL_REVIEW` y lo que se hace
 *   es **decir la fecha**. El día que el dueño lo fije, se aplica en un solo
 *   sitio.
 * · **No trae valores censurados** («>400», «<50»): el laboratorio dio un
 *   límite, no un número, y meterlo en una fórmula afirmaría un valor exacto que
 *   nadie midió.
 * · **No cambia ningún umbral, ninguna fórmula ni ninguna compuerta.** Cambia
 *   qué entra.
 * · **No dibuja tendencias en la consulta.** `seriesDesdeHistorial` sigue siendo
 *   del panel; esto es el puente al motor, no una pantalla nueva.
 * · **No cubre la UCI ni hospitalización**, que tienen su propio camino.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  labsDelCuadro, POR_QUE_NO_HAY_UMBRAL_DE_ANTIGUEDAD, POR_QUE_HOY_MANDA,
} from '@/lib/expediente/laboratorio/lo-que-ya-esta-medido'
import { copiloto } from '@/lib/expediente/copiloto'

const PANEL_DEL_MES_PASADO = [{
  fecha: '2026-07-14',
  resultados: [{ clave: 'creatinina', valor: 2.4, etiqueta: 'Creatinina', unidad: 'mg/dL', critico: false }],
}]

/** El motor real, con lo que la consulta le pasaría. */
function motorCon(labs: ReturnType<typeof labsDelCuadro>) {
  return copiloto({
    edad: 68, sexo: 'Femenino',
    medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
    labs: labs.labs, labsMedidosEn: labs.medidoEn,
  })
}

describe('la creatinina del expediente llega al ajuste renal', () => {
  it('AL REVÉS — con sólo lo de hoy, el motor no dice nada de la metformina', () => {
    /* El estado anterior, reproducido con el motor real: `ajusteRenal` sale por
       su primera línea porque no hay `labs.creatinina`. */
    const sug = motorCon(labsDelCuadro({}, []))
    expect(JSON.stringify(sug)).not.toMatch(/metformina/i)
    expect(JSON.stringify(sug)).not.toMatch(/TFG/)
  })

  it('con el panel del mes pasado, el aviso sale', () => {
    const sug = motorCon(labsDelCuadro({}, PANEL_DEL_MES_PASADO))
    const texto = JSON.stringify(sug)
    expect(texto).toMatch(/metformina/i)
    expect(texto).toMatch(/TFG/)
  })

  it('y el aviso dice DE CUÁNDO es la creatinina', () => {
    /* Sin esto el motor afirmaría una vigencia que nadie comprobó — y éste es el
       aviso más grave que produce. */
    const texto = JSON.stringify(motorCon(labsDelCuadro({}, PANEL_DEL_MES_PASADO)))
    expect(texto).toMatch(/2026-07-14/)
  })

  it('lo dictado HOY manda, y va sin fecha porque es de esta consulta', () => {
    const cuadro = labsDelCuadro({ creatinina: 0.9 }, PANEL_DEL_MES_PASADO)
    expect(cuadro.labs.creatinina).toBe(0.9)
    expect(cuadro.medidoEn.creatinina).toBeUndefined()
    /* Con 0.9 en una mujer de 68 la TFG no baja de 60: no hay aviso renal. */
    expect(JSON.stringify(motorCon(cuadro))).not.toMatch(/metformina/i)
  })
})

describe('qué panel manda y qué no entra', () => {
  it('el panel más RECIENTE manda sobre cada analito', () => {
    const cuadro = labsDelCuadro({}, [
      { fecha: '2024-01-01', resultados: [{ clave: 'creatinina', valor: 3.5 }] },
      { fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 2.4 }] },
    ])
    expect(cuadro.labs.creatinina).toBe(2.4)
    expect(cuadro.medidoEn.creatinina).toBe('2026-07-14')
  })

  it('un panel viejo completa lo que el reciente no trae', () => {
    const cuadro = labsDelCuadro({}, [
      { fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 2.4 }] },
      { fecha: '2024-01-01', resultados: [{ clave: 'ldl', valor: 190 }] },
    ])
    expect(cuadro.labs).toEqual({ creatinina: 2.4, ldl: 190 })
    expect(cuadro.medidoEn.ldl).toBe('2024-01-01')
  })

  it('un valor CENSURADO no entra: el laboratorio dio un límite, no un número', () => {
    const cuadro = labsDelCuadro({}, [
      { fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 400, censurada: { signo: '>' } }] },
    ])
    expect(cuadro.labs.creatinina).toBeUndefined()
    expect(cuadro.medidoEn.creatinina).toBeUndefined()
  })

  it('un panel sin fecha no entra: sin fecha no se puede decir de cuándo es', () => {
    expect(labsDelCuadro({}, [{ fecha: '', resultados: [{ clave: 'creatinina', valor: 2.4 }] }]).labs).toEqual({})
  })

  it('lo que no es un número no entra', () => {
    const cuadro = labsDelCuadro({}, [{
      fecha: '2026-07-14',
      resultados: [
        { clave: 'creatinina', valor: Number.NaN },
        { clave: '', valor: 3 },
        { clave: 'ldl' },
      ],
    }])
    expect(cuadro.labs).toEqual({})
  })

  it('sin paneles se comporta exactamente como antes', () => {
    expect(labsDelCuadro({ creatinina: 1.1 }, undefined)).toEqual({ labs: { creatinina: 1.1 }, medidoEn: {} })
    expect(labsDelCuadro(undefined, undefined)).toEqual({ labs: {}, medidoEn: {} })
  })
})

describe('lo que este módulo NO decide, dicho', () => {
  it('el umbral de antigüedad queda como NEEDS_CLINICAL_REVIEW', () => {
    /* Rellenar «180 días» porque suena razonable es el fallo más caro de este
       repositorio: no rompe nada, no falla ninguna prueba, y sale impreso. */
    expect(POR_QUE_NO_HAY_UMBRAL_DE_ANTIGUEDAD).toContain('NEEDS_CLINICAL_REVIEW')
    const src = readFileSync('src/lib/expediente/laboratorio/lo-que-ya-esta-medido.ts', 'utf8')
    expect(src).not.toMatch(/DIAS_[A-Z_]*\s*=\s*\d+/)
  })

  it('la regla de que hoy manda está escrita, y es la misma que la medicación', () => {
    expect(POR_QUE_HOY_MANDA).toMatch(/cuadro-completo/)
  })
})

describe('el dato tiene que LLEGAR a la consulta', () => {
  const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la consulta lee los paneles y los mete en la entrada del motor', () => {
    expect(src).toContain('listarPanelesLab(clinicId, patientId)')
    expect(src).toMatch(/labs: labsDeLaConsulta\.labs/)
    expect(src).toMatch(/labsMedidosEn: labsDeLaConsulta\.medidoEn/)
  })

  it('sigue pasando lo dictado hoy: el puente añade, no sustituye', () => {
    expect(src).toMatch(/labsDelCuadro\(\s*\n\s*labsDesdeEstudios\(/)
  })

  it('si la lectura falla, los motores ven lo de hoy — no se rompe la consulta', () => {
    const i = src.indexOf('listarPanelesLab(clinicId, patientId)')
    expect(src.slice(i, i + 200)).toContain('.catch(')
  })
})

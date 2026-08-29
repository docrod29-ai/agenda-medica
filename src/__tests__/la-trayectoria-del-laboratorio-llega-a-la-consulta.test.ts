/**
 * GOLDEN — LA TRAYECTORIA DE LABORATORIO SÓLO SE VEÍA SALIENDO DE LA CONSULTA.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * REG-368 hizo que los laboratorios del expediente lleguen a los motores. Lo que
 * llega es **el último valor de cada analito**. El último valor no dice lo único
 * que a veces importa:
 *
 *     creatinina  0.9 (mar-2025) → 1.3 (ene-2026) → 1.7 (jul-2026)
 *
 * Ninguno de los tres dispara nada por sí solo y los tres juntos son un
 * deterioro renal. `seriesDesdeHistorial` construye esa trayectoria desde hace
 * tiempo y **su único llamador es el panel de la pestaña de Laboratorios**: para
 * verla hay que salir de donde se está prescribiendo, con el paciente enfrente.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Estaba escrito en el checkpoint como lo siguiente de WS-10 después de REG-368:
 * «llevar la tendencia de laboratorios a la consulta, que hoy sólo se dibuja en
 * su pestaña».
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Familia «escrito y sin conectar»: el cálculo existía y su único lector estaba
 * a una pestaña de distancia del momento en que sirve.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Este módulo hace **aritmética y procedencia**, no clínica. Devuelve dos
 * números con sus fechas y la palabra que describe la diferencia. «Subió» es un
 * hecho; «empeoró» sería un diagnóstico que nadie firmó.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No dice si el cambio es significativo** — `NEEDS_CLINICAL_REVIEW`. Cuánto
 *   tiene que subir una creatinina para que importe es un umbral clínico y aquí
 *   no se inventa: no hay porcentajes, ni «deterioro», ni banderas. Hay un caso
 *   que falla si aparece un umbral numérico en el módulo.
 * · **No trae censurados** («>400»): un límite no es un número y haría subir o
 *   bajar una línea por un valor que nadie midió.
 * · **No dibuja una gráfica.** La gráfica sigue siendo del panel; esto es la
 *   frase que cabe donde se decide.
 * · **Sólo de los analitos que entran a los motores**, y sólo cuando hay una
 *   medición anterior. Una trayectoria de algo que nadie usa es inventario.
 * · **No cubre UCI ni hospitalización**, que tienen su propio camino.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  trayectoriaDe, comoSeDiceLaTrayectoria, TOPE_PREVIOS,
  POR_QUE_NO_DICE_SI_ES_SIGNIFICATIVO,
} from '@/lib/expediente/laboratorio/la-trayectoria'
import { copiloto } from '@/lib/expediente/copiloto'

const DETERIORO = [
  { fecha: '2025-03-02', resultados: [{ clave: 'creatinina', valor: 0.9 }] },
  { fecha: '2026-01-10', resultados: [{ clave: 'creatinina', valor: 1.3 }] },
  { fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 1.7 }] },
]

describe('la trayectoria es aritmética con procedencia', () => {
  it('el último valor manda, y el anterior queda dicho', () => {
    const t = trayectoriaDe(DETERIORO, 'creatinina')!
    expect(t.actual).toEqual({ valor: 1.7, fecha: '2026-07-14' })
    expect(t.previo).toEqual({ valor: 1.3, fecha: '2026-01-10' })
    expect(t.direccion).toBe('sube')
    expect(comoSeDiceLaTrayectoria(t)).toBe('subió desde 1.3 el 2026-01-10')
  })

  it('conserva los anteriores del más nuevo al más viejo', () => {
    expect(trayectoriaDe(DETERIORO, 'creatinina')!.previos.map(p => p.valor)).toEqual([1.3, 0.9])
  })

  it('lo dictado HOY manda, y el panel más nuevo pasa a ser el previo', () => {
    /* Misma regla que `labsDelCuadro`: si el médico acaba de dictar un valor,
       está mirando un resultado nuevo. */
    const t = trayectoriaDe(DETERIORO, 'creatinina', 2.4)!
    expect(t.actual).toEqual({ valor: 2.4, fecha: '' })
    expect(t.previo).toEqual({ valor: 1.7, fecha: '2026-07-14' })
    expect(comoSeDiceLaTrayectoria(t)).toBe('subió desde 1.7 el 2026-07-14')
  })

  it('baja e igual se dicen por su nombre, sin adjetivos', () => {
    const baja = trayectoriaDe([
      { fecha: '2026-01-10', resultados: [{ clave: 'creatinina', valor: 1.7 }] },
      { fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 1.1 }] },
    ], 'creatinina')!
    expect(baja.direccion).toBe('baja')
    expect(comoSeDiceLaTrayectoria(baja)).toBe('bajó desde 1.7 el 2026-01-10')

    const igual = trayectoriaDe([
      { fecha: '2026-01-10', resultados: [{ clave: 'creatinina', valor: 1.1 }] },
      { fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 1.1 }] },
    ], 'creatinina')!
    expect(igual.direccion).toBe('igual')
    expect(comoSeDiceLaTrayectoria(igual)).toBe('igual que el 2026-01-10')
  })

  it('sin medición anterior no hay frase — no un «sin datos previos»', () => {
    const t = trayectoriaDe([{ fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 1.7 }] }], 'creatinina')!
    expect(t.direccion).toBe('sin_previos')
    expect(comoSeDiceLaTrayectoria(t)).toBe('')
  })

  it('sin nada devuelve null, y la frase de null es vacía', () => {
    expect(trayectoriaDe([], 'creatinina')).toBeNull()
    expect(trayectoriaDe(undefined, 'creatinina')).toBeNull()
    expect(comoSeDiceLaTrayectoria(null)).toBe('')
  })
})

describe('lo que no entra a una trayectoria', () => {
  it('un valor CENSURADO no entra: un límite no es un número', () => {
    const t = trayectoriaDe([
      { fecha: '2026-01-10', resultados: [{ clave: 'creatinina', valor: 1.3 }] },
      { fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 400, censurada: { signo: '>' } }] },
    ], 'creatinina')!
    /* El censurado no se convierte en «subió a 400»: se ignora y manda el real. */
    expect(t.actual).toEqual({ valor: 1.3, fecha: '2026-01-10' })
    expect(t.direccion).toBe('sin_previos')
  })

  it('un panel sin fecha no entra', () => {
    expect(trayectoriaDe([{ fecha: '', resultados: [{ clave: 'creatinina', valor: 1.3 }] }], 'creatinina')).toBeNull()
  })

  it('otro analito no contamina la serie', () => {
    const t = trayectoriaDe([
      { fecha: '2026-01-10', resultados: [{ clave: 'ldl', valor: 190 }] },
      { fecha: '2026-07-14', resultados: [{ clave: 'creatinina', valor: 1.7 }] },
    ], 'creatinina')!
    expect(t.previos).toEqual([])
  })

  it('hay tope de puntos: el expediente crece y esto se pinta en una línea', () => {
    const muchos = Array.from({ length: TOPE_PREVIOS + 6 }, (_, i) => ({
      fecha: `2020-01-${String(i + 1).padStart(2, '0')}`,
      resultados: [{ clave: 'creatinina', valor: 1 + i / 10 }],
    }))
    expect(trayectoriaDe(muchos, 'creatinina')!.previos).toHaveLength(TOPE_PREVIOS)
  })
})

describe('no se inventa el umbral, y se declara', () => {
  it('el módulo no lleva NINGUNA cifra clínica — se comprueba el código, no la prosa', () => {
    /*
     * Un «+30 % es lesión renal aguda» aquí no rompería nada, no fallaría
     * ninguna prueba, y saldría impreso con cédula profesional. Regla 1.
     *
     * Se buscan los literales numéricos del CÓDIGO —quitando comentarios y
     * cadenas, donde la palabra «umbral» aparece legítimamente al explicar por
     * qué no hay ninguno—. El único permitido es el tope de puntos, que es una
     * cota de memoria y de ancho de pantalla, no una cifra clínica.
     */
    expect(POR_QUE_NO_DICE_SI_ES_SIGNIFICATIVO).toContain('NEEDS_CLINICAL_REVIEW')
    const src = readFileSync('src/lib/expediente/laboratorio/la-trayectoria.ts', 'utf8')
    const codigo = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')     // comentarios de bloque
      .replace(/\/\/[^\n]*/g, ' ')            // comentarios de línea
      .replace(/'[^']*'|`[^`]*`/g, "''")     // cadenas
    /* `0` y `1` se permiten: son índices y recortes de lista (`historicos[0]`,
       `.slice(1)`). Ninguna cifra clínica de este dominio vale 0 ni 1 a secas,
       así que permitirlos no abre la puerta que este caso cierra. Cualquier
       30, 0.3, 1.5 o 60 cae aquí. */
    const permitidos = new Set(['0', '1', String(TOPE_PREVIOS)])
    const numeros = [...codigo.matchAll(/(?<![\w.])\d+(?:\.\d+)?/g)].map(m => m[0])
    const clinicas = numeros.filter(n => !permitidos.has(n))
    expect(clinicas, `cifras sin justificar en el código: ${clinicas.join(', ')}`).toEqual([])
    expect(numeros, 'el tope de puntos desapareció del módulo').toContain(String(TOPE_PREVIOS))
  })

  it('la frase describe aritmética, nunca clínica', () => {
    const t = trayectoriaDe(DETERIORO, 'creatinina')
    const frase = comoSeDiceLaTrayectoria(t)
    expect(frase).toMatch(/subió/)
    for (const juicio of [/empeor/i, /deterior/i, /alarm/i, /grave/i, /significativ/i]) {
      expect(frase, `la frase emite un juicio clínico: ${frase}`).not.toMatch(juicio)
    }
  })
})

describe('llega al aviso que cambia la conducta', () => {
  it('el motor real cita la trayectoria junto al valor', () => {
    const sug = copiloto({
      edad: 68, sexo: 'Femenino',
      medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
      labs: { creatinina: 2.4 },
      labsMedidosEn: { creatinina: '2026-07-14' },
      labsTrayectoria: { creatinina: 'subió desde 1.3 el 2026-01-10' },
    })
    const texto = JSON.stringify(sug)
    expect(texto).toMatch(/metformina/i)
    expect(texto).toMatch(/medida el 2026-07-14/)
    expect(texto).toMatch(/subió desde 1\.3 el 2026-01-10/)
  })

  it('AL REVÉS — sin trayectoria el aviso sale igual, sólo que sin ella', () => {
    const sug = copiloto({
      edad: 68, sexo: 'Femenino',
      medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
      labs: { creatinina: 2.4 }, labsMedidosEn: { creatinina: '2026-07-14' },
    })
    const texto = JSON.stringify(sug)
    expect(texto).toMatch(/metformina/i)
    expect(texto).not.toMatch(/subió/)
  })
})

describe('el dato tiene que LLEGAR a la consulta', () => {
  const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('la consulta la calcula sólo de lo que los motores usan', () => {
    expect(src).toContain("from '@/lib/expediente/laboratorio/la-trayectoria'")
    expect(src).toMatch(/Object\.keys\(labsDeLaConsulta\.labs\)/)
    /* Y descarta las vacías, para que el aviso no arrastre un «sin previos». */
    expect(src).toMatch(/\.filter\(\(\[, frase\]\) => frase\)/)
  })

  it('la pinta en la consulta, no sólo dentro de un aviso del motor', () => {
    expect(src).toMatch(/\{Object\.keys\(trayectoriasDeLaConsulta\)\.length > 0 && \(/)
    expect(src).toContain('TOPE_TRAYECTORIAS_EN_PANTALLA')
  })

  it('y dice que no juzga el cambio', () => {
    expect(src).toContain('no si el cambio es importante')
  })

  it('se la pasa al motor', () => {
    expect(src).toMatch(/labsTrayectoria: trayectoriasDeLaConsulta/)
  })
})

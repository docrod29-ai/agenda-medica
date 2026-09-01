/**
 * GOLDEN — CUÁNDO UNA CREATININA DEJA DE SERVIR PARA DOSIFICAR.
 *
 * ── DE DÓNDE SALE ESTA POLÍTICA ─────────────────────────────────────────────
 *
 * REG-368 llevó los laboratorios del expediente a los motores y dejó abierto,
 * como `NEEDS_CLINICAL_REVIEW`, cuánto puede tener una creatinina para seguir
 * sirviendo. **El dueño lo resolvió el 29-ago-2026**:
 *
 *   · AKI, hospitalizado o función renal inestable → **≤24 h**
 *   · Ambulatorio clínicamente estable            → **≤30 días**
 *   · No se puede demostrar estabilidad, o es ambiguo → **≤7 días**
 *   · Fuera de ventana: **no bloquear en silencio, no inventar función renal**;
 *     marcar `STALE_RENAL_FUNCTION` y pedir función renal actualizada antes de
 *     una recomendación de dosificación dependiente del riñón.
 *   · **La autoridad final es del médico.**
 *
 * Este archivo existe para que esas cuatro reglas no se puedan cambiar por
 * descuido: cada una tiene su caso, y los números están comparados contra la
 * política, no contra la implementación.
 *
 * ── QUÉ FALLABA ANTES ───────────────────────────────────────────────────────
 *
 * Nada se filtraba por antigüedad: una creatinina de hace dos años estimaba una
 * TFG y con ella se emitía «metformina contraindicada», con la fecha a la vista
 * (REG-368) y sin decir que el dato ya no valía para dosificar.
 *
 * ── LO QUE NO SE INFIERE, Y POR QUÉ ─────────────────────────────────────────
 *
 * **La estabilidad clínica no se deduce de los números.** Decidir que una
 * función renal es estable mirando cuánto se movió la creatinina exigiría un
 * umbral de variación que nadie ha validado — lo mismo que la otra política del
 * dueño prohíbe. Sólo cuenta si alguien la **declara**.
 *
 * Consecuencia declarada: **hoy nada en el producto la declara**, así que en la
 * consulta ambulatoria rige la ventana conservadora de 7 días. La de 30 queda
 * implementada y probada, esperando a quien pueda declararla.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No bloquea la firma ni retira la recomendación.** La política dice que no
 *   se bloquee en silencio: la sugerencia de ajuste sigue saliendo, con su
 *   fecha, y encima se dice que el dato está caduco.
 * · **No pide el laboratorio por su cuenta** ni genera una orden.
 * · **«IRA» no se reconoce como renal aguda**: en México se dicta muchísimo más
 *   como *infección respiratoria aguda*, y meterla convertiría cada catarro en
 *   una ventana de 24 h. Lo que no está en la lista no se vigila — declarado.
 * · **No cubre UCI ni hospitalización**, que tienen su propio camino; lo que sí
 *   usa de ahí es el internamiento activo como señal de «hospitalizado».
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  vigenciaDeLaFuncionRenal, contextoRenal, hayRenalAgudo,
  avisoDeFuncionRenalCaduca, comoSeDiceLaAntiguedad,
  VENTANA_HORAS, STALE_RENAL_FUNCTION,
  DE_QUIEN_SON_ESTAS_CIFRAS, POR_QUE_NO_SE_DEDUCE_LA_ESTABILIDAD,
} from '@/lib/expediente/laboratorio/vigencia-de-la-funcion-renal'
import { copiloto } from '@/lib/expediente/copiloto'

const AHORA = '2026-08-29T12:00:00.000Z'
const haceDias = (d: number) =>
  new Date(Date.parse(AHORA) - d * 86_400_000).toISOString().slice(0, 10)

describe('las tres ventanas del dueño, una por caso', () => {
  it('hospitalizado: la ventana es de 24 h', () => {
    expect(VENTANA_HORAS.inestable).toBe(24)
    const v = vigenciaDeLaFuncionRenal(haceDias(2), AHORA, { hospitalizado: true })
    expect(v.contexto).toBe('inestable')
    expect(v.vigente).toBe(false)
    expect(v.marca).toBe(STALE_RENAL_FUNCTION)
  })

  it('con daño renal AGUDO en la lista, también 24 h', () => {
    const v = vigenciaDeLaFuncionRenal(haceDias(3), AHORA, {
      diagnosticos: [{ descripcion: 'Lesión renal aguda' }],
    })
    expect(v.contexto).toBe('inestable')
    expect(v.vigente).toBe(false)
  })

  it('ambulatorio con estabilidad DECLARADA: 30 días', () => {
    expect(VENTANA_HORAS.ambulatorio_estable).toBe(30 * 24)
    const dentro = vigenciaDeLaFuncionRenal(haceDias(20), AHORA, { estabilidadDeclarada: true })
    expect(dentro.contexto).toBe('ambulatorio_estable')
    expect(dentro.vigente).toBe(true)
    const fuera = vigenciaDeLaFuncionRenal(haceDias(40), AHORA, { estabilidadDeclarada: true })
    expect(fuera.vigente).toBe(false)
  })

  it('sin poder demostrar estabilidad: la conservadora de 7 días', () => {
    expect(VENTANA_HORAS.indeterminado).toBe(7 * 24)
    expect(vigenciaDeLaFuncionRenal(haceDias(5), AHORA, {}).vigente).toBe(true)
    const v = vigenciaDeLaFuncionRenal(haceDias(10), AHORA, {})
    expect(v.contexto).toBe('indeterminado')
    expect(v.vigente).toBe(false)
  })

  it('lo agudo manda sobre la estabilidad declarada', () => {
    /* Si alguien declaró estable a un paciente con lesión renal aguda, gana lo
       agudo: la ventana corta es la segura. */
    expect(contextoRenal({ estabilidadDeclarada: true, diagnosticos: [{ descripcion: 'Necrosis tubular aguda' }] }))
      .toBe('inestable')
  })

  it('la enfermedad renal CRÓNICA no es inestable', () => {
    /* Un paciente con ERC estable es justamente el caso de la ventana larga.
       Meterlo en 24 h convertiría a todo nefrópata en una urgencia. */
    expect(hayRenalAgudo([{ descripcion: 'Enfermedad renal crónica estadio 3' }])).toBe(false)
    expect(contextoRenal({ diagnosticos: [{ descripcion: 'Enfermedad renal crónica' }] })).toBe('indeterminado')
  })

  it('«IRA» NO se toma por renal aguda — declarado, no olvidado', () => {
    /* En México se dicta muchísimo más como infección respiratoria aguda. */
    expect(hayRenalAgudo([{ descripcion: 'IRA' }])).toBe(false)
    expect(hayRenalAgudo([{ descripcion: 'Infección respiratoria aguda' }])).toBe(false)
    const src = readFileSync('src/lib/expediente/laboratorio/vigencia-de-la-funcion-renal.ts', 'utf8')
    expect(src).toMatch(/«IRA» NO está en la lista/)
  })
})

describe('la antigüedad se mide al alza, nunca a la baja', () => {
  it('lo dictado HOY no tiene antigüedad', () => {
    /* Contrato de `labsDelCuadro`: sin fecha significa «de esta consulta». */
    const v = vigenciaDeLaFuncionRenal(undefined, AHORA, { hospitalizado: true })
    expect(v.antiguedadHoras).toBe(0)
    expect(v.vigente).toBe(true)
    expect(vigenciaDeLaFuncionRenal('', AHORA, { hospitalizado: true }).vigente).toBe(true)
  })

  it('un panel de AYER no cumple las 24 h aunque se tomara anoche', () => {
    /* La fecha no lleva hora, así que se ancla a las 00:00 y la antigüedad sale
       al alza. Pedir una creatinina de más es preferible a dosificar con una
       que no se puede demostrar reciente. */
    const v = vigenciaDeLaFuncionRenal(haceDias(1), AHORA, { hospitalizado: true })
    expect(v.antiguedadHoras).toBeGreaterThan(24)
    expect(v.vigente).toBe(false)
  })

  it('un panel de HOY sí cumple las 24 h', () => {
    expect(vigenciaDeLaFuncionRenal(haceDias(0), AHORA, { hospitalizado: true }).vigente).toBe(true)
  })

  it('una fecha ilegible NO se da por reciente', () => {
    const v = vigenciaDeLaFuncionRenal('ayer por la tarde', AHORA, {})
    expect(v.antiguedadHoras).toBeNull()
    expect(v.vigente).toBe(false)
    expect(v.marca).toBe(STALE_RENAL_FUNCTION)
  })

  it('no lee el reloj: dos llamadas con el mismo `ahora` son idénticas', () => {
    expect(vigenciaDeLaFuncionRenal(haceDias(10), AHORA, {}))
      .toEqual(vigenciaDeLaFuncionRenal(haceDias(10), AHORA, {}))
  })
})

describe('lo que se dice cuando el dato se pasó', () => {
  const v = vigenciaDeLaFuncionRenal(haceDias(400), AHORA, {})

  it('lleva la marca literal que pide la política', () => {
    expect(avisoDeFuncionRenalCaduca(v)).toContain('STALE_RENAL_FUNCTION')
  })

  it('dice la ventana, por qué esa, y qué hace falta', () => {
    const t = avisoDeFuncionRenalCaduca(v)
    expect(t).toContain('7 días')
    expect(t).toMatch(/no consta estabilidad clínica/)
    expect(t).toMatch(/función renal actualizada/)
    expect(t).toMatch(/dosificación dependiente del riñón/)
  })

  it('y recuerda de quién es la decisión', () => {
    expect(avisoDeFuncionRenalCaduca(v)).toMatch(/decisión es del médico/)
  })

  it('con el dato vigente NO dice nada', () => {
    expect(avisoDeFuncionRenalCaduca(vigenciaDeLaFuncionRenal(haceDias(1), AHORA, {}))).toBe('')
  })

  it('la antigüedad se dice sin fingir precisión', () => {
    expect(comoSeDiceLaAntiguedad(0)).toBe('de hoy')
    expect(comoSeDiceLaAntiguedad(30)).toBe('de ayer')
    expect(comoSeDiceLaAntiguedad(24 * 10)).toBe('de hace 10 días')
    expect(comoSeDiceLaAntiguedad(24 * 200)).toMatch(/meses/)
    expect(comoSeDiceLaAntiguedad(null)).toBe('de fecha ilegible')
  })
})

describe('no bloquea, no inventa, y sólo habla donde se dosifica', () => {
  const conCreatininaCaduca = (extra: Record<string, unknown> = {}) => copiloto({
    edad: 68, sexo: 'Femenino',
    medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
    labs: { creatinina: 2.4 },
    labsMedidosEn: { creatinina: haceDias(400).slice(0, 10) },
    funcionRenalVigente: { vigente: false, aviso: avisoDeFuncionRenalCaduca(vigenciaDeLaFuncionRenal(haceDias(400), AHORA, {})) },
    ...extra,
  })

  it('el aviso sale, con su marca', () => {
    expect(JSON.stringify(conCreatininaCaduca())).toContain('STALE_RENAL_FUNCTION')
  })

  it('y la recomendación de ajuste NO se retira: no se bloquea en silencio', () => {
    const texto = JSON.stringify(conCreatininaCaduca())
    expect(texto).toMatch(/metformina/i)
    expect(texto).toMatch(/TFG/)
  })

  it('AL REVÉS — con el dato vigente no se dice nada de caducidad', () => {
    const sug = copiloto({
      edad: 68, sexo: 'Femenino',
      medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
      labs: { creatinina: 2.4 },
      funcionRenalVigente: { vigente: true, aviso: '' },
    })
    expect(JSON.stringify(sug)).not.toContain('STALE_RENAL_FUNCTION')
    expect(JSON.stringify(sug)).toMatch(/metformina/i)
  })

  it('sin evaluar la vigencia, el motor se comporta como antes', () => {
    const sug = copiloto({
      edad: 68, sexo: 'Femenino',
      medicamentos: [{ nombre: 'Metformina', dosis: '850 mg' }],
      labs: { creatinina: 2.4 },
    })
    expect(JSON.stringify(sug)).not.toContain('STALE_RENAL_FUNCTION')
    expect(JSON.stringify(sug)).toMatch(/metformina/i)
  })

  it('sin fármaco de ajuste renal no hay aviso de caducidad: sería ruido', () => {
    /* La política habla de una recomendación de dosificación dependiente del
       riñón. Sin ella no hay nada que advertir. */
    const sug = copiloto({
      edad: 68, sexo: 'Femenino',
      medicamentos: [],
      labs: { creatinina: 2.4 },
      funcionRenalVigente: { vigente: false, aviso: 'x STALE_RENAL_FUNCTION' },
    })
    expect(JSON.stringify(sug)).not.toContain('STALE_RENAL_FUNCTION')
  })
})

describe('las cifras son del dueño, y se dice', () => {
  it('el módulo declara de quién son', () => {
    expect(DE_QUIEN_SON_ESTAS_CIFRAS).toMatch(/29-ago-2026/)
    expect(DE_QUIEN_SON_ESTAS_CIFRAS).toMatch(/REG-368/)
  })

  it('lo único numérico del módulo son las tres ventanas', () => {
    /* Cualquier otra constante numérica sería una cifra clínica inventada. */
    const src = readFileSync('src/lib/expediente/laboratorio/vigencia-de-la-funcion-renal.ts', 'utf8')
    const constantes = [...src.matchAll(/^\s+(\w+):\s*(\d+(?:\s*\*\s*\d+)?),$/gm)].map(m => `${m[1]}`)
    expect(constantes.sort()).toEqual(['ambulatorio_estable', 'indeterminado', 'inestable'])
  })

  it('la estabilidad no se deduce, y el módulo explica por qué', () => {
    expect(POR_QUE_NO_SE_DEDUCE_LA_ESTABILIDAD).toMatch(/umbral de variación que nadie ha validado/)
  })

  it('la consulta NO declara estabilidad — hoy nada puede', () => {
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(src).toMatch(/vigenciaDeLaFuncionRenal\(/)
    expect(src).not.toMatch(/estabilidadDeclarada:\s*true/)
  })

  it('la consulta pasa el internamiento y los problemas como señales', () => {
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(src).toContain('hospitalizado: !!internamientoActivo')
    expect(src).toContain('diagnosticos: dxDelCuadro')
  })

  it('el instante se ancla a la carga, no al render', () => {
    /*
     * Con `new Date()` en el cuerpo, la vigencia nacía distinta en cada render y
     * con ella la entrada del copiloto, cuya memoización dejaba de servir: el
     * motor entero se recalculaba en cada tecla del dictado. La ventana más
     * corta de la política es de 24 h y una consulta no dura eso, así que
     * anclar no cambia ningún veredicto.
     */
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    expect(src).toMatch(/const ahoraParaVigencia = useMemo\(\(\) => new Date\(\)\.toISOString\(\), \[panelesLab\]\)/)
    expect(src).toMatch(/vigenciaDeLaFuncionRenal\(\s*\n\s*labsDeLaConsulta\.medidoEn\.creatinina,\s*\n\s*ahoraParaVigencia,/)
  })
})

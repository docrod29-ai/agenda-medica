/**
 * GOLDEN — LOS AVISOS QUE EL MÉDICO CONFIRMÓ HABER REVISADO SE DESCARTABAN AL
 * FIRMAR.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Antes de firmar, `/consulta` enseña una lista de avisos y pide confirmar con
 * «Los revisé, firmar». Los produce `construirAvisos` a partir de motores con
 * pruebas: la contradicción con una negación, el antecedente que era del
 * familiar, el dato que el paciente ofreció como duda (`certeza.ts`), el
 * desajuste temporal, la afirmación sin respaldo en el dictado.
 *
 * Y al firmar se descartaban todos. La nota firmada guarda con qué modelo se
 * generó, qué versión del prompt, cuántos campos vinieron del dictado y cuáles
 * aprobó el médico (`iaAuditoria`) — y **nada de lo que el sistema le señaló**.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo WS-10. El tablero lo tenía escrito como «el hueco de fondo»:
 * negación, temporalidad, experienciador y certeza **corren en el momento de la
 * consulta y producen avisos, y después se descartan**. `certeza.ts` lo dice de
 * sí mismo en `POR_QUE_IMPORTA`: «lo que el paciente ofreció como duda queda en
 * el expediente como diagnóstico; a partir de la segunda consulta ya nadie sabe
 * que era una duda».
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El resultado de los motores vivía sólo en estado de React. Familia «escrito y
 * sin conectar», en su variante temporal: sí corría en el camino del médico, y
 * el dato no sobrevivía al acto que lo hacía importante.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Se sella lo que estaba EN PANTALLA al firmar —lo mismo que enumeró el diálogo
 * y a lo que se refiere «Los revisé»—, ni más ni menos. Y se mete en la nota
 * **antes** de calcular el hash: `iaAuditoria` está dentro del conjunto sellado
 * (`OPCIONALES_SELLADOS_V3`), así que añadirlo después haría que el sello se
 * calculara sobre un objeto distinto del que se escribe y la nota se reabriera
 * marcada como «alterada». Ése es el modo de fallo de REG-060 y es la razón de
 * que exista `conAvisosSellados` en vez de un objeto suelto en la pantalla.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No sella los avisos que el médico cerró antes de llegar a firmar.** Eso
 *   sería un historial de la sesión, que es otra cosa y no es lo que él
 *   confirmó. Queda declarado, no disimulado.
 * · **No sella los de PRESCRIPCIÓN.** `alFirmar` los deja fuera porque se ven
 *   mientras receta, no al firmar (REG-173/190). Aquí se sella lo que se mostró
 *   en ese diálogo.
 * · **No resuelve la duda.** Un dato incierto sellado sigue siendo incierto;
 *   ahora se puede volver a leer, que es lo que no se podía.
 * · **No añade `certeza` a `Diagnostico`.** El eje sigue sin estructurarse en la
 *   entidad; lo que se conserva es la FRASE que lo delató, con su aviso.
 * · **No se imprime.** Es cómo se revisó la nota, no parte del documento que se
 *   entrega al paciente ni del que va a la farmacia.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  sellarAvisos, conAvisosSellados, avisosSelladosDe,
  TOPE_AVISOS_SELLADOS, POR_QUE_SE_SELLA,
} from '@/lib/expediente/lo-que-se-aviso-al-firmar'
import { construirAvisos } from '@/lib/expediente/avisos-consulta'
import { alFirmar } from '@/lib/expediente/cuando-avisar'
import { normalizarParaSello } from '@/lib/expediente/integrity'
import type { NotaMedica } from '@/types/expediente'
import type { AvisoConsulta } from '@/lib/expediente/avisos-consulta'

const NOTA_BASE = {
  id: 'n1', clinicId: 'c1', pacienteId: 'p1', pacienteNombre: 'Paciente Sintético',
  tipo: 'consulta', metadata: { id: 'n1', fechaCreacion: '2026-08-29T10:00:00.000Z' },
  secciones: [], diagnosticos: [], medicamentos: [], alergias: [],
} as unknown as NotaMedica

/** La cadena real: los motores producen los avisos, `alFirmar` deja los del texto. */
function avisosDeUnaConsultaConDudas(): AvisoConsulta[] {
  return alFirmar(construirAvisos({
    datosInciertos: [{ frase: 'creo que me dijeron que tenía anemia', matiz: 'duda', marca: 'creo que' }],
    antecedentesDeFamiliar: [{ frase: 'mi mamá tuvo cáncer de mama', marca: 'mi mamá' }],
  }))
}

describe('lo que se avisó al firmar queda en la nota', () => {
  it('la duda del paciente sobrevive a la firma', () => {
    const avisos = avisosDeUnaConsultaConDudas()
    expect(avisos.length, 'los motores no produjeron avisos: el fixture no prueba nada').toBeGreaterThan(0)

    const nota = conAvisosSellados(NOTA_BASE, avisos)
    const leidos = avisosSelladosDe(nota)
    expect(leidos).not.toBeNull()
    expect(JSON.stringify(leidos)).toMatch(/anemia/)
    /* Se conserva de qué motor viene: sin el origen, seis meses después es una
       frase suelta y no se sabe qué la marcó. */
    expect(leidos!.avisos.some(a => a.origen === 'dato_incierto')).toBe(true)
  })

  it('AL REVÉS — sin el sello, la nota firmada no dice nada de lo que se avisó', () => {
    /* El estado anterior, reproducido: la nota se construía igual y los avisos
       se quedaban en la pantalla. */
    expect(avisosSelladosDe(NOTA_BASE)).toBeNull()
    expect(JSON.stringify(NOTA_BASE)).not.toMatch(/anemia/)
  })

  it('no se reescribe la frase que el médico leyó', () => {
    const avisos = avisosDeUnaConsultaConDudas()
    const leidos = avisosSelladosDe(conAvisosSellados(NOTA_BASE, avisos))!
    expect(leidos.avisos.map(a => a.texto)).toEqual(avisos.slice(0, TOPE_AVISOS_SELLADOS).map(a => a.texto))
  })
})

describe('el sello entra ANTES del hash, o la nota se reabre «alterada»', () => {
  it('`iaAuditoria` está dentro de lo que cubre el sello de integridad', () => {
    /*
     * Si esto dejara de ser cierto, el orden de `conAvisosSellados` respecto a
     * `normalizarParaSello` dejaría de importar — y si al revés alguien mueve la
     * llamada después del hash, la nota nace marcada como alterada. Es el modo
     * de fallo de REG-060: la alarma roja que el sello existe para no dar nunca.
     */
    const integrity = readFileSync('src/lib/expediente/integrity.ts', 'utf8')
    expect(integrity).toMatch(/OPCIONALES_SELLADOS_V3[\s\S]{0,300}'iaAuditoria'/)
  })

  it('la consulta sella los avisos antes de normalizar para el sello', () => {
    const src = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')
    const iSello = src.indexOf('conAvisosSellados(construirNota')
    const iHash = src.indexOf('normalizarParaSello(notaParaValidar)')
    expect(iSello, 'la consulta no sella los avisos').toBeGreaterThan(-1)
    expect(iHash).toBeGreaterThan(-1)
    expect(iSello, 'el sello se calcularía sobre un objeto distinto del que se escribe').toBeLessThan(iHash)
  })

  it('normalizar para el sello conserva el campo', () => {
    const nota = conAvisosSellados(NOTA_BASE, avisosDeUnaConsultaConDudas())
    expect(avisosSelladosDe(normalizarParaSello(nota))).not.toBeNull()
  })
})

describe('lo que NO se escribe, y por qué', () => {
  it('sin avisos no se añade la llave: «no hubo» y «es anterior a esto» no son lo mismo', () => {
    const nota = conAvisosSellados(NOTA_BASE, [])
    expect(nota.iaAuditoria?.avisosAlFirmar).toBeUndefined()
    expect(nota).toEqual(NOTA_BASE)
  })

  it('no muta la nota que recibe', () => {
    const antes = JSON.stringify(NOTA_BASE)
    conAvisosSellados(NOTA_BASE, avisosDeUnaConsultaConDudas())
    expect(JSON.stringify(NOTA_BASE)).toBe(antes)
  })

  it('conserva lo que `iaAuditoria` ya llevaba', () => {
    const con = { ...NOTA_BASE, iaAuditoria: { aprobadoPor: 'medico@ejemplo.mx' } } as NotaMedica
    const salida = conAvisosSellados(con, avisosDeUnaConsultaConDudas())
    expect(salida.iaAuditoria?.aprobadoPor).toBe('medico@ejemplo.mx')
    expect(salida.iaAuditoria?.avisosAlFirmar).toBeDefined()
  })

  it('hay tope, y lo que no cabe se CUENTA en vez de callarse', () => {
    const muchos: AvisoConsulta[] = Array.from({ length: TOPE_AVISOS_SELLADOS + 7 }, (_, i) => ({
      id: `dato_incierto:${i}`, origen: 'dato_incierto', nivel: 'revisa', texto: `aviso ${i}`,
    }))
    const sello = sellarAvisos(muchos)
    expect(sello.avisos).toHaveLength(TOPE_AVISOS_SELLADOS)
    expect(sello.total).toBe(TOPE_AVISOS_SELLADOS + 7)
  })

  it('un aviso sin id o sin texto no se sella', () => {
    const sello = sellarAvisos([
      { id: '', origen: 'dato_incierto', nivel: 'revisa', texto: 'x' },
      { id: 'a:1', origen: 'dato_incierto', nivel: 'revisa', texto: '' },
    ] as AvisoConsulta[])
    expect(sello.avisos).toEqual([])
    expect(sello.total).toBe(0)
  })

  it('una nota sin el campo devuelve null, no un objeto vacío', () => {
    expect(avisosSelladosDe(null)).toBeNull()
    expect(avisosSelladosDe(undefined)).toBeNull()
    expect(avisosSelladosDe({ iaAuditoria: { avisosAlFirmar: { avisos: [], total: 0 } } })).toBeNull()
  })

  it('el porqué está escrito en el módulo', () => {
    expect(POR_QUE_SE_SELLA).toMatch(/se ven exactamente igual seis meses después/)
  })
})

/**
 * ── EL DATO TIENE QUE LLEGAR ────────────────────────────────────────────────
 *
 * Sellarlo y no enseñarlo sería el mismo defecto que REG-363 acaba de cerrar
 * por el otro lado: el dato escrito y nadie leyéndolo.
 */
describe('la pantalla de la nota firmada lo lee', () => {
  const src = readFileSync('src/app/(dashboard)/nota/[patientId]/[notaId]/page.tsx', 'utf8')

  it('lo lee y lo pinta', () => {
    expect(src).toContain("from '@/lib/expediente/lo-que-se-aviso-al-firmar'")
    expect(src).toMatch(/avisosSelladosDe\(nota\)/)
    expect(src).toMatch(/\{avisosSellados && \(/)
  })

  it('y NO lo imprime: no es parte del documento que se entrega', () => {
    /* El bloque va con `no-print`. Un aviso interno impreso en la receta o en
       la copia del paciente es otro problema, no la solución de éste. */
    const i = src.indexOf('{avisosSellados && (')
    expect(src.slice(i, i + 200)).toContain('no-print')
  })

  it('dice cuántos no cupieron, en vez de enseñar una lista muda', () => {
    expect(src).toMatch(/avisosSellados\.total > avisosSellados\.avisos\.length/)
  })
})

import { describe, it, expect } from 'vitest'
import { ordenesDeAritmetica, QUE_NO_VIGILA } from './_harness/ordenes-de-aritmetica'
import { buildSystemPrompt } from '@/lib/expediente/prompts'
import { GUIAS } from '@/lib/expediente/guias-de-especialidad'
import type { TipoNota } from '@/types/expediente'

/**
 * EL PROMPT NO ORDENA ARITMÉTICA, CON NINGUNAS PALABRAS — REG-530.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `el-llm-no-calcula-en-ninguna-nota.test.ts` (REG-194) vigila que el prompt
 * no le pida al modelo calcular. Lo hacía casando LITERALES: que no esté la
 * frase «Pediatría: dosis en mg/kg/día Y mg/kg/dosis. Holliday-Segar» y que
 * sí esté «16-bis. TÚ NO CALCULAS». Una orden nueva con otras palabras
 * —«estima la TFG con CKD-EPI», «calcula la superficie corporal con
 * Mosteller»— pasaba el guardián sin tocarlo. Y miraba el archivo fuente, no
 * el prompt que de verdad se manda: una guía de especialidad nueva entra por
 * otro archivo.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría test-the-test del 5-sep-2026 («casa literales»). Verificado
 * metiendo una orden reformulada en el prompt: el guardián viejo seguía verde.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `ordenesDeAritmetica(texto)` (instrumento del arnés, `_harness/`): por frases, delata las que nombran una
 * cantidad derivada o una fórmula con nombre sin negarla, sin atribuirla a un
 * motor y sin convertirla en transcripción. Se corre sobre el prompt EMITIDO
 * (`buildSystemPrompt`) para los 13 tipos de nota × las 16 guías de
 * especialidad × con y sin «completa los huecos». El guardián viejo se queda:
 * sella la redacción de la regla 16-bis; éste sella que nadie la contradiga.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Los mutantes de abajo son las dos frases originales de REG-194 y tres
 * reformulaciones: las cinco se delatan. Y el prompt real, en sus 442
 * combinaciones, no tiene ninguna.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Escalas que las guías piden DOCUMENTAR si se dictaron (qSOFA, Glasgow,
 *   PHQ-9…) no cuentan como orden de calcular. Declarado en `QUE_NO_VIGILA`.
 * - Es vocabulario: una fórmula que no esté en la lista no se vigila.
 * - No mira el prompt del usuario (`buildUserPrompt`): ahí va el dictado, no
 *   instrucciones.
 */

const TIPOS: TipoNota[] = [
  'historia_clinica', 'primera_vez', 'seguimiento', 'alta_consulta', 'ingreso', 'evolucion', 'egreso',
  'valoracion_preoperatoria', 'valoracion_inmuno', 'nota_postoperatoria', 'nota_anestesia', 'consentimiento',
  'evolucion_uci',
]

describe('REG-530 · el detector, contra los mutantes', () => {
  it('1 · EL CASO: las dos frases originales de REG-194 se delatan', () => {
    expect(ordenesDeAritmetica('- Pediatría: dosis en mg/kg/día Y mg/kg/dosis. Holliday-Segar para líquidos.')).toHaveLength(2)
    expect(ordenesDeAritmetica('percentiles si hay datos; dosis en mg/kg/día. Cálculo de líquidos Holliday-Segar cuando aplique.').length).toBeGreaterThanOrEqual(2)
  })

  it('2 · y las reformulaciones que el guardián viejo dejaba pasar', () => {
    for (const orden of [
      'Estima la TFG con CKD-EPI a partir de la creatinina.',
      'Calcula la superficie corporal con Mosteller y anótala.',
      'Reporta el percentil de peso para la edad.',
    ]) {
      expect(ordenesDeAritmetica(orden), orden).toHaveLength(1)
    }
  })

  it('3 · lo negado, lo atribuido al motor y lo transcrito NO se delatan', () => {
    for (const legitima of [
      'NUNCA calcules una escala, un índice, un percentil, una dosis por kilo, una superficie corporal.',
      'El mg/kg lo calcula el motor calcularDosisPediatrica.',
      'transcribe el peso y la dosis TAL COMO SE DICTARON, con su unidad.',
      'Si se dictó un cálculo de líquidos, transcríbelo; no lo hagas tú.',
      '"conclusionRiesgo": SE LLENA AUTOMÁTICAMENTE con calculadoras (ASA, RCRI).',
    ]) {
      expect(ordenesDeAritmetica(legitima), legitima).toEqual([])
    }
  })

  it('4 · una escala nombrada como cosa que documentar no es una orden de calcular (declarado)', () => {
    expect(ordenesDeAritmetica('URGENCIAS: triage, ABCDE, escalas (qSOFA, Glasgow) si se mencionan.')).toEqual([])
    expect(QUE_NO_VIGILA).toContain('qSOFA')
  })

  it('5 · dice por qué delata cada frase', () => {
    const [o] = ordenesDeAritmetica('Calcula la superficie corporal con Mosteller.')
    expect(o.porQue.toLowerCase()).toContain('superficie corporal')
  })
})

describe('REG-530 · el prompt EMITIDO, en todas sus combinaciones', () => {
  const especialidades: (string | undefined)[] = [undefined, ...GUIAS.map(g => g.nombre)]

  it('6 · ningún tipo de nota × especialidad × huecos ordena aritmética', () => {
    const hallazgos: string[] = []
    let combinaciones = 0
    for (const tipo of TIPOS) {
      for (const esp of especialidades) {
        for (const proponerHuecos of [false, true]) {
          combinaciones++
          const prompt = buildSystemPrompt(tipo, esp, undefined, { proponerHuecos })
          for (const o of ordenesDeAritmetica(prompt)) hallazgos.push(`${tipo}/${esp ?? '—'}: «${o.frase.slice(0, 90)}» (${o.porQue})`)
        }
      }
    }
    expect(combinaciones).toBe(TIPOS.length * especialidades.length * 2)
    expect([...new Set(hallazgos)]).toEqual([])
  })

  it('7 · y el guardián se pondría rojo si una guía nueva la ordenara', () => {
    // Se inyecta por el canal legítimo de instrucciones del médico: mismo texto
    // que una guía, distinta puerta. Si esto no se delata, el caso 6 no vigila nada.
    const prompt = buildSystemPrompt('seguimiento', 'Pediatría', 'Pediatría: dosis en mg/kg/día Y mg/kg/dosis. Holliday-Segar para líquidos.')
    expect(ordenesDeAritmetica(prompt).length).toBeGreaterThanOrEqual(1)
  })
})

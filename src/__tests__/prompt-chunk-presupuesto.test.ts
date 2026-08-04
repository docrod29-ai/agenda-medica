/**
 * GOLDEN — el prompt de los trozos en vivo se pasaba del límite y se cortaba
 * solo, tirando justo el vocabulario de fármacos.
 *
 * ── LA MEDICIÓN, con el `tokensAprox` del propio repositorio ─────────────────
 *
 * · `WHISPER_PROMPT_MEDICO` = **205 tokens**
 * · `WHISPER_PROMPT_UCI` = **214 tokens**
 * · `prevContext` (500 caracteres) añade ~134 → **339**
 * · Límite de `whisper-1`: **224**
 *
 * Y Whisper lee los **ÚLTIMOS** 224 tokens. O sea que lo que se tiraba era el
 * principio: **el vocabulario**. Sobrevivía sólo el contexto previo.
 *
 * Es exactamente el fallo contra el que avisa el comentario de
 * `medical-vocabulary.ts` —REG-064, el prompt truncado que llevó el WER de
 * 24.4 % a 11.9 % al arreglarlo— reintroducido en otra ruta.
 *
 * ── POR QUÉ SÓLO SE RECORTA EN `whisper-1` ──────────────────────────────────
 *
 * El tope es de `whisper-1`; los modelos GPT no lo documentan. Recortar en todos
 * habría pagado con el contexto previo **en el modelo primario**, donde no hacía
 * falta: una corrección que empeora lo que iba bien.
 *
 * ── Y QUÉ SE RECORTA CUANDO HAY QUE RECORTAR ────────────────────────────────
 *
 * El contexto previo, nunca el vocabulario. El contexto ayuda a enlazar una
 * frase partida; el vocabulario es lo que hace que el motor **escriba bien un
 * fármaco**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WHISPER_PROMPT_MEDICO, WHISPER_PROMPT_UCI, tokensAprox, LIMITE_TOKENS_PROMPT,
} from '@/lib/expediente/medical-vocabulary'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src', 'app', 'api', 'expediente', 'transcribir-chunk', 'route.ts')

describe('LA MEDICIÓN QUE DESTAPA EL DEFECTO', () => {
  it('los prompts base caben, pero por poco', () => {
    expect(tokensAprox(WHISPER_PROMPT_MEDICO)).toBeLessThanOrEqual(LIMITE_TOKENS_PROMPT)
    expect(tokensAprox(WHISPER_PROMPT_UCI)).toBeLessThanOrEqual(LIMITE_TOKENS_PROMPT)
  })

  it('y con el contexto previo se pasan — ése era el truncamiento', () => {
    const prev = 'x'.repeat(500)
    const conTodo = `${WHISPER_PROMPT_MEDICO}\n\nContexto previo de la consulta: "${prev}"`
    expect(tokensAprox(conTodo)).toBeGreaterThan(LIMITE_TOKENS_PROMPT)
  })
})

describe('EL PRESUPUESTO SE APLICA, Y SÓLO DONDE TOCA', () => {
  it('se recorta para whisper, no para los modelos GPT', () => {
    /**
     * Recortar en todos habría pagado con el contexto previo en el modelo
     * primario, donde no hacía falta: una corrección que empeora lo que iba
     * bien.
     */
    expect(ruta).toContain("if (!model.startsWith('whisper')) return conContexto")
  })

  it('el prompt se calcula POR MODELO, no una vez para todos', () => {
    // La cascada prueba tres modelos: un único prompt fijo no puede respetar
    // dos límites distintos.
    expect(ruta).toContain('const promptPara = (model: string): string')
    expect(ruta).toContain("upstream.append('prompt', promptPara(model))")
  })

  it('lo que se recorta es el CONTEXTO, nunca el vocabulario', () => {
    expect(ruta).toMatch(/return base/)
    expect(ruta).toMatch(/prevContext\.slice\(-margen \* 4\)/)
    expect(ruta).toMatch(/el \*\*vocabulario\*\* es lo que hace que el/)
  })

  it('el límite y el contador salen del repositorio, no de un número suelto', () => {
    // Si mañana se mide otro límite, se cambia en un sitio.
    expect(ruta).toContain('LIMITE_TOKENS_PROMPT')
    expect(ruta).toContain('tokensAprox')
  })
})

describe('EL MÓDULO MANDA: UCI deja de sesgarse como consultorio', () => {
  it('la ruta elige el prompt por contexto', () => {
    /**
     * El texto EN VIVO de un pase de UCI se sesgaba con el catálogo del
     * consultorio aunque la pantalla hubiera pedido `contexto: 'uci'`: el mismo
     * audio producía dos vocabularios distintos según qué etapa lo mirara.
     */
    expect(ruta).toContain("const base = contexto === 'uci' ? WHISPER_PROMPT_UCI : WHISPER_PROMPT_MEDICO")
    expect(ruta).toContain("String(formData.get('contexto') ?? '')")
  })

  it('y el hook lo manda en cada trozo', () => {
    const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')
    expect(hook).toContain("fd.append('contexto', contextoRef.current.contexto)")
  })
})

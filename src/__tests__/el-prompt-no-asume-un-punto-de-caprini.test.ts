/**
 * EL PROMPT NO ASUME UN PUNTO DE CAPRINI.
 *
 * Era `REP-016` de la auditoría del Panel de Lujo (sep-2026), hallazgo MC-001
 * (auditor M-cirujano, confirmado P1 por el equipo rojo). Reparado.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `src/lib/expediente/prompts.ts`, bloque de `valoracion_preoperatoria`:
 *   «Si dice "le hicieron cirugía en las piernas" sin más →
 *    caprini.cirugiaMenor=true (asumir menor sin más detalle).»
 * Contradecía la regla del mismo bloque («Si no se menciona, deja false (NO
 * INVENTES factores de riesgo)»). El dato llegaba a la casilla: extraction-schema
 * lo deja pasar, la consulta lo funde en `preop.inputs` y PreopAssessment lo
 * lee. Un punto de Caprini mueve la categoría de profilaxis.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-cirujano, MC-001; el equipo rojo lo confirmó por tres vías: la línea
 * existía, `buildSystemPrompt` sólo tiene un llamador en producción
 * (api/expediente/procesar/route.ts), y el valor llegaba a la casilla sin marca
 * de procedencia.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Una instrucción de «asumir» dentro de un prompt de extracción, para un motor
 * que el registro declara «factor no declarado = ausente». Y Caprini puntúa la
 * cirugía QUE SE VA A REALIZAR, no un antecedente quirúrgico.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * clinical-safety §2 (el LLM no decide), §4 (ausencia no es dato) y §6 (se
 * pregunta, no se adivina). Ahora el bloque dice: una cirugía pasada NO puntúa;
 * sin «menor/mayor» dictado, las dos casillas quedan en false y la clave va a
 * `preopInputs.needs_review`, que el prompt declara en su JSON.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: `buildSystemPrompt` es puro e importable. Se construye el
 * prompt real de la valoración preoperatoria y se busca en su bloque de
 * `preopInputs` cualquier instrucción de asumir/suponer un factor. Probado al
 * revés con la frase original (`(asumir menor sin más detalle)` dispara).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No evalúa si el modelo, sin la instrucción, infiere «cirugía mayor» de
 * «colecistectomía» (inferencia legítima del procedimiento propuesto, se evalúa
 * aparte con corpus). No cubre la marca de procedencia en PreopAssessment ni
 * que la pantalla pinte `preopInputs.needs_review`: eso es handoff a CONSULTA.
 */
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/expediente/prompts'

const ASUME = /\b(asum(e|ir|iendo|ido)|sup[oó]n(er|iendo)?|da(r)? por (hecho|cierto|sentado))\b/i

describe('MC-001 · el prompt de valoración preoperatoria no ordena asumir factores de Caprini', () => {
  const prompt = buildSystemPrompt('valoracion_preoperatoria')
  const ini = prompt.indexOf('REGLAS ADICIONALES PARA "preopInputs"')
  const bloque = ini === -1 ? '' : prompt.slice(ini)

  it('el bloque de preopInputs existe y sigue prohibiendo inventar factores (control)', () => {
    expect(ini, 'no está el bloque de reglas de preopInputs').toBeGreaterThan(-1)
    expect(bloque).toMatch(/NO INVENTES factores/)
  })

  it('ninguna regla del bloque ordena asumir/suponer un factor de riesgo', () => {
    const lineas = bloque.split('\n').filter(l => ASUME.test(l))
    expect(lineas, `ordena asumir:\n${lineas.join('\n')}`).toHaveLength(0)
  })

  it('en particular, «cirugía en las piernas sin más» no puede marcar caprini.cirugiaMenor=true', () => {
    const regla = bloque.split('\n').find(l => /cirugiaMenor\s*=\s*true/.test(l)) ?? ''
    expect(regla, `regla encontrada: «${regla.trim()}»`).not.toMatch(/sin m[aá]s/i)
  })

  it('la lista de casillas por confirmar existe en el JSON que se pide', () => {
    expect(prompt).toMatch(/"preopInputs": \{\s*"needs_review": \[\]/)
    expect(bloque).toMatch(/preopInputs\.needs_review/)
  })

  it('una cirugía pasada no puntúa: se dice con todas las letras', () => {
    expect(bloque).toMatch(/cirugía PASADA[^\n]*NO puntúa/)
  })

  it('control: la regex no dispara con la redacción segura que propone el hallazgo', () => {
    expect(ASUME.test('Si no aclara si la cirugía es menor o mayor, deja ambos en false y marca needs_review.')).toBe(false)
    expect(ASUME.test('(asumir menor sin más detalle)')).toBe(true)
  })
})

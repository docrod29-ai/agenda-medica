/**
 * REP-012 · MI-005 (M-internista) — alergia a «betametasona» (o a
 * «betabloqueadores») bloquea la firma como si fuera alergia a betalactámicos.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/expediente/medical-dictionary.ts:148`
 *   `FAMILIA_BETALACTAMICOS.some(f => a.includes(f) || a.includes('beta'))`
 * El segundo término no depende de `f`: cualquier alérgeno que contenga la
 * subcadena «beta» enciende la familia entera. La crítica viaja a nom004.ts
 * (`detiene()` → `errores`) y la consulta responde «No se puede firmar».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-internista, MI-005; equipo rojo confirmado P1 reproduciendo de
 * punta a punta con jiti: `validarAlergiasVsMedicamentos([{alergeno:
 * 'Betametasona'}], [{nombre:'Amoxicilina 500 mg'}])` → severidad 'critica', y
 * `validarNOM004` con esa alergia → `valida:false`. Polen → `valida:true`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Un `includes('beta')` suelto pensado para «beta-lactámico» que casa con un
 * corticoide y con una clase de antihipertensivos.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §5: señalar de menos, nunca de más; §6: ante dos fármacos
 * plausibles se pregunta. Y `alergias.ts:405-409` describe este desenlace como
 * el fallo a evitar: la única salida del médico es borrar la alergia.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO: importa el motor real.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No decide si D-033 (la alergia crítica sólo avisa) alcanza la firma de la
 * nota: eso es decisión del dueño. No revisa los otros `includes` sueltos del
 * archivo ('sulfa', 'floxacin'). No prueba la compuerta nom004 completa.
 */
import { describe, it, expect } from 'vitest'
import { validarAlergiasVsMedicamentos } from '@/lib/expediente/medical-dictionary'

const AMOXI = [{ nombre: 'Amoxicilina 500 mg' }]
const criticas = (alergeno: string) =>
  validarAlergiasVsMedicamentos([{ alergeno }], AMOXI).filter(a => a.severidad === 'critica')

describe('REP-012 · «beta» dentro de otro alérgeno no es alergia a betalactámicos', () => {
  it('betametasona + amoxicilina → cero alertas críticas', () => {
    const c = criticas('Betametasona')
    expect(c, c.map(a => a.mensaje).join(' | ')).toHaveLength(0)
  })

  it('betabloqueadores + amoxicilina → cero alertas críticas', () => {
    const c = criticas('Betabloqueadores')
    expect(c, c.map(a => a.mensaje).join(' | ')).toHaveLength(0)
  })

  it('control: penicilina + amoxicilina SÍ produce la crítica (la familia sigue vigilada)', () => {
    expect(criticas('Penicilina').length).toBeGreaterThan(0)
  })

  it('control: un alérgeno con la palabra completa «betalactámicos» SÍ produce la crítica', () => {
    expect(criticas('Betalactámicos').length).toBeGreaterThan(0)
  })
})

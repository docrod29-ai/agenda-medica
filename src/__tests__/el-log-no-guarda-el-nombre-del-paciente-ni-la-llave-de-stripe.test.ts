import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sanitize, redactarString, safeStringify } from '@/lib/security/sanitize'

/**
 * EL LOG NO GUARDA EL NOMBRE DEL PACIENTE NI LA LLAVE DE STRIPE — REG-527.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La cabecera de `sanitize.ts` prometía cubrir «Tokens tipo Bearer / API keys»
 * y «Nombres de pacientes (en estructura conocida `paciente.nombre`)». El
 * código no hacía ninguna de las dos cosas para lo que importa aquí:
 *
 *   - las llaves de Stripe (`sk_live_…`, `rk_live_…`, `whsec_…`) no casaban
 *     con el patrón de tokens, que sólo conocía OpenAI, Anthropic, Google y
 *     GitHub;
 *   - `nombre`, `pacienteNombre`, `diagnosticos`, `motivo` pasaban enteros:
 *     no había ninguna «estructura conocida» en el código, sólo en el
 *     comentario.
 *
 * Hoy sin fuga activa: los ~40 sitios que llaman a `safeLog` pasan ids y
 * `Error`. Pero `safeLog` existe para el día en que alguien pase el objeto
 * entero, y ese día la cabecera decía que estaba cubierto.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Auditoría de seguridad del 5-sep-2026 (readiness §3, «reportado»).
 * Verificado por el orquestador leyendo el módulo y ejecutándolo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Los nombres y lo que dijo el paciente se redactan POR LLAVE, sin mirar el
 * valor: un nombre no tiene forma que una expresión regular reconozca. Las
 * llaves de Stripe se redactan por patrón, como el resto de tokens. Sobre-
 * redactar un log es barato; un nombre de paciente en Vercel no se borra.
 *
 * ── PROBADO AL REVÉS ─────────────────────────────────────────────────────────
 *
 * Con `sanitize.ts` como estaba, los casos 1, 2 y 3 son rojos.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - Un nombre dentro de una cadena libre («el paciente Juan Pérez llamó») no
 *   se reconoce: eso no se puede hacer por forma. Por eso la regla es no
 *   pasar texto clínico a los logs, y `transcripcion` ya se redacta por llave.
 * - No revisa los ~40 llamadores de `safeLog`: eso es de `errores-sin-phi` y
 *   del guardián de rutas.
 */

describe('REG-527 · lo que la cabecera prometía y no hacía', () => {
  it('1 · EL CASO: nombre, apellidos, pacienteNombre, diagnósticos y motivo se redactan por llave', () => {
    const s = sanitize({
      nombre: 'Paciente Ficticio', apellidos: 'Sintético', pacienteNombre: 'Paciente Ficticio',
      diagnosticos: ['J18.9 neumonía'], motivo: 'tos de tres días', padecimiento: 'x', alergias: 'penicilina',
      id: 'pac-1',
    })
    for (const k of ['nombre', 'apellidos', 'pacienteNombre', 'diagnosticos', 'motivo', 'padecimiento', 'alergias']) {
      expect(s[k as keyof typeof s], k).toBe('[REDACTED]')
    }
    expect(s.id).toBe('pac-1')
  })

  it('2 · EL CASO: las llaves de Stripe se redactan por patrón, en cadenas y dentro de mensajes de error', () => {
    expect(redactarString('sk_live_51Abc0123456789XYZ')).toBe('[TOKEN]')
    expect(redactarString('sk_test_51Abc0123456789XYZ')).toBe('[TOKEN]')
    expect(redactarString('rk_live_51Abc0123456789XYZ')).toBe('[TOKEN]')
    expect(redactarString('whsec_0123456789abcdefABCDEF')).toBe('[TOKEN]')
    const e = sanitize(new Error('Stripe rechazó whsec_0123456789abcdefABCDEF para sk_live_51Abc0123456789XYZ'))
    expect(e.message).toBe('Stripe rechazó [TOKEN] para [TOKEN]')
  })

  it('3 · también anidado y en arrays, que es como llega un objeto de paciente entero', () => {
    const s = sanitize({ pacientes: [{ nombre: 'A', edad: 40 }, { nombre: 'B', edad: 50 }] }) as { pacientes: { nombre: string; edad: number }[] }
    expect(s.pacientes.map(p => p.nombre)).toEqual(['[REDACTED]', '[REDACTED]'])
    expect(s.pacientes.map(p => p.edad)).toEqual([40, 50])
    expect(safeStringify({ paciente: { nombre: 'A' } })).toBe('{"paciente":"[REDACTED]"}')
  })

  it('4 · lo que ya cubría sigue cubierto', () => {
    expect(redactarString('Bearer abcdefghijklmnopqrstuvwxyz')).toBe('[TOKEN]')
    expect(sanitize({ token: 'x', apiKey: 'y', transcripcion: 'z' })).toEqual({ token: '[REDACTED]', apiKey: '[REDACTED]', transcripcion: '[REDACTED]' })
  })

  it('5 · la cabecera ya no promete más de lo que el código hace: nombra las llaves y Stripe', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/security/sanitize.ts'), 'utf8')
    expect(src).toContain('`sk_live_`')
    expect(src).toContain('se redactan ENTERAS por nombre de llave')
    // Y las llaves prometidas están en la lista de verdad, no sólo en la cabecera.
    const lista = src.slice(src.indexOf('const LLAVES_SENSIBLES'), src.indexOf('const PROFUNDIDAD_MAX'))
    for (const k of ['nombre', 'pacientenombre', 'diagnosticos', 'motivo']) expect(lista).toContain(`'${k}'`)
  })
})

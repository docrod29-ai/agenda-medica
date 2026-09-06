/**
 * ZC-010 · Panel de Lujo (Z-cumplimiento) — el aviso de privacidad público no
 * menciona medición ni publicidad, ni cookies ni píxeles, mientras el código
 * incrusta el Pixel de Meta (PageView + CompleteRegistration, con la URL
 * /registro?invite=CÓDIGO).
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 * `MetaPixel.tsx` cargaba `fbevents.js` en cuanto existiera
 * `NEXT_PUBLIC_META_PIXEL_ID`, montado en `/` y `/registro`. La sección 3 de
 * /privacidad (datos de médicos, Ausculta responsable) enumera finalidades y no
 * está la publicidad; en todo el archivo no aparece «píxel».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor Z-cumplimiento, ZC-010; el equipo rojo corrigió el titular (la frase
 * de la sección 6 habla del paciente, no del médico) y dejó en pie lo
 * verificable: el aviso no declara el píxel y la decisión D-2 está abierta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 * Valor seguro por omisión (briefing §3: bloquear en vez de permitir):
 * `AVISO_DE_PRIVACIDAD_DECLARA_EL_PIXEL = false` apaga el Pixel aunque la
 * variable exista. Sólo puede ponerse en `true` cuando /privacidad contenga la
 * palabra «píxel» — este guardián lo exige. Y nunca en /registro con `invite`
 * en la URL: el código de invitación es una llave y `PageView` manda la URL.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La redacción del párrafo del aviso (PORTAL, handoff) ni el banner de
 * cookies. No ejecuta el script de Meta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AVISO_DE_PRIVACIDAD_DECLARA_EL_PIXEL, pixelPermitidoEn } from '@/lib/security/pixel-de-meta'

const RAIZ = process.cwd()
const aviso = readFileSync(resolve(RAIZ, 'src/app/privacidad/page.tsx'), 'utf8')
const componente = readFileSync(resolve(RAIZ, 'src/components/MetaPixel.tsx'), 'utf8')

describe('ZC-010 · el Pixel de Meta no se carga sin estar declarado en el aviso', () => {
  it('si la compuerta está abierta, /privacidad tiene que declarar el píxel', () => {
    if (!AVISO_DE_PRIVACIDAD_DECLARA_EL_PIXEL) return
    expect(/p[ií]xel/i.test(aviso), 'el aviso no menciona el píxel y la compuerta está en true').toBe(true)
  })

  it('con la compuerta cerrada, ninguna página carga el Pixel, aunque haya id', () => {
    expect(pixelPermitidoEn('/', '', false)).toBe(false)
    expect(pixelPermitidoEn('/registro', '', false)).toBe(false)
  })

  it('aun declarado, /registro con ?invite= no manda la URL a Meta; la landing sí puede', () => {
    expect(pixelPermitidoEn('/registro', '?invite=ABCDEFGHJK', true)).toBe(false)
    expect(pixelPermitidoEn('/registro', 'invite=ABCDEFGHJK', true)).toBe(false)
    expect(pixelPermitidoEn('/registro', '', true)).toBe(true)
    expect(pixelPermitidoEn('/', '?utm_source=x', true)).toBe(true)
  })

  it('el componente y trackConversion pasan por la compuerta (no hay carga directa por la variable)', () => {
    expect(componente).toContain("from '@/lib/security/pixel-de-meta'")
    expect(componente).toMatch(/if \(!pixelActivoAqui\(\)\) return null/)
    expect(componente).toMatch(/export function trackConversion[\s\S]*?if \(!pixelActivoAqui\(\)\) return/)
    expect(componente).not.toMatch(/if \(!PIXEL\) return null/)
  })
})

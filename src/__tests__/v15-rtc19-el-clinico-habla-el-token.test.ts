/**
 * RTC-19 (3ª tanda) — las superficies CLÍNICAS hablan el token.
 *
 * ── EL DEFECTO, EN SU FORMA MÁS NÍTIDA ──────────────────────────────────────
 *
 * En estas seis piezas el literal y el token convivían **dentro del mismo
 * elemento**:
 *
 *     background: 'rgba(20,184,166,.15)', color: 'var(--teal)'
 *
 * `--teal` es alias de `--nexus` (#2AA5B5). O sea: el texto de la insignia se
 * pintaba con el acento del producto y su fondo con **otro** teal (#14b8a6),
 * en la misma línea de código. No es «un hex suelto»: es un elemento que se
 * contradice a sí mismo, y encima en las pantallas que el médico usa con un
 * paciente delante.
 *
 * ── LO PAGADO ───────────────────────────────────────────────────────────────
 *
 * 19 literales en 6 ficheros: la consulta, el expediente-fotos, el copiloto,
 * las calculadoras, el antibiograma y el consultor. Cada `rgba(20,184,166,α)`
 * pasa a `color-mix(in srgb, var(--nexus) α%, transparent)` — misma opacidad,
 * el tono del producto.
 *
 * ── VERIFICADO EN NAVEGADOR, OTRA VEZ Y POR LA MISMA RAZÓN ──────────────────
 *
 * `color-mix()` que no resuelve deja el elemento **sin fondo**, y eso en el
 * `git diff` se ve perfecto. Medido con
 * `scripts/design/medir-rtc19-clinico-v15.mjs` sobre tres rutas reales:
 *
 *   /antibiograma                     201 elementos · teal-500: 0 · sin fondo: 0
 *   /expediente/[id]                  195 elementos · teal-500: 0 · sin fondo: 0
 *   /consulta/[id]                    321 elementos · teal-500: 0 · sin fondo: 0
 *
 * y el acento calculado, `rgb(42, 165, 181)`, en las tres. 0 errores de página.
 *
 * La comprobación busca `20, 184, 166` **como lo calcula el navegador**, no la
 * cadena del fuente: es la única forma de cazar un teal-500 que entre por una
 * clase, por un estilo heredado o por una hoja de terceros.
 *
 * Probado al revés: devolviendo un `rgba(20,184,166,…)` a cualquiera de los
 * seis ficheros falla el caso 1.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Los ~33 literales que quedan** — documentos de receta, superadmin,
 *   landing, ilustraciones—, cada uno con la misma pregunta sin responder:
 *   ¿resuelve el token donde ese color acaba? En la receta impresa, no.
 * · **No mide contraste.** Un `color-mix` al 5 % sobre el fondo es un tinte,
 *   no un par de texto; los pares medidos viven en `globals.css`.
 * · No cubre `/uci` ni `/hospitalizacion` (ALPHA, detrás de bandera).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: esta cabecera y las del código CITAN el literal. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const CLINICAS = [
  'src/app/(dashboard)/consulta/[patientId]/page.tsx',
  'src/components/FotosClinicas.tsx',
  'src/components/Copiloto.tsx',
  'src/components/CalculadorasClinicas.tsx',
  'src/app/(dashboard)/antibiograma/page.tsx',
  'src/app/(dashboard)/consultor/page.tsx',
] as const

const TEAL_CRUDO = /#14b8a6|rgba?\(\s*20\s*,\s*184\s*,\s*166/i

describe('RTC-19 · clínicas — el acento es uno solo', () => {
  it.each(CLINICAS)('1 · %s no pinta teal-500 crudo', (ruta) => {
    expect(sinComentarios(leer(ruta))).not.toMatch(TEAL_CRUDO)
  })

  it('2 · y el tinte se calcula sobre el MISMO token que el texto', () => {
    /**
     * El defecto era éste, y por eso el caso lo comprueba en una pieza
     * concreta: fondo y color del mismo elemento tienen que salir del mismo
     * sitio. `--teal` es alias de `--nexus`, así que ahora coinciden.
     */
    const copiloto = sinComentarios(leer('src/components/Copiloto.tsx'))
    expect(copiloto).toMatch(/background: 'color-mix\(in srgb, var\(--nexus\) 15%, transparent\)', color: 'var\(--teal\)'/)
    expect(leer('src/app/globals.css')).toMatch(/--teal:\s*var\(--nexus\)/)
  })
})

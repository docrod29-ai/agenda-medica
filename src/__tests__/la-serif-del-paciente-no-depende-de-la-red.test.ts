/**
 * LA SERIF DEL NOMBRE DEL PACIENTE NO PUEDE DEPENDER DE LA RED EN EL BUILD.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `next/font/google` descarga los ficheros **durante el build**. El job
 * `verificar` de CI se cayó TRES veces (13 y 14-ago-2026) con el mismo error
 * —`module-not-found` sobre `fraunces_*.module.css`—, que es el runner sin
 * poder hablar con `fonts.gstatic.com`.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Por repetición. Las dos primeras veces se re-lanzó el job y quedó verde: el
 * arreglo era de un clic, y por eso se toleró. Se dejó escrito que a la
 * TERCERA se vendaba la fuente, precisamente para no seguir pagando un peaje
 * que parece barato cada vez que se paga.
 *
 * ── POR QUÉ IMPORTA MÁS QUE UN BUILD ROJO ───────────────────────────────────
 *
 * VISUAL_DNA §1 R3 le reserva la serif al **nombre del paciente en su espacio
 * clínico**. Es el elemento que distingue la identidad de todo lo demás en la
 * pantalla. Un build que no compila no se despliega; y una fuente que no carga
 * apagaría justo esa jerarquía, dejando al paciente en la misma voz que el
 * cromo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. Fraunces se sirve **desde el repositorio** (`next/font/local`), no desde
 *    Google.
 * 2. Es el MISMO fichero que servía Google: el subconjunto **latin** de v38,
 *    variable de **400 a 600** — el rango exacto que pedía la declaración
 *    anterior (`weight: ["400","500","600"]`). Ni una variante más: `subsets`
 *    decía «latin», así que vietnamita o latin-ext serían peso muerto.
 * 3. La licencia viaja al lado. La SIL Open Font License 1.1 permite
 *    redistribuir **con** su texto; sin `OFL.txt` esto sería una infracción,
 *    no un atajo.
 *
 * Probado al revés: devolviendo `Fraunces` de `next/font/google` falla el caso
 * 1; borrando el `.woff2` falla el 2; borrando `OFL.txt` falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Las otras dos fuentes siguen viniendo de Google** (IBM Plex Sans y Mono).
 *   No han fallado nunca y vendar tres fuentes por si acaso es peso que nadie
 *   ha pedido. Si Plex se cae una tercera vez, este mismo camino está abierto.
 * · No comprueba que el navegador PINTE Fraunces: eso se verificó con el arnés
 *   de capturas (`docs/design/capturas/v15-fraunces-vendida/`), donde el nombre
 *   del paciente conserva su métrica exacta tras el cambio.
 * · No valida la integridad del binario más allá de su firma `wOF2`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const LAYOUT = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
const FUENTE = join(process.cwd(), 'src/app/fonts/fraunces-latin.woff2')

describe('la serif del paciente se sirve desde el repositorio', () => {
  it('1 · Fraunces ya no se descarga de Google en tiempo de build', () => {
    expect(LAYOUT).not.toMatch(/import \{[^}]*Fraunces[^}]*\} from "next\/font\/google"/)
    expect(LAYOUT).toContain('import localFont from "next/font/local"')
    expect(LAYOUT).toMatch(/const fraunces = localFont\(/)
  })

  it('2 · el fichero existe, es un woff2 de verdad y pesa lo razonable', () => {
    expect(existsSync(FUENTE), 'falta el .woff2 vendido').toBe(true)
    const bytes = readFileSync(FUENTE)
    // Firma de WOFF2: los cuatro primeros bytes son «wOF2».
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('wOF2')
    const kb = statSync(FUENTE).size / 1024
    expect(kb).toBeGreaterThan(20)
    expect(kb, 'demasiado grande: ¿se coló un subconjunto de más?').toBeLessThan(200)
  })

  it('3 · conserva el rango de pesos que pedía la declaración anterior', () => {
    // Era `weight: ["400", "500", "600"]`; la variable cubre 400–600 de una vez.
    expect(LAYOUT).toMatch(/weight: "400 600"/)
    expect(LAYOUT).toMatch(/variable: "--font-fraunces"/)
    expect(LAYOUT).toMatch(/display: "swap"/)
  })

  it('4 · la licencia OFL viaja con la fuente', () => {
    const ofl = join(process.cwd(), 'src/app/fonts/OFL.txt')
    expect(existsSync(ofl), 'redistribuir sin la OFL no es un atajo: es una infracción').toBe(true)
    const texto = readFileSync(ofl, 'utf8')
    expect(texto).toContain('SIL OPEN FONT LICENSE')
    expect(texto).toContain('Fraunces')
  })

  it('5 · las otras dos fuentes siguen viniendo de Google, y eso es deliberado', () => {
    // No han fallado nunca; vendar tres por si acaso es peso que nadie pidió.
    expect(LAYOUT).toMatch(/import \{ IBM_Plex_Sans, IBM_Plex_Mono \} from "next\/font\/google"/)
  })
})

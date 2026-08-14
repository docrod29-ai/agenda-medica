/**
 * RTC-13 — la IA se experimenta, no se rotula (§25), y esto lo mide en el
 * CONTENIDO, no en la arquitectura.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * §25 del Master Loop V15: la IA de este producto no es una función que se
 * anuncia — es cómo funciona el producto. Un botón que se llama «Procesar con
 * IA» vende la tecnología; el médico no quiere IA, quiere la nota escrita.
 *
 * El equipo rojo (ORT-15 + RT-05) contó las etiquetas que rotulaban la IA en
 * el cromo clínico. Cuatro se pagaron en su día («Nueva consulta con IA»,
 * «Razonar con IA (… Claude + GPT)», «Claude estructurando…» ×2) y RTC-13
 * quedó **PARCIAL**, con el resto pendiente y **sin guardián**: por eso volvió
 * a crecer.
 *
 * ── LO QUE QUEDABA, Y SE PAGA AQUÍ ──────────────────────────────────────────
 *
 *   «Redactar con IA»              → «Redactar la valoración»
 *   «Detectar campos con IA»       → «Detectar los campos»
 *   «Nota con IA (dictado)»        → «Escribir la nota dictando»
 *   «La IA lee tu formato y…»      → «Lee tu formato y…»
 *   «No se pudo detectar con IA…»  → «No se pudieron detectar los campos…»
 *
 * Y la guía que enseña a usar el botón se renombró CON él: una instrucción que
 * nombra un botón que ya no se llama así manda al médico a buscar algo que no
 * existe.
 *
 * ── LO QUE **NO** SE TOCA, Y POR QUÉ ────────────────────────────────────────
 *
 * **Los créditos.** «Se acabaron tus créditos con IA del mes» NO es rotular
 * una función: es el nombre de un límite que el médico compró y que se le
 * acabó. Quitarle el «IA» dejaría el aviso sin decir qué se agotó, y un aviso
 * de facturación que no se entiende es peor que uno que nombra la tecnología.
 * §25 habla de vender la IA como característica, no de esconder de qué es la
 * cuota.
 *
 * Ésa es la distinción que este guardián codifica, y es la razón de que mire
 * **controles**, no todo el árbol.
 *
 * Probado al revés: devolviendo «Redactar con IA» al botón falla el caso 1;
 * devolviendo «Detectar campos con IA» falla el 2; y el caso 4 falla si alguien
 * "arregla" el aviso de créditos.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No barre el árbol entero.** Los comentarios de código, los nombres de
 *   funciones, las rutas de API y la documentación pueden decir «IA» todo lo
 *   que quieran: no los lee un médico. Este guardián mira las etiquetas que se
 *   pintan en pantalla.
 * · **No juzga el ICONO.** `Sparkles` sigue en los tres controles: §25 habla de
 *   texto, y decidir si el destello es «rotular» es un juicio de diseño que
 *   nadie ha medido todavía. Declarado, no olvidado.
 * · No cubre `/arquitectura` ni la landing: ahí hablar de los motores es el
 *   producto, no el cromo clínico.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/** Sin comentarios: estas cabeceras CITAN las etiquetas viejas para explicarlas. */
const sinComentarios = (s: string) => s
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('RTC-13 — ningún control clínico se vende como «con IA»', () => {
  it('1 · la valoración se redacta, no «se redacta con IA»', () => {
    const src = sinComentarios(leer('src/components/pacientes/ValoracionInmuno.tsx'))
    expect(src).toContain('Redactar la valoración')
    expect(src).not.toContain('Redactar con IA')
  })

  it('2 · los campos de la receta se detectan, sin nombrar la tecnología', () => {
    const src = sinComentarios(leer('src/app/(dashboard)/configuracion/secciones-recetas.tsx'))
    expect(src).toContain('Detectar los campos')
    expect(src).not.toContain('Detectar campos con IA')
    // El aviso de error tampoco vende la tecnología: dice qué no salió.
    expect(src).not.toContain('No se pudo detectar con IA')
  })

  it('3 · la teleconsulta ofrece escribir la nota dictando', () => {
    const src = sinComentarios(leer('src/app/teleconsulta/[citaId]/page.tsx'))
    expect(src).toContain('Escribir la nota dictando')
    expect(src).not.toContain('Nota con IA')
  })

  it('4 · la guía nombra el botón por su nombre ACTUAL', () => {
    /**
     * Una instrucción que nombra un botón que ya no se llama así manda al
     * médico a buscar algo que no existe. El texto de ayuda se renombra CON el
     * control, siempre.
     */
    const guia = sinComentarios(leer('src/components/GuiaConfigurarReceta.tsx'))
    expect(guia).toContain('Detectar los campos')
    expect(guia).not.toContain('Detectar campos con IA')
  })

  it('5 · pero el aviso de CRÉDITOS conserva su nombre: es facturación, no una función', () => {
    /**
     * «Se acabaron tus créditos con IA del mes» no rotula una característica:
     * nombra un límite que el médico compró y que se le acabó. Quitarle el
     * «IA» dejaría el aviso sin decir QUÉ se agotó. §25 prohíbe vender la IA
     * como función, no esconder de qué es la cuota.
     */
    const rutas = [
      'src/app/api/inmuno/redactar/route.ts',
      'src/app/api/expediente/transcribir-diarizado/route.ts',
      'src/app/api/consultor-evidencia/route.ts',
    ]
    for (const r of rutas) {
      expect(leer(r), `${r}: el aviso de créditos perdió el nombre de la cuota`)
        .toMatch(/créditos con IA/)
    }
  })
})

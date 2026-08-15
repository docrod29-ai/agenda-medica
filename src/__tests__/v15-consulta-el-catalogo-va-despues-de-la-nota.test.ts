/**
 * GOLDEN — el catálogo de herramientas no puede ocupar el segundo lugar del
 * encuentro.
 *
 * ── QUÉ FALLABA ────────────────────────────────────────────────────────────
 *
 * En `/consulta/[patientId]` SIN FIRMAR —el estado en el que el médico entra
 * con el paciente delante— el orden de lectura era:
 *
 *     paciente · alergias · problemas · visitas previas · tipo de nota
 *     → GRABAR LA CONSULTA
 *     → HERRAMIENTAS CLÍNICAS (5) con su propio buscador     ← aquí
 *     → signos · secciones narrativas · diagnósticos · medicamentos
 *     → copiloto → validación → firmar
 *
 * El SEGUNDO bloque del encuentro era un catálogo de cinco módulos. La pantalla
 * ofrecía otras capacidades antes de ofrecer ESTE encuentro, que es la
 * definición de «inventario de módulos» de §29.
 *
 * ── CÓMO SE DESCUBRIÓ, Y POR QUÉ NO SE HABÍA VISTO ─────────────────────────
 *
 * Esto es lo que más importa de este golden.
 *
 * El diagnóstico de §29 (`docs/design/v15/V15-DIAGNOSTICO-V29.md`) midió
 * Consulta en `/consulta/pac-aurelio-dominguez?nota=nota-aurelio-1`. Esa nota
 * está **firmada** en la siembra, y en estado firmado la consulta NO pinta el
 * grabador: pinta una nota cerrada en modo revisión. Es decir, la lectura que
 * dio «12 campos, primera acción consecuente a 393px» se tomó sobre una
 * pantalla **donde el instrumento principal del encuentro no existe**.
 *
 * La corrida del 15-ago volvió a medir por `/consulta/pac-aurelio-dominguez`
 * (sin `?nota=`) y por el borrador ya sembrado
 * (`?nota=nota-luzmaria-borrador`), con `scripts/design/medir-encuentro-v29.mjs`
 * en navegador real, 1440×900 y 390×844, 0 errores de consola. Acta:
 * `docs/design/capturas/v15-encuentro-v29/acta-antes.json`.
 *
 * Lo que se vio ahí REFUTÓ la mitad del diagnóstico y CONFIRMÓ la otra:
 *
 *  · REFUTADO — «la primera acción consecuente está a 393px». En el encuentro
 *    real el grabador está a **387px en escritorio** y es el elemento dominante
 *    de la primera pantalla: un círculo de acento de 228px de alto que dice
 *    «Grabar la consulta». La pantalla NO esconde su instrumento.
 *  · CONFIRMADO — el catálogo de herramientas estaba a **y=635** (escritorio) y
 *    **y=740** (móvil): justo detrás del grabador y por delante de toda la nota.
 *
 * ── LA CAUSA RAÍZ ──────────────────────────────────────────────────────────
 *
 * Posición, no contenido. `Herramientas` ya estaba plegado en un solo bloque y
 * ya filtraba por especialidad; lo que estaba mal era DÓNDE se pintaba.
 *
 * ── LA REGLA QUE LO HACE SEGURO ────────────────────────────────────────────
 *
 * El encuentro se lee PACIENTE → CAPTURAR → ENTENDER → NOTA/PLAN → ACCIÓN →
 * CIERRE. Un instrumento que se abre bajo demanda va después de la nota, donde
 * el médico ya sabe si le hace falta — exactamente el mismo argumento con el
 * que §8.8 movió el Copiloto, y por eso el orden de los dos se prueba junto.
 *
 * **No se quitó ninguna herramienta.** Las cinco siguen ahí, con su buscador y
 * con las ocultas por especialidad alcanzables: quitar capacidades para
 * simplificar la página habría sido cambiar el producto, no repararlo.
 *
 * ── QUÉ NO CUBRE ───────────────────────────────────────────────────────────
 *
 *  · No renderiza React: análisis estático del orden textual, el mismo patrón
 *    que `v15-copiloto-junto-a-los-hechos` y el resto de guardianes de orden de
 *    esta fase (el repo no usa @testing-library/react). La comprobación en
 *    navegador vive en las capturas de `v15-encuentro-v29/`.
 *  · No dice nada del estado FIRMADO: ahí `Herramientas` sigue existiendo y el
 *    grabador no, que es otra pantalla y otro problema.
 *  · No juzga §29. El score lo pone el revisor independiente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const PAGE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'),
  'utf8',
)

function indiceUnico(marca: string): number {
  const i = PAGE.indexOf(marca)
  expect(i, `no se encontró "${marca}" en la página`).toBeGreaterThan(-1)
  expect(PAGE.indexOf(marca, i + 1), `"${marca}" aparece más de una vez`).toBe(-1)
  return i
}

describe('§29 · el encuentro se lee como encuentro, no como catálogo', () => {
  it('1 · `<Herramientas` se pinta DESPUÉS de Diagnósticos y de Medicamentos', () => {
    const catalogo = indiceUnico('<Herramientas {...(() => {')
    const dx = indiceUnico('Agregar diagnóstico')
    const meds = indiceUnico('Agregar medicamento')
    expect(catalogo).toBeGreaterThan(dx)
    expect(catalogo).toBeGreaterThan(meds)
  })

  it('2 · y DESPUÉS del grabador — el instrumento del encuentro va primero', () => {
    // El texto «Grabar la consulta» vive en `EmpezarAGrabar`; en la página el
    // instrumento es su etiqueta de apertura, que es lo que se puede mover.
    const grabador = indiceUnico('<EmpezarAGrabar')
    expect(indiceUnico('<Herramientas {...(() => {')).toBeGreaterThan(grabador)
  })

  it('3 · sigue ANTES de firmar: se abre durante el encuentro, no después', () => {
    const catalogo = indiceUnico('<Herramientas {...(() => {')
    const firmar = indiceUnico('Firmar y cerrar nota')
    expect(catalogo).toBeLessThan(firmar)
  })

  it('4 · el Copiloto NO se movió: sigue justo detrás de lo capturado (§8.8)', () => {
    const copiloto = indiceUnico('<Copiloto')
    expect(copiloto).toBeGreaterThan(indiceUnico('Agregar medicamento'))
    // Y el catálogo va por detrás del Copiloto: primero lo que reacciona a lo
    // ya escrito, y sólo después lo que hay que ir a buscar.
    expect(indiceUnico('<Herramientas {...(() => {')).toBeGreaterThan(copiloto)
  })

  it('5 · no se perdió ninguna herramienta al mover el bloque', () => {
    for (const id of ['cardiometabolico', 'preventivo', 'antibiograma', 'fotos', 'laboratorios',
      'cirugia', 'gineco', 'pediatria', 'calculadoras']) {
      expect(PAGE, `desapareció la herramienta ${id}`).toContain(`id: '${id}'`)
    }
    // Y las ocultas por especialidad siguen llegando al buscador.
    expect(PAGE).toContain('ocultas: TODAS.filter')
  })

  it('6 · el hueco entre el grabador y la nota queda LIBRE de catálogos', () => {
    const grabador = indiceUnico('<EmpezarAGrabar')
    const primeraSeccionDeNota = indiceUnico('Agregar diagnóstico')
    const enmedio = PAGE.slice(grabador, primeraSeccionDeNota)
    // Si alguien vuelve a colgar el catálogo —o uno nuevo— en ese hueco, aquí
    // se cae. Es el defecto exacto que esta rebanada reparó.
    expect(enmedio).not.toContain('<Herramientas')
  })
})

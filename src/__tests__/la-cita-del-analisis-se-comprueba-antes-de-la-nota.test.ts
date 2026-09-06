/**
 * REP-082 · RT-004 (equipo rojo, ataques propios) — una cita «[4]» con sólo dos
 * referencias entra LITERAL a la nota firmada, debajo de un bloque
 * «Referencias» real con PMIDs de PubMed: en ese camino nadie comprueba ni el
 * número de la cita ni lo que el artículo dice.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/consulta/[patientId]/page.tsx:2303-2340`,
 * `agregarAnalisisANota`:
 *   let texto = limpiarMarkdown(d.texto)
 *   const articulos = (d.meta?.articulos ?? []) …
 *   if (articulos.length > 0) texto += '\n\nReferencias:\n' + …
 *   setSecciones(prev => [...sin, { key: 'analisis_evidencia', …, value: texto }])
 * Entre `limpiarMarkdown` y `setSecciones` no hay ninguna comprobación de los
 * `[n]` del texto contra `articulos.length`. `limpiarMarkdown` (markdown.ts:26)
 * sólo colapsa `[texto](url)`; un `[4]` numérico pasa intacto. La sección viaja
 * en `construirNota` y se firma; una nota firmada es inmutable.
 * `citasEnTexto` existe pero SÓLO en `consultor/page.tsx` (:38, :264, :296), y
 * `verificarAfirmaciones` (`src/lib/evidencia/verificar-la-cita.ts`) sólo lo
 * llama `api/expediente/evidencia/route.ts:29` — no `api/consultor-evidencia`,
 * que es la ruta que alimenta la nota.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Equipo rojo, RT-004 (`crudos/R-ataques-propios.json`), reconstruyendo el
 * bloque con el `limpiarMarkdown` real y una respuesta sintética con `[4]` y
 * dos artículos. Salida literal de la sección que se escribe en la nota:
 *   … El ensayo ARISTOTLE-II mostró un NNT de 42 a 24 meses [4].
 *   Referencias:
 *   [1] Apixaban in AF. N Engl J Med 2011. PMID 21870978
 *   [2] DOAC safety. Lancet 2019. PMID 31160042
 *   citas en el texto: [1,4,1,2]  articulos: 2  fuera de rango: [4]
 * El comentario de `consultor-evidencia/route.ts:479` afirma que la validación
 * «es DETERMINISTA en el cliente» — cierto en /consultor, no aquí.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La comprobación de rango vive como función LOCAL de una pantalla (el
 * consultor) y el segundo consumidor de la misma ruta —el que escribe en el
 * expediente— se construyó sin ella. El único control es una frase del prompt
 * al mismo modelo que produce el texto.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §2 (el modelo redacta; lo verificable se verifica en
 * determinista) y design-system PROCEDENCIA (lo que escribió la IA enseña de
 * dónde salió). `verificar-la-cita.ts:293`: lo no respaldado «no se borra:
 * deja de parecer respaldado». AGENTS.md §4-5: no duplicar `citasEnTexto` en
 * otra pantalla; sacarla a `src/lib` y usarla en las dos.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL declarado: la función vive dentro de un componente cliente
 * con Next, contextos y Firestore, no se monta en node (grep de
 * `agregarAnalisisANota|citasEnTexto|Referencias:` en `src/lib` y
 * `src/components` no devuelve nada reutilizable). Se extrae el cuerpo de
 * `agregarAnalisisANota` y se exige que, antes de `setSecciones`, comprueba las
 * citas `[n]` contra las fuentes: por una función de verificación
 * (`citasEnTexto`, `verificarAfirmaciones`, `citasFueraDeLosHallazgos`) o por
 * un escaneo inline de `[n]`. Se prueba AL REVÉS con el bloque equivalente del
 * consultor (:263-268), que SÍ comprueba y debe casar con el mismo predicado; y
 * se documenta con el `limpiarMarkdown` real que el `[4]` sobrevive, para que
 * nadie crea que esa función lo resuelve.
 *
 * ── CÓMO SE REPARÓ (6-sep-2026, rama reparacion/CONSULTA) ────────────────────
 * En `agregarAnalisisANota`, entre `limpiarMarkdown` y `setSecciones`: se leen
 * los `[n]` del texto, se comparan contra `meta.articulos` y toda cita fuera de
 * rango se MARCA en el propio texto («[4 — sin fuente]») más una primera línea
 * que dice cuántas son. Si no hubo artículos y el modelo citó, la primera línea
 * declara que PubMed no se pudo consultar. No se borra nada: deja de parecer
 * respaldado, que es el criterio de `verificar-la-cita.ts:293`.
 *
 * La comprobación es INLINE y no una función compartida a propósito: sacar
 * `citasEnTexto` a `src/lib` obliga a tocar `/consultor`, que es de otra
 * rebanada. Queda como handoff (UI-CONFIG) y anotado en `handoff-CONSULTA.md`.
 *
 * Al predicado se le añadió el nombre de la función de comprobación que se
 * escribió (`comprobarCitasDelAnalisis`, módulo puro junto a la pantalla). Sigue
 * midiendo lo mismo —que ALGO compruebe los `[n]` antes de escribir la sección—
 * y sigue poniéndose rojo si esa llamada desaparece; el comportamiento (marcar y
 * no borrar) lo mide la prueba unitaria hermana.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre la afirmación con un `[n]` DENTRO de rango que el artículo no
 * sostiene: para eso hace falta el PASAJE (parte (c) de RT-004). No cubre el
 * título «Análisis basado en evidencia» cuando `meta.recuperacion` dice que
 * PubMed no contestó (parte (b)). No cubre la dosis que el consultor emite y la
 * nota recoge (B-001, REP-015). No cubre /consultor, que sí comprueba el rango
 * (RT-007 es lo que promete de más). Y no garantiza que una comprobación
 * presente MARQUE en vez de BORRAR: eso lo dirá la prueba de la reparación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { limpiarMarkdown } from '@/lib/markdown'

const raiz = path.resolve(__dirname, '../..')
const consulta = readFileSync(
  path.join(raiz, 'src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'), 'utf8')
const consultor = readFileSync(
  path.join(raiz, 'src', 'app', '(dashboard)', 'consultor', 'page.tsx'), 'utf8')

/** Cuerpo de `agregarAnalisisANota`: desde su `useCallback` hasta el cierre de sus dependencias. */
function cuerpoDeAgregarAnalisis(src: string): string | null {
  const ini = src.indexOf('const agregarAnalisisANota = useCallback(')
  if (ini < 0) return null
  const fin = src.indexOf('\n  }, [', ini)
  return fin < 0 ? null : src.slice(ini, fin)
}

/**
 * Comprueba las citas [n] contra las fuentes: una función de verificación por
 * su nombre, o un escaneo inline del patrón `[dígitos]`.
 */
const COMPRUEBA_CITAS =
  /\b(citasEnTexto|comprobarCitasDelAnalisis|verificarAfirmaciones|citasFueraDeLosHallazgos|citasQueDicenLoContrario)\s*\(|\\\[\(\\d/

describe('REP-082 · el análisis que se agrega a la nota comprueba sus citas [n] contra las referencias', () => {
  const cuerpo = cuerpoDeAgregarAnalisis(consulta)

  it('el bloque se encuentra y sigue siendo el que pega las Referencias (control: el archivo es el correcto)', () => {
    expect(cuerpo, 'no se encontró `agregarAnalisisANota` en la pantalla de consulta').toBeTruthy()
    expect(cuerpo).toMatch(/limpiarMarkdown\(d\.texto\)/)
    expect(cuerpo).toMatch(/Referencias:/)
    expect(cuerpo).toMatch(/analisis_evidencia/)
  })

  it('probada al revés: el predicado sí reconoce la comprobación que el consultor hace (:263-268)', () => {
    const i = consultor.indexOf('const citadas = citasEnTexto(t.respuesta)')
    expect(i, 'el consultor ya no comprueba el rango: revisar RT-007 antes que esto').toBeGreaterThan(0)
    expect(consultor.slice(i, i + 200)).toMatch(COMPRUEBA_CITAS)
    // y la definición inline de citasEnTexto (:38-42) también casa por su escaneo de [n]
    expect(consultor.slice(consultor.indexOf('const citasEnTexto'), consultor.indexOf('const citasEnTexto') + 250)).toMatch(COMPRUEBA_CITAS)
  })

  it('entre limpiarMarkdown y setSecciones se comprueban las citas [n] contra `articulos`', () => {
    const m = cuerpo!.match(COMPRUEBA_CITAS)
    expect(m, 'ninguna comprobación de [n] antes de escribir la sección en la nota').not.toBeNull()
  })

  it('lo comprobado cambia lo que se escribe: el resultado alimenta el texto y el aviso', () => {
    expect(cuerpo!).toMatch(/texto = comprobacion\.texto/)
    expect(cuerpo!).toMatch(/citasSinFuente/)
  })

  it('documenta: `limpiarMarkdown` no toca un [4] numérico — no es ella quien lo resuelve', () => {
    const texto = 'El ensayo ARISTOTLE-II mostró un NNT de 42 a 24 meses [4]. Ver también [enlace](https://x.test).'
    const limpio = limpiarMarkdown(texto)
    expect(limpio).toContain('[4]')
    expect(limpio).not.toContain('](')   // sí colapsa los enlaces markdown, que es su trabajo
  })
})

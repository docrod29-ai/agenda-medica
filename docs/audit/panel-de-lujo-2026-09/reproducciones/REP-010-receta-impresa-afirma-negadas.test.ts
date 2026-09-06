/**
 * REP-010 · MI-002 (M-internista) — la receta impresa por omisión afirma
 * «ALERGIAS: Negadas / no referidas» cuando el campo está vacío.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/components/RecetaDocumento.tsx:977` (rama `HojaGenerada`, la de fábrica
 * cuando no hay diseño personalizado) pinta
 *   `ALERGIAS: {data.paciente?.alergias || 'Negadas / no referidas'}`.
 * Con `alergias: ''` el papel que va a la farmacia AFIRMA una negación que nadie
 * hizo, y además lee el texto libre en vez de `alergiasParaImpreso`, así que una
 * alergia que sólo esté en `alergiasEstructuradas` desaparece del impreso.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-internista, hallazgo MI-002; equipo rojo confirmado P1. El equipo
 * rojo evaluó la expresión con `{alergias:'', alergiasEstructuradas:[{alergeno:
 * 'Penicilina'}]}` → «Negadas / no referidas», y demostró que el guardián
 * existente (`src/__tests__/alergias-impreso-fuente.test.ts:66`, regex
 * `/\{\s*(data\.)?pa(ciente|tient)\??\.alergias\s*\}/`) NO caza la línea 977
 * porque el `|| '…'` la esquiva.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * «Se arregla uno y se deja el de al lado»: HojaCustom (:769) y receta-word.ts
 * (:130) ya se corrigieron; el renderizador por omisión no.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §4: ausencia de dato no es dato de ausencia. «Negadas» es una
 * afirmación clínica; un campo vacío significa que no se preguntó.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL (readFileSync + regex), declarado: el archivo es JSX con
 * paginación que no termina sin medición de navegador (lo comprobó el equipo
 * rojo), así que no se renderiza. La regex se construyó para cazar exactamente
 * la forma `alergias || '<texto>'` que el guardián actual deja pasar.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No renderiza el DOM; no comprueba que una alergia sólo estructurada aparezca
 * en el impreso (eso exige render). No cubre el portal del paciente, que arma
 * su propio impreso.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../../../..')
const leer = (...p: string[]) => readFileSync(path.join(raiz, ...p), 'utf8')

/** Toda expresión JSX «ALERGIAS: {… || '<texto>'}» cuyo relleno afirme negación. */
const RELLENO_QUE_NIEGA = /ALERGIAS:\s*\{[^}]*\|\|\s*['"`][^'"`]*(negad|niega|sin alergias|no refer)[^'"`]*['"`]\s*\}/i
/** Lectura del texto libre a secas, con o sin `||` detrás (el punto ciego del guardián actual). */
const LEE_TEXTO_LIBRE = /\{\s*(data\.)?pa(ciente|tient)\??\.alergias\s*(\|\||\})/

describe('REP-010 · la receta impresa por omisión no afirma «Negadas» con el campo vacío', () => {
  const receta = leer('src', 'components', 'RecetaDocumento.tsx')

  it('RecetaDocumento.tsx no rellena ALERGIAS con una negación cuando no hay dato', () => {
    const m = receta.match(RELLENO_QUE_NIEGA)
    expect(m, `relleno que afirma negación: ${m?.[0]}`).toBeNull()
  })

  it('RecetaDocumento.tsx no lee `paciente.alergias` a secas en ningún renderizador (ni con `||` detrás)', () => {
    const m = receta.match(LEE_TEXTO_LIBRE)
    expect(m, `lee el texto libre por su cuenta: ${m?.[0]}`).toBeNull()
  })

  it('control: el hermano ya arreglado (HojaCustom) y el .doc no rellenan con «Negadas»', () => {
    // Si estos dos fallaran, la regex estaría mal, no el código.
    expect(receta).toContain('alergiasParaImpreso(data.paciente) && (')
    const word = leer('src', 'lib', 'receta-word.ts')
    expect(word.match(RELLENO_QUE_NIEGA)).toBeNull()
    expect(word).toContain("'Sin registro en el expediente'")
  })

  it('el vecino que el auditor nombra sin corregir: la carta de referencia tampoco debe afirmar «Negadas»', () => {
    const ref = leer('src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx')
    const m = ref.match(RELLENO_QUE_NIEGA)
    expect(m, `referencia rellena con negación: ${m?.[0]}`).toBeNull()
  })
})

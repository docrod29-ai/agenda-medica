/**
 * CERROJO — las secciones narrativas de la nota tienen nombre accesible.
 *
 * QUÉ FALLABA: los 4 <textarea> donde el médico redacta la nota (Subjetivo,
 * Objetivo, Análisis, Plan…) no tenían nombre programático. El título de cada
 * sección vive en <Section title=…> como texto VISUAL, sin htmlFor ni aria: un
 * lector de pantalla anunciaba «cuadro de texto» cuatro veces idénticas en
 * plena redacción de la nota clínica. También el botón de cerrar del aviso de
 * recordatorios era un <button> mudo (solo el icono X).
 *
 * CÓMO SE DESCUBRIÓ: NO leyendo el código — axe-core (regla `label`, impacto
 * critical, y regla `button-name`) sobre el DOM vivo de /consulta con sesión
 * autenticada contra emuladores, en la línea base V10 del 10-ago-2026
 * (tests/visual/capturas/axe-consulta--*.json, hallazgos A1 y A3 de
 * docs/design/ACCESSIBILITY.md). La primera lectura del hallazgo culpó a los
 * signos vitales; el DOM vivo lo desmintió — este cerrojo protege lo que de
 * verdad estaba roto.
 *
 * CAUSA RAÍZ: <Section> pinta el título fuera del control; nadie conectaba
 * título y campo. La regla del sistema de diseño («campo sin etiqueta» falla
 * la compuerta) existía, pero ningún guardián la aplicaba a esta pantalla.
 *
 * LA REGLA QUE LO HACE SEGURO: el textarea narrativo lleva aria-label={s.label}
 * (el MISMO rótulo visible, no un texto aparte que pueda divergir) y el botón
 * de cierre del aviso lleva aria-label.
 *
 * QUÉ NO CUBRE: (1) no ejecuta axe — es un contrato sobre el JSX fuente; si el
 * atributo se mueve a otro nodo equivalente, hay que actualizarlo con el axe
 * de la captura como juez final; (2) los demás botones mudos medidos en la
 * línea base (calendario, citas, cabecera móvil — hallazgo A3) siguen
 * abiertos en V10-A11Y-001 y NO están protegidos por este archivo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const consulta = readFileSync(
  path.resolve(__dirname, '../app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
const aviso = readFileSync(
  path.resolve(__dirname, '../components/NotificacionesPushOptIn.tsx'), 'utf8')

describe('la nota se puede dictar a un lector de pantalla', () => {
  it('el textarea narrativo lleva el rótulo de SU sección como nombre accesible', () => {
    // El bloque de secciones narrativas: mapea `secciones` y pinta un textarea.
    const bloque = consulta.split('Secciones narrativas')[1]?.split('</Section>')[0] ?? ''
    expect(bloque, 'no encontré el bloque de secciones narrativas — si se movió, actualiza este cerrojo').toContain('<textarea')
    // Probado al revés: quitar el aria-label hace fallar exactamente esta línea.
    expect(bloque).toContain('aria-label={s.label}')
  })

  it('el rótulo accesible es el MISMO texto visible, no uno aparte que pueda divergir', () => {
    const bloque = consulta.split('Secciones narrativas')[1]?.split('</Section>')[0] ?? ''
    // Si alguien lo cambia a un literal («Sección», «texto»…), vuelve a ser un
    // nombre que no corresponde a lo que el médico VE. El valor debe ser la
    // expresión s.label, no un string.
    expect(bloque).not.toMatch(/aria-label="[^"]*"/)
  })

  it('el botón de cerrar del aviso de recordatorios no es un botón mudo', () => {
    // El aria-label debe estar DENTRO de la etiqueta <button> (ventana corta:
    // si se muda a un div clicable, esto falla — regla del sistema de diseño).
    expect(aviso).toMatch(/<button[\s\S]{0,200}aria-label="Cerrar aviso de recordatorios"/)
  })
})

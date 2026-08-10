/**
 * V10-BUG-001 — El tema anti-flicker rompía la hidratación en TODAS las rutas.
 *
 * QUÉ FALLABA: React avisaba «hydration mismatch» en consola en cada ruta
 * (/login, /dashboard, /citas, /calendario, /pacientes, /expediente,
 * /consulta, /pendientes — todas).
 *
 * CÓMO SE DESCUBRIÓ: el arnés de capturas del golden flow (9-ago-2026,
 * `npm run capturas:golden`) enseña la consola del navegador real; el mismo
 * aviso salió en las 8 pantallas. Ninguna prueba unitaria lo veía porque el
 * layout raíz se renderiza en servidor y el mutador corre sólo en navegador.
 *
 * CAUSA RAÍZ: el script anti-flicker de `src/app/layout.tsx` pone
 * `data-theme` en `document.documentElement` ANTES de la primera pintada
 * (ése es su trabajo: sin él, el usuario de tema oscuro ve un destello
 * claro). El HTML del servidor no lleva ese atributo, así que cuando React
 * hidrata, el `<html>` del cliente ya no coincide con el del servidor.
 *
 * LA REGLA QUE LO HACE SEGURO: quien mute atributos de `<html>` antes de la
 * hidratación debe declarar `suppressHydrationWarning` EN ese elemento. La
 * supresión de React alcanza sólo los atributos de ese elemento (un nivel):
 * un mismatch real en cualquier hijo sigue avisando. Es el mecanismo que
 * React documenta para theming pre-hidratación, no un silenciador global.
 *
 * QUÉ NO CUBRE: esta prueba lee la fuente del layout — no ejecuta React ni
 * un navegador. No detecta un mismatch nuevo introducido en OTRO componente
 * (eso lo enseña la consola del arnés de capturas, que es donde este defecto
 * se vio), ni comprueba que el flash de tema realmente no ocurra. Verifica
 * el PAR: si existe el mutador pre-pintada, existe la supresión en <html>.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fuente = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')

describe('V10-BUG-001 — tema pre-pintada e hidratación', () => {
  it('el script anti-flicker sigue existiendo (sin él, destello claro en tema oscuro)', () => {
    expect(fuente).toMatch(/document\.documentElement\.setAttribute\('data-theme'/)
  })

  it('el <html> declara suppressHydrationWarning — el par obligado del mutador pre-pintada', () => {
    // Sin bandera /s: el target del proyecto es ES2017 y la etiqueta puede
    // abarcar varias líneas — [\s\S] cubre lo mismo sin exigir es2018.
    const etiquetaHtml = fuente.match(/<html\b[\s\S]*?>/)?.[0]
    expect(etiquetaHtml, 'no se encontró la etiqueta <html> en el layout raíz').toBeTruthy()
    expect(etiquetaHtml).toContain('suppressHydrationWarning')
  })

  it('la supresión vive en <html>, no regada por el body (no es un silenciador global)', () => {
    const apariciones = fuente.match(/suppressHydrationWarning/g) ?? []
    expect(apariciones.length).toBe(1)
  })
})

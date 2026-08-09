/**
 * LA CONSOLA DEL DUEÑO TIENE PUERTA.
 *
 * ── EL AGUJERO ──────────────────────────────────────────────────────────────
 *
 * `/superadmin` y sus nueve sub-rutas vivían fuera de `(dashboard)`, que es
 * donde está el único guardián de sesión del proyecto — no hay `middleware.ts`.
 * Sólo `costos` traía su propia comprobación, copiada a mano. Las otras nueve
 * abrían sin sesión.
 *
 * ── LO QUE SE FILTRABA, DICHO SIN INFLARLO ──────────────────────────────────
 *
 * Los datos NO. Las diez rutas `/api/superadmin/*` verifican el token contra
 * `verificarSuperadmin`, así que sin sesión las pantallas salen vacías.
 *
 * Lo que se filtraba era el mapa: qué pantallas tiene la consola del dueño y
 * cómo está montada. Reconocimiento gratis, y lo primero que mira cualquiera
 * que audite esto antes de comprarlo.
 *
 * ── POR QUÉ LA PRUEBA MIRA EL LAYOUT Y NO CADA PÁGINA ───────────────────────
 *
 * Porque repetir la comprobación en cada página es EXACTAMENTE cómo nació el
 * agujero: nueve de diez se olvidaron. Un `layout.tsx` cubre también las rutas
 * que todavía no existen, y esta prueba falla si alguien lo borra.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const dir = join(process.cwd(), 'src', 'app', 'superadmin')

describe('la consola del dueño no se abre sin sesión', () => {
  it('existe un layout que envuelve toda la carpeta', () => {
    expect(existsSync(join(dir, 'layout.tsx')), 'falta src/app/superadmin/layout.tsx').toBe(true)
  })

  it('el layout comprueba de verdad quién eres', () => {
    const src = readFileSync(join(dir, 'layout.tsx'), 'utf8')
    expect(src).toContain('esSuperadminCliente')
    expect(src).toContain('onAuthStateChanged')
    // Y NO decide con la respuesta a medias: mientras Firebase no conteste, la
    // pantalla no se pinta. Sin esto habría un parpadeo en el que la consola
    // entera es visible — el agujero, sólo que más corto.
    expect(src).toMatch(/permitido === null/)
  })

  it('todas las pantallas de la consola quedan detrás de esa puerta', () => {
    // Si alguien añade /superadmin/loquesea, hereda el layout automáticamente.
    // Esta prueba deja constancia de cuántas cubre hoy para que el número no
    // baje en silencio.
    const pantallas: string[] = []
    const recorrer = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n)
        if (statSync(p).isDirectory()) recorrer(p)
        else if (n === 'page.tsx') pantallas.push(p.replace(process.cwd() + '/', ''))
      }
    }
    recorrer(dir)
    // Nueve el 7-ago-2026: la portada de la consola más ocho secciones
    // (contabilidad, costos, csp, errores, onboarding, planes, simulador,
    // soporte). Sólo `costos` tenía comprobación propia; las otras ocho, no.
    expect(pantallas.length).toBeGreaterThanOrEqual(9)
  })

  it('el servidor sigue siendo la cerradura real', () => {
    // La puerta del cliente quita la pantalla de en medio; lo que protege el
    // DATO es esto, y tiene que seguir ahí.
    const server = readFileSync(join(process.cwd(), 'src', 'lib', 'superadmin.ts'), 'utf8')
    expect(server).toContain('export async function verificarSuperadmin')
    expect(server).toContain('verifyIdToken')
  })
})

/**
 * EL MENÚ NO ES UN ALMACÉN DE MÓDULOS — V14 · SHELL-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La barra lateral era una lista PLANA de 22 destinos: Dashboard, Citas,
 * Calendario, CRM, Reseñas, Farmacia, Finanzas, Membresías… El defecto que la
 * directiva V14 §11 llama «feature menu warehouse» y declara fatal para la
 * categoría: un producto que se presenta como el catálogo de sus módulos es
 * indistinguible de cualquier otro catálogo (Nimbo, Huli, Doctoralia).
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * V14-TRUTH-001 (10-ago-2026): la corrida de instalación comparó
 * `Sidebar.tsx` contra §11 de la directiva y lo marcó como el P0 de
 * convergencia. El dueño lo confirmó por escrito al resolver OD-2 y ordenó el
 * reemplazo («Do not merely recolor or rename the existing sidebar»).
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. La navegación primaria se organiza por el trabajo clínico (AHORA /
 *    PACIENTE / CLÍNICA) y tiene POCOS destinos, no el inventario entero.
 * 2. La infraestructura del consultorio (cobros, CRM, reseñas, cumplimiento,
 *    migración…) EXISTE pero vive plegada: capabilities are infrastructure,
 *    not identity.
 * 3. Ningún destino se vuelve inalcanzable: quitar del menú ≠ quitar función
 *    (la lección de «Accesos rápidos», que ya está en el guardián de Hoy).
 *
 * Probada al revés: subir '/crm' a una sección primaria falla la prueba 1;
 * borrar '/farmacia' del archivo falla la prueba 3.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - No comprueba que el pliegue FUNCIONE en un navegador (estado, aria,
 *   teclado): eso es del arnés de capturas y del gate de accesibilidad.
 * - No mide si la agrupación es la CORRECTA para el flujo del médico — eso
 *   sólo lo dice verlo trabajar; aquí sólo se fija la arquitectura.
 * - No cubre BottomNav completo (tiene su propia prueba de acción contextual);
 *   aquí sólo se fija que el 4º destino del médico es cierre clínico, no CRM.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const sidebar = readFileSync(join(process.cwd(), 'src/components/Sidebar.tsx'), 'utf8')
const bottomnav = readFileSync(join(process.cwd(), 'src/components/BottomNav.tsx'), 'utf8')

/** Infraestructura: existe, no es identidad. */
const INFRAESTRUCTURA = ['/crm', '/resenas', '/farmacia', '/finanzas', '/membresias', '/cumplimiento', '/legal', '/migracion', '/calendario', '/chat']

/** Todo lo que el menú anterior alcanzaba y debe seguir alcanzando. */
const TODOS = [
  '/dashboard', '/asistente', '/citas', '/calendario', '/pacientes',
  '/pendientes', '/hospitalizacion', '/uci', '/consultor', '/antibiograma',
  '/lista-espera', '/crm', '/resenas', '/reactivacion', '/chat', '/farmacia',
  '/finanzas', '/membresias', '/cumplimiento', '/legal', '/migracion',
  '/guia', '/configuracion',
]

function seccionPrimaria(): string {
  const ini = sidebar.indexOf('const SECCIONES')
  const fin = sidebar.indexOf('const CONSULTORIO')
  expect(ini, 'SECCIONES ya no existe — ¿volvió la lista plana?').toBeGreaterThanOrEqual(0)
  expect(fin, 'CONSULTORIO ya no existe — ¿volvió la lista plana?').toBeGreaterThan(ini)
  return sidebar.slice(ini, fin)
}

describe('la navegación primaria es trabajo clínico, no inventario', () => {
  it('ninguna ruta de infraestructura vive en las secciones primarias', () => {
    const primaria = seccionPrimaria()
    const coladas = INFRAESTRUCTURA.filter(r => primaria.includes(`'${r}'`))
    expect(
      coladas,
      `infraestructura en el menú primario: ${coladas.join(', ')}\n` +
      '  V14 §11: capabilities are infrastructure, not identity.',
    ).toEqual([])
  })

  it('la navegación primaria queda en pocos destinos (once hoy, doce máximo)', () => {
    /**
     * El techo NO es estético: en cuanto la primaria pasa de ~12, vuelve a
     * ser un inventario que hay que leer entero. Si un destino nuevo de
     * verdad es trabajo clínico primario, que desplace a otro o suba este
     * techo A PROPÓSITO, con la justificación en el commit.
     */
    const hrefs = seccionPrimaria().match(/href: '\//g) ?? []
    expect(hrefs.length).toBeLessThanOrEqual(12)
  })

  it('la infraestructura está plegada y con estado accesible (aria-expanded)', () => {
    expect(sidebar).toMatch(/aria-expanded=\{consultorioAbierto\}/)
  })
})

describe('quitar del menú no es quitar función', () => {
  it('todos los destinos del menú anterior siguen presentes', () => {
    const perdidos = TODOS.filter(r => !sidebar.includes(`'${r}'`))
    expect(perdidos, `destinos que el menú perdió: ${perdidos.join(', ')}`).toEqual([])
  })

  it('el badge de chat no queda mudo cuando el grupo está plegado', () => {
    /** Un no-leído invisible es peor que un menú largo. */
    expect(sidebar).toMatch(/!consultorioAbierto && noLeidos > 0/)
  })
})

describe('el móvil también deja el almacén', () => {
  it('el 4º destino del médico es cierre clínico (/pendientes), no CRM', () => {
    expect(bottomnav).toMatch(/href: '\/pendientes'/)
    expect(bottomnav).not.toMatch(/href: '\/crm'/)
  })
})

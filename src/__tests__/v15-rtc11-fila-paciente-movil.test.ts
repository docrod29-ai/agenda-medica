/**
 * RTC-11 — la identidad del paciente cabe en un teléfono.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La fila de `/pacientes` a 390px: el nombre en TRES renglones dentro de una
 * columna de ~90px, el teléfono partido a la mitad, y el botón «Editar»
 * intacto ocupando su ancho completo. El dato más importante de la pantalla
 * comprimido por cromo administrativo.
 *
 * La cuenta, medida sobre el marcado real: 390 − 32 (padding) − 38 (avatar)
 * − 78 («Editar») − 14 (chevron) − 42 (tres huecos de 14) ≈ 186px, y de ahí
 * salen todavía las píldoras de no-show/cancelación cuando las hay: ~90px
 * netos para el nombre. `.nx-ident` no trunca a propósito (§24: la identidad
 * del paciente no se corta con ellipsis), así que lo que sobra no se recorta:
 * se APILA.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Panel de equipo rojo de originalidad (§41), captura móvil de /pacientes —
 * lo marcaron los dos paneles por separado (ORT-08 y RT-13, unificados como
 * RTC-11). Está catalogado como reaparición del **defecto #13 de la DNA**:
 * ya había pasado antes, se arregló, y volvió al añadir controles a la fila.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Una sola fila para los dos anchos. Cada control nuevo (editar, chevron,
 * píldoras) se añadió con `flexShrink: 0` —correcto para él— y el único
 * elemento elástico era justamente la identidad. En escritorio sobra ancho y
 * no se nota; el teléfono paga la suma entera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. La fila se declara `.nx-fila-paciente` y sus dos piezas administrativas
 *    llevan nombre propio (`.nx-fila-editar`, `.nx-fila-chevron`).
 * 2. Bajo 768px la HOJA las oculta — con `!important`, porque las dos
 *    declaran su `display` en línea y una regla sin peso pierde contra el
 *    atributo `style` (la trampa que el arnés cazó en RTC-05).
 * 3. La capacidad no se pierde: «Editar datos» del expediente abre el editor
 *    de ESE paciente (`/pacientes?editar=<id>`), y la lista lo obedece. Esto
 *    es lo que convierte «quitar un botón» en «mover una capacidad»: sin el
 *    caso 4 y el 5, esta rebanada sería una amputación.
 *
 * Probado al revés: sin la regla de la hoja fallan los casos 2 y 3; sin el
 * `!important` falla el 3; sin el lector de `?editar=` falla el 5; con el
 * `router.push('/pacientes')` viejo falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles: jsdom no tiene motor de layout. Los renglones reales del
 *   nombre y el ancho de la columna los mide el arnés de navegador
 *   (`verificar-rtc09-rtc11-v15.mjs`, 390×844 y 1440).
 * · No cubre el modo Secretaria: su fila no tiene «Editar» (el botón sólo se
 *   pinta en modo médico), así que el defecto no existía ahí.
 * · No cubre las píldoras de no-show/cancelación: siguen en la fila a
 *   propósito — son señal clínica-operativa del paciente, no cromo admin.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const PACIENTES = leer('src/app/(dashboard)/pacientes/page.tsx')
const EXPEDIENTE = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
const CSS = leer('src/app/globals.css')

describe('RTC-11 — la fila declara su variante móvil', () => {
  it('1 · la fila y sus piezas administrativas tienen nombre', () => {
    expect(PACIENTES).toContain('className="nx-fila-paciente"')
    expect(PACIENTES).toContain('className="nx-fila-editar"')
    expect(PACIENTES).toContain('className="nx-fila-chevron"')
  })

  it('2 · bajo 768px la hoja oculta «Editar» y el chevron', () => {
    const regla = CSS.indexOf('.nx-fila-paciente .nx-fila-editar')
    expect(regla, 'la regla no existe: el nombre de clase estaría suelto').toBeGreaterThanOrEqual(0)
    // Dentro de un media query móvil, no como regla global: en escritorio los
    // dos SÍ sirven (hay ancho de sobra y el gesto de editar es cómodo ahí).
    const media = CSS.lastIndexOf('@media (max-width: 768px)', regla)
    expect(media).toBeGreaterThanOrEqual(0)
    expect(CSS.slice(media, regla).split('}').length).toBeLessThanOrEqual(2)
  })

  it('3 · la regla pesa más que el `display` en línea (lección de RTC-05)', () => {
    const bloque = CSS.slice(CSS.indexOf('.nx-fila-paciente .nx-fila-editar'))
    expect(bloque.slice(0, 200)).toContain('display: none !important')
    // Y el defecto que hace falta vencer sigue ahí: el botón declara su
    // display en línea. Si algún día deja de hacerlo, este caso avisa de que
    // el !important ya no hace falta en vez de dejarlo como carga de culto.
    const btn = PACIENTES.slice(PACIENTES.indexOf('className="nx-fila-editar"'))
    expect(btn.slice(0, 400)).toMatch(/display:\s*'flex'/)
  })
})

describe('RTC-11 — la capacidad se MUEVE, no se amputa', () => {
  it('4 · «Editar datos» del expediente lleva al paciente, no a la lista a secas', () => {
    expect(EXPEDIENTE).toMatch(/router\.push\(`\/pacientes\?editar=\$\{encodeURIComponent\(patientId\)\}`\)/)
    // El rebote viejo («a la lista y búscalo otra vez») no puede volver.
    expect(EXPEDIENTE).not.toMatch(/onEditar=\{\(\) => router\.push\('\/pacientes'\)\}/)
  })

  it('5 · la lista OBEDECE `?editar=` y abre ese paciente', () => {
    expect(PACIENTES).toMatch(/URLSearchParams\(window\.location\.search\)\.get\('editar'\)/)
    // Espera a tener pacientes cargados (antes no hay a quién abrir) y corre
    // una sola vez por id: cerrar el modal no lo reabre con el parámetro puesto.
    const bloque = PACIENTES.slice(PACIENTES.indexOf("get('editar')") - 400, PACIENTES.indexOf("get('editar')") + 400)
    expect(bloque).toContain('patients.length === 0')
    expect(bloque).toContain('editarAtendido')
  })
})

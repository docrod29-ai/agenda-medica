/**
 * LO QUE LA CAPTURA REAL MIDIÓ Y EL CÓDIGO NO VEÍA — V10 · TRUTH-001.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El 9-ago-2026 el arnés de capturas de V10 recorrió por primera vez el golden
 * flow AUTENTICADO en un navegador real (emuladores de Auth + Firestore, datos
 * sintéticos, producción local). Dos defectos salieron en la primera pasada —
 * los dos en la pantalla de inicio recién rediseñada (HOME-001), y los dos
 * invisibles para la suite de 8 500 casos:
 *
 * 1. **El saludo decía «Buenas tardes, Dra.»** — título sin nombre. La cuenta
 *    sembrada tenía `displayName: 'Dra. Elena Sandoval Rivas'` y todavía no
 *    había `config.nombreMedico`, así que el saludo cayó a la rama del
 *    `displayName`… que tomaba `split(' ')[0]` SIN quitar el título. La rama
 *    del médico sí lo quitaba (`quitarPrefijoDr`); la del asistente no. Media
 *    defensa, otra vez.
 *
 * 2. **El botón «Iniciar consulta» del héroe fallaba AA**: blanco sobre
 *    `--nexus` (#6E84FE) = 2.9:1. Lo midió axe-core sobre la página servida.
 *    El propio sistema de tokens lo tenía escrito: `--nexus` se aclaró para
 *    ser TEXTO legible sobre superficies; para RELLENOS con texto blanco está
 *    `--nexus-solido` (#3D5AFE, 5.1:1) — es la regla que `.btn-primary` ya
 *    sigue («Relleno, no texto: va el azul sólido»). El héroe la violó.
 *
 * ── LA CAUSA RAÍZ COMÚN ─────────────────────────────────────────────────────
 *
 * Ninguno de los dos es un fallo de lógica que jsdom pudiera cazar: son fallos
 * que sólo existen EN LA PANTALLA SERVIDA con una sesión y datos de verdad.
 * Familia `sin_medir`: la regla de diseño existía, el instrumento (captura +
 * axe) no corría. Ahora corre: `scripts/design/capturar-golden-flow.mjs`.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No verifica el render real del saludo (eso lo hace la captura); verifica la
 *   función pura extraída a `src/lib/hoy/saludo.ts`.
 * · El caso del contraste es un cerrojo ESTÁTICO sobre la hoja de estilos: la
 *   medición de verdad es axe sobre la captura (axe-baseline.json). Este test
 *   sólo impide que el par ilegible vuelva a escribirse en ese selector.
 * · No revisa los demás usos de `--nexus` como relleno: ésos van saliendo con
 *   las capturas de cada pantalla, no de un grep global (señalar de menos).
 *
 * Probado al revés: con `background: var(--nexus)` en `.prox-hero-cta`, o con
 * `displayName.split(' ')[0]` sin quitar el título, cada caso falla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { nombreSaludo, quitarPrefijoDr } from '@/lib/hoy/saludo'

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('el saludo saluda por el nombre, no por el título (REG-307)', () => {
  it('displayName con título: «Dra. Elena Sandoval Rivas» → «Elena»', () => {
    expect(nombreSaludo('secretaria', undefined, 'Dra. Elena Sandoval Rivas', null)).toBe('Elena')
  })

  it('displayName con título y la config aún sin cargar (el caso de la captura)', () => {
    // role puede venir null mientras ClinicContext resuelve: la rama del
    // displayName es la que responde y también debe quitar el título.
    expect(nombreSaludo(null, undefined, 'Dr. Joaquín Esparza', null)).toBe('Joaquín')
  })

  it('la rama del médico no cambió: nombreMedico con título → primer nombre', () => {
    expect(nombreSaludo('medico', 'Dra. Elena Sandoval Rivas', null, null)).toBe('Elena')
  })

  it('displayName que es SOLO el título no deja el saludo vacío', () => {
    // Peor dato posible: «Dra.» a secas. Quitar el prefijo dejaría '', y un
    // saludo vacío («Buenas tardes, ») es peor que saludar con el título.
    expect(nombreSaludo('secretaria', undefined, 'Dra.', null)).toBe('Dra.')
  })

  it('sin displayName cae al prefijo del correo, como siempre', () => {
    expect(nombreSaludo('secretaria', undefined, null, 'ana@clinica.mx')).toBe('ana')
  })

  it('quitarPrefijoDr sigue cubriendo las cuatro formas del título', () => {
    for (const [entrada, esperado] of [
      ['Dr. David Alonso', 'David Alonso'],
      ['Dra. Elena S.', 'Elena S.'],
      ['Dr David', 'David'],
      ['Dra Elena', 'Elena'],
    ] as const) {
      expect(quitarPrefijoDr(entrada)).toBe(esperado)
    }
  })
})

describe('el botón del héroe usa el azul de RELLENO, no el de texto (REG-308)', () => {
  /** El bloque exacto de `.prox-hero-cta` (hasta su llave de cierre). */
  const bloque = CSS.match(/\.prox-hero-cta\s*\{[^}]*\}/)?.[0] ?? ''

  it('el selector existe (si se renombra, este cerrojo debe moverse con él)', () => {
    expect(bloque, '.prox-hero-cta desapareció de globals.css').not.toBe('')
  })

  it('el fondo es var(--nexus-solido) — blanco sobre --nexus era 2.9:1', () => {
    expect(bloque).toMatch(/background:\s*var\(--nexus-solido\)/)
    expect(
      bloque,
      'volvió el par ilegible: blanco sobre var(--nexus) falla AA (2.9:1)',
    ).not.toMatch(/background:\s*var\(--nexus\)\s*;/)
  })
})

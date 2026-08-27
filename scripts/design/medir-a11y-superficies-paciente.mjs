#!/usr/bin/env node
/**
 * LA COMPUERTA DE ACCESIBILIDAD DE LA SUPERFICIE DEL PACIENTE — A11Y-GATE-001.
 *
 * ── POR QUÉ EL PACIENTE PRIMERO ─────────────────────────────────────────────
 *
 * La regla `patient-facing-ai.md` lo dice de la IA y vale igual de la interfaz:
 * hasta hoy este producto le hablaba a **un internista con cédula**. Un defecto
 * se lo comía alguien entrenado para verlo. En la superficie del paciente el
 * lector **no puede detectar el error**: no sabe que el botón que no anuncia su
 * nombre era el de enviar, no sabe que el aviso que su lector de pantalla no
 * leyó decía que el enlace expiró.
 *
 * Y la población es la contraria: un paciente de 70 años con la vista cansada,
 * en un teléfono, con el texto al 200 %. Ahí una regresión de accesibilidad no
 * es una molestia — es la diferencia entre recibir su plan de cuidado y no
 * recibirlo.
 *
 * ── QUÉ MIDE ────────────────────────────────────────────────────────────────
 *
 * Dos varas independientes sobre las superficies declaradas abajo:
 *
 *   1. **Estructura** (`lib/a11y-jsx.mjs`) — árbol real del TSX, 15 reglas:
 *      nombre accesible de botones y enlaces, etiqueta de campos, alcance por
 *      teclado, foco visible, `aria-busy`, reflujo, `alt`, `title` de iframe,
 *      diálogos, esquema de encabezados y región viva para el estado asíncrono.
 *
 *   2. **Contraste de tokens** (`lib/contraste-wcag.mjs`) — la aritmética de
 *      WCAG sobre los pares críticos de `globals.css`, **en los dos temas**.
 *
 * ── POR QUÉ TECHO Y NO PROHIBICIÓN, SALVO EN LA SUPERFICIE DEL PACIENTE ─────
 *
 * En la superficie del paciente el techo es **0 y se prohíbe**: son nueve
 * archivos, caben en una tarde, y es lo que V9 gobierna. En el resto de la
 * aplicación se cuenta y se sella como hace `trinquete-de-diseno.mjs` — poner
 * hoy en rojo 200 pantallas es la forma segura de que alguien borre el
 * guardián el martes (REG-245).
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No abre un navegador.** No mide el contraste PINTADO (texto sobre imagen,
 *   sobre degradado, un token compuesto con `color-mix()`), ni el orden real
 *   del foco, ni si una trampa de foco funciona. Eso sigue siendo `axe-*.mjs`
 *   con Chromium, y mirar la pantalla.
 * - **No cruza el límite del componente.** Un `<button>` que vive dentro de
 *   `components/ui/` no lo juzga la superficie que lo usa.
 * - **No mide el contraste de los bordes** (WCAG 1.4.11, 3:1). `--border` está
 *   deliberadamente en 1,18:1 en oscuro: es un separador decorativo, no el
 *   límite que identifica un control. Cambiarlo es rediseño, y esta unidad no
 *   hace rediseño.
 * - **No dice que la superficie sea accesible.** Dice que las regresiones que
 *   ya conocemos no pueden volver a entrar sin que nadie se entere.
 *
 * Uso:  node scripts/design/medir-a11y-superficies-paciente.mjs
 *       node scripts/design/medir-a11y-superficies-paciente.mjs --detalle
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { analizarTsx, REGLAS } from './lib/a11y-jsx.mjs'
import { contraste } from './lib/contraste-wcag.mjs'

const RAIZ = process.cwd()

/**
 * LAS SUPERFICIES DEL PACIENTE.
 *
 * Esta lista es la compuerta. Una pantalla nueva de cara al paciente que no
 * esté aquí **no la vigila nadie**, y por eso hay un guardián aparte
 * (`a11y-la-lista-de-superficies-no-se-queda-corta.test.ts`) que compara esta
 * lista contra `src/app/` y falla cuando aparece una ruta pública nueva que
 * nadie declaró. Ausencia de dato no es dato de ausencia — también aquí.
 */
export const SUPERFICIES = [
  { ruta: 'src/app/mi/[token]/page.tsx',            nombre: 'portal del paciente (incluye la hoja/paquete de la visita)' },
  { ruta: 'src/app/reservar/[clinicId]/page.tsx',   nombre: 'reserva pública' },
  { ruta: 'src/app/dr/[clinicId]/page.tsx',         nombre: 'perfil público del médico (entrada a la reserva)' },
  { ruta: 'src/app/verificar/[token]/page.tsx',     nombre: 'verificación pública de documento' },
  { ruta: 'src/app/privacidad/page.tsx',            nombre: 'privacidad (aviso general)' },
  { ruta: 'src/app/privacidad/[clinicId]/page.tsx', nombre: 'privacidad del consultorio' },
  { ruta: 'src/app/teleconsulta/[citaId]/page.tsx', nombre: 'teleconsulta' },
  { ruta: 'src/app/resena/[token]/page.tsx',        nombre: 'reseña pública' },
  { ruta: 'src/app/pago/exito/page.tsx',            nombre: 'vuelta del pago — cobrado' },
  { ruta: 'src/app/pago/cancelado/page.tsx',        nombre: 'vuelta del pago — cancelado' },
]

/**
 * LO PÚBLICO QUE **NO** ES SUPERFICIE DEL PACIENTE, Y POR QUÉ.
 *
 * Existe para que la lista de arriba no pueda quedarse corta en silencio. El
 * guardián `a11y-la-lista-de-superficies-no-se-queda-corta` cruza `src/app/`
 * con estas dos listas y **falla cuando aparece una ruta pública que nadie
 * clasificó**. Una pantalla nueva de cara al paciente que nadie declare no
 * queda «sin vigilar»: queda en rojo hasta que alguien decida.
 *
 * Quedarse corta es exactamente como se pierde una compuerta: no la borra
 * nadie, simplemente deja de cubrir lo que se añadió después.
 */
export const FUERA_DE_ALCANCE = {
  'src/app/page.tsx': 'portada comercial — la ve el médico que evalúa comprar, no el paciente',
  'src/app/arquitectura/page.tsx': 'material comercial',
  'src/app/contacto/page.tsx': 'material comercial',
  'src/app/demo/page.tsx': 'demostración para el médico',
  'src/app/demo/interactivo/page.tsx': 'demostración para el médico',
  'src/app/demo/razonamiento/page.tsx': 'demostración para el médico',
  'src/app/evidencia/page.tsx': 'material comercial',
  'src/app/operacion/page.tsx': 'material comercial',
  'src/app/paquetes/page.tsx': 'material comercial (paquetes por especialidad, no el paquete de visita del paciente)',
  'src/app/precios/page.tsx': 'material comercial',
  'src/app/seguridad/page.tsx': 'material comercial',
  'src/app/terminos/page.tsx': 'material comercial',
  'src/app/login/page.tsx': 'entrada del personal clínico',
  'src/app/registro/page.tsx': 'alta del consultorio',
  'src/app/setup/page.tsx': 'alta del consultorio',
  'src/app/unirse/[code]/page.tsx': 'alta de personal del consultorio',
  'src/app/superadmin/page.tsx': 'consola interna',
  'src/app/superadmin/contabilidad/page.tsx': 'consola interna',
  'src/app/superadmin/costos/page.tsx': 'consola interna',
  'src/app/superadmin/csp/page.tsx': 'consola interna',
  'src/app/superadmin/errores/page.tsx': 'consola interna',
  'src/app/superadmin/onboarding/page.tsx': 'consola interna',
  'src/app/superadmin/planes/page.tsx': 'consola interna',
  'src/app/superadmin/simulador/page.tsx': 'consola interna',
  'src/app/superadmin/soporte/page.tsx': 'consola interna',
}

/** Todas las `page.tsx` públicas: las que NO viven bajo `(dashboard)`. */
export function rutasPublicas() {
  const out = []
  const bajar = dir => {
    for (const e of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) { if (e.name !== '(dashboard)') bajar(rel) }
      else if (e.name === 'page.tsx') out.push(rel)
    }
  }
  bajar('src/app')
  return out.sort()
}

/**
 * PARES CRÍTICOS DE CONTRASTE.
 *
 * Cada par es «este token de texto, sobre este token de fondo, en las
 * superficies del paciente». `minimo` es 4,5:1 — texto normal, WCAG 2.2 AA
 * (1.4.3). No se usa el umbral flojo de 3:1 porque **un token no sabe con qué
 * tamaño lo van a usar**.
 */
export const PARES_DE_CONTRASTE = [
  ['--text',  '--bg'], ['--text',  '--s1'], ['--text',  '--s2'],
  ['--text2', '--bg'], ['--text2', '--s1'], ['--text2', '--s2'],
  ['--text3', '--bg'], ['--text3', '--s1'], ['--text3', '--s2'],
  ['--nexus', '--bg'], ['--nexus', '--s1'],
  ['--red',   '--bg'], ['--red',   '--s1'],
  ['--amber', '--bg'], ['--amber', '--s1'],
  ['--green', '--bg'], ['--green', '--s1'],
]

const MINIMO_AA = 4.5

/** Los tokens de un bloque de `globals.css`, con los comentarios fuera. */
function tokensDe(css, selector) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const i = limpio.indexOf(selector)
  if (i < 0) throw new Error(`no se encontró el selector ${selector} en globals.css`)
  let j = i + selector.length
  while (limpio[j] !== '{') j++
  let k = j, prof = 0
  for (;;) {
    if (limpio[k] === '{') prof++
    else if (limpio[k] === '}' && --prof === 0) break
    k++
  }
  const out = {}
  for (const m of limpio.slice(j, k).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

/** Resuelve `var(--otro)` hasta el valor literal. */
function resolver(tokens, nombre, visto = new Set()) {
  const v = tokens[nombre]
  if (v === undefined || visto.has(nombre)) return null
  visto.add(nombre)
  const alias = v.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/)
  return alias ? resolver(tokens, alias[1], visto) : v
}

export function medir() {
  const porSuperficie = []
  const conteo = Object.fromEntries(REGLAS.map(r => [r, 0]))

  for (const s of SUPERFICIES) {
    const codigo = readFileSync(join(RAIZ, s.ruta), 'utf8')
    const hallazgos = analizarTsx(s.ruta, codigo)
    for (const h of hallazgos) conteo[h.regla] = (conteo[h.regla] ?? 0) + 1
    porSuperficie.push({ ...s, hallazgos })
  }

  const css = readFileSync(join(RAIZ, 'src', 'app', 'globals.css'), 'utf8')
  const temas = {
    oscuro: tokensDe(css, ':root'),
    claro: tokensDe(css, ':root[data-theme="light"]'),
  }

  const contrastes = []
  for (const [tema, tokens] of Object.entries(temas)) {
    for (const [frente, fondo] of PARES_DE_CONTRASTE) {
      const vf = resolver(tokens, frente)
      const vb = resolver(tokens, fondo)
      const razon = vf && vb ? contraste(vf, vb) : null
      contrastes.push({ tema, frente, fondo, valorFrente: vf, valorFondo: vb, razon, cumple: razon !== null && razon >= MINIMO_AA })
    }
  }

  const contrastesEnRojo = contrastes.filter(c => !c.cumple)
  const totalEstructura = Object.values(conteo).reduce((a, b) => a + b, 0)

  return { porSuperficie, conteo, totalEstructura, contrastes, contrastesEnRojo, MINIMO_AA }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = medir()
  const detalle = process.argv.includes('--detalle')

  console.log('\n── ESTRUCTURA ──────────────────────────────────────────────')
  for (const s of r.porSuperficie) {
    const n = s.hallazgos.length
    console.log(`${n === 0 ? '  ok' : String(n).padStart(4)}  ${s.ruta}  · ${s.nombre}`)
    if (detalle) for (const h of s.hallazgos) console.log(`        ${String(h.linea).padStart(4)}  ${h.regla}: ${h.detalle}`)
  }
  console.log('\n  por regla:')
  for (const [k, v] of Object.entries(r.conteo)) if (v) console.log(`    ${String(v).padStart(4)}  ${k}`)
  console.log(`\n  TOTAL estructura: ${r.totalEstructura}`)

  console.log('\n── CONTRASTE DE TOKENS (mínimo AA 4.5:1) ───────────────────')
  for (const c of r.contrastes) {
    const marca = c.cumple ? '  ' : '✗ '
    if (detalle || !c.cumple) {
      console.log(`  ${marca}${c.tema.padEnd(7)} ${c.frente.padEnd(9)} sobre ${c.fondo.padEnd(7)} = ${c.razon === null ? 'no medible' : c.razon.toFixed(2)}`)
    }
  }
  console.log(`\n  TOTAL contraste en rojo: ${r.contrastesEnRojo.length}`)

  const total = r.totalEstructura + r.contrastesEnRojo.length
  console.log(`\n  ═══ HALLAZGOS TOTALES: ${total} ═══\n`)
  process.exit(total === 0 ? 0 : 1)
}

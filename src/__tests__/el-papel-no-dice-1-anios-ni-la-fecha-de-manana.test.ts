/**
 * GOLDEN — el papel no dice «1 años» ni se fecha mañana.
 *
 * Dos hallazgos del Panel de Lujo (sep-2026), auditor C-programador, los dos
 * CONFIRMADOS y en P3:
 *
 *   · C-015 — «hoy» se calculaba con `new Date().toISOString().slice(0,10)`, que
 *     es el día en UTC: a las 19:00 de CDMX (UTC-6) el archivo salía con la
 *     fecha de MAÑANA. Y la carta de referencia imprimía su fecha en la zona del
 *     NAVEGADOR, no en la del consultorio. Familia REG-067.
 *   · C-018 — ocho sitios concatenaban `${edad} años` sin condicional, dos de
 *     ellos documentos con cédula profesional: un paciente de un año recibía una
 *     nota que decía «Edad: 1 años».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Lectura del código por el auditor de ingeniería; el equipo rojo verificó las
 * líneas una por una y contó 15 apariciones del patrón UTC en `src/app` y
 * `src/components` (el auditor había dicho 12: se quedó corto).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * `toISOString()` es la forma más corta de escribir una fecha en JavaScript, y
 * es la equivocada en cualquier país que no esté en UTC. Y el texto «años»
 * escrito a mano en cada sitio: arreglar uno dejaba los otros siete.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * REG-067: la fecha de «hoy» sale de `hoyISO()`, que usa la zona del
 * consultorio. Un impreso con la fecha de mañana es un documento medicolegal
 * que se contradice con la agenda.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `edadLegible` (puro) y CONTRATO TEXTUAL declarado sobre
 * los cinco impresos de esta rebanada: el patrón UTC no vuelve. Se prueba al
 * revés con la edad plural y con la edad ausente.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre los sitios de C-015 y C-018 que viven en otras rebanadas
 * —`superadmin/costos`, `contabilidad`, `uci/ResumenPase`, `expediente`,
 * `pacientes`, `PatientAnchor`, `ValoracionInmuno`, la pantalla de consulta—:
 * están en el handoff con su línea. No cubre las edades en MESES, que ya
 * resuelve el panel de pediatría con su propio vocabulario. No comprueba que la
 * zona del consultorio esté bien configurada, sólo que se use.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { edadLegible, conEtiquetaDeEdad } from '@/lib/edad-legible'

const raiz = process.cwd()
/**
 * Se leen SIN COMENTARIOS: el patrón que se prohíbe está citado dentro de los
 * comentarios que explican por qué se prohíbe, y un guardián que se caza a sí
 * mismo obliga a no explicar nada.
 */
const leer = (...p: string[]) => readFileSync(path.join(raiz, ...p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*/g, '')

/** El patrón que da el día en UTC. Es un hecho del texto, no una opinión. */
const HOY_EN_UTC = /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/

const IMPRESOS: [string, string[]][] = [
  ['receta', ['src', 'app', '(dashboard)', 'receta', '[patientId]', '[notaId]', 'page.tsx']],
  ['orden médica', ['src', 'app', '(dashboard)', 'orden', '[patientId]', '[notaId]', 'page.tsx']],
  ['carta de referencia', ['src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx']],
  ['nota médica', ['src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx']],
  ['receta en Word', ['src', 'lib', 'receta-word.ts']],
  ['nota en Word', ['src', 'lib', 'nota-word.ts']],
]

describe('C-015 · «hoy» es hoy en el consultorio, no en Greenwich', () => {
  for (const [nombre, ruta] of IMPRESOS) {
    it(`${nombre}: no calcula el día en UTC`, () => {
      const s = leer(...ruta)
      const m = s.match(HOY_EN_UTC)
      expect(m, `${nombre} sigue fechando en UTC: ${m?.[0]}`).toBeNull()
      expect(s, `${nombre} no usa la zona del consultorio`).toMatch(/hoyISO\(|fechaISOLocal\(/)
    })
  }

  it('la fecha IMPRESA de la carta de referencia se formatea en la zona del consultorio', () => {
    const s = leer('src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx')
    expect(s).toContain('timeZone: zonaActiva()')
  })
})

describe('C-018 · «1 año», no «1 años»', () => {
  it('el singular y el plural', () => {
    expect(edadLegible(1)).toBe('1 año')
    expect(edadLegible(34)).toBe('34 años')
    expect(edadLegible(0)).toBe('0 años')
  })

  it('sin edad devuelve vacío: el llamador decide, y nunca sale «undefined años»', () => {
    expect(edadLegible(undefined)).toBe('')
    expect(edadLegible(null)).toBe('')
    expect(edadLegible('')).toBe('')
    expect(edadLegible(-3)).toBe('')
    expect(conEtiquetaDeEdad(undefined)).toBe('')
  })

  it('la etiqueta va delante cuando hay edad', () => {
    expect(conEtiquetaDeEdad(1)).toBe('Edad: 1 año')
    expect(conEtiquetaDeEdad('7')).toBe('Edad: 7 años')
  })

  it('los impresos de esta rebanada usan la función, no el texto a mano', () => {
    for (const ruta of [
      ['src', 'app', '(dashboard)', 'nota', '[patientId]', '[notaId]', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'referencia', '[patientId]', 'page.tsx'],
      ['src', 'components', 'RecetaDocumento.tsx'],
      ['src', 'lib', 'nota-word.ts'],
      ['src', 'lib', 'receta-word.ts'],
    ]) {
      const s = leer(...ruta)
      expect(s, `${ruta.join('/')} no usa edadLegible`).toMatch(/edadLegible|conEtiquetaDeEdad/)
      expect(s, `${ruta.join('/')} sigue concatenando « años»`).not.toMatch(/\}\s*años/)
    }
  })
})

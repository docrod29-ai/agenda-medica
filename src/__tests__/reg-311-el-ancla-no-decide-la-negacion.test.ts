/**
 * EL ANCLA DEL PACIENTE VOLVIÓ A DECIDIR LA NEGACIÓN POR SU CUENTA — REG-311.
 *
 * ── LA SÉPTIMA COPIA ────────────────────────────────────────────────────────
 *
 * `PatientAnchor` — el componente que V15 escribió para que la identidad y la
 * seguridad del paciente estén SIEMPRE visibles en el expediente — nació con
 * su propia lógica de negación de alergias:
 *
 *     /^(ninguna|niega|no|sin|nkda|negad)/i        ← sin `\b`, sin estructuradas
 *
 * Es la SÉPTIMA copia de la regla que REG-279 ya condenó («la sexta copia»),
 * y PEOR que la condenada: al perder el `\b`, «Nolotil» empieza por «no» y el
 * ancla decía «sin alergias» en gris. Con «Niega penicilina. Alérgico a
 * sulfas» — la cadena motivadora de REG-279 — el ancla AFIRMABA la ausencia
 * de una alergia que el expediente registra. Y con la alergia sólo en
 * `alergiasEstructuradas`, decía «no registradas».
 *
 * En /consulta convivían además DOS criterios en el mismo viewport: la franja
 * editable pintaba rojo con CUALQUIER texto («Niega alergias» → ROJO) y la
 * píldora del encabezado usaba el prefijo («Niega penicilina. Alérgico a
 * sulfas» → NEUTRO). Dos alarmas contradictorias para el mismo dato, en la
 * pantalla donde se prescribe.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * V15-ORIGINALITY-REDTEAM-001 (13-ago-2026): el equipo rojo de originalidad,
 * revisando CAPTURAS reales del panel §26/§41, contrastó el cromo del ancla
 * contra el golden de REG-279 y encontró que su guarda de fuente sólo miraba
 * la ruta de hospitalización. El defecto llegó a la rama con la suite en
 * verde: ninguna prueba miraba este archivo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La negación de alergias se decide UNA vez, en `src/lib/seguridad/alergias`
 * (`alergenosDe` + `negacionesEnTexto`, sellados por REG-279): «negadas»
 * exige negación explícita Y que no quede ningún alérgeno, leyendo también
 * las estructuradas. Ningún componente reimplementa el predicado. Y el hueco
 * («no registradas») se dice en ámbar: ausencia de dato no es dato de
 * ausencia (regla 4 de clinical-safety).
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · El RENDER real (colores, orden DOM): eso lo mira el arnés de capturas.
 * · Una reimplementación futura SIN regex (p. ej. `startsWith('niega')`):
 *   el barrido busca la familia de regex de prefijo, no toda heurística
 *   imaginable. La regla de fondo es el import del módulo sellado.
 * · La franja de hospitalización: ésa tiene su propio golden (REG-279).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { alergenosDe, negacionesEnTexto } from '@/lib/seguridad/alergias'

/** La decisión del ancla, tal cual la toma el componente. */
function loQueDiceElAncla(p: { alergias?: string; alergiasEstructuradas?: { alergeno: string }[] }) {
  const alergenos = alergenosDe(p)
  const negadas = alergenos.length === 0 && negacionesEnTexto(p.alergias).length > 0
  if (alergenos.length) return `ROJO: ${alergenos.join(' · ')}`
  return negadas ? 'GRIS: negadas' : 'ÁMBAR: no registradas'
}

describe('el caso que lo motiva — la misma cadena de REG-279, ahora en el ancla', () => {
  it('«Niega penicilina. Alérgico a sulfas» pinta ROJO con las sulfas', () => {
    expect(loQueDiceElAncla({ alergias: 'Niega penicilina. Alérgico a sulfas' })).toBe('ROJO: sulfas')
  })

  it('«Nolotil» empieza por «no» y NO por eso es una negación', () => {
    /* El regex condenado de REG-279 tenía `\b`; la séptima copia lo perdió.
       Éste es el caso que el `\b` protegía. */
    expect(loQueDiceElAncla({ alergias: 'Nolotil' })).toBe('ROJO: Nolotil')
  })

  it('la alergia sólo-estructurada EXISTE para el ancla', () => {
    expect(loQueDiceElAncla({ alergias: '', alergiasEstructuradas: [{ alergeno: 'penicilina' }] }))
      .toBe('ROJO: penicilina')
  })

  it('una negación de verdad sigue siendo GRIS — el arreglo no sobreavisa', () => {
    expect(loQueDiceElAncla({ alergias: 'Niega alergias' })).toBe('GRIS: negadas')
  })

  it('el hueco es ÁMBAR, no gris: ausencia de dato no es dato de ausencia', () => {
    expect(loQueDiceElAncla({})).toBe('ÁMBAR: no registradas')
  })
})

const RAIZ = join(__dirname, '..', '..')
const ANCLA = readFileSync(join(RAIZ, 'src/components/expediente/PatientAnchor.tsx'), 'utf8')
const CONSULTA = readFileSync(join(RAIZ, 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

describe('la fuente usa el módulo sellado, no una copia', () => {
  it('PatientAnchor importa alergenosDe y negacionesEnTexto de seguridad/alergias', () => {
    expect(ANCLA).toMatch(/import \{[^}]*alergenosDe[^}]*\} from '@\/lib\/seguridad\/alergias'/)
    expect(ANCLA).toContain('negacionesEnTexto')
  })

  it('el ancla pinta el hueco en ámbar y las negadas en gris — tres estados, no dos', () => {
    expect(ANCLA).toContain('negadas por el paciente')
    expect(ANCLA).toContain('no registradas')
    expect(ANCLA).toContain('var(--amber)')
  })

  it('las DOS piezas de /consulta derivan del mismo criterio sellado', () => {
    const usos = CONSULTA.match(/alergenosDe\(patient \?\? \{\}\)/g) ?? []
    expect(usos.length).toBeGreaterThanOrEqual(2)
  })
})

describe('la octava copia no puede nacer — barrido de repositorio', () => {
  it('ningún componente ni pantalla trae su propio regex de negación de alergias', () => {
    /* La familia entera de la copia: un regex de prefijo con las palabras de
       negación. `lib/seguridad/alergias.ts` (el dueño legítimo) y las pruebas
       quedan fuera del barrido. */
    const FIRMA = /\^\s*\(\s*(?:[a-zñ]+\|)*(?:ninguna|niega|nkda)(?:\|[a-zñ]+)*\s*\)/i
    const sospechosos: string[] = []
    const caminar = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) {
          if (e === '__tests__' || e === 'node_modules') continue
          caminar(p)
        } else if (p.endsWith('.tsx') && FIRMA.test(readFileSync(p, 'utf8'))) {
          sospechosos.push(p.slice(RAIZ.length + 1))
        }
      }
    }
    caminar(join(RAIZ, 'src/app'))
    caminar(join(RAIZ, 'src/components'))
    expect(sospechosos).toEqual([])
  })
})

/**
 * EL REGISTRO DE PELIGROS NO PUEDE QUEDARSE ATRÁS — §18 del charter V7.
 *
 * ── POR QUÉ ESTE GUARDIÁN ────────────────────────────────────────────────────
 *
 * El charter exige un caso de seguridad por función clínica. Escribirlo una vez
 * es fácil; lo que falla es mantenerlo. Ya pasó con el tablero del programa:
 * `MASTER_STATE.json` decía v1030 mientras producción iba por v1079. **Un
 * documento de seguridad desactualizado miente con más autoridad que no
 * tenerlo**, porque quien lo lee asume que refleja el sistema.
 *
 * Esta prueba no juzga si los peligros son los correctos —eso es criterio
 * clínico del médico dueño—. Comprueba tres cosas mecánicas:
 *
 * 1. que cada peligro tenga las casillas que el charter exige;
 * 2. que las pruebas que dice tener EXISTAN de verdad;
 * 3. que ninguna aprobación se dé por firmada sin el médico.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const RUTA = 'docs/clinical-safety/REGISTRO-DE-PELIGROS.md'
const doc = readFileSync(join(process.cwd(), RUTA), 'utf8')
const peligros = doc.split(/^## PEL-/m).slice(1)

describe('el registro existe y tiene contenido', () => {
  it('hay peligros escritos', () => {
    expect(peligros.length).toBeGreaterThanOrEqual(10)
  })

  it('están numerados sin saltos', () => {
    const ids = [...doc.matchAll(/^## PEL-(\d{3})/gm)].map(m => Number(m[1]))
    expect(ids).toEqual(ids.map((_, i) => i + 1))
  })
})

describe('cada peligro trae las casillas del §18', () => {
  const OBLIGATORIAS = [
    '**Causa**', '**Daño posible**', '**A quién afecta**', '**Severidad**',
    '**Controles**', '**Pruebas**', '**Riesgo residual**', '**Responsable**',
  ]
  for (const p of peligros) {
    const titulo = p.split('\n')[0].trim().slice(0, 50)
    for (const casilla of OBLIGATORIAS) {
      it(`PEL-${titulo} tiene ${casilla}`, () => {
        expect(p).toContain(casilla)
      })
    }
  }
})

describe('las pruebas que dice tener existen de verdad', () => {
  /**
   * Ésta es la que importa. Un registro puede citar un archivo de prueba que se
   * renombró o se borró, y entonces el control que declara **no está**. Es el
   * mismo patrón de «escrito y sin conectar» aplicado a la documentación de
   * seguridad.
   */
  const citados = [...doc.matchAll(/`([\w-]+\.test\.ts)`/g)].map(m => m[1])

  it('se citan pruebas concretas, no genéricas', () => {
    expect(citados.length).toBeGreaterThanOrEqual(15)
  })

  for (const archivo of [...new Set(citados)]) {
    it(`«${archivo}» existe`, () => {
      expect(
        existsSync(join(process.cwd(), 'src/__tests__', archivo)),
        `el registro de peligros cita ${archivo} y no está en src/__tests__`,
      ).toBe(true)
    })
  }
})

describe('ninguna aprobación se firma sola', () => {
  it('todas las casillas de aprobación siguen pendientes', () => {
    /**
     * La aceptación de un riesgo clínico residual corresponde al médico
     * responsable (§18). El sistema que produce el riesgo no puede aprobarlo.
     */
    const pendientes = (doc.match(/\*\*Aprobación\*\*: ☐ pendiente/g) || []).length
    const marcadas = (doc.match(/\*\*Aprobación\*\*: ☑/g) || []).length
    expect(pendientes).toBe(peligros.length)
    expect(marcadas, 'una aprobación clínica no puede marcarla el sistema').toBe(0)
  })

  it('el responsable es el médico dueño, nombrado', () => {
    expect(doc).toContain('Dr. David Alonso Rodríguez Luna')
  })
})

describe('declara sus propios huecos', () => {
  it('dice explícitamente qué NO cubre todavía', () => {
    // Un registro que aparenta ser completo es peor que uno que declara sus
    // huecos: el primero se confía, el segundo se completa.
    expect(doc).toContain('Lo que este registro NO cubre todavía')
  })

  it('y nombra los cuatro pendientes conocidos', () => {
    for (const hueco of ['Paciente equivocado', 'Fuga entre consultorios', 'Inyección de instrucciones']) {
      expect(doc).toContain(hueco)
    }
  })
})

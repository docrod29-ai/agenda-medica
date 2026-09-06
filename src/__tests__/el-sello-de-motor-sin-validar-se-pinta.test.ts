/**
 * REP-020 · MI-003 (M-internista; bajado a P2 por el equipo rojo, guardián
 * barato) — `SelloMotor` está importado y nunca se renderiza en `src/`.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/consulta/[patientId]/page.tsx:154` importa `SelloMotor`;
 * `grep -rn '<SelloMotor' src/` devuelve cero. La pantalla
 * /cumplimiento/motores afirma «sus resultados salen en pantalla con una
 * etiqueta ámbar junto al dato» — 23 de 89 motores están en
 * `pendiente_validacion` y ninguno lleva etiqueta.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-internista, MI-003; equipo rojo confirmado (P2): sólo tres líneas
 * nombran `SelloMotor` en src/ — la definición, ese import y `motoresSinValidar`
 * en cumplimiento/page.tsx. Además, `src/__tests__/modulos-sin-conectar.test.ts`
 * marca conectado cualquier archivo con un import de valor, sin mirar el uso.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * «Escrito y sin conectar»: componente importado y nunca usado como JSX.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * el-dato-tiene-que-llegar / «escrito y sin conectar»: buscar el símbolo en
 * app/, hooks/, components/ antes de declarar algo entregado — y aquí, buscar
 * el USO, no el import.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL declarado (recorrido de `src/` en busca de `<SelloMotor` o
 * `createElement(SelloMotor`). Es lo que el hallazgo pide como guardián.
 *
 * ── CÓMO SE REPARÓ (6-sep-2026, rama reparacion/CONSULTA) ────────────────────
 * Se pinta donde el registro dice que hace falta y donde el médico está mirando
 * el resultado: junto a la edad gestacional y al tamizaje de rutina
 * (`gineco-obstetricia`), junto al esquema de vacunación (`esquema-vacunacion-mx`),
 * junto a la profilaxis quirúrgica (`profilaxis-quirurgica`) y junto al catálogo
 * preventivo (`medicina-preventiva`, que además es `experimental`). Cuatro de los
 * motores no validados que de verdad tienen superficie en la consulta.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No dice junto a qué resultados debe ir el sello ni en qué pantalla (sale del
 * registro). No renderiza la consulta. Si el dueño elige la otra salida
 * (corregir el texto de /cumplimiento/motores y borrar el import), esta prueba
 * debe reescribirse, no forzarse.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../..')
const SRC = path.join(raiz, 'src')

function archivos(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, out)
    else if (/\.(tsx|ts)$/.test(e) && !p.includes(`${path.sep}__tests__${path.sep}`)) out.push(p)
  }
  return out
}

describe('REP-020 · SelloMotor se pinta en alguna pantalla', () => {
  const todos = archivos(SRC)
  const usa = (s: string) => /<SelloMotor\b|createElement\(\s*SelloMotor\b/.test(s)

  it('control: el componente existe y alguien lo importa', () => {
    expect(todos.some(f => f.endsWith(`${path.sep}components${path.sep}SelloMotor.tsx`))).toBe(true)
    const importadores = todos.filter(f => /import \{[^}]*\bSelloMotor\b[^}]*\} from ['"]@\/components\/SelloMotor['"]/.test(readFileSync(f, 'utf8')))
    expect(importadores.length).toBeGreaterThan(0)
  })

  it('hay al menos un archivo de src/ (fuera de tests) que lo usa como elemento', () => {
    const usos = todos.filter(f => usa(readFileSync(f, 'utf8')) && !f.endsWith('SelloMotor.tsx'))
    expect(usos.length, 'SelloMotor está importado pero nunca renderizado').toBeGreaterThan(0)
  })

  it('se pinta junto a resultados de motores que el registro marca sin validar', () => {
    const conSello = todos.filter(f => usa(readFileSync(f, 'utf8')) && !f.endsWith('SelloMotor.tsx'))
      .map(f => path.basename(f))
    // Los cuatro motores no validados con superficie propia en la consulta.
    for (const panel of ['PanelGineco.tsx', 'PanelPediatria.tsx', 'PanelCirugia.tsx', 'PanelPreventivo.tsx']) {
      expect(conSello, `${panel} enseña un resultado de motor sin validar y no lleva sello`).toContain(panel)
    }
  })

  it('probada al revés: el sello NO habla de un motor validado (si hablara siempre, nadie lo vería)', async () => {
    const { estadoDeMotor } = await import('@/components/SelloMotor')
    expect(estadoDeMotor('gineco-obstetricia')).toBe('pendiente_validacion')
    expect(estadoDeMotor('esquema-vacunacion-mx')).toBe('pendiente_validacion')
    // Un id que no existe no inventa estado.
    expect(estadoDeMotor('motor-que-no-existe')).toBeNull()
  })
})

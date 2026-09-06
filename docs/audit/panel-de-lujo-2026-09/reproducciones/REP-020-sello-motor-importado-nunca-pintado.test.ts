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
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No dice junto a qué resultados debe ir el sello ni en qué pantalla (sale del
 * registro). No renderiza la consulta. Si el dueño elige la otra salida
 * (corregir el texto de /cumplimiento/motores y borrar el import), esta prueba
 * debe reescribirse, no forzarse.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../../../..')
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
})

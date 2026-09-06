/**
 * REP-053 · MP-006 (M-pediatra) — el hard-stop kg/lb de REG-013 protege sólo al
 * panel: el peso de signos vitales (sin selector de unidad, sin plausibilidad)
 * es el que alimenta la verificación mg/kg de la consulta y de la receta.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/consulta/[patientId]/page.tsx:6727`: los siete signos
 * vitales (`['peso','Peso','kg']`) sin selector de unidad ni
 * `revisarPesoPediatrico`; y `:6325` `pesoKg: signosNum.peso ?? undefined`
 * entra directo a `dosisPeligrosasDeLaLista`. La receta
 * (`receta/[patientId]/[notaId]/page.tsx:240`) hace lo mismo con
 * `kgMasa(pesoParaDosis)` desde `nota.signosVitales.peso`.
 * `grep -rn revisarPesoPediatrico src/app src/components` → UN llamador:
 * PanelPediatria.tsx:49. Y ahí el «peso previo» es el de HOY (page.tsx:7083
 * `pesoInicial={signosNum.peso}`), así que `revisarPesoPediatrico(20, 20)` es ok.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor M-pediatra, MP-006; equipo rojo confirmado P1 con el grep. Lactante
 * sintético de 9 kg pesado en libras (20): paracetamol 200 mg (22 mg/kg reales,
 * sobre el tope de 15) se calcula como 10 mg/kg → sin aviso.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La guarda existe y está «cableada» (REG-106) en una de las tres puertas por
 * donde entra un peso.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * el-dato-tiene-que-llegar / «escrito y sin conectar»: buscar el símbolo en
 * app/, components/ antes de declarar algo entregado. clinical-safety §3: la
 * confirmación es visible, no una corrección silenciosa.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL declarado: es JSX de dos pantallas y el motor puro
 * (`dosisPeligrosasDeLaLista`) no recibe hoy ningún peso previo con el que
 * comparar, así que no hay comportamiento que importar sin inventar una firma.
 * Es exactamente el guardián que el hallazgo pide («≥2 llamadores en
 * app/+components/; hoy 1»), más la localización: la guarda debe vivir en las
 * dos pantallas que alimentan mg/kg con el peso de signos.
 *
 * ── COMO SE REPARO (6-sep-2026, rama reparacion/CONSULTA) ────────────────────
 * En la consulta: selector de unidad kg/lb VISIBLE (se guarda siempre en kg),
 * `revisarPesoPediatrico` sobre el peso de signos antes de alimentar
 * `dosisPeligrosasDeLaLista` —mientras no se confirme, el motor recibe
 * `undefined` y la pantalla dice que la revision por kilo no esta corriendo—, y
 * el «peso previo» del panel pasa a ser el de la ultima nota FIRMADA con peso,
 * con su fecha, en vez del de hoy.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre un peso mal medido en kg (sin patron x2.2) ni al paciente sin nota
 * previa. NO CUBRE LA RECETA: `receta/[patientId]/[notaId]/page.tsx` es de otra
 * rebanada (RECETA-DOCS) y su mitad queda como handoff — el caso que la medía se
 * conserva abajo como `it.todo`, para que se reactive cuando esa mitad aterrice.
 * Si el arreglo mete la guarda dentro de `dosisPeligrosasDeLaLista` con un
 * peso previo como parametro, los casos deben reescribirse contra esa firma,
 * no forzarse.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../..')
const leer = (rel: string) => readFileSync(path.join(raiz, rel), 'utf8')
const CONSULTA = 'src/app/(dashboard)/consulta/[patientId]/page.tsx'
const RECETA = 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'

function archivos(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) archivos(p, out)
    else if (/\.(tsx|ts)$/.test(e) && !p.includes(`${path.sep}__tests__${path.sep}`)) out.push(p)
  }
  return out
}

describe('REP-053 · el peso de signos vitales pasa por revisarPesoPediatrico antes de mg/kg', () => {
  const pantallas = [...archivos(path.join(raiz, 'src/app')), ...archivos(path.join(raiz, 'src/components'))]
  const llamadores = pantallas.filter(f => /revisarPesoPediatrico\s*\(/.test(readFileSync(f, 'utf8')))

  it('control: la guarda existe y el panel la llama (REG-013 / REG-106)', () => {
    expect(llamadores.some(f => f.endsWith('PanelPediatria.tsx'))).toBe(true)
    expect(leer(CONSULTA)).toMatch(/pesoKg:\s*pesoParaDosis/)
    expect(leer(RECETA)).toMatch(/kgMasa\(pesoParaDosis\)/)
  })

  it('guardián del hallazgo: ≥2 llamadores de revisarPesoPediatrico en app/+components/ (hoy 1)', () => {
    const rel = llamadores.map(f => path.relative(raiz, f))
    expect(rel, `llamadores: ${rel.join(', ') || 'ninguno'}`).not.toHaveLength(0)
    expect(rel.length, `sólo ${rel.join(', ')}`).toBeGreaterThanOrEqual(2)
  })

  it('la consulta, que alimenta dosisPeligrosasDeLaLista con signosNum.peso, revisa ese peso', () => {
    expect(/revisarPesoPediatrico/.test(leer(CONSULTA)), `${CONSULTA} no menciona revisarPesoPediatrico`).toBe(true)
  })

  /**
   * HANDOFF A RECETA-DOCS (declarado, no silenciado): la pantalla de la receta
   * vuelve a leer el peso de la nota y llama a `revisarDosis` sin pasar por
   * `revisarPesoPediatrico`. Ese archivo no es de esta rebanada; el caso queda
   * escrito para activarse en cuanto su dueno lo repare — activarlo aqui dejaria
   * la suite roja por trabajo ajeno, que no es lo que mide una prueba.
   */
  it.todo('HANDOFF RECETA-DOCS · la receta, que alimenta revisarDosis con el peso de la nota, revisa ese peso')

  it('control del handoff: la receta sigue siendo la pantalla que dosifica con el peso de la nota', () => {
    expect(leer(RECETA)).toMatch(/kgMasa\(pesoParaDosis\)/)
  })
})

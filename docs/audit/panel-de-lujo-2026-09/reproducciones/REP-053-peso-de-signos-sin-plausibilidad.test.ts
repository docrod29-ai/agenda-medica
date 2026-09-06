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
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No cubre un peso mal medido en kg (sin patrón ×2.2) ni al paciente sin nota
 * previa. No cubre que el panel reciba el peso PREVIO real (última nota firmada
 * con peso): ese dato no existe hoy como entrada y su forma es decisión de
 * producto. El selector kg/lb en signos vitales es decisión del dueño (L6.2).
 * Si el arreglo mete la guarda dentro de `dosisPeligrosasDeLaLista` con un
 * peso previo como parámetro, los casos 2 y 3 deben reescribirse contra esa
 * firma, no forzarse.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../../../..')
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
    expect(leer(CONSULTA)).toMatch(/pesoKg:\s*signosNum\.peso/)
    expect(leer(RECETA)).toMatch(/kgMasa\(pesoParaDosis\)/)
  })

  it('guardián del hallazgo: ≥2 llamadores de revisarPesoPediatrico en app/+components/ (hoy 1)', () => {
    const rel = llamadores.map(f => path.relative(raiz, f))
    expect(rel, `llamadores: ${rel.join(', ') || 'ninguno'}`).not.toHaveLength(0)
    expect(rel.length, `sólo ${rel.join(', ')}`).toBeGreaterThanOrEqual(2)
  })

  it('la consulta, que alimenta dosisPeligrosasDeLaLista con signosNum.peso, revisa ese peso', () => {
    expect(leer(CONSULTA)).toMatch(/revisarPesoPediatrico/)
  })

  it('la receta, que alimenta revisarDosis con el peso de la nota, revisa ese peso', () => {
    expect(leer(RECETA)).toMatch(/revisarPesoPediatrico/)
  })
})

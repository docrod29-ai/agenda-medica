/**
 * «SIN REFERENCIA DE DOSIS» SE DESCARTABA TAMBIÉN EN NIÑOS — REG-306, SAFE-003.
 *
 * ── DE DÓNDE VIENE ──────────────────────────────────────────────────────────
 *
 * Auditoría de nueve dimensiones, hallazgo G2 (BACKLOG.json, `SAFE-003`).
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `revisarDosis()` marca `sin_referencia` cuando el fármaco no está en el
 * catálogo — «verifica manualmente, ausencia de alerta ≠ dosis segura». Tanto
 * `dosisPeligrosasDeLaLista` (consulta) como la pantalla de receta descartaban
 * ese código sin mirar la edad: «no saturar de avisos que no dicen nada».
 *
 * Es la decisión correcta en un adulto. En un paciente **pediátrico** la dosis
 * va por kilogramo y el margen entre dosis terapéutica y tóxica es estrecho:
 * que el catálogo no tenga referencia para ese fármaco no es «sin hallazgos»,
 * es «nadie comprobó esta dosis» — y callarlo se lee, en la pantalla, como que
 * sí se comprobó.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo el filtro `.filter(a => a.codigo !== 'sin_referencia')` en los dos
 * sitios donde corre `revisarDosis` sobre una lista, sin condición de edad.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `esPediatrico` (edad < 18) es la única condición: con ella, `sin_referencia`
 * se conserva; sin ella (adulto o edad desconocida), se descarta como antes.
 * Edad **desconocida** se trata como adulto a propósito — no hay forma de sacar
 * más seguridad inventando una edad que nadie escribió.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * No cambia qué bloquea la firma (nada lo hacía antes tampoco: es un aviso
 * informativo). No añade fármacos al catálogo. No prueba la pantalla en un
 * navegador — la receta se verifica por texto de origen, como el resto de los
 * goldens de esa pantalla.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dosisPeligrosasDeLaLista } from '@/lib/seguridad/dosis-de-la-lista'

const FARMACO_FUERA_DEL_CATALOGO = 'fármaco-inventado-xyz'

describe('sin_referencia en la lista de la consulta (SAFE-003)', () => {
  it('en un adulto, sigue sin enseñarse — sigue siendo ruido', () => {
    const r = dosisPeligrosasDeLaLista([
      { nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '500 mg' },
    ], { edadAnios: 45 })
    expect(r).toEqual([])
  })

  it('con edad desconocida, se trata como adulto — no se inventa pediatría', () => {
    const r = dosisPeligrosasDeLaLista([
      { nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '500 mg' },
    ])
    expect(r).toEqual([])
  })

  it('en un niño de 17 años, SÍ se enseña: nadie comprobó esa dosis', () => {
    const r = dosisPeligrosasDeLaLista([
      { nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '500 mg' },
    ], { edadAnios: 17 })
    expect(r).toHaveLength(1)
    expect(r[0].alertas.map(a => a.codigo)).toContain('sin_referencia')
  })

  it('en un lactante, también', () => {
    const r = dosisPeligrosasDeLaLista([
      { nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '50 mg' },
    ], { edadAnios: 0.5 })
    expect(r).toHaveLength(1)
    expect(r[0].alertas.map(a => a.codigo)).toContain('sin_referencia')
  })

  it('a los 18 exactos ya cuenta como adulto — el umbral es "< 18", no "<= 18"', () => {
    const r = dosisPeligrosasDeLaLista([
      { nombre: FARMACO_FUERA_DEL_CATALOGO, dosis: '500 mg' },
    ], { edadAnios: 18 })
    expect(r).toEqual([])
  })

  it('en un niño, un fármaco SÍ catalogado sigue sin generar ruido de sin_referencia', () => {
    // Control negativo: lo que cambia es la ausencia de catálogo, no la edad
    // por sí sola disparando avisos de más.
    const r = dosisPeligrosasDeLaLista([
      { nombre: 'paracetamol', dosis: '500 mg', frecuencia: 'cada 8 horas' },
    ], { edadAnios: 8 })
    expect(r).toEqual([])
  })
})

describe('la receta tiene la misma excepción, no sólo la consulta', () => {
  const receta = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8',
  )

  it('el filtro de la receta ya no descarta sin_referencia de forma incondicional', () => {
    expect(receta).toContain("a.codigo !== 'sin_referencia' || esPediatrico")
  })

  it('esPediatrico en la receta sigue siendo edad < 18, la misma regla que en la lista', () => {
    expect(receta).toMatch(/esPediatrico = edadPaciente != null && edadPaciente < 18/)
  })
})

/**
 * GOLDEN — la receta dice qué red de seguridad NO está corriendo, y el papel lo
 * dice también.
 *
 * Cuatro hallazgos del Panel de Lujo (sep-2026):
 *
 *   · MP-007 (M-pediatra, CONFIRMADO, P2) — la receta avisa en ámbar cuando
 *     falta la EDAD (REG-524) y callaba cuando falta el PESO en un niño: la
 *     comprobación mg/kg se apagaba sin decirlo.
 *   · MG-002 (M-ginecóloga, CONFIRMADO, P2) — la pantalla revisaba alergias,
 *     dosis, duplicidad, interacciones, controlados y riñón, y NUNCA la tabla de
 *     embarazo y lactancia. El fármaco añadido en la propia receta —el camino
 *     que no pasa por la consulta— salía sin ninguna señal gestacional.
 *   · MP-005 (M-pediatra, CONFIRMADO, P0; motor ya reparado) — parte de PAPEL:
 *     el aviso de «volumen sin concentración» vivía sólo en la pantalla del
 *     médico; el renglón salía limpio hacia la farmacia y hacia el cuidador.
 *   · N-022 (N-negocio, CONFIRMADO, P3) — renovar un crónico obligaba a
 *     dictarlo entero otra vez.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * MP-007: el equipo rojo comprobó que `esPediatrico` y `pesoParaDosis` vivían
 * DENTRO del `useMemo` de las alertas, así que ninguna rama de render podía
 * leerlas — el aviso no existía ni podía existir. MG-002: `EMBARAZO_LACTANCIA`
 * sólo lo consumía el copiloto, y el copiloto sólo se monta en la consulta.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Dos pantallas con dos niveles de seguridad sobre la misma prescripción, sin
 * que nadie lo supiera. Y una comprobación que se apaga sola cuando le falta un
 * dato: la ausencia de alerta se lee como «ya se revisó».
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §4 y §5 — ausencia de dato no es dato de ausencia, y se
 * señala de menos, nunca de más: cuando una comprobación no corre, se DICE.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre los módulos puros (`pesoParaDosificar`,
 * `revisionGestacionalDeLaReceta`, `marcaDelRenglonImpreso`,
 * `medicamentosARenovar`) y CONTRATO TEXTUAL declarado sobre la pantalla, que
 * no se monta en node. Probadas al revés: con peso no hay aviso, sin embarazo
 * no hay aviso gestacional, y un renglón completo no se marca en el papel.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No renderiza la pantalla ni el impreso. No decide qué fármaco es teratógeno
 * (esa tabla es del motor de prescripción segura) ni qué presentaciones
 * comerciales existen (NEEDS_CLINICAL_REVIEW: la aporta el médico). No cubre el
 * caso de que el peso exista pero sea de otra fecha. No cubre las otras dos
 * partes de N-022 —recordatorios de toma y adherencia—, que viven en el portal
 * y están en el handoff.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { pesoParaDosificar, AVISO_SIN_PESO_PARA_DOSIFICAR } from '@/lib/receta-peso-para-dosificar'
import { revisionGestacionalDeLaReceta } from '@/lib/receta-revision-gestacional'
import { marcaDelRenglonImpreso } from '@/lib/receta-renglon-impreso'
import { medicamentosARenovar } from '@/lib/receta-renovacion'

const raiz = process.cwd()
const pagina = readFileSync(
  path.join(raiz, 'src', 'app', '(dashboard)', 'receta', '[patientId]', '[notaId]', 'page.tsx'), 'utf8')

describe('MP-007 · el peso que falta se dice', () => {
  it('un niño sin peso en ningún sitio: la comprobación mg/kg NO corre, y se sabe', () => {
    const r = pesoParaDosificar(true, undefined, '')
    expect(r.falta).toBe(true)
    expect(r.peso).toBeUndefined()
  })

  it('el peso de la nota manda, y si no, el que el médico teclea en la pantalla', () => {
    expect(pesoParaDosificar(true, 14, '20')).toEqual({ peso: 14, falta: false, origen: 'nota' })
    expect(pesoParaDosificar(true, 0, '20')).toEqual({ peso: 20, falta: false, origen: 'tecleado' })
  })

  it('al revés: en un adulto no aplica y no se pinta ningún aviso', () => {
    expect(pesoParaDosificar(false, undefined, '')).toEqual({ falta: false, origen: 'no_aplica' })
  })

  it('la pantalla puede leerlo y lo pinta', () => {
    // Antes vivía dentro del useMemo: ninguna rama de render podía verlo.
    expect(pagina).toContain('const pesoDosis = pesoParaDosificar(')
    expect(pagina).toContain('{pesoDosis.falta && (')
    expect(pagina).toContain('AVISO_SIN_PESO_PARA_DOSIFICAR')
    expect(AVISO_SIN_PESO_PARA_DOSIFICAR).toMatch(/mg\/kg/)
  })
})

describe('MG-002 · el embarazo se revisa donde se imprime', () => {
  const conEnalapril = (diagnosticos: { descripcion: string; tipo?: string }[]) =>
    revisionGestacionalDeLaReceta({
      sexo: 'Femenino', edad: 30,
      diagnosticos: diagnosticos as never,
      medicamentos: [{ nombre: 'Enalapril 10 mg', dosis: '10 mg' }],
    })

  it('un fármaco contraindicado en el embarazo avisa aunque nadie lo confirme', () => {
    // Contraindicado es contraindicado: la advertencia no espera al diagnóstico.
    const avisos = conEnalapril([])
    expect(avisos.length).toBeGreaterThan(0)
    expect(avisos[0].id.startsWith('gesta:')).toBe(true)
  })

  it('con el embarazo escrito en la nota, el aviso lo cita', () => {
    const avisos = conEnalapril([{ descripcion: 'Embarazo de 10 semanas', tipo: 'definitivo' }])
    expect(avisos.map(a => a.titulo).join(' ')).toMatch(/Enalapril/i)
  })

  it('al revés: un fármaco sin riesgo gestacional no inventa un aviso', () => {
    const avisos = revisionGestacionalDeLaReceta({
      sexo: 'Femenino', edad: 30,
      diagnosticos: [{ descripcion: 'Embarazo de 10 semanas', tipo: 'definitivo' }],
      medicamentos: [{ nombre: 'Paracetamol 500 mg' }],
    })
    expect(avisos).toEqual([])
  })

  it('sin medicamentos no se llama al motor: una receta vacía no avisa de nada', () => {
    expect(revisionGestacionalDeLaReceta({ diagnosticos: [], medicamentos: [] })).toEqual([])
  })

  it('la pantalla monta la revisión y la pinta', () => {
    expect(pagina).toContain('revisionGestacionalDeLaReceta({')
    expect(pagina).toContain('{avisosGestacionales.length > 0 && (')
  })
})

describe('MP-005 · el hueco del renglón viaja con el papel', () => {
  it('«Amoxicilina 5 mL» sale marcado: la concentración falta', () => {
    const marca = marcaDelRenglonImpreso({ nombre: 'Amoxicilina', dosis: '5 mL' })
    expect(marca).toMatch(/CONCENTRACIÓN/i)
    expect(marca).toMatch(/250 mg\/5 mL/)
  })

  it('con la presentación escrita, el renglón sale limpio', () => {
    expect(marcaDelRenglonImpreso({ nombre: 'Amoxicilina', dosis: '250 mg/5 mL, 5 mL' })).toBeNull()
  })

  it('la unidad y la cantidad ausentes también se marcan', () => {
    expect(marcaDelRenglonImpreso({ nombre: 'Levotiroxina', dosis: '100' })).toMatch(/UNIDAD/i)
    expect(marcaDelRenglonImpreso({ nombre: 'Paracetamol', dosis: '' })).toMatch(/CANTIDAD/i)
  })

  it('al revés: un renglón completo no lleva marca, y un renglón sin nombre no existe', () => {
    expect(marcaDelRenglonImpreso({ nombre: 'Paracetamol', dosis: '500 mg' })).toBeNull()
    expect(marcaDelRenglonImpreso({ nombre: '', dosis: '5 mL' })).toBeNull()
    expect(marcaDelRenglonImpreso(null)).toBeNull()
  })

  it('los dos impresos lo pintan: la hoja y el .doc', () => {
    const hoja = readFileSync(path.join(raiz, 'src', 'components', 'RecetaDocumento.tsx'), 'utf8')
    const word = readFileSync(path.join(raiz, 'src', 'lib', 'receta-word.ts'), 'utf8')
    expect(hoja).toContain('marcaDelRenglonImpreso(m)')
    expect(word).toContain('marcaDelRenglonImpreso(m)')
  })
})

describe('N-022 · renovar lo crónico sin volver a dictarlo', () => {
  const vigentes = [
    { medicamento: { nombre: 'Metformina 850 mg', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 horas', duracion: 'indefinido' } },
    { medicamento: { nombre: 'Losartán 50 mg', dosis: '50 mg', via: 'oral', frecuencia: 'cada 24 horas', duracion: 'indefinido' } },
  ] as never

  it('ofrece lo vigente que todavía no está en la receta de hoy', () => {
    const r = medicamentosARenovar(vigentes, [{ nombre: 'Metformina 850 mg' }] as never)
    expect(r.map(m => m.nombre)).toEqual(['Losartán 50 mg'])
  })

  it('no repite lo que ya está, aunque se escriba distinto', () => {
    expect(medicamentosARenovar(vigentes, [
      { nombre: 'metformina 850 mg' }, { nombre: 'LOSARTÁN 50 MG' },
    ] as never)).toEqual([])
  })

  it('lo renovado vuelve a pasar por las compuertas: entra como un renglón más', () => {
    // El botón añade a `medicamentos`, que es la lista sobre la que corren
    // TODAS las revisiones de esta pantalla. Una renovación no hereda la
    // aprobación de la receta anterior.
    expect(pagina).toContain('setMedicamentos([...medicamentos, { ...r }])')
    expect(pagina).toContain('const porRenovar = medicamentosARenovar(vigentes, medicamentos)')
  })
})

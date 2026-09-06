/**
 * EL MOTOR DE SOBREDOSIS CORRÍA DESPUÉS DE FIRMAR — REG-190.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * `revisarDosis()` caza sobredosis, techos por vía y edad, y el **error de
 * decimal** —«500 mg donde iban 50»—, que es de los errores de prescripción que
 * más daño hacen y que un modelo generativo pasa por alto sin despeinarse.
 *
 * Tenía **un solo llamador**: la pantalla de la receta, que se abre desde una
 * nota **ya firmada**. El motor corría cuando la nota estaba sellada y el
 * paciente se había ido con la receta en la mano.
 *
 * ── LO QUE ESTO NO HACE ──────────────────────────────────────────────────────
 *
 * **No cambia qué bloquea la firma.** Eso lo decidió el médico dueño el 5-ago
 * con el dato delante. Entra como aviso: le pide una mirada, no se lo impide.
 * Pero **cuando es crítica no se pliega** — «500 donde iban 50» es del mismo
 * orden de daño que recetar aquello a lo que el paciente es alérgico.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dosisPeligrosasDeLaLista, hayCritica } from '@/lib/seguridad/dosis-de-la-lista'
import { construirAvisos, NIVEL, NO_SE_PLIEGAN, fijos, plegables } from '@/lib/expediente/avisos-consulta'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
)

describe('el error de decimal se caza sobre la lista', () => {
  it('paracetamol 10 g por toma salta', () => {
    const r = dosisPeligrosasDeLaLista([{ nombre: 'paracetamol', dosis: '10000 mg' }])
    expect(r).toHaveLength(1)
    expect(r[0].severidad).toBe('critica')
  })

  it('ketorolaco 300 mg salta', () => {
    expect(dosisPeligrosasDeLaLista([{ nombre: 'ketorolaco', dosis: '300 mg' }])).toHaveLength(1)
  })

  it('paracetamol 500 mg cada 8 horas NO salta — es la dosis normal', () => {
    expect(dosisPeligrosasDeLaLista([
      { nombre: 'paracetamol', dosis: '500 mg', frecuencia: 'cada 8 horas' },
    ])).toEqual([])
  })

  it('revisa la lista entera, no sólo el primero', () => {
    const r = dosisPeligrosasDeLaLista([
      { nombre: 'paracetamol', dosis: '500 mg', frecuencia: 'cada 8 horas' },
      { nombre: 'ketorolaco', dosis: '300 mg' },
    ])
    expect(r.map(x => x.med)).toEqual(['ketorolaco'])
  })
})

describe('lo que no puede decir, se calla', () => {
  it('un renglón sin dosis no genera aviso — de eso ya se encarga la compuerta', () => {
    expect(dosisPeligrosasDeLaLista([{ nombre: 'levotiroxina', dosis: '' }])).toEqual([])
  })

  it('un renglón sin nombre tampoco', () => {
    expect(dosisPeligrosasDeLaLista([{ nombre: '  ', dosis: '500 mg' }])).toEqual([])
  })

  it('«no está en el catálogo» NO se enseña', () => {
    /**
     * No es un hallazgo sobre el paciente, y en una lista de ocho llenaría la
     * pantalla de avisos que no dicen nada. El motor ya advierte por su cuenta
     * que la ausencia de alerta no significa dosis segura.
     */
    expect(dosisPeligrosasDeLaLista([{ nombre: 'fármaco-inventado-xyz', dosis: '500 mg' }])).toEqual([])
  })

  it('una lista vacía no inventa nada', () => {
    expect(dosisPeligrosasDeLaLista([])).toEqual([])
    expect(hayCritica([])).toBe(false)
  })
})

describe('llega a la barra en el nivel que le toca', () => {
  const avisos = () => construirAvisos({
    dosisPeligrosas: [{ med: 'paracetamol', mensaje: '10000 mg es extremadamente alto', critica: true }],
  })

  it('es de nivel «revisa», no bloquea', () => {
    // Qué bloquea lo decidió el médico dueño. Ampliarlo por mi cuenta sería
    // decidir por él una segunda vez.
    expect(NIVEL.dosis_peligrosa).toBe('revisa')
    expect(avisos()[0].nivel).toBe('revisa')
  })

  it('pero NO se pliega: sale a la vista aunque haya veinte avisos más', () => {
    const todos = construirAvisos({
      dosisPeligrosas: [{ med: 'paracetamol', mensaje: 'x', critica: true }],
      conflictos: Array.from({ length: 20 }, (_, i) => `c${i}`),
    })
    expect(fijos(todos).map(a => a.origen)).toContain('dosis_peligrosa')
    expect(plegables(todos).map(a => a.origen)).not.toContain('dosis_peligrosa')
    expect(NO_SE_PLIEGAN).toContain('dosis_peligrosa')
  })

  it('lo crítico no se puede descartar con un botón', () => {
    expect(avisos()[0].descartable).toBe(false)
  })

  it('lo no crítico sí', () => {
    const [a] = construirAvisos({
      dosisPeligrosas: [{ med: 'losartán', mensaje: 'dosis alta', critica: false }],
    })
    expect(a.descartable).toBe(true)
  })

  it('el mensaje del motor va literal — dice la cifra y el techo', () => {
    const [a] = construirAvisos({
      dosisPeligrosas: [{ med: 'paracetamol', mensaje: '10000 mg es ~10× el máximo por toma (1000 mg)', critica: true }],
    })
    expect(a.texto).toContain('~10×')
    expect(a.texto).toContain('1000 mg')
  })
})

describe('está conectado a la consulta, no sólo escrito', () => {
  it('la consulta lo calcula y se lo pasa a la barra', () => {
    expect(page).toContain('dosisPeligrosas: dosisPeligrosasDeLaLista(medicamentos, {')
  })

  it('con la edad y el peso del paciente, que es lo que activa lo pediátrico', () => {
    // REG-524: la edad pasa por `edadParaDosificar` (fecha de nacimiento > edad congelada > desconocida).
    expect(page).toContain('edadAnios: edadParaDosificar(patient).edad ?? undefined')
    expect(page).toContain('pesoKg: signosNum.peso')
  })

  it('y la receta sigue teniendo su propia revisión', () => {
    // Traerlo a la consulta no es quitarlo de donde estaba: la receta se puede
    // abrir sin pasar por la consulta de hoy.
    const receta = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/receta/[patientId]/[notaId]/page.tsx'), 'utf8',
    )
    expect(receta).toContain('revisarDosis({')
  })
})

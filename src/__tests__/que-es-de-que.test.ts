/**
 * QUÉ ES DE QUÉ — REG-243.
 *
 * ── DE DÓNDE SALE ───────────────────────────────────────────────────────────
 *
 * De la investigación del mercado (I-12). Suki lo llama *problem-based
 * charting*: cada problema con su CIE-10 y debajo el plan de ESE problema.
 *
 * Aquí la nota tenía una lista de diagnósticos y otra de medicamentos, sin
 * relación entre ellas. Con dos problemas y cinco fármacos, quién es de quién
 * quedaba en la cabeza del médico — y en la del que lea la nota después, que no
 * estuvo. Familia `hueco_frente_al_mercado`.
 *
 * ── LA LÍNEA QUE NO SE CRUZA, Y ES TODO EL DISEÑO ───────────────────────────
 *
 * Inferir sería fácil: «moxifloxacino es antibiótico, hay una neumonía, luego
 * el moxifloxacino es de la neumonía». Eso es razonamiento clínico. Con **dos
 * infecciones simultáneas** acierta por suerte, y el error se lee como acierto.
 *
 * Se ata sólo lo que el médico DIJO, en el mismo tramo del dictado, y se enseña
 * la frase que lo prueba. Lo que no consta queda sin asignar, a la vista.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  planPorProblema, aQuienPertenece,
  POR_QUE_NO_SE_INFIERE, POR_QUE_EL_HUECO_SE_VE, POR_QUE_EL_DICTADO_Y_NO_LA_NOTA,
} from '@/lib/expediente/plan-por-problema'

const DICTADO =
  'Paciente con neumonía adquirida en la comunidad. Para la neumonía le doy ' +
  'moxifloxacino 400 mg cada 24 horas. También tiene hipertensión arterial, le ' +
  'sigo el losartán 50 mg. Le agrego paracetamol si tiene dolor.'

const DX = ['Neumonía adquirida en la comunidad', 'Hipertensión arterial sistémica']
const MEDS = [{ nombre: 'Moxifloxacino' }, { nombre: 'Losartán' }, { nombre: 'Paracetamol' }]

describe('ata lo que se dijo', () => {
  const grupos = planPorProblema({ diagnosticos: DX, medicamentos: MEDS, dictado: DICTADO })

  it('cada fármaco cae bajo el problema que el médico nombró con él', () => {
    expect(grupos.map(g => [g.diagnostico, g.medicamentos.map(m => m.nombre)])).toEqual([
      ['Neumonía adquirida en la comunidad', ['Moxifloxacino']],
      ['Hipertensión arterial sistémica', ['Losartán']],
      [null, ['Paracetamol']],
    ])
  })

  it('enseña la FRASE que lo prueba, no una afirmación suelta', () => {
    const neumonia = grupos[0].medicamentos[0]
    expect(neumonia.evidencia?.texto).toContain('Para la neumonía le doy moxifloxacino')
  })

  it('respeta el ORDEN de los diagnósticos de la nota', () => {
    /** El orden lo eligió el médico; reordenarlo por conveniencia lo pisa. */
    const alReves = planPorProblema({
      diagnosticos: [...DX].reverse(), medicamentos: MEDS, dictado: DICTADO,
    })
    expect(alReves[0].diagnostico).toBe('Hipertensión arterial sistémica')
  })
})

describe('NO adivina — que es de lo que se trata', () => {
  it('un fármaco que no se dijo junto a un diagnóstico queda SIN ASIGNAR', () => {
    /**
     * «Le agrego paracetamol si tiene dolor» no nombra ningún problema. Un
     * motor que infiriera lo colgaría de la neumonía por ser lo más cercano.
     */
    const sinAsignar = planPorProblema({ diagnosticos: DX, medicamentos: MEDS, dictado: DICTADO })
      .find(g => g.diagnostico === null)
    expect(sinAsignar?.medicamentos.map(m => m.nombre)).toEqual(['Paracetamol'])
  })

  it('con DOS infecciones simultáneas no reparte por su cuenta', () => {
    /**
     * El caso que hace peligrosa la inferencia. El dictado sólo ata uno; el
     * otro fármaco tiene que quedarse sin asignar, no repartirse a ojo.
     */
    const dictado = 'Tiene neumonía y también una infección urinaria. Le doy ' +
      'moxifloxacino para la neumonía. Le agrego nitrofurantoína.'
    const g = planPorProblema({
      diagnosticos: ['Neumonía', 'Infección urinaria'],
      medicamentos: [{ nombre: 'Moxifloxacino' }, { nombre: 'Nitrofurantoína' }],
      dictado,
    })
    expect(g.find(x => x.diagnostico === 'Neumonía')?.medicamentos.map(m => m.nombre))
      .toEqual(['Moxifloxacino'])
    expect(g.find(x => x.diagnostico === null)?.medicamentos.map(m => m.nombre))
      .toEqual(['Nitrofurantoína'])
  })

  it('sin dictado no ata NADA', () => {
    const g = planPorProblema({ diagnosticos: DX, medicamentos: MEDS, dictado: '' })
    expect(g).toEqual([{ diagnostico: null, medicamentos: MEDS.map(m => ({ nombre: m.nombre })) }])
  })

  it('una palabra corta compartida no basta para atar', () => {
    /**
     * «Aguda» aparece en muchos diagnósticos. Atar por eso pondría el fármaco
     * bajo el problema equivocado con toda la apariencia de estar bien.
     */
    expect(aQuienPertenece('Omeprazol', ['Gastritis aguda', 'Faringitis aguda'],
      'Le doy omeprazol, es aguda.')).toBeNull()
  })

  it('no truena con entradas vacías', () => {
    expect(planPorProblema({})).toEqual([])
    expect(aQuienPertenece('', DX, DICTADO)).toBeNull()
    expect(aQuienPertenece('Moxifloxacino', [], DICTADO)).toBeNull()
  })
})

describe('las razones quedan escritas', () => {
  it('por qué no se infiere', () => {
    expect(POR_QUE_NO_SE_INFIERE).toMatch(/dos infecciones simult[áa]neas/)
  })

  it('por qué el hueco se ve', () => {
    expect(POR_QUE_EL_HUECO_SE_VE).toMatch(/error que se lee\s*\n?\s*como un acierto/)
  })

  it('por qué el dictado y no la nota', () => {
    /**
     * La nota es prosa reordenada por el modelo: ahí el fármaco y el
     * diagnóstico pueden acabar juntos sin que nadie los relacionara nunca.
     */
    expect(POR_QUE_EL_DICTADO_Y_NO_LA_NOTA).toMatch(/reordenada por el modelo/)
  })
})

describe('está CONECTADO, y usa el motor que ya existía', () => {
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
  const mod = readFileSync(
    join(process.cwd(), 'src/lib/expediente/plan-por-problema.ts'), 'utf8')
  const comp = readFileSync(
    join(process.cwd(), 'src/components/PlanPorProblema.tsx'), 'utf8')

  it('la consulta lo importa y lo monta', () => {
    expect(page).toContain("import { PlanPorProblema } from '@/components/PlanPorProblema'")
    expect(page).toContain('<PlanPorProblema')
  })

  it('recibe el dictado, no la nota', () => {
    expect(page).toMatch(/dictado=\{voz\.transcripcion\}/)
  })

  it('reutiliza `segmentar` de trazabilidad en vez de partir el texto otra vez', () => {
    /** Dos formas de trocear el dictado darían dos verdades distintas. */
    expect(mod).toContain("from '@/lib/expediente/trazabilidad'")
    expect(mod).toContain('segmentar(')
  })

  it('no ofrece un segundo sitio donde editar el plan', () => {
    /** Un segundo lugar donde editar lo mismo separa las dos versiones. */
    expect(comp).not.toMatch(/onChange|setMedicamentos|<input|<select/)
  })

  it('usa tokens de color que existen', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
    for (const t of ['--amber', '--border2', '--text3', '--s2'])
      expect(css, `${t} no existe`).toMatch(new RegExp(`\\${t}\\s*:`))
  })
})

/**
 * GOLDEN — motor de dosificación V2.
 *
 * Dos cosas se protegen aquí, y la primera importa más que la segunda:
 *
 *  1. **Que nadie edite una dosis dentro del repo.** El dataset entra byte a byte
 *     desde el archivo del Dr. y su huella queda anclada abajo. Corregir una
 *     dosis se hace en el origen y se vuelve a importar, con la huella nueva a la
 *     vista en el diff — nunca con un dedo dentro del JSON.
 *
 *  2. **Que el motor no invente.** Sin fármaco, sin dato o con una regla dura
 *     disparada, la respuesta es SPECIALIST_REVIEW o BLOCKED, jamás un número.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  DATASET, buscarFarmaco, nombresFarmacos, fuentesDe,
} from '@/lib/dosing/dataset'
import { recomendar } from '@/lib/dosing/motor'

const RUTA_JSON = join(process.cwd(), 'src/lib/dosing/data/dosing-v2.json')

describe('El dataset llegó entero y nadie lo ha tocado', () => {
  /**
   * Huella del archivo que entregó el Dr. el 30-jul-2026.
   *
   * Si este caso se pone rojo, alguien editó una dosis dentro del repo. Eso NO
   * se arregla actualizando el número de abajo sin mirar: se mira el diff, se
   * comprueba de dónde salió el cambio, y sólo entonces se sella la versión
   * nueva.
   */
  const HUELLA = '0520abd4310e002e960336606c6a3a83c26a15159f9f5080187f5f931a102a9c'

  it('la huella del dataset no ha cambiado', () => {
    const hash = createHash('sha256').update(readFileSync(RUTA_JSON)).digest('hex')
    expect(hash, 'ALGUIEN EDITÓ EL DATASET DE DOSIS. Revisa el diff antes de re-sellar.')
      .toBe(HUELLA)
  })

  it('trae los 54 fármacos, sus 12 reglas duras y sus 22 fuentes', () => {
    expect(DATASET.drugs).toHaveLength(54)
    expect(DATASET.global_hard_stops).toHaveLength(12)
    expect(Object.keys(DATASET.sources)).toHaveLength(22)
    expect(DATASET.version).toBe('2.0-core')
  })

  it('cada fármaco cita al menos una fuente, y la fuente existe', () => {
    for (const f of DATASET.drugs) {
      expect(f.source_ids.length, f.drug).toBeGreaterThan(0)
      for (const { id, fuente } of fuentesDe(f)) {
        expect(fuente, `${f.drug} cita «${id}», que no está en sources`).not.toBeNull()
      }
    }
  })
})

describe('Los nombres en español llegan al fármaco correcto', () => {
  it('empareja los que la app dicta en español', () => {
    for (const [es, en] of [
      ['meropenem', 'Meropenem'], ['vancomicina', 'Vancomycin IV'],
      ['piperacilina/tazobactam', 'Piperacillin/tazobactam'],
      ['noradrenalina', 'Norepinephrine'], ['norepinefrina', 'Norepinephrine'],
      ['trimetoprima/sulfametoxazol', 'TMP/SMX'], ['fosfenitoina', 'Fosphenytoin'],
    ] as const) {
      expect(buscarFarmaco(es)?.drug, es).toBe(en)
    }
  })

  it('NO empareja por parecido — dos cefalosporinas distintas no se confunden', () => {
    expect(buscarFarmaco('ceftriaxona')?.drug).toBe('Ceftriaxone')
    expect(buscarFarmaco('ceftazidima')?.drug).toBe('Ceftazidime')
    // Un nombre inventado no cae en el más parecido: devuelve nada.
    expect(buscarFarmaco('ceftriaxidima')).toBeNull()
    expect(buscarFarmaco('meropenemol')).toBeNull()
  })

  it('un fármaco que no está devuelve SPECIALIST_REVIEW, no una dosis', () => {
    const r = recomendar({ farmaco: 'colistina' })
    expect(r.estado).toBe('SPECIALIST_REVIEW')
    expect(r.reglaAplicada).toBeNull()
    expect(r.faltantes[0]).toContain('no está entre los 54')
  })

  it('el catálogo se puede listar para un selector', () => {
    expect(nombresFarmacos()).toHaveLength(54)
  })
})

describe('Reglas duras: BLOQUEAN, no avisan', () => {
  it('daptomicina + neumonía = BLOCKED, y NO se enseña la dosis', () => {
    const r = recomendar({ farmaco: 'daptomicina', esNeumonia: true, crClMlMin: 60 })
    expect(r.estado).toBe('BLOCKED')
    // Enseñar el número y decir «pero no» invita a leer sólo el número.
    expect(r.reglaAplicada).toBeNull()
    expect(r.bloqueos.join(' ')).toMatch(/neumonía/i)
  })

  it('daptomicina sin saber si es neumonía PREGUNTA, no asume que no lo es', () => {
    const r = recomendar({ farmaco: 'daptomicina', crClMlMin: 60 })
    expect(r.estado).toBe('SPECIALIST_REVIEW')
    expect(r.faltantes.join(' ')).toMatch(/neumon/i)
  })

  it('daptomicina fuera de neumonía sí devuelve su regla', () => {
    const r = recomendar({
      farmaco: 'daptomicina', esNeumonia: false, crClMlMin: 60,
      pesoKg: 70, escalarPeso: 'TBW',
    })
    expect(r.estado).toBe('CLEAR')
    expect(r.reglaAplicada).toContain('8-10 mg/kg')
  })

  it('un bloqueador neuromuscular sin sedación confirmada = BLOCKED', () => {
    expect(recomendar({ farmaco: 'rocuronio' }).estado).toBe('BLOCKED')
    const ok = recomendar({ farmaco: 'rocuronio', sedacionYVentilacionAseguradas: true })
    expect(ok.estado).not.toBe('BLOCKED')
  })

  it('mg/kg sin peso o sin escalar de peso NO produce dosis', () => {
    const sinNada = recomendar({ farmaco: 'vancomicina' })
    expect(sinNada.estado).toBe('SPECIALIST_REVIEW')
    expect(sinNada.faltantes.join(' ')).toMatch(/peso/i)

    const soloPeso = recomendar({ farmaco: 'vancomicina', pesoKg: 80 })
    expect(soloPeso.faltantes.join(' ')).toMatch(/TBW|IBW|AdjBW/)
  })

  it('una función renal inestable manda a revisión aunque haya CrCl', () => {
    const r = recomendar({
      farmaco: 'cefepime', crClMlMin: 40, renalInestable: true,
    })
    expect(r.estado).toBe('SPECIALIST_REVIEW')
    expect(r.bloqueos.join(' ')).toMatch(/PROVISIONAL/)
  })
})

describe('El reemplazo renal NO es «CrCl menor de 10»', () => {
  it('en CVVHD se elige la rama de reemplazo renal, no la renal', () => {
    const r = recomendar({ farmaco: 'meropenem', rrt: 'CVVHD', crClMlMin: 5 })
    expect(r.rama).toBe('reemplazo_renal')
    // La regla de CRRT del dataset da 1 g q8h; la de CrCl <10 daría 500 mg q24h.
    expect(r.reglaAplicada).toContain('CRRT')
    expect(r.porQueEsaRama).toMatch(/filtro/i)
  })

  it('la rama de CRRT NO es la mitad de la de no-diálisis', () => {
    const soloRenal = recomendar({ farmaco: 'meropenem', crClMlMin: 5, rrt: 'ninguna' })
    const enCrrt = recomendar({ farmaco: 'meropenem', crClMlMin: 5, rrt: 'CVVHD' })
    expect(enCrrt.reglaAplicada).not.toBe(soloRenal.reglaAplicada)
  })

  it('una modalidad DESCONOCIDA se pregunta, no se supone', () => {
    const r = recomendar({ farmaco: 'meropenem', rrt: 'desconocida', crClMlMin: 5 })
    expect(r.estado).toBe('SPECIALIST_REVIEW')
    expect(r.faltantes.join(' ')).toMatch(/IHD[\s\S]*PIRRT[\s\S]*CVVH/)
  })

  it('el cefiderocol en CRRT exige la tasa de efluente', () => {
    const sin = recomendar({ farmaco: 'cefiderocol', rrt: 'CVVHDF' })
    expect(sin.faltantes.join(' ')).toMatch(/efluente/i)
    const con = recomendar({ farmaco: 'cefiderocol', rrt: 'CVVHDF', efluenteCrrtLh: 2 })
    expect(con.faltantes.join(' ')).not.toMatch(/efluente/i)
  })
})

describe('Lo que devuelve es del dataset, palabra por palabra', () => {
  it('la regla es el texto LITERAL, sin reescribir', () => {
    const f = buscarFarmaco('meropenem')!
    const r = recomendar({ farmaco: 'meropenem', crClMlMin: 80, rrt: 'ninguna' })
    expect(r.reglaAplicada).toContain(f.dose_rule)
  })

  it('viaja con su fuente, su versión y su fecha', () => {
    const r = recomendar({ farmaco: 'meropenem', crClMlMin: 80, rrt: 'ninguna' })
    expect(r.fuentes.map(x => x.id)).toContain('UCSF_MERO')
    expect(r.fuentes[0].url).toMatch(/^https:\/\//)
    expect(r.versionDataset).toBe('2.0-core')
    expect(r.fechaVerificacion).toBe('2026-07-30')
  })

  it('SIEMPRE sale marcado como no validado por el médico', () => {
    /**
     * El dataset se marca a sí mismo VERIFIED_NUMERIC_CORE, y eso describe de
     * dónde viene el dato — no que el médico de este consultorio lo haya
     * comprobado. La pantalla no puede confundir las dos cosas.
     */
    for (const nombre of ['meropenem', 'vancomicina', 'propofol', 'noradrenalina']) {
      const r = recomendar({ farmaco: nombre, pesoKg: 70, escalarPeso: 'TBW' })
      expect(r.validacion, nombre).toBe('sin_validar')
      expect(r.avisoValidacion).toMatch(/SIN VALIDAR/)
    }
  })

  it('deja constancia de qué datos del paciente se usaron', () => {
    const r = recomendar({
      farmaco: 'meropenem', crClMlMin: 40, rrt: 'ninguna',
      indicacion: 'neumonía nosocomial', micMgL: 2,
    })
    expect(r.entradasUsadas).toMatchObject({
      farmaco: 'Meropenem', crClMlMin: 40, rrt: 'ninguna', micMgL: 2,
    })
  })
})

describe('Ningún fármaco del dataset revienta el motor', () => {
  it('los 54 responden con un estado válido y sin lanzar', () => {
    for (const f of DATASET.drugs) {
      const r = recomendar({
        farmaco: f.drug, crClMlMin: 60, rrt: 'ninguna',
        pesoKg: 70, escalarPeso: 'TBW',
        esNeumonia: false, sedacionYVentilacionAseguradas: true,
      })
      expect(['CLEAR', 'BLOCKED', 'SPECIALIST_REVIEW'], f.drug).toContain(r.estado)
      // Y si sale CLEAR, hay regla; si no, no hay número suelto por ahí.
      if (r.estado === 'CLEAR') expect(r.reglaAplicada, f.drug).toBeTruthy()
    }
  })
})

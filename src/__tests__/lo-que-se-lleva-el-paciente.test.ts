/**
 * LO QUE SE LLEVA EL PACIENTE — REG-242.
 *
 * ── EL HUECO ────────────────────────────────────────────────────────────────
 *
 * De la investigación del mercado (I-12): Suki tiene instrucciones para el
 * paciente «a nivel de lectura de quinto grado, en 80 idiomas». Nabla también —
 * y son lo ÚNICO que traduce al idioma del paciente, porque la nota clínica la
 * deja en inglés «per U.S. regulations».
 *
 * NexusMED no las tenía. El paciente salía con una receta y con lo que hubiera
 * retenido de la conversación.
 *
 * ── LA DECISIÓN QUE SEPARA ESTO DE LO SUYO ──────────────────────────────────
 *
 * Ellos las **generan** con un modelo. Aquí se **componen**.
 *
 * Un modelo que redacta instrucciones puede añadir «tome mucha agua» o «si
 * empeora acuda a urgencias». En un papel que sale con el membrete y la cédula
 * del médico, eso es **una indicación médica que nadie firmó**.
 *
 * Y hay una compuerta que lo comprueba de verdad, no de palabra: ninguna cifra
 * de la hoja puede faltar en la nota. Se reutiliza `cifrasClinicas` de REG-240.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  comoSeLoExplico, comoTexto, viaEnLlano, vecesAlDia, comoTomarlo,
  POR_QUE_SE_COMPONE_Y_NO_SE_GENERA, POR_QUE_24_ENTRE_N_ES_SEGURO,
} from '@/lib/paciente/como-se-lo-explico'
import { cifrasClinicas } from '@/lib/seguridad/la-reescritura-no-pierde-cifras'

const MEDS = [
  { nombre: 'Moxifloxacino', dosis: '400 mg', via: 'oral', frecuencia: 'cada 24 horas', duracion: '14 días' },
  { nombre: 'Paracetamol', dosis: '500 mg', via: 'v.o.', frecuencia: 'cada 8 horas', duracion: '5 días' },
  { nombre: 'Enoxaparina', dosis: '40 mg', via: 'subcutánea', frecuencia: 'cada 5 horas' },
]

describe('habla como el paciente, no como la receta', () => {
  it.each([
    ['oral', 'por la boca'],
    ['v.o.', 'por la boca'],
    ['vía oral', 'por la boca'],
    ['subcutánea', 'inyectado bajo la piel'],
    ['intramuscular', 'inyectado en el músculo'],
    ['intravenosa', 'por la vena'],
    ['sublingual', 'debajo de la lengua'],
    ['tópica', 'sobre la piel'],
  ])('«%s» → «%s»', (via, esperado) => expect(viaEnLlano(via)).toBe(esperado))

  it('una vía que no conoce se deja TAL CUAL', () => {
    /**
     * Es preferible que el paciente lea «intraósea» a que se le diga algo que
     * el médico no dijo.
     */
    expect(viaEnLlano('intraósea')).toBe('intraósea')
  })
})

describe('24 ÷ n, y sólo cuando es exacto', () => {
  it.each([
    ['cada 8 horas', '3 veces al día'],
    ['cada 12 horas', '2 veces al día'],
    ['cada 6 horas', '4 veces al día'],
    ['cada 24 horas', 'una vez al día'],
    ['c/8h', '3 veces al día'],
  ])('«%s» → «%s»', (f, esperado) => expect(vecesAlDia(f)).toBe(esperado))

  it('«cada 5 horas» NO se convierte: 4,8 veces al día no existe', () => {
    /**
     * Redondear aquí sería inventarle una pauta al médico. Ésta es la prueba
     * que impide que alguien «mejore» la función más adelante.
     */
    expect(vecesAlDia('cada 5 horas')).toBeNull()
    expect(vecesAlDia('cada 7 horas')).toBeNull()
    expect(POR_QUE_24_ENTRE_N_ES_SEGURO).toMatch(/4,8 veces al día/)
  })

  it('una frecuencia que no es «cada N horas» se deja como está', () => {
    expect(vecesAlDia('3 veces al día')).toBeNull()
    expect(comoTomarlo({ nombre: 'X', frecuencia: '3 veces al día' })).toContain('3 veces al día')
  })
})

describe('la hoja, entera', () => {
  const bloques = comoSeLoExplico({
    medicamentos: MEDS,
    estudios: ['Biometría hemática', 'Radiografía de tórax'],
    proximaCita: 'Lunes 18 de agosto, 10:00',
  })
  const texto = comoTexto(bloques)

  it('lleva medicamentos, estudios y cita', () => {
    expect(bloques.map(b => b.titulo)).toEqual([
      'Sus medicamentos', 'Estudios que le pidió el médico', 'Su próxima cita',
    ])
  })

  it('el medicamento se lee de corrido y en llano', () => {
    expect(texto).toContain('Paracetamol · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 5 días')
  })

  it('la enoxaparina NO recibe un «veces al día» inventado', () => {
    expect(texto).toContain('Enoxaparina · 40 mg · inyectado bajo la piel · cada 5 horas')
    expect(texto).not.toMatch(/4[.,]8/)
  })

  it('un bloque vacío no aparece', () => {
    /** «Estudios: —» le hace leer al paciente una línea que no dice nada. */
    const b = comoSeLoExplico({ medicamentos: MEDS })
    expect(b.map(x => x.titulo)).toEqual(['Sus medicamentos'])
  })

  it('sin nada que decir, no hay hoja', () => {
    expect(comoSeLoExplico({})).toEqual([])
    expect(comoSeLoExplico({ medicamentos: [{ nombre: '' }] })).toEqual([])
  })
})

describe('LA COMPUERTA: ninguna cifra que no esté en la nota', () => {
  /**
   * Ésta es la prueba que hace que «se compone, no se genera» sea un hecho
   * comprobable en vez de una promesa en un comentario.
   *
   * Se reutiliza `cifrasClinicas` de REG-240: toda cifra con unidad que aparece
   * en la hoja tiene que estar en los campos de origen.
   */
  it('toda cifra de la hoja viene de la nota, o es 24÷n EXACTO sobre ella', () => {
    /**
     * La primera versión de esta prueba exigía coincidencia literal y **falló
     * con su propio producto**: «3 veces» no está en la nota, es 24 ÷ 8.
     *
     * Perdonar el «veces» sin más habría sido abrir un boquete: cualquier
     * cifra con esa unidad pasaría. Lo que se comprueba es más estrecho — que
     * el número sea exactamente 24 dividido entre unas horas que SÍ están en
     * la nota. Si alguien «mejora» la función y empieza a redondear, esto
     * falla.
     */
    const origen = MEDS.map(m => `${m.nombre} ${m.dosis} ${m.frecuencia} ${m.duracion ?? ''}`).join(' ')
    const enLaNota = cifrasClinicas(origen)
    const enLaHoja = cifrasClinicas(comoTexto(comoSeLoExplico({ medicamentos: MEDS })))

    const horasDeLaNota = [...enLaNota.keys()]
      .map(c => c.match(/^(\d+)horas?$/)?.[1]).filter(Boolean).map(Number)
    const derivacionesLegitimas = new Set(
      horasDeLaNota.filter(h => h > 0 && h <= 24 && 24 % h === 0).map(h => `${24 / h}veces`))

    const inventadas = [...enLaHoja.keys()]
      .filter(c => !enLaNota.has(c) && !derivacionesLegitimas.has(c))
    expect(inventadas, `cifras que la hoja añade sin origen: ${inventadas.join(', ')}`).toEqual([])
  })

  it('y ninguna cifra de la NOTA se pierde en la hoja', () => {
    /**
     * El sentido contrario importa igual: una hoja que se come la duración
     * manda al paciente a casa sin saber cuántos días toma el antibiótico.
     */
    const origen = MEDS.map(m => `${m.nombre} ${m.dosis} ${m.frecuencia} ${m.duracion ?? ''}`).join(' ')
    const enLaHoja = cifrasClinicas(comoTexto(comoSeLoExplico({ medicamentos: MEDS })))
    const perdidas = [...cifrasClinicas(origen).keys()].filter(c => !enLaHoja.has(c))
    expect(perdidas, `cifras de la nota que la hoja no dice: ${perdidas.join(', ')}`).toEqual([])
  })

  it('las indicaciones del médico van LITERALES, sin reescribir', () => {
    const dictado = 'Reposo relativo.\nSi hay fiebre mayor a 38.5 grados, avisar.'
    const b = comoSeLoExplico({ indicacionesDelMedico: dictado })
    expect(b[0].lineas).toEqual(['Reposo relativo.', 'Si hay fiebre mayor a 38.5 grados, avisar.'])
  })

  it('no añade consejos generales por su cuenta', () => {
    const mod = readFileSync(join(process.cwd(), 'src/lib/paciente/como-se-lo-explico.ts'), 'utf8')
    const codigo = mod.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const frase of ['tome mucha agua', 'acuda a urgencias', 'no suspenda', 'consulte a su médico'])
      expect(codigo.toLowerCase()).not.toContain(frase)
  })

  it('y queda escrito por qué se compone en vez de generarse', () => {
    expect(POR_QUE_SE_COMPONE_Y_NO_SE_GENERA).toMatch(/que nadie\s*\n?\s*firmó/)
  })
})

describe('está CONECTADO', () => {
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('la consulta lo importa y lo monta', () => {
    expect(page).toContain("import { HojaParaElPaciente } from '@/components/HojaParaElPaciente'")
    expect(page).toContain('<HojaParaElPaciente')
  })

  it('le pasa los MISMOS medicamentos y estudios de la nota', () => {
    expect(page).toMatch(/medicamentos=\{medicamentos\}/)
    expect(page).toMatch(/estudios=\{estudiosOrden\}/)
  })

  it('NO aparece en un paciente internado', () => {
    /**
     * La nota de hospital y la de UCI se escriben en esta MISMA pantalla
     * (`/consulta/[id]?internamiento=…`). Sin este guardia, a un paciente
     * intubado se le generaría una hoja de «cómo tomarlo» sobre fármacos
     * intravenosos.
     */
    expect(page).toMatch(/\{!esNotaHospital && firmada && \(\s*\n\s*<HojaParaElPaciente/)
  })

  it('los botones no salen impresos en la hoja del paciente', () => {
    const comp = readFileSync(join(process.cwd(), 'src/components/HojaParaElPaciente.tsx'), 'utf8')
    expect(comp).toMatch(/className="no-print"/)
  })
})

describe('POSTVISIT-GATE-001 (REG-306) — no se entrega sin firmar', () => {
  /**
   * ── EL HUECO ──────────────────────────────────────────────────────────────
   *
   * `HojaParaElPaciente` se montaba con el estado VIVO de `medicamentos` y
   * `estudiosOrden` — el borrador en curso, no la nota firmada. La única
   * guarda era `{!esNotaHospital}`. Justo encima, `ComoCerrarLaConsulta` sí
   * exige `{firmada && …}`. El cabezal del módulo afirmaba que el contenido
   * sale de lo «ya revisado y firmado»: era intención de diseño, no una
   * condición que el código exigiera — regla `patient-facing-ai.md` §4:
   * un paquete para el paciente nace DRAFT y sólo se enseña tras aprobarse.
   *
   * ── CÓMO SE DESCUBRIÓ ─────────────────────────────────────────────────────
   *
   * Auditoría PATIENT-UX-TRUTH-001 (V9), 8-ago-2026, registrada como
   * POSTVISIT-GATE-001 en `agent-state/BACKLOG.json`.
   *
   * ── LA REGLA QUE LO HACE SEGURO ───────────────────────────────────────────
   *
   * `<HojaParaElPaciente ...>` sólo se monta cuando `firmada` es verdadero,
   * igual que `ComoCerrarLaConsulta`. Antes de firmar, el médico puede seguir
   * dictando, corrigiendo y borrando medicamentos: nada de eso debe poder
   * copiarse ni imprimirse como instrucción para el paciente.
   *
   * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────
   *
   * No cubre el estado DRAFT/RELEASED de un `PatientVisitPackage` en el
   * portal (`/mi/[token]`): esta hoja vive sólo en la pantalla de consulta del
   * médico (copiar/imprimir), no en la superficie del paciente. Ver
   * POSTVISIT-ENTREGA-001, que sigue pendiente.
   */
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('el guardia exige `firmada`, no sólo `!esNotaHospital`', () => {
    /**
     * Prueba al revés: si alguien vuelve a escribir el guardia como
     * `{!esNotaHospital && (` — sin `firmada` — esta prueba falla. Es
     * justo el defecto que REG-306 reparó.
     */
    const bloque = page.slice(page.indexOf('LO QUE SE LLEVA EL PACIENTE (REG-242)'))
    const guardia = bloque.match(/\{[^{}]*&&[^{}]*\(\s*\n\s*<HojaParaElPaciente/)?.[0] ?? ''
    expect(guardia).toContain('firmada')
  })

  it('el guardia sigue excluyendo al paciente internado', () => {
    expect(page).toMatch(/\{!esNotaHospital && firmada && \(\s*\n\s*<HojaParaElPaciente/)
  })
})

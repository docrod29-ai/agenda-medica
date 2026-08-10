/**
 * EL PAQUETE SALE DE UNA NOTA FIRMADA — V9 · `POSTVISIT-001` · REG-306, REG-307.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos cosas, y la primera es la peor porque llevaba meses en producción:
 *
 * **1. El fármaco que el médico acababa de suspender salía en la lista de «SUS
 * MEDICAMENTOS».** Cuando el médico usa «ya no lo toma» en la consulta, el
 * fármaco no sale de la nota: entra en `medicamentos` con `estado: 'suspendida'`,
 * su motivo, sin vía ni frecuencia. `comoTomarlo` no miraba el estado, así que la
 * hoja que el paciente se llevaba a casa imprimía «Ibuprofeno · 400 mg · otra»
 * junto a lo que sí tenía que tomar. Se lo acababan de quitar delante y el papel
 * le decía que siguiera.
 *
 * **2. La hoja se componía del borrador EN CURSO.** La única guarda era
 * `{!esNotaHospital}`. Justo encima, `ComoCerrarLaConsulta` sí exigía `firmada`.
 * El médico podía copiar y entregar una hoja hecha de una nota a medio dictar.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * El (1) siguiendo el dato: al escribir `componerPaquete` había que decidir qué
 * hacer con `estado`, y al mirar quién lo escribe apareció el modal «ya no lo
 * toma» de la consulta — que mete el fármaco en el mismo array que lee la hoja.
 * El (2) estaba declarado como `POSTVISIT-GATE-001` desde la auditoría
 * `PATIENT-UX-TRUTH-001` (8-ago-2026), con el número de línea.
 *
 * ── LA CAUSA RAÍZ, COMPARTIDA ───────────────────────────────────────────────
 *
 * La hoja del paciente se alimenta del **estado vivo de la pantalla** en vez de
 * un documento cerrado. El estado vivo incluye lo que aún no está firmado y lo
 * que ya se retiró, y ninguna de las dos cosas debería llegarle a alguien que no
 * puede detectar el error.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Lo que va hacia el paciente sale de una **nota firmada**, leída por el
 * **servidor**, y se compone de forma **determinista**. `componerPaquete` lanza
 * si la nota no está firmada —lanza, no devuelve `null`: un `null` se ignora en
 * silencio en el primer llamador que se olvide de mirarlo—.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No monta la ruta HTTP con Firestore.** Comprueba las funciones que la ruta
 *   usa, y que la ruta las use en el orden correcto. Montar `adminDb` exige el
 *   emulador, y eso es otra suite (`vitest.emulator.config.ts`).
 * - **No comprueba nada en un navegador.** Que el botón «Liberar» aparezca sólo
 *   con la nota firmada se sella leyendo el componente, no pulsándolo.
 * - **No prueba el aislamiento entre consultorios** de la colección: eso vive en
 *   `firestore.rules` y en la matriz de acceso, con sus propios guardianes.
 * - **No valida el contenido clínico** de la nota: si el médico firmó una dosis
 *   equivocada, el paquete la entrega tal cual. La compuerta de dosis está antes,
 *   en `AntesDeFirmar`.
 * - **`warningSigns` no se prueba con contenido real** porque hoy nada lo
 *   escribe: el campo existe y va vacío, declarado. Llega cuando el médico tenga
 *   dónde escribirlo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  componerPaquete, cambiosDeMedicacion, liberar, visibleParaElPaciente,
  NotaSinFirmar, POR_QUE_EL_SILENCIO_NO_SUSPENDE_TAMPOCO_AQUI,
  type NotaParaElPaquete,
} from '@/lib/paciente/paquete-de-visita'
import {
  comoSeLoExplico, comoTexto, fechaDeSeguimientoEnLlano, yaNoSeToma,
} from '@/lib/paciente/como-se-lo-explico'
import { cifrasClinicas } from '@/lib/seguridad/la-reescritura-no-pierde-cifras'

const AMOXI = { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' }
const IBU_SUSPENDIDO = { nombre: 'Ibuprofeno', dosis: '400 mg', via: 'otra', frecuencia: '', duracion: '', estado: 'suspendida', motivoEstado: 'gastritis' }

const notaFirmada = (extra: Partial<NotaParaElPaquete> = {}): NotaParaElPaquete => ({
  id: 'nota_1',
  estado: 'firmada',
  resumenEjecutivo: 'Faringitis aguda estreptocócica.',
  medicamentos: [AMOXI],
  estudiosOrden: ['Biometría hemática'],
  ...extra,
})

/* ══════════════════════════════════════════════════════════════════════════ */

describe('REG-306 · el fármaco que se acaba de suspender NO va con los que sí toma', () => {
  it('lo saca de «Sus medicamentos» y lo pone en «Lo que ya no toma»', () => {
    const bloques = comoSeLoExplico({ medicamentos: [AMOXI, IBU_SUSPENDIDO] })
    const titulos = bloques.map(b => b.titulo)

    expect(titulos).toContain('Sus medicamentos')
    expect(titulos).toContain('Lo que ya no toma')

    const suyos = bloques.find(b => b.titulo === 'Sus medicamentos')!.lineas.join(' ')
    /* LA QUE MUERDE. Antes de REG-306 esto contenía «Ibuprofeno · 400 mg · otra». */
    expect(suyos).not.toContain('Ibuprofeno')
    expect(suyos).toContain('Amoxicilina')
  })

  it('dice por qué, con las palabras del médico', () => {
    const b = comoSeLoExplico({ medicamentos: [IBU_SUSPENDIDO] })
    expect(b[0].lineas).toEqual(['Ibuprofeno — deje de tomarlo (gastritis)'])
  })

  it('«ya terminó» y «se suspende» no se dicen igual', () => {
    const b = comoSeLoExplico({ medicamentos: [{ nombre: 'Azitromicina', estado: 'terminada' }] })
    expect(b[0].lineas).toEqual(['Azitromicina — ya terminó el tratamiento'])
  })

  it('`probablemente_terminada` SIGUE en «Sus medicamentos»', () => {
    /**
     * Probada al revés: si alguien «mejora» la función metiendo este estado en el
     * bloque de retirados, esto falla.
     *
     * Ese estado no lo decidió nadie — lo dedujo el sistema al ver que la
     * duración escrita venció (§D1). Que el calendario haya pasado no significa
     * que el paciente lo dejara, y sacarlo de su lista es decirle que deje una
     * medicación que su médico no retiró.
     */
    const m = { nombre: 'Metformina', dosis: '850 mg', estado: 'probablemente_terminada' }
    expect(yaNoSeToma(m)).toBe(false)
    const b = comoSeLoExplico({ medicamentos: [m] })
    expect(b.map(x => x.titulo)).toEqual(['Sus medicamentos'])
  })

  it('sin `estado`, todo sigue igual que antes: nada se pierde', () => {
    /** La inmensa mayoría de lo prescrito no lleva el campo. Si esta prueba
     *  fallara, el cambio habría vaciado la hoja de todos los expedientes. */
    const b = comoSeLoExplico({ medicamentos: [AMOXI] })
    expect(b.map(x => x.titulo)).toEqual(['Sus medicamentos'])
    expect(b[0].lineas[0]).toContain('Amoxicilina')
  })
})

describe('REG-307 · la compuerta de firma', () => {
  it('se niega a componer desde un borrador', () => {
    expect(() => componerPaquete({ nota: notaFirmada({ estado: 'borrador' }), medicacionPrevia: [] }))
      .toThrow(NotaSinFirmar)
  })

  it('se niega también cuando el estado falta o es cualquier otra cosa', () => {
    for (const estado of [undefined, '', 'firmado', 'FIRMADA', null, 1]) {
      expect(() => componerPaquete({ nota: notaFirmada({ estado }), medicacionPrevia: [] }))
        .toThrow(NotaSinFirmar)
    }
  })

  it('con la nota firmada, compone', () => {
    const p = componerPaquete({ nota: notaFirmada(), medicacionPrevia: [] })
    expect(p.notaId).toBe('nota_1')
    expect(p.encounterSummary).toBe('Faringitis aguda estreptocócica.')
    expect(p.orders).toEqual(['Biometría hemática'])
  })

  it('y aun así nace DRAFT, invisible para el paciente', () => {
    /** Firmar va hacia el expediente; liberar va hacia el paciente. Son dos
     *  actos, y `componerPaquete` sólo puede hacer el primero. */
    const p = componerPaquete({ nota: notaFirmada(), medicacionPrevia: [] })
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(visibleParaElPaciente(p)).toBe(false)
  })

  it('el paquete de una nota firmada tampoco lleva el suspendido en sus instrucciones', () => {
    const p = componerPaquete({ nota: notaFirmada({ medicamentos: [AMOXI, IBU_SUSPENDIDO] }), medicacionPrevia: [] })
    expect(p.medicationInstructions.map(m => m.nombre)).toEqual(['Amoxicilina'])
  })
})

describe('el silencio no suspende — tampoco de cara al paciente', () => {
  it('un fármaco que estaba antes y hoy no se menciona NO se declara suspendido', () => {
    /**
     * ÉSTA es la prueba que más importa de este archivo.
     *
     * El paciente toma losartán crónico. Viene por una faringitis y la nota de
     * hoy sólo lleva amoxicilina. Inferir «suspendido» del silencio le diría que
     * deje su antihipertensivo — y la regla de IA de cara al paciente pone
     * «suspender un medicamento» en la lista de lo que el código NO DEBE PODER
     * hacer.
     */
    const cambios = cambiosDeMedicacion([AMOXI], ['Losartán'])
    expect(cambios).not.toBeNull()
    expect(cambios!.some(c => c.nombre === 'Losartán')).toBe(false)
    expect(cambios!.some(c => c.tipo === 'suspendido')).toBe(false)
  })

  it('«suspendido» sale SÓLO del estado que escribió el médico', () => {
    const cambios = cambiosDeMedicacion([IBU_SUSPENDIDO], ['Ibuprofeno'])!
    expect(cambios).toEqual([{ nombre: 'Ibuprofeno', tipo: 'suspendido' }])
  })

  it('sin lista previa devuelve `null`, no «sin cambios»', () => {
    /** «No aparecía antes» y «no sé qué había antes» son cosas distintas.
     *  Confundirlas es dato de ausencia. */
    expect(cambiosDeMedicacion([AMOXI], null)).toBeNull()
    expect(componerPaquete({ nota: notaFirmada(), medicacionPrevia: null }).medicationChanges).toBeNull()
  })

  it('una lista previa VACÍA sí es una respuesta: todo es nuevo', () => {
    expect(cambiosDeMedicacion([AMOXI], [])).toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })

  it('lo que ya tomaba y sigue tomando es «sin-cambio»', () => {
    expect(cambiosDeMedicacion([AMOXI], ['amoxicilina'])).toEqual([{ nombre: 'Amoxicilina', tipo: 'sin-cambio' }])
  })

  it('reconoce el mismo fármaco con acentos y espacios distintos', () => {
    expect(cambiosDeMedicacion([{ nombre: 'Losartán' }], ['  LOSARTAN  '])![0].tipo).toBe('sin-cambio')
  })

  it('y queda escrito por qué', () => {
    expect(POR_QUE_EL_SILENCIO_NO_SUSPENDE_TAMPOCO_AQUI).toMatch(/no está\s*\n?\s*suspendido/)
  })
})

describe('lo que no se puede componer se queda vacío, no se rellena', () => {
  const p = componerPaquete({ nota: notaFirmada(), medicacionPrevia: [] })

  it('signos de alarma vacíos si el médico no los escribió', () => {
    expect(p.warningSigns).toEqual([])
  })

  it('material educativo, documentos y preguntas, vacíos y declarados', () => {
    expect(p.educationalMaterial).toEqual([])
    expect(p.documents).toEqual([])
    expect(p.unansweredQuestions).toEqual([])
  })

  it('el módulo no contiene ni un consejo general', () => {
    const mod = readFileSync(join(process.cwd(), 'src/lib/paciente/paquete-de-visita.ts'), 'utf8')
    const codigo = mod.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const frase of ['tome mucha agua', 'acuda a urgencias', 'si empeora', 'consulte a su médico'])
      expect(codigo.toLowerCase()).not.toContain(frase)
  })

  it('no hay ninguna llamada a un modelo de lenguaje en este camino', () => {
    /** El §1 de `patient-facing-ai.md`: el nivel 9 —modelo general— nunca
     *  ORIGINA un dato del paciente. Aquí no hay nivel 9 en absoluto. */
    const mod = readFileSync(join(process.cwd(), 'src/lib/paciente/paquete-de-visita.ts'), 'utf8')
    for (const s of ['llamarIA', 'anthropic', 'openai', 'fetch('])
      expect(mod.toLowerCase()).not.toContain(s.toLowerCase())
  })
})

describe('LA COMPUERTA: ninguna cifra del paquete que no esté en la nota', () => {
  it('las instrucciones no añaden cifras propias', () => {
    /**
     * Mismo criterio que el golden de `como-se-lo-explico` (REG-240/242): toda
     * cifra con unidad del paquete tiene que estar en la nota, salvo el 24÷n
     * EXACTO, que es aritmética sobre lo que el médico dictó.
     */
    const meds = [AMOXI, { nombre: 'Paracetamol', dosis: '500 mg', via: 'oral', frecuencia: 'cada 6 horas' }]
    const p = componerPaquete({ nota: notaFirmada({ medicamentos: meds }), medicacionPrevia: [] })

    const origen = meds.map(m => `${m.nombre} ${m.dosis} ${m.frecuencia} ${m.duracion ?? ''}`).join(' ')
    const enLaNota = cifrasClinicas(origen)
    const enElPaquete = cifrasClinicas(p.medicationInstructions.map(m => m.instruccion).join(' '))

    const horas = [...enLaNota.keys()].map(c => c.match(/^(\d+)horas?$/)?.[1]).filter(Boolean).map(Number)
    const legitimas = new Set(horas.filter(h => h > 0 && h <= 24 && 24 % h === 0).map(h => `${24 / h}veces`))

    const inventadas = [...enElPaquete.keys()].filter(c => !enLaNota.has(c) && !legitimas.has(c))
    expect(inventadas, `cifras que el paquete añade sin origen: ${inventadas.join(', ')}`).toEqual([])
  })

  it('el resumen del médico va LITERAL', () => {
    const p = componerPaquete({ nota: notaFirmada({ resumenEjecutivo: '  Faringitis.  ' }), medicacionPrevia: [] })
    expect(p.encounterSummary).toBe('Faringitis.')
  })
})

describe('REG-307 · la fecha de la próxima cita, que nunca podía renderizarse', () => {
  it('`2026-09-01` no se convierte en el 31 de agosto', () => {
    /**
     * `new Date('2026-09-01')` es medianoche UTC: formateado en la zona del
     * consultorio sale un día antes. Se leen las partes de la cadena. Probada al
     * revés: con `new Date` esto falla en cualquier huso al oeste de Greenwich.
     */
    expect(fechaDeSeguimientoEnLlano('2026-09-01')).toBe('1 de septiembre de 2026')
    expect(fechaDeSeguimientoEnLlano('2026-01-31')).toBe('31 de enero de 2026')
  })

  it('el texto libre se devuelve tal cual: no se le inventa una fecha', () => {
    expect(fechaDeSeguimientoEnLlano('en 3 meses')).toBe('en 3 meses')
    expect(fechaDeSeguimientoEnLlano('')).toBe('')
    expect(fechaDeSeguimientoEnLlano(undefined)).toBe('')
  })

  it('y ahora sí produce el cuarto bloque de la hoja', () => {
    /** Estaba fijo en `undefined` en la consulta: el bloque «Su próxima cita»
     *  no podía renderizarse jamás. */
    const b = comoSeLoExplico({ proximaCita: fechaDeSeguimientoEnLlano('2026-09-01') })
    expect(comoTexto(b)).toContain('1 de septiembre de 2026')
  })
})

/* ══════════════════════════════════════════════════════════════════════════ */

describe('EL DATO TIENE QUE LLEGAR — los tres tramos del camino', () => {
  const RUTA = readFileSync(join(process.cwd(), 'src/app/api/expediente/paquete-visita/route.ts'), 'utf8')
  const CONSULTA = readFileSync(join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')
  const HOJA = readFileSync(join(process.cwd(), 'src/components/HojaParaElPaciente.tsx'), 'utf8')
  const PORTAL = readFileSync(join(process.cwd(), 'src/app/mi/[token]/page.tsx'), 'utf8')

  describe('1 · el médico tiene por dónde liberar', () => {
    it('la hoja exige saber si la nota está firmada, sin valor por defecto', () => {
      /** Un `= true` habría dejado la puerta abierta al segundo llamador que se
       *  olvide de pasarlo, que es como se pierden estas compuertas. */
      expect(HOJA).toMatch(/notaFirmada: boolean/)
      expect(HOJA).not.toMatch(/notaFirmada[^:]*=\s*true/)
    })

    it('sin firma no se renderiza ningún botón de entrega', () => {
      const cuerpo = HOJA.replace(/\/\*[\s\S]*?\*\//g, '')
      expect(cuerpo).toMatch(/p\.notaFirmada \?/)
      /* Copiar, imprimir y liberar viven todos dentro de la rama firmada. */
      const firmada = cuerpo.slice(cuerpo.indexOf('p.notaFirmada ?'), cuerpo.indexOf(') : ('))
      for (const s of ['onClick={copiar}', 'window.print()', 'p.onLiberar'])
        expect(firmada).toContain(s)
    })

    it('la consulta le pasa el estado real de la firma', () => {
      expect(CONSULTA).toMatch(/notaFirmada=\{firmada\}/)
      expect(CONSULTA).toMatch(/onLiberar=\{liberarAlPaciente\}/)
    })

    it('y sigue sin aparecer en un paciente internado', () => {
      /** El guardia de REG-242 no se perdió al añadir la compuerta de firma. */
      expect(CONSULTA).toMatch(/\{!esNotaHospital && \(\s*\n\s*<HojaParaElPaciente/)
    })

    it('la fecha de seguimiento ya no va fija en `undefined`', () => {
      expect(CONSULTA).not.toContain('proximaCita={undefined}')
      expect(CONSULTA).toMatch(/proximaCita=\{fechaDeSeguimientoEnLlano\(proximoSeguimiento\)\}/)
    })
  })

  describe('2 · el servidor compone, comprueba y escribe', () => {
    it('el contenido NO viaja en el cuerpo: sólo identificadores', () => {
      /**
       * Si el navegador mandara el texto, esta pantalla podría publicarle al
       * paciente cualquier cosa bajo el membrete de su médico, y la compuerta de
       * firma sería una comprobación del navegador — o sea, ninguna.
       */
      const cuerpo = CONSULTA.slice(CONSULTA.indexOf('const liberarAlPaciente'), CONSULTA.indexOf('const mmss'))
      expect(cuerpo).toContain('clinicId, patientId, notaId')
      for (const campo of ['medicamentos:', 'resumen:', 'diagnosticos:', 'encounterSummary'])
        expect(cuerpo).not.toContain(campo)
    })

    it('la ruta lee la nota de Firestore y compone con la compuerta', () => {
      expect(RUTA).toContain("collection('notas')")
      expect(RUTA).toContain('componerPaquete(')
      expect(RUTA).toContain('NotaSinFirmar')
    })

    it('el aprobador sale del token verificado, nunca del cuerpo', () => {
      expect(RUTA).toMatch(/const aprobador = acc\.email \?\? acc\.uid/)
      expect(RUTA).toContain('liberar(borrador, aprobador,')
      expect(RUTA).not.toMatch(/body\.approvedBy|body\.aprobadoPor/)
    })

    it('comprueba la compuerta del portal ANTES de escribir', () => {
      const i = RUTA.indexOf('visibleParaElPaciente(paquete)')
      const j = RUTA.indexOf('.create(paquete)')
      expect(i).toBeGreaterThan(0)
      expect(j).toBeGreaterThan(i)
    })

    it('usa `create`, no `set`: una versión entregada no se sobrescribe', () => {
      expect(RUTA).toContain('.create(paquete)')
      expect(RUTA).not.toMatch(/\.set\(paquete/)
    })

    it('un borrador se responde 409 y con el motivo, no con «error»', () => {
      const rama = RUTA.slice(RUTA.indexOf('e instanceof NotaSinFirmar'))
      expect(rama).toContain('status: 409')
      expect(rama).toMatch(/Primero firma la nota/)
    })
  })

  describe('3 · el paciente lo recibe', () => {
    it('el portal pide los paquetes al servidor', () => {
      expect(PORTAL).toContain("action: 'paquetes'")
      expect(PORTAL).toContain('setPaquetes(')
    })

    it('distingue «cargando» de «tu médico no ha liberado nada»', () => {
      /** Decirle «no hay plan» mientras la petición viaja es una mentira que se
       *  lee como un hecho. */
      expect(PORTAL).toContain('paquetes === null')
      expect(PORTAL).toContain('paquetes.length === 0')
    })

    it('no pinta la sección de cambios cuando el servidor no pudo determinarlos', () => {
      expect(PORTAL).toMatch(/\{pq\.medicationChanges && \(/)
    })
  })
})

describe('la ruta está declarada donde exige la regla de aislamiento', () => {
  const REGISTRO = readFileSync(join(process.cwd(), 'src/lib/authz/registro-rutas.ts'), 'utf8')

  it('con `firmar` para escribir y `clinico.leer` para leer', () => {
    /**
     * `firmar` y no `clinico.escribir`: enfermería escribe en el expediente y no
     * puede aprobar lo que el paciente leerá como palabra de su médico. Probado
     * al revés: si alguien la relaja a `clinico.escribir`, esto falla.
     */
    const decl = /'expediente\/paquete-visita': \{[\s\S]*?\n  \},/.exec(REGISTRO)?.[0] ?? ''
    expect(decl).not.toBe('')
    expect(decl).toContain("POST: 'firmar'")
    expect(decl).toContain("GET: 'clinico.leer'")
  })
})

describe('un paquete liberado es lo que se entregó, y se puede liberar otra vez', () => {
  it('la versión la decide quien llama, y `liberar` la conserva', () => {
    const v2 = componerPaquete({ nota: notaFirmada(), medicacionPrevia: [] }, 2)
    expect(v2.version).toBe(2)
    expect(liberar(v2, 'dr_david', 1_754_000_000_000).version).toBe(2)
  })

  it('el idioma por defecto es es-MX, y se puede pedir otro', () => {
    expect(componerPaquete({ nota: notaFirmada(), medicacionPrevia: [] }).language).toBe('es-MX')
    expect(componerPaquete({ nota: notaFirmada(), medicacionPrevia: [], idioma: 'en-US' }).language).toBe('en-US')
  })
})

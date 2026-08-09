/**
 * EL PAQUETE DE LA VISITA: SE COMPONE DE LO FIRMADO Y SE LIBERA A MANO.
 * V9 · `POSTVISIT-001` · REG-306.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Tres cosas, y ninguna rompía nada:
 *
 * 1. **La hoja del paciente se componía del borrador en curso.** «Copiar» e
 *    «Imprimir» estaban disponibles con la nota a medio dictar: el médico podía
 *    entregarle en mano, con su membrete, un tratamiento que diez minutos
 *    después sería otro. (`POSTVISIT-GATE-001`.)
 * 2. **La superficie del paciente estaba montada y vacía por construcción.**
 *    `PATIENT-COMPANION-001` dejó el modelo, la compuerta del servidor y los
 *    cinco destinos, pero **no había dónde pulsar para crear un paquete**: cero
 *    documentos en producción, para siempre. (`POSTVISIT-ENTREGA-001`.)
 * 3. **La acción `paquetes` de `/api/portal` no la llamaba nadie.** El servidor
 *    sabía filtrar y responder; la pantalla del paciente nunca preguntaba. Es
 *    la regla «el dato tiene que LLEGAR» en su forma más limpia: conectado de
 *    un lado, sin destinatario del otro.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Leyendo el checkpoint de la unidad anterior, que lo dejó escrito con todas
 * las letras: «hoy ningún paquete existe en producción: falta la pantalla del
 * médico para liberarlos». Los tres P1 estaban declarados en `BACKLOG.json`
 * desde la auditoría `PATIENT-UX-TRUTH-001`.
 *
 * ── LA CAUSA RAÍZ, QUE ES UNA SOLA ──────────────────────────────────────────
 *
 * El producto tenía **el contenido resuelto** —`como-se-lo-explico` compone
 * instrucciones sin inventar una cifra desde REG-242— y **no tenía ni la
 * compuerta ni el camino**. Lo que faltaba no era saber qué decirle al
 * paciente: era decidir *cuándo* deja de ser un borrador y *por dónde* llega.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Firmar y liberar son **dos actos** (regla 4 de `patient-facing-ai.md`), y
 * entre el borrador y el paciente hay tres cierres independientes:
 *
 *   · `componerPaquete` se niega si la nota no está firmada — se lanza, no se
 *     devuelve `null`, porque un `null` se ignora con un `?.`;
 *   · `liberar()` exige quién aprueba y cuándo, y quién sale de la SESIÓN
 *     verificada, nunca del cuerpo de la petición;
 *   · `visibleParaElPaciente` filtra en el servidor antes de responder.
 *
 * Y el contenido no viaja desde el navegador: la ruta recibe tres
 * identificadores y compone ella misma desde la nota firmada.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No ejecuta la ruta HTTP.** Comprueba las funciones puras que la ruta usa,
 *   y —leyendo el archivo— que la ruta las use y de dónde saca el aprobador.
 *   Montar Firestore admin exige el emulador, que es otra suite.
 * - **No se ha visto en un navegador.** Ni el botón, ni la pantalla del
 *   paciente, ni el enlace. `NAV-NAVEGADOR-001` sigue abierto.
 * - **No prueba que el enlace emitido abra el portal**: eso depende del secreto
 *   HMAC y de la versión del paciente, y vive en el golden del token.
 * - **No valida el contenido clínico.** Que la composición no invente cifras lo
 *   vigila el golden de `como-se-lo-explico`; aquí se comprueba que el paquete
 *   no añada ninguna sobre lo que la nota ya traía.
 * - **No cubre los signos de alarma ni el material educativo**: van vacíos a
 *   propósito y esta prueba sella que sigan vacíos, no que se llenen.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  componerPaquete, cambiosDeMedicacion, ultimaVersionPorNota,
  liberar, visibleParaElPaciente, NOTA_SIN_FIRMAR,
  type PaqueteDeVisita,
} from '@/lib/paciente/paquete-de-visita'
import { cifrasClinicas } from '@/lib/seguridad/la-reescritura-no-pierde-cifras'
import { vecesAlDia } from '@/lib/paciente/como-se-lo-explico'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const RUTA_LIBERAR = leer('src', 'app', 'api', 'expediente', 'paquete-visita', 'route.ts')
const RUTA_PORTAL = leer('src', 'app', 'api', 'portal', 'route.ts')
const PANTALLA_PACIENTE = leer('src', 'app', 'mi', '[token]', 'page.tsx')
const PANTALLA_CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const HOJA = leer('src', 'components', 'HojaParaElPaciente.tsx')
const REGISTRO = leer('src', 'lib', 'authz', 'registro-rutas.ts')

const NOTA_FIRMADA = {
  id: 'nota_1',
  estado: 'firmada',
  resumenEjecutivo: 'Faringitis aguda estreptocócica.',
  diagnosticos: [{ descripcion: 'Faringitis aguda' }],
  medicamentos: [
    { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
  ],
  estudiosOrden: ['Biometría hemática'],
}

describe('la compuerta de firma: de un borrador no se compone nada', () => {
  it('se niega con una nota en borrador', () => {
    /**
     * LA QUE MUERDE. Probada al revés: quitando el `if` de `estado !== firmada`
     * en `componerPaquete`, este caso pasa a componer y la prueba falla — que
     * es exactamente el defecto que `POSTVISIT-GATE-001` describía.
     */
    expect(() => componerPaquete({ ...NOTA_FIRMADA, estado: 'borrador' })).toThrow(NOTA_SIN_FIRMAR)
  })

  it('se niega con una nota sin estado declarado', () => {
    /* Ausencia de estado no es «firmada». Es el modo de fallo de una migración
       o de un documento escrito por otro módulo. */
    expect(() => componerPaquete({ ...NOTA_FIRMADA, estado: undefined })).toThrow(NOTA_SIN_FIRMAR)
  })

  it('se niega sin saber de qué nota sale', () => {
    expect(() => componerPaquete({ ...NOTA_FIRMADA, id: '' })).toThrow()
  })

  it('con la nota firmada, compone — y nace DRAFT igualmente', () => {
    const p = componerPaquete(NOTA_FIRMADA)
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
    /* Firmar es hacia el expediente; liberar es hacia el paciente. Que la nota
       esté firmada es condición NECESARIA y no suficiente. */
    expect(visibleParaElPaciente(p)).toBe(false)
  })
})

describe('la composición no añade ni una cifra que la nota no traiga', () => {
  it('toda cifra del paquete está en la nota, o es 24÷n exacto', () => {
    /**
     * La única aritmética permitida es la que `como-se-lo-explico` documenta y
     * prueba: «cada 8 horas» → «3 veces al día», y **sólo** cuando 24÷n es
     * exacto. «Cada 5 horas» no son «4,8 veces al día» y redondearlo sería
     * inventarle una pauta al médico.
     *
     * Se declara aquí en vez de excluir la comprobación entera: si mañana la
     * composición añadiera cualquier otra cifra —una duración «habitual», un
     * intervalo redondeado— esta prueba la caza.
     */
    const p = componerPaquete(NOTA_FIRMADA, { seguimiento: '2026-09-01', contactoDelConsultorio: 'Llama al 5555555555' })
    const enLaNota = new Set(cifrasClinicas(JSON.stringify(NOTA_FIRMADA)).keys())
    for (const m of NOTA_FIRMADA.medicamentos) {
      const derivada = vecesAlDia(m.frecuencia)
      if (derivada) for (const c of cifrasClinicas(derivada).keys()) enLaNota.add(c)
    }
    const enElPaquete = cifrasClinicas(
      [p.encounterSummary, ...p.medicationInstructions.map(m => m.instruccion), ...p.orders].join(' \n'),
    )
    for (const cifra of enElPaquete.keys()) expect([...enLaNota]).toContain(cifra)
  })

  it('los tres campos que no hay de dónde sacar van VACÍOS, no rellenos', () => {
    /**
     * Signos de alarma = indicación médica. Material educativo = evidencia
     * curada. Documentos = `DOCUMENTS-001`. Rellenarlos con «lo habitual» es
     * la regla 1 de seguridad clínica al revés, y aquí se lo diría a alguien
     * que no puede detectar el error.
     */
    const p = componerPaquete(NOTA_FIRMADA)
    expect(p.warningSigns).toEqual([])
    expect(p.educationalMaterial).toEqual([])
    expect(p.documents).toEqual([])
    expect(p.unansweredQuestions).toEqual([])
  })

  it('sin seguimiento indicado, el campo va vacío — no se compone uno', () => {
    expect(componerPaquete(NOTA_FIRMADA).followUp).toBe('')
  })

  it('sin resumen firmado cae a los diagnósticos, que también están firmados', () => {
    const p = componerPaquete({ ...NOTA_FIRMADA, resumenEjecutivo: '' })
    expect(p.encounterSummary).toBe('Faringitis aguda')
  })
})

describe('qué cambió desde la visita anterior', () => {
  const antes = [{ nombre: 'Amoxicilina', dosis: '500 mg', frecuencia: 'cada 8 horas' }]

  it('SIN lista previa devuelve null, no «sin cambios»', () => {
    /**
     * La distinción entera de este campo. «No aparecía antes» y «no sé qué
     * había antes» no se le pueden decir igual a un paciente: la segunda es
     * dato de ausencia. Probada al revés: devolviendo `[]` en vez de `null`,
     * falla.
     */
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], undefined)).toBeNull()
    expect(componerPaquete(NOTA_FIRMADA).medicationChanges).toBeNull()
  })

  it('una lista previa VACÍA sí es conocimiento: todo es nuevo', () => {
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], [])).toEqual([
      { nombre: 'Amoxicilina', tipo: 'nuevo' },
    ])
  })

  it('lo que estaba y ya no está sale como suspendido', () => {
    const c = cambiosDeMedicacion([], antes)
    expect(c).toEqual([{ nombre: 'Amoxicilina', tipo: 'suspendido' }])
  })

  it('MISMO fármaco con OTRA dosis es `ajustado`, nunca «sin cambio»', () => {
    /**
     * La razón por la que existe el cuarto tipo, y el caso que más daño hace
     * si se equivoca: «sigue igual» sobre un medicamento cuya dosis se acaba
     * de duplicar es la frase que hace que el paciente tome la vieja.
     *
     * Probada al revés: comparando sólo por nombre —que es como estaba
     * declarado el tipo antes de escribir la composición— devuelve
     * `sin-cambio` y esta prueba falla.
     */
    const c = cambiosDeMedicacion(
      [{ nombre: 'Amoxicilina', dosis: '875 mg', frecuencia: 'cada 8 horas' }],
      antes,
    )
    expect(c).toEqual([{ nombre: 'Amoxicilina', tipo: 'ajustado' }])
  })

  it('cambiar la frecuencia también es un ajuste', () => {
    const c = cambiosDeMedicacion(
      [{ nombre: 'Amoxicilina', dosis: '500 mg', frecuencia: 'cada 12 horas' }],
      antes,
    )
    expect(c?.[0].tipo).toBe('ajustado')
  })

  it('idéntico es `sin-cambio`', () => {
    expect(cambiosDeMedicacion([...antes], antes)).toEqual([{ nombre: 'Amoxicilina', tipo: 'sin-cambio' }])
  })

  it('acentos y mayúsculas no inventan una suspensión y un alta', () => {
    /* «Ampicilina» y «ampicilina» son el mismo fármaco. Sin normalizar, el
       paciente leería que uno se suspendió y otro empezó — el mismo día. */
    const c = cambiosDeMedicacion(
      [{ nombre: 'AMOXICILINA', dosis: '500 mg', frecuencia: 'cada 8 horas' }],
      antes,
    )
    expect(c).toEqual([{ nombre: 'AMOXICILINA', tipo: 'sin-cambio' }])
  })
})

describe('el paciente ve UNA versión por consulta', () => {
  const base = (notaId: string, version: number) =>
    ({ notaId, version, estado: 'RELEASED', approvedBy: 'u1', approvedAt: 1_754_000_000_000 + version }) as PaqueteDeVisita

  it('de dos versiones de la misma nota queda la mayor', () => {
    /**
     * Las dos pasan la compuerta: las dos se liberaron de verdad, con su
     * aprobador y su fecha. Enseñárselas juntas es cómo se acaba tomando la
     * dosis corregida y la equivocada el mismo día.
     */
    const r = ultimaVersionPorNota([base('n1', 1), base('n1', 2)])
    expect(r).toHaveLength(1)
    expect(r[0].version).toBe(2)
  })

  it('no confunde consultas distintas', () => {
    const r = ultimaVersionPorNota([base('n1', 2), base('n2', 1)])
    expect(r.map(p => p.notaId).sort()).toEqual(['n1', 'n2'])
  })

  it('el orden de llegada no decide', () => {
    expect(ultimaVersionPorNota([base('n1', 2), base('n1', 1)])[0].version).toBe(2)
  })
})

describe('el servidor compone y aprueba; el navegador sólo pide', () => {
  it('la ruta compone ella misma desde la nota, con la compuerta puesta', () => {
    expect(RUTA_LIBERAR).toContain('componerPaquete(nota')
    expect(RUTA_LIBERAR).toContain('NOTA_SIN_FIRMAR')
  })

  it('quién aprueba sale de la sesión verificada, NUNCA del cuerpo', () => {
    /**
     * Un `approvedBy` que llegara del navegador convertiría el campo en
     * decorativo: cualquiera podría liberar firmando con el nombre de otro.
     */
    expect(RUTA_LIBERAR).toContain('const aprobadoPor = acc.uid')
    expect(RUTA_LIBERAR).not.toMatch(/aprobadoPor\s*=\s*(body|String\(body)/)
  })

  it('sólo tres identificadores cruzan la frontera', () => {
    /* Si el contenido llegara en el cuerpo, esto sería un «escribe lo que
       quieras en el expediente del paciente» con buenos modales. */
    expect(PANTALLA_CONSULTA + leer('src', 'components', 'LiberarAlPaciente.tsx'))
      .toContain('JSON.stringify({ clinicId, patientId, notaId })')
  })

  it('escribe con `create`: un paquete liberado no se pisa', () => {
    expect(RUTA_LIBERAR).toMatch(/\.create\(liberado\)/)
    expect(RUTA_LIBERAR).not.toMatch(/\.(set|update)\(liberado/)
  })

  it('el POST exige capacidad de escritura clínica', () => {
    expect(RUTA_LIBERAR).toContain("verificarCapacidad(req, clinicId, 'clinico.escribir')")
  })

  it('la ruta está declarada en el registro de autorización', () => {
    /* Una ruta de API sin declarar es «any-member implícito» hasta que alguien
       lo mire. El guardián del registro también lo caza; esto lo ata a la unidad. */
    expect(REGISTRO).toContain("'expediente/paquete-visita'")
  })

  it('el portal deja UNA versión por consulta, con la función con nombre', () => {
    expect(RUTA_PORTAL).toContain('ultimaVersionPorNota(')
    expect(RUTA_PORTAL).toContain('.filter(visibleParaElPaciente)')
  })
})

describe('el dato LLEGA: cada extremo tiene quien lo pida y quien lo pinte', () => {
  it('la pantalla del paciente PIDE los paquetes', () => {
    /**
     * Ésta es la prueba de la regla «el dato tiene que LLEGAR». La acción
     * `paquetes` existía en el servidor desde REG-304 y esta pantalla nunca la
     * llamaba: filtrada, autorizada, probada — y sin destinatario.
     */
    expect(PANTALLA_PACIENTE).toContain("action: 'paquetes'")
    expect(PANTALLA_PACIENTE).toContain('setPaquetes')
  })

  it('la pantalla del paciente PINTA lo que llegó', () => {
    expect(PANTALLA_PACIENTE).toContain('pq.medicationInstructions')
    expect(PANTALLA_PACIENTE).toContain('pq.medicationChanges')
    expect(PANTALLA_PACIENTE).toContain('pq.followUp')
  })

  it('un cambio de medicación no se comunica sólo con color', () => {
    /* §ACCESIBILIDAD de la especificación: «Never represent clinical risk only
       with color». La palabra lo dice. */
    expect(PANTALLA_PACIENTE).toContain('ya no lo tomes')
    expect(PANTALLA_PACIENTE).toContain('cambió cómo tomarlo')
  })

  it('la consulta monta el botón de liberar y le pasa la firma', () => {
    expect(PANTALLA_CONSULTA).toContain('<LiberarAlPaciente')
    expect(PANTALLA_CONSULTA).toMatch(/<LiberarAlPaciente[\s\S]{0,240}firmada=\{firmada\}/)
  })
})

describe('la hoja del paciente no sale del consultorio sin firma', () => {
  it('copiar e imprimir dependen de la firma', () => {
    /**
     * Probada al revés: quitando `entregable &&` del encabezado, los dos
     * botones vuelven a estar disponibles sobre el borrador en curso — que es
     * `POSTVISIT-GATE-001` tal como estaba.
     */
    expect(HOJA).toContain('const entregable = p.firmada === true')
    expect(HOJA).toMatch(/\{entregable && \(<>/)
  })

  it('por defecto NO es entregable: la compuerta no hay que acordarse de activarla', () => {
    /* `firmada?: boolean` sin valor equivale a vista previa. Quien monte esta
       hoja en una pantalla nueva y no diga nada obtiene lo seguro. */
    expect(HOJA).toContain('firmada?: boolean')
    expect(HOJA).not.toContain('firmada = true')
  })

  it('la consulta le pasa la firma real, y ya no fija la próxima cita en undefined', () => {
    /* `proximaCita={undefined}` llevaba desde REG-242 impidiendo que el cuarto
       bloque se renderizara jamás, con el dato en la misma pantalla. */
    expect(PANTALLA_CONSULTA).toMatch(/<HojaParaElPaciente[\s\S]{0,300}firmada=\{firmada\}/)
    expect(PANTALLA_CONSULTA).not.toContain('proximaCita={undefined}')
  })
})

describe('liberar sigue exigiendo quién y cuándo', () => {
  it('un paquete recién compuesto y liberado sí es visible', () => {
    const p = liberar(componerPaquete(NOTA_FIRMADA), 'uid_medico', 1_754_000_000_000)
    expect(visibleParaElPaciente(p)).toBe(true)
    expect(p.approvedBy).toBe('uid_medico')
  })

  it('sin aprobador no se libera, aunque la nota esté firmada', () => {
    expect(() => liberar(componerPaquete(NOTA_FIRMADA), '', 1_754_000_000_000)).toThrow()
  })
})

/**
 * LO QUE FIRMÓ LLEGA AL PACIENTE — V9 · `POSTVISIT-001` · REG-306, REG-307.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos defectos que son las dos mitades del mismo hueco, y que por separado
 * parecían menores:
 *
 * **REG-306 · La hoja del paciente no tenía compuerta de firma.**
 * `HojaParaElPaciente` se montaba con el estado VIVO de la pantalla
 * (`medicamentos`, `estudiosOrden`), y su única guarda era `{!esNotaHospital}`.
 * Justo encima, `ComoCerrarLaConsulta` sí exigía `{firmada && …}`. La cabecera
 * del módulo de composición afirmaba que el contenido salía de lo «ya revisado y
 * firmado»: era **intención de diseño, no precondición**. El médico podía copiar
 * al portapapeles —o imprimir— una hoja compuesta de un borrador a medio dictar y
 * mandarla por WhatsApp. Nada lo impedía.
 *
 * **REG-307 · Y la hoja no llegaba nunca al paciente.** Dos botones: copiar e
 * imprimir. No estaba en `/mi/[token]`, ni en ninguna plantilla de WhatsApp. Del
 * otro lado, `/api/portal` tenía desde REG-304 una acción `paquetes` con su
 * compuerta y su alcance clínico… **y ningún llamador**: contestaba
 * correctamente a nadie. Y `proximaCita={undefined}` estaba fijo en la consulta,
 * así que el cuarto bloque de la hoja era código que **no podía renderizarse
 * jamás**.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Los dos salieron de `PATIENT-UX-TRUTH-001` leyendo el producto real, y el
 * segundo se confirmó del modo que manda la regla «el dato tiene que LLEGAR»:
 * buscando el otro extremo. La acción existía, la pantalla no la pedía. Es la
 * familia más grande de este repositorio —«escrito, probado y sin conectar»—
 * aparecida esta vez del lado del paciente, donde nadie de dentro la ve.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El esfuerzo se puso en **componer bien** y no en **entregar**. El motor
 * (`como-se-lo-explico`) es lo mejor de esta superficie: determinista, sin
 * modelo, se niega a expandir «cada 5 horas». Y su salida moría en un botón de
 * portapapeles.
 *
 * ── LAS REGLAS QUE LO HACEN SEGURO ──────────────────────────────────────────
 *
 * 1. **Sin firma no se entrega.** `componerPaquete` LANZA si la nota no está
 *    firmada, y la hoja de la consulta esconde copiar e imprimir. La hoja se
 *    sigue viendo —el médico necesita ver qué se llevará el paciente mientras
 *    todavía puede cambiarlo—: lo que se cierra es la salida, no la vista.
 * 2. **Firmar no libera.** El paquete nace `DRAFT` aunque la nota esté firmada;
 *    liberar es otro acto, con `approvedBy` sacado del token verificado.
 * 3. **Sin lista previa no se afirma nada.** `medicationChanges` es `null`, no un
 *    arreglo de «sin-cambio»: ausencia de dato no es dato de ausencia.
 * 4. **Quien escribe y quien lee nombran la MISMA colección**, por constante
 *    compartida. REG-160 fue exactamente lo contrario.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No monta la ruta HTTP con Firestore.** Comprueba las funciones que la ruta
 *   usa, y que la ruta las use — el emulador es otra suite. Lo que sí se
 *   comprueba es que las dos puntas del dato nombren la misma colección, que es
 *   lo que ninguna prueba de contrato veía.
 * - **No se ha visto en un navegador.** Ni la entrega, ni el estado «ya
 *   entregado», ni cómo se lee la tarjeta en un teléfono. `NAV-NAVEGADOR-001`.
 * - **No prueba el 409 de re-liberación contra la base**, sólo que la ruta lo
 *   declara y no reescribe. Volver a liberar una versión nueva es
 *   `POSTVISIT-VERSION-001`, y llega con el versionado de `DOCUMENTS-001`.
 * - **No valida el contenido clínico** de la nota: si el médico firmó una dosis
 *   equivocada, se le entrega la dosis equivocada. Eso lo vigilan las compuertas
 *   de prescripción, antes de firmar.
 * - **No cubre `warningSigns` ni `educationalMaterial`**: siguen vacíos porque no
 *   hay campo firmado de donde salgan. La pantalla del paciente ya sabe
 *   pintarlos el día que lo haya.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  componerPaquete, cambiosDeMedicacion, liberar, visibleParaElPaciente,
  COLECCION_PAQUETES, NOTA_SIN_FIRMAR, PAQUETE_SIN_NOTA,
  type NotaParaElPaquete,
} from '@/lib/paciente/paquete-de-visita'
import { fechaEnLlano, comoSeLoExplico } from '@/lib/paciente/como-se-lo-explico'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const RUTA_LIBERAR = leer('src', 'app', 'api', 'expediente', 'paquete-visita', 'route.ts')
const RUTA_PORTAL = leer('src', 'app', 'api', 'portal', 'route.ts')
const PANTALLA_CONSULTA = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const PANTALLA_PACIENTE = leer('src', 'app', 'mi', '[token]', 'page.tsx')
const HOJA = leer('src', 'components', 'HojaParaElPaciente.tsx')

/** Una nota firmada mínima, con lo que la composición mira de ella. */
const notaFirmada = (extra: Partial<NotaParaElPaquete> = {}): NotaParaElPaquete => ({
  id: 'nota_1',
  estado: 'firmada',
  resumenEjecutivo: 'Faringitis aguda.',
  medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' }],
  estudiosOrden: ['Biometría hemática'],
  ...extra,
})

describe('la compuerta de firma — POSTVISIT-GATE-001', () => {
  it('compone el paquete de una nota FIRMADA', () => {
    const p = componerPaquete({ nota: notaFirmada() })
    expect(p.notaId).toBe('nota_1')
    expect(p.medicationInstructions).toHaveLength(1)
  })

  it('SE NIEGA a componer el paquete de un borrador', () => {
    /**
     * Ésta es la que muerde, y es la prueba al revés del defecto: con el código
     * de antes —la hoja compuesta del estado vivo, sin mirar el estado de la
     * nota— este caso pasaba sin protestar y el paciente recibía un borrador.
     */
    expect(() => componerPaquete({ nota: notaFirmada({ estado: 'borrador' }) }))
      .toThrow(NOTA_SIN_FIRMAR)
  })

  it('se niega también cuando el estado falta o es cualquier otra cosa', () => {
    /** Falla CERRADO: lo que no dice «firmada» no está firmado. */
    for (const estado of [undefined, null, '', 'FIRMADA', 'firmando', 42, {}]) {
      expect(() => componerPaquete({ nota: notaFirmada({ estado }) })).toThrow(NOTA_SIN_FIRMAR)
    }
  })

  it('se niega a componer un paquete sin la nota de la que sale', () => {
    /** Sin `notaId` el paquete no puede referenciar su fuente, y la fuente de
     *  verdad tiene que seguir siendo la nota (invariante nº1). */
    expect(() => componerPaquete({ nota: notaFirmada({ id: '' }) })).toThrow(PAQUETE_SIN_NOTA)
  })

  it('el paquete nace DRAFT aunque la nota esté firmada', () => {
    /** Firmar es hacia el expediente; liberar es hacia el paciente. Dos actos. */
    const p = componerPaquete({ nota: notaFirmada() })
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
    expect(visibleParaElPaciente(p)).toBe(false)
  })

  it('la hoja de la consulta esconde copiar e imprimir sin firma', () => {
    /**
     * La compuerta de la INTERFAZ. `entregable` es `false` por defecto: una
     * compuerta que hay que acordarse de activar no es una compuerta.
     */
    expect(HOJA).toContain('const entregable = p.entregable === true')
    expect(HOJA).toContain('{!entregable && (')
    expect(HOJA).toContain('{entregable && (<>')
    expect(PANTALLA_CONSULTA).toContain('entregable={firmada}')
  })

  it('el botón de entregar sólo existe con la nota firmada', () => {
    expect(PANTALLA_CONSULTA).toMatch(/\{firmada && clinicId && notaId && \(\s*<EntregarAlPaciente/)
  })
})

describe('la composición no inventa nada', () => {
  it('no aparece ninguna cifra que no estuviera en la nota', () => {
    /**
     * La garantía de `como-se-lo-explico`, comprobada sobre el paquete: toda
     * cifra del resultado tiene que estar en la entrada. Se permite `3` porque
     * sale de 24 ÷ 8 —aritmética exacta sobre lo que el médico dictó— y ese caso
     * lo cubre el golden de `como-se-lo-explico`.
     */
    const p = componerPaquete({ nota: notaFirmada() })
    const salida = JSON.stringify(p).match(/\d+/g) ?? []
    const entrada = new Set(['500', '8', '7', '3', '1'])
    expect(salida.filter(n => !entrada.has(n))).toEqual([])
  })

  it('los signos de alarma van VACÍOS: son indicación médica', () => {
    /** No hay parámetro para rellenarlos, a propósito. «Acuda a urgencias si
     *  empeora» es una indicación que nadie firmó. */
    const p = componerPaquete({ nota: notaFirmada() })
    expect(p.warningSigns).toEqual([])
    expect(p.educationalMaterial).toEqual([])
  })

  it('el paquete no copia el teléfono del consultorio', () => {
    /** Vive en su configuración. Copiado aquí, un paquete viejo apuntaría a un
     *  número que ya no contesta — y duplicaría una fuente de verdad. */
    expect(componerPaquete({ nota: notaFirmada() }).clinicianContactRules).toBe('')
  })

  it('un medicamento sin nombre no produce una línea vacía', () => {
    const p = componerPaquete({ nota: notaFirmada({ medicamentos: [{ dosis: '500 mg' }] }) })
    expect(p.medicationInstructions).toEqual([])
  })
})

describe('qué cambió desde la visita anterior', () => {
  const previa = [{ nombre: 'Losartán', dosis: '50 mg', via: 'oral', frecuencia: 'cada 24 horas' }]

  it('SIN lista previa devuelve null, no «sin cambios»', () => {
    /**
     * La que más importa de este bloque. «No aparecía antes» y «no sé qué había
     * antes» son cosas distintas: decirle al paciente «sigue igual» cuando nadie
     * sabe qué tomaba es afirmar sobre un dato que no existe.
     */
    expect(cambiosDeMedicacion(previa, undefined)).toBeNull()
    expect(componerPaquete({ nota: notaFirmada() }).medicationChanges).toBeNull()
  })

  it('una lista previa VACÍA sí es un dato: todo lo de hoy es nuevo', () => {
    const c = cambiosDeMedicacion(previa, [])
    expect(c).toEqual([{ nombre: 'Losartán', tipo: 'nuevo' }])
  })

  it('lo que ya no está sale como suspendido y lo nuevo como nuevo', () => {
    const c = cambiosDeMedicacion([{ nombre: 'Amoxicilina', dosis: '500 mg' }], previa) ?? []
    expect(c).toEqual([
      { nombre: 'Amoxicilina', tipo: 'nuevo' },
      { nombre: 'Losartán', tipo: 'suspendido' },
    ])
  })

  it('una DOSIS distinta es «cambiado», nunca «sin-cambio»', () => {
    /**
     * Probada al revés: comparando sólo nombres —que es lo que decía el diseño
     * original— este caso salía `sin-cambio`, y el paciente leía «sigue igual»
     * junto a una dosis que no es la que tomaba. Es el fallo que más caro sale de
     * este módulo, porque se lee como un acierto.
     */
    const hoy = [{ nombre: 'Losartán', dosis: '100 mg', via: 'oral', frecuencia: 'cada 24 horas' }]
    expect(cambiosDeMedicacion(hoy, previa)).toEqual([{ nombre: 'Losartán', tipo: 'cambiado' }])
  })

  it('lo idéntico sale como sin-cambio, y va al FINAL', () => {
    const hoy = [{ nombre: 'Amoxicilina', dosis: '500 mg' }, ...previa]
    const c = cambiosDeMedicacion(hoy, previa) ?? []
    expect(c.map(x => x.tipo)).toEqual(['nuevo', 'sin-cambio'])
  })

  it('«losartan» y «Losartán» son el mismo fármaco', () => {
    /** Sin normalizar acentos, el mismo medicamento salía suspendido Y nuevo a la
     *  vez — dos renglones contradictorios en la pantalla del paciente. */
    const hoy = [{ nombre: 'losartan', dosis: '50 mg', via: 'oral', frecuencia: 'cada 24 horas' }]
    expect(cambiosDeMedicacion(hoy, previa)).toEqual([{ nombre: 'losartan', tipo: 'sin-cambio' }])
  })
})

describe('cuándo volver — el bloque que no podía renderizarse jamás', () => {
  it('la consulta ya no pasa `proximaCita={undefined}` fijo', () => {
    expect(PANTALLA_CONSULTA).not.toContain('proximaCita={undefined}')
    expect(PANTALLA_CONSULTA).toContain('cuandoVolver={proximoSeguimiento || undefined}')
  })

  it('«cuándo volver» y «próxima cita» son bloques DISTINTOS', () => {
    /**
     * «Vuelve el 1 de septiembre» es una indicación del médico; «su próxima cita
     * es el 1 de septiembre» es una cita que alguien apartó. Con el título
     * equivocado el paciente se presenta ese día esperando que lo esperen.
     */
    const bloques = comoSeLoExplico({ cuandoVolver: '2026-09-01' })
    expect(bloques.map(b => b.titulo)).toEqual(['Cuándo volver'])
    expect(comoSeLoExplico({ proximaCita: '2026-09-01' }).map(b => b.titulo))
      .toEqual(['Su próxima cita'])
  })

  it('la fecha no se adelanta un día', () => {
    /**
     * `new Date('2026-09-01')` es medianoche UTC, o sea las 18:00 del 31 de
     * agosto en México. Formatearlo con la zona local le adelanta un día a la
     * fecha de seguimiento — el mismo defecto que REG-293 cerró en los cobros,
     * esta vez impreso en la hoja del paciente.
     */
    expect(fechaEnLlano('2026-09-01')).toBe('1 de septiembre de 2026')
    expect(fechaEnLlano('2026-01-31')).toBe('31 de enero de 2026')
  })

  it('lo que no es una fecha ISO se deja TAL CUAL', () => {
    /** Si el médico escribió «en tres semanas», eso es lo que el paciente lee. */
    expect(fechaEnLlano('en tres semanas')).toBe('en tres semanas')
    expect(fechaEnLlano('2026-13-01')).toBe('2026-13-01')
    expect(fechaEnLlano(undefined)).toBe('')
  })

  it('el seguimiento llega al paquete por `followUp`', () => {
    const p = componerPaquete({ nota: notaFirmada(), cuandoVolver: '2026-09-01' })
    expect(p.followUp).toBe('1 de septiembre de 2026')
  })
})

describe('quién libera, y con qué identidad', () => {
  it('la ruta exige la capacidad `firmar`, no membresía a secas', () => {
    expect(RUTA_LIBERAR).toContain("verificarCapacidad(req, clinicId, 'firmar')")
  })

  it('`approvedBy` sale del TOKEN, nunca del cuerpo de la petición', () => {
    /**
     * Si viniera del cuerpo, cualquiera con la sesión abierta podría liberar un
     * paquete «aprobado por» quien quisiera. `firestore.rules` tiene esta
     * colección en `write: if false` por lo mismo.
     */
    expect(RUTA_LIBERAR).toContain('const quien = acceso.email || acceso.uid')
    expect(RUTA_LIBERAR).toContain('liberar(paquete, quien, Date.now())')
    expect(RUTA_LIBERAR).not.toMatch(/approvedBy:\s*(texto\()?body\./)
  })

  it('libera pasando por `liberar()`, que exige quién y cuándo', () => {
    const p = liberar(componerPaquete({ nota: notaFirmada() }), 'dr@ejemplo.mx', 1_754_000_000_000)
    expect(visibleParaElPaciente(p)).toBe(true)
    expect(p.approvedBy).toBe('dr@ejemplo.mx')
  })

  it('la ruta NO reescribe un paquete ya liberado', () => {
    /** «Lo que se entregó se entregó»: 409 y no se toca. Corregirlo es liberar
     *  una versión nueva, y eso es `POSTVISIT-VERSION-001`. */
    expect(RUTA_LIBERAR).toContain("if (ya?.estado === 'RELEASED')")
    expect(RUTA_LIBERAR).toContain('status: 409')
  })

  it('escribe con lista blanca de campos, no con un spread', () => {
    /** Un `set({...paquete})` mete mañana cualquier campo interno nuevo en un
     *  documento que el paciente puede leer. */
    expect(RUTA_LIBERAR).not.toMatch(/\.set\(\{\s*\.\.\./)
    expect(RUTA_LIBERAR).toContain('merge: false')
  })

  it('la ruta está declarada en el registro de capacidades', () => {
    const registro = leer('src', 'lib', 'authz', 'registro-rutas.ts')
    expect(registro).toContain("'expediente/paquete-visita': { tipo: 'capacidad', capacidad: 'firmar' }")
  })
})

describe('EL DATO TIENE QUE LLEGAR — las dos puntas nombran la misma colección', () => {
  it('quien escribe y quien lee usan la constante compartida', () => {
    /**
     * REG-160 fue exactamente esto: validar la colección declarada y escribir en
     * otra ruta, porque el nombre estaba escrito dos veces. Una prueba de
     * contrato sobre cada lado por separado habría pasado las dos veces.
     */
    expect(COLECCION_PAQUETES).toBe('paquetes_visita')
    expect(RUTA_LIBERAR).toContain('COLECCION_PAQUETES')
    expect(RUTA_LIBERAR).toContain('.collection(COLECCION_PAQUETES)')
    expect(RUTA_PORTAL).toContain('.collection(COLECCION_PAQUETES)')
    /* Y ninguno de los dos vuelve a escribir el nombre a mano. */
    expect(RUTA_LIBERAR).not.toContain("collection('paquetes_visita')")
    expect(RUTA_PORTAL).not.toContain("collection('paquetes_visita')")
  })

  it('el escritor apunta al MISMO padre que el lector: el paciente', () => {
    /** Escribir en `clinics/{c}/paquetes_visita` y leer en
     *  `clinics/{c}/patients/{p}/paquetes_visita` es el defecto que este caso
     *  vigila: los dos tienen que colgar del paciente. */
    expect(RUTA_LIBERAR).toContain("collection('patients').doc(patientId)")
    expect(RUTA_PORTAL).toContain("collection('patients').doc(patientId)")
  })

  it('la pantalla del paciente PIDE los paquetes', () => {
    /**
     * La acción existía desde REG-304 con su compuerta y su alcance… y ningún
     * llamador: contestaba correctamente a nadie. Esto es el otro extremo del
     * dato, que es donde manda mirar la regla.
     */
    expect(PANTALLA_PACIENTE).toContain("action: 'paquetes'")
    expect(PANTALLA_PACIENTE).toContain('setPaquetes')
  })

  it('la pantalla del médico llama a la ruta que libera', () => {
    const boton = leer('src', 'components', 'EntregarAlPaciente.tsx')
    expect(boton).toContain("'/api/expediente/paquete-visita'")
    expect(boton).toContain("accion: 'liberar'")
    expect(PANTALLA_CONSULTA).toContain('<EntregarAlPaciente')
  })
})

describe('lo que la pantalla del paciente NO se permite decirle', () => {
  it('no le dice «ya no lo tomes» de lo que dejó de aparecer', () => {
    /**
     * Que un fármaco no esté en la receta de hoy **no** significa que el médico
     * lo haya suspendido: puede no haberlo vuelto a listar. Suspender un
     * medicamento está en la lista de lo que la IA del paciente NUNCA hace por su
     * cuenta (§3 de `patient-facing-ai.md`), así que se dice lo que el documento
     * dice y la decisión se escala.
     */
    expect(PANTALLA_PACIENTE).not.toMatch(/[Yy]a no lo tomes/)
    expect(PANTALLA_PACIENTE).toContain('Antes de dejar de tomarlo, pregúntale a tu médico')
  })

  it('no pinta «sin cambios» cuando no hubo con qué comparar', () => {
    /** `medicationChanges: null` no puede acabar en un bloque vacío que se lea
     *  como «nada cambió». El bloque entero se condiciona a que haya cambios. */
    expect(PANTALLA_PACIENTE).toContain('{cambios && cambios.length > 0 && (')
  })

  it('no vuelve a filtrar por estado en el cliente', () => {
    /**
     * Filtrar en dos sitios invita a que un día sólo filtre uno, y el que se
     * olvidaría es el que no cierra la ruta HTTP. La compuerta está en
     * `/api/portal` y se comprueba en `un-borrador-no-llega-al-paciente`.
     */
    expect(PANTALLA_PACIENTE).not.toContain("estado === 'RELEASED'")
  })

  it('distingue «todavía no se sabe» de «no hay ninguno»', () => {
    /** Pintar el mismo cartel para los dos le dice al paciente que su médico no
     *  le ha liberado nada mientras la petición sigue en vuelo. */
    expect(PANTALLA_PACIENTE).toContain('paquetes !== null && paquetes.length === 0')
  })
})

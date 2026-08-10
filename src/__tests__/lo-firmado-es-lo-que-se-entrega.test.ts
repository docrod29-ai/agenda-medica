/**
 * LO FIRMADO ES LO QUE SE ENTREGA — V9 · `POSTVISIT-001` · REG-306, REG-307.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * Dos cosas, y la segunda es más grande que la primera.
 *
 * **1 · La hoja del paciente salía del borrador en curso (REG-306).**
 * `HojaParaElPaciente` se compone en vivo mientras el médico dicta: eso es lo
 * que la hace útil durante la consulta. Y desde el primer minuto tenía botón de
 * «Copiar» y de «Imprimir», sin una sola comprobación de firma. Lo que acababa
 * en el WhatsApp del paciente podía ser una dosis a medio corregir, un fármaco
 * que el médico estaba a punto de quitar, o una frecuencia mal oída que todavía
 * no había revisado.
 *
 * La hoja no mentía —enseñaba exactamente lo que había en pantalla—. Lo que
 * faltaba era que dijera que **lo que había todavía no estaba firmado**.
 *
 * **2 · Y lo firmado no llegaba a ninguna parte (REG-307).**
 * `PATIENT-COMPANION-001` dejó la superficie del paciente montada, el modelo
 * `PaqueteDeVisita` con sus dos estados y la compuerta del servidor que impide
 * que un borrador la cruce. Faltaba el acto: **nadie podía crear un paquete**.
 * La pestaña «Cuidado» del portal enseñaba un estado vacío honesto que iba a
 * seguir vacío para siempre, porque `componerPaquete` se había retirado del
 * repositorio por no tener llamador.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Los dos estaban **escritos y declarados** en el backlog de
 * `PATIENT-UX-TRUTH-001` como `POSTVISIT-GATE-001` y `POSTVISIT-ENTREGA-001`, y
 * en `PATIENT_COMPANION_STATE.md` con esta frase: «el contenido está resuelto;
 * faltan la compuerta y el camino». Esta unidad es esa frase, ejecutada.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `escrito_y_sin_conectar`, en las dos direcciones a la vez, que es la forma
 * rara: el motor que compone existía **sin salida**, y la pantalla que entrega
 * existía **sin entrada**. Ninguna prueba de ninguna de las dos piezas podía
 * verlo, porque cada una era correcta por su cuenta. Es la misma familia de la
 * regla «el dato tiene que LLEGAR»: la pregunta no es si el código lo dice, es
 * si el destinatario lo recibe.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Mirar es libre; salir no.** Y salir hacia el paciente exige dos actos
 * distintos, en este orden: firmar la nota (hacia el expediente) y liberar el
 * paquete (hacia la persona). El segundo no se hereda del primero, no lo puede
 * hacer el navegador y no lo puede hacer un modelo de lenguaje.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No monta la ruta HTTP con Firestore.** Comprueba el motor puro y que la
 *   ruta lo use como debe, leyendo su código. Ejercitarla de verdad exige el
 *   emulador y es otra suite (`vitest.emulator.config.ts`).
 * - **No se ha visto en un navegador.** Ni la pantalla del médico, ni la del
 *   paciente, ni el recorrido completo. Sigue siendo `NAV-NAVEGADOR-001`.
 * - **No cubre corregir un paquete ya liberado.** Recomponer sobre un
 *   `RELEASED` responde 409 a propósito: corregir lo entregado es liberar una
 *   versión nueva, y eso queda abierto como `POSTVISIT-VERSION-002` con el
 *   campo `version` ya en el modelo.
 * - **No detecta un cambio de dosis del mismo fármaco.** `cambiosDeMedicacion`
 *   compara por NOMBRE: el mismo fármaco con otra dosis sale `sin-cambio`. Está
 *   declarado en el módulo y no es un olvido — comparar cifras y equivocarse le
 *   diría al paciente que su dosis cambió cuando no cambió, o al revés.
 * - **No valida que el texto compuesto se entienda.** Que no invente cifras lo
 *   vigila el golden de `como-se-lo-explico`; que se lea bien es otra cosa.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  componerPaquete, cambiosDeMedicacion, puedeComponerse, liberar,
  visibleParaElPaciente, ESTADO_QUE_PERMITE_COMPONER,
  type NotaParaComponer,
} from '@/lib/paciente/paquete-de-visita'
import { REGISTRO_RUTAS } from '@/lib/authz/registro-rutas'

const RAIZ = process.cwd()
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')

const RUTA = leer('src/app/api/paciente/paquete/route.ts')
const PANTALLA_MEDICO = leer('src/components/LiberarParaElPaciente.tsx')
const HOJA = leer('src/components/HojaParaElPaciente.tsx')
const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
const PORTAL_PACIENTE = leer('src/app/mi/[token]/page.tsx')

/** Una nota firmada mínima, con las cifras que el paciente va a leer. */
const notaFirmada = (extra: Partial<NotaParaComponer> = {}): NotaParaComponer => ({
  id: 'nota_1',
  estado: 'firmada',
  resumenEjecutivo: 'Faringitis aguda estreptocócica.',
  diagnosticos: [{ descripcion: 'Faringitis aguda' }],
  medicamentos: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' }],
  estudiosOrden: ['Biometría hemática'],
  ...extra,
})

describe('POSTVISIT-GATE-001 · sin firma no hay paquete', () => {
  it('sólo el estado «firmada» permite componer', () => {
    expect(ESTADO_QUE_PERMITE_COMPONER).toBe('firmada')
    expect(puedeComponerse({ estado: 'firmada' })).toBe(true)
  })

  it('un borrador NO permite componer — probado al revés', () => {
    /**
     * Ésta es la que muerde. Si `puedeComponerse` dejara pasar el borrador, el
     * resto de la unidad seguiría en verde y el paciente recibiría texto que su
     * médico todavía estaba corrigiendo.
     */
    expect(puedeComponerse({ estado: 'borrador' })).toBe(false)
  })

  it('una nota cancelada tampoco, y una sin estado tampoco', () => {
    expect(puedeComponerse({ estado: 'cancelada' })).toBe(false)
    expect(puedeComponerse({ estado: undefined })).toBe(false)
    expect(puedeComponerse({ estado: null })).toBe(false)
    // Ni un objeto que se parezca: sólo la cadena exacta.
    expect(puedeComponerse({ estado: { estado: 'firmada' } })).toBe(false)
  })

  it('`componerPaquete` LANZA sobre una nota sin firmar, no devuelve null', () => {
    /**
     * Lanzar y no devolver `null` es deliberado: un `null` se ignora por
     * accidente en el sitio de uso, y lo que hay al otro lado de este error es
     * un borrador clínico camino del paciente.
     */
    expect(() => componerPaquete({ nota: notaFirmada({ estado: 'borrador' }) })).toThrow()
    expect(() => componerPaquete({ nota: notaFirmada() })).not.toThrow()
  })

  it('la hoja del paciente no deja copiar ni imprimir sin firma', () => {
    /* El defecto original: los dos botones existían desde el primer minuto. */
    expect(HOJA).toContain('firmada?: boolean')
    expect(HOJA).toMatch(/const firmada = p\.firmada === true/)
    // Los dos botones viven DENTRO de la rama firmada.
    expect(HOJA).toMatch(/\{firmada \? \(/)
    // Y `copiar` se defiende sola: un botón escondido no cierra nada.
    expect(HOJA).toMatch(/const copiar = async \(\) => \{[\s\S]{0,220}if \(!firmada\) return/)
  })

  it('el valor por omisión de la compuerta es CERRADO', () => {
    /**
     * `p.firmada === true` y no `p.firmada !== false`. Una compuerta cuyo estado
     * seguro depende de que alguien se acuerde de pasar la prop no es una
     * compuerta: es una convención.
     */
    expect(HOJA).not.toMatch(/firmada\s*!==\s*false/)
    expect(HOJA).toContain('firmada?: boolean')
  })

  it('la consulta le pasa el estado real de la nota, no un literal', () => {
    expect(CONSULTA).toMatch(/firmada=\{firmada\}/)
    expect(CONSULTA).not.toMatch(/firmada=\{true\}/)
  })
})

describe('POSTVISIT-001 · la composición no inventa nada', () => {
  it('el paquete nace DRAFT, sin aprobador y sin fecha', () => {
    const p = componerPaquete({ nota: notaFirmada() })
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedAt).toBeNull()
    expect(p.approvedBy).toBeNull()
    expect(p.version).toBe(1)
    /* Y una nota FIRMADA sigue naciendo DRAFT: firmar no libera. */
    expect(visibleParaElPaciente(p)).toBe(false)
  })

  it('ninguna cifra del paquete deja de estar en la nota', () => {
    /**
     * La garantía de fondo de toda esta superficie. Se mide sobre el resultado
     * completo: si algún día alguien mete un modelo de lenguaje en medio, o un
     * «tome mucha agua» con un número, esta prueba lo caza.
     */
    const nota = notaFirmada()
    const p = componerPaquete({ nota, proximaCita: '' })
    const cifrasDe = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? [])
    const enLaNota = new Set(cifrasDe(JSON.stringify(nota)))
    const enElPaquete = cifrasDe(
      [p.encounterSummary, ...p.medicationInstructions.map(m => m.instruccion), ...p.orders, ...p.warningSigns].join(' '),
    )
    const inventadas = enElPaquete.filter(c => !enLaNota.has(c))
    /**
     * La única excepción tolerada es la aritmética EXACTA de `vecesAlDia`
     * (24 ÷ 8 = 3), que `como-se-lo-explico` ya tiene sellada con su porqué.
     */
    expect(inventadas.filter(c => c !== '3')).toEqual([])
  })

  it('la instrucción sale en español llano, con lo que el médico puso', () => {
    const p = componerPaquete({ nota: notaFirmada() })
    expect(p.medicationInstructions).toHaveLength(1)
    expect(p.medicationInstructions[0].instruccion).toContain('500 mg')
    expect(p.medicationInstructions[0].instruccion).toContain('por la boca')
    expect(p.medicationInstructions[0].instruccion).toContain('3 veces al día')
  })

  it('los signos de alarma sólo salen de lo que escribió el médico', () => {
    /* Sin nada escrito, van vacíos. Nunca «lo habitual»: regla 1. */
    expect(componerPaquete({ nota: notaFirmada() }).warningSigns).toEqual([])
    const p = componerPaquete({ nota: notaFirmada(), signosDeAlarma: ['Fiebre que no cede', '  '] })
    expect(p.warningSigns).toEqual(['Fiebre que no cede'])
  })

  it('el material educativo va vacío mientras no haya evidencia curada', () => {
    const p = componerPaquete({ nota: notaFirmada(), signosDeAlarma: ['x'] })
    expect(p.educationalMaterial).toEqual([])
    expect(p.documents).toEqual([])
    expect(p.unansweredQuestions).toEqual([])
  })

  it('sin resumen ejecutivo se usan los diagnósticos firmados, no una redacción nueva', () => {
    const p = componerPaquete({
      nota: notaFirmada({ resumenEjecutivo: '', diagnosticos: [{ descripcion: 'Faringitis aguda' }, { descripcion: 'Rinitis alérgica' }] }),
    })
    expect(p.encounterSummary).toBe('Faringitis aguda · Rinitis alérgica')
  })
})

describe('POSTVISIT-001 · ausencia de dato no es dato de ausencia', () => {
  it('sin lista previa, `medicationChanges` es null y NO «sin cambios»', () => {
    /**
     * La distinción que da nombre a la regla 4 de seguridad clínica. Decirle al
     * paciente «sin cambios» cuando en realidad no se consultó su historial es
     * inventarle una tranquilidad, y sobre eso decide si sigue tomando algo.
     */
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], undefined)).toBeNull()
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], null)).toBeNull()
    expect(componerPaquete({ nota: notaFirmada() }).medicationChanges).toBeNull()
  })

  it('una lista previa VACÍA sí afirma: todo es nuevo', () => {
    const c = cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], [])
    expect(c).toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })

  it('lo que estaba y ya no está sale como suspendido', () => {
    const c = cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], [{ nombre: 'Ibuprofeno' }])
    expect(c).toContainEqual({ nombre: 'Amoxicilina', tipo: 'nuevo' })
    expect(c).toContainEqual({ nombre: 'Ibuprofeno', tipo: 'suspendido' })
  })

  it('el mismo fármaco escrito distinto no se cuenta dos veces', () => {
    /* Acentos y mayúsculas no son un fármaco distinto. */
    const c = cambiosDeMedicacion([{ nombre: 'Metamizol' }], [{ nombre: 'metamizol' }])
    expect(c).toEqual([{ nombre: 'Metamizol', tipo: 'sin-cambio' }])
  })

  it('un medicamento sin nombre no produce una línea fantasma', () => {
    const c = cambiosDeMedicacion([{ nombre: '' }, { nombre: 'Amoxicilina' }], [])
    expect(c).toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })
})

describe('POSTVISIT-001 · liberar es un acto del servidor, no del navegador', () => {
  it('la ruta existe, está declarada y exige `firmar` para escribir', () => {
    const decl = REGISTRO_RUTAS['paciente/paquete']
    expect(decl, 'la ruta no está en el registro de rutas').toBeDefined()
    expect(decl).toMatchObject({ tipo: 'porMetodo', metodos: { GET: 'clinico.leer', POST: 'firmar' } })
    expect(RUTA).toContain("verificarCapacidad(req, clinicId, 'firmar')")
  })

  it('`approvedBy` sale de la sesión verificada, NUNCA del cuerpo', () => {
    /**
     * El corazón de la unidad. Un `approvedBy` que viaja por la red es un campo
     * que se puede escribir, y entonces «lo aprobó su médico» deja de
     * significar nada. Se comprueba en las dos direcciones: que se use el
     * acceso verificado, y que el cuerpo no traiga ese campo.
     */
    expect(RUTA).toMatch(/const quien = acc\.email \|\| acc\.uid/)
    expect(RUTA).toMatch(/liberar\(paquete, quien, Date\.now\(\)\)/)
    expect(RUTA).not.toMatch(/body\.approvedBy|body\.aprobadoPor/)
  })

  it('el contenido clínico lo lee el servidor de la nota, no lo manda el cliente', () => {
    /* El cuerpo sólo trae identificadores y los signos de alarma del médico. */
    expect(RUTA).toMatch(/leerNota\(clinicId, patientId, notaId\)/)
    expect(RUTA).not.toMatch(/body\.medicamentos|body\.medicationInstructions|body\.encounterSummary/)
  })

  it('la compuerta de firma se comprueba también AL LIBERAR, no sólo al componer', () => {
    /**
     * Entre componer y liberar puede pasar cualquier cosa. Liberar sin volver a
     * mirar entregaría un paquete cuya nota ya no sostiene nada.
     */
    const gate = RUTA.match(/puedeComponerse\(nota\)/g) ?? []
    expect(gate.length).toBeGreaterThanOrEqual(2)
    expect(RUTA).toMatch(/if \(!puedeComponerse\(nota\)\)[\s\S]{0,400}status: 409/)
  })

  it('un paquete ya liberado no se reescribe', () => {
    expect(RUTA).toMatch(/enDisco\?\.estado === 'RELEASED'/)
    expect(RUTA).toContain('POSTVISIT-VERSION-002')
  })

  it('liberar deja rastro en la bitácora', () => {
    expect(RUTA).toContain('paquete_visita_liberado')
  })

  it('`liberar()` sigue exigiendo quién y cuándo', () => {
    const p = componerPaquete({ nota: notaFirmada() })
    expect(() => liberar(p, '', Date.now())).toThrow()
    expect(() => liberar(p, 'dra@ejemplo.mx', 0)).toThrow()
    const l = liberar(p, 'dra@ejemplo.mx', 1_754_000_000_000)
    expect(visibleParaElPaciente(l)).toBe(true)
  })
})

describe('POSTVISIT-ENTREGA-001 · el dato tiene que LLEGAR', () => {
  it('`componerPaquete` tiene llamador de verdad', () => {
    /**
     * La razón por la que este motor se retiró del repositorio en
     * `PATIENT-COMPANION-001`. Vuelve con quien lo llame, y esta prueba es lo
     * que impide que vuelva a quedarse solo.
     */
    expect(RUTA).toContain('componerPaquete(')
    expect(RUTA).toContain("from '@/lib/paciente/paquete-de-visita'")
  })

  it('la consulta monta la pantalla de liberación, y sólo con la nota firmada', () => {
    expect(CONSULTA).toContain("import { LiberarParaElPaciente } from '@/components/LiberarParaElPaciente'")
    expect(CONSULTA).toMatch(/\{!esNotaHospital && firmada && clinicId[\s\S]{0,80}<LiberarParaElPaciente/)
  })

  it('la pantalla del médico pide la vista previa al servidor y no la recompone', () => {
    /* Aprobar algo que no se ve es firmar en blanco; y dos composiciones
       distintas —una en el navegador, otra en el servidor— pueden discrepar. */
    expect(PANTALLA_MEDICO).toContain("const API = '/api/paciente/paquete'")
    expect(PANTALLA_MEDICO).toContain("accion: 'liberar'")
    /* Lo nombra en su cabecera —explica de quién es llamador— pero NO lo importa. */
    expect(PANTALLA_MEDICO).not.toMatch(/^import[^\n]*componerPaquete/m)
  })

  it('el portal del paciente PIDE los paquetes y los PINTA', () => {
    /**
     * «El dato tiene que LLEGAR»: que el servidor los sirva no basta si la
     * pantalla no los pide. Antes de esta unidad la pestaña «Cuidado» no hacía
     * ni una petición — enseñaba un estado vacío que iba a serlo para siempre.
     */
    expect(PORTAL_PACIENTE).toMatch(/action: 'paquetes'/)
    expect(PORTAL_PACIENTE).toMatch(/setPaquetes/)
    expect(PORTAL_PACIENTE).toMatch(/paquetes\?\.map/)
    expect(PORTAL_PACIENTE).toContain('medicationInstructions')
  })

  it('el paciente no ve «sin cambios» cuando no se pudo determinar', () => {
    /* La regla 4, aplicada en la pantalla que la lee alguien sin formación. */
    expect(PORTAL_PACIENTE).toMatch(/p\.medicationChanges && p\.medicationChanges\.some/)
  })

  it('el estado de carga y el estado vacío son distintos', () => {
    /* `null` = cargando, `[]` = el médico no ha liberado nada. Colapsarlos le
       diría al paciente «no hay nada» mientras la petición está en vuelo. */
    expect(PORTAL_PACIENTE).toMatch(/paquetes === null/)
    expect(PORTAL_PACIENTE).toMatch(/paquetes\?\.length === 0/)
  })
})

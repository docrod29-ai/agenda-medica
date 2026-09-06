/**
 * GOLDEN — LA PREGUNTA DEL PACIENTE LA CLASIFICA EL SERVIDOR, Y LA ESCALACIÓN LLEGA.
 *
 * V9 · `PATIENT-AI-001`, la mitad que convierte un motor en un producto.
 *
 * ── POR QUÉ ESTE GOLDEN EXISTE APARTE DEL DEL MOTOR ─────────────────────────
 *
 * `lo-que-el-paciente-pregunta-se-clasifica-antes-de-contestarse` prueba la
 * DECISIÓN: dado un texto y un plan, qué clase sale. Este prueba que esa
 * decisión **corra donde tiene que correr y con los datos que tiene que usar**.
 *
 * Son dos defectos distintos y el segundo no lo caza el primero. Es
 * literalmente la familia más grande de este repositorio —«escrito, probado y
 * sin conectar», 80 de 297— y su forma más cara ya ocurrió en esta misma
 * superficie: `componerPaquete` llegó con modelo, máquina de estados, compuerta,
 * reglas, matriz, respaldo y exportación ARCO, y **ningún camino del producto
 * escribía jamás un documento** (REG-335).
 *
 * ── LAS TRES COSAS QUE SÓLO EL SERVIDOR PUEDE GARANTIZAR ────────────────────
 *
 *  1. **El plan es el LIBERADO.** Se lee de Firestore y se filtra con
 *     `visibleParaElPaciente`. Si el navegador mandara el plan en el cuerpo, la
 *     lista de fuentes del §1 de `patient-facing-ai.md` sería una recomendación
 *     y no una frontera: bastaría con inventarse un `medicationInstructions`
 *     para que el portal «citara» cualquier cosa como aprobada por el médico.
 *  2. **La clase la pone el servidor.** Por eso `preguntas_paciente` es
 *     `write: if false` en las reglas: si el navegador pudiera escribir ahí,
 *     quien tuviera el token del portal podría guardar su pregunta ya marcada
 *     `ANSWER_FROM_APPROVED_PLAN` y fabricarse la constancia de que el sistema
 *     le contestó algo que nunca le contestó.
 *  3. **La escalación llega a un humano.** «La escalación es el producto, no el
 *     fallo» (§3). Una escalación que se queda en la pantalla es un cartel.
 *
 * ── POR QUÉ SE LEE EL FUENTE Y NO SE LEVANTA LA RUTA ────────────────────────
 *
 * Declarado, porque es la debilidad de este golden: `/api/portal` necesita
 * Firebase Admin y el emulador, y esta suite corre en cada cambio. Lo que aquí
 * se comprueba son **invariantes estructurales del fuente** — el mismo método
 * que ya usa `un-borrador-no-llega-al-paciente` para la acción `paquetes`.
 *
 * Se prueba al revés mutilando el fuente en memoria: si un guardián no se cae
 * con la ruta rota, no vigila nada.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No ejecuta la ruta.** El aislamiento entre consultorios y el token tienen
 *   su suite contra el emulador (`aislamiento-tenant` en CI).
 * · **No prueba que el WhatsApp salga.** `avisarAlConsultorio` ya registra el no
 *   entregado; que Meta lo entregue no lo puede afirmar ninguna prueba de aquí.
 * · **No mide la pantalla.** Que el aviso urgente salga en la primera línea se
 *   ve en un navegador.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RUTA = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'portal', 'route.ts'), 'utf8')

/** El bloque de una acción del `switch`, para poder exigirle cosas a ella sola. */
function accion(nombre: string, fuente = RUTA): string {
  const m = new RegExp(`case '${nombre}': \\{[\\s\\S]*?\\n      \\}`).exec(fuente)
  return m?.[0] ?? ''
}

describe('LA ACCIÓN EXISTE Y ESTÁ CONECTADA', () => {
  it('`preguntar` es una acción de la ruta, no una intención', () => {
    expect(accion('preguntar'), 'sin `case preguntar` la pantalla no tiene con quién hablar').not.toBe('')
  })

  it('y `preguntas` devuelve el historial, para que una respuesta sobreviva a recargar', () => {
    expect(accion('preguntas')).not.toBe('')
  })

  it('llama al motor determinista, y el motor existe', () => {
    expect(RUTA).toContain('clasificarPregunta')
    expect(RUTA).toContain("from '@/lib/paciente/pregunta-del-paciente'")
  })
})

describe('1 · EL PLAN ES EL LIBERADO, Y NO VIENE DEL NAVEGADOR', () => {
  const a = accion('preguntar')

  it('el plan se lee de Firestore', () => {
    expect(a).toContain("collection('paquetes_visita')")
  })

  it('y pasa por la compuerta CON NOMBRE', () => {
    // `.filter(visibleParaElPaciente)`, no una comparación suelta: una
    // comprobación con nombre se puede exigir en una prueba.
    expect(a).toContain('.filter(visibleParaElPaciente)')
  })

  it('el cuerpo de la petición NO puede traer el plan', () => {
    // Si `body.plan` existiera, cualquiera con el token se fabricaría un plan.
    expect(RUTA).not.toContain('body.plan')
    expect(RUTA).not.toContain('body.medicationInstructions')
  })

  it('`medicationChanges` cae a `null`, nunca a lista vacía', () => {
    /**
     * `?? []` afirmaría «no hubo cambios» sobre un paquete que quizá no pudo
     * calcularlos. Ausencia de dato no es dato de ausencia, y el lector de esta
     * frase es alguien que no puede detectar el error.
     */
    expect(a).toContain('medicationChanges ?? null')
    expect(a).not.toContain('medicationChanges ?? []')
  })
})

describe('2 · LA CLASE LA PONE EL SERVIDOR', () => {
  const a = accion('preguntar')

  it('la clase sale del motor, no del cuerpo de la petición', () => {
    expect(a).toContain('clase: r.clase')
    expect(RUTA).not.toContain('body.clase')
  })

  it('lo que se guarda es una lista blanca, nunca un `...body`', () => {
    /**
     * Se mira el LITERAL que se escribe, no el bloque entero: el bloque entero
     * contiene el comentario que explica esta misma regla, y un guardián que
     * tropieza con su propia documentación no vigila el código — vigila la
     * prosa. (Pasó en la primera ejecución de esta prueba.)
     */
    const doc = /const doc = \{[\s\S]*?\n        \}/.exec(a)?.[0] ?? ''
    expect(doc, 'no se encontró el literal que se guarda').not.toBe('')
    expect(doc).not.toContain('...')
    for (const campo of ['texto,', 'clase: r.clase', 'motivo: r.motivo', 'procedencia: r.procedencia']) {
      expect(doc, `${campo} tiene que enumerarse`).toContain(campo)
    }
  })

  it('exige alcance clínico — un token de agenda no abre esto, salvo que sea una urgencia', () => {
    /**
     * ── ESTE CASO PEDÍA EL LITERAL, Y EL LITERAL CAMBIÓ POR PI-004 ──────────
     *
     * `preguntar` sigue cerrada al alcance `agenda`… menos cuando lo que llega
     * es una de las urgencias del §6. Una urgencia no devuelve un solo dato
     * clínico del paciente: registra lo que escribió y enseña la vía. Contestar
     * «pide a tu médico el acceso» a quien dice que le falta el aire es
     * responderle que le falta un permiso.
     *
     * Lo que se vigila sigue siendo lo mismo —que la puerta exista y que
     * `preguntas` (que SÍ devuelve su historial) no tenga excepción ninguna—,
     * dicho sobre la forma nueva.
     */
    expect(a).toContain("alcance !== 'clinico'")
    expect(a, 'la única excepción es la urgencia, y va nombrada').toContain('!urgenciaDeEstaPeticion')
    expect(accion('preguntas')).toContain("if (alcance !== 'clinico')")
    expect(accion('preguntas'), 'el historial no tiene excepción: devuelve secreto médico').not.toContain('urgencia')
  })

  /**
   * PI-004 — LA URGENCIA SE MIRA ANTES QUE EL FRENO DE TASA.
   *
   * A las 2 a.m., tras varias recargas del portal, «me duele el pecho y me
   * falta el aire» recibió «Demasiadas consultas a tus documentos»: el freno
   * por paciente se preguntaba antes que la urgencia, así que nada se
   * clasificó, nada se registró y nadie se enteró. Es el fallo de ORDEN que
   * `urgencia.ts` dejó escrito, un piso más abajo.
   */
  it('la urgencia se clasifica ANTES de los frenos por paciente, y abre tarea igual', () => {
    const iUrgencia = RUTA.indexOf('const urgenciaDeEstaPeticion')
    const iFrenoClinico = RUTA.indexOf('portal:clinico:')
    expect(iUrgencia, 'desapareció la clasificación temprana').toBeGreaterThan(-1)
    expect(iUrgencia, 'el freno volvió a preguntarse antes que la urgencia').toBeLessThan(iFrenoClinico)
    // Y los frenos POR PACIENTE quedan dentro de la rama que la urgencia salta.
    expect(RUTA).toContain('if (!urgenciaDeEstaPeticion) {')
    // El freno por IP NO se salta: ése protege la ruta de una ráfaga, no al
    // consultorio de un paciente angustiado.
    expect(RUTA.indexOf('portal:ip:'), 'el freno por IP tiene que seguir por delante').toBeLessThan(iUrgencia)
    // Y la tarea del worklist se abre mirando también la clase.
    expect(RUTA).toContain("r.avisarAlConsultorio || r.clase === 'URGENT_REVIEW_REQUIRED'")
  })

  it('tiene freno propio: un token filtrado no convierte el buzón del médico en spam', () => {
    expect(RUTA).toContain('portal:pregunta:')
    expect(RUTA).toContain('PREGUNTAS_POR_VENTANA')
    // Estricto: si el freno no puede contar, no se atiende.
    expect(RUTA).toMatch(/limitarEstricto\(`portal:pregunta:/)
  })
})

describe('3 · LA ESCALACIÓN LLEGA A UN HUMANO', () => {
  const a = accion('preguntar')

  it('se GUARDA antes de contestarle al paciente', () => {
    /**
     * El orden importa: decirle «ya quedó registrada» y que no quede registrada
     * es peor que no ofrecer el canal. Si la escritura lanza, el paciente ve un
     * error honesto en vez de una promesa falsa.
     */
    const guarda = a.indexOf("collection('preguntas_paciente')")
    const responde = a.lastIndexOf('return NextResponse.json({')
    expect(guarda).toBeGreaterThan(-1)
    expect(guarda, 'se responde antes de guardar: la promesa saldría sin respaldo').toBeLessThan(responde)
  })

  it('y avisa al consultorio cuando el motor lo pide', () => {
    expect(a).toContain('r.avisarAlConsultorio')
    expect(a).toContain('avisoDePreguntaAlConsultorio')
    expect(a).toContain('avisarAlConsultorio(')
  })
})

describe('AL PACIENTE NO SE LE DEVUELVE EL MOTIVO', () => {
  it('ni al preguntar, ni en su propio historial', () => {
    /**
     * Saber que su frase encajó en `cambio_de_dosis` no le sirve y le enseña a
     * esquivar el clasificador. Va al documento y al consultorio, no al JSON.
     */
    const respuesta = /return NextResponse\.json\(\{\n\s+id: ref\.id,[\s\S]*?\}\)/.exec(accion('preguntar'))?.[0] ?? ''
    expect(respuesta).not.toBe('')
    expect(respuesta).not.toContain('motivo')

    const historial = /const preguntas = snapP\.docs[\s\S]*?return NextResponse\.json\(\{ preguntas \}\)/.exec(accion('preguntas'))?.[0] ?? ''
    expect(historial).not.toBe('')
    expect(historial).not.toContain('motivo:')
  })
})

describe('LA COLECCIÓN NUEVA ESTÁ DECLARADA EN LOS TRES SITIOS', () => {
  /**
   * `.claude/rules/security-tenant.md`: reglas, matriz y manifiesto del
   * respaldo. Cada uno tiene su propio guardián; esto comprueba que los tres
   * hablan de ESTA colección, que es lo que ninguno de los tres puede saber.
   *
   * «Una colección que nadie respalda se pierde el día que hace falta, y el
   * archivo llamado respaldo sigue pareciendo completo.»
   */
  it('firestore.rules, con escritura cerrada al navegador', () => {
    const reglas = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')
    const bloque = /match \/preguntas_paciente\/\{docId\} \{[\s\S]*?\}/.exec(reglas)?.[0] ?? ''
    expect(bloque, 'la colección no está en las reglas').not.toBe('')
    expect(bloque).toContain('allow write: if false')
    expect(bloque).toContain('isMedico(clinicId)')
  })

  it('la matriz de acceso, como CLÍNICO y escrito por el servidor', () => {
    const matriz = readFileSync(join(process.cwd(), 'src', 'lib', 'authz', 'matriz-acceso.ts'), 'utf8')
    expect(matriz).toContain('preguntas_paciente')
  })

  it('y el manifiesto del respaldo', () => {
    const respaldo = readFileSync(join(process.cwd(), 'src', 'lib', 'clinica', 'respaldo.ts'), 'utf8')
    expect(respaldo).toContain('preguntas_paciente')
  })
})

/* ────────────────────────────────────────────────────────────────────────────
   PROBADO AL REVÉS — con la ruta mutilada, cada guardián tiene que caerse
   ──────────────────────────────────────────────────────────────────────────── */

describe('ESTOS GUARDIANES SE CAEN CON LA RUTA ROTA', () => {
  it('CAE si se quita la compuerta de alcance clínico', () => {
    const roto = RUTA.replace(/if \(alcance !== 'clinico'\)/g, 'if (false)')
    expect(accion('preguntar', roto)).not.toContain("if (alcance !== 'clinico')")
  })

  it('CAE si el plan deja de filtrarse por `visibleParaElPaciente`', () => {
    // `replaceAll`, no `replace`: la primera aparición está en `paquetes`, y una
    // mutilación que no toca la acción que se vigila no demuestra nada.
    const roto = RUTA.replaceAll('.filter(visibleParaElPaciente)', '.filter(() => true)')
    expect(accion('preguntar', roto)).not.toContain('.filter(visibleParaElPaciente)')
  })

  it('CAE si se responde antes de guardar', () => {
    // La mutilación mueve la escritura al final: la promesa saldría sin respaldo.
    const a = accion('preguntar')
    const sinGuardar = a.replace("collection('preguntas_paciente')", "collection('otra_cosa')")
    expect(sinGuardar.indexOf("collection('preguntas_paciente')")).toBe(-1)
  })

  it('CAE si `medicationChanges` se degrada a lista vacía', () => {
    const roto = RUTA.replace('medicationChanges ?? null', 'medicationChanges ?? []')
    expect(accion('preguntar', roto)).toContain('medicationChanges ?? []')
  })

  it('CAE si el motivo se le devuelve al paciente', () => {
    // Se muta la RESPUESTA, no el documento que se guarda: los dos llevan
    // `escalada: r.avisarAlConsultorio,` y `replace` toca el primero, que es el
    // documento — donde el motivo SÍ debe estar.
    const roto = accion('preguntar').replace(
      'escalada: r.avisarAlConsultorio,\n        })',
      'escalada: r.avisarAlConsultorio,\n          motivo: r.motivo,\n        })',
    )
    const respuesta = /return NextResponse\.json\(\{\n\s+id: ref\.id,[\s\S]*?\}\)/.exec(roto)?.[0] ?? ''
    expect(respuesta).toContain('motivo')
  })
})

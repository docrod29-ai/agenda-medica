/**
 * GOLDEN — EL MOTOR SABÍA LEER CUATRO DIMENSIONES Y LE LLEGABAN DOS.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `aplicabilidad.ts` (WS-09, REG-387) evalúa si un estudio aplica a un paciente
 * y sabe leer cuatro dimensiones: edad, embarazo, función renal y alergia. La
 * función renal incluso trae la vigencia de REG-375 —«un número viejo no es un
 * número»— en un campo `tfg: { valor, vigente }` diseñado para eso.
 *
 * El único sitio que lo llama construía esto:
 *
 *     const estadoDelPaciente = {
 *       ...(typeof ctx.edad === 'number' ? { edadEnAnios: ctx.edad } : {}),
 *       ...(Array.isArray(ctx.alergias) ? { alergenos: ctx.alergias } : {}),
 *     }
 *
 * **`embarazo` y `tfg` no se rellenaban nunca.** No era inseguro —sin el dato el
 * motor responde `datos_insuficientes`, que es lo correcto— pero significaba que
 * un ensayo que excluye embarazadas jamás llegaba a decir nada sobre una
 * paciente embarazada del expediente, **teniendo el dato a un campo de
 * distancia**. La pantalla ya calculaba la creatinina y su vigencia.
 *
 * Es «el dato tiene que LLEGAR» en su forma más limpia: el contrato estaba bien
 * escrito por los dos lados y nadie los unió.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Recorriendo `WS-09.motor`, cuyo censo pedía «las otras diez dimensiones». Al
 * mirar el sitio de la llamada antes de añadir ninguna apareció que **dos de las
 * cuatro que ya existían estaban muertas**. Añadir diez sobre eso habría sido
 * construir más motor sin combustible.
 *
 * ── LA DISCREPANCIA QUE APARECIÓ AL MUDAR LA LECTURA DEL EMBARAZO ───────────
 *
 * La lectura de «¿está embarazada?» vivía dentro de `copiloto.ts` sin exportar.
 * Escribirla otra vez habría creado dos formas de leer los mismos diagnósticos,
 * así que se mudó a un módulo propio — y ahí se vio que **el comentario del
 * copiloto y su código no coinciden**: el comentario dice que un `diferencial`
 * cuenta para avisar, y el código lo excluye.
 *
 * Se conservó la conducta del CÓDIGO, no la del comentario, porque cambiarla
 * mueve un aviso de seguridad de medicamentos en embarazo. La pregunta queda
 * declarada en `LA_DISCREPANCIA_DEL_DIFERENCIAL` para el médico.
 *
 * ── LAS DOS DIMENSIONES NUEVAS, Y POR QUÉ SÓLO DOS ──────────────────────────
 *
 * El censo pedía diez. Se añadieron **comorbilidad** y **terapia previa**: las
 * dos únicas cuyo dato del paciente EXISTE hoy en el árbol (`problemasActivos`
 * y la lista de medicamentos). Las otras ocho se declaran, no se construyen —
 * un campo que nadie llena es una promesa del modelo, y eso ya se intentó y se
 * descartó en REG-370/371.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Sigue sin existir el veredicto «aplica»: el máximo es `nada_lo_excluye`. Y una
 * sospecha de embarazo viaja como **ausencia**, no como `false`: el motor
 * contesta `datos_insuficientes` en vez de afirmar sobre una duda. Ausencia de
 * dato no es dato de ausencia, también aquí.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · NO añade las otras ocho dimensiones del §9 (organismo, susceptibilidad,
 *   sitio, dispositivo, interacción, severidad, entorno, jurisdicción). Falta el
 *   dato del paciente, no el patrón.
 * · NO distingue «tratamiento previo con X» de «en tratamiento con X»: en un
 *   resumen se escriben igual y separarlas exigiría leer el tiempo verbal. La
 *   dimensión se llama `terapia_previa` y su frase dice qué se comprobó.
 * · NO unifica las tres copias de la cadena de CKD-EPI que viven en el copiloto.
 *   `tfgPorCkdEpi` existe y tiene un consumidor; migrar el copiloto es su unidad.
 * · NO comprueba en navegador que el contexto viaje: se comprueba que la
 *   pantalla lo construya y que la ruta lo acepte.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  dimensionDe, evaluarCriterio, aplicabilidad, type EstadoDelPaciente,
} from '@/lib/evidencia/aplicabilidad'
import {
  loQueElExpedienteDiceDelEmbarazo, tratarComoEmbarazada, embarazoParaAplicabilidad,
  LA_DECISION_DEL_DIFERENCIAL,
} from '@/lib/expediente/lo-que-el-expediente-dice-del-embarazo'
import { tfgPorCkdEpi } from '@/lib/expediente/funcion-renal'

const RUTA = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')
const CONSULTA = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

describe('el dato que no llegaba', () => {
  it('la pantalla manda el embarazo y la función renal con su vigencia', () => {
    /* El arreglo entero. Sin estas dos líneas el motor sigue contestando
       `datos_insuficientes` para siempre, con el dato a un campo de distancia. */
    expect(CONSULTA).toContain('embarazo: embarazoParaAplicabilidad(loQueElExpedienteDiceDelEmbarazo(dxDelCuadro))')
    expect(CONSULTA).toContain('tfg: { valor: tfgParaEvidencia, vigente: vigenciaRenal.vigente }')
  })

  it('y la ruta los acepta en vez de tirarlos', () => {
    expect(RUTA).toContain("typeof ctx.embarazo === 'boolean' ? { embarazo: ctx.embarazo }")
    expect(RUTA).toContain('vigente: !!ctx.tfg.vigente')
  })

  it('una TFG fuera de ventana NO decide un criterio renal', () => {
    /* REG-375 dicho por esta puerta: un número viejo no es un número. Si esto
       cayera, una creatinina del año pasado excluiría a un paciente hoy. */
    const criterio = 'Se excluyeron pacientes con TFG < 30 mL/min'
    const caduca: EstadoDelPaciente = { tfg: { valor: 22, vigente: false } }
    const vigente: EstadoDelPaciente = { tfg: { valor: 22, vigente: true } }
    expect(evaluarCriterio(criterio, 'exclusion', caduca).veredicto).toBe('datos_insuficientes')
    expect(evaluarCriterio(criterio, 'exclusion', vigente).veredicto).toBe('cumple')
  })

  it('la TFG se calcula con el motor canónico, y sin dato devuelve null', () => {
    /* `null` y no cero: un cero sería una insuficiencia renal terminal inventada. */
    expect(tfgPorCkdEpi(undefined, 60, 'Femenino')).toBeNull()
    expect(tfgPorCkdEpi(1.0, undefined, 'Masculino')).toBeNull()
    expect(tfgPorCkdEpi(900, 60, 'Masculino')).toBeNull()
    const tfg = tfgPorCkdEpi(1.0, 60, 'Masculino')
    expect(typeof tfg).toBe('number')
    expect(tfg!).toBeGreaterThan(50)
  })
})

describe('una sospecha de embarazo no afirma ni niega', () => {
  const dx = (descripcion: string, tipo?: string) => ({ descripcion, tipo }) as never

  it('confirmado viaja como true; descartado, como false', () => {
    expect(embarazoParaAplicabilidad(loQueElExpedienteDiceDelEmbarazo([dx('Embarazo', 'definitivo')]))).toBe(true)
    expect(embarazoParaAplicabilidad(loQueElExpedienteDiceDelEmbarazo([dx('Embarazo', 'descartado')]))).toBe(false)
  })

  it('un presuntivo viaja como AUSENCIA, no como false', () => {
    /**
     * Lo importante. Mandar `false` sobre una sospecha haría que un estudio que
     * excluye embarazadas se declarara aplicable a una paciente que quizá lo
     * está. `undefined` hace que el motor conteste `datos_insuficientes`.
     */
    const l = loQueElExpedienteDiceDelEmbarazo([dx('Probable embarazo', 'presuntivo')])
    expect(l.estado).toBe('posible')
    expect(embarazoParaAplicabilidad(l)).toBeUndefined()
    expect(evaluarCriterio('Se excluyeron mujeres embarazadas', 'exclusion', {}).veredicto)
      .toBe('datos_insuficientes')
  })

  it('«embarazo» y «embarazo descartado» a la vez es conflicto, no resolución', () => {
    const l = loQueElExpedienteDiceDelEmbarazo([dx('Embarazo', 'definitivo'), dx('Embarazo', 'descartado')])
    expect(l.estado).toBe('posible')
    expect(embarazoParaAplicabilidad(l)).toBeUndefined()
  })

  it('lo que nadie anotó sale `no_consta`, nunca `descartado`', () => {
    expect(loQueElExpedienteDiceDelEmbarazo([]).estado).toBe('no_consta')
    expect(loQueElExpedienteDiceDelEmbarazo(undefined).estado).toBe('no_consta')
    expect(loQueElExpedienteDiceDelEmbarazo([dx('Cefalea', 'definitivo')]).estado).toBe('no_consta')
  })
})

describe('la conducta del copiloto no cambió al mudar la lectura', () => {
  const dx = (descripcion: string, tipo?: string) => ({ descripcion, tipo }) as never

  it('avisar cuenta el presuntivo Y el diferencial — decisión del dueño, 31-ago-2026', () => {
    /**
     * ACTUALIZADO EN REG-546, y no es un retoque: cambia un aviso de seguridad.
     *
     * Este caso fijaba la conducta que se CONSERVÓ al mudar la lectura aquí
     * —el `diferencial` fuera— mientras el comentario del copiloto decía lo
     * contrario. El dueño decidió que cuenta, así que el comentario pasa a ser
     * cierto y este caso pasa a fijar la conducta nueva.
     *
     * Lo único que se excluye es lo que alguien DESCARTÓ.
     */
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([dx('Embarazo', 'presuntivo')]))).toBe(true)
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([dx('Embarazo', 'diferencial')]))).toBe(true)
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([dx('Embarazo', 'descartado')]))).toBe(false)
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([dx('Embarazo')]))).toBe(true)
  })

  it('sin diagnóstico gestacional NO se avisa: ausencia de dato no es dato', () => {
    /* El caso que impide que la decisión se pase de frenada. Ampliar a quién se
       avisa no puede convertir «nadie ha dicho nada» en «puede estar embarazada». */
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([]))).toBe(false)
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([dx('Hipertensión')]))).toBe(false)
  })

  it('un descartado viejo NO tapa un diferencial vivo', () => {
    /* «Embarazo descartado» en marzo y «embarazo» como diferencial hoy: hay una
       hipótesis viva, y ésa manda. */
    expect(tratarComoEmbarazada(loQueElExpedienteDiceDelEmbarazo([
      dx('Embarazo descartado', 'descartado'), dx('Embarazo', 'diferencial'),
    ]))).toBe(true)
  })

  it('la decisión queda registrada, con su fecha y su alcance REAL', () => {
    expect(LA_DECISION_DEL_DIFERENCIAL).toContain('DECIDIDO')
    expect(LA_DECISION_DEL_DIFERENCIAL).toContain('31-ago-2026')
    /**
     * El alcance importa y la pregunta lo sobreestimaba: decía «el aviso de
     * fármaco CONTRAINDICADO» y los siete `contraindicado` avisan SIEMPRE, en
     * cualquier paciente. Lo que esta decisión mueve son los cuatro `evitar`.
     */
    expect(LA_DECISION_DEL_DIFERENCIAL).toMatch(/evitar/)
    expect(LA_DECISION_DEL_DIFERENCIAL).toMatch(/no dependían de esto/)
  })
})

describe('las dos dimensiones nuevas', () => {
  it('reconoce una comorbilidad y la busca en los problemas del paciente', () => {
    const t = 'Se excluyeron pacientes con insuficiencia cardiaca'
    expect(dimensionDe(t)).toBe('comorbilidad')
    const con = evaluarCriterio(t, 'exclusion', { problemas: ['Insuficiencia cardiaca congestiva'] })
    expect(con.veredicto).toBe('cumple')
    const sin = evaluarCriterio(t, 'exclusion', { problemas: ['Hipertensión arterial'] })
    expect(sin.veredicto).toBe('no_cumple')
  })

  it('reconoce terapia previa y la busca en los medicamentos', () => {
    const t = 'Patients previously treated with rituximab were excluded'
    expect(dimensionDe(t)).toBe('terapia_previa')
    expect(evaluarCriterio(t, 'exclusion', { medicamentos: ['Rituximab 375 mg/m2'] }).veredicto).toBe('cumple')
    expect(evaluarCriterio(t, 'exclusion', { medicamentos: ['Metformina'] }).veredicto).toBe('no_cumple')
  })

  it('sin la lista, no adivina: dice que faltan datos', () => {
    expect(evaluarCriterio('Pacientes con diabetes', 'inclusion', {}).veredicto).toBe('datos_insuficientes')
    expect(evaluarCriterio('Prior therapy with statins', 'exclusion', {}).veredicto).toBe('datos_insuficientes')
  })

  it('la alergia gana sobre la comorbilidad cuando la frase casa con las dos', () => {
    /* «alergia conocida a penicilina» casa con COMORBILIDAD por el «conocida».
       El orden del reconocedor no es cosmético. */
    expect(dimensionDe('Alergia conocida a penicilina')).toBe('alergia')
  })

  it('no inventa una comorbilidad de una frase administrativa', () => {
    /* Sin la preposición no dispara: «reclutados en 12 centros» no es una
       enfermedad llamada «reclutados». Regla 5: señalar de menos. */
    expect(dimensionDe('Pacientes reclutados en 12 centros de tercer nivel')).not.toBe('comorbilidad')
    expect(dimensionDe('El estudio se realizó entre 2019 y 2022')).toBeNull()
  })
})

describe('sigue sin existir el veredicto «aplica»', () => {
  it('el máximo es `nada_lo_excluye`, también con las dimensiones nuevas', () => {
    const r = aplicabilidad(
      [{ texto: 'Pacientes con diabetes mellitus', clase: 'inclusion' }],
      { problemas: ['Diabetes mellitus tipo 2'] },
    )
    expect(r.veredicto).toBe('nada_lo_excluye')
    expect(['no_aplica', 'datos_insuficientes', 'nada_lo_excluze']).not.toContain('aplica')
  })

  it('y lo que no se supo leer se cuenta, no se esconde', () => {
    const r = aplicabilidad(
      [{ texto: 'Consentimiento informado firmado', clase: 'inclusion' }],
      { problemas: ['Diabetes'] },
    )
    expect(r.noLeidos).toBe(1)
  })
})

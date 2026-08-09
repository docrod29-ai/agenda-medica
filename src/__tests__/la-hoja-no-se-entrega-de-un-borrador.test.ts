/**
 * LA HOJA DEL PACIENTE NO SALE DE UN BORRADOR — V9 · `POSTVISIT-001` · REG-306.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `HojaParaElPaciente` —lo que el paciente se lleva a casa: sus medicamentos en
 * español llano, sus estudios— se montaba con el estado **VIVO** de la
 * consulta. La única guarda era `{!esNotaHospital}`.
 *
 * Justo encima, en la misma pantalla, `ComoCerrarLaConsulta` sí exigía
 * `{firmada && …}`. Dos bloques vecinos, dos criterios.
 *
 * Así que el médico podía, a mitad del dictado, pulsar «Copiar» o «Imprimir» y
 * entregarle al paciente una hoja compuesta de una nota **a medio escribir**:
 * con la dosis que todavía iba a corregir, con el fármaco que aún no había
 * decidido. Y salía con el membrete del consultorio.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Auditando el producto real en `PATIENT-UX-TRUTH-001` (8-ago-2026): la
 * cabecera del módulo AFIRMA que el contenido sale de lo «ya revisado y
 * firmado». Era intención de diseño, no precondición. Nadie la comprobaba —
 * quedó anotado como `POSTVISIT-GATE-001`.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La compuerta estaba escrita en un **comentario**. Familia
 * `escrito_y_sin_conectar` en su variante más silenciosa: el requisito existía,
 * documentado, y no había una sola línea de código que lo impusiera.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * **Lo que el paciente lee sale de material firmado.** `componerPaquete`
 * **lanza** ante una nota sin firmar en vez de devolver algo marcado: un valor
 * de retorno se ignora sin escribir nada; una excepción, no. La compuerta vive
 * en el motor, para que ninguna pantalla futura pueda saltársela por descuido,
 * y se repite en la ruta para poder dar un mensaje que el médico entienda.
 *
 * Y copiar e imprimir **son entrega**: van detrás de la firma igual que la
 * entrega al portal. La hoja se sigue VIENDO mientras se dicta, marcada como
 * borrador — cerrar la vista previa no protegía a nadie y quitaría la única
 * forma de saber qué se está construyendo.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No prueba la pantalla en un navegador.** Que el botón esté `disabled` se
 *   comprueba leyendo el componente, no pulsándolo: este repositorio no tiene
 *   entorno de render de React. Verlo con los ojos sigue en `NAV-NAVEGADOR-001`.
 * - **No valida el contenido clínico** de la nota firmada. Que la composición no
 *   invente cifras lo vigila el golden de `como-se-lo-explico`.
 * - **No cubre la entrega** —ruta, versiones, portal—: eso es
 *   `el-paquete-liberado-llega-al-paciente.test.ts` (REG-307).
 * - **No dice nada de los signos de alarma.** `warningSigns` va vacío a
 *   propósito: es indicación médica y hoy no hay campo donde el médico la
 *   escriba. Rellenarlo con lo «típico» de un diagnóstico sería inventar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  componerPaquete, cambiosDeMedicacion, liberar, visibleParaElPaciente,
  ESTADO_NOTA_QUE_SE_PUEDE_ENTREGAR,
  type EncuentroParaElPaquete,
} from '@/lib/paciente/paquete-de-visita'

const RAIZ = process.cwd()
const HOJA = readFileSync(join(RAIZ, 'src', 'components', 'HojaParaElPaciente.tsx'), 'utf8')
const CONSULTA = readFileSync(join(RAIZ, 'src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'), 'utf8')

/** Un encuentro sintético. Cero datos de paciente real (regla de privacidad). */
const encuentro = (over: Partial<EncuentroParaElPaquete> = {}): EncuentroParaElPaquete => ({
  notaId: 'nota_1',
  estadoNota: 'firmada',
  resumenEjecutivo: 'Faringitis aguda.',
  medicamentos: [
    { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
  ],
  estudios: ['Biometría hemática'],
  medicacionPrevia: null,
  contactoDelConsultorio: 'Si tienes dudas, llama a tu consultorio: 555',
  ...over,
})

describe('sin firma no hay paquete — la compuerta vive en el motor', () => {
  it('se niega a componer de una nota en borrador', () => {
    /** La que muerde. Sin la compuerta, esto devuelve un paquete tan campante. */
    expect(() => componerPaquete(encuentro({ estadoNota: 'borrador' }))).toThrow(/sin firmar/i)
  })

  it('se niega también cuando el estado falta o es cualquier otra cosa', () => {
    /**
     * Fallar CERRADO: un documento sin `estado` —una migración, un import— no
     * es «probablemente firmada». Y `'FIRMADA'` no es `'firmada'`: se compara
     * contra la constante, no contra una idea.
     */
    expect(() => componerPaquete(encuentro({ estadoNota: undefined }))).toThrow()
    expect(() => componerPaquete(encuentro({ estadoNota: 'FIRMADA' }))).toThrow()
    expect(() => componerPaquete(encuentro({ estadoNota: 'anulada' }))).toThrow()
  })

  it('con la nota firmada, compone', () => {
    const p = componerPaquete(encuentro())
    expect(p.notaId).toBe('nota_1')
    expect(ESTADO_NOTA_QUE_SE_PUEDE_ENTREGAR).toBe('firmada')
  })

  it('no compone sin saber de qué nota sale', () => {
    /** Un paquete sin `notaId` es un texto huérfano: no se puede auditar contra
     *  nada ni volver a la nota que lo sostiene. */
    expect(() => componerPaquete(encuentro({ notaId: '' }))).toThrow()
  })
})

describe('lo compuesto nace DRAFT aunque la nota esté firmada', () => {
  it('firmar no libera', () => {
    const p = componerPaquete(encuentro())
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
    expect(visibleParaElPaciente(p)).toBe(false)
  })

  it('sólo `liberar` lo hace visible, y exige quién aprueba', () => {
    const p = liberar(componerPaquete(encuentro()), 'dra@ejemplo.mx', 1_754_000_000_000)
    expect(visibleParaElPaciente(p)).toBe(true)
    expect(() => liberar(componerPaquete(encuentro()), '', 1)).toThrow()
  })
})

describe('la composición dice lo que la nota dice, y nada más', () => {
  it('la instrucción sale de `como-se-lo-explico`, en español llano', () => {
    const p = componerPaquete(encuentro())
    expect(p.medicationInstructions).toHaveLength(1)
    expect(p.medicationInstructions[0].instruccion)
      .toBe('Amoxicilina · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 7 días')
  })

  it('el resumen va literal: no se reescribe «para que se entienda mejor»', () => {
    expect(componerPaquete(encuentro()).encounterSummary).toBe('Faringitis aguda.')
  })

  it('sin resumen, va vacío — no se compone uno a partir del diagnóstico', () => {
    expect(componerPaquete(encuentro({ resumenEjecutivo: undefined })).encounterSummary).toBe('')
  })

  it('los signos de alarma y el material educativo van VACÍOS, declarados', () => {
    /**
     * Son indicación médica y evidencia curada. No hay de dónde sacarlos sin
     * inventar, así que se quedan vacíos: regla 1 de seguridad clínica.
     */
    const p = componerPaquete(encuentro())
    expect(p.warningSigns).toEqual([])
    expect(p.educationalMaterial).toEqual([])
  })

  it('un fármaco SUSPENDIDO hoy no lleva instrucción de cómo tomarlo', () => {
    /**
     * El caso que hace daño: «Losartán · 50 mg · cada 24 horas» impreso en la
     * hoja de un paciente al que su médico acaba de suspender el losartán. Sale
     * en «qué cambió», que es lo que de verdad pasó.
     */
    const p = componerPaquete(encuentro({
      medicamentos: [
        { nombre: 'Losartán', dosis: '50 mg', via: 'oral', frecuencia: 'cada 24 horas', duracion: '', estado: 'suspendida' },
      ],
      medicacionPrevia: ['Losartán'],
    }))
    expect(p.medicationInstructions).toEqual([])
    expect(p.medicationChanges).toEqual([{ nombre: 'Losartán', tipo: 'suspendido' }])
  })
})

describe('qué cambió — y qué NO se afirma que cambió', () => {
  it('sin lista previa devuelve `null`, no una lista de «nuevos»', () => {
    /**
     * «No aparecía antes» y «no sé qué había antes» son cosas distintas. Un
     * paciente de primera vez no tiene lista previa: decirle que todo es nuevo
     * sería afirmar algo que nadie comprobó (regla 4).
     */
    expect(cambiosDeMedicacion(null, [{ nombre: 'Amoxicilina' }])).toBeNull()
    expect(cambiosDeMedicacion(undefined, [{ nombre: 'Amoxicilina' }])).toBeNull()
    expect(componerPaquete(encuentro({ medicacionPrevia: null })).medicationChanges).toBeNull()
  })

  it('una lista previa VACÍA sí es una respuesta: no tomaba nada', () => {
    expect(cambiosDeMedicacion([], [{ nombre: 'Amoxicilina' }]))
      .toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })

  it('el silencio NO suspende: lo que ya tomaba y hoy no se menciona no sale', () => {
    /**
     * La regla que gobierna `medicamentosVigentes`, y aquí importa más: al
     * paciente se le estaría diciendo que deje de tomar algo que su médico no
     * suspendió. La metformina no aparece por ningún lado.
     */
    const cambios = cambiosDeMedicacion(['Metformina', 'Amoxicilina'], [{ nombre: 'Amoxicilina' }])
    expect(cambios).toEqual([{ nombre: 'Amoxicilina', tipo: 'sin-cambio' }])
    expect(JSON.stringify(cambios)).not.toContain('Metformina')
  })

  it('reconoce el mismo fármaco con acentos y mayúsculas distintas', () => {
    /** Con dos normalizadores distintos, «Losartán» y «losartan» serían dos
     *  fármacos y el paciente leería «nuevo» de lo que lleva un año tomando. */
    expect(cambiosDeMedicacion(['losartan'], [{ nombre: 'Losartán' }]))
      .toEqual([{ nombre: 'Losartán', tipo: 'sin-cambio' }])
  })

  it('un medicamento en borrador no entra en los cambios', () => {
    expect(cambiosDeMedicacion([], [{ nombre: 'A medio teclear', estado: 'borrador' }])).toEqual([])
  })
})

describe('la pantalla del médico no entrega un borrador', () => {
  it('copiar e imprimir van detrás de la firma', () => {
    /**
     * Probado al revés: si se quitara `disabled={!firmada}` de los dos botones,
     * estas dos aserciones caen. Son las dos únicas salidas de papel que tiene
     * esta hoja.
     */
    const botones = [...HOJA.matchAll(/<button[\s\S]*?<\/button>/g)]
      .map(m => m[0])
      .filter(b => /Copiado|Imprimir/.test(b))
    expect(botones).toHaveLength(2)
    for (const b of botones) expect(b).toContain('disabled={!firmada}')
    expect(HOJA).toContain('if (!firmada) return')          // copiar, además, se corta dentro
    expect(HOJA).toContain('onClick={() => { if (firmada) window.print() }}')
  })

  it('`firmada` es opcional y por omisión FALSO', () => {
    /**
     * Fallar cerrado importa más que en otras props: la pantalla que se olvide
     * de pasarla no debe entregar. `p.firmada === true` y no `!!p.firmada` para
     * que un `'no'` de una futura ruta que serialice mal no valga por «sí».
     */
    expect(HOJA).toContain('firmada?: boolean')
    expect(HOJA).toContain('const firmada = p.firmada === true')
  })

  it('la consulta le pasa el estado REAL de la nota', () => {
    /**
     * «El dato tiene que LLEGAR»: el componente puede tener la compuerta
     * perfecta y no servir de nada si su único llamador no le dice si la nota
     * está firmada.
     */
    const uso = /<HojaParaElPaciente[\s\S]*?\/>/.exec(CONSULTA)?.[0] ?? ''
    expect(uso).not.toBe('')
    expect(uso).toContain('firmada={firmada}')
    expect(uso).toContain('onEntregar={entregarAlPaciente}')
  })

  it('la hoja se sigue VIENDO mientras se dicta, marcada como borrador', () => {
    /**
     * Esconderla no protegía a nadie —copiar e imprimir ya están cerrados— y
     * quitaría lo único que le dice al médico qué se está construyendo. Lo que
     * cambia es que la hoja lo diga.
     */
    expect(HOJA).toContain('Vista previa de la nota en curso')
  })
})

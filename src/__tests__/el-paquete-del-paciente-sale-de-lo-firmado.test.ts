/**
 * EL PAQUETE DEL PACIENTE SALE DE LO FIRMADO — V9 `POSTVISIT-001`, REG-306/307.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * Dos cosas, y las dos venían de la misma frase sin cumplir.
 *
 * **REG-306** · `HojaParaElPaciente` se montaba en la consulta con la única
 * guarda `{!esNotaHospital}` y se alimentaba del estado VIVO de `medicamentos` y
 * `estudiosOrden`. La cabecera del módulo afirmaba que su contenido sale de lo
 * «ya revisado y firmado»: era intención de diseño, no precondición. El médico
 * podía copiar o imprimir —los dos botones existen— una hoja compuesta del
 * borrador en curso y dársela al paciente antes de firmar nada.
 *
 * **REG-307** · Y aunque la firmara, la hoja no llegaba: dos botones,
 * portapapeles e impresora, y ni una ruta hacia `/mi/[token]`.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * En la auditoría `PATIENT-UX-TRUTH-001` (8-ago-2026), leyendo la consulta línea
 * a línea: justo encima de la hoja, `ComoCerrarLaConsulta` SÍ exigía `firmada`.
 * Dos componentes vecinos que sacan cosas de la consulta hacia fuera, y sólo uno
 * con compuerta.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * La compuerta vivía en un comentario. Nada la comprobaba: ni una prueba, ni un
 * tipo, ni el propio módulo, que aceptaba de buena fe los medicamentos que le
 * pasaran. Un invariante que sólo está escrito en prosa no es un invariante.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * La compuerta viaja con el motor: `componerPaquete` comprueba la firma él
 * mismo, aunque la ruta ya la haya comprobado. El día que exista un segundo
 * llamador —un lote, una migración— no habrá que acordarse.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * - **Nada de esto se ha visto en un navegador.** No hay entorno con
 *   credenciales de Firebase en esta máquina, así que la liberación de verdad
 *   —pulsar el botón y que el paciente lo vea en su portal— sigue sin ejecutarse.
 * - No prueba las reglas de Firestore (`allow write: if false`): eso lo cubre el
 *   guardián de la matriz de acceso.
 * - No mide la latencia ni el comportamiento con cientos de notas firmadas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  componerPaquete, cambiosDeMedicacion, liberar, visibleParaElPaciente,
  tieneAlgoQueDecir, PaqueteNoComponible, IDIOMA_POR_DEFECTO,
  type NotaParaElPaquete,
} from '@/lib/paciente/paquete-de-visita'
import {
  siguienteVersion, idDelPaquete, vigentesPorNota, comoContactarAlConsultorio,
} from '@/lib/paciente/liberacion'

const NOTA_FIRMADA: NotaParaElPaquete = {
  id: 'nota-1',
  estado: 'firmada',
  resumenEjecutivo: 'Faringitis aguda. Se inicia amoxicilina.',
  medicamentos: [
    { nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' },
    { nombre: 'Paracetamol', dosis: '500 mg', via: 'v.o.', frecuencia: 'cada 6 horas' },
  ],
  estudiosOrden: ['Biometría hemática', 'Exudado faríngeo'],
}

describe('POSTVISIT-GATE-001 · la firma es precondición, no intención', () => {
  it('un BORRADOR no se convierte en paquete', () => {
    /* Al revés del arreglo: con la nota sin firmar tiene que fallar. Si esta
       prueba pasara sola, la compuerta no existe. */
    expect(() => componerPaquete({ ...NOTA_FIRMADA, estado: 'borrador' }))
      .toThrowError(PaqueteNoComponible)
  })

  it('y el motivo es un TIPO, no un texto que la ruta tenga que adivinar', () => {
    try {
      componerPaquete({ ...NOTA_FIRMADA, estado: 'borrador' })
      expect.unreachable('tenía que lanzar')
    } catch (e) {
      expect(e).toBeInstanceOf(PaqueteNoComponible)
      expect((e as PaqueteNoComponible).motivo).toBe('sin-firma')
    }
  })

  it('una nota CANCELADA tampoco', () => {
    expect(() => componerPaquete({ ...NOTA_FIRMADA, estado: 'cancelada' })).toThrowError(PaqueteNoComponible)
  })

  it('un paciente INTERNADO no se lleva instrucciones a casa', () => {
    /* Mismo motivo que la guarda `!esNotaHospital` de la pantalla: una hoja de
       «cómo tomarlo» sobre fármacos intravenosos de UCI confunde. */
    try {
      componerPaquete({ ...NOTA_FIRMADA, internamientoId: 'int-9' })
      expect.unreachable('tenía que lanzar')
    } catch (e) {
      expect((e as PaqueteNoComponible).motivo).toBe('paciente-internado')
    }
  })

  it('sin id de nota no hay paquete: el paquete REFERENCIA, no copia', () => {
    try {
      componerPaquete({ ...NOTA_FIRMADA, id: '' })
      expect.unreachable('tenía que lanzar')
    } catch (e) {
      expect((e as PaqueteNoComponible).motivo).toBe('sin-nota')
    }
  })

  it('con la nota firmada SÍ compone — el control de que lo anterior no pasa por vacío', () => {
    const p = componerPaquete(NOTA_FIRMADA)
    expect(p.notaId).toBe('nota-1')
    expect(p.medicationInstructions.length).toBe(2)
  })
})

describe('nace DRAFT aunque la nota esté firmada', () => {
  const p = componerPaquete(NOTA_FIRMADA)

  it('firmar va al expediente; liberar va al paciente. Son dos actos', () => {
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
    expect(p.version).toBe(1)
  })

  it('y un DRAFT no pasa la compuerta del portal', () => {
    expect(visibleParaElPaciente(p)).toBe(false)
  })

  it('sólo pasa después de liberar, con quién y cuándo', () => {
    const l = liberar(p, 'dra@consultorio.mx', 1_754_700_000_000)
    expect(visibleParaElPaciente(l)).toBe(true)
    expect(l.approvedBy).toBe('dra@consultorio.mx')
  })
})

describe('el contenido sale de la nota, y nada más', () => {
  it('la instrucción es la de `como-se-lo-explico`, en español llano', () => {
    const p = componerPaquete(NOTA_FIRMADA)
    expect(p.medicationInstructions[0].instruccion)
      .toBe('Amoxicilina · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 7 días')
  })

  it('no inventa signos de alarma ni material educativo', () => {
    /**
     * Es la regla 1 de seguridad clínica. La especificación pide los dos campos
     * y no hay de dónde sacarlos sin inventarlos: los signos de alarma son
     * indicación médica y el material educativo es evidencia curada.
     */
    const p = componerPaquete(NOTA_FIRMADA)
    expect(p.warningSigns).toEqual([])
    expect(p.educationalMaterial).toEqual([])
  })

  it('un medicamento sin nombre no produce una línea fantasma', () => {
    const p = componerPaquete({ ...NOTA_FIRMADA, medicamentos: [{ dosis: '500 mg' }, { nombre: 'Ibuprofeno' }] })
    expect(p.medicationInstructions.map(m => m.nombre)).toEqual(['Ibuprofeno'])
  })

  it('el seguimiento va LITERAL, tal como lo escribió el médico', () => {
    const p = componerPaquete(NOTA_FIRMADA, { proximoSeguimiento: '  En 10 días con resultados  ' })
    expect(p.followUp).toBe('En 10 días con resultados')
  })

  it('el idioma inicial es es-MX y se puede pedir otro sin bifurcar el producto', () => {
    expect(componerPaquete(NOTA_FIRMADA).language).toBe(IDIOMA_POR_DEFECTO)
    expect(componerPaquete(NOTA_FIRMADA, { idioma: 'en-US' }).language).toBe('en-US')
  })
})

describe('qué cambió — y cuándo NO se puede afirmar que nada cambió', () => {
  const previa = [
    { nombre: 'Metformina', dosis: '850 mg', frecuencia: 'cada 12 horas' },
    { nombre: 'Losartán', dosis: '50 mg', frecuencia: 'cada 24 horas' },
  ]

  it('SIN lista previa devuelve null, no «sin cambios»', () => {
    /**
     * La distinción que da sentido al campo: «no aparecía antes» y «no sé qué
     * había antes» son cosas distintas, y confundirlas es tratar la ausencia de
     * dato como dato de ausencia.
     */
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], undefined)).toBeNull()
    expect(cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], null)).toBeNull()
    expect(componerPaquete(NOTA_FIRMADA).medicationChanges).toBeNull()
  })

  it('una lista previa VACÍA sí afirma algo: la visita anterior no dejó medicación', () => {
    const c = cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], [])
    expect(c).toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })

  it('detecta alta, baja y continuación', () => {
    const c = cambiosDeMedicacion(
      [{ nombre: 'Metformina', dosis: '850 mg', frecuencia: 'cada 12 horas' }, { nombre: 'Amoxicilina' }],
      previa,
    )
    expect(c).toEqual([
      { nombre: 'Amoxicilina', tipo: 'nuevo' },
      { nombre: 'Losartán', tipo: 'suspendido' },
      { nombre: 'Metformina', tipo: 'sin-cambio' },
    ])
  })

  it('UNA DOSIS QUE CAMBIA NO ES «sin cambio»', () => {
    /**
     * El caso que obligó al cuarto tipo. Comparando sólo por nombre, bajar la
     * metformina de 850 a 425 mg salía como «sigue igual» — y el paciente que
     * lee «sigue igual» deja de comprobar la caja.
     */
    const c = cambiosDeMedicacion([{ nombre: 'Metformina', dosis: '425 mg', frecuencia: 'cada 12 horas' }], previa)
    expect(c).toContainEqual({ nombre: 'Metformina', tipo: 'modificado' })
    expect(c).not.toContainEqual({ nombre: 'Metformina', tipo: 'sin-cambio' })
  })

  it('cambiar la frecuencia también cuenta', () => {
    const c = cambiosDeMedicacion([{ nombre: 'Losartán', dosis: '50 mg', frecuencia: 'cada 12 horas' }], previa)
    expect(c).toContainEqual({ nombre: 'Losartán', tipo: 'modificado' })
  })

  it('«metformina» y «Metformina» son el mismo fármaco', () => {
    const c = cambiosDeMedicacion([{ nombre: ' metformina ', dosis: '850 mg', frecuencia: 'cada 12 horas' }], previa)
    expect(c).toContainEqual({ nombre: 'metformina', tipo: 'sin-cambio' })
  })

  it('y los acentos no parten un fármaco en dos', () => {
    const c = cambiosDeMedicacion([{ nombre: 'Losartan', dosis: '50 mg', frecuencia: 'cada 24 horas' }], previa)
    expect(c).toContainEqual({ nombre: 'Losartan', tipo: 'sin-cambio' })
    expect(c).not.toContainEqual({ nombre: 'Losartán', tipo: 'suspendido' })
  })

  it('lo que el paciente tiene que hacer va PRIMERO', () => {
    const c = cambiosDeMedicacion(
      [{ nombre: 'Losartán', dosis: '50 mg', frecuencia: 'cada 24 horas' }, { nombre: 'Amoxicilina' }],
      previa,
    )!
    expect(c[0].tipo).toBe('nuevo')
    expect(c[c.length - 1].tipo).toBe('sin-cambio')
  })
})

describe('no se libera una hoja vacía', () => {
  it('una consulta sin medicación, sin estudios y sin seguimiento no tiene nada que decir', () => {
    const p = componerPaquete({ id: 'n', estado: 'firmada' })
    expect(tieneAlgoQueDecir(p)).toBe(false)
  })

  it('y una lista de «sin cambio» por sí sola tampoco es un mensaje', () => {
    const p = componerPaquete({ id: 'n', estado: 'firmada' }, { medicacionPrevia: [] })
    expect(p.medicationChanges).toEqual([])
    expect(tieneAlgoQueDecir(p)).toBe(false)
  })

  it('con un solo estudio ya hay algo que decir', () => {
    expect(tieneAlgoQueDecir(componerPaquete({ id: 'n', estado: 'firmada', estudiosOrden: ['BH'] }))).toBe(true)
  })
})

describe('versiones — lo que se entregó se entregó', () => {
  it('la primera versión es 1; no hay versión 0', () => {
    expect(siguienteVersion([])).toBe(1)
  })

  it('se cuenta por el MÁXIMO, no por cuántos hay', () => {
    /* Si se borrara una versión intermedia, contar documentos reutilizaría un
       número ya entregado y dos paquetes distintos se llamarían igual. */
    expect(siguienteVersion([{ version: 1 }, { version: 3 }])).toBe(4)
    expect(siguienteVersion([{ version: 'dos' }, { version: 2 }])).toBe(3)
  })

  it('el id lleva la versión dentro: dos pestañas no pueden escribir la misma', () => {
    expect(idDelPaquete('nota-1', 2)).toBe('nota-1__v2')
    expect(() => idDelPaquete('', 1)).toThrow()
    expect(() => idDelPaquete('nota-1', 0)).toThrow()
  })

  it('el paciente ve UNA versión por consulta, la vigente', () => {
    const vig = vigentesPorNota([
      { notaId: 'a', version: 1, approvedAt: 100 },
      { notaId: 'a', version: 2, approvedAt: 200 },
      { notaId: 'b', version: 1, approvedAt: 150 },
    ])
    expect(vig.map(p => `${p.notaId}v${p.version}`).sort()).toEqual(['av2', 'bv1'])
  })

  it('y las anteriores siguen existiendo: se filtran al servir, no se borran', () => {
    const todas = [{ notaId: 'a', version: 1 }, { notaId: 'a', version: 2 }]
    vigentesPorNota(todas)
    expect(todas.length).toBe(2)
  })
})

describe('cómo contactar al consultorio: dato administrativo, no indicación médica', () => {
  it('compone con lo que el médico capturó', () => {
    expect(comoContactarAlConsultorio({ nombreClinica: 'Clínica X', whatsappConsultorio: '5555', telefonoAdmin: '5556' }))
      .toBe('Clínica X · WhatsApp 5555 · Tel. 5556')
  })

  it('sin ninguna vía de contacto devuelve vacío: un teléfono inventado es peor que ninguno', () => {
    expect(comoContactarAlConsultorio({ nombreClinica: 'Clínica X' })).toBe('')
    expect(comoContactarAlConsultorio(null)).toBe('')
  })

  it('no dice cuándo llamar ni cuándo acudir a urgencias', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/paciente/liberacion.ts'), 'utf8')
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase()
    for (const frase of ['urgencias', 'si empeora', 'acuda', 'llame de inmediato']) {
      expect(codigo).not.toContain(frase)
    }
  })
})

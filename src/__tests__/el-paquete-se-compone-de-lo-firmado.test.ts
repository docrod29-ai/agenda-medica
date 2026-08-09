/**
 * EL PAQUETE SE COMPONE DE LO FIRMADO — V9 · POSTVISIT-001 · REG-306.
 *
 * ── QUÉ FALTABA ──────────────────────────────────────────────────────────────
 *
 * `PATIENT-COMPANION-001` (REG-304/305) escribió `componerPaquete` y
 * `cambiosDeMedicacion` y las retiró en el mismo turno: el guardián de conexión
 * (`scripts/calidad/motores-conectados.mjs`, REG-255) las cazaba al instante —
 * cuerpo real, cero llamadores. Quedó anotado en el header de
 * `paquete-de-visita.ts` y en `un-borrador-no-llega-al-paciente.test.ts` como
 * deuda explícita: «llegan con quien las llame».
 *
 * ── CÓMO SE DESCUBRIÓ QUE FALTABA MÁS QUE EL LLAMADOR ───────────────────────
 *
 * Al escribir la ruta que por fin las llama (`POST
 * /api/expediente/paquete-visita`) apareció la pregunta que la deuda no había
 * obligado a contestar todavía: «lo vigente» de un paciente no es lo mismo que
 * «lo que dice esta nota» — un crónico que hoy no se tocó sigue vigente
 * (`ordenes-medicamento.ts`, REG-183). Componer desde `nota.medicamentos` a
 * secas habría hecho desaparecer del paquete cualquier fármaco crónico que la
 * consulta de hoy no mencionara, que es exactamente el dato de ausencia que la
 * regla 4 de seguridad clínica prohíbe. Por eso `componerPaquete` recibe «lo
 * vigente», ya resuelto por quien llama, y no `nota.medicamentos` crudo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * 1. `componerPaquete` es PURO: no calcula qué es «vigente», no decide
 *    liberar, y nada que no esté en su entrada puede aparecer en su salida.
 * 2. Reutiliza `comoTomarlo` — la MISMA función que ya usaba
 *    `HojaParaElPaciente` — para que la instrucción que lee el paciente sea
 *    idéntica se componga desde donde se componga.
 * 3. `cambiosDeMedicacion` propaga `null` cuando `previas` es `null`: «no se
 *    pudo determinar» nunca se convierte en «no había nada antes» (probado al
 *    revés más abajo).
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────────
 *
 * - No prueba `/api/expediente/paquete-visita` con una petición real (necesita
 *   el emulador de Firestore) — sólo las funciones puras que esa ruta llama.
 *   La máquina de estados (`liberar`/`visibleParaElPaciente`) sigue en
 *   `un-borrador-no-llega-al-paciente.test.ts`.
 * - No prueba `medicamentosVigentes` en sí (regla del silencio que no
 *   suspende): eso lo cubre `ordenes-medicamento.ts` y sus propias pruebas.
 * - No prueba el botón `LiberarPaqueteAlPaciente` ni un navegador real.
 */
import { describe, it, expect } from 'vitest'
import { componerPaquete, cambiosDeMedicacion } from '@/lib/paciente/paquete-de-visita'

describe('cambiosDeMedicacion — la regla del null, probada al revés', () => {
  it('sin lista previa, NO se afirma nada: null, no lista vacía', () => {
    /**
     * Probado al revés: si esta función devolviera `[]` en vez de `null`
     * cuando no hay con qué comparar, el paquete diría «sin cambios», que es
     * justo el dato de ausencia que la regla 4 prohíbe.
     */
    const r = cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], null)
    expect(r).toBeNull()
  })

  it('primera consulta de verdad: cero previos SÍ se puede afirmar, y no es null', () => {
    /** `[]` es una respuesta —«no tomaba nada antes»—, no «no sé». Confundirla
     *  con `null` perdería la única vez que el paquete puede decir «nuevo» con
     *  seguridad total. */
    const r = cambiosDeMedicacion([{ nombre: 'Amoxicilina' }], [])
    expect(r).toEqual([{ nombre: 'Amoxicilina', tipo: 'nuevo' }])
  })

  it('nuevo, suspendido y sin-cambio, los tres a la vez', () => {
    const r = cambiosDeMedicacion(
      [{ nombre: 'Losartán' }, { nombre: 'Amoxicilina' }],
      [{ nombre: 'Losartán' }, { nombre: 'Metformina' }],
    )
    expect(r).toEqual(
      expect.arrayContaining([
        { nombre: 'Losartán', tipo: 'sin-cambio' },
        { nombre: 'Amoxicilina', tipo: 'nuevo' },
        { nombre: 'Metformina', tipo: 'suspendido' },
      ]),
    )
    expect(r).toHaveLength(3)
  })

  it('el mismo fármaco con distinto acento o mayúscula no cuenta como dos', () => {
    const r = cambiosDeMedicacion([{ nombre: 'metformina' }], [{ nombre: 'Metformína' }])
    expect(r).toEqual([{ nombre: 'metformina', tipo: 'sin-cambio' }])
  })

  it('nombres vacíos o no-string no ensucian el resultado', () => {
    const r = cambiosDeMedicacion([{ nombre: '' }, { nombre: 42 }, { nombre: 'Ibuprofeno' }], [])
    expect(r).toEqual([{ nombre: 'Ibuprofeno', tipo: 'nuevo' }])
  })
})

describe('componerPaquete — nada que no esté en la entrada aparece en la salida', () => {
  const ENTRADA_MINIMA = {
    notaId: 'nota_1',
    medicamentosVigentes: [],
    medicamentosVigentesAntes: null,
    version: 1,
  }

  it('nace DRAFT, sin aprobador ni fecha — nunca libera por su cuenta', () => {
    /**
     * Probado al revés: si `componerPaquete` alguna vez pusiera `estado:
     * 'RELEASED'` por comodidad («ya se está liberando de todos modos»), esta
     * prueba lo cazaría. Firmar y liberar son dos actos (regla 4).
     */
    const p = componerPaquete(ENTRADA_MINIMA)
    expect(p.estado).toBe('DRAFT')
    expect(p.approvedBy).toBeNull()
    expect(p.approvedAt).toBeNull()
    expect(p.version).toBe(1)
  })

  it('sin fuente, warningSigns y educationalMaterial se quedan vacíos — nunca con «lo habitual»', () => {
    const p = componerPaquete(ENTRADA_MINIMA)
    expect(p.warningSigns).toEqual([])
    expect(p.educationalMaterial).toEqual([])
    expect(p.documents).toEqual([])
    expect(p.unansweredQuestions).toEqual([])
  })

  it('sin estudios en la entrada, orders es vacío — no se inventa una solicitud', () => {
    const p = componerPaquete(ENTRADA_MINIMA)
    expect(p.orders).toEqual([])
  })

  it('reutiliza comoTomarlo: la instrucción es idéntica a la de HojaParaElPaciente', () => {
    const p = componerPaquete({
      ...ENTRADA_MINIMA,
      medicamentosVigentes: [{ nombre: 'Amoxicilina', dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 horas', duracion: '7 días' }],
    })
    expect(p.medicationInstructions).toEqual([
      { nombre: 'Amoxicilina', instruccion: 'Amoxicilina · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 7 días' },
    ])
  })

  it('un medicamento sin nombre no produce una línea vacía', () => {
    const p = componerPaquete({
      ...ENTRADA_MINIMA,
      medicamentosVigentes: [{ nombre: '', dosis: '500 mg' }],
    })
    expect(p.medicationInstructions).toEqual([])
  })

  it('medicationChanges hereda el null de cambiosDeMedicacion sin reinterpretarlo', () => {
    const p = componerPaquete({
      ...ENTRADA_MINIMA,
      medicamentosVigentes: [{ nombre: 'Amoxicilina' }],
      medicamentosVigentesAntes: null,
    })
    expect(p.medicationChanges).toBeNull()
  })

  it('medicationChanges calcula de verdad cuando SÍ hay lista previa', () => {
    const p = componerPaquete({
      ...ENTRADA_MINIMA,
      medicamentosVigentes: [{ nombre: 'Amoxicilina' }],
      medicamentosVigentesAntes: [{ nombre: 'Ibuprofeno' }],
    })
    expect(p.medicationChanges).toEqual([
      { nombre: 'Amoxicilina', tipo: 'nuevo' },
      { nombre: 'Ibuprofeno', tipo: 'suspendido' },
    ])
  })

  it('clinicianContactRules y language pasan tal cual, sin inventar un teléfono ni un idioma distinto', () => {
    const p = componerPaquete({ ...ENTRADA_MINIMA, reglasDeContactoClinico: 'Llame al consultorio: 555-0000' })
    expect(p.clinicianContactRules).toBe('Llame al consultorio: 555-0000')
    expect(p.language).toBe('es-MX')
  })

  it('sin teléfono del consultorio, clinicianContactRules va vacío — no se inventa uno', () => {
    const p = componerPaquete(ENTRADA_MINIMA)
    expect(p.clinicianContactRules).toBe('')
  })

  it('el resumen del encuentro es exactamente el que ya se firmó, no uno nuevo', () => {
    const p = componerPaquete({ ...ENTRADA_MINIMA, resumenEncuentro: 'Faringitis aguda, se inicia amoxicilina.' })
    expect(p.encounterSummary).toBe('Faringitis aguda, se inicia amoxicilina.')
  })
})

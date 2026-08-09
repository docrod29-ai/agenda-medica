/**
 * GOLDEN — «Niega alergia a penicilina» bloqueaba la firma.
 *
 * El cruce alergia↔fármaco hace `alergia.includes(farmaco)` sobre el texto
 * libre. Con el campo escrito así —que es como lo escribe medio mundo— salía
 * una alerta crítica al prescribir amoxicilina, y esa alerta deshabilita Firmar.
 * La única salida que le quedaba al médico era BORRAR el texto del expediente:
 * se pierde el dato y se pierde la compuerta.
 *
 * Y al revés: el campo entero se guardaba como UN alérgeno, así que
 * «Penicilina, Sulfas» era un único alérgeno llamado «Penicilina, Sulfas».
 */
import { describe, it, expect } from 'vitest'
import { parsearAlergiasTexto, negacionesEnTexto, esAlergiaNegada, alergiasDe, alergenosDe } from '@/lib/seguridad/alergias'
import { validarNOM004 } from '@/lib/expediente/nom004'
import type { NotaMedica } from '@/types/expediente'

describe('esAlergiaNegada', () => {
  it('reconoce cómo se escribe de verdad', () => {
    for (const t of ['Niega alergias', 'niega alergia a penicilina', 'Sin alergias conocidas',
                     'No refiere alergias', 'Negadas', 'Ninguna', 'No conocidas', 'Descartada alergia a AINE']) {
      expect(esAlergiaNegada(t)).toBe(true)
    }
  })

  it('NO se lleva por delante una alergia de verdad', () => {
    for (const t of ['Penicilina', 'Sulfas', 'Nimesulida', 'Sinvastatina', 'Nitrofurantoína']) {
      expect(esAlergiaNegada(t)).toBe(false)
    }
  })
})

describe('parsearAlergiasTexto', () => {
  it('una entrada POR alérgeno', () => {
    expect(parsearAlergiasTexto('Penicilina, Sulfas; Mariscos').map(a => a.alergeno))
      .toEqual(['Penicilina', 'Sulfas', 'Mariscos'])
  })

  it('descarta lo negado y conserva lo afirmado en la misma frase', () => {
    expect(parsearAlergiasTexto('Niega alergia a penicilina, alérgico a sulfas').map(a => a.alergeno))
      .toEqual(['alérgico a sulfas'])
  })

  it('un campo entero de negación no deja ninguna alergia', () => {
    expect(parsearAlergiasTexto('Sin alergias conocidas')).toEqual([])
    expect(alergiasDe({ alergias: 'Niega alergias' })).toEqual([])
  })

  it('lo negado se puede consultar, no se esconde', () => {
    expect(negacionesEnTexto('Niega alergia a penicilina, sulfas')).toEqual(['Niega alergia a penicilina'])
  })
})

const notaCon = (alergias: { alergeno: string; tipo?: string }[], meds: string[]) => ({
  tipo: 'seguimiento',
  fechaConsulta: '2030-01-01T10:00:00Z',
  metadata: { medicoId: 'med-1', cedulaProfesional: '1234567' },
  secciones: [{ key: 'subjetivo', label: 'Subjetivo', value: 'Caso ficticio.', obligatorio: true }],
  signosVitales: { fc: 80, ta: '120/80' },
  diagnosticos: [{ descripcion: 'Faringitis', tipo: 'definitivo', estado: 'activo' }],
  medicamentos: meds.map(nombre => ({ nombre, dosis: '500 mg', via: 'oral', frecuencia: 'cada 8 h', duracion: '7 días' })),
  alergias,
} as unknown as NotaMedica)

describe('la compuerta de alergia por nombre exacto', () => {
  it('DISPARA aunque el tipo no se haya capturado', () => {
    // Estaba muerta: exigía `tipo === 'medicamento'` y ninguna ruta escribe ese
    // campo, así que «Tramadol» + «Tramadol 100 mg» pasaba sin una sola señal.
    const r = validarNOM004(notaCon([{ alergeno: 'Tramadol' }], ['Tramadol 100 mg']))
    expect(r.errores.some(e => e.includes('Tramadol'))).toBe(true)
  })

  it('no inventa una alergia donde no la hay', () => {
    const r = validarNOM004(notaCon([{ alergeno: 'Tramadol' }], ['Metformina 850 mg']))
    expect(r.errores.some(e => e.includes('Metformina'))).toBe(false)
  })
})

describe('EL ANCLA ERA EL FALLO — REG-248', () => {
  /**
   * ── LO QUE SALÍA IMPRESO ─────────────────────────────────────────────────
   *
   * `NEGADOR` estaba anclado al principio, y con razón: «Alérgico a penicilina,
   * niega sulfas» tiene que conservar la penicilina. Pero el ancla significa que
   * **cualquier palabra delante lo rompe**:
   *
   *     «negadas»          → reconocida ✓
   *     «alergias negadas» → NO reconocida ✗   ← la frase natural en español
   *     «NKDA»             → NO reconocida ✗   ← el estándar hospitalario
   *     «se niegan» · «no» · «(-)» → NO reconocidas ✗
   *
   * Lo que no se reconoce como negación **se registra como alérgeno**. De aquí
   * leen la receta impresa, la nota, el recurso FHIR y el sesgo del reconocedor:
   * la receta con su cédula salía diciendo que el paciente es alérgico a
   * «alergias negadas».
   */
  it.each([
    'alergias negadas', 'Alergias: negadas', 'Alergia: ninguna',
    'antecedentes alérgicos negados',
    'NKDA', 'nkda', 'NKA',
    'se niegan', 'interrogadas y negadas', 'no conocidas',
    'no', 'ninguna', '(-)', '-', 'negativo',
  ])('«%s» es una negación', (t) => expect(esAlergiaNegada(t)).toBe(true))

  it.each([
    'penicilina', 'naproxeno', 'nogal', 'nueces', 'Alérgico a sulfas',
    'TMP/SMX', 'metamizol', 'alergia a penicilina',
  ])('«%s» NO es una negación', (t) => expect(esAlergiaNegada(t)).toBe(false))

  it('«naproxeno» y «nogal» son la razón de comparar el fragmento ENTERO', () => {
    /**
     * «no» está en la lista de negaciones completas. Si se comparara como
     * PREFIJO, «naproxeno» —un alérgeno real y frecuente— desaparecería del
     * expediente sin que nadie lo notara.
     */
    expect(alergenosDe({ alergias: 'naproxeno, nogal' })).toEqual(['naproxeno', 'nogal'])
  })

  it('el caso que el ancla protegía sigue protegido', () => {
    /**
     * Ensanchar el reconocedor de negaciones es donde se pierde una alergia
     * real. «Niega penicilina. Alérgico a sulfas» tiene que conservar sulfas.
     */
    /**
     * REG-276 — antes esperaba `['Alérgico a sulfas']`, CON el prefijo dentro
     * del nombre. Se cambia porque un alérgeno llamado «Alérgico a sulfas» no
     * casa con ningún fármaco del catálogo, así que el cruce
     * alergia↔medicamento podía no dispararse justo con el que importa. Es el
     * mismo daño que «SMX)», por otra puerta. Lo que la prueba defiende —que la
     * alergia de después de una negación SIGA APARECIENDO— no cambia.
     */
    expect(alergenosDe({ alergias: 'Niega penicilina. Alérgico a sulfas' }))
      .toEqual(['sulfas'])
  })

  it('«alergias negadas» y «NKDA» ya no dejan un alérgeno fantasma', () => {
    expect(alergenosDe({ alergias: 'Alergias negadas' })).toEqual([])
    expect(alergenosDe({ alergias: 'NKDA' })).toEqual([])
  })
})

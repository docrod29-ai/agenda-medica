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
import { parsearAlergiasTexto, negacionesEnTexto, esAlergiaNegada, alergiasDe } from '@/lib/seguridad/alergias'
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
    /**
     * «sulfas» ENTRA EN LA LISTA A PARTIR DE REG-209.
     *
     * Cuando esta prueba se escribió, «sulfas» no salía por aquí porque no se
     * descartaba: se registraba como una alergia que el campo estaba negando.
     * Hoy la negación alcanza a toda la enumeración, así que el fragmento SÍ se
     * descarta — y justo por eso tiene que poder enseñarse. La intención de esta
     * prueba («no se esconde») se cumple mejor ahora que antes.
     */
    expect(negacionesEnTexto('Niega alergia a penicilina, sulfas'))
      .toEqual(['Niega alergia a penicilina', 'sulfas'])
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

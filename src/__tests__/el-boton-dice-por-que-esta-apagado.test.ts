/**
 * UNA SOLA RESPUESTA A «¿POR QUÉ NO PUEDO FIRMAR?» — REG-189.
 *
 * ── EL DEFECTO ───────────────────────────────────────────────────────────────
 *
 * La razón estaba repartida en dos sitios que no se hablaban, y **cada uno
 * mentía a su manera**:
 *
 * | Situación | El botón | La barra |
 * |---|---|---|
 * | Dosis incompleta | **encendido** (fallaba al pulsarlo) | «1 bloquea» ✓ |
 * | Sección obligatoria vacía | apagado ✓ | **«nada te impide firmar»** |
 *
 * El médico veía la contradicción completa: un botón gris junto a un cartel que
 * decía que todo estaba bien, o un botón encendido que no hacía nada.
 *
 * ── LO QUE ESTO NO ES ────────────────────────────────────────────────────────
 *
 * **No cambia la política.** Ni una condición se añade ni se quita: lo que
 * impedía firmar ayer impide firmar hoy. Lo único que cambia es que se dice en
 * un sitio y **antes de pulsar**.
 *
 * Que la falta de dosis bloquee fue decisión del médico dueño (5-ago, con el
 * dato delante). Un botón que se apaga sin decir por qué es esa misma decisión,
 * peor contada.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  motivosParaNoFirmar, sePuedeFirmar, porQueNoSePuedeFirmar,
} from '@/lib/expediente/por-que-no-se-firma'
import { construirAvisos, NIVEL } from '@/lib/expediente/avisos-consulta'

const page = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8',
)

describe('las dos fuentes cuentan, no una', () => {
  it('NOM-004 solo ya impide firmar', () => {
    expect(sePuedeFirmar({ erroresNOM004: ['Falta: Exploración física'] })).toBe(false)
  })

  it('la dosis sola también', () => {
    expect(sePuedeFirmar({
      dosisIncompletas: [{ nombre: 'levotiroxina', mensaje: 'la receta no lleva cantidad' }],
    })).toBe(false)
  })

  it('las dos juntas suman, no se pisan', () => {
    const m = motivosParaNoFirmar({
      erroresNOM004: ['Falta: Exploración física', 'Falta cédula profesional'],
      dosisIncompletas: [{ nombre: 'levotiroxina', mensaje: 'sin cantidad' }],
    })
    expect(m).toHaveLength(3)
    expect(m.map(x => x.origen)).toEqual(['nom004', 'nom004', 'dosis'])
  })

  it('sin nada pendiente, se firma', () => {
    expect(sePuedeFirmar({})).toBe(true)
    expect(sePuedeFirmar({ erroresNOM004: [], dosisIncompletas: [] })).toBe(true)
  })

  it('los renglones vacíos no cuentan como motivo', () => {
    expect(sePuedeFirmar({ erroresNOM004: ['', '   '] })).toBe(true)
  })
})

describe('el motivo se puede leer sin pulsar', () => {
  it('con uno, lo dice entero', () => {
    expect(porQueNoSePuedeFirmar({ erroresNOM004: ['Falta: Exploración física'] }))
      .toBe('No se puede firmar todavía: Falta: Exploración física')
  })

  it('con varios, dice cuántos y enseña el primero', () => {
    const t = porQueNoSePuedeFirmar({
      erroresNOM004: ['Falta: Exploración física', 'Falta cédula profesional'],
    })
    expect(t).toContain('2 cosas por resolver')
    expect(t).toContain('Exploración física')
  })

  it('sin motivos, no dice nada', () => {
    expect(porQueNoSePuedeFirmar({})).toBe('')
  })

  it('el mensaje del motor se enseña LITERAL, no parafraseado', () => {
    // `revisarUnidadDosis` explica el riesgo concreto —«100 se leerá como 100
    // mg»— y resumirlo se lleva justo el porqué.
    const t = porQueNoSePuedeFirmar({
      dosisIncompletas: [{ nombre: 'levotiroxina', mensaje: 'la receta no lleva cantidad. Quien la surta no puede saber cuánto dispensar.' }],
    })
    expect(t).toContain('Quien la surta no puede saber cuánto dispensar')
  })
})

describe('la barra cuenta lo mismo que apaga el botón', () => {
  it('un requisito de NOM-004 sale como bloqueo en la barra', () => {
    const avisos = construirAvisos({ yaLoBloqueaNOM004: ['Falta: Exploración física'] })
    expect(avisos).toHaveLength(1)
    expect(avisos[0].nivel).toBe('bloquea')
  })

  it('y no se puede descartar con «Ya lo revisé»', () => {
    // Sería una promesa falsa: el aviso se iría y el botón seguiría apagado.
    const [a] = construirAvisos({ yaLoBloqueaNOM004: ['Falta: Exploración física'] })
    expect(a.descartable).toBe(false)
  })

  it('los dos orígenes que bloquean son los dos que apagan el botón', () => {
    expect(NIVEL.requisito_nom004).toBe('bloquea')
    expect(NIVEL.dosis_incompleta).toBe('bloquea')
  })
})

describe('está conectado de verdad, no sólo escrito', () => {
  it('el botón se apaga con la fuente única', () => {
    expect(page).toContain('disabled={bloqueosDeFirma.length > 0 || guardando}')
  })

  it('ya no se apaga sólo con NOM-004', () => {
    expect(page).not.toContain('disabled={!validacion.valida || guardando}')
  })

  it('el motivo viaja en el title del botón', () => {
    expect(page).toContain('title={motivoNoFirma')
  })

  it('y se enseña junto a los botones, que es donde está el dedo', () => {
    // El mensaje ya existía y era inalcanzable: el del toast sólo salía al
    // pulsar, y el de NOM-004 queda fuera de pantalla cuando el médico está
    // abajo.
    expect(page).toContain('{bloqueosDeFirma.length > 0 && !guardando && (')
    expect(page).toContain('{motivoNoFirma}')
  })

  it('la barra recibe los requisitos de NOM-004', () => {
    expect(page).toContain('yaLoBloqueaNOM004: validacion?.errores ?? []')
  })
})

describe('la política no cambió', () => {
  it('la compuerta de dosis de firmar() sigue en su sitio', () => {
    // Apagar el botón es defensa en profundidad, no sustitución: `firmar()`
    // puede llamarse por otro camino (un atajo, una prueba, código futuro).
    expect(page).toContain('No se puede firmar. ')
    expect(page).toContain("x.aviso?.codigo === 'dosis_sin_cifra'")
  })
})

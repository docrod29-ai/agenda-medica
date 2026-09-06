/**
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * MEDIDO en navegador el 1-sep-2026, con un paciente sembrado a propósito con
 * los tres ejes del modelo (`tipo`, `estado`, `tipoOrigen`): los cuatro
 * diagnósticos vigentes del expediente se pintaban en el **mismo nodo de
 * texto**, con el mismo color, peso y tamaño, bajo el rótulo «Diagnósticos
 * activos»:
 *
 *     Condición crónica sintética A · Condición activa sintética B ·
 *     Sospecha sintética C · Propuesta de la IA sintética D
 *
 * Uno definitivo puesto por el médico y otro que el modelo propuso y **nadie
 * avaló**, indistinguibles.
 *
 * ── CAUSA RAÍZ ──────────────────────────────────────────────────────────────
 *
 * `ResumenPaciente` empujaba `d.descripcion` PELADA a una lista de cadenas.
 * `tipo` y `tipoOrigen` viajaban en el documento firmado y se tiraban ahí.
 *
 * ── LO QUE NO SE HACE, Y POR QUÉ IMPORTA ────────────────────────────────────
 *
 * **NO se etiqueta `presuntivo`.** REG-365 lo decidió y sigue siendo correcto:
 * es el valor de fábrica del esquema —«nadie dijo nada»— y escribir
 * «(presuntivo)» junto a una crónica confirmada afirma una duda que el médico
 * nunca expresó, en casi todos los renglones. Una etiqueta que sale siempre
 * deja de leerse el día que sí significa algo.
 *
 * Esta prueba lo fija en los dos sentidos, para que un arreglo futuro de la
 * procedencia no se lleve por delante esa decisión.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Lo que se dice es la PROCEDENCIA, que es otro eje: `tipoOrigen === 'medico'`
 * es «lo eligió una persona» y el resto no. Es la misma frontera que
 * `la-certeza-que-sale-al-mundo` aplica al salir a FHIR —`confirmed` sólo con
 * `medico`— y la que la consulta ya avisa antes de firmar. `requisitos.ts`
 * declaraba el hueco: «FALTA la misma elección en las otras superficies que
 * muestran diagnósticos (expediente…)».
 *
 * Y se dice **una vez y no por fila**, con la regla que ya eligió la consulta:
 * un aviso por diagnóstico, en una lista de seis, es ruido que se aprende a
 * saltar. `por_defecto` cuenta igual que `extraccion`: en los dos casos nadie
 * lo decidió.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No añade al expediente el SELECTOR de tipo que tiene la consulta. Avalar un
 *   diagnóstico desde aquí sigue sin poder hacerse, y sigue declarado en
 *   `requisitos.ts`.
 * · No toca UCI ni hospitalización, que muestran diagnósticos con el mismo
 *   hueco.
 * · No mide la pantalla: que los cuatro dejen de ser indistinguibles se
 *   comprobó en navegador y vive en la bitácora del carril.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { nombreConCerteza } from '@/lib/expediente/problemas-activos'

const RESUMEN = readFileSync(
  join(__dirname, '..', 'components', 'expediente', 'ResumenPaciente.tsx'), 'utf8',
)

describe('el expediente dice quién puso cada diagnóstico', () => {
  it('«presuntivo» NO se etiqueta — REG-365 sigue en pie', () => {
    expect(nombreConCerteza({ descripcion: 'Diabetes tipo 2', tipo: 'presuntivo' }))
      .toBe('Diabetes tipo 2')
    expect(nombreConCerteza({ descripcion: 'Diabetes tipo 2', tipo: 'definitivo' }))
      .toBe('Diabetes tipo 2')
  })

  it('lo que SÍ se etiqueta sigue etiquetándose', () => {
    expect(nombreConCerteza({ descripcion: 'Tromboembolia', tipo: 'descartado' }))
      .toBe('Tromboembolia (descartado)')
    expect(nombreConCerteza({ descripcion: 'Tromboembolia', tipo: 'diferencial' }))
      .toBe('Tromboembolia (diferencial)')
  })

  it('la frontera del aval es `medico`, y sólo `medico`', () => {
    const eligioUnaPersona = (o?: string) => o === 'medico'
    expect(eligioUnaPersona('medico')).toBe(true)
    // Los dos casos donde nadie decidió cuentan igual.
    expect(eligioUnaPersona('extraccion')).toBe(false)
    expect(eligioUnaPersona('por_defecto')).toBe(false)
    // Y un documento viejo, sin el campo, tampoco está avalado.
    expect(eligioUnaPersona(undefined)).toBe(false)
  })

  /** LA CONEXIÓN: lo que fallaba era que el dato se tiraba en la pantalla. */
  it('el resumen conserva `tipoOrigen` en vez de tirar la descripción pelada', () => {
    expect(RESUMEN).toMatch(/loEligioUnaPersona: d\.tipoOrigen === 'medico'/)
    expect(RESUMEN).toMatch(/nombreConCerteza\(d\)/)
    // Y NO vuelve a empujar la descripción sola.
    const sinComentarios = RESUMEN.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
    expect(sinComentarios).not.toMatch(/out\.push\(d\.descripcion\.trim\(\)\)/)
  })

  it('el aviso se enseña UNA VEZ, no por fila', () => {
    const sinComentarios = RESUMEN.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
    // Un contador y un solo renglón condicionado a él: no un `.map` de avisos.
    expect(sinComentarios).toMatch(/const sinAvalar = dxActivos\.filter\(d => !d\.loEligioUnaPersona\)\.length/)
    expect((sinComentarios.match(/sinAvalar > 0/g) ?? []).length).toBe(1)
  })

  it('el aviso habla del REGISTRO, no acusa al médico ni afirma una duda clínica', () => {
    const sinComentarios = RESUMEN.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
    const i = sinComentarios.indexOf('sinAvalar > 0')
    const aviso = sinComentarios.slice(i, i + 400)
    expect(aviso).toMatch(/el dictado\s*\n?\s*o la plantilla, no una persona/)
    // Ni «dudoso», ni «no confirmado», ni «presuntivo»: eso sería afirmar sobre
    // la CLÍNICA, y lo que falta es una firma, no certeza.
    expect(aviso).not.toMatch(/dudos|presuntiv|no confirmad|sin confirmar/i)
  })
})

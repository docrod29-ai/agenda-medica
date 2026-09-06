/**
 * ASE-003 (Panel de Lujo 2026-09, auditor AS-expedientes; reproducción
 * REP-038) — el importador guardaba la fecha de
 * nacimiento tal cual venga («15/03/1980»): la edad no se deriva, y ese mismo
 * paciente capturado a mano («1980-03-15») es «otra persona» para el motor de
 * duplicados, para siempre.
 *
 * ── QUÉ FALLABA ────────────────────────────────────────────────────────────────
 * `src/app/(dashboard)/migracion/page.tsx:211` `fechaNacimiento:
 * fila.fechaNacimiento?.trim()` y `:215` `edad: edadEnAnios(…)`. `edadEnAnios`
 * (`pediatria.ts:391`) → `fechaLocalDesdeISO` (`fecha-local.ts:36`) sólo
 * entiende `^\d{4}-\d{2}-\d{2}$` y cae en `new Date('15/03/1980')` = Invalid →
 * `null`. Peor: «03/04/1975» lo lee JS como 4 de marzo (mm/dd) y la edad sale
 * con el mes del cumpleaños cambiado. `duplicados.ts:186,222` compara
 * `String(fechaNacimiento).slice(0,10)` como CADENA: «15/03/1980» ≠
 * «1980-03-15» → «dos personas». Ni `createPatient` (`firestore.ts:568`) ni
 * las reglas (`firestore.rules:194`) validan nada. `csv-pacientes.ts` no tiene
 * ningún normalizador de fecha.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-expedientes, hallazgo ASE-003 (`crudos/AS-expedientes.json`), CSV
 * sintético importado y verificado DEL OTRO LADO en el emulador (sin `edad`).
 * El equipo rojo (`crudos/R-AS-expedientes.json`) lo ejecutó con jiti (salida
 * literal: «15/03/1980 | Invalid Date | edadEnAnios = null») y reprodujo la
 * mitad más cara: `compararPacientes(…'15/03/1980', …'1980-03-15') = null`.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Familia REG-160: el dato se valida en un formato (ISO, el del formulario) y
 * se escribe en otro (el de Excel es-MX, dd/mm/aaaa) sin que nadie traduzca.
 * `csv-pacientes.test.ts` sólo usa fechas ISO.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * el-dato-tiene-que-llegar: «¿quién lo lee después, y encuentra lo que
 * espera?». clinical-safety §6: la ambigua dd/mm vs mm/dd se PREGUNTA, no se
 * adivina.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre la capa pura por la que HOY pasa el dato
 * (`csv-pacientes.ts` → `fecha-local.ts`/`pediatria.ts` → `duplicados.ts`). No
 * se impone dónde vive el normalizador: la prueba acepta que «15/03/1980» se
 * entienda (a) en una función exportada de `csv-pacientes` cuyo nombre
 * mencione «fecha», (b) en `construirFilas`, o (c) en `fechaLocalDesdeISO`.
 * Con la ISO obtenida por cualquiera de esas vías, la edad y el motor de
 * duplicados tienen que dar la respuesta correcta.
 *
 * ── LA REPARACIÓN ───────────────────────────────────────────────────────────
 * `csv-pacientes.ts` traduce la fecha ANTES de escribirla:
 * `fechaISODesdeTextoDeArchivo` entiende dd/mm/aaaa y aaaa-mm-dd, resuelve el
 * caso que se declara solo (un número > 12 sólo puede ser el día) y devuelve
 * `null` para lo que no se entiende —incluido el año de dos cifras—, en vez de
 * inventar un siglo. `construirFilas` la deja en ISO y anota un reparo VISIBLE
 * cuando no pudo: el campo se queda vacío, que es la verdad, y la pantalla lo
 * dice. La ambigua (03/04/1975) no se adivina: `fechaDeArchivoEsAmbigua` la
 * marca y /migracion PREGUNTA una vez por archivo (clinical-safety §6).
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * La pantalla `/migracion` (no se monta). La fecha AMBIGUA («03/04/1975») —
 * qué preguntar y a quién es decisión de producto. Fechas bien formadas pero
 * falsas (futuras). El aviso en la vista previa.
 */
import { describe, it, expect } from 'vitest'
import * as csv from '@/lib/csv-pacientes'
import { fechaLocalDesdeISO } from '@/lib/fecha-local'
import { edadEnAnios } from '@/lib/expediente/pediatria'
import { compararPacientes } from '@/lib/pacientes/duplicados'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Intenta las tres vías de normalización que aceptaría una reparación. Devuelve la ISO o null. */
function normalizar(cruda: string): { iso: string; via: string } | null {
  // (a) un normalizador exportado por csv-pacientes
  for (const [nombre, fn] of Object.entries(csv)) {
    if (typeof fn !== 'function' || !/fecha/i.test(nombre)) continue
    try {
      const r = (fn as (s: string) => unknown)(cruda)
      if (typeof r === 'string' && ISO.test(r)) return { iso: r, via: `csv-pacientes.${nombre}` }
    } catch { /* no era esa */ }
  }
  // (b) construirFilas la deja en ISO
  const filas = csv.construirFilas([['Nombre', 'Fecha de nacimiento'], ['Ernestina Quiroga Balbuena', cruda]], csv.mapearEncabezados(['Nombre', 'Fecha de nacimiento']))
  const f = filas[0]?.fechaNacimiento
  if (typeof f === 'string' && ISO.test(f)) return { iso: f, via: 'construirFilas' }
  // (c) fecha-local la entiende
  const d = fechaLocalDesdeISO(cruda)
  if (Number.isFinite(d.getTime())) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { iso, via: 'fechaLocalDesdeISO' }
  }
  return null
}

describe('«15/03/1980» se entiende como 1980-03-15 antes de escribirse', () => {
  it('control: la ISO ya funciona de punta a punta (edad y duplicados)', () => {
    expect(edadEnAnios('1990-11-02', '2026-09-06')).toBe(35)
    expect(compararPacientes(
      { nombre: 'Ernestina Quiroga Balbuena', fechaNacimiento: '1980-03-15' },
      { id: 'p1', nombre: 'Ernestina Quiroga Balbuena', fechaNacimiento: '1980-03-15' },
    )).not.toBeNull()
  })

  it('«15/03/1980» (Excel es-MX) se normaliza a 1980-03-15 por alguna de las tres vías', () => {
    const n = normalizar('15/03/1980')
    expect(n, 'ninguna capa pura entiende dd/mm/aaaa: la fila se escribe cruda').not.toBeNull()
    expect(n!.iso).toBe('1980-03-15')
  })

  it('con esa fecha la edad se deriva (46 al 2026-09-06)', () => {
    const n = normalizar('15/03/1980')
    expect(edadEnAnios(n?.iso ?? '15/03/1980', '2026-09-06')).toBe(46)
  })

  it('el importado («15/03/1980») y el capturado a mano («1980-03-15») son la MISMA persona', () => {
    const n = normalizar('15/03/1980')
    const r = compararPacientes(
      { nombre: 'Ernestina Quiroga Balbuena', fechaNacimiento: n?.iso ?? '15/03/1980' },
      { id: 'p1', nombre: 'Ernestina Quiroga Balbuena', fechaNacimiento: '1980-03-15' },
    )
    expect(r, 'el motor de duplicados los separa por la fecha: dos expedientes').not.toBeNull()
  })
})

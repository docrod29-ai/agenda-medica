/**
 * REP-039 · ASE-004 (AS-expedientes) — un Excel con «Nombre», «Apellido
 * paterno» y «Apellido materno» en columnas separadas —el formato de casi
 * cualquier sistema mexicano— importa a todos los pacientes con SOLO el nombre
 * de pila, sin avisar.
 *
 * ── QUÉ FALLA ────────────────────────────────────────────────────────────────
 * `src/lib/csv-pacientes.ts:80-91` `SINONIMOS` no tiene ninguna entrada para
 * «apellido», «apellidos», «apellido paterno» ni «apellido materno»;
 * `mapearEncabezados` (:93-95) devuelve `null` para esas columnas y
 * `construirFilas` (:116) las ignora. Encabezado `Nombre,Apellido
 * paterno,Apellido materno,…` + fila `Ernestina,Quiroga,Balbuena` → `{ nombre:
 * 'Ernestina' }`. La vista previa (`migracion/page.tsx:356-389`) sólo pinta
 * nombre y teléfono y no lista las columnas descartadas.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-expedientes, hallazgo ASE-004 (`crudos/AS-expedientes.json`), CSV
 * sintético en /migracion verificado en el emulador (`nombre:'Ernestina'`). El
 * equipo rojo (`crudos/R-AS-expedientes.json`) lo ejecutó con jiti: `MAPEO:
 * ["nombre",null,null,"telefono",…]` → los apellidos se pierden en el mapeo,
 * no en la escritura.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * El auto-mapeo se escribió contra el CSV que EXPORTA esta misma app (una sola
 * columna «Nombre»), no contra el que exporta el sistema del que se viene. Y
 * no enseña su resultado ni exige confirmación, así que el hueco es silencioso.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * Familia REG-160 (el dato se lee en un formato y se escribe en otro).
 * clinical-safety §5: el vocabulario de sinónimos es vocabulario, no criterio
 * —que falte un término significa que ese caso NO se vigila—.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre `mapearEncabezados` + `construirFilas` reales, con la
 * fila sintética del equipo rojo. No se impone la forma (campo intermedio o
 * composición dentro de `construirFilas`): se afirma el NOMBRE COMPLETO que
 * sale.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * El orden «Apellidos, Nombre» dentro de UNA sola columna (lo tolera el motor
 * de duplicados, no la búsqueda por prefijo: ASE-001/REP-037). La tabla
 * «columna del archivo → campo» en la vista previa y el bloqueo de «Importar»
 * con columnas descartadas.
 */
import { describe, it, expect } from 'vitest'
import { mapearEncabezados, construirFilas } from '@/lib/csv-pacientes'

function importar(encabezados: string[], fila: string[]): string {
  const filas = construirFilas([encabezados, fila], mapearEncabezados(encabezados))
  return (filas[0]?.nombre ?? '').replace(/\s+/g, ' ').trim()
}

describe('REP-039 · los apellidos en columnas separadas llegan al nombre completo', () => {
  it('control: con una sola columna «Nombre completo» el nombre entra entero', () => {
    expect(importar(['Nombre completo', 'Teléfono'], ['Ernestina Quiroga Balbuena', '5550101010'])).toBe('Ernestina Quiroga Balbuena')
  })

  it('HOY FALLA: «Nombre / Apellido paterno / Apellido materno» → «Ernestina Quiroga Balbuena»', () => {
    expect(importar(
      ['Nombre', 'Apellido paterno', 'Apellido materno', 'Teléfono'],
      ['Ernestina', 'Quiroga', 'Balbuena', '5550101010'],
    )).toBe('Ernestina Quiroga Balbuena')
  })

  it('HOY FALLA: «Nombre / Apellidos» → «Ernestina Quiroga Balbuena»', () => {
    expect(importar(['Nombre', 'Apellidos', 'Teléfono'], ['Ernestina', 'Quiroga Balbuena', '5550101010'])).toBe('Ernestina Quiroga Balbuena')
  })

  it('HOY FALLA: la columna de apellidos no se descarta en el mapeo (deja de ser null)', () => {
    const mapeo = mapearEncabezados(['Nombre', 'Apellido paterno', 'Apellido materno'])
    expect(mapeo[1], 'Apellido paterno → null: la columna se tira').not.toBeNull()
    expect(mapeo[2], 'Apellido materno → null: la columna se tira').not.toBeNull()
  })
})

/**
 * A-013 · ASE-005 · ASE-007 · ASE-025 (Panel de Lujo 2026-09) — la importación
 * escribía en el expediente lo que viniera en el archivo, sin mirarlo.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * · **A-013** — `validarCURP` existía, estaba probado y no lo llamaba NADIE en
 *   todo el producto (`modulos-sin-conectar.test.ts` lo tenía declarado
 *   huérfano «porque el campo salió del formulario corto»). Pero el campo no se
 *   había ido: `migracion/page.tsx:217` seguía escribiendo
 *   `curp: fila.curp?.trim()` de cada paciente importado.
 * · **ASE-005** — con eso, «INVALIDO123» se guardaba como CURP del paciente; y
 *   el sexo escrito «F» o «Mujer» —el formato de casi cualquier sistema— se
 *   tiraba sin decir nada, porque sólo se aceptaban las tres cadenas exactas del
 *   formulario. El formulario corto ya no tiene campo CURP, así que después no
 *   había dónde corregirlo.
 * · **ASE-007** — la vista previa decía «N duplicados (se omiten)» y no decía
 *   con QUIÉN chocaba cada fila ni con cuánta certeza: el hijo homónimo del
 *   padre, sin fecha de nacimiento en el archivo, se perdía sin que nadie
 *   pudiera verlo.
 * · **ASE-025** — `fechaNacimientoDesdeCURP` elegía el siglo comparando las dos
 *   cifras del año contra el año actual: un nacido en 1926 salía nacido en 2026.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Panel de Lujo de septiembre de 2026: A-013 del panel de ingeniería y
 * ASE-005/007/025 del auditor AS-expedientes, los cuatro confirmados por el
 * equipo rojo ejecutando el módulo real (`crudos/R-AS-expedientes.json`, salida
 * literal «sexo escrito = undefined | curp escrito = INVALIDO123»).
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * Familia REG-160: el dato se valida en un formato —el del formulario— y se
 * escribe en otro —el del archivo— sin que nadie traduzca. Y el validador
 * estaba escrito y sin conectar, que es la otra mitad de la misma familia.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §3: nada se corrige en silencio — un dato del archivo que no
 * se puede usar NO se guarda, y se dice cuál y por qué. §6: se pregunta, no se
 * adivina — la «M» que puede ser Masculino o Mujer no se elige a cara o cruz.
 * §5: el vocabulario de sinónimos es vocabulario, no criterio.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * COMPORTAMIENTO sobre los módulos puros reales (`csv-pacientes`, `curp`), con
 * filas sintéticas. Se prueba AL REVÉS: los controles fijan que el CURP bueno
 * SÍ entra, que el sexo reconocible SÍ entra, y que una fila sin coincidencias
 * NO trae `coincide` — un guardián que sólo sabe decir que no, no es un
 * guardián.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No monta `/migracion` (la pantalla es quien pinta los reparos y ofrece
 * «Importar de todas formas»). No valida el CURP contra RENAPO: sólo su forma.
 * No cubre el dígito verificador del CURP, que el `CURP_REGEX` tampoco calcula.
 */
import { describe, it, expect } from 'vitest'
import {
  construirFilas, mapearEncabezados, clasificarFilas,
  normalizarSexoImportado, deducirQueSignificaLaM,
  fechaISODesdeTextoDeArchivo, fechaDeArchivoEsAmbigua,
} from '@/lib/csv-pacientes'
import { fechaNacimientoDesdeCURP, validarCURP } from '@/lib/curp'
import type { Patient } from '@/types'

/** CURP sintético, con la forma oficial. Ningún paciente real. */
const CURP_BUENO = 'QUBE800315MDFRLR07'

function fila(encabezados: string[], valores: string[]) {
  return construirFilas([encabezados, valores], mapearEncabezados(encabezados))[0]
}

const px = (o: Partial<Patient>): Patient => ({
  id: o.id ?? 'x', nombre: o.nombre ?? 'N', telefono: o.telefono ?? '',
  noShowCount: 0, cancelacionCount: 0, createdAt: '', updatedAt: '', creadoPor: '', ...o,
})

describe('A-013/ASE-005 · el CURP se mira antes de escribirlo', () => {
  it('control: el validador reconoce la forma oficial', () => {
    expect(validarCURP(CURP_BUENO)).toBe(true)
    expect(validarCURP('INVALIDO123')).toBe(false)
  })

  it('un CURP que no tiene forma de CURP no se guarda, y se dice', () => {
    const f = fila(['Nombre', 'CURP'], ['Ernestina Quiroga Balbuena', 'INVALIDO123'])
    expect(f.curp).toBeUndefined()
    const reparo = f.reparos?.find(r => r.campo === 'curp')
    expect(reparo, 'se descartó en silencio: el médico no puede enterarse').toBeTruthy()
    expect(reparo!.valor).toBe('INVALIDO123')
    expect(reparo!.gravedad).toBe('descartado')
  })

  it('control (al revés): un CURP con forma válida SÍ entra, y en mayúsculas', () => {
    const f = fila(['Nombre', 'CURP'], ['Ernestina Quiroga Balbuena', CURP_BUENO.toLowerCase()])
    expect(f.curp).toBe(CURP_BUENO)
    expect(f.reparos?.some(r => r.campo === 'curp')).toBeFalsy()
  })
})

describe('ASE-005 · el sexo del archivo se traduce, y lo ambiguo se declara', () => {
  it('«F» y «Mujer» llegan como Femenino; «Hombre» como Masculino', () => {
    expect(fila(['Nombre', 'Sexo'], ['Fermina Olguín Sada', 'F']).sexo).toBe('Femenino')
    expect(fila(['Nombre', 'Sexo'], ['Fermina Olguín Sada', 'Mujer']).sexo).toBe('Femenino')
    expect(fila(['Nombre', 'Sexo'], ['Leocadio Zubiaurre', 'Hombre']).sexo).toBe('Masculino')
  })

  it('«M» sola NO se elige: puede ser Masculino o Mujer, y se dice', () => {
    const f = fila(['Nombre', 'Sexo'], ['Leocadio Zubiaurre', 'M'])
    expect(f.sexo).toBeUndefined()
    expect(f.reparos?.find(r => r.campo === 'sexo')?.motivo).toMatch(/Masculino o Mujer/)
    expect(normalizarSexoImportado('M')).toBeNull()
  })

  it('cuando el archivo se declara solo, la «M» se resuelve por lo que hay en la columna', () => {
    // La columna trae también una «H»: el archivo usa H/M, así que M es Mujer.
    expect(deducirQueSignificaLaM(['H', 'M', 'H'])).toBe('M-es-mujer')
    // La columna trae también una «F»: el archivo usa M/F, así que M es Masculino.
    expect(deducirQueSignificaLaM(['F', 'M'])).toBe('M-es-masculino')
    expect(deducirQueSignificaLaM(['M', 'M'])).toBeNull()

    const filas = construirFilas(
      [['Nombre', 'Sexo'], ['Leocadio Zubiaurre', 'M'], ['Fermina Olguín', 'H']],
      mapearEncabezados(['Nombre', 'Sexo']),
    )
    expect(filas[0].sexo).toBe('Femenino')
    expect(filas[1].sexo).toBe('Masculino')
  })

  it('sin fecha ni sexo en el archivo, el CURP válido los aporta — y lo dice', () => {
    const f = fila(['Nombre', 'CURP'], ['Ernestina Quiroga Balbuena', CURP_BUENO])
    expect(f.fechaNacimiento).toBe('1980-03-15')
    expect(f.sexo).toBe('Femenino')
    expect(f.reparos?.filter(r => r.gravedad === 'derivado')).toHaveLength(2)
  })
})

describe('ASE-025 · el siglo del CURP sale de la homoclave, no del reloj', () => {
  it('AA=26 con homoclave NUMÉRICA es 1926, no 2026', () => {
    // Homoclave en la posición 17: un dígito significa «nació antes del 2000».
    const centenario = 'QUBE260315MDFRLR07'
    expect(validarCURP(centenario)).toBe(true)
    expect(fechaNacimientoDesdeCURP(centenario)).toBe('1926-03-15')
  })

  it('control (al revés): la misma clave con homoclave de LETRA es 2026', () => {
    const bebe = 'QUBE260315MDFRLRA7'
    expect(validarCURP(bebe)).toBe(true)
    expect(fechaNacimientoDesdeCURP(bebe)).toBe('2026-03-15')
  })
})

describe('ASE-003 · la fecha del archivo, y lo que no se puede decidir', () => {
  it('el número mayor que 12 resuelve el orden sin preguntar', () => {
    expect(fechaISODesdeTextoDeArchivo('15/03/1980')).toBe('1980-03-15')
    expect(fechaISODesdeTextoDeArchivo('15/03/1980', 'mes-primero')).toBe('1980-03-15')
    expect(fechaDeArchivoEsAmbigua('15/03/1980')).toBe(false)
  })

  it('la que SÍ es ambigua se marca, y el orden elegido manda', () => {
    expect(fechaDeArchivoEsAmbigua('03/04/1975')).toBe(true)
    expect(fechaISODesdeTextoDeArchivo('03/04/1975', 'dia-primero')).toBe('1975-04-03')
    expect(fechaISODesdeTextoDeArchivo('03/04/1975', 'mes-primero')).toBe('1975-03-04')
  })

  it('lo que no se entiende no se inventa: día imposible y año de dos cifras', () => {
    expect(fechaISODesdeTextoDeArchivo('31/02/1980')).toBeNull()
    expect(fechaISODesdeTextoDeArchivo('15/03/80')).toBeNull()
    expect(fechaISODesdeTextoDeArchivo('el año pasado')).toBeNull()
    const f = fila(['Nombre', 'Fecha de nacimiento'], ['Ernestina Quiroga', '31/02/1980'])
    expect(f.fechaNacimiento).toBeUndefined()
    expect(f.reparos?.find(r => r.campo === 'fechaNacimiento')?.gravedad).toBe('descartado')
  })
})

describe('ASE-007 · la fila omitida dice contra QUIÉN chocó', () => {
  const padre = px({ id: 'papa', nombre: 'Leocadio Zubiaurre Iparraguirre', telefono: '5550101010', fechaNacimiento: '1975-04-03' })

  it('el duplicado trae el expediente existente y la certeza', () => {
    const filas = construirFilas(
      [['Nombre', 'Teléfono'], ['Leocadio Zubiaurre Iparraguirre', '5550101010']],
      mapearEncabezados(['Nombre', 'Teléfono']),
    )
    const [c] = clasificarFilas(filas, [padre])
    expect(c.estado).toBe('duplicado')
    expect(c.coincide?.id, 'se omite sin decir con quién chocó').toBe('papa')
    expect(c.coincide?.nombre).toBe('Leocadio Zubiaurre Iparraguirre')
    expect(c.coincide?.certeza).toBe('probable')
    expect(c.coincide?.motivo).toMatch(/tel[eé]fono/i)
  })

  it('control (al revés): una fila que no choca con nadie no trae coincidencia', () => {
    const filas = construirFilas(
      [['Nombre', 'Teléfono'], ['Fermina Olguín Sada', '5559990000']],
      mapearEncabezados(['Nombre', 'Teléfono']),
    )
    const [c] = clasificarFilas(filas, [padre])
    expect(c.estado).toBe('nuevo')
    expect(c.coincide).toBeUndefined()
  })
})

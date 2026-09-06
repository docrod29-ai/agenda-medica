/**
 * ASE-006 · ASE-007 · ASE-008 · ASE-019 · ASE-027 (Panel de Lujo 2026-09,
 * auditor AS-expedientes) — la pantalla de migración escribía 1 200 expedientes
 * y no enseñaba nada de lo que había decidido por el camino.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * · **ASE-006** — `catch { errores++ }`: las filas que fallaban se contaban y no
 *   se nombraban («⚠️ 2 con error (revisa el formato)»), y `setTexto('')` en la
 *   misma sentencia vaciaba el archivo, así que reintentar sólo las fallidas era
 *   imposible sin volver a subirlo todo.
 * · **ASE-007** — «N duplicados (se omiten)» no decía con QUIÉN coincidía cada
 *   fila ni permitía forzarla: el hijo homónimo del padre, sin fecha de
 *   nacimiento en el archivo, no entraba nunca.
 * · **ASE-008** — el texto prometía «CSV o Excel» y el lector hacía
 *   `readAsText`: un .xlsx real acababa en «No se encontró una columna de
 *   Nombre», que manda a revisar un encabezado que está perfecto.
 * · **ASE-019** — «el respaldo completo en Pacientes», y el respaldo se había
 *   mudado a Operaciones (documentado en `pacientes/page.tsx:130-134`).
 * · **ASE-027** — 1 200 altas una a una sin decir por dónde va.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 * Auditor AS-expedientes con la app levantada y un CSV sintético; el equipo rojo
 * confirmó las cinco líneas (`crudos/R-AS-expedientes.json`) y bajó ASE-008 a P3
 * al comprobar que el `accept=".csv"` ya atenúa el .xlsx en el selector.
 *
 * ── CAUSA RAÍZ ───────────────────────────────────────────────────────────────
 * La pantalla se escribió como un proceso por lotes (entra archivo, sale
 * recuento) en el sitio de mayor confianza del alta. Un recuento no es un
 * reporte: no se puede actuar sobre él.
 *
 * ── REGLA ────────────────────────────────────────────────────────────────────
 * clinical-safety §3: nada se corrige —ni se descarta— en silencio, y lo que se
 * decide automáticamente tiene que ser visible y reversible por el médico.
 *
 * ── TIPO DE PRUEBA ───────────────────────────────────────────────────────────
 * CONTRATO TEXTUAL sobre `migracion/page.tsx`, declarado: la pantalla es un
 * componente de cliente con ClinicContext, Auth y Firestore, y este repo no
 * monta React en vitest (`vitest.config.ts` corre en `environment: 'node'`, sin
 * jsdom ni testing-library). El comportamiento que SÍ es puro —el mapeo, la
 * fecha, el CURP, la coincidencia— vive en sus propios golden sobre
 * `csv-pacientes`, y esta prueba sólo fija que la pantalla los use y los pinte.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 * No monta la pantalla ni comprueba el pintado real. No prueba la lectura de un
 * .xlsx (no se implementó: se rechaza diciendo cómo convertirlo). No cubre la
 * reanudación de una importación interrumpida (ASE-027 queda a medias: hay
 * progreso, no hay servidor que reciba el archivo — declarado en
 * `no-reparado-EXPEDIENTES.md`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const raiz = path.resolve(__dirname, '../..')
const pagina = readFileSync(path.join(raiz, 'src/app/(dashboard)/migracion/page.tsx'), 'utf8')

describe('ASE-006 · la fila que falla se nombra y el archivo no se tira', () => {
  it('el catch guarda nombre, teléfono y motivo — no un contador', () => {
    expect(pagina, 'el catch sigue sin guardar la fila').toMatch(/fallidas\.push\(\s*\{[\s\S]{0,200}?nombre:[\s\S]{0,200}?motivo:/)
    expect(pagina).not.toMatch(/\}\s*catch\s*\{\s*errores\+\+\s*\}/)
  })

  it('las fallidas se pueden descargar para corregirlas y reintentar', () => {
    expect(pagina).toMatch(/Descargar las que fallaron/)
    expect(pagina).toMatch(/const descargarFallidas/)
  })

  it('el contenido pegado sólo se borra cuando NO falló ninguna', () => {
    expect(pagina).toMatch(/if \(!fallidas\.length\) \{ setTexto\(''\)/)
  })
})

describe('ASE-007 · la fila omitida dice con quién chocó y se puede forzar', () => {
  it('se pinta el expediente con el que coincide y su motivo', () => {
    expect(pagina).toMatch(/c\.coincide\.nombre/)
    expect(pagina).toMatch(/c\.coincide\.motivo/)
  })

  it('hay una salida para importarla de todas formas', () => {
    expect(pagina).toMatch(/Es otra persona — impórtala/)
    expect(pagina).toMatch(/setForzadas/)
  })

  it('lo forzado cuenta como nuevo al importar, no se queda en la pantalla', () => {
    expect(pagina).toMatch(/c\.estado === 'nuevo' \|\| forzadas\.has\(i\)/)
  })
})

describe('ASE-003/004 · lo que la pantalla enseña antes de escribir', () => {
  it('lista las columnas del archivo que no se van a guardar', () => {
    expect(pagina).toMatch(/columnasDescartadas/)
    expect(pagina).toMatch(/columnas del archivo que no vamos a guardar/)
  })

  it('PREGUNTA el orden de la fecha cuando el archivo es ambiguo', () => {
    expect(pagina).toMatch(/fechaDeArchivoEsAmbigua/)
    expect(pagina).toMatch(/¿Cómo vienen las fechas de este archivo\?/)
    expect(pagina).toMatch(/cambiarOrdenDeFecha/)
  })

  it('pinta los reparos de cada fila (lo que no se pudo guardar)', () => {
    expect(pagina).toMatch(/c\.fila\.reparos/)
  })

  it('la fecha ya no se escribe cruda: llega en ISO desde construirFilas', () => {
    expect(pagina).not.toMatch(/fechaNacimiento: fila\.fechaNacimiento\?\.trim\(\)/)
    expect(pagina).toMatch(/construirFilas\(csv, mapeo, \{ ordenDeFecha \}\)/)
  })
})

describe('ASE-008 · el .xlsx se rechaza diciendo cómo convertirlo', () => {
  it('el lector reconoce la extensión y explica el paso que resuelve', () => {
    expect(pagina).toMatch(/\\\.\(xlsx\|xls\|numbers\|ods\)/)
    expect(pagina).toMatch(/Guardar como → CSV UTF-8/)
  })

  it('el texto de la tarjeta ya no promete leer Excel', () => {
    expect(pagina).not.toMatch(/Sube un CSV o Excel/)
  })
})

describe('ASE-019 · el respaldo se nombra donde vive', () => {
  it('no manda a Pacientes, que es de donde se mudó', () => {
    expect(pagina).not.toMatch(/respaldo\s*\n?\s*completo en Pacientes/)
    expect(pagina).toMatch(/respaldo completo, en Operaciones/)
    expect(pagina).toMatch(/href="\/operaciones"/)
  })
})

describe('ASE-027 · una importación larga dice por dónde va', () => {
  it('hay progreso visible y aviso de no cerrar la pestaña', () => {
    expect(pagina).toMatch(/setProgreso/)
    expect(pagina).toMatch(/no cierres esta pestaña/)
  })
})

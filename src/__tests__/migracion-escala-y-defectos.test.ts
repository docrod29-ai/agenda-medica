/**
 * GOLDEN — 10 000 FILAS SINTÉTICAS, CON LOS MALES DE UN ARCHIVO REAL.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El importador anterior recorría el arreglo COMPLETO de pacientes existentes
 * por cada fila del archivo (`clasificarFilas` → `comparables.some(...)`), y
 * además metía cada fila aceptada en ese mismo arreglo. Con N filas y M
 * existentes eso es O((N+M)·N) comparaciones, y cada una hace distancia de
 * edición sobre varias palabras.
 *
 * Con 200 pacientes no se nota. Con 10 000 el navegador se queda colgado, y con
 * 50 000 no termina — que es exactamente el tamaño de consultorio que este
 * carril existe para atender.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo `clasificarFilas` con la pregunta «¿cuántas veces se ejecuta
 * `compararPacientes` con 50 000 filas?». La respuesta era del orden de mil
 * millones.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * No había índice. `duplicados.ts` YA tenía la solución para el barrido interno
 * —bloquear por señales baratas— pero el importador no la usaba: comparaba todo
 * contra todo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * `IndicePacientes` bloquea por teléfono, fecha, CURP y prefijos de apellido.
 * Sólo se comparan los que caen en el mismo bloque.
 *
 * ── QUÉ NO CUBRE — Y ESTO IMPORTA MÁS QUE LO QUE SÍ ──────────────────────────
 *
 * **Generar 10 000 fixtures NO es haber probado producción con 10 000
 * pacientes.** Lo que esta prueba demuestra es que el pipeline PURO procesa
 * 10 000 filas con memoria acotada y en tiempo razonable en un proceso de Node.
 *
 * Lo que NO demuestra, y nadie debe leer aquí:
 *
 *  · que Firestore aguante ese ritmo de escritura;
 *  · cuánto tarda de verdad una importación con la red por medio;
 *  · el comportamiento con arranque en frío de una función sin servidor;
 *  · nada en absoluto sobre 50 000 — ese tamaño se genera y se mide en el arnés
 *    (`scripts/migration/arnes.mjs`), fuera de la suite, y sigue sin ser una
 *    medición de producción.
 *
 * Los números observados van en `docs/migration/ESCALA.md` con su etiqueta:
 * `local observado`, nunca `probado en producción`.
 */
import { describe, it, expect } from 'vitest'
import { generarCsv, padronSintetico, DEFECTOS } from '@/lib/migration/sintetico'
import { ensayar } from '@/lib/migration/ensayo'
import { ADAPTADOR_CSV } from '@/lib/migration/adaptadores'
import { DESTINOS } from '@/lib/migration/contrato'
import { planificar, MAXIMO_FILAS_EN_MEMORIA, FILAS_POR_LOTE } from '@/lib/migration/lotes'
import { celdaSegura } from '@/lib/csv-seguro'

const HOY = '2026-08-23'
const O = { clinicId: 'c1', hoy: HOY }

describe('escala', () => {
  it('10 000 filas: se procesan enteras y las cuentas cuadran', async () => {
    const { csv, filasDeclaradas } = generarCsv({ filas: 10_000, proporcionDefectuosa: 0.1 })
    const t0 = Date.now()
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    const ms = Date.now() - t0

    expect(r.reconciliacion.cuentas.sourceRecords).toBe(filasDeclaradas)
    // LA COMPROBACIÓN QUE IMPORTA: ni una fila se perdió por el camino.
    const suma = DESTINOS.reduce((s, d) => s + r.reconciliacion.cuentas.porDestino[d], 0)
    expect(suma).toBe(filasDeclaradas)
    expect(r.reconciliacion.estado).toBe('COMPLETED')

    // Holgadísimo a propósito: esto vigila el regreso a lo cuadrático, no marca
    // un objetivo de rendimiento. Con el importador viejo esto no terminaba.
    expect(ms, `tardó ${ms} ms`).toBeLessThan(60_000)
  }, 90_000)

  it('10 000 filas contra un padrón de 5 000: el emparejamiento no se vuelve cuadrático', async () => {
    const { csv, filasDeclaradas } = generarCsv({ filas: 10_000, proporcionDefectuosa: 0.05 })
    // El padrón comparte semilla, así que un buen trozo del archivo YA existe:
    // sin solapamiento esto mediría el caso fácil.
    const padron = padronSintetico(5_000)
    const t0 = Date.now()
    const r = await ensayar(ADAPTADOR_CSV, csv, padron, O)
    const ms = Date.now() - t0

    expect(r.reconciliacion.cuentas.sourceRecords).toBe(filasDeclaradas)
    // Con un padrón solapado tienen que aparecer duplicados: si saliera cero,
    // el índice no estaría encontrando nada y la prueba no probaría nada.
    expect(r.reconciliacion.cuentas.porDestino.duplicate).toBeGreaterThan(0)
    expect(ms, `tardó ${ms} ms`).toBeLessThan(60_000)
  }, 90_000)

  it('el detalle devuelto está ACOTADO, pero las cuentas siguen siendo completas', async () => {
    /**
     * El arnés midió 882 MB de montón para 50 000 filas porque cada fila
     * arrastraba su procedencia por campo. Se recorta el DETALLE devuelto; lo
     * que no se recorta nunca es la contabilidad.
     */
    const { csv, filasDeclaradas } = generarCsv({ filas: 5_000, proporcionDefectuosa: 0.1 })
    const r = await ensayar(ADAPTADOR_CSV, csv, [], { ...O, detalleMaximo: 100 })

    expect(r.filas).toHaveLength(100)
    expect(r.filasOmitidas).toBe(filasDeclaradas - 100)
    // LO QUE IMPORTA: recortar el detalle NO recorta las cuentas.
    expect(r.reconciliacion.cuentas.sourceRecords).toBe(filasDeclaradas)
    const suma = DESTINOS.reduce((s, d) => s + r.reconciliacion.cuentas.porDestino[d], 0)
    expect(suma).toBe(filasDeclaradas)
    expect(r.reconciliacion.estado).toBe('COMPLETED')
  })

  it('AL REVÉS: con el tope por encima del archivo, se devuelven todas', async () => {
    const { csv, filasDeclaradas } = generarCsv({ filas: 50 })
    const r = await ensayar(ADAPTADOR_CSV, csv, [], { ...O, detalleMaximo: 1000 })
    expect(r.filas).toHaveLength(filasDeclaradas)
    expect(r.filasOmitidas).toBe(0)
  })

  it('UN BLOQUE SATURADO SE DECLARA: «no busqué en todos los sitios» no es «no hay duplicados»', async () => {
    /**
     * El índice deja de recorrer un bloque cuando pasa del tope, o el
     * emparejamiento vuelve a ser cuadrático. El precio es real: un duplicado
     * que viviera sólo ahí no se detecta. Callarlo sería convertir una búsqueda
     * incompleta en un resultado limpio.
     *
     * Se fuerza la saturación con muchísimas filas que comparten apellido.
     */
    const filas = Array.from({ length: 300 }, (_, i) => `Juan Hernandez Hernandez ${i},555${String(1000000 + i).slice(-7)}`)
    const r = await ensayar(ADAPTADOR_CSV, ['Nombre,Teléfono', ...filas].join('\n'), [], O)
    expect(r.senalesSaturadas.length).toBeGreaterThan(0)
    // Y las cuentas siguen cuadrando: saturar no pierde filas, sólo deja de mirar.
    const suma = DESTINOS.reduce((s, d) => s + r.reconciliacion.cuentas.porDestino[d], 0)
    expect(suma).toBe(r.reconciliacion.cuentas.sourceRecords)
  })

  it('AL REVÉS: un archivo normal no satura nada y no ensucia el informe', async () => {
    const { csv } = generarCsv({ filas: 100 })
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(r.senalesSaturadas).toEqual([])
  })

  it('el troceado de 50 000 filas es acotado y no requiere tenerlas todas en memoria', () => {
    // Se planifica sobre el CONTEO, no sobre los datos: se puede decir «esto son
    // 125 lotes» sin haber leído el archivo entero.
    const lotes = planificar(50_000, 'imp_1', FILAS_POR_LOTE)
    expect(lotes).toHaveLength(125)
    expect(lotes.reduce((s, l) => s + l.filas, 0)).toBe(50_000)
    for (const l of lotes) expect(l.filas).toBeLessThanOrEqual(MAXIMO_FILAS_EN_MEMORIA)
  })
})

/* ═══════════════ LOS MALES DE UN ARCHIVO REAL ═══════════════ */

describe('archivo con defectos', () => {
  it('cada clase de defecto acaba en un cubo, y ninguno tumba el archivo', async () => {
    const { csv, filasDeclaradas } = generarCsv({ filas: 600, proporcionDefectuosa: 0.5, malformado: true })
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)

    const suma = DESTINOS.reduce((s, d) => s + r.reconciliacion.cuentas.porDestino[d], 0)
    expect(suma).toBe(r.reconciliacion.cuentas.sourceRecords)
    expect(r.reconciliacion.cuentas.sourceRecords).toBe(filasDeclaradas)
    expect(r.reconciliacion.estado).toBe('COMPLETED')

    // Y las filas buenas SIGUEN ENTRANDO: una fila mala no aborta la migración.
    expect(r.reconciliacion.cuentas.porDestino.accepted).toBeGreaterThan(100)

    // Los defectos que el generador inyecta aparecen con su razón, no genéricos.
    const razones = r.reconciliacion.cuentas.porRazon
    expect(razones['MISSING_REQUIRED_IDENTITY']).toBeGreaterThan(0)
    expect(razones['AMBIGUOUS_DATE']).toBeGreaterThan(0)
    expect(razones['UNRECOGNIZED_ENUM']).toBeGreaterThan(0)
  })

  it('los acentos, la ñ y el Unicode sobreviven al viaje', async () => {
    const csv = 'Nombre,Notas\nÑuño Peña Ibáñez,"acentos áéíóú · símbolos ±≤≥ · 中文"'
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(r.filas[0].campos.nombre).toBe('Ñuño Peña Ibáñez')
    expect(r.filas[0].campos.notas).toContain('中文')
    expect(r.filas[0].veredicto.destino).toBe('accepted')
  })

  it('la inyección de fórmula ni ejecuta ni deja el apóstrofo pegado al nombre', async () => {
    // Se construye como lo escribiría NUESTRA exportación: con el apóstrofo puesto.
    const csv = ['Nombre,Notas', [celdaSegura('=HYPERLINK("http://x.invalid")'), celdaSegura('@SUM(A1:A9)')].join(',')].join('\n')
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    // El apóstrofo era nuestro y vuelve a salir; el texto queda como el original.
    expect(r.filas[0].campos.nombre).toBe('=HYPERLINK("http://x.invalid")')
    expect(r.filas[0].campos.notas).toBe('@SUM(A1:A9)')
  })

  it('un campo larguísimo se rechaza por su razón sin tumbar la fila entera', async () => {
    const csv = `Nombre,Notas\nAna Ruiz Soto,${'x'.repeat(30_000)}`
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    // La fila va a cuarentena —hay algo que no se pudo resolver— y se dice cuál.
    expect(r.filas[0].veredicto.destino).toBe('quarantined')
    expect(r.filas[0].veredicto.razones).toContain('FIELD_TOO_LONG')
    expect(r.filas[0].veredicto.detalle?.camposInciertos).toBe('notas')
  })

  it('los encabezados en inglés se mapean igual que los españoles', async () => {
    const { csv } = generarCsv({ filas: 20, ingles: true })
    const r = await ensayar(ADAPTADOR_CSV, csv, [], O)
    expect(r.mapeo.camposResueltos).toContain('nombre')
    expect(r.mapeo.camposResueltos).toContain('email')
    expect(r.bloqueos).toEqual([])
  })

  it('el generador es DETERMINISTA: misma semilla, mismo archivo byte por byte', () => {
    const a = generarCsv({ filas: 500, semilla: 42, proporcionDefectuosa: 0.2 })
    const b = generarCsv({ filas: 500, semilla: 42, proporcionDefectuosa: 0.2 })
    expect(a.csv).toBe(b.csv)
    expect(generarCsv({ filas: 500, semilla: 43, proporcionDefectuosa: 0.2 }).csv).not.toBe(a.csv)
  })

  it('el censo del generador declara qué defectos metió', () => {
    const { censo } = generarCsv({ filas: 1000, proporcionDefectuosa: 0.5 })
    const conDefecto = DEFECTOS.filter(d => d !== 'perfecta' && censo[d] > 0)
    // Si el generador dejara de inyectar variedad, las pruebas de arriba
    // seguirían en verde sin probar nada. Esto lo vigila.
    expect(conDefecto.length).toBeGreaterThanOrEqual(6)
  })

  it('NINGÚN dato del generador sale de un paciente real: teléfonos 555 y correos .invalid', () => {
    const { csv } = generarCsv({ filas: 200 })
    for (const m of csv.matchAll(/,(\d{7,})/g)) expect(m[1].startsWith('555')).toBe(true)
    expect(csv).not.toMatch(/@(?!ejemplo\.invalid)[a-z]+\.(com|mx|org)/)
  })
})

/**
 * GOLDEN — UN RESPALDO NO ES UN RESPALDO HASTA QUE SE HA RESTAURADO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * El respaldo del consultorio estaba bien construido —servidor, NDJSON,
 * paginado, con cabecera y pie, con árbol de subcolecciones— y aun así había
 * cinco huecos que nadie podía ver desde dentro:
 *
 *  1. **El pie no permitía conciliar.** Decía `documentos` y `completo`, y
 *     `completo` se calculaba de UNA cosa: que ninguna colección hubiera
 *     lanzado una excepción. Una rama que nadie declaró se exportaba de menos,
 *     no fallaba nada, y el archivo se certificaba completo. Es literalmente lo
 *     que pasó con `patients/{p}/notas/{n}/adendas`.
 *  2. **`merge: true` sobre una nota firmada.** El importador usa el SDK admin,
 *     que **ignora las reglas de Firestore**: la regla que hace inmutable una
 *     nota firmada (NOM-024) no se evalúa por ese camino ni una vez. La
 *     restauración era la única puerta de la aplicación por la que se podía
 *     reescribir un documento medicolegal.
 *  3. **Re-enraizar la ruta no reescribe el contenido.** Un documento podía
 *     quedar guardado en el consultorio B declarando `clinicId: 'A'`.
 *  4. **`ok: true` con el archivo cortado.** Se respondía `ok: true` más un
 *     aviso. `ok: true` es lo que lee quien está esperando de pie.
 *  5. **El respaldo de ayer pisaba el trabajo de esta mañana**, y el informe lo
 *     contaba como restaurado.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Leyendo `restaurar.ts`, que **documenta el riesgo del SDK admin en su propia
 * cabecera** y deriva la colección de la ruta precisamente por eso — y viendo
 * que la ruta que consume esa función escribía con `merge: true` sin comparar
 * nada. El módulo avisaba del peligro y la ruta lo cruzaba igual.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Una restauración se detiene ante lo que no le toca resolver. Un documento
 * firmado que difiere, una referencia a otro consultorio o un linaje roto no se
 * escriben «avisando»: se detienen. Y el resultado se dice con una palabra que
 * obliga a mirar, no con un porcentaje.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 *  · **Nada de Firestore.** Aquí no hay emulador ni SDK: se prueban los motores
 *    puros y el TEXTO de las rutas que los consumen. Que la ruta llame a la
 *    función correcta se comprueba por lectura del archivo, que es lo que se
 *    puede hacer sin levantar un proyecto.
 *  · **El tiempo real de restaurar.** Esto no mide RTO y no pretende medirlo;
 *    ver `src/lib/durability/rpo-rto.ts`.
 *  · **Los bytes de Cloud Storage.** No se descarga ni un objeto: se cruzan
 *    nombres y tamaños.
 *  · **Notas selladas con v2.** El fixture sella con la versión actual; la
 *    re-verificación de v2 la cubre `e0-12-sello-integridad`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  generarConsultorio, aRespaldoNdjson, objetosDelFixture, inyectar,
  AVERIAS, averiasSinDetector, VERSION_FIXTURE,
} from '@/lib/durability/fixtures'
import { correrEnsayo, ensayoImpecable, fotoDeLineas, esColeccionInmutable, DESTINO_VACIO } from '@/lib/durability/ensayo'
import { evaluarCompletitud, FORMATO_V1, FORMATO_V2, FUERA_DEL_ARCHIVO } from '@/lib/durability/manifiesto'
import { huellaDelConjunto, huellaDeEntrada, acumuladorDeConjunto } from '@/lib/durability/huellas'
import { decidirEscritura, loteDe, confirmarLote, esElMismoTrabajo, loteYaConfirmado } from '@/lib/durability/idempotencia'
import { planearTodo } from '@/lib/durability/rollback'
import { clasificar, permisoDeBorrado, retencionLegalPuedeCaducar, DIAS_MINIMOS_DE_CONSERVACION } from '@/lib/durability/archivado'
import { cruzarObjetos, rutaDelObjetoDeLaUrl, duennoDelObjeto } from '@/lib/durability/adjuntos'
import { esMedicion, tramosDeHoy, rtoPublicable, sumarTramosMedidos, descargoDeAlcance } from '@/lib/durability/rpo-rto'
import { dictaminar, CONTEOS_EN_CERO } from '@/lib/durability/veredicto'
import { INVENTARIO, rutasSinClasificar, clasesConRutaFantasma, declaracionesFantasma } from '@/lib/durability/inventario'
import { referenciasForasteras, evaluarAislamiento, reenraizarContenido } from '@/lib/durability/aislamiento'
import { EXCLUIDAS } from '@/lib/clinica/respaldo'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const rutaImportar = leer('src', 'app', 'api', 'clinic', 'importar', 'route.ts')
const rutaExportar = leer('src', 'app', 'api', 'clinic', 'exportar', 'route.ts')

const CLINICA = 'clinica-de-prueba-a'
const OTRA = 'clinica-de-prueba-b'
const CUANDO = '2026-01-05T09:00:00.000Z'
const PEQUEÑO = { clinicId: CLINICA, pacientes: 4, notasPorPaciente: 2, citasPorPaciente: 1, semilla: 7 }

async function respaldoLimpio() {
  const docs = await generarConsultorio(PEQUEÑO)
  return { docs, ndjson: await aRespaldoNdjson(docs, CLINICA, CUANDO) }
}

/** El destino, sembrado con los mismos documentos que el respaldo. */
function destinoCon(docs: { _ruta: string; _coleccion: string;[k: string]: unknown }[]) {
  const m = new Map<string, Record<string, unknown>>()
  for (const d of docs) {
    const { _ruta, _coleccion, ...datos } = d
    void _coleccion
    m.set(_ruta, datos)
  }
  return { documentos: m }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('1 · la ida y vuelta limpia', () => {
  it('un respaldo íntegro vuelve entero, y el veredicto lo dice', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    expect(r.dictamen.veredicto).toBe('COMPLETA')
    expect(r.conteos.escritos).toBe(docs.length)
    expect(r.reconciliacion?.limpia).toBe(true)
    expect(ensayoImpecable(r)).toBe(true)
  })

  it('el fixture es determinista: dos generaciones dan el mismo archivo', async () => {
    // Un ensayo que no se puede repetir no es evidencia.
    const a = await aRespaldoNdjson(await generarConsultorio(PEQUEÑO), CLINICA, CUANDO)
    const b = await aRespaldoNdjson(await generarConsultorio(PEQUEÑO), CLINICA, CUANDO)
    expect(a).toBe(b)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('2 · un archivo cortado NO es un respaldo', () => {
  it('sin pie, el veredicto no puede ser COMPLETA', async () => {
    const { ndjson } = await respaldoLimpio()
    const { ndjson: roto } = inyectar(ndjson, 'respaldo-truncado-sin-pie')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA })

    expect(r.simulacroBase.pie).toBe(false)
    expect(r.completitud.estado).not.toBe('completo')
    expect(r.dictamen.veredicto).not.toBe('COMPLETA')
    expect(r.dictamen.porQue.join(' ')).toMatch(/cortado/)
  })

  it('AL REVÉS: el mismo archivo con su pie sí llega a COMPLETA', async () => {
    // Probado al revés: si esta mitad no pasara, la de arriba no probaría nada.
    const { ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA })
    expect(r.completitud.estado).toBe('completo')
  })

  it('el formato viejo se LEE pero no se puede conciliar', () => {
    /**
     * `nexusmed-respaldo-1` no trae recuentos ni huella. Los archivos que los
     * médicos ya descargaron siguen sirviendo para rescatar datos; lo que no se
     * puede es llamarlos completos, porque falta con qué comprobarlo.
     */
    const v = evaluarCompletitud(
      { formato: FORMATO_V1, clinicId: CLINICA },
      { documentos: 3, completo: true, problemas: [] },
      { documentos: 3, conteos: { patients: 3 }, huella: 'x' },
    )
    expect(v.estado).toBe('incompleto')
    expect(v.formatoConciliable).toBe(false)
    expect(v.motivos.join(' ')).toMatch(/no CONCILIAR|no trae recuento/)
  })

  it('un archivo sin cabecera es INVÁLIDO, no incompleto', () => {
    const v = evaluarCompletitud(null, null, { documentos: 0, conteos: {}, huella: '' })
    expect(v.estado).toBe('invalido')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('3 · líneas que no se entienden', () => {
  it('una línea corrupta se rechaza y NO tumba las otras', async () => {
    const { ndjson } = await respaldoLimpio()
    const { ndjson: roto } = inyectar(ndjson, 'linea-json-corrupta')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA })

    expect(r.simulacroBase.rechazadas.length).toBeGreaterThan(0)
    expect(r.conteos.escritos).toBeGreaterThan(0)   // el resto sí se restaura
    expect(r.dictamen.veredicto).not.toBe('COMPLETA')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('4 y 5 · lo que falta y lo que sobra', () => {
  it('un documento que estaba y no volvió se detecta como FALTA', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const { ndjson: roto } = inyectar(ndjson, 'documento-ausente')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA, base })

    expect(r.reconciliacion?.porClase.FALTA).toBeGreaterThan(0)
    expect(r.reconciliacion?.limpia).toBe(false)
  })

  it('un duplicado con otra identidad se detecta como SOBRA', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const { ndjson: roto } = inyectar(ndjson, 'documento-duplicado')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA, base })

    expect(r.reconciliacion?.porClase.SOBRA).toBeGreaterThan(0)
  })

  it('los conteos por sí solos NO habrían visto el duplicado', async () => {
    /**
     * ── POR QUÉ ESTA PRUEBA EXISTE ────────────────────────────────────────
     *
     * Es la que justifica todo el módulo de conciliación. Con un documento de
     * menos y uno de más, el TOTAL cuadra: quien mire el número dirá que volvió
     * todo. Sólo comparando identidad por identidad se ve que faltan tres citas
     * y sobran tres notas.
     */
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const conMenos = inyectar(ndjson, 'documento-ausente').ndjson
    const conMenosYMas = inyectar(conMenos, 'documento-duplicado').ndjson
    const r = await correrEnsayo(conMenosYMas, { clinicIdDestino: CLINICA, base })

    expect(r.reconciliacion?.base).toBe(r.reconciliacion?.despues)   // el total CUADRA
    expect(r.reconciliacion?.limpia).toBe(false)                     // y aun así está roto
    expect(r.reconciliacion?.porClase.FALTA).toBeGreaterThan(0)
    expect(r.reconciliacion?.porClase.SOBRA).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('6 · aislamiento entre consultorios: fail closed', () => {
  it('un documento que declara pertenecer a otro consultorio NO se escribe', async () => {
    const { ndjson } = await respaldoLimpio()
    const { ndjson: roto } = inyectar(ndjson, 'referencia-interna-forastera')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA })

    expect(r.conteos.contaminacionEntreConsultorios).toBeGreaterThan(0)
    expect(r.dictamen.veredicto).toBe('REVISION_HUMANA')
    expect(r.dictamen.antesDeUsarlo.join(' ')).toMatch(/otro consultorio/)
  })

  it('un archivo con DOS consultorios mezclados se detecta por la procedencia', async () => {
    const a = await generarConsultorio(PEQUEÑO)
    const b = await generarConsultorio({ ...PEQUEÑO, clinicId: OTRA, pacientes: 2, semilla: 9 })
    const mezclado = await aRespaldoNdjson([...a, ...b], CLINICA, CUANDO)
    const r = await correrEnsayo(mezclado, { clinicIdDestino: CLINICA })

    expect(r.conteos.contaminacionEntreConsultorios).toBe(b.length)
    expect(r.dictamen.veredicto).toBe('REVISION_HUMANA')
  })

  it('re-enraizar la RUTA no reescribe el CONTENIDO, y por eso hace falta mirarlo', () => {
    const hallazgos = referenciasForasteras(
      `clinics/${CLINICA}/appointments/x`,
      { clinicId: OTRA, metadata: { clinicId: OTRA }, nota: `clinics/${OTRA}/patients/p/notas/n` },
      CLINICA,
    )
    expect(hallazgos.length).toBeGreaterThanOrEqual(3)
    expect(hallazgos.some(h => h.campo === 'metadata.clinicId')).toBe(true)
    expect(hallazgos.some(h => h.clase === 'ruta-forastera')).toBe(true)
  })

  it('en un documento INMUTABLE la contaminación no se puede arreglar reescribiendo', () => {
    /**
     * `clinicId` va DENTRO del sello v3. Dejar el campo contamina el destino;
     * reescribirlo altera un documento firmado. No hay tercera opción, así que
     * no se elige: se para.
     */
    const hs = referenciasForasteras('clinics/A/patients/p/notas/n', { clinicId: OTRA }, CLINICA)
    expect(evaluarAislamiento(hs, true).veredicto).toBe('revision-humana')
    expect(evaluarAislamiento(hs, false).veredicto).toBe('contaminado')
  })

  it('cuando SÍ se puede reescribir, se dice qué campos se tocaron', () => {
    const { datos, camposTocados } = reenraizarContenido(
      { clinicId: OTRA, metadata: { clinicId: OTRA, medicoId: 'm' } }, CLINICA,
    )
    expect(camposTocados).toEqual(['clinicId', 'metadata.clinicId'])
    expect((datos.metadata as Record<string, unknown>).clinicId).toBe(CLINICA)
    expect((datos.metadata as Record<string, unknown>).medicoId).toBe('m')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('7 · la verdad firmada no se altera restaurando', () => {
  it('una nota firmada alterada en el archivo NO se escribe', async () => {
    const { ndjson } = await respaldoLimpio()
    const { ndjson: roto } = inyectar(ndjson, 'nota-firmada-alterada')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA })

    const alterada = r.verdadFirmada.find(v => v.comparacion.veredicto === 'archivo-alterado')
    expect(alterada, 'no se detectó la nota firmada alterada').toBeDefined()
    expect(r.conteos.verdadFirmadaEnConflicto).toBeGreaterThan(0)
    expect(r.dictamen.veredicto).toBe('REVISION_HUMANA')
    // Y no se escribió: no aparece en la fotografía resultante.
    expect(r.fotoResultante.some(f => f.ruta === alterada!.ruta)).toBe(false)
  })

  it('AL REVÉS: la misma nota SIN alterar sí se escribe', async () => {
    const { ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA })
    expect(r.verdadFirmada).toEqual([])
    expect(r.dictamen.veredicto).toBe('COMPLETA')
  })

  it('si el destino ya tiene la nota firmada y difiere, se detiene', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const destino = destinoCon(docs)
    // El destino tiene una versión distinta de una nota firmada.
    const firmada = docs.find(d => d._coleccion === 'patients.notas' && d.estado === 'firmada')!
    const enDestino = destino.documentos.get(firmada._ruta)!
    destino.documentos.set(firmada._ruta, { ...enDestino, resumenEjecutivo: 'OTRA COSA' })

    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino })
    expect(r.verdadFirmada.some(v => v.comparacion.veredicto === 'revision-humana')).toBe(true)
    expect(r.dictamen.veredicto).toBe('REVISION_HUMANA')
  })

  it('la ruta de importación llama al candado, no sólo lo tiene escrito', () => {
    // «Escrito y sin conectar»: el módulo puede ser perfecto y no correr nunca.
    expect(rutaImportar).toContain('compararNotaFirmada(')
    expect(rutaImportar).toContain('conteos.verdadFirmadaEnConflicto++')
    expect(rutaImportar).toContain("detener(d.ruta, `verdad-firmada:${cmp.veredicto}`")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('8 · linaje de adendas y versiones', () => {
  it('una adenda sin su nota se detecta como P0', async () => {
    const { ndjson } = await respaldoLimpio()
    const { ndjson: roto } = inyectar(ndjson, 'adenda-sin-nota')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA })

    const h = r.referenciales.find(x => x.codigo === 'adenda-sin-nota')
    expect(h, 'no se detectó la adenda huérfana').toBeDefined()
    expect(h!.severidad).toBe('P0')
    expect(h!.porQue).toMatch(/único mecanismo de corrección/i)
    expect(r.dictamen.veredicto).toBe('REVISION_HUMANA')
  })

  it('AL REVÉS: con su nota, la misma adenda no produce hallazgo', async () => {
    const { ndjson } = await respaldoLimpio()
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA })
    expect(r.referenciales.filter(x => x.codigo === 'adenda-sin-nota')).toEqual([])
  })

  it('una nota que cuelga de un paciente y declara ser de otro es P0', async () => {
    const docs = await generarConsultorio(PEQUEÑO)
    const nota = docs.find(d => d._coleccion === 'patients.notas')!
    const cruzada = { ...nota, pacienteId: 'paciente-de-otro' }
    const ndjson = await aRespaldoNdjson(
      docs.map(d => (d._ruta === nota._ruta ? cruzada : d)), CLINICA, CUANDO,
    )
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA })
    const h = r.referenciales.find(x => x.codigo === 'nota-de-otro-paciente')
    expect(h, 'una nota archivada bajo otro expediente pasó desapercibida').toBeDefined()
    expect(h!.severidad).toBe('P0')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('9, 10 y 15 · reintentar no duplica, y reanudar no se salta lotes', () => {
  it('la MISMA restauración dos veces deja el mismo estado', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const primera = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })
    const segunda = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: destinoCon(docs), base })

    expect(primera.conteos.escritos).toBe(docs.length)
    expect(segunda.conteos.escritos).toBe(0)
    expect(segunda.conteos.yaEstaban).toBe(docs.length)
    expect(segunda.reconciliacion?.limpia).toBe(true)
  })

  it('un tiempo de espera agotado DESPUÉS de escribir no duplica al reintentar', async () => {
    const { docs, ndjson } = await respaldoLimpio()
    const base = await fotoDeLineas(docs)
    const mitad = Math.floor(docs.length / 2)
    const r = await correrEnsayo(ndjson, {
      clinicIdDestino: CLINICA, destino: destinoCon(docs.slice(0, mitad)), base,
    })
    expect(r.conteos.yaEstaban).toBe(mitad)
    expect(r.conteos.escritos).toBe(docs.length - mitad)
    expect(r.reconciliacion?.limpia).toBe(true)
  })

  it('el punto de control sólo avanza tras confirmar: un lote muerto NO consta', () => {
    /**
     * Avanzarlo antes convierte un fallo a mitad de lote en un hueco
     * permanente: el reintento se salta un lote que nunca se escribió y el
     * informe lo cuenta como hecho.
     */
    const t = {
      trabajoId: 't', origen: 'a', destino: 'b', huellaDelArchivo: 'h',
      esperados: 1000, ultimoLoteConfirmado: -1, escritosConfirmados: 0,
      iniciadoEn: CUANDO, actualizadoEn: CUANDO, estado: 'en-curso' as const,
    }
    const tras0 = confirmarLote(t, 0, 400, CUANDO)
    expect(loteYaConfirmado(tras0, 0)).toBe(true)
    expect(loteYaConfirmado(tras0, 1)).toBe(false)   // murió a mitad: no consta
    expect(tras0.escritosConfirmados).toBe(400)
  })

  it('un archivo DISTINTO no reanuda encima del trabajo anterior', () => {
    const t = {
      trabajoId: 'id', origen: 'a', destino: 'b', huellaDelArchivo: 'h1',
      esperados: 10, ultimoLoteConfirmado: 3, escritosConfirmados: 1200,
      iniciadoEn: CUANDO, actualizadoEn: CUANDO, estado: 'en-curso' as const,
    }
    expect(esElMismoTrabajo(t, { trabajoId: 'id', origen: 'a', destino: 'b', huellaDelArchivo: 'h1' })).toBe(true)
    expect(esElMismoTrabajo(t, { trabajoId: 'id', origen: 'a', destino: 'b', huellaDelArchivo: 'h2' })).toBe(false)
    expect(esElMismoTrabajo(t, { trabajoId: 'id', origen: 'a', destino: 'OTRO', huellaDelArchivo: 'h1' })).toBe(false)
  })

  it('los lotes son deterministas: el mismo archivo se parte igual siempre', () => {
    expect(loteDe(0)).toBe(0)
    expect(loteDe(399)).toBe(0)
    expect(loteDe(400)).toBe(1)
    expect(loteDe(5, 2)).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('11 · el respaldo de ayer no pisa el trabajo de esta mañana', () => {
  it('un documento más nuevo en el destino NO se sobrescribe', () => {
    const d = decidirEscritura({
      huellaDelArchivo: 'a', huellaDelDestino: 'b', esInmutable: false,
      fechaDelArchivo: '2026-01-01T00:00:00.000Z',
      fechaDelDestino: '2026-01-02T00:00:00.000Z',
    })
    expect(d.decision).toBe('no-pisar-lo-mas-nuevo')
    expect(d.porQue).toMatch(/borraría trabajo/)
  })

  it('si no se puede comparar la frescura, tampoco se pisa', () => {
    // La misma regla que el barrido de `ops/retencion.ts`: lo que no se puede
    // fechar, no se toca.
    expect(decidirEscritura({
      huellaDelArchivo: 'a', huellaDelDestino: 'b', esInmutable: false,
      fechaDelArchivo: null, fechaDelDestino: '2026-01-02T00:00:00.000Z',
    }).decision).toBe('no-pisar-lo-mas-nuevo')
  })

  it('AL REVÉS: con el respaldo más reciente, sí se escribe y se declara', () => {
    const d = decidirEscritura({
      huellaDelArchivo: 'a', huellaDelDestino: 'b', esInmutable: false,
      fechaDelArchivo: '2026-01-03T00:00:00.000Z',
      fechaDelDestino: '2026-01-02T00:00:00.000Z',
    })
    expect(d.decision).toBe('sobrescribir-declarando')
  })

  it('la reversión no borra lo que el médico tocó después', () => {
    const asientos = [
      { ruta: 'clinics/a/patients/p1', huellaPrevia: null, huellaEscrita: 'H', esInmutable: false },
      { ruta: 'clinics/a/patients/p2', huellaPrevia: 'V', huellaEscrita: 'H', esInmutable: false },
      { ruta: 'clinics/a/patients/p3/notas/n/adendas/a1', huellaPrevia: null, huellaEscrita: 'H', esInmutable: true },
    ]
    const plan = planearTodo(asientos, [
      { ruta: 'clinics/a/patients/p1', huellaActual: 'EDITADO-DESPUES' },
      { ruta: 'clinics/a/patients/p2', huellaActual: 'H' },
      { ruta: 'clinics/a/patients/p3/notas/n/adendas/a1', huellaActual: 'H' },
    ])
    expect(plan.reversiones[0].accion).toBe('revision-humana')   // lo tocó el médico
    expect(plan.reversiones[1].accion).toBe('restaurar-previo')
    expect(plan.reversiones[2].accion).toBe('revision-humana')   // inmutable
    expect(plan.aplicableSinPersona).toBe(false)
  })

  it('lo que la restauración creó y nadie tocó sí se puede borrar al revertir', () => {
    const plan = planearTodo(
      [{ ruta: 'clinics/a/appointments/c1', huellaPrevia: null, huellaEscrita: 'H', esInmutable: false }],
      [{ ruta: 'clinics/a/appointments/c1', huellaActual: 'H' }],
    )
    expect(plan.reversiones[0].accion).toBe('borrar')
    expect(plan.aplicableSinPersona).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('12 y 13 · objetos grandes: lo que el respaldo NO trae', () => {
  it('un metadato de foto sin su objeto se detecta', () => {
    const roturas = cruzarObjetos(
      [{
        ruta: 'clinics/a/patients/p/fotos/f1', coleccion: 'patients.fotos',
        url: '/api/receta/diseno?path=receta-diseno%2Fmed-1%2Ffotos-p-1.jpg',
        rutaDelObjeto: 'receta-diseno/med-1/fotos-p-1.jpg', huellaDeclarada: null,
      }],
      [], ['med-1'],
    )
    expect(roturas.some(r => r.clase === 'metadato-sin-objeto')).toBe(true)
  })

  it('un objeto que ningún documento referencia se detecta (y el audio no cuenta)', () => {
    const roturas = cruzarObjetos(
      [], [
        { ruta: 'receta-diseno/med-1/huerfano.jpg', bytes: 10, huella: null },
        { ruta: 'consultas-audio/med-1/x.webm', bytes: 10, huella: null },
      ], ['med-1'],
    )
    const huerfanos = roturas.filter(r => r.clase === 'objeto-sin-metadato')
    expect(huerfanos).toHaveLength(1)
    expect(huerfanos[0].donde).toContain('receta-diseno')
  })

  it('una huella que no cuadra es P0: la imagen que se enseña no es la que se guardó', () => {
    const roturas = cruzarObjetos(
      [{
        ruta: 'clinics/a/patients/p/fotos/f1', coleccion: 'patients.fotos', url: 'x',
        rutaDelObjeto: 'receta-diseno/med-1/f.jpg', huellaDeclarada: 'AAA',
      }],
      [{ ruta: 'receta-diseno/med-1/f.jpg', bytes: 10, huella: 'BBB' }], ['med-1'],
    )
    const h = roturas.find(r => r.clase === 'huella-no-cuadra')
    expect(h).toBeDefined()
    expect(h!.severidad).toBe('P0')
  })

  it('un objeto de OTRO médico tras restaurar es P0', () => {
    /**
     * El hallazgo real de esta ronda: los objetos se enraízan por `uid` de
     * médico (`receta-diseno/{uid}/…`), no por consultorio. Re-enraizar el
     * documento no mueve el objeto, así que el metadato queda apuntando a
     * material de otro.
     */
    const roturas = cruzarObjetos(
      [{
        ruta: 'clinics/b/patients/p/fotos/f1', coleccion: 'patients.fotos', url: 'x',
        rutaDelObjeto: 'receta-diseno/med-DEL-OTRO/f.jpg', huellaDeclarada: null,
      }],
      [{ ruta: 'receta-diseno/med-DEL-OTRO/f.jpg', bytes: 10, huella: null }], ['med-de-aqui'],
    )
    const h = roturas.find(r => r.clase === 'objeto-de-otro-duenno')
    expect(h).toBeDefined()
    expect(h!.severidad).toBe('P0')
  })

  it('la ruta del objeto se saca de la url del proxy, y su dueño de la ruta', () => {
    expect(rutaDelObjetoDeLaUrl('/api/receta/diseno?path=receta-diseno%2Fuid1%2Fx.png'))
      .toBe('receta-diseno/uid1/x.png')
    expect(duennoDelObjeto('receta-diseno/uid1/x.png')).toBe('uid1')
    expect(rutaDelObjetoDeLaUrl('https://ejemplo.invalid/x.png')).toBeNull()
  })

  it('el archivo DECLARA que los objetos no viajan, y la restauración lo repite', () => {
    // Una ausencia que no se declara se descubre el día del incidente.
    expect(Object.keys(FUERA_DEL_ARCHIVO)).toContain('storage:objetos')
    expect(rutaExportar).toContain('cabeceraV2(')
    expect(rutaImportar).toContain('noVuelve')
    expect(rutaImportar).toMatch(/IMÁGENES de la fotografía clínica/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('14 · la huella del conjunto', () => {
  it('no depende del orden en que se lean los documentos', async () => {
    const a = await huellaDelConjunto(['11'.repeat(32), '22'.repeat(32), '33'.repeat(32)])
    const b = await huellaDelConjunto(['33'.repeat(32), '11'.repeat(32), '22'.repeat(32)])
    expect(a).toBe(b)
  })

  it('un duplicado NO se cancela (por eso se suma en vez de hacer XOR)', async () => {
    /**
     * Con un XOR, dos elementos iguales se anulan y el documento duplicado
     * desaparecería de la huella — justo una de las averías que hay que ver.
     */
    const uno = await huellaDelConjunto(['ab'.repeat(32)])
    const dos = await huellaDelConjunto(['ab'.repeat(32), 'ab'.repeat(32)])
    expect(dos).not.toBe(uno)
    expect(dos).not.toBe('0'.repeat(64))
  })

  it('cambiar un solo documento cambia la huella', async () => {
    const a = acumuladorDeConjunto()
    a.añadir(await huellaDeEntrada('clinics/a/patients/p', { nombre: 'X' }))
    const b = acumuladorDeConjunto()
    b.añadir(await huellaDeEntrada('clinics/a/patients/p', { nombre: 'Y' }))
    expect(a.valor()).not.toBe(b.valor())
  })

  it('dos documentos de contenido idéntico en rutas distintas NO son el mismo elemento', async () => {
    const x = await huellaDeEntrada('clinics/a/appointments/c1', { fecha: 'F' })
    const y = await huellaDeEntrada('clinics/a/appointments/c2', { fecha: 'F' })
    expect(x).not.toBe(y)
  })

  it('una huella del pie que no corresponde se detecta', async () => {
    const { ndjson } = await respaldoLimpio()
    const { ndjson: roto } = inyectar(ndjson, 'huella-corrompida')
    const r = await correrEnsayo(roto, { clinicIdDestino: CLINICA })
    expect(r.completitud.motivos.join(' ')).toMatch(/huella/)
    expect(r.completitud.estado).toBe('incompleto')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('16 · RPO y RTO: medido, deseado, o sin medir', () => {
  it('sólo tres procedencias son mediciones; TARGET y NOT_MEASURED no lo son', () => {
    expect(esMedicion('OBSERVED_LOCAL')).toBe(true)
    expect(esMedicion('OBSERVED_CI')).toBe(true)
    expect(esMedicion('OBSERVED_STAGING')).toBe(true)
    expect(esMedicion('TARGET')).toBe(false)
    expect(esMedicion('NOT_MEASURED')).toBe(false)
  })

  it('hoy NO hay RTO publicable, y se dice cuáles faltan', () => {
    const t = tramosDeHoy()
    const p = rtoPublicable(t)
    expect(p.publicable).toBe(false)
    expect(p.faltan).toContain('restoreDeFirestore')
    expect(p.faltan).toContain('deteccion')
  })

  it('sumar tramos medidos devuelve SIEMPRE cuáles fueron y cuáles faltan', () => {
    const t = tramosDeHoy()
    t.parseoYReenraizado = { procedencia: 'OBSERVED_CI', ms: 120, alcance: 'x', noCubre: 'y' }
    const s = sumarTramosMedidos(t)
    expect(s.ms).toBe(120)
    expect(s.tramos).toEqual(['parseoYReenraizado'])
    expect(s.faltan.length).toBeGreaterThan(0)
    expect(descargoDeAlcance(t)).toMatch(/NO es el RTO/)
  })

  it('cada tramo declara qué cubre y qué NO cubre', () => {
    for (const [nombre, c] of Object.entries(tramosDeHoy())) {
      expect(c.alcance.length, nombre).toBeGreaterThan(20)
      expect(c.noCubre.length, nombre).toBeGreaterThan(20)
    }
  })

  it('el simulacro que ya existía sigue diciendo que no es el RTO', async () => {
    const { POR_QUE_ESTE_ENSAYO_NO_ES_EL_RTO } = await import('@/lib/clinica/simulacro')
    expect(POR_QUE_ESTE_ENSAYO_NO_ES_EL_RTO).toMatch(/no mide el restore de Firestore/i)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('17 y 18 · conservación: elegible NO es borrar', () => {
  it('este repositorio NO fija el plazo mínimo, y por eso nada llega a elegible', () => {
    /**
     * Poner aquí un número plausible sería el fallo más caro posible: no falla,
     * no rompe una prueba, y decide sobre el expediente de alguien.
     */
    expect(DIAS_MINIMOS_DE_CONSERVACION).toBeNull()
    const c = clasificar({
      ultimaActividad: '1990-01-01T00:00:00.000Z',
      ultimaNotaFirmada: '1990-01-01T00:00:00.000Z',
      retencionLegal: false, retencionClinica: null, arcoAbierta: false,
      archivadoPorElConsultorio: true,
    }, Date.parse(CUANDO))
    expect(c.estado).toBe('ARCHIVADO')
    expect(c.queFaltaria).toMatch(/NEEDS_CLINICAL_REVIEW/)
  })

  it('aun con plazo cumplido, NADA autoriza a borrar', () => {
    const c = clasificar({
      ultimaActividad: '1990-01-01T00:00:00.000Z',
      ultimaNotaFirmada: '1990-01-01T00:00:00.000Z',
      retencionLegal: false, retencionClinica: null, arcoAbierta: false,
      archivadoPorElConsultorio: false,
    }, Date.parse(CUANDO), 365 * 5)
    expect(c.estado).toBe('ELEGIBLE_PARA_BORRADO')
    const p = permisoDeBorrado(c.estado)
    expect(p.cumpleElPlazo).toBe(true)
    expect(p.autorizadoAborrar).toBe(false)
  })

  it('la retención legal gana a todo y NO caduca sola', () => {
    const c = clasificar({
      ultimaActividad: '1990-01-01T00:00:00.000Z',
      ultimaNotaFirmada: '1990-01-01T00:00:00.000Z',
      retencionLegal: true, retencionClinica: null, arcoAbierta: false,
      archivadoPorElConsultorio: false,
    }, Date.parse(CUANDO), 365 * 5)
    expect(c.estado).toBe('RETENCION_LEGAL')
    expect(retencionLegalPuedeCaducar().puede).toBe(false)
  })

  it('sin fecha legible no se avanza: se pide revisión', () => {
    const c = clasificar({
      ultimaActividad: 'no-es-una-fecha', ultimaNotaFirmada: null,
      retencionLegal: false, retencionClinica: null, arcoAbierta: false,
      archivadoPorElConsultorio: false,
    }, Date.parse(CUANDO), 365)
    expect(c.estado).toBe('REQUIERE_REVISION')
  })

  it('el módulo de conservación NO exporta ninguna función que borre', () => {
    /**
     * La ausencia ES el control. Un módulo de conservación con una función de
     * borrado acaba conectado a un cron.
     */
    const src = leer('src', 'lib', 'durability', 'archivado.ts')
    expect(src).not.toMatch(/export (async )?function (borrar|eliminar|purgar|suprimir)/)
    expect(src).toContain('POR_QUE_ESTE_MODULO_NO_BORRA_NADA')
  })

  it('y el barrido de plataforma sigue sin tocar nada clínico', async () => {
    const { REGLAS, POR_QUE_NADA_CLINICO } = await import('@/lib/ops/retencion')
    for (const r of REGLAS) expect(r.coleccion).not.toContain('clinics')
    expect(POR_QUE_NADA_CLINICO).toMatch(/NOM-004/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('19 · los secretos ni salen ni entran', () => {
  it('`secretos` está declarado como excluido, con su razón', () => {
    expect(EXCLUIDAS.secretos).toMatch(/llaves de API/i)
  })

  it('una línea de `secretos` en un archivo editado a mano se rechaza', async () => {
    const docs = await generarConsultorio(PEQUEÑO)
    const conSecreto = [
      ...docs,
      { _ruta: `clinics/${CLINICA}/secretos/ia`, _coleccion: 'secretos', apiKey: 'NO-DEBE-ENTRAR' },
    ]
    const ndjson = await aRespaldoNdjson(conSecreto, CLINICA, CUANDO)
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA })

    expect(r.conteos.excluidosPorPolitica).toBe(1)
    expect(r.fotoResultante.some(f => f.ruta.includes('/secretos/'))).toBe(false)
    expect(r.simulacroBase.excluidos).toBe(1)
  })

  it('ningún fixture ni acta lleva algo que parezca una credencial', async () => {
    const docs = await generarConsultorio(PEQUEÑO)
    const texto = JSON.stringify(docs)
    expect(texto).not.toMatch(/sk-[A-Za-z0-9]{16,}/)
    expect(texto).not.toMatch(/AIza[A-Za-z0-9_-]{16,}/)
    expect(texto).not.toMatch(/BEGIN (RSA )?PRIVATE KEY/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('20 · el veredicto, y por qué 9 999 de 10 000 no es éxito', () => {
  it('una sola nota firmada en conflicto tumba el veredicto entero', () => {
    const d = dictaminar(
      { ...CONTEOS_EN_CERO, esperados: 10_000, escritos: 9_999, verdadFirmadaEnConflicto: 1, enRevisionHumana: 1 },
      true, 'completo',
    )
    expect(d.veredicto).toBe('REVISION_HUMANA')
    expect(d.antesDeUsarlo.join(' ')).toMatch(/medicolegal/)
  })

  it('faltar documentos sin nada grave es PARCIAL, no COMPLETA', () => {
    const d = dictaminar(
      { ...CONTEOS_EN_CERO, esperados: 100, escritos: 90 }, true, 'completo',
    )
    expect(d.veredicto).toBe('PARCIAL')
  })

  it('un archivo inválido es FALLIDA y no escribe nada', () => {
    const d = dictaminar({ ...CONTEOS_EN_CERO }, false, 'invalido')
    expect(d.veredicto).toBe('FALLIDA')
  })

  it('AL REVÉS: todo en orden es COMPLETA y sin nada que revisar', () => {
    const d = dictaminar(
      { ...CONTEOS_EN_CERO, esperados: 100, escritos: 100 }, true, 'completo',
    )
    expect(d.veredicto).toBe('COMPLETA')
    expect(d.antesDeUsarlo).toEqual([])
  })

  it('la ruta de importación devuelve el veredicto, no `ok: true` a secas', () => {
    expect(rutaImportar).toContain('veredicto: dictamen.veredicto')
    expect(rutaImportar).toContain("ok: dictamen.veredicto !== 'FALLIDA'")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('21 · el inventario no tiene huecos ni fantasmas', () => {
  it('toda ruta del respaldo tiene clase de dato o declaración de por qué no', () => {
    expect(rutasSinClasificar()).toEqual([])
  })

  it('ninguna clase de dato apunta a una ruta que el respaldo no conoce', () => {
    expect(clasesConRutaFantasma()).toEqual([])
  })

  it('ninguna declaración sobrevive a la ruta que declaraba', () => {
    expect(declaracionesFantasma()).toEqual([])
  })

  it('`backupIncluded` se DERIVA del manifiesto, no se escribe a mano', () => {
    // Si se declarara, el día que una colección salga del respaldo el
    // inventario seguiría diciendo que viaja.
    const src = leer('src', 'lib', 'durability', 'inventario.ts')
    expect(src).toContain('backupIncluded: derivarBackupIncluido(c.sourcePath)')
    const secretos = INVENTARIO.find(c => c.dataClass === 'clinic-secrets')!
    expect(secretos.backupIncluded).toBe(false)
    expect(secretos.restoreAllowed).toBe('nunca')
  })

  it('toda clase inmutable tiene invariante escrita y régimen restrictivo', () => {
    for (const c of INVENTARIO.filter(x => x.signedOrImmutable)) {
      expect(c.integrityInvariant.length, c.dataClass).toBeGreaterThan(40)
      expect(c.restoreAllowed, c.dataClass).not.toBe('libre')
    }
  })

  it('lo que el ensayo trata como inmutable coincide con el inventario', () => {
    // Dos listas que dicen lo mismo y pueden divergir es media protección.
    expect(esColeccionInmutable('patients.notas.adendas', {})).toBe(true)
    expect(esColeccionInmutable('patients.notas', { estado: 'firmada' })).toBe(true)
    expect(esColeccionInmutable('patients.notas', { estado: 'borrador' })).toBe(false)
    expect(esColeccionInmutable('appointments', {})).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('22 · las averías declaran quién las detecta', () => {
  it('ninguna avería se queda sin detector', () => {
    // Una avería sin detector es un caso de prueba que no prueba nada.
    expect(averiasSinDetector()).toEqual([])
    expect(AVERIAS.length).toBe(16)
  })

  it('las de PROCESO no se pueden inyectar en el archivo, y se dice', () => {
    // Confundirlas haría creer que están cubiertas sin haberlas ejercitado.
    expect(() => inyectar('x', 'peticion-repetida')).toThrow(/PROCESO/)
    expect(() => inyectar('x', 'no-existe')).toThrow(/desconocida/)
  })

  it('el arnés y el fixture están versionados', () => {
    expect(VERSION_FIXTURE).toBeTruthy()
    expect(objetosDelFixture(PEQUEÑO).length).toBe(PEQUEÑO.pacientes + 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('23 · escala: el arnés aguanta un consultorio de verdad', () => {
  it('diez mil documentos vuelven enteros y concilian', async () => {
    /**
     * ── POR QUÉ 10 000 Y NO 200 ──────────────────────────────────────────────
     *
     * No es una prueba de capacidad —eso lo mide #342— sino de que la
     * conciliación no se rompe ni se vuelve cuadrática con el tamaño. Un
     * reconciliador que compara todos contra todos pasa con 200 documentos y
     * cuelga con diez mil, y el día que se descubre es el día del incidente.
     */
    const grande = { clinicId: CLINICA, pacientes: 750, notasPorPaciente: 3, citasPorPaciente: 2, semilla: 11 }
    const docs = await generarConsultorio(grande)
    expect(docs.length).toBeGreaterThan(10_000)

    const ndjson = await aRespaldoNdjson(docs, CLINICA, CUANDO)
    const base = await fotoDeLineas(docs)
    const r = await correrEnsayo(ndjson, { clinicIdDestino: CLINICA, destino: DESTINO_VACIO, base })

    expect(r.dictamen.veredicto).toBe('COMPLETA')
    expect(r.conteos.escritos).toBe(docs.length)
    expect(r.reconciliacion?.limpia).toBe(true)
  }, 120_000)
})

// ─────────────────────────────────────────────────────────────────────────────
describe('24 · el arnés no puede tocar nada real', () => {
  it('ningún módulo de durabilidad importa Firestore ni la red', () => {
    /**
     * Es lo que hace seguro correr esto en cualquier máquina: no puede escribir
     * en ninguna parte porque no sabe cómo.
     */
    const modulos = [
      'inventario', 'manifiesto', 'huellas', 'integridad-referencial', 'verdad-firmada',
      'aislamiento', 'idempotencia', 'rollback', 'veredicto', 'reconciliacion',
      'adjuntos', 'archivado', 'crecimiento', 'rpo-rto', 'autosave-contrato',
      'fixtures', 'ensayo',
    ]
    for (const m of modulos) {
      const src = leer('src', 'lib', 'durability', `${m}.ts`)
      expect(src, `${m} importa firebase`).not.toMatch(/from '(firebase|firebase-admin)/)
      expect(src, `${m} importa el admin`).not.toMatch(/firebase-admin/)
      expect(src, `${m} usa fetch`).not.toMatch(/\bfetch\(/)
      expect(src, `${m} lee disco`).not.toMatch(/from 'node:fs'/)
    }
  })

  it('el arnés declara que sus datos son sintéticos, y no trae cifras clínicas', async () => {
    const { POR_QUE_NO_HAY_CIFRAS_CLINICAS } = await import('@/lib/durability/fixtures')
    expect(POR_QUE_NO_HAY_CIFRAS_CLINICAS).toMatch(/sintética|sintético|ninguna cifra/i)
    const docs = await generarConsultorio(PEQUEÑO)
    for (const d of docs.filter(x => x._coleccion === 'patients.notas')) {
      expect(d.signosVitales).toBeNull()
      for (const m of d.medicamentos as { nombre: string }[]) {
        expect(m).not.toHaveProperty('dosis')
      }
    }
  })
})

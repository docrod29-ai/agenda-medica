/**
 * EL CONSULTORIO SINTÉTICO Y LAS DIECISÉIS AVERÍAS.
 *
 * ── CERO PACIENTES REALES ────────────────────────────────────────────────────
 *
 * Todo lo que sale de aquí es inventado: nombres compuestos por partículas,
 * fechas fijas, textos de relleno. Ninguna cifra clínica —ninguna dosis, ningún
 * umbral, ningún signo vital con valor plausible— porque este fixture NO es
 * material clínico y no debe poder confundirse con uno. Los medicamentos llevan
 * nombre de relleno y una intención (`reported`, `start`, …), que es lo único
 * que el arnés necesita comprobar.
 *
 * ── POR QUÉ DOS CONSULTORIOS ─────────────────────────────────────────────────
 *
 * Porque la mitad de las averías de #312 sólo existen cuando hay dos: la ruta
 * que apunta al otro, el campo `clinicId` que sobrevive al re-enraizado, el
 * archivo con las dos historias mezcladas. Un fixture de un solo consultorio no
 * puede fallar en aislamiento, y por tanto no puede demostrar que se detecta.
 *
 * ── POR QUÉ NO HAY `Math.random` ─────────────────────────────────────────────
 *
 * Un ensayo que no se puede repetir no es evidencia. La misma semilla produce
 * el mismo consultorio, byte por byte, así que dos ejecuciones se pueden
 * comparar y un fallo se puede reproducir.
 *
 * ── EL SELLO DE LAS NOTAS FIRMADAS ES EL DE VERDAD ───────────────────────────
 *
 * Se calcula con `generarHashIntegridad` de `expediente/integrity.ts`, el mismo
 * que sella las notas en producción. Si el fixture usara un sello inventado, la
 * prueba de que «restaurar no altera una nota firmada» se estaría probando
 * contra un mecanismo que no es el que corre.
 *
 * Módulo PURO salvo por el hash, que es asíncrono.
 */
import type { NotaMedica } from '@/types/expediente'
import { generarHashIntegridad, HASH_VERSION } from '@/lib/expediente/integrity'
import { cabeceraV2, pieV2 } from '@/lib/durability/manifiesto'
import { huellaDeEntrada, huellaDelConjunto } from '@/lib/durability/huellas'

/** El separador de líneas del NDJSON. Una constante para no repetirlo. */
const SALTO = String.fromCharCode(10)

export const VERSION_FIXTURE = 'durabilidad-1'
/** Versión del árbol de colecciones con el que se generó. */
export const SCHEMA_VERSION = 1

/** Generador determinista. Mismo `semilla` ⇒ misma secuencia. */
function dado(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const NOMBRES = ['Aro', 'Bel', 'Cor', 'Dun', 'Eri', 'Fal', 'Gor', 'Hal', 'Ith', 'Jor']
const APELLIDOS = ['Vantel', 'Morrigan', 'Quessir', 'Draven', 'Sorrel', 'Wren', 'Ashby']

export interface OpcionesDeFixture {
  clinicId: string
  pacientes: number
  /** Notas por paciente. La primera de cada paciente sale FIRMADA. */
  notasPorPaciente: number
  citasPorPaciente: number
  semilla: number
  /** Fecha base, ISO. Fija: no se lee el reloj. */
  desde?: string
}

/** Una línea del respaldo, ya con su ruta. */
export interface LineaSintetica {
  _ruta: string
  _coleccion: string
  [k: string]: unknown
}

const BASE_POR_OMISION = '2026-01-05T09:00:00.000Z'

function fecha(base: string, dias: number, minutos = 0): string {
  return new Date(Date.parse(base) + dias * 86_400_000 + minutos * 60_000).toISOString()
}

/**
 * Una nota con la forma que sella `canonicoV3`.
 *
 * Se construye completa a propósito: si faltaran campos, el sello se calcularía
 * sobre `null` y la prueba de inmutabilidad estaría probando otra cosa.
 */
function armarNota(
  clinicId: string, pacienteId: string, notaId: string, medicoId: string,
  firmada: boolean, cuando: string, texto: string,
): Record<string, unknown> {
  return {
    clinicId,
    pacienteId,
    pacienteNombre: `Paciente ${pacienteId}`,
    tipo: 'consulta',
    estado: firmada ? 'firmada' : 'borrador',
    fechaConsulta: cuando,
    createdAt: cuando,
    creadoPor: medicoId,
    updatedAt: cuando,
    resumenEjecutivo: texto,
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo', value: `${texto} (relato sintético)` },
      { key: 'objetivo', label: 'Objetivo', value: 'exploración sintética sin cifras' },
      { key: 'analisis', label: 'Análisis', value: 'análisis sintético' },
      { key: 'plan', label: 'Plan', value: 'plan sintético' },
    ],
    signosVitales: null,
    diagnosticos: [{ descripcion: 'Diagnóstico sintético', confirmadoPor: firmada ? medicoId : null }],
    /**
     * Los seis estados de intención que #326 exige en su fixture. Sin cifras:
     * lo que el arnés comprueba es que la INTENCIÓN sobreviva la ida y vuelta,
     * no que la dosis sea correcta.
     */
    medicamentos: [
      { nombre: 'Fármaco-A', intencion: 'reported' },
      { nombre: 'Fármaco-B', intencion: 'continue' },
      { nombre: 'Fármaco-C', intencion: firmada ? 'start' : 'unknown' },
      { nombre: 'Fármaco-D', intencion: 'change' },
      { nombre: 'Fármaco-E', intencion: 'stop' },
      { nombre: 'Fármaco-F', intencion: 'unknown' },
    ],
    alergias: [],
    preop: null,
    hospital: null,
    infectologia: null,
    estudiosOrden: null,
    internamientoId: null,
    iaAuditoria: null,
    transcripcionCruda: `${texto} — transcripción de trabajo sintética`,
    transcripcionMotor: `${texto} — transcripción de motor sintética`,
    dialogoDiarizado: null,
    metadata: {
      id: notaId,
      tipoNota: 'consulta',
      clinicId,
      pacienteId,
      medicoId,
      cedulaProfesional: 'CED-SINTETICA',
      especialidad: 'Medicina interna',
      establecimiento: 'Consultorio sintético',
      fechaCreacion: cuando,
      fechaModificacion: cuando,
      fuenteGeneracion: 'sintetico',
      estado: firmada ? 'firmada' : 'borrador',
      version: 1,
    },
  }
}

/** Sella la nota con el MISMO sello que produce la aplicación. */
async function sellar(nota: Record<string, unknown>): Promise<Record<string, unknown>> {
  const hash = await generarHashIntegridad(nota as unknown as NotaMedica, HASH_VERSION)
  const meta = { ...(nota.metadata as Record<string, unknown>), hashIntegridad: hash, hashVersion: HASH_VERSION }
  return { ...nota, metadata: meta }
}

/**
 * Genera un consultorio sintético completo.
 *
 * Incluye: pacientes, citas, notas (la primera de cada paciente FIRMADA, con
 * adenda), versiones de borrador, laboratorios, fotografía clínica con su
 * metadato de Storage, cobros y bitácora.
 */
export async function generarConsultorio(op: OpcionesDeFixture): Promise<LineaSintetica[]> {
  const base = op.desde ?? BASE_POR_OMISION
  const r = dado(op.semilla)
  const out: LineaSintetica[] = []
  const raiz = `clinics/${op.clinicId}`
  const medicoId = `med-${op.clinicId}-1`

  out.push({
    _ruta: `${raiz}/doctors/${medicoId}`, _coleccion: 'doctors',
    nombre: 'Dra. Sintética', cedula: 'CED-SINTETICA', activo: true,
  })
  out.push({
    _ruta: `${raiz}/config/general`, _coleccion: 'config',
    membrete: `/api/receta/diseno?path=receta-diseno%2F${medicoId}%2Fmembrete-1.png`,
    horario: 'sintético',
  })

  for (let i = 0; i < op.pacientes; i++) {
    const pid = `pac-${op.clinicId}-${String(i).padStart(5, '0')}`
    const nombre = `${NOMBRES[Math.floor(r() * NOMBRES.length)]} ${APELLIDOS[Math.floor(r() * APELLIDOS.length)]}`
    out.push({
      _ruta: `${raiz}/patients/${pid}`, _coleccion: 'patients',
      clinicId: op.clinicId, nombre, fechaNacimiento: '1980-01-01',
      telefono: '000-000-0000', creadoEn: fecha(base, -365),
    })
    out.push({
      _ruta: `${raiz}/patients/${pid}/clinico/antecedentes`, _coleccion: 'patients.clinico',
      clinicId: op.clinicId, pacienteId: pid, alergias: [], cronicas: [],
    })

    for (let c = 0; c < op.citasPorPaciente; c++) {
      out.push({
        _ruta: `${raiz}/appointments/cita-${pid}-${c}`, _coleccion: 'appointments',
        clinicId: op.clinicId, patientId: pid, medicoId,
        fecha: fecha(base, c * 7, c * 30), estado: 'confirmada', duracionMin: 30,
      })
    }

    for (let n = 0; n < op.notasPorPaciente; n++) {
      const notaId = `nota-${pid}-${n}`
      const firmada = n === 0
      const cuando = fecha(base, n * 7, 15)
      const nota = await sellar(armarNota(op.clinicId, pid, notaId, medicoId, firmada, cuando, `Consulta sintética ${n}`))
      out.push({ _ruta: `${raiz}/patients/${pid}/notas/${notaId}`, _coleccion: 'patients.notas', ...nota })

      if (firmada) {
        out.push({
          _ruta: `${raiz}/patients/${pid}/notas/${notaId}/adendas/ad-1`,
          _coleccion: 'patients.notas.adendas',
          clinicId: op.clinicId, pacienteId: pid,
          texto: 'Aclaración sintética sobre la nota.', motivo: 'Dato omitido',
          autorUid: medicoId, autorNombre: 'Dra. Sintética', autorEmail: 'sintetica@example.invalid',
          autorCedula: 'CED-SINTETICA', createdAt: fecha(base, n * 7, 90),
        })
      } else {
        out.push({
          _ruta: `${raiz}/patients/${pid}/notas/${notaId}/versions/v-1`,
          _coleccion: 'patients.notas.versions',
          clinicId: op.clinicId, pacienteId: pid,
          resumenEjecutivo: 'Versión anterior sintética',
          versionadoEn: fecha(base, n * 7, 10), versionadoPor: medicoId,
        })
      }
    }

    out.push({
      _ruta: `${raiz}/patients/${pid}/laboratorios/lab-1`, _coleccion: 'patients.laboratorios',
      clinicId: op.clinicId, pacienteId: pid, estudio: 'Estudio sintético',
      fecha: fecha(base, 1), resultado: 'sin cifras: material sintético',
    })
    out.push({
      _ruta: `${raiz}/patients/${pid}/fotos/foto-1`, _coleccion: 'patients.fotos',
      clinicId: op.clinicId, pacienteId: pid, region: 'Otra',
      fecha: fecha(base, 1), descripcion: 'Imagen sintética',
      url: `/api/receta/diseno?path=receta-diseno%2F${medicoId}%2Ffotos${pid}-1.jpg`,
    })
    out.push({
      _ruta: `${raiz}/cobros/cobro-${pid}-1`, _coleccion: 'cobros',
      clinicId: op.clinicId, patientId: pid, monto: 0, moneda: 'MXN',
      concepto: 'Consulta sintética', fecha: fecha(base, 1),
    })
    out.push({
      _ruta: `${raiz}/audit_log/aud-${pid}-1`, _coleccion: 'audit_log',
      /**
       * El evento sale del tipo `AuditEvento`, no se inventa: el trinquete de
       * `bitacora-etiquetas` exige que todo lo que se escribe esté declarado, y
       * un fixture que invente un nombre lo rompe — con razón, porque ese
       * nombre acabaría en la pantalla de cumplimiento tal cual.
       */
      clinicId: op.clinicId, evento: 'expediente_lectura', medicoUid: medicoId,
      timestamp: fecha(base, 1, 5),
    })
  }

  return out
}

/** Objetos de Storage que corresponden al fixture. Sólo nombres y tamaños. */
export function objetosDelFixture(op: OpcionesDeFixture): { ruta: string; bytes: number; huella: string | null }[] {
  const medicoId = `med-${op.clinicId}-1`
  const out = [{ ruta: `receta-diseno/${medicoId}/membrete-1.png`, bytes: 120_000, huella: null }]
  for (let i = 0; i < op.pacientes; i++) {
    const pid = `pac-${op.clinicId}-${String(i).padStart(5, '0')}`
    out.push({ ruta: `receta-diseno/${medicoId}/fotos${pid}-1.jpg`, bytes: 240_000, huella: null })
  }
  return out
}

/** Envuelve los documentos en un archivo NDJSON del formato v2. */
export async function aRespaldoNdjson(
  docs: readonly LineaSintetica[], clinicId: string, generadoEn: string,
): Promise<string> {
  const conteos: Record<string, number> = {}
  const huellas: string[] = []
  for (const d of docs) {
    conteos[d._coleccion] = (conteos[d._coleccion] ?? 0) + 1
    huellas.push(await huellaDeEntrada(d._ruta, d as Record<string, unknown>))
  }
  const lineas = [JSON.stringify(cabeceraV2(clinicId, generadoEn, SCHEMA_VERSION))]
  for (const d of docs) lineas.push(JSON.stringify(d))
  lineas.push(JSON.stringify(pieV2(docs.length, conteos, await huellaDelConjunto(huellas), [])))
  return lineas.join(SALTO)
}

// ── LAS DIECISÉIS AVERÍAS ────────────────────────────────────────────────────

export type AmbitoDeAveria =
  /** Se inyecta en el archivo: se puede aplicar aquí. */
  | 'archivo'
  /** Es un suceso del PROCESO de restauración: lo provoca el arnés, no el archivo. */
  | 'proceso'

export interface Averia {
  codigo: string
  ambito: AmbitoDeAveria
  /** Qué se rompe. */
  descripcion: string
  /** Qué tiene que detectarlo. Si esto está vacío, la avería no está cubierta. */
  detectadaPor: string
}

export const AVERIAS: Averia[] = [
  { codigo: 'respaldo-truncado-sin-pie', ambito: 'archivo', descripcion: 'El archivo se corta antes de la línea de cierre.', detectadaPor: 'manifiesto.evaluarCompletitud → sin pie ⇒ incompleto; veredicto.dictaminar ⇒ PARCIAL.' },
  { codigo: 'linea-json-corrupta', ambito: 'archivo', descripcion: 'Una línea deja de ser JSON válido.', detectadaPor: 'restaurar.leerLinea ⇒ rechazada; el resto del archivo sigue restaurándose.' },
  { codigo: 'documento-ausente', ambito: 'archivo', descripcion: 'Se quita un documento que existía en la base.', detectadaPor: 'reconciliacion.reconciliar ⇒ FALTA.' },
  { codigo: 'documento-duplicado', ambito: 'archivo', descripcion: 'Un documento aparece dos veces con distinta identidad.', detectadaPor: 'reconciliacion.duplicadosPorContenido y ⇒ SOBRA.' },
  { codigo: 'version-rancia', ambito: 'archivo', descripcion: 'El archivo trae una versión ANTERIOR de un documento que en el destino es más nueva.', detectadaPor: 'idempotencia.decidirEscritura ⇒ no-pisar-lo-mas-nuevo; reconciliar ⇒ RANCIO.' },
  { codigo: 'ruta-de-otro-consultorio', ambito: 'archivo', descripcion: 'Una línea trae `_ruta` de otro `clinicId`.', detectadaPor: 'restaurar.reenraizar la reescribe; integridad-referencial la ve si llega sin re-enraizar.' },
  { codigo: 'referencia-interna-forastera', ambito: 'archivo', descripcion: 'El contenido del documento declara `clinicId` del consultorio de origen.', detectadaPor: 'aislamiento.referenciasForasteras ⇒ campo-de-inquilino-forastero.' },
  { codigo: 'nota-firmada-alterada', ambito: 'archivo', descripcion: 'Se cambia el texto de una nota FIRMADA sin recalcular su sello.', detectadaPor: 'verdad-firmada.compararNotaFirmada ⇒ archivo-alterado (fail closed).' },
  { codigo: 'adenda-sin-nota', ambito: 'archivo', descripcion: 'Se quita la nota padre de una adenda.', detectadaPor: 'integridad-referencial ⇒ adenda-sin-nota (P0).' },
  { codigo: 'adjunto-sin-metadato', ambito: 'archivo', descripcion: 'Hay objeto en el bucket que ningún documento referencia.', detectadaPor: 'adjuntos.cruzarObjetos ⇒ objeto-sin-metadato.' },
  { codigo: 'metadato-sin-adjunto', ambito: 'archivo', descripcion: 'Hay metadato de foto cuyo objeto no existe en el destino.', detectadaPor: 'adjuntos.cruzarObjetos ⇒ metadato-sin-objeto.' },
  { codigo: 'huella-corrompida', ambito: 'archivo', descripcion: 'La huella del pie no corresponde al contenido.', detectadaPor: 'manifiesto.evaluarCompletitud ⇒ huella no coincide.' },
  { codigo: 'restauracion-interrumpida', ambito: 'proceso', descripcion: 'El proceso muere a mitad de un lote.', detectadaPor: 'idempotencia: el punto de control sólo avanza tras confirmar; el reintento reescribe el lote incompleto.' },
  { codigo: 'reinicio-del-proceso', ambito: 'proceso', descripcion: 'El trabajador se reinicia y se reanuda el mismo trabajo.', detectadaPor: 'idempotencia.esElMismoTrabajo + loteYaConfirmado.' },
  { codigo: 'peticion-repetida', ambito: 'proceso', descripcion: 'Se pide dos veces la misma restauración entera.', detectadaPor: 'idempotencia.decidirEscritura ⇒ omitir-identico; el estado final no cambia.' },
  { codigo: 'timeout-despues-de-escribir', ambito: 'proceso', descripcion: 'El servidor escribió y la respuesta no llegó; se reintenta.', detectadaPor: 'lo mismo: el reintento encuentra los documentos idénticos y no escribe.' },
]

/** Toda avería tiene que declarar quién la detecta. Sin eso, no es un caso. */
export function averiasSinDetector(): string[] {
  return AVERIAS.filter(a => !a.detectadaPor.trim()).map(a => a.codigo)
}

/**
 * Aplica una avería de ámbito `archivo` sobre el NDJSON.
 *
 * @returns el archivo averiado y qué se tocó, para que el acta pueda decirlo.
 * @throws si el código es de ámbito `proceso`: ésas las provoca el arnés, no el
 *   archivo, y confundirlas haría creer que están cubiertas cuando no se han
 *   ejercitado.
 */
export function inyectar(ndjson: string, codigo: string): { ndjson: string; queSeToco: string } {
  const av = AVERIAS.find(a => a.codigo === codigo)
  if (!av) throw new Error(`avería desconocida: ${codigo}`)
  if (av.ambito !== 'archivo') {
    throw new Error(`«${codigo}» es una avería de PROCESO: la provoca el arnés ejecutando la restauración de otra manera, no editando el archivo.`)
  }
  const lineas = ndjson.split(SALTO)
  const iDoc = lineas.findIndex(l => l.includes('"_coleccion":"patients.notas"') && l.includes('"estado":"firmada"'))
  const iCita = lineas.findIndex(l => l.includes('"_coleccion":"appointments"'))
  const iPie = lineas.length - 1

  const unir = (ls: string[]) => ls.join(SALTO)

  switch (codigo) {
    case 'respaldo-truncado-sin-pie':
      return { ndjson: unir(lineas.slice(0, Math.max(2, iPie - 3))), queSeToco: 'se cortó el archivo antes del pie y de las últimas líneas' }

    case 'linea-json-corrupta': {
      const ls = [...lineas]
      const i = Math.min(3, ls.length - 2)
      ls[i] = `${ls[i].slice(0, Math.floor(ls[i].length / 2))}`
      return { ndjson: unir(ls), queSeToco: `se truncó la línea ${i} a la mitad` }
    }

    case 'documento-ausente': {
      const ls = [...lineas]
      const i = ls.findIndex(l => l.includes('"_coleccion":"patients.laboratorios"'))
      if (i < 0) throw new Error('el fixture no tiene laboratorios que quitar')
      ls.splice(i, 1)
      return { ndjson: unir(ls), queSeToco: 'se quitó un laboratorio del archivo' }
    }

    case 'documento-duplicado': {
      if (iCita < 0) throw new Error('el fixture no tiene citas que duplicar')
      const o = JSON.parse(lineas[iCita]) as LineaSintetica
      const copia = { ...o, _ruta: `${o._ruta}-copia` }
      const ls = [...lineas]
      ls.splice(iCita + 1, 0, JSON.stringify(copia))
      return { ndjson: unir(ls), queSeToco: 'se duplicó una cita con otra identidad y el mismo contenido' }
    }

    case 'version-rancia': {
      const ls = [...lineas]
      const i = ls.findIndex(l => l.includes('"_coleccion":"patients.notas"') && l.includes('"estado":"borrador"'))
      if (i < 0) throw new Error('el fixture no tiene borradores')
      const o = JSON.parse(ls[i]) as Record<string, unknown>
      o.updatedAt = '2020-01-01T00:00:00.000Z'
      o.resumenEjecutivo = 'Versión vieja sintética'
      ls[i] = JSON.stringify(o)
      return { ndjson: unir(ls), queSeToco: 'se retrasó la fecha de un borrador a 2020 para que sea más viejo que el destino' }
    }

    case 'ruta-de-otro-consultorio': {
      const ls = [...lineas]
      const i = ls.findIndex(l => l.includes('"_coleccion":"patients"'))
      const o = JSON.parse(ls[i]) as LineaSintetica
      o._ruta = o._ruta.replace(/^clinics\/[^/]+\//, 'clinics/consultorio-ajeno/')
      ls[i] = JSON.stringify(o)
      return { ndjson: unir(ls), queSeToco: 'una línea apunta a `clinics/consultorio-ajeno/…`' }
    }

    case 'referencia-interna-forastera': {
      const ls = [...lineas]
      const i = ls.findIndex(l => l.includes('"_coleccion":"appointments"'))
      const o = JSON.parse(ls[i]) as Record<string, unknown>
      o.clinicId = 'consultorio-ajeno'
      o.notaDeReferencia = 'clinics/consultorio-ajeno/patients/pac-x/notas/nota-x'
      ls[i] = JSON.stringify(o)
      return { ndjson: unir(ls), queSeToco: 'una cita declara `clinicId: consultorio-ajeno` y referencia una ruta suya' }
    }

    case 'nota-firmada-alterada': {
      if (iDoc < 0) throw new Error('el fixture no tiene notas firmadas')
      const ls = [...lineas]
      const o = JSON.parse(ls[iDoc]) as Record<string, unknown>
      const secciones = o.secciones as { key: string; label: string; value: string }[]
      o.secciones = secciones.map(s => s.key === 'plan' ? { ...s, value: 'PLAN ALTERADO SIN RESELLAR' } : s)
      ls[iDoc] = JSON.stringify(o)
      return { ndjson: unir(ls), queSeToco: 'se cambió el plan de una nota FIRMADA sin recalcular su sello' }
    }

    case 'adenda-sin-nota': {
      const ls = [...lineas]
      const iAd = ls.findIndex(l => l.includes('"_coleccion":"patients.notas.adendas"'))
      if (iAd < 0) throw new Error('el fixture no tiene adendas')
      const ad = JSON.parse(ls[iAd]) as LineaSintetica
      const padre = ad._ruta.split('/').slice(0, -2).join('/')
      const iPadre = ls.findIndex(l => l.includes(`"_ruta":"${padre}"`))
      if (iPadre < 0) throw new Error('no se encontró la nota padre de la adenda')
      ls.splice(iPadre, 1)
      return { ndjson: unir(ls), queSeToco: `se quitó la nota ${padre}, dejando su adenda huérfana` }
    }

    case 'metadato-sin-adjunto':
      return { ndjson, queSeToco: 'no se toca el archivo: el arnés omite el objeto del listado del bucket destino' }

    case 'adjunto-sin-metadato': {
      const ls = [...lineas]
      const i = ls.findIndex(l => l.includes('"_coleccion":"patients.fotos"'))
      if (i < 0) throw new Error('el fixture no tiene fotos')
      ls.splice(i, 1)
      return { ndjson: unir(ls), queSeToco: 'se quitó el metadato de una foto; su objeto sigue en el bucket' }
    }

    case 'huella-corrompida': {
      const ls = [...lineas]
      const pie = JSON.parse(ls[ls.length - 1]) as Record<string, unknown>
      pie.huella = '0'.repeat(64)
      ls[ls.length - 1] = JSON.stringify(pie)
      return { ndjson: unir(ls), queSeToco: 'se sustituyó la huella del pie por ceros' }
    }

    default:
      throw new Error(`avería de archivo sin inyector: ${codigo}`)
  }
}

export const POR_QUE_NO_HAY_CIFRAS_CLINICAS =
  'Un fixture con dosis plausibles acaba copiado a un ejemplo, a una captura de ' +
  'pantalla y a una demostración. Ninguna cifra de este archivo salió de una ' +
  'fuente citada, así que ninguna cifra de este archivo puede parecer clínica. ' +
  'Lo que el arnés comprueba —identidad, linaje, inquilino, sello— no necesita ' +
  'ni una.'

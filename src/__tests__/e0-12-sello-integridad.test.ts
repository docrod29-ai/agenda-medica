import { describe, it, expect } from 'vitest'
import {
  generarHashIntegridad,
  verificarIntegridadEstado,
  verificarIntegridadDetalle,
  HASH_VERSION,
  CAMPOS_SELLADOS_V3,
  CAMPOS_NO_SELLADOS_V3,
  COBERTURA_SELLO,
} from '@/lib/expediente/integrity'
import { stripUndefined } from '@/lib/expediente/serializacion'
import type { NotaMedica, MetadataNOM024 } from '@/types/expediente'

/**
 * E0-12 — El sello de integridad cubre TODO el contenido firmable.
 *
 * ACEPTACIÓN: alterar `preop.resultados` de una nota FIRMADA la marca 'alterada'.
 *
 * Todo aquí es SINTÉTICO: paciente ficticio, puntajes inventados como bytes, no
 * como criterio clínico. Estos tests no afirman nada médico — sólo que cambiar un
 * byte del documento firmado rompe el sello, y que los cambios legítimos NO.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixture: NotaMedica con TODOS sus campos poblados
// ─────────────────────────────────────────────────────────────────────────────

function notaV3Completa(): NotaMedica {
  return {
    id: 'nota-doc-id',
    clinicId: 'clinica-sintetica',
    pacienteId: 'pac-999',
    pacienteNombre: 'Paciente Ficticio de Prueba',
    tipo: 'valoracion_preoperatoria',
    metadata: {
      id: 'nota-meta-id',
      tipoNota: 'valoracion_preoperatoria',
      clinicId: 'clinica-sintetica',
      pacienteId: 'pac-999',
      medicoId: 'medico-uid-1',
      cedulaProfesional: '00000000',
      especialidad: 'Medicina interna',
      establecimiento: 'Consultorio de pruebas',
      fechaCreacion: '2026-07-29T10:00:00.000Z',
      fechaModificacion: '2026-07-29T10:00:00.000Z',
      hashIntegridad: '',
      hashVersion: undefined,
      version: 1,
      estado: 'firmada',
      fuenteGeneracion: 'ia_voz',
    },
    resumenEjecutivo: 'Valoración preoperatoria de caso ficticio.',
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo', value: 'Texto sintético S.', obligatorio: true },
      { key: 'objetivo', label: 'Objetivo', value: 'Texto sintético O.', placeholder: 'ph' },
    ],
    signosVitales: { fc: 70, ta: '110/70' },
    diagnosticos: [{ descripcion: 'Diagnóstico ficticio', tipo: 'definitivo', estado: 'activo', codigoCIE10: 'Z00' }],
    medicamentos: [{ nombre: 'Fármaco ficticio', dosis: '1 tableta', via: 'oral', frecuencia: 'cada 24 h', duracion: '5 días', indicacion: 'prueba' }],
    alergias: [{ alergeno: 'Alérgeno ficticio' }],
    estudiosOrden: ['Estudio sintético A', 'Estudio sintético B'],
    internamientoId: 'internamiento-1',
    hospital: {
      servicio: 'Servicio de pruebas',
      cama: '101-A',
      diaHospitalizacion: 3,
      condicion: 'estable',
      fechaIngreso: '2026-07-26T08:00:00.000Z',
      fechaEgreso: '2026-07-29T08:00:00.000Z',
      balanceHidrico: { ingresos: 1000, egresos: 900, balance: 100 },
    },
    infectologia: {
      diaAntibiotico: 4,
      antibioticoActual: 'Antibiótico ficticio',
      candidatoDesescalada: true,
      candidatoSwitchIVVO: false,
      cultivosSeguimiento: 'Pendiente (ficticio)',
    },
    // Forma real que produce PreopAssessment (inputs de las escalas + resultados
    // calculados por el motor determinista). Los números son sintéticos.
    preop: {
      inputs: { cardiopatiaIsquemica: true, dasi: 20, caprini: 3, stopbang: 2, chadsvasc: 1, hasbled: 0, cirugia: 'ficticia' },
      resultados: {
        rcri: { puntos: 2, nivel: 'sintetico', interpretacion: 'Texto sintético de prueba' },
        dasi: { mets: 6.5, nivel: 'sintetico' },
        caprini: { puntos: 3, nivel: 'sintetico' },
        stopbang: { puntos: 2, nivel: 'sintetico' },
        ariscat: { puntos: 26, nivel: 'sintetico' },
        chadsvasc: { puntos: 1, nivel: 'sintetico' },
        hasbled: { puntos: 0, nivel: 'sintetico' },
      },
    },
    iaAuditoria: {
      extraction: { campo: { valor: 'x', cita: 'dijo x' } },
      safety: { conflictos: [] },
      aprobadosPorMedico: ['dx.0'],
      procedencia: { dictado: 2, ia: 1, manual: 3, total: 6 },
      procesadoEn: '2026-07-29T09:50:00.000Z',
      aprobadoPor: 'medico@ejemplo.test',
      provenance: {
        modelo: 'modelo-ficticio-1',
        motor: 'estandar',
        promptVersion: 'v1',
        apiVersion: '2026-01-01',
        generadoEn: '2026-07-29T09:49:00.000Z',
        revisadoPorHumano: true,
        camposAprobados: 1,
        pmids: ['00000000'],
      },
    },
    transcripcionCruda: 'Transcripción sintética de la consulta ficticia.',
    // v996: el material de origen y la lista de dudas. Datos 100 % sintéticos.
    transcripcionMotor: 'transcripcion sintetica sin corregir de la consulta ficticia',
    palabrasAVerificar: [{ texto: 'sintética', momento: '0:03', seguridad: 41 }],
    dialogoDiarizado: [
      { speaker: 'Médico', text: 'Pregunta sintética.' },
      { speaker: 'Paciente', text: 'Respuesta sintética.' },
    ],
    firma: undefined,
    estado: 'firmada',
    fechaConsulta: '2026-07-29T10:00:00.000Z',
    createdAt: '2026-07-29T09:00:00.000Z',
    updatedAt: '2026-07-29T10:00:00.000Z',
    creadoPor: 'medico-uid-1',
  }
}

/** Sella la nota como lo hace `firmar()`: hash primero, metadata del sello después. */
async function sellar(nota: NotaMedica, version = HASH_VERSION): Promise<NotaMedica> {
  const hashIntegridad = await generarHashIntegridad(nota, version as 2 | 3)
  return { ...nota, metadata: { ...nota.metadata, hashIntegridad, hashVersion: version } }
}

/** Aplica una mutación profunda sobre una copia (JSON) de la nota. */
function mutar(nota: NotaMedica, fn: (n: Record<string, never>) => void): NotaMedica {
  const copia = JSON.parse(JSON.stringify(nota)) as NotaMedica
  fn(copia as unknown as Record<string, never>)
  return copia
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Libre = any

// ─────────────────────────────────────────────────────────────────────────────
// 1 · ACEPTACIÓN
// ─────────────────────────────────────────────────────────────────────────────

describe('E0-12 · aceptación: preop entra al sello', () => {
  it('alterar preop.resultados de una nota FIRMADA la marca "alterada"', async () => {
    const firmada = await sellar(notaV3Completa())
    expect(await verificarIntegridadEstado(firmada)).toBe('verificada')

    // El puntaje de riesgo quirúrgico de una nota YA FIRMADA se cambia por otro.
    const alterada = mutar(firmada, (n: Libre) => { n.preop.resultados.rcri.puntos = 4 })
    expect(await verificarIntegridadEstado(alterada)).toBe('alterada')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Una hoja alterada por caso → 'alterada' en todas
// ─────────────────────────────────────────────────────────────────────────────

const MUTACIONES_DETECTABLES: [string, (n: Libre) => void][] = [
  ['preop.inputs.dasi', n => { n.preop.inputs.dasi = 99 }],
  ['preop.resultados.ariscat.puntos', n => { n.preop.resultados.ariscat.puntos = 99 }],
  ['hospital.cama', n => { n.hospital.cama = '999-Z' }],
  ['hospital.balanceHidrico.balance', n => { n.hospital.balanceHidrico.balance = -500 }],
  ['infectologia.diaAntibiotico', n => { n.infectologia.diaAntibiotico = 14 }],
  ['infectologia.candidatoDesescalada', n => { n.infectologia.candidatoDesescalada = false }],
  ['resumenEjecutivo', n => { n.resumenEjecutivo = 'Otro resumen.' }],
  ['secciones[0].label', n => { n.secciones[0].label = 'Objetivo' }],
  ['secciones[0].value', n => { n.secciones[0].value = 'Otro texto.' }],
  ['estudiosOrden[0]', n => { n.estudiosOrden[0] = 'Otro estudio' }],
  ['internamientoId', n => { n.internamientoId = 'internamiento-2' }],
  ['transcripcionCruda', n => { n.transcripcionCruda = 'Otra transcripción.' }],
  ['dialogoDiarizado[0].text', n => { n.dialogoDiarizado[0].text = 'Otra frase.' }],
  ['iaAuditoria.provenance.modelo', n => { n.iaAuditoria.provenance.modelo = 'modelo-ficticio-2' }],
  ['iaAuditoria.provenance.revisadoPorHumano', n => { n.iaAuditoria.provenance.revisadoPorHumano = false }],
  ['iaAuditoria.extraction', n => { n.iaAuditoria.extraction.campo.cita = 'nunca lo dijo' }],
  ['pacienteNombre', n => { n.pacienteNombre = 'Otro Paciente Ficticio' }],
  ['clinicId', n => { n.clinicId = 'otra-clinica' }],
  ['createdAt', n => { n.createdAt = '2020-01-01T00:00:00.000Z' }],
  ['creadoPor', n => { n.creadoPor = 'otro-uid' }],
  ['metadata.id', n => { n.metadata.id = 'otra-nota-meta-id' }],
  ['metadata.medicoId', n => { n.metadata.medicoId = 'otro-medico' }],
  ['metadata.cedulaProfesional', n => { n.metadata.cedulaProfesional = '11111111' }],
  ['metadata.establecimiento', n => { n.metadata.establecimiento = 'Otro consultorio' }],
  ['metadata.especialidad', n => { n.metadata.especialidad = 'Otra especialidad' }],
  ['metadata.fuenteGeneracion', n => { n.metadata.fuenteGeneracion = 'manual' }],
  ['metadata.fechaCreacion', n => { n.metadata.fechaCreacion = '2020-01-01T00:00:00.000Z' }],
  ['metadata.tipoNota', n => { n.metadata.tipoNota = 'consulta_general' }],
  ['fechaConsulta', n => { n.fechaConsulta = '2020-01-01T00:00:00.000Z' }],
  ['tipo', n => { n.tipo = 'consulta_general' }],
  ['pacienteId', n => { n.pacienteId = 'pac-000' }],
  ['diagnosticos[0].descripcion', n => { n.diagnosticos[0].descripcion = 'Otro dx' }],
  ['medicamentos[0].dosis', n => { n.medicamentos[0].dosis = '2 tabletas' }],
  ['alergias[0].alergeno', n => { n.alergias[0].alergeno = 'Otro alérgeno' }],
  ['signosVitales.fc', n => { n.signosVitales.fc = 140 }],
]

describe('E0-12 · toda hoja del contenido firmable es detectable', () => {
  it.each(MUTACIONES_DETECTABLES)('alterar %s → "alterada"', async (_campo, mutacion) => {
    const firmada = await sellar(notaV3Completa())
    expect(await verificarIntegridadEstado(mutar(firmada, mutacion))).toBe('alterada')
  })

  it('las 22 hojas cubiertas por v2 seguían detectándose; las nuevas NO lo estaban', async () => {
    // Control: con el sello v2 estas mutaciones pasaban INADVERTIDAS. Es el hueco
    // que cierra esta unidad; si alguna empieza a detectarse en v2, canonicoV2 se movió.
    const firmadaV2 = await sellar(notaV3Completa(), 2)
    const invisiblesEnV2: ((n: Libre) => void)[] = [
      n => { n.preop.resultados.rcri.puntos = 4 },
      n => { n.hospital.cama = '999-Z' },
      n => { n.infectologia.diaAntibiotico = 14 },
      n => { n.iaAuditoria.provenance.modelo = 'otro' },
      n => { n.transcripcionCruda = 'otra' },
      n => { n.metadata.cedulaProfesional = '11111111' },
      n => { n.resumenEjecutivo = 'otro' },
      n => { n.secciones[0].label = 'Objetivo' },
    ]
    for (const mutacion of invisiblesEnV2) {
      expect(await verificarIntegridadEstado(mutar(firmadaV2, mutacion))).toBe('verificada')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3 · Negativos: cambios LEGÍTIMOS no deben alarmar
// ─────────────────────────────────────────────────────────────────────────────

const CAMBIOS_LEGITIMOS: [string, (n: Libre) => void][] = [
  ['adjuntar la firma después del hash', n => {
    n.firma = {
      nombreMedico: 'Dra. Ficticia', cedulaProfesional: '00000000', especialidad: 'Medicina interna',
      institucion: 'Consultorio de pruebas', timestamp: '2026-07-29T10:00:01.000Z',
      hashFirma: 'ff00', imagenDataUrl: 'data:image/png;base64,AAAA',
    }
  }],
  ['metadata.fechaModificacion se fija después del hash', n => { n.metadata.fechaModificacion = '2026-07-29T10:00:01.000Z' }],
  ['updateNota reescribe updatedAt', n => { n.updatedAt = '2026-07-30T00:00:00.000Z' }],
  ['el versionado mueve metadata.version', n => { n.metadata.version = 7 }],
  ['cancelar la nota es una transición legítima', n => { n.estado = 'cancelada'; n.metadata.estado = 'cancelada' }],
  ['normNota sobrescribe el id de nivel superior con el doc.id', n => { n.id = 'otro-doc-id-de-firestore' }],
]

describe('E0-12 · los cambios legítimos NO disparan la alarma roja', () => {
  it.each(CAMBIOS_LEGITIMOS)('%s → sigue "verificada"', async (_caso, cambio) => {
    const firmada = await sellar(notaV3Completa())
    expect(await verificarIntegridadEstado(mutar(firmada, cambio))).toBe('verificada')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Round-trip completo simulado (el modo de falla grave: falso "alterada")
// ─────────────────────────────────────────────────────────────────────────────

/** Baraja las llaves de todo objeto en profundidad: lo que hace Firestore al releer. */
function barajarLlaves(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(barajarLlaves)
  if (x && typeof x === 'object') {
    const src = x as Record<string, unknown>
    const llaves = Object.keys(src).reverse()   // determinista, pero distinto orden
    const out: Record<string, unknown> = {}
    for (const k of llaves) out[k] = barajarLlaves(src[k])
    return out
  }
  return x
}

/** Defaults defensivos de `normNota` (firestore.ts) al leer el documento. */
function normNotaSimulada(raw: Record<string, unknown>, docId: string): NotaMedica {
  const n = raw as unknown as Partial<NotaMedica>
  return {
    ...(raw as unknown as NotaMedica),
    id: docId,
    diagnosticos: Array.isArray(n.diagnosticos) ? n.diagnosticos : [],
    medicamentos: Array.isArray(n.medicamentos) ? n.medicamentos : [],
    alergias: Array.isArray(n.alergias) ? n.alergias : [],
    secciones: Array.isArray(n.secciones) ? n.secciones : [],
  }
}

describe('E0-12 · viaje completo a Firestore y de vuelta', () => {
  it('sellar → stripUndefined → barajar llaves → normNota → mutaciones post-hash = "verificada"', async () => {
    const firmada = await sellar(notaV3Completa())
    // Las 5 mutaciones que ocurren DESPUÉS de calcular el hash, todas juntas.
    const conFirma = mutar(firmada, (n: Libre) => {
      n.firma = { nombreMedico: 'Dra. Ficticia', cedulaProfesional: '00000000', especialidad: 'Medicina interna', timestamp: '2026-07-29T10:00:01.000Z', hashFirma: 'ff00' }
      n.metadata.fechaModificacion = '2026-07-29T10:00:01.000Z'
      n.updatedAt = '2026-07-30T00:00:00.000Z'
      n.metadata.version = 2
      n.id = ''
    })
    const ida = stripUndefined(conFirma)
    const vuelta = normNotaSimulada(barajarLlaves(ida) as Record<string, unknown>, 'doc-id-real-de-firestore')
    expect(await verificarIntegridadEstado(vuelta)).toBe('verificada')
  })

  it('una nota SIN los campos opcionales también round-trippea sin falso "alterada"', async () => {
    const minima = notaV3Completa()
    // El caso real más común: consulta sin preop, sin hospital, sin dictado.
    const podada = { ...minima } as Libre
    for (const k of ['resumenEjecutivo', 'signosVitales', 'estudiosOrden', 'internamientoId', 'hospital', 'infectologia', 'preop', 'iaAuditoria', 'transcripcionCruda', 'dialogoDiarizado']) {
      podada[k] = undefined
    }
    const firmada = await sellar(podada as NotaMedica)
    const vuelta = normNotaSimulada(barajarLlaves(stripUndefined(firmada)) as Record<string, unknown>, 'doc-id')
    expect(await verificarIntegridadEstado(vuelta)).toBe('verificada')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5-9 · Compatibilidad de versiones (el plan de migración, en tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('E0-12 · migración: cada nota se verifica con SU versión de sello', () => {
  it('una nota v2 sigue "verificada" — NO se degrada a "legado" al subir HASH_VERSION', async () => {
    const v2 = await sellar(notaV3Completa(), 2)
    expect(v2.metadata.hashVersion).toBe(2)
    expect(await verificarIntegridadEstado(v2)).toBe('verificada')
  })

  it('vector GOLDEN de v2: congela el algoritmo legado byte por byte', async () => {
    // Calculado con el código de integrity.ts ANTES de esta unidad, sobre la
    // fixture de integrity.test.ts. Si alguien edita canonicoV2, este test cae y
    // con él se sabría que todo el histórico firmado dejó de verificarse.
    const legada = {
      tipo: 'valoracion_inmuno',
      pacienteId: 'p1',
      fechaConsulta: '2026-07-04T10:00:00.000Z',
      metadata: { id: 'n1', medicoId: 'm1', hashIntegridad: '', hashVersion: 2 },
      secciones: [{ key: 'motivoHuesped', label: 'Motivo', value: 'SOT renal' }],
      diagnosticos: [{ descripcion: 'Inmunocompromiso', tipo: 'definitivo', estado: 'activo', codigoCIE10: 'Z94' }],
      medicamentos: [{ nombre: 'TMP-SMX', dosis: '', via: 'oral', frecuencia: '', duracion: '', indicacion: 'PJP' }],
      alergias: [],
      signosVitales: { fc: 80, ta: '120/80' },
    } as unknown as NotaMedica
    expect(await generarHashIntegridad(legada, 2))
      .toBe('939119bcc0b4738acde02fdb9ce8740ecdafbb45b604c649c270b9dfde029b8d')
  })

  it('DEGRADACIÓN: a un sello v3 se le baja hashVersion a 2 → "alterada"', async () => {
    const v3 = await sellar(notaV3Completa(), 3)
    const degradada = { ...v3, metadata: { ...v3.metadata, hashVersion: 2 } }
    expect(await verificarIntegridadEstado(degradada)).toBe('alterada')
  })

  it('versión FUTURA desconocida → "legado" (aviso neutro), no alarma roja', async () => {
    const v3 = await sellar(notaV3Completa())
    const futura = { ...v3, metadata: { ...v3.metadata, hashVersion: 99 } }
    expect(await verificarIntegridadEstado(futura)).toBe('legado')
  })

  it('v1 / hashVersion ausente sigue "legado", y sin hash sigue "sin-sello"', async () => {
    const base = notaV3Completa()
    const v1 = { ...base, metadata: { ...base.metadata, hashIntegridad: 'loquesea', hashVersion: undefined } }
    expect(await verificarIntegridadEstado(v1)).toBe('legado')
    const uno = { ...base, metadata: { ...base.metadata, hashIntegridad: 'loquesea', hashVersion: 1 } }
    expect(await verificarIntegridadEstado(uno)).toBe('legado')
    const sinSello = { ...base, metadata: { ...base.metadata, hashIntegridad: '' } }
    expect(await verificarIntegridadEstado(sinSello)).toBe('sin-sello')
  })

  it('las notas NUEVAS nacen con el sello completo (HASH_VERSION = 3)', () => {
    expect(HASH_VERSION).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10 · Trinquete de cobertura: ningún campo firmable puede quedar sin clasificar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estos dos Records son el trinquete: si alguien AÑADE un campo a `NotaMedica` o a
 * `MetadataNOM024`, `npx tsc --noEmit` falla aquí por propiedad faltante, y el
 * assert de abajo obliga a clasificarlo como sellado o no-sellado con su razón.
 * Es la garantía de que no vuelve a pasar lo de `preop`: nacer fuera del sello.
 */
const LLAVES_NOTA: Record<keyof NotaMedica, true> = {
  id: true, clinicId: true, pacienteId: true, pacienteNombre: true, tipo: true,
  metadata: true, resumenEjecutivo: true, secciones: true, signosVitales: true,
  diagnosticos: true, medicamentos: true, alergias: true, estudiosOrden: true,
  internamientoId: true, hospital: true, infectologia: true, preop: true,
  iaAuditoria: true, transcripcionCruda: true, transcripcionMotor: true,
  dialogoDiarizado: true, palabrasAVerificar: true, firma: true,
  estado: true, fechaConsulta: true, createdAt: true, updatedAt: true, creadoPor: true,
}

const LLAVES_METADATA: Record<keyof MetadataNOM024, true> = {
  id: true, tipoNota: true, clinicId: true, pacienteId: true, medicoId: true,
  cedulaProfesional: true, especialidad: true, establecimiento: true,
  fechaCreacion: true, fechaModificacion: true, hashIntegridad: true,
  hashVersion: true, version: true, estado: true, fuenteGeneracion: true,
}

describe('E0-12 · trinquete de cobertura del sello v3', () => {
  const clasificados = new Set<string>([
    ...CAMPOS_SELLADOS_V3,
    ...CAMPOS_NO_SELLADOS_V3.map(c => c.campo),
  ])

  it('todo campo de NotaMedica está clasificado (sellado o excluido con razón)', () => {
    const sinClasificar = Object.keys(LLAVES_NOTA).filter(k => !clasificados.has(k))
    expect(sinClasificar).toEqual([])
  })

  it('todo campo de MetadataNOM024 está clasificado', () => {
    const sinClasificar = Object.keys(LLAVES_METADATA)
      .map(k => `metadata.${k}`)
      .filter(k => !clasificados.has(k))
    expect(sinClasificar).toEqual([])
  })

  it('la clasificación no inventa campos que el tipo no tiene', () => {
    const existentes = new Set<string>([
      ...Object.keys(LLAVES_NOTA),
      ...Object.keys(LLAVES_METADATA).map(k => `metadata.${k}`),
    ])
    expect([...clasificados].filter(c => !existentes.has(c))).toEqual([])
  })

  it('ningún campo está en las dos listas a la vez', () => {
    const sellados = new Set(CAMPOS_SELLADOS_V3)
    expect(CAMPOS_NO_SELLADOS_V3.filter(c => sellados.has(c.campo)).map(c => c.campo)).toEqual([])
  })

  it('toda exclusión trae una razón escrita y no trivial', () => {
    for (const { campo, razon } of CAMPOS_NO_SELLADOS_V3) {
      expect(razon.trim().length, `falta la razón de ${campo}`).toBeGreaterThan(30)
    }
  })

  it('la fixture puebla TODOS los campos del tipo (si no, los tests 1-4 no prueban lo que dicen)', () => {
    const n = notaV3Completa() as unknown as Record<string, unknown>
    // `firma` es el único ausente a propósito: se adjunta después del hash.
    const faltantes = Object.keys(LLAVES_NOTA).filter(k => k !== 'firma' && n[k] === undefined)
    expect(faltantes).toEqual([])
    const meta = n.metadata as Record<string, unknown>
    // `hashVersion`/`hashIntegridad` los pone el sellado, no la fixture.
    const faltantesMeta = Object.keys(LLAVES_METADATA)
      .filter(k => k !== 'hashVersion' && meta[k] === undefined)
    expect(faltantesMeta).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11 · Cobertura declarada por versión (lo que la pantalla puede DECIR)
// ─────────────────────────────────────────────────────────────────────────────

describe('E0-12 · COBERTURA_SELLO dice la verdad de cada versión', () => {
  it('v3 declara lo que NO cubre, en vez de decir que lo cubre todo', () => {
    /**
     * ── ESTA PRUEBA CERTIFICABA UNA AFIRMACIÓN FALSA (6-ago-2026, REG-199) ──
     *
     * Exigía `noCubre: []`, es decir: obligaba a que v3 declarara cubrirlo todo.
     * Y el mismo módulo documenta, en `CAMPOS_NO_SELLADOS_V3`, que **no lo
     * cubre**: `transcripcionMotor` —el material de origen del que se
     * re-proyecta la nota— queda fuera a propósito, porque sellarlo cambiaría
     * el hash de todo lo ya firmado y lo marcaría «alterada» (REG-060).
     *
     * La decisión de no sellarlo es correcta y se mantiene. Lo que no se
     * sostiene es contarla hacia dentro y ocultarla hacia fuera: al médico se
     * le decía «cubre todo». Una afirmación de integridad más ancha que su
     * alcance real es peor que no afirmar nada, porque se confía en ella.
     */
    expect(COBERTURA_SELLO[3].cubre).toBe(CAMPOS_SELLADOS_V3)
    expect(COBERTURA_SELLO[3].noCubre).toContain('transcripcionMotor')
  })

  it('y la cobertura se DERIVA de la lista de exclusiones, no se escribe aparte', () => {
    // Dos listas que deben decir lo mismo acaban diciendo cosas distintas: es
    // lo que pasó aquí, y lo que costó REG-177 con los huecos.
    expect(COBERTURA_SELLO[3].noCubre).toEqual(CAMPOS_NO_SELLADOS_V3.map(x => x.campo))
  })

  it('cada exclusión tiene una etiqueta legible para el médico', () => {
    // El nombre técnico no le dice nada a quien lee el sello en pantalla.
    expect(COBERTURA_SELLO[3].noCubreEtiquetas).toContain('transcripción de origen del dictado')
  })

  it('v2 declara los huecos que nombra el backlog', () => {
    for (const campo of ['preop', 'hospital', 'infectologia', 'iaAuditoria']) {
      expect(COBERTURA_SELLO[2].noCubre).toContain(campo)
    }
    expect(COBERTURA_SELLO[2].noCubreEtiquetas.length).toBeGreaterThan(0)
  })

  it('detalle de una nota v3: verificada, y con sus huecos dichos', async () => {
    const v3 = await sellar(notaV3Completa())
    const d = await verificarIntegridadDetalle(v3)
    expect(d.estado).toBe('verificada')
    expect(d.version).toBe(3)
    /**
     * `cubreTodo` ya no significa «es la última versión» sino «no queda nada
     * fuera». Cuando v4 selle también el origen, pasará a `true` porque la
     * lista de exclusiones quedará vacía — no porque alguien se acuerde de
     * cambiarlo a mano.
     */
    expect(d.cubreTodo).toBe(false)
    expect(d.noCubre).toContain('transcripcionMotor')
  })

  it('detalle de una nota v2: verificada, pero cubreTodo = false y con huecos declarados', async () => {
    const v2 = await sellar(notaV3Completa(), 2)
    const d = await verificarIntegridadDetalle(v2)
    expect(d.estado).toBe('verificada')
    expect(d.version).toBe(2)
    expect(d.cubreTodo).toBe(false)
    expect(d.noCubre).toContain('preop')
    expect(d.noCubreEtiquetas).toContain('valoración preoperatoria')
  })

  it('detalle de una nota sin sello: sin versión y sin cobertura que declarar', async () => {
    const base = notaV3Completa()
    const d = await verificarIntegridadDetalle({ ...base, metadata: { ...base.metadata, hashIntegridad: '' } })
    expect(d).toMatchObject({ estado: 'sin-sello', version: undefined, cubreTodo: false, noCubre: [] })
  })
})

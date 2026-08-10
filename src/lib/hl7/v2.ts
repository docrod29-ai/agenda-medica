/**
 * Parser HL7 v2 (ORU^R01 resultados de laboratorio · ADT admisiones) + puente a
 * FHIR — interoperabilidad. Es el formato que hablan los LIS y sistemas hospitalarios.
 *
 * PURO (sin red/DB): parsea el mensaje crudo y normaliza. Un endpoint delgado lo
 * expone como "convertidor" v2→FHIR. No inventa: solo mapea lo que trae el mensaje.
 */

export interface SegmentoHL7 { tipo: string; campos: string[] }

/** Divide un mensaje HL7 v2 en segmentos y campos (separadores estándar | ^). */
export function parsearHL7(mensaje: string): SegmentoHL7[] {
  return (mensaje || '')
    .split(/\r\n|\r|\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(linea => {
      const campos = linea.split('|')
      return { tipo: campos[0] ?? '', campos }
    })
}

/** Componentes de un campo (separados por ^). */
export function componentes(campo: string | undefined): string[] {
  return (campo ?? '').split('^')
}

export interface ResultadoLab {
  codigo: string        // ej. LOINC
  sistema?: string      // ej. LN (LOINC)
  nombre: string        // nombre del analito
  valor: string
  unidad?: string
  rango?: string        // rango de referencia
  flag?: string         // H/L/HH/LL/N/A (anormal)
  /**
   * `OBX-14` — cuándo se OBSERVÓ, según el aparato que lo midió.
   *
   * Hacía falta para el adaptador de dispositivos: un mensaje que llega con
   * retraso escribiría signos «de ahora» que son de hace dos horas, y la gráfica
   * de tendencia mentiría. Ver `lib/dispositivos/vitales-hl7.ts`.
   */
  medidoEn?: string
}

export interface OruParseado {
  paciente: { id?: string; nombre?: string }
  resultados: ResultadoLab[]
  mensajeControlId?: string
}

/** Extrae paciente + resultados (OBX) de un mensaje ORU^R01. */
export function parsearORU(mensaje: string): OruParseado {
  const segs = parsearHL7(mensaje)
  const msh = segs.find(s => s.tipo === 'MSH')
  const pid = segs.find(s => s.tipo === 'PID')
  const nombrePid = componentes(pid?.campos[5]) // apellido^nombre
  const resultados: ResultadoLab[] = segs
    .filter(s => s.tipo === 'OBX')
    .map(obx => {
      const idc = componentes(obx.campos[3]) // codigo^nombre^sistema
      return {
        codigo: idc[0] ?? '',
        nombre: idc[1] ?? '',
        sistema: idc[2] || undefined,
        valor: (obx.campos[5] ?? '').trim(),
        unidad: componentes(obx.campos[6])[0] || undefined,
        rango: (obx.campos[7] ?? '') || undefined,
        flag: (obx.campos[8] ?? '') || undefined,
        medidoEn: (obx.campos[13] ?? '') || undefined,
      }
    })
    .filter(r => r.codigo || r.nombre)
  return {
    paciente: {
      id: componentes(pid?.campos[3])[0] || undefined,
      nombre: [nombrePid[1], nombrePid[0]].filter(Boolean).join(' ') || undefined,
    },
    resultados,
    mensajeControlId: msh?.campos[9] || undefined,
  }
}

export interface AdtParseado {
  tipoEvento?: string   // ej. A01 (admisión), A03 (alta)
  paciente: { id?: string; nombre?: string; sexo?: string; fechaNac?: string }
  ubicacion?: string
}

/** Extrae la info de admisión de un mensaje ADT (PID + PV1). */
export function parsearADT(mensaje: string): AdtParseado {
  const segs = parsearHL7(mensaje)
  const msh = segs.find(s => s.tipo === 'MSH')
  const pid = segs.find(s => s.tipo === 'PID')
  const pv1 = segs.find(s => s.tipo === 'PV1')
  const nombre = componentes(pid?.campos[5])
  const tipoEvento = componentes(msh?.campos[8])[1] // MSH-9 = messageType^triggerEvent
  return {
    tipoEvento: tipoEvento || undefined,
    paciente: {
      id: componentes(pid?.campos[3])[0] || undefined,
      nombre: [nombre[1], nombre[0]].filter(Boolean).join(' ') || undefined,
      sexo: pid?.campos[8] || undefined,
      fechaNac: pid?.campos[7] || undefined,
    },
    ubicacion: componentes(pv1?.campos[3]).filter(Boolean).join('-') || undefined,
  }
}

/** Puente: resultados ORU → Observation FHIR R4 (usa LOINC si el sistema es LN). */
export function oruAFHIR(oru: OruParseado, patientRef = 'Patient/desconocido'): Record<string, unknown>[] {
  return oru.resultados.map((r, i) => {
    const esLoinc = (r.sistema ?? '').toUpperCase().startsWith('LN')
    const valorNum = Number(r.valor.replace(',', '.'))
    const value = Number.isFinite(valorNum) && r.valor.trim() !== ''
      ? { valueQuantity: { value: valorNum, ...(r.unidad ? { unit: r.unidad } : {}) } }
      : { valueString: r.valor }
    return {
      resourceType: 'Observation',
      id: `oru-${r.codigo || i}`,
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
      code: {
        text: r.nombre || r.codigo,
        coding: r.codigo ? [{ system: esLoinc ? 'http://loinc.org' : 'urn:hl7:local', code: r.codigo, display: r.nombre }] : undefined,
      },
      subject: { reference: patientRef },
      ...value,
      ...(r.rango ? { referenceRange: [{ text: r.rango }] } : {}),
      ...(r.flag && r.flag !== 'N' ? { interpretation: [{ text: r.flag }] } : {}),
    }
  })
}

/** ACK de aplicación (AA = aceptado). Para responder al LIS. */
export function construirACK(mensajeControlId: string, codigo: 'AA' | 'AE' | 'AR' = 'AA'): string {
  const cid = mensajeControlId || 'MSGID'
  return [
    `MSH|^~\\&|AUSCULTA|CLINICA|LIS|LAB|||ACK|${cid}|P|2.5`,
    `MSA|${codigo}|${cid}`,
  ].join('\r')
}

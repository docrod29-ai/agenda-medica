/**
 * SIEMBRA ADICIONAL PARA EL VIDEO DE DEMOSTRACIÓN — sobre el consultorio sintético.
 *
 * `scripts/design/sembrar-emulador.mjs` deja el consultorio del arnés visual
 * con una nota firmada de texto «Contenido sintético de medición» y un paquete
 * de visita con «Medicamento sintético A». Eso sirve para medir pantallas, no
 * para enseñar el producto: en un video, esas cadenas parecen un defecto.
 *
 * Esto NO reescribe aquel sembrador: lo COMPLETA para la paciente ficticia
 * Rosalía Mendieta Cuevas (pac-001):
 *   · dos notas de seguimiento previas, selladas con el hash REAL del producto
 *     (`generarHashIntegridad`, versión vigente), para que el expediente y el
 *     visor las pinten «verificada» y no «sin sello»;
 *   · dos paneles de laboratorio, para que exista una trayectoria que graficar;
 *   · el paquete de visita liberado de la última consulta, con texto legible.
 *
 * Cero pacientes reales. Los valores de laboratorio son de una persona que no
 * existe y no son ninguna referencia: están aquí para que la gráfica tenga
 * dos puntos, no para decir qué es normal.
 *
 * Uso (con los emuladores levantados y la siembra base hecha):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/demo-video/sembrar-extra.ts
 */
import { generarHashIntegridad, generarHashFirma, HASH_VERSION } from '../../src/lib/expediente/integrity'
import type { NotaMedica } from '../../src/types/expediente'

const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const PROYECTO = process.env.GOOGLE_CLOUD_PROJECT || 'demo-nexusmed-v10'
const CLINICA = 'consultorio-demo-v10'
const PAC = 'pac-001'
const NOMBRE = 'Rosalía Mendieta Cuevas'
const MEDICA = 'Dra. Ximena Alcántara Robledo'
const CEDULA = '0000000'
const ESPECIALIDAD = 'Medicina Interna e Infectología'
const ESTABLECIMIENTO = 'Consultorio de Medicina Interna'

if (!HOST.startsWith('127.0.0.1') && !HOST.startsWith('localhost')) {
  throw new Error('Esto sólo corre contra el emulador local.')
}
if (!PROYECTO.startsWith('demo-')) throw new Error('El proyecto tiene que empezar por demo-.')

// ── REST tipado de Firestore (igual que el sembrador base) ───────────────────
type V = { nullValue: null } | { booleanValue: boolean } | { integerValue: string } | { doubleValue: number } | { stringValue: string } | { arrayValue: { values: V[] } } | { mapValue: { fields: Record<string, V> } }
function valor(v: unknown): V {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } }
  if (typeof v === 'object') return { mapValue: { fields: campos(v as Record<string, unknown>) } }
  throw new Error(`Tipo sin traducir: ${typeof v}`)
}
function campos(obj: Record<string, unknown>) {
  const out: Record<string, V> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = valor(v)
  return out
}
const ADMIN = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }
const base = `http://${HOST}/v1/projects/${PROYECTO}/databases/(default)/documents`
async function escribir(ruta: string, datos: Record<string, unknown>, { parcial = false } = {}) {
  // Sin `updateMask`, PATCH REEMPLAZA el documento entero: `parcial` protege lo que ya había.
  const mascara = parcial ? '?' + Object.keys(datos).map(k => `updateMask.fieldPaths=${k}`).join('&') : ''
  const r = await fetch(`${base}/${ruta}${mascara}`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields: campos(datos) }) })
  if (!r.ok) throw new Error(`PATCH ${ruta}: ${r.status} ${await r.text()}`)
}
async function borrar(ruta: string) {
  const r = await fetch(`${base}/${ruta}`, { method: 'DELETE', headers: ADMIN })
  if (!r.ok && r.status !== 404) throw new Error(`DELETE ${ruta}: ${r.status}`)
}
async function leer(ruta: string) {
  const r = await fetch(`${base}/${ruta}`, { headers: ADMIN })
  return r.ok ? r.json() : null
}

// ── Fechas: relativas al día del consultorio ─────────────────────────────────
const TZ = 'America/Mexico_City'
const hoy = new Date()
const enZona = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const haceDias = (n: number) => { const d = new Date(hoy); d.setUTCDate(d.getUTCDate() - n); return enZona(d) }
const iso = (dia: string, hora = '10:15') => new Date(`${dia}T${hora}:00-06:00`).toISOString()

async function notaSellada(n: {
  id: string; dia: string; medicoId: string
  resumen: string; secciones: { key: string; label: string; value: string }[]
  signos: Record<string, number | string>; medicamentos: Record<string, unknown>[]
  diagnosticos: Record<string, unknown>[]; transcripcion: string
}): Promise<Record<string, unknown>> {
  const creada = iso(n.dia)
  const firmada = iso(n.dia, '10:52')
  const nota = {
    id: n.id,
    clinicId: CLINICA,
    pacienteId: PAC,
    pacienteNombre: NOMBRE,
    tipo: 'seguimiento',
    metadata: {
      id: n.id, tipoNota: 'seguimiento', clinicId: CLINICA, pacienteId: PAC, medicoId: n.medicoId,
      cedulaProfesional: CEDULA, especialidad: ESPECIALIDAD, establecimiento: ESTABLECIMIENTO,
      fechaCreacion: creada, fechaModificacion: firmada, hashIntegridad: '', hashVersion: HASH_VERSION,
      version: 1, estado: 'firmada', fuenteGeneracion: 'ia_dictado',
    },
    resumenEjecutivo: n.resumen,
    secciones: n.secciones,
    signosVitales: n.signos,
    diagnosticos: n.diagnosticos,
    medicamentos: n.medicamentos,
    alergias: [
      { alergeno: 'Penicilina', tipo: 'medicamento', reaccion: 'anafilaxia', severidad: 'anafilaxia', confirmada: true },
      { alergeno: 'Sulfas', tipo: 'medicamento', severidad: 'moderada', confirmada: true },
      { alergeno: 'AINEs', tipo: 'medicamento', confirmada: true },
    ],
    transcripcionCruda: n.transcripcion,
    transcripcionMotor: n.transcripcion,
    createdAt: creada,
    creadoPor: n.medicoId,
  } as unknown as NotaMedica
  const hash = await generarHashIntegridad(nota)
  const hashFirma = await generarHashFirma(n.id, n.medicoId, firmada)
  return {
    ...(nota as unknown as Record<string, unknown>),
    metadata: { ...(nota.metadata as unknown as Record<string, unknown>), hashIntegridad: hash },
    estado: 'firmada',
    fechaConsulta: n.dia,
    firmadaEn: firmada,
    medicoNombre: MEDICA,
    firma: { nombreMedico: MEDICA, cedulaProfesional: CEDULA, especialidad: ESPECIALIDAD, timestamp: firmada, hashFirma },
    updatedAt: firmada,
  }
}

async function main() {
  const clinica = await leer(`clinics/${CLINICA}`)
  const medicoId: string = clinica?.fields?.ownerId?.stringValue
  if (!medicoId) throw new Error('Primero corre scripts/design/sembrar-emulador.mjs')

  const d180 = haceDias(182)
  const d90 = haceDias(91)

  // ── Nota de hace seis meses ────────────────────────────────────────────────
  const notaA = await notaSellada({
    id: 'nota-demo-000', dia: d180, medicoId,
    resumen: 'Mujer de 68 años con diabetes tipo 2 y nefropatía incipiente; control glucémico referido irregular; se ajusta plan y se solicitan estudios.',
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo (S)', value: 'Refiere glucemias capilares matutinas variables, con cifras altas después de la cena. Apego parcial a metformina: omite la dosis nocturna dos o tres veces por semana. Niega poliuria, polidipsia y pérdida de peso. Niega fiebre.' },
      { key: 'objetivo', label: 'Objetivo (O)', value: 'Signos vitales registrados en consulta. Sin edema de miembros inferiores. Pulsos pedios presentes y simétricos. Sensibilidad plantar conservada al monofilamento.' },
      { key: 'evaluacion', label: 'Evaluación (A)', value: 'Diabetes mellitus tipo 2 con control glucémico subóptimo por apego irregular. Nefropatía diabética incipiente conocida, sin datos clínicos de progresión.' },
      { key: 'plan', label: 'Plan (P)', value: 'Reforzar apego: metformina 850 mg vía oral cada 12 horas con alimentos. Solicitar hemoglobina glucosilada, glucosa, creatinina y urea. Cita de seguimiento en tres meses con resultados.' },
    ],
    signos: { ta: '134/84', fc: 78, fr: 17, temperatura: 36.5, spo2: 96, peso: 71, talla: 156 },
    diagnosticos: [
      { descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11', tipo: 'definitivo', estado: 'cronico' },
      { descripcion: 'Nefropatía diabética incipiente', codigoCIE10: 'E11.2', tipo: 'definitivo', estado: 'en_seguimiento' },
    ],
    medicamentos: [
      { nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 horas', duracion: '3 meses', indicacion: 'Diabetes mellitus tipo 2. Con alimentos.', estado: 'activa', procedenciaClinica: 'se_prescribe_hoy' },
    ],
    transcripcion: 'Médico: ¿Cómo ha estado de la glucosa? Paciente: En las mañanas variable, doctora, y en la noche se me sube. A veces se me olvida la pastilla de la noche. Médico: Vamos a reforzar la metformina ochocientos cincuenta cada doce horas con alimentos y le pido hemoglobina glucosilada, glucosa, creatinina y urea.',
  })
  await escribir(`clinics/${CLINICA}/patients/${PAC}/notas/nota-demo-000`, notaA)

  // ── Nota de hace tres meses (sustituye la de texto sintético) ──────────────
  const notaB = await notaSellada({
    id: 'nota-demo-001', dia: d90, medicoId,
    resumen: 'Mujer de 68 años con diabetes tipo 2 y nefropatía incipiente; mejora del apego; laboratorios revisados; continúa metformina.',
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo (S)', value: 'Refiere mejor apego a metformina desde la consulta anterior. Glucemias capilares matutinas más estables según su libreta. Niega hipoglucemias, fiebre y ardor al orinar.' },
      { key: 'objetivo', label: 'Objetivo (O)', value: 'Signos vitales registrados en consulta. Laboratorios recientes revisados con la paciente. Sin edema. Exploración de pies sin lesiones.' },
      { key: 'evaluacion', label: 'Evaluación (A)', value: 'Diabetes mellitus tipo 2 con mejoría del control glucémico. Nefropatía diabética incipiente, función renal estable respecto al estudio previo.' },
      { key: 'plan', label: 'Plan (P)', value: 'Continuar metformina 850 mg vía oral cada 12 horas. Repetir hemoglobina glucosilada y perfil renal en tres meses. Cita de seguimiento en tres meses.' },
    ],
    signos: { ta: '130/82', fc: 76, fr: 16, temperatura: 36.6, spo2: 97, peso: 70, talla: 156 },
    diagnosticos: [
      { descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11', tipo: 'definitivo', estado: 'cronico' },
      { descripcion: 'Nefropatía diabética incipiente', codigoCIE10: 'E11.2', tipo: 'definitivo', estado: 'en_seguimiento' },
    ],
    medicamentos: [
      { nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 horas', duracion: '3 meses', indicacion: 'Diabetes mellitus tipo 2. Con alimentos.', estado: 'activa', procedenciaClinica: 'se_prescribe_hoy' },
    ],
    transcripcion: 'Médico: ¿Cómo le fue con la metformina? Paciente: Mejor, doctora, ya no se me olvida. Médico: Sus laboratorios salieron estables. Seguimos igual, metformina ochocientos cincuenta cada doce horas, y repetimos la glucosilada y el perfil renal en tres meses.',
  })
  await escribir(`clinics/${CLINICA}/patients/${PAC}/notas/nota-demo-001`, notaB)

  // ── Laboratorios: dos paneles, para que haya trayectoria ───────────────────
  const panel = (id: string, dia: string, v: { glucosa: number; hba1c: number; creatinina: number; urea: number }) => ({
    fecha: dia,
    fuente: 'pdf',
    createdAt: iso(dia, '08:40'),
    creadoPor: medicoId,
    pacienteId: PAC,
    clinicId: CLINICA,
    sujeto: { veredicto: 'coincide', confirmadoPorMedico: true, verificadoEn: iso(dia, '08:41') },
    resultados: [
      { clave: 'glucosa', etiqueta: 'Glucosa', valor: v.glucosa, unidad: 'mg/dL', referencia: '70-100', critico: false, graficable: true },
      { clave: 'hba1c', etiqueta: 'Hemoglobina glucosilada (HbA1c)', valor: v.hba1c, unidad: '%', referencia: '4-5.6', critico: false, graficable: true },
      { clave: 'creatinina', etiqueta: 'Creatinina', valor: v.creatinina, unidad: 'mg/dL', referencia: '0.6-1.1', critico: false, graficable: true },
      { clave: 'urea', etiqueta: 'Urea', valor: v.urea, unidad: 'mg/dL', referencia: '15-45', critico: false, graficable: true },
    ],
    noReconocidas: [],
  })
  await escribir(`clinics/${CLINICA}/patients/${PAC}/laboratorios/lab-demo-001`, panel('lab-demo-001', haceDias(184), { glucosa: 148, hba1c: 7.9, creatinina: 1.1, urea: 39 }))
  await escribir(`clinics/${CLINICA}/patients/${PAC}/laboratorios/lab-demo-002`, panel('lab-demo-002', haceDias(93), { glucosa: 131, hba1c: 7.3, creatinina: 1.2, urea: 41 }))

  // ── Paquete de visita liberado de la última consulta (texto legible) ───────
  await escribir(`clinics/${CLINICA}/patients/${PAC}/paquetes_visita/paq-demo-001`, {
    notaId: 'nota-demo-001',
    estado: 'RELEASED',
    approvedBy: medicoId,
    approvedAt: new Date(iso(d90, '11:05')).getTime(),
    version: 1,
    fechaConsulta: iso(d90, '10:15'),
    encounterSummary: 'Revisamos tu control de la diabetes. Vas mejor desde la consulta pasada y tus estudios de riñón salieron estables.',
    medicationInstructions: [
      { nombre: 'Metformina 850 mg', instruccion: 'Una tableta cada 12 horas, con alimentos. No la suspendas por tu cuenta.' },
    ],
    medicationChanges: [{ nombre: 'Metformina', tipo: 'sin-cambio' }],
    orders: ['Hemoglobina glucosilada y perfil renal en tres meses'],
    followUp: 'Cita de seguimiento en tres meses, con tus resultados.',
    warningSigns: ['Temblor, sudor frío o confusión (posible baja de azúcar)', 'Fiebre o ardor al orinar', 'Hinchazón nueva en pies o piernas'],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    alergias: 'Penicilina (anafilaxia), sulfas, AINEs',
    language: 'es-MX',
    prescriptor: { nombre: MEDICA, cedulaProfesional: CEDULA, especialidad: ESPECIALIDAD },
    clinicianContactRules: 'Si algo de esto empeora, comunícate con el consultorio antes de la cita.',
  })


  // ── Lo que el recetario necesita para salir completo ───────────────────────
  // `direccion` es el campo que lee la receta (el sembrador base escribe otro).
  await escribir(`clinics/${CLINICA}/config/main`, {
    direccion: 'Av. de los Sauces 214, Col. Jardines del Valle, Ciudad Demo, CP 00000',
    telefonoConsultorio: '5555000000',
  }, { parcial: true })
  // La médica como documento de `doctors`: el portal público y el asistente
  // listan médicos ACTIVOS de esa colección, y el sembrador base no la crea.
  await escribir(`clinics/${CLINICA}/doctors/medico-demo-001`, {
    nombre: MEDICA, especialidad: ESPECIALIDAD, cedulaProfesional: CEDULA, activo: true, uid: medicoId,
    email: 'demo@nexusmed.test', color: '#2AA5B5', createdAt: new Date().toISOString(),
  })
  // Firma manuscrita SINTÉTICA (un trazo SVG), en el subdocumento protegido y
  // atada al uid de la médica: sin ella el impreso sale «sin firma ni sello».
  const trazo = 'M6 44 C 18 10, 30 12, 36 30 S 52 58, 62 26 C 70 6, 86 8, 92 30 S 112 54, 126 22 C 134 6, 150 10, 158 32 M 166 26 c 10 -12, 22 -10, 30 4 M 40 50 c 40 -6, 90 -10, 150 -4'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 64"><path d="${trazo}" fill="none" stroke="#1b2a4a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  const firmaDataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
  await escribir(`clinics/${CLINICA}/config/firma`, {
    firmaImagenDataUrl: firmaDataUrl,
    firmaPorMedico: { [medicoId]: firmaDataUrl },
    actualizadoEn: new Date().toISOString(),
  })

  // ── Ficha de la paciente: edad y contacto coherentes con el diálogo ────────
  await escribir(`clinics/${CLINICA}/patients/${PAC}`, {
    nombre: NOMBRE, telefono: '5555010101', fechaNacimiento: '1958-03-14', sexo: 'Femenino',
    alergias: 'Penicilina (anafilaxia), sulfas, AINEs', seguroMedico: 'GNP Salud',
    notas: 'Diabetes tipo 2 desde 2011. Nefropatía incipiente.',
    email: 'rosalia.demo@example.com', edad: 68,
    updatedAt: new Date().toISOString(),
  }, { parcial: true })

  // Un paciente más en la lista de espera, para la escena del hueco liberado.
  await escribir(`clinics/${CLINICA}/waitlist/espera-demo-001`, {
    pacienteNombre: 'Fermín Olvera Rangel', pacienteTelefono: '5555010707', tipo: 'seguimiento',
    fechaDeseada: haceDias(0), rangoHorario: 'Tarde, después de las 16:00', prioridad: 2,
    notas: 'Prefiere martes o jueves.', estado: 'activo',
    createdAt: iso(haceDias(4), '12:00'), updatedAt: iso(haceDias(4), '12:00'),
  })

  await borrar(`clinics/${CLINICA}/patients/${PAC}/paquetes_visita/paq-sintetico-borrar`)
  console.log(`✓ Siembra extra lista sobre ${CLINICA}: 2 notas selladas (v${HASH_VERSION}), 2 laboratorios, 1 paquete liberado, 1 en lista de espera.`)
}

main().catch(e => { console.error('✗', e.message); process.exit(1) })

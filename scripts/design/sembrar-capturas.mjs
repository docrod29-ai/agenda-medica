/**
 * SIEMBRA SINTÉTICA PARA EL ARNÉS DE CAPTURAS V10 (§33, §39).
 *
 * Puebla los emuladores de Auth y Firestore con un consultorio sintético
 * completo para poder capturar el golden flow AUTENTICADO en un navegador
 * real. Todo aquí es inventado y determinista (regla `data-privacy.md`:
 * cero pacientes reales); el candado es el mismo de `emulator/entorno.ts`:
 * el proyecto empieza por `demo-`, con lo que el SDK se niega a hablar con
 * un proyecto real y no pide credenciales.
 *
 * Uso (emuladores ya levantados en 8080/9099):
 *   node scripts/design/sembrar-capturas.mjs
 */
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'demo-nexusmed-test'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error('El proyecto de siembra DEBE empezar por demo- (candado anti-producción)')
}

const app = initializeApp({ projectId: PROJECT_ID })
const auth = getAuth(app)
const db = getFirestore(app)

export const CUENTA = {
  email: 'medico@capturas.demo',
  password: 'captura-v10-demo',
  displayName: 'Dra. Elena Sandoval Rivas',
}

const CLINIC_ID = 'clinica-capturas-v10'
const hoy = new Date()
const yyyy = hoy.getFullYear()
const mm = String(hoy.getMonth() + 1).padStart(2, '0')
const dd = String(hoy.getDate()).padStart(2, '0')
const HOY = `${yyyy}-${mm}-${dd}`
const dia = (n) => {
  const d = new Date(hoy.getTime() + n * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ISO = new Date().toISOString()

async function main() {
  // ── Médico ────────────────────────────────────────────────────────────
  let user
  try {
    user = await auth.getUserByEmail(CUENTA.email)
  } catch {
    user = await auth.createUser({
      email: CUENTA.email,
      password: CUENTA.password,
      displayName: CUENTA.displayName,
      emailVerified: true,
    })
  }
  const uid = user.uid

  // ── Consultorio en prueba (14 días, como vende Practice) ─────────────
  const trialEnds = new Date(hoy.getTime() + 9 * 86400000)
  await db.doc(`clinics/${CLINIC_ID}`).set({
    nombreClinica: 'Consultorio de Medicina Interna Reforma',
    nombreMedico: CUENTA.displayName,
    plan: 'trial',
    status: 'trial',
    trialEndsAt: trialEnds.toISOString(),
    trialEndsAtMs: trialEnds.getTime(),
    createdAt: ISO,
  })
  await db.doc(`clinic_members/${uid}`).set({
    clinicId: CLINIC_ID,
    role: 'medico',
    displayName: CUENTA.displayName,
    createdAt: ISO,
  })

  // ── Pacientes sintéticos (edades y padecimientos plausibles, TODO inventado)
  const pacientes = [
    {
      id: 'pac-aurelio-dominguez',
      nombre: 'Aurelio Domínguez Peña',
      telefono: '+52 55 5555 0101',
      fechaNacimiento: '1954-03-18',
      edad: 72,
      sexo: 'Masculino',
      alergias: 'Penicilina (rash generalizado, 2019)',
      seguroMedico: 'GNP Gastos Médicos',
      tags: [],
      notas: 'DM2 de 15 años de evolución. HbA1c 8.2% (jun 2026).',
      ultimaCita: dia(-30),
      proximoSeguimiento: HOY,
    },
    {
      id: 'pac-refugio-alcantara',
      nombre: 'María del Refugio Alcántara Solís',
      telefono: '+52 55 5555 0102',
      fechaNacimiento: '1968-11-02',
      edad: 57,
      sexo: 'Femenino',
      alergias: '',
      seguroMedico: '',
      tags: [],
      notas: 'HAS en tratamiento. Última TA 138/86.',
      ultimaCita: dia(-90),
    },
    {
      id: 'pac-joaquin-esparza',
      nombre: 'Joaquín Esparza Villarreal',
      telefono: '+52 55 5555 0103',
      fechaNacimiento: '1990-07-25',
      edad: 36,
      sexo: 'Masculino',
      alergias: 'AINE (broncoespasmo)',
      seguroMedico: 'AXA',
      tags: [],
      notas: 'Fiebre de origen a estudiar; segunda valoración.',
      ultimaCita: dia(-7),
    },
    {
      id: 'pac-catalina-ibarra',
      nombre: 'Catalina Ibarra Fuentes',
      telefono: '+52 55 5555 0104',
      fechaNacimiento: '1947-01-30',
      edad: 79,
      sexo: 'Femenino',
      alergias: 'Sulfas',
      seguroMedico: 'IMSS + particular',
      tags: [],
      notas: 'EPOC GOLD II. Esquema de vacunación al corriente.',
      ultimaCita: dia(-14),
      proximoSeguimiento: dia(3),
    },
    {
      id: 'pac-ernesto-quiroga',
      nombre: 'Ernesto Quiroga Lomelí',
      telefono: '+52 55 5555 0105',
      fechaNacimiento: '1982-09-12',
      edad: 43,
      sexo: 'Masculino',
      alergias: '',
      seguroMedico: 'Metlife',
      tags: [],
      notas: 'Chequeo anual empresarial.',
    },
    {
      id: 'pac-luzmaria-cervantes',
      nombre: 'Luz María Cervantes Ochoa',
      telefono: '+52 55 5555 0106',
      fechaNacimiento: '1975-05-08',
      edad: 51,
      sexo: 'Femenino',
      alergias: 'Levofloxacino (tendinopatía)',
      seguroMedico: '',
      tags: [],
      notas: 'ITU de repetición; urocultivo pendiente de revisar.',
      ultimaCita: dia(-3),
    },
  ]
  for (const p of pacientes) {
    const { id, ...datos } = p
    await db.doc(`clinics/${CLINIC_ID}/patients/${id}`).set({
      ...datos,
      createdAt: ISO,
      updatedAt: ISO,
    })
  }

  // ── Citas de HOY (y una de mañana) con estados variados ──────────────
  const base = {
    duracion: 30,
    medicoNombre: CUENTA.displayName,
    medicoId: uid,
    confirmadoPaciente: false,
    recordatorio24hEnviado: false,
    recordatorioMismoDiaEnviado: false,
    consentimientoMensajes: true,
    createdAt: ISO,
    updatedAt: ISO,
    creadoPor: uid,
    updatedPor: uid,
  }
  const citas = [
    {
      id: 'cita-hoy-0900',
      pacienteId: 'pac-refugio-alcantara',
      pacienteNombre: 'María del Refugio Alcántara Solís',
      pacienteTelefono: '+52 55 5555 0102',
      fechaHora: `${HOY} 09:00`,
      tipo: 'seguimiento',
      motivo: 'Control de hipertensión arterial',
      estado: 'completada',
      origen: 'Manual',
      confirmadoPaciente: true,
    },
    {
      id: 'cita-hoy-0930',
      pacienteId: 'pac-luzmaria-cervantes',
      pacienteNombre: 'Luz María Cervantes Ochoa',
      pacienteTelefono: '+52 55 5555 0106',
      fechaHora: `${HOY} 09:30`,
      tipo: 'estudios',
      motivo: 'Revisión de urocultivo',
      estado: 'completada',
      origen: 'WhatsApp',
      confirmadoPaciente: true,
    },
    {
      id: 'cita-hoy-1030',
      pacienteId: 'pac-aurelio-dominguez',
      pacienteNombre: 'Aurelio Domínguez Peña',
      pacienteTelefono: '+52 55 5555 0101',
      fechaHora: `${HOY} 10:30`,
      tipo: 'seguimiento',
      motivo: 'Control de diabetes — revisar HbA1c y ajuste de metformina',
      estado: 'en-sala',
      origen: 'Manual',
      confirmadoPaciente: true,
    },
    {
      id: 'cita-hoy-1130',
      pacienteId: 'pac-joaquin-esparza',
      pacienteNombre: 'Joaquín Esparza Villarreal',
      pacienteTelefono: '+52 55 5555 0103',
      fechaHora: `${HOY} 11:30`,
      tipo: 'urgente',
      motivo: 'Fiebre persistente de 8 días — segunda valoración',
      estado: 'confirmada',
      origen: 'Teléfono',
      confirmadoPaciente: true,
    },
    {
      id: 'cita-hoy-1300',
      pacienteId: 'pac-ernesto-quiroga',
      pacienteNombre: 'Ernesto Quiroga Lomelí',
      pacienteTelefono: '+52 55 5555 0105',
      fechaHora: `${HOY} 13:00`,
      tipo: 'primera-vez',
      motivo: 'Chequeo anual empresarial',
      estado: 'pendiente-confirmar',
      origen: 'WhatsApp',
    },
    {
      id: 'cita-hoy-1700',
      pacienteId: 'pac-catalina-ibarra',
      pacienteNombre: 'Catalina Ibarra Fuentes',
      pacienteTelefono: '+52 55 5555 0104',
      fechaHora: `${HOY} 17:00`,
      tipo: 'teleconsulta',
      motivo: 'Seguimiento de EPOC — revisión de espirometría',
      estado: 'pendiente-confirmar',
      origen: 'Manual',
    },
    {
      id: 'cita-manana-1000',
      pacienteId: 'pac-catalina-ibarra',
      pacienteNombre: 'Catalina Ibarra Fuentes',
      pacienteTelefono: '+52 55 5555 0104',
      fechaHora: `${dia(1)} 10:00`,
      tipo: 'seguimiento',
      motivo: 'Resultados de laboratorio',
      estado: 'confirmada',
      origen: 'Manual',
      confirmadoPaciente: true,
    },
  ]
  for (const c of citas) {
    const { id, ...datos } = c
    await db.doc(`clinics/${CLINIC_ID}/appointments/${id}`).set({ ...base, ...datos })
  }

  // ── Tareas clínicas (cabos sueltos de consultas anteriores) ──────────
  // Fuente de la zona CONTINUITY de V15-TODAY-001 (ContinuidadPanel, la
  // misma tareasVivas() que ya lee /pendientes). Sin esto la zona no tiene
  // nada que pintar en el arnés de capturas: se comporta como si no hubiera
  // pendientes, y eso es exactamente lo que NO se quiere verificar.
  const diaISO = (n) => new Date(hoy.getTime() + n * 86400000).toISOString()
  const tareas = [
    {
      id: 'tarea-urocultivo-luzmaria',
      clinicId: CLINIC_ID,
      patientId: 'pac-luzmaria-cervantes',
      patientNombre: 'Luz María Cervantes Ochoa',
      tipo: 'resultado_por_revisar',
      titulo: 'Urocultivo — resultado disponible',
      detalle: 'ITU de repetición; revisar sensibilidad antes de renovar esquema.',
      prioridad: 'alta',
      estado: 'solicitada',
      creadaEn: diaISO(-2),
      venceEn: diaISO(-1), // ya venció: se ve el escalamiento real, no sólo la lista
      origen: 'laboratorio',
    },
    {
      id: 'tarea-seguimiento-catalina',
      clinicId: CLINIC_ID,
      patientId: 'pac-catalina-ibarra',
      patientNombre: 'Catalina Ibarra Fuentes',
      tipo: 'seguimiento',
      titulo: 'Seguimiento de EPOC — revisar espirometría',
      detalle: 'Control programado tras ajuste de esquema inhalado.',
      prioridad: 'normal',
      estado: 'solicitada',
      creadaEn: diaISO(-14),
      venceEn: diaISO(3),
      origen: 'nota',
    },
    {
      id: 'tarea-reconciliacion-aurelio',
      clinicId: CLINIC_ID,
      patientId: 'pac-aurelio-dominguez',
      patientNombre: 'Aurelio Domínguez Peña',
      tipo: 'reconciliacion_medicamento',
      titulo: 'Confirmar si la metformina sigue vigente',
      detalle: 'El paciente mencionó suspenderla; no coincide con la lista activa.',
      prioridad: 'critica',
      estado: 'solicitada',
      creadaEn: diaISO(-1),
      origen: 'nota',
    },
    /**
     * V15-RESULTS-CLOSURE-001 — dos tareas de resultado MÁS, con dueño y
     * estado distintos, para que `ProgresoResultado` (§9) tenga algo real que
     * enseñar en cada una de sus etapas alcanzables: sin la de aquí abajo,
     * 'tarea-urocultivo-luzmaria' es la única de tipo resultado y siempre se
     * ve en el mismo punto (sin dueño, recién solicitada).
     */
    {
      id: 'tarea-estudio-catalina',
      clinicId: CLINIC_ID,
      patientId: 'pac-catalina-ibarra',
      patientNombre: 'Catalina Ibarra Fuentes',
      tipo: 'estudio_pendiente',
      titulo: 'Espirometría de control — en proceso',
      detalle: 'Pedida para valorar respuesta al ajuste de esquema inhalado.',
      prioridad: 'normal',
      estado: 'en_curso',
      ownerUid: uid,
      ownerNombre: CUENTA.displayName,
      creadaEn: diaISO(-3),
      venceEn: diaISO(2),
      origen: 'nota',
    },
    {
      // 'cerrada' NO aparece en `tareasVivas()` (a propósito: es el worklist
      // de lo VIVO) — 'completada' sí, y es la única forma de ver en el
      // navegador real la etapa "Cerrado" como LA ACTUAL, con Revisión ya
      // hecha: el estudio se hizo, falta que alguien lo mire y decida.
      id: 'tarea-resultado-completado-aurelio',
      clinicId: CLINIC_ID,
      patientId: 'pac-aurelio-dominguez',
      patientNombre: 'Aurelio Domínguez Peña',
      tipo: 'resultado_por_revisar',
      titulo: 'Perfil lipídico — resultado listo',
      detalle: 'Llegó del laboratorio; falta que alguien lo revise y decida.',
      prioridad: 'normal',
      estado: 'completada',
      ownerUid: uid,
      ownerNombre: CUENTA.displayName,
      creadaEn: diaISO(-7),
      completadaEn: diaISO(-1),
      origen: 'laboratorio',
    },
    /**
     * V15-FOLLOWUP-WORK-001 (Fase 7, §10) — dos tareas MÁS, para que los
     * grupos "esperando al paciente" y "otros" de `estadoDeAccion` tengan
     * algo real que enseñar. Sin ellas, las cinco tareas de arriba sólo
     * cubren tres de los cinco grupos no-vencidos (las otras dos
     * escalan por crítica-sin-dueño o vencida, así que nunca llegan a
     * `resto`). Ninguna de las dos escala: prioridad no-crítica y sin
     * vencer.
     */
    {
      id: 'tarea-receta-luzmaria',
      clinicId: CLINIC_ID,
      patientId: 'pac-luzmaria-cervantes',
      patientNombre: 'Luz María Cervantes Ochoa',
      tipo: 'receta_por_entregar',
      titulo: 'Entregar receta (2 medicamentos)',
      detalle: 'La receta se generó en la consulta. Se cierra cuando el paciente la tiene.',
      prioridad: 'alta',
      estado: 'solicitada',
      creadaEn: diaISO(-1),
      venceEn: diaISO(4),
      origen: 'nota',
    },
    {
      id: 'tarea-otra-catalina',
      clinicId: CLINIC_ID,
      patientId: 'pac-catalina-ibarra',
      patientNombre: 'Catalina Ibarra Fuentes',
      tipo: 'otra',
      titulo: 'Llamar a laboratorio externo por resultado extraviado',
      detalle: 'El laboratorio reportó el estudio como perdido; hay que reprogramarlo.',
      prioridad: 'normal',
      estado: 'solicitada',
      ownerUid: uid,
      ownerNombre: CUENTA.displayName,
      creadaEn: diaISO(-1),
      venceEn: diaISO(5),
      origen: 'manual',
    },
    /**
     * V15-FOLLOWUP-WORK-001 (Fase 7, §10), segunda rebanada — «closed
     * recently» necesita una tarea de verdad EN `cerrada` para que
     * `tareasCerradasRecientes()` tenga algo que devolver: `tareasVivas()`
     * la excluye a propósito, así que ninguna de las de arriba sirve.
     */
    {
      id: 'tarea-cerrada-luzmaria',
      clinicId: CLINIC_ID,
      patientId: 'pac-luzmaria-cervantes',
      patientNombre: 'Luz María Cervantes Ochoa',
      tipo: 'resultado_por_revisar',
      titulo: 'Radiografía de tórax — sin hallazgos',
      detalle: 'Revisada en la consulta previa; no hay hallazgo que requiera seguimiento.',
      prioridad: 'normal',
      estado: 'cerrada',
      ownerUid: uid,
      ownerNombre: CUENTA.displayName,
      creadaEn: diaISO(-5),
      completadaEn: diaISO(-3),
      cerradaEn: diaISO(-2),
      cerradaPor: uid,
      origen: 'laboratorio',
    },
  ]
  for (const t of tareas) {
    const { id, ...datos } = t
    await db.doc(`clinics/${CLINIC_ID}/tareas_clinicas/${id}`).set(datos)
  }

  console.log(`Sembrado: clínica ${CLINIC_ID}, médico ${CUENTA.email} (uid ${uid}), ${pacientes.length} pacientes, ${citas.length} citas, ${tareas.length} tareas clínicas (${HOY}).`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

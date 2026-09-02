#!/usr/bin/env node
/**
 * ARNÉS VISUAL V10 — siembra el emulador con un consultorio SINTÉTICO.
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
 *
 * V10 §33 es literal: «Never approve a screen only by reading JSX/CSS». Hay que
 * abrir la pantalla en un navegador. Pero todas las pantallas del flujo dorado
 * —agenda, paciente, consulta, nota, receta— exigen sesión, y la única sesión
 * que existe en esta máquina es la de PRODUCCIÓN, con pacientes reales dentro.
 *
 * Capturarla estaría prohibido dos veces: `data-privacy.md` dice «cero
 * pacientes reales, ni en pruebas, ni en fixtures, ni en ejemplos», y una
 * captura de pantalla es PHI guardada en un PNG. Y V10 §6 prohíbe usar datos
 * identificables.
 *
 * Así que la sesión se fabrica. Todo lo que hay aquí es inventado: los nombres
 * salen de un pueblo que no existe, los teléfonos son del rango 555 reservado
 * para ficción, y el proyecto (`demo-*`) no está dado de alta en Firebase.
 *
 * ── LOS DATOS NO SON DECORADO ────────────────────────────────────────────────
 *
 * Una siembra bonita produce una auditoría visual mentirosa. Los casos duros de
 * V10 §39 —nombre larguísimo, muchas alergias, cero medicamentos, un valor
 * crítico, una cita sin confirmar— tienen que ESTAR sembrados, porque son
 * exactamente los que rompen la maquetación, y son los que nunca aparecen si
 * uno siembra tres pacientes llamados «Juan Pérez».
 *
 * ── DETERMINISTA ─────────────────────────────────────────────────────────────
 *
 * Los ids están escritos a mano y las fechas se derivan del día en curso a las
 * horas fijas del consultorio. Dos corridas seguidas producen la misma pantalla,
 * que es la condición para que una regresión visual signifique algo (V10 §39).
 *
 * Uso:
 *   npm run arnes:emuladores      (en otra terminal — los deja levantados)
 *   npm run arnes:sembrar
 *   npm run arnes:dev             → http://localhost:3200
 *   Entrar con  demo@nexusmed.test  /  demo1234
 */

import { writeFile } from 'node:fs/promises'

const PROYECTO = process.env.ARNES_PROYECTO || 'demo-nexusmed-v10'
const AUTH = process.env.ARNES_AUTH || '127.0.0.1:9099'
const FIRESTORE = process.env.ARNES_FIRESTORE || '127.0.0.1:8080'

const CORREO = 'demo@nexusmed.test'
const CLAVE = 'demo1234'
const CLINICA = 'consultorio-demo-v10'

// ── Fechas: hoy, a las horas del consultorio ────────────────────────────────
/**
 * «HOY» ES EL DEL CONSULTORIO, NO EL DEL CONTENEDOR.
 *
 * Esto usaba `new Date().getDate()`, que es la fecha LOCAL DEL PROCESO. En esta
 * caja el proceso corre en UTC y el consultorio está en `America/Mexico_City`
 * (UTC-6): entre las 18:00 y la medianoche de México, el contenedor ya está en
 * el día siguiente.
 *
 * Consecuencia real, vista en una auditoría visual: la siembra ponía las cinco
 * citas en el día 30 mientras la aplicación —que sí usa la zona del
 * consultorio— decía que hoy era el 29. La agenda del día salía VACÍA y el
 * marcador de «hoy» señalaba una columna sin nada. Nada de eso era un defecto
 * del producto; era el arnés sembrando en el día equivocado.
 *
 * Es el mismo error que `lib/timezone.ts` lleva años impidiendo dentro del
 * producto, cometido en la herramienta que lo audita.
 */
const TZ_CONSULTORIO = 'America/Mexico_City'
const enZona = (d) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_CONSULTORIO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)

const hoy = new Date()
const iso = (d) => d.toISOString()
const dia = enZona(hoy)
const enDias = (n) => {
  const d = new Date(hoy)
  d.setUTCDate(d.getUTCDate() + n)
  return enZona(d)
}

/**
 * Los pacientes. Cada uno existe para forzar un caso, no para rellenar.
 *
 * El paciente 4 lleva el nombre compuesto más largo que un registro civil
 * mexicano admite de verdad (dos nombres + dos apellidos, uno de ellos
 * compuesto). Si el encabezado de paciente lo trunca sin avisar, o lo desborda,
 * se ve aquí y no en la consulta de un médico.
 */
const PACIENTES = [
  {
    id: 'pac-001',
    nombre: 'Rosalía Mendieta Cuevas',
    telefono: '5555010101',
    fechaNacimiento: '1958-03-14',
    sexo: 'Femenino',
    alergias: 'Penicilina (anafilaxia), sulfas, AINEs',
    seguroMedico: 'GNP Salud',
    notas: 'Diabetes tipo 2 desde 2011. Nefropatía incipiente.',
  },
  {
    id: 'pac-002',
    nombre: 'Aurelio Barquín Salcedo',
    telefono: '5555010202',
    fechaNacimiento: '1971-11-02',
    sexo: 'Masculino',
    alergias: '',
    seguroMedico: '',
    notas: 'Sin antecedentes de importancia.',
  },
  {
    id: 'pac-003',
    nombre: 'Nadia Ferreiro Ocampo',
    telefono: '5555010303',
    fechaNacimiento: '1994-07-26',
    sexo: 'Femenino',
    alergias: 'Ninguna conocida',
    seguroMedico: 'AXA',
    notas: 'Embarazo de 26 semanas.',
  },
  {
    id: 'pac-004',
    nombre: 'María Guadalupe de la Concepción Villaseñor Etchegaray',
    telefono: '5555010404',
    fechaNacimiento: '1943-01-09',
    sexo: 'Femenino',
    alergias: 'Yodo, mariscos, látex, penicilina, metamizol, tramadol',
    seguroMedico: 'IMSS',
    notas: 'EPOC. Oxígeno domiciliario 2 L/min.',
  },
  {
    id: 'pac-005',
    nombre: 'Tadeo Iparraguirre Nolasco',
    telefono: '5555010505',
    fechaNacimiento: '2019-05-30',
    sexo: 'Masculino',
    alergias: '',
    seguroMedico: '',
    notas: 'Pediátrico. Peso 18.4 kg.',
    /**
     * HISTORIAL DE INASISTENCIA — para que el aviso de riesgo de no-show se
     * pueda VER. Sin esto, `calcularRiesgoNoShow` nunca pasa de «bajo» y la
     * insignia de riesgo no se pinta nunca: el código estaba escrito y la
     * pantalla que lo enseña no se podía auditar. Misma familia que los cobros
     * de la unidad 31 — el arnés tiene que poder producir el caso.
     */
    noShowCount: 3,
    cancelacionCount: 2,
  },
]

/**
 * La agenda del día. Mezcla deliberada de estados porque el color de estado es
 * justo lo que V10 §15 pide moderar: si todas las citas están confirmadas, la
 * pantalla se ve tranquila por accidente y no por diseño.
 */
/**
 * LOS ESTADOS SON DEL TIPO, NO INVENTADOS.
 *
 * Aquí se sembraba `programada`, que NO es miembro de `AppointmentStatus`. El
 * producto no la conoce, así que `APPOINTMENT_STATUS_CONFIG['programada']` es
 * `undefined`: la insignia no se pintaba y la rejilla la caía por el `else`
 * («el resto → sólido»), es decir, la pintaba como si estuviera CONFIRMADA.
 *
 * El daño no era del producto sino de esta siembra: hacía que una auditoría
 * visual concluyera «confirmada y pendiente se ven igual» cuando lo que pasaba
 * es que el arnés estaba inventando un estado. Misma familia que el `urgencia`
 * por `urgente` de la unidad 16 — un dato de prueba fuera del vocabulario hace
 * mentir a la pantalla que se está auditando.
 *
 * `pendiente-confirmar` es el estado real de una cita que aún no confirma el
 * paciente, y es el que de verdad llena la agenda de un consultorio.
 */
const CITAS = [
  { id: 'cita-001', pac: 'pac-001', hora: '09:00', dur: 30, tipo: 'Seguimiento', estado: 'confirmada', conf: true, motivo: 'Control de glucosa y revisión de función renal' },
  { id: 'cita-002', pac: 'pac-004', hora: '09:45', dur: 45, tipo: 'Primera vez', estado: 'pendiente-confirmar', conf: false, motivo: 'Disnea de medianos esfuerzos desde hace tres semanas' },
  { id: 'cita-003', pac: 'pac-002', hora: '11:00', dur: 30, tipo: 'Seguimiento', estado: 'confirmada', conf: true, motivo: 'Resultados de laboratorio' },
  { id: 'cita-004', pac: 'pac-005', hora: '12:00', dur: 30, tipo: 'Primera vez', estado: 'pendiente-confirmar', conf: false, motivo: 'Fiebre de tres días' },
  /**
   * Dos casos que EXISTEN en el código y no se podían ver en pantalla:
   * la cita de cortesía (con su motivo) y la descuadrada con Google Calendar.
   * Sin sembrarlas, sus avisos no se pintan nunca y no hay forma de auditarlos.
   */
  { id: 'cita-008', pac: 'pac-002', hora: '16:00', dur: 30, tipo: 'Seguimiento', estado: 'confirmada', conf: true, motivo: 'Revisión de control', exento: 'Familiar del personal' },
  { id: 'cita-009', pac: 'pac-003', hora: '17:00', dur: 30, tipo: 'Seguimiento', estado: 'confirmada', conf: true, motivo: 'Control posoperatorio', syncRoto: true },
  /**
   * ATENDIDA Y SIN COBRAR — el único estado en el que aparece el botón de
   * «Cobrar». Sin ella, el camino del dinero no se puede recorrer en el arnés:
   * el botón no existe, así que no hay nada que auditar. Cuarta vez en esta
   * vuelta que la siembra era lo que impedía ver una pantalla.
   */
  { id: 'cita-010', pac: 'pac-001', hora: '08:00', dur: 30, tipo: 'Seguimiento', estado: 'atendida', conf: true, motivo: 'Control de presión' },
  { id: 'cita-005', pac: 'pac-003', hora: '13:00', dur: 30, tipo: 'Seguimiento', estado: 'cancelada', conf: false, motivo: 'Control prenatal' },
  { id: 'cita-006', pac: 'pac-001', hora: '10:30', dur: 30, tipo: 'Seguimiento', estado: 'pendiente-confirmar', conf: false, motivo: 'Ajuste de metformina', dia: enDias(1) },
  { id: 'cita-007', pac: 'pac-002', hora: '17:15', dur: 30, tipo: 'Seguimiento', estado: 'pendiente-confirmar', conf: false, motivo: 'Revisión de presión arterial', dia: enDias(3) },
]

/**
 * COBROS — para que `/finanzas` se pueda AUDITAR.
 *
 * Sin esto la pantalla salía entera a `$0.00`: seis tarjetas de estadística en
 * cero, una gráfica vacía y una tabla sin filas. Auditar eso y concluir «se ve
 * plana» no dice nada — es la misma trampa que el día sin citas de la unidad
 * 23: **una pantalla vacía puntúa distinto sin ser distinta**, y encima esconde
 * justo los defectos que sólo aparecen con datos (alineación de cifras,
 * truncado de nombres largos, la gráfica con una barra que se sale).
 *
 * Se siembra un mes con forma REAL, no un relleno bonito:
 *  · varios métodos de pago, para que la partición signifique algo;
 *  · un reembolso (monto negativo), que es el caso que rompe los promedios;
 *  · un cobro de cuatro cifras junto a otros de dos, para ver si las columnas
 *    numéricas se alinean;
 *  · el paciente del nombre más largo, que es quien desborda la tabla;
 *  · días con varios cobros y días sin ninguno, para que la gráfica tenga
 *    relieve en vez de una meseta.
 */
const COBROS = [
  { d: 0,  monto: 1200, metodo: 'efectivo',        concepto: 'consulta',      pac: 'pac-001', desc: 'Consulta de seguimiento' },
  { d: 0,  monto: 900,  metodo: 'transferencia',   concepto: 'consulta',      pac: 'pac-002', desc: 'Consulta de seguimiento' },
  { d: -1, monto: 1800, metodo: 'tarjeta_credito', concepto: 'consulta',      pac: 'pac-004', desc: 'Primera vez' },
  { d: -1, monto: 350,  metodo: 'efectivo',        concepto: 'estudio',       pac: 'pac-004', desc: 'Electrocardiograma' },
  { d: -3, monto: 12500, metodo: 'transferencia',  concepto: 'procedimiento', pac: 'pac-003', desc: 'Procedimiento programado' },
  { d: -4, monto: 900,  metodo: 'tarjeta_debito',  concepto: 'teleconsulta',  pac: 'pac-005', desc: 'Teleconsulta' },
  { d: -6, monto: 1200, metodo: 'efectivo',        concepto: 'consulta',      pac: 'pac-001', desc: 'Consulta de seguimiento' },
  { d: -7, monto: -900, metodo: 'transferencia',   concepto: 'reembolso',     pac: 'pac-002', desc: 'Reembolso por cita cancelada' },
  { d: -9, monto: 450,  metodo: 'efectivo',        concepto: 'medicamento',   pac: 'pac-001', desc: 'Metformina 850 mg' },
  { d: -12, monto: 1800, metodo: 'tarjeta_credito', concepto: 'consulta',     pac: 'pac-003', desc: 'Primera vez' },
  { d: -15, monto: 900, metodo: 'efectivo',        concepto: 'consulta',      pac: 'pac-005', desc: 'Consulta de seguimiento' },
  { d: -18, monto: 2400, metodo: 'transferencia',  concepto: 'paquete',       pac: 'pac-004', desc: 'Paquete de control anual' },
]

// ── Traductor a la representación tipada de Firestore ───────────────────────
/**
 * El REST de Firestore no acepta JSON pelado: cada valor va etiquetado con su
 * tipo. Se hace a mano y no con `firebase-admin` a propósito — el SDK de admin
 * busca credenciales de aplicación, y este arnés tiene que poder correr en una
 * máquina donde ésas son las de PRODUCCIÓN. Sin SDK no hay forma de que un
 * despiste escriba en el proyecto equivocado.
 */
function valor(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } }
  if (typeof v === 'object') return { mapValue: { fields: campos(v) } }
  throw new Error(`Tipo sin traducir: ${typeof v}`)
}
function campos(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    out[k] = valor(v)
  }
  return out
}

/**
 * `Bearer owner` es la credencial que el emulador reconoce como administrador.
 *
 * Hace falta porque el emulador carga `firestore.rules` de verdad, y esas reglas
 * prohíben —correctamente— que un cliente cree un consultorio o una membresía:
 * en producción eso lo escribe el servidor con el SDK de admin. La siembra
 * ocupa ese mismo papel.
 *
 * Que las reglas reales estén cargadas es una ventaja, no un estorbo: significa
 * que todo lo que la APLICACIÓN lea o escriba durante una captura pasa por la
 * misma autorización que en producción. Si una pantalla funciona aquí sólo
 * porque las reglas estaban apagadas, el arnés estaría mintiendo.
 */
const ADMIN = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }

async function escribir(ruta, datos) {
  const partes = ruta.split('/')
  const docId = partes.pop()
  const padre = partes.join('/')
  const url = `http://${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/${padre}?documentId=${encodeURIComponent(docId)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: ADMIN,
    body: JSON.stringify({ fields: campos(datos) }),
  })
  if (!res.ok) {
    const cuerpo = await res.text()
    // Ya existe: se sobrescribe con PATCH. La siembra tiene que ser repetible.
    if (res.status === 409 || cuerpo.includes('ALREADY_EXISTS')) {
      const patch = `http://${FIRESTORE}/v1/projects/${PROYECTO}/databases/(default)/documents/${ruta}`
      const r2 = await fetch(patch, {
        method: 'PATCH',
        headers: ADMIN,
        body: JSON.stringify({ fields: campos(datos) }),
      })
      if (!r2.ok) throw new Error(`PATCH ${ruta}: ${r2.status} ${await r2.text()}`)
      return
    }
    throw new Error(`POST ${ruta}: ${res.status} ${cuerpo}`)
  }
}

async function limpiar() {
  // Borrado en bloque del proyecto entero: sin esto, una siembra vieja se mezcla
  // con la nueva y la captura deja de ser reproducible.
  const url = `http://${FIRESTORE}/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`
  const res = await fetch(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`No se pudo limpiar Firestore: ${res.status}`)
}

async function crearUsuario() {
  const base = `http://${AUTH}/identitytoolkit.googleapis.com/v1`
  // El emulador acepta cualquier apiKey; la real nunca sale de esta máquina.
  const registrar = await fetch(`${base}/accounts:signUp?key=arnes-visual-v10`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CORREO, password: CLAVE, returnSecureToken: true }),
  })
  const cuerpo = await registrar.json()
  if (cuerpo.idToken) return cuerpo.localId
  // Ya existía de una corrida anterior: se entra con él.
  const entrar = await fetch(`${base}/accounts:signInWithPassword?key=arnes-visual-v10`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CORREO, password: CLAVE, returnSecureToken: true }),
  })
  const c2 = await entrar.json()
  if (!c2.idToken) throw new Error(`No se pudo crear ni abrir la cuenta: ${JSON.stringify(cuerpo)} / ${JSON.stringify(c2)}`)
  return c2.localId
}

/**
 * El correo se marca como verificado.
 *
 * No es maquillaje: el aviso «confirma tu correo» ocupa la primera franja de
 * TODAS las pantallas, y una cuenta de médico en uso normal no lo tiene. Dejarlo
 * puesto desplazaría cada captura 44 px hacia abajo y metería en la auditoría un
 * elemento que no forma parte de lo que se juzga.
 *
 * El aviso se audita aparte, en su propio caso, no de polizón en las otras siete
 * pantallas.
 */
async function verificarCorreo(uid) {
  const res = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROYECTO}/accounts:update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: uid, emailVerified: true }),
  })
  if (!res.ok) throw new Error(`No se pudo marcar el correo como verificado: ${res.status} ${await res.text()}`)
}

async function vivo(hostPuerto, nombre) {
  try {
    await fetch(`http://${hostPuerto}/`, { signal: AbortSignal.timeout(1500) })
    return true
  } catch {
    console.error(`\n  ✗ El emulador de ${nombre} no responde en ${hostPuerto}.`)
    console.error(`    Levántalos primero en otra terminal:  npm run arnes:emuladores\n`)
    return false
  }
}

async function main() {
  if (!(await vivo(FIRESTORE, 'Firestore'))) process.exit(1)
  if (!(await vivo(AUTH, 'Auth'))) process.exit(1)

  await limpiar()
  const uid = await crearUsuario()
  await verificarCorreo(uid)

  // ── Consultorio ───────────────────────────────────────────────────────────
  await escribir(`clinics/${CLINICA}`, {
    nombreClinica: 'Consultorio de Medicina Interna',
    nombreMedico: 'Dra. Ximena Alcántara Robledo',
    plan: 'premium',
    status: 'active',
    paseLibre: true,          // el arnés no debe chocar contra el muro de pago
    ownerId: uid,
    createdAt: iso(hoy),
    updatedAt: iso(hoy),
  })

  await escribir(`clinic_members/${uid}`, {
    clinicId: CLINICA,
    role: 'medico',
    displayName: 'Dra. Ximena Alcántara Robledo',
    email: CORREO,
    createdAt: iso(hoy),
  })

  await escribir(`clinics/${CLINICA}/config/main`, {
    nombreClinica: 'Consultorio de Medicina Interna',
    nombreMedico: 'Ximena Alcántara Robledo',
    especialidad: 'Medicina Interna e Infectología',
    cedulaProfesional: '0000000',        // sintética: siete ceros no es una cédula
    telefonoConsultorio: '5555000000',
    direccionConsultorio: 'Calle Inventada 100, Colonia Ficticia, Ciudad Demo',
    zonaHoraria: 'America/Mexico_City',
    duracionCitaDefault: 30,
    horaInicio: '09:00',
    horaFin: '19:00',
  })

  /**
   * `ultimaCita` SE DERIVA DE LAS CITAS, NO SE ESCRIBE A MANO.
   *
   * La siembra escribía `noShowCount` y `cancelacionCount` —lo que dejaría una
   * transición a «no asistió»— y NO escribía `ultimaCita`, que es lo que deja
   * una transición a «atendida». Incoherente consigo misma, y con una
   * consecuencia que engaña: `/pacientes` abre en «Recientes», «Recientes»
   * filtra por `ultimaCita`, y el arnés enseñaba la pantalla VACÍA —«Ninguno
   * tiene citas recientes. Hay 5 expedientes en total»— con ocho citas hoy y
   * una de ellas atendida.
   *
   * Eso es peor que una siembra pobre: hace que una pantalla sana parezca rota.
   * El guion ya avisa arriba de que «una siembra bonita produce una auditoría
   * visual mentirosa»; ésta mentía en la otra dirección, y se tarda lo mismo en
   * perseguir un defecto que no existe.
   *
   * Se deriva con la MISMA regla del producto —`esAtencionEfectiva` en
   * `src/lib/agenda/contadores-paciente.ts`— y no con una fecha inventada, para
   * que la siembra no pueda separarse de la regla sin que un guardián lo vea.
   */
  const ESTADOS_QUE_CUENTAN_COMO_ATENCION = ['atendida', 'finalizada', 'pagada']
  const ultimaCitaDe = new Map()
  for (const c of CITAS) {
    if (!ESTADOS_QUE_CUENTAN_COMO_ATENCION.includes(c.estado)) continue
    const fecha = c.dia || dia
    const previa = ultimaCitaDe.get(c.pac)
    if (!previa || fecha > previa) ultimaCitaDe.set(c.pac, fecha)
  }

  // ── Pacientes ─────────────────────────────────────────────────────────────
  for (const p of PACIENTES) {
    await escribir(`clinics/${CLINICA}/patients/${p.id}`, {
      nombre: p.nombre,
      telefono: p.telefono,
      fechaNacimiento: p.fechaNacimiento,
      sexo: p.sexo,
      alergias: p.alergias,
      seguroMedico: p.seguroMedico,
      notas: p.notas,
      noShowCount: p.noShowCount ?? 0,
      cancelacionCount: p.cancelacionCount ?? 0,
      // Ausente cuando el paciente no tiene ninguna cita atendida: ausencia de
      // dato no es dato de ausencia, tampoco en la siembra.
      ...(ultimaCitaDe.has(p.id) ? { ultimaCita: ultimaCitaDe.get(p.id) } : {}),
      createdAt: iso(hoy),
      updatedAt: iso(hoy),
    })
  }

  /**
   * UN PAQUETE DE VISITA LIBERADO — para que la cara CLÍNICA del portal exista.
   *
   * El portal del paciente tiene dos caras: con el enlace de mostrador
   * (`agenda`) enseña un muro donde con el clínico enseña el plan y las recetas.
   * Sin un paquete liberado, esa segunda cara se pinta VACÍA y el arnés la mide
   * en cero — un cero real que no vigila nada, porque no hay nada que vigilar.
   *
   * Se sembró a mano la primera vez y quedó declarado como riesgo: una caja
   * recién sembrada habría vuelto a medir la cara clínica vacía SIN AVISAR. Por
   * eso vive aquí, donde no se puede olvidar.
   *
   * Las TRES condiciones de `visibleParaElPaciente` —RELEASED, approvedBy y
   * approvedAt— van puestas a propósito: un paquete DRAFT no es visible para el
   * paciente, y sembrar uno así mediría otra vez la pantalla vacía. Es la regla
   * «DRAFT hasta que el médico apruebe» de `.claude/rules/patient-facing-ai.md`.
   *
   * Todo sintético, como el resto del sembrado. Cero pacientes reales.
   */
  await escribir(`clinics/${CLINICA}/patients/pac-001/paquetes_visita/paq-demo-001`, {
    estado: 'RELEASED',
    approvedBy: 'medico-demo-sintetico',
    approvedAt: Date.now(),
    version: 1,
    fechaConsulta: iso(hoy).slice(0, 10),
    encounterSummary: 'Control de presión arterial. Cifras dentro de lo esperado para el plan actual.',
    medicationInstructions: [
      { nombre: 'Medicamento sintético A', instruccion: 'Una toma por la mañana, con alimento.' },
    ],
    medicationChanges: [
      { nombre: 'Medicamento sintético A', tipo: 'sin-cambio' },
    ],
    orders: ['Estudio de laboratorio de control'],
    followUp: 'Cita de seguimiento en cuatro semanas.',
    warningSigns: ['Dolor de cabeza intenso que no cede', 'Visión borrosa'],
    alergias: 'Penicilina (anafilaxia), sulfas, AINEs',
    prescriptor: {
      nombre: 'Dra. Ximena Alcántara Robledo (sintética)',
      cedulaProfesional: '00000000',
      especialidad: 'Medicina Interna',
    },
    clinicianContactRules: 'Si algo de esto empeora, comunícate con el consultorio antes de la cita.',
  })

  /**
   * UNA NOTA FIRMADA CON RECETA — para que «Documentos» del portal no esté vacío.
   *
   * `action:'documentos'` no devuelve `medicamentos` en crudo: los cruza por
   * `medicamentosDeLaReceta`, que separa cinco cosas que no son lo mismo —lo que
   * el paciente REFIRIÓ que toma, lo que la IA extrajo sin confirmar, lo
   * suspendido, lo vencido, y lo que el médico INDICÓ—. Sólo lo último baja al
   * papel.
   *
   * Por eso este medicamento lleva `procedenciaClinica: 'se_prescribe_hoy'` y
   * `estado: 'activa'`: son las DOS condiciones que ese filtro exige. Sembrar
   * uno con `ya_lo_toma` o en `borrador` dejaría «Documentos» vacío igual, y el
   * arnés volvería a medir un cero que no vigila nada.
   *
   * La nota va `firmada` porque la ruta filtra por `estado == 'firmada'`: una
   * nota sin firmar no es una receta y no debe llegarle al paciente.
   *
   * Medicamento sintético, sin dosis real: lo que se vigila aquí es que la
   * pantalla se comporte, no lo que dice. Cero pacientes reales.
   */
  await escribir(`clinics/${CLINICA}/patients/pac-001/notas/nota-demo-001`, {
    id: 'nota-demo-001',
    clinicId: CLINICA,
    pacienteId: 'pac-001',
    pacienteNombre: PACIENTES.find(x => x.id === 'pac-001').nombre,
    tipo: 'seguimiento',
    estado: 'firmada',
    fechaConsulta: iso(hoy).slice(0, 10),
    firmadaEn: iso(hoy),
    medicoNombre: 'Dra. Ximena Alcántara Robledo (sintética)',
    /*
     * LA PRIMERA VERSIÓN DE ESTE SEMBRADO NO TRAÍA `metadata` NI `secciones`.
     *
     * Y pasó desapercibido porque el ÚNICO lector que se miró fue la ruta del
     * portal, que sólo lee `estado` y `medicamentos`. El visor medicolegal
     * —`/nota/[patientId]/[notaId]`, el sitio donde el médico LEE el documento—
     * hace `nota.metadata.establecimiento` sin guarda y `nota.secciones.filter`,
     * así que reventaba entero: «Algo salió mal», con un «Reintentar» que no
     * puede arreglar un fallo determinista de render.
     *
     * Es «el dato tiene que LLEGAR» en su forma más literal: el que escribe lo
     * aceptó, Firestore lo aceptó, un lector lo aceptó — y el lector que
     * importaba no podía pintarlo. Un sembrador en `.mjs` no pasa por `tsc`, así
     * que `NotaMedica` decía «obligatorio» y nadie lo comprobaba.
     *
     * Ahora se siembra contra el TIPO, no contra el lector que se tenía a mano.
     */
    metadata: {
      id: 'nota-demo-001',
      tipoNota: 'seguimiento',
      clinicId: CLINICA,
      pacienteId: 'pac-001',
      medicoId: uid,
      // Sintéticas y marcadas como tales: ni cédula ni establecimiento reales.
      cedulaProfesional: 'CED-SINTETICA-0000',
      especialidad: 'Medicina Interna (sintética)',
      establecimiento: 'Consultorio sintético de medición',
      fechaCreacion: iso(hoy),
      fechaModificacion: iso(hoy),
      /*
       * SELLO VACÍO A PROPÓSITO. El visor distingue cuatro estados de integridad
       * y `''` cae en `sin-sello`, que es la verdad: esta nota no se firmó por el
       * producto, se escribió a mano en el emulador. Inventar un SHA-256 la
       * pintaría de ROJO —«pudo haber sido alterada»— y el arnés estaría midiendo
       * una alarma falsa que yo mismo fabriqué.
       */
      hashIntegridad: '',
      version: 1,
      estado: 'firmada',
      fuenteGeneracion: 'manual',
    },
    /*
     * Y LA FIRMA, que es lo que hace que sea un documento y no un borrador.
     *
     * `estado: 'firmada'` a solas no basta: el pie del documento pregunta por
     * `nota.estado === 'firmada' && nota.firma`, así que sin este bloque la nota
     * salía sellada arriba y estampada BORRADOR abajo — un documento que se
     * contradice a sí mismo, y encima el estado que hace falta para la ADENDA,
     * que es corrección de nota FIRMADA.
     *
     * `hashFirma` va vacío por lo mismo que `hashIntegridad`: no se inventa un
     * sello. Sin él la pantalla dice `sin-sello`, que es la verdad.
     */
    firma: {
      nombreMedico: 'Dra. Ximena Alcántara Robledo (sintética)',
      cedulaProfesional: 'CED-SINTETICA-0000',
      especialidad: 'Medicina Interna (sintética)',
      timestamp: iso(hoy),
      hashFirma: '',
    },
    /*
     * Texto sintético y SIN UNA SOLA CIFRA CLÍNICA: aquí se vigila que la
     * pantalla se comporte, no lo que dice. `clinical-safety.md` §1 — una dosis
     * o un umbral inventados en un fixture acaban citándose como si fueran algo.
     */
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo', value: 'Contenido sintético de medición. No corresponde a ninguna persona.' },
      { key: 'objetivo', label: 'Objetivo', value: 'Contenido sintético de medición.' },
      { key: 'analisis', label: 'Análisis', value: 'Contenido sintético de medición.' },
      { key: 'plan', label: 'Plan', value: 'Contenido sintético de medición.' },
    ],
    medicamentos: [
      {
        nombre: 'Medicamento sintético A',
        procedenciaClinica: 'se_prescribe_hoy',
        estado: 'activa',
        indicacion: 'Una toma por la mañana, con alimento.',
      },
      {
        // Referido por el paciente: NO debe bajar a la receta. Está aquí a
        // propósito, para que el sembrado ejercite la frontera y no sólo el
        // camino feliz.
        nombre: 'Medicamento sintético B',
        procedenciaClinica: 'ya_lo_toma',
        estado: 'activa',
        indicacion: 'Lo tomaba desde antes de esta consulta.',
      },
    ],
  })

  // ── Agenda ────────────────────────────────────────────────────────────────
  for (const c of CITAS) {
    const p = PACIENTES.find(x => x.id === c.pac)
    await escribir(`clinics/${CLINICA}/appointments/${c.id}`, {
      pacienteId: c.pac,
      pacienteNombre: p.nombre,
      pacienteTelefono: p.telefono,
      fechaHora: `${c.dia || dia} ${c.hora}`,
      duracion: c.dur,
      tipo: c.tipo,
      motivo: c.motivo,
      estado: c.estado,
      origen: 'manual',
      medicoNombre: 'Dra. Ximena Alcántara Robledo',
      medicoId: uid,
      confirmadoPaciente: c.conf,
      recordatorio24hEnviado: false,
      recordatorioMismoDiaEnviado: false,
      consentimientoMensajes: true,
      ...(c.exento ? { cobroExento: true, exentoMotivo: c.exento } : {}),
      ...(c.syncRoto ? { googleCalendarEventId: 'evt-sintetico-001', googleCalendarSyncStatus: 'error' } : {}),
      createdAt: iso(hoy),
      updatedAt: iso(hoy),
    })
  }

  // ── Cobros ────────────────────────────────────────────────────────────────
  for (const [i, c] of COBROS.entries()) {
    const p = PACIENTES.find(x => x.id === c.pac)
    const diaCobro = enDias(c.d)
    await escribir(`clinics/${CLINICA}/cobros/cobro-${String(i + 1).padStart(3, '0')}`, {
      fecha: `${diaCobro}T12:00:00.000Z`,
      dia: diaCobro,
      mes: diaCobro.slice(0, 7),
      monto: c.monto,
      metodo: c.metodo,
      concepto: c.concepto,
      descripcion: c.desc,
      patientId: c.pac,
      patientNombre: p.nombre,
      medicoId: uid,
      medicoNombre: 'Dra. Ximena Alcántara Robledo',
      createdAt: iso(hoy),
      updatedAt: iso(hoy),
    })
  }

  /**
   * El uid se deja escrito para el script de capturas.
   *
   * Lo necesita para marcar el paseo de bienvenida como visto, y su clave lleva
   * el uid dentro (`nexus_tour_v1_<uid>`). Leerlo del navegador no sirve:
   * Firebase v9 guarda la sesión en IndexedDB, no en localStorage, así que
   * hurgar en `localStorage` desde la página devuelve `undefined` — y la clave
   * queda escrita con esa palabra dentro, que es exactamente el fallo mudo que
   * hizo que las siete primeras capturas fueran siete fotos del mismo modal.
   */
  await writeFile(
    new URL('./arnes-sesion.json', import.meta.url),
    JSON.stringify({ uid, correo: CORREO, clave: CLAVE, clinica: CLINICA, proyecto: PROYECTO }, null, 2) + '\n',
  )

  console.log(`
  ✓ Emulador sembrado — proyecto ${PROYECTO}

    consultorio  ${CLINICA}
    médica       Dra. Ximena Alcántara Robledo (sintética)
    pacientes    ${PACIENTES.length}
    cobros       ${COBROS.length}\n    citas        ${CITAS.length}  (${CITAS.filter(c => !c.dia).length} hoy, ${dia})

    entrar con   ${CORREO} / ${CLAVE}
    la app       npm run arnes:dev   →  http://localhost:3200

  Cero pacientes reales. Cero contacto con producción.
`)
}

main().catch(e => { console.error('\n  ✗', e.message, '\n'); process.exit(1) })

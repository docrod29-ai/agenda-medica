/**
 * SIEMBRA GP-FINAL — el segundo consultorio y las piezas del recorrido real.
 *
 * ── POR QUÉ HACE FALTA OTRA SIEMBRA ─────────────────────────────────────────
 *
 * Las seis siembras que ya existen (`sembrar-capturas`, `sembrar-rtc30`,
 * `sembrar-cita-por-delante-v15`, `sembrar-receta-en-nota-firmada-v15`…) pueblan
 * UN consultorio: `clinica-capturas-v10`. Sirven para medir pantallas, y para eso
 * un solo inquilino basta.
 *
 * El Golden Path no mide pantallas: recorre el consultorio como médico y como
 * paciente, y dos de sus invariantes innegociables —«paciente equivocado = P0» y
 * «tenant equivocado = P0»— **no se pueden ni siquiera intentar** con un solo
 * consultorio y un solo expediente al alcance. Una separación que nunca se pone a
 * prueba contra un segundo inquilino real no está comprobada: está supuesta.
 *
 * Por eso esto SUMA, no sustituye. Se corre DESPUÉS de `sembrar-capturas.mjs` y
 * deja intacto lo suyo.
 *
 * ── QUÉ AÑADE Y PARA QUÉ SIRVE CADA COSA ────────────────────────────────────
 *
 *   · Consultorio B (`clinica-gp-final-b`) con su médico y su paciente. Es el
 *     otro lado de la frontera: sin él, «el token de B no alcanza lo de A» es una
 *     frase, no una prueba.
 *   · Un paquete de visita RELEASED y otro DRAFT, sembrados A MANO en el
 *     consultorio A. El DRAFT es el que nunca debe verse; sembrarlo a mano es
 *     deliberado, porque comprueba la compuerta del servidor y no la del camino
 *     que lo creó.
 *   · Un paciente de A con `portalTokenVersion` subido: la revocación sólo se
 *     puede probar si existe un enlace emitido ANTES de ella.
 *
 * Todo inventado. Nombres de un pueblo que no existe, teléfonos del rango 555
 * reservado para ficción, proyecto `demo-*` que no está dado de alta en Firebase
 * (regla `data-privacy.md`: cero pacientes reales, tampoco en fixtures).
 *
 * Uso (emuladores levantados en 8080/9099, y sembrar-capturas ya corrido):
 *   node scripts/golden-path/sembrar-gp-final.mjs
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'demo-nexusmed-test'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

// Mismo candado anti-producción que el resto de las siembras: el SDK se niega a
// hablar con un proyecto real si el id empieza por `demo-`.
if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error('El proyecto de siembra DEBE empezar por demo- (candado anti-producción)')
}

const app = getApps().length ? getApps()[0] : initializeApp({ projectId: PROJECT_ID })
const auth = getAuth(app)
const db = getFirestore(app)

/** Consultorio A: el que ya sembró `sembrar-capturas.mjs`. No se toca su forma. */
export const CLINICA_A = 'clinica-capturas-v10'
/** Consultorio B: existe SÓLO para que la frontera tenga dos lados. */
export const CLINICA_B = 'clinica-gp-final-b'

export const MEDICO_B = {
  email: 'medico.b@gp-final.demo',
  password: 'gp-final-demo-b',
  displayName: 'Dr. Nicolás Berrondo Alcaraz',
}

export const PACIENTE_B = 'pac-gp-b-hilaria-mondragon'
/** El paciente de A cuyos enlaces se revocan a mitad del recorrido. */
export const PACIENTE_A_REVOCADO = 'pac-catalina-ibarra'
/** El paciente de A que sí tiene paquete liberado. */
export const PACIENTE_A_LIBERADO = 'pac-luzmaria-cervantes'
/** El paciente de A con paquete en DRAFT, que el portal jamás debe enseñar. */
export const PACIENTE_A_BORRADOR = 'pac-aurelio-dominguez'

const ISO = new Date().toISOString()

async function usuario({ email, password, displayName }) {
  try {
    return await auth.getUserByEmail(email)
  } catch {
    return await auth.createUser({ email, password, displayName, emailVerified: true })
  }
}

async function main() {
  // ── Consultorio B, con su médico y su paciente ────────────────────────
  const b = await usuario(MEDICO_B)
  await db.doc(`clinics/${CLINICA_B}`).set({
    nombreClinica: 'Consultorio Berrondo — Medicina Interna',
    nombreMedico: MEDICO_B.displayName,
    plan: 'trial',
    status: 'trial',
    createdAt: ISO,
  })
  await db.doc(`clinic_members/${b.uid}`).set({
    clinicId: CLINICA_B,
    role: 'medico',
    displayName: MEDICO_B.displayName,
    createdAt: ISO,
  })
  await db.doc(`clinics/${CLINICA_B}/patients/${PACIENTE_B}`).set({
    id: PACIENTE_B,
    nombre: 'Hilaria Mondragón Zepeda',
    telefono: '+52 55 5555 0901',
    fechaNacimiento: '1968-11-02',
    edad: 57,
    sexo: 'Femenino',
    alergias: 'Ninguna conocida',
    clinicId: CLINICA_B,
    createdAt: ISO,
  })

  // ── Paquete RELEASED en A (lo que el paciente SÍ debe leer) ───────────
  //
  // La forma sale del tipo `PaqueteDeVisita`, no de la memoria: `estado` (no
  // `status`), `approvedAt` en epoch ms (no ISO), y la ruta es
  // `clinics/{c}/patients/{p}/paquetes_visita/{notaId}` — el id del documento ES
  // el notaId, que es de donde le viene la idempotencia al camino real.
  //
  // `medicationInstructions` lleva SÓLO lo prescrito hoy. Si aquí se colara un
  // antecedente, la prueba de «receta sin intención médica» estaría midiendo la
  // siembra en vez del producto.
  const prescriptor = {
    nombre: 'Dra. Elena Sandoval Rivas',
    cedulaProfesional: '00000000',
    especialidad: 'Medicina Interna',
  }
  const paqueteBase = {
    fechaConsulta: ISO,
    encounterSummary: 'Consulta de seguimiento. Se ajusta tratamiento y se pide control.',
    medicationChanges: null,   // `null` = no se pudo determinar; NO «sin cambios».
    orders: ['Biometría hemática de control'],
    followUp: 'Cita en cuatro semanas.',
    // Vacíos A PROPÓSITO: indicación médica y evidencia curada. Rellenarlos aquí
    // sería inventar una cifra clínica dentro de un fixture.
    warningSigns: [],
    educationalMaterial: [],
    documents: [],
    unansweredQuestions: [],
    clinicianContactRules: 'Si algo empeora, llama al consultorio.',
    prescriptor,
    language: 'es-MX',
    version: 1,
  }
  await db
    .doc(`clinics/${CLINICA_A}/patients/${PACIENTE_A_LIBERADO}/paquetes_visita/nota-luzmaria-1`)
    .set({
      ...paqueteBase,
      notaId: 'nota-luzmaria-1',
      medicationInstructions: [
        // La instrucción se escribe con la forma que produce `comoTomarlo`
        // —nombre primero, separado por «·»—. Una redacción inventada aquí
        // hacía que la prueba buscase el fármaco y no lo encontrase, y por poco
        // se reporta como defecto del portal lo que era un fixture mal hecho.
        { nombre: 'Amoxicilina', instruccion: 'Amoxicilina · 500 mg · por la boca · cada 8 horas (3 veces al día) · durante 7 días' },
      ],
      alergias: 'Sulfas (urticaria, 2021)',
      estado: 'RELEASED',
      approvedAt: Date.now(),
      approvedBy: 'medico-siembra-gp-final',
    })

  // ── Paquete DRAFT en A (el que NUNCA debe salir) ──────────────────────
  //
  // Sembrado a mano y no por el camino del producto: así la prueba muerde la
  // compuerta del servidor, y no la del botón que lo creó.
  await db
    .doc(`clinics/${CLINICA_A}/patients/${PACIENTE_A_BORRADOR}/paquetes_visita/nota-aurelio-1`)
    .set({
      ...paqueteBase,
      notaId: 'nota-aurelio-1',
      medicationInstructions: [
        { nombre: 'Metformina', instruccion: 'Metformina · 850 mg · por la boca · cada 12 horas (2 veces al día) · continuo' },
      ],
      alergias: 'Penicilina (rash generalizado, 2019)',
      estado: 'DRAFT',
      approvedAt: null,
      approvedBy: null,
    })

  // ── Estado que el recorrido consume, devuelto a cero ─────────────────
  //
  // El consentimiento de grabación se guarda en el expediente y dura «una vez
  // por paciente, y ya» (decisión del dueño). Es correcto para el producto y
  // veneno para una prueba: la segunda corrida ya no ve el diálogo y concluye
  // que se grabó sin consentimiento. Pasó, y dio un P0 falso.
  //
  // Un Golden Path que sólo vale la primera vez no es reproducible, así que la
  // siembra devuelve el expediente al estado de partida.
  for (const pid of [PACIENTE_A_BORRADOR, 'pac-refugio-alcantara']) {
    await db.doc(`clinics/${CLINICA_A}/patients/${pid}`)
      .set({ consentimientoGrabacion: null }, { merge: true })
  }

  // ── La configuración del consultorio, COMPLETA ───────────────────────
  //
  // `sembrar-capturas` deja el nombre del médico en `clinics/{id}`, pero la
  // firma lo lee de `clinics/{id}/config/main`, que nacía sin él. Un consultorio
  // así puede firmar (NOM-004 no pide el nombre) y luego no puede entregarle
  // nada al paciente (`componerPaquete` sí lo pide): es REG-336, y el Golden
  // Path lo encontró precisamente porque la siembra lo reproducía sin querer.
  //
  // Aquí se siembra el consultorio BIEN configurado, que es el caso normal. El
  // caso roto lo provoca el recorrido a propósito, y comprueba que ahora la
  // firma se niegue y diga por qué.
  await db.doc(`clinics/${CLINICA_A}/config/main`).set({
    nombreMedico: 'Dra. Elena Sandoval Rivas',
    cedulaProfesional: '12345678',
    especialidad: 'Medicina Interna',
    nombreClinica: 'Consultorio de Medicina Interna Reforma',
    updatedAt: ISO,
  }, { merge: true })

  // ── El freno de peticiones, a cero ───────────────────────────────────
  //
  // El limitador cuenta por ventana fija en `rate_limits`. La ráfaga del paso 33
  // deja esa ventana gastada, y la corrida SIGUIENTE se encontraba el portal
  // devolviendo 429 desde el primer clic — y concluía que el paciente no ve su
  // medicación. Un recorrido que se envenena a sí mismo entre corridas no es
  // reproducible, que es lo único que se le pide a un Golden Path.
  const limites = await db.collection('rate_limits').get()
  await Promise.all(limites.docs.map(d => d.ref.delete()))

  // ── Revocación: el expediente sube su contador de enlaces ─────────────
  // Un enlace emitido con la versión anterior tiene que dejar de valer.
  await db.doc(`clinics/${CLINICA_A}/patients/${PACIENTE_A_REVOCADO}`)
    .set({ portalTokenVersion: 3 }, { merge: true })

  console.log(
    `Siembra GP-FINAL: consultorio B ${CLINICA_B} (médico ${MEDICO_B.email}, uid ${b.uid}), ` +
    `1 paciente en B, 1 paquete RELEASED y 1 DRAFT en A, ` +
    `${PACIENTE_A_REVOCADO} con portalTokenVersion=3.`,
  )
}

main().catch((e) => { console.error(e); process.exit(1) })

/**
 * SIEMBRA EXTRA PARA EL ARNÉS DE RTC-30 (cuarta aplicación).
 *
 * Se ejecuta DESPUÉS de `sembrar-capturas.mjs` y sólo AÑADE lo que hace falta
 * para poder ver los estados vacíos que se están reparando. Vive aparte a
 * propósito: los otros arneses de V15 comparan contra los recuentos del
 * consultorio base («6 expedientes», «6 citas»), y meterle pacientes a la
 * siembra compartida los rompería a todos.
 *
 * Qué añade, y por qué cada cosa:
 *
 *   FARMACIA — 4 ítems en 2 categorías. Sin ellos `/farmacia` sólo puede
 *   enseñar el vacío de inventario entero (que es correcto y no se toca): el
 *   defecto que se repara aparece con ítems DENTRO y un filtro que los tapa.
 *
 *   REACTIVACIÓN — 3 pacientes que llevan tiempo sin volver y que la pantalla
 *   NO enseña, uno por cada causa que antes se callaba:
 *     · sin teléfono (400 días)     → no se le puede escribir
 *     · con baja de WhatsApp (400)  → pidió no recibir mensajes
 *     · a 120 días                  → lo esconde la píldora del umbral
 *
 * Todo inventado y determinista (`data-privacy.md`: cero pacientes reales). El
 * candado anti-producción es el mismo: el proyecto empieza por `demo-`.
 *
 * Uso (emuladores levantados, después de sembrar-capturas):
 *   node scripts/design/sembrar-rtc30.mjs
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'demo-nexusmed-test'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'

if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error('El proyecto de siembra DEBE empezar por demo- (candado anti-producción)')
}

const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
const db = getFirestore(app)

const CLINIC_ID = 'clinica-capturas-v10'
const hoy = new Date()
const ISO = hoy.toISOString()
const dia = (n) => {
  const d = new Date(hoy.getTime() + n * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * La CLAVE del documento de baja es el teléfono ya normalizado
 * (`normalizarTelefonoWa`: dígitos, prefijo 52, sin el «1» de móvil). Escribirlo
 * a mano aquí es a propósito — el sembrador no importa código de `src/` — y por
 * eso el arnés comprueba que la baja de verdad MUERDA: si esta cadena no casara,
 * el paciente saldría como candidato y la condición fallaría en vez de pasar
 * inadvertida.
 */
const TEL_DE_BAJA = '525555550091'

const ITEMS = [
  { id: 'far-amoxicilina', nombre: 'Amoxicilina 500 mg cápsulas', categoria: 'medicamento', presentacion: 'Caja con 12', cantidad: 24, cantidadMinima: 6, lote: 'L-8841', proveedor: 'Distribuidora Norte', caducidad: dia(400) },
  { id: 'far-paracetamol', nombre: 'Paracetamol 500 mg tabletas', categoria: 'medicamento', presentacion: 'Caja con 20', cantidad: 40, cantidadMinima: 10, lote: 'L-2213', proveedor: 'Distribuidora Norte', caducidad: dia(500) },
  { id: 'far-gasas', nombre: 'Gasas estériles 10×10', categoria: 'material_curacion', presentacion: 'Paquete con 10', cantidad: 30, cantidadMinima: 8, lote: 'G-0071', proveedor: 'Insumos Reforma', caducidad: dia(700) },
  { id: 'far-jeringas', nombre: 'Jeringas 5 mL', categoria: 'consumible', presentacion: 'Caja con 100', cantidad: 12, cantidadMinima: 20, lote: 'J-5510', proveedor: 'Insumos Reforma', caducidad: dia(600) },
]

const PACIENTES = [
  {
    id: 'pac-rtc30-sin-telefono',
    nombre: 'Rosalinda Cázares Montiel',
    // SIN teléfono ni whatsapp: el caso que más se parecía a un éxito.
    telefono: '', whatsapp: '',
    fechaNacimiento: '1961-05-14', edad: 65, sexo: 'Femenino',
    alergias: '', seguroMedico: '', tags: [],
    notas: 'Sin datos de contacto capturados.',
    ultimaCita: dia(-400),
  },
  {
    id: 'pac-rtc30-de-baja',
    nombre: 'Ernesto Villalpando Cruz',
    telefono: '+52 55 5555 0091', whatsapp: '+52 55 5555 0091',
    fechaNacimiento: '1975-09-09', edad: 50, sexo: 'Masculino',
    alergias: '', seguroMedico: '', tags: [],
    notas: 'Pidió no recibir mensajes.',
    ultimaCita: dia(-400),
  },
  {
    id: 'pac-rtc30-bajo-umbral',
    nombre: 'Leonor Bustamante Ríos',
    telefono: '+52 55 5555 0092', whatsapp: '+52 55 5555 0092',
    fechaNacimiento: '1983-02-21', edad: 43, sexo: 'Femenino',
    alergias: '', seguroMedico: '', tags: [],
    notas: 'Control anual pendiente.',
    ultimaCita: dia(-120),
  },
]

async function main() {
  for (const { id, ...datos } of ITEMS) {
    await db.doc(`clinics/${CLINIC_ID}/farmacia/${id}`).set({
      ...datos, activo: true, createdAt: ISO, updatedAt: ISO, creadoPor: 'siembra-rtc30',
    })
  }
  for (const { id, ...datos } of PACIENTES) {
    await db.doc(`clinics/${CLINIC_ID}/patients/${id}`).set({ ...datos, createdAt: ISO, updatedAt: ISO })
  }
  // El id del documento de baja ES el teléfono normalizado (así lo lee la pantalla).
  await db.doc(`clinics/${CLINIC_ID}/whatsapp_optout/${TEL_DE_BAJA}`).set({
    motivo: 'BAJA solicitada por el paciente', fecha: ISO,
  })
  console.log(`Siembra RTC-30: ${ITEMS.length} ítems de farmacia, ${PACIENTES.length} pacientes sin volver, 1 baja de WhatsApp.`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })

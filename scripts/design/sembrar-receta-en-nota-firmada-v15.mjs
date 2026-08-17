/**
 * SIEMBRA ADITIVA — dos medicamentos en una nota YA FIRMADA de la siembra base,
 * para que el cierre del encuentro tenga una receta que entregar.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * WF-05 del banco de flujos (`V15-WORKFLOW-BENCHMARK-001`) recorre
 * ENCUENTRO → RECETA → VUELTA A LA CONTINUIDAD. Ese camino lo abre
 * `ComoCerrarLaConsulta`, que sólo se pinta sobre una nota **firmada** y sólo
 * ofrece el paso de receta si `hayMedicamentos`.
 *
 * Medido antes de escribir esto: **ninguna** nota de `sembrar-capturas.mjs`
 * lleva medicamentos — el sembrador las escribe todas con `medicamentos: []`
 * (línea 729). O sea que sobre la siembra base WF-05 no se puede recorrer, y no
 * porque el producto no lo sostenga: porque el corpus no lo alcanza. Declarar
 * «UNVERIFIABLE» ahí sería declarar una limitación del banco como si fuera del
 * producto.
 *
 * ── POR QUÉ MODIFICA UNA NOTA EN VEZ DE CREAR OTRA ─────────────────────────
 *
 * Crear una nota nueva obliga a escribir a mano su forma entera —secciones,
 * metadatos, sellos— y esa segunda lista diverge de la del sembrador a la
 * tercera edición (REG-318, la misma lección que ya se aprendió dentro de un
 * medidor). Aquí se lee el documento REAL que ya sembró `sembrar-capturas.mjs`
 * y se le añade lo único que le falta: el arreglo de medicamentos. Todo lo
 * demás lo sigue mandando el sembrador base.
 *
 * Si la nota no existe, esto NO la inventa: avisa y sale con error. Una siembra
 * que se arregla sola escondería que la base cambió.
 *
 * ── LO QUE NO HACE, DECLARADO ──────────────────────────────────────────────
 *
 * No firma nada nuevo, no crea órdenes, no toca al paciente ni a las tareas del
 * worklist. Y los dos fármacos son de libro, a dosis de adulto sin ajuste: NO
 * son una recomendación clínica ni un caso de prueba de seguridad de dosis —
 * son dos filas para que el checklist de cierre tenga qué ofrecer.
 *
 * Uso (emuladores levantados; DESPUÉS de sembrar-capturas.mjs):
 *   node scripts/design/sembrar-receta-en-nota-firmada-v15.mjs
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'demo-nexusmed-test'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'

if (!PROJECT_ID.startsWith('demo-')) {
  throw new Error('El proyecto de siembra DEBE empezar por demo- (candado anti-producción)')
}

const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
const db = getFirestore(app)

const CLINIC_ID = 'clinica-capturas-v10'
const NOTA_ID = 'nota-luzmaria-1'   // firmada, ITU de repetición, de la siembra base
const PACIENTE_ID = 'pac-luzmaria-cervantes'

/** Forma `Medicamento` de `src/types/expediente.ts`. Sintéticos, como todo aquí. */
const MEDICAMENTOS = [
  {
    nombre: 'Nitrofurantoína',
    dosis: '100 mg',
    via: 'oral',
    frecuencia: 'cada 12 horas',
    duracion: '5 días',
    indicacion: 'Infección urinaria no complicada',
  },
  {
    nombre: 'Paracetamol',
    dosis: '500 mg',
    via: 'oral',
    frecuencia: 'cada 8 horas por razón necesaria',
    duracion: '3 días',
    indicacion: 'Molestia miccional',
  },
]

/* La ruta REAL que escribe `sembrar-capturas.mjs` (línea 725): las notas
   cuelgan del paciente, no de la clínica. La primera versión de esta siembra
   apuntó a `clinicas/<c>/notas/<n>` y salió con «la nota no existe» sobre una
   nota que sí existía — el fallo cerrado hizo su trabajo. */
const ref = db.doc(`clinics/${CLINIC_ID}/patients/${PACIENTE_ID}/notas/${NOTA_ID}`)
const snap = await ref.get()
if (!snap.exists) {
  console.error(
    `[siembra-receta] La nota ${NOTA_ID} no existe. ` +
    'Corre antes scripts/design/sembrar-capturas.mjs. No se inventa nada.',
  )
  process.exit(1)
}
const nota = snap.data()
if (nota.estado !== 'firmada') {
  console.error(`[siembra-receta] ${NOTA_ID} no está firmada (estado: ${nota.estado}). El cierre sólo se pinta sobre una nota firmada.`)
  process.exit(1)
}

await ref.update({ medicamentos: MEDICAMENTOS })
console.log(`[siembra-receta] ${NOTA_ID} (${nota.pacienteNombre}) ← ${MEDICAMENTOS.length} medicamentos`)

/**
 * SIEMBRA ADITIVA — una cita POR DELANTE de la hora actual, para que el héroe
 * NOW de Hoy se pinte a cualquier hora del día.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * `sembrar-capturas.mjs` planta la agenda del día en horas FIJAS (09:00 a
 * 17:00). El héroe NOW de `/dashboard` sólo se pinta si queda una cita por
 * delante (`stats.prox`: la primera cuya `fechaHora >= hoy HH:MM`), y la hora
 * la manda el reloj del consultorio (`America/Mexico_City`), no el del
 * contenedor.
 *
 * Consecuencia medida: una corrida de madrugada UTC —o sea, de noche en
 * México— abre Hoy SIN héroe, y el control primario de la pantalla no se
 * puede medir en navegador real. Eso no es un dato del producto: es el reloj
 * de la máquina decidiendo qué se audita. Un routine que corre a una hora
 * distinta cada día no puede tener una vara que dependa de la hora.
 *
 * Esto añade UNA cita sintética 40 minutos por delante de la hora del
 * consultorio, en el día del consultorio. No toca ninguna de las siete de la
 * siembra base: se suma, con id propio, y usa un paciente que ya existe.
 *
 * LO QUE NO ARREGLA, declarado: si la hora del consultorio pasa de las 23:19
 * la cita se ancla a las 23:59 y, después de esa hora, el héroe sigue sin
 * pintarse. Se declara en vez de fingir que la ventana es de 24 h.
 *
 * Uso (emuladores levantados; DESPUÉS de sembrar-capturas.mjs):
 *   node scripts/design/sembrar-cita-por-delante-v15.mjs
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
/** La misma zona que publica el producto (`TZ_DEFAULT` de src/lib/timezone.ts). */
const ZONA = 'America/Mexico_City'

/** `YYYY-MM-DD HH:MM` en la zona del consultorio, como los guarda el producto. */
function enZona(fecha) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(fecha).reduce((a, x) => (a[x.type] = x.value, a), {})
  // `hour12: false` puede devolver «24» a medianoche en algunas plataformas.
  const hh = p.hour === '24' ? '00' : p.hour
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${hh}:${p.minute}` }
}

const ahora = enZona(new Date())
const dentroDe40 = enZona(new Date(Date.now() + 40 * 60000))
// Si los 40 minutos cruzan la medianoche del consultorio, se ancla al final
// del MISMO día: el héroe mira la agenda de hoy, no la de mañana.
const hora = dentroDe40.dia === ahora.dia ? dentroDe40.hora : '23:59'

/**
 * La FORMA sale de una cita ya sembrada, no de una lista escrita a mano aquí.
 * Un segundo molde para la misma entidad empieza idéntico y diverge a la
 * tercera edición — es la lección de REG-318, y aquí sería peor: la copia
 * viviría en el instrumento que audita al producto.
 */
const modelo = await db.doc(`clinics/${CLINIC_ID}/appointments/cita-hoy-1030`).get()
if (!modelo.exists) {
  throw new Error('Falta la siembra base: corre antes scripts/design/sembrar-capturas.mjs')
}

await db.doc(`clinics/${CLINIC_ID}/appointments/cita-por-delante-v15`).set({
  ...modelo.data(),
  fechaHora: `${ahora.dia} ${hora}`,
  estado: 'confirmada',
  updatedAt: new Date().toISOString(),
})

console.log(`Cita por delante: ${ahora.dia} ${hora} (${ZONA}; ahora son las ${ahora.hora})`)
process.exit(0)

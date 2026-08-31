/**
 * BUILD EQUIVALENTE AL PREVIEW DE VERCEL.
 *
 * ── POR QUÉ EXISTE (27-ago-2026) ─────────────────────────────────────────────
 *
 * El 27 de agosto se integraron cuatro lotes de trabajo con merges remotos
 * consecutivos. Cada push disparó un Preview de Vercel sobre un estado
 * intermedio que nadie había construido. El de `1d9a55f3` salió ROJO:
 *
 *     src/lib/firestore.ts(246,14): error TS2304: Cannot find name 'idIdempotente'
 *
 * El merge se había quedado con la LLAMADA de una rama y con los IMPORTS de la
 * otra. Git no vio conflicto —las líneas no se solapaban— así que fusionó
 * limpio y rompió el tipo. Un conflicto semántico no lo caza `git`: lo caza el
 * compilador, y a nadie le dio tiempo a correrlo antes del push siguiente.
 *
 * ── EL DESNIVEL QUE ESTE SCRIPT CIERRA ───────────────────────────────────────
 *
 * `npm run build` aquí hereda el entorno de quien lo lanza. Si esa máquina
 * tiene un `.env.local` (gitignoreado) con las `NEXT_PUBLIC_FIREBASE_*`, el
 * build pasa. El Preview de Vercel NO tiene ese archivo: tiene sus Preview
 * Environment Variables, que son otro conjunto y las gestiona el dueño.
 *
 * Es el mismo accidente que ya documenta REG-059
 * (`src/__tests__/servidor-sin-sdk-cliente.test.ts`): «en Vercel no se notaba
 * porque ahí sí existen — el build de producción funcionaba POR ACCIDENTE».
 * Un verde que depende de un archivo que el destinatario no tiene no es un
 * verde: es una coincidencia.
 *
 * Así que aquí el entorno se FRIEGA y se reconstruye desde el manifiesto:
 * quedan exactamente los nombres declarados en
 * `ops/vercel/preview-env.manifest.json`, con relleno de FORMA válida, y nada
 * más. Lo que sobrevive a eso sobrevive al Preview.
 *
 * ── LO QUE ESTE SCRIPT **NO** HACE, DECLARADO ────────────────────────────────
 *
 *   · No habla con Vercel. No lee el proyecto, ni sus variables, ni despliega.
 *     No puede: no tiene credenciales, y no debe tenerlas.
 *   · No conoce ningún valor real. Inyecta relleno sintético y sólo para los
 *     nombres PÚBLICOS del manifiesto — los que ya viajan dentro del bundle a
 *     todos los navegadores, así que no hay nada que filtrar.
 *   · No inyecta NI UN secreto. Si el build pide uno, eso es un defecto del
 *     árbol (código de servidor ejecutándose al compilar) y se reporta POR EL
 *     NOMBRE de la variable, nunca por su valor.
 *   · No sustituye al Preview: no cubre cabeceras, rewrites del edge, ni
 *     runtime. Cubre lo que rompió el 27-ago —compilación y tipos— y el
 *     desnivel de entorno. Lo demás sigue siendo trabajo del Preview real.
 *
 *   node scripts/preview-equivalente.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const MANIFIESTO = 'ops/vercel/preview-env.manifest.json'

// Relleno con FORMA válida. Un proyecto que no existe, a propósito: si algo
// intentara contactar a Firebase durante el build, fallaría en vez de tocar
// datos de alguien. Mismo criterio que el job `verificar` del CI.
const RELLENO = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyBUILD-ONLY-PLACEHOLDER-000000000000',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'preview-equivalente.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'preview-equivalente',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'preview-equivalente.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
}

const manifiesto = JSON.parse(readFileSync(MANIFIESTO, 'utf8'))
const exigidas = manifiesto.publicas_que_el_build_exige.nombres

const faltanEnRelleno = exigidas.filter(n => !(n in RELLENO))
if (faltanEnRelleno.length > 0) {
  console.error(
    'El manifiesto exige nombres para los que este script no tiene relleno:\n  ' +
    faltanEnRelleno.join('\n  ') +
    '\n\nUna compuerta que no puede montar el entorno que declara no protege: se falla.'
  )
  process.exit(1)
}

// ── FREGAR ──────────────────────────────────────────────────────────────────
// Se cae TODO lo que empiece por NEXT_PUBLIC_ (lo que el bundle se lleva) y las
// dos que redirigen el SDK a un emulador. Lo demás del entorno se conserva:
// PATH, HOME y compañía hacen falta para que `next` arranque, y ninguna de
// ellas entra al bundle.
const entorno = { ...process.env }
const fregadas = []
for (const nombre of Object.keys(entorno)) {
  if (nombre.startsWith('NEXT_PUBLIC_')) { delete entorno[nombre]; fregadas.push(nombre) }
}
for (const nombre of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (nombre in entorno) { delete entorno[nombre]; fregadas.push(nombre) }
}

for (const nombre of exigidas) entorno[nombre] = RELLENO[nombre]
entorno.NEXT_TELEMETRY_DISABLED = '1'
entorno.NODE_ENV = 'production'

console.log('── build equivalente a Preview ──────────────────────────────────')
console.log(`entorno fregado    : ${fregadas.length} nombre(s) retirados`)
if (fregadas.length > 0) console.log(`                     ${fregadas.sort().join(', ')}`)
console.log(`entorno inyectado  : ${exigidas.join(', ')}`)
console.log('secretos inyectados: NINGUNO (invariante del manifiesto)')
console.log('─────────────────────────────────────────────────────────────────\n')

try {
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit', env: entorno })
} catch {
  console.error(
    '\n── PREVIEW EQUIVALENTE: ROJO ────────────────────────────────────\n' +
    'Este árbol haría rojo el Preview de Vercel. NO se empuja.\n\n' +
    'Si el fallo nombra una variable que no está en el manifiesto, hay dos\n' +
    'salidas y sólo el dueño elige: declararla en las Preview Environment\n' +
    'Variables de Vercel, o dejar de leerla durante el build. Este script no\n' +
    'toca ninguna de las dos — y no imprime valores, sólo nombres.\n' +
    '─────────────────────────────────────────────────────────────────'
  )
  process.exit(1)
}

console.log('\n── PREVIEW EQUIVALENTE: VERDE ───────────────────────────────────')
console.log('El build sobrevive sin heredar entorno local. Cubre compilación y')
console.log('tipos, no cabeceras ni runtime: eso sigue siendo del Preview real.')
console.log('─────────────────────────────────────────────────────────────────')

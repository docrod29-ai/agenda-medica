#!/usr/bin/env node
/**
 * BACKFILL de `pesoUrgencia` en `tareas_clinicas` — P1-14.
 *
 * ── QUÉ HACE Y POR QUÉ HACE FALTA ────────────────────────────────────────────
 *
 * El worklist ordena por urgencia en el SERVIDOR, y para eso Firestore necesita
 * un número: la palabra no se puede ordenar (en alfabético `alta` iría antes que
 * `critica`). `pesoUrgencia` es esa proyección, y desde P1-14 la escribe
 * `crearTareas` en cada tarea nueva.
 *
 * Las tareas escritas ANTES no lo tienen. Y un `orderBy` de Firestore no ordena
 * los documentos a los que les falta el campo: **los EXCLUYE**. Mientras esto no
 * corra, `tareasVivas` hace una segunda lectura por antigüedad para que ninguna
 * tarea histórica desaparezca del worklist — y lo dice en `migracionPendiente`.
 *
 * Este script quita esa necesidad. Cuando termine, `migracionPendiente` se apaga
 * solo, porque se MIDE: no hay que acordarse de cambiar ninguna bandera.
 *
 * ── LO QUE NO HACE, A PROPÓSITO ──────────────────────────────────────────────
 *
 * · **No toca `prioridad`.** Ni la deduce, ni la corrige, ni la rellena. Una
 *   tarea sin prioridad legible se escribe con el peso «sin clasificar», que la
 *   manda al final del worklist pero **la deja dentro**. Inventarle una
 *   prioridad sería decidir urgencia clínica desde un script.
 * · **No borra ni mueve nada.** Sólo añade un campo derivado.
 * · **No decide cuándo correrlo.** Correr algo contra datos clínicos vivos es
 *   del dueño.
 *
 * ── CÓMO SE CORRE ────────────────────────────────────────────────────────────
 *
 *   # 1 · ver qué haría, sin escribir nada (por defecto)
 *   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> \
 *     node scripts/migraciones/peso-de-urgencia.mjs --proyecto nexomed-agenda
 *
 *   # 2 · escribir
 *   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> \
 *     node scripts/migraciones/peso-de-urgencia.mjs --proyecto nexomed-agenda --escribir
 *
 * Es IDEMPOTENTE: vuelve a calcular el mismo número de la misma `prioridad`, así
 * que correrlo dos veces no cambia nada. Se puede parar y reanudar.
 *
 * ── EL ORDEN CON EL RESTO DEL DESPLIEGUE ─────────────────────────────────────
 *
 * 1. `npx firebase deploy --only firestore:indexes` y esperar a `Enabled`.
 * 2. Fusionar el código.
 * 3. Este script.
 *
 * Los tres pasos son independientes y ninguno rompe si otro no ha corrido: el
 * código se cae al camino de antigüedad si falta el índice
 * (`conRespaldoSinIndice`) y hace la segunda lectura mientras falte el backfill.
 * El orden es para que el producto esté BIEN, no para que no se rompa.
 */
import { readFileSync } from 'node:fs'

/* La escalera vive en `src/lib/tareas-clinicas/modelo.ts` y se LEE de ahí, no se
   copia: una segunda tabla de pesos que se desincronizara escribiría números que
   ordenan al revés de lo que ve el médico, y nada lo diría. */
const MODELO = readFileSync('src/lib/tareas-clinicas/modelo.ts', 'utf8')

function escaleraDelModelo() {
  const bloque = MODELO.match(/ESCALERA_DE_URGENCIA:\s*Record<Prioridad,\s*number>\s*=\s*\{([\s\S]*?)\}/)
  if (!bloque) throw new Error('No se pudo leer ESCALERA_DE_URGENCIA de modelo.ts')
  const escalera = {}
  for (const m of bloque[1].matchAll(/([a-zA-Z_]+)\s*:\s*(\d+)/g)) escalera[m[1]] = Number(m[2])
  const sinClasificar = MODELO.match(/PESO_SIN_CLASIFICAR\s*=\s*(\d+)/)
  if (!sinClasificar) throw new Error('No se pudo leer PESO_SIN_CLASIFICAR de modelo.ts')
  if (!Object.keys(escalera).length) throw new Error('ESCALERA_DE_URGENCIA salió vacía')
  return { escalera, sinClasificar: Number(sinClasificar[1]) }
}

const { escalera, sinClasificar } = escaleraDelModelo()
const peso = p => (typeof p === 'string' && p in escalera ? escalera[p] : sinClasificar)

const args = process.argv.slice(2)
const escribir = args.includes('--escribir')
const proyecto = args[args.indexOf('--proyecto') + 1]

if (!proyecto || proyecto.startsWith('--')) {
  console.error('Falta --proyecto <id>. Ver la cabecera de este archivo.')
  process.exit(2)
}

console.log(`Escalera leída de modelo.ts: ${JSON.stringify(escalera)}  ·  sin clasificar: ${sinClasificar}`)
console.log(escribir ? 'MODO ESCRITURA' : 'ENSAYO (no escribe). Añade --escribir para aplicar.')

const { initializeApp, applicationDefault } = await import('firebase-admin/app')
const { getFirestore, FieldPath } = await import('firebase-admin/firestore')
initializeApp({ credential: applicationDefault(), projectId: proyecto })
const db = getFirestore()

const PAGINA = 400
let vistas = 0, escritas = 0, yaEstaban = 0, sinPrioridad = 0

const clinicas = await db.collection('clinics').select().get()
console.log(`Consultorios: ${clinicas.size}`)

for (const clinica of clinicas.docs) {
  const col = clinica.ref.collection('tareas_clinicas')
  let cursor = null
  for (;;) {
    /* Se pagina por `__name__`, que no necesita índice y no se salta nada aunque
       alguien escriba mientras esto corre. */
    let q = col.orderBy(FieldPath.documentId()).limit(PAGINA)
    if (cursor) q = q.startAfter(cursor)
    const snap = await q.get()
    if (snap.empty) break
    cursor = snap.docs[snap.docs.length - 1]

    const lote = db.batch()
    let enLote = 0
    for (const d of snap.docs) {
      vistas += 1
      const prioridad = d.get('prioridad')
      if (typeof prioridad !== 'string') sinPrioridad += 1
      const quiere = peso(prioridad)
      if (d.get('pesoUrgencia') === quiere) { yaEstaban += 1; continue }
      if (escribir) { lote.update(d.ref, { pesoUrgencia: quiere }); enLote += 1 }
      escritas += 1
    }
    if (escribir && enLote) await lote.commit()
    if (snap.size < PAGINA) break
  }
}

/* RECUENTOS, NUNCA CONTENIDO: estos documentos llevan PHI. Regla
   `data-privacy.md` y `scripts/verificar-invariantes-de-datos.md`. */
console.log(`\nTareas vistas          ${vistas}`)
console.log(`Ya tenían el peso bien ${yaEstaban}`)
console.log(`${escribir ? 'Escritas' : 'Se escribirían'}         ${escritas}`)
console.log(`Sin prioridad legible  ${sinPrioridad}  (van con peso ${sinClasificar}: al final del worklist, NO fuera)`)
if (!escribir && escritas) console.log('\nEnsayo. Nada se escribió. Repite con --escribir.')

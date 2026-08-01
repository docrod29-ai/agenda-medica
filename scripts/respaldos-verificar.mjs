#!/usr/bin/env node
/**
 * ¿ESTÁN LOS RESPALDOS ENCENDIDOS DE VERDAD?
 *
 * ── POR QUÉ HACÍA FALTA ESTO ─────────────────────────────────────────────────
 *
 * La guía de cómo activarlos existe desde hace tiempo (`docs/RESPALDOS_Y_APPCHECK.md`).
 * Lo que faltaba —y es lo que la auditoría marcó como P0-6— era EVIDENCIA: nadie
 * podía decir si estaban puestos, ni desde cuándo, ni si el último respaldo era
 * de anoche o de hace tres meses.
 *
 * «Creo que lo activé» y «está activado» se parecen muchísimo hasta el día que
 * hay que restaurar. Este script convierte la creencia en una respuesta.
 *
 * ── ES DE SOLO LECTURA ───────────────────────────────────────────────────────
 *
 * No crea, no borra, no restaura, no cambia nada. Sólo pregunta y reporta. Un
 * script que verifica respaldos y además los toca es un script que puede
 * romperlos, y sería el peor sitio posible para un error.
 *
 *   node scripts/respaldos-verificar.mjs                  (usa el proyecto activo)
 *   node scripts/respaldos-verificar.mjs mi-proyecto-id
 *
 * Sale con código 1 si algo falta, para poder colgarlo de una tarea programada.
 */
import { execFileSync } from 'node:child_process'

const V = '\x1b[32m', R = '\x1b[31m', A = '\x1b[33m', G = '\x1b[90m', F = '\x1b[0m', N = '\x1b[1m'

/** Corre gcloud y devuelve la salida, o `null` si falló. Nunca lanza. */
function gcloud(args) {
  try {
    return execFileSync('gcloud', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    return null
  }
}

function proyecto() {
  if (process.argv[2]) return process.argv[2]
  const p = gcloud(['config', 'get-value', 'project'])
  return (p ?? '').trim().replace(/^\(unset\)$/, '')
}

const DIAS = ms => Math.floor(ms / 86_400_000)

console.log(`\n${N}Respaldos de Firestore — verificación${F}\n`)

if (!gcloud(['--version'])) {
  console.log(`${R}✗${F} No encuentro \`gcloud\` en este equipo.`)
  console.log(`${G}  Instálalo desde https://cloud.google.com/sdk/docs/install y luego \`gcloud auth login\`.${F}\n`)
  process.exit(1)
}

const PROJECT = proyecto()
if (!PROJECT) {
  console.log(`${R}✗${F} No hay proyecto configurado.`)
  console.log(`${G}  Usa: gcloud config set project TU_PROJECT_ID${F}\n`)
  process.exit(1)
}
console.log(`${G}Proyecto:${F} ${PROJECT}\n`)

let problemas = 0

/* ── 1. Recuperación a un punto en el tiempo (PITR) ──────────────────────── */
const desc = gcloud(['firestore', 'databases', 'describe', `--project=${PROJECT}`, '--format=json'])
if (!desc) {
  console.log(`${R}✗${F} No pude leer la base de datos. ¿Tienes permiso en este proyecto?`)
  problemas++
} else {
  let db = {}
  try { db = JSON.parse(desc) } catch { /* formato inesperado */ }
  const pitr = String(db.pointInTimeRecoveryEnablement ?? '')
  if (pitr.includes('ENABLED')) {
    console.log(`${V}✓${F} Recuperación a un punto en el tiempo (PITR): ENCENDIDA`)
    console.log(`${G}  Puedes volver a cualquier instante de los últimos 7 días.${F}`)
  } else {
    console.log(`${R}✗${F} PITR APAGADA — un borrado accidental sería permanente.`)
    console.log(`${G}  gcloud firestore databases update --enable-pitr --project=${PROJECT}${F}`)
    problemas++
  }
}

/* ── 2. Respaldos programados ────────────────────────────────────────────── */
const sched = gcloud(['firestore', 'backups', 'schedules', 'list', `--project=${PROJECT}`, '--database=(default)', '--format=json'])
if (sched === null) {
  console.log(`\n${A}!${F} No pude consultar los respaldos programados.`)
  console.log(`${G}  Puede ser falta de permiso o una versión vieja de gcloud. No es prueba de que falten.${F}`)
  problemas++
} else {
  let lista = []
  try { lista = JSON.parse(sched) } catch { /* vacío */ }
  if (lista.length > 0) {
    console.log(`\n${V}✓${F} Respaldos programados: ${lista.length}`)
    for (const s of lista) console.log(`${G}  · retención ${s.retention ?? '?'}${F}`)
  } else {
    console.log(`\n${R}✗${F} No hay respaldos programados.`)
    console.log(`${G}  gcloud firestore backups schedules create --database='(default)' \\${F}`)
    console.log(`${G}    --recurrence=daily --retention=14d --project=${PROJECT}${F}`)
    problemas++
  }
}

/* ── 3. ¿Cuándo fue el último respaldo REAL? ─────────────────────────────── */
/**
 * Esta es la pregunta que de verdad importa. Una programación configurada y un
 * respaldo que existe no son lo mismo: la programación puede estar puesta y
 * fallando en silencio desde hace semanas.
 */
const backups = gcloud(['firestore', 'backups', 'list', `--project=${PROJECT}`, '--format=json'])
if (backups === null) {
  console.log(`\n${A}!${F} No pude listar los respaldos existentes.`)
  problemas++
} else {
  let lista = []
  try { lista = JSON.parse(backups) } catch { /* vacío */ }
  if (lista.length === 0) {
    console.log(`\n${R}✗${F} No existe NINGÚN respaldo todavía.`)
    console.log(`${G}  Si acabas de programarlos, el primero tarda hasta 24 h en aparecer.${F}`)
    problemas++
  } else {
    const fechas = lista.map(b => Date.parse(b.snapshotTime ?? b.createTime ?? '')).filter(n => Number.isFinite(n))
    const ultimo = Math.max(...fechas)
    const edad = DIAS(Date.now() - ultimo)
    const fecha = new Date(ultimo).toISOString().slice(0, 16).replace('T', ' ')
    if (edad <= 2) {
      console.log(`\n${V}✓${F} Último respaldo: ${fecha} UTC ${G}(hace ${edad} día(s)) · ${lista.length} en total${F}`)
    } else {
      // Un respaldo viejo es más peligroso que ninguno: da tranquilidad falsa.
      console.log(`\n${R}✗${F} El último respaldo es de hace ${edad} DÍAS (${fecha} UTC).`)
      console.log(`${G}  La programación puede estar fallando en silencio. Revísala.${F}`)
      problemas++
    }
  }
}

/* ── Veredicto ───────────────────────────────────────────────────────────── */
console.log('')
if (problemas === 0) {
  console.log(`${V}${N}Todo en orden.${F} Guarda esta salida con la fecha: es la evidencia.`)
  console.log(`${G}Falta una cosa que esto no puede comprobar: haber RESTAURADO alguna vez.`)
  console.log(`Un respaldo que nunca se probó es una hipótesis. Ver docs/SIMULACRO_RESTAURACION.md${F}\n`)
} else {
  console.log(`${R}${N}${problemas} punto(s) por resolver.${F} Los comandos están arriba.\n`)
  process.exit(1)
}

#!/usr/bin/env node
/**
 * LOS DOCUMENTOS DEL ENCUENTRO — nota, receta y orden.
 *
 * ── POR QUÉ ESTABAN SIN MEDIR ───────────────────────────────────────────────
 *
 * Son lo que el médico PRODUCE: lo que se imprime con su cédula profesional. La
 * misión del producto, dicha en `CLAUDE.md`, es «que el médico salga de la
 * consulta con la nota hecha». Y las tres rutas necesitan un `notaId`, que la
 * siembra estándar no crea — así que llevaban fuera del trinquete desde el
 * principio, no por decisión sino por no poder entrar.
 *
 * ── DE DÓNDE SALE LA NOTA ───────────────────────────────────────────────────
 *
 * **No la invento.** Es la misma nota sintética firmada que ya usa
 * `scripts/design/capturar-nota-cromo-v15.mjs`, escrita por un carril anterior,
 * con su paciente sintético y sus cifras. Aquí sólo se reapunta a la clínica y
 * al paciente que siembra `sembrar-emulador.mjs`, para que los datos sean
 * coherentes con el resto del arnés.
 *
 * Buscar antes de crear: el fixture ya existía y reescribirlo habría sido una
 * segunda fuente de verdad de la misma cosa.
 *
 * ── POR QUÉ NO VA EN LA SIEMBRA ESTÁNDAR ────────────────────────────────────
 *
 * Porque cambiaría lo que ven las 69 combinaciones ya medidas —un expediente
 * con nota no es el mismo que uno sin ella— y movería números ya certificados
 * por un motivo que no es un cambio de producto. Se siembra aquí, para lo suyo.
 *
 * ── CANDADO ─────────────────────────────────────────────────────────────────
 *
 * Igual que el guion del que sale: si el proyecto no empieza por `demo-`, para.
 * Nada de esto puede tocar datos reales.
 *
 * ── USO ─────────────────────────────────────────────────────────────────────
 *
 *   (emuladores sembrados + build y servidor CON la configuración del arnés)
 *   node scripts/carril-excelencia/documentos-del-encuentro.mjs
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-nexusmed-v10'
const CLINIC_ID = 'consultorio-demo-v10'
const PATIENT_ID = 'pac-001'
const NOTA_ID = 'nota-arnes-excelencia-firmada'
const BASE = 'http://localhost:3300'
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

async function sembrarNotaFirmada() {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  if (!PROJECT_ID.startsWith('demo-')) throw new Error('candado anti-producción')
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
  const db = getFirestore(app)
  const ISO = new Date().toISOString()
  await db.doc(`clinics/${CLINIC_ID}/patients/${PATIENT_ID}/notas/${NOTA_ID}`).set({
    id: NOTA_ID, clinicId: CLINIC_ID, pacienteId: PATIENT_ID,
    pacienteNombre: 'Rosalía Mendieta Cuevas',
    tipo: 'seguimiento',
    metadata: { establecimiento: 'Consultorio de Medicina Interna', medicoId: 'medico-arnes' },
    resumenEjecutivo: 'Seguimiento de DM2; ajuste de metformina y solicitud de HbA1c de control.',
    secciones: [
      { key: 'subjetivo', label: 'Subjetivo', value: 'Paciente refiere apego al tratamiento. Niega hipoglucemias.' },
      { key: 'plan', label: 'Plan', value: 'Continuar metformina. HbA1c de control en 3 meses.' },
    ],
    signosVitales: { ta: '128/78', fc: '72' },
    diagnosticos: [{ descripcion: 'Diabetes mellitus tipo 2', codigoCIE10: 'E11.9' }],
    medicamentos: [{ nombre: 'Metformina', dosis: '850 mg', via: 'oral', frecuencia: 'cada 12 h', duracion: '90 días' }],
    alergias: [],
    transcripcionCruda: 'Doctor: ¿cómo ha estado de sus niveles? Paciente: bien, sin bajones de azúcar.',
    estado: 'firmada',
    firma: { nombreMedico: 'Dra. Ximena Alcántara Robledo', cedulaProfesional: '12345678', timestamp: ISO },
    fechaConsulta: ISO, createdAt: ISO, updatedAt: ISO, creadoPor: 'arnes-excelencia',
  })
}

await sembrarNotaFirmada()

const RUTAS = [
  `/nota/${PATIENT_ID}/${NOTA_ID}`,
  `/receta/${PATIENT_ID}/${NOTA_ID}`,
  `/orden/${PATIENT_ID}/${NOTA_ID}`,
]

const nav = await chromium.launch({ executablePath: CHROME })
for (const W of [390, 1440]) {
  const ctx = await nav.newContext({ viewport: { width: W, height: W === 390 ? 844 : 900 } })
  const pag = await ctx.newPage()
  await pag.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  try { await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 }) }
  catch {
    console.error('\n  No apareció el formulario de acceso: el servidor sirve un build hecho SIN')
    console.error('  la configuración del arnés. Para, borra .next, construye con ella y arranca.\n')
    await nav.close(); process.exit(2)
  }
  await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
  await pag.locator('input[type=password]').first().fill('demo1234')
  await pag.locator('button[type=submit]').first().click()
  await pag.waitForTimeout(9000)

  for (const ruta of RUTAS) {
    const errs = []
    pag.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 110)) })
    await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
    await pag.waitForTimeout(6500)
    await pag.addScriptTag({ content: AXE })
    const r = await pag.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } })
      return {
        total: r.violations.reduce((s,v)=>s+v.nodes.length,0),
        det: r.violations.flatMap(v => v.nodes.slice(0,3).map(n => {
          const el = document.querySelector(n.target.join(' '))
          const b = el?.getBoundingClientRect()
          return `${v.id}[${v.impact}] ${Math.round(b?.width||0)}x${Math.round(b?.height||0)} «${(el?.textContent||'').trim().slice(0,26)}» ${(n.failureSummary||'').replace(/\n/g,' ').slice(0,110)}`
        })),
        desb: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        aterrizo: location.pathname,
        // La huella dice si se está midiendo el DOCUMENTO o una pantalla de
        // «no encontrado». Sin esto, un id mal sembrado daría axe 0 y parecería
        // una buena noticia.
        huella: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
      }
    })
    if (/no encontrad|no localizamos/i.test(r.huella)) {
      console.error(`\n  ${ruta}: la pantalla dice «no encontrado». La nota no llegó a la base;`)
      console.error('  medir esto sería medir el vacío.\n')
      await nav.close(); process.exit(2)
    }
    console.log(`\n${ruta}@${W}  axe ${r.total}  desborde ${r.desb}  consola ${errs.length}`)
    console.log(`     «${r.huella}»`)
    r.det.forEach(d => console.log(`     ${d}`))
    errs.slice(0, 3).forEach(e => console.log(`     consola: ${e}`))
    pag.removeAllListeners('console')
  }
  await ctx.close()
}
await nav.close()

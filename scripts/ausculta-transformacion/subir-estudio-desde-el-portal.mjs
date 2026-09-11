/**
 * EL PACIENTE SUBE UN ESTUDIO DESDE EL PORTAL, Y EL MÉDICO LO VE — D-058.
 *
 * Sonda de OBSERVAR sobre el arnés con emuladores (auth, firestore y STORAGE):
 * abre el portal con un enlace de alcance clínico, elige un PDF y una foto
 * sintéticos, los envía y comprueba del otro lado —Firestore del emulador— que
 * quedaron registrados bajo `estudios_aportados` y que se abrió una tarea
 * `resultado_por_revisar` por cada uno. «El dato tiene que LLEGAR».
 *
 * Necesita:
 *   npx firebase emulators:start --only auth,firestore,storage --project demo-nexusmed-v10
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node scripts/design/sembrar-emulador.mjs
 *   PORTAL_PACIENTE_SECRET=<cualquiera> FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 npm run arnes:dev
 *   TOKEN=$(PORTAL_PACIENTE_SECRET=<el mismo> npx tsx -e "import { crearTokenPaciente } from './src/lib/patient-token'; console.log(crearTokenPaciente('consultorio-demo-v10','pac-001',7,'clinico',0))")
 *   node scripts/ausculta-transformacion/subir-estudio-desde-el-portal.mjs "$TOKEN" <carpeta-de-salida> [http://localhost:3200]
 *
 * Por eso NO corre en CI. Vista el 10-sep-2026: dos archivos → dos registros →
 * dos tareas; el médico los ve en Laboratorios → «Aportados por el paciente».
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
// Argumentos, no variables de entorno: igual que las demás sondas de esta carpeta.
const [TOKEN, OUT, base = 'http://localhost:3200'] = process.argv.slice(2)
if (!TOKEN || !OUT) { console.error('uso: node subir-estudio-desde-el-portal.mjs <token> <carpeta-de-salida> [base]'); process.exit(2) }
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
writeFileSync(`${OUT}/labs-sinteticos.pdf`, pdf); writeFileSync(`${OUT}/foto-sintetica.png`, png)
const nav = await chromium.launch({ executablePath: CHROME })
const out = {}
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
const consola = []
p.on('console', m => { if (m.type() === 'error') consola.push(m.text().slice(0, 200)) })
p.on('pageerror', e => consola.push('pageerror: ' + String(e).slice(0, 200)))
await p.goto(`${base}/mi/${TOKEN}`, { waitUntil: 'domcontentloaded' })
await p.getByText('Cargando tu información').waitFor({ state: 'hidden', timeout: 90000 }).catch(() => {})
await p.waitForTimeout(1500)
const docs = p.getByRole('button', { name: /Documentos|Mis documentos|Recetas/i }).first()
if (await docs.count()) await docs.click(); else { const l = p.locator('a,button', { hasText: /Documentos/i }).first(); if (await l.count()) await l.click() }
await p.waitForTimeout(1500)
const seccion = p.getByRole('heading', { name: /Subir un estudio/ })
out.seccionVisible = await seccion.count()
if (out.seccionVisible) await seccion.scrollIntoViewIfNeeded()
await p.screenshot({ path: `${OUT}/portal-estudio-390-antes.png` })
await p.setInputFiles('input[type=file]', [`${OUT}/labs-sinteticos.pdf`, `${OUT}/foto-sintetica.png`])
await p.waitForTimeout(500)
await p.screenshot({ path: `${OUT}/portal-estudio-390-elegidos.png` })
await p.getByRole('button', { name: /Enviar a mi médico/ }).click()
await p.waitForTimeout(9000)
await p.screenshot({ path: `${OUT}/portal-estudio-390-despues.png` })
out.textoTrasSubir = await p.locator('body').innerText().then(t => (t.match(/(ya est[áa]n? en tu expediente[^\n]*|No se pudo[^\n]*|no pasó la validación[^\n]*)/) || [''])[0])
out.filas = await p.locator('section[aria-labelledby] li').allInnerTexts().catch(() => [])
out.consola = consola
await ctx.close(); await nav.close()
const H = { headers: { Authorization: 'Bearer owner' } }
const e = await fetch('http://127.0.0.1:8080/v1/projects/demo-nexusmed-v10/databases/(default)/documents/clinics/consultorio-demo-v10/patients/pac-001/estudios_aportados?pageSize=20', H).then(r => r.json())
out.estudiosEnFirestore = (e.documents || []).map(d => ({ id: d.name.split('/').pop(), nombre: d.fields.nombre?.stringValue, ct: d.fields.contentType?.stringValue, bytes: d.fields.bytes?.integerValue, ruta: d.fields.ruta?.stringValue }))
const t = await fetch('http://127.0.0.1:8080/v1/projects/demo-nexusmed-v10/databases/(default)/documents/clinics/consultorio-demo-v10/tareas_clinicas?pageSize=100', H).then(r => r.json())
out.tareasDeEstudio = (t.documents || []).filter(d => d.fields.origen?.stringValue === 'portal:estudio').map(d => ({ id: d.name.split('/').pop(), titulo: d.fields.titulo?.stringValue, tipo: d.fields.tipo?.stringValue, ownerUid: d.fields.ownerUid?.stringValue }))
console.log(JSON.stringify(out, null, 2))

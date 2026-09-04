/**
 * EL DÍA DE UN MÉDICO — el recorrido completo, de entrar a cobrar.
 *
 * POR QUÉ UN RECORRIDO Y NO MÁS ARNESES POR PANTALLA
 * ──────────────────────────────────────────────────
 * Los demás arneses de este carril miran UNA cosa muy bien: que nada tape un
 * control, que el texto largo quepa, que el foco se vea. Ninguno contesta la
 * pregunta que importa al final: **¿se puede pasar una consulta de principio a
 * fin sin quedarse atascado?** Eso sólo se sabe recorriéndolo.
 *
 * Y recorriéndolo aparecieron cosas que ninguna medición por pantalla iba a
 * dar: la barra de voz se iba de la pantalla al bajar por la nota (REG-430), y
 * la consulta sólo se estaba midiendo EN REPOSO, que es un estado en el que
 * nadie trabaja.
 *
 * LO QUE MIRA EN CADA PASO
 * ────────────────────────
 * No sólo que el clic funcione: qué queda en pantalla después. Un paso que
 * «funciona» y no deja ninguna señal es indistinguible de uno que no hizo nada
 * — así lo dice la cabecera de `MientrasHablas` sobre el micrófono, y vale
 * igual para todo lo demás.
 *
 * LO QUE ENCONTRÓ LA PRIMERA VEZ, Y NO ERA DEL PRODUCTO
 * ─────────────────────────────────────────────────────
 * Tres veces seguidas un localizador flojo pareció un defecto: «no hay botón de
 * grabar» (el nombre accesible empieza por «Grabar la consulta:»), «pulsar
 * grabar no hace nada» (había un consentimiento delante, que es lo correcto) y
 * «no hay botón de detener» (se llama «Terminar la grabación» por su
 * `aria-label`, no «Terminar»). Queda escrito porque el mismo error tres veces
 * en una sesión ya no es mala suerte: **antes de acusar a la pantalla, hay que
 * mirar por qué nombre se la está llamando.**
 *
 * QUÉ NO CUBRE
 * ────────────
 * · **Sólo Chromium.** No hay WebKit en este entorno: esto NO prueba iPhone.
 * · **La transcripción no se puede probar de verdad**: no hay clave de IA en
 *   este entorno, así que el paso de detener acaba en un 503. Lo que sí se
 *   comprueba es lo que el médico ve entonces —«No se pudo transcribir»,
 *   «Descargar audio», «Descartar audio guardado»—, que es lo que decide si
 *   una consulta de veinte minutos se perdió o no.
 * · No firma la nota: hacen falta seis campos y llenarlos aquí sería probar el
 *   formulario, no el recorrido. Lo que se comprueba es que la compuerta de
 *   firma DIGA qué falta.
 * · No cubre receta, orden ni portal del paciente. Cada uno tiene el suyo.
 */
import { chromium } from 'playwright'
const B = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const nav=await chromium.launch({executablePath:B, args:[
  '--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']})
const ctx=await nav.newContext({viewport:{width:1440,height:900}, permissions:['microphone']})
const p=await ctx.newPage()
const errores=[]
p.on('console', m => { if (m.type()==='error') errores.push(m.text().slice(0,110)) })
p.on('pageerror', e => errores.push('PAGEERROR ' + String(e).slice(0,110)))

const paso = async (n, texto, fn) => {
  const antes = errores.length
  try {
    const r = await fn()
    console.log(`  ${n}. ${texto}${r ? ` → ${r}` : ''}${errores.length>antes?`  [${errores.length-antes} error(es) de consola]`:''}`)
  } catch (e) {
    console.log(`  ${n}. ${texto}\n       ✗ ${String(e).split('\n')[0].slice(0,120)}`)
  }
}

console.log('\n═══ EL DÍA DE UN MÉDICO ═══\n')

await paso(1, 'Entra al consultorio', async () => {
  await p.goto(BASE + '/login')
  await p.fill('input[type=email]','demo@nexusmed.test'); await p.fill('input[type=password]','demo1234')
  await p.click('button[type=submit]'); await p.waitForURL(/dashboard|citas/,{timeout:30000})
  try { await p.getByRole('button',{name:'Saltar',exact:true}).first().click({timeout:5000})
        await p.waitForSelector('text=BIENVENIDO A AUSCULTA',{state:'detached',timeout:5000}) } catch {}
  return 'aterriza en ' + new URL(p.url()).pathname
})

await paso(2, 'Ve el día', async () => {
  await p.goto(BASE + '/citas'); await p.waitForTimeout(2500)
  const n = await p.locator('button[aria-label^="Más acciones"]').count()
  const primera = (await p.locator('.riel-entrada').first().innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0,60)
  return `${n} citas · la primera dice «${primera}»`
})

await paso(3, 'Abre la consulta del primer paciente', async () => {
  await p.locator('button[aria-label^="Más acciones"]').first().click(); await p.waitForTimeout(600)
  await p.locator('[role="menu"] button', {hasText:'Abrir consulta'}).first().click()
  await p.waitForURL(/consulta/,{timeout:20000}); await p.waitForTimeout(3000)
  return new URL(p.url()).pathname
})

await paso(4, 'La consulta dice de quién es', async () => {
  const t = await p.evaluate(() => document.body.innerText)
  const nombre = /Rosal[ií]a|Mar[ií]a|Aurelio|Tadeo|Nadia/.exec(t)?.[0]
  const alergia = /alergia/i.test(t)
  return `paciente «${nombre ?? 'NO SE VE'}» · menciona alergias: ${alergia}`
})

await paso(5, 'Pide grabar y da el consentimiento', async () => {
  const b = p.getByRole('button',{name:/^Grabar la consulta/}).first()
  if (!(await b.count())) return 'NO HAY BOTÓN DE GRABAR'
  await b.click(); await p.waitForTimeout(1500)
  const ok = p.getByRole('button',{name:/Confirmo el consentimiento/})
  const pidio = await ok.count() > 0
  if (pidio) await ok.click()
  await p.waitForTimeout(4000)
  const t = await p.evaluate(() => document.body.innerText)
  const estados = [...new Set((t.match(/Grabando|Esperando voz|Transcribiendo/g)||[]))]
  return `${pidio?'pide consentimiento primero · ':''}en pantalla: ${JSON.stringify(estados)}`
})

await paso('5b','Baja por la nota: ¿sigue el control a mano?', async () => {
  await p.evaluate(() => { const m=document.querySelector('main')||document.scrollingElement; m.scrollTop = m.scrollHeight })
  await p.waitForTimeout(1400)
  const d = await p.evaluate(() => {
    const b = document.querySelector('.nx-mientras-hablas')?.getBoundingClientRect()
    return { visible: !!(b && b.top < innerHeight && b.bottom > 0), top: b?Math.round(b.top):null }
  })
  return `barra de voz visible al final: ${d.visible} (top ${d.top})`
})

await paso(6, 'Detiene la grabación', async () => {
  const b = p.getByRole('button',{name:/^Terminar la grabación$/}).first()
  if (!(await b.count())) return 'NO HAY BOTÓN DE DETENER'
  await b.click(); await p.waitForTimeout(4000)
  const t = await p.evaluate(() => document.body.innerText)
  return /transcrib|procesando|sin voz|no se detect/i.test(t) ? 'reacciona al detener' : 'sin señal visible'
})

await paso(7, '¿Se puede firmar la nota?', async () => {
  const b = p.getByRole('button',{name:/firmar/i}).first()
  if (!(await b.count())) return 'NO HAY BOTÓN DE FIRMAR en esta pantalla'
  const on = await b.isEnabled()
  const razon = await b.getAttribute('title') || await b.getAttribute('aria-describedby') || ''
  return `botón de firmar ${on?'ACTIVO':'apagado'}${razon?` · dice «${razon}»`:''}`
})

await paso(8, 'La transcripción falla: ¿se pierde la consulta?', async () => {
  // Sin clave de IA el proveedor devuelve 503. Lo que importa no es que falle
  // —eso es del entorno— sino que el médico se entere y pueda sacar el audio:
  // veinte minutos de consulta no pueden desaparecer en silencio.
  const t = await p.evaluate(() => document.body.innerText)
  return `avisa: ${/No se pudo transcribir/i.test(t)} · deja descargar el audio: ${/Descargar audio/i.test(t)}`
    + ` · deja descartarlo: ${/Descartar audio/i.test(t)}`
})

await paso(9, 'Vuelve a la agenda y cobra', async () => {
  await p.goto(BASE + '/citas'); await p.waitForTimeout(2500)
  const b = p.getByRole('button',{name:'Cobrar',exact:true}).first()
  if (!(await b.count())) return 'NO HAY BOTÓN COBRAR'
  await b.click(); await p.waitForTimeout(2000)
  const hay = await p.locator('[role="dialog"]').count()
  return hay ? 'se abre el diálogo de cobro' : 'el botón no abrió nada'
})

await paso(10, 'Recarga con el audio a medias: ¿lo encuentra?', async () => {
  /**
   * El caso de verdad: el navegador se recarga, o el médico vuelve al día
   * siguiente. El aviso del fallo vive en memoria y se pierde; lo que no puede
   * perderse es el AUDIO. Si queda guardado y nadie lo ofrece, son veinte
   * minutos de consulta inalcanzables — y encima voz, que es un dato biométrico
   * ocupando el dispositivo sin forma visible de borrarlo.
   *
   * Dos veces este paso dijo «se pierde» y las dos se equivocaba él, no el
   * producto: la primera miraba la pantalla antes de recargar; la segunda
   * recargaba la pantalla donde había quedado el paso del cobro, que es la
   * AGENDA. Hay que volver a la consulta y recargar ALLÍ.
   */
  await p.goto(BASE + '/consulta/pac-001'); await p.waitForTimeout(2000)
  await p.reload(); await p.waitForTimeout(7000)
  const d = await p.evaluate(async () => {
    let trozos = 0
    for (const b of (await indexedDB.databases?.()) ?? []) {
      if (!/recovery/i.test(b.name)) continue
      const db = await new Promise(r => { const q = indexedDB.open(b.name); q.onsuccess = () => r(q.result); q.onerror = () => r(null) })
      if (!db) continue
      for (const st of [...db.objectStoreNames]) {
        trozos += await new Promise(r => { const c = db.transaction(st).objectStore(st).count(); c.onsuccess = () => r(c.result); c.onerror = () => r(0) })
      }
      db.close()
    }
    return { trozos, cartel: /audio guardado de una sesión anterior/i.test(document.body.innerText) }
  })
  if (d.trozos > 0 && !d.cartel) return '✗ hay audio guardado y NADIE lo ofrece: inalcanzable'
  return `audio guardado: ${d.trozos} trozo(s) · lo ofrece al volver: ${d.cartel}`
})

console.log(`\n  Errores de consola en todo el recorrido: ${errores.length}`)
for (const e of [...new Set(errores)].slice(0,6)) console.log('    · ' + e)
await nav.close()

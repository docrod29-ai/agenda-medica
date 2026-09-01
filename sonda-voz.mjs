import { chromium } from 'playwright'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = 'http://127.0.0.1:3300'
const OUT = 'docs/design/capturas/v92'
const nav = await chromium.launch({ executablePath: CHROME, args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] })
const pag = await ctx.newPage()
await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await pag.waitForTimeout(3000)
await pag.locator('input[type=email]').fill('demo@nexusmed.test')
await pag.locator('input[type=password]').fill('demo1234')
await pag.locator('button[type=submit]').first().click(); await pag.waitForTimeout(9000)
await pag.goto(`${BASE}/consulta/pac-001`, { waitUntil: 'domcontentloaded' }); await pag.waitForTimeout(10000)
for (const t of [/^saltar$/i, /^entendido$/i]) {
  const b = pag.locator('button:visible').filter({ hasText: t }).first()
  if (await b.count().catch(()=>0)) { await b.click().catch(()=>{}); await pag.waitForTimeout(800) }
}
async function foto(n) {
  await pag.screenshot({ path: `${OUT}/${n}.png` })
  const d = await pag.evaluate(() => {
    const enPantalla = []
    document.querySelectorAll('main *, [role=dialog] *').forEach(e => {
      const r = e.getBoundingClientRect()
      if (e.children.length === 0 && e.textContent.trim() && r.top > -50 && r.top < 900) enPantalla.push(e.textContent.trim().slice(0,64))
    })
    const circ = [...document.querySelectorAll('span,button,div')].find(e => {
      const c = getComputedStyle(e), r = e.getBoundingClientRect()
      return r.width > 50 && Math.abs(r.width-r.height) < 4 && parseFloat(c.borderTopLeftRadius) > r.width/3
    })
    const cc = circ && getComputedStyle(circ)
    return {
      visible: [...new Set(enPantalla)].slice(0,16),
      circulo: circ ? { px: Math.round(circ.getBoundingClientRect().width), fondo: cc.backgroundColor, anim: cc.animationName } : null,
      vivo: [...document.querySelectorAll('[role=status],[aria-live]')].map(e=>e.textContent.trim().slice(0,70)).filter(Boolean).slice(0,4),
    }
  })
  console.log(`\n════════ ${n} ════════`); console.log(JSON.stringify(d, null, 1))
}
await foto('01-inactivo')
await pag.getByRole('button', { name: /Grabar la consulta/i }).first().click()
await pag.waitForTimeout(900); await foto('02-consentimiento')
const ok = pag.locator('[role=dialog] button').filter({ hasText: /confirm|acept|entend|s[ií]|graba/i }).first()
console.log('\n>>> botones del modal:', JSON.stringify(await pag.locator('[role=dialog] button').allInnerTexts()))
await ok.click().catch(e => console.log('no pude confirmar:', e.message.slice(0,60)))
await pag.waitForTimeout(2500); await foto('03-tras-consentir')
await pag.waitForTimeout(6000); await foto('04-grabando-8s')
console.log('\n════════ ¿QUÉ TAPA LA PÍLDORA FLOTANTE? ════════')
console.log(JSON.stringify(await pag.evaluate(() => {
  const pil = [...document.querySelectorAll('button')].find(b => /Detener y generar nota/i.test(b.textContent))
  if (!pil) return { pildora: 'no existe' }
  const cont = pil.closest('div')
  const r = cont.getBoundingClientRect()
  const puntos = []
  for (const [dx,dy] of [[0.5,0.5],[0.1,0.5],[0.9,0.5]]) {
    const x = r.left + r.width*dx, y = r.top + r.height*dy
    const e = document.elementFromPoint(x,y)
    puntos.push(e ? e.tagName + (e.className ? '.'+String(e.className).slice(0,20) : '') : 'nada')
  }
  // ¿qué habría debajo si la píldora no estuviera?
  const debajo = document.elementsFromPoint(r.left + r.width/2, r.top + r.height/2)
    .map(e => e.tagName + (e.getAttribute?.('placeholder') ? `[${e.getAttribute('placeholder').slice(0,20)}]` : ''))
  const motivo = [...document.querySelectorAll('textarea')][0]
  const rm = motivo?.getBoundingClientRect()
  return {
    pildora: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), pos: getComputedStyle(cont).position },
    encimaDe: puntos, pila: debajo.slice(0,5),
    primerCampoObligatorio: rm ? { y: Math.round(rm.top), h: Math.round(rm.height) } : null,
    seSolapan: rm ? !(r.bottom < rm.top || r.top > rm.bottom) : null,
  }
}), null, 1))
// ¿cuántos relojes corriendo a la vez?
console.log('\n════════ RELOJES Y ESTADOS SIMULTÁNEOS ════════')
console.log(JSON.stringify(await pag.evaluate(() => {
  const t = document.body.innerText
  return {
    relojes: (t.match(/\d{1,2}:\d{2}/g) || []),
    palabrasDeEstado: [...new Set((t.match(/Escuchando|Grabando|Pausado|Procesando|Esperando voz/gi) || []))],
    controlesDeDetener: [...document.querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(x=>/detener|terminar|parar|stop/i.test(x)),
    regionesVivas: document.querySelectorAll('[aria-live],[role=status]').length,
    // LO QUE IMPORTA: cuántas de esas regiones llevan un RELOJ dentro, o sea
    // cuántas relee un lector de pantalla cada segundo.
    // LO QUE UN LECTOR DE PANTALLA ANUNCIA: textContent MENOS los subárboles
    // `aria-hidden`. `textContent` a secas los incluye, y por eso la primera
    // versión de esta sonda seguía «viendo» un reloj que ya estaba callado.
    regionesConReloj: (() => {
      const textoAccesible = (raiz) => {
        let t = ''
        const rec = (n) => {
          if (n.nodeType === 3) { t += n.textContent; return }
          if (n.nodeType !== 1) return
          if (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('aria-hidden')) return
          n.childNodes.forEach(rec)
        }
        rec(raiz); return t
      }
      return [...document.querySelectorAll('[aria-live],[role=status]')]
        .map(e => textoAccesible(e).replace(/\s+/g,' ').trim())
        .filter(t => /\d{1,2}:\d{2}/.test(t))
        .map(t => t.slice(0,60))
    })(),
  }
}), null, 1))
await nav.close()

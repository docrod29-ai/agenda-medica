import { chromium } from 'playwright'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = 'http://127.0.0.1:3300'
const OUT = 'docs/design/capturas/v93'
const nav = await chromium.launch({ executablePath: CHROME })
async function entrar(w,h) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h } })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000)
  await p.locator('input[type=email]').fill('demo@nexusmed.test')
  await p.locator('input[type=password]').fill('demo1234')
  await p.locator('button[type=submit]').first().click(); await p.waitForTimeout(9000)
  await p.goto(`${BASE}/expediente/pac-001`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(10000)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = p.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(()=>0)) { await b.click().catch(()=>{}); await p.waitForTimeout(800) }
  }
  return p
}
const pag = await entrar(1440, 900)
await pag.screenshot({ path: `${OUT}/expediente-1440-DESPUES.png` })
console.log(JSON.stringify(await pag.evaluate(() => {
  let sc=null,max=0
  document.querySelectorAll('*').forEach(e=>{const c=getComputedStyle(e)
    if(/auto|scroll/.test(c.overflowY)&&e.scrollHeight>e.clientHeight+50&&e.scrollHeight>max){max=e.scrollHeight;sc=e}})
  const raiz = sc||document.body
  const cajas=[...raiz.querySelectorAll('div,section')].filter(d=>{
    const c=getComputedStyle(d),r=d.getBoundingClientRect()
    if(r.height<44) return false
    return parseFloat(c.borderTopLeftRadius)>=6 &&
      (c.backgroundColor!=='rgba(0, 0, 0, 0)' || (c.borderTopStyle!=='none'&&parseFloat(c.borderTopWidth)>0))})
  const primerPliegue=[]
  raiz.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect()
    if(e.children.length===0&&e.textContent.trim()&&r.top>-20&&r.top<900) primerPliegue.push(e.textContent.trim().slice(0,60))})
  return {
    altoPx: sc?sc.scrollHeight:document.documentElement.scrollHeight,
    pantallas: +(((sc?sc.scrollHeight:0)/(sc?sc.clientHeight:900))).toFixed(1),
    cajasRedondeadas: cajas.length,
    botones: raiz.querySelectorAll('button').length,
    titulos: [...raiz.querySelectorAll('h1,h2,h3,h4')].map(h=>h.textContent.trim().slice(0,40)).filter(Boolean),
    primerPliegue: [...new Set(primerPliegue)].slice(0,30),
  }
}, null), null, 1))
await nav.close()

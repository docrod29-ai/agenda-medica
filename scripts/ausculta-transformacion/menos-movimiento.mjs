/** Con «menos movimiento» pedido: nada puede quedarse escondido ni girando. */
import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:3200'
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const p = await ctx.newPage()
for (const ruta of ['/', '/demo', '/login']) {
  await p.goto(base + ruta, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1400)
  const r = await p.evaluate(() => {
    const escondidos = []
    let animando = 0
    for (const el of document.querySelectorAll('main *, header *')) {
      const cs = getComputedStyle(el)
      const tieneTexto = (el.textContent || '').trim().length > 0
      if (tieneTexto && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity < 0.9) {
        escondidos.push(`${el.className || el.tagName} @ opacity ${cs.opacity}`)
      }
      if (cs.animationName !== 'none' && cs.animationIterationCount === 'infinite'
          && parseFloat(cs.animationDuration) > 0.01) animando++
    }
    return { escondidos: escondidos.slice(0, 6), nEscondidos: escondidos.length, animandoInfinito: animando }
  })
  console.log(ruta.padEnd(10), 'escondidos=' + r.nEscondidos, '· animando en bucle=' + r.animandoInfinito,
    r.escondidos.length ? '\n   ' + r.escondidos.join('\n   ') : '')
}
await nav.close()

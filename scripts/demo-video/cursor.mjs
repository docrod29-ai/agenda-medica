/**
 * Cursor visible para la grabación. Chromium sin cabeza no dibuja el puntero en
 * el video, así que se pinta uno en el DOM que sigue los eventos del ratón.
 *
 * Se inyecta con `context.addInitScript(cursorOverlay, telefono)`: Playwright
 * serializa la función y la corre en cada documento. Todo lo de adentro es
 * código de navegador, sin dependencias.
 *
 * Por qué se monta DESPUÉS de `load` y se vigila con un intervalo: React
 * hidrata `<html>` y `<body>` enteros; un nodo ajeno presente durante la
 * hidratación puede provocar un desajuste y un re-render que lo borre. Montarlo
 * tarde y volver a montarlo si desaparece lo hace inmune a eso.
 */
export function cursorOverlay(telefono) {
  if (window.__cursorDemo) return
  window.__cursorDemo = true
  let x = -100, y = -100, pulsando = false
  const css = document.createElement('style')
  css.id = 'nx-cursor-css'
  css.textContent = [
    '#nx-cursor{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))}',
    '#nx-cursor.tel{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.28);border:2px solid rgba(255,255,255,.95);opacity:0;transition:opacity .2s}',
    '#nx-cursor.tel.on{opacity:1}',
    '#nx-cursor.down svg{transform:scale(.9)}',
    '.nx-onda{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;border-radius:50%;border:3px solid #2AA5B5;transform:translate(-50%,-50%) scale(1);opacity:.95;animation:nxonda .6s ease-out forwards}',
    '@keyframes nxonda{to{transform:translate(-50%,-50%) scale(5);opacity:0}}',
    // El indicador de desarrollo de Next (la «N» y los avisos) no es parte del producto.
    'nextjs-portal{display:none!important}',
  ].join('\n')
  const c = document.createElement('div')
  c.id = 'nx-cursor'
  if (telefono) c.className = 'tel'
  else c.innerHTML = '<svg width="28" height="32" viewBox="0 0 26 30"><path d="M3 2 L3 24 L9 18.5 L13 27 L17 25 L13 16.5 L21 16 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  const pinta = () => {
    c.style.transform = telefono ? `translate(${x - 17}px,${y - 17}px)` : `translate(${x - 3}px,${y - 2}px)`
  }
  const monta = () => {
    if (!document.body) return
    if (!document.getElementById('nx-cursor-css')) document.head.appendChild(css)
    if (!document.getElementById('nx-cursor')) { document.body.appendChild(c); pinta() }
  }
  document.addEventListener('mousemove', e => {
    x = e.clientX; y = e.clientY; pinta()
    if (telefono) c.classList.add('on')
  }, true)
  document.addEventListener('mousedown', e => {
    pulsando = true; c.classList.add('down')
    const o = document.createElement('div')
    o.className = 'nx-onda'; o.style.left = e.clientX + 'px'; o.style.top = e.clientY + 'px'
    document.body.appendChild(o); setTimeout(() => o.remove(), 700)
  }, true)
  document.addEventListener('mouseup', () => { pulsando = false; c.classList.remove('down') }, true)
  if (document.readyState === 'complete') setTimeout(monta, 400)
  else window.addEventListener('load', () => setTimeout(monta, 400))
  setInterval(monta, 500)
}

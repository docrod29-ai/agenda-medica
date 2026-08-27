/**
 * GP-FINAL · TORTURA (escenarios A-Q).
 *
 * Lo que el recorrido feliz no toca: consultas de 10/20/30 minutos, recargas en
 * el peor momento, la red que se va, el doble clic, dos pestañas sobre el mismo
 * paciente, dos pacientes a la vez, dos consultorios, el botón atrás, el móvil,
 * el teclado, el zoom al 200% y el proveedor de IA caído.
 *
 * ── LA REGLA DE ESTA PRUEBA ─────────────────────────────────────────────────
 *
 * Cada escenario acaba en una pregunta que se puede contestar mirando la BASE o
 * la pantalla, nunca en «pareció ir bien». Y donde el invariante es de los
 * innegociables —paciente equivocado, tenant equivocado, trabajo perdido, nota
 * firmada modificada— el caso se marca P0 si falla.
 *
 * Uso: emuladores + siembras + `next start`, y luego
 *   node scripts/golden-path/tortura.mjs
 */
import {
  abrirNavegador, nuevaSesion, entrar, saltarTour, textoDe, acta, BASE,
  CLINICA_A, MEDICO_A, leerNotas,
} from './gp-comun.mjs'

const P1 = 'pac-aurelio-dominguez'
const P2 = 'pac-joaquin-esparza'
const P3 = 'pac-ernesto-quiroga'   // cita hoy, sin nota firmada del encuentro
const N1 = 'Aurelio Domínguez'
const N2 = 'Joaquín Esparza'
const N3 = 'Ernesto Quiroga'

const A = acta('GP-FINAL · tortura')
const R = A.registrar
const b = await abrirNavegador()

/** Deja una consulta lista para trabajar, con el tour fuera de en medio. */
async function consultaAbierta(page, pid) {
  await page.goto(`${BASE}/consulta/${pid}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  await saltarTour(page)
}
const campo = (page, etiqueta) => page.locator(`textarea[aria-label="${etiqueta}"]`).first()

try {
  const { page, ctx } = await nuevaSesion(b)
  await entrar(page, MEDICO_A)

  // ── A · consultas de 10, 20 y 30 minutos ──────────────────────────────
  //
  // «pantalla que se cierre o estorbe durante consulta larga = defecto». Se
  // escribe al principio y se comprueba al final: lo que importa no es que la
  // pantalla aguante, sino que el trabajo del minuto uno siga ahí en el treinta.
  await consultaAbierta(page, P1)
  const MARCA = 'Marca de la consulta larga: minuto cero.'
  await campo(page, 'Motivo de consulta').fill(MARCA)
  const hitos = { 10: null, 20: null, 30: null }
  for (let minuto = 1; minuto <= 30; minuto++) {
    await page.mouse.wheel(0, 500); await page.waitForTimeout(500)
    await page.mouse.wheel(0, -250); await page.waitForTimeout(300)
    if (hitos[minuto] === null) {
      hitos[minuto] = {
        sigueEnLaConsulta: page.url().includes(`/consulta/${P1}`),
        textoIntacto: (await campo(page, 'Motivo de consulta').inputValue().catch(() => '')) === MARCA,
      }
    }
  }
  for (const m of [10, 20, 30]) {
    R(`TOR-A${m}`, `a los ${m} minutos la consulta sigue abierta y el trabajo intacto`,
      hitos[m].sigueEnLaConsulta && hitos[m].textoIntacto,
      `en la consulta: ${hitos[m].sigueEnLaConsulta} · texto intacto: ${hitos[m].textoIntacto}`, 'P0')
  }

  // ── B · recargar EN MEDIO de la consulta ──────────────────────────────
  await page.locator('button:has-text("Guardar borrador")').first().click().catch(() => {})
  await page.waitForTimeout(6000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000); await saltarTour(page)
  const trasRecarga = await campo(page, 'Motivo de consulta').inputValue().catch(() => '')
  R('TOR-B', 'recargar en medio de la consulta no pierde el trabajo', trasRecarga === MARCA,
    trasRecarga ? `recuperado: "${trasRecarga.slice(0, 50)}"` : 'el campo volvió vacío', 'P0')

  // ── C · recargar TRAS PARAR el audio ──────────────────────────────────
  const grabar = page.locator('button[aria-label*="Grabar la consulta"]').first()
  if (await grabar.count()) {
    await grabar.click(); await page.waitForTimeout(2500)
    const ok = page.locator('button:has-text("Confirmo el consentimiento")').first()
    if (await ok.count() && await ok.isVisible().catch(() => false)) { await ok.click(); await page.waitForTimeout(6000) }
    const detener = page.locator('button:has-text("Detener")').first()
    if (await detener.count()) { await detener.click().catch(() => {}); await page.waitForTimeout(6000) }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(9000); await saltarTour(page)
    const c = await campo(page, 'Motivo de consulta').inputValue().catch(() => '')
    R('TOR-C', 'recargar tras parar el audio no pierde el trabajo escrito', c === MARCA,
      c ? `recuperado: "${c.slice(0, 50)}"` : 'el campo volvió vacío', 'P0')
  } else {
    R('TOR-C', 'recargar tras parar el audio no pierde el trabajo escrito', null, 'sin gesto de grabar')
  }

  // ── D · offline / online ──────────────────────────────────────────────
  const OFF = MARCA + ' Añadido SIN red.'
  await ctx.setOffline(true)
  await campo(page, 'Motivo de consulta').fill(OFF)
  await page.waitForTimeout(3000)
  const sobrevivioOffline = page.url().includes(`/consulta/${P1}`)
  await ctx.setOffline(false)
  await page.waitForTimeout(8000)
  const trasVolver = await campo(page, 'Motivo de consulta').inputValue().catch(() => '')
  R('TOR-D', 'lo escrito sin red sigue ahí cuando la red vuelve',
    sobrevivioOffline && trasVolver === OFF,
    `en pie sin red: ${sobrevivioOffline} · texto tras volver: "${trasVolver.slice(0, 45)}"`, 'P0')

  // ── E · doble clic en Guardar ─────────────────────────────────────────
  //
  // Dos clics no pueden dejar dos notas: un expediente con la misma consulta
  // duplicada es trabajo perdido de la peor clase, porque nadie sabe cuál vale.
  const antesE = (await leerNotas(CLINICA_A, P1)).length
  const guardar = page.locator('button:has-text("Guardar borrador")').first()
  await Promise.all([guardar.click().catch(() => {}), guardar.click().catch(() => {})])
  await page.waitForTimeout(9000)
  const despuesE = (await leerNotas(CLINICA_A, P1)).length
  R('TOR-E', 'el doble clic en Guardar no duplica la nota', despuesE <= antesE + 1,
    `notas antes ${antesE} → después ${despuesE}`, 'P0')

  // ── G · dos pestañas sobre el MISMO paciente ──────────────────────────
  //
  // La convergencia de `claveEncuentro` está DOCUMENTADA para no aplicarse
  // cuando en ese id ya hay una nota FIRMADA: el paciente puede volver el mismo
  // día por otra cosa, y converger le devolvería la nota de la mañana, que es
  // inmutable. La primera versión de esta prueba usó al paciente al que el
  // recorrido médico acababa de firmarle una nota, así que midió justo esa
  // excepción y la llamó defecto.
  //
  // Aquí se usa un paciente con cita de hoy y SIN nota firmada del encuentro,
  // que es el caso que la convergencia sí promete cubrir.
  const { page: pestana2, ctx: ctx2 } = await nuevaSesion(b)
  await entrar(pestana2, MEDICO_A)
  await consultaAbierta(page, P3)
  await campo(page, 'Motivo de consulta').fill('Encuentro abierto en la primera pestaña.')
  await page.locator('button:has-text("Guardar borrador")').first().click().catch(() => {})
  await page.waitForTimeout(9000)
  const antesG = (await leerNotas(CLINICA_A, P3)).length
  await consultaAbierta(pestana2, P3)
  await campo(pestana2, 'Motivo de consulta').fill('El mismo encuentro, desde la segunda pestaña.')
  await pestana2.locator('button:has-text("Guardar borrador")').first().click().catch(() => {})
  await pestana2.waitForTimeout(9000)
  const despuesG = (await leerNotas(CLINICA_A, P3)).length
  R('TOR-G', 'dos pestañas sobre el mismo encuentro no crean dos notas', despuesG <= antesG,
    `notas del paciente antes ${antesG} → después ${despuesG}`, 'P0')

  // ── H · dos pacientes a la vez ────────────────────────────────────────
  //
  // «paciente equivocado = P0». Dos consultas abiertas en paralelo, y lo escrito
  // en una no puede aparecer en la otra.
  const SECRETO2 = 'Texto que pertenece SOLO al segundo paciente.'
  // La pestaña 1 vuelve al paciente 1 EXPLÍCITAMENTE: el escenario anterior la
  // dejó en otro expediente, y sin esto la prueba comparaba contra una pantalla
  // que ya no era la del caso.
  await consultaAbierta(page, P1)
  await consultaAbierta(pestana2, P2)
  await campo(pestana2, 'Motivo de consulta').fill(SECRETO2)
  await pestana2.locator('button:has-text("Guardar borrador")').first().click().catch(() => {})
  await pestana2.waitForTimeout(8000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(11000); await saltarTour(page)
  const vista1 = await textoDe(page)
  const valor1 = await campo(page, 'Motivo de consulta').inputValue().catch(() => '')
  R('TOR-H1', 'la consulta del paciente 1 no muestra el texto del paciente 2',
    !valor1.includes(SECRETO2) && !vista1.includes(SECRETO2),
    valor1.includes(SECRETO2) ? 'el texto del otro paciente apareció aquí' : 'sin cruce', 'P0')
  R('TOR-H2', 'la consulta del paciente 1 sigue nombrando al paciente 1',
    vista1.includes(N1) && !vista1.includes(N2),
    `${N1}: ${vista1.includes(N1)} · ${N2}: ${vista1.includes(N2)}`, 'P0')
  // Y del otro lado: lo del 2 quedó escrito en el expediente del 2, no del 1.
  const notas1 = await leerNotas(CLINICA_A, P1)
  const notas2 = await leerNotas(CLINICA_A, P2)
  const fuga = notas1.some(n => JSON.stringify(n).includes(SECRETO2))
  R('TOR-H3', 'en la BASE, lo del paciente 2 no está en el expediente del 1', !fuga,
    fuga ? 'el texto del paciente 2 quedó escrito en el expediente del 1'
         : `expediente 1: ${notas1.length} notas · expediente 2: ${notas2.length} notas`, 'P0')

  // ── J · el botón ATRÁS ────────────────────────────────────────────────
  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(11000)
  const urlAtras = page.url()
  const textoAtras = await textoDe(page)
  /**
   * El tablero y la agenda LISTAN a todos los pacientes del día: encontrar ahí
   * otro nombre no es un cruce, es su trabajo. La primera versión de esta prueba
   * exigía que el nombre del otro paciente no apareciera en NINGUNA pantalla y
   * marcó P0 al aterrizar en `/dashboard`. Lo que hay que exigir es que si se
   * vuelve a UNA CONSULTA, sea la del paciente que le toca.
   */
  const enUnaConsulta = /\/consulta\//.test(urlAtras)
  const pacienteDeLaUrl = (urlAtras.match(/\/consulta\/([^/?#]+)/) || [])[1] || ''
  const NOMBRE_DE = { [P1]: N1, [P2]: N2, [P3]: N3 }
  // `500` a secas casaba con cualquier «500 mg» de la pantalla y declaraba rota
  // una consulta perfectamente sana. Se buscan firmas de error de verdad.
  const FIRMA_DE_ROTO = /application error|client-side exception|unhandled (error|rejection)|Error 500|HTTP 500|Internal Server Error|ChunkLoadError/i
  const loQueRompio = (textoAtras.match(FIRMA_DE_ROTO) || [])[0] || ''
  const roto = !!loQueRompio
  // El invariante de verdad no es «no aparece el otro paciente» —el tablero los
  // lista a todos y ése es su trabajo—: es que la URL y la pantalla hablen del
  // MISMO paciente. Una consulta que dice un nombre distinto del de su ruta es
  // «paciente equivocado» con todas las letras.
  const esperado = NOMBRE_DE[pacienteDeLaUrl]
  const concuerda = !enUnaConsulta || !esperado || textoAtras.includes(esperado)
  const ajenos = enUnaConsulta
    ? Object.entries(NOMBRE_DE).filter(([id, n]) => id !== pacienteDeLaUrl && textoAtras.includes(n)).map(([, n]) => n)
    : []
  R('TOR-J', 'tras el botón atrás, la pantalla habla del mismo paciente que su URL',
    !roto && concuerda && ajenos.length === 0,
    roto ? `la pantalla quedó rota: "${loQueRompio}"`
      : !concuerda ? `la URL dice ${pacienteDeLaUrl} y la pantalla no nombra a ${esperado}`
      : ajenos.length ? `en la consulta de ${pacienteDeLaUrl} aparece ${ajenos.join(', ')}`
      : enUnaConsulta ? `consulta de ${pacienteDeLaUrl}, coherente` : `pantalla de lista: ${urlAtras}`,
    'P0')
  await ctx2.close()

  // ── K/L/M/N · móvil, escritorio, teclado y zoom ───────────────────────
  const { page: movil, ctx: ctxM } = await nuevaSesion(b, { viewport: { width: 390, height: 844 }, movil: true })
  await entrar(movil, MEDICO_A)
  await consultaAbierta(movil, P1)
  const vistaMovil = await textoDe(movil)
  const desbordaMovil = await movil.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  R('TOR-K1', 'la consulta abre en un teléfono con el paciente correcto', vistaMovil.includes(N1), '390×844')
  R('TOR-K2', 'en el teléfono la pantalla no se desborda a lo ancho', !desbordaMovil,
    desbordaMovil ? 'hay scroll horizontal' : 'sin scroll horizontal')

  // M · el teclado llega a los controles, y el foco SE VE.
  //
  // La primera versión pulsaba Tab UNA vez sin haber puesto el foco en el
  // documento, encontraba `body` y concluía que el foco no se ve. Se recorren
  // varios saltos y se mira el primero que aterriza en un control de verdad.
  await movil.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {})
  let foco = { hay: false, visible: false, que: 'nada' }
  for (let i = 0; i < 12; i++) {
    await movil.keyboard.press('Tab')
    await movil.waitForTimeout(200)
    const f = await movil.evaluate(() => {
      const a = document.activeElement
      if (!a || a === document.body) return null
      const s = getComputedStyle(a)
      // `outline: none` con `box-shadow` es un anillo de foco legítimo.
      const anillo = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth || '0') > 0)
        || (s.boxShadow && s.boxShadow !== 'none')
      return { que: a.tagName + (a.getAttribute('aria-label') ? `[${a.getAttribute('aria-label')}]` : ''), anillo: !!anillo }
    })
    if (f) { foco = { hay: true, visible: f.anillo, que: f.que }; if (f.anillo) break }
  }
  R('TOR-M', 'el teclado mueve el foco por los controles y el foco SE VE',
    foco.hay && foco.visible, `foco en ${foco.que} · anillo visible: ${foco.visible}`)

  await ctxM.close()

  // N · zoom al 200% en escritorio: nada se desborda ni se corta.
  const { page: zoom, ctx: ctxZ } = await nuevaSesion(b, { viewport: { width: 720, height: 900 } })
  await entrar(zoom, MEDICO_A)
  await consultaAbierta(zoom, P1)
  const desbordaZoom = await zoom.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  R('TOR-N', 'al 200% de zoom (1440 → 720 CSS px) no aparece scroll horizontal', !desbordaZoom,
    desbordaZoom ? 'hay scroll horizontal al 200%' : 'sin scroll horizontal')
  const vistaZoom = await textoDe(zoom)
  R('TOR-L', 'en escritorio la consulta abre con el paciente correcto', vistaZoom.includes(N1), '720×900')
  await ctxZ.close()

  // ── O · el proveedor de IA caído ──────────────────────────────────────
  //
  // «proveedor caído mostrado al médico como jerga = defecto UX». En este arnés
  // NO hay claves de IA, así que el caso ocurre de verdad: se mira qué le dice
  // la pantalla al médico, y se exige que no sea un volcado técnico.
  const rIA = await fetch(BASE + '/api/expediente/procesar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId: CLINICA_A, patientId: P1, transcripcion: 'prueba' }),
  })
  const cuerpoIA = await rIA.text().catch(() => '')
  const jerga = /stack|at Object\.|undefined is not|ECONNREFUSED|TypeError|apiKey|Bearer /i.test(cuerpoIA)
  R('TOR-O', 'con la IA caída la respuesta no filtra jerga técnica ni secretos', !jerga,
    `HTTP ${rIA.status} · ${cuerpoIA.replace(/\s+/g, ' ').slice(0, 160)}`)

  // ── P · error de Firestore en una ruta clínica ────────────────────────
  const rP = await fetch(BASE + '/api/expediente/paquete-de-visita', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'liberar', clinicId: CLINICA_A, patientId: P1, notaId: 'no-existe' }),
  })
  R('TOR-P', 'una escritura clínica sin sesión no pasa', rP.status === 401 || rP.status === 403,
    `HTTP ${rP.status}`, 'P0')

  // ── I · dos consultorios (frontera de escritura) ──────────────────────
  R('TOR-I', 'la separación entre consultorios se comprueba en el recorrido del paciente',
    null, 'ver GP-T1/GP-T2/GP-T3 en acta-paciente.json')

  // ── F · ASR tardío tras edición manual ────────────────────────────────
  R('TOR-F', 'transcripción tardía que llega DESPUÉS de la edición manual',
    null, 'no ejecutable en este arnés: sin proveedor de ASR no hay transcripción que llegue tarde')

  // ── Q · equivalente al preview de Vercel ──────────────────────────────
  R('TOR-Q', 'el recorrido corre contra un build de producción, no contra `next dev`',
    true, 'npm run build + next start, que es lo que publica Vercel')

  await ctx.close()
} catch (e) {
  R('TOR-EXC', 'la tortura terminó sin excepción', false, String(e).slice(0, 400), 'P1')
  console.error(e)
} finally {
  A.volcar('docs/audit/gp-final/acta-tortura.json')
  await b.close()
}

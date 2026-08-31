/**
 * ¿ACUSA EL CONTROL QUE ESTÁ VIVO? — trinquete de estaticidad.
 *
 * Pasa el puntero por encima de cada control **habilitado y visible** de cada
 * ruta y compara su `backgroundColor` y su `color` antes y después. Si no
 * cambia nada, el control está MUDO: se ve igual apuntado que sin apuntar, y
 * entonces se lee como texto, no como algo a lo que se puede ir.
 *
 * POR QUÉ ESTO ES UNA MEDIDA Y NO UNA OPINIÓN
 * ───────────────────────────────────────────
 * El encargo pide que el producto «no se sienta estático, plano ni genérico».
 * Eso suena a gusto personal hasta que se cuenta: en `/consulta/pac-001` —donde
 * el médico escribe la nota— los **16 botones** no respondían al puntero. Ni
 * «Grabar la consulta», que es la acción primera del producto, ni «Firmar y
 * cerrar nota», que es la última. En `/operaciones`, **22 de 22**.
 *
 * Contar controles mudos convierte «se siente muerto» en un número que sólo
 * puede bajar.
 *
 * DOS CLASES DE CONTROL NO CUENTAN, Y POR LA MISMA RAZÓN
 * ──────────────────────────────────────────────────────
 * · Un `<button disabled>` que no responde está **bien**: decir «aquí puedes
 *   pulsar» cuando no se puede es peor que callarse.
 * · **El control que ya está puesto** —`aria-pressed`, `aria-checked`,
 *   `aria-selected`, `.active` o `aria-current`— tampoco tiene que decir
 *   «puedes venir aquí»: ya estás. El
 *   filtro activo, la pestaña abierta y el destino donde estás llevan su
 *   superficie puesta precisamente porque son el sitio actual, y por eso
 *   apuntarlos no cambia nada.
 *
 * Contarlos empujaba a añadir un `:hover` de adorno a la pestaña abierta para
 * bajar un número. Eso es exactamente lo que el encargo llama animación
 * decorativa, y este trinquete no está para provocarla.
 *
 * QUÉ NO MIDE
 * ───────────
 * · **Si el acuse es el correcto.** Mide que algo cambie, no que el cambio sea
 *   el del sistema de diseño. Un botón que se pusiera fucsia al pasar contaría
 *   como vivo; para eso están el trinquete de diseño y mirar la pantalla.
 * · El pulsado (`:active`) y el foco: el foco lo cubre `arnes:foco-visible`.
 * · Lo que sólo existe dentro de un diálogo o un panel sin abrir.
 * · El teléfono: sin puntero no hay `:hover`. Esto es la comprobación de
 *   escritorio; en móvil el acuse es el `:active` y no se mide aquí.
 *
 * CÓMO SE USA
 * ───────────
 *   node scripts/carril-excelencia/el-control-acusa-el-puntero.mjs
 *   node scripts/carril-excelencia/el-control-acusa-el-puntero.mjs --actualizar
 *
 * El techo SÓLO PUEDE BAJAR. Si un cambio deja más controles mudos, se arregla
 * el cambio — no se mueve el techo.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { conPortal, claveDeRuta } from './token-del-portal.mjs'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const BASE = process.env.BASE ?? 'http://localhost:3300'
const TECHOS = 'docs/audit/carril-excelencia/techos-de-estaticidad.json'
const ACTUALIZAR = process.argv.includes('--actualizar')

/** Las mismas rutas del trinquete de interfaz. Ver `el-foco-se-ve.mjs`: la lista
 *  escrita de memoria incluía cinco pantallas que no existen. */
const RUTAS = (process.env.RUTAS ?? [
  '/citas', '/calendario', '/asistente', '/lista-espera', '/finanzas',
  '/operaciones', '/dashboard', '/pacientes', '/pendientes', '/configuracion',
  '/crm', '/reactivacion', '/resenas', '/membresias', '/farmacia',
  '/corte-caja', '/cumplimiento', '/cumplimiento/retencion', '/consultor',
  '/guia', '/consulta/pac-001', '/expediente/pac-001',
].join(',')).split(',')

/**
 * EL PORTAL DEL PACIENTE ENTRA AQUÍ, y llevaba fuera desde el principio.
 *
 * Las 22 rutas de arriba son todas del lado del MÉDICO. El portal es la única
 * pantalla que ve un paciente, y `.claude/rules/patient-facing-ai.md` dice por
 * qué eso no se hereda: del lado del médico, un control que se lee como texto
 * lo salva alguien entrenado para sospechar. Un paciente que no ve que algo se
 * puede pulsar, simplemente no lo pulsa — y ese control era «Confirmar cita».
 *
 * No lleva la sesión del equipo: lleva su token. Sin `PORTAL_PACIENTE_SECRET`
 * no se mide, y `conPortal` lo dice en voz alta en vez de dejar un hueco
 * silencioso con buena conciencia.
 */
const RUTAS_CON_PORTAL = conPortal(RUTAS)

const nav = await chromium.launch({ executablePath: CHROME })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
const pag = await ctx.newPage()

await pag.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
try {
  await pag.locator('input[type=email]').first().waitFor({ timeout: 20000 })
} catch {
  console.error(`\n  No apareció el formulario de acceso en ${BASE}/login.`)
  console.error('  Casi seguro: el servidor sirve un build hecho SIN la configuración del')
  console.error('  arnés. Para el servidor, borra .next, construye con las variables del')
  console.error('  arnés (NEXT_PUBLIC_FIREBASE_EMULATORS=1 …) y arranca otra vez.\n')
  await nav.close()
  process.exit(2)
}
await pag.locator('input[type=email]').first().fill('demo@nexusmed.test')
await pag.locator('input[type=password]').first().fill('demo1234')
await pag.locator('button[type=submit]').first().click()
await pag.waitForTimeout(9000)

/**
 * TODO LO QUE CUENTA COMO ACUSE, Y EN TODA LA FILA.
 *
 * La primera versión leía sólo `backgroundColor` y `color` **del propio
 * control**, y por eso mentía de dos maneras distintas:
 *
 *  · **Se perdía los acuses que no son de color.** `.nx-agenda-bloque` —los
 *    bloques de cita del calendario— se aclara con `filter: brightness(1.35)` y
 *    levanta una sombra al pasar. Nada de eso es `backgroundColor`, así que los
 *    contaba mudos. Ocho citas acusadas de estar muertas mientras respondían.
 *  · **Miraba el elemento y no lo que se VE.** En `/dashboard` cada cita es un
 *    `<a class="cita-principal">` dentro de un `.cita-fila`, y quien se ilumina
 *    es la FILA. El enlace no cambia ni un píxel propio, pero el médico ve
 *    encenderse el renglón entero. Ocho más.
 *
 * Así que se leen siete propiedades y se mira la cadena de antepasados hasta
 * `<main>`: si algo cambia en el camino, el acuse llegó a los ojos.
 */
/* La lista va DENTRO de la función a propósito: esto se ejecuta en el navegador
   y una constante de Node no cruza. Escrita fuera, `FOTO` lanzaba
   `ReferenceError` en cada control, el `catch` se lo tragaba y **ninguno se
   contaba como mudo**: el guion informó 0 en las 22 rutas. Un cero perfecto es
   la forma que tiene una medición rota de parecer un aprobado. */
const FOTO = (e) => {
  /*
   * `textDecorationColor` lo trajo un falso positivo: el nombre del paciente de
   * la franja de identidad responde al puntero subiendo el color del SUBRAYADO
   * —de `--text3` a `--text`, decisión de WCAG 1.4.1 tomada a propósito— y esta
   * foto sólo miraba `textDecorationLine`, que no cambia. El control estaba
   * bien; la foto estaba incompleta.
   */
  const props = ['backgroundColor', 'color', 'filter', 'boxShadow', 'transform', 'borderColor', 'textDecorationLine', 'textDecorationColor']
  const trozos = []
  for (let n = e; n && n.tagName !== 'MAIN' && n !== document.body; n = n.parentElement) {
    const c = getComputedStyle(n)
    trozos.push(props.map(p => c[p]).join(','))
  }
  return trozos.join(' / ')
}

const medido = {}
const detalle = {}

for (const ruta of RUTAS_CON_PORTAL) {
  await pag.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await pag.waitForTimeout(5000)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pag.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) {
      await b.click().catch(() => {})
      await pag.waitForTimeout(600)
    }
  }

  const estado = await pag.evaluate(() => ({
    main: !!document.querySelector('main'),
    texto: (document.body.innerText || '').slice(0, 120),
  })).catch(() => ({ main: false, texto: '' }))
  if (!estado.main) {
    console.error(
      /404|no encontrada/i.test(estado.texto)
        ? `  ROTA  ${ruta} — 404: esta ruta NO EXISTE. Corrige la lista, no el build.`
        : `  ROTA  ${ruta} — no montó <main> y no es un 404; casi seguro el servidor sirve un build viejo.`,
    )
    await nav.close()
    process.exit(2)
  }

  const cuantos = await pag.evaluate(() => {
    let i = 0
    /*
     * TODO EL DOCUMENTO, no sólo `<main>`. Hasta el 31-ago el armazón —el riel,
     * la barra superior, el pie— no lo miraba nadie, aunque esté en todas las
     * pantallas y se use más que cualquier control de contenido. Al abrirlo
     * salió uno mudo de verdad: el buscador «Buscar… ⌘K», con el fondo escrito
     * en línea ganándole al `:hover`. Al ser el armazón el mismo en todas las
     * rutas, un defecto suyo aparece en las 22 a la vez, que es lo que debe pasar.
     */
    document.querySelectorAll('a,button,[role=button]').forEach(e => {
      const b = e.getBoundingClientRect()
      if (!b.width || e.offsetParent === null) return
      if (e.disabled === true || e.getAttribute('aria-disabled') === 'true') return
      if (e.getAttribute('aria-pressed') === 'true') return
      /*
       * Y `aria-checked` / `aria-selected`, que dicen lo MISMO con el atributo
       * que le toca a cada rol: `role="radio"` se anuncia con `aria-checked` y
       * una pestaña con `aria-selected`. Esta lista sólo tenía `aria-pressed`, y
       * por eso acusaba de mudo al tipo de cita elegido en `/asistente` — un
       * `role="radio"` que declara su estado como debe. El defecto era de esta
       * lista, no de la pantalla.
       */
      if (e.getAttribute('aria-checked') === 'true') return
      if (e.getAttribute('aria-selected') === 'true') return
      if (e.getAttribute('aria-current') && e.getAttribute('aria-current') !== 'false') return
      if (e.classList.contains('active')) return
      e.dataset.acusePuntero = 'p' + (i++)
    })
    return i
  })

  const mudos = []
  let rotos = 0
  for (let i = 0; i < cuantos; i++) {
    const el = pag.locator(`[data-acuse-puntero="p${i}"]`)
    try {
      const antes = await el.evaluate(FOTO)
      await el.hover({ force: true, timeout: 4000 })
      await pag.waitForTimeout(300)
      const despues = await el.evaluate(FOTO)
      if (antes === despues) {
        /*
         * ANTES DE ACUSAR, SE MIRA SI HAY UN VELO ENCIMA.
         *
         * La bienvenida es un `position: fixed; inset: 0` con `z-index: 200`.
         * Mientras está puesta, el `:hover` del ratón cae en ELLA y no en el
         * control de debajo, así que todo lo que se mida sale «mudo» sin
         * estarlo. Y no basta con descartarla al entrar en la ruta: aparece con
         * retraso y se colaba a mitad del recorrido. Pasó de verdad — este guion
         * acusó de mudo a «Cerrar sesión» en `/consultor`, que está vivo.
         *
         * Una medición tomada bajo un velo no es una medición: se para en vez de
         * publicar un defecto que no existe.
         */
        const velo = await pag.evaluate(() => {
          for (const d of document.querySelectorAll('[role=dialog][aria-modal="true"]')) {
            const c = getComputedStyle(d)
            const b = d.getBoundingClientRect()
            if (c.position === 'fixed' && b.width > innerWidth * 0.8 && b.height > innerHeight * 0.8) return true
          }
          return false
        }).catch(() => false)
        if (velo) {
          console.error(`\n  ${ruta}: apareció un diálogo a pantalla completa durante la medición.`)
          console.error('  Lo que se midiera a partir de ahí sería el velo, no la pantalla. Se para.\n')
          await nav.close()
          process.exit(2)
        }
        const rot = await el.evaluate(e => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 34))
        mudos.push(rot.replace(/\s+/g, ' '))
      }
      await pag.mouse.move(4, 4)
    } catch (e) {
      // Un control que se va del árbol al mover el puntero no se cuenta. Pero
      // los fallos se CUENTAN: un `catch` mudo fue exactamente lo que dejó que
      // un `ReferenceError` en cada medición se leyera como «0 mudos» en las 22
      // rutas. Si se rompen muchas, esto no está midiendo y hay que decirlo.
      rotos++
      if (rotos <= 2) console.error(`        (fallo al medir en ${ruta}: ${String(e).slice(0, 90)})`)
    }
  }
  if (cuantos && rotos > cuantos / 4) {
    console.error(`\n  ${rotos} de ${cuantos} mediciones fallaron en ${ruta}. Esto no está midiendo.\n`)
    await nav.close()
    process.exit(2)
  }

  // La clave estable: el token del portal cambia en cada corrida y guardar la
  // URL literal dejaría un techo nuevo cada vez, comparable con nada.
  medido[claveDeRuta(ruta)] = mudos.length
  detalle[claveDeRuta(ruta)] = { total: cuantos, mudos }
  console.log(`  ${String(mudos.length).padStart(3)} mudos de ${String(cuantos).padEnd(4)} ${ruta}`)
  if (mudos.length) mudos.slice(0, 6).forEach(m => console.log(`        · ${m}`))
}

/*
 * ── Y LOS DIÁLOGOS, QUE SE MIDEN ABIERTOS ──────────────────────────────────
 *
 * Un control dentro de un diálogo no existe hasta que el diálogo se abre, así
 * que el recorrido por rutas de arriba no lo ve nunca. `arnes:dialogos-teclado`
 * sí los abre, pero mira el TECLADO —foco y Escape—, no el puntero.
 *
 * Medido el 31-ago al abrirlos por primera vez: el modal de agendar, limpio; el
 * panel de ayuda, **dos mudos** —el enlace «Guía» y la aspa de cerrar—, los dos
 * con el estilo en línea ganándole al `:hover`, que es el defecto de siempre.
 *
 * Sólo se miran los dos que este guion sabe abrir. Los que piden un estado
 * difícil —un cobro a medias, una firma— siguen sin mirarse, y no estar aquí
 * significa que NO se vigilan.
 */
const mudosDeDialogos = []
{
  /* Se reutiliza la pestaña que YA tiene sesión: una nueva iría a `/login` y
     el producto la rebotaría al tablero, que fue lo que pasó la primera vez. */
  const pagD = pag
  await pagD.goto(`${BASE}/citas`, { waitUntil: 'domcontentloaded' })
  await pagD.waitForTimeout(8000)
  for (const t of [/^saltar$/i, /^entendido$/i]) {
    const b = pagD.locator('button:visible').filter({ hasText: t }).first()
    if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); await pagD.waitForTimeout(700) }
  }

  const DIALOGOS = [
    {
      nombre: 'panel de ayuda',
      sel: '[role=dialog][aria-label="Asistente de ayuda"]',
      abrir: async () => { await pagD.locator('[aria-label="Abrir ayuda"]').first().click({ timeout: 5000 }) },
    },
    {
      nombre: 'modal de agendar',
      sel: '[role=dialog]',
      abrir: async () => {
        const m = pagD.locator('button:visible[aria-label^="Más acciones"]').first()
        await m.click({ timeout: 5000 })
        await pagD.waitForTimeout(1000)
        await pagD.locator('button:visible, [role=menuitem]:visible').filter({ hasText: /Editar cita/i }).first().click({ timeout: 5000 })
      },
    },
    /**
     * LOS DIÁLOGOS DE ESTADO DIFÍCIL, que hasta hoy no se abría ninguno.
     *
     * Los dos de arriba se abren con un clic desde la pantalla en la que ya
     * estamos. Éstos piden LLEVAR EL PRODUCTO A UN ESTADO: un cobro que anular,
     * y un motivo escrito para que el botón destructivo deje de estar apagado.
     *
     * Y eso importa para lo que mide este arnés: un control `disabled` se salta
     * a propósito —un botón apagado no tiene que acusar nada—, así que el botón
     * «Anular cobro» NO se medía aunque el diálogo se hubiera abierto. Sin
     * escribir el motivo, el control más peligroso del producto queda fuera de
     * la cuenta y el diálogo sale «0 mudos» sin haber mirado lo que importa.
     *
     * Es la confirmación de un acto DESTRUCTIVO sobre dinero. El golden de
     * fuente `un-dialogo-a-mano-no-atrapa-el-foco` ya exige que pase por
     * `ui/Modal`; lo que nadie había comprobado es cómo se comporta al PULSAR.
     */
    {
      nombre: 'anular un cobro',
      sel: '[role=dialog]',
      abrir: async () => {
        await pagD.goto(`${BASE}/finanzas`, { waitUntil: 'domcontentloaded' })
        await pagD.waitForTimeout(6000)
        await pagD.locator('button:visible').filter({ hasText: /^Anular$/ }).first()
          .click({ timeout: 8000 })
        await pagD.waitForTimeout(1500)
        // El motivo enciende el botón destructivo. Sin esto no se mide.
        const campo = pagD.locator('[role=dialog] textarea, [role=dialog] input[type=text]').first()
        if (await campo.count().catch(() => 0)) {
          await campo.fill('captura equivocada — medición del arnés').catch(() => {})
          await pagD.waitForTimeout(600)
        }
      },
    },
  ]

  for (const d of DIALOGOS) {
    await pagD.keyboard.press('Escape').catch(() => {})
    await pagD.waitForTimeout(800)
    await d.abrir().catch(() => {})
    await pagD.waitForTimeout(2800)
    const cuantosD = await pagD.evaluate(sel => {
      const caja = document.querySelector(sel)
      if (!caja) return -1
      let i = 0
      caja.querySelectorAll('a,button,[role=button]').forEach(e => {
        const b = e.getBoundingClientRect()
        if (!b.width || e.offsetParent === null) return
        if (e.disabled === true || e.getAttribute('aria-disabled') === 'true') return
        for (const a of ['aria-pressed', 'aria-checked', 'aria-selected']) if (e.getAttribute(a) === 'true') return
        e.dataset.acuseDialogo = 'd' + (i++)
      })
      return i
    }, d.sel).catch(() => -1)
    if (cuantosD <= 0) { console.log(`  ${'sin abrir'.padEnd(9)} ${d.nombre} — queda sin medir`); continue }
    const mudosD = []
    for (let i = 0; i < cuantosD; i++) {
      const el = pagD.locator(`[data-acuse-dialogo="d${i}"]`)
      try {
        const antes = await el.evaluate(FOTO)
        await el.hover({ force: true, timeout: 3000 })
        await pagD.waitForTimeout(200)
        if (antes === await el.evaluate(FOTO)) {
          mudosD.push((await el.evaluate(e => (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30))).replace(/\s+/g, ' '))
        }
      } catch { /* se fue del árbol */ }
    }
    console.log(`  ${String(mudosD.length).padStart(3)} mudos de ${String(cuantosD).padEnd(4)} ${d.nombre} (diálogo)`)
    mudosD.forEach(m => console.log(`        · ${m}`))
    if (mudosD.length) mudosDeDialogos.push(`${d.nombre}: ${mudosD.length} mudos (${mudosD.join(', ')})`)
  }
}

await nav.close()

// Un barrido que no encuentra controles no es un aprobado: es un barrido roto.
const totalControles = Object.values(detalle).reduce((a, d) => a + d.total, 0)
if (totalControles < 100) {
  console.error(`\n  Sólo se encontraron ${totalControles} controles en ${RUTAS_CON_PORTAL.length} rutas. No está midiendo.\n`)
  process.exit(2)
}

if (ACTUALIZAR) {
  writeFileSync(TECHOS, JSON.stringify({
    queEsEsto:
      'Controles habilitados que NO acusan el puntero, por ruta. SÓLO PUEDEN BAJAR. ' +
      'Si un cambio deja más controles mudos, se arregla el cambio — no se mueve el techo. ' +
      'Se actualiza con --actualizar y sólo cuando la mejora es real.',
    medidoEl: new Date().toISOString().slice(0, 10),
    techos: medido,
  }, null, 2) + '\n')
  console.log(`\n  Techos de estaticidad actualizados en ${TECHOS}.`)
  process.exit(0)
}

const { techos } = JSON.parse(readFileSync(TECHOS, 'utf8'))
const peores = []
const mejores = []
for (const ruta of RUTAS_CON_PORTAL.map(claveDeRuta)) {
  const antes = techos[ruta]
  if (antes === undefined) { peores.push(`${ruta}: sin techo declarado — añádelo con --actualizar`); continue }
  if (medido[ruta] > antes) peores.push(`${ruta}: ${medido[ruta]} mudos, el techo era ${antes}`)
  if (medido[ruta] < antes) mejores.push(`${ruta}: ${medido[ruta]} mudos, el techo decía ${antes}`)
}

/* Los diálogos no tienen techo por ruta: su cuenta buena es CERO y punto. */
for (const m of mudosDeDialogos) peores.push(m)

if (peores.length) {
  console.error('\n  MÁS CONTROLES MUDOS QUE ANTES:\n' + peores.map(p => '   · ' + p).join('\n') + '\n')
  process.exit(1)
}
if (mejores.length) {
  console.error(
    '\n  Hay holgura escondida: el producto está MEJOR que su techo.\n' +
    mejores.map(m => '   · ' + m).join('\n') +
    '\n\n  Baja los techos con --actualizar; si no, la mejora se puede perder sin que nadie se entere.\n',
  )
  process.exit(1)
}
console.log('\n  Sin estaticidad nueva.\n')

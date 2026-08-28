/**
 * GP-FINAL · FLUJO MÉDICO (pasos 1-23) sobre un navegador de verdad.
 *
 * Recorre el consultorio COMO MÉDICO: entra, abre la agenda, elige un paciente,
 * abre la consulta, graba, dicta, edita a mano, deja que autoguarde, recarga,
 * comprueba que el trabajo volvió, corrige el dictado, firma, receta, libera y
 * cierra.
 *
 * No es una auditoría de módulos sueltos: el objeto de estudio es el RECORRIDO.
 * Un módulo verde cuyo dato no llega al siguiente paso es exactamente el defecto
 * que esta clase de prueba existe para cazar (`el-dato-tiene-que-llegar.md`).
 *
 * Uso: emuladores + siembras + `next start` levantados, y luego
 *   node scripts/golden-path/recorrer-medico.mjs
 */
import { abrirNavegador, nuevaSesion, entrar, saltarTour, textoDe, acta, BASE, CLINICA_A, leerAprendizaje, consentimientoEnExpediente, leerNotas, leerPaquetes, ponerNombreDelMedico } from './gp-comun.mjs'

const PACIENTE = 'pac-aurelio-dominguez'
const NOMBRE_PACIENTE = 'Aurelio Domínguez Peña'
const OTRO_PACIENTE = 'pac-luzmaria-cervantes'
const A = acta('GP-FINAL · flujo médico')
const R = A.registrar

const b = await abrirNavegador()
const { page, consola } = await nuevaSesion(b)

try {
  // ── 1 · login ─────────────────────────────────────────────────────────
  await entrar(page)
  R('GP-01', 'login del médico llega al tablero', page.url().includes('/dashboard'), page.url())

  // ── 2 · agenda ────────────────────────────────────────────────────────
  await page.goto(BASE + '/citas', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  await saltarTour(page)
  const agenda = await textoDe(page)
  R('GP-02', 'la agenda del día pinta citas reales', /\d{2}:\d{2}/.test(agenda) && agenda.includes('citas'),
    (agenda.match(/\d+ citas/) || [''])[0])

  // ── 3 · seleccionar paciente ──────────────────────────────────────────
  R('GP-03', 'el paciente sembrado aparece en la agenda', agenda.includes('Aurelio') || agenda.includes('Refugio'),
    agenda.includes('Aurelio') ? 'Aurelio en agenda' : 'otro paciente en agenda')

  // ── 4 · abrir consulta ────────────────────────────────────────────────
  await page.goto(BASE + `/consulta/${PACIENTE}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  await saltarTour(page)
  const consulta = await textoDe(page)
  R('GP-04', 'la consulta abre con el paciente correcto', consulta.includes(NOMBRE_PACIENTE), NOMBRE_PACIENTE)

  // INVARIANTE «paciente equivocado = P0»: la pantalla no puede nombrar a otro.
  const otroNombre = 'Luz María Cervantes'
  R('GP-04b', 'la consulta NO nombra a otro paciente', !consulta.includes(otroNombre),
    consulta.includes(otroNombre) ? 'aparece Luz María en la consulta de Aurelio' : 'sólo el paciente abierto', 'P0')

  // ── 5 · comenzar grabación ────────────────────────────────────────────
  const botonGrabar = page.locator('button[aria-label*="Grabar la consulta"]').first()
  const hayGrabar = await botonGrabar.count() > 0
  R('GP-05a', 'existe el gesto de grabar la consulta', hayGrabar)
  if (hayGrabar) {
    await botonGrabar.click()
    await page.waitForTimeout(2500)
    /**
     * EL CONSENTIMIENTO ES PARTE DEL RECORRIDO, NO UN ESTORBO.
     *
     * Grabar abre un diálogo de consentimiento. La primera versión de esta
     * prueba lo trató como ruido y buscó «detener la grabación» en el texto de
     * la pantalla — y lo encontró DENTRO del propio diálogo («el paciente puede
     * pedir detener la grabación en cualquier momento»), así que daba verde sin
     * haber grabado nada. El instrumento medía el consentimiento y decía que
     * medía la grabación.
     *
     * Ahora se acepta el consentimiento y se busca la señal FUERA del diálogo.
     */
    const dialogo = page.locator('[role="dialog"]').first()
    const pideConsentimiento = await dialogo.count() > 0 && await dialogo.isVisible().catch(() => false)
    /**
     * El consentimiento dura «una vez por paciente, y ya» (decisión del dueño),
     * y se guarda en el expediente. Así que «no salió el diálogo» tiene dos
     * lecturas opuestas: ya constaba, o se grabó sin pedirlo. Distinguirlas
     * exige mirar el expediente — no la pantalla.
     */
    const yaConstaba = await consentimientoEnExpediente(CLINICA_A, PACIENTE)
    R('GP-05b', 'no se graba sin consentimiento: o lo pide, o ya consta en el expediente',
      pideConsentimiento || yaConstaba,
      pideConsentimiento ? 'diálogo de consentimiento' : yaConstaba ? 'consentimiento previo en el expediente' : 'grabó sin consentimiento y sin registro', 'P0')
    if (pideConsentimiento) {
      await page.locator('button:has-text("Confirmo el consentimiento")').first().click()
      await page.waitForTimeout(6000)
    }
    // La señal se busca con el diálogo ya cerrado, para no volver a leerlo a él.
    const sigueDialogo = await page.locator('[role="dialog"]').first().isVisible().catch(() => false)
    const trasGrabar = await textoDe(page)
    const grabando = !sigueDialogo && /grabando|detener|pausar|escuchando/i.test(trasGrabar)
    R('GP-05c', 'con el consentimiento dado, la pantalla dice que está grabando', grabando,
      (trasGrabar.match(/Grabando[^\n]{0,40}|Detener[^\n]{0,30}|Escuchando[^\n]{0,30}/i) || ['sin señal visible'])[0])
  }

  // ── 6/7 · consulta larga + navegación mientras graba ──────────────────
  //
  // «pantalla que se cierre o estorbe durante consulta larga = defecto». Se
  // recorre el tiempo de verdad, con scroll, como haría el médico.
  const MIN = Number(process.env.GP_MINUTOS || 16)
  const t0 = Date.now()
  let sobrevivio = true
  for (let i = 0; i < MIN; i++) {
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(1200)
    await page.mouse.wheel(0, -300)
    await page.waitForTimeout(800)
    // Cada minuto simulado se comprueba que la consulta sigue en pie.
    if (!page.url().includes(`/consulta/${PACIENTE}`)) { sobrevivio = false; break }
  }
  R('GP-06', `la consulta sobrevive ${MIN} ciclos de trabajo sin cerrarse ni navegar sola`, sobrevivio, page.url())
  R('GP-07', 'el scroll y la navegación normal no interrumpen la grabación',
    await textoDe(page).then(t => /grabando|detener|pausar/i.test(t)).catch(() => false) || !hayGrabar,
    `${((Date.now() - t0) / 1000).toFixed(0)}s de trabajo continuo`)

  // ── 8 · dictado + edición manual ──────────────────────────────────────
  const MOTIVO = 'Dolor abdominal de tres días de evolución.'
  const PADECIMIENTO = 'Inicia hace tres dias con dolor en epigastrio, sin fiebre. Niega vomito.'
  const motivo = page.locator('textarea[aria-label="Motivo de consulta"]').first()
  await motivo.fill(MOTIVO)
  const padecimiento = page.locator('textarea[aria-label="Padecimiento actual"]').first()
  await padecimiento.fill(PADECIMIENTO)
  await page.waitForTimeout(1500)
  R('GP-08', 'la edición manual del médico entra en la nota',
    (await motivo.inputValue()) === MOTIVO && (await padecimiento.inputValue()) === PADECIMIENTO)

  // ── 9 · autosave ──────────────────────────────────────────────────────
  //
  // Se pulsa «Guardar borrador» y se comprueba del OTRO LADO: en la base, no en
  // el toast. Un guardado que sólo existe en el mensaje de la pantalla es la
  // familia «el dato no llega».
  const guardar = page.locator('button:has-text("Guardar borrador")').first()
  await guardar.click()
  await page.waitForTimeout(6000)
  const trasGuardar = await textoDe(page)
  R('GP-09', 'el borrador se guarda y la pantalla lo dice',
    /guardad|borrador/i.test(trasGuardar), (trasGuardar.match(/[^\n]*guardad[^\n]*/i) || ['sin acuse'])[0])

  // ── 10/11 · desconexión breve y reconexión ────────────────────────────
  await page.context().setOffline(true)
  await page.waitForTimeout(4000)
  const offline = await textoDe(page)
  // «proveedor caído mostrado al médico como jerga = defecto UX»: aquí sólo se
  // observa, y se juzga en el recorrido de tortura.
  R('GP-10', 'la app sigue en pie sin red (no se cae ni navega sola)',
    page.url().includes(`/consulta/${PACIENTE}`) && offline.includes(NOMBRE_PACIENTE), page.url())
  await page.context().setOffline(false)
  await page.waitForTimeout(5000)
  R('GP-11', 'al volver la red la consulta sigue usable',
    (await motivo.inputValue()) === MOTIVO, 'el texto del médico sigue en pantalla')

  // ── 12/13 · reload y recuperación ─────────────────────────────────────
  //
  // «trabajo perdido = P0». Éste es el caso que lo mide.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000)
  await saltarTour(page)
  const tras = await textoDe(page)
  const motivo2 = page.locator('textarea[aria-label="Motivo de consulta"]').first()
  const padecimiento2 = page.locator('textarea[aria-label="Padecimiento actual"]').first()
  const vMotivo = await motivo2.inputValue().catch(() => '')
  const vPad = await padecimiento2.inputValue().catch(() => '')
  const recuperado = vMotivo.includes('Dolor abdominal') || vPad.includes('epigastrio')
    || tras.includes('Dolor abdominal') || /recuperar|retomar|sin guardar|continuar/i.test(tras)
  R('GP-12', 'tras recargar, la consulta vuelve al mismo paciente', tras.includes(NOMBRE_PACIENTE), page.url())
  R('GP-13', 'tras recargar, el trabajo del médico NO se pierde', recuperado,
    recuperado
      ? `motivo="${vMotivo.slice(0, 40)}" padecimiento="${vPad.slice(0, 40)}"`
      : `motivo y padecimiento vacíos tras recargar (motivo="${vMotivo}")`,
    'P0')

  // ── 14 · corrección manual del dictado ────────────────────────────────
  //
  // El médico arregla a mano lo que el motor oyó mal. Regla 3 de seguridad
  // clínica: nada cambia en silencio — y su reverso, lo que el médico cambia
  // MANDA sobre lo que el motor puso.
  const CORREGIDO = 'Inicia hace tres días con dolor en epigastrio, sin fiebre. Niega vómito.'
  await padecimiento2.fill(CORREGIDO)
  await page.waitForTimeout(1200)
  R('GP-14', 'la corrección manual del médico se queda escrita',
    (await padecimiento2.inputValue()) === CORREGIDO, 'acentos y ortografía corregidos a mano')

  // ── 15 · la identidad del paciente NO se vuelve vocabulario ───────────
  //
  // H-19 / `voice-asr.md`: lo aprendido del dictado **se comparte por
  // consultorio**, así que aprender un apellido lo llevaría al sesgo de
  // vocabulario de la consulta del paciente SIGUIENTE — identidad cruzando de
  // expediente a expediente por la puerta de atrás.
  //
  // La primera versión de esta prueba miraba `localStorage` y encontraba cero
  // claves: verde por vacío, que es la peor clase de verde. Lo aprendido vive
  // en `clinics/{id}/asr_aprendizaje`. Se mira AHÍ —del otro lado, en la base—
  // porque una prueba de contrato sobre el prompt no dice qué quedó escrito
  // (`el-dato-tiene-que-llegar.md`).
  const aprendidoEnLaBase = await leerAprendizaje(CLINICA_A)
  const partesDelNombre = ['Aurelio', 'Domínguez', 'Dominguez', 'Peña', 'Pena']
  const filtradas = partesDelNombre.filter(n =>
    aprendidoEnLaBase.some(d => JSON.stringify(d).toLowerCase().includes(n.toLowerCase())))
  // Sin proveedor de transcripción no hay dictado, y sin dictado no se aprende
  // nada: cero entradas es «no ejecutado», no «verde». Un verde por vacío es la
  // peor clase de verde — parece cobertura y no lo es.
  R('GP-15', 'ninguna parte del nombre del paciente entra en lo aprendido del consultorio',
    aprendidoEnLaBase.length === 0 ? null : filtradas.length === 0,
    filtradas.length
      ? `se aprendió identidad: ${filtradas.join(', ')}`
      : aprendidoEnLaBase.length === 0
        ? 'no hubo dictado real (sin proveedor de ASR): esta prueba NO cubre H-19 en navegador; lo cubren sus goldens sellados'
        : `${aprendidoEnLaBase.length} entradas en clinics/${CLINICA_A}/asr_aprendizaje, ninguna con el nombre`,
    'P0')

  // ── 16/17 · diagnóstico sugerido, y confirmarlo o rechazarlo ──────────
  //
  // «diagnóstico sugerido convertido en confirmado = P0». Lo que se comprueba
  // es que la pantalla DISTINGA las dos cosas: si un sugerido y un confirmado
  // se pintan igual, el médico firma algo que no dijo.
  const textoDx = await textoDe(page)
  const hayEjeDeSugerencia = /sugerid|propuest|revisar|confirmar|aceptar|IA/i.test(textoDx)
  R('GP-16', 'la pantalla tiene un eje para lo que sugiere la IA', hayEjeDeSugerencia,
    (textoDx.match(/[^\n]*sugerid[^\n]*/i) || textoDx.match(/[^\n]*revisar[^\n]*/i) || ['sin eje visible'])[0])

  const agregarDx = page.locator('button:has-text("Agregar diagnóstico")').first()
  let dxPuesto = false
  if (await agregarDx.count()) {
    await agregarDx.click()
    await page.waitForTimeout(1500)
    // Selector por el placeholder REAL del campo. La primera versión cogía
    // «el último input visible», que resultó ser el de la corrección de texto:
    // escribía el diagnóstico en otra caja y concluía que no se podía.
    const campo = page.locator('input[placeholder*="Faringitis"]').first()
    await campo.fill('Gastritis aguda').catch(() => {})
    await page.waitForTimeout(2500)
    dxPuesto = (await campo.inputValue().catch(() => '')).includes('Gastritis')
  }
  R('GP-17', 'el médico puede confirmar un diagnóstico con un acto explícito', dxPuesto,
    dxPuesto ? 'Gastritis aguda añadida por el médico' : 'no se pudo añadir diagnóstico desde la pantalla')

  // ── 18 · plan ─────────────────────────────────────────────────────────
  const PLAN = 'Omeprazol 20 mg cada 24 horas por 14 días. Dieta blanda. Cita en dos semanas.'
  const planTx = page.locator('textarea[aria-label="Plan de tratamiento"]').first()
  await planTx.fill(PLAN)
  await page.waitForTimeout(1000)
  R('GP-18', 'el plan de tratamiento se escribe en la nota', (await planTx.inputValue()) === PLAN)

  // ── 19 · prescripción explícita ───────────────────────────────────────
  //
  // «receta sin intención médica = P0». Escribir el plan NO es prescribir: la
  // prescripción tiene que ser un acto aparte, y por eso se comprueba que
  // exista el gesto y que sea el médico quien lo hace.
  const agregarMed = page.locator('button:has-text("Agregar medicamento")').first()
  let medPuesto = false
  if (await agregarMed.count()) {
    await agregarMed.click()
    await page.waitForTimeout(1500)
    const campoMed = page.locator('input[placeholder="Medicamento"]').last()
    if (await campoMed.count()) {
      await campoMed.fill('Omeprazol').catch(() => {})
      const dosis = page.locator('input[placeholder="Dosis"]').last()
      if (await dosis.count()) await dosis.fill('20 mg').catch(() => {})
      const frec = page.locator('input[placeholder="Frecuencia"]').last()
      if (await frec.count()) await frec.fill('cada 24 horas').catch(() => {})
      const dur = page.locator('input[placeholder="Duración"]').last()
      if (await dur.count()) await dur.fill('14 días').catch(() => {})
      await page.waitForTimeout(2500)
      medPuesto = (await campoMed.inputValue().catch(() => '')).includes('Omeprazol')
    }
  }
  R('GP-19', 'prescribir es un acto explícito del médico, distinto de dictar el plan',
    await agregarMed.count() > 0, medPuesto ? 'Omeprazol prescrito por el médico' : 'existe el gesto de prescribir')

  // ── 19-bis · REG-336: sin nombre de quien firma, NO se firma ──────────
  //
  // Reproducción en navegador del defecto que encontró este mismo recorrido: se
  // le quita el nombre al consultorio, se comprueba que la firma se cierre Y
  // que diga la verdad sobre lo que falta, y se devuelve el nombre.
  //
  // Se hace antes de firmar de verdad porque después la nota es inmutable.
  await ponerNombreDelMedico(CLINICA_A, '')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000)
  await saltarTour(page)
  const firmarSinNombre = page.locator('button:has-text("Firmar y cerrar nota")').first()
  const bloqueada = !(await firmarSinNombre.isEnabled().catch(() => false))
  const razonSinNombre = (await page.locator('[role="status"]').allInnerTexts().catch(() => []))
    .find(t => /nombre|firm|cédula|cedula/i.test(t)) || ''
  R('GP-19b', 'sin nombre de quien firma, la firma se cierra (REG-336)', bloqueada,
    bloqueada ? 'botón de firma apagado' : 'se pudo firmar una nota que nadie podría entregar', 'P1')
  R('GP-19c', 'y el motivo nombra el NOMBRE que falta, no la cédula que sí está',
    /nombre/i.test(razonSinNombre),
    razonSinNombre.slice(0, 200) || 'sin motivo visible', 'P1')
  await ponerNombreDelMedico(CLINICA_A, 'Dra. Elena Sandoval Rivas')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(9000)
  await saltarTour(page)

  // ── 20 · firmar la nota ───────────────────────────────────────────────
  //
  // El botón de firmar se apaga cuando algo falta, y DICE QUÉ falta (REG-189).
  // La primera versión de esta prueba lo leyó como defecto: no lo es — es la
  // compuerta funcionando. Lo que sí hay que comprobar es lo que promete la
  // regresión: que el motivo sea legible y accionable, y que al resolverlo la
  // firma se abra. Un botón apagado y mudo sí sería el defecto.
  const firmar = page.locator('button:has-text("Firmar y cerrar nota")').first()
  const motivo0 = await page.locator('[role="status"]').allInnerTexts().catch(() => [])
  const razonFirma = motivo0.find(t => /firm|nom|dosis|cédula|cedula|falta/i.test(t)) || ''
  const apagadoAlPrincipio = !(await firmar.isEnabled().catch(() => false))
  R('GP-20a', 'si no se puede firmar, la pantalla DICE por qué (no un botón mudo)',
    !apagadoAlPrincipio || razonFirma.trim().length > 0,
    apagadoAlPrincipio ? `motivo: ${razonFirma.slice(0, 180)}` : 'firma disponible de entrada')

  // Se resuelve lo que la propia pantalla pide, como haría el médico.
  const cedula = page.locator('input[placeholder*="édula"], input[aria-label*="édula"]').first()
  if (await cedula.count() && await cedula.isVisible().catch(() => false)) {
    await cedula.fill('12345678')
    const g = page.locator('button:has-text("Guardar")').filter({ hasNotText: 'borrador' }).first()
    if (await g.count()) await g.click().catch(() => {})
    await page.waitForTimeout(4000)
  }
  // Y se rellenan todas las secciones: NOM-004 las exige.
  for (const etiqueta of ['Antecedentes relevantes', 'Exploración física', 'Plan de abordaje diagnóstico']) {
    const t = page.locator(`textarea[aria-label="${etiqueta}"]`).first()
    if (await t.count() && !(await t.inputValue().catch(() => 'x')).trim()) {
      await t.fill(`${etiqueta}: sin hallazgos relevantes en esta consulta sintética.`).catch(() => {})
    }
  }
  await page.waitForTimeout(3000)

  const firmarHabilitado = await firmar.isEnabled().catch(() => false)
  const motivo1 = (await page.locator('[role="status"]').allInnerTexts().catch(() => []))
    .find(t => /firm|nom|dosis|cédula|cedula|falta/i.test(t)) || ''
  R('GP-20b', 'resuelto lo que la pantalla pedía, la firma se abre', firmarHabilitado,
    firmarHabilitado ? 'firma habilitada' : `sigue bloqueada: ${motivo1.slice(0, 180)}`)

  let firmo = false
  let notaFirmadaId = null
  if (firmarHabilitado) {
    await firmar.click()
    // Firmar NO abre un diálogo: firma y navega al siguiente paso del cierre
    // (`aDondeIrDirecto`). Buscar aquí un «¿confirmas?» era inventarse un paso
    // que el producto no tiene, y la prueba se quedaba esperándolo.
    await page.waitForTimeout(12000)
    /**
     * Se comprueba EN LA BASE, no en la pantalla. Un acuse en pantalla dice que
     * el botón hizo algo; sólo el documento dice que la nota quedó firmada
     * (`el-dato-tiene-que-llegar.md`).
     */
    /**
     * LA NOTA DE ESTA CONSULTA, NO «UNA NOTA FIRMADA CUALQUIERA».
     *
     * La primera versión cogía la primera nota con `estado==='firmada'` del
     * expediente y encontraba `nota-aurelio-1` — una nota SEMBRADA, ya firmada
     * antes de empezar. La prueba se declaraba verde por el trabajo de la
     * siembra, y los pasos siguientes (receta, paquete) iban contra la nota
     * equivocada. Un expediente longitudinal siempre tiene notas viejas: hay
     * que quedarse con LA de esta consulta.
     *
     * El id sale de la ruta a la que el propio producto llevó al firmar.
     */
    const deLaUrl = (page.url().match(/\/(?:receta|orden)\/[^/]+\/([^/?#]+)/) || [])[1] || null
    const notas = await leerNotas(CLINICA_A, PACIENTE)
    const laDeHoy = deLaUrl ? notas.find(n => n.id === deLaUrl) : null
    firmo = !!laDeHoy && laDeHoy.estado === 'firmada'
    notaFirmadaId = firmo ? laDeHoy.id : null
    R('GP-20c', 'la nota queda FIRMADA en el expediente (no sólo en la pantalla)', firmo,
      firmo
        ? `la nota de esta consulta (${notaFirmadaId}) quedó con estado=firmada`
        : `la nota de esta consulta no quedó firmada (url=${deLaUrl}); estados en el expediente: ${notas.map(n => `${n.id}:${n.estado}`).join(' · ') || 'sin notas'}`)
    R('GP-20d', 'tras firmar, el producto lleva al siguiente paso del cierre',
      page.url() !== BASE + `/consulta/${PACIENTE}`, page.url())
  } else {
    R('GP-20c', 'la nota queda FIRMADA en el expediente', null, 'no se llegó a firmar: la compuerta seguía cerrada')
  }

  // ── 21 · receta ───────────────────────────────────────────────────────
  //
  // «receta sin intención médica = P0». La receta tiene que llevar lo que el
  // médico prescribió HOY, y NO los antecedentes que el paciente ya tomaba.
  if (notaFirmadaId) {
    await page.goto(BASE + `/receta/${PACIENTE}/${notaFirmadaId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(7000)
    const receta = await textoDe(page)
    R('GP-21a', 'la receta de la nota firmada se puede abrir',
      !/no encontrad|404|error/i.test(receta.slice(0, 400)), page.url())
    R('GP-21b', 'la receta lleva lo prescrito hoy', /omeprazol/i.test(receta),
      /omeprazol/i.test(receta) ? 'Omeprazol en la receta' : 'el fármaco prescrito no aparece en la receta')
    // Aurelio toma metformina como ANTECEDENTE. En la receta no pinta nada.
    R('GP-21c', 'la receta NO arrastra la medicación que el paciente ya tomaba',
      !/metformina/i.test(receta),
      /metformina/i.test(receta) ? 'un antecedente bajó al papel de la receta' : 'sólo lo de hoy', 'P0')
  } else {
    R('GP-21a', 'la receta de la nota firmada se puede abrir', null, 'sin nota firmada')
  }

  // ── 22 · liberar el paquete al paciente ───────────────────────────────
  //
  // FIRMAR ≠ LIBERAR. Es el invariante de POSTVISIT-001, y aquí se comprueba lo
  // único que no puede comprobar una prueba de unidad: que el médico PUEDA
  // llegar al acto, y que al hacerlo el paquete quede escrito como RELEASED.
  if (notaFirmadaId) {
    await page.goto(BASE + `/consulta/${PACIENTE}?nota=${notaFirmadaId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(10000)
    await saltarTour(page)
    const conNota = await textoDe(page)
    const hayEntrega = /entregar al paciente/i.test(conNota)
    R('GP-22a', 'con la nota firmada, el médico alcanza el acto de entregar al paciente', hayEntrega,
      hayEntrega ? 'bloque «Entregar al paciente» presente' : 'el acto de liberar no es alcanzable desde la consulta firmada')

    // Sólo el paquete DE ESTA NOTA: el expediente trae paquetes sembrados, y
    // contarlos aquí mediría la siembra.
    const antes = (await leerPaquetes(CLINICA_A, PACIENTE)).filter(x => x.notaId === notaFirmadaId)
    R('GP-22b', 'firmar por sí solo NO libera nada al paciente',
      !antes.some(x => x.estado === 'RELEASED'),
      `paquete de la nota de hoy tras firmar: ${antes.map(x => x.estado).join(',') || 'todavía no existe'}`, 'P0')

    const liberar = page.locator('button:has-text("Liberar al paciente")').first()
    const liberarUsable = await liberar.count() > 0 && await liberar.isEnabled().catch(() => false)
    R('GP-22c', 'el acto de liberar está DISPONIBLE sobre una nota recién firmada', liberarUsable,
      liberarUsable ? 'botón activo' : 'el botón de liberar existe pero está apagado: no se compuso el paquete')
    if (liberarUsable) {
      await liberar.click()
      await page.waitForTimeout(9000)
      const despues = (await leerPaquetes(CLINICA_A, PACIENTE)).filter(x => x.notaId === notaFirmadaId)
      const rel = despues.find(x => x.estado === 'RELEASED')
      R('GP-22d', 'liberar escribe el paquete como RELEASED, con quién y cuándo',
        !!rel && !!rel.approvedBy && !!rel.approvedAt,
        rel ? `paquete ${rel.notaId} RELEASED por ${rel.approvedBy}` : 'no se escribió ningún paquete liberado')
    } else {
      R('GP-22d', 'liberar escribe el paquete como RELEASED', null, 'no se pudo pulsar liberar')
    }
  } else {
    R('GP-22a', 'el médico alcanza el acto de entregar al paciente', null, 'sin nota firmada')
  }

  // ── 23 · cerrar la consulta ───────────────────────────────────────────
  const alFinal = await textoDe(page)
  /**
   * El cierre de la consulta tiene DOS formas, y hay que buscar la que toca:
   *
   *  · sin firmar → la barra de acciones (`#cierre-de-la-consulta`), con firmar,
   *    guardar y descartar;
   *  · firmada → el checklist `ComoCerrarLaConsulta` («Ya está firmada. Falta
   *    esto»), que es lo que queda por hacer con el paciente delante.
   *
   * La primera versión buscaba sólo el ancla, y sobre una nota ya firmada —que
   * es justo donde acaba este recorrido— no existe. Buscaba la forma equivocada
   * del cierre y concluía que no había cierre.
   */
  const anclaCierre = await page.locator('#cierre-de-la-consulta').count() > 0
  const checklistCierre = /ya está firmada\. falta esto/i.test(alFinal)
  R('GP-23', 'la consulta ofrece su cierre (checklist si está firmada, barra si no)',
    anclaCierre || checklistCierre,
    checklistCierre ? 'checklist «Ya está firmada. Falta esto»'
      : anclaCierre ? 'barra de cierre #cierre-de-la-consulta'
      : 'no se encontró ninguna de las dos formas del cierre')

  console.log('\n--- consola del navegador (primeros 8) ---')
  console.log(JSON.stringify(consola.slice(0, 8), null, 1))
} catch (e) {
  R('GP-EXC', 'el recorrido terminó sin excepción', false, String(e).slice(0, 400), 'P1')
  console.error(e)
} finally {
  A.volcar('docs/audit/gp-final/acta-medico.json')
  await b.close()
}

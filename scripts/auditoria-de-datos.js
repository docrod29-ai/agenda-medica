/**
 * AUDITORÍA DE INVARIANTES SOBRE DATOS REALES — un solo bloque, para pegar.
 *
 * ── POR QUÉ ES UN ARCHIVO PARA PEGAR Y NO UNA PRUEBA ─────────────────────────
 *
 * Los datos de producción llevan PHI, así que esto **no puede correr en CI**.
 * Corre en el navegador del dueño, con su sesión, y **sólo devuelve recuentos**:
 * ningún nombre, ningún alérgeno, ningún texto clínico sale de aquí.
 *
 * ── DE DÓNDE SALE ────────────────────────────────────────────────────────────
 *
 * El 5-ago-2026, seis defectos aparecieron en un solo día y **los seis se
 * encontraron mirando los datos, no el código**:
 *
 *   · REG-167 — el sesgo degradaba el motor de voz al modelo viejo.
 *   · REG-170 — el bucle de corrección nunca había aprendido una palabra.
 *   · REG-171 — un alérgico a TMP/SMX quedaba alérgico a «SMX)».
 *   · REG-172 — «no especificada» apagaba el guard de la insulina.
 *   · REG-173 — el aviso de dosis llegaba después de firmar.
 *   · REG-153 — el cobro duplicado (reparado antes de materializarse).
 *
 * Ninguno era visible desde el repositorio. Esto es la herramienta que los
 * encontró, ya ordenada para volver a pasarla.
 *
 * ── CÓMO SE USA ──────────────────────────────────────────────────────────────
 *
 * Con la aplicación abierta y la sesión iniciada, se pega entero en la consola
 * del navegador. Devuelve una tabla de invariantes con su cuenta.
 *
 * ── LA TRAMPA QUE YA MORDIÓ UNA VEZ ──────────────────────────────────────────
 *
 * Leer un campo que no existe devuelve vacío, **no un error**. La primera
 * medición de citas dio «0 dobles reservas» buscando `fecha` y `hora` cuando el
 * documento usa `fechaHora`: el número salió correcto por accidente y la
 * medición estaba mal.
 *
 * Por eso cada bloque comprueba primero que el campo exista, y lo dice.
 */
(async () => {
  // ── Sesión ────────────────────────────────────────────────────────────────
  const abrir = () => new Promise((res, rej) => {
    const r = indexedDB.open('firebaseLocalStorageDb')
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  const db = await abrir()
  const todo = await new Promise(res => {
    const t = db.transaction('firebaseLocalStorage', 'readonly')
      .objectStore('firebaseLocalStorage').getAll()
    t.onsuccess = () => res(t.result)
  })
  const u = todo.map(x => x.value).find(v => v && v.uid)
  if (!u) return console.error('Sin sesión iniciada.')
  const tk = u.stsTokenManager.accessToken
  const proj = JSON.parse(atob(tk.split('.')[1])).aud
  const base = `https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents`
  const H = { Authorization: `Bearer ${tk}` }
  const leer = async p => (await fetch(`${base}/${p}`, { headers: H })).json()

  const mem = await leer(`clinic_members/${u.uid}`)
  const cid = mem.fields?.clinicId?.stringValue
  if (!cid) return console.error('Esta cuenta no pertenece a ningún consultorio.')

  const texto = (f, k) => (f?.[k]?.stringValue || '').trim()
  const filas = []
  const anota = (invariante, cumplen, incumplen, nota = '') =>
    filas.push({ invariante, cumplen, incumplen, nota })

  // ── Notas ─────────────────────────────────────────────────────────────────
  const ps = await leer(`clinics/${cid}/patients?pageSize=300`)
  const pacientes = ps.documents || []
  let firmadas = 0, sinSello = 0, sinFirma = 0, sinCedula = 0, sinEstadoRaiz = 0
  let deVozFirmadas = 0, sinOrigen = 0
  let meds = 0, sinDosis = 0, viaFueraDelTipo = 0
  const VIAS = ['oral', 'iv', 'im', 'sc', 'topica', 'inhalatoria', 'sublingual', 'rectal', 'otra']

  for (const p of pacientes) {
    const pid = p.name.split('/').pop()
    const ns = await leer(`clinics/${cid}/patients/${pid}/notas?pageSize=50`)
    for (const d of (ns.documents || [])) {
      const f = d.fields || {}
      if (!f.estado) sinEstadoRaiz++
      if (texto(f, 'estado') !== 'firmada') continue
      firmadas++
      const meta = f.metadata?.mapValue?.fields || {}
      const firma = f.firma?.mapValue?.fields || {}
      if (!texto(meta, 'hashIntegridad')) sinSello++
      if (!f.firma) sinFirma++
      if (!texto(firma, 'cedulaProfesional')) sinCedula++
      if (texto(meta, 'fuenteGeneracion') === 'ia_voz') {
        deVozFirmadas++
        if (!texto(f, 'transcripcionMotor')) sinOrigen++
      }
      for (const m of (f.medicamentos?.arrayValue?.values || [])) {
        const g = m.mapValue?.fields || {}
        if (!texto(g, 'nombre')) continue
        meds++
        if (!texto(g, 'dosis')) sinDosis++
        const via = texto(g, 'via').toLowerCase()
        if (via && !VIAS.includes(via)) viaFueraDelTipo++
      }
    }
  }
  anota('Nota firmada ⇒ sello de integridad', firmadas - sinSello, sinSello)
  anota('Nota firmada ⇒ bloque de firma', firmadas - sinFirma, sinFirma)
  anota('Nota firmada ⇒ cédula profesional', firmadas - sinCedula, sinCedula)
  anota('Nota ⇒ `estado` en la raíz', '—', sinEstadoRaiz, 'las reglas lo exigen para crear')
  anota('Nota de voz firmada ⇒ transcripcionMotor', deVozFirmadas - sinOrigen, sinOrigen, 'REG-170: sin él el bucle no aprende')
  anota('Medicamento ⇒ tiene dosis', meds - sinDosis, sinDosis, 'REG-173: avisa antes de firmar')
  anota('Medicamento ⇒ vía del enum', meds - viaFueraDelTipo, viaFueraDelTipo, 'REG-172: «no especificada» apagaba el guard')

  // ── Cobros ────────────────────────────────────────────────────────────────
  const cobros = []
  let tok = null
  do {
    const r = await leer(`clinics/${cid}/cobros?pageSize=300${tok ? `&pageToken=${tok}` : ''}`)
    for (const d of (r.documents || [])) cobros.push(texto(d.fields, 'referenciaExterna'))
    tok = r.nextPageToken
  } while (tok)
  const conRef = cobros.filter(Boolean)
  const dup = conRef.length - new Set(conRef).size
  anota('Cobro de Stripe ⇒ referencia única', conRef.length - dup, dup, 'REG-153: id determinista')

  // ── Citas ─────────────────────────────────────────────────────────────────
  const cs = await leer(`clinics/${cid}/appointments?pageSize=300`)
  const citas = cs.documents || []
  /**
   * El campo se comprueba ANTES de contar. Con `fecha`/`hora` —que no existen—
   * el resultado salía «0 dobles reservas» y parecía correcto.
   */
  const usaFechaHora = citas.some(d => d.fields?.fechaHora)
  if (!usaFechaHora && citas.length) {
    anota('Cita ⇒ sin doble reserva', '?', '?', 'NO MEDIDO: falta el campo `fechaHora`')
  } else {
    const claves = citas
      .filter(d => !['cancelada', 'no-asistio'].includes(texto(d.fields, 'estado')))
      .map(d => `${texto(d.fields, 'fechaHora')}|${texto(d.fields, 'medicoId') || texto(d.fields, 'doctorId')}`)
      .filter(k => k.length > 1)
    const dobles = claves.length - new Set(claves).size
    anota('Cita activa ⇒ sin doble reserva', claves.length - dobles, dobles)
  }

  console.table(filas)
  console.log('Sólo recuentos. Ningún dato clínico salió de este navegador.')
  return filas
})()

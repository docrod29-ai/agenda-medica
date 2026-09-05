/**
 * LA CAPTURA LLAMADA «COMPLETA» ENSEÑABA UN TERCIO DE LA PANTALLA — REG-514.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * Sembrando `/pendientes` para poder juzgarla. La sonda contestó `alto: 844` y
 * guardó su `…-390-completa.png`, y al recorrer la pantalla a mano el
 * contenedor de dentro medía **2 407 px**. O sea que la captura «completa»
 * enseñaba el 35 % de la pantalla.
 *
 * Comprobado con `md5sum`, no deducido: el archivo `…-completa.png` sale **byte
 * a byte idéntico** al del pliegue. Y no era cosa de `/pendientes` — pasaba en
 * las CINCO pantallas ya auditadas de esta rama:
 *
 *     ruta                 documento   contenido real
 *     /consulta/pac-001          844            3 094
 *     /dashboard                 844            2 651
 *     /pendientes                844            2 407
 *     /expediente/pac-001        844            1 844
 *     /citas                     844            1 627
 *
 * ── LA CAUSA ────────────────────────────────────────────────────────────────
 *
 * El cascarón `(dashboard)` fija el documento al alto de la ventana y scrollea
 * un `<main>` de dentro. `fullPage: true` extiende el DOCUMENTO — y el
 * documento ya cabe, así que no tiene nada que extender. Por el mismo motivo
 * `document.documentElement.scrollHeight` decía 844: el número tampoco delataba
 * nada.
 *
 * ── POR QUÉ ESTO ES LO PEOR QUE LE PUEDE PASAR A UN ARNÉS ───────────────────
 *
 * El master loop dice que una pantalla no se aprueba leyendo el código: se
 * lanza, se mira y se recorre. Esta sonda existe para eso — y estaba dando por
 * mirado lo que no había enseñado, con un nombre de archivo que prometía lo
 * contrario. **Cuatro pantallas de esta rama se declararon vistas habiendo
 * visto el primer pliegue.**
 *
 * Es «el dato tiene que LLEGAR» cometido en la herramienta que audita, y la
 * hermana exacta de REG-440: allí la siembra enseñaba menos de lo que había y
 * hacía perseguir un defecto inexistente; aquí la captura enseñaba menos de lo
 * que había y hacía dar por buena una pantalla sin verla. Los dos mienten con
 * la autoridad de haber sido medidos.
 *
 * ── LO QUE **NO** ESTABA MAL, Y HAY QUE DECIRLO ─────────────────────────────
 *
 * Los conteos —desbordamiento, campos sin etiqueta, objetivos táctiles— salen
 * de `getBoundingClientRect`, que se calcula sobre el layout entero
 * independientemente del scroll. Esos números **siempre fueron correctos**. Lo
 * ciego eran los ojos, no la aritmética. Se recorrió el bajo pliegue de las
 * cinco pantallas con el arreglo puesto y no apareció ningún defecto nuevo.
 *
 * ── EL SEGUNDO DEFECTO DE LA MISMA MIRADA: CONTAR CAJAS NO ES CONTAR DEDOS ──
 *
 * En `/pendientes` la sonda denunciaba **7 objetivos táctiles pequeños de 7**, y
 * los siete eran el nombre del paciente que encabeza cada pendiente —
 * `a.nx-ident`, que YA está en la familia de `globals.css` que estira el área de
 * golpe con un pseudo (REG-442). Medidos por su caja salen a 20; al dedo miden
 * 45. En `/dashboard` eran 10 de 10.
 *
 * Un número que es cien por cien ruido no se lee — y la vez que traiga un
 * objetivo pequeño de verdad, tampoco. Tercera vez que esta sonda grita en
 * falso (REG-434, REG-439).
 *
 * **No se arregló filtrando por clase.** Lo barato era «no cuentes
 * `a.nx-ident`», y eso es CREERLE al CSS: el día que alguien saque esa clase de
 * la familia, o mueva la regla fuera de `@media (pointer: coarse)`, la sonda
 * seguiría callada. Ahora se le pregunta al navegador a quién atribuye cada
 * punto —el mismo barrido de `el-area-de-golpe-de-una-fila-de-cita.mjs`—, así
 * que un mecanismo roto reaparece en la cuenta solo.
 *
 * ── Y EL BARRIDO ME SALIÓ MAL A LA PRIMERA ──────────────────────────────────
 *
 * La primera versión aceptaba el punto si el elemento golpeado era el enlace,
 * un hijo suyo **o un ancestro** (`h.contains(el)`). Con eso el barrido se
 * derramaba por la tarjeta entera y un enlace de 20 px medía 59 de golpe. Lo
 * cazó que las dos sondas no coincidían: la dedicada decía 45 y ésta 59.
 *
 * Una medición que aprueba de más es peor que la que gritaba en falso: aquélla
 * molestaba, ésta habría escondido. Quitado el `h.contains(el)`, las dos sondas
 * dan 45.
 *
 * ── Y EL TERCERO: `/pendientes` NO SE PODÍA JUZGAR ──────────────────────────
 *
 * La siembra no escribía ni una tarea, así que la pantalla salía siempre en su
 * estado vacío. Ahora siembra ocho —**una por cada grupo** de
 * `estado-de-accion.ts`, más una cerrada—, porque un grupo que no se pinta no
 * se puede juzgar y la auditoría visual mentiría por omisión.
 *
 * `pesoUrgencia` SE DERIVA de la prioridad, con la escalera del producto:
 * sembrar directo a Firestore se salta `crearTareas`, que es «la única puerta»
 * que lo escribe, y sin ese número el worklist no se puede ordenar por urgencia.
 * Misma figura que REG-440 con `ultimaCita`, y por eso lleva el mismo guardián.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **Este guardián es de FUENTE.** Que la captura enseñe la pantalla entera y
 *   que el golpe mida 45 lo dice el navegador, y esas sondas **no corren en
 *   CI**: necesitan emuladores.
 * · **No comprueba el ESTILO de captura de otras sondas.** `caminar-con-el-
 *   teclado.mjs`, `el-estado-sobrevive-a-la-interrupcion.mjs` y las de
 *   `carril-excelencia/` no se revisaron por este defecto. Se dice: pueden
 *   tenerlo.
 * · **No dice que `/pendientes` esté auditada de punta a punta.** Se recorrió a
 *   390 px y se miraron sus cuatro pantallas: cero desbordamiento, cero campos
 *   sin etiqueta, cero errores de consola, seis grupos pintados. El recorrido
 *   con teclado, el bloque «Ver cerrados recientemente» desplegado y el diálogo
 *   de «¿Por qué está aquí?» quedan sin mirar.
 * · **`aceptada` sigue ofreciendo «Tomarla»** — una tarea que ya es mía invita a
 *   tomarla otra vez. Se vio y NO se tocó: el texto sale de `siguientePaso`, que
 *   es la fuente única del paso legal de una tarea clínica, y cambiar ahí una
 *   palabra sin el dueño es fijar vocabulario de producto.
 * · **No es un iPhone.** Chromium a 390 px.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

const SONDA = leer('scripts', 'ausculta-transformacion', 'mirar-la-consulta.mjs')
const GOLPE = leer('scripts', 'ausculta-transformacion', 'el-area-de-golpe-de-una-fila-de-cita.mjs')
const SIEMBRA = leer('scripts', 'design', 'sembrar-emulador.mjs')
const MODELO = leer('src', 'lib', 'tareas-clinicas', 'modelo.ts')

/** Sin comentarios: esta sonda y este golden explican el defecto CITANDO lo que
 *  se retiró, y un guardián no puede caer por su propia prosa. Ya pasó dos
 *  veces en esta rama (REG-437, REG-438). */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const SONDA_LIMPIA = sinComentarios(SONDA)

describe('la sonda enseña la pantalla entera, no el primer pliegue', () => {
  it('EL CASO: mide el alto del SCROLLER, no el del documento', () => {
    /**
     * PROBADO AL REVÉS: volviendo a `document.documentElement.scrollHeight`
     * como única medida, la sonda contesta 844 en las cinco pantallas.
     * Medido en `/pendientes`: 844 → 2 407.
     */
    expect(
      SONDA_LIMPIA,
      'la sonda dejó de buscar el scroller interno: en este cascarón el ' +
      'documento SIEMPRE mide una ventana, así que el alto vuelve a ser 844 ' +
      'en pantallas de tres mil píxeles',
    ).toMatch(/const altoReal = await p\.evaluate/)
    expect(SONDA_LIMPIA).toMatch(/scrollHeight > x\.clientHeight/)
    expect(SONDA_LIMPIA).toMatch(/overflowY/)
  })

  it('y lo publica: `altoReal` sale en la salida, junto al del documento', () => {
    /**
     * Los dos números, no uno. Que salgan juntos es lo que hace evidente la
     * diferencia — y `alto` (el del documento) se conserva a propósito: es la
     * prueba de que la sonda no se está engañando otra vez.
     */
    expect(SONDA_LIMPIA).toMatch(/altoReal, pantallasDelRecorrido/)
    expect(SONDA_LIMPIA).toMatch(/alto: document\.documentElement\.scrollHeight/)
  })

  it('EL CASO: ya no se guarda un archivo que promete lo que no trae', () => {
    /**
     * PROBADO AL REVÉS: devolviendo `fullPage: true`, el archivo vuelve a salir
     * byte a byte idéntico al del pliegue (comprobado con `md5sum` en las cinco
     * pantallas). Un nombre que miente es peor que no tener la captura: se mira
     * y se da la pantalla por vista.
     */
    expect(
      SONDA_LIMPIA,
      'volvió el `fullPage: true`: en este cascarón no extiende nada, porque ' +
      'quien scrollea es un `<main>` de dentro y no el documento',
    ).not.toMatch(/fullPage:\s*true/)
    expect(SONDA_LIMPIA).not.toMatch(/-completa\.png/)
  })

  it('y en su lugar se RECORRE la pantalla, con solape', () => {
    /**
     * Sin solape, una fila partida justo por el corte no se ve entera en
     * ninguna de las dos capturas — que es otra forma de no haberla mirado.
     */
    expect(SONDA_LIMPIA).toMatch(/recorrido-\$\{i\}\.png/)
    expect(SONDA_LIMPIA).toMatch(/alturaDeVentana - 64/)
  })
})

describe('la sonda cuenta dedos, no cajas', () => {
  it('EL CASO: el objetivo pequeño se decide por el ÁREA DE GOLPE', () => {
    /**
     * PROBADO AL REVÉS: decidiendo con `getBoundingClientRect`, `/pendientes`
     * vuelve a denunciar 7 de 7 y `/dashboard` 10 de 10 — todos ya cubiertos
     * por el pseudo de REG-442. Medido: 7 → 0 y 10 → 0, y `/consulta` sigue
     * denunciando sus dos «ya no».
     */
    expect(SONDA_LIMPIA).toMatch(/const chicosDeVerdad = golpes\.filter/)
    expect(SONDA_LIMPIA).toMatch(/objetivosChicos: chicosDeVerdad\.length/)
    expect(SONDA_LIMPIA).toMatch(/document\.elementFromPoint/)
  })

  it('el barrido NO acepta al ancestro — eso absolvía de más', () => {
    /**
     * PROBADO AL REVÉS: reponiendo `h.contains(el)`, el barrido se derrama por
     * la tarjeta y un enlace de 20 px mide 59 de golpe en vez de 45. Lo cazó
     * que las dos sondas dejaron de coincidir.
     *
     * Una medición que aprueba de más esconde; la que grita en falso sólo
     * molesta. Este caso vale por los dos de arriba.
     */
    const i = SONDA_LIMPIA.indexOf('const esEl = (x, y)')
    expect(i, 'ya no está el barrido de hit-testing').toBeGreaterThan(0)
    const linea = SONDA_LIMPIA.slice(i, SONDA_LIMPIA.indexOf('\n', i))
    expect(
      linea,
      'el barrido volvió a aceptar al ancestro: mide la tarjeta entera y ' +
      'absuelve objetivos táctiles que son pequeños de verdad',
    ).not.toMatch(/h\.contains\(el\)/)
    expect(linea).toMatch(/el\.contains\(h\)/)
  })

  it('y NO se filtró por clase, que era el atajo', () => {
    /**
     * «No cuentes `a.nx-ident`» es creerle al CSS. El día que alguien saque esa
     * clase de la familia del pseudo, o mueva la regla fuera de la media query,
     * la sonda seguiría callada y el enlace volvería a tocarse en 20 px.
     */
    expect(
      SONDA_LIMPIA,
      'la sonda empezó a exonerar por nombre de clase en vez de por medición',
    ).not.toMatch(/nx-ident|cita-principal|nx-enlace-tactil/)
  })

  it('lo que NO se pudo medir no se descuenta', () => {
    /**
     * Un candidato que desaparece del DOM entre las dos pasadas, o que no se
     * puede traer a la vista, no puede convertirse en un aprobado silencioso.
     * Sale en `noMedidos`, que hoy vale 0 en las cinco pantallas.
     */
    expect(SONDA_LIMPIA).toMatch(/noMedidos: noMedidos\.length/)
  })

  it('y enseña a quién salvó el pseudo, en vez de callárselo', () => {
    /**
     * `salvadosPorElPseudo` es la prueba en positivo de que el mecanismo de
     * REG-442 sigue vivo. El día que esa lista se vacíe sola habrá que
     * preguntarse por qué — y sin publicarla, nadie se lo preguntaría.
     */
    expect(SONDA_LIMPIA).toMatch(/salvadosPorElPseudo/)
  })
})

describe('la sonda del área de golpe se generalizó en vez de clonarse', () => {
  it('toma ruta y selector, y conserva sus valores de origen', () => {
    /**
     * Dos sondas del mismo mecanismo divergen, y la que mide de más gana por
     * accidente. Los valores por omisión son con los que nació (REG-442), así
     * que la medición vieja se puede repetir sin argumentos — y se repitió:
     * sigue dando visible 39, golpe 45.
     */
    expect(GOLPE).toMatch(/const RUTA = rutaArg \|\| '\/dashboard'/)
    expect(GOLPE).toMatch(/const SEL = selArg \|\| '\.cita-principal'/)
  })

  it('y su barrido tampoco acepta al ancestro', () => {
    /**
     * La misma trampa que arriba, en la sonda hermana. `closest(sel) === el`
     * sólo es cierto para el elemento y sus descendientes.
     */
    expect(GOLPE).toMatch(/closest\(sel\) === el/)
  })
})

describe('la siembra de pendientes deriva el peso con la escalera del producto', () => {
  /** La escalera que usa el PRODUCTO para ordenar el worklist. */
  const escaleraDelProducto = (): Record<string, number> => {
    const i = MODELO.indexOf('export const ESCALERA_DE_URGENCIA')
    expect(i, 'ya no existe ESCALERA_DE_URGENCIA en el modelo').toBeGreaterThan(0)
    const cuerpo = MODELO.slice(i, MODELO.indexOf('}', i))
    return Object.fromEntries(
      [...cuerpo.matchAll(/(\w+):\s*(\d+)/g)].map(m => [m[1], Number(m[2])]),
    )
  }
  /** La escalera que copia la SIEMBRA. */
  const escaleraDeLaSiembra = (): Record<string, number> => {
    const i = SIEMBRA.indexOf('const ESCALERA_DE_URGENCIA')
    expect(i, 'la siembra ya no declara la escalera de urgencia').toBeGreaterThan(0)
    const linea = SIEMBRA.slice(i, SIEMBRA.indexOf('\n', i))
    return Object.fromEntries(
      [...linea.matchAll(/(\w+):\s*(\d+)/g)].map(m => [m[1], Number(m[2])]),
    )
  }

  it('EL CASO: las dos escaleras son la MISMA', () => {
    /**
     * PROBADO AL REVÉS: cambiando `alta: 10` por `alta: 5` en la siembra, este
     * caso cae nombrando la diferencia.
     *
     * `crearTareas` es «la única puerta» que escribe `pesoUrgencia`, y sembrar
     * directo a Firestore se la salta. Sin ese número el worklist no puede
     * ordenar por urgencia: lo crítico deja de ir primero y `orderBy` **excluye**
     * los documentos que no traen el campo — desaparecerían de la pantalla.
     */
    const producto = escaleraDelProducto()
    const siembra = escaleraDeLaSiembra()
    expect(Object.keys(producto).length, 'no se leyó la escalera del producto').toBeGreaterThan(0)
    expect(
      siembra,
      `la siembra ordena con ${JSON.stringify(siembra)} y el producto con ` +
      `${JSON.stringify(producto)}. Separadas, el arnés enseña un worklist ` +
      'ordenado distinto del real — y lo crítico deja de ir primero.',
    ).toEqual(producto)
  })

  it('y el peso se DERIVA de la prioridad, no se escribe a mano', () => {
    /**
     * El atajo era `pesoUrgencia: 0` en cada tarea sembrada. Duraría hasta que
     * alguien cambiara una prioridad, y entonces el arnés pintaría un worklist
     * ordenado al revés de sus propias palabras — sin que nada fallara.
     */
    expect(SIEMBRA).toMatch(/pesoUrgencia: pesoDeUrgencia\(t\.prioridad\)/)
    const bloque = SIEMBRA.slice(SIEMBRA.indexOf('const TAREAS = ['), SIEMBRA.indexOf('for (const t of TAREAS)'))
    expect(
      bloque,
      'apareció un peso literal en la lista de tareas: eso es volver a escribirlo a mano',
    ).not.toMatch(/pesoUrgencia:\s*\d/)
  })

  it('siembra un pendiente de CADA grupo de la pantalla', () => {
    /**
     * `/pendientes` agrupa por estado de acción. Sembrar tres pendientes
     * cómodos dejaría cuatro grupos sin pintar, y un grupo que no se pinta no
     * se puede juzgar: la auditoría visual diría que la pantalla está bien
     * porque lo poco que enseñó estaba bien.
     *
     * Medido: los seis grupos salen pintados, más «Ver cerrados recientemente».
     */
    /**
     * SIN COMENTARIOS, y no es un detalle: la primera versión de este caso
     * PASÓ con el defecto puesto. Se cambió `reconciliacion_medicamento` por
     * `otra` en la lista y el caso siguió verde, porque el comentario que
     * explica ese tipo lo nombra tres líneas más arriba. El guardián se estaba
     * leyendo su propia prosa — tercera vez en esta rama (REG-437, REG-438).
     */
    const bloque = sinComentarios(
      SIEMBRA.slice(SIEMBRA.indexOf('const TAREAS = ['), SIEMBRA.indexOf('for (const t of TAREAS)')))
    for (const tipo of [
      'resultado_por_revisar', 'estudio_pendiente', 'seguimiento',
      'receta_por_entregar', 'reconciliacion_medicamento',
    ]) {
      expect(bloque, `la siembra dejó de cubrir \`${tipo}\`: su grupo vuelve a no pintarse`).toContain(tipo)
    }
    expect(bloque, 'sin una tarea cerrada, «Ver cerrados recientemente» no se puede mirar').toMatch(/estado: 'cerrada'/)
    expect(bloque, 'sin una tarea sin dueño no se ve la consulta de primera clase del modelo').toMatch(/dueno: null/)
  })

  it('y las marcas de tiempo son ISO completas, no fechas sueltas', () => {
    /**
     * `venceEn` y `creadaEn` los escribe el producto con `toISOString()`, y
     * `estaVencida` los compara contra `Date.now()`. Sembrar «2026-09-02» los
     * fijaría en medianoche UTC — o sea SIEMPRE en el pasado: una tarea que
     * vence hoy se pintaría «venció» en rojo y se colaría en el grupo de
     * escalar. El arnés enseñaría más urgencia de la que hay.
     */
    expect(SIEMBRA).toMatch(/const isoEnDias = \(n\) => new Date\(hoy\.getTime\(\)/)
    expect(SIEMBRA).toMatch(/creadaEn: isoEnDias\(-t\.naceHace\)/)
    expect(SIEMBRA).toMatch(/venceEn: isoEnDias\(t\.vence\)/)
  })
})

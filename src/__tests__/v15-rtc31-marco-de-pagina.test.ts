/**
 * RTC-31 — el marco de página deja de ser el de cualquier andamio.
 *
 * ── QUÉ FALLABA, Y CÓMO SE MIDIÓ ────────────────────────────────────────────
 *
 * La segunda pasada de §29 (14-ago-2026, sobre 18 capturas nuevas) dejó cinco
 * superficies empatadas en 2.0–2.5 y una sola en **1.0**: `/pendientes`.
 * Pagados los defectos de contenido de las dos peores (RTC-15 y RTC-29), lo
 * que quedaba **dejó de repartirse por pantalla**: es el marco, y es el mismo
 * en las cinco —título + racimo de botones, buscador de ancho completo, fila
 * de píldoras, contenedor de tarjeta con filas dentro, estado vacío ilustrado—.
 *
 * La correlación es lo que da la causa: la única superficie sin ese marco es
 * justo la única que llega al objetivo. Por eso ninguna cantidad de trabajo
 * dentro de las filas bajaba el score de las otras: el contenido ya era de
 * este producto; el marco seguía siendo de cualquiera.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * `PageHeader` nació con `subtitle` OPCIONAL. Ocho pantallas de nueve lo
 * pusieron igualmente; la novena —`/pacientes`, la más visitada— no. Una regla
 * que se cumple ocho de nueve veces no es una regla: es una costumbre, y la
 * excepción cae siempre en la pantalla que más prisa tuvo.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * La ley entera vive en `docs/design/v15/V15-MARCO-DE-PAGINA.md`. Lo que este
 * guardián fija:
 *
 * 1. `subtitle` es OBLIGATORIO en el tipo — el compilador se encarga, y aquí
 *    se comprueba que nadie lo devuelva a opcional.
 * 2. Toda pantalla que use `PageHeader` pasa un subtítulo, y **no es un eco
 *    del título**.
 * 3. Una lista de trabajo no lleva `.card` alrededor: agrupa el encabezado,
 *    no la caja.
 *
 * Probado al revés: devolviendo `subtitle?:` falla el caso 1; quitando el
 * subtítulo de `/pacientes` falla el 2; devolviendo `<div className="card"` a
 * la lista falla el 4.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No cubre las cinco pantallas**: esta rebanada convierte `/pacientes` y
 *   deja el resto declarado en la tabla del documento. Convertirlas de golpe
 *   sin volver a puntuar sería repintar.
 * · **No juzga la CALIDAD del subtítulo** más allá de que no sea un eco: que
 *   una frase explique de verdad de dónde sale el contenido es un juicio, no
 *   una aserción.
 * · No cubre las píldoras de filtro ni el estado vacío (RTC-30): declarados
 *   como pendientes en el documento, no olvidados.
 * · No mide píxeles ni score — eso es el arnés y la re-puntuación.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { globSync } from 'glob'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const HEADER = leer('src/components/ui/PageHeader.tsx')

describe('RTC-31 — toda pantalla dice qué es', () => {
  it('1 · `subtitle` es obligatorio en el tipo, no una recomendación', () => {
    expect(HEADER, 'subtitle volvió a ser opcional').not.toMatch(/^\s*subtitle\?:/m)
    expect(HEADER).toMatch(/^\s*subtitle: ReactNode/m)
    // Y se pinta siempre: un `subtitle && (…)` dejaría pasar la cadena vacía.
    expect(HEADER).toMatch(/<div className="page-header-sub">\{subtitle\}<\/div>/)
  })

  it('2 · todas las pantallas con cabecera pasan su subtítulo', () => {
    const pantallas = globSync('src/app/**/*.tsx', { cwd: process.cwd() })
      .filter(f => readFileSync(join(process.cwd(), f), 'utf8').includes('<PageHeader'))
    expect(pantallas.length, 'nadie usa PageHeader: el guardián mide el vacío').toBeGreaterThan(5)
    for (const f of pantallas) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      const cabeceras = (src.match(/<PageHeader/g) ?? []).length
      const subtitulos = (src.match(/subtitle=/g) ?? []).length
      expect(subtitulos, `${f}: ${cabeceras} cabeceras y ${subtitulos} subtítulos`).toBeGreaterThanOrEqual(cabeceras)
    }
  })

  it('3 · el subtítulo no es un eco del título', () => {
    /**
     * «Pacientes → Listado de pacientes» no informa: repite. La comprobación es
     * deliberadamente floja —sólo caza el eco literal— porque juzgar si una
     * frase explica de verdad de dónde sale el contenido es un juicio, y los
     * juicios se documentan, no se asertan.
     */
    const pantallas = globSync('src/app/**/*.tsx', { cwd: process.cwd() })
      .map(f => [f, readFileSync(join(process.cwd(), f), 'utf8')] as const)
      .filter(([, src]) => src.includes('<PageHeader'))
    for (const [f, src] of pantallas) {
      for (const m of src.matchAll(/title="([^"]+)"\s*(?:\/\*[\s\S]*?\*\/)?\s*subtitle="([^"]+)"/g)) {
        const [, titulo, sub] = m
        expect(sub.toLowerCase().trim(), `${f}: el subtítulo repite el título`).not.toBe(titulo.toLowerCase().trim())
        expect(sub.length, `${f}: el subtítulo es demasiado corto para decir algo`).toBeGreaterThan(20)
      }
    }
  })
})

describe('RTC-31 — una lista de trabajo no lleva tarjeta alrededor', () => {
  const PACIENTES = leer('src/app/(dashboard)/pacientes/page.tsx')
  const HOY = leer('src/app/(dashboard)/dashboard/page.tsx')
  const CONTINUIDAD = leer('src/components/ContinuidadPanel.tsx')

  it('4 · la lista de /pacientes ya no vive dentro de una `.card`', () => {
    expect(PACIENTES).not.toContain('<div className="card" style={{ padding: 0 }}>')
  })

  it('5 · y quien agrupa es el encabezado, que habla el rol del sistema', () => {
    const enc = PACIENTES.slice(PACIENTES.indexOf('function ListaEncabezado'))
    const cuerpo = enc.slice(0, enc.indexOf('\n}'))
    expect(cuerpo).toContain('className="t-overline"')
    // Sin fondo propio: agrupa hablando, no dibujando.
    expect(cuerpo).not.toMatch(/background: 'var\(--s1\)'/)
  })

  it('10 · el resumen del paciente no es una fila de KPIs', () => {
    /**
     * 7ª rebanada. La 4ª pasada de §29 nombró la fila de tarjetas-estadística
     * del expediente (ÚLTIMOS SIGNOS · DIAGNÓSTICOS ACTIVOS · ACTIVIDAD) como
     * uno de los tres residuos: su CONTENIDO era clínico y específico, su
     * FORMA era la fila de KPIs de cualquier tablero — tres cajas con borde,
     * encabezado en versalitas y una cifra grande dentro.
     *
     * Ahora se pinta como lo escribe un médico: los signos en una línea, los
     * diagnósticos en la suya, la actividad al final en voz baja. Y es la
     * MISMA anatomía del bloque de «Problemas / Toma» que va justo debajo: dos
     * bloques vecinos que dicen cosas del mismo orden ya no hablan idiomas
     * distintos.
     *
     * No se pierde un dato — eso lo siguen fijando los casos 4 y 5 de RTC-10
     * (las secciones vacías se pliegan y la ausencia se dice hablando del
     * REGISTRO, no del paciente).
     *
     * Probado al revés: devolviendo las tres tarjetas falla.
     */
    const RESUMEN = leer('src/components/expediente/ResumenPaciente.tsx')
    expect(RESUMEN, 'volvió la rejilla de tarjetas').not.toMatch(/gridTemplateColumns: 'repeat\(auto-fit/)
    expect(RESUMEN).not.toMatch(/const tarjeta: React\.CSSProperties/)
    expect(RESUMEN).not.toMatch(/textTransform: 'uppercase'/)
    // La anatomía del vecino: caja de --s2 con borde, icono y líneas «etiqueta: valor».
    expect(RESUMEN).toMatch(/background: 'var\(--s2\)', border: '1px solid var\(--border\)'/)
    expect(RESUMEN).toContain('<strong style={{ color: \'var(--text)\' }}>Últimos signos:</strong>')
    expect(RESUMEN).toContain('<strong style={{ color: \'var(--text)\' }}>Diagnósticos activos:</strong>')
  })

  it('9 · en /consulta la identidad ENCABEZA, como ya hacía el expediente', () => {
    /**
     * 6ª rebanada, y otra que sólo se vio con historia sembrada. Medido:
     *
     *   con historia, ANTES   identidad a 287px (escritorio) · 404px (móvil)
     *   con historia, DESPUÉS identidad a 105px · 183px
     *   el expediente, para comparar                117px · 195px
     *
     * Las cajas de contexto —alergias, problemas, visitas anteriores— iban por
     * delante del nombre. Con el paciente vacío la identidad estaba a ~172px,
     * así que el defecto **sólo existía cuando el paciente tiene historia**,
     * que es siempre menos el primer día: la pantalla se veía bien justo en el
     * caso que no importa.
     *
     * El orden no se inventa: es el que el expediente ya había elegido en su
     * ancla —identidad → alergias → el resto—, y ahora el mismo paciente se
     * ancla igual en las dos pantallas.
     *
     * Probado al revés: devolviendo la franja de alergias por encima del
     * `<h1>` falla.
     */
    const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    const identidad = CONSULTA.indexOf('<h1 className="nx-vt-paciente"')
    const alergias = CONSULTA.indexOf('{/* Alergias — SIEMPRE visible y EDITABLE')
    const problemas = CONSULTA.indexOf('LOS PROBLEMAS DEL PACIENTE Y CUÁNDO VINO LA ÚLTIMA VEZ')
    const visitas = CONSULTA.indexOf('{/* Continuidad: contexto de las últimas visitas')
    for (const [n, i] of [['identidad', identidad], ['alergias', alergias], ['problemas', problemas], ['visitas', visitas]]) {
      expect(i, `falta el marcador ${n}`).toBeGreaterThan(0)
    }
    expect(identidad, 'la franja de alergias volvió por encima del nombre').toBeLessThan(alergias)
    expect(identidad).toBeLessThan(problemas)
    expect(identidad).toBeLessThan(visitas)
  })

  it('8 · la acción primaria del expediente vive en el ancla, y no entre el paciente y sus alergias', () => {
    /**
     * 5ª rebanada, y la única que se tomó CON UNA MEDICIÓN DELANTE porque la
     * observación («se ve raro») no bastaba. Medido sobre los tres expedientes
     * sembrados: la fila propia costaba 43px + 24px de margen con **720px sin
     * usar a su izquierda** — media lienzo vacío para sostener un botón que ya
     * tenía sitio junto al nombre del paciente (172px libres). Después: la
     * historia clínica sube de 491px a 424px.
     *
     * Y la primera versión metió la acción ENTRE el nombre y el aviso de
     * alergias en el teléfono. En un ancho donde todo va en columna el orden ES
     * la jerarquía, y lo único que hay que leer antes de empezar a atender es
     * el aviso. Por eso hay DOS sitios y sólo uno se pinta por ancho.
     *
     * Probado al revés: devolviendo la fila propia falla el primer expect;
     * quitando el slot móvil falla el tercero; poniendo el slot móvil ANTES del
     * aviso falla el cuarto.
     */
    const EXP = leer('src/app/(dashboard)/expediente/[patientId]/page.tsx')
    const ANCLA = leer('src/components/expediente/PatientAnchor.tsx')

    // Ya no hay fila propia — ni su rejilla móvil, que ordenaba cuatro botones
    // donde quedaba uno.
    expect(EXP).not.toContain('className="actions-row exp-actions"')
    expect(EXP).not.toContain('.exp-actions { display: grid')

    // La acción se pasa al ancla, y sigue siendo la MISMA (mismo destino).
    expect(EXP).toMatch(/accion=\{\s*<button onClick=\{\(\) => navegarConContinuidad/)
    expect(EXP).toContain('Nueva consulta')

    // Dos sitios, uno por ancho.
    expect(ANCLA).toContain('className="nx-ancla-accion"')
    expect(ANCLA).toContain('className="nx-ancla-accion-movil"')
    expect(ANCLA).toMatch(/max-width: 768px\)\s*\{\s*\.nx-ancla-accion \{ display: none; \}/)
    expect(ANCLA).toMatch(/min-width: 769px\)\s*\{\s*\.nx-ancla-accion-movil \{ display: none; \}/)

    // Y en el teléfono, el aviso de alergias va ANTES.
    const aviso = ANCLA.indexOf('<strong>Alergias:</strong>')
    const slotMovil = ANCLA.indexOf('className="nx-ancla-accion-movil"')
    expect(aviso).toBeGreaterThan(0)
    expect(slotMovil, 'la acción se metió entre el paciente y sus alergias').toBeGreaterThan(aviso)
  })

  it('7 · en /consulta, la caja de grabación sólo se pinta cuando agrupa VARIOS controles', () => {
    /**
     * 4ª rebanada. `grabCard` existe para agrupar los controles de la grabación
     * EN CURSO —medidor de nivel, tamaño del archivo, avisos de micrófono, la
     * descarga de emergencia—. Antes de pulsar no hay nada de eso: sólo
     * `EmpezarAGrabar`, que ya es una superficie con su borde y su radio de 16.
     * La caja de fuera dibujaba un segundo marco alrededor del primero, con dos
     * radios distintos (12 y 16) a 18px de distancia. Un contenedor que no
     * contiene más que una cosa no contiene nada.
     *
     * No se borra: se le quita la piel mientras no tenga nada que agrupar —
     * mismo DOM, misma separación, misma conducta al grabar.
     */
    const CONSULTA = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')
    const UI = leer('src/app/(dashboard)/consulta/[patientId]/consulta-ui.tsx')
    expect(CONSULTA).toContain('esElPrincipio ? S.grabCardSola : S.grabCard')
    expect(UI).toMatch(/grabCardSola: \{ background: 'transparent', border: 0, padding: 0/)
    // Y la caja de la grabación en curso NO se toca: sigue teniendo su piel.
    expect(UI).toMatch(/grabCard: \{ background: 'var\(--s1\)', border: '1px solid var\(--border\)'/)
  })

  it('6 · los dos bloques de Hoy tampoco: agrupa su encabezado, no la caja', () => {
    // 2ª rebanada. «Agenda de hoy» y «Sigue abierto de antes» ya traían
    // encabezado con línea inferior; lo que sobraba era la tarjeta alrededor.
    expect(HOY).toContain('<section className="hoy-bloque">')
    expect(HOY).not.toContain('<section className="card" style={{ padding: 0 }}>')
    expect(CONTINUIDAD).toContain('<section className="hoy-bloque"')
    expect(CONTINUIDAD).not.toContain('className="card"')
    expect(leer('src/app/globals.css')).toContain('.hoy-bloque {')
  })
})

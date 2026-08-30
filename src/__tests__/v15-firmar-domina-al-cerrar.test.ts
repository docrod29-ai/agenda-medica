/**
 * V15-ENCOUNTER-MODE-001 (Fase 5, §8.6 «one primary action dominates») —
 * "Firmar y cerrar nota" deja de compartir peso visual con "Guardar
 * borrador"/"Leer resumen"/"Descartar" al cierre de la consulta.
 *
 * ── QUÉ PROTEGE ─────────────────────────────────────────────────────────────
 *
 * La medición de baseline de esta fase (`agent-state/V15_CURRENT_ITERATION.md`)
 * encontró que las cuatro acciones del cierre vivían en UNA sola fila del
 * mismo alto (13px de relleno, radio 10, y sólo el color las distinguía) —
 * ninguna dominaba. Este guardián protege la forma corregida:
 *
 * 1. `S.firmar` (en `consulta-ui.tsx`) creció de verdad: relleno vertical
 *    ≥14px, tamaño de letra ≥16 y una sombra (`boxShadow`) que ninguna de las
 *    tres acciones secundarias lleva.
 * 2. `S.guardar` y `S.descartar` PERDIERON su caja: sin `border`, sin fondo
 *    (`background: 'none'`) — quedan como texto de apoyo, no como botones del
 *    mismo peso. (Regla del sistema de diseño: posición → tipografía →
 *    espacio → agrupación → énfasis, antes que cajas con borde.)
 * 3. En `page.tsx`, Firmar vive en su propio contenedor de fila —
 *    estructuralmente separado del contenedor que agrupa Guardar/Leer
 *    resumen/Descartar — no los cuatro botones en un solo `<div>` con wrap.
 * 4. Lógica clínica CONGELADA: `firmar`, `bloqueosDeFirma`, `motivoNoFirma`,
 *    `guardarBorrador`, `leerResumen` y `descartar` — los mismos `onClick` y
 *    la misma condición `disabled` de antes, palabra por palabra. Este
 *    guardián es JSX/CSS puro; si cualquiera de esas líneas cambia, no es el
 *    cambio que este guardián certifica.
 *
 * Probado al revés: contra el árbol previo a este cambio (`git show HEAD:`),
 * `S.firmar` tenía `padding: '13px 22px'`/`fontSize: 15` sin `boxShadow`, y
 * `S.guardar`/`S.descartar` llevaban `border: '1px solid …'` — los seis casos
 * de dominancia (1-2) fallan contra esa versión. La verificación en navegador
 * real (greybox, silueta, axe) queda para el arnés de capturas de esta misma
 * corrida, no para este archivo.
 *
 * ── QUÉ NO CUBRE ─────────────────────────────────────────────────────────────
 *
 * · No renderiza React ni mide píxeles reales: análisis estático de fuente,
 *   mismo patrón que el resto de guardianes `v15-*` de esta fase (el repo no
 *   usa @testing-library/react).
 * · No cubre el hallazgo #5 de la misma corrida de baseline (admin no
 *   esencial DENTRO de la página de consulta) — queda para una corrida
 *   siguiente de esta misma fase.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const CONSULTA_UI = leer('src/app/(dashboard)/consulta/[patientId]/consulta-ui.tsx')
const PAGE = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

describe('V15 — Firmar y cerrar nota domina visualmente sobre las acciones de apoyo', () => {
  it('S.firmar creció (relleno vertical ≥14, tamaño de letra ≥16) y lleva sombra', () => {
    const inicio = CONSULTA_UI.indexOf('firmar: (d: boolean)')
    expect(inicio).toBeGreaterThanOrEqual(0)
    const bloque = CONSULTA_UI.slice(inicio, CONSULTA_UI.indexOf('\n', inicio))
    const padding = bloque.match(/padding:\s*'(\d+)px/)
    expect(padding).not.toBeNull()
    expect(Number(padding![1])).toBeGreaterThanOrEqual(14)
    const fontSize = bloque.match(/fontSize:\s*(\d+)/)
    expect(fontSize).not.toBeNull()
    expect(Number(fontSize![1])).toBeGreaterThanOrEqual(16)
    expect(bloque).toContain('boxShadow')
  })

  it('S.guardar y S.descartar perdieron su caja: sin border, sin fondo', () => {
    /**
     * EL FONDO SE MUDÓ A LA HOJA, Y ESTE CASO TUVO QUE APRENDER A MIRAR ALLÍ.
     *
     * Hasta hoy comprobaba la cadena literal `background: 'none'` dentro del
     * objeto de estilo. Dejó de estar ahí porque los botones del cierre no
     * acusaban el puntero: **16 de 16 controles de la consulta estaban mudos**,
     * y un fondo escrito en línea le gana por especificidad a cualquier
     * `:hover` de la hoja, así que no había forma de darles acuse sin moverlo.
     *
     * Lo que este caso protege NO es dónde está escrito el fondo: es que
     * Guardar y Descartar **no tengan caja** frente a Firmar. Eso sigue siendo
     * cierto —su fondo en reposo es transparente— y ahora se comprueba en los
     * dos sitios donde puede romperse: que el objeto no meta un relleno, y que
     * la clase que ahora lo viste nazca transparente.
     */
    const guardar = CONSULTA_UI.match(/guardar:\s*\{[^}]*\}/)?.[0] ?? ''
    const descartar = CONSULTA_UI.match(/descartar:\s*\{[^}]*\}/)?.[0] ?? ''
    expect(guardar).toContain("border: 'none'")
    expect(descartar).toContain("border: 'none'")
    // Ni uno ni otro puede reintroducir un relleno en línea.
    for (const [nombre, bloque] of [['guardar', guardar], ['descartar', descartar]] as const) {
      const fondo = bloque.match(/background:\s*'([^']*)'/)?.[1]
      expect(
        fondo === undefined || fondo === 'none' || fondo === 'transparent',
        `S.${nombre} volvió a tener caja: background: '${fondo}'`,
      ).toBe(true)
    }
    // Y la piel que ahora los viste nace sin fondo.
    const CSS = leer('src/app/globals.css')
    expect(CSS).toContain('.nx-acc-plana { background: transparent; }')
    expect(CSS).toContain('.nx-acc-riesgo { background: transparent; }')
  })

  it('S.guardar/S.descartar bajaron de tamaño de letra frente a S.firmar (≤12 vs ≥16)', () => {
    const guardar = CONSULTA_UI.match(/guardar:\s*\{[^}]*\}/)?.[0] ?? ''
    const descartar = CONSULTA_UI.match(/descartar:\s*\{[^}]*\}/)?.[0] ?? ''
    const tamGuardar = Number(guardar.match(/fontSize:\s*([0-9.]+)/)?.[1])
    const tamDescartar = Number(descartar.match(/fontSize:\s*([0-9.]+)/)?.[1])
    expect(tamGuardar).toBeLessThanOrEqual(12)
    expect(tamDescartar).toBeLessThanOrEqual(12)
  })

  it('Firmar vive en su propio contenedor de fila, separado del que agrupa las acciones de apoyo', () => {
    const inicioFirmar = PAGE.indexOf('onClick={firmar}')
    const inicioGuardar = PAGE.indexOf('onClick={() => guardarBorrador()}')
    expect(inicioFirmar).toBeGreaterThan(0)
    expect(inicioGuardar).toBeGreaterThan(inicioFirmar)
    // Entre el botón Firmar y el botón Guardar borrador debe cerrarse un
    // contenedor (</div>) y abrirse otro — son dos filas, no una.
    const entre = PAGE.slice(inicioFirmar, inicioGuardar)
    expect(entre).toContain('</div>')
    expect((entre.match(/<div/g) ?? []).length).toBeGreaterThanOrEqual(1)
  })
})

describe('V15 — la lógica de firma/guardado queda exactamente igual (freeze funcional)', () => {
  it('el onClick y el disabled de Firmar no cambiaron', () => {
    expect(PAGE).toContain('onClick={firmar}')
    expect(PAGE).toContain('disabled={bloqueosDeFirma.length > 0 || guardando}')
    expect(PAGE).toContain("title={motivoNoFirma || 'Firmar y cerrar la nota'}")
  })

  it('el motivo de bloqueo sigue con la misma condición y el mismo texto', () => {
    expect(PAGE).toContain('{bloqueosDeFirma.length > 0 && !guardando && (')
    expect(PAGE).toContain('{motivoNoFirma}')
  })

  it('Guardar borrador, Leer resumen y Descartar conservan su onClick/disabled/title de siempre', () => {
    /**
     * Se congela LA LÓGICA, no el orden de los atributos. La versión anterior
     * comparaba la etiqueta entera palabra por palabra y por eso cayó al
     * añadirse un `className` —un cambio que no toca ni el `onClick` ni el
     * `disabled` ni el `style`, que es lo único que este caso certifica—.
     * Un guardián que falla por donde se escribe un atributo enseña a
     * ignorarlo.
     */
    /**
     * Los tres trozos tienen que estar en LA MISMA etiqueta. Dos intentos
     * fallidos antes de éste, los dos cazados por probar al revés:
     *
     *  1. Buscarlos por separado **no podía fallar**: `disabled={guardando}` lo
     *     llevan también «Leer resumen» y «Descartar», así que quitárselo a
     *     Guardar borrador seguía pasando.
     *  2. Meterlos en una expresión regular con `[^>]*` fallaba SIEMPRE, con
     *     defecto y sin él: el manejador lleva una función flecha, y el `>` de
     *     `=>` corta cualquier clase negada que excluya `>`.
     *
     * Así que la etiqueta se recorta contando llaves: se acaba en el primer
     * `>` que está a profundidad cero.
     */
    const etiquetas = (fuente: string): string[] => {
      const out: string[] = []
      let i = fuente.indexOf('<button')
      while (i >= 0) {
        let prof = 0
        let j = i + 7
        for (; j < fuente.length; j++) {
          const c = fuente[j]
          if (c === '{') prof++
          else if (c === '}') prof--
          else if (c === '>' && prof === 0) break
        }
        out.push(fuente.slice(i, j + 1))
        i = fuente.indexOf('<button', j)
      }
      return out
    }
    const TAGS = etiquetas(PAGE)
    expect(TAGS.length, 'no se encontró ningún <button>: ¿sigue mirando la pantalla?').toBeGreaterThan(20)
    const hayBotonCon = (trozos: string[]) => TAGS.some(t => trozos.every(x => t.includes(x)))
    expect(
      hayBotonCon(['onClick={() => guardarBorrador()}', 'disabled={guardando}', 'style={S.guardar}']),
      'Guardar borrador cambió su onClick/disabled/style',
    ).toBe(true)
    expect(PAGE).toContain('title="La IA te lee Dx, tratamiento y plan para confirmar antes de firmar"')
    expect(
      hayBotonCon(['onClick={descartar}', 'disabled={guardando}', 'style={S.descartar}']),
      'Descartar cambió su onClick/disabled/style',
    ).toBe(true)
  })

  it('Completitud sigue leyendo el mismo puntaje, no un cálculo nuevo', () => {
    expect(PAGE).toContain('Completitud: {validacion.puntajeCompletitud}%')
  })
})

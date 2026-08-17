/**
 * RTC-10 — el primer viewport de un expediente es el PACIENTE.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * La primera pantalla de un expediente no traía «un solo dato clínico»: cuatro
 * botones de documentos/exportación al mismo peso que el CTA clínico, tres
 * tarjetas KPI con DOS vacías («Sin signos registrados aún», «Sin diagnósticos
 * activos») y, debajo, dos cajas-módulo plegadas —contacto y herramientas—
 * antes de llegar a nada del paciente. El equipo rojo lo llamó por su nombre:
 * «pila de cajas-módulo» en vez del Clinical Spine de §7.
 *
 * ── CÓMO SE DESCUBRIÓ, Y QUÉ MIDIÓ EL ARNÉS ─────────────────────────────────
 *
 * Panel de equipo rojo (ORT-07 + RT-02). Confirmado y CUANTIFICADO en navegador
 * real con `scripts/design/medir-primer-viewport-expediente-v15.mjs`, sobre los
 * tres expedientes sembrados, a 1440×900:
 *
 *              baseline                       después
 *   pendientes @775px (bajo el pliegue)   @492px, antes de la historia
 *   cajas-módulo antes de la historia: 2  0
 *   tarjetas vacías: 2                    0
 *   export sobre la historia: 3           0
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * El expediente creció por acumulación: cada capacidad nueva añadió su caja al
 * final del bloque anterior, y las que llegaron primero —contacto, laboratorios—
 * se quedaron arriba por antigüedad, no por importancia. Nadie decidió que el
 * teléfono del paciente pesara más que sus pendientes; simplemente llegó antes.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * 1. El orden de la página dice lo que la pantalla ES:
 *    identidad → estado → pendientes → historia → utilidades → documentos.
 * 2. Una tarjeta sin contenido no se pinta como tarjeta. Pero **no desaparece
 *    el hecho**: se degrada a una línea que habla del REGISTRO («este
 *    expediente todavía no tiene … registrados»), nunca del paciente —
 *    «ausencia de dato no es dato de ausencia» corta en las dos direcciones.
 * 3. El riel del Clinical Spine sigue el orden VISUAL. Un índice que anuncia
 *    otro orden que el del documento manda al médico abajo para volver a subir.
 * 4. La exportación conserva su conducta entera; sólo cambia de sitio y gana
 *    nombre propio.
 *
 * Probado al revés: devolviendo el orden viejo fallan los casos 1-3; devolviendo
 * las tarjetas vacías falla el 4; devolviendo los tres botones a la cabecera
 * falla el 5; devolviendo el riel a su orden viejo falla el 6.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · No mide píxeles: jsdom no tiene layout. El antes/después está en
 *   `docs/design/capturas/v15-rtc10/medicion-{baseline,despues}.json`.
 * · El estado clínico (`#spine-problemas`) NO se pudo medir en navegador
 *   cuando se escribió esto: ningún paciente sembrado tenía notas firmadas con
 *   dx, así que ese ancla no llegaba a pintarse. Por eso el caso 1 lo cubre por
 *   ORDEN en el fuente. **HUECO CERRADO el 14-ago**: la siembra ya crea notas
 *   firmadas con diagnósticos (`v15-la-siembra-tiene-expedientes-con-historia`)
 *   y el bloque se ve en `docs/design/capturas/v15-rtc31-primario-con-notas/`
 *   — «Problemas: … · Toma: … · De lo último que se dijo de cada uno en sus
 *   notas firmadas». Lo que sigue sin hacerse es re-medir el primer viewport
 *   CON historia: los números de arriba son de expedientes vacíos.
 * · No cubre `/consulta`: RTC-12 (el lienzo de escritorio) sigue abierto.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/**
 * SIN COMENTARIOS, Y NO POR ESTILO.
 *
 * La primera pasada de esta prueba falló por sí misma: los comentarios que
 * explican la rebanada MENCIONAN «Documentos y exportación» y «Sin diagnósticos
 * activos», y las búsquedas los encontraban antes que al código. Es la ceguera
 * que `grafo-de-dependencias` ya tenía escrita —«el lector veía texto donde
 * tenía que ver código»— reapareciendo en una prueba. Se quitan las líneas de
 * comentario ANTES que los bloques: al revés, una barra-asterisco dentro de un
 * `//` abre un bloque falso y se come el archivo.
 *
 * Y NO se filtran las líneas que empiezan por `*`: la primera versión lo hacía
 * y borraba también los cierres ` * /`, con lo que cada bloque se comía código
 * hasta el siguiente cierre que quedara vivo — cinco casos en rojo por culpa
 * del limpiador, no del producto. Es literalmente la nota que
 * `grafo-de-dependencias` dejó escrita sobre el ORDEN de esta limpieza.
 */
const sinComentarios = (src: string) => src
  .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')

const EXPEDIENTE = sinComentarios(leer('src/app/(dashboard)/expediente/[patientId]/page.tsx'))
const RESUMEN = sinComentarios(leer('src/components/expediente/ResumenPaciente.tsx'))

/** Posición de un marcador en el fuente; -1 si no está. */
const pos = (marca: string) => EXPEDIENTE.indexOf(marca)

const RESUMEN_PACIENTE = '<ResumenPaciente patient={patient} notas={notas} />'
const ESTADO_CLINICO = 'id="spine-problemas"'
const PENDIENTES = 'id="spine-pendientes"'
const HISTORIA = 'id="spine-encuentros"'
const CONTACTO = '<DatosPaciente'
const HERRAMIENTAS = '<Herramientas items={['
const DOCUMENTOS = 'Documentos y exportación'

describe('RTC-10 — el orden de la página dice lo que la pantalla es', () => {
  it('1 · el estado clínico y los pendientes van ANTES de la historia', () => {
    for (const marca of [RESUMEN_PACIENTE, ESTADO_CLINICO, PENDIENTES, HISTORIA]) {
      expect(pos(marca), `falta el marcador ${marca}`).toBeGreaterThan(0)
    }
    expect(pos(ESTADO_CLINICO)).toBeGreaterThan(pos(RESUMEN_PACIENTE))
    expect(pos(ESTADO_CLINICO)).toBeLessThan(pos(HISTORIA))
    expect(pos(PENDIENTES)).toBeLessThan(pos(HISTORIA))
  })

  it('2 · las cajas-módulo (contacto, herramientas) van DESPUÉS de la historia', () => {
    // Eran las dos que el equipo rojo encontró apiladas por delante del
    // paciente. Siguen enteras: cambiaron de sitio, no de conducta.
    expect(pos(CONTACTO)).toBeGreaterThan(pos(HISTORIA))
    expect(pos(HERRAMIENTAS)).toBeGreaterThan(pos(HISTORIA))
  })

  it('3 · los documentos y la exportación son lo último', () => {
    expect(pos(DOCUMENTOS)).toBeGreaterThan(pos(HISTORIA))
    expect(pos(DOCUMENTOS)).toBeGreaterThan(pos(CONTACTO))
  })
})

describe('RTC-10 — una tarjeta vacía no es información', () => {
  it('4 · las tarjetas de signos y de diagnósticos sólo se pintan CON contenido', () => {
    expect(RESUMEN).toMatch(/const conSignos = vitales\.length > 0/)
    expect(RESUMEN).toMatch(/const conDx = dxActivos\.length > 0/)
    expect(RESUMEN).toMatch(/\{conSignos && \(/)
    expect(RESUMEN).toMatch(/\{conDx && \(/)
    // Y las cajas vacías de antes ya no existen.
    expect(RESUMEN).not.toContain('Sin signos registrados aún')
    expect(RESUMEN).not.toContain('Sin diagnósticos activos')
  })

  it('5 · pero la ausencia SE DICE, y habla del registro, no del paciente', () => {
    /**
     * «Ausencia de dato no es dato de ausencia» (regla 4 de seguridad clínica)
     * corta en las dos direcciones: esconder que no hay signos registrados
     * sería tan malo como afirmar que el paciente no tiene ninguno. La línea
     * dice «este EXPEDIENTE todavía no tiene … registrados» — un hecho sobre
     * lo que hay escrito, que es lo único que el sistema sabe.
     */
    expect(RESUMEN).toContain('Este expediente todavía no tiene')
    expect(RESUMEN).toContain('registrados')
    expect(RESUMEN).toMatch(/ausentes\.length > 0/)
  })

  it('6 · el riel del Clinical Spine sigue el orden VISUAL de la página', () => {
    const spine = EXPEDIENTE.slice(EXPEDIENTE.indexOf('const spineItems'), EXPEDIENTE.indexOf('return ('))
    const orden = ['problemas', 'pendientes', 'encuentros', 'internamientos', 'herramientas']
      .map(id => spine.indexOf(`id: '${id}'`))
    expect(orden.every(i => i > 0), 'falta algún ítem del riel').toBe(true)
    expect(orden, 'el riel anuncia un orden distinto del documento').toEqual([...orden].sort((a, b) => a - b))
  })
})

describe('RTC-10 — la exportación conserva su conducta entera', () => {
  it('7 · los tres formatos siguen existiendo, con sus avisos de lo que NO llevan', () => {
    // Mover no puede significar perder: el expediente completo declara lo que
    // no se pudo leer, y el archivo de intercambio declara qué pasa con las
    // notas sin firmar.
    //
    // 14-ago-2026 (REG-313): este caso exigía la frase «NO van en FHIR», que
    // era FALSA —el exportador las manda como `preliminary`—. Se exige la
    // declaración, no aquella redacción concreta.
    expect(EXPEDIENTE).toContain('/api/expediente/exportar/')
    expect(EXPEDIENTE).toContain('no se pudieron leer')
    expect(EXPEDIENTE).toMatch(/marcadas como preliminares/)
    expect(EXPEDIENTE).toContain('/referencia/${patientId}')
  })

  it('8 · el primario clínico sigue solo, y ahora vive en el ancla del paciente', () => {
    /**
     * La condición SIGUE al código. RTC-10 dejó a «Nueva consulta» solo en su
     * fila —lo que este caso fijaba: UN botón, y que fuera el clínico—. RTC-31
     * midió esa fila (43px + 24px de margen con **720px sin usar a su
     * izquierda**) y subió el botón al ancla, junto a la otra acción de ese
     * paciente. La fila desapareció con su rejilla móvil.
     *
     * Lo que este caso protege no era la fila: era que la acción clínica no
     * volviera a compartir peso con los tres botones de documentos. Eso se
     * comprueba igual —mejor, de hecho— sobre el slot del ancla.
     */
    expect(EXPEDIENTE, 'volvió la fila propia del primario').not.toContain('className="actions-row exp-actions"')
    const slot = EXPEDIENTE.slice(pos('accion={'))
    const hastaElCierre = slot.slice(0, slot.indexOf('}\n      />'))
    expect((hastaElCierre.match(/<button/g) ?? []).length).toBe(1)
    expect(hastaElCierre).toContain('Nueva consulta')
    // Y los tres de exportación siguen abajo, con su nombre propio.
    expect(pos('Documentos y exportación')).toBeGreaterThan(pos('<DatosPaciente'))
  })
})

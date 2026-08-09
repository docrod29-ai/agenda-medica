/**
 * EL BORRADOR NO PIERDE CAMPOS — V9 · NAVIGATION-001.
 *
 * ── QUÉ FALLABA ─────────────────────────────────────────────────────────────
 *
 * `proximoSeguimiento` —la fecha de la próxima consulta— se guardaba y **se
 * borraba sola al salir de la pantalla**.
 *
 * El borrador local se escribía en tres sitios, cada uno con su lista de campos
 * copiada a mano:
 *
 * | # | Camino | Escribe en | ¿Llevaba el campo? |
 * |---|---|---|---|
 * | 1 | respaldo con rebote de 1 500 ms | `localStorage[respaldoKey]` | **sí** |
 * | 2 | espejo en memoria (`BorradorContext`) | RAM del layout | no |
 * | 3 | `flushRespaldo` (desmontar · ocultar · cerrar) | **`localStorage[respaldoKey]`** | no |
 *
 * 3 escribe **la misma clave que 1** y corre justo al navegar. Así que el orden
 * real de los hechos era: se teclea la fecha → a los 1,5 s el respaldo la guarda
 * → el médico va a la agenda → el volcado de despedida reescribe la clave **sin
 * el campo**. No es que no se guardara: es que se guardaba y luego se pisaba.
 *
 * Y la condición «¿hay algo que guardar?» estaba copiada **cuatro** veces, con
 * dos criterios distintos: con la fecha como único contenido, una copia decía
 * «hay algo» y otra «no hay nada» sobre el mismo borrador.
 *
 * ── CÓMO SE DESCUBRIÓ ───────────────────────────────────────────────────────
 *
 * `NAVIGATION_STATE_AUDIT.md` §3, hallazgo nº 9, leyendo qué campos aparecen en
 * cada uno de los caminos de escritura. **No hay forma de encontrarlo probando
 * un camino**: los tres funcionan; lo que falla es que no coinciden.
 *
 * ── Y YA HABÍA PASADO, CON ESTE MISMO CAMPO ─────────────────────────────────
 *
 * REG-193. Aquel arreglo cubrió **uno de los tres caminos** —y dejó el
 * comentario de la reparación escrito encima del único sitio corregido, lo que
 * hacía parecer que el problema estaba cerrado—. No fue descuido: mientras la
 * lista esté copiada tres veces, **arreglar una copia se ve exactamente igual
 * que arreglar el problema**.
 *
 * ── LA REGLA QUE LO HACE SEGURO ─────────────────────────────────────────────
 *
 * Una sola lista (`CAMPOS_DEL_BORRADOR`), una sola instantánea
 * (`instantaneaDeBorrador`), una sola condición (`hayQueGuardar`). Y esta prueba
 * comprueba las dos mitades del viaje: que **se escriba** por los tres caminos y
 * que **se lea de vuelta** al restaurar. Un campo que se guarda y nadie
 * restaura está igual de perdido — «el dato tiene que LLEGAR».
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Con la fecha de seguimiento como ÚNICO contenido: la condición vieja del
 * volcado devolvía `false` (no guardaba nada) y la instantánea vieja no traía el
 * campo. Las dos comprobaciones están escritas abajo con el comportamiento viejo
 * reproducido a mano, así que fallan si alguien vuelve a él.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * - **No prueba que el navegador restaure de verdad.** Lee el código de la
 *   pantalla; no monta React ni escribe en `localStorage` real. El ciclo
 *   Agenda → Consulta → volver, con los ojos, sigue pendiente (`NAV-NAVEGADOR-001`).
 * - No cubre el guardado al SERVIDOR, que tiene su propio esquema y su lista
 *   blanca en la ruta de API.
 * - No vigila el resto del estado que también muere al navegar —turnos
 *   diarizados, evidencia, NER, roles de hablante— que son hallazgos aparte del
 *   mismo audit (§2 nº 8) y siguen abiertos.
 * - Sólo mira la pantalla de consulta. Otras pantallas con borrador propio no
 *   están cubiertas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAMPOS_DEL_BORRADOR,
  hayQueGuardar,
  instantaneaDeBorrador,
} from '@/lib/expediente/borrador-de-consulta'

const CONSULTA = readFileSync(
  join(process.cwd(), 'src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx'),
  'utf8',
)

const sinSignos = () => false

describe('la condición de «hay algo que guardar» es una sola', () => {
  it('la fecha de próxima consulta, sola, YA es contenido', () => {
    /**
     * Éste es el caso exacto: el médico teclea la fecha de seguimiento y no
     * toca nada más. Con la condición vieja del volcado y del espejo, esto era
     * `false` y no se guardaba nada.
     */
    expect(hayQueGuardar({ proximoSeguimiento: '2026-09-01' }, sinSignos)).toBe(true)
  })

  it('el comportamiento viejo habría dicho que no hay nada (probado al revés)', () => {
    const e = { proximoSeguimiento: '2026-09-01' } as {
      resumen?: string; secciones?: Array<{ value?: string }>; diagnosticos?: unknown[]
      medicamentos?: unknown[]; transcripcion?: string; estudiosOrden?: string[]
      preop?: unknown; proximoSeguimiento?: string
    }
    // La condición tal y como estaba en `flushRespaldo` y en el espejo:
    const viejo = Boolean(
      e.resumen?.trim() || e.secciones?.some(s => s.value?.trim()) || e.diagnosticos?.length ||
      e.medicamentos?.length || e.transcripcion?.trim() || sinSignos() ||
      (e.estudiosOrden?.length ?? 0) > 0 || !!e.preop,
    )
    expect(viejo).toBe(false)
    expect(hayQueGuardar(e, sinSignos)).toBe(true)
  })

  it('un borrador de verdad vacío sigue siendo vacío', () => {
    // Que la condición sea más generosa no puede volverla trivial: si esto
    // devolviera `true`, se escribiría un respaldo por cada pantalla abierta.
    expect(hayQueGuardar({}, sinSignos)).toBe(false)
    expect(hayQueGuardar({ resumen: '   ', proximoSeguimiento: '' }, sinSignos)).toBe(false)
  })

  it('los signos vitales los juzga quien sabe de signos vitales', () => {
    // El criterio no se reimplementa aquí: se inyecta el de la pantalla.
    expect(hayQueGuardar({}, () => true)).toBe(true)
  })
})

describe('la instantánea lleva todos los campos, por los tres caminos', () => {
  it('incluye cada campo declarado, y la identidad de la nota', () => {
    const foto = instantaneaDeBorrador({ resumen: 'x', proximoSeguimiento: '2026-09-01' }, 'nota-1')
    for (const campo of CAMPOS_DEL_BORRADOR) expect(foto).toHaveProperty(campo)
    expect(foto.notaId).toBe('nota-1')
    expect(foto.proximoSeguimiento).toBe('2026-09-01')
  })

  it('no inventa campos que nadie declaró', () => {
    /**
     * Si la instantánea copiara el estado entero, arrastraría al respaldo local
     * cosas que no son la nota — y `localStorage` guarda PHI ofuscada, no un
     * volcado de la pantalla.
     */
    const foto = instantaneaDeBorrador({ resumen: 'x' } as Record<string, unknown>, null)
    expect(Object.keys(foto).sort()).toEqual([...CAMPOS_DEL_BORRADOR, 'notaId'].sort())
  })
})

describe('los tres caminos de escritura usan la misma instantánea', () => {
  /**
   * Ésta es la prueba que impide que vuelva a pasar: no comprueba que los
   * campos coincidan hoy —eso se arregla copiando y pegando— sino que **no haya
   * tres listas** que puedan separarse mañana.
   */
  it('el respaldo local y el volcado de despedida escriben por la instantánea', () => {
    const escrituras = [...CONSULTA.matchAll(/localStorage\.setItem\(respaldoKey[\s\S]{0,400}?\)\)\)/g)]
    expect(escrituras.length, 'esperaba las dos escrituras de localStorage del borrador').toBe(2)
    for (const m of escrituras) {
      expect(m[0], 'una escritura del respaldo arma su objeto a mano').toContain('instantaneaDeBorrador')
    }
  })

  it('el espejo en memoria también', () => {
    const m = /borradorMem\.escribir\(respaldoKey,([\s\S]{0,300}?)\)\n/.exec(CONSULTA)
    expect(m, 'no se encontró la escritura del espejo en memoria').not.toBeNull()
    expect(m![1]).toContain('instantaneaDeBorrador')
  })

  it('ninguna de las condiciones de contenido quedó copiada a mano', () => {
    /**
     * La firma de la copia: `e.medicamentos?.length` fuera del módulo
     * compartido. Aparece una sola vez, y es la reproducción deliberada del
     * comportamiento viejo dentro de esta misma prueba.
     */
    const copias = [...CONSULTA.matchAll(/\.medicamentos\?\.length/g)]
    expect(copias.length, 'volvió a haber una condición de contenido copiada en la pantalla').toBe(0)
  })
})

describe('lo que se guarda se vuelve a leer', () => {
  it('la restauración lee TODOS los campos de la instantánea', () => {
    /**
     * «El dato tiene que LLEGAR»: escribir un campo que el restaurador ignora
     * es exactamente igual de inútil que no escribirlo, y mucho más difícil de
     * ver — el respaldo en disco se ve completo.
     *
     * Se busca `b.<campo>` porque así se llama el borrador leído en la pantalla.
     */
    const olvidados = CAMPOS_DEL_BORRADOR.filter(campo => !CONSULTA.includes(`b.${campo}`))
    expect(olvidados, `campos que se guardan y nadie restaura: ${olvidados.join(', ')}`).toEqual([])
  })
})

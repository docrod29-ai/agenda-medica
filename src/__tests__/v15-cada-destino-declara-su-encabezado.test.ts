/**
 * V15-FINAL-COHERENCE-001 — dos contradicciones pequeñas de gramática, de las
 * que sólo se ven comparando superficies entre sí.
 *
 * ── CÓMO SE DESCUBRIERON ──────────────────────────────────────────────────
 *
 * Inventariando el encabezado de LAS 45 pantallas del dashboard a la vez
 * (`grep '<h1'` + `grep PageHeader` sobre cada `page.tsx`) para la matriz de
 * coherencia. El inventario deja cuatro pantallas sin encabezado de nivel
 * uno, y sólo al mirarlas una por una se separan las de verdad de los falsos
 * positivos:
 *
 * | pantalla                | veredicto |
 * |---|---|
 * | `/expedientes`          | **falso positivo** — es un `router.replace` a `/pacientes`, no una pantalla |
 * | `/nota/[patientId]`     | **falso positivo** como encabezado — es la ruta de rescate de un URL mal formado … |
 * | `/nota/[…]/[notaId]`    | defecto real, y se paga en `v15-el-documento-clinico-nombra-al-paciente` |
 * | `/chat`                 | **defecto real** — tiene título, pero fingido |
 *
 * ── LOS DOS QUE ESTE GUARDIÁN CUBRE ───────────────────────────────────────
 *
 * 1. **`/chat` fingía su encabezado.** «Chat de la clínica» se pintaba en un
 *    `<div>` a 15/700, en el sitio exacto de un título y con su misma voz —
 *    pero sin serlo. Todas las demás superficies declaran el suyo de verdad,
 *    propio o vía `PageHeader`. Quien recorre por encabezados no encontraba
 *    ninguno. Cambia la semántica, no la voz.
 *
 * 2. **La ruta de rescate prometía un sitio y llevaba a otro.** Su botón decía
 *    «Ir a Consulta» y navegaba a `/pacientes`. Es la familia de RTC-08, que
 *    este producto ya declaró defecto y reparó en el riel — «un ítem que dice
 *    Encuentro, te deja en la lista de pacientes y encima ilumina Paciente
 *    rompe la pregunta de §15 en el primer uso». La regla que se fijó
 *    entonces (o hay un lugar, o se dice cuál es) nunca llegó a esta pantalla:
 *    el producto aprendió la lección en un sitio y no la aplicó en el otro.
 *    Es la misma forma que REG-319, donde un contenedor reservó la banda de la
 *    barra del pulgar y su hermano no.
 *
 * El DESTINO no se toca: no se entra a una consulta sin elegir paciente
 * primero, así que `/pacientes` es correcto. Lo que se corrige es la promesa.
 *
 * ── QUÉ NO CUBRE ──────────────────────────────────────────────────────────
 *
 *  · No es un barrido de accesibilidad del producto. Cubre las dos superficies
 *    que la matriz de coherencia señaló, no «todas las pantallas tienen h1»:
 *    hay rutas que legítimamente no lo llevan (redirecciones), y convertir eso
 *    en regla obligaría a poner encabezados donde no hay pantalla.
 *  · No mide contraste, foco ni orden de encabezados — eso es axe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const CHAT = 'src/app/(dashboard)/chat/page.tsx'
const RESCATE = 'src/app/(dashboard)/nota/[patientId]/page.tsx'

describe('/chat declara su título como encabezado, no como un div con pinta de título', () => {
  it('«Chat de la clínica» vive en un <h1>', () => {
    const src = sinComentarios(leer(CHAT))
    expect(src).toMatch(/<h1[^>]*>Chat de la clínica<\/h1>/)
  })

  /**
   * Probado al revés: si vuelve a ser un `<div>`, este caso muerde. Se nombra
   * el literal exacto que había — es la regresión concreta que se vigila.
   */
  it('ya no queda un <div> haciendo de título', () => {
    const src = sinComentarios(leer(CHAT))
    expect(src).not.toMatch(/<div[^>]*>Chat de la clínica<\/div>/)
  })

  it('conserva su VOZ: mismo tamaño y peso que tenía de div (15/700)', () => {
    // La reparación es semántica. Si además hubiera cambiado de tamaño, sería
    // un rediseño encubierto y esta iteración no hace rediseño por gusto.
    const src = sinComentarios(leer(CHAT))
    const h1 = src.match(/<h1([^>]*)>Chat de la clínica<\/h1>/)?.[1] ?? ''
    expect(h1).toMatch(/fontSize:\s*15/)
    expect(h1).toMatch(/fontWeight:\s*700/)
  })
})

describe('la ruta de rescate de nota no promete un sitio al que no lleva', () => {
  it('el botón ya no dice «Ir a Consulta»', () => {
    expect(sinComentarios(leer(RESCATE))).not.toMatch(/Ir a Consulta/)
  })

  it('lo que promete el rótulo es lo que hace el destino', () => {
    const src = sinComentarios(leer(RESCATE))
    // El destino no cambió — se comprueba que sigue siendo el correcto…
    expect(src).toMatch(/router\.push\('\/pacientes'\)/)
    // …y que el rótulo lo nombra.
    expect(src).toMatch(/Ir a Pacientes/)
  })
})

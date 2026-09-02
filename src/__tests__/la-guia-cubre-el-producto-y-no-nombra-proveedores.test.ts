/**
 * GOLDEN — la guía no documentaba cómo firmar.
 *
 * ── QUÉ FALTABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Recorriendo la guía tema por tema contra el árbol de rutas real. Cubría
 * catorce cosas y le faltaban nueve, entre ellas:
 *
 *   · **firmar la nota** — el acto medicolegal del producto
 *   · el ciclo de la orden hasta el resultado y la decisión
 *   · el expediente y la línea de tiempo del paciente
 *   · qué significa sugerido / confirmado / descartado / activo / histórico
 *   · el portal del paciente
 *   · la cuenta: contraseña, segundo factor, sesión
 *   · privacidad, y qué le toca al médico
 *   · qué hacer cuando algo falla
 *   · qué es Ausculta, en una frase
 *
 * Y el hueco no era sólo de la guía: **esta misma base alimenta al bot de
 * soporte** (`/api/ayuda-bot`, ver la cabecera de `conocimiento.ts`). Un médico
 * que le preguntara al bot «¿por qué no me deja firmar?» no tenía de dónde
 * sacar la respuesta. Es el patrón de una sola fuente funcionando al revés: el
 * defecto se propaga a los dos consumidores a la vez.
 *
 * ── EL SEGUNDO DEFECTO: LA MARCA DEL PROVEEDOR EN LA PANTALLA ───────────────
 *
 * Seis cadenas de cara al médico nombraban modelos y proveedores:
 * «⚡ Rápida (Haiku)», «⭐ Estándar (Sonnet 5…)», «💎 Máxima (Opus 4.8 +
 * GPT-5…)», «Opus de Anthropic + GPT-5 de OpenAI», «doble cerebro (Claude +
 * GPT)», «Razonado por Claude + GPT», más «la llave de AssemblyAI».
 *
 * `planes-ia.ts` declara la frontera por escrito —lo exportado como cadena de
 * pantalla NO nombra proveedores ni modelos— y ya se corrigió una vez en
 * `TablaNivelesIA` (#345). La base de conocimiento se quedó fuera de aquella
 * corrección. Además son versiones: «Sonnet 5» y «Opus 4.8» caducan solas y
 * dejan a la guía diciendo algo falso sin que nadie toque nada.
 *
 * Lo que el médico necesita saber no es qué modelo corre, sino QUÉ CAMBIA
 * CLÍNICAMENTE — que es justo lo que `MOTORES.incluye` ya dice, y en
 * provider-free.
 *
 * ── PROBADO AL REVÉS ────────────────────────────────────────────────────────
 *
 * Contra el árbol anterior fallan los dos casos: nueve temas ausentes y siete
 * menciones de proveedor.
 *
 * ── QUÉ **NO** CUBRE ────────────────────────────────────────────────────────
 *
 * · **No comprueba que lo escrito sea cierto.** Cada sección nueva se redactó
 *   mirando la pantalla que describe —los rótulos y los estados son los que
 *   existen hoy— pero eso es una verificación por LECTURA, no una medición.
 *   Un texto que envejezca mal pasaría este caso. Lo que sí impide es que un
 *   tema DESAPAREZCA.
 * · **No mira la pantalla de la guía.** `/guia` vive detrás de la sesión y no
 *   se pudo recorrer en un navegador en esta corrida; se declara. Lo que sí se
 *   comprueba aquí es que cada sección tenga icono, porque sin él la lista se
 *   vuelve una columna de bombillos idénticos y deja de poder recorrerse de un
 *   vistazo.
 * · No vigila el resto de la aplicación: los nombres de proveedor fuera de la
 *   base de conocimiento tienen sus propios guardianes.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GUIA, conocimientoTexto } from '@/lib/ayuda/conocimiento'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/**
 * Los temas sin los que la guía no cubre el producto. No es la lista completa
 * de secciones —eso ataría el caso al índice— sino lo que un médico tiene que
 * poder buscar, con la palabra por la que lo buscaría.
 */
const TEMAS_QUE_NO_PUEDEN_FALTAR: { tema: string; senal: RegExp }[] = [
  { tema: 'qué es Ausculta', senal: /qué es ausculta/i },
  { tema: 'firmar la nota', senal: /firmar la nota/i },
  { tema: 'por qué el botón de firmar está apagado', senal: /bot[óo]n est[áa] apagado/i },
  { tema: 'órdenes y seguimiento del resultado', senal: /[óo]rdenes, resultados y seguimiento/i },
  { tema: 'el expediente del paciente', senal: /pacientes y expediente/i },
  { tema: 'sugerido contra confirmado', senal: /sugerido ≠ confirmado/i },
  { tema: 'el portal del paciente', senal: /el portal del paciente/i },
  { tema: 'contraseña y sesión', senal: /contrase[ñn]a y sesi[óo]n/i },
  { tema: 'privacidad y seguridad', senal: /privacidad y seguridad/i },
  { tema: 'qué hacer cuando algo falla', senal: /cuando algo falla/i },
]

/** Marcas de proveedor y de modelo. Ninguna es cosa del médico. */
const PROVEEDORES =
  /\b(haiku|sonnet|opus|gpt-?\d|chatgpt|claude|anthropic|openai|assemblyai|whisper|gemini|llama)\b/i

describe('la guía cubre el producto', () => {
  it('ningún tema esencial se queda sin documentar', () => {
    const texto = conocimientoTexto()
    const ausentes = TEMAS_QUE_NO_PUEDEN_FALTAR
      .filter(({ senal }) => !senal.test(texto))
      .map(({ tema }) => tema)
    expect(
      ausentes,
      `sin esto, ni la guía ni el bot de soporte pueden contestar:\n${ausentes.join('\n')}`,
    ).toEqual([])
  })

  it('«qué es Ausculta» va primero, que es lo que se lee primero', () => {
    expect(GUIA[0].id).toBe('que-es')
  })

  it('cada sección tiene icono propio, o la lista es una columna de bombillos', () => {
    const pagina = leer('src/app/(dashboard)/guia/page.tsx')
    const bloque = pagina.slice(pagina.indexOf('const ICONO'), pagina.indexOf('const ROLES'))
    const sinIcono = GUIA.filter(s => !bloque.includes(`${s.id}:`) && !bloque.includes(`'${s.id}':`))
      .map(s => s.id)
    expect(sinIcono, `caen al icono genérico: ${sinIcono.join(', ')}`).toEqual([])
  })

  it('y lo que documenta lleva pasos de verdad, no un titular suelto', () => {
    const flojas = GUIA.filter(s => s.pasos.length < 3).map(s => s.id)
    expect(flojas, `secciones sin contenido útil: ${flojas.join(', ')}`).toEqual([])
  })
})

describe('la guía no nombra proveedores ni modelos', () => {
  it('ni en un paso, ni en un tip, ni en un aviso', () => {
    const culpables: string[] = []
    for (const s of GUIA) {
      const trozos = [
        s.titulo, s.intro,
        ...s.pasos.flatMap(p => [p.t, p.d]),
        ...(s.tips ?? []), ...(s.ojo ?? []),
      ]
      for (const t of trozos) {
        const m = t.match(PROVEEDORES)
        if (m) culpables.push(`${s.id} → «${m[0]}» en: ${t.slice(0, 80)}…`)
      }
    }
    expect(
      culpables,
      `la marca del proveedor llega a la pantalla del médico (#345):\n${culpables.join('\n')}`,
    ).toEqual([])
  })

  it('los tres niveles siguen explicándose por lo que CAMBIA clínicamente', () => {
    /**
     * Quitar el nombre del modelo no puede dejar la sección vacía: lo que el
     * médico necesita para elegir sigue teniendo que estar, y es lo mismo que
     * dice `MOTORES.incluye` — provider-free desde su origen.
     */
    const texto = conocimientoTexto()
    expect(texto).toMatch(/separaci[óo]n de voces/i)
    expect(texto).toMatch(/segundo verificador|segunda inteligencia/i)
    expect(texto).toMatch(/revisi[óo]n farmacol[óo]gica/i)
  })
})

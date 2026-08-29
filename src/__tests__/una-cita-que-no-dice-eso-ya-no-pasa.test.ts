/**
 * GOLDEN — SE COMPROBABA QUE LA CITA ESTUVIERA EN RANGO, NO QUE DIJERA ESO.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * La ruta de evidencia de la consulta pedía al modelo afirmaciones con
 * `citas: [n]` y comprobaba **una sola cosa**: que `n` estuviera dentro del
 * rango de artículos.
 *
 * Es decir: un `[2]` que apunte a un artículo **que dice lo contrario** pasaba.
 * Y pasaba con la peor apariencia posible — una afirmación clínica con su número
 * de cita al lado, que es exactamente el formato que un médico lee como «esto
 * está respaldado».
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * El tablero de Ausculta lo tenía escrito desde la auditoría de WS-06/07: «la
 * verificación de citas está construida, probada y **nunca se llama**;
 * `mapaDeSoporte`, `esRespuestaRespaldada` y `tasaSinRespaldo` tienen cero
 * llamadores fuera de pruebas». Se abrió como P1-19 al cerrar P1-9.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * Dos cosas, y la segunda explica por qué nadie lo había enchufado:
 *
 * 1. **El verificador no tenía llamador.** Familia «escrito, probado y sin
 *    conectar». Su propio encabezado decía que se había escrito reutilizando la
 *    forma de esta ruta «para que enchufarlo no exija cambiarle el prompt».
 * 2. **Y aun así había que cambiar el prompt.** `claimDesde` exige el **pasaje
 *    literal**: el trozo de texto del artículo que respalda la frase. El modelo
 *    devolvía sólo el número. Sin el pasaje no hay nada que verificar — sólo un
 *    número que está en rango.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Se le pide al modelo la **frase literal** que respalda cada afirmación, y se
 * ancla carácter a carácter contra el texto que se le enseñó. Pedirlo no es sólo
 * para poder comprobar: obligarle a copiar la frase que lo respalda es la forma
 * más barata que existe de que **no invente el respaldo**.
 *
 * Y el prompt le dice explícitamente que, si no tiene una frase literal, deje la
 * cita vacía: **decirlo sin cita es honesto; citar algo que no lo dice, no**.
 *
 * ── QUÉ SE HACE CON LO NO RESPALDADO — Y POR QUÉ NO SE BORRA ────────────────
 *
 * **No se borra.** Puede seguir siendo buen razonamiento clínico —consenso,
 * fisiopatología, experiencia— y borrarlo le quitaría al médico algo que quizá
 * necesita. Lo que no puede es seguir **pareciendo** respaldado: se le quita el
 * `[n]` y se marca. El médico decide, que es la regla de la casa.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **Anclar no es entender.** Que la frase esté literalmente en el resumen no
 *   prueba que respalde la afirmación: un pasaje puede citarse fuera de
 *   contexto, o decir lo contrario en la frase siguiente. Esto cierra la
 *   invención del respaldo, no la interpretación — y esa distinción es la razón
 *   por la que el aviso dice «no se pudo comprobar», no «es falso».
 * · **Se ancla contra el RESUMEN** (más el texto completo de PMC cuando la
 *   licencia lo permite, REG-357), que es lo que el modelo vio. Anclar contra un
 *   texto que no vio sería pedirle que cite lo que no leyó.
 * · **No prueba la red ni el modelo.** Se ejercita el verificador con artículos
 *   y afirmaciones sintéticas.
 * · **No renderiza.** Que la marca exista en el árbol no prueba que se vea.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { verificarAfirmaciones, fuentesDeArticulos } from '@/lib/evidencia/verificar-la-cita'

const AHORA = '2026-08-29T12:00:00.000Z'

const ARTICULOS = [
  {
    pmid: '40000001', titulo: 'Nitrofurantoína en ITU no complicada', revista: 'Rev Sintética', anio: '2024',
    resumen: 'En este ensayo aleatorizado, la nitrofurantoína durante cinco días logró curación clínica en el 88% de las pacientes, frente al 74% con dosis única de fosfomicina (HR 0.72, IC95% 0.60-0.86).',
  },
  {
    pmid: '40000002', titulo: 'Profilaxis con arándano', revista: 'Rev Sintética', anio: '2023',
    resumen: 'No se encontró diferencia significativa entre el extracto de arándano y el placebo para la prevención de infecciones urinarias recurrentes en mujeres premenopáusicas.',
  },
]

describe('LA CITA SE ANCLA AL TEXTO, NO AL NÚMERO', () => {
  it('una afirmación con su pasaje literal queda respaldada', () => {
    const v = verificarAfirmaciones([{
      texto: 'La nitrofurantoína cinco días supera a la fosfomicina en dosis única.',
      citas: [1],
      pasajes: ['la nitrofurantoína durante cinco días logró curación clínica en el 88% de las pacientes'],
    }], ARTICULOS, AHORA)
    expect(v.sePudoVerificar).toBe(true)
    expect(v.respaldada).toBe(true)
    expect(v.sinRespaldo).toEqual([])
  })

  it('EL CASO: un [n] en rango cuyo artículo NO dice eso ya no pasa', () => {
    /**
     * El número 2 existe, así que la comprobación anterior —«¿está en rango?»—
     * lo daba por bueno. El artículo 2 habla de arándano y placebo.
     */
    const v = verificarAfirmaciones([{
      texto: 'El arándano reduce a la mitad las recurrencias.',
      citas: [2],
      pasajes: ['el extracto de arándano redujo a la mitad las recurrencias'],
    }], ARTICULOS, AHORA)
    expect(v.respaldada).toBe(false)
    expect(v.sinRespaldo.length).toBe(1)
    expect(v.sinRespaldo[0].texto).toContain('arándano')
  })

  it('citar un artículo que no existe tampoco pasa', () => {
    const v = verificarAfirmaciones([{
      texto: 'Afirmación con cita inventada.', citas: [9],
      pasajes: ['un texto cualquiera lo bastante largo para pasar el mínimo'],
    }], ARTICULOS, AHORA)
    expect(v.respaldada).toBe(false)
    expect(v.sinRespaldo[0].motivo).toBe('CITA_FUERA_DE_RANGO')
  })

  it('citar sin aportar el pasaje no basta: era exactamente lo que se hacía antes', () => {
    const v = verificarAfirmaciones([{
      texto: 'La nitrofurantoína es superior.', citas: [1],
    }], ARTICULOS, AHORA)
    expect(v.respaldada).toBe(false)
    expect(v.sinRespaldo[0].motivo).toBe('SIN_PASAJE')
  })

  it('y un pasaje PARAFRASEADO no cuela: se compara carácter a carácter', () => {
    const v = verificarAfirmaciones([{
      texto: 'La nitrofurantoína cura a casi nueve de cada diez.',
      citas: [1],
      // Dice lo mismo, pero no son las palabras del artículo.
      pasajes: ['la nitrofurantoina curó a casi nueve de cada diez mujeres del estudio'],
    }], ARTICULOS, AHORA)
    expect(v.respaldada).toBe(false)
  })

  it('una sola afirmación inventada tumba el «respaldada» de todo el bloque', () => {
    /**
     * Deliberadamente estricto: una respuesta con tres afirmaciones buenas y una
     * inventada no es una respuesta respaldada — es una respuesta con una
     * afirmación inventada dentro.
     */
    const v = verificarAfirmaciones([
      {
        texto: 'Buena.', citas: [1],
        pasajes: ['la nitrofurantoína durante cinco días logró curación clínica en el 88% de las pacientes'],
      },
      { texto: 'Inventada.', citas: [2], pasajes: ['el arándano redujo a la mitad las recurrencias'] },
    ], ARTICULOS, AHORA)
    expect(v.respaldada).toBe(false)
    expect(v.respaldadas).toBe(1)
    expect(v.tasaSinRespaldo).toBeGreaterThan(0)
  })
})

describe('«NO SE PUDO VERIFICAR» NO ES «NO ESTÁ RESPALDADA»', () => {
  it('sin artículos, no se emite juicio sobre el análisis', () => {
    const v = verificarAfirmaciones([{ texto: 'Algo.', citas: [1], pasajes: ['x'] }], [], AHORA)
    expect(v.sePudoVerificar).toBe(false)
    expect(v.sinRespaldo).toEqual([])
  })

  it('sin afirmaciones citadas tampoco', () => {
    const v = verificarAfirmaciones([], ARTICULOS, AHORA)
    expect(v.sePudoVerificar).toBe(false)
  })

  it('un artículo sin resumen no sirve para anclar, y se descarta sin romper', () => {
    const fuentes = fuentesDeArticulos([{ pmid: '1', titulo: 'Sin resumen', resumen: '' }], AHORA)
    expect(fuentes).toEqual([])
  })

  it('y un año que no se reconoce no se inventa', () => {
    const [f] = fuentesDeArticulos([{ pmid: '7', titulo: 'T', resumen: 'Un resumen suficiente para anclar pasajes.', anio: 'sin fecha' }], AHORA)
    expect(f.publicado.precision).toBe('desconocida')
  })
})

describe('LA RUTA Y LA PANTALLA LO TIENEN CABLEADO', () => {
  const ruta = readFileSync('src/app/api/expediente/evidencia/route.ts', 'utf8')
  const pantalla = readFileSync('src/app/(dashboard)/consulta/[patientId]/page.tsx', 'utf8')

  it('el prompt pide el PASAJE literal, no sólo el número', () => {
    expect(ruta).toContain('"pasajes"')
    expect(ruta).toContain('LITERAL, palabra por palabra')
    // Y le da la salida honesta: sin frase literal, cita vacía.
    expect(ruta).toContain('deja "citas" y "pasajes" VACÍOS')
  })

  it('la ruta verifica de verdad', () => {
    expect(ruta).toContain('verificarAfirmaciones(')
    expect(ruta).toContain('_verificacion')
  })

  it('LA PANTALLA MARCA lo no respaldado — y le QUITA el [n]', () => {
    /**
     * Dejar el número al lado de una afirmación no anclada sería seguir
     * enseñándola como evidencia citada, que es el defecto entero.
     */
    expect(pantalla).toContain('sin respaldo comprobado en el artículo citado')
    expect(pantalla).toContain('noAnclada ? null : citas(it.citas)')
  })

  it('y NO la borra: puede ser buen razonamiento clínico', () => {
    // El comentario que explica el porqué va ANTES del `Set`, con el bloque.
    const i = pantalla.indexOf('const sinRespaldo = new Set')
    const bloque = pantalla.slice(Math.max(0, i - 900), i + 900)
    expect(bloque).toContain('No se borra')
    // Y la afirmación sigue pintándose: sólo pierde el respaldo aparente.
    expect(bloque).toContain('String(it[campoTitulo]')
  })
})

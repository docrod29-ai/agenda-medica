/**
 * GOLDEN — el juez leía un texto distinto del que leyó el redactor.
 *
 * ── EL DEFECTO, Y ES DE LOS QUE NO SE VEN ────────────────────────────────────
 *
 * El modelo redacta la nota leyendo el diálogo **marcado**: las palabras que el
 * audio no oyó con seguridad van entre `⟦…?⟧`, con su instrucción delante. Si el
 * modelo cita una frase que contiene una de esas palabras, la cita se lleva la
 * marca dentro:
 *
 *     "le doy ⟦sefriaxona?⟧ dos gramos"
 *
 * Y el sello de procedencia compara esa cita contra la transcripción **plana**,
 * donde la marca no existe. No la encuentra → degrada el campo a «ia» → la
 * compuerta de firma lo saca como «no se pudo comprobar».
 *
 * O sea: un campo **correctamente citado** se presentaba como dudoso. Y encima
 * justo en las frases donde el audio ya había dudado — las que más importa
 * revisar bien. El médico ve una lista de avisos que no le dice nada, y una
 * lista que no dice nada se cierra sin leer: ahí se pierde entera, incluida la
 * alergia que sí importaba.
 *
 * ── ES LA `FidelidadEntrega` DEL CHARTER ─────────────────────────────────────
 *
 * «El string medido debe ser el que sale hacia la IA», con criterio de
 * aceptación **= 1**. Aquí el juez y el redactor leían strings distintos, así
 * que cualquier medición de exactitud habría sido sobre el texto equivocado.
 *
 * ── LA CORRECCIÓN ────────────────────────────────────────────────────────────
 *
 * La marca es una anotación **nuestra**, no algo que dijera el paciente: una
 * cita que la arrastra sigue siendo las mismas palabras. Se quita al normalizar,
 * en los DOS jueces —el sello al firmar y la revalidación del ensamble—, que ya
 * estaban atados por una prueba para que no divergieran.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  construirManifiesto, normaliza, quienSostiene,
  POR_QUE_SE_QUITAN_LAS_MARCAS, POR_QUE_SE_DICE_QUIEN,
} from '@/lib/expediente/procedencia'
import { normaliza as normalizaRevalidacion, citaVerifica } from '@/lib/ia/revalidar-citas'
import { ABRE, CIERRA, marcarTurno } from '@/lib/expediente/confianza-audio'

const DICTADO = 'El paciente refiere dolor. Le doy ceftriaxona dos gramos cada ocho horas.'

describe('LA MARCA NO ROMPE LA COMPARACIÓN', () => {
  it('una cita con la marca dentro se normaliza igual que sin ella', () => {
    const conMarca = `le doy ${ABRE}ceftriaxona${CIERRA} dos gramos`
    expect(normaliza(conMarca)).toBe(normaliza('le doy ceftriaxona dos gramos'))
  })

  it('los dos jueces normalizan idéntico', () => {
    /**
     * Ya estaban atados por una prueba; esto lo mantiene después de tocarlos.
     * Dos jueces con criterios distintos harían que aquí pase y al firmar no.
     */
    for (const s of [`${ABRE}dos${CIERRA} gramos`, 'DOS Gramos', '  dos   gramos ']) {
      expect(normalizaRevalidacion(s), s).toBe(normaliza(s))
    }
  })

  it('quitar la marca no se come texto de verdad', () => {
    // Si se llevara por delante caracteres normales, estaría alterando el
    // dictado para que cuadre — que es lo contrario de verificar.
    expect(normaliza('tensión (sistólica) de 120')).toBe('tension (sistolica) de 120')
  })
})

describe('EL CASO COMPLETO: UNA CITA MARCADA SOSTIENE EL CAMPO', () => {
  const manifiesto = (cita: string) => construirManifiesto(
    { medicamentos: [{ nombre: 'Ceftriaxona', dosis: '2 g' }] },
    { medicamentos: [{ nombre: 'Ceftriaxona', dosis: '2 g', source_quote: cita }] } as never,
    undefined,
    { transcripcion: DICTADO },
  )

  it('la cita LIMPIA sella el campo como dictado — como siempre', () => {
    expect(manifiesto('le doy ceftriaxona dos gramos').campos[0].origen).toBe('dictado')
  })

  it('y la cita MARCADA también, que es lo que fallaba', () => {
    const c = manifiesto(`le doy ${ABRE}ceftriaxona${CIERRA} dos gramos`)
    expect(c.campos[0].origen).toBe('dictado')
  })

  it('una cita que de verdad NO está sigue sin sellar', () => {
    // La corrección no puede convertirse en una puerta: lo que no se dijo,
    // sigue sin comprobarse.
    expect(manifiesto('el paciente niega alergias conocidas').campos[0].origen).toBe('ia')
  })
})

describe('Y EN LA REVALIDACIÓN DEL ENSAMBLE, LO MISMO', () => {
  it('una cita marcada verifica contra el dictado plano', () => {
    const t = normaliza(DICTADO)
    expect(citaVerifica(`le doy ${ABRE}ceftriaxona${CIERRA} dos gramos`, t)).toBe(true)
  })

  it('sin dejar pasar una inventada', () => {
    const t = normaliza(DICTADO)
    expect(citaVerifica('frase que no se dijo en esta consulta', t)).toBe(false)
  })
})

describe('LA MARCA SIGUE HACIENDO SU TRABAJO', () => {
  it('marcarTurno sigue marcando: esto no la desactiva', () => {
    /**
     * La corrección es en el JUEZ, no en la marca. Si la marca dejara de
     * ponerse, el modelo volvería a leer un dictado donde todo parece igual de
     * seguro — que es el defecto que la marca vino a cerrar.
     */
    const t = {
      speaker: 'A', text: 'le doy ceftriaxona dos gramos',
      palabras: [
        { texto: 'le', inicioMs: 0, confianza: 0.99 },
        { texto: 'doy', inicioMs: 200, confianza: 0.99 },
        { texto: 'ceftriaxona', inicioMs: 400, confianza: 0.3 },
        { texto: 'dos', inicioMs: 900, confianza: 0.99 },
        { texto: 'gramos', inicioMs: 1200, confianza: 0.98 },
      ],
    }
    expect(marcarTurno(t)).toContain(ABRE)
  })

  it('está escrito por qué se quitan al comparar', () => {
    expect(POR_QUE_SE_QUITAN_LAS_MARCAS).toMatch(/campo correctamente citado/)
  })
})

/**
 * ── EL CUARTO CRITERIO DEL CHARTER: LA ATRIBUCIÓN DE ROL ────────────────────
 *
 * «Atribución de rol crítica errónea = 0 — un síntoma del acompañante como del
 * paciente es un hecho falso.»
 *
 * La regla V3 preguntaba «¿lo afirmó alguien que **no es el médico**?», y con
 * eso bastaba. Así que un antecedente sostenido por **la hija** —«sí, es
 * diabética»— se sellaba exactamente igual que si lo hubiera dicho la paciente,
 * que puede no haberlo dicho nunca.
 *
 * No se arregla rechazándolo: el relato de un acompañante **es** historia
 * clínica válida, y con un paciente con demencia o afasia es la única que hay.
 * Lo que no puede es atribuirse **en silencio** al paciente.
 */
describe('QUIÉN SOSTIENE LA CITA', () => {
  const turnos = [
    { rol: 'Médico', texto: '¿Ha tenido diabetes?' },
    { rol: 'Paciente', texto: 'No sé, doctor.' },
    { rol: 'Acompañante', texto: 'Sí, es diabética desde hace años, yo le pongo la insulina.' },
  ]

  it('lo que dice el propio paciente no lleva apostilla', () => {
    // El caso normal. Añadirle «lo dijo: Paciente» sería ruido en todas las
    // líneas, y un sello lleno de ruido se deja de leer.
    expect(quienSostiene('no sé, doctor', turnos)).toBeUndefined()
  })

  it('lo que dice el acompañante SÍ dice quién', () => {
    expect(quienSostiene('es diabética desde hace años', turnos)).toBe('Acompañante')
  })

  it('sin turnos no se inventa un rol', () => {
    // Una apostilla equivocada sobre quién habló es peor que ninguna.
    expect(quienSostiene('es diabética', undefined)).toBeUndefined()
    expect(quienSostiene('es diabética', [])).toBeUndefined()
  })

  it('una cita que no cae en ningún turno tampoco', () => {
    expect(quienSostiene('frase que nadie dijo aquí', turnos)).toBeUndefined()
  })

  it('el campo NO se degrada: sigue siendo dictado, con su autor', () => {
    /**
     * Degradarlo a «ia» diría «no se pudo comprobar» sobre algo que sí se
     * comprobó. Quien lo dijo es un hecho, no una duda.
     */
    const m = construirManifiesto(
      { diagnosticos: [{ descripcion: 'Diabetes mellitus' }] },
      { diagnosticos: [{ descripcion: 'Diabetes mellitus', source_quote: 'es diabética desde hace años' }] } as never,
      undefined,
      { transcripcion: turnos.map(t => t.texto).join(' '), turnos },
    )
    expect(m.campos[0].origen).toBe('dictado')
    expect(m.campos[0].dichoPor).toBe('Acompañante')
  })

  it('y el sello lo enseña', () => {
    const comp = readFileSync(join(process.cwd(), 'src', 'components', 'SelloProcedencia.tsx'), 'utf8')
    expect(comp).toContain('lo dijo: {c.dichoPor}')
  })

  it('está escrito por qué no se rechaza el dato', () => {
    expect(POR_QUE_SE_DICE_QUIEN).toMatch(/demencia o afasia/)
  })
})

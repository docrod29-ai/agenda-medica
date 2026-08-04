/**
 * GOLDEN — la duda del motor de audio ya no se borra: se propaga.
 *
 * ── EL CASO ──────────────────────────────────────────────────────────────────
 *
 * En una consulta real, el audio oyó «la de la **docencia**» —que no significa
 * nada ahí— y aguas abajo apareció **«vesícula»**, un órgano que el paciente
 * nunca mencionó. El Dr. lo señaló: «él nunca dijo nada de la vesícula».
 *
 * ── EL MECANISMO, QUE ES LO QUE ESTA PRUEBA FIJA ─────────────────────────────
 *
 * AssemblyAI devuelve una confianza por CADA palabra. La ruta la tiraba:
 *
 *     (u) => ({ speaker: u.speaker, text: u.text })   // ← `u.words` a la basura
 *
 * Después de esa línea una palabra de 0.31 y una de 0.99 son indistinguibles, y
 * el modelo razona sobre las dos con el mismo aplomo. El motor SABÍA que dudaba
 * y la duda la borramos nosotros — el dato existía y era gratis.
 *
 * La v973 arregló por qué no había diarización. Esto arregla por qué una palabra
 * mal oída llegaba a la nota disfrazada de hecho.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  esMarcable, palabrasDudosas, marcarTurno, paraElMedico, marcaDeTiempo,
  UMBRAL_DUDA, UMBRAL_SIN_CALIBRAR, TOPE_AVISO, INSTRUCCION_MARCAS, ABRE, CIERRA,
  POR_QUE_NO_SE_CORRIGE, POR_QUE_SE_PROPAGA_LA_DUDA,
  type TurnoConPalabras,
} from '@/lib/expediente/confianza-audio'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

/** El turno real que falló, con la palabra dudosa donde estuvo. */
const TURNO_DE_LUIS: TurnoConPalabras = {
  speaker: 'B',
  text: 'me duele aquí la de la docencia desde hace tres días',
  palabras: [
    { texto: 'me', inicioMs: 1000, confianza: 0.97 },
    { texto: 'duele', inicioMs: 1200, confianza: 0.99 },
    { texto: 'aquí', inicioMs: 1500, confianza: 0.95 },
    { texto: 'la', inicioMs: 1700, confianza: 0.42 },
    { texto: 'de', inicioMs: 1800, confianza: 0.40 },
    { texto: 'la', inicioMs: 1900, confianza: 0.44 },
    { texto: 'docencia', inicioMs: 2000, confianza: 0.31 },
    { texto: 'desde', inicioMs: 2600, confianza: 0.96 },
    { texto: 'hace', inicioMs: 2800, confianza: 0.98 },
    { texto: 'tres', inicioMs: 3000, confianza: 0.97 },
    { texto: 'días', inicioMs: 3200, confianza: 0.99 },
  ],
}

describe('EL CASO REAL: «docencia» queda marcada', () => {
  it('la palabra que rompió la nota se detecta', () => {
    const d = palabrasDudosas([TURNO_DE_LUIS])
    expect(d.map(p => p.texto)).toContain('docencia')
  })

  it('y el texto que ve el modelo la trae marcada', () => {
    expect(marcarTurno(TURNO_DE_LUIS)).toContain(`${ABRE}docencia${CIERRA}`)
  })

  it('lo que SÍ se oyó bien no se marca', () => {
    const m = marcarTurno(TURNO_DE_LUIS)
    expect(m).toContain('duele')
    expect(m).not.toContain(`${ABRE}duele`)
    expect(m).not.toContain(`${ABRE}días`)
  })

  it('NO se corrige ni se propone nada: sigue diciendo «docencia»', () => {
    /**
     * Ésta es la prueba que define el módulo. Buscar la palabra clínica más
     * parecida a «docencia» es CÓMO se llega a «vesícula»: el mismo fallo,
     * cometido por nosotros y con más confianza. Se marca la duda; no se
     * resuelve.
     */
    const m = marcarTurno(TURNO_DE_LUIS)
    expect(m).toContain('docencia')
    expect(m.toLowerCase()).not.toContain('vesícula')
    expect(POR_QUE_NO_SE_CORRIGE).toMatch(/es el mismo fallo/)
  })
})

describe('LAS PALABRAS VACÍAS NO SE MARCAN, y no es un descuido', () => {
  it('«la» y «de» dudosas se quedan sin marca', () => {
    /**
     * Son las que más bajo puntúan —se dicen rápido y pegadas— y ninguna se
     * convierte jamás en un hecho clínico. Marcarlas llenaría el texto de marcas
     * irrelevantes, y un texto lleno de marcas se lee igual que uno sin ninguna.
     */
    const m = marcarTurno(TURNO_DE_LUIS)
    expect(m).not.toContain(`${ABRE}la${CIERRA}`)
    expect(m).not.toContain(`${ABRE}de${CIERRA}`)
  })

  it('la puntuación no impide reconocerlas', () => {
    expect(esMarcable({ texto: 'La,', inicioMs: 0, confianza: 0.2 })).toBe(false)
  })

  it('pero un fármaco dudoso SÍ se marca aunque sea corto', () => {
    expect(esMarcable({ texto: 'DOAC', inicioMs: 0, confianza: 0.35 })).toBe(true)
  })
})

describe('EL UMBRAL: declarado como no calibrado', () => {
  it('está en el rango en que una confianza tiene sentido', () => {
    expect(UMBRAL_DUDA).toBeGreaterThan(0)
    expect(UMBRAL_DUDA).toBeLessThan(1)
  })

  it('NEEDS_CALIBRATION — no se presenta como medido', () => {
    /**
     * No sale de ningún estudio: es un punto de partida. Presentarlo como una
     * cifra validada sería la misma clase de invención que este repositorio
     * lleva toda la sesión desmontando, sólo que en estadística en vez de en
     * clínica.
     */
    expect(UMBRAL_SIN_CALIBRAR).toMatch(/NEEDS_CALIBRATION/)
    expect(UMBRAL_SIN_CALIBRAR).toMatch(/banco de voz/)
  })

  it('y se explica hacia qué lado se erró', () => {
    // Marcar de más cuesta una mirada; marcar de menos cuesta una palabra
    // inventada dentro de una nota firmada.
    expect(UMBRAL_SIN_CALIBRAR).toMatch(/marcar de menos cuesta/)
  })

  it('se puede mover sin tocar código', () => {
    expect(leer('src', 'lib', 'expediente', 'confianza-audio.ts'))
      .toContain('NEXT_PUBLIC_UMBRAL_CONFIANZA_AUDIO')
  })
})

describe('LA REGLA que acompaña a las marcas', () => {
  it('una palabra marcada NUNCA se convierte en hecho clínico', () => {
    // Sin la regla, las marcas son un formato raro que el modelo descarta.
    expect(INSTRUCCION_MARCAS).toMatch(/NUNCA se convierte en un hecho clínico/)
  })

  it('prohíbe explícitamente sustituirla por la más probable', () => {
    expect(INSTRUCCION_MARCAS).toMatch(/no la sustituyas/)
  })

  it('y cierra la salida falsa: ausencia de dato no es dato de ausencia', () => {
    /**
     * Sin esto, un modelo prudente responde a la duda afirmando lo contrario
     * («niega antecedentes»), que en una nota clínica es peor que callar.
     */
    expect(INSTRUCCION_MARCAS).toMatch(/ausencia de dato no es dato de ausencia/i)
  })

  it('la marca no se confunde con lo que un médico dicta', () => {
    // Un médico dicta paréntesis y corchetes de verdad; una marca que se
    // confunde con el contenido no marca nada.
    expect(ABRE).not.toBe('[')
    expect(ABRE).not.toBe('(')
  })
})

describe('LO QUE VE EL MÉDICO', () => {
  it('la lista trae la palabra, el minuto y qué tan seguro estaba el motor', () => {
    const { palabras } = paraElMedico([TURNO_DE_LUIS])
    expect(palabras[0]).toEqual({ texto: 'docencia', momento: '0:02', seguridad: 31 })
  })

  it('la más dudosa va primero, no la primera que se dijo', () => {
    const t: TurnoConPalabras = {
      speaker: 'A', text: '',
      palabras: [
        { texto: 'amikacina', inicioMs: 500, confianza: 0.55 },
        { texto: 'meropenem', inicioMs: 900, confianza: 0.20 },
      ],
    }
    expect(paraElMedico([t]).palabras[0].texto).toBe('meropenem')
  })

  it('el minuto se lee como un reloj, para volver al audio', () => {
    expect(marcaDeTiempo(0)).toBe('0:00')
    expect(marcaDeTiempo(65_000)).toBe('1:05')
    expect(marcaDeTiempo(600_000)).toBe('10:00')
  })

  it('cuando se recorta la lista, se DICE cuántas quedaron fuera', () => {
    /**
     * «Un recorte que nadie ve se lee como el total» — el fallo que este
     * repositorio ya cometió y ya arregló en otros sitios. Aquí significaría que
     * el médico cree haber revisado todas las palabras dudosas.
     */
    const muchas: TurnoConPalabras = {
      speaker: 'A', text: '',
      palabras: Array.from({ length: TOPE_AVISO + 5 }, (_, i) => ({
        texto: `palabra${i}`, inicioMs: i * 1000, confianza: 0.1 + i * 0.01,
      })),
    }
    const r = paraElMedico([muchas])
    expect(r.palabras).toHaveLength(TOPE_AVISO)
    expect(r.ocultas).toBe(5)
  })

  it('sin palabras dudosas no hay lista, y por tanto no hay aviso', () => {
    const limpio: TurnoConPalabras = {
      speaker: 'A', text: 'buenos días',
      palabras: [{ texto: 'buenos', inicioMs: 0, confianza: 0.99 }, { texto: 'días', inicioMs: 300, confianza: 0.98 }],
    }
    expect(paraElMedico([limpio]).palabras).toHaveLength(0)
  })
})

describe('UN TURNO SIN PALABRAS: no saber ≠ estar seguro', () => {
  it('el texto se devuelve tal cual, sin marcas inventadas', () => {
    const viejo: TurnoConPalabras = { speaker: 'A', text: 'dolor abdominal de tres días' }
    expect(marcarTurno(viejo)).toBe('dolor abdominal de tres días')
  })

  it('y no aporta nada a la lista de verificación', () => {
    expect(paraElMedico([{ speaker: 'A', text: 'x' }]).palabras).toHaveLength(0)
  })
})

describe('ESTÁ CONECTADO DE PUNTA A PUNTA', () => {
  it('la ruta ya NO tira `words`', () => {
    /**
     * Ésta es LA línea. Si alguien vuelve a mapear sólo `{ speaker, text }`, la
     * duda se vuelve a borrar y todo lo demás de este archivo pasa en verde
     * sobre un dato que ya no llega.
     */
    const ruta = leer('src', 'app', 'api', 'expediente', 'transcribir-diarizado', 'route.ts')
    expect(ruta).toContain('u.words')
    expect(ruta).toContain('confianza:')
    expect(ruta).toContain('inicioMs:')
  })

  it('el hook las transporta', () => {
    const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')
    expect(hook).toContain('palabras?: PalabraOida[]')
  })

  it('el corrector NO reescribe las confianzas', () => {
    /**
     * La confianza describe lo que el motor OYÓ, no lo que el corrector escribió
     * después. Sobrescribirlas haría que la lista señalara términos que el
     * médico ya no ve en pantalla.
     */
    expect(leer('src', 'hooks', 'useGrabacionAudio.ts')).toMatch(/`palabras` se conserva SIN corregir/)
  })

  it('el texto que va a la IA lleva las marcas y la regla', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('marcarTurno(u)')
    expect(page).toContain('INSTRUCCION_MARCAS')
  })

  it('la regla SÓLO viaja si hay marcas', () => {
    // Una regla que habla de algo que no está es ruido que el modelo tiene que
    // descartar solo.
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toMatch(/dudosas\.length > 0 \?/)
  })

  it('y la pantalla se lo enseña al médico ANTES de firmar', () => {
    const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
    expect(page).toContain('Palabras que el audio no oyó con seguridad')
    expect(page).toContain('paraElMedico(audio.utterances)')
  })
})

describe('LAS DOS FRASES DE LA NOTA QUE FALLÓ, prohibidas en el prompt', () => {
  const prompts = leer('src', 'lib', 'expediente', 'prompts.ts')

  it('la nota no puede describirse a sí misma', () => {
    /**
     * La nota real decía «no se refiere motivo clínico **en este fragmento de
     * consulta**; la entrevista corresponde a la elaboración de historia
     * clínica». Eso no es una nota clínica: es el modelo hablando de su entrada.
     */
    expect(prompts).toContain('en este fragmento de consulta')
    expect(prompts).toMatch(/NUNCA DE LA GRABACIÓN/)
  })

  it('y una laguna no se convierte en una negación', () => {
    expect(prompts).toMatch(/Ausencia de dato no es dato de ausencia/)
    expect(prompts).toMatch(/no inteligible, confirmar/)
  })
})

describe('LAS RAZONES ESTÁN ESCRITAS', () => {
  it('por qué se propaga la duda en vez de borrarla', () => {
    expect(POR_QUE_SE_PROPAGA_LA_DUDA).toMatch(/0\.31 y una de 0\.99 son indistinguibles/)
  })
})

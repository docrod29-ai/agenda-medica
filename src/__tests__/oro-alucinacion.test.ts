/**
 * GOLDEN — el corpus oro conecta el arnés de validación, que llevaba meses
 * escrito, probado y huérfano.
 *
 * ── LO QUE ESTO CAMBIA ───────────────────────────────────────────────────────
 *
 * Hasta hoy no existía **un número de alucinación que suba o baje por versión**.
 * Había un arnés (`src/lib/ia/evaluacion.ts`) con sus pruebas, listado en el
 * inventario de huérfanos del propio repositorio, esperando lo único que no se
 * puede escribir sin haber fallado antes: casos.
 *
 * Los tres casos salieron de producción, del Dr., en un solo día.
 *
 * ── EL CRITERIO ES CERO, NO UN PORCENTAJE ────────────────────────────────────
 *
 * Sobre un corpus que controlamos entero, una enfermedad inventada o un órgano
 * que nadie mencionó no son una tasa aceptable: son un fallo.
 *
 * ── LO QUE ESTO **NO** MIDE, y hay que decirlo ───────────────────────────────
 *
 * No mide cuánto alucina el sistema con pacientes reales. Es sintético y
 * pequeño: dice si las defensas deterministas siguen en pie. El número
 * defendible ante un hospital necesita transcripciones de-identificadas y
 * anotación clínica, y lo produce el Dr.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CASOS_ORO, POR_QUE_EL_CRITERIO_ES_CERO, POR_QUE_NO_ES_UNA_MEDICION_DE_PRODUCCION } from '@/lib/ia/casos-oro'
import { evaluarCaso, equivalente } from '@/lib/ia/evaluacion'
import { condicionesNegadas, contradicciones } from '@/lib/expediente/negaciones'
import { sanitizarProsa } from '@/lib/expediente/sanitizar-prosa'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

describe('EL CORPUS ORO existe y está bien formado', () => {
  it('los fallos de producción y el criterio de rol están cubiertos', () => {
    /**
     * Los tres primeros salieron de producción en un solo día. El cuarto no
     * salió de un fallo observado sino de un **criterio del charter** con
     * tolerancia cero —«un síntoma del acompañante como del paciente es un
     * hecho falso»—: la regla V3 aceptaba a cualquiera que no fuera el médico,
     * así que un antecedente que sostiene la hija se sellaba igual que si lo
     * hubiera dicho la paciente.
     */
    expect(CASOS_ORO.map(c => c.id).sort()).toEqual([
      'oro-meta-texto', 'oro-negacion-cronicas', 'oro-palabra-no-entendida',
      'oro-rol-acompanante',
    ])
  })

  it('cada caso dice DE DÓNDE salió y QUÉ defensa lo atrapa', () => {
    /**
     * Un caso sin origen se borra dentro de seis meses por parecer trivial. Y un
     * corpus que sólo falla, sin decir qué defensa se cayó, manda a buscar el
     * problema al sitio equivocado.
     */
    for (const c of CASOS_ORO) {
      expect(c.origen.length, c.id).toBeGreaterThan(40)
      expect(['negaciones', 'confianza-audio', 'sanitizar-prosa', 'procedencia-v3']).toContain(c.defensa)
    }
  })

  it('todos declaran lo que NO puede aparecer', () => {
    for (const c of CASOS_ORO) {
      expect(c.prohibidos?.length, c.id).toBeGreaterThan(0)
    }
  })

  it('y el corpus no puede encoger sin que se note', () => {
    /**
     * Un caso que sale del corpus deja de vigilarse. Si alguien lo quita, esto
     * se pone rojo y hay que justificarlo — es la condición de proceso del
     * charter: «el corpus oro no puede encoger».
     *
     * Crece a 4 en la v1014. Se comprueba el número EXACTO y no un mínimo: un
     * «≥» deja pasar el cambalache de quitar uno y meter otro sin que nadie mire
     * cuál se fue.
     */
    expect(CASOS_ORO).toHaveLength(4)
  })
})

describe('CASO 1 · la negación de crónicas — criterio CERO', () => {
  const caso = CASOS_ORO.find(c => c.id === 'oro-negacion-cronicas')!

  it('el motor detecta las dos condiciones negadas', () => {
    const n = condicionesNegadas(caso.entrada).map(x => x.condicion)
    expect(n).toContain('diabetes')
    expect(n).toContain('hipertensión arterial')
  })

  it('y CAZA la nota mala: los prohibidos no pueden pasar', () => {
    /**
     * Se simula la salida que de verdad ocurrió. Si el motor dejara de atrapar
     * esto, la versión siguiente firmaría notas con dos crónicas inventadas.
     */
    const notaMala = `Paciente con ${caso.prohibidos!.join(', ')}.`
    const c = contradicciones(condicionesNegadas(caso.entrada), notaMala)
    expect(c.length, 'ninguna contradicción detectada').toBe(caso.prohibidos!.length)
  })

  it('lo correcto —el negativo pertinente— NO dispara alarma', () => {
    // Si el negativo pertinente disparara, el médico aprendería a cerrar el
    // aviso sin leerlo, y ahí perdemos la defensa entera.
    const c = contradicciones(condicionesNegadas(caso.entrada), caso.esperado.negativos)
    expect(c).toEqual([])
  })
})

describe('CASO 2 · la palabra que el audio no entendió', () => {
  const caso = CASOS_ORO.find(c => c.id === 'oro-palabra-no-entendida')!

  it('ninguna defensa PROPONE el órgano parecido', () => {
    /**
     * Ésta es la prueba que define el sistema: no se corrige lo que no se oyó.
     * Buscar la palabra clínica más próxima a «docencia» es exactamente cómo se
     * llegó a «vesícula».
     */
    const marcado = leer('src', 'lib', 'expediente', 'confianza-audio.ts')
    for (const p of caso.prohibidos!) {
      expect(marcado.toLowerCase(), p).not.toContain(`'${norm(p)}'`)
    }
    expect(marcado).toMatch(/No corrige nada/)
  })

  it('la entrada conserva la no-palabra: no se sustituye por nada', () => {
    expect(caso.entrada).toContain('docencia')
    for (const p of caso.prohibidos!) {
      expect(norm(caso.entrada)).not.toContain(norm(p))
    }
  })
})

describe('CASO 3 · la nota que hablaba de sí misma', () => {
  const caso = CASOS_ORO.find(c => c.id === 'oro-meta-texto')!

  it('el saneador quita el meta-texto y deja lo clínico', () => {
    const salida = sanitizarProsa(
      `No se refiere motivo clínico en este fragmento de consulta; ${caso.esperado.motivoConsulta}.`,
    )
    expect(norm(salida)).not.toContain('fragmento de consulta')
    expect(salida).toContain('dolor abdominal')
  })

  it('CERO prohibidos sobreviven al saneador, en su frase natural', () => {
    /**
     * PREMISA CORREGIDA. Mi primera versión metía cada prohibido en la misma
     * plantilla («según X»), y «según fragmento de consulta» no es español que
     * nadie escriba: el patrón no coincidía y la prueba culpaba al saneador de
     * un fixture mal construido.
     *
     * Cada prohibido se prueba con la frase en la que de verdad aparece. Y el
     * patrón se deja ESTRECHO a propósito: recortar prosa clínica por parecerse
     * a una bandera interna es el fallo caro de este saneador.
     */
    const FRASES: Record<string, string> = {
      'fragmento de consulta': 'No se refiere motivo clínico en este fragmento de consulta.',
      'la transcripción': 'Refiere dolor abdominal según la transcripción.',
      'la grabación': 'No se especificó en la grabación.',
      'el audio': 'No se dispone del audio completo.',
    }
    for (const p of caso.prohibidos!) {
      const frase = FRASES[p]
      expect(frase, `falta la frase natural de «${p}»`).toBeTruthy()
      expect(norm(sanitizarProsa(frase)), p).not.toContain(norm(p))
    }
  })
})

describe('EL ARNÉS YA NO ES HUÉRFANO — se usa, y da un número', () => {
  it('`evaluarCaso` corre sobre el corpus y cuenta alucinaciones', () => {
    /**
     * Con la salida CORRECTA de cada caso, el arnés no debe encontrar nada.
     * Éste es el número que sube o baja por versión: hoy, cero.
     */
    let alucinaciones = 0
    for (const caso of CASOS_ORO) {
      const r = evaluarCaso(caso, { id: caso.id, campos: caso.esperado })
      alucinaciones += r.alucinaciones.length
      expect(r.faltantes, caso.id).toEqual([])
    }
    expect(alucinaciones, 'alucinaciones sobre el corpus oro').toBe(0)
  })

  it('y detecta la salida MALA de cada caso', () => {
    // Un medidor que no distingue la salida buena de la mala es un generador de
    // ceros. Se comprueba por los dos lados.
    const caso = CASOS_ORO.find(c => c.id === 'oro-negacion-cronicas')!
    const r = evaluarCaso(caso, { id: caso.id, campos: { negativos: `Paciente con ${caso.prohibidos![0]}` } })
    expect(r.correctos).toEqual([])
  })

  it('la equivalencia es laxa a propósito', () => {
    // «cefalea» y «cefalea tensional» no son dos hallazgos distintos para esto.
    expect(equivalente('cefalea', 'cefalea tensional')).toBe(true)
    expect(equivalente('diabetes', 'hipertensión')).toBe(false)
  })

  it('el arnés está declarado como lo que es: infraestructura del CI', () => {
    /**
     * ── LA PREMISA DE ESTA PRUEBA ESTABA MAL, Y LO DESTAPÓ LA v1019 ─────────
     *
     * Antes afirmaba que `evaluacion.ts` había SALIDO de la lista de huérfanos.
     * Y era verdad en la letra: no estaba en la lista. Pero lo único que lo
     * sacaba de ella era un `import type` desde `casos-oro.ts` — y TypeScript
     * BORRA los imports de tipo al compilar, así que ni una línea del arnés
     * llegaba al bundle.
     *
     * O sea que esta prueba certificaba «ya se usa» sobre un módulo del que no
     * se ejecutaba nada en producción. Un test que afirma de más es peor que
     * ninguno: aquí decía que el trabajo llegaba, y no llegaba.
     *
     * Lo cierto es que el arnés **sí se usa, y su sitio es el CI** —lo corren
     * este corpus y `ia-evaluacion`—, igual que los demás gates. Eso es lo que
     * se comprueba ahora: que esté declarado con esa razón, no escondido.
     */
    const orfanato = leer('src', '__tests__', 'modulos-sin-conectar.test.ts')
    expect(orfanato).toContain("'src/lib/ia/evaluacion.ts':")
    expect(orfanato).toMatch(/arnés de validación de la IA[\s\S]*sitio ES el CI/)
  })
})

describe('LO QUE ESTE CORPUS NO ES, dicho a tiempo', () => {
  it('el criterio cero está justificado por escrito', () => {
    expect(POR_QUE_EL_CRITERIO_ES_CERO).toMatch(/no hay ruido del mundo real/)
  })

  it('y NO se presenta como una medición de producción', () => {
    /**
     * Presentar un corpus sintético de tres casos como la tasa de alucinación
     * del producto sería inventar una cifra con otro nombre.
     */
    expect(POR_QUE_NO_ES_UNA_MEDICION_DE_PRODUCCION).toMatch(/lo produce el Dr/)
  })
})

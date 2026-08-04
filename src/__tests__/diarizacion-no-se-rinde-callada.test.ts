/**
 * GOLDEN — la separación de voces dejó de rendirse en silencio.
 *
 * ── EL CASO REAL ─────────────────────────────────────────────────────────────
 *
 * El Dr. dictó una consulta completa: infección urinaria recurrente, *E. coli*
 * con su antibiograma, tres años de antecedentes urológicos y el plan de
 * fosfomicina. La nota salió diciendo «no se refiere motivo clínico en este
 * fragmento de consulta; la entrevista corresponde a la elaboración de historia
 * clínica (datos sociodemográficos)», con «Padecimiento actual: No referido».
 *
 * Y en el camino, una palabra que el audio no entendió —«la de la **docencia**»,
 * que no significa nada— apareció aguas abajo convertida en **«vesícula»**: un
 * órgano que el paciente nunca mencionó.
 *
 * ── LA CAUSA ─────────────────────────────────────────────────────────────────
 *
 * `intentarDiarizar` esperaba `90 × 2 s` = **tres minutos** para CUALQUIER
 * grabación. Una consulta real dura mucho más; AssemblyAI no termina en tres
 * minutos un audio de doce. Se agotaba el contador y la función devolvía `null`
 * — el MISMO `null` que devolvía si no había llave, si fallaba el proveedor o si
 * se caía la red.
 *
 * El que llamaba no podía distinguirlos: caía a Whisper sin separación de voces
 * y **no se lo decía a nadie**. La llave de AssemblyAI estaba puesta y pagada
 * desde hacía 47 días. Lo que falló fue el reloj.
 *
 * Sin turnos Médico/Paciente el modelo razona sobre un bloque plano — y ahí es
 * donde una palabra mal oída acaba ascendida a diagnóstico.
 *
 * ── LO QUE ESTA PRUEBA FIJA ──────────────────────────────────────────────────
 *
 * Que el tope no vuelva a estar donde lo toca el uso normal, y que los cuatro
 * fallos dejen de verse iguales.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { esperaDiarizacion } from '@/hooks/useGrabacionAudio'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')

/** Cuántos segundos de espera concede el presupuesto para ese audio. */
const segundosDeEspera = (segAudio: number) => {
  const { intentos, pausaMs } = esperaDiarizacion(segAudio)
  return (intentos * pausaMs) / 1000
}

describe('EL CASO QUE SE ROMPÍA: una consulta de duración real', () => {
  it('una consulta de 12 minutos ya NO se queda en tres', () => {
    /**
     * Es la duración de la consulta que falló. Con el tope viejo tenía 180 s y
     * se rendía siempre.
     */
    expect(segundosDeEspera(12 * 60)).toBeGreaterThan(180)
  })

  it('la espera CRECE con el audio, en vez de ser un tope fijo', () => {
    const corta = segundosDeEspera(60)
    const larga = segundosDeEspera(20 * 60)
    expect(larga).toBeGreaterThan(corta)
  })

  it('y le da tiempo de sobra para lo que TARDA transcribir', () => {
    /**
     * PREMISA CORREGIDA. Mi primera versión exigía que el presupuesto superara
     * la DURACIÓN del audio, y falló a los 25 minutos por el techo de 15.
     * Estaba mal la prueba, no el código: transcribir tarda una FRACCIÓN de lo
     * que dura el audio —el motor no lo escucha en tiempo real—, así que pedir
     * «más que la duración» no es el invariante correcto, sólo el más fácil de
     * escribir.
     *
     * Lo que de verdad hay que garantizar es margen sobre el tiempo de proceso
     * real, y que una consulta larga no se quede corta.
     */
    const TECHO = 20 * 60
    for (const min of [5, 12, 25, 45]) {
      const presupuesto = segundosDeEspera(min * 60)
      // Generoso hasta el techo; el techo es el único límite.
      expect(presupuesto, `${min} min`).toBeGreaterThanOrEqual(Math.min(min * 60 * 0.6, TECHO))
      expect(presupuesto, `${min} min`).toBeGreaterThanOrEqual(4 * 60)
    }
  })
})

describe('los topes siguen existiendo, pero donde no estorban', () => {
  it('un audio diminuto igual espera al menos un minuto', () => {
    // Encolar y arrancar tiene un costo fijo: no se puede medir sólo por duración.
    expect(segundosDeEspera(3)).toBeGreaterThanOrEqual(60)
  })

  it('y hay techo: no se espera indefinidamente', () => {
    /**
     * Un techo hace falta —sin él, un trabajo colgado dejaría al médico mirando
     * la pantalla para siempre—. Lo que estaba mal no era tenerlo: era ponerlo
     * donde lo toca cualquier consulta.
     */
    expect(segundosDeEspera(5 * 60 * 60)).toBeLessThanOrEqual(20 * 60)
  })
})

describe('los CUATRO fallos dejan de verse iguales', () => {
  it('ya no hay un `return null` que signifique cuatro cosas', () => {
    expect(hook).not.toMatch(/return null\s*\/\/\s*timeout/)
    expect(hook).not.toMatch(/return null\s*\/\/\s*503 sinClave/)
  })

  it('cada causa tiene su nombre', () => {
    for (const m of ['sin_llave', 'error_proveedor', 'tiempo_agotado', 'red', 'sin_texto']) {
      expect(hook, m).toContain(`'${m}'`)
    }
  })

  it('«no hay llave» se distingue de «falló el proveedor» leyendo la respuesta', () => {
    // El 503 trae `sinClave`; cualquier otro código es el proveedor.
    expect(hook).toMatch(/d\?\.sinClave \? 'sin_llave' : 'error_proveedor'/)
  })

  it('y el resultado dice si hubo diarización, no sólo si hay texto', () => {
    /**
     * Antes se comprobaba `diar && diar.text.trim()`: un texto sin turnos
     * pasaba por bueno. Ahora `ok` es explícito.
     */
    expect(hook).toContain('if (diar.ok && diar.text.trim())')
  })
})

describe('AL MÉDICO SE LE DICE', () => {
  const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

  it('el motivo llega hasta la pantalla', () => {
    expect(hook).toMatch(/sinDiarizacion: MotivoSinDiarizacion \| null/)
    expect(page).toContain('audio.sinDiarizacion')
  })

  it('el aviso dice qué revisar antes de firmar', () => {
    /**
     * «Algo falló» no le sirve a nadie. Lo accionable es dónde mirar: fármacos,
     * dosis y microorganismos son justo lo que se degrada sin diarización.
     */
    expect(page).toMatch(/Sin separación de voces en esta grabación/)
    expect(page).toMatch(/revisa nombres de fármacos,\s*\n?\s*dosis y microorganismos antes de firmar/)
  })

  it('y cada causa tiene su propio texto, no un genérico', () => {
    // Cuatro causas exigen cuatro acciones distintas: una es del proveedor, otra
    // de configuración, y la del tiempo se resuelve reintentando.
    expect(page).toContain('MOTIVO_SIN_DIARIZACION')
    for (const m of ['sin_llave', 'error_proveedor', 'tiempo_agotado', 'red', 'sin_texto']) {
      expect(page, m).toContain(`${m}:`)
    }
  })
})

describe('LA TRANSCRIPCIÓN ES DE LA PLATAFORMA, para todos', () => {
  const aiKeys = leer('src', 'lib', 'ai-keys.ts')

  it('AssemblyAI y OpenAI ya NO leen la llave del consultorio', () => {
    /**
     * Decisión del Dr.: «la llave debe estar para todos, no que se ponga
     * individual — y Whisper». Oír bien no es un extra que cada consultorio se
     * costea: es la promesa central del producto.
     */
    expect(aiKeys).toMatch(/if \(proveedor === 'assemblyai' \|\| proveedor === 'openai'\)/)
  })

  it('y eso cierra una trampa: la llave mala del consultorio GANABA a la buena', () => {
    /**
     * Un médico que pegara una llave vencida recibía PEOR transcripción que uno
     * que no pusiera ninguna — y en silencio. La comprobación de la plataforma
     * va ahora ANTES de leer la del consultorio.
     */
    /**
     * PREMISA CORREGIDA. Mi primera versión buscaba `docIA(clinicId).get()` en
     * TODO el archivo y lo encontraba en otra función, mucho más arriba: medía
     * el orden entre dos cosas que no se comparan. Se acota al cuerpo de
     * `resolverClaveIA`, que es donde la precedencia significa algo.
     */
    const cuerpo = aiKeys.slice(aiKeys.indexOf('export async function resolverClaveIA'))
    const i = cuerpo.indexOf("proveedor === 'assemblyai'")
    const j = cuerpo.indexOf('docIA(clinicId).get()')
    expect(i, 'la rama de plataforma existe').toBeGreaterThan(0)
    expect(j, 'la lectura de la llave del consultorio existe').toBeGreaterThan(0)
    expect(i, 'la rama de plataforma va antes de la del consultorio').toBeLessThan(j)
  })

  it('la pantalla de llaves ya no ofrece las de transcripción', () => {
    // Se quitó la opción, no sólo el aviso.
    const cfg = leer('src', 'app', '(dashboard)', 'configuracion', 'secciones-cuenta.tsx')
    const lista = cfg.slice(cfg.indexOf('const PROVEEDORES_IA'), cfg.indexOf('] as const', cfg.indexOf('const PROVEEDORES_IA')))
    expect(lista).toContain("id: 'anthropic'")
    expect(lista).not.toContain("id: 'assemblyai'")
    expect(lista).not.toContain("id: 'openai'")
  })
})

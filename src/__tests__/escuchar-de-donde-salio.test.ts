/**
 * ESCUCHAR DE DÓNDE SALIÓ — REG-250.
 *
 * ── LA CADENA, CERRADA ──────────────────────────────────────────────────────
 *
 * El médico pidió textualmente: «hacer clic en cualquier frase de la nota →
 * escuchar exactamente el audio que la originó». Es lo que Abridge llama
 * *Linked Evidence*, y lo que **Nabla estructuralmente no puede tener** porque
 * borra el audio original (AP, oct-2024).
 *
 *     frase de la nota → trozo del dictado → SEGUNDO EXACTO → audio
 *
 * Los dos primeros pasos ya existían (`trazabilidad.ts`). El audio se guarda
 * desde REG-249. Faltaba el puente del medio: los segmentos llevan posición en
 * CARACTERES y el audio se busca por TIEMPO.
 *
 * ── POR QUÉ NO SE HACE CON UNA REGLA DE TRES ────────────────────────────────
 *
 * Repartir la duración total entre los caracteres del dictado y multiplicar
 * falla justo donde importa: la gente se calla, tose, repite, y el paciente
 * habla a otra velocidad que el médico. Tres segundos de desfase dejan al médico
 * oyendo la frase equivocada — y **una prueba en el segundo equivocado es peor
 * que ninguna prueba**, porque tiene aspecto de prueba.
 *
 * Se busca la frase EN LAS PALABRAS QUE EL MOTOR OYÓ y se devuelve el `inicioMs`
 * de la que de verdad la empieza.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  cuandoSeDijo, lineaDeTiempo, comoReloj,
  POR_QUE_NO_UNA_REGLA_DE_TRES, POR_QUE_NULL_ES_UNA_RESPUESTA, POR_QUE_TRES_PALABRAS,
} from '@/lib/expediente/cuando-se-dijo'

const pal = (texto: string, inicioMs: number) => ({ texto, inicioMs, confianza: 1 })

const CONSULTA = [
  {
    speaker: 'A', text: 'Buenos días, ¿qué le trae por aquí?',
    palabras: [pal('Buenos', 1000), pal('días', 1400), pal('qué', 1800), pal('le', 2000),
      pal('trae', 2200), pal('por', 2500), pal('aquí', 2700)],
  },
  {
    speaker: 'B', text: 'Me duele el pecho desde hace tres días',
    palabras: [pal('Me', 4000), pal('duele', 4200), pal('el', 4600), pal('pecho', 4800),
      pal('desde', 5200), pal('hace', 5500), pal('tres', 5800), pal('días', 6100)],
  },
  {
    speaker: 'A', text: 'Le voy a dar moxifloxacino cuatrocientos miligramos',
    palabras: [pal('Le', 123000), pal('voy', 123200), pal('a', 123400), pal('dar', 123600),
      pal('moxifloxacino', 124000), pal('cuatrocientos', 124800), pal('miligramos', 125400)],
  },
] as never

describe('localiza la frase en el audio', () => {
  it('encuentra el momento y QUIÉN lo dijo', () => {
    const m = cuandoSeDijo('Me duele el pecho', CONSULTA)!
    expect(m.inicioMs).toBe(4000)
    expect(m.speaker).toBe('B')
    expect(m.palabrasQueCasaron).toBe(4)
  })

  it('lo del médico sale con el hablante del médico, dos minutos después', () => {
    /**
     * Éste es el caso que hace útil el botón: la prescripción se dicta al final
     * de la consulta, y sin el salto habría que oírla entera.
     */
    const m = cuandoSeDijo('dar moxifloxacino cuatrocientos', CONSULTA)!
    expect(m.inicioMs).toBe(123600)
    expect(m.speaker).toBe('A')
    expect(comoReloj(m.inicioMs)).toBe('2:03')
  })

  it('los acentos y la puntuación no lo despistan', () => {
    /** El corrector léxico reescribe el dictado; la nota la escribe un modelo. */
    const m = cuandoSeDijo('me duele el pecho, desde hace tres dias.', CONSULTA)!
    expect(m.inicioMs).toBe(4000)
    expect(m.palabrasQueCasaron).toBe(8)
  })

  it('prefiere la coincidencia MÁS LARGA', () => {
    const dos = [
      { speaker: 'A', text: 'le doy paracetamol', palabras: [pal('le', 100), pal('doy', 200), pal('paracetamol', 300)] },
      { speaker: 'A', text: 'le doy paracetamol quinientos miligramos', palabras: [pal('le', 9000), pal('doy', 9100), pal('paracetamol', 9200), pal('quinientos', 9400), pal('miligramos', 9700)] },
    ] as never
    expect(cuandoSeDijo('le doy paracetamol quinientos miligramos', dos)!.inicioMs).toBe(9000)
  })
})

describe('NUNCA aproxima — y ésta es la parte importante', () => {
  it('una frase que no está devuelve null, no «lo más parecido»', () => {
    expect(cuandoSeDijo('el paciente refiere fiebre de cuarenta grados', CONSULTA)).toBeNull()
  })

  it('«Sí» o «Correcto» no bastan para localizar nada', () => {
    /**
     * Esa palabra aparece diez veces en una consulta y cualquiera de las diez
     * parecería igual de buena. Sin material, no hay botón.
     */
    expect(cuandoSeDijo('Sí', CONSULTA)).toBeNull()
    expect(cuandoSeDijo('correcto', CONSULTA)).toBeNull()
    expect(POR_QUE_TRES_PALABRAS).toMatch(/diez veces/)
  })

  it('sin tiempos por palabra no se inventa el segundo cero', () => {
    /**
     * Un turno viejo, recuperado de un borrador anterior a que se guardaran los
     * tiempos, no tiene momento. Rellenarlo con cero pondría toda esa consulta
     * al principio del audio — y sonaría plausible.
     */
    const viejo = [{ speaker: 'A', text: 'Me duele el pecho' }] as never
    expect(cuandoSeDijo('Me duele el pecho', viejo)).toBeNull()
    expect(lineaDeTiempo(viejo)).toEqual([])
  })

  it('sin turnos, null', () => {
    expect(cuandoSeDijo('lo que sea', undefined)).toBeNull()
    expect(cuandoSeDijo('', CONSULTA)).toBeNull()
  })

  it('y queda escrito por qué no vale una regla de tres', () => {
    expect(POR_QUE_NO_UNA_REGLA_DE_TRES).toMatch(/frase equivocada/)
    expect(POR_QUE_NULL_ES_UNA_RESPUESTA).toMatch(/prueba falsa es peor que ninguna/)
  })
})

describe('el reloj se lee sin pensar', () => {
  it.each([[0, '0:00'], [4000, '0:04'], [124000, '2:04'], [3661000, '1:01:01']])(
    '%i ms → %s', (ms, txt) => expect(comoReloj(ms as number)).toBe(txt))

  it('pasada la hora NO dice «61:01»', () => {
    /** Un pase de visita de UCI dura más de una hora. */
    expect(comoReloj(3661000)).not.toBe('61:01')
  })
})

describe('el reproductor no hace daño', () => {
  const comp = readFileSync(join(process.cwd(), 'src/components/EscucharElMomento.tsx'), 'utf8')

  it('la URL se pide AL PULSAR, no al pintar', () => {
    /**
     * Ahí es cuando las reglas de Storage se evalúan otra vez, con quien esté
     * mirando. Si el permiso cambió, deja de sonar — que es lo correcto.
     */
    expect(comp).toMatch(/await p\.resolverUrl\(p\.audioPath\)/)
    expect(comp.replace(/\s+/g, ' ')).toMatch(/reglas de Storage se evalúan \*\*otra vez\*\*/)
  })

  it('hay UN solo elemento de audio para toda la página', () => {
    /** Decenas de <audio> al mismo archivo son decenas de descargas. */
    expect(comp).toMatch(/let compartido: HTMLAudioElement \| null = null/)
  })

  it('se para al desmontar', () => {
    /**
     * Dejar sonando el audio de un paciente después de cerrar su nota es
     * exactamente lo que no puede pasar.
     */
    expect(comp).toMatch(/useEffect\(\(\) => \(\) => \{ compartido\?\.pause\(\) \}, \[\]\)/)
  })

  it('sin ruta no hay botón apagado: no hay botón', () => {
    expect(comp).toMatch(/if \(!p\.audioPath\) return null/)
  })
})

describe('está CONECTADO', () => {
  const panel = readFileSync(join(process.cwd(), 'src/components/DeDondeSalioEsto.tsx'), 'utf8')
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('el panel usa el motor y el botón', () => {
    expect(panel).toContain("from '@/lib/expediente/cuando-se-dijo'")
    expect(panel).toContain('<EscucharElMomento')
  })

  it('si el motor no localiza la frase, no sale botón', () => {
    expect(panel).toMatch(/return m \? \(/)
    expect(panel).toMatch(/\) : null/)
  })

  it('la consulta le pasa los turnos, la ruta y el resolvedor', () => {
    expect(page).toMatch(/utterances=\{audio\.utterances\}/)
    expect(page).toMatch(/audioPath=\{audio\.audioPath\}/)
    expect(page).toMatch(/getDownloadURL\(ref\(getStorage\(\), path\)\)/)
  })

  it('firebase/storage se carga sólo si se pulsa', () => {
    /** No se paga la descarga en las consultas que nunca escuchan nada. */
    expect(page).toMatch(/await import\('firebase\/storage'\)/)
  })
})

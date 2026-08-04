/**
 * GOLDEN — el «original» que se archivaba no era el original, y el documento de
 * la nota se estaba llenando de confianzas por palabra.
 *
 * Son los dos P0 de la auditoría VOICE-001, y los dos viven en la misma línea
 * de `construirNota`.
 *
 * ── B-1 · `transcripcionCruda` no era cruda ─────────────────────────────────
 *
 * El campo que la pantalla de la nota enseña como «transcripción original» se
 * llenaba con `voz.transcripcion`: el texto que ya pasó por las CUATRO etapas
 * del pipeline —normalización, siglas, corrector vigilado, unidades— y que
 * además **el médico puede editar a mano** antes de firmar.
 *
 * El crudo de verdad existía: `ResultadoPipeline.crudo`. Se producía y se
 * descartaba en la misma línea en que se aplicaba el resultado. O sea que ante
 * una discusión medicolegal —«yo no dije eso»— lo archivado como material de
 * origen ya había sido reescrito tres veces por máquinas y una por una persona.
 *
 * Es el principio nº 1 del charter roto en el sitio que más importa: *el audio
 * no es la nota, y una capa no sobrescribe a la otra*.
 *
 * ── B-2 · miles de objetos por consulta dentro del documento ────────────────
 *
 * `dialogoDiarizado` se llenaba con `audio.utterances` **enteros**. Un turno de
 * AssemblyAI trae `palabras: {texto,inicioMs,confianza}[]`; una consulta de 20
 * minutos son varios miles de esos objetos. El tipo declarado siempre fue
 * `{speaker, text}[]` — el exceso no estaba ni tipado.
 *
 * Y este repositorio ya sabe lo que pasa cuando un documento se acerca al 1 MB
 * de Firestore: no falla el campo grande, falla **todo guardado posterior**.
 * Está en la bitácora dos veces (config de receta con base64).
 *
 * ── LO QUE SÍ HAY QUE CONSERVAR ─────────────────────────────────────────────
 *
 * De las confianzas por palabra, lo único que un revisor necesita es la lista
 * corta: qué dudó el audio y en qué minuto. Eso es `paraElMedico`, que ya
 * existía y ya se pintaba en pantalla — pero se perdía al guardar.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CAMPOS_SELLADOS_V3, CAMPOS_NO_SELLADOS_V3,
} from '@/lib/expediente/integrity'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const page = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')
const hook = leer('src', 'hooks', 'useGrabacionAudio.ts')
const tipos = leer('src', 'types', 'expediente.ts')

describe('B-1 · EL MATERIAL DE ORIGEN SE GUARDA', () => {
  it('el hook conserva el crudo del pipeline en vez de tirarlo', () => {
    expect(hook).toContain("const [transcripcionMotor, setTranscripcionMotor] = useState('')")
    expect(hook).toContain('setTranscripcionMotor(r.crudo)')
  })

  it('y también al RECUPERAR un audio, no sólo al transcribir', () => {
    /**
     * La recuperación desde IndexedDB es el camino de la consulta que se cayó
     * —justo la que más falta hace defender—. Dejarla sin origen habría hecho
     * que la defensa existiera sólo cuando todo va bien.
     */
    const veces = hook.split('setTranscripcionMotor(r.crudo)').length - 1
    expect(veces).toBe(2)
  })

  it('se limpia al empezar una grabación nueva', () => {
    // Arrastrar el origen de la consulta anterior sería peor que no tenerlo:
    // sería material de origen del paciente equivocado.
    expect(hook).toContain("setTranscripcionMotor('')")
  })

  it('la nota lo escribe, y NO lo confunde con el texto de trabajo', () => {
    expect(page).toContain('transcripcionMotor: audio.transcripcionMotor || undefined')
    // El campo de siempre sigue siendo el texto de trabajo: hay lectores que
    // dependen de él (restauración de borradores, historial de versiones).
    expect(page).toContain('transcripcionCruda:')
  })

  it('el tipo dice cuál es cuál, sin eufemismos', () => {
    expect(tipos).toMatch(/\*\*No es el\n\s+\* material de origen\*\*/)
    expect(tipos).toMatch(/ANTES del pipeline y antes de cualquier edición/)
  })
})

describe('B-2 · EL DOCUMENTO DEJA DE ENGORDAR', () => {
  it('se guardan los turnos, no las palabras', () => {
    expect(page).toContain('audio.utterances.map(u => ({ speaker: u.speaker, text: u.text }))')
  })

  it('sin turnos no se escribe un array vacío', () => {
    // `undefined` no viaja a Firestore; `[]` sí, y encima se lee como «hubo
    // diarización y no dijo nada», que es distinto de «no hubo».
    expect(page).toMatch(/dialogoDiarizado: audio\.utterances\.length > 0/)
    expect(page).toMatch(/: undefined,/)
  })

  it('lo que sí sobrevive es la lista corta de dudas', () => {
    expect(page).toContain('palabrasAVerificar: palabrasAVerificar.palabras.length > 0')
  })

  it('y es la MISMA lista que ya se enseña en pantalla', () => {
    /**
     * Si se recalculara con otro criterio, el médico vería una lista al firmar
     * y el expediente guardaría otra. Una corrección silenciosa se ve igual
     * que un acierto.
     */
    expect(page).toContain('const palabrasAVerificar = useMemo(() => paraElMedico(audio.utterances)')
  })

  it('el tipo declara que la ausencia de `palabras` es deliberada', () => {
    expect(tipos).toMatch(/\*\*Sin `palabras`\*\*, y no es un olvido/)
    expect(tipos).toMatch(/bloquear todo guardado posterior/)
  })
})

describe('EL SELLO: cada campo nuevo, clasificado y con su razón', () => {
  const excluido = (c: string) => CAMPOS_NO_SELLADOS_V3.find(x => x.campo === c)

  it('ninguno de los dos queda sin clasificar', () => {
    for (const campo of ['transcripcionMotor', 'palabrasAVerificar']) {
      const dentro = CAMPOS_SELLADOS_V3.includes(campo)
      expect(dentro || !!excluido(campo), campo).toBe(true)
    }
  })

  it('el material de origen queda FUERA del sello v3, y dice por qué', () => {
    /**
     * Le corresponde ir sellado. Pero añadirlo al canónico v3 cambiaría el
     * hash de todas las notas ya firmadas y las marcaría «alterada» de golpe:
     * la falsa alarma de REG-060, que este repositorio ya pagó una vez.
     *
     * Entra al sello cuando se suba a hashVersion 4 — su propia versión, con su
     * propia migración. Dicho aquí en vez de silenciado.
     */
    const r = excluido('transcripcionMotor')
    expect(r).toBeTruthy()
    expect(r!.razon).toMatch(/hashVersion 4/)
    expect(r!.razon).toMatch(/REG-060/)
  })

  it('la lista de dudas queda fuera porque es derivada y su umbral no está calibrado', () => {
    const r = excluido('palabrasAVerificar')
    expect(r).toBeTruthy()
    expect(r!.razon).toMatch(/DERIVADO/)
    expect(r!.razon).toMatch(/UMBRAL_DUDA/)
  })
})

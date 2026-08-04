/**
 * GOLDEN — la nota de UCI dejó de nacer huérfana.
 *
 * ── EL HALLAZGO ──────────────────────────────────────────────────────────────
 *
 * El panel de UCI pasa a la nota por una semilla en `sessionStorage`, y esa
 * semilla llevaba **sólo las secciones**. El dictado se quedaba atrás.
 *
 * Consecuencia, y no es una: casi todas las defensas de la nota exigen que
 * exista `voz.transcripcion`, así que **se apagaban todas a la vez**:
 *
 * · `fuenteGeneracion` salía `'manual'` en una nota **dictada**.
 * · `transcripcionCruda` y `dialogoDiarizado` quedaban `undefined`.
 * · El motor de negaciones no corría (exige el dictado).
 * · Las palabras a verificar no aparecían.
 * · La compuerta de evidencia (v987) no tenía contra qué comprobar.
 * · La segunda opinión recibía una transcripción vacía: no podía contrastar.
 * · El manifiesto de procedencia sellaba sobre la nada.
 *
 * O sea: **el camino que más nota firmada produce en UCI era el que menos
 * protección tenía.** Y no por una decisión — porque el dictado no viajaba.
 *
 * ── POR QUÉ UN SOLO CAMBIO LO ARREGLA TODO ───────────────────────────────────
 *
 * No hubo que tocar ninguna de esas defensas. Todas estaban bien escritas y
 * todas dependían del mismo dato ausente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const uci = leer('src', 'app', '(dashboard)', 'uci', 'page.tsx')
const consulta = leer('src', 'app', '(dashboard)', 'consulta', '[patientId]', 'page.tsx')

describe('LA SEMILLA LLEVA EL DICTADO', () => {
  it('el panel manda secciones, dictado y turnos', () => {
    expect(uci).toContain('const semilla = {')
    expect(uci).toMatch(/dictado: paseTexto\.trim\(\) \|\| audio\.transcripcion\.trim\(\)/)
    expect(uci).toMatch(/utterances: audio\.utterances/)
  })

  it('el dictado sale del cuadro editable Y del audio', () => {
    /**
     * El médico puede dictar, o escribir/pegar el pase en el cuadro. Los dos
     * caminos producen nota; llevarse sólo uno dejaría al otro sin defensas,
     * que es el mismo defecto a medias.
     */
    expect(uci).toContain('paseTexto.trim() || audio.transcripcion.trim()')
  })
})

describe('LA CONSULTA LO RECIBE Y LO CONECTA', () => {
  it('carga el dictado en la transcripción de voz', () => {
    // Es la línea de la que cuelgan todas las defensas.
    expect(consulta).toContain('if (dictado) voz.setTranscripcion(dictado)')
  })

  it('y acepta la forma VIEJA de la semilla sin romperse', () => {
    /**
     * Puede quedar una semilla escrita por la pestaña anterior. Romperla
     * perdería el pase que el médico acaba de dictar — exactamente lo que este
     * cambio viene a evitar.
     */
    expect(consulta).toMatch(/Array\.isArray\(parsed\) \? parsed : parsed\?\.secciones/)
  })

  it('el aviso distingue si vino con dictado o sin él', () => {
    // Si el médico ve el mismo mensaje en los dos casos, no puede saber que en
    // uno la nota va protegida y en el otro no.
    expect(consulta).toMatch(/Pase de UCI cargado en la nota, con su dictado/)
  })
})

describe('LO QUE SE RECUPERA, y por qué no hubo que tocarlo', () => {
  it('`fuenteGeneracion` mira la transcripción', () => {
    // Con el dictado presente, una nota dictada deja de firmarse como «manual».
    expect(consulta).toMatch(/fuenteGeneracion: voz\.transcripcion \? 'ia_voz' : 'manual'/)
  })

  it('el motor de negaciones exige el dictado — y ahora lo tiene', () => {
    expect(consulta).toMatch(/const dictado = voz\.transcripcion/)
  })

  it('la compuerta de evidencia también', () => {
    expect(consulta).toContain('transcripcion: voz.transcripcion,')
  })

  it('y la transcripción cruda se persiste con la nota', () => {
    expect(consulta).toMatch(/transcripcionCruda: voz\.transcripcion/)
  })
})

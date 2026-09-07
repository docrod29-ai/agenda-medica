/**
 * LA MARCA SALE DEL TEXTO Y SE QUEDA EN LA PROCEDENCIA — 7-sep-2026.
 *
 * ── LO QUE FALLABA ──────────────────────────────────────────────────────────
 *
 * «Y luego me pones que la inteligencia artificial no escuchó esto y lo
 * inventó. Pues no le pongas, tú pon lo mejor. Esos cachos no quiero que los
 * vea el médico […] no quiero que batalle.»
 *
 * `[IA — no dictado]` iba **dentro del texto de la nota**, prefijando cada
 * renglón que la IA había redactado. De ahí colgaba un cartel antes de firmar
 * con dos botones —«Las acepto» / «Quitarlas»—, y la firma quedaba bloqueada
 * hasta contestarlo.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * Se confundió el AVISO con su SITIO. La regla 3 de seguridad clínica pide que
 * toda redacción automática sea visible y reversible; nunca pidió que el aviso
 * viviera incrustado en el párrafo. Ponerlo ahí convirtió cada nota en una
 * pregunta obligatoria cuya respuesta era siempre la misma — y cuyo error
 * costaba el plan entero de una nota real (REG-195).
 *
 * ── LA REGLA QUE ESTO HACE SEGURO ───────────────────────────────────────────
 *
 * La marca no desaparece: **cambia de sitio**. El texto sale limpio y las
 * mismas líneas viajan en `_redactadoPorIA`, que es procedencia. Sigue
 * constando qué redactó la IA y qué salió del dictado; lo que se pierde es la
 * fricción.
 *
 * Y el despegue corre en el SERVIDOR, no en la pantalla: esta respuesta la leen
 * también el expediente, el PDF y el paquete del paciente.
 *
 * ── LO QUE ESTA PRUEBA NO CUBRE ─────────────────────────────────────────────
 *
 * · Que el modelo siga marcando bien lo que redacta. Eso lo fija
 *   `los-huecos-se-proponen-marcados.test.ts`, y sigue vigente: el prompt no
 *   cambia, sólo cambia quién se queda con la marca.
 * · Que la línea «no dictaste X» se lea bien en pantalla. No se aprueba una
 *   interfaz leyendo código.
 * · Que la procedencia se persista con la nota firmada: hoy viaja en la
 *   respuesta y se enseña; guardarla en el documento es trabajo con nombre.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  despegarMarcas, apartadosQueFaltaron, MARCA_SUGERENCIA, sugerenciasPendientes,
} from '@/lib/expediente/sugerencias-ia'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const ruta = leer('src/app/api/expediente/procesar/route.ts')
const page = leer('src/app/(dashboard)/consulta/[patientId]/page.tsx')

/** Lo que el modelo devuelve hoy: el plan dictado, más lo que él completó. */
const DEL_MODELO = {
  motivoConsulta: 'Odinofagia de tres días.',
  planTratamiento:
    `Amoxicilina 500 mg VO.\n`
    + `${MARCA_SUGERENCIA} Intervalo cada 8 h por 7 días.\n`
    + `${MARCA_SUGERENCIA} Signos de alarma: disnea, incapacidad para deglutir.`,
}

describe('el médico lee una nota limpia', () => {
  const d = despegarMarcas(DEL_MODELO)

  it('ni un solo apartado conserva la marca', () => {
    expect(JSON.stringify(d.secciones)).not.toContain(MARCA_SUGERENCIA)
  })

  it('el contenido NO se borra: se queda entero, sólo pierde el prefijo', () => {
    expect(String(d.secciones.planTratamiento)).toContain('Intervalo cada 8 h por 7 días.')
    expect(String(d.secciones.planTratamiento)).toContain('Amoxicilina 500 mg VO.')
  })

  it('lo que el médico sí dictó no se toca', () => {
    expect(d.secciones.motivoConsulta).toBe('Odinofagia de tres días.')
  })
})

describe('y la procedencia no se pierde: cambia de sitio', () => {
  const d = despegarMarcas(DEL_MODELO)

  it('las dos líneas que redactó la IA siguen constando, con su apartado', () => {
    expect(d.redactadoPorIA).toHaveLength(2)
    expect(d.redactadoPorIA[0]).toEqual({ seccion: 'planTratamiento', linea: 'Intervalo cada 8 h por 7 días.' })
  })

  it('«qué faltó» se contesta con los apartados, sin repetir', () => {
    expect(apartadosQueFaltaron(d.redactadoPorIA)).toEqual(['planTratamiento'])
  })

  it('una nota dictada entera no genera ruido: la lista queda vacía', () => {
    const todo = despegarMarcas({ planTratamiento: 'Amoxicilina 500 mg cada 8 h por 7 días.' })
    expect(todo.redactadoPorIA).toEqual([])
  })
})

describe('el cartel de firma se apaga solo, y sigue de red', () => {
  /**
   * Ésta es la prueba al revés: el cartel NO se borró de la pantalla. Se apaga
   * porque ya no hay marcas que contar. Si un día una ruta dejara de despegar,
   * el contador vuelve a subir y la marca no se imprime.
   */
  it('tras el despegue no queda nada pendiente que contestar', () => {
    const d = despegarMarcas(DEL_MODELO)
    const secciones = Object.entries(d.secciones).map(([key, value]) => ({ key, value: String(value) }))
    expect(sugerenciasPendientes(secciones)).toBe(0)
  })

  it('la red sigue puesta en la pantalla', () => {
    expect(page).toContain('sugerenciasPendientes(secciones) > 0')
  })
})

describe('el dato tiene que LLEGAR', () => {
  it('el despegue corre en el servidor, en los DOS caminos de respuesta', () => {
    expect(ruta).toContain('despegarMarcas')
    // El de esquema completo y el parcial: una nota de un día malo también se firma.
    expect(ruta.match(/despegarMarcas\(/g) ?? []).toHaveLength(2)
    expect(ruta).toContain('_redactadoPorIA')
  })

  it('la pantalla recoge la procedencia y dice qué faltó, sin botones que contestar', () => {
    expect(page).toContain('data._redactadoPorIA')
    expect(page).toContain('No dictaste')
  })
})

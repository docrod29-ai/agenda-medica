/**
 * LA ORDEN NO SE QUEDA EN EL TINTERO — REG-244.
 *
 * ── EL DEFECTO ──────────────────────────────────────────────────────────────
 *
 * Al firmar, la consulta elegía UN destino:
 *
 *     con medicamentos               → la receta
 *     sin medicamentos, con estudios → la orden
 *     ninguno                        → el expediente
 *
 * Con medicamentos **y** estudios —media consulta de medicina interna— iba a la
 * receta y **la orden no se imprimía nunca**. El paciente salía con su receta y
 * sin su solicitud de estudios, y **todo se veía correcto**: nota firmada, cita
 * marcada como atendida, ningún aviso.
 *
 * Lo más incómodo: el comentario del código ya avisaba de la mitad del problema
 * —«antes solo ramificaba a receta y la orden se quedaba en el tintero»— y lo
 * arregló para el caso «sin medicamentos». El caso «con los dos» siguió igual.
 *
 * ── POR QUÉ NO SE ARREGLA CON OTRO `if` ─────────────────────────────────────
 *
 * Porque el problema no es a cuál de los dos ir: **es que son dos**. Cualquier
 * regla que elija uno deja el otro sin hacer.
 *
 * ── LO QUE NO CAMBIA ────────────────────────────────────────────────────────
 *
 * Con un solo destino se sigue yendo directo. Ese caso nunca estuvo roto, y
 * meterle una pantalla de por medio sería añadir un clic a la consulta más
 * común para arreglar un problema que esa consulta no tiene.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  queFaltaParaCerrar, aDondeIrDirecto,
  EL_CASO_QUE_SE_PERDIA, POR_QUE_NO_OTRO_IF, POR_QUE_EL_CASO_SIMPLE_NO_CAMBIA,
} from '@/lib/expediente/que-falta-para-cerrar'

const BASE = { patientId: 'p1', notaId: 'n1' }

describe('EL CASO QUE SE PERDÍA: medicamentos Y estudios', () => {
  it('no se elige un destino — se enseñan los dos', () => {
    expect(aDondeIrDirecto({ ...BASE, hayMedicamentos: true, hayEstudios: true })).toBeNull()
  })

  it('la orden aparece en la lista, con lo que pasa si no se hace', () => {
    const pasos = queFaltaParaCerrar({ ...BASE, hayMedicamentos: true, hayEstudios: true })
    const orden = pasos.find(p => p.que === 'orden')!
    expect(orden.ruta).toBe('/orden/p1/n1')
    expect(orden.siNoSeHace).toMatch(/laboratorio no le va a tomar la muestra/)
  })

  it('la receta va antes que la orden', () => {
    /** Es lo que el paciente espera con la mano extendida. */
    const claves = queFaltaParaCerrar({ ...BASE, hayMedicamentos: true, hayEstudios: true })
      .map(p => p.que)
    expect(claves.indexOf('receta')).toBeLessThan(claves.indexOf('orden'))
  })

  it('y queda escrito el caso exacto que se perdía', () => {
    expect(EL_CASO_QUE_SE_PERDIA).toMatch(/sin imprimir/)
    expect(POR_QUE_NO_OTRO_IF).toMatch(/es que son dos/)
  })
})

describe('el caso simple NO cambia', () => {
  it('sólo medicamentos → directo a la receta, como siempre', () => {
    expect(aDondeIrDirecto({ ...BASE, hayMedicamentos: true })).toBe('/receta/p1/n1')
  })

  it('sólo estudios → directo a la orden', () => {
    expect(aDondeIrDirecto({ ...BASE, hayEstudios: true })).toBe('/orden/p1/n1')
  })

  it('nada que entregar → al expediente', () => {
    expect(aDondeIrDirecto(BASE)).toBe('/expediente/p1')
  })

  it('internado → al episodio, y eso no admite alternativa', () => {
    expect(aDondeIrDirecto({ ...BASE, hayMedicamentos: true, hayEstudios: true, internamientoActivo: 'i9' }))
      .toBe('/hospitalizacion/i9')
  })

  it('y queda escrito por qué el caso simple no se toca', () => {
    expect(POR_QUE_EL_CASO_SIMPLE_NO_CAMBIA).toMatch(/un clic a la consulta más común/)
  })
})

describe('el cobro cuenta como un destino más', () => {
  it('con cobro y receta ya son dos: se enseña la pantalla', () => {
    expect(aDondeIrDirecto({ ...BASE, hayMedicamentos: true, pideCobro: true })).toBeNull()
  })

  /**
   * ── ESTA ASERCIÓN SE CAMBIÓ, Y POR QUÉ (Panel de Lujo ZC-007) ─────────────
   *
   * Decía `expect(cobro.ruta).toBeNull()` bajo el título «el cobro se resuelve
   * sin salir de aquí», y esa frase describía una intención que el producto no
   * cumplía. `ruta: null` hace que `ComoCerrarLaConsulta` pinte el paso como un
   * **botón deshabilitado y sin explicación**, y el único disparador del modal
   * de cobro corre una sola vez al firmar: si el médico cerró ese modal, ya no
   * había forma de volver a él desde la consulta. No se resolvía «sin salir de
   * aquí»: no se resolvía.
   *
   * Se descubrió en la auditoría del Panel de Lujo (6-sep-2026, ZC-007),
   * mirando qué PASA al pulsar cada paso del cierre en vez de qué declara.
   *
   * Lo que se comprueba ahora es lo que de verdad hace falta: que el paso lleve
   * a alguna parte, y que esa parte sea la vía que el propio comentario de la
   * pantalla de consulta ya declaraba como normal — la asistente cobra desde la
   * ficha de la cita, en Citas.
   *
   * Lo que NO se hizo, a propósito: abrir un segundo disparador del modal de
   * cobro dentro de la consulta. Serían dos sitios donde se registra un cobro, y
   * el corte de caja acabaría con dos fuentes de verdad.
   */
  it('el paso del cobro lleva a donde se cobra, y no es un botón muerto', () => {
    const cobro = queFaltaParaCerrar({ ...BASE, hayMedicamentos: true, pideCobro: true })
      .find(p => p.que === 'cobro')!
    expect(cobro.ruta).toBe('/citas')
    expect(cobro.titulo).toMatch(/en la cita/)
    expect(cobro.siNoSeHace).toMatch(/corte del día/)
  })
})

describe('la hoja del paciente entra en el cierre', () => {
  it('aparece cuando hay algo que entregarle', () => {
    const claves = queFaltaParaCerrar({ ...BASE, hayMedicamentos: true }).map(p => p.que)
    expect(claves).toContain('hoja_del_paciente')
  })

  it('NO cuenta para decidir si se navega directo', () => {
    /**
     * Vive en la propia consulta: no es un destino, es algo que ya está en
     * pantalla. Contarla obligaría a enseñar el panel siempre.
     */
    expect(aDondeIrDirecto({ ...BASE, hayMedicamentos: true })).toBe('/receta/p1/n1')
  })

  it('sin nada que entregar, no aparece', () => {
    expect(queFaltaParaCerrar(BASE).map(p => p.que)).toEqual(['expediente'])
  })
})

describe('sin nota guardada no se ofrece imprimir nada', () => {
  it('sin notaId no hay ruta de receta ni de orden', () => {
    /** Una ruta a `/receta/p1/null` es un 404 con forma de botón. */
    const claves = queFaltaParaCerrar({ patientId: 'p1', notaId: null, hayMedicamentos: true, hayEstudios: true })
      .map(p => p.que)
    expect(claves).not.toContain('receta')
    expect(claves).not.toContain('orden')
  })
})

describe('está CONECTADO', () => {
  const page = readFileSync(
    join(process.cwd(), 'src/app/(dashboard)/consulta/[patientId]/page.tsx'), 'utf8')

  it('firmar usa el motor en vez de la cadena de ifs', () => {
    expect(page).toContain('aDondeIrDirecto({')
    expect(page).not.toMatch(/\(medicamentos\.length > 0 && nid\) \? `\/receta/)
  })

  it('sólo navega si hay un destino claro', () => {
    expect(page).toMatch(/if \(destino\) router\.push\(destino\)/)
  })

  it('el panel se monta y sólo con la nota firmada', () => {
    expect(page).toContain("import { ComoCerrarLaConsulta } from '@/components/ComoCerrarLaConsulta'")
    expect(page).toMatch(/\{firmada && \(\s*\n\s*<ComoCerrarLaConsulta/)
  })

  it('el panel dice la consecuencia, no sólo el nombre', () => {
    const comp = readFileSync(join(process.cwd(), 'src/components/ComoCerrarLaConsulta.tsx'), 'utf8')
    expect(comp).toMatch(/paso\.siNoSeHace/)
  })
})

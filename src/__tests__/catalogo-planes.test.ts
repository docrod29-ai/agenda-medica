/**
 * SUBIR UN PRECIO NO PUEDE EXIGIR UN PROGRAMADOR.
 *
 * `PLANES` vive en el código. Ya no está disperso, pero sigue siendo código:
 * pasar Clínica de $899 a $949 exige editar un archivo, compilar y desplegar —
 * o sea, exige a un programador para una decisión del dueño que se toma en
 * treinta segundos.
 *
 * Este catálogo deja que un documento guardado sobreescriba precio y créditos,
 * con los valores del código como RED. Y toda la mitad delicada de estas pruebas
 * es la misma pregunta: qué pasa cuando lo guardado está mal. La respuesta nunca
 * puede ser «la aplicación se queda sin precios».
 */
import { describe, it, expect } from 'vitest'
import { PLANES } from '@/lib/planes-ia'
import {
  catalogoEfectivo, prepararGuardado, PRECIO_MAXIMO_MXN,
} from '@/lib/finanzas/catalogo-planes'

describe('el catálogo efectivo', () => {
  it('sin documento guardado usa el de fábrica', () => {
    const c = catalogoEfectivo(null)
    expect(c.planes.clinica.precioMXN).toBe(PLANES.clinica.precioMXN)
    expect(c.deFabrica).toBe(true)
    expect(c.avisos).toEqual([])
  })

  it('un ajuste válido manda sobre el código', () => {
    const c = catalogoEfectivo({ version: 3, ajustes: { clinica: { precioMXN: 949 } } })
    expect(c.planes.clinica.precioMXN).toBe(949)
    expect(c.version).toBe(3)
    expect(c.deFabrica).toBe(false)
  })

  it('lo que no se ajusta se queda como está', () => {
    const c = catalogoEfectivo({ ajustes: { clinica: { precioMXN: 949 } } })
    expect(c.planes.premium.precioMXN).toBe(PLANES.premium.precioMXN)
    expect(c.planes.agenda.precioMXN).toBe(PLANES.agenda.precioMXN)
  })

  it('los créditos también se pueden mover', () => {
    const c = catalogoEfectivo({ ajustes: { clinica: { creditos: 250 } } })
    expect(c.planes.clinica.creditos).toBe(250)
    expect(c.planes.clinica.precioMXN).toBe(PLANES.clinica.precioMXN)
  })

  it('NO SE PUEDE EDITAR LO QUE INCLUYE EL PLAN', () => {
    /**
     * `incluye`, `modulos` y `nivelIA` no son un precio: son la promesa del
     * producto y el permiso de acceso. Editarlos desde un formulario abriría
     * módulos que nadie pagó, y con un dedazo.
     */
    const c = catalogoEfectivo({
      ajustes: { agenda: { precioMXN: 399, ...({ nivelIA: 'premium', incluye: ['todo'] } as object) } },
    })
    expect(c.planes.agenda.nivelIA).toBe(PLANES.agenda.nivelIA)
    expect(c.planes.agenda.incluye).toEqual(PLANES.agenda.incluye)
    expect(c.planes.agenda.precioMXN).toBe(399)   // el dinero sí
  })
})

describe('cuando lo guardado está mal — y por qué NUNCA se queda sin precios', () => {
  it('un precio de $0 se ignora y se DICE', () => {
    // Un plan a cero se cobraría mal en todas las pantallas a la vez.
    const c = catalogoEfectivo({ ajustes: { clinica: { precioMXN: 0 } } })
    expect(c.planes.clinica.precioMXN).toBe(PLANES.clinica.precioMXN)
    expect(c.avisos.join(' ')).toMatch(/se ignoró el precio/)
  })

  it('un precio negativo tampoco', () => {
    const c = catalogoEfectivo({ ajustes: { clinica: { precioMXN: -100 } } })
    expect(c.planes.clinica.precioMXN).toBe(PLANES.clinica.precioMXN)
  })

  it('EL CERO DE MÁS se caza', () => {
    // $8,990 en vez de $899 es el dedazo clásico, y nadie lo revisa dos veces.
    const c = catalogoEfectivo({ ajustes: { clinica: { precioMXN: PRECIO_MAXIMO_MXN + 1 } } })
    expect(c.planes.clinica.precioMXN).toBe(PLANES.clinica.precioMXN)
    expect(c.avisos.join(' ')).toMatch(/cero de más/)
  })

  it('el texto en vez del número se ignora', () => {
    const c = catalogoEfectivo({ ajustes: { clinica: { precioMXN: 'novecientos' as unknown as number } } })
    expect(c.planes.clinica.precioMXN).toBe(PLANES.clinica.precioMXN)
  })

  it('UN CAMPO MALO NO TIRA EL OTRO', () => {
    // Si alguien escribe bien el precio y mal los créditos, rechazar los dos
    // castigaría la parte correcta.
    const c = catalogoEfectivo({ ajustes: { clinica: { precioMXN: 949, creditos: -5 } } })
    expect(c.planes.clinica.precioMXN).toBe(949)
    expect(c.planes.clinica.creditos).toBe(PLANES.clinica.creditos)
    expect(c.avisos.length).toBe(1)
  })

  it('los créditos con decimales se rechazan', () => {
    const c = catalogoEfectivo({ ajustes: { clinica: { creditos: 200.5 } } })
    expect(c.planes.clinica.creditos).toBe(PLANES.clinica.creditos)
  })

  it('UN DOCUMENTO CORRUPTO NO REVIENTA NADA', () => {
    /**
     * La aplicación sin precios no puede ni cobrar ni enseñar el plan. Es mucho
     * peor que cobrar el de fábrica, así que aquí nunca se lanza.
     */
    for (const basura of [undefined, null, {}, { ajustes: null }, { ajustes: 'texto' }, { ajustes: [] }, { ajustes: { clinica: 'x' } }]) {
      const c = catalogoEfectivo(basura as never)
      expect(c.planes.clinica.precioMXN).toBe(PLANES.clinica.precioMXN)
      expect(Object.keys(c.planes).length).toBe(Object.keys(PLANES).length)
    }
  })

  it('un plan que no existe se ignora sin ensuciar el catálogo', () => {
    const c = catalogoEfectivo({ ajustes: { inventado: { precioMXN: 1 } } as never })
    expect(Object.keys(c.planes).sort()).toEqual(Object.keys(PLANES).sort())
  })
})

describe('lo que se guarda ya va limpio', () => {
  const AHORA = '2026-08-01T03:00:00.000Z'

  it('sube la versión y sella autor y fecha', () => {
    // Una tarifa sin autor no se puede auditar.
    const { doc } = prepararGuardado({ clinica: { precioMXN: 949 } }, 4, 'doc@correo.mx', AHORA)
    expect(doc.version).toBe(5)
    expect(doc.actualizadoPor).toBe('doc@correo.mx')
    expect(doc.actualizadoEn).toBe(AHORA)
  })

  it('LA BASURA NO ENTRA, no sólo se ignora al leer', () => {
    /**
     * Filtrar sólo en la lectura deja un documento con basura dentro: una bomba
     * que estalla el día que alguien cambie la validación de lectura.
     */
    const { doc, rechazos } = prepararGuardado({ clinica: { precioMXN: -1 }, premium: { precioMXN: 1790 } }, 0, 'x', AHORA)
    expect(doc.ajustes?.clinica).toBeUndefined()
    expect(doc.ajustes?.premium?.precioMXN).toBe(1790)
    expect(rechazos.length).toBe(1)
  })

  it('sin nada válido, guarda un documento vacío en vez de uno tóxico', () => {
    const { doc } = prepararGuardado({ clinica: { precioMXN: 0 } }, 1, 'x', AHORA)
    expect(doc.ajustes).toEqual({})
    expect(doc.version).toBe(2)
  })

  it('lo guardado y lo leído coinciden: el ciclo cierra', () => {
    const { doc } = prepararGuardado({ clinica: { precioMXN: 949, creditos: 220 } }, 0, 'x', AHORA)
    const c = catalogoEfectivo(doc)
    expect(c.planes.clinica.precioMXN).toBe(949)
    expect(c.planes.clinica.creditos).toBe(220)
    expect(c.avisos).toEqual([])
  })
})

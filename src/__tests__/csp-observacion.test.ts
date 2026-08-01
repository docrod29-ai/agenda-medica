/**
 * EL BUZÓN PÚBLICO QUE NO PUEDE VOLVERSE UNA FUGA NI UNA FACTURA.
 *
 * Este endpoint lo llama el NAVEGADOR, sin autenticación — no hay otra forma de
 * que funcione. Eso deja dos maneras de hacerlo mal, y las dos se prueban aquí:
 *
 *  · Guardar la dirección completa. En esta aplicación la URL de la página ES un
 *    dato sensible: el portal del paciente lleva su token en la ruta y el
 *    expediente lleva el id. Sería una fuga de PHI en la colección que existe
 *    para mejorar la seguridad.
 *  · Guardar un documento por reporte. Cualquiera en internet podría inflar la
 *    base de datos y la factura escribiendo en el buzón.
 */
import { describe, it, expect } from 'vitest'
import {
  rutaSegura, gruposDeReporte, idDocumento, veredictoEnforce,
  MAXIMO_GRUPOS_POR_PETICION, MAXIMO_LARGO_CAMPO, DIAS_MINIMOS_DE_OBSERVACION,
} from '@/lib/security/csp-observacion'

const HOY = '2026-08-01'
const PROPIO = ['https://agenda-medica-one.vercel.app']

describe('rutaSegura — lo que NUNCA puede quedar guardado', () => {
  it('EL TOKEN DEL PACIENTE NO SE GUARDA', () => {
    // /mi/{token} es una sesión válida: guardarla sería entregar el expediente.
    const r = rutaSegura('https://app.mx/mi/eyJhbGciOiJI-token-secreto?x=1')
    expect(r).toBe('https://app.mx/mi/…')
    expect(r).not.toMatch(/token-secreto/)
  })

  it('EL ID DEL PACIENTE TAMPOCO', () => {
    expect(rutaSegura('https://app.mx/expediente/PACIENTE-123/nota/9')).toBe('https://app.mx/expediente/…')
  })

  it('la raíz se conserva entera porque no esconde nada', () => {
    expect(rutaSegura('https://app.mx/')).toBe('https://app.mx/')
  })

  it('los valores que NO son URL se conservan: significan algo', () => {
    // 'inline' y 'eval' son la respuesta a «¿qué hay que apretar?».
    expect(rutaSegura('inline')).toBe('inline')
    expect(rutaSegura('eval')).toBe('eval')
    expect(rutaSegura('data')).toBe('data')
  })

  it('la basura no se guarda como si fuera algo', () => {
    expect(rutaSegura('%%%no es nada%%%')).toBe('')
    expect(rutaSegura(null)).toBe('')
    expect(rutaSegura(12345)).toBe('')
  })
})

describe('gruposDeReporte', () => {
  const unReporte = (extra: Record<string, unknown> = {}) => ({
    'csp-report': {
      'violated-directive': 'script-src',
      'blocked-uri': 'https://cdn.ajeno.com/x.js',
      'document-uri': 'https://agenda-medica-one.vercel.app/consulta/abc123',
      ...extra,
    },
  })

  it('entiende el formato clásico (report-uri)', () => {
    const g = gruposDeReporte(unReporte(), HOY, PROPIO)
    expect(g).toHaveLength(1)
    expect(g[0].directiva).toBe('script-src')
    // El recurso bloqueado conserva su primer segmento —aquí, el archivo— y eso
    // es lo que hace útil el reporte: «un script de este CDN» no basta para
    // decidir, «este archivo de este CDN» sí. La regla de redacción es la misma
    // que para la página, y protege igual si el recurso fuera de esta app.
    expect(g[0].bloqueado).toBe('https://cdn.ajeno.com/x.js')
    expect(g[0].pagina).toBe('https://agenda-medica-one.vercel.app/consulta/…')
  })

  it('y el moderno (report-to), que llega en arreglo y en camelCase', () => {
    const g = gruposDeReporte([{
      body: {
        effectiveDirective: 'img-src',
        blockedURL: 'https://otro.com/a.png',
        documentURL: 'https://agenda-medica-one.vercel.app/agenda',
      },
    }], HOY, PROPIO)
    expect(g).toHaveLength(1)
    expect(g[0].directiva).toBe('img-src')
  })

  it('MIL REPORTES IGUALES SON UN GRUPO, NO MIL', () => {
    // Es lo que impide que el buzón se convierta en una manguera contra la base
    // de datos: la clave lleva el día, así que se incrementa un contador.
    const muchos = Array.from({ length: 500 }, () => ({ body: {
      effectiveDirective: 'script-src', blockedURL: 'inline',
      documentURL: 'https://agenda-medica-one.vercel.app/consulta/x',
    } }))
    expect(gruposDeReporte(muchos, HOY, PROPIO)).toHaveLength(1)
  })

  it('un aluvión de grupos DISTINTOS también se recorta', () => {
    const muchos = Array.from({ length: 200 }, (_, i) => ({ body: {
      effectiveDirective: `dir-${i}`, blockedURL: 'inline',
      documentURL: 'https://agenda-medica-one.vercel.app/x',
    } }))
    expect(gruposDeReporte(muchos, HOY, PROPIO).length).toBe(MAXIMO_GRUPOS_POR_PETICION)
  })

  it('LO AJENO SE DESCARTA', () => {
    /**
     * Un reporte cuya página no es de esta aplicación no dice nada de esta
     * aplicación: o es ruido de una extensión del navegador en otro sitio, o es
     * alguien escribiendo en el buzón a propósito.
     */
    const g = gruposDeReporte(unReporte({ 'document-uri': 'https://sitio-cualquiera.com/x' }), HOY, PROPIO)
    expect(g).toEqual([])
  })

  it('…pero SIN lista de orígenes no se filtra: perder la observación es peor', () => {
    const g = gruposDeReporte(unReporte({ 'document-uri': 'https://sitio-cualquiera.com/x' }), HOY, [])
    expect(g).toHaveLength(1)
  })

  it('un campo kilométrico se recorta', () => {
    const g = gruposDeReporte(unReporte({ 'violated-directive': 'x'.repeat(5000) }), HOY, PROPIO)
    expect(g[0].directiva.length).toBe(MAXIMO_LARGO_CAMPO)
  })

  it('sin directiva no hay grupo: no habría nada que decidir', () => {
    expect(gruposDeReporte(unReporte({ 'violated-directive': '' }), HOY, PROPIO)).toEqual([])
  })

  it('un cuerpo absurdo no rompe nada', () => {
    for (const basura of [null, 'texto', 42, [], {}]) {
      expect(() => gruposDeReporte(basura, HOY, PROPIO)).not.toThrow()
    }
  })

  it('el día viaja en la clave: la agrupación se reinicia cada día', () => {
    const a = gruposDeReporte(unReporte(), '2026-08-01', PROPIO)[0]
    const b = gruposDeReporte(unReporte(), '2026-08-02', PROPIO)[0]
    expect(a.clave).not.toBe(b.clave)
  })
})

describe('idDocumento', () => {
  it('sin barras, porque Firestore no las admite en un id', () => {
    expect(idDocumento('script-src|https://cdn.com/x|2026-08-01')).not.toMatch(/\//)
  })

  it('sigue siendo legible: la mitad del sentido de un id determinista', () => {
    expect(idDocumento('script-src|inline|2026-08-01')).toContain('script-src')
  })

  it('acotado, para que ningún id se salga del límite de Firestore', () => {
    expect(idDocumento('x'.repeat(2000)).length).toBeLessThanOrEqual(400)
  })
})

describe('¿ya se puede bloquear de verdad?', () => {
  it('con pocos días NO, y dice cuántos faltan', () => {
    const v = veredictoEnforce(2, 0)
    expect(v.listo).toBe(false)
    expect(v.motivo).toMatch(/Faltan 5 día/)
  })

  it('con violaciones vivas NO, aunque sobren días', () => {
    // Pasar a bloqueo rompería exactamente eso que está saltando.
    const v = veredictoEnforce(30, 3)
    expect(v.listo).toBe(false)
    expect(v.motivo).toMatch(/rompería justo eso/)
  })

  it('con los días cumplidos y nada saltando, SÍ — y dice qué poner', () => {
    const v = veredictoEnforce(DIAS_MINIMOS_DE_OBSERVACION, 0)
    expect(v.listo).toBe(true)
    expect(v.motivo).toMatch(/CSP_MODE=enforce/)
  })

  it('una semana es el mínimo, no un día', () => {
    // Un solo día no ve el cierre de mes ni la pantalla que se usa una vez por
    // semana; encender el bloqueo con esa muestra rompe en producción.
    expect(DIAS_MINIMOS_DE_OBSERVACION).toBeGreaterThanOrEqual(7)
  })
})

describe('el recurso bloqueado también se redacta si es NUESTRO', () => {
  it('un recurso propio con id de paciente no filtra el id', () => {
    /**
     * `blocked-uri` no siempre apunta a un tercero: puede ser una imagen o una
     * petición de esta misma aplicación. Si esa ruta llevara el id de un
     * paciente, guardarla entera sería la misma fuga por la otra puerta.
     */
    const g = gruposDeReporte({
      'csp-report': {
        'violated-directive': 'connect-src',
        'blocked-uri': 'https://agenda-medica-one.vercel.app/api/expediente/PACIENTE-9/notas',
        'document-uri': 'https://agenda-medica-one.vercel.app/expediente/PACIENTE-9',
      },
    }, HOY, PROPIO)
    expect(g[0].bloqueado).toBe('https://agenda-medica-one.vercel.app/api/…')
    expect(JSON.stringify(g)).not.toMatch(/PACIENTE-9/)
  })
})

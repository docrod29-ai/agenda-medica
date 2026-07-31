/**
 * GOLDEN — la zona del consultorio publicada una vez.
 *
 * Lo que se protege aquí es la propiedad que hace segura toda la solución:
 * **en el servidor la zona no se puede publicar.** Una función de Vercel atiende
 * a muchos consultorios; una variable de módulo compartida entre peticiones
 * calcularía el corte de caja de Tijuana con la zona del que entró antes.
 *
 * Los tests corren en entorno `node`, así que `window` no existe: ése ES el
 * escenario del servidor. El navegador se simula definiéndolo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TZ_DEFAULT, fijarZonaConsultorio, limpiarZonaConsultorio, zonaActiva, hoyISO,
} from '@/lib/timezone'

/** localStorage de mentira, para simular el navegador. */
function almacenFalso() {
  const datos = new Map<string, string>()
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v) },
    removeItem: (k: string) => { datos.delete(k) },
    _datos: datos,
  }
}

/**
 * `window` en el global de Node.
 *
 * Se tipa a mano porque el DOM completo no existe en entorno `node` y el módulo
 * sólo mira `typeof window` y `window.localStorage`: montar un `Storage` entero
 * para eso sería ruido.
 */
const g = globalThis as unknown as { window?: { localStorage: unknown } }

function simularNavegador(store: unknown = almacenFalso()) {
  g.window = { localStorage: store }
  return store as ReturnType<typeof almacenFalso>
}
function volverAlServidor() { delete g.window }

beforeEach(() => { volverAlServidor(); limpiarZonaConsultorio() })
afterEach(() => { volverAlServidor(); limpiarZonaConsultorio() })

describe('EN EL SERVIDOR la zona no se publica — la propiedad que no es negociable', () => {
  it('fijarZonaConsultorio no hace nada y lo dice', () => {
    expect(fijarZonaConsultorio('America/Tijuana')).toBe(false)
    expect(zonaActiva()).toBe(TZ_DEFAULT)
  })

  it('por muchas veces que se llame, la zona sigue siendo la de último recurso', () => {
    for (const tz of ['America/Tijuana', 'America/Hermosillo', 'Europe/Madrid']) {
      fijarZonaConsultorio(tz)
    }
    expect(zonaActiva()).toBe(TZ_DEFAULT)
  })

  it('un consultorio NO puede heredar la zona de otro entre peticiones', () => {
    // El escenario real: dos peticiones seguidas en la misma instancia de Vercel.
    fijarZonaConsultorio('America/Tijuana')      // consultorio A
    const paraB = zonaActiva()                    // consultorio B, sin publicar nada
    expect(paraB).toBe(TZ_DEFAULT)
    expect(paraB).not.toBe('America/Tijuana')
  })
})

describe('EN EL NAVEGADOR la zona sí se publica', () => {
  it('se publica y la usan las funciones que no reciben argumento', () => {
    simularNavegador()
    expect(fijarZonaConsultorio('America/Tijuana')).toBe(true)
    expect(zonaActiva()).toBe('America/Tijuana')
  })

  it('un argumento explícito SIEMPRE gana sobre la publicada', () => {
    /**
     * Con reloj FIJO a propósito.
     *
     * La primera versión de este caso comparaba Tijuana contra Madrid usando la
     * hora real, y esas dos zonas coinciden de día durante quince horas de cada
     * veinticuatro: el test habría fallado sin que nada estuviera roto, unas
     * noches sí y otras no. Un invariante intermitente enseña a ignorar el CI.
     */
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T06:30:00Z'))
    try {
      simularNavegador()
      fijarZonaConsultorio('America/Tijuana')
      // A esa hora UTC: en Tijuana (UTC-8) aún es 31-dic; en CDMX (UTC-6) ya es 1-ene.
      expect(hoyISO()).toBe('2025-12-31')                    // la publicada
      expect(hoyISO('America/Mexico_City')).toBe('2026-01-01') // la explícita gana
    } finally {
      vi.useRealTimers()
    }
  })

  it('se recuerda para la siguiente carga', () => {
    const store = simularNavegador()
    fijarZonaConsultorio('America/Hermosillo')
    expect(store._datos.get('nx.tz.consultorio')).toBe('America/Hermosillo')

    // Nueva carga: se pierde la variable de módulo, sobrevive el almacén.
    limpiarZonaConsultorioSoloMemoria()
    simularNavegador(store)
    expect(zonaActiva()).toBe('America/Hermosillo')
  })

  it('cerrar sesión la olvida, para que el siguiente no la herede', () => {
    const store = simularNavegador()
    fijarZonaConsultorio('America/Tijuana')
    limpiarZonaConsultorio()
    expect(zonaActiva()).toBe(TZ_DEFAULT)
    expect(store._datos.get('nx.tz.consultorio')).toBeUndefined()
  })
})

describe('Nada de esto puede romper las fechas de la app', () => {
  it('una zona vacía o nula se ignora', () => {
    simularNavegador()
    for (const malo of ['', null, undefined]) {
      expect(fijarZonaConsultorio(malo)).toBe(false)
    }
    expect(zonaActiva()).toBe(TZ_DEFAULT)
  })

  it('una zona INVÁLIDA se rechaza en vez de reventar cada render', () => {
    simularNavegador()
    expect(fijarZonaConsultorio('Marte/Olympus_Mons')).toBe(false)
    expect(zonaActiva()).toBe(TZ_DEFAULT)
    expect(() => hoyISO()).not.toThrow()
  })

  it('una zona corrupta en el almacén se descarta y se limpia sola', () => {
    // Alguien tocó localStorage a mano. Sin esta guarda, Intl lanzaría en CADA
    // llamada a hoyISO() y la app entera dejaría de pintar fechas.
    const store = almacenFalso()
    store.setItem('nx.tz.consultorio', 'no-es-una-zona')
    simularNavegador(store)
    expect(zonaActiva()).toBe(TZ_DEFAULT)
    expect(store._datos.get('nx.tz.consultorio')).toBeUndefined()
    expect(() => hoyISO()).not.toThrow()
  })

  it('si localStorage lanza (modo privado), no se cae nada', () => {
    simularNavegador({
      getItem() { throw new Error('bloqueado') },
      setItem() { throw new Error('bloqueado') },
      removeItem() { throw new Error('bloqueado') },
    })
    expect(fijarZonaConsultorio('America/Tijuana')).toBe(true)  // en memoria sí
    expect(zonaActiva()).toBe('America/Tijuana')
    expect(() => limpiarZonaConsultorio()).not.toThrow()
  })
})

describe('El desfase que motivó todo esto es real y medible', () => {
  it('Tijuana y México central NO siempre están en el mismo día', () => {
    // 2026-01-01T06:30:00Z → Tijuana (UTC-8) sigue en 2025-12-31; CDMX (UTC-6)
    // ya está en 2026-01-01. Es exactamente el corte de caja cerrando el día
    // equivocado.
    const instante = new Date('2026-01-01T06:30:00Z')
    const dia = (tz: string) => new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(instante)
    expect(dia('America/Tijuana')).toBe('2025-12-31')
    expect(dia('America/Mexico_City')).toBe('2026-01-01')
  })
})

/** Simula una recarga: la variable de módulo se pierde, el almacén no. */
function limpiarZonaConsultorioSoloMemoria() {
  // `limpiarZonaConsultorio` borra las dos cosas; aquí hace falta perder sólo la
  // memoria, que es lo que pasa al recargar la página.
  volverAlServidor()
  limpiarZonaConsultorio()
}

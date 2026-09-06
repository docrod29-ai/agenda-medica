/**
 * LA ALERTA TIENE QUIEN LA LEA — REG-256.
 *
 * ── LO QUE ENCONTRÓ EL INSTRUMENTO DE REG-255 ───────────────────────────────
 *
 * Primera cosecha del barrido de motores sin conectar, y salió de lo alto de la
 * lista:
 *
 *     src/lib/hospital/firestore.ts::getAlertas
 *     src/lib/hospital/firestore.ts::marcarAlertaLeida
 *
 * `crearAlerta()` guarda cada alerta del episodio en `hospital_alertas`: valor
 * de laboratorio **crítico**, NEWS2, interconsulta, resultado listo. La
 * colección existe, tiene reglas de Firestore, está en la lista de respaldos y
 * en la matriz de acceso.
 *
 * Y **ninguna pantalla la leía**. Las dos funciones de lectura estaban escritas
 * y sin un solo llamador en todo el repositorio.
 *
 * Traducido: el potasio de 7.2 se marca crítico, se escribe la alerta, y va a
 * parar a un cajón que no tiene tirador.
 *
 * ── LO QUE SÍ FUNCIONABA, PARA NO EXAGERAR ──────────────────────────────────
 *
 * El envío por WhatsApp sí corría, y el propio código ya avisaba cuando NO
 * salía —eso se reparó en su día—. Pero WhatsApp es un canal que se pierde: se
 * lee en el pasillo, se olvida, o el teléfono no está registrado, que es el
 * estado por defecto de una clínica recién configurada.
 *
 * **La alerta en la ficha del paciente es la que sigue ahí mañana.**
 *
 * ── LAS TRES DECISIONES DEL DISEÑO ──────────────────────────────────────────
 *
 * 1. **Encima de las pestañas.** Una alerta que hay que ir a buscar en una
 *    pestaña no es una alerta.
 * 2. **Se marca leída con un clic, no al mirarla.** Marcar por el hecho de que
 *    la lista aparezca convierte el estado en ruido: se «leen» solas al abrir
 *    la ficha por cualquier otro motivo.
 * 3. **Si la consulta falla, se dice.** No se enseña «0 alertas»: fingir una
 *    bandeja vacía sería la misma mentira que este componente repara.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  POR_QUE_EXISTE, POR_QUE_NO_SE_MARCAN_SOLAS, POR_QUE_NULL_NO_ES_CERO,
} from '@/components/AlertasDelEpisodio'

const leer = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')
const comp = leer('src', 'components', 'AlertasDelEpisodio.tsx')
const page = leer('src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx')

describe('las funciones de lectura YA CORREN', () => {
  it('la ficha del episodio importa las dos', () => {
    expect(page).toMatch(/getAlertas, marcarAlertaLeida/)
  })

  it('y se las pasa al componente', () => {
    expect(page).toMatch(/cargar=\{getAlertas\}/)
    expect(page).toMatch(/marcarLeida=\{marcarAlertaLeida\}/)
  })

  it('el componente está montado ENCIMA de las pestañas', () => {
    /**
     * Una alerta que hay que ir a buscar en una pestaña no es una alerta. Se
     * comprueba por posición: el montaje va antes del bloque de pestañas.
     */
    const iAlertas = page.indexOf('<AlertasDelEpisodio')
    const iTabs = page.indexOf('{/* Tabs */}')
    expect(iAlertas).toBeGreaterThan(-1)
    expect(iTabs).toBeGreaterThan(-1)
    expect(iAlertas, 'la bandeja quedó DEBAJO de las pestañas').toBeLessThan(iTabs)
  })
})

describe('sólo las de ESTE paciente', () => {
  it('se filtra por internamientoId', () => {
    /** La colección es de toda la clínica: sin filtro saldrían ajenas. */
    expect(comp).toMatch(/todas\.filter\(a => a\.internamientoId === internamientoId\)/)
  })
})

describe('lo no leído manda', () => {
  it('lo sin leer va primero y lo leído se apaga', () => {
    expect(comp).toMatch(/\[\.\.\.sinLeer, \.\.\.alertas\.filter\(a => a\.leida\)\]/)
    expect(comp).toMatch(/opacity: a\.leida \? 0\.5 : 1/)
  })

  it('el borde se pone rojo mientras quede algo sin leer', () => {
    expect(comp).toMatch(/sinLeer\.length \? 'var\(--red\)' : 'var\(--border\)'/)
  })

  it('se marca con un CLIC, nunca al aparecer', () => {
    expect(comp).toMatch(/onClick=\{\(\) => marcar\(a\.id\)\}/)
    /* No hay ningún efecto que marque leído al montar. */
    expect(comp).not.toMatch(/useEffect\([^)]*marcarLeida/)
    expect(POR_QUE_NO_SE_MARCAN_SOLAS).toMatch(/pasó por delante/)
  })
})

describe('lo que NO se finge', () => {
  /**
   * ── ESTA ASERCIÓN SE CAMBIÓ, Y POR QUÉ (Panel de Lujo ZC-001) ─────────────
   *
   * Lo que decía antes:
   *
   *     expect(comp).toMatch(/setAlertas\(null\)/)
   *     expect(comp).toMatch(/if \(!alertas \|\| alertas\.length === 0\) return null/)
   *
   * Las dos líneas eran ciertas y las dos juntas **fijaban el defecto**. El
   * `catch` ponía `null` y el `if` de abajo trataba ese mismo `null` como «no
   * hay nada»: las dos únicas salidas del componente ante un fallo de lectura
   * eran no pintar nada. La prueba se llamaba «no se enseña 0 alertas» y lo que
   * comprobaba era que no se enseñara NADA — que es la misma mentira dicha en
   * silencio, no lo contrario de ella.
   *
   * Se descubrió en la auditoría del Panel de Lujo (6-sep-2026, hallazgo ZC-001
   * del barrido de cierre de componentes) mirando qué PINTA el componente
   * cuando `cargar` rechaza, en vez de qué guarda.
   *
   * Lo que se comprueba ahora: que el fallo tiene un estado PROPIO
   * (`falloAlLeer`), que se pinta con la pieza compartida `NoSePudoLeer`, y
   * —esto es lo que de verdad cierra el agujero— que esa rama va ANTES que la
   * del vacío en el orden del archivo. Si alguien la mueve debajo del
   * `return null`, deja de alcanzarse y el defecto vuelve.
   */
  it('si la carga falla, se PINTA que falló — y antes que ningún «no hay nada»', () => {
    expect(comp).toMatch(/setFalloAlLeer\(e \?\? new Error\('lectura fallida'\)\)/)

    const ramaDelFallo = comp.indexOf('if (falloAlLeer !== undefined)')
    const ramaDelVacio = comp.indexOf('if (!alertas || alertas.length === 0) return null')
    expect(ramaDelFallo).toBeGreaterThan(-1)
    expect(ramaDelVacio).toBeGreaterThan(-1)
    expect(ramaDelFallo).toBeLessThan(ramaDelVacio)

    expect(comp).toMatch(/<NoSePudoLeer[\s\S]*?que="las alertas de este paciente"/)
    expect(POR_QUE_NULL_NO_ES_CERO).toMatch(/misma mentira/)
    /* Y que quede escrito que «se dice» significa EN PANTALLA. */
    expect(POR_QUE_NULL_NO_ES_CERO).toMatch(/ZC-001/)
  })

  it('si no se pudo marcar, se queda sin marcar', () => {
    expect(comp).toMatch(/no se pudo marcar, se queda sin marcar: no se finge/)
  })

  it('que el WhatsApp NO saliera se enseña', () => {
    /**
     * Es información, no un detalle: si el canal falló, el médico tiene que
     * saber que esa alerta sólo existe aquí.
     */
    expect(comp).toMatch(/a\.whatsappEnviado === false \? ' · no se envió por WhatsApp' : ''/)
  })

  it('sin alertas de este episodio no hay recuadro vacío', () => {
    expect(comp).toMatch(/Sin alertas de este episodio no se enseña un recuadro vacío/)
  })
})

describe('queda escrito por qué existía el hueco', () => {
  it('el cajón sin tirador', () => {
    expect(POR_QUE_EXISTE).toMatch(/caj[óo]n\s*\n?\s*sin tirador/)
  })
})

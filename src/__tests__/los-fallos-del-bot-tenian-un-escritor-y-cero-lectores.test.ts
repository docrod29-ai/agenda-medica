/**
 * GOLDEN — la colección de fallos del bot estaba declarada en los tres sitios, respaldada… e invisible.
 *
 * ── QUÉ FALLABA (TR-WHATSAPP.entrega) ───────────────────────────────────────
 *
 * CORRECCIÓN DEL CENSO, la octava de este bucle. El `queFalta` decía que «el
 * mensaje REACTIVO del bot no pasa por el outbox — esa respuesta se pierde y no
 * queda en ninguna cola».
 *
 * La primera mitad es cierta y es una DECISIÓN, no un hueco: `no-entregados.ts`
 * lo argumenta —reintentar fuera de la ventana de 24 h exige una plantilla
 * aprobada en Meta, que es un trámite del dueño, y encolar mensajes que no se
 * van a poder mandar sería fabricar una cola que crece y no entrega—.
 *
 * La segunda mitad era **falsa**: sí quedaba constancia. `registrarNoEntregado`
 * escribe en `clinics/{id}/whatsapp_no_entregados` desde el helper `send()` del
 * bot, que cubre sus 36 llamadas.
 *
 * El defecto real estaba en otro sitio, y es peor:
 *
 *     grep whatsapp_no_entregados → firestore.rules · matriz-acceso · respaldo
 *                                 · el módulo que ESCRIBE
 *                                 · ningún lector
 *
 * **Un escritor y cero lectores.** La colección estaba declarada en los tres
 * sitios que exige la regla de inquilinos, respaldada, cerrada al cliente por
 * las dos puntas… e invisible. Y la cabecera del propio módulo prometía, con
 * estas palabras, que «un fallo registrado se puede **VER**, contar y arreglar a
 * mano — una llamada de teléfono».
 *
 * ── LO QUE COSTABA ──────────────────────────────────────────────────────────
 *
 * El caso que el módulo nombra: el paciente agenda por WhatsApp, la confirmación
 * falla, la cita queda creada y él no se entera. Se registraba. Nadie podía
 * leerlo. Y peor: REG-535 había construido una pantalla llamada **«No
 * entregados»**, así que un médico que la abriera y la viera vacía concluía que
 * no se había perdido ningún mensaje — mirando la mitad de la realidad.
 *
 * ── LA CAUSA RAÍZ ───────────────────────────────────────────────────────────
 *
 * La misma de REG-527 y REG-531, y ya van tres: **cuanto mejor explicada está
 * una garantía, menos probable es que alguien vaya a comprobar si el código la
 * cumple.** Aquí la garantía estaba escrita en la cabecera del módulo que la
 * incumplía.
 *
 * ── POR QUÉ SON DOS LISTAS Y NO UNA ─────────────────────────────────────────
 *
 * Porque se actúa distinto sobre cada una. Los de la COLA agotaron sus
 * reintentos y se pueden devolver a ella, con el riesgo de duplicar. Los del BOT
 * **nunca estuvieron en una cola** y no se pueden reintentar: la única salida es
 * llamar al paciente.
 *
 * Por eso los del bot van **sin botón**. Poner uno que no puede cumplir sería
 * peor que no ponerlo: el médico creería que el mensaje va a salir y dejaría de
 * llamar, que es lo único que hoy sí funciona.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No los encola ni los reintenta.** Sigue haciendo falta la plantilla
 *   aprobada, que es del dueño.
 * · **No dice a qué paciente**: el registro guarda los últimos cuatro dígitos y
 *   120 caracteres a propósito, y ampliarlo sería meter PHI donde se decidió que
 *   no la hubiera.
 * · **No archiva ni descarta** lo que el médico ya resolvió por teléfono. Sigue
 *   abierto en el eje.
 * · **No es una prueba de navegador.**
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  TOPE_A_LISTAR, POR_QUE_NO_SE_ENCOLA,
  POR_QUE_NO_LLEVAN_BOTON, POR_QUE_SON_DOS_LISTAS_Y_NO_UNA,
} from '@/lib/whatsapp/no-entregados'

const leer = (r: string) => readFileSync(resolve(process.cwd(), r), 'utf8')
const MODULO = leer('src/lib/whatsapp/no-entregados.ts')
const RUTA = leer('src/app/api/whatsapp/no-entregados/route.ts')
const PANTALLA = leer('src/app/(dashboard)/configuracion/secciones-comunicacion.tsx')
const REGLAS = leer('firestore.rules')
const MATRIZ = leer('src/lib/authz/matriz-acceso.ts')
const RESPALDO = leer('src/lib/clinica/respaldo.ts')

describe('la colección seguía declarada donde tenía que estar', () => {
  it('en las tres: reglas, matriz y respaldo', () => {
    /* Esto ya pasaba antes del arreglo, y es el punto: los tres guardianes de la
       regla de inquilinos estaban en verde sobre una colección que nadie leía. */
    for (const [nombre, texto] of [['reglas', REGLAS], ['matriz', MATRIZ], ['respaldo', RESPALDO]] as const) {
      expect(texto, nombre).toContain('whatsapp_no_entregados')
    }
  })
})

describe('y ahora tiene lector', () => {
  it('el módulo expone cómo leerla', () => {
    expect(MODULO).toMatch(/export async function listarNoEntregados/)
  })

  it('lanza en vez de devolver una lista vacía', () => {
    /**
     * AL REVÉS de lo que sería cómodo: «no se pudo leer» y «no hay ninguno»
     * llevan al médico a cosas opuestas. Un `try/catch` que devolviera `[]`
     * pintaría una pantalla tranquilizadora sobre una lectura rota.
     */
    const cuerpo = MODULO.slice(MODULO.indexOf('export async function listarNoEntregados'))
      .slice(0, MODULO.slice(MODULO.indexOf('export async function listarNoEntregados')).indexOf('\n}\n') + 3)
    expect(cuerpo).not.toMatch(/catch/)
    expect(cuerpo).toMatch(/\.limit\(tope\)/)
  })

  it('y con tope, que no es una cifra clínica', () => {
    expect(TOPE_A_LISTAR).toBe(50)
    expect(MODULO).toMatch(/No es una cifra clínica/)
  })
})

describe('la ruta: una sola puerta para la misma pregunta', () => {
  it('devuelve las dos listas', () => {
    expect(RUTA).toMatch(/listarMuertas\(clinicId\),\s*\n\s*listarNoEntregados\(clinicId\),/)
    expect(RUTA).toMatch(/delBot: delBot\.map/)
  })

  it('con la MISMA capacidad, no con una puerta nueva', () => {
    /* Dos puertas para la misma pregunta es el criterio paralelo que ya se
       corrigió una vez en esta misma ruta (REG-535). */
    expect(RUTA.match(/verificarCapacidad\(req, clinicId, 'mensajeria\.enviar'\)/g) ?? []).toHaveLength(2)
    expect(RUTA).not.toMatch(/'clinico\.escribir'/)
  })

  it('no ensancha lo que viaja: se pasa lo que ya venía minimizado', () => {
    expect(RUTA).toMatch(/id: b\.id, origen: b\.origen, telefono: b\.telefono,/)
    /* Nada del texto entero ni del teléfono completo: el registro nace con los
       últimos cuatro dígitos y 120 caracteres, y así se queda. */
    expect(MODULO).toMatch(/Últimos 4 dígitos/)
    expect(MODULO).toMatch(/\.slice\(0, 120\)/)
  })
})

describe('la pantalla, y el caso que más importa', () => {
  it('«ningún mensaje se ha rendido» exige que las DOS estén vacías', () => {
    /**
     * ÉSTE es el defecto que quedaba después de REG-535: con el bot fallando y
     * la cola limpia, la pantalla afirmaba que no se había perdido nada. Una
     * afirmación falsa sobre exactamente lo que el médico venía a comprobar.
     */
    expect(PANTALLA).toMatch(/muertas\.length === 0 && \(delBot\?\.length \?\? 0\) === 0/)
  })

  it('los del bot se pintan, con su cuenta', () => {
    expect(PANTALLA).toMatch(/Respuestas del bot que no salieron — \{delBot\?\.length\}/)
    expect(PANTALLA).toMatch(/\{b\.extracto\}<\/div>/)
  })

  it('y SIN botón: no se pueden reintentar, y se dice por qué', () => {
    const seccion = PANTALLA.slice(
      PANTALLA.indexOf('Respuestas del bot que no salieron'),
      PANTALLA.indexOf('No entregados — {muertas.length}'),
    )
    expect(seccion).toMatch(/no se pueden reintentar/)
    expect(seccion).toMatch(/hay que llamarle/)
    /* Un botón aquí haría creer que el mensaje va a salir. */
    expect(seccion).not.toMatch(/<button/)
  })

  it('un fallo de lectura sigue sin verse como «no hay ninguno»', () => {
    expect(PANTALLA).toMatch(/setMuertas\(null\); setDelBot\(null\)/)
  })
})

describe('lo que el módulo declara', () => {
  it('por qué no se encola, por qué no llevan botón y por qué son dos listas', () => {
    expect(POR_QUE_NO_SE_ENCOLA).toMatch(/plantilla aprobada en Meta/)
    expect(POR_QUE_NO_LLEVAN_BOTON).toMatch(/dejaría de llamar por teléfono/)
    expect(POR_QUE_SON_DOS_LISTAS_Y_NO_UNA).toMatch(/nunca estuvieron en una cola/)
  })

  it('y deja escrito el patrón que lo escondió', () => {
    expect(MODULO).toMatch(/un escritor y[\s\S]{0,20}cero lectores/)
    expect(MODULO).toMatch(/menos probable es que alguien vaya a[\s\S]{0,10}comprobar si el código la cumple/)
  })
})

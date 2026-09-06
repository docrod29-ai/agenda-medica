/**
 * GOLDEN — EL AVISO DECÍA CUÁNTOS SE RINDIERON, Y CON UN NÚMERO NO SE HACE NADA.
 *
 * ── QUÉ FALLABA (TR-WHATSAPP) ───────────────────────────────────────────────
 *
 * REG-397 puso el instrumento: el vigilante cuenta las entradas muertas del
 * outbox y las distingue de las pausadas —una pausa se arregla sola cuando el
 * proveedor vuelve; una muerta ya no se reintenta nunca—.
 *
 * Pero el aviso dice **un número**. Con un número no se ve de qué paciente era el
 * mensaje, ni qué decía, ni por qué murió, ni se puede volver a intentar. El
 * outbox tenía `contarMuertas` y nada más: contar es el primer paso y no es el
 * trabajo.
 *
 * Un recordatorio de cita que murió es un paciente que no sabe que tiene cita, y
 * hasta hoy eso sólo se sabía en plural.
 *
 * ── POR QUÉ REVIVIR ES UN ACTO Y NO UN REINTENTO AUTOMÁTICO ────────────────
 *
 * Una entrada muerta agotó sus reintentos, y desde la cola **no se puede
 * distinguir** entre dos casos opuestos: que el mensaje no llegara nunca —y
 * entonces revivirlo es lo correcto— o que llegara y se perdiera el acuse.
 *
 * Reintentar a ciegas duplicaría el mensaje al paciente. Así que no se reintenta
 * solo: lo revive una persona que **ve** el mensaje, y la pantalla se lo dice
 * antes de que pulse, no después.
 *
 * ── UN CRITERIO DE AUTORIZACIÓN QUE ME INVENTÉ Y SE CORRIGIÓ ───────────────
 *
 * La primera versión de la ruta distinguía dos puertas —ver con membresía,
 * revivir con `clinico.escribir`— y sonaba razonable. No es el modelo del árbol:
 * aquí la mensajería es UNA capacidad (`mensajeria.enviar`, la misma que
 * `/api/whatsapp/entregas`), y la cola lleva teléfonos y textos de pacientes, así
 * que verla no es más inocente que usarla.
 *
 * Dos partes decidiendo lo mismo con reglas distintas es justo lo que este
 * repositorio persigue por todas partes. Se alineó con la que ya existía.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **El mensaje REACTIVO del bot sigue fuera.** No pasa por el outbox: si el
 *   proveedor está caído cuando el paciente escribe, esa respuesta se pierde y no
 *   queda en ninguna cola. Es otra unidad y sigue abierta.
 * · **No deduplica.** Revivir puede duplicar, y la única defensa es que lo decida
 *   una persona informada. Una clave de idempotencia de punta a punta con el
 *   proveedor sería la defensa real, y no existe.
 * · **No borra ni archiva** lo que el médico decida no reintentar: se queda en la
 *   cola. Vaciarla es otra decisión.
 * · **No se probó en navegador.** Se comprueba la lógica de la cola, la puerta de
 *   autorización y que la pantalla avise del riesgo antes del botón.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  POR_QUE_REVIVIR_ES_UN_ACTO, POR_QUE_LAS_PAUSAS_NO_SE_BORRAN, TOPE_LISTA_MUERTAS,
} from '@/lib/whatsapp/outbox'
import { ACCIONES_HOSPITAL_MUTAR } from '@/lib/authz/registro-rutas'

const OUTBOX = readFileSync('src/lib/whatsapp/outbox.ts', 'utf8')
const RUTA = readFileSync('src/app/api/whatsapp/no-entregados/route.ts', 'utf8')
const PANTALLA = readFileSync('src/app/(dashboard)/configuracion/secciones-comunicacion.tsx', 'utf8')
const REGISTRO = readFileSync('src/lib/authz/registro-rutas.ts', 'utf8')

describe('ahora se pueden ver, no sólo contar', () => {
  it('el outbox sabe listarlas, no sólo contarlas', () => {
    expect(OUTBOX).toContain('export async function listarMuertas(')
    expect(OUTBOX).toContain('export async function contarMuertas(')
  })

  it('listar exige el consultorio y la colección cuelga de él', () => {
    /* Una cola de mensajes lleva teléfonos de pacientes: listarlas entre
       inquilinos sería la fuga que las reglas cierran por el otro lado. */
    expect(OUTBOX).toContain('if (!clinicId) return []')
    expect(OUTBOX).toContain("adminDb.collection('clinics').doc(clinicId).collection('whatsapp_outbox')")
  })

  it('una cola ilegible NO se convierte en «no hay ninguna»', () => {
    /**
     * «No se pudo leer» y «no hay ninguno» tienen consecuencias opuestas para el
     * médico. Devolver `[]` ante un fallo las pintaría igual — el mismo defecto
     * que el sobre de recuperación de evidencia existe para no repetir.
     */
    expect(OUTBOX).toContain("throw new Error('No se pudo leer la cola de mensajes no entregados.')")
    expect(RUTA).toContain('status: 503')
  })

  it('la lista tiene tope', () => {
    expect(TOPE_LISTA_MUERTAS).toBe(50)
    expect(OUTBOX).toContain('tope = TOPE_LISTA_MUERTAS')
  })
})

describe('revivir es un acto, y sus reglas', () => {
  it('sólo revive lo que está MUERTO', () => {
    /* Tocar una pendiente le reiniciaría el retroceso y la mandaría antes de
       tiempo contra un proveedor que quizá sigue caído. */
    expect(OUTBOX).toContain("if (d.estado !== 'muerto') return 'no_estaba_muerta'")
    expect(RUTA).toContain('status: 409')
  })

  it('pone los intentos a cero pero CONSERVA las pausas', () => {
    /**
     * Si los intentos no se reiniciaran, la entrada nacería agotada y volvería a
     * morir en el primer fallo. Las pausas cuentan otra cosa —cuántas veces no
     * estaba el proveedor— y borrarlas escondería que el problema era él.
     */
    expect(OUTBOX).toContain('intentos: 0,')
    const bloque = OUTBOX.slice(OUTBOX.indexOf('export async function revivirEntrada'))
    expect(bloque).not.toContain('pausas: 0')
    expect(POR_QUE_LAS_PAUSAS_NO_SE_BORRAN).toContain('del proveedor')
  })

  it('queda escrito quién la revivió y cuándo', () => {
    /* Una muerta que vuelve ya falló una vez: quien mire la cola después tiene
       que poder distinguirla de una entrada nueva. */
    expect(OUTBOX).toContain('revivida: { por: quien, cuando:')
  })

  it('y el porqué está escrito donde vive la cola', () => {
    expect(POR_QUE_REVIVIR_ES_UN_ACTO).toContain('duplicaria el mensaje')
  })
})

describe('la puerta es la que ya existía', () => {
  it('los dos métodos exigen `mensajeria.enviar`, como `/entregas`', () => {
    /**
     * La primera versión inventó dos puertas distintas. Un criterio de
     * autorización paralelo es dos partes decidiendo lo mismo con reglas
     * distintas — lo que este repositorio persigue por todas partes.
     */
    const veces = (RUTA.match(/verificarCapacidad\(req, clinicId, 'mensajeria\.enviar'\)/g) ?? []).length
    expect(veces).toBe(2)
    expect(RUTA).not.toContain('verificarMiembro')
    expect(RUTA).not.toContain("'clinico.escribir'")
  })

  it('la ruta está declarada en el registro', () => {
    /* Una ruta sin declarar es una ruta que nadie vigila: el guardián del
       registro la caza, y esto fija además CON QUÉ capacidad quedó. */
    expect(REGISTRO).toContain("'whatsapp/no-entregados': {")
    const bloque = REGISTRO.slice(REGISTRO.indexOf("'whatsapp/no-entregados'"), REGISTRO.indexOf("'whatsapp/no-entregados'") + 200)
    expect(bloque).toContain("capacidad: 'mensajeria.enviar'")
    /* Sanidad del import: si el registro cambiara de forma, esto lo nota. */
    expect(typeof ACCIONES_HOSPITAL_MUTAR).toBe('object')
  })
})

describe('la pantalla dice el riesgo ANTES del botón', () => {
  it('avisa de que puede duplicar', () => {
    /**
     * El médico tiene que saberlo antes de pulsar, no después. Un aviso que sólo
     * vive en el comentario del código no lo lee quien decide.
     */
    expect(PANTALLA).toContain('puede duplicar el mensaje')
    /* Se ancla en «Reintentando…», que sólo está en el botón: «Volver a
       intentar» aparece también dentro del propio aviso, y anclar ahí medía la
       distancia del aviso consigo mismo. */
    const i = PANTALLA.indexOf('puede duplicar el mensaje')
    const j = PANTALLA.indexOf('Reintentando…')
    expect(j).toBeGreaterThan(i)
  })

  it('distingue «no hay ninguno» de «no se pudo leer»', () => {
    expect(PANTALLA).toContain('Ningún mensaje se ha rendido')
    expect(PANTALLA).toContain('setMuertas(null)')
  })

  it('y el botón se puede pulsar con el dedo', () => {
    /* 44 px es el mínimo de la regla de diseño, y esto se usa en un teléfono. */
    const bloque = PANTALLA.slice(PANTALLA.indexOf('Reintentando…') - 700, PANTALLA.indexOf('Reintentando…'))
    expect(bloque).toContain('minHeight: 44')
  })
})

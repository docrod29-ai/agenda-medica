/**
 * GOLDEN — un consultorio podía quedarse con el canal de WhatsApp de otro.
 *
 * ── EL HUECO ─────────────────────────────────────────────────────────────────
 *
 * `whatsapp_channels/{id}` es el índice que usa el webhook para decidir **a qué
 * consultorio pertenece un mensaje entrante**. Los tres caminos de conexión
 * —`manual-connect`, `meta-connect` y el callback de 360dialog— lo escribían con
 * un `set()` plano, sin mirar de quién era.
 *
 * Si un segundo consultorio reclama un identificador ya tomado, el índice se
 * reescribe y **todos los mensajes entrantes de ese número pasan a entregarse en
 * el consultorio nuevo** — incluidos los de los pacientes del primero, que
 * siguen escribiendo al mismo teléfono de siempre.
 *
 * Es una fuga entre inquilinos por la puerta de atrás: nadie lee el expediente
 * de nadie, pero los mensajes de los pacientes de A acaban en la bandeja de B, y
 * el bot de B les contesta con la agenda de B.
 *
 * ── LO QUE ESTE GOLDEN VIGILA ────────────────────────────────────────────────
 *
 * Que la comprobación exista, que la usen **los tres** caminos —dejar uno sin
 * cubrir deja el agujero entero— y que la reconexión legítima siga funcionando.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (r: string) => readFileSync(join(process.cwd(), r), 'utf8')
const modulo = leer('src/lib/whatsapp/reclamar-canal.ts')

const CAMINOS = [
  'src/app/api/whatsapp/manual-connect/route.ts',
  'src/app/api/whatsapp/meta-connect/route.ts',
  'src/app/api/whatsapp/360dialog-callback/route.ts',
]

describe('LA REGLA: OCUPADO POR OTRO, NO SE RECLAMA', () => {
  it('se compara el dueño previo con quien reclama', () => {
    expect(modulo).toContain("if (dueño && dueño !== clinicId)")
  })

  it('y la reconexión del MISMO consultorio sigue permitida', () => {
    /**
     * Cambiar el token o reinstalar es normal. Bloquearlo dejaría a un cliente
     * legítimo sin poder arreglar su propia integración.
     */
    expect(modulo).toMatch(/Libre, o ya nuestro/)
  })

  it('si no se puede comprobar, NO se reclama (fail-closed)', () => {
    /**
     * Es justo el caso en el que el `set()` optimista causaba el daño: escribir
     * sin saber de quién era.
     */
    // REG-529: la lectura vive dentro de la transacción (`tx.get(ref)`), y el
    // fail-closed envuelve la transacción entera. Se busca desde la lectura.
    const i = modulo.indexOf('previo = await tx.get(ref)')
    expect(i, 'la lectura ya no está dentro de la transacción').toBeGreaterThan(-1)
    const bloque = modulo.slice(i, i + 1600)
    expect(bloque).toContain('ok: false')
    expect(bloque).toMatch(/No se pudo comprobar/)
  })
})

describe('LOS TRES CAMINOS ESTÁN CUBIERTOS — dejar uno abre el agujero entero', () => {
  /**
   * Escritos uno a uno y no en un bucle: el guardián de seguridad clínica cuenta
   * los `it(` de forma ESTÁTICA, así que un bucle sobre una tabla cuenta como un
   * solo caso y el sello dejaría de reflejar lo que de verdad se comprueba.
   */
  const manual = leer(CAMINOS[0])
  const meta = leer(CAMINOS[1])
  const dialog = leer(CAMINOS[2])

  it('manual-connect usa la comprobación', () => {
    expect(manual).toContain('reclamarCanal(')
    expect(manual).toContain('if (!reclamo.ok)')
  })

  it('manual-connect ya no escribe el índice a pelo', () => {
    expect(manual).not.toMatch(/collection\('whatsapp_channels'\)\.doc\([^)]*\)\.set\(/)
  })

  it('meta-connect usa la comprobación', () => {
    expect(meta).toContain('reclamarCanal(')
    expect(meta).toContain('if (!reclamo.ok)')
  })

  it('meta-connect ya no escribe el índice a pelo', () => {
    expect(meta).not.toMatch(/collection\('whatsapp_channels'\)\.doc\([^)]*\)\.set\(/)
  })

  it('el callback de 360dialog usa la comprobación', () => {
    expect(dialog).toContain('reclamarCanal(')
    expect(dialog).toContain('if (!reclamo.ok)')
  })

  it('el callback de 360dialog ya no escribe el índice a pelo', () => {
    expect(dialog).not.toMatch(/collection\('whatsapp_channels'\)\.doc\([^)]*\)\.set\(/)
  })
})

describe('SE RECHAZA DICIENDO QUÉ HACER', () => {
  it('el mensaje explica que hay que desconectarlo desde el otro consultorio', () => {
    // Un 409 sin explicación deja al cliente sin saber qué hacer.
    expect(modulo).toMatch(/desconectarlo desde ahí antes de conectarlo aquí/)
  })

  it('y liberar el canal sigue teniendo su camino propio', () => {
    // `whatsapp-disconnect` lo borra desde el consultorio dueño.
    const desconectar = leer('src/app/api/clinic/whatsapp-disconnect/route.ts')
    expect(desconectar).toContain("collection('whatsapp_channels')")
    expect(desconectar).toContain('.delete()')
  })
})

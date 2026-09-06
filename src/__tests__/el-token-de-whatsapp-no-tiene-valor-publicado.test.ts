/**
 * GUARDIÁN — REG-508. El producto le decía al médico qué token teclear en Meta,
 * y ese token no era el que el servidor iba a aceptar.
 *
 * ── QUÉ FALLABA, Y CÓMO SE DESCUBRIÓ ────────────────────────────────────────
 *
 * Salió del inventario de variables de entorno: `WHATSAPP_VERIFY_TOKEN` y
 * `WHATSAPP_WEBHOOK_TOKEN` son alias a propósito —los dos caminos aceptan
 * cualquiera de los dos—, pero el literal `'agenda-medica-bot'` aparecía en dos
 * sitios y **el servidor no lo acepta en ninguno**.
 *
 * `whatsapp/webhook` ya había tomado la decisión correcta y la dejó escrita:
 * *«Sin fallback público: si no está configurado, la verificación GET fallará
 * (mejor que aceptar un token por defecto que está en el repo)»*. Su
 * `VERIFY_TOKEN` cae a `''` y rechaza.
 *
 * A los otros dos sitios no les llegó ese arreglo:
 *
 *  1. `whatsapp/meta-connect` declaraba `WEBHOOK_VERIFY_TOKEN` con ese literal
 *     de respaldo **y no lo usaba en ninguna parte**: `registerWebhook` hace
 *     `POST /{wabaId}/subscribed_apps`, donde no viaja ningún token. Código
 *     muerto cargando un secreto adivinable, que además hacía creer a quien
 *     leyera el archivo que aquí se acordaba algo con Meta.
 *  2. **Y la pantalla de Configuración lo IMPRIMÍA como instrucción**: «Token de
 *     verificación: `agenda-medica-bot`». Eso sí lo veía el médico.
 *
 * ── POR QUÉ IMPORTA ─────────────────────────────────────────────────────────
 *
 * Las dos salidas eran malas, y no había una tercera:
 *
 * · Con `WHATSAPP_WEBHOOK_TOKEN` puesta a otra cosa —lo normal—, seguir la
 *   instrucción de la pantalla hacía que **Meta no verificara el webhook**. El
 *   síntoma («no me llegan los mensajes de WhatsApp») no se parece a la causa
 *   («la pantalla me dictó un token que el servidor no acepta»), y el bot de
 *   pacientes se queda mudo sin que nadie sepa por qué.
 * · Con la variable puesta a ese literal, el secreto compartido con Meta estaba
 *   **publicado en la propia pantalla y en el repositorio**.
 *
 * ── QUÉ NO CUBRE ────────────────────────────────────────────────────────────
 *
 * · **No comprueba que el valor de Vercel y el del panel de Meta coincidan.**
 *   Eso es exactamente lo que no puede vivir aquí: son dos consolas. Lo único
 *   que se puede hacer desde el repositorio es dejar de dictar un valor falso.
 * · **No vigila otros literales** que alguien pudiera inventar mañana: vigila
 *   éste, que es el que existió, y que la lectura del webhook siga sin respaldo.
 * · No prueba el camino de alta de WhatsApp de punta a punta.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const LITERAL = 'agenda-medica-bot'
const webhook = readFileSync('src/app/api/whatsapp/webhook/route.ts', 'utf8')
const conector = readFileSync('src/app/api/whatsapp/meta-connect/route.ts', 'utf8')
const pantalla = readFileSync('src/app/(dashboard)/configuracion/page.tsx', 'utf8')

/** Las líneas de CÓDIGO de un archivo: sin prosa, que aquí sí habla del literal. */
const codigoDe = (fuente: string): string => fuente
  .split('\n')
  .filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
  .join('\n')

describe('REG-508 · el token de verificación de WhatsApp no tiene valor publicado', () => {
  it('el literal no vive en ningún código del árbol', () => {
    /**
     * Se busca en TODO `src/`, no sólo en los tres archivos conocidos: el
     * defecto ya había aparecido en dos sitios distintos, y el tercero sería
     * igual de invisible.
     *
     * Se excluyen las PRUEBAS —este mismo archivo tiene que nombrar el literal
     * para poder buscarlo—, y eso deja un hueco declarado: una prueba que
     * reintrodujera el valor no saltaría aquí. No se despliega, así que no es un
     * secreto publicado; pero se dice en vez de callarlo.
     */
    const encontrados = execSync(
      `grep -rn "${LITERAL}" src --include=*.ts --include=*.tsx --exclude-dir=__tests__ || true`,
      { encoding: 'utf8' },
    )
      .trim().split('\n').filter(Boolean)
      // Los comentarios que EXPLICAN el defecto sí lo nombran, y deben poder.
      .filter(l => {
        const texto = l.slice(l.indexOf(':', l.indexOf(':') + 1) + 1)
        return !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(texto)
      })
    expect(encontrados, 'un token de verificación escrito en el código es un secreto publicado').toEqual([])
  })

  it('la pantalla nombra la variable y no dicta un valor', () => {
    expect(pantalla).toContain('WHATSAPP_WEBHOOK_TOKEN')
    expect(codigoDe(pantalla)).not.toContain(LITERAL)
  })

  it('el webhook sigue sin respaldo: sin variable, rechaza', () => {
    /**
     * Ésta es la decisión que ya estaba bien tomada y que no se puede perder al
     * limpiar lo demás. Si alguien le pusiera un respaldo, el candado entero se
     * abriría — y ninguna otra prueba lo notaría.
     */
    expect(codigoDe(webhook)).toContain("process.env.WHATSAPP_VERIFY_TOKEN || ''")
  })

  it('el conector ya no declara un token que nunca usó', () => {
    /**
     * `registerWebhook` sólo hace `POST …/subscribed_apps`. Si vuelve a aparecer
     * una constante de token en este archivo, o es código muerto otra vez o
     * alguien cree que por aquí se configura Meta — y no se configura.
     */
    expect(codigoDe(conector)).not.toContain('WEBHOOK_VERIFY_TOKEN')
    expect(conector).toContain('subscribed_apps')
  })

  it('AL REVÉS: si el literal volviera al código, se detecta', () => {
    /**
     * La prueba del guardián. Se reproduce la línea exacta que tenía la pantalla
     * y se comprueba que el filtro de prosa NO la deja pasar — si lo hiciera,
     * los casos de arriba estarían pasando por la razón equivocada.
     */
    const comoEstaba = `          Token de verificación: <code>${LITERAL}</code>`
    expect(codigoDe(comoEstaba)).toContain(LITERAL)

    const comoUnComentario = `          * Token de verificación: ${LITERAL}`
    expect(codigoDe(comoUnComentario)).not.toContain(LITERAL)
  })
})

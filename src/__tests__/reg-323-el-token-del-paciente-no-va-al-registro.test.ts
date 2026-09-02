/**
 * GOLDEN — REG-323: el enlace del paciente viajaba ENTERO al registro de errores.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * `/api/errores` guarda la ruta del fallo, y la redacta con `redactarRuta` para
 * no llevarse el identificador del paciente (REG anterior, `errores-sin-phi`).
 * Esa redacción tenía dos huecos y los dos apuntaban al mismo sitio:
 *
 *  1. El segmento `mi` no estaba en la lista de segmentos con identificador.
 *  2. La heurística de identificador exigía `^[A-Za-z0-9_-]+$`, y el token del
 *     portal es `base64url(payload).base64url(firma)` — **el punto la
 *     esquivaba**.
 *
 * Resultado: un error no atrapado en `/mi/<token>` mandaba el token completo a
 * la colección RAÍZ `errores`, legible desde `/superadmin/errores`.
 *
 * Y `/mi/<token>` no es una ruta con un identificador dentro: el token **ES la
 * sesión del paciente**. Quien tenga esa cadena abre el expediente. Esto no es
 * PHI filtrada por descuido: es una credencial de portador copiada a un canal
 * de diagnóstico con otro control de acceso.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Inventariando el camino de pantalla blanca para #310. `src/app/mi/` no tiene
 * `error.tsx`, así que un fallo de componente ahí sube hasta
 * `src/app/global-error.tsx` — que sí reporta, y con `sinSesion: true`. Al
 * seguir qué se reportaba exactamente apareció `window.location.pathname`, y
 * con él el token.
 *
 * Las mismas familias quedaban abiertas en `/resena/[token]`,
 * `/verificar/[token]` y `/unirse/[code]`.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * Dos capas, porque una sola vuelve a fallar en cuanto aparezca una ruta nueva:
 *
 *  · los segmentos de cara al paciente se declaran: lo que sigue a `mi`,
 *    `resena`, `verificar`, `unirse`, `reservar` o `teleconsulta` es una
 *    credencial y se borra;
 *  · **cualquier** segmento con forma de token firmado (`algo.algo` en
 *    base64url, las dos mitades largas) se borra, esté donde esté y lo haya
 *    declarado alguien o no.
 *
 * Y se conserva la FORMA: `/mi/:id` sigue diciendo qué pantalla falló.
 *
 * ── LO QUE **NO** CUBRE ──────────────────────────────────────────────────────
 *
 * No impide que un token llegue por otro camino: sigue viajando en la URL del
 * navegador, en el historial y en cualquier `Referer` que salga del dominio.
 * Sacar el token de la URL es un cambio de arquitectura del portal —queda como
 * hallazgo P1 en `docs/reliability/HOT-PATH-INVENTORY.md`—; esto tapa el canal
 * que además lo PERSISTÍA en una colección raíz.
 *
 * Tampoco cubre rutas de cara al paciente que se creen mañana con otro nombre:
 * para ésas queda la segunda capa, la de la forma del token.
 */
import { describe, it, expect } from 'vitest'
import { redactarRuta } from '@/lib/security/sanitize'

/** Forma real: `base64url(payload).base64url(hmacSHA256)`, de `lib/patient-token.ts`. */
const TOKEN = 'eyJwIjoicF8xIiwiYyI6ImNsaW5pY19hIn0.aBcD3fGhIjKlMnOpQrStUvWxYz0123456789abcd'

describe('REG-323 · el enlace del paciente no acaba en el registro de errores', () => {
  it('el portal del paciente pierde el token y conserva la pantalla', () => {
    expect(redactarRuta(`/mi/${TOKEN}`)).toBe('/mi/:id')
  })

  it('AL REVÉS: la heurística de identificador SOLA no lo cazaba', () => {
    // Ésta es la prueba que demuestra que el arreglo hacía falta. El punto del
    // token rompe el patrón, así que el segmento pasaba entero.
    const heuristicaVieja = (seg: string) =>
      seg.length >= 12 && /^[A-Za-z0-9_-]+$/.test(seg) && /\d/.test(seg) && /[A-Za-z]/.test(seg)
    expect(heuristicaVieja(TOKEN)).toBe(false)
  })

  it('las otras tres rutas de token quedaban igual de abiertas', () => {
    expect(redactarRuta(`/resena/${TOKEN}`)).toBe('/resena/:id')
    expect(redactarRuta(`/verificar/${TOKEN}`)).toBe('/verificar/:id')
    expect(redactarRuta('/unirse/K3M9XP2QR7LS')).toBe('/unirse/:id')
  })

  it('LA LISTA sola basta: un token SIN punto en una ruta de paciente también se borra', () => {
    /**
     * ── POR QUÉ ESTE CASO EXISTE ──────────────────────────────────────────
     *
     * El arreglo tiene DOS mitades independientes: la lista de segmentos de
     * cara al paciente, y la detección de token firmado. Los demás casos de
     * este archivo pasan con cualquiera de las dos, así que **quitar la lista
     * los dejaba todos en verde** — probado al revés, y por eso se añadió.
     *
     * Este token no tiene punto, no llega a doce caracteres con dígito, y por
     * tanto NO lo cazan ni `pareceTokenFirmado` ni la heurística de id. Sólo lo
     * tapa la lista. Si alguien la poda por parecer redundante, esto se pone
     * rojo y le dice por qué no lo era.
     *
     * Y no es hipotético: nada obliga a que el token del portal lleve firma
     * separada por un punto. Un token opaco es una forma perfectamente normal
     * de emitir una credencial, y sigue siendo la sesión del paciente.
     */
    expect(redactarRuta('/mi/abcdefghijklmnop')).toBe('/mi/:id')
    expect(redactarRuta('/resena/opaquetokenaqui')).toBe('/resena/:id')
  })

  it('un token firmado se borra aunque nadie hubiera declarado su segmento', () => {
    // Segunda capa: la ruta de mañana no está en ninguna lista.
    expect(redactarRuta(`/ruta/que/no/existe/todavia/${TOKEN}`)).toBe('/ruta/que/no/existe/todavia/:id')
  })

  it('el agendado público del paciente tampoco expone la clínica en claro', () => {
    expect(redactarRuta('/reservar/AbC123XyZ456')).toBe('/reservar/:id')
    expect(redactarRuta('/teleconsulta/8x2Kd9Lm0Qw1')).toBe('/teleconsulta/:id')
  })

  it('lo inocuo NO se estropea: un redactor que rompe el informe se acaba apagando', () => {
    expect(redactarRuta('/favicon.ico')).toBe('/favicon.ico')
    expect(redactarRuta('/sitemap.xml')).toBe('/sitemap.xml')
    expect(redactarRuta('/pdf.worker.min.mjs')).toBe('/pdf.worker.min.mjs')
    expect(redactarRuta('/precios')).toBe('/precios')
    expect(redactarRuta('/mi')).toBe('/mi')            // sin token detrás, no hay nada que borrar
  })

  it('y lo que ya funcionaba sigue funcionando', () => {
    expect(redactarRuta('/consulta/AbC123XyZ456')).toBe('/consulta/:id')
    expect(redactarRuta('/expediente/8x2Kd9Lm0Qw1/labs')).toBe('/expediente/:id/labs')
    expect(redactarRuta('/agenda?dia=2026-08-04&paciente=Juan')).toBe('/agenda?…')
  })
})

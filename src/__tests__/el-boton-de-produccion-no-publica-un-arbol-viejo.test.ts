/**
 * EL BOTÓN DE PRODUCCIÓN NO PUEDE PUBLICAR UN ÁRBOL ATRASADO EN SILENCIO.
 *
 * QUÉ FALLABA
 * ────────────
 * `deploy-production.yml` hace checkout de `SHA_AUTORIZADO`, un pin escrito a
 * mano — no de `main`. Sus tres compuertas comprobaban el sha contra sí mismo,
 * el proyecto de Vercel, y que producción sirviera `VERSION_ESPERADA`.
 *
 * Ninguna de las tres puede detectar que el pin haya envejecido: mientras
 * `public/version.txt` no cambie, la MISMA cadena («nexusmed-v1175») describe
 * árboles distintos. La compuerta de versión pasa igual de rápido con el árbol
 * al día que con uno atrasado.
 *
 * CÓMO SE DESCUBRIÓ
 * ──────────────────
 * El 31-ago, contestando «¿ya se puede desplegar?». Producción se había
 * publicado esa madrugada desde `ee1b3632`; para cuando se miró, `main` iba 87
 * commits por delante y el pin seguía en `ee1b3632`. Las tres compuertas
 * pasaban. Aquel día no hizo daño porque las reglas del pin coincidían con las
 * de `main` — se comprobó, no se supuso.
 *
 * CAUSA RAÍZ
 * ───────────
 * Una compuerta anclada en un dato que no cambia cuando cambia lo que vigila.
 * `version.txt` es una copia del propio repositorio: no puede detectar deriva.
 *
 * POR QUÉ IMPORTA MÁS QUE UN DESPLIEGUE CUALQUIERA
 * ─────────────────────────────────────────────────
 * Este workflow es el ÚNICO que publica `firestore.rules`, que es la frontera de
 * aislamiento entre consultorios. Publicar las reglas de un árbol viejo con todo
 * en verde es exactamente la clase de fallo que no avisa.
 *
 * LA REGLA QUE LO HACE SEGURO
 * ────────────────────────────
 * El pin se conserva —es el acto de autorización del dueño— pero se le exige ser
 * la cabeza de `main`. El rollback deliberado sigue siendo posible declarando el
 * mismo sha en `ROLLBACK_AUTORIZADO`: la excepción se ve en el diff.
 *
 * QUÉ *NO* CUBRE
 * ───────────────
 * - No comprueba qué árbol sirve producción AHORA. Eso sigue siendo el punto
 *   ciego, y sigue declarado en `ESTADO-DE-PRODUCCION-2026-08-31.md`.
 * - Compara identidad de sha, no equivalencia de contenido.
 * - No prueba el YAML: prueba la DECISIÓN. Que el workflow llame a esto con los
 *   valores correctos lo cubre el caso del final, que lee el archivo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { decidirArbolAutorizado } from '../../scripts/ops/arbol-autorizado.mjs'

const CABEZA = 'f270cefc0c0c3666d6cad0ca90a101be3cd1f91a'
const VIEJO = 'ee1b363225082c88ce5ddcfbc7401a8c6dbe7206'

describe('la compuerta del árbol autorizado', () => {
  it('deja pasar cuando el pin ES la cabeza de main', () => {
    const v = decidirArbolAutorizado({ shaAutorizado: CABEZA, cabezaDeMain: CABEZA })
    expect(v.ok).toBe(true)
    expect(v.nivel).toBe('ok')
  })

  it('PARA cuando el pin está por detrás Y difiere en lo que se publica', () => {
    const v = decidirArbolAutorizado({
      shaAutorizado: VIEJO, cabezaDeMain: CABEZA, commitsDetras: 87,
      publicablesQueDifieren: ['firestore.rules'],
    })
    expect(v.ok).toBe(false)
    expect(v.nivel).toBe('error')
    // El mensaje tiene que decir CUÁNTO, o no se sabe si es un commit o cien.
    expect(v.motivo).toContain('87 commits por detrás')
    // Y CUÁL difiere, o hay que ir a buscarlo a mano.
    expect(v.motivo).toContain('firestore.rules')
  })

  it('DEJA PASAR un pin atrasado cuando nada de lo publicable cambió — el caso real del 31-ago', () => {
    // 87 commits detrás y las reglas byte a byte idénticas: publicar desde el pin
    // equivale a publicar desde la cabeza. La versión anterior de esta compuerta
    // lo paraba, y por eso era inusable: al fusionar un PR, el commit de merge
    // deja el pin atrás sin que nada peligroso haya cambiado.
    const v = decidirArbolAutorizado({
      shaAutorizado: VIEJO, cabezaDeMain: CABEZA, commitsDetras: 87,
      publicablesQueDifieren: [],
    })
    expect(v.ok).toBe(true)
    expect(v.motivo).toContain('idéntico')
  })

  it('PARA si no se pudo comparar lo publicable — no se sabe NO es coincide', () => {
    const v = decidirArbolAutorizado({
      shaAutorizado: VIEJO, cabezaDeMain: CABEZA, commitsDetras: 87,
      publicablesQueDifieren: null,
    })
    expect(v.ok).toBe(false)
    expect(v.motivo).toContain('NO se pudo comparar')
  })

  it('nombra TODOS los publicables que difieren, no sólo el primero', () => {
    const v = decidirArbolAutorizado({
      shaAutorizado: VIEJO, cabezaDeMain: CABEZA,
      publicablesQueDifieren: ['firestore.rules', 'public/sw.js'],
    })
    expect(v.motivo).toContain('firestore.rules')
    expect(v.motivo).toContain('public/sw.js')
  })

  it('PARA cuando el pin ni siquiera está en la historia de main', () => {
    // Peor que atrasado: son las reglas de una rama que nadie fusionó.
    const v = decidirArbolAutorizado({
      shaAutorizado: VIEJO, cabezaDeMain: CABEZA, esAncestroDeMain: false,
      publicablesQueDifieren: [],
    })
    expect(v.ok).toBe(false)
    expect(v.motivo).toContain('NO está en la historia de main')
  })

  it('permite el rollback SÓLO si se declara ese mismo sha, y lo dice en voz alta', () => {
    const v = decidirArbolAutorizado({
      shaAutorizado: VIEJO, cabezaDeMain: CABEZA, rollbackAutorizado: VIEJO, commitsDetras: 87,
    })
    expect(v.ok).toBe(true)
    expect(v.nivel).toBe('aviso')          // pasa, pero nunca en silencio
    expect(v.motivo).toContain('ROLLBACK DECLARADO')
  })

  it('un rollback declarado para OTRO sha no autoriza éste', () => {
    // Si el pin cambia y nadie actualiza la excepción, la excepción caduca sola.
    const v = decidirArbolAutorizado({
      shaAutorizado: VIEJO, cabezaDeMain: CABEZA, rollbackAutorizado: CABEZA,
      publicablesQueDifieren: ['firestore.rules'],
    })
    expect(v.ok).toBe(false)
  })

  it('un sha que no se pudo leer PARA — ausencia de dato no es dato de ausencia', () => {
    for (const caso of [
      { shaAutorizado: '', cabezaDeMain: CABEZA },
      { shaAutorizado: CABEZA, cabezaDeMain: '' },
      { shaAutorizado: undefined as unknown as string, cabezaDeMain: CABEZA },
    ]) {
      const v = decidirArbolAutorizado(caso)
      expect(v.ok).toBe(false)
      expect(v.motivo).toContain('No se pudo leer')
    }
  })

  it('un rollback vacío no autoriza nada aunque el pin también lo parezca', () => {
    // Con '' == '' un `if (a === b)` mal escrito dejaría pasar cualquier cosa.
    const v = decidirArbolAutorizado({
      shaAutorizado: VIEJO, cabezaDeMain: CABEZA, rollbackAutorizado: '',
      publicablesQueDifieren: ['firestore.rules'],
    })
    expect(v.ok).toBe(false)
  })
})

describe('el workflow de producción usa esa compuerta de verdad', () => {
  // Una decisión perfecta que nadie llama no protege nada: esto es
  // «lo escrito y sin conectar» aplicado a un YAML.
  const yaml = readFileSync('.github/workflows/deploy-production.yml', 'utf8')

  it('llama a la compuerta 0 antes de tocar las reglas de Firestore', () => {
    expect(yaml).toContain('arbol-autorizado.mjs')
    const compuerta = yaml.indexOf('arbol-autorizado.mjs')
    const reglas = yaml.indexOf('firestore:rules')
    expect(compuerta).toBeGreaterThan(-1)
    expect(reglas).toBeGreaterThan(-1)
    expect(compuerta).toBeLessThan(reglas)
  })

  it('declara ROLLBACK_AUTORIZADO, y vacío por defecto', () => {
    expect(yaml).toMatch(/ROLLBACK_AUTORIZADO:\s*''/)
  })

  it('calcula de verdad qué publicables difieren, y se los pasa a la decisión', () => {
    // Una decisión que sabe comparar contenido no sirve de nada si el workflow
    // no le pasa el dato. «Escrito y sin conectar», aplicado a un YAML.
    for (const f of ['firestore.rules', 'firestore.indexes.json', 'public/version.txt', 'public/sw.js']) {
      expect(yaml).toContain(f)
    }
    expect(yaml).toContain('PUBLICABLES_DIFIEREN')
    expect(yaml).toContain('git diff --quiet')
  })

  it('lee la compuerta desde main, no desde el árbol que va a publicar', () => {
    // Si la leyera del checkout, un árbol viejo traería su propia compuerta
    // vieja — y una compuerta que viaja con lo que vigila no vigila nada.
    expect(yaml).toContain('FETCH_HEAD:scripts/ops/arbol-autorizado.mjs')
  })
})

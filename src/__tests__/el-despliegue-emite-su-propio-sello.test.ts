/**
 * GOLDEN — REG-415: EL SELLO DE LAS REGLAS DEPENDÍA DE QUE ALGUIEN SE ACORDARA.
 *
 * ── QUÉ FALLABA ──────────────────────────────────────────────────────────────
 *
 * REG-340 cerró la mitad del problema: `firestore.rules.estado.json` guarda el
 * sha256 de las reglas confirmadas desplegadas, y
 * `las-reglas-escritas-no-son-las-que-rigen.test.ts` compara ese hash con el de
 * hoy. Si no coinciden, el documento tiene que decir qué no rige.
 *
 * La mitad que quedaba abierta era **cómo se rellena ese hash**. El despliegue
 * publicaba las reglas y no dejaba dicho en ninguna parte QUÉ había publicado:
 * alguien tenía que acordarse de correr `sha256sum` sobre el árbol correcto,
 * después, a mano, y pegarlo. Cuando eso no pasa —y no pasó en las ejecuciones
 * #11 y #12 del 31-ago— el sello se queda vacío, el guardián exige una lista de
 * pendientes, y el repositorio pasa a declarar rotas unas reglas que ya rigen.
 *
 * El fallo no es un dato equivocado: es un documento que **asusta con un hueco
 * ya cerrado**. Cuesta lo mismo que el contrario, porque la siguiente sesión que
 * lo lea intentará desplegar algo que ya está desplegado.
 *
 * ── CÓMO SE DESCUBRIÓ ────────────────────────────────────────────────────────
 *
 * Revisando por qué `main` seguía diciendo que `clinics/{id}/members/{uid}` no
 * tenía regla desplegada, cuando el acta de v1177 registraba
 * `FIRESTORE_RULES = success` sobre `8f74901d` — un árbol cuyo `firestore.rules`
 * es byte a byte el de hoy. Las dos cosas eran ciertas y se contradecían: el
 * despliegue había ocurrido y el registro del despliegue no se había escrito.
 *
 * ── LA CAUSA RAÍZ ────────────────────────────────────────────────────────────
 *
 * `depende_de_recordar`, otra vez, un escalón más arriba. REG-340 quitó la
 * memoria del *estado* (ahora se deriva del hash) y la dejó en el *acto de
 * registrarlo*. Un paso manual al final de un despliegue es un paso que se salta.
 *
 * ── LA REGLA QUE LO HACE SEGURO ──────────────────────────────────────────────
 *
 * **El que publica es el que sella.** El paso «Firestore · emitir el sello de
 * las reglas» corre justo después del despliegue, calcula el sha256 del
 * `firestore.rules` **que acaba de publicar** —el del árbol de `SHA_AUTORIZADO`,
 * porque el checkout es ése— y lo escribe en el acta de la ejecución. Rellenar
 * el sello pasa a ser copiar tres líneas, no reconstruir un dato.
 *
 * Este guardián existe para lo que viene después: que ese paso **no se pueda
 * borrar en silencio**. Un paso de workflow que nadie vigila desaparece en el
 * primer refactor del YAML, y su desaparición no rompe nada visible — vuelve a
 * romper esto, meses más tarde.
 *
 * ── QUÉ NO CUBRE, DECLARADO ──────────────────────────────────────────────────
 *
 * · **No comprueba producción.** Como el guardián hermano: mira el texto del
 *   workflow, no lo que Firebase tiene publicado. Nada puede preguntárselo desde
 *   aquí.
 * · **No obliga a pegar el sello.** Emitirlo es automático; copiarlo sigue
 *   siendo un acto humano, y a propósito: el archivo dice que el hash no se
 *   toca sin haber desplegado, y un workflow que se auto-commitea el registro
 *   convertiría el sello en algo que se escribe solo.
 * · **No cubre los índices**, que van en el mismo comando y NO terminan con él:
 *   `--only firestore:indexes` contesta al enviar. Eso se mira en la consola.
 * · **No valida las reglas**: que estén desplegadas no dice que sean correctas.
 *   Eso es la suite del emulador.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const RUTA_WORKFLOW = '.github/workflows/deploy-production.yml'
const RUTA_ESTADO = 'firestore.rules.estado.json'

const workflow = readFileSync(RUTA_WORKFLOW, 'utf8')
const estado = JSON.parse(readFileSync(RUTA_ESTADO, 'utf8')) as { comoSeActualiza: string }

/**
 * Derivado del texto del workflow, no de una lista de nombres de pasos: lo que
 * importa es que las cuatro cosas OCURRAN, no cómo se llame el paso que lo hace.
 */
function analizar(yaml: string) {
  return {
    /** Publica las reglas. Si esto cae, no hay nada que sellar. */
    publica: /firebase deploy --only firestore:rules/.test(yaml),
    /** Emite el sello, y lo emite DESPUÉS del despliegue. */
    emite: /sha256sum\s+firestore\.rules/.test(yaml),
    /** Del archivo publicado, no de una constante pegada a mano. */
    derivaElHash: /HASH="\$\(sha256sum\s+firestore\.rules[^)]*\)"/.test(yaml),
    /** Y queda en el acta, que es el registro que sobrevive a la ejecución. */
    loDeclaraElActa: /FIRESTORE_RULES_SHA256=/.test(yaml),
    /** El acta no cierra en SUCCESS si el despliegue de reglas no fue. */
    elActaExigeElPaso: /\[ "\$R_RULES" = success \]/.test(yaml),
  }
}

describe('REG-415 — EL QUE PUBLICA LAS REGLAS ES EL QUE LAS SELLA', () => {
  const hoy = analizar(workflow)

  it('el despliegue publica firestore.rules', () => {
    expect(hoy.publica, `${RUTA_WORKFLOW} ya no publica las reglas`).toBe(true)
  })

  it('EL CASO: y emite el sello de lo que acaba de publicar', () => {
    expect(
      hoy.emite,
      'El paso que emite el sello desapareció de ' + RUTA_WORKFLOW + '. Sin él, ' +
      'rellenar firestore.rules.estado.json vuelve a depender de que alguien ' +
      'calcule el sha256 a mano después de desplegar — que es exactamente cómo ' +
      'el sello se quedó vacío tras las ejecuciones #11 y #12.',
    ).toBe(true)
  })

  it('el hash se DERIVA del archivo, no se pega como constante', () => {
    // Un hash escrito a mano en el YAML sería el mismo defecto con otra cara:
    // diría lo que alguien creyó publicar, no lo que se publicó.
    expect(hoy.derivaElHash).toBe(true)
  })

  it('y el acta lo deja escrito, que es lo que sobrevive a la ejecución', () => {
    expect(hoy.loDeclaraElActa).toBe(true)
  })

  it('el acta no puede cerrar en SUCCESS si el despliegue de reglas no fue', () => {
    expect(hoy.elActaExigeElPaso).toBe(true)
  })

  it('el registro remite al paso, para que quien lo borre encuentre la referencia', () => {
    expect(estado.comoSeActualiza).toContain('emitir el sello de las reglas')
  })

  describe('EL CEDAZO SABE FALLAR — probado al revés sobre workflows mutilados', () => {
    it('borrar el paso del sello se detecta', () => {
      const mutilado = workflow.replace(/HASH="\$\(sha256sum[^\n]*\n/, '')
      expect(analizar(mutilado).emite).toBe(false)
    })

    it('borrar el despliegue de las reglas se detecta', () => {
      const mutilado = workflow.replace(/--only firestore:rules,firestore:indexes/g, '--only hosting')
      expect(analizar(mutilado).publica).toBe(false)
    })

    it('cambiar el hash derivado por una constante pegada se detecta', () => {
      const mutilado = workflow.replace(
        /HASH="\$\(sha256sum[^\n]*/,
        'HASH="3032001e141c42eb835674b9219f17a91e491d38f7a7cb55a77177ecbe0e90a9"',
      )
      expect(analizar(mutilado).derivaElHash).toBe(false)
    })

    it('quitar el sello del acta se detecta', () => {
      const mutilado = workflow.replace(/FIRESTORE_RULES_SHA256=/g, 'NADA=')
      expect(analizar(mutilado).loDeclaraElActa).toBe(false)
    })

    it('dejar que el acta cierre en verde sin el paso de Firestore se detecta', () => {
      const mutilado = workflow.replace('[ "$R_RULES" = success ] && ', '')
      expect(analizar(mutilado).elActaExigeElPaso).toBe(false)
    })
  })
})

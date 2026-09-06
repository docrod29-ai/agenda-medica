/**
 * ¿EL ÁRBOL QUE SE VA A PUBLICAR ES EL DE HOY?
 *
 * QUÉ PASABA
 * ───────────
 * `deploy-production.yml` fija `SHA_AUTORIZADO` a mano y hace checkout de ESE
 * árbol — no de `main`. La compuerta que debía protegerlo comprobaba que
 * producción sirviera `VERSION_ESPERADA`, y eso NO detecta una deriva: mientras
 * `public/version.txt` no se mueva, la misma cadena («nexusmed-v1175») describe
 * árboles distintos.
 *
 * El 31-ago el pin llevaba 87 commits de retraso y las tres compuertas pasaban.
 * Ese día no hizo daño porque las reglas del pin coincidían con las de `main`.
 * El día que no coincidan, se publican LAS REGLAS VIEJAS con todo en verde — y
 * `firestore.rules` es la frontera de aislamiento entre consultorios.
 *
 * POR QUÉ NO SE ARREGLA «DESPLEGANDO MAIN Y YA»
 * ──────────────────────────────────────────────
 * El pin no es un descuido: es el acto de autorización del dueño sobre un árbol
 * concreto, y el workflow no tiene inputs a propósito («para evitar errores de
 * pegado»). Se conserva el pin y se le exige que esté al día.
 *
 * SE COMPARA LO QUE ESTE WORKFLOW PUBLICA, NO LA IDENTIDAD DEL SHA
 * ─────────────────────────────────────────────────────────────────
 * La primera versión exigía que el pin FUERA la cabeza de `main`. Cazaba el
 * fallo, pero era inusable: al fusionar un PR, el commit de merge mueve `main`
 * por delante del pin que ese mismo PR acaba de escribir. Ocurrió TRES veces en
 * una tarde —87, 5 y 2 commits de retraso— y ninguna de las tres era peligrosa.
 *
 * Una compuerta que salta siempre acaba desactivada o rodeada, y entonces no
 * protege nada. Así que se compara lo que de verdad importa: este workflow
 * publica `firestore.rules` y `firestore.indexes.json`, y certifica
 * `version.txt` y `sw.js`. Si esos cuatro son idénticos entre el pin y la
 * cabeza, publicar desde el pin es EQUIVALENTE a publicar desde la cabeza.
 *
 * Con esto, el caso real del 31-ago —87 commits detrás, reglas idénticas—
 * habría pasado legítimamente; y un pin atrasado CON REGLAS DISTINTAS se sigue
 * parando, que es el fallo que perseguíamos.
 *
 * No es más laxa: es más precisa. Antes comparaba nombres; ahora, contenido.
 *
 * EL ROLLBACK SIGUE SIENDO POSIBLE, PERO DEJA DE SER SILENCIOSO
 * ──────────────────────────────────────────────────────────────
 * Publicar un árbol anterior a propósito es legítimo. Ahora hay que declararlo
 * poniendo el MISMO sha en `ROLLBACK_AUTORIZADO`: la excepción queda escrita en
 * el archivo y se ve en el diff, en vez de esconderse en un pin que envejeció.
 *
 * LO QUE ESTA DECISIÓN *NO* PRUEBA
 * ─────────────────────────────────
 * - No comprueba qué árbol sirve producción AHORA. Eso sigue sin poder saberse
 *   desde el repositorio mientras la cadena de versión no se mueva; esto sólo
 *   garantiza que lo que se AUTORIZA es la cabeza, no lo que ya está publicado.
 * - Sólo mira los CUATRO archivos que este workflow publica o certifica. Dos
 *   árboles con esos cuatro idénticos pasan aunque todo lo demás difiera —y
 *   eso es correcto, porque lo demás no lo publica este botón: lo publica la
 *   integración de Vercel, que va por su cuenta.
 * - No compara el contenido servido por producción: sigue siendo el punto
 *   ciego, y sigue declarado.
 * - No sustituye a las compuertas 1-3; se suma a ellas.
 */

/** @typedef {{ok: boolean, nivel: 'ok'|'aviso'|'error', motivo: string}} Veredicto */

/**
 * @param {object} e
 * @param {string} e.shaAutorizado      El pin del workflow.
 * @param {string} e.cabezaDeMain       Lo que devuelve `git ls-remote origin refs/heads/main`.
 * @param {string} [e.rollbackAutorizado] Si vale el mismo sha, se permite publicar un árbol viejo.
 * @param {boolean} [e.esAncestroDeMain] ¿El pin está en la historia de `main`?
 * @param {number|null} [e.commitsDetras] Cuántos commits le faltan, si se pudo contar.
 * @param {string[]|null} [e.publicablesQueDifieren] De los cuatro archivos que este
 *   workflow publica o certifica, cuáles NO coinciden entre el pin y la cabeza.
 *   Lista vacía = son idénticos. `null` = no se pudo comparar, y entonces esto
 *   se para: un dato que falta no es un dato que coincide.
 * @returns {Veredicto}
 */
export function decidirArbolAutorizado({
  shaAutorizado,
  cabezaDeMain,
  rollbackAutorizado = '',
  esAncestroDeMain = true,
  commitsDetras = null,
  publicablesQueDifieren = null,
}) {
  const pin = String(shaAutorizado ?? '').trim()
  const cabeza = String(cabezaDeMain ?? '').trim()

  // Un sha que no se pudo leer NO es «igual»: es un dato que falta, y ante un
  // dato que falta esto se para. Ausencia de dato no es dato de ausencia.
  if (!pin || !cabeza) {
    return {
      ok: false, nivel: 'error',
      motivo: 'No se pudo leer el SHA autorizado o la cabeza de main. Sin ese dato no se publica.',
    }
  }

  if (pin === cabeza) {
    return { ok: true, nivel: 'ok', motivo: `El árbol autorizado ES la cabeza de main (${corto(cabeza)}).` }
  }

  const declarado = String(rollbackAutorizado ?? '').trim()
  if (declarado && declarado === pin) {
    return {
      ok: true, nivel: 'aviso',
      motivo:
        `ROLLBACK DECLARADO: se publica ${corto(pin)}, que NO es la cabeza de main ` +
        `(${corto(cabeza)})${detras(commitsDetras)}. Está autorizado en ROLLBACK_AUTORIZADO.`,
    }
  }

  // Un pin fuera de la historia de main es peor que uno atrasado: son las reglas
  // de una rama que nadie fusionó.
  if (!esAncestroDeMain) {
    return {
      ok: false, nivel: 'error',
      motivo:
        `El árbol autorizado ${corto(pin)} NO está en la historia de main (${corto(cabeza)}). ` +
        'Publicar desde una rama sin fusionar sacaría a producción reglas que nadie revisó en main.',
    }
  }

  // Está en la historia de `main` pero por detrás. Aquí decide el CONTENIDO.
  if (publicablesQueDifieren === null) {
    return {
      ok: false, nivel: 'error',
      motivo:
        `El árbol autorizado ${corto(pin)} está por detrás de la cabeza de main ` +
        `(${corto(cabeza)})${detras(commitsDetras)}, y NO se pudo comparar lo que este ` +
        'workflow publica. Un dato que falta no es un dato que coincide: no se publica.',
    }
  }

  if (publicablesQueDifieren.length === 0) {
    return {
      ok: true, nivel: 'ok',
      motivo:
        `El árbol autorizado ${corto(pin)} está por detrás de la cabeza ` +
        `(${corto(cabeza)})${detras(commitsDetras)}, pero TODO lo que este workflow ` +
        'publica o certifica es idéntico: publicar desde el pin equivale a publicar ' +
        'desde la cabeza.',
    }
  }

  return {
    ok: false, nivel: 'error',
    motivo:
      `El árbol autorizado ${corto(pin)} está por detrás de la cabeza de main ` +
      `(${corto(cabeza)})${detras(commitsDetras)} Y difiere en lo que este workflow ` +
      `publica: ${publicablesQueDifieren.join(', ')}. ` +
      'Publicarlo sacaría a producción esa versión vieja. Pon el SHA de la cabeza en ' +
      'SHA_AUTORIZADO, o —si el árbol viejo es a propósito— declara ese mismo SHA en ' +
      'ROLLBACK_AUTORIZADO.',
  }
}

function corto(sha) { return String(sha).slice(0, 8) }
function detras(n) {
  return typeof n === 'number' && n > 0 ? `, ${n} commit${n === 1 ? '' : 's'} por detrás` : ''
}

/* CLI: lo llama la Compuerta 0 del workflow. Sale 1 si no se puede publicar. */
if (process.argv[1] && process.argv[1].endsWith('arbol-autorizado.mjs')) {
  const n = Number(process.env.COMMITS_DETRAS)
  const v = decidirArbolAutorizado({
    shaAutorizado: process.env.SHA_AUTORIZADO,
    cabezaDeMain: process.env.CABEZA_DE_MAIN,
    rollbackAutorizado: process.env.ROLLBACK_AUTORIZADO,
    esAncestroDeMain: process.env.ES_ANCESTRO !== 'no',
    commitsDetras: Number.isFinite(n) ? n : null,
    // Vacío = idénticos. Sin definir = no se pudo comparar, y eso PARA.
    publicablesQueDifieren: process.env.PUBLICABLES_DIFIEREN === undefined
      ? null
      : process.env.PUBLICABLES_DIFIEREN.split(',').map(x => x.trim()).filter(Boolean),
  })
  if (v.ok && v.nivel === 'aviso') console.log(`::warning::${v.motivo}`)
  else if (v.ok) console.log(v.motivo)
  else console.log(`::error::${v.motivo}`)
  process.exit(v.ok ? 0 : 1)
}

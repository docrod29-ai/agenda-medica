/**
 * EL TEMA, DECIDIDO EN UN SOLO SITIO.
 *
 * ── EL FALLO QUE LO TRAE AQUÍ ────────────────────────────────────────────────
 *
 * El tema lo deciden DOS lectores, y tenían tablas distintas:
 *
 *  1. Un guion en línea en el `<head>` de `layout.tsx`, que corre antes de que
 *     pinte nada para que no haya parpadeo.
 *  2. `useTema`, ya con React montado.
 *
 * El modo **automático** —«sigue al sistema operativo», uno de los tres del
 * control— se guardaba **borrando la llave**. Así que «elegí automático» y
 * «nunca elegí nada» quedaban escritos igual: sin dato.
 *
 * Y los dos lectores leían esa ausencia como **oscuro**. Consecuencia: el
 * médico elegía automático, el tema seguía al sistema… hasta la siguiente
 * carga. Al recargar —o al abrir la aplicación instalada, que es como se abre
 * cada mañana— volvía a oscuro, y el control decía «oscuro» como si lo hubiera
 * elegido él.
 *
 * Es la regla 4 de seguridad clínica dicha en interfaz: **ausencia de dato no
 * es dato de ausencia**. No había forma de distinguir un silencio de una
 * decisión, así que el automático era inalcanzable en cuanto se recargaba.
 *
 * ── LO QUE **NO** CAMBIA ─────────────────────────────────────────────────────
 *
 * El valor de fábrica sigue siendo **oscuro**: es la identidad de la marca y
 * es una decisión de producto, no un accidente. Lo que cambia es que ahora
 * «automático» se escribe, en vez de representarse con un hueco.
 *
 * La llave `nexusmed.theme` NO se renombra: está declarada en
 * `NO_SE_RENOMBRAN` de `marca.ts` — renombrarla le borra al médico su
 * preferencia. Vive aquí para que haya un solo sitio donde escribirla.
 */

export type ModoTema = 'dark' | 'light' | 'auto'

/** `localStorage` · preferencia de tema. Ver `NO_SE_RENOMBRAN` en `marca.ts`. */
export const LLAVE_TEMA = 'nexusmed.theme'

/** Lo emite quien cicla el tema; lo escuchan todas las vistas del control. */
export const EVENTO_TEMA = 'nx:tema'

/**
 * Qué hay que poner en `data-theme` según lo guardado.
 *
 * `null` significa **quitar el atributo**, que es como se le cede la decisión
 * a `prefers-color-scheme` en `globals.css`.
 */
export function atributoDeTema(guardado: string | null | undefined): 'dark' | 'light' | null {
  if (guardado === 'light') return 'light'
  if (guardado === 'auto') return null
  // 'dark', un valor corrupto, o nunca eligió: la marca es oscura.
  return 'dark'
}

/** El modo que el control tiene que enseñar según lo guardado. */
export function modoGuardado(guardado: string | null | undefined): ModoTema {
  return guardado === 'light' ? 'light' : guardado === 'auto' ? 'auto' : 'dark'
}

/**
 * EL MISMO CRITERIO, EN EL GUION QUE CORRE ANTES DE REACT.
 *
 * Se genera desde la llave de arriba en vez de repetirla a mano, que es cómo
 * los dos lectores se desfasaron la primera vez. Va en ES5 y sin dependencias:
 * corre en línea en el `<head>`, antes de que exista ningún bundle.
 *
 * El `catch` pinta oscuro: si `localStorage` no se puede leer (modo privado,
 * cookies bloqueadas) no hay preferencia que respetar, y el valor de fábrica
 * es el de la marca.
 */
export const GUION_TEMA = `(function(){
  try{
    var t = localStorage.getItem('${LLAVE_TEMA}');
    if (t === 'auto') { document.documentElement.removeAttribute('data-theme'); return; }
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  } catch(e){
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`

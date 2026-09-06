/**
 * CUÁNDO PUEDE CARGARSE EL PIXEL DE META (Panel de Lujo ZC-010).
 *
 * El aviso público (`/privacidad`) enumera las finalidades de los datos de los
 * médicos —cuenta, cobro, CFDI, soporte— y no menciona medición ni publicidad,
 * ni una palabra sobre cookies o píxeles. Mientras eso siga así, el Pixel no
 * puede cargarse aunque `NEXT_PUBLIC_META_PIXEL_ID` exista:
 * `AVISO_DE_PRIVACIDAD_DECLARA_EL_PIXEL` es la compuerta, y el guardián
 * (`meta-pixel-declarado-en-el-aviso.test.ts`) exige que sólo pase a `true`
 * cuando el aviso contenga la palabra «píxel». Es la decisión D-2 del dueño
 * aplicada por su valor seguro: apagado hasta que esté declarado. Se enciende
 * cambiando esta constante, no la variable.
 *
 * Y aunque se declare, en /registro NO se carga cuando la URL trae `?invite=`:
 * `PageView` manda la URL completa y el código de invitación es una llave.
 *
 * Módulo PURO (sin `window`), para probarlo sin navegador.
 */

/** Ver cabecera. Sólo se pone en `true` cuando /privacidad declara el píxel. */
export const AVISO_DE_PRIVACIDAD_DECLARA_EL_PIXEL = false

export function pixelPermitidoEn(pathname: string, search: string, declarado: boolean = AVISO_DE_PRIVACIDAD_DECLARA_EL_PIXEL): boolean {
  if (!declarado) return false
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  // La URL con el código de invitación es una llave: no viaja a un tercero.
  if (pathname.startsWith('/registro') && params.has('invite')) return false
  return true
}

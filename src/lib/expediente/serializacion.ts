/**
 * Serialización de documentos del expediente para el viaje a Firestore.
 *
 * `stripUndefined` vivía privado dentro de `firestore.ts`, que importa el SDK de
 * Firebase. Se movió aquí —módulo PURO, sin dependencias— por una razón concreta
 * de verificabilidad (E0-12): el sello de integridad NOM-024 sólo es fiable si el
 * documento que se lee de Firestore produce el MISMO hash que el que se escribió.
 * Para probar eso en un test hay que simular el viaje de ida (quitar `undefined`,
 * que Firestore rechaza) sin arrastrar el SDK ni una conexión real.
 *
 * `firestore.ts` lo importa: cero cambios para sus llamadores.
 */

/** Firestore rechaza valores `undefined`. Los eliminamos recursivamente. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(v => stripUndefined(v)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      out[k] = stripUndefined(v)
    }
    return out as T
  }
  return value
}

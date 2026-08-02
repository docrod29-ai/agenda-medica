/**
 * LEER UNA RESPUESTA NDJSON — porque `res.json()` no sirve para esto.
 *
 * ── EL FALLO QUE ORIGINA ESTE ARCHIVO ────────────────────────────────────────
 *
 * `/api/consultor-evidencia` responde SIEMPRE en NDJSON: una línea de metadatos,
 * muchas de texto y una de cierre. El botón «Agregar análisis a la nota» hacía
 * `await res.json()`, que revienta al llegar a la segunda línea. El `catch`
 * devolvía `null` y el médico veía «No se pudo generar el análisis».
 *
 * Mientras tanto el servidor había hecho el trabajo entero: llamó al modelo,
 * terminó el stream y descontó los créditos. En Premium eran cuatro créditos por
 * cada clic de un botón que no ha funcionado nunca.
 *
 * Que exista aquí y no dentro de una pantalla es a propósito: el formato lo
 * eligen las rutas, y ya hay dos clientes que lo consumen. El tercero no debería
 * volver a escribir el bucle.
 */

export interface EventoNdjson {
  type?: string
  text?: string
  error?: string
  [k: string]: unknown
}

export interface RespuestaNdjson {
  /** Todo el texto de los `delta`, en orden. */
  texto: string
  /** La línea `meta`, si la hubo. */
  meta: EventoNdjson | null
  /** El primer `error` recibido. `null` si no hubo. */
  error: string | null
}

/**
 * Consume la respuesta entera y devuelve lo acumulado.
 *
 * Para pintar en vivo está `onDelta`; quien sólo quiere el resultado final
 * puede ignorarlo. Un `error` NO interrumpe la lectura: el stream puede traer
 * texto parcial antes de fallar, y tirarlo sería perder lo que sí llegó.
 */
export async function leerNdjson(
  res: Response,
  onDelta?: (texto: string, acumulado: string) => void,
): Promise<RespuestaNdjson> {
  const salida: RespuestaNdjson = { texto: '', meta: null, error: null }
  if (!res.body) {
    // Sin cuerpo legible no hay stream que leer; puede ser un error en JSON normal.
    const d = await res.json().catch(() => null)
    salida.error = (d as { error?: string } | null)?.error ?? 'La respuesta llegó vacía'
    return salida
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''

  const procesar = (linea: string) => {
    const s = linea.trim()
    if (!s) return
    let ev: EventoNdjson
    try { ev = JSON.parse(s) } catch { return }   // línea a medias o basura: se ignora
    if (ev.type === 'meta') salida.meta = ev
    else if (ev.type === 'delta') {
      salida.texto += ev.text ?? ''
      onDelta?.(ev.text ?? '', salida.texto)
    } else if (ev.type === 'error' && !salida.error) {
      salida.error = String(ev.error ?? 'Error del proveedor')
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lineas = buf.split('\n')
    buf = lineas.pop() ?? ''      // la última puede venir cortada a la mitad
    for (const l of lineas) procesar(l)
  }
  if (buf.trim()) procesar(buf)   // sin salto de línea final

  return salida
}

export const POR_QUE_NO_RES_JSON =
  'Porque la ruta responde NDJSON —una línea de metadatos, muchas de texto y ' +
  'una de cierre— y `res.json()` revienta al llegar a la segunda. El servidor ' +
  'ya había llamado al modelo y descontado los créditos, así que el médico ' +
  'pagaba una respuesta que la pantalla tiraba a la basura.'

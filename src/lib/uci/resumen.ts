/**
 * RESUMEN DEL PASE — el puente entre las tomas persistidas y los motores.
 *
 * El Morning Brief (§30) y la línea de tiempo (§33) ya existen y están probados,
 * pero reciben datos ya masticados. Este módulo es lo que faltaba: convertir las
 * `TomaUci` que hay en el expediente en lo que esos motores esperan.
 *
 * ── EL PUENTE QUE PUEDE ROMPERSE EN SILENCIO ─────────────────────────────────
 *
 * El panel guarda las medidas con SUS nombres (`norepi`, `creat`) y el Morning
 * Brief usa los del charter (`ne`, `creatinina`). Si ese mapa se desalinea, el
 * brief no falla: sale **vacío para siempre** y nadie se entera de por qué.
 *
 * Por eso el mapa es explícito, está exportado y un caso del golden comprueba
 * que **todo destino existe** en `METRICAS_BRIEF`.
 *
 * ── VACÍO NO ES CERO ─────────────────────────────────────────────────────────
 *
 * `numero()` devuelve `null` para blanco, espacios y basura, y entiende la coma
 * decimal mexicana. No es un detalle: la auditoría del 26-jul encontró un `num()`
 * duplicado en 12 motores que convierte un espacio en 0 y pierde «12,5» en
 * silencio. Un 0 inventado en una FiO₂ o en un lactato no es un dato faltante:
 * es un dato **falso**.
 *
 * Módulo PURO.
 */

import type { TomaUci } from '@/lib/uci/observaciones'
import { METRICAS_BRIEF, type ParMedido } from '@/lib/uci/morning-brief'
import type { EventoLinea } from '@/lib/uci/linea-tiempo'
import { num } from '@/lib/uci/num'

/**
 * Coerción numérica: se REEXPORTA la fuente única, no se reimplementa.
 *
 * Escribí aquí una propia y tenía el bug que `num()` existe para evitar:
 * «1,200» daba **1.2** en vez de 1200. En una glucosa eso convierte una
 * hiperglucemia en una alerta de hipoglucemia — es un hallazgo P1 de la propia
 * auditoría, reintroducido por mí al escribir la copia número trece.
 *
 * La lección no es «tener cuidado»: es que un módulo nuevo NO escribe su propia
 * coerción numérica.
 */
export { num as numero }

/**
 * Del nombre con el que el PANEL guarda la medida al de la métrica del charter.
 * Sólo se traduce lo que cambia de nombre; el resto pasa igual.
 */
export const CLAVE_PANEL_A_BRIEF: Readonly<Record<string, string>> = {
  norepi: 'ne',
  creat: 'creatinina',
}

/** Nombre de métrica del charter para una medida del panel. */
export function claveBrief(clavePanel: string): string {
  return CLAVE_PANEL_A_BRIEF[clavePanel] ?? clavePanel
}

/**
 * Cambios para el Morning Brief a partir de las tomas VIGENTES.
 *
 * Toma el primer valor DENTRO de la ventana y el último de la serie. Con una
 * sola lectura de una métrica no se emite cambio: un delta necesita dos puntos,
 * y fabricar uno contra el propio valor daría «sin cambio» donde lo que hay es
 * **falta de comparación**.
 *
 * @param tomas ya filtradas por `serieTomas` (sólo las clínicamente vigentes),
 *   en orden ascendente.
 */
export function cambiosDeTomas(
  tomas: readonly TomaUci[],
  ventanaHoras: number,
  ahoraIso: string,
): { cambios: ParMedido[]; conUnSoloPunto: string[] } {
  const ahora = Date.parse(ahoraIso)
  if (Number.isNaN(ahora)) throw new Error(`cambiosDeTomas: instante inválido «${ahoraIso}»`)
  if (!(ventanaHoras > 0)) throw new Error('cambiosDeTomas: la ventana debe ser positiva')

  const desde = ahora - ventanaHoras * 3_600_000
  const enVentana = tomas
    .filter(t => {
      const ms = Date.parse(t.medidoEn)
      return !Number.isNaN(ms) && ms >= desde && ms <= ahora
    })
    .sort((a, b) => Date.parse(a.medidoEn) - Date.parse(b.medidoEn))

  const porClave = new Map<string, number[]>()
  for (const t of enVentana) {
    for (const [k, raw] of Object.entries(t.medidas ?? {})) {
      const n = num(raw)
      if (n === null) continue
      const clave = claveBrief(k)
      const lista = porClave.get(clave)
      if (lista) lista.push(n); else porClave.set(clave, [n])
    }
  }

  const cambios: ParMedido[] = []
  const conUnSoloPunto: string[] = []
  for (const [clave, valores] of porClave) {
    if (valores.length < 2) { conUnSoloPunto.push(clave); continue }
    cambios.push({ clave, de: valores[0], a: valores[valores.length - 1] })
  }
  return { cambios, conUnSoloPunto }
}

/**
 * Eventos de línea de tiempo a partir de las tomas.
 *
 * Cada medida numérica que **cambió** respecto de la toma anterior produce un
 * evento. Repetir un valor idéntico no es un evento: llenaría la línea de ruido
 * y escondería lo que sí se movió.
 */
export function eventosDeTomas(tomas: readonly TomaUci[]): EventoLinea[] {
  const orden = [...tomas]
    .filter(t => !Number.isNaN(Date.parse(t.medidoEn)))
    .sort((a, b) => Date.parse(a.medidoEn) - Date.parse(b.medidoEn))

  const etiquetaDe = new Map(METRICAS_BRIEF.map(m => [m.clave, m.etiqueta]))
  const previo = new Map<string, number>()
  const eventos: EventoLinea[] = []

  for (const t of orden) {
    for (const [k, raw] of Object.entries(t.medidas ?? {})) {
      const n = num(raw)
      if (n === null) continue
      const clave = claveBrief(k)
      const antes = previo.get(clave)
      previo.set(clave, n)
      if (antes === undefined || antes === n) continue
      eventos.push({
        en: t.medidoEn,
        origen: 'toma',
        etiqueta: etiquetaDe.get(clave) ?? clave,
        direccion: n > antes ? 'sube' : 'baja',
        valor: n,
      })
    }
  }
  return eventos
}

/** Métricas del panel que hoy NO llegan a ninguna métrica del brief. */
export function clavesSinMetrica(tomas: readonly TomaUci[]): string[] {
  const conocidas = new Set(METRICAS_BRIEF.map(m => m.clave))
  const vistas = new Set<string>()
  for (const t of tomas) {
    for (const k of Object.keys(t.medidas ?? {})) {
      const c = claveBrief(k)
      if (!conocidas.has(c)) vistas.add(c)
    }
  }
  return [...vistas].sort()
}

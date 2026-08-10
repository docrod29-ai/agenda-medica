/**
 * EL SIMULACRO QUE SÍ PODEMOS CORRER NOSOTROS.
 *
 * ── DÓNDE ESTÁBAMOS (D8) ─────────────────────────────────────────────────────
 *
 * `docs/SIMULACRO_RESTAURACION.md` tiene el procedimiento entero y su historial
 * dice, literalmente, «todavía ninguno». La frase del auditor es la correcta:
 * **sin un tiempo medido no hay respuesta para un hospital** que pregunte cuánto
 * tarda Ausculta en volver.
 *
 * ── LO QUE ESTE MÓDULO MIDE, Y LO QUE NO ─────────────────────────────────────
 *
 * Mide **nuestra mitad**: cuánto tarda un respaldo NDJSON en volver a
 * interpretarse, re-enraizarse y quedar listo para escribirse, y si vuelve
 * entero. Es la parte que depende de nuestro código y que podemos ensayar
 * cuantas veces queramos, sin consola y sin tocar nada.
 *
 * **No mide** el tiempo de `gcloud firestore databases restore`, que es de
 * Google y hay que cronometrarlo a mano en el ensayo de verdad. Decirlo importa:
 * un número que se presenta como «el RTO» cuando sólo cubre un tramo es peor que
 * no tener número, porque nadie lo vuelve a comprobar.
 *
 * Módulo PURO: no lee disco, no mide el reloj. Quien cronometra es el script.
 */
import { leerLinea, reenraizar, admitir } from '@/lib/clinica/restaurar'

export interface ResultadoSimulacro {
  /** Líneas leídas del archivo, sin contar las vacías. */
  lineas: number
  /** Documentos que se escribirían. */
  restaurables: number
  /** Documentos que el respaldo trae y NO se restauran (llaves de API…). */
  excluidos: number
  /** Líneas que no se entendieron, con su razón. */
  rechazadas: { porQue: string; crudo: string }[]
  /** ¿Traía cabecera y pie? Un archivo sin pie se cortó a medias. */
  cabecera: boolean
  pie: boolean
  /** Colecciones vistas, con cuántos documentos de cada una. */
  porColeccion: Record<string, number>
}

/**
 * Corre el archivo entero por el camino de vuelta, sin escribir nada.
 *
 * Es exactamente lo que hace la ruta de importación en modo ensayo, con las
 * mismas funciones: si esto pasa, la restauración de verdad tiene el mismo
 * criterio delante.
 */
export function simularRestauracion(ndjson: string, clinicIdDestino: string): ResultadoSimulacro {
  const r: ResultadoSimulacro = {
    lineas: 0, restaurables: 0, excluidos: 0, rechazadas: [],
    cabecera: false, pie: false, porColeccion: {},
  }
  for (const crudo of ndjson.split('\n')) {
    const l = leerLinea(crudo)
    if (!l) continue
    r.lineas++
    if (l.clase === 'cabecera') { r.cabecera = true; continue }
    if (l.clase === 'pie') { r.pie = true; continue }
    if (l.clase === 'rechazada') { r.rechazadas.push({ porQue: l.porQue, crudo: l.crudo }); continue }

    const v = admitir(l.coleccion)
    if (!v.escribir) { r.excluidos++; continue }
    // Se re-enraíza aunque no se escriba: es el paso que puede fallar, y un
    // ensayo que se salta el paso que falla no ensaya nada.
    const destino = reenraizar(l.ruta, clinicIdDestino)
    if (!destino.startsWith(`clinics/${clinicIdDestino}/`)) {
      r.rechazadas.push({ porQue: `re-enraizado incorrecto: ${destino}`, crudo: l.ruta })
      continue
    }
    r.restaurables++
    const raiz = l.coleccion.split('.')[0]
    r.porColeccion[raiz] = (r.porColeccion[raiz] ?? 0) + 1
  }
  return r
}

/**
 * ¿El ensayo salió limpio?
 *
 * Sin pie, no: el archivo se cortó y lo que falta no se puede saber cuál era.
 */
export function ensayoLimpio(r: ResultadoSimulacro): boolean {
  return r.cabecera && r.pie && r.rechazadas.length === 0 && r.restaurables > 0
}

/**
 * El bloque de evidencia, listo para pegar en el historial del documento.
 *
 * @param ms lo que tardó, medido por quien llama. No se estima aquí: un tiempo
 *   inventado en un documento de continuidad es peor que ninguno.
 */
export function actaDeSimulacro(r: ResultadoSimulacro, ms: number, fechaISO: string): string {
  const seg = ms / 1000
  const porSeg = seg > 0 ? Math.round(r.restaurables / seg) : 0
  const cols = Object.entries(r.porColeccion).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`).join(', ')
  return [
    `### Ensayo de ida y vuelta del ${fechaISO.slice(0, 10)}`,
    '',
    `- Documentos en el respaldo: **${r.restaurables + r.excluidos}** (${r.restaurables} restaurables, ${r.excluidos} excluidos por política)`,
    // Por debajo de un segundo se dice en milisegundos: «0.00 s» parece que no
    // se midió, y lo que se midió fue rápido.
    `- Tardó: **${seg >= 1 ? `${seg.toFixed(2)} s` : `${ms.toFixed(0)} ms`}** — ${porSeg.toLocaleString('es-MX')} documentos/segundo`,
    `- Cabecera y pie: ${r.cabecera ? '✅' : '❌'} / ${r.pie ? '✅' : '❌'}`,
    `- Líneas rechazadas: ${r.rechazadas.length === 0 ? '0' : `${r.rechazadas.length} → ${r.rechazadas.slice(0, 3).map(x => x.porQue).join(' · ')}`}`,
    `- Por colección: ${cols || '(ninguna)'}`,
    `- Veredicto: ${ensayoLimpio(r) ? '✅ el respaldo vuelve entero' : '❌ revisar arriba'}`,
    '',
    '> **Qué NO mide esto:** el tiempo de `gcloud firestore databases restore`,',
    '> que es de Google y hay que cronometrarlo en el ensayo con consola. Éste',
    '> mide nuestra mitad: que el archivo vuelve a leerse entero y cuánto tarda.',
  ].join('\n')
}

export const POR_QUE_ESTE_ENSAYO_NO_ES_EL_RTO =
  'Mide nuestra mitad: que el respaldo vuelve a leerse entero y cuánto tarda. ' +
  'No mide el restore de Firestore, que es de Google y se cronometra a mano. Un ' +
  'número presentado como «el RTO» cubriendo sólo un tramo es peor que no tener ' +
  'número, porque nadie lo vuelve a comprobar.'

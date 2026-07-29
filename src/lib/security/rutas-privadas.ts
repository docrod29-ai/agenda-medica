/**
 * Fuente ÚNICA de verdad de la zona autenticada (unidad Nexus OS E0-10).
 *
 * POR QUÉ EXISTE: la lista vivía incrustada en un regex dentro de `next.config.ts`
 * y se desincronizó de `src/app/(dashboard)/`. Medido contra producción, estas
 * pantallas NO devolvían ninguna cabecera anti-clickjacking:
 *
 *     /uci  /hospitalizacion  /superadmin  /receta  /orden  /corte-caja  …
 *
 * `/uci`, `/hospitalizacion` y `/receta` renderizan PHI y `/superadmin` es la
 * consola del dueño: cualquier sitio podía embeberlas en un iframe invisible y
 * hacer clickjacking sobre la sesión del médico. Al vivir la lista en un módulo
 * propio, `src/__tests__/csp-guard.test.ts` puede cruzarla contra el árbol de
 * rutas real y tumbar el CI cuando alguien añada una pantalla del dashboard sin
 * protección (o deje aquí una ruta que ya no existe).
 *
 * No contiene lógica clínica ni de negocio: sólo nombres de ruta.
 */

/**
 * Primer segmento de cada ruta de la zona autenticada. Debe corresponder 1:1 con
 * un directorio real bajo `src/app/(dashboard)/` o `src/app/`.
 *
 * NO se incluyen a propósito:
 *  - `teleconsulta`: la abre el PACIENTE desde un enlace; además embebe un iframe
 *    de Daily y no queremos tocar su comportamiento de encuadre.
 *  - `mi`, `resena`, `verificar`, `pago`, `unirse`, `reservar`, `dr`, `demo`:
 *    superficie pública/paciente (algunas se embeben a propósito).
 */
export const RUTAS_PRIVADAS = [
  'agenda',
  'antibiograma',
  'asistente',
  'calendario',
  'chat',
  'citas',
  'configuracion',
  'consulta',
  'consultor',
  'corte-caja',
  'crm',
  'cumplimiento',
  'dashboard',
  'expediente',
  'expedientes',
  'farmacia',
  'finanzas',
  'guia',
  'hospitalizacion',
  'legal',
  'lista-espera',
  'membresias',
  'migracion',
  'nota',
  'orden',
  'pacientes',
  'reactivacion',
  'receta',
  'referencia',
  'resenas',
  'setup',
  'superadmin',
  'uci',
  'waitlist',
] as const

/**
 * `source` de Next para el bloque de cabeceras de la zona autenticada.
 * Forma idéntica a la que ya había (`/(a|b|c)(.*)`), sólo que derivada del array.
 */
export const RE_RUTAS_PRIVADAS = `/(${RUTAS_PRIVADAS.join('|')})(.*)`

/** Ruta absoluta de prueba para una entrada de la lista (E2E y guardián). */
export function rutaDePrueba(segmento: string): string {
  return `/${segmento}`
}

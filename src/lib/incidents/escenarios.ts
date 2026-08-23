/**
 * LOS TRECE SIMULACROS — la lista mínima de #315, más el que la lista destapó.
 *
 * ── POR QUÉ ESTOS TRECE ──────────────────────────────────────────────────────
 *
 * Doce salen del carril tal cual está pedido: son las formas en que este
 * producto se ha roto o puede romperse. El decimotercero
 * (`PERSISTENCIA-SIN-CLAVE`) apareció al escribir el cuarto: la diferencia entre
 * una escritura con clave de idempotencia y una sin ella cambia la respuesta de
 * la política, y sin las dos al lado no se ve que la cambia.
 *
 * ── LO QUE CADA ESCENARIO DECLARA ────────────────────────────────────────────
 *
 * Los `esperado` son la parte importante: sin ellos el arnés cuenta lo que pasó
 * pero no dice si estuvo bien. Un simulacro que siempre «pasa» no es un
 * simulacro, es un informe.
 *
 * Módulo PURO. Sin red, sin proveedores, sin producción.
 */
import type { Escenario } from './simulacro'

/** Genera `n` fallos repartidos en `ventanaMs`, con `ops` operaciones distintas. */
function goteo(n: number, ventanaMs: number, ops: number, prefijo: string) {
  return Array.from({ length: n }, (_, i) => ({
    enMs: Math.round((i * ventanaMs) / Math.max(1, n - 1)),
    operationId: `${prefijo}-${i % Math.max(1, ops)}`,
    tenantRef: `t${i % 3}`,
  }))
}

export const ESCENARIOS: readonly Escenario[] = [
  {
    id: 'IA-SALDO',
    titulo: 'La cuenta del proveedor de IA se quedó sin saldo',
    categoria: 'ai_provider', subtipo: 'sin_saldo', feature: 'nota',
    ruta: '/consulta/[id]', proveedor: 'anthropic', codigoNormalizado: 'http_400',
    /** `nunca`: es la decisión de `seArreglaReintentando('sin_saldo')`, no una nueva. */
    dimensionesOverride: { reintentabilidad: 'nunca' },
    fallos: goteo(60, 180_000, 30, 'op'),
    accionPropuesta: 'reintento_idempotente',
    idempotenciaGarantizada: true,
    resultadosDeIntento: [],
    duracionDeAccionMs: 0,
    esperado: { esIncidente: true, remediacionPermitida: false, gruposEsperados: 1, avisoRequerido: true },
  },
  {
    id: 'IA-SOBRECARGA',
    titulo: 'El proveedor de IA está saturado',
    categoria: 'ai_provider', subtipo: 'sobrecarga', feature: 'nota',
    ruta: '/consulta/[id]', proveedor: 'anthropic', codigoNormalizado: 'http_529',
    fallos: goteo(40, 120_000, 25, 'op'),
    accionPropuesta: 'reintento_idempotente',
    idempotenciaGarantizada: true,
    resultadosDeIntento: ['fallido', 'recuperado'],
    duracionDeAccionMs: 800,
    esperado: { esIncidente: true, remediacionPermitida: true, gruposEsperados: 1, avisoRequerido: false },
  },
  {
    id: 'IA-TIMEOUT',
    titulo: 'El proveedor de IA deja de responder a tiempo',
    categoria: 'ai_provider', subtipo: 'timeout', feature: 'transcribir',
    ruta: '/consulta/[id]', proveedor: 'assemblyai', codigoNormalizado: 'http_504',
    fallos: goteo(30, 150_000, 14, 'op'),
    accionPropuesta: 'respaldo_de_proveedor_autorizado',
    idempotenciaGarantizada: true,
    resultadosDeIntento: ['recuperado'],
    duracionDeAccionMs: 1500,
    esperado: { esIncidente: true, remediacionPermitida: true, gruposEsperados: 1, avisoRequerido: false },
  },
  {
    id: 'PERSISTENCIA-TRANSITORIA',
    titulo: 'Escritura a la base que falla de forma transitoria, CON clave de idempotencia',
    categoria: 'persistence', subtipo: 'escritura_rechazada', feature: 'nota',
    ruta: '/consulta/[id]', codigoNormalizado: 'unavailable',
    /** Con clave, repetir la escritura deja el mismo documento: es reversible. */
    dimensionesOverride: { reversibilidad: 'reversible' },
    fallos: goteo(25, 120_000, 12, 'op'),
    accionPropuesta: 'reintento_idempotente',
    idempotenciaGarantizada: true,
    resultadosDeIntento: ['recuperado'],
    duracionDeAccionMs: 400,
    esperado: { esIncidente: true, remediacionPermitida: true, gruposEsperados: 1, avisoRequerido: false },
  },
  {
    id: 'PERSISTENCIA-SIN-CLAVE',
    titulo: 'La MISMA escritura, SIN clave de idempotencia',
    categoria: 'persistence', subtipo: 'escritura_rechazada', feature: 'cobro',
    ruta: '/api/[id]', codigoNormalizado: 'unavailable',
    /**
     * Sin clave no se sabe si la escritura llegó. Reintentar puede duplicarla, y
     * duplicar un cobro no se deshace con otro reintento. Aquí la política dice
     * que no, y ése es el caso que justifica el escenario.
     */
    fallos: goteo(25, 120_000, 12, 'op'),
    accionPropuesta: 'reintento_idempotente',
    idempotenciaGarantizada: false,
    resultadosDeIntento: [],
    duracionDeAccionMs: 0,
    esperado: { esIncidente: true, remediacionPermitida: false, gruposEsperados: 1, avisoRequerido: true },
  },
  {
    id: 'AUTOGUARDADO',
    titulo: 'El autoguardado de la consulta deja de guardar',
    categoria: 'autosave', subtipo: 'guardado_fallido', feature: 'nota',
    ruta: '/consulta/[id]', codigoNormalizado: 'unavailable',
    fallos: goteo(22, 240_000, 8, 'op'),
    accionPropuesta: 'reintento_idempotente',
    idempotenciaGarantizada: true,
    resultadosDeIntento: ['recuperado'],
    duracionDeAccionMs: 500,
    esperado: { esIncidente: true, remediacionPermitida: true, gruposEsperados: 1, avisoRequerido: false },
  },
  {
    id: 'ENTREGA-DUPLICADA',
    titulo: 'Un trabajo asíncrono se entrega dos veces',
    categoria: 'notification', subtipo: 'entrega_duplicada', feature: 'recordatorio',
    codigoNormalizado: 'duplicado',
    fallos: goteo(30, 200_000, 11, 'op'),
    /**
     * La respuesta correcta a una entrega duplicada es que el receptor sea
     * idempotente, no reintentar. Sin esa garantía la política lo para — y ése
     * es justo el punto: aquí se ve que la para.
     */
    accionPropuesta: 'reintento_idempotente',
    idempotenciaGarantizada: false,
    resultadosDeIntento: [],
    duracionDeAccionMs: 0,
    esperado: { esIncidente: true, remediacionPermitida: false, gruposEsperados: 1, avisoRequerido: true },
  },
  {
    id: 'RESPUESTA-CADUCA',
    titulo: 'El paciente reserva sobre un hueco que ya no existe',
    categoria: 'scheduling', subtipo: 'hueco_caduco', feature: 'reservar',
    ruta: '/reservar/[id]', codigoNormalizado: 'http_409',
    dimensionesOverride: { reversibilidad: 'reversible' },
    fallos: goteo(26, 180_000, 9, 'op'),
    accionPropuesta: 'invalidar_cache_caduca',
    idempotenciaGarantizada: true,
    resultadosDeIntento: ['recuperado'],
    duracionDeAccionMs: 200,
    esperado: { esIncidente: true, remediacionPermitida: true, gruposEsperados: 1, avisoRequerido: false },
  },
  {
    id: 'UI-COMPONENTE',
    titulo: 'Un componente secundario de la pantalla lanza',
    categoria: 'ui', subtipo: 'componente_lanza', feature: 'panel-evidencia',
    ruta: '/consulta/[id]', codigoNormalizado: 'render_error',
    fallos: goteo(24, 240_000, 10, 'op'),
    accionPropuesta: 'reiniciar_estado_de_cliente',
    resultadosDeIntento: ['recuperado'],
    duracionDeAccionMs: 100,
    esperado: { esIncidente: true, remediacionPermitida: true, gruposEsperados: 1, avisoRequerido: false },
  },
  {
    id: 'WHATSAPP-TRAS-RESERVA',
    titulo: 'La cita se guardó y el mensaje al paciente no salió',
    categoria: 'notification', subtipo: 'envio_fallido', feature: 'confirmacion-portal',
    ruta: '/api/public/booking', proveedor: 'whatsapp', codigoNormalizado: 'http_502',
    dimensionesOverride: { reversibilidad: 'reversible' },
    fallos: goteo(21, 240_000, 7, 'op'),
    accionPropuesta: 'reintentar_notificacion',
    idempotenciaGarantizada: true,
    resultadosDeIntento: ['recuperado'],
    duracionDeAccionMs: 900,
    esperado: { esIncidente: true, remediacionPermitida: true, gruposEsperados: 1, avisoRequerido: false },
  },
  {
    id: 'AISLAMIENTO',
    titulo: 'Una lectura intentó cruzar de un consultorio a otro',
    categoria: 'tenant_isolation', subtipo: 'lectura_cruzada', feature: 'expediente',
    ruta: '/api/[id]', codigoNormalizado: 'permission_denied',
    /** UN evento. La raya no aplica: aquí una vez ya es demasiadas. */
    fallos: [{ enMs: 0, operationId: 'op-0', tenantRef: 't0' }],
    accionPropuesta: 'reintento_idempotente',
    idempotenciaGarantizada: true,
    resultadosDeIntento: [],
    duracionDeAccionMs: 0,
    esperado: { esIncidente: true, remediacionPermitida: false, gruposEsperados: 1, avisoRequerido: true },
  },
  {
    id: 'API-500-REPETIDO',
    titulo: 'Un 500 que se repite y que nadie ha clasificado todavía',
    categoria: 'unknown', subtipo: 'error_no_clasificado', feature: 'expediente',
    ruta: '/api/[id]', codigoNormalizado: 'http_500',
    fallos: goteo(40, 240_000, 15, 'op'),
    /** Sin categoría no hay runbook, y sin runbook no hay acción segura. */
    accionPropuesta: null,
    resultadosDeIntento: [],
    duracionDeAccionMs: 0,
    esperado: { esIncidente: true, remediacionPermitida: false, gruposEsperados: 1, avisoRequerido: true },
  },
  {
    id: 'RED-PUNTUAL',
    titulo: 'Un fallo de red suelto e inofensivo',
    categoria: 'network', subtipo: 'conexion_perdida', feature: 'nota',
    ruta: '/consulta/[id]', codigoNormalizado: 'network_error',
    /** UNO. Por debajo de toda raya: se anota y no despierta a nadie. */
    fallos: [{ enMs: 0, operationId: 'op-0', tenantRef: 't0' }],
    accionPropuesta: 'reintento_idempotente',
    idempotenciaGarantizada: true,
    resultadosDeIntento: ['recuperado'],
    duracionDeAccionMs: 100,
    /**
     * `remediacionPermitida: true` y `esIncidente: false` a la vez, y no es una
     * contradicción: la política DEJARÍA reintentar, y no hace falta porque no
     * hay incidente. Que una acción sea segura no es motivo para ejecutarla.
     */
    esperado: { esIncidente: false, remediacionPermitida: true, gruposEsperados: 1, avisoRequerido: false },
  },
]

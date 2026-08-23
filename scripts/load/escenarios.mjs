#!/usr/bin/env node
/**
 * LOS ESCENARIOS — cohortes, inyección de fallos y qué se puede afirmar de cada
 * ejecución.
 *
 * ── LA CLASE DE EVIDENCIA ES PARTE DEL ESCENARIO ─────────────────────────────
 *
 * Cada escenario declara, ANTES de correr, qué se puede decir con su resultado.
 * No es una nota al pie: es un campo que viaja en la salida JSON, porque el
 * modo en que estas cosas se malinterpretan es siempre el mismo — alguien copia
 * el número al informe y pierde el contexto por el camino.
 *
 *   `harness-only`      — se probó el ARNÉS y las invariantes de fiabilidad.
 *                         No dice nada del producto ni de la infraestructura.
 *   `local-integration` — se corrió contra un objetivo local real.
 *   `staging-load`      — se corrió contra un entorno dimensionado. NO DISPONIBLE
 *                         hoy: requiere infraestructura que nadie ha autorizado.
 *
 * Ningún escenario de este archivo produce `staging-load`. Ésa es la línea
 * entre lo que se puede demostrar hoy y lo que hace falta pedir.
 */

export const CLASES_DE_EVIDENCIA = {
  HARNESS: 'harness-only',
  LOCAL: 'local-integration',
  STAGING: 'staging-load',
}

/**
 * Perfiles de inyección de fallos.
 *
 * `probabilidad` es por operación de esa clase. Determinista: el arnés usa un
 * generador con semilla, así que el mismo `seed` produce exactamente los mismos
 * fallos en los mismos sitios. Un arnés de fallos no determinista no sirve para
 * una regresión: el día que falle, no se podrá repetir.
 */
export const PERFILES_DE_FALLO = {
  ninguno: {
    nombre: 'ninguno',
    descripcion: 'Camino feliz. Sirve de línea base para comparar.',
    fallos: [],
  },
  'ia-caida': {
    nombre: 'ia-caida',
    descripcion: 'El proveedor de IA devuelve 503 durante toda la ventana.',
    fallos: [{ clase: 'async:razonamiento', modo: 'http-503', probabilidad: 1 }],
    invarianteEsperada: 'La consulta sigue editable y el borrador se guarda; el razonamiento acaba en carta muerta visible.',
  },
  'ia-timeout': {
    nombre: 'ia-timeout',
    descripcion: 'El proveedor de IA acepta y no contesta: se agota el tiempo.',
    fallos: [{ clase: 'async:razonamiento', modo: 'timeout', probabilidad: 1 }],
    invarianteEsperada: 'El cortacircuitos abre y deja de esperar; el camino caliente no cambia de latencia.',
  },
  'evidencia-caida': {
    nombre: 'evidencia-caida',
    descripcion: 'El proveedor de evidencia no responde.',
    fallos: [{ clase: 'async:evidencia', modo: 'http-500', probabilidad: 1 }],
    invarianteEsperada: 'Se informa «evidencia no disponible». No se fabrica ninguna referencia.',
  },
  'transcripcion-caida': {
    nombre: 'transcripcion-caida',
    descripcion: 'La transcripción falla de forma transitoria.',
    fallos: [{ clase: 'async:transcripcion', modo: 'http-503', probabilidad: 0.7 }],
    invarianteEsperada: 'Lo ya capturado se conserva; la entrada escrita sigue disponible.',
  },
  'red-intermitente': {
    nombre: 'red-intermitente',
    descripcion: 'Un 15 % de las escrituras del camino caliente pierde la respuesta DESPUÉS de haberse escrito.',
    fallos: [{ clase: 'hot:guardar-borrador', modo: 'respuesta-perdida', probabilidad: 0.15 },
             { clase: 'hot:agendar-cita', modo: 'respuesta-perdida', probabilidad: 0.15 }],
    invarianteEsperada: 'El reintento del cliente NO duplica: misma llave de idempotencia, mismo resultado.',
  },
  'entrega-duplicada': {
    nombre: 'entrega-duplicada',
    descripcion: 'La cola entrega dos veces el 20 % de los trabajos (semántica «al menos una vez»).',
    fallos: [{ clase: 'async:documento', modo: 'entrega-duplicada', probabilidad: 0.2 },
             { clase: 'async:whatsapp', modo: 'entrega-duplicada', probabilidad: 0.2 }],
    invarianteEsperada: 'Ningún efecto duplicado: la segunda entrega se rechaza por identidad.',
  },
  'saturacion-proveedor': {
    nombre: 'saturacion-proveedor',
    descripcion: 'El proveedor devuelve 429 en la mitad de las llamadas.',
    fallos: [{ clase: 'async:razonamiento', modo: 'http-429', probabilidad: 0.5 },
             { clase: 'async:transcripcion', modo: 'http-429', probabilidad: 0.5 }],
    invarianteEsperada: 'La espera crece con jitter; la profundidad de cola sube acotada y no se pierde trabajo en silencio.',
  },
  'almacenamiento-transitorio': {
    nombre: 'almacenamiento-transitorio',
    descripcion: 'El almacén rechaza el 10 % de los autoguardados de forma transitoria.',
    fallos: [{ clase: 'hot:guardar-borrador', modo: 'http-503', probabilidad: 0.1 }],
    invarianteEsperada: 'Ningún borrador se pierde: el respaldo local cubre y el reintento acotado sube el trabajo.',
  },
  'resultado-caduco': {
    nombre: 'resultado-caduco',
    descripcion: 'El 30 % de los resultados asíncronos vuelve cuando el encuentro ya avanzó.',
    fallos: [{ clase: 'async:razonamiento', modo: 'resultado-caduco', probabilidad: 0.3 }],
    invarianteEsperada: 'El resultado caduco se descarta: no pisa verdad clínica confirmada ni firmada.',
  },
}

/**
 * Las cohortes. `registeredPhysicians` y `concurrentConsultations` son
 * parámetros SEPARADOS por exigencia de #310 — el segundo se deriva del primero
 * salvo que se fije a mano.
 */
export const COHORTES = {
  'baseline-single-tenant': { registeredPhysicians: 1, fraccionSimultanea: 1, ventanaSegundos: 60 },
  'multi-tenant-2k': { registeredPhysicians: 2_000, ventanaSegundos: 60 },
  'multi-tenant-10k': { registeredPhysicians: 10_000, ventanaSegundos: 60 },
  'growth-tier': { registeredPhysicians: 25_000, ventanaSegundos: 60 },
  'large-practice-30k-patients': {
    registeredPhysicians: 1, fraccionSimultanea: 1, ventanaSegundos: 60,
    patientsPerPhysician: 30_000,
    nota: 'El tamaño del expediente importa para lecturas acotadas, no para concurrencia. Se declara aparte a propósito.',
  },
}

/**
 * Lo que se puede correr en CI sin infraestructura y sin gasto.
 *
 * `growth-tier` NO está: no porque no quepa, sino porque una ejecución de una
 * cohorte grande en el arnés simulado sólo demuestra que el arnés escala, y
 * meterla en CI invitaría a citarla como si demostrara otra cosa.
 */
export const ESCENARIOS_CI = ['baseline-single-tenant', 'multi-tenant-2k']

export function resolverEscenario(nombreCohorte, nombrePerfil = 'ninguno') {
  const cohorte = COHORTES[nombreCohorte]
  if (!cohorte) throw new Error(`Cohorte desconocida: ${nombreCohorte}. Conocidas: ${Object.keys(COHORTES).join(', ')}`)
  const perfil = PERFILES_DE_FALLO[nombrePerfil]
  if (!perfil) throw new Error(`Perfil de fallo desconocido: ${nombrePerfil}. Conocidos: ${Object.keys(PERFILES_DE_FALLO).join(', ')}`)
  return { nombre: `${nombreCohorte}::${nombrePerfil}`, cohorte: { ...cohorte }, perfil }
}

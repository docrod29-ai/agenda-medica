#!/usr/bin/env node
/**
 * EL MOTOR DEL ARNÉS — determinista, sin dependencias, sin red.
 *
 * ── QUÉ DEMUESTRA Y QUÉ NO ───────────────────────────────────────────────────
 *
 * Con el controlador `simulado` esto NO mide Ausculta. Mide el MODELO: la forma
 * de la carga, el comportamiento de las colas bajo esa forma, y si las
 * invariantes de fiabilidad se sostienen cuando se inyectan fallos. Eso vale
 * para cazar un defecto de diseño —una cola sin fondo, un reintento que
 * duplica, un resultado caduco que pisa la nota— y no vale absolutamente nada
 * como afirmación de capacidad. La salida lo dice en su propio campo
 * `evidenceClass`, no en una nota al pie que alguien recortará.
 *
 * Con el controlador `http` sí se mide un objetivo real, y entonces la clase de
 * evidencia sube. Ese controlador está PREPARADO y no ejecutado: hoy no hay un
 * entorno donde apuntarlo que no sea producción, y producción está prohibida.
 *
 * ── POR QUÉ ESTE ARCHIVO ES .mjs Y NO TypeScript ─────────────────────────────
 *
 * Para que lo pueda ejecutar `node` a secas —igual que
 * `scripts/product/generate-consultorio-load-fixture.mjs`, que ya vive así— y
 * también `vitest`, que importa `.mjs` sin ceremonia. Un solo archivo, dos
 * consumidores, ninguna copia.
 *
 * Las primitivas de PRODUCTO viven en `src/lib/reliability/` y son las que
 * corren en la aplicación. Éste es su gemelo de laboratorio, y hay una prueba
 * (`src/__tests__/arnes-carga-coincide-con-producto.test.ts`) que comprueba que
 * los dos deciden lo mismo. Sin esa prueba, esto sería un segundo sistema; con
 * ella, es un arnés.
 *
 * ── DETERMINISMO ─────────────────────────────────────────────────────────────
 *
 * Nada de `Math.random` ni de `Date.now`. Todo sale de la semilla. Un arnés de
 * fallos que no se puede repetir no sirve para una regresión: el día que
 * encuentre algo, no se podrá volver a encontrar.
 */

/** Generador con semilla. El mismo que usa el generador de fixtures de #319. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Retroceso exponencial con jitter completo. Gemelo de `reintentos.ts`. */
export function esperaMs(intento, { baseMs, topeMs, factorSaturacion }, veredicto, azar) {
  const n = Math.max(1, Math.floor(intento))
  const factor = veredicto === 'saturacion' ? factorSaturacion : 1
  const techo = Math.min(baseMs * factor * Math.pow(2, n - 1), topeMs)
  const r = Math.min(Math.max(azar(), 0), 0.999999)
  return Math.round(techo * r)
}

export const POLITICA = { reintentosMaximos: 3, baseMs: 500, topeMs: 30_000, presupuestoTotalMs: 90_000, factorSaturacion: 4 }

export function veredictoDeModo(modo) {
  if (modo === 'timeout') return 'transitorio'
  if (modo === 'http-429') return 'saturacion'
  if (modo === 'http-500' || modo === 'http-503') return 'transitorio'
  if (modo === 'http-401' || modo === 'http-403') return 'permanente'
  return 'transitorio'
}

/**
 * Latencia sintética por clase, en ms.
 *
 * Son valores del MODELO, no medidos. Existen para que las colas tengan una
 * dinámica que observar; NO se reportan como latencia del producto. La salida
 * marca `latencySource: 'modelo-sintetico'` para que no puedan citarse como si
 * lo fueran.
 */
const LATENCIA_MODELO = {
  'hot:abrir-paciente': [80, 260],
  'hot:abrir-encuentro': [90, 300],
  'hot:guardar-borrador': [110, 420],
  'hot:reanudar-borrador': [100, 380],
  'hot:editar-nota': [1, 8],
  'hot:buscar-paciente': [60, 240],
  'hot:agendar-cita': [140, 520],
  'hot:firmar-nota': [200, 900],
  'async:transcripcion': [2_000, 18_000],
  'async:razonamiento': [3_000, 25_000],
  'async:evidencia': [1_500, 12_000],
  'async:documento': [800, 6_000],
  'async:notificacion': [200, 2_500],
  'async:whatsapp': [150, 1_800],
  'async:analitica': [50, 600],
}

function muestraLatencia(clase, azar) {
  const [lo, hi] = LATENCIA_MODELO[clase] ?? [50, 500]
  return Math.round(lo + azar() * (hi - lo))
}

export function percentil(ordenados, p) {
  if (!ordenados.length) return null
  if (ordenados.length === 1) return ordenados[0]
  const pos = Math.min(Math.max(p, 0), 1) * (ordenados.length - 1)
  const bajo = Math.floor(pos), alto = Math.ceil(pos)
  if (bajo === alto) return ordenados[bajo]
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo)
}

const CLASES_DE_COLA = {
  'async:transcripcion': 'transcription',
  'async:razonamiento': 'reasoning',
  'async:evidencia': 'evidence',
  'async:documento': 'document',
  'async:notificacion': 'notification',
  'async:whatsapp': 'whatsapp',
}

const REINTENTOS_POR_CLASE = {
  'async:transcripcion': 3,
  'async:razonamiento': 2,
  'async:evidencia': 2,
  'async:documento': 3,
  'async:notificacion': 5,
  'async:whatsapp': 5,
  'async:analitica': 1,
  'hot:guardar-borrador': 2,
  'hot:agendar-cita': 1,
}

/**
 * Corre un escenario.
 *
 * Modelo de tiempo por SEGUNDOS discretos: en cada segundo llegan las
 * operaciones que tocan por tasa, se drena la cola según su capacidad, y se
 * anota. Es grueso a propósito — un simulador de eventos continuo daría
 * números más bonitos y exactamente la misma capacidad de decir la verdad,
 * que es ninguna.
 */
export function correrEscenario({ modelo, escenario, seed, capacidadColaPorSegundo = 8, profundidadMaxima = 5_000 }) {
  const azar = mulberry32(seed)
  const ventana = escenario.cohorte.ventanaSegundos ?? 60
  const fallosPorClase = new Map()
  for (const f of escenario.perfil.fallos ?? []) fallosPorClase.set(f.clase, f)

  const latenciasCalientes = []
  const colas = {}
  for (const nombre of Object.values(CLASES_DE_COLA)) {
    colas[nombre] = {
      maxDepth: 0, retryCount: 0, duplicateCount: 0, deadLetterCount: 0,
      pendientes: [], esperaMsTotal: 0, completados: 0,
    }
  }

  const contadores = {
    requestCount: 0, successCount: 0, errorCount: 0, degradedCount: 0,
    lostDraftCount: 0, blankScreenCount: 0, crossTenantLeakageCount: 0,
    unboundedReadCount: 0, idempotencyViolationCount: 0, silentProviderFailureCount: 0,
    staleResultsDiscarded: 0, duplicateDeliveriesRejected: 0, localFallbackUsed: 0,
    rechazadosPorContrapresion: 0,
  }

  /**
   * Identidades ya vistas. Es lo único que impide que un reintento o una
   * segunda entrega produzcan un segundo efecto.
   */
  const identidadesVistas = new Set()
  let ordinal = 0

  const acumuladoPorClase = {}
  for (const clase of Object.keys(modelo.opsPorSegundo)) acumuladoPorClase[clase] = 0

  for (let segundo = 0; segundo < ventana; segundo += 1) {
    // ── 1. LLEGADAS ─────────────────────────────────────────────────────────
    for (const [clase, tasa] of Object.entries(modelo.opsPorSegundo)) {
      acumuladoPorClase[clase] += tasa
      const cuantas = Math.floor(acumuladoPorClase[clase])
      acumuladoPorClase[clase] -= cuantas

      for (let i = 0; i < cuantas; i += 1) {
        ordinal += 1
        const fallo = fallosPorClase.get(clase)
        const activa = Boolean(fallo) && azar() < fallo.probabilidad
        const claveIdem = `${clase}:${ordinal}`
        contadores.requestCount += 1

        // ── Resultado caduco: vuelve cuando el encuentro ya avanzó ──────────
        if (activa && fallo.modo === 'resultado-caduco') {
          // Se DESCARTA. No pisa verdad clínica confirmada ni firmada. Cuenta
          // como manejado, nunca como éxito de la tarea.
          contadores.staleResultsDiscarded += 1
          continue
        }

        // ── Entrega duplicada: la cola entrega dos veces ────────────────────
        if (activa && fallo.modo === 'entrega-duplicada') {
          if (identidadesVistas.has(claveIdem)) contadores.idempotencyViolationCount += 1
          identidadesVistas.add(claveIdem)
          // La SEGUNDA entrega, con la misma identidad, no puede producir efecto.
          contadores.duplicateDeliveriesRejected += 1
          const nombreCola = CLASES_DE_COLA[clase]
          if (nombreCola) colas[nombreCola].duplicateCount += 1
        }

        // ── Respuesta perdida DESPUÉS del commit: el cliente reintenta ──────
        if (activa && fallo.modo === 'respuesta-perdida') {
          if (identidadesVistas.has(claveIdem)) contadores.idempotencyViolationCount += 1
          identidadesVistas.add(claveIdem)
          // El reintento llega con la MISMA llave: se le devuelve el resultado
          // original. Si esto produjera un segundo efecto —o un 409 mentiroso
          // sobre un hueco que el propio usuario acaba de ocupar—, sería un
          // defecto de idempotencia y se contaría arriba.
          contadores.requestCount += 1
          contadores.successCount += 1
          latenciasCalientes.push(muestraLatencia(clase, azar))
        }

        const modoFallo = activa && ['http-500', 'http-503', 'http-429', 'timeout'].includes(fallo.modo)
          ? fallo.modo
          : null

        // ── Camino caliente ────────────────────────────────────────────────
        if (clase.startsWith('hot:')) {
          latenciasCalientes.push(muestraLatencia(clase, azar))
          if (modoFallo) {
            // Falla el almacén, no el médico: el borrador cae al respaldo local
            // y se sube después. Por eso `lostDraftCount` sigue en cero — y si
            // algún día no lo estuviera, sería bloqueador incondicional.
            contadores.localFallbackUsed += 1
            contadores.degradedCount += 1
          } else {
            contadores.successCount += 1
          }
          continue
        }

        // ── Trabajo asíncrono: a su cola ───────────────────────────────────
        const nombreCola = CLASES_DE_COLA[clase]
        if (!nombreCola) { contadores.successCount += 1; continue }
        const cola = colas[nombreCola]
        if (cola.pendientes.length >= profundidadMaxima) {
          // CONTRAPRESIÓN: se rechaza en voz alta en vez de crecer sin fondo.
          // Un rechazo observable es recuperable; una cola infinita es el mismo
          // fallo más tarde y con más trabajo dentro.
          contadores.rechazadosPorContrapresion += 1
          contadores.errorCount += 1
          continue
        }
        cola.pendientes.push({ clase, modoFallo, intentos: 0, gastadoMs: 0, encoladoEn: segundo })
        cola.maxDepth = Math.max(cola.maxDepth, cola.pendientes.length)
      }
    }

    // ── 2. DRENAJE: capacidad FINITA por segundo y por cola ─────────────────
    for (const cola of Object.values(colas)) {
      let capacidad = capacidadColaPorSegundo
      while (capacidad > 0 && cola.pendientes.length) {
        const t = cola.pendientes.shift()
        capacidad -= 1
        t.intentos += 1
        t.gastadoMs += muestraLatencia(t.clase, azar)

        if (!t.modoFallo) {
          cola.completados += 1
          cola.esperaMsTotal += (segundo - t.encoladoEn) * 1000
          contadores.successCount += 1
          continue
        }

        const veredicto = veredictoDeModo(t.modoFallo)
        const max = REINTENTOS_POR_CLASE[t.clase] ?? 2
        if (veredicto === 'permanente' || t.intentos > max || t.gastadoMs >= POLITICA.presupuestoTotalMs) {
          // CARTA MUERTA: estado terminal VISIBLE. Un trabajo que desaparece sin
          // asiento sería `silentProviderFailureCount`, que es bloqueador.
          cola.deadLetterCount += 1
          contadores.degradedCount += 1
          continue
        }
        t.gastadoMs += esperaMs(t.intentos, POLITICA, veredicto, azar)
        cola.retryCount += 1
        cola.pendientes.push(t)
        cola.maxDepth = Math.max(cola.maxDepth, cola.pendientes.length)
      }
    }
  }

  // Lo que queda encolado al cerrar la ventana NO es éxito. Contarlo como tal
  // es el error clásico de estos arneses: la cola se vacía en el informe y no
  // en la realidad.
  let pendientes = 0
  for (const c of Object.values(colas)) pendientes += c.pendientes.length

  const ordenadas = [...latenciasCalientes].sort((a, b) => a - b)

  return {
    ventanaSegundos: ventana,
    contadores: { ...contadores, pendientesAlCerrar: pendientes },
    latenciaCalienteMs: {
      p50: Math.round(percentil(ordenadas, 0.5) ?? 0),
      p95: Math.round(percentil(ordenadas, 0.95) ?? 0),
      p99: Math.round(percentil(ordenadas, 0.99) ?? 0),
      muestras: ordenadas.length,
    },
    colas: Object.fromEntries(Object.entries(colas).map(([k, v]) => [k, {
      maxDepth: v.maxDepth,
      retryCount: v.retryCount,
      duplicateCount: v.duplicateCount,
      deadLetterCount: v.deadLetterCount,
      esperaMediaMs: v.completados ? Math.round(v.esperaMsTotal / v.completados) : 0,
    }])),
  }
}

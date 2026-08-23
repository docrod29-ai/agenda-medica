/**
 * EL PUENTE CON LO QUE YA EXISTE — sin sustituirlo.
 *
 * ── QUÉ HABÍA ANTES DE ESTE KERNEL ───────────────────────────────────────────
 *
 * Dos módulos, escritos tras la caída del 31-jul-2026 y buenos:
 *
 *  · `src/lib/ia/fallo-proveedor.ts` — clasifica el fallo del proveedor, dice si
 *    se arregla reintentando, redacta el mensaje del médico según de quién sea
 *    la llave, y decide si el aviso le toca al dueño.
 *  · `src/lib/ia/incidentes-servidor.ts` — agrupa por proveedor+clase+hora en
 *    `platform_incidentes`, cuenta repeticiones, junta funciones afectadas y
 *    nunca lanza.
 *
 * ── QUÉ SE GENERALIZA Y QUÉ SE QUEDA DONDE ESTÁ ──────────────────────────────
 *
 * Se generaliza la **identidad y la decisión**: firma, agrupación, umbral,
 * política de remediación, runbook, tiempos. Eso ahora sirve para agenda,
 * autoguardado, notificaciones o persistencia igual que para la IA.
 *
 * Se queda donde está lo que es **exclusivamente de IA**: la clasificación por
 * cuerpo de respuesta (`credit balance is too low` disfrazado de 400), la
 * distinción llave-del-consultorio contra llave-de-la-plataforma, y el aviso al
 * dueño. Nada de eso tiene sentido fuera del proveedor de IA, y moverlo aquí lo
 * habría convertido en genérico a costa de perder lo que lo hace útil.
 *
 * ── LO QUE ESTE PUENTE NO HACE ───────────────────────────────────────────────
 *
 * No escribe en Firestore, no cambia `claveIncidente()` y no toca
 * `platform_incidentes`. La clave por hora de aquel módulo sigue siendo la suya:
 * dos claves distintas para el mismo documento serían dos fuentes de verdad para
 * el mismo incidente.
 *
 * Módulo PURO.
 */
import {
  avisoAlDueno, seArreglaReintentando,
  type ClaseFallo, type QuienPaga,
} from '@/lib/ia/fallo-proveedor'
import type { EventoIncidente, Reintentabilidad, Severidad } from './taxonomia'
import { dimensionesDe } from './taxonomia'
import type { IncidenteParaDecidir } from './remediacion'
import { runbookPara, type Runbook } from './runbooks'

/** Lo que se sabe del fallo, con los mismos nombres que ya usa `ReporteFallo`. */
export interface FalloDeIA {
  readonly clase: ClaseFallo
  readonly quien: QuienPaga
  readonly proveedor: 'anthropic' | 'openai' | 'assemblyai'
  readonly feature: string
  readonly status: number
  readonly appVersion: string
  readonly ocurridoEn: string
  readonly ruta?: string
  readonly correlationId?: string
  readonly tenantRef?: string
  readonly operationId?: string
}

/**
 * De `ClaseFallo` a severidad de incidente.
 *
 * `sin_saldo` y `llave_invalida` son sev2 porque tiran la IA de TODOS los
 * consultorios que van con la llave de la plataforma y no se arreglan solos: hay
 * que ir a pagar o a rotar. `sobrecarga` y `limite_tasa` son sev3 porque pasan
 * solos. No son cifras clínicas: son la traducción de una decisión que este
 * producto ya tomó el 31-jul.
 */
function severidadDe(clase: ClaseFallo, quien: QuienPaga): Severidad {
  if (clase === 'sin_saldo' || clase === 'llave_invalida') {
    // Con llave del consultorio afecta a UN cliente y él puede arreglarlo en un minuto.
    return quien === 'plataforma' ? 'sev2' : 'sev3'
  }
  return 'sev3'
}

/** Reutiliza `seArreglaReintentando()`: no se decide dos veces lo mismo. */
export function reintentabilidadDe(clase: ClaseFallo): Reintentabilidad {
  if (!seArreglaReintentando(clase)) return 'nunca'
  return clase === 'timeout' ? 'inmediato' : 'tras_espera'
}

/**
 * El fallo de IA, dicho en el vocabulario del kernel.
 *
 * `subtipo` es la `ClaseFallo` tal cual: ya son etiquetas en minúscula con guión
 * bajo, exactamente la forma que exige la firma. Traducirlas a otras palabras
 * habría creado dos nombres para el mismo fallo.
 */
export function eventoDesdeFalloDeIA(f: FalloDeIA): EventoIncidente {
  return {
    categoria: 'ai_provider',
    subtipo: f.clase,
    feature: f.feature,
    ...(f.ruta ? { ruta: f.ruta } : {}),
    proveedor: f.proveedor,
    codigoNormalizado: `http_${Math.max(0, Math.trunc(f.status))}`,
    appVersion: f.appVersion,
    ocurridoEn: f.ocurridoEn,
    ...(f.correlationId ? { correlationId: f.correlationId } : {}),
    ...(f.tenantRef ? { tenantRef: f.tenantRef } : {}),
    ...(f.operationId ? { operationId: f.operationId } : {}),
    severidad: severidadDe(f.clase, f.quien),
  }
}

/** Lo que necesita la política de remediación para decidir sobre un fallo de IA. */
export function incidenteParaDecidirDesdeIA(f: FalloDeIA): IncidenteParaDecidir {
  const base = dimensionesDe({ categoria: 'ai_provider', severidad: severidadDe(f.clase, f.quien) })
  return {
    categoria: 'ai_provider',
    dimensiones: { ...base, reintentabilidad: reintentabilidadDe(f.clase) },
    /**
     * Una llamada a un modelo se puede repetir sin dejar nada a medias: no
     * escribe en el expediente, la escribe después el médico al aceptar. Por eso
     * la idempotencia está garantizada aquí y no lo está en `persistence`.
     */
    idempotenciaGarantizada: true,
  }
}

/** El runbook que le toca. Delega en el motor: no hay una tabla paralela aquí. */
export function runbookDeFalloDeIA(f: FalloDeIA): Runbook {
  return runbookPara('ai_provider', f.clase)
}

/**
 * ¿Le toca al dueño enterarse? Delega en `avisoAlDueno()`, que ya lo sabe.
 *
 * Repetir aquí la regla «con llave del consultorio no es incidencia de
 * plataforma» habría creado el segundo sitio donde cambiarla — y el día que
 * cambiara en uno solo, el tablero del dueño se llenaría de ruido ajeno otra vez.
 */
export function leTocaAlDueno(f: FalloDeIA): boolean {
  return avisoAlDueno(f.clase, f.quien, f.proveedor) !== null
}

export const LO_QUE_SE_QUEDA_EN_IA_Y_POR_QUE = {
  clasificacionPorCuerpo:
    'Sólo Anthropic disfraza el saldo agotado de 400 y sólo OpenAI mete ' +
    '`insufficient_quota` dentro de un 429. Eso es conocimiento del proveedor, ' +
    'no una taxonomía general.',
  llaveDelConsultorioVsPlataforma:
    'Es un modelo de negocio, no un modo de fallo: ningún otro subsistema tiene ' +
    'un cliente que pueda arreglar la avería desde Configuración.',
  avisoAlDueno:
    'El aviso al dueño depende de quién paga. Generalizarlo habría obligado a ' +
    'inventar un «quién paga» para el autoguardado, que no existe.',
} as const

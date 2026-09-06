/**
 * CÓMO DE GRAVE ES UNA ALERTA, Y QUÉ DEBE PASAR EN CONSECUENCIA.
 *
 * ── EL PROBLEMA QUE RESUELVE ─────────────────────────────────────────────────
 *
 * Hoy las alertas clínicas se clasifican en `info | advertencia | critica`. Tres
 * cajones para cosas que no se parecen en nada:
 *
 *   · «este fármaco está CONTRAINDICADO en el embarazo»
 *   · «hay que AJUSTAR la dosis por función renal»
 *   · «VIGILA el potasio si se combinan»
 *   · «existe una interacción DESCRITA, sin acción requerida»
 *
 * Las cuatro caben en «crítica», y cuando todo es crítico nada lo es: el médico
 * aprende a pasar por encima del color rojo, y el día que aparece el que sí
 * importa ya no lo ve. Es el fallo clásico de los sistemas de alertas clínicas, y
 * el charter lo dice con estas palabras: **«no marcar todo como contraindicado»**.
 *
 * ── LO QUE ESTE MÓDULO APORTA ────────────────────────────────────────────────
 *
 * Separa dos cosas que estaban mezcladas:
 *
 *   1. **QUÉ ES** la alerta — su naturaleza clínica (`Clasificacion`).
 *   2. **QUÉ HACE** el software con ella — si detiene, si pide justificar, si
 *      sólo informa (`Conducta`).
 *
 * La primera es criterio médico. La segunda es una decisión de producto, y esa
 * sí es mía: qué interrumpe al médico y qué no.
 *
 * ── LO QUE ESTE MÓDULO **NO** HACE ───────────────────────────────────────────
 *
 * **No clasifica ningún fármaco.** Aquí sólo vive el esquema — los ocho niveles,
 * qué significa cada uno y qué conducta le corresponde. Decir «amoxicilina en
 * alergia a penicilina es CONTRAINDICATED» es criterio clínico y lo asigna el
 * médico responsable, no un archivo de software.
 *
 * Módulo PURO.
 */

/**
 * Los ocho niveles del charter, del más grave al más leve.
 *
 * El orden del tipo ES el orden de gravedad, y de ahí sale `masGrave`: no hay
 * una tabla de prioridades separada que pueda desincronizarse.
 */
export const CLASIFICACIONES = [
  /** No debe administrarse. El daño esperado supera cualquier beneficio previsible. */
  'BLOCK',
  /** Contraindicación formal descrita en la ficha o la guía. */
  'CONTRAINDICATED',
  /** Debe evitarse; existe alternativa preferible. */
  'AVOID',
  /** No recomendado de rutina, admisible con justificación. */
  'NOT_RECOMMENDED',
  /** Se puede usar, pero la dosis o el intervalo cambian. */
  'DOSE_ADJUST',
  /** Se puede usar vigilando algo concreto (un laboratorio, un signo). */
  'MONITOR',
  /** Se muestra sin pedir nada: contexto que puede importar. */
  'PASSIVE',
  /** Dato informativo. No implica ninguna acción. */
  'INFORMATION',
] as const

export type Clasificacion = (typeof CLASIFICACIONES)[number]

/**
 * Qué hace el software cuando aparece una alerta de esa clase.
 *
 * Es deliberadamente CORTO. Tres conductas, no ocho: multiplicar los
 * comportamientos de la interfaz por los niveles clínicos produce una matriz que
 * nadie entiende y que acaba implementada a medias.
 */
export type Conducta =
  /**
   * DETIENE la acción y exige una justificación escrita para continuar.
   *
   * No es un muro: un bloqueo del que no se puede salir acaba en que el médico
   * borra la alergia del expediente para poder firmar —mutilando el registro— o
   * deja de usar la aplicación. Lo que hace falta es que pasar por encima CUESTE
   * y quede constancia de quién y por qué.
   */
  | 'detener'
  /** Pide una confirmación explícita, sin exigir texto. */
  | 'confirmar'
  /** Se muestra y no interrumpe. */
  | 'informar'

const CONDUCTA_DE: Record<Clasificacion, Conducta> = {
  BLOCK: 'detener',
  CONTRAINDICATED: 'detener',
  AVOID: 'confirmar',
  NOT_RECOMMENDED: 'confirmar',
  DOSE_ADJUST: 'confirmar',
  MONITOR: 'informar',
  PASSIVE: 'informar',
  INFORMATION: 'informar',
}

/** Etiqueta para el médico. En su lengua, no en la del catálogo. */
const ETIQUETA_DE: Record<Clasificacion, string> = {
  BLOCK: 'No administrar',
  CONTRAINDICATED: 'Contraindicado',
  AVOID: 'Evitar',
  NOT_RECOMMENDED: 'No recomendado',
  DOSE_ADJUST: 'Ajustar dosis',
  MONITOR: 'Vigilar',
  PASSIVE: 'A considerar',
  INFORMATION: 'Informativo',
}

export function conductaDe(c: Clasificacion): Conducta {
  return CONDUCTA_DE[c] ?? 'informar'
}

export function etiquetaDe(c: Clasificacion): string {
  return ETIQUETA_DE[c] ?? 'Informativo'
}

/** ¿Esta alerta detiene la firma o la receta? */
export function detiene(c: Clasificacion): boolean {
  return conductaDe(c) === 'detener'
}

/**
 * La más grave de un conjunto. `null` si no hay ninguna.
 *
 * ── SIN LLAMADOR, Y EL COMENTARIO ANTERIOR MENTÍA (4-sep-2026) ──────────────
 *
 * Decía «se usa para decidir qué conducta aplica a una receta entera: manda la
 * peor de sus alertas, no la última que se calculó». **No la usa nadie.**
 *
 * Y lo que prometía ya está resuelto por otro camino: `expediente/nom004.ts`
 * recorre las alertas UNA A UNA y llama a `detiene()` en cada una, así que basta
 * una que bloquee para que salga como error. La peor manda sin necesidad de
 * calcularla aparte.
 *
 * Se deja escrita —es correcta y barata— pero **el comentario dice la verdad**:
 * un comentario que afirma un uso inexistente es peor que la función huérfana,
 * porque hace creer que la lógica vive aquí cuando vive en otro sitio.
 */
export function masGrave(cs: readonly Clasificacion[]): Clasificacion | null {
  let peor: Clasificacion | null = null
  let peorIdx: number = CLASIFICACIONES.length
  for (const c of cs) {
    const i = CLASIFICACIONES.indexOf(c)
    if (i >= 0 && i < peorIdx) { peorIdx = i; peor = c }
  }
  return peor
}

/**
 * PUENTE DESDE EL MODELO VIEJO — y por qué es conservador.
 *
 * El código existente marca `info | advertencia | critica`. Traducir hacia
 * arriba («crítica → BLOCK») convertiría en un muro cosas que hoy sólo avisan, y
 * eso es cambiar conducta clínica desde una tabla de conversión. Así que:
 *
 *   · `critica`    → CONTRAINDICATED (detiene, como hoy detiene la firma)
 *   · `advertencia`→ MONITOR (informa, como hoy)
 *   · `info`       → INFORMATION
 *
 * Ninguna traducción INVENTA gravedad: cada una conserva la conducta actual. El
 * detalle fino —qué es BLOCK y qué es AVOID— lo asigna el médico cuando revise
 * su catálogo, y para eso existe el esquema.
 */
export function desdeSeveridadHeredada(s: 'info' | 'advertencia' | 'critica'): Clasificacion {
  if (s === 'critica') return 'CONTRAINDICATED'
  if (s === 'advertencia') return 'MONITOR'
  return 'INFORMATION'
}

export const POR_QUE_NO_TODO_ES_CRITICO =
  'Porque cuando todo es crítico nada lo es: el médico aprende a pasar por ' +
  'encima del color rojo, y el día que aparece el que sí importaba ya no lo ve. ' +
  'Separar «contraindicado» de «ajusta la dosis» y de «vigila el potasio» es lo ' +
  'que hace que una alerta signifique algo.'

export const QUE_NO_DECIDE_ESTE_MODULO =
  'No clasifica ningún fármaco. Aquí vive el esquema —los ocho niveles y qué ' +
  'conducta le toca a cada uno—. Decir que un fármaco concreto está ' +
  'CONTRAINDICADO en una situación concreta es criterio clínico y lo asigna el ' +
  'médico responsable, no un archivo de software.'

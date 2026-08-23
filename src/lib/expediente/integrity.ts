import type { NotaMedica } from '@/types/expediente'

/**
 * NOM-024-SSA3-2012 — Integridad del dato.
 * Hash SHA-256 sobre los campos clínicos críticos. Si la nota se altera
 * después de la firma, el hash deja de coincidir → se detecta la alteración.
 *
 * Usa Web Crypto API (crypto.subtle) — disponible en navegador y en
 * Node 18+ / Edge runtime. Sin dependencias externas.
 */

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Serialización ESTABLE: ordena las llaves de todo objeto de forma determinista
 * y omite `undefined`.
 *
 * EXPORTADA (v-durabilidad, #312) sin tocar una coma de su cuerpo: el arnés de
 * recuperación necesita la MISMA canonicalización para poder comparar un
 * documento del respaldo con el documento vivo. Reimplementarla allí sería
 * fabricar una segunda verdad sobre qué significa «el mismo documento» — y dos
 * canonicalizaciones que discrepan producen «alterada» sobre notas intactas,
 * que es el modo de falla grave del sello (REG-060).
 *
 * Es indispensable porque Firestore NO conserva el orden de las llaves de los
 * mapas al recargar la nota; sin esto, el JSON —y por tanto el hash— cambiaría
 * al releer una nota intacta y daría un falso "alterada".
 */
export function ordenEstable(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(ordenEstable)
  if (x && typeof x === 'object') {
    const src = x as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src).sort()) {
      if (src[k] !== undefined) out[k] = ordenEstable(src[k])
    }
    return out
  }
  return x
}

/**
 * CONGELADO — sello v2. NO EDITAR.
 *
 * Cada nota ya firmada en producción con `hashVersion: 2` depende de que esta
 * función devuelva byte por byte lo mismo que devolvía el día que se firmó.
 * Tocar una coma aquí convierte notas legítimas en "alterada". El vector golden
 * de `e0-12-sello-integridad.test.ts` (caso 6) existe exactamente para eso.
 *
 * Cubre 10 campos. Los huecos que dejaba —`preop`, `hospital`, `infectologia`,
 * `iaAuditoria`, la trazabilidad del dictado, el encabezado medicolegal— son la
 * razón de ser de v3; ver COBERTURA_SELLO.
 */
function canonicoV2(nota: NotaMedica): string {
  return JSON.stringify(ordenEstable({
    id: nota.metadata.id,
    tipo: nota.tipo,
    pacienteId: nota.pacienteId,
    medicoId: nota.metadata.medicoId,
    fechaConsulta: nota.fechaConsulta,
    secciones: nota.secciones.map(s => ({ k: s.key, v: s.value })),
    diagnosticos: nota.diagnosticos,
    medicamentos: nota.medicamentos,
    alergias: nota.alergias,
    signosVitales: nota.signosVitales ?? null,
  }))
}

/**
 * Sello v3 — cubre TODO el contenido firmable de la nota (E0-12).
 *
 * Qué cambia respecto de v2 y por qué: v2 sellaba 10 de los 24 campos de
 * `NotaMedica`. Se podía alterar el puntaje de riesgo quirúrgico de una
 * valoración preoperatoria FIRMADA, el día de antibiótico de una nota de
 * infectología, la procedencia de la IA (con qué modelo se generó, si el médico
 * la revisó), la transcripción que es la FUENTE del expediente, o la cédula
 * profesional del encabezado, y la pantalla seguía diciendo "integridad
 * verificada". El sello no impide alterar: hace la alteración DETECTABLE, y era
 * detectable sólo en la mitad del documento.
 *
 * Todo lo que queda fuera está en CAMPOS_NO_SELLADOS_V3 con su razón escrita, y
 * el test de cobertura falla si aparece un campo nuevo sin clasificar. Un campo
 * firmable no vuelve a quedar fuera del sello por descuido.
 */
function canonicoV3(nota: NotaMedica): string {
  return JSON.stringify(ordenEstable({
    // Versión LITERAL, no `nota.metadata.hashVersion`: sellar la versión declarada
    // sería auto-referencia. Con el literal, bajarle la versión a un sello v3 para
    // que se re-verifique con el juego de campos v2 no cuela → sale "alterada".
    v: 3,
    // ── identidad del documento
    id: nota.metadata.id,          // metadata.id, NO el `id` de nivel superior (ver exclusiones)
    clinicId: nota.clinicId ?? null,
    pacienteId: nota.pacienteId,
    pacienteNombre: nota.pacienteNombre ?? '',
    tipo: nota.tipo,
    fechaConsulta: nota.fechaConsulta,
    createdAt: nota.createdAt ?? null,
    creadoPor: nota.creadoPor ?? '',
    // ── encabezado medicolegal (cédula y establecimiento son parte del documento)
    meta: {
      tipoNota: nota.metadata.tipoNota ?? null,
      clinicId: nota.metadata.clinicId ?? null,
      pacienteId: nota.metadata.pacienteId ?? null,
      medicoId: nota.metadata.medicoId,
      cedulaProfesional: nota.metadata.cedulaProfesional ?? '',
      especialidad: nota.metadata.especialidad ?? '',
      establecimiento: nota.metadata.establecimiento ?? '',
      fechaCreacion: nota.metadata.fechaCreacion ?? null,
      fuenteGeneracion: nota.metadata.fuenteGeneracion ?? null,
    },
    // ── cuerpo clínico
    resumenEjecutivo: nota.resumenEjecutivo ?? '',
    // Sección COMPLETA, no sólo {key,value}: el documento imprime `label`, así que
    // cambiar "Objetivo" por "Subjetivo" cambia lo que la nota AFIRMA.
    secciones: nota.secciones,
    signosVitales: nota.signosVitales ?? null,
    diagnosticos: nota.diagnosticos,
    medicamentos: nota.medicamentos,
    alergias: nota.alergias,
    // ── los tres huecos que nombra el backlog
    preop: nota.preop ?? null,
    hospital: nota.hospital ?? null,
    infectologia: nota.infectologia ?? null,
    // ── contexto y trazabilidad
    estudiosOrden: nota.estudiosOrden ?? null,
    internamientoId: nota.internamientoId ?? null,
    iaAuditoria: nota.iaAuditoria ?? null,
    transcripcionCruda: nota.transcripcionCruda ?? null,
    dialogoDiarizado: nota.dialogoDiarizado ?? null,
  }))
}

/** Versión del algoritmo de sello que usan las notas NUEVAS. */
export const HASH_VERSION = 3

/**
 * Versiones que este build sabe RE-VERIFICAR.
 * v1 no está: dependía del orden de llaves, que Firestore no conserva.
 */
export const VERSIONES_VERIFICABLES = [2, 3] as const
export type VersionSello = (typeof VERSIONES_VERIFICABLES)[number]

/**
 * Canonizador por versión. Cada nota se re-verifica con el algoritmo de SU sello:
 * subir HASH_VERSION sin esto convertiría todas las notas v2 —hoy "verificada"—
 * en "legado" de golpe, perdiendo la verificabilidad de todo el histórico firmado.
 */
const CANONICO: Record<VersionSello, (n: NotaMedica) => string> = {
  2: canonicoV2,
  3: canonicoV3,
}

/**
 * Partición EXPLÍCITA de los campos de `NotaMedica` bajo el sello v3.
 * Cada campo está en esta lista o en CAMPOS_NO_SELLADOS_V3, con su razón escrita.
 * El test de cobertura falla si un campo del tipo no aparece en ninguna.
 */
export const CAMPOS_SELLADOS_V3: readonly string[] = [
  // El contenedor `metadata` se sella campo por campo (los `metadata.*` de abajo).
  'metadata',
  'clinicId',
  'pacienteId',
  'pacienteNombre',
  'tipo',
  'fechaConsulta',
  'createdAt',
  'creadoPor',
  'metadata.id',
  'metadata.tipoNota',
  'metadata.clinicId',
  'metadata.pacienteId',
  'metadata.medicoId',
  'metadata.cedulaProfesional',
  'metadata.especialidad',
  'metadata.establecimiento',
  'metadata.fechaCreacion',
  'metadata.fuenteGeneracion',
  'resumenEjecutivo',
  'secciones',
  'signosVitales',
  'diagnosticos',
  'medicamentos',
  'alergias',
  'preop',
  'hospital',
  'infectologia',
  'estudiosOrden',
  'internamientoId',
  'iaAuditoria',
  'transcripcionCruda',
  'dialogoDiarizado',
]

/**
 * Campos OPCIONALES que v3 sella como `?? null`. Son los peligrosos: si el
 * objeto los trae `undefined`, el canónico los sella como `null`, pero
 * `stripUndefined` los quita del payload y `updateDoc` hace MERGE — así que el
 * valor VIEJO sobrevive en Firestore y el hash guardado ya no le corresponde.
 * Derivada del canónico, no escrita a mano: ver `normalizarParaSello`.
 */
const OPCIONALES_SELLADOS_V3 = [
  'signosVitales', 'preop', 'hospital', 'infectologia', 'estudiosOrden',
  'internamientoId', 'iaAuditoria', 'transcripcionCruda', 'dialogoDiarizado',
] as const

/**
 * REG-060 — Deja la nota EXACTAMENTE como se va a sellar.
 *
 * EL DEFECTO QUE ARREGLA (reproducido con el código real): el médico dicta, se
 * autoguarda, VACÍA el cuadro del dictado y firma. El hash se calcula con
 * `transcripcionCruda: null`, pero al escribir:
 *
 *   1. `stripUndefined` (serializacion.ts) quita la llave del payload — Firestore
 *      RECHAZA `undefined`, así que quitarla es correcto en sí.
 *   2. `updateDoc` hace MERGE: lo que no viene en el payload NO se borra.
 *   3. Resultado: en Firestore sigue «tos y fiebre de tres días», mientras el
 *      sello se calculó sobre `null`.
 *   4. Al reabrir la nota, el hash no cuadra → **"alterada"** en una nota
 *      legítima. La alarma roja que este sello existe para no dar nunca.
 *
 * LA REGLA: se firma y se escribe el MISMO objeto. Convirtiendo los opcionales
 * `undefined` en `null` EXPLÍCITO, el payload ya lleva la llave, `updateDoc`
 * sobrescribe el valor viejo y el documento guardado coincide con lo sellado.
 *
 * Se aplica ANTES de calcular el hash y se escribe ESE objeto — nunca el
 * original. No muta la entrada.
 */
export function normalizarParaSello(nota: NotaMedica): NotaMedica {
  const salida = { ...nota } as unknown as Record<string, unknown>
  for (const campo of OPCIONALES_SELLADOS_V3) {
    if (salida[campo] === undefined) salida[campo] = null
  }
  return salida as unknown as NotaMedica
}

/**
 * Lo que el sello v3 NO cubre, con la razón. Ninguna de estas exclusiones es
 * comodidad: sellar cualquiera de ellas marcaría "alterada" a notas legítimas
 * (que es el modo de falla grave del sello: la alarma roja que no debe existir).
 */
/**
 * Cómo se le nombra al médico cada exclusión.
 *
 * El nombre técnico no le dice nada a quien lee el sello en pantalla: lo que
 * necesita saber es QUÉ parte del documento queda fuera, en su idioma.
 */
export const ETIQUETA_NO_SELLADO: Readonly<Record<string, string>> = {
  transcripcionMotor: 'transcripción de origen del dictado',
  palabrasAVerificar: 'marcas de duda del audio',
  id: 'identificador interno del documento',
  updatedAt: 'fecha de última modificación',
  estado: 'estado del documento',
  firma: 'bloque de firma',
}

export const CAMPOS_NO_SELLADOS_V3: readonly { campo: string; razon: string }[] = [
  {
    campo: 'transcripcionMotor',
    razon: 'ES material de origen y le CORRESPONDE ir sellado — pero añadirlo al canónico v3 cambiaría el hash de TODAS las notas ya firmadas y las volvería «alterada» de golpe: la falsa alarma exacta de REG-060. Entra al sello cuando se suba a hashVersion 4, que es su propia versión con su propia migración. Hasta entonces se guarda y NO se sella, dicho aquí en vez de silenciado.',
  },
  {
    campo: 'palabrasAVerificar',
    razon: 'Metadato DERIVADO del dictado: se recalcula desde las confianzas y no es contenido del documento. Sellarlo ataría el hash a un umbral que está declarado sin calibrar (UMBRAL_DUDA), así que recalibrarlo marcaría notas firmadas como alteradas sin que nadie las tocara.',
  },
  {
    campo: 'id',
    razon: 'normNota lo SOBRESCRIBE con el doc.id al leer, y al firmar vale `notaId ?? \'\'` (en el camino rápido, cadena vacía). Sellarlo marcaría "alterada" toda nota firmada sin borrador previo. La identidad se sella vía metadata.id, que sí se guarda literal.',
  },
  {
    campo: 'estado',
    razon: 'Cancelar una nota firmada es una transición LEGÍTIMA posterior a la firma. Sellarla convertiría una cancelación válida en "alterada". Lo vigila el log de auditoría, no el hash.',
  },
  {
    campo: 'updatedAt',
    razon: 'updateNota lo reescribe en CADA escritura, después de calcular el hash.',
  },
  {
    campo: 'firma',
    razon: 'Se adjunta DESPUÉS de calcular el hash; sellarla haría que toda nota firmada saliera "alterada". Su integridad va por hashFirma. Residual declarado: hashFirma no cubre el nombre ni la cédula del bloque de firma, pero v3 sí sella metadata.cedulaProfesional/especialidad/establecimiento, así que un cambio ahí se detecta por contradicción.',
  },
  {
    campo: 'metadata.fechaModificacion',
    razon: 'Se fija DESPUÉS de calcular el hash, en el mismo objeto que se firma.',
  },
  {
    campo: 'metadata.hashIntegridad',
    razon: 'Auto-referencia: es el propio sello.',
  },
  {
    campo: 'metadata.hashVersion',
    razon: 'Vale undefined cuando se calcula el hash y 3 cuando se lee. En su lugar se sella el literal `v: 3`, que además cierra el ataque de degradación de versión.',
  },
  {
    campo: 'metadata.version',
    razon: 'Contador de versiones del documento; lo mueve el versionado NOM-024, no el contenido clínico.',
  },
  {
    campo: 'metadata.estado',
    razon: 'Igual que `estado`: la transición a cancelada es legítima tras la firma.',
  },
]

/**
 * Qué cubre cada versión del sello, para poder DECÍRSELO al médico en la nota.
 * `noCubre` son nombres de campo (máquina); `noCubreEtiquetas`, lenguaje humano
 * para la pantalla.
 */
export const COBERTURA_SELLO: Record<VersionSello, {
  cubre: readonly string[]
  noCubre: readonly string[]
  noCubreEtiquetas: readonly string[]
}> = {
  2: {
    cubre: [
      'metadata.id', 'tipo', 'pacienteId', 'metadata.medicoId', 'fechaConsulta',
      'secciones.key', 'secciones.value', 'diagnosticos', 'medicamentos', 'alergias',
      'signosVitales',
    ],
    noCubre: [
      'preop', 'hospital', 'infectologia', 'iaAuditoria', 'resumenEjecutivo',
      'secciones.label', 'estudiosOrden', 'internamientoId', 'transcripcionCruda',
      'dialogoDiarizado', 'pacienteNombre', 'clinicId', 'createdAt', 'creadoPor',
      'metadata.tipoNota', 'metadata.clinicId', 'metadata.pacienteId',
      'metadata.cedulaProfesional', 'metadata.especialidad', 'metadata.establecimiento',
      'metadata.fechaCreacion', 'metadata.fuenteGeneracion',
    ],
    noCubreEtiquetas: [
      'valoración preoperatoria', 'datos hospitalarios', 'infectología',
      'trazabilidad de IA', 'resumen ejecutivo', 'transcripción del dictado',
      'estudios solicitados', 'encabezado (cédula y establecimiento)',
    ],
  },
  /**
   * ── v3 NO CUBRE TODO, Y LA PANTALLA DECÍA QUE SÍ (6-ago-2026, REG-199) ────
   *
   * Aquí estaba `noCubre: []` y `verificarIntegridadDetalle` deriva de ahí un
   * `cubreTodo: version === HASH_VERSION`. Resultado: al médico se le decía que
   * el sello cubre el contenido íntegro de la nota.
   *
   * Y el propio módulo, veinte líneas más arriba, declara lo contrario:
   * `CAMPOS_NO_SELLADOS_V3` documenta que `transcripcionMotor` —el material de
   * origen del que se re-proyecta la nota— **no está sellado**, y por qué:
   * añadirlo al canónico cambiaría el hash de TODAS las notas ya firmadas y las
   * marcaría «alterada» de golpe (REG-060).
   *
   * Esa decisión es correcta y se mantiene. Lo que no se sostiene es contarla
   * hacia dentro y ocultarla hacia fuera: **una afirmación de integridad más
   * ancha que su alcance real es peor que no afirmar nada**, porque se confía
   * en ella. La cobertura se deriva ahora de la misma lista que documenta las
   * exclusiones, así que las dos no pueden volver a decir cosas distintas.
   */
  3: {
    cubre: CAMPOS_SELLADOS_V3,
    noCubre: CAMPOS_NO_SELLADOS_V3.map(x => x.campo),
    noCubreEtiquetas: CAMPOS_NO_SELLADOS_V3.map(x => ETIQUETA_NO_SELLADO[x.campo] ?? x.campo),
  },
}

/**
 * Hash de integridad del contenido clínico (NOM-024).
 * `version` permite RE-verificar un sello antiguo con su propio algoritmo; por
 * omisión sella con la versión actual.
 */
export async function generarHashIntegridad(
  nota: NotaMedica,
  version: VersionSello = HASH_VERSION,
): Promise<string> {
  return sha256Hex(CANONICO[version](nota))
}

/** Hash de la firma (timestamp + médico + nota) */
export async function generarHashFirma(
  notaId: string,
  medicoId: string,
  timestamp: string,
): Promise<string> {
  return sha256Hex(`${notaId}|${medicoId}|${timestamp}`)
}

export type EstadoIntegridad = 'verificada' | 'alterada' | 'legado' | 'sin-sello'

/**
 * Verifica el sello de una nota firmada.
 * - 'sin-sello': la nota no tiene hash guardado.
 * - 'legado': sello que este build no sabe re-verificar (hashVersion ausente/1,
 *   o una versión FUTURA desconocida). NO implica alteración.
 * - 'verificada' / 'alterada': se recalcula con el algoritmo de SU versión.
 *
 * Que una versión futura desconocida caiga en 'legado' (aviso neutro) y no en
 * 'alterada' (alarma roja) es deliberado: durante un despliegue parcial un
 * cliente viejo puede leer una nota sellada por un cliente nuevo, y eso no es
 * una alteración.
 */
export async function verificarIntegridadEstado(nota: NotaMedica): Promise<EstadoIntegridad> {
  if (!nota.metadata.hashIntegridad) return 'sin-sello'
  const version = nota.metadata.hashVersion ?? 1
  const canon = CANONICO[version as VersionSello]
  if (!canon) return 'legado'
  const actual = await sha256Hex(canon(nota))
  return actual === nota.metadata.hashIntegridad ? 'verificada' : 'alterada'
}

/**
 * Estado del sello MÁS su cobertura. Mientras coexistan notas v2 y v3, la
 * pantalla puede decir la verdad completa: "sello verificado, y esto es lo que
 * ese sello NO cubre" — que es honesto y no alarma, porque no hay indicio de
 * alteración.
 */
export interface DetalleIntegridad {
  estado: EstadoIntegridad
  /** Versión declarada en la nota (`undefined` si no hay sello). */
  version?: number
  /** true si el sello cubre todo lo firmable (versión actual). */
  cubreTodo: boolean
  /** Campos que ESE sello no cubre (vacío en v3). */
  noCubre: readonly string[]
  /** Lo mismo, en lenguaje para el médico. */
  noCubreEtiquetas: readonly string[]
}

export async function verificarIntegridadDetalle(nota: NotaMedica): Promise<DetalleIntegridad> {
  const estado = await verificarIntegridadEstado(nota)
  const version = nota.metadata.hashIntegridad ? (nota.metadata.hashVersion ?? 1) : undefined
  const cobertura = version !== undefined ? COBERTURA_SELLO[version as VersionSello] : undefined
  return {
    estado,
    version,
    /**
     * ── «CUBRE TODO» SIGNIFICA CUBRE TODO (REG-199) ──────────────────────────
     *
     * Antes bastaba con ser la versión actual del sello. Pero ser la última
     * versión no significa cubrirlo todo: v3 es la actual y deja fuera la
     * transcripción de origen, a propósito y por una razón buena (REG-060).
     *
     * Ahora se deriva de la cobertura real. Cuando v4 selle también el origen,
     * esto pasará a `true` solo porque la lista de exclusiones quedará vacía —
     * no porque alguien se acuerde de cambiarlo aquí.
     */
    /**
     * OJO CON LA NOTA SIN SELLO: no tiene versión, así que no tiene cobertura,
     * así que su lista de exclusiones está vacía — y «lista vacía» NO significa
     * aquí «cubre todo», significa que no cubre nada. Se exige que haya sello.
     *
     * (Lo cazó el propio golden al primer intento: `sin-sello` daba
     * `cubreTodo: true`.)
     */
    cubreTodo: cobertura !== undefined && cobertura.noCubre.length === 0,
    noCubre: cobertura?.noCubre ?? [],
    noCubreEtiquetas: cobertura?.noCubreEtiquetas ?? [],
  }
}

/** Compat: booleano estricto (true solo si el sello estable coincide). */
export async function verificarIntegridad(nota: NotaMedica): Promise<boolean> {
  return (await verificarIntegridadEstado(nota)) === 'verificada'
}

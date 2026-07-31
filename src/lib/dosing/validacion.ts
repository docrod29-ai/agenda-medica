/**
 * VALIDACIÓN MÉDICA DEL DATASET DE DOSIS — el registro de quién comprobó qué.
 *
 * El dataset se marca a sí mismo `VERIFIED_NUMERIC_CORE` en los 54 fármacos. Eso
 * describe **de dónde viene el dato**. No dice que un médico de este consultorio
 * lo haya comprobado contra la fuente, y confundir las dos cosas es exactamente
 * cómo un número sin revisar acaba en una orden.
 *
 * Así que la validación se guarda aparte, fármaco por fármaco, con quién la hizo
 * y cuándo. Hasta que existe, la pantalla dice «sin validar».
 *
 * ── POR QUÉ SE ATA A LA HUELLA DEL DATASET ───────────────────────────────────
 *
 * Una validación vale para **la versión que se validó**. Si mañana entra un
 * dataset con dosis corregidas, las firmas viejas ya no describen lo que hay en
 * pantalla: seguirían diciendo «validado» sobre un número que nadie miró.
 *
 * Por eso cada firma guarda la versión y la huella del dataset, y
 * `estaValidado()` sólo la acepta si coinciden. Al cambiar el dataset, todo
 * vuelve a «sin validar» — que es incómodo y es lo correcto.
 *
 * Módulo PURO. La persistencia vive en `firestore.ts`.
 */

export interface FirmaValidacion {
  /** Nombre del fármaco tal como aparece en el dataset. */
  farmaco: string
  /** Quién validó: uid del médico. */
  validadoPor: string
  /** Nombre legible, para la pantalla y para la auditoría. */
  validadoPorNombre: string
  /** ISO-8601 en UTC. */
  fecha: string
  /** Versión del dataset validada. */
  versionDataset: string
  /** Huella SHA-256 del dataset validado. */
  huellaDataset: string
  /** Lo que el médico quiera dejar escrito: correcciones, matices, la fuente que usó. */
  nota?: string
}

export type ResultadoValidacion =
  | { estado: 'validado'; firma: FirmaValidacion }
  | { estado: 'sin_validar' }
  | { estado: 'caducada'; firma: FirmaValidacion; porQue: string }

/**
 * ¿Está validado este fármaco para el dataset que hay cargado ahora?
 *
 * @param firma la firma guardada, si existe.
 * @param versionActual versión del dataset en el repo.
 * @param huellaActual huella del dataset en el repo.
 */
export function estadoDe(
  firma: FirmaValidacion | null | undefined,
  versionActual: string,
  huellaActual: string,
): ResultadoValidacion {
  if (!firma) return { estado: 'sin_validar' }
  if (firma.versionDataset !== versionActual || firma.huellaDataset !== huellaActual) {
    return {
      estado: 'caducada', firma,
      porQue: `Se validó la versión ${firma.versionDataset} y ahora está cargada la `
        + `${versionActual}. La firma NO se arrastra: describe unos números que ya no `
        + 'son los que están en pantalla.',
    }
  }
  return { estado: 'validado', firma }
}

/** Crea una firma. `fecha` se pasa: nada de relojes escondidos dentro. */
export function firmar(
  farmaco: string,
  medico: { uid: string; nombre: string },
  dataset: { version: string; huella: string },
  fechaIso: string,
  nota?: string,
): FirmaValidacion {
  if (!farmaco.trim()) throw new Error('validacion: falta el fármaco')
  if (!medico.uid) throw new Error('validacion: falta el uid del médico')
  if (!fechaIso) throw new Error('validacion: falta la fecha')
  return {
    farmaco: farmaco.trim(),
    validadoPor: medico.uid,
    validadoPorNombre: medico.nombre || medico.uid,
    fecha: fechaIso,
    versionDataset: dataset.version,
    huellaDataset: dataset.huella,
    ...(nota?.trim() ? { nota: nota.trim() } : {}),
  }
}

export interface AvanceValidacion {
  total: number
  validados: number
  caducados: number
  sinValidar: number
  /** 0-100, para la barra. */
  porcentaje: number
}

/** Cuánto lleva validado el consultorio. */
export function avance(
  farmacos: readonly string[],
  firmas: Readonly<Record<string, FirmaValidacion>>,
  versionActual: string,
  huellaActual: string,
): AvanceValidacion {
  let validados = 0, caducados = 0
  for (const f of farmacos) {
    const e = estadoDe(firmas[f], versionActual, huellaActual)
    if (e.estado === 'validado') validados++
    else if (e.estado === 'caducada') caducados++
  }
  const total = farmacos.length
  return {
    total, validados, caducados,
    sinValidar: total - validados - caducados,
    porcentaje: total === 0 ? 0 : Math.round((validados / total) * 100),
  }
}

export const POR_QUE_CADUCA =
  'Una validación vale para la versión que se validó. Si entra un dataset con ' +
  'dosis corregidas, las firmas viejas dejan de describir lo que hay en pantalla: ' +
  'dirían «validado» sobre un número que nadie miró. Al cambiar el dataset todo ' +
  'vuelve a «sin validar». Es incómodo y es lo correcto.'

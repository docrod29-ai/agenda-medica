/**
 * ══════════════════════════════════════════════════════════════════════════
 * CLINICAL SAFETY GATE (unidad Nexus OS E0-11)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * POR QUÉ EXISTE: el CI ya corre `npx vitest run` en cada PR, así que un
 * invariante clínico que FALLA tumba el CI. Pero `vitest run` mide *los tests
 * que quedan*, no *los que deben existir*: hoy el CI sigue verde si alguien
 *
 *   · borra `clinical-safety-harness.test.ts`,
 *   · le pone `describe.skip` a la dosis pediátrica,
 *   · o deja un `it.only` que excluye al resto del archivo.
 *
 * Ese es el agujero que cierra este módulo: declara qué archivos de test son
 * INVARIANTES PROTEGIDOS y da las herramientas para comprobar que siguen ahí,
 * encendidos y con al menos tantos casos como el día que se sellaron.
 *
 * EL MANIFIESTO ES DERIVADO, NO ESCRITO A MANO. Una lista a mano se pudre en
 * dos unidades. Se deriva de dos fuentes que ya son la verdad del repo:
 *   1. `CLINICAL_ENGINE_REGISTRY[].goldenTests` — el golden de cada motor (E0-03).
 *   2. `docs/audit/regression-ledger.md` — el test permanente de cada REG-xxx.
 * Más tres METAGATES que no salen de ninguna de las dos y se declaran aquí.
 *
 * Este módulo es PURO: no lee disco ni conoce rutas absolutas. Quien lo usa
 * (el test `clinical-safety-gate.test.ts` y `scripts/invariantes-clinicos.mjs`)
 * le pasa el contenido del ledger. Así se puede probar con fixtures.
 */

import { CLINICAL_ENGINE_REGISTRY } from './registry'

/** Directorio único donde viven las suites de invariantes. */
export const DIR_TESTS = 'src/__tests__'

/** Un archivo de test cuya desaparición o desactivación debe romper el CI. */
export interface InvarianteProtegido {
  /** Ruta repo-relativa, p.ej. 'src/__tests__/clinical-safety-harness.test.ts'. */
  archivo: string
  /** De dónde salió: del registro de motores, del ledger, o es un metagate. */
  origen: 'registry' | 'ledger' | 'meta'
  /** Motor(es) o REG-xxx que dependen de él. Sirve para el mensaje de fallo. */
  porQue: string
}

/**
 * Los tres gates que se vigilan a sí mismos y no salen ni del registro ni del
 * ledger. Sin ellos, el candado se podría quitar sin que nada chillara.
 */
export const METAGATES: readonly { archivo: string; porQue: string }[] = [
  {
    archivo: `${DIR_TESTS}/clinical-registry.test.ts`,
    porQue: 'metagate E0-03: integridad del Clinical Engine Registry',
  },
  {
    archivo: `${DIR_TESTS}/clinical-registry-adr.test.ts`,
    porQue: 'metagate E0-03: trinquete de cobertura documental (ADRs)',
  },
  {
    archivo: `${DIR_TESTS}/clinical-safety-gate.test.ts`,
    porQue: 'metagate E0-11: este mismo gate (se protege a sí mismo)',
  },
]

/** Normaliza un `goldenTests` (nombre suelto) a ruta repo-relativa. */
export function rutaDeTest(nombreOruta: string): string {
  return nombreOruta.includes('/') ? nombreOruta : `${DIR_TESTS}/${nombreOruta}`
}

/**
 * Extrae las rutas de test citadas en el regression-ledger.
 *
 * El ledger las cita en prosa dentro de backticks (`src/__tests__/x.test.ts`),
 * a veces varias por celda. Se buscan por patrón de ruta, no por posición de
 * columna: la tabla ha cambiado de forma varias veces y una extracción por
 * columnas se rompería en silencio — que es justo lo que este gate persigue.
 */
export function testsCitadosEnLedger(ledgerMd: string): string[] {
  const re = /src\/__tests__\/[A-Za-z0-9._-]+\.test\.ts/g
  return [...new Set(ledgerMd.match(re) ?? [])].sort()
}

/**
 * Deriva el conjunto protegido = goldenTests(registry) ∪ ledger ∪ metagates.
 *
 * Un mismo archivo puede venir de varias fuentes (el harness respalda 12 motores
 * y cierra 6 REG-xxx). Se colapsa a UNA entrada, con el origen de mayor peso
 * (registry > ledger > meta) y el porqué acumulado, para que el mensaje de
 * fallo diga a la cara qué se cae si ese archivo desaparece.
 */
export function invariantesProtegidos(ledgerMd: string): InvarianteProtegido[] {
  const acc = new Map<string, { origen: InvarianteProtegido['origen']; motivos: string[] }>()

  const agregar = (archivo: string, origen: InvarianteProtegido['origen'], motivo: string) => {
    const previo = acc.get(archivo)
    if (!previo) {
      acc.set(archivo, { origen, motivos: [motivo] })
      return
    }
    if (!previo.motivos.includes(motivo)) previo.motivos.push(motivo)
    // 'registry' manda sobre 'ledger', y 'ledger' sobre 'meta'.
    const peso = { registry: 3, ledger: 2, meta: 1 } as const
    if (peso[origen] > peso[previo.origen]) previo.origen = origen
  }

  for (const motor of CLINICAL_ENGINE_REGISTRY) {
    for (const golden of motor.goldenTests ?? []) {
      agregar(rutaDeTest(golden), 'registry', `motor ${motor.id}`)
    }
  }
  for (const archivo of testsCitadosEnLedger(ledgerMd)) {
    agregar(archivo, 'ledger', 'regression-ledger')
  }
  for (const meta of METAGATES) {
    agregar(meta.archivo, 'meta', meta.porQue)
  }

  return [...acc.entries()]
    .map(([archivo, { origen, motivos }]) => ({
      archivo,
      origen,
      // Se recorta el porqué: con 12 motores detrás, la lista completa haría
      // ilegible el mensaje de fallo. El archivo ya identifica el invariante.
      porQue: motivos.length > 3 ? `${motivos.slice(0, 3).join(', ')} (+${motivos.length - 3})` : motivos.join(', '),
    }))
    .sort((a, b) => a.archivo.localeCompare(b.archivo))
}

/**
 * Patrones de DESACTIVACIÓN de un test.
 *
 * Anclados a inicio de línea a propósito: así no disparan con menciones dentro
 * de un string o de un comentario (este mismo archivo habla de `it.skip` y no
 * debe autoacusarse). Se documenta explícitamente que esto es una COTA, no un
 * parser de TypeScript: un `it` generado en runtime no se detecta. Es
 * suficiente — el objetivo es que apagar un invariante exija un acto VISIBLE en
 * el diff, no ser infalible contra un adversario interno.
 */
export const PATRONES_DESACTIVACION: readonly { nombre: string; re: RegExp }[] = [
  { nombre: 'skip', re: /^\s*(?:describe|it|test)(?:\.each\([^)]*\))?\.skip\s*[(`]/m },
  { nombre: 'xit/xdescribe', re: /^\s*x(?:it|describe)\s*[(`]/m },
  { nombre: 'only', re: /^\s*(?:describe|it|test)(?:\.each\([^)]*\))?\.only\s*[(`]/m },
  { nombre: 'todo', re: /^\s*(?:describe|it|test)\.todo\s*[(`]/m },
  // skipIf/runIf — el bypass que encontró la verificación adversarial de E0-11.
  // NO son "desactivación exótica": son API de primera clase de vitest y apagan
  // el archivo ENTERO sin borrar una sola línea `it(`, así que pasaban las tres
  // aserciones a la vez (no hay .skip, el conteo de casos no baja) y vitest
  // reporta el archivo como SKIPPED, no failed — o sea el job `verificar`
  // también salía verde. Demostrado sobre clinical-safety-harness.test.ts:
  // `describe.skipIf(true)(` apagaba sus 42 casos (CKD-EPI, MELD, FIB-4, SOFA)
  // con TODO el CI en verde. Se acepta el falso positivo de un `skipIf(false)`
  // legítimo: en un invariante clínico, condicionar la ejecución ya merece
  // revisión humana.
  { nombre: 'skipIf/runIf', re: /^\s*(?:describe|it|test)(?:\.each\([^)]*\))?\.(?:skipIf|runIf)\s*\(/m },
]

/**
 * Devuelve las desactivaciones encontradas, con número de línea (1-based) para
 * que el mensaje de fallo apunte al sitio exacto y no obligue a buscar a mano.
 */
export function buscarDesactivaciones(
  fuente: string,
): { patron: string; linea: number; texto: string }[] {
  const hallazgos: { patron: string; linea: number; texto: string }[] = []
  const lineas = fuente.split('\n')
  lineas.forEach((linea, i) => {
    for (const { nombre, re } of PATRONES_DESACTIVACION) {
      // Las regex llevan flag `m` pero no `g`: se evalúan línea a línea, así que
      // no hay estado `lastIndex` que arrastre falsos negativos entre archivos.
      if (re.test(linea)) hallazgos.push({ patron: nombre, linea: i + 1, texto: linea.trim() })
    }
  })
  return hallazgos
}

/**
 * Cuenta casos declarados en un fuente de test. COTA INFERIOR deliberada:
 * cuenta `it(` / `test(` / `it.each(` al inicio de línea. No cuenta los casos
 * que un `.each` expande ni los generados en un bucle. Sirve para detectar que
 * un archivo se vació dejando un `it` verde, no para auditar cobertura.
 */
export function contarCasos(fuente: string): number {
  const re = /^\s*(?:it|test)(?:\.each\([^)]*\))?\s*[(`]/gm
  return (fuente.match(re) ?? []).length
}

/** Forma del sello congelado (`src/lib/clinical/invariantes-clinicos.json`). */
export interface SelloInvariantes {
  sellado: string
  porQue: string
  totalCasos: number
  archivos: { archivo: string; minCasos: number }[]
}

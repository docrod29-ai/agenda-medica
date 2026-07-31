/**
 * ClinicalFact — el hecho clínico atómico del grafo del paciente (Nexus OS E1-01).
 *
 * PORQUÉ EXISTE: hoy el repo tiene «medio ClinicalFact» repartido en cinco sitios
 * (`ICUObservation` en types/uci.ts, `iaAuditoria.provenance` en types/expediente.ts,
 * `CampoProcedencia` en lib/expediente/procedencia.ts, el libro append-only de
 * types/hospital.ts y el catálogo de analitos). Ninguno sirve como grafo
 * longitudinal del paciente y todos permiten lo mismo: un dato SIN unidad y con
 * procedencia vacía. La aceptación de esta unidad es una sola frase —«un hecho
 * sin unidad o sin procedencia NO valida»— y este archivo la vuelve inexpresable.
 *
 * ALCANCE DELIBERADO: aquí sólo hay TIPOS. Nace sin importadores de producción.
 * No sustituye ni migra `ICUObservation` (eso no es esta unidad). No canoniza
 * conceptos (E1-02). No persiste (E1-04). No resuelve vigencia (E1-05) ni
 * conflictos (E1-08).
 *
 * SIN `import { z }` A PROPÓSITO: este archivo lo importará la UI (E1-09) y no
 * debe arrastrar zod al bundle de cliente. La validación vive en
 * `src/lib/clinical-fact/schema.ts`.
 *
 * ANTI-DERIVA: los cuatro vocabularios que usa NO se redecidieron; se copian de
 * donde ya estaban decididos en el repo, con su cita.
 */

import type { CualquierCantidad } from '@/types/clinical-quantity'
import type { ClinicalTruthStatus } from '@/types/uci'
import type { EfectoCorreccion } from '@/types/hospital'

// ---------------------------------------------------------------------------
// 1. Concepto — referencia OPACA en esta unidad
// ---------------------------------------------------------------------------

/**
 * Referencia a un concepto clínico. E1-02 la canoniza contra el catálogo del
 * repo (`lib/expediente/laboratorio/analitos.ts`); E1-01 la deja OPACA a
 * propósito: si aquí se decidiera el catálogo, E1-02 heredaría una taxonomía
 * inventada por un agente en vez de la que ya usa el producto.
 */
export interface ConceptoRef {
  /** Clave canónica del repo si existe (p. ej. `analitos.ts` → 'creatinina'). */
  readonly clave: string
  /** Etiqueta legible para mostrar sin tener que resolver el catálogo. */
  readonly etiqueta?: string
  /** Código estándar cuando la licencia lo permita. Lo llena E1-02, no E1-01. */
  readonly codigo?: {
    readonly sistema: 'LOINC' | 'CIE-10' | 'SNOMED' | 'ATC'
    readonly codigo: string
  }
}

// ---------------------------------------------------------------------------
// 2. Valor — union CERRADA, sin variante «número suelto»
// ---------------------------------------------------------------------------

/**
 * El valor del hecho.
 *
 * NO existe la variante `{ clase: 'numero', valor: number }`: un número clínico
 * sin unidad es el bug de escala que E0-04 existe para impedir, y dejarlo aquí
 * vaciaría la aceptación de esta unidad. Todo número viaja como `CualquierCantidad`.
 *
 * La variante `texto` es la otra fuga posible —`{ clase: 'texto', texto: '135' }`
 * es un número sin unidad que SÍ validaría— y por eso el esquema de runtime la
 * cierra: un texto que `num()` lee como número no es un hecho de texto.
 */
export type ValorClinico =
  | { readonly clase: 'cantidad'; readonly cantidad: CualquierCantidad }
  /** Dx, alérgeno, germen aislado: el valor ES un concepto. */
  | { readonly clase: 'codigo'; readonly concepto: ConceptoRef }
  /** Presencia/ausencia explícita (no confundir con `certeza: 'negated'`). */
  | { readonly clase: 'booleano'; readonly presente: boolean }
  /** Narrativo de verdad ('120/80', 'sin focalización'). NUNCA un número. */
  | { readonly clase: 'texto'; readonly texto: string }

// ---------------------------------------------------------------------------
// 3. Ciclo de vida y certeza — dos ejes SEPARADOS
// ---------------------------------------------------------------------------

/**
 * Ciclo de vida del REGISTRO. Subconjunto alineado con `Observation.status` de
 * FHIR, que la frontera de exportación ya emite (`lib/fhir/recursos.ts:99`).
 */
export type EstadoHecho = 'preliminar' | 'final' | 'corregido' | 'anulado'

/**
 * Verdad clínica del CONTENIDO. Reusa tal cual el vocabulario ya en uso en UCI
 * (`types/uci.ts` → `ClinicalTruthStatus`), incluido `conflicting`, que es el que
 * E1-08 necesitará. No se inventa uno nuevo.
 */
export type CertezaHecho = ClinicalTruthStatus

// ---------------------------------------------------------------------------
// 4. Fuente, autor y procedencia
// ---------------------------------------------------------------------------

/**
 * De dónde salió el hecho. `documentoId` es lo que permitirá a E1-09 llevar al
 * médico de un dato del grafo al documento que lo originó con un clic.
 */
export interface FuenteHecho {
  readonly tipo:
    | 'nota' | 'laboratorio' | 'receta' | 'internamiento' | 'signos'
    | 'hl7' | 'fhir' | 'dictado' | 'formulario'
  readonly documentoId?: string
  /**
   * Frase literal que respalda el hecho, si la hay. Conserva la idea de `cita`
   * de `lib/expediente/procedencia.ts`: el dato estructurado nunca pierde el
   * fragmento del que salió.
   */
  readonly citaTextual?: string
}

/** Quién responde por el hecho. */
export interface AutorHecho {
  readonly uid: string
  readonly nombre?: string
  readonly rol?: 'medico' | 'enfermeria' | 'laboratorio' | 'sistema'
}

/**
 * Procedencia: union discriminada por `origen`, SIN variante «todo opcional».
 *
 * PORQUÉ ASÍ: el provenance que ya existe en la nota (`types/expediente.ts` →
 * `iaAuditoria.provenance`) tiene todos sus campos opcionales, así que hoy
 * `provenance: {}` es válido y no prueba nada. Aquí los nombres de campo se
 * copian de allí (anti-deriva) pero son OBLIGATORIOS por variante, que es lo que
 * exige el invariante 5 del programa (modelo, promptVersion, engineVersion,
 * knowledgeVersion, sello temporal).
 */
export type ProcedenciaHecho =
  | {
      readonly origen: 'humano'
      readonly autor: AutorHecho
      /** ISO — cuándo se SUPO/registró (la otra mitad de la bitemporalidad). */
      readonly registradoEn: string
    }
  | {
      readonly origen: 'ia'
      readonly autor: AutorHecho
      readonly registradoEn: string
      readonly modelo: string
      readonly promptVersion: string
      readonly apiVersion?: string
      readonly retrieverVersion?: string
      readonly knowledgeVersion?: string
      /** Un hecho de IA sin revisión humana no es lo mismo que uno revisado. */
      readonly revisadoPorHumano: boolean
    }
  | {
      readonly origen: 'motor'
      readonly registradoEn: string
      /** id del motor en CLINICAL_ENGINE_REGISTRY (E0-03). */
      readonly engineId: string
      readonly engineVersion: string
    }
  | {
      readonly origen: 'externo'
      readonly registradoEn: string
      /** Sistema emisor (LIS, HIS, laboratorio externo). */
      readonly sistema: string
      /** id del mensaje HL7/FHIR, para rastrear el origen exacto. */
      readonly mensajeId?: string
    }

// ---------------------------------------------------------------------------
// 5. El hecho
// ---------------------------------------------------------------------------

/**
 * Un hecho clínico atómico.
 *
 * INMUTABLE: corregir NO es editar ni borrar, es anexar otro hecho con
 * `supersedes`. Es la misma semántica del libro append-only del episodio que ya
 * está en producción (`types/hospital.ts` → `EventoClinico.corrigeEventoId` +
 * `EfectoCorreccion`), reusada en vez de reinventada.
 *
 * Cada campo tiene UN trabajo, a propósito — si se solapan, E1-05 y E1-08
 * heredan la ambigüedad:
 *  - `estado`      → en qué punto está el REGISTRO
 *  - `certeza`     → qué tan verdadero es el CONTENIDO
 *  - `validFrom/To`→ en qué ventana fue verdad en el MUNDO
 *  - `observedAt` vs `procedencia.registradoEn` → cuándo pasó vs cuándo se supo
 *  - `supersedes`  → qué hecho anterior corrige y con qué efecto
 */
export interface ClinicalFact {
  readonly id: string
  /** Multi-tenant: el hecho SIEMPRE sabe de qué consultorio es. */
  readonly clinicId: string
  readonly pacienteId: string
  readonly concepto: ConceptoRef
  readonly valor: ValorClinico
  readonly estado: EstadoHecho
  readonly certeza: CertezaHecho
  readonly fuente: FuenteHecho
  readonly procedencia: ProcedenciaHecho
  /** ISO — cuándo ocurrió/se observó en el MUNDO (no cuándo se capturó). */
  readonly observedAt: string
  /** Vigencia clínica. `validTo` ausente = sigue vigente (lo resuelve E1-05). */
  readonly validFrom?: string
  readonly validTo?: string
  /** Qué hecho reemplaza ESTE y con qué efecto. */
  readonly supersedes?: {
    readonly factId: string
    readonly efecto: EfectoCorreccion
    readonly motivo?: string
  }
}

// ---------------------------------------------------------------------------
// 6. Aptitud para cálculo
// ---------------------------------------------------------------------------

/**
 * ¿El hecho es apto para alimentar un motor determinista?
 *
 * ESPEJO DELIBERADO de `esUsableParaCalculo` de `types/uci.ts`: misma política,
 * copiada, no redecidida — sólo `confirmed`/`inferred` alimentan un cálculo, y
 * un registro anulado nunca. No se inventa criterio clínico aquí.
 *
 * `negated` queda fuera a propósito: «sin fiebre» es información clínica válida,
 * pero no es un VALOR con el que un motor pueda operar.
 */
export function esUsableParaCalculo(
  f: Pick<ClinicalFact, 'estado' | 'certeza' | 'valor'>,
): boolean {
  if (f.estado === 'anulado') return false
  return f.certeza === 'confirmed' || f.certeza === 'inferred'
}

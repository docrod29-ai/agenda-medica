/**
 * Validación en TIEMPO DE EJECUCIÓN de un `ClinicalFact` (Nexus OS E1-01).
 *
 * PORQUÉ EXISTE APARTE DE LOS TIPOS: un hecho llega desde Firestore, HL7 v2, una
 * foto de laboratorio o un formulario. Ahí valor, unidad y dimensión son
 * `unknown` y el compilador no protege nada. La aceptación de la unidad —«un
 * hecho sin unidad o sin procedencia NO valida»— sólo se puede probar aquí.
 *
 * TRES DECISIONES QUE HACEN QUE LA ACEPTACIÓN NO SEA DECORATIVA:
 *
 *  1. `z.strictObject` en TODOS los niveles. Con `z.object` una llave extra se
 *     descarta EN SILENCIO, así que un productor podría colgar `unidad` al lado
 *     de un texto y creer que su hecho «tiene unidad». Con strict, falla.
 *  2. La cantidad se construye con `parsearCantidad` (la única puerta de entrada
 *     de `clinical-quantity.ts` para datos externos), que exige que la unidad
 *     pertenezca a la dimensión DECLARADA y nunca la adivina.
 *  3. Un texto que `num()` lee como número NO es un hecho de texto. Sin esta
 *     guarda, `{ clase: 'texto', texto: '135' }` sería un número sin unidad que
 *     valida — el agujero exacto que esta unidad debe cerrar.
 *
 * NO RELLENA NADA. `parsearHecho` no aplica ni un `default`: un hecho incompleto
 * NO EXISTE, no se degrada a uno plausible. Es la misma lección ya escrita en
 * `types/expediente.ts` sobre `Alergia` («un tipo que obliga a rellenar es un
 * tipo que obliga a inventar»).
 *
 * VIVE EN `src/lib/clinical-fact/` Y NO EN `src/lib/clinical/` A PROPÓSITO: ese
 * directorio es territorio del Clinical Engine Registry y de su trinquete de
 * ADRs (E0-03). Esto NO es un motor clínico —no calcula, no decide, no tiene un
 * solo umbral—; meterlo ahí haría que un gate lo reclamara como motor sin ADR y
 * pusiera el CI en rojo por una clasificación equivocada.
 */

import { z } from 'zod'
import { num } from '@/lib/uci/num'
import { parsearCantidad } from '@/types/clinical-quantity'
import type { ClinicalFact, ValorClinico } from '@/types/clinical-fact'

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

/** Un string obligatorio de verdad: `''` no es un identificador. */
const TextoObligatorio = z.string().min(1)

/**
 * Fecha ISO. Se exige la forma `YYYY-MM-DD[THH:MM...]` y que sea parseable: un
 * sello temporal que no se puede ordenar no sirve para bitemporalidad (E1-06).
 */
const Iso = z.string().refine(
  (s) => /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)
    && !Number.isNaN(Date.parse(s)),
  { message: 'debe ser una fecha ISO (YYYY-MM-DD u ISO completa)' },
)

export const ConceptoRefSchema = z.strictObject({
  clave: TextoObligatorio,
  etiqueta: z.string().min(1).optional(),
  codigo: z.strictObject({
    sistema: z.enum(['LOINC', 'CIE-10', 'SNOMED', 'ATC']),
    codigo: TextoObligatorio,
  }).optional(),
})

// ---------------------------------------------------------------------------
// Valor — la mitad «sin unidad no valida» de la aceptación
// ---------------------------------------------------------------------------

/**
 * Forma CRUDA de una cantidad tal como llega de Firestore/HL7: los tres campos
 * existen, pero su legalidad (¿esa unidad pertenece a esa dimensión?) todavía no
 * está probada. `valor` admite string porque el mundo real manda "1,2".
 */
const CantidadCruda = z.strictObject({
  valor: z.union([z.number(), z.string()]),
  unidad: TextoObligatorio,
  dimension: TextoObligatorio,
})

/** Union discriminada por `clase`, ANTES de construir la cantidad. */
const ValorCrudo = z.discriminatedUnion('clase', [
  z.strictObject({ clase: z.literal('cantidad'), cantidad: CantidadCruda }),
  z.strictObject({ clase: z.literal('codigo'), concepto: ConceptoRefSchema }),
  z.strictObject({ clase: z.literal('booleano'), presente: z.boolean() }),
  z.strictObject({
    clase: z.literal('texto'),
    texto: TextoObligatorio.refine((t) => num(t) === null, {
      message: 'un número no puede viajar disfrazado de texto: usa clase "cantidad" con su unidad',
    }),
  }),
])

/**
 * Valor ya CONSTRUIDO: la variante `cantidad` sale de aquí como
 * `CualquierCantidad` de verdad, no como tres campos sueltos.
 */
export const ValorClinicoSchema = ValorCrudo.transform((v, ctx): ValorClinico => {
  if (v.clase !== 'cantidad') return v
  const q = parsearCantidad(v.cantidad.valor, v.cantidad.unidad, v.cantidad.dimension)
  if (q === null) {
    ctx.addIssue({
      code: 'custom',
      message: `la unidad "${v.cantidad.unidad}" no pertenece a la dimensión "${v.cantidad.dimension}" (o el valor no es un número finito)`,
      path: ['cantidad'],
    })
    return z.NEVER
  }
  return { clase: 'cantidad', cantidad: q }
})

// ---------------------------------------------------------------------------
// Procedencia — la otra mitad de la aceptación
// ---------------------------------------------------------------------------

export const AutorHechoSchema = z.strictObject({
  uid: TextoObligatorio,
  nombre: z.string().min(1).optional(),
  rol: z.enum(['medico', 'enfermeria', 'laboratorio', 'sistema']).optional(),
})

/**
 * Union discriminada por `origen`. NO hay variante de campos todos opcionales,
 * así que `procedencia: {}` no tiene dónde caer: falla por discriminador
 * inválido antes de mirar nada más.
 */
export const ProcedenciaHechoSchema = z.discriminatedUnion('origen', [
  z.strictObject({
    origen: z.literal('humano'),
    autor: AutorHechoSchema,
    registradoEn: Iso,
  }),
  z.strictObject({
    origen: z.literal('ia'),
    autor: AutorHechoSchema,
    registradoEn: Iso,
    modelo: TextoObligatorio,
    promptVersion: TextoObligatorio,
    apiVersion: z.string().min(1).optional(),
    retrieverVersion: z.string().min(1).optional(),
    knowledgeVersion: z.string().min(1).optional(),
    revisadoPorHumano: z.boolean(),
  }),
  z.strictObject({
    origen: z.literal('motor'),
    registradoEn: Iso,
    engineId: TextoObligatorio,
    engineVersion: TextoObligatorio,
  }),
  z.strictObject({
    origen: z.literal('externo'),
    registradoEn: Iso,
    sistema: TextoObligatorio,
    mensajeId: z.string().min(1).optional(),
  }),
])

// ---------------------------------------------------------------------------
// El hecho completo
// ---------------------------------------------------------------------------

export const FuenteHechoSchema = z.strictObject({
  tipo: z.enum([
    'nota', 'laboratorio', 'receta', 'internamiento', 'signos',
    'hl7', 'fhir', 'dictado', 'formulario',
  ]),
  documentoId: z.string().min(1).optional(),
  citaTextual: z.string().min(1).optional(),
})

export const SupersedesSchema = z.strictObject({
  factId: TextoObligatorio,
  efecto: z.enum(['anula', 'sustituye', 'aclara']),
  motivo: z.string().min(1).optional(),
})

export const ClinicalFactSchema: z.ZodType<ClinicalFact, unknown> = z.strictObject({
  id: TextoObligatorio,
  clinicId: TextoObligatorio,
  pacienteId: TextoObligatorio,
  concepto: ConceptoRefSchema,
  valor: ValorClinicoSchema,
  estado: z.enum(['preliminar', 'final', 'corregido', 'anulado']),
  certeza: z.enum([
    'confirmed', 'negated', 'unknown', 'historical', 'suspected', 'inferred', 'conflicting',
  ]),
  fuente: FuenteHechoSchema,
  procedencia: ProcedenciaHechoSchema,
  observedAt: Iso,
  validFrom: Iso.optional(),
  validTo: Iso.optional(),
  supersedes: SupersedesSchema.optional(),
})

/** Resultado de validar. Nunca lanza: el llamador decide qué hacer con el error. */
export type ResultadoParseo =
  | { readonly ok: true; readonly hecho: ClinicalFact }
  | { readonly ok: false; readonly errores: string[] }

/**
 * Valida y CONSTRUYE un hecho a partir de datos desconocidos.
 *
 * No lanza y no rellena: si falta algo, devuelve los errores con su ruta para
 * que el productor los arregle en el origen. Perder un dato ruidosamente es
 * mejor que guardarlo a medias — este repo ya pagó esa lección.
 */
export function parsearHecho(x: unknown): ResultadoParseo {
  const r = ClinicalFactSchema.safeParse(x)
  if (r.success) return { ok: true, hecho: r.data }
  return {
    ok: false,
    errores: r.error.issues.map((i) => {
      const ruta = i.path.join('.')
      return ruta ? `${ruta}: ${i.message}` : i.message
    }),
  }
}

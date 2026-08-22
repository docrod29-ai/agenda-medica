/**
 * ══════════════════════════════════════════════════════════════════════════
 * EVIDENCE INTEGRATIONS — fachada del carril #314
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── QUÉ ES ESTO Y QUÉ NO ES ─────────────────────────────────────────────────
 *
 * Es la capa de RECUPERACIÓN de evidencia: quién se consulta, con qué licencia,
 * qué contestó y qué pasa cuando no contesta.
 *
 * NO es un segundo modelo de evidencia. El modelo canónico —`Source`,
 * `Passage`, `Claim`, y la regla «una afirmación sin pasaje de respaldo no
 * puede construirse»— vive en `src/types/evidence.ts` y aquí se REUSA. Duplicar
 * la fuente de verdad de una entidad clínica es lo primero que prohíbe
 * CLAUDE.md, y un `EvidenceSource` paralelo sería exactamente eso.
 *
 * ── EL CAMINO COMPLETO, EN ORDEN ────────────────────────────────────────────
 *
 *   pregunta clínica (sin PHI)
 *     → seleccion.ts     ¿a quién se consulta, y a quién sólo se declara?
 *     → adaptadores/     cada uno devuelve un SOBRE, nunca una excepción
 *     → soporte.ts       corpus de síntesis (sólo rol `respaldo`)
 *     → [ SÍNTESIS ]     ← el modelo redacta. FRONTERA: aquí acaba lo verificable
 *     → soporte.ts       mapa afirmación↔pasaje; lo que no ancla se MARCA
 *     → frescura.ts      qué tan vieja es cada fuente, y sobre qué fecha
 *     → compuertas.ts    propuesta informativa; NUNCA diagnóstico/orden/receta
 *
 * ── ESTADO REAL (#314, 2026-08-22) ──────────────────────────────────────────
 *
 * OPERATIVO:      PubMed (envuelve el retrieval que ya existía), corpus sintético.
 * APAGADO:        UpToDate, OpenEvidence, Cochrane — falta licencia. Ver
 *                 `catalogo.ts` y docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md.
 * DESCUBRIMIENTO: Perplexity — nunca respalda por sí sola (#314 punto 7).
 * PERSONAL:       conocimiento del médico — nunca asciende a guía (#314 punto 8).
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE AUNQUE SÓLO REEXPORTE ───────────────────────
 *
 * Da UNA puerta de entrada al módulo, para que el día que se cablee a la ruta
 * de consulta no haya siete imports sueltos apuntando a las tripas. Y como
 * `index.ts` está exento del guardián de módulos huérfanos, importar aquí cada
 * submódulo con import de VALOR (no `import type`, que TypeScript borra) es lo
 * que mantiene al guardián informado sin tocar su lista de excepciones.
 */

// ── Contrato del sobre de recuperación ──────────────────────────────────────
export {
  tieneMaterial, puedeRespaldar, comoSeLeDiceAlMedico, correlacionSegura,
  sobreConMaterial, sobreSinMaterial, ESTADOS_SIN_MATERIAL,
} from './contrato'
export type {
  SobreDeRecuperacion, SobreConMaterial, SobreSinMaterial,
  EstadoDeRecuperacion, EstadoConMaterial, ClaseDeFallo,
  AdaptadorDeEvidencia, ConsultaDeEvidencia, ContextoDeRecuperacion,
  DisponibilidadDeclarada, TelemetriaDeRecuperacion, FrescuraDeclarada,
  IdDeCorrelacion, MotivoRechazoSobre,
} from './contrato'

// ── Catálogo y licencias ────────────────────────────────────────────────────
export {
  CATALOGO_DE_EVIDENCIA, CAMPOS_DE_LA_MATRIZ, LICENCIAS_OPERABLES,
  UNVERIFIABLE, REVISADO_EN,
  entradaDeCatalogo, esProveedorDeEvidencia, estaVerificado,
  licenciaPermiteOperar, proveedoresDeRespaldo, camposSinVerificar,
  decisionesPendientes,
} from './catalogo'
export type {
  ProveedorDeEvidencia, RolDeEvidencia, EstadoDeLicencia, ClaseDeFuente,
  EntradaDeCatalogo, MatrizDeCalificacion, Verificable,
} from './catalogo'

// ── Separación retrieval → síntesis y mapa de soporte ───────────────────────
export {
  corpusParaSintesis, mapaDeSoporte, tasaSinRespaldo,
  esRespuestaRespaldada, avisosDeDegradacion, sobresConAporte,
} from './soporte'
export type {
  CorpusParaSintesis, MapaDeSoporte, AfirmacionRespaldada, AfirmacionSinRespaldo,
} from './soporte'

// ── Compuertas ──────────────────────────────────────────────────────────────
export {
  propuestaDesdeEvidencia, propuestasDeSintesis, decisionDelMedico,
  puedeCachearse, claveDeCache,
} from './compuertas'
export type {
  AccionClinica, PropuestaDeEvidencia, AccionAutorizada, VeredictoDeCache,
} from './compuertas'

// ── Frescura ────────────────────────────────────────────────────────────────
export {
  UMBRAL_DIAS, diasEntre, instanteComparable,
  frescuraDeFuente, frescuraDeNota, frescuraDeSobre, tasaDeFrescura, umbralPara,
} from './frescura'
export type { VeredictoDeFrescura, BaseDeLaEdad } from './frescura'

// ── Selección de proveedores ────────────────────────────────────────────────
export {
  intencionDe, ordenarProveedores, planDeConsulta, hayRespaldoOperativo,
} from './seleccion'
export type { IntencionClinica, ProveedorOrdenado, PlanDeConsulta } from './seleccion'

// ── Benchmark ───────────────────────────────────────────────────────────────
export { correrCaso, correrBenchmark, percentil, informeLegible } from './benchmark'
export type { CasoDeBenchmark, MedidasDeCaso, InformeDeBenchmark } from './benchmark'

// ── Adaptadores ─────────────────────────────────────────────────────────────
export { adaptadorPubMed, claseDeFalloDeRed } from './adaptadores/pubmed'
export type { BuscarArticulos, OpcionesPubMed } from './adaptadores/pubmed'

export {
  adaptadorNoConfigurado, uptodate, openevidence, cochrane, perplexity,
} from './adaptadores/no-configurado'
export type { OpcionesNoConfigurado } from './adaptadores/no-configurado'

export { adaptadorConocimientoPersonal, validarNota } from './adaptadores/conocimiento-personal'
export type {
  NotaPersonal, SobreDeNotas, LeerNotas, MotivoRechazoNota, OpcionesConocimientoPersonal,
} from './adaptadores/conocimiento-personal'

export { adaptadorSintetico, CORPUS_SINTETICO } from './adaptadores/sintetico'
export type { DocumentoSintetico, GuionDeFallo, OpcionesSintetico } from './adaptadores/sintetico'

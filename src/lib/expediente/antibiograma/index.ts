/**
 * Motor de interpretación inteligente de antibiogramas — API pública.
 *
 * «La IA EXTRAE, el motor RAZONA»: cada regla está citada a su fuente
 * (Torres & Cercenado 2010, Navarro 2010, Vila & Marco 2010, Bush & Bradford 2019,
 * CLSI M100, NOM-045). No hay afirmaciones sin respaldo.
 *
 * ⚠️ Apoyo decisional; no sustituye al infectólogo ni a la confirmación de
 *    mecanismo. Pendiente de validación clínica antes de conducir prescripción.
 */
export { interpretarAntibiograma } from './motor'
export { CLASES, COBERTURA, terapiaPorClase, type ClaseEnzima } from './betalactamasas'
export { REF } from './referencias'
export type {
  SIR,
  ResultadoAntibiograma,
  EntradaAntibiograma,
  SitioInfeccion,
  FenotipoClave,
  Confianza,
  FenotipoDetectado,
  MecanismoInferido,
  AlertaAntibiograma,
  NotaIntrinseca,
  OpcionTerapeutica,
  BloqueDidactico,
  InterpretacionAntibiograma,
} from './tipos'

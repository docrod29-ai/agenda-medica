/**
 * SPECIALTY PACKAGES — el catálogo público de los paquetes por especialidad.
 *
 * Esto NO es una promesa nueva: es el nombre y la cara pública de algo que YA
 * corre en producción. La consulta filtra sus herramientas por TRONCO
 * (`herramientas-por-especialidad.ts`): un internista ve riesgo cardiovascular y
 * antibiograma; un pediatra, dosis por peso y percentiles OMS; un cirujano, la
 * valoración perioperatoria. Ese filtrado —con herencia de subespecialidades— ES
 * el "Specialty Package".
 *
 * Regla de oro (igual que /arquitectura): aquí solo se nombra lo que EXISTE. El
 * contenido de `incluye` se DERIVA de la misma tabla que gobierna la consulta
 * (`herramientasDeTronco`), así el catálogo público no puede prometer una
 * herramienta que la consulta no muestra. Puro y determinista → testeable.
 */
import {
  type Tronco,
  type HerramientaId,
  herramientasDeTronco,
} from './herramientas-por-especialidad'

/** Descripción honesta de cada herramienta: qué hace, con qué se apoya. */
export const HERRAMIENTAS: Record<HerramientaId, { nombre: string; que: string }> = {
  copiloto: {
    nombre: 'Copiloto de seguridad',
    que: 'Vigilancia silenciosa: choque alergia↔fármaco, dosis↔peso, ajuste renal, contradicciones. Va SIEMPRE, en toda especialidad.',
  },
  cardiometabolico: {
    nombre: 'Cardiometabólico',
    que: 'Riesgo cardiovascular (PREVENT AHA), dislipidemia (ACC/AHA), obesidad y MASLD con FIB-4.',
  },
  preventivo: {
    nombre: 'Preventivo',
    que: 'Tamizajes y prevención por edad y sexo, con tendencias del propio paciente.',
  },
  antibiograma: {
    nombre: 'Antibiograma + PROA',
    que: 'Lectura de antibiograma con inferencia determinista de mecanismo, clasificación AWaRe y evidencia PubMed.',
  },
  calculadoras: {
    nombre: 'Calculadoras clínicas',
    que: 'Escalas y fórmulas con código (TFG, IMC, riesgos), no estimaciones de un modelo.',
  },
  pediatria: {
    nombre: 'Pediatría',
    que: 'Dosis por peso y percentiles/curvas OMS; el riesgo cardiovascular a 10 años no aplica y no estorba.',
  },
  gineco: {
    nombre: 'Gineco-obstetricia',
    que: 'Herramientas del embarazo y la salud de la mujer, con alerta de teratógenos por principio activo.',
  },
  cirugia: {
    nombre: 'Valoración perioperatoria',
    que: 'ASA, RCRI, Caprini, Apfel y profilaxis con re-dosis: la herramienta central del acto quirúrgico.',
  },
  fotos: {
    nombre: 'Fotos clínicas',
    que: 'Documentación de lesiones sin capturar identificadores del paciente. Va siempre.',
  },
  laboratorios: {
    nombre: 'Laboratorios',
    que: 'Interpretación de PDF/foto de laboratorio con gráficas de tendencia por analito.',
  },
}

export interface Paquete {
  tronco: Tronco
  nombre: string
  /** A quién le toca por defecto (las subespecialidades heredan del tronco). */
  cubre: string
  /** El foco clínico del paquete en una línea. */
  foco: string
  /**
   * Estado honesto. 'activo' = filtra la consulta HOY en producción.
   * 'contexto' = además se enciende solo por el diagnóstico dictado.
   */
  estado: 'activo' | 'contexto'
}

/**
 * Los paquetes, en el mismo orden en que un consultorio los encuentra útiles.
 * `primer-contacto` y `otra` NO son paquetes de especialidad (ven todo); se
 * describen aparte en la página para no vender un filtro donde no lo hay.
 */
export const PAQUETES: Paquete[] = [
  {
    tronco: 'medicina-interna',
    nombre: 'Medicina Interna',
    cubre: 'Internista, cardiología, neumología, gastro/hepatología, endocrinología, nefrología, reumatología, hematología, infectología, oncología, geriatría, neurología, dermatología, terapia intensiva.',
    foco: 'El adulto complejo: riesgo cardiovascular, prevención y cultivos con PROA.',
    estado: 'activo',
  },
  {
    tronco: 'pediatria',
    nombre: 'Pediatría',
    cubre: 'Pediatría general, neonatología y subespecialidades pediátricas médicas (infecto, cardio, neumo, neuro pediátricas).',
    foco: 'Dosis por peso y percentiles OMS; sin ruido de escalas de adulto.',
    estado: 'activo',
  },
  {
    tronco: 'gineco-obstetricia',
    nombre: 'Gineco-obstetricia',
    cubre: 'Ginecología, obstetricia, medicina materno-fetal, biología de la reproducción y oncología ginecológica.',
    foco: 'Salud de la mujer y embarazo, con alerta de teratógenos por fármaco.',
    estado: 'activo',
  },
  {
    tronco: 'cirugia',
    nombre: 'Quirúrgico y perioperatorio',
    cubre: 'Cirugía general y de especialidad, ortopedia/traumatología, urología, otorrino, oftalmología, neurocirugía, anestesiología, trasplante.',
    foco: 'La valoración perioperatoria como herramienta central del caso.',
    estado: 'contexto',
  },
]

/** Las herramientas del paquete, derivadas de la fuente que gobierna la consulta. */
export function incluyeDe(tronco: Tronco): { id: HerramientaId; nombre: string; que: string }[] {
  return herramientasDeTronco(tronco).map(id => ({ id, ...HERRAMIENTAS[id] }))
}

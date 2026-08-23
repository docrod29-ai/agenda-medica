/**
 * MIGRACIÓN DE PACIENTES — la puerta del módulo.
 *
 * Carril #311. El orden de los re-exports es el del pipeline, que es también el
 * orden en que conviene leerlos:
 *
 *   UPLOAD → DETECT_SCHEMA → MAP_FIELDS → NORMALIZE → VALIDATE → MATCH/DEDUPE
 *   → QUARANTINE → DRY_RUN → HUMAN_APPROVAL → CHUNKED_IMPORT → RECONCILIATION
 *
 * Todo lo que hay aquí es PURO: ni un solo módulo importa Firestore, red o
 * reloj. Lo que escribe vive fuera y llama a esto para decidir qué escribir —
 * ésa es la razón de que el ensayo pueda garantizar cero escrituras.
 */
export * from './contrato'
export * from './adaptadores'
export * from './mapeo'
export * from './normalizacion'
export * from './emparejamiento'
export * from './huella'
export * from './procedencia'
export * from './ensayo'
export * from './lotes'
export * from './reconciliacion'
export * from './rollback'
export * from './aislamiento'
export * from './auditoria'
export * from './adjuntos'
export * from './media-clinica'
export * from './exportacion'

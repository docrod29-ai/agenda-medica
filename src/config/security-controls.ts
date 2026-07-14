/**
 * Estado VERIFICABLE de los controles de seguridad (fuente única de /seguridad).
 *
 * Regla (Product Maturity Loop · SECURITY_HARDENING): un control NO se marca
 * 'active-verified' solo porque exista código. Cada estado refleja verificación
 * real y enlaza a su evidencia interna (archivo/registro). Lo no verificado se
 * declara con honestidad.
 *
 * Estados permitidos (del prompt):
 *   active-verified                → activo y verificado técnicamente
 *   implemented-pending-verification → implementado, falta verificación formal
 *   in-progress                    → en proceso
 *   planned                        → planeado (diseño listo, requiere acción externa)
 *   externally-assessed            → evaluado por un tercero (con informe)
 */
export type SecurityState =
  | 'active-verified' | 'implemented-pending-verification' | 'in-progress' | 'planned' | 'externally-assessed'

export interface SecurityControl {
  id: string
  titulo: string
  detalle: string
  estado: SecurityState
  /** Evidencia interna (archivo del repo o registro) que respalda el estado. */
  evidencia: string
}

export const SECURITY_CONTROLS: SecurityControl[] = [
  {
    id: 'encryption', titulo: 'Cifrado en tránsito y en reposo', estado: 'active-verified',
    detalle: 'Todo el tráfico viaja por HTTPS/TLS. La información se almacena en Google Cloud (Firestore/Storage), cifrada en reposo de forma predeterminada.',
    evidencia: 'Plataforma GCP (cifrado en reposo por defecto) + HTTPS forzado en Vercel.',
  },
  {
    id: 'rbac', titulo: 'Control de acceso por roles', estado: 'active-verified',
    detalle: 'Permisos por rol (médico, administración, enfermería, recepción, auditor). El rol vive en el servidor; la asistente nunca ve datos clínicos sensibles.',
    evidencia: 'firestore.rules (isMedico/isMember) + clinic_members.',
  },
  {
    id: 'tenant-isolation', titulo: 'Aislamiento entre consultorios', estado: 'active-verified',
    detalle: 'Cada consultorio es un espacio de datos independiente; las reglas impiden el acceso cruzado.',
    evidencia: 'firestore.rules (match /clinics/{clinicId} con isMember).',
  },
  {
    id: 'audit-log', titulo: 'Bitácora inalterable (append-only)', estado: 'active-verified',
    detalle: 'Registro append-only de quién consultó, creó, firmó, corrigió (adenda), imprimió o exportó cada dato clínico. No se puede editar ni borrar.',
    evidencia: 'firestore.rules audit_log (allow update, delete: if false) + src/lib/expediente/audit-log.ts.',
  },
  {
    id: 'session-timeout', titulo: 'Cierre automático de sesión por inactividad', estado: 'active-verified',
    detalle: 'La sesión se cierra tras inactividad con aviso previo; los borradores se conservan.',
    evidencia: 'src/components/AutoLogout.tsx (30 min, probado).',
  },
  {
    id: 'rate-limit', titulo: 'Límites de tasa en endpoints sensibles', estado: 'active-verified',
    detalle: 'Rate limiting propio (Firestore) en endpoints de IA/soporte/errores para bloquear abuso.',
    evidencia: 'src/lib/rate-limit (fail-open) en rutas de IA/soporte.',
  },
  {
    id: 'app-check', titulo: 'Verificación de origen (App Check)', estado: 'implemented-pending-verification',
    detalle: 'App Check para bloquear tráfico automatizado. Requiere activar la site key en la consola para verificación completa.',
    evidencia: 'Integración presente; enforcement pendiente de activar (acción externa).',
  },
  {
    id: 'incident-response', titulo: 'Plan de respuesta a incidentes', estado: 'implemented-pending-verification',
    detalle: 'Plan documentado (severidad, contención, comunicación, postmortem). Falta un simulacro registrado.',
    evidencia: 'docs/security/incident-response-plan.md.',
  },
  {
    id: 'backups-pitr', titulo: 'Respaldos + recuperación a un punto en el tiempo', estado: 'in-progress',
    detalle: 'Respaldos automáticos y PITR en activación. Objetivos: RPO ≤ 24 h, RTO ≤ 4 h. NO se declara "activo" hasta ejecutar un restore drill en staging.',
    evidencia: 'docs/security/backup-and-restore.md (restore drill: BLOCKED — requiere infraestructura).',
  },
  {
    id: 'mfa', titulo: 'Autenticación multifactor (MFA)', estado: 'planned',
    detalle: 'Diseño listo (TOTP + códigos de recuperación, obligatorio para administradores). Requiere habilitar Identity Platform en el proyecto para implementarlo y probarlo.',
    evidencia: 'docs/security/mfa-design.md (BLOCKED — requiere Identity Platform).',
  },
  {
    id: 'pentest', titulo: 'Prueba de penetración externa anual', estado: 'planned',
    detalle: 'Alcance y reglas de compromiso preparados. Pendiente de contratar a un tercero independiente; las pruebas internas (SAST/dependencias/secretos) NO equivalen a un pentest externo.',
    evidencia: 'docs/security/pentest-readiness.md.',
  },
]

/** Verdad para la UI: solo estos dos estados se muestran como "verde/activo". */
export function esActivo(e: SecurityState): boolean {
  return e === 'active-verified' || e === 'externally-assessed'
}

export const ESTADO_LABEL: Record<SecurityState, string> = {
  'active-verified': 'Activo y verificado',
  'implemented-pending-verification': 'Implementado · verificación pendiente',
  'in-progress': 'En proceso',
  'planned': 'Planeado',
  'externally-assessed': 'Evaluado por tercero',
}

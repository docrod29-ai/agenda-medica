/**
 * PROCEDENCIA DEL NIVEL DE IA — proveedor y modelo reales, SÓLO hacia adentro.
 *
 * ── QUÉ ES ESTO Y QUÉ NO ES ──────────────────────────────────────────────────
 *
 * NO es un router. El router existe y es uno solo: `/api/expediente/procesar`
 * traduce `Motor.perfil` a su cascada `CANDIDATOS` y resuelve el modelo vivo
 * contra el proveedor. Este módulo no enruta ni decide nada: describe, para el
 * lado administrativo, qué hay debajo de cada nivel de intención.
 *
 * Existe porque el arreglo de #345 quitó `modelos` del tipo `Motor` —era el campo
 * que obligaba a toda pantalla del médico a pintar una marca—, y esa información
 * no podía simplemente desaparecer: la procedencia de una nota firmada es materia
 * medicolegal, y el margen por nivel es materia contable. Quitarla del contrato
 * del médico no es lo mismo que borrarla.
 *
 * ── LA FRONTERA ──────────────────────────────────────────────────────────────
 *
 * Este archivo NO se importa desde `src/app/(dashboard)/`, `src/components/` ni
 * `src/app/precios`. Lo consumen procedencia, auditoría, contabilidad de costos,
 * observabilidad y superadmin. Un guardián lo comprueba: ver
 * `src/__tests__/el-medico-no-elige-marca.test.ts`.
 *
 * La frontera es estructural a propósito. Un comentario que dice «no lo pintes»
 * no sobrevive a la tercera pantalla que necesita un subtítulo; un `import` que
 * hace fallar una prueba, sí.
 *
 * ── LA ETIQUETA NO ES LA VERDAD DEL COSTO ────────────────────────────────────
 *
 * `etiquetaAuditoria` es legible para un humano que revisa un panel. El costo
 * real NO se calcula desde aquí: se calcula en `src/lib/finanzas/` a partir del
 * id de modelo que DEVUELVE el proveedor en cada llamada, que es el único dato
 * que no puede quedarse atrasado cuando la cascada degrada a un modelo distinto
 * del esperado. Si alguna vez discrepan, manda el id del proveedor.
 *
 * Módulo PURO: sin E/S, sin estado.
 */
import type { ClaveMotor, PerfilRuteo } from '@/lib/planes-ia'

export type ProveedorIA = 'anthropic' | 'openai' | 'assemblyai'

export interface ProcedenciaMotor {
  /** Perfil que consume el router; la misma clave que lleva `Motor.perfil`. */
  perfil: PerfilRuteo
  /** Proveedores que pueden intervenir en una nota de este nivel. */
  proveedores: readonly ProveedorIA[]
  /** ¿Este nivel dispara un segundo verificador independiente? */
  segundaOpinion: boolean
  /** ¿Este nivel separa voces (diarización) además de redactar? */
  diarizacion: boolean
  /**
   * Etiqueta legible para paneles internos. NUNCA para una pantalla del médico.
   * Orientativa: el modelo servido de verdad lo dicta la cascada del router.
   */
  etiquetaAuditoria: string
}

/**
 * Intención clínica → qué corre por dentro. La clave es la MISMA `ClaveMotor`
 * que ya usan los créditos y el router: no se inventa una segunda taxonomía.
 */
export const PROCEDENCIA_POR_MOTOR: Readonly<Record<ClaveMotor, ProcedenciaMotor>> = {
  rapida: {
    perfil: 'live',
    proveedores: ['anthropic'],
    segundaOpinion: false,
    diarizacion: false,
    etiquetaAuditoria: 'Haiku 4.5',
  },
  estandar: {
    perfil: 'pro',
    proveedores: ['anthropic', 'assemblyai'],
    segundaOpinion: false,
    diarizacion: true,
    etiquetaAuditoria: 'Sonnet 5 + diarización',
  },
  maxima: {
    perfil: 'premium',
    proveedores: ['anthropic', 'openai', 'assemblyai'],
    segundaOpinion: true,
    diarizacion: true,
    etiquetaAuditoria: 'Opus 4.8 + GPT-5 (2ª opinión)',
  },
}

/** Procedencia de un nivel. Cae a `estandar`, igual que `motorPorClave`. */
export const procedenciaDe = (c?: string): ProcedenciaMotor =>
  PROCEDENCIA_POR_MOTOR[(c as ClaveMotor)] ?? PROCEDENCIA_POR_MOTOR.estandar

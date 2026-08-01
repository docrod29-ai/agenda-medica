/**
 * CAPACIDADES POR ROL — quién puede hacer qué (unidad Nexus OS E0-07).
 *
 * POR QUÉ EXISTE: hasta hoy la autorización de las API routes era BINARIA
 * (`verificarMiembro` = cualquier rol, `verificarMedico` = medico|admin) y vivía
 * repartida en SEIS sitios sin fuente de verdad: el `role !== 'medico'` de
 * `auth-server.ts`, el mapa `GATES` de `hospital/mutar`, el `ROLES_CLINICOS` de
 * `hospital/alerta`, la tabla de `permissions.ts` (que no gateaba nada),
 * `firestore.rules` y la matriz de E0-06. Cada sitio con su propia lista de roles.
 *
 * Aquí las capacidades son un DATO puro y comprobable:
 *  - `authz-capabilities.test.ts` cruza la matriz contra `rolesDe()` de E0-06
 *    (la transcripción probada de `firestore.rules`), así que la tabla NO se
 *    justifica con prosa: si alguien afloja una fila, el puente con E0-06 se rompe.
 *  - `authz-rutas-declaradas.test.ts` exige que cada ruta de `src/app/api`
 *    declare la capacidad que pide. Una ruta nueva sin declarar pone los tests en
 *    rojo: eso es «no hay any-member implícito».
 *
 * MÓDULO PURO: sin `next/server`, sin `firebase-admin`, sin I/O. La guardia de
 * request vive aparte, en `./verificar.ts`, para que este núcleo se pruebe sin un
 * solo mock y para no crear un ciclo con `auth-server.ts`.
 *
 * NO REDECLARA LOS ROLES. La unión canónica la creó E0-06 en `./matriz-acceso.ts`;
 * declarar aquí una lista propia habría producido la 5.ª lista de roles del repo,
 * que es justo el defecto que esta unidad viene a cerrar.
 */
import { ROLES, ROLES_NO_CLINICOS, rolesDe, type Rol } from './matriz-acceso'

export type { Rol }
export { ROLES, ROLES_NO_CLINICOS }

/**
 * Roles que HOY se pueden ASIGNAR desde la app. Espejo exacto de
 * `cambiarRolMiembro` (`src/lib/miembros.ts`) y del enum de `ClinicMember.role`.
 *
 * `recepcion` y `facturacion` existen en la matriz (E0-06 los evalúa para que el
 * día que se activen no entren por una puerta abierta) pero NO son asignables:
 * hoy nadie los tiene. La distinción es la que hace segura la migración de rutas:
 * ampliar una capacidad hacia un rol NO asignable no le da acceso a ningún usuario
 * real, y el test lo comprueba (invariante «ninguna ampliación alcanza a alguien»).
 */
export const ROLES_ASIGNABLES: readonly Rol[] = [
  'admin', 'medico', 'secretaria', 'enfermeria', 'farmacia', 'laboratorio',
]

/**
 * Catálogo CERRADO de capacidades. Cada una es un verbo del consultorio, no un
 * nombre de pantalla: lo que se autoriza es la acción, no la ruta.
 */
export const CAPACIDADES = [
  // ── clínicas ─────────────────────────────────────────────────────────────
  /** Leer PHI clínico en el pase de visita (≡ `isClinicoHospital`). */
  'clinico.leer',
  /** Dictar, procesar con IA o exportar el expediente (≡ `isMedico`). */
  'clinico.escribir',
  /** Sellar una nota o una receta. Acto irreversible con identidad profesional. */
  'firmar',
  /** Receta e indicaciones farmacológicas. */
  'prescribir',
  /** Enfermería registra la toma en el MAR. */
  'medicamento.administrar',
  /**
   * Enfermería registra en el pase de visita lo que NO es medicación: balance
   * hídrico, escalas (NEWS2/Glasgow) y nota SBAR.
   *
   * Existe porque el catálogo inicial del diseño no podía expresar 1:1 el mapa
   * `GATES` de `hospital/mutar`: forzar `balance`/`escala`/`sbar` dentro de
   * `medicamento.administrar` habría dejado un nombre que miente en un archivo de
   * seguridad. Mismo conjunto de roles, verbo correcto.
   */
  'pase.registrar',
  /**
   * Farmacia verifica una dispensación. Mismo motivo que `pase.registrar`:
   * `GATES.verificar_farmacia` es {farmacia, medico, admin} y ninguna capacidad
   * del catálogo inicial producía ese conjunto. Sin ella la migración de
   * `hospital/mutar` habría cambiado quién puede verificar en farmacia.
   */
  'farmacia.verificar',
  // ── operativas ───────────────────────────────────────────────────────────
  /** Citas, sync de calendario, lista de espera, magic-link del portal. */
  'agenda.gestionar',
  /**
   * BORRAR una cita (no cancelarla) y agendar ENCIMA de otra.
   *
   * Separada de `agenda.gestionar` por decisión del dueño (2026-08-01): las dos
   * destruyen algo —el registro de la cita, o el tiempo de consulta de un
   * paciente que ya lo tenía— y ésas las decide quien atiende, no el mostrador.
   * Cancelar, reagendar y marcar no-asistió siguen siendo de `agenda.gestionar`.
   */
  'agenda.destruir',
  /** WhatsApp saliente al paciente. */
  'mensajeria.enviar',
  /** Registrar cobro o abono. */
  'cobrar',
  /** Timbrar y descargar CFDI. */
  'facturar',
  /** Ver el directorio del consultorio (correos del equipo). */
  'equipo.leer',
  // ── administración ───────────────────────────────────────────────────────
  /** Config, llaves de IA, WhatsApp, suscripción, asientos. */
  'administrar',
  /** Escribir en la bitácora la acción PROPIA (NOM-024). */
  'auditoria.registrar',
] as const
export type Capacidad = (typeof CAPACIDADES)[number]

/**
 * LA MATRIZ. Superconjunto exacto de lo que hoy autoriza el código: cada fila sale
 * de un gate existente, no de una preferencia.
 *
 *  · `clinico.escribir` / `firmar` / `prescribir` / `administrar` = {medico, admin}
 *    ≡ `verificarMedico` (auth-server.ts) ≡ `rolesDe('isMedico')`.
 *  · `clinico.leer` ≡ `rolesDe('isClinicoHospital')` ≡ el `ROLES_CLINICOS` suelto
 *    de `hospital/alerta`.
 *  · `medicamento.administrar` ≡ `GATES.administrar` de `hospital/mutar`.
 *  · `auditoria.registrar` la tienen TODOS los roles: es la bitácora de la acción
 *    propia y negarla abriría huecos en el rastro NOM-024. Es un «todos» DECLARADO
 *    por escrito, que es exactamente lo contrario de un any-member implícito.
 *  · `medico` conserva `administrar` porque hoy `verificarMedico` protege
 *    `stripe/*`, `clinic/ai-keys` POST y `whatsapp/*-connect`: quitárselo rompería
 *    al consultorio de un solo médico (el caso del dueño). Pendiente de su
 *    decisión (Q5), no se cambia por iniciativa propia.
 */
export const CAPACIDADES_POR_ROL: Readonly<Record<Rol, readonly Capacidad[]>> = {
  admin: [
    'clinico.leer', 'clinico.escribir', 'firmar', 'prescribir', 'medicamento.administrar',
    'pase.registrar', 'farmacia.verificar',
    'agenda.gestionar', 'agenda.destruir', 'mensajeria.enviar', 'cobrar', 'facturar', 'equipo.leer',
    'administrar', 'auditoria.registrar',
  ],
  medico: [
    'clinico.leer', 'clinico.escribir', 'firmar', 'prescribir', 'medicamento.administrar',
    'pase.registrar', 'farmacia.verificar',
    'agenda.gestionar', 'agenda.destruir', 'mensajeria.enviar', 'cobrar', 'facturar', 'equipo.leer',
    'administrar', 'auditoria.registrar',
  ],
  /**
   * La asistente del mostrador: agenda, WhatsApp, cobro, FACTURACIÓN y
   * directorio. NUNCA clínico, y NUNCA `agenda.destruir`.
   *
   * Decisión del dueño (2026-08-01), en las dos direcciones:
   *  · SE AMPLÍA con `facturar`. Cobrar y no poder timbrar el CFDI del cobro
   *    que acabas de registrar era un corte artificial: el trabajo es el mismo
   *    y la factura la pedía el paciente en el mostrador.
   *  · SE ESTRECHA quitando el borrado de citas y el sobreagendamiento
   *    (`agenda.destruir`), que destruyen registro o tiempo clínico.
   */
  secretaria: ['agenda.gestionar', 'mensajeria.enviar', 'cobrar', 'facturar', 'equipo.leer', 'auditoria.registrar'],
  // Rol declarado y todavía no asignable (ver ROLES_ASIGNABLES).
  recepcion: ['agenda.gestionar', 'mensajeria.enviar', 'auditoria.registrar'],
  facturacion: ['cobrar', 'facturar', 'auditoria.registrar'],
  // Staff clínico hospitalario: lee el pase de visita, no dicta ni firma.
  enfermeria: ['clinico.leer', 'medicamento.administrar', 'pase.registrar', 'auditoria.registrar'],
  farmacia: ['clinico.leer', 'farmacia.verificar', 'auditoria.registrar'],
  laboratorio: ['clinico.leer', 'auditoria.registrar'],
}

/**
 * Capacidades de un rol, con MÍNIMO PRIVILEGIO ante datos ausentes: rol
 * null/undefined/desconocido → NINGUNA capacidad.
 *
 * Es deliberadamente más estricto que `permisosPorRol` (que ante un rol ausente
 * devuelve el objeto `RECEPCION` porque es una capa de UX y devolver `undefined`
 * reventaría al llamador). Aquí se decide acceso real en el servidor: sin rol
 * legible, no se autoriza nada.
 */
export function capacidadesDe(rol: string | null | undefined): readonly Capacidad[] {
  if (!rol) return []
  return CAPACIDADES_POR_ROL[rol as Rol] ?? []
}

/** ¿Este rol tiene esta capacidad? Falla-cerrado ante rol ausente o desconocido. */
export function tieneCapacidad(rol: string | null | undefined, c: Capacidad): boolean {
  return capacidadesDe(rol).includes(c)
}

/**
 * Roles que satisfacen una capacidad, en el orden canónico de `ROLES`.
 * Es la función con la que los tests de no-regresión comparan una capacidad
 * contra el conjunto de roles que la ruta autorizaba ANTES de migrarla.
 */
export function rolesCon(c: Capacidad): readonly Rol[] {
  return ROLES.filter(r => CAPACIDADES_POR_ROL[r].includes(c))
}

/**
 * Puente explícito con E0-06: la guarda de `firestore.rules` equivalente a una
 * capacidad clínica. Sirve para que el test compare conjuntos en vez de confiar en
 * que la tabla de arriba se transcribió bien.
 */
export const GUARDA_EQUIVALENTE = {
  'clinico.escribir': 'isMedico',
  'clinico.leer': 'isClinicoHospital',
} as const

/** Reexport del helper de E0-06 para que el puente se lea de un tirón. */
export { rolesDe }

/**
 * GENERADOR DE CASOS tenant × rol × colección (unidad Nexus OS E0-08).
 *
 * Por qué existe este archivo y no una lista de casos escrita a mano: una lista a
 * mano se queda vieja en cuanto alguien añade un `match` a `firestore.rules` — y
 * una suite de seguridad que se queda vieja pasa en verde probando menos de lo que
 * dice. Los casos se DERIVAN de `MATRIZ_ACCESO` (unidad E0-06), que a su vez está
 * atada a las reglas reales por `src/__tests__/matriz-acceso.test.ts`. Añadir una
 * colección sin que aparezca aquí pone rojo el gate rápido
 * (`src/__tests__/emulador-config-guard.test.ts`, prueba anti-encogimiento).
 *
 * MÓDULO PURO: sin Firebase, sin red, sin PHI. Solo produce descripciones de casos.
 * Quien los ejecuta contra el emulador es `emulator/tenant-aislamiento.emu.test.ts`.
 *
 * REGLA 2 de la carta operativa: los dos inquilinos y todos los ids son
 * SINTÉTICOS y deterministas. Aquí no hay ni puede haber un dato real.
 */

import {
  MATRIZ_ACCESO,
  ROLES,
  puedeEscribir,
  puedeLeer,
  type Guarda,
  type RecursoAcceso,
  type Rol,
} from '@/lib/authz/matriz-acceso'

/** Los dos inquilinos sintéticos. Nunca datos reales (regla 2). */
export const TENANT_A = 'clinica-alfa'
export const TENANT_B = 'clinica-beta'

export type Tenant = typeof TENANT_A | typeof TENANT_B
export const TENANTS: readonly Tenant[] = [TENANT_A, TENANT_B]

export type Operacion = 'read' | 'write'
export const OPERACIONES: readonly Operacion[] = ['read', 'write']

export type Esperado = 'permitido' | 'denegado'

export interface CasoTenant {
  /** Ruta CONCRETA ya instanciada (comodines → ids sintéticos fijos). */
  readonly ruta: string
  /** Ruta con comodines, tal cual en MATRIZ_ACCESO (para el mensaje de error). */
  readonly plantilla: string
  readonly tenantDelRecurso: Tenant
  /** Clínica a la que pertenece el usuario que intenta la operación. */
  readonly tenantDelUsuario: Tenant
  readonly rol: Rol
  readonly operacion: Operacion
  readonly esperado: Esperado
  /** true cuando tenantDelUsuario !== tenantDelRecurso. */
  readonly esCrossTenant: boolean
  /** Guarda declarada en la matriz para ESA operación. Se imprime en el fallo. */
  readonly guarda: Guarda
}

/**
 * `{document=**}` no es una ruta instanciable (es el default-deny). Se excluye del
 * generador; que exista y esté cerrado ya lo verifica `firestore-rules-guard.test.ts`.
 */
const PLANTILLA_DEFAULT_DENY = '{document=**}'

/** ¿La ruta lleva el `clinicId` en su POSICIÓN (aislamiento posicional)? */
export function esRutaDeTenant(ruta: string): boolean {
  return ruta.startsWith('clinics/{clinicId}')
}

/**
 * Recursos con aislamiento POSICIONAL: el `clinicId` viaja en la ruta, así que un
 * acceso cross-tenant es siempre una fuga (salvo los `publico` enumerados abajo).
 * Los de raíz (`clinic_members/{uid}`, `platform_*`, …) se aíslan por CONTENIDO
 * (`resource.data.clinicId`) y van en un bloque escrito a mano en el spec.
 */
export function recursosDeTenant(): readonly RecursoAcceso[] {
  return MATRIZ_ACCESO.filter(r => esRutaDeTenant(r.ruta))
}

/**
 * Instancia los comodines de una plantilla con ids sintéticos deterministas.
 *
 * `{clinicId}` → el tenant; `{uid}` → el uid que se pasa; cualquier otro comodín →
 * `x-<nombre>`. Deliberadamente GENÉRICO (no una tabla de nombres a mano): así una
 * colección nueva con un comodín nuevo se instancia sola y el generador no se rompe
 * ni hay que recordar actualizar un mapa.
 *
 * OJO con `{uid}`: `learning/{uid}` y `chat_reads/{uid}` exigen
 * `request.auth.uid == uid`. Se instancia con el uid del ACTOR a propósito — es el
 * caso MÁS permisivo posible, de modo que si la operación se deniega solo puede ser
 * por el aislamiento de clínica y no por el dueño del documento.
 */
export function instanciar(plantilla: string, clinicId: string, uid: string): string {
  return plantilla.replace(/\{([^}]*)\}/g, (_todo, nombre: string) => {
    if (nombre === 'clinicId') return clinicId
    if (nombre === 'uid') return uid
    return `x-${nombre}`
  })
}

/** Guarda que aplica a la operación. */
export function guardaDe(recurso: RecursoAcceso, op: Operacion): Guarda {
  return op === 'read' ? recurso.guardaLectura : recurso.guardaEscritura
}

/**
 * Rutas que la matriz declara `publico` para esa operación — las ÚNICAS donde un
 * acceso cross-tenant NO es una fuga. Se DERIVA de MATRIZ_ACCESO, no se escribe a
 * mano: así nadie puede añadir una excepción tocando un solo archivo.
 */
export function rutasPublicas(op: Operacion): readonly string[] {
  return MATRIZ_ACCESO.filter(r => guardaDe(r, op) === 'publico').map(r => r.ruta)
}

/** uid determinista del actor. Mismo criterio que `emulator/entorno.ts`. */
export function uidDe(tenant: string, rol: Rol): string {
  return `u-${tenant}-${rol}`
}

/**
 * El producto cartesiano completo. Puro y determinista: sin red, sin Firebase.
 *
 * Se generan las CUATRO combinaciones (recurso en A/B × usuario propio/ajeno) en
 * vez de fijar el recurso en A: el aislamiento debe ser simétrico y probar una sola
 * dirección dejaría media afirmación sin evidencia.
 *
 * `esperado` se decide así:
 *  - cross-tenant y guarda ≠ `publico` → `denegado`. NO se consulta la matriz: la
 *    respuesta correcta es siempre negar. Es LA aceptación de la unidad.
 *  - cross-tenant y guarda `publico`   → `permitido` (excepción enumerada en la matriz).
 *  - mismo tenant                      → lo que dice la matriz de E0-06.
 */
export function generarCasos(): readonly CasoTenant[] {
  const casos: CasoTenant[] = []
  for (const recurso of recursosDeTenant()) {
    if (recurso.ruta === PLANTILLA_DEFAULT_DENY) continue
    for (const tenantDelRecurso of TENANTS) {
      for (const tenantDelUsuario of TENANTS) {
        const esCrossTenant = tenantDelRecurso !== tenantDelUsuario
        for (const rol of ROLES) {
          for (const operacion of OPERACIONES) {
            const guarda = guardaDe(recurso, operacion)
            const ruta = instanciar(
              recurso.ruta,
              tenantDelRecurso,
              uidDe(tenantDelUsuario, rol),
            )
            const esperado: Esperado = esCrossTenant
              ? (guarda === 'publico' ? 'permitido' : 'denegado')
              : ((operacion === 'read' ? puedeLeer(rol, recurso.ruta) : puedeEscribir(rol, recurso.ruta))
                  ? 'permitido'
                  : 'denegado')
            casos.push({
              ruta,
              plantilla: recurso.ruta,
              tenantDelRecurso,
              tenantDelUsuario,
              rol,
              operacion,
              esperado,
              esCrossTenant,
              guarda,
            })
          }
        }
      }
    }
  }
  return casos
}

/**
 * Los casos que la Afirmación A (aislamiento) DEBE poner a prueba: cross-tenant y
 * guarda no pública. Todos ellos esperan `denegado`.
 */
export function casosDeAislamiento(): readonly CasoTenant[] {
  return generarCasos().filter(c => c.esCrossTenant && c.guarda !== 'publico')
}

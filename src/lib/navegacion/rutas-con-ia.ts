/**
 * RUTAS QUE SÓLO TIENEN SENTIDO CON IA DE VOZ — D-061.
 *
 * El paquete Expediente abre el módulo `expediente` entero (consulta, recetas,
 * órdenes, referencias) pero no la IA. `/consultor` es una pantalla cuya única
 * función es una llamada de IA: mostrarla a un plan escrito es ofrecer una
 * puerta que da a un 403. Hermana de `modulos-en-pausa`: esto es visibilidad
 * de menú, no control de acceso. El acceso lo cierra `verificarModuloIA`.
 */
import { planIncluyeIA } from '@/lib/planes-ia'

export const RUTAS_CON_IA: readonly string[] = ['/consultor']

type ClinicPlan = { plan?: string | null; paseLibre?: boolean | null } | null | undefined

/** ¿Se esconde esta ruta del menú para este consultorio? Sólo si su plan no incluye IA. */
export function ocultaSinIA(clinic: ClinicPlan, href: string): boolean {
  if (!clinic || clinic.paseLibre) return false
  if (planIncluyeIA(clinic.plan)) return false
  return RUTAS_CON_IA.some(r => href === r || href.startsWith(r + '/'))
}

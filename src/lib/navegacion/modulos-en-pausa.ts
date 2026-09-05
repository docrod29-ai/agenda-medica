/**
 * MÓDULOS EN PAUSA — lo que existe, funciona y NO se ofrece todavía.
 *
 * Decisión del dueño (4-sep-2026): Hospitalización y UCI salen de la
 * navegación. La prioridad es **la consulta y su agenda**; un grupo «Hospital
 * y UCI» en el índice compite por atención con lo único que se está vendiendo
 * hoy, y además ofrece dos productos que están en ALPHA («se usan, no se
 * venden», CLAUDE.md).
 *
 * PAUSA NO ES BORRADO. Nada se elimina:
 *
 * - las rutas `/hospitalizacion` y `/uci` siguen vivas y se pueden abrir
 *   escribiéndolas (o desde el enlace del expediente de un paciente internado);
 * - las declaraciones siguen escritas donde estaban —el `NAV` del `Sidebar` y
 *   los `GRUPOS` de `/operaciones`— con su etiqueta, su icono y su «para qué»,
 *   listas para volver a pintarse;
 * - el catálogo de módulos, los paquetes, los precios, los motores clínicos y
 *   sus pruebas no se tocan. El entitlement (`rutaPermitida`) sigue mandando
 *   sobre el acceso: esto sólo decide qué se OFRECE en el menú.
 *
 * PARA VOLVER A ENCENDERLO: vaciar `MODULOS_EN_PAUSA` (o quitar la clave que
 * toque). Una línea. El guardián
 * `src/__tests__/hospital-y-uci-en-pausa.test.ts` comprueba las dos
 * direcciones: que hoy no se pintan, y que con la lista vacía volverían.
 *
 * Lo que esta pausa NO hace, dicho para que nadie lo suponga: no cierra la
 * ruta HTTP ni oculta datos. Esconder un botón nunca fue una defensa
 * (`.claude/rules/security-tenant.md`); quien no tenga el módulo contratado
 * sigue rebotando por `rutaPermitida`, igual que antes de esta pausa.
 */
import { MODULOS } from '@/lib/modulos'

/** Claves de `MODULOS` que hoy no se ofrecen en la navegación. */
export const MODULOS_EN_PAUSA: readonly string[] = ['hospitalizacion', 'uci']

/**
 * Las rutas que quedan en pausa según una lista de módulos.
 *
 * Una ruta se pausa sólo si **todos** los módulos que la reclaman están en
 * pausa. `/hospitalizacion` la reclaman `hospitalizacion` y `uci` (el UCI OS
 * trae su propio censo): pausar uno solo dejaría la ruta ofrecida por el otro,
 * que es justo el descuido que este cálculo evita. Y si mañana un módulo que
 * sigue a la venta reclama una de esas rutas, deja de estar en pausa sin que
 * nadie tenga que acordarse de editar una segunda lista.
 */
export function rutasEnPausa(enPausa: readonly string[] = MODULOS_EN_PAUSA): string[] {
  const pausados = new Set(enPausa)
  const rutas = new Set<string>()
  for (const m of MODULOS) {
    if (!pausados.has(m.key)) continue
    for (const r of m.rutas) {
      const duenos = MODULOS.filter(x => x.rutas.includes(r))
      if (duenos.every(d => pausados.has(d.key))) rutas.add(r)
    }
  }
  return [...rutas]
}

/** Las rutas en pausa HOY, calculadas una vez (el catálogo es estático). */
export const RUTAS_EN_PAUSA: readonly string[] = rutasEnPausa()

/**
 * ¿Este destino se esconde del menú? Se compara por familia de ruta para que
 * `/uci/cama-3` quede fuera igual que `/uci`.
 */
export function enPausa(href: string, rutas: readonly string[] = RUTAS_EN_PAUSA): boolean {
  return rutas.some(r => href === r || href.startsWith(r + '/'))
}

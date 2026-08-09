# Estado del sistema de diseño — V9

> Se escribe **a mano**, tras cada iteración. Las cifras derivables viven en
> `scripts/design/techos-de-diseno.json` (selladas) y en
> `docs/design/SCREEN_INVENTORY.md` (generado).

**Unidad**: `DESIGN-SYSTEM-001` **cerrada** el 9-ago-2026 · REG-298, REG-299.
**Siguiente**: `NAVIGATION-001`.
**El porqué completo**: [`docs/design/NEXUS_DESIGN_SYSTEM.md`](../docs/design/NEXUS_DESIGN_SYSTEM.md).

---

## Lo que esta unidad encontró, y no buscaba

La auditoría anterior dijo «1 205 hexadecimales a mano, 125 el azul de marca
retecleado». **Estaba mal contado**: la mayoría no eran literales sueltos sino
respaldos dentro de `var()`. Y corregir la cuenta destapó algo peor:

> **Había un segundo sistema de color entero, obsoleto, escondido dentro del
> primero. En cinco sitios era el que mandaba.**

280 respaldos. **253 obsoletos** (ni el valor oscuro ni el claro de su token),
**5 sobre tokens que no existían** —`--warn-*`, `--success`—, 22 correctos.

- El peor posible: `var(--text, #0f172a)` ×35 → texto casi negro sobre lienzo
  `#0B0C0E`. Contraste ≈1,05:1. **Invisible.**
- El que ya pasaba: tarjeta de aviso **color crema sobre lienzo oscuro** en
  `/pacientes`. Tercera aparición de esta forma.
- Y cuatro fantasmas **sin respaldo**: `--danger`, `--muted`, `--surface`,
  `--text1`. No pintaban un color equivocado — no pintaban nada. El error de
  Configuración no salía en rojo.

## Lo que queda montado

| | |
|---|---|
| **Respaldos de token** | **0**, y es invariante, no deuda |
| **`@theme inline`** | de **4** valores a **~35**, con prefijo `nx-` |
| **Escalas nuevas** | radio · espacio · elevación · movimiento · tipografía |
| **Trinquete** | `scripts/design/trinquete-de-diseno.mjs`, 5 métricas, sólo baja |
| **Guardián** | `el-sistema-de-diseno-no-pierde-terreno.test.ts`, 9 casos |

El prefijo `nx-` importa: `--spacing-4` sin prefijo redefiniría `p-4` en toda la
aplicación de golpe. Con prefijo se **añade** vocabulario sin reinterpretar el
que ya se usa — la diferencia entre migrar poco a poco y migrar de una vez.

## La deuda, medida y sellada

| Métrica | Hoy = techo |
|---|---:|
| `respaldosDeToken` | **0** |
| `hexEnLinea` | 565 |
| `tamanosFueraDeEscala` | 2 029 |
| `radiosFueraDeEscala` | 638 |
| `sombrasEnLinea` | 24 |

El sello **no lleva holgura**: el guardián exige que el techo sea exactamente lo
que mide el script. Un techo con margen es un techo que no muerde.

## Dos defectos que esta unidad introdujo, y uno que llevaba dos commits

`REG-299`. Los dos scripts de `scripts/design/` ejecutaban su cuerpo de línea de
órdenes **al importarlos**. El del trinquete tumbaba la recolección de la prueba
con `process.exit(1)`; el del inventario **reescribía el markdown antes de
compararlo**, así que **ese guardián no podía fallar nunca**.

Y estuvo dos commits fingiendo ser una prueba: se probó al revés al crearlo, pasó
en verde, y **se dio por bueno**. Se ejecutó la comprobación correcta y no se
miró el resultado.

**La regla que deja**: probar al revés no sirve si no se mira el resultado. Una
prueba que pasa cuando debería fallar es peor que ninguna — ocupa el sitio.

## Lo que este estado NO afirma

- **Nadie ha abierto un navegador.** La tarjeta crema se dedujo de que el token
  no existía; verla con los ojos sigue pendiente, igual que el resto de las
  correcciones de esta unidad.
- **No hay compuerta de accesibilidad** (`A11Y-GATE-001`) ni regresión visual.
- **Ninguna pantalla se ha migrado** a las utilidades nuevas
  (`DESIGN-MIGRAR-001`). Esta unidad pone el cimiento y la compuerta.
- Los primitivos de `components/ui/` siguen al **~24 %** de adopción.

## Capacidad nueva detectada

Apareció la skill `agent-browser`. **No desbloquea todavía** la verificación
visual: `npm run build` compila pero falla al recolectar datos de página por
falta de credenciales de Firebase en este contenedor. El bloqueo es de entorno,
no de herramienta — anotado en `NAV-NAVEGADOR-001`.

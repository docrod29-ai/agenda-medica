# ADR · Puente tomas → motores del pase

**Motor:** `uci-resumen` · `src/lib/uci/resumen.ts`
**Estado:** `validado`.

## Fuente de verdad

No aporta ninguna regla clínica. Convierte las `TomaUci` persistidas
(ICU-P0-1) en lo que ya esperan `uci-morning-brief` (§30) y `uci-linea-tiempo`
(§33). Toda la interpretación sigue viviendo en esos motores.

## Referencia

Ninguna externa. El único criterio propio es de **ingeniería de datos**: cómo se
lee un número y cuándo hay suficiente para comparar.

## El fallo que este módulo evita: el puente mudo

El panel guarda las medidas con **sus** nombres (`norepi`, `creat`) y el Morning
Brief usa los del charter (`ne`, `creatinina`). Si ese mapa se desalinea, el
brief **no falla**: sale vacío para siempre y nadie sabe por qué.

Por eso `CLAVE_PANEL_A_BRIEF` es explícito, está exportado, y un caso comprueba
que **todo destino existe** en `METRICAS_BRIEF`. Y `clavesSinMetrica()` lista lo
que hoy se captura pero todavía no llega a ninguna métrica — visible en pantalla,
no enterrado.

## Vacío no es cero

`numero()` devuelve `null` para blanco, espacios, `null` y basura, y entiende la
coma decimal mexicana.

Es la respuesta directa a un hallazgo **confirmado** de la auditoría maestra del
26-jul: un `num()` duplicado en **12 motores** que convierte un espacio en `0` y
pierde «12,5» en silencio. Un 0 inventado en una FiO₂ o en un lactato no es un
dato faltante — es un dato **falso**, y aguas abajo alimenta un delta que nadie
capturó.

El caso que lo congela: dos tomas, FiO₂ 60 y luego un espacio. Con el `num()`
viejo el brief habría dicho «FiO₂ 60 → 0».

Esto **no** repara los 12 motores; es el camino nuevo hecho bien. La
consolidación sigue abierta en la cola de la auditoría.

## Un delta necesita dos puntos

Con una sola lectura de una métrica **no se emite cambio**, y la métrica entra
en `conUnSoloPunto`. Fabricar el par contra el propio valor diría «sin cambio»
donde lo que hay es **falta de comparación** — y esa distinción es la misma que
protege el motor de dato faltante.

## Golden

`src/__tests__/uci-resumen.test.ts` — **25 casos**.

| Congela |
|---|
| Todo destino del mapa existe como métrica del brief |
| Blanco, espacios y basura son `null`, **no** cero; el 0 de verdad sí es 0 |
| «12,5» se entiende |
| Un espacio guardado **no** produce un cambio a cero |
| Con un solo punto no se inventa un delta |
| La ventana recorta de verdad; lo del futuro no entra |
| Tomas desordenadas se ordenan por cuándo se **midió** |
| Del dato guardado a la frase del charter, sin retoques a mano |
| Un valor **repetido** no es un evento de la línea |
| La primera lectura tampoco: no hay contra qué compararla |

## Dato faltante

`conUnSoloPunto` y `clavesSinMetrica` son huecos **declarados**: la pantalla los
dice con sus palabras en lugar de mostrar una sección vacía, que se leería como
«no pasó nada».

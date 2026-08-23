# Contrato SLO / SLI — Ausculta Consultorio

**Carril:** #310. **Estándar:** #320 Gate 3.
**Estado de todo lo que hay debajo: `TARGET`. Nada está `OBSERVED`.**

---

## La regla que ordena este documento

Cada indicador aparece **dos veces**: una como objetivo y otra como medición. Hoy la
segunda columna está vacía en todas las filas, y eso es información, no un hueco por
llenar antes de enseñar el documento.

- **TARGET** — el número que queremos. Se propone aquí y **no está aprobado**.
- **OBSERVED** — lo que se midió, con SHA exacto del candidato, escenario, semilla y
  entorno. Vacío significa **no medido**, que es distinto de «cero» y distinto de «bien».

Un TARGET presentado como capacidad demostrada es la falta más cara de este carril, porque
no rompe ninguna prueba y acaba en una promesa comercial. #310 lo prohíbe con todas las
letras: los umbrales «deben derivarse de evidencia de línea base medida, no inventarse como
criterio de aprobado».

**Ningún TARGET de este documento puede convertirse en criterio de aprobado sin que el
dueño lo apruebe explícitamente sobre evidencia medida.**

---

## 1. Disponibilidad y durabilidad

| Indicador | Cómo se mide | TARGET propuesto | OBSERVED |
|---|---|---|---|
| Disponibilidad de la consulta | fracción de aperturas de encuentro que llegan a pantalla utilizable | 99,9 % mensual | — |
| Durabilidad del guardado | notas con al menos un punto durable escrito / notas abiertas | 100 % (invariante, no porcentaje) | — |
| Éxito del autoguardado | autoguardados con acuse durable / autoguardados intentados | ≥ 99,5 % | — |
| Éxito de la recuperación | borradores recuperados tras recarga/caída / borradores que existían | 100 % (invariante) | — |
| Tasa de pantalla blanca | sesiones con pantalla sin contenido ni mensaje / sesiones | 0 (bloqueador incondicional) | — |

Las tres filas marcadas «invariante» **no son porcentajes**: una sola pérdida de borrador es
un bloqueador de lanzamiento, no una desviación de presupuesto de error. Ponerles un 99,9 %
sería declarar que perder una nota de cada mil es aceptable.

## 2. Latencia interactiva

Se mide **por operación**, nunca agregada: promediar la apertura de un paciente con la firma
de una nota esconde justo lo que duele (`src/lib/observabilidad/latencias.ts` ya explica por
qué percentiles y no promedio).

| Operación | p50 | p95 | p99 | OBSERVED |
|---|---|---|---|---|
| `hot:abrir-paciente` | 400 ms | 1 200 ms | 2 500 ms | — |
| `hot:abrir-encuentro` | 400 ms | 1 200 ms | 2 500 ms | — |
| `hot:buscar-paciente` | 250 ms | 800 ms | 1 500 ms | — |
| `hot:guardar-borrador` | 300 ms | 1 000 ms | 2 500 ms | — |
| `hot:reanudar-borrador` | 400 ms | 1 200 ms | 2 500 ms | — |
| `hot:editar-nota` (tecla → pintado) | 16 ms | 50 ms | 100 ms | — |
| `hot:agendar-cita` | 500 ms | 1 500 ms | 3 000 ms | — |
| `hot:firmar-nota` | 800 ms | 2 500 ms | 5 000 ms | — |

Los presupuestos de diseño equivalentes viven en `src/lib/reliability/clases-de-trabajo.ts`
y son **techos de arquitectura**, no estos SLO. Cruzar el techo es un defecto de diseño;
cruzar el SLO es consumo de presupuesto de error.

## 3. Errores y reintentos

| Indicador | TARGET propuesto | OBSERVED |
|---|---|---|
| Tasa de error de API en camino caliente | ≤ 0,5 % | — |
| Tasa de reintento (fracción de peticiones que reintentan) | ≤ 2 % | — |
| Conflictos de idempotencia (misma llave, cuerpo distinto) | 0 | — |
| Citas duplicadas | 0 (bloqueador incondicional) | — |
| Encuentros duplicados | 0 (bloqueador incondicional) | — |
| Fugas entre consultorios | 0 (bloqueador incondicional) | — |
| Lecturas de colección sin acotar en camino caliente | 0 | **hoy ≥ 3** — ver `HOT-PATH-INVENTORY.md` P0-1, P0-2, P1-1 |

La última fila es la única con dato: es un conteo estático del repositorio, no una medición
en ejecución, y por eso se declara como tal.

## 4. Voz y captura

| Indicador | TARGET propuesto | OBSERVED |
|---|---|---|
| Paradas de grabación inesperadas | ≤ 0,1 % de las consultas | — |
| Fragmentos de transcripción perdidos | 0 (el audio local es la red debajo) | — |
| Tiempo hasta nota utilizable | p50 ≤ 3 min tras cerrar la captura | — |

## 5. Trabajo asíncrono y contrapresión

| Indicador | TARGET propuesto | OBSERVED |
|---|---|---|
| Profundidad de cola (transcripción) | p95 ≤ 60 s de trabajo pendiente | — |
| Profundidad de cola (razonamiento) | p95 ≤ 120 s | — |
| Espera en cola antes del primer intento | p95 ≤ 30 s | — |
| Trabajos en carta muerta | ≤ 0,1 %, **siempre visibles** | — |
| Tasa de timeout de proveedor | ≤ 1 % | — |
| Fallo silencioso de proveedor | 0 (bloqueador incondicional) | — |

«Visible» no es negociable: un trabajo que agota su presupuesto y desaparece es peor que uno
que falla, porque nadie sabe que faltaba.

## 6. Presupuesto de error

Con 99,9 % mensual, el presupuesto es **43 minutos al mes**. La política propuesta —también
sin aprobar— es la habitual: consumido más de la mitad, se congela lo que no sea reparación
de fiabilidad; agotado, se congela todo lo demás.

Los bloqueadores incondicionales **no consumen presupuesto: lo anulan**. Un borrador perdido
no se compensa con un mes bueno.

---

## Cómo se llena la columna OBSERVED

1. Se congela un candidato y se anota su SHA de 40 caracteres.
2. Se corre el arnés contra un objetivo REAL:
   `node scripts/load/run-consultorio-load.mjs --driver=http …`
   El controlador `http` **no está implementado**: hoy no existe un entorno dimensionado
   donde apuntarlo que no sea producción. Ver [`CAPACITY-REPORT.md`](CAPACITY-REPORT.md).
3. La evidencia se valida con `scripts/product/validate-consultorio-load-result.mjs` (PR
   #340) y se guarda atada a ese SHA.
4. El dueño aprueba —o no— convertir el TARGET en criterio de aprobado.

Mientras el paso 2 no exista, **toda la columna OBSERVED se queda vacía**. Rellenarla con
números del controlador simulado sería exactamente lo que este documento existe para
impedir: el arnés simulado mide el modelo, no el producto, y su propia salida lo declara
en el campo `evidenceClass`.

# Preguntas abiertas — 29 jul 2026

Sólo lo que **hoy** bloquea código y no puedo decidir yo. Cada una tiene un
default seguro que ya está aplicado, así que **el programa no se detiene**
esperando: si no contestas, se queda en el estado conservador.

---

## ✅ Q-A — RESUELTA el 29-jul-2026

Contestada dos veces, y la segunda amplió la primera:

1. **Enmienda A3-bis:** se corrige SIEMPRE, sin ventana de tiempo, conservando
   historial. Implementado y desplegado en v707 (el botón de la ficha ya corrige
   en vez de intentar borrar).
2. **ICU-Q3** (`DECISIONES-ICU-VOICE-INFUSION-OBSERVATION.md`) resolvió además la
   parte de **cálculo**, que era E0-09/Q1: la observación corregida SÍ entra al
   cálculo si es la versión clínica vigente, con máquina de estados de 6 valores
   y `latest clinically valid observation`, nunca `latest database row`.

**Requisito nuevo descubierto al implementarla:** la corrección debe heredar la
**hora efectiva** del original (C2 de ese documento). Sin eso, «el NEWS2
retrospectivo de las 08:00 usa 92» no es computable.

<details><summary>Planteamiento original</summary>

## Q-A · Signos vitales append-only: ¿aplica sin estado «firmado»?

**Bloquea:** E0-09 (registro hospitalario append-only) — un parche de 3 líneas en
`firestore.rules:246-248` que ya está escrito y sin aplicar.

**El contexto.** Tu documento de arquitectura, §A3, lista **«signos vitales»**
entre los datos append-only. Eso es claro. Pero la misma sección condiciona la
regla a dato **«FINALIZADO / FIRMADO»**, y un registro de signos vitales no tiene
estado borrador/firmado: se captura y ya está.

**La pregunta, en una línea:** ¿un signo vital queda inmutable **desde que se
captura**, o hay una ventana para corregir un dedazo?

| Opción | Qué pasa en la práctica |
|---|---|
| **(a)** Inmutable desde la captura ⭐ | La enfermera teclea 180 en vez de 80 → **no** puede editarlo. Tiene que capturar un registro nuevo y el 180 queda visible para siempre en el histórico. Es lo más defendible legalmente y lo más incómodo de usar. |
| **(b)** Ventana corta de corrección (p. ej. 15 min, mismo autor) | Se puede arreglar el dedazo recién hecho. Después de la ventana, inmutable. Cada corrección queda registrada con quién y cuándo. |
| **(c)** Editable siempre, con historial | Lo de hoy. **No** cumple §A3. |

**Default aplicado mientras no contestes:** ninguno — la regla sigue como está (c),
porque cambiarla afecta a producción y §5 de la carta operativa me prohíbe
ejecutar a ciegas un cambio con riesgo de regresión visible.

**Tu respuesta:** ver arriba.

</details>

---

## Q-B · `ClinicalQuantity`: la marca fantasma indexa por dimensión, no por unidad

**Bloquea:** E0-05. **No** es pregunta clínica — es un hueco de tipos que te reporto
porque tiene consecuencia clínica si no se cierra.

**Qué encontró la verificación adversarial.** E0-04 sobrevivió a la refutación: el
compilador **sí** rechaza sumar mg con mL. Pero la marca de tipo distingue
*dimensiones* (masa, volumen), no *unidades*. Así que esto **compila**:

```ts
{ ...mg(500), unidad: 'µg' }   // 500 µg presentados como si fueran 500 mg
```

Un error de escala de **1000×**, silencioso, dentro del tipo que existe
precisamente para impedirlo.

**Por qué no es urgente hoy:** `ClinicalQuantity` todavía no tiene consumidores en
producción. Cero código real puede caer en esto ahora mismo.

**Por qué es obligatorio cerrarlo antes de que los tenga:** tu §A1 pide
`unitCode` UCUM, no sólo dimensión. La corrección es exactamente eso — indexar la
marca por `unitCode`, no por dimensión.

**Esto no necesita decisión tuya.** Lo cierro en E0-05 salvo que me digas otra cosa.
Lo dejo escrito para que no se pierda si se cortan los créditos.

---

## Lo que sigue esperándote fuera del código

Sin cambios respecto a lo ya registrado — ninguno bloquea programar, todos bloquean
**publicar**:

| Pendiente | Estado seguro |
|---|---|
| Protección de rama en GitHub (~5 min de consola) | El gate de seguridad clínica **avisa, no bloquea**. Un PR que rompe un invariante hoy se puede mergear. |
| Licencia CLSI M100 Ed36 | Antibiograma local `DISABLED` |
| Formulario del hospital | `UNCONFIGURED` |
| Segundo aprobador | `PENDING_ASSIGNMENT` |
| Abogado + entidad legal | `PENDING_REGULATORY_REVIEW` |

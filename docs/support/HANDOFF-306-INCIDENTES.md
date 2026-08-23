# Handoff a #306 — dónde se enchufa el núcleo de incidentes

Este carril (#315) **no toca la interfaz del producto**. Lo que sigue son los
puntos de inserción exactos, con archivo y símbolo, para que el carril que sí es
dueño de esas pantallas los cablee cuando le toque.

Regla de este documento: **cada punto dice qué función llamar y con qué**, no
«habría que instrumentar la consulta». Un handoff que no se puede ejecutar sin
volver a investigar no es un handoff.

---

## H-1 · El recolector: de un `catch` a un `EventoIncidente` — **P1**

Hoy el núcleo sabe decidir y nadie le mete eventos. Falta la función que un
`catch` pueda llamar sin pensar.

**Qué llamar:** construir un `EventoIncidente` (`src/lib/incidents/taxonomia.ts`)
y firmarlo con `firmaDe()`. Los campos son cerrados y todos obligatorios menos
los opcionales declarados.

**Cuidado con dos cosas, y sólo dos:**

1. `ruta` va como **plantilla**. Si se pasa la ruta real, `plantillaDeRuta()` la
   normaliza, pero es mejor pasarla ya normalizada desde el componente.
2. `feature` y `subtipo` son **etiquetas**, no frases. `firmaDe()` **lanza** si
   se le pasa texto libre — a propósito: una firma degradada dejaría pasar PHI
   sin que quien la recibe pueda saberlo.

**Envolver siempre en `conTelemetriaQueFallaAbierta()`**
(`src/lib/incidents/telemetria.ts`). Anotar un incidente no puede tumbar la
operación que lo sufrió.

## H-2 · Autoguardado de la consulta — **P1**

**Archivo:** `src/app/(dashboard)/consulta/[patientId]/page.tsx`
**Símbolo:** `guardarBorrador`, en la rama de `catch` donde ya vive
`fallosGuardadoRef.current += 1`.

El aviso al médico **ya está bien** y no hay que tocarlo: al tercer fallo seguido
dice «La nota NO se está guardando en el servidor… no cierres la pestaña». Lo que
falta es que ese tercer fallo **salga de la pestaña**.

```
categoria: 'autosave'
subtipo:   'guardado_fallido'
feature:   'nota'
ruta:      '/consulta/[id]'
codigoNormalizado: el `codigo` que ya calcula ese catch, normalizado a etiqueta
```

**Por qué importa:** si el autoguardado falla a la vez en cincuenta consultorios,
hoy cada médico lo ve y la plataforma no lo sabe. Es la avería más cara del
producto —la que amenaza el trabajo dictado— y es la única invisible desde fuera.
Ver R-06 en [`RIESGOS-315.json`](RIESGOS-315.json).

**Lo que la interfaz ya puede pedirle al núcleo:** `estadoParaElMedico()` con
categoría `autosave` devuelve `visibilidad: 'bloqueante'` e
`interrumpeConsulta: true` — la ÚNICA categoría con ese trato de fábrica, y por
eso mismo no hay que decidirlo otra vez en la pantalla.

## H-3 · El rastreo de errores del cliente — **P1**

**Archivos:** `src/lib/reportar-error.ts` y `src/app/api/errores/route.ts`.

La deduplicación de hoy vive en un `Set` en memoria del navegador: se vacía al
recargar y al pasar de 50. Veinte médicos con el mismo fallo son veinte reportes.

**Qué cambiar:** que `api/errores` firme el reporte con `firmaDe()` (categoría
`browser_runtime` o `ui`) y agrupe con `agrupar()` / `fusionar()`. El núcleo ya
está probado con 1000 repeticiones → un grupo.

**Y que el descarte por freno se CUENTE** (R-04): hoy un reporte tirado por el
límite de 5/hora/IP devuelve `{ok:true}` y desaparece. El punto ciego coincide
con la caída más grave — un consultorio entero sale por una sola IP.

## H-4 · Frenos por panel en el escritorio de consulta — **P2**

Confirmado independientemente y **ya reportado** por el carril de escala como N-3
en `docs/reliability/NO-WHITE-SCREEN-INVENTORY.md`. No se duplica el inventario.

Lo que #315 añade: cuando exista el `ErrorBoundary` por panel,
`estadoParaElMedico({ categoria: 'ui', … })` da el texto y la visibilidad
(`discreto`, no `franja`) sin que la pantalla tenga que decidirlo.

## H-5 · Rutas de cara al paciente sin `error.tsx` — **P1**

`src/app/mi/`, `src/app/reservar/`, `src/app/teleconsulta/`. Confirmado
independientemente; **ya reportado** por el carril de escala como N-1, con los
tres archivos exactos. No se duplica.

`/reservar/[clinicId]` es el autoagendado — Golden Path A de #320/#321.

## H-6 · La consola de soporte — **P2**

**Contrato listo:** `proyectarParaSoporte()` en
`src/lib/incidents/consola-soporte.ts`, con un ejemplo real y auditado en
[`consola-soporte-fixture.json`](consola-soporte-fixture.json).

**Lo único innegociable al construirla:** la vista se **construye** campo a
campo, no se filtra. Filtrar es quitar de un objeto lo que no debe salir, y esa
lista se queda corta el día que alguien añade un campo. `auditarVista()` es el
guardián, no la defensa.

## H-7 · El vigilante tiene que mirar los incidentes — **P1**

**Archivo:** `src/app/api/cron/vigilante/route.ts`. **No es de #306**, es de este
carril, y queda pendiente porque tocarlo sin el recolector (H-1) sería vigilar
una colección que casi nadie escribe.

Hoy el vigilante mira latidos de crons y saldo de proveedores, y alerta bien. **No
mira `platform_incidentes` ni `errores`.** Falta el paso que lea la última
ventana, la evalúe con `evaluarUmbral()` y alerte por lo que cruce la raya.

Ver R-01. Y ojo con R-02: sin `OPS_ALERTA_WEBHOOK` configurado, la alerta no
llega a nadie — eso **exige una decisión del dueño** (elegir destino).

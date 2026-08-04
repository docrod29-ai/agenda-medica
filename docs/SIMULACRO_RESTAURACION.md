# Simulacro de restauración

> **Un respaldo que nunca se restauró es una hipótesis, no un respaldo.**
>
> Esto es lo que cierra el P0-6 de la auditoría. No era «no hay respaldos»: era
> que nadie los había probado nunca, así que nadie sabía si funcionaban, cuánto
> tardaban ni qué se perdía por el camino. Todo eso se descubre el peor día
> posible, o se descubre hoy en un ensayo.

---

## Lo primero: la regla que no se rompe

**La restauración NUNCA se hace encima de la base de producción.**

Firestore restaura *creando una base nueva*. Ese es el comportamiento que hace
seguro este ensayo, y es también la razón por la que hay que teclearlo bien: un
nombre de base equivocado es la única forma de convertir un simulacro en un
incidente.

En todo este documento la base de ensayo se llama `ensayo-restauracion`. Si en
algún comando lees `(default)` como destino, **párate**: ese comando está mal.

---

## Antes de empezar (5 minutos)

```bash
npm run respaldos:verificar
```

Responde tres cosas que hasta ahora nadie podía responder: si la recuperación a
un punto en el tiempo está encendida, si hay respaldos programados, y **de
cuándo es el último respaldo real**. Los tres tienen que salir en verde antes de
ensayar nada: no tiene sentido practicar una restauración de algo que no existe.

Guarda esa salida. Es la primera evidencia.

---

## El ensayo

### 1. Elige el punto al que vas a volver

```bash
gcloud firestore backups list --project=TU_PROJECT_ID
```

Apunta el `name` completo del respaldo más reciente.

### 2. Restaura a una base NUEVA

```bash
gcloud firestore databases restore \
  --source-backup=EL_NAME_QUE_APUNTASTE \
  --destination-database=ensayo-restauracion \
  --project=TU_PROJECT_ID
```

Arranca el cronómetro aquí. **Cuánto tarda es parte de lo que se está midiendo**:
si un día pasa de verdad, esa cifra es el tiempo que tu consultorio está sin
expediente, y conviene saberla antes de tener que explicarla.

### 3. Comprueba que lo restaurado sirve

No basta con que el comando termine bien. Hay que abrir la base y mirar:

```bash
gcloud firestore databases describe \
  --database=ensayo-restauracion --project=TU_PROJECT_ID
```

Y en la consola de Firebase, con la base `ensayo-restauracion` seleccionada,
comprobar **cinco cosas concretas** —no «se ve bien»—:

- [ ] Existe la colección `clinics` y tu consultorio está dentro
- [ ] Un paciente que sabías que existía, sigue ahí
- [ ] Una nota firmada conserva su texto y su firma
- [ ] Las citas de la semana anterior al respaldo están completas
- [ ] `platform_cost_ledger` tiene asientos (o sea: se restauró todo, no sólo lo clínico)

### 4. Anota lo que se perdió

Entre el momento del respaldo y el del incidente hay un hueco. Con la
recuperación a un punto en el tiempo ese hueco es de minutos; con un respaldo
diario puede ser de casi 24 horas.

**Escribe la cifra.** Es la respuesta a «¿cuánto puedo llegar a perder?», y esa
pregunta se la va a hacer cualquiera que audite esto — y tú mismo, alguna noche.

### 5. Borra la base de ensayo

```bash
gcloud firestore databases delete \
  --database=ensayo-restauracion --project=TU_PROJECT_ID
```

Una base de ensayo olvidada cuesta dinero todos los meses y, peor, algún día
alguien la confunde con la buena.

---

## Deja la evidencia

Copia esta plantilla al final de este archivo, rellena y haz commit. **Eso es lo
que faltaba**: no el procedimiento, sino la constancia de haberlo hecho.

```
### Simulacro del AAAA-MM-DD

- Respaldo usado: ..............  (fecha del snapshot: .........)
- Tardó: ....... minutos
- Las 5 comprobaciones: ✅ / ❌ (cuál falló: ..........)
- Ventana de pérdida medida: ....... horas
- Base de ensayo borrada: sí / no
- Sorpresas: ..........................................
```

**Cada 6 meses**, o después de cualquier cambio grande en la estructura de datos.
Un simulacro de hace dos años y ninguno son casi lo mismo.

---

## Qué hacer si un día pasa de verdad

1. **No borres nada más.** El primer instinto —«deshacer»— suele empeorarlo.
2. **Apunta la hora exacta** en que empezó el problema. La recuperación a un
   punto en el tiempo necesita ese dato y no lo puedes reconstruir después.
3. **Restaura a una base nueva**, igual que en el ensayo. Nunca encima.
4. **Comprueba antes de cambiar el interruptor.** Las mismas cinco
   comprobaciones. Servir una base a medio restaurar es peor que estar caído: la
   gente empieza a escribir encima de un estado incompleto.
5. **Después, cambia la aplicación a la base nueva** — y sólo entonces.

---

## Historial de simulacros

### Lo que se puede ensayar sin consola, y lo que no

El ensayo de arriba —el de `gcloud`— necesita la consola y hay que cronometrarlo
a mano. **La otra mitad sí se puede correr ahora mismo, cuantas veces haga
falta**, y es la que depende de nuestro código:

```bash
npm run simulacro:respaldo
```

Toma un respaldo NDJSON —sintético por defecto, o el real si se le pasa la ruta—,
lo corre entero por el camino de vuelta con **las mismas funciones que usa la
importación**, y mide cuánto tarda. Sale con código distinto de cero si no está
limpio, para que pueda vigilarlo algo automático y no sólo una persona leyendo.

### Ensayo de ida y vuelta del 2026-08-04

- Documentos en el respaldo: **200001** (200000 restaurables, 1 excluidos por política)
- Tardó: **161 ms** — 1,239,038 documentos/segundo
- Cabecera y pie: ✅ / ✅
- Líneas rechazadas: 0
- Por colección: patients: 80000, appointments: 40000, cobros: 40000, audit_log: 40000
- Veredicto: ✅ el respaldo vuelve entero

> **Qué NO mide esto:** el tiempo de `gcloud firestore databases restore`,
> que es de Google y hay que cronometrarlo en el ensayo con consola. Éste
> mide nuestra mitad: que el archivo vuelve a leerse entero y cuánto tarda.

### El ensayo con consola

*(Pendiente: necesita `gcloud` y el proyecto de Firebase. Es lo único de esta
página que no se puede automatizar desde el repositorio, y es lo que falta para
cerrar el P0-6 del todo.)*

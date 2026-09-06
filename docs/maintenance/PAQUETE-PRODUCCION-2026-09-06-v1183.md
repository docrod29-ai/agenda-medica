# Paquete de producción — `nexusmed-v1183`

> **SUPERADO — 6-sep-2026. PUBLICADO Y VERIFICADO.** El botón corrió sobre
> `182d8c78`: ejecución [#23](https://github.com/docrod29-ai/agenda-medica/actions/runs/34004090694), en verde, con la
> Compuerta 3 midiendo `nexusmed-v1183` contra el sitio vivo. Lo escrito debajo no se
> reescribe: era verdad cuando se escribió. Cierre asentado el 6-sep-2026 en el ciclo de
> v1184 (REG-435: un acta de una versión ya publicada no puede seguir diciendo que no
> se publicó). Esta acta nació sin la línea «Estado: PREPARADO, NO PUBLICADO» que
> llevan las demás —la escribió otra sesión, antes de correr el botón—; se deja dicho
> aquí, no se le inventa arriba.

**Fecha:** 6-sep-2026 · **Autoriza:** el dueño («sigue y desplegando y subiendo a
producción, no quiero atascadero»).

## 0. Qué es este paquete, en una frase

**Las cuatro cosas que el dueño encontró usando la app en su propio iPhone**, más
la auditoría de lo que aquellas cuatro dejaron declarado sin mirar.

Es el primer paquete de esta sesión que sale de **uso real en un aparato real**,
no de leer código. Las cuatro las encontró él en diez minutos; ninguna la había
cazado el arnés, que corre en Chromium a 390 px.

## 1. La fila que importa: la receta

**REG-515** es de seguridad clínica y es la segunda vez que el dueño reporta lo
mismo. La primera creó `que-va-en-la-receta.ts`. Esta vez ese módulo **ya existía
y ya estaba conectado** — la regla corría y aun así se colaban antecedentes al
papel.

Lo que faltaba: el filtro sólo apartaba lo etiquetado `ya_lo_toma`, así que **la
única palabra sobre si algo se receta era la etiqueta que el propio modelo se
pone**. Y el dato que podía contradecirla —quién dijo la frase— se borraba en la
frontera del esquema.

Ahora manda la atribución: un antecedente lo dice el paciente, un plan lo dice el
médico. Lo que trae atribución y no es del médico no baja al papel.

## 2. Qué entra, en una frase por bloque

| | |
|---|---|
| **REG-515** | La receta ya no imprime lo que dijo el paciente. `speaker` cruza la frontera del esquema y decide. |
| **REG-516** | Un código CIE-10 sin diagnóstico ya no sale impreso. La regla deja de estar duplicada en dos pantallas. |
| **REG-517** | El diálogo de firmar deja de esconder sus botones en un iPhone, y deja de ser un muro de veintiún avisos. |
| **REG-518** | Tres diálogos más con la misma herida, un patrón compartido para los cuatro, y un guardián para el quinto. |
| **D-032** | La caja ámbar de palabras dudosas se retira de la consulta. Sólo la caja: el marcado sigue corriendo. |

## 3. Lo que este paquete NO afirma

- **No se probó en un iPhone.** Las cinco reparaciones se verifican con pruebas
  de FUENTE; que en el aparato se vean los botones lo dice el teléfono. El
  arnés corre en Node y en Chromium.
- **No se auditaron los paneles anclados** que no son modales (menús, tooltips).
- **No se tocaron las varias casillas de diagnóstico** de la pantalla de
  consulta, que es donde el dueño las ve. Trabajo aparte, declarado.
- **No se decidió ninguna cifra clínica.** El bloque D sigue abierto entero.
- La conversión de descripción a partir de un código CIE-10 **no se hace**: haría
  falta un catálogo citado, y rellenarlo sería inventar un diagnóstico.

## 4. Orden de publicación

1. Este PR (#457): las cuatro reparaciones, el service worker a v1183 y esta acta.
2. Un segundo PR repunta `SHA_AUTORIZADO` al `main` resultante. Va aparte porque
   la Compuerta 0 compara el pin contra la cabeza de `main`, y un pin que apunta
   a un árbol que aún no existe no se puede escribir.
3. El botón. Publica reglas, verifica la versión contra el sitio vivo y corre la
   comprobación de cabeceras de producción.

---

## 5. Lo que pasó de verdad

Se publicó el 6-sep-2026. Los tres pasos salieron en orden y ninguno se repitió.

| Paso | Qué fue | Resultado |
|---|---|---|
| 1 | PR #457 — las cuatro reparaciones, el SW a v1183 y esta acta | fusionado, 5 checks en verde |
| — | Vercel publicó `main` (`078664fe`) por su integración de git | producción pasa a servir `nexusmed-v1183` |
| 2 | PR #460 — `SHA_AUTORIZADO` repuntado a `078664fe` | fusionado, 5 checks en verde |
| 3 | Workflow «Despliegue a producción (manual)», ejecución **#23** | `PRODUCTION_RELEASE=SUCCESS` |

Acta que emitió la ejecución #23:

```
APP_SHA=078664fee86b23f75e9fd45b3390e710ca459e91
VERSION=nexusmed-v1183
FIRESTORE_RULES=success
FIRESTORE_INDICES=success
FIRESTORE_RULES_SHA256=1d91d7077e616e2a600a0f0526d79c46b85d5ffe9d7d5bffd0d8b157923d2df7
SECURITY_E2E=success
SMOKE=success
SMOKE_PORTAL=success
PRODUCTION_RELEASE=SUCCESS
```

<https://github.com/docrod29-ai/agenda-medica/actions/runs/34004090694>

### El hash de las reglas NO se movió, y eso es lo correcto

`v1183` son reparaciones de la receta, del diagnóstico impreso y de los diálogos:
**ninguna toca `firestore.rules`**. La ejecución #23 republicó las mismas reglas
—un no-op del lado de Firebase— y sirve para dejar constancia de que lo que rige
hoy es lo que el árbol dice. El sha256 del árbol local se comprobó contra el
valor que emitió el workflow en vez de darse por bueno.

### Lo que esta ejecución NO demuestra

- **Que en un iPhone se vean los botones.** Las cinco reparaciones se verifican
  con pruebas de FUENTE; el aparato es el único que puede decirlo, y el arnés no
  corre en uno. Éste es el paquete que MÁS necesita esa comprobación, porque las
  cuatro quejas salieron de ahí.
- **Que los índices estén construidos.** `deploy --only firestore:indexes`
  contesta al enviar, no al terminar.
- **Que el service worker viejo se haya retirado.** Sube la versión del caché; la
  retirada ocurre cuando cada cliente recarga. Para probar en el teléfono hay que
  cerrar Safari del todo y volver a abrir.
- **Nada del bloque D.** Ninguna cifra clínica se decidió; sigue abierto entero.

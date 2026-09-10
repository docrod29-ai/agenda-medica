# Bitácora · 10-sep-2026 (tarde) — los pendientes que Codex dejó declarados

Contexto: v1195 en producción (PR #478 rematado y publicado, run #34). El dueño
preguntó por los tres pendientes del checkpoint de Codex y pidió arreglarlos y
definirlos. Aquí está qué se hizo con cada uno, qué se probó y qué le toca a él.

## 1 · «Posible mezcla de pacientes sin secuencia identificada»

**Qué era.** Codex sospechaba que una respuesta tardía de la IA (estructurar,
corregir) pudiera caer en el expediente de otro paciente si el médico cambiaba
de paciente mientras la petición seguía en vuelo. No tenía secuencia ni prueba.

**Qué se hizo.** Sonda de navegador sobre el arnés con emuladores y datos
sintéticos: `scripts/ausculta-transformacion/respuesta-tardia-cambio-de-paciente.mjs`.

| Corrida | Navega a pac-002 | SENTINEL en pantalla | SENTINEL en Firestore pac-002 | SENTINEL en Firestore pac-001 |
|---|---|---|---|---|
| Control positivo | no | **sí** | no | **sí** (autoguardado a los 30 s) |
| Caso | sí, a los ~0,6 s; la respuesta llega a los 7,1 s | **no** | **no** | no |

El control positivo demuestra que la sonda detecta lo que busca (sin él, un
«no aparece» no vale nada). En el caso, la pantalla de consulta se desmonta al
cambiar de paciente —el segmento dinámico `[patientId]` cambia de clave en el
App Router— y el `setState` de la instancia vieja ya no llega a nadie.

**Veredicto.** No hay mezcla por esta vía. **Residual declarado:** la
corrección que el médico pidió se PIERDE en silencio si se va antes de que
llegue (ni pac-001 la recibe). Es pérdida, no mezcla; queda anotado en la sonda
y en `docs/clinical-safety/REGISTRO-DE-PELIGROS.md`.

**Qué NO cubre.** Cambiar de NOTA del mismo paciente por `?nota=` (los
parámetros de búsqueda no desmontan) — ahí la guardia es `firmadaRef`, porque
la nota que se reabre está firmada. No se probó la estructuración en vivo
mientras se graba y se navega: la grabación vive en la misma pantalla y se
corta al salir.

## 2 · Decisiones de agenda, portal y roles del 9-sep

Auditadas las ocho contra el código (agente Explore, muy exhaustivo) y luego
resueltas una por una:

| Decisión | Estado antes | Hoy |
|---|---|---|
| A · duración por tipo, ajustable por cita | ya existía | sin cambios |
| B · consecutivas, sin huecos obligatorios | ya existía (`intervaloMinutos` retirado) | sin cambios; queda un fósil en `agenda/prompts.ts` («buffer_minimo_respetado»), sin motor detrás |
| C · confirmación directa o manual por médico | **faltaba** | **D-054**: `confirmacionDeCitas` por consultorio (Configuración → Portal) con override por médico; un solo módulo decide y lo llaman portal público, bot y lista de espera. «Por sede» pendiente: no hay sede |
| D · cancelar/reagendar hasta 12 h; después, solicitar | parcial (sólo el «no») | **D-055**: `cambioEnLinea` por cita, acción `solicitar-cambio`, tarea de recepción colgada de la cita, pantalla que ofrece pedir el cambio |
| E · lista de espera: avisar a todos, el primero gana | parcial (`LIMITE_NOTIFICAR = 3`) | **D-053**: se avisa a todos los compatibles; la reserva atómica ya existía |
| F · portal: documentos, subir estudios, preconsulta, mensajes | parcial (falta subir estudios) | **D-058 definida**, no implementada: exige `storage.rules` nuevas (despliegue del dueño) y tres respuestas suyas |
| G · admin → recepción; clínico → médico | parcial (lo admin no llegaba a nadie) | **D-056**: tarea `area: 'recepcion'`, prioridad normal, escalada, aviso al consultorio; `/pendientes` la etiqueta «Recepción» |
| H · cada médico ve sus pacientes; compartir con autorización | **faltaba** | **D-057 definida**, no implementada: toca reglas, matriz, respaldo, listas y migración; cuatro preguntas al dueño |

Pruebas nuevas: `quien-confirma-la-cita-que-pide-el-paciente` (D-054, con
guardián de fuente y autotest), `la-lista-de-espera-avisa-a-todos-los-compatibles`
(D-053, probada al revés: con el `break` cuenta 3 y no 5),
`lo-administrativo-va-a-recepcion` (D-055/D-056). Invertido a propósito el caso 3
de `la-pregunta-escalada-llega-al-worklist` (afirmaba que lo administrativo no
abría tarea).

## 3 · «Objetivo de carga no medido»

No es tiempo de carga de la pantalla: es **capacidad** — 100 000 cuentas
registradas y 100 000 usuarios activos simultáneos, las dos confirmadas por el
dueño («Las dos»). El contrato del ensayo ya está escrito
(`docs/maintenance/AUSCULTA-2026-09-09.md`, «Contrato del ensayo adicional»).

Lo que este contenedor **no puede** hacer: generar esa carga (el arnés local
está acotado a 400 sesiones), apuntarla a producción (prohibido sin
autorización y además es la base viva), ni contratar la infraestructura de
ensayo. Lo que sí hay: modelo de concurrencia, generador sintético y validador
del JSON de carga.

**Lo que hace falta del dueño, en este orden:**

1. Un **proyecto de Firebase de ensayo** aparte (no `nexomed-agenda`) y un
   despliegue de Vercel apuntando a él — o autorización explícita para crear
   ambos con su cuenta.
2. **Presupuesto** para los generadores distribuidos y para el consumo de
   Firestore/Vercel durante el ensayo (lecturas, escrituras, funciones). Sin
   cifra no se puede dimensionar.
3. La **mezcla de roles** (cuántos médicos dictando, cuántas recepciones,
   cuántos pacientes en el portal) y la **duración** del pico. El documento
   propone valores; los tiene que confirmar él.
4. Verificar el **plan de Vercel** (la integración devolvió 403 al consultar la
   configuración): cuotas de funciones y ancho de banda.

Con eso se puede ejecutar y entregar el informe con commit, región, reglas,
índices y métricas. Sin eso, «100 k» sigue siendo un objetivo, no una medida.

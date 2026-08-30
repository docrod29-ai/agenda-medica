# AUSCULTA — PRODUCT EXCELLENCE / VISUAL & INTERACTION EXCELLENCE LOOP

> **Fuente**: pegado por el dueño (Dr. David Alonso Rodríguez Luna) el
> **30-ago-2026**, literal y completo. Hasta esa fecha este pliego sólo existía
> dentro de conversaciones de chat: los carriles lo citaban por sección (§29,
> §38) y **nadie podía comprobar qué decía**, porque no estaba en ningún
> archivo. Se guarda aquí para que eso no vuelva a pasar.
>
> **Regla**: no se resume, no se reescribe, no se "mejora". Si algo del
> repositorio lo contradice, **gana este pliego** — salvo el propio §0, que
> manda que el estado real del repositorio gane a las cifras del pliego.
>
> Carril: **B — Excelencia de producto**. Tablero vivo en
> `docs/design/SCREEN_INVENTORY.md`.

---

MISIÓN

Transformar Ausculta Consultorio en un producto clínico extraordinariamente
claro, rápido, vivo, elegante y reconocible.

NO quiero simplemente “una aplicación médica que funciona”.

Quiero que el producto se sienta diseñado deliberadamente en cada interacción.

El benchmark de calidad debe ser el nivel de refinamiento de los mejores
productos SaaS/AI contemporáneos y, dentro del ámbito clínico, superar la
calidad percibida de Abridge.

NO COPIAR ABRIDGE.

Superarlo donde Ausculta pueda tener ventaja:

clinical workflow
evidence
continuity
patient state
specialist depth
closed-loop work
mobile workflow
information density
clarity
responsiveness.

==================================================
0. CONTINUIDAD — NO REPETIR
==================================================

Trabaja sobre la rama/PR ACTUAL de Product Excellence.

ANTES de modificar:

lee:
- commits actuales;
- matriz de pantallas;
- certificación;
- browser evidence;
- visual regression;
- estados PROVEN / NOT_PROVEN / BLOCKED;
- cambios integrados desde otros carriles.

NO vuelvas a implementar unidades ya PROVEN.

NO reinicies el inventario desde cero.

Si una pantalla ya fue mejorada:
úsala como nuevo baseline.

Si el estado escrito en este prompt contradice el repositorio:
MANDA EL REPOSITORIO ACTUAL.

==================================================
1. PROBLEMA CENTRAL
==================================================

Ausculta no debe sentirse:

estático
aburrido
plano
genérico
como formulario administrativo
como dashboard template
como colección de cards
como CRUD con IA pegada
como prototipo
como “software médico viejo pero blanco”

La aplicación debe sentirse VIVA sin convertirse en espectáculo.

Movimiento con propósito.

Jerarquía con propósito.

Densidad con propósito.

Silencio visual con propósito.

==================================================
2. PRINCIPIO DE DISEÑO
==================================================

La estética NO se arregla simplemente agregando:

gradientes
sombras
border radius
glassmorphism
colores
animaciones
ilustraciones

Eso sería maquillaje.

Cada intervención debe mejorar al menos una de:

orientation
hierarchy
comprehension
continuity
feedback
confidence
task completion
perceived speed
clinical calm
information density
discoverability
product identity

==================================================
3. INVENTARIO REAL DE PANTALLAS
==================================================

Mantener un SCREEN INVENTORY canónico.

Para cada pantalla/journey evaluar:

desktop
390 px
WebKit
hierarchy
density
spacing
typography
motion
microinteraction
feedback
loading
empty
error
success
long-content
keyboard
focus
accessibility
responsive behavior
perceived performance
staticness
card fatigue
visual regression
benchmark quality

Estados:

PROVEN
NOT_PROVEN
BLOCKED_EXTERNAL

No declarar PROVEN sin evidencia suficiente.

==================================================
4. STATICNESS AUDIT
==================================================

Buscar sistemáticamente pantallas que parezcan “capturas de pantalla”.

Preguntar:

¿qué está ocurriendo?
¿qué cambió?
¿qué puede hacer el usuario ahora?
¿qué necesita atención?
¿qué acaba de guardarse?
¿qué está cargando?
¿qué está esperando?
¿qué tiene prioridad?
¿qué está conectado con qué?

Una pantalla completamente inmóvil mientras ocurren procesos detrás
es una oportunidad perdida de comunicación.

Agregar feedback útil cuando corresponda:

progress
skeleton
streaming
status transition
inline confirmation
subtle motion
context preservation
optimistic update
background activity indication

==================================================
5. MOTION SYSTEM
==================================================

Crear un lenguaje de movimiento coherente.

Motion debe explicar:

entrada
salida
continuidad
causalidad
cambio de estado
jerarquía
origen/destino
background work
success
failure

Evitar:

bounce gratuito
animación lenta
parallax decorativo
transiciones largas
elementos flotando sin propósito
animar todo

Preferir movimiento rápido, sobrio y clínicamente calmado.

Respetar:

prefers-reduced-motion.

==================================================
6. MICROINTERACTIONS
==================================================

Revisar:

buttons
toggles
tabs
filters
search
command actions
menus
forms
autosave
copy
send
schedule
prescribe
order
save
review
accept/reject
AI suggestions
Evidence cards
timeline items
notifications

Cada acción importante debe comunicar:

idle
hover cuando corresponda
focus
pressed
loading
success
error
disabled

No permitir botones “muertos” perceptualmente.

==================================================
7. INFORMATION HIERARCHY
==================================================

La jerarquía clínica debe ser inmediata.

En segundos el médico debe distinguir:

paciente
motivo
estado actual
riesgos
alergias
problemas activos
medicamentos
pendientes
acciones críticas
evidence
AI suggestions
timeline

Evitar que todo tenga el mismo peso.

Usar:

typographic hierarchy
spacing
grouping
progressive disclosure
semantic emphasis
density control

antes de recurrir a decoración.

==================================================
8. REDUCIR CARD FATIGUE
==================================================

Auditar uso excesivo de tarjetas.

No envolver cada fragmento de información en un rectángulo.

Usar según contexto:

sections
rows
dividers
timeline
table
inline metadata
command surfaces
progressive disclosure
side panels
sticky contextual regions

Las cards deben significar algo.

==================================================
9. CONSULTA — CLINICAL COMMAND CENTER
==================================================

La consulta es el corazón de Ausculta.

Debe sentirse como un clinical command center, no como un formulario.

El médico debe poder comprender rápidamente:

qué sabe Ausculta;
qué acaba de escuchar;
qué está redactando;
qué falta;
qué cambió;
qué requiere confirmación;
qué evidencia está sustentando algo;
qué pendientes nacieron;
qué acciones puede tomar.

Voice, Clinical Truth, Reasoning, Evidence y acciones clínicas deben sentirse
como partes de un mismo sistema.

NO cinco widgets desconectados.

==================================================
10. AI INTEGRATION
==================================================

La IA NO debe parecer un chatbot añadido al costado.

Debe aparecer contextualmente:

donde existe una decisión;
donde falta información;
donde detectó discrepancia;
donde puede ahorrar trabajo;
donde existe evidencia;
donde necesita confirmación.

Mostrar claramente:

suggestion
confidence/uncertainty cuando sea apropiado
evidence
missing context
action
dismiss/accept/edit

Nunca confundir sugerencia con verdad clínica.

==================================================
11. EVIDENCE EXPERIENCE
==================================================

Evidence debe sentirse como producto central.

Diseñar para lectura rápida:

qué responde;
qué evidencia existe;
qué tan reciente;
qué tipo de fuente;
qué población;
qué tan aplicable al paciente;
qué contradicciones existen;
qué guideline/journal;
qué provenance.

Evitar lista interminable de resultados.

Permitir progressive disclosure.

==================================================
12. AGENDA
==================================================

Agenda debe sentirse viva.

Estados claros:

upcoming
arrived
waiting
in consultation
finished
cancelled
no-show
urgent/add-on

Interacciones rápidas.

Feedback inmediato.

Evitar aspecto de calendario administrativo genérico.

El médico/recepción debe saber de un vistazo:

qué está pasando ahora;
qué sigue;
qué cambió;
dónde existe conflicto;
qué requiere acción.

==================================================
13. EXPEDIENTE / PATIENT OVERVIEW
==================================================

El expediente debe privilegiar comprensión longitudinal.

No mostrar todo a la vez.

Priorizar:

current state
active problems
medications
allergies
recent changes
critical trends
pending work
timeline
relevant history

Usar disclosure progresivo para profundidad histórica.

==================================================
14. LONGITUDINAL TIMELINE
==================================================

La línea temporal debe comunicar cambio.

Distinguir:

consultation
diagnosis
medication change
lab
imaging
procedure
hospitalization
message
follow-up
order/result
clinical milestone

No convertir timeline en feed social.

==================================================
15. LOADING
==================================================

CERO spinner genérico innecesario.

Preferir:

skeleton contextual
progressive rendering
preserved layout
streaming cuando tenga sentido
background refresh
stale-while-revalidate perceptual pattern

Evitar layout shift.

El usuario debe entender qué está ocurriendo.

==================================================
16. EMPTY STATES
==================================================

“No hay datos” no es diseño suficiente.

Cada empty state debe responder:

qué falta;
por qué está vacío;
si es normal;
qué puede hacer el usuario;
qué ocurrirá después.

No llenar de ilustraciones infantiles.

==================================================
17. ERROR STATES
==================================================

Errores deben ser:

claros
accionables
no destructivos
contextuales

Preservar trabajo.

Explicar:

qué falló;
qué NO se perdió;
qué puede reintentarse;
qué necesita intervención.

No mostrar stack traces.
No mostrar errores genéricos si conocemos la causa.

==================================================
18. SUCCESS STATES
==================================================

Confirmar acciones importantes sin molestar.

Ejemplos:

guardado
orden creada
receta preparada
mensaje enviado
resultado revisado
seguimiento cerrado

Usar feedback inline o toast sólo cuando sea apropiado.

==================================================
19. PERCEIVED PERFORMANCE
==================================================

La aplicación debe sentirse rápida incluso cuando una operación tarde.

Auditar:

time to first meaningful paint
input responsiveness
navigation responsiveness
AI streaming latency perception
Evidence retrieval perception
layout shift
blocking overlays
long blank states

No bloquear toda la interfaz por una tarea secundaria.

==================================================
20. MOBILE-FIRST — 390 PX
==================================================

390 px es superficie de primera clase.

No “desktop encogido”.

Revisar:

tap targets
safe areas
sticky actions
bottom navigation
keyboard
visualViewport
long forms
drawers
modals
tables
Evidence
consultation
timeline
agenda
prescription
orders

Nada crítico debe quedar:

fuera de pantalla
detrás del teclado
debajo de un fixed element
inaccesible
imposible de cerrar

==================================================
21. iOS / WEBKIT
==================================================

Validar explícitamente comportamiento tipo iPhone/WebKit.

Especial atención:

100vh/100dvh
keyboard
focus
scroll restoration
sticky
fixed
safe-area-inset
overscroll
nested scrolling
route transitions
back navigation

No declarar mobile PROVEN sólo por Chromium responsive mode cuando WebKit
sea necesario para la afirmación.

==================================================
22. TYPOGRAPHY
==================================================

Construir jerarquía tipográfica deliberada.

Revisar:

display
page title
section heading
body
metadata
clinical labels
numbers
tables
dense UI
monospace/data when appropriate

Evitar tamaños excesivos que desperdicien espacio clínico.

Evitar texto diminuto.

==================================================
23. SPACING / RHYTHM
==================================================

Crear ritmo consistente.

Eliminar:

espacios muertos gigantes
bloques comprimidos
padding arbitrario
márgenes inconsistentes

La densidad médica debe ser alta pero respirable.

==================================================
24. DESIGN TOKENS
==================================================

Centralizar:

spacing
radius
type scale
motion
elevation
surface hierarchy
interactive states
focus
breakpoints

Evitar one-off CSS.

Design debt guard debe permanecer verde.

==================================================
25. PRODUCT IDENTITY
==================================================

Ausculta debe empezar a tener una identidad reconocible.

No mediante branding decorativo.

Mediante:

composición
ritmo
tipografía
motion
clinical surfaces
evidence presentation
AI behavior
timeline language
feedback
information architecture

Quiero que una captura sin logo pueda empezar a sentirse “Ausculta”.

==================================================
26. ACCESSIBILITY
==================================================

Objetivo WCAG 2.2 AA.

Revisar:

contrast
keyboard
focus visibility
semantic HTML
labels
aria cuando corresponda
screen reader order
motion reduction
touch target
error identification

No sacrificar accesibilidad por estética.

==================================================
27. VISUAL REGRESSION
==================================================

Las pantallas críticas necesitan guards visuales cuando el entorno lo permita.

Cubrir:

desktop
390 px
loading
empty
error
long content
important modal/drawer
navigation state

Evitar snapshots inútiles.

Proteger invariantes visuales reales.

==================================================
28. BROWSER WALKTHROUGHS
==================================================

No evaluar producto únicamente leyendo código.

RECORRER EL PRODUCTO.

Usar browser real cuando esté disponible.

Journeys prioritarios:

login
agenda
buscar paciente
abrir expediente
iniciar consulta
documentar
usar Voice
usar AI
consultar Evidence
generar receta
crear orden
volver
navegar a otro módulo
regresar
cerrar consulta
seguimiento

Buscar:

fricción
confusión
pantallas muertas
scroll extraño
feedback ausente
jerarquía débil
componentes inconsistentes
layout shift
mobile breakage

==================================================
29. BENCHMARK CONTRA ABRIDGE
==================================================

Abridge es benchmark de calidad percibida, NO plantilla.

Comparar principios:

clarity
focus
speed
motion
confidence
workflow continuity
AI integration
clinical calm
information hierarchy

Donde Ausculta tenga más funciones, evitar que eso produzca más ruido.

MÁS CAPACIDAD NO DEBE SIGNIFICAR PEOR UX.

Objetivo:

Ausculta debe poder sentirse más profundo clínicamente SIN sentirse más pesado.

==================================================
30. BENCHMARK AMPLIADO
==================================================

Tomar principios de productos excelentes cuando sean apropiados:

Linear:
velocidad, teclado, feedback, jerarquía.

Stripe:
claridad, precisión, densidad controlada.

Apple:
composición, calma, detalle.

Perplexity:
evidence/provenance integrated into answer flow.

WhatsApp:
familiaridad y baja fricción en comunicación.

NO copiar skins.

Extraer principios.

==================================================
31. CLINICAL SAFETY IN UX
==================================================

La belleza nunca puede ocultar:

allergy
critical result
pending task
uncertainty
suggested diagnosis
medication discrepancy
failed save
unsent order
unreviewed result

No usar motion/color para crear falsa seguridad.

==================================================
32. NO SILENT LOSS
==================================================

Visualmente demostrar cuando exista:

saving
saved
syncing
failed
offline/retry
draft preserved

Cero borradores perdidos silenciosamente.

==================================================
33. CROSS-LANE CONTRACT
==================================================

Master Completion trabaja en paralelo.

NO rehacer trabajo técnico/clínico suyo.

Si necesitas tocar un archivo compartido:

identifica si la región se cruza.

Si el cambio es puramente visual y disjunto:
continúa.

Si existe conflicto:
CROSS_LANE_CONFLICT.

Documenta y evita destruir el otro carril.

==================================================
34. NO COSMETIC CHEATING
==================================================

No declarar “mejor estética” por haber:

cambiado colores;
aumentado radius;
agregado shadow;
agregado gradient;
animado cards.

La prueba es:

¿se entiende mejor?
¿se siente más rápido?
¿orienta mejor?
¿reduce fricción?
¿comunica estado?
¿reduce ruido?
¿mejora continuidad?
¿se siente más terminado?

==================================================
35. PRIORIDAD DE EJECUCIÓN
==================================================

Primero arreglar las superficies de mayor frecuencia/valor:

consulta
agenda
expediente
Evidence
receta/órdenes
AI surfaces
patient state
closed-loop work

Después:

secondary workflows
settings
administrative surfaces.

==================================================
36. ITERACIÓN VISUAL REAL
==================================================

Para cada pantalla importante:

1. inspeccionar;
2. recorrer;
3. identificar problema concreto;
4. modificar;
5. abrir de nuevo;
6. comparar;
7. probar 390 px;
8. probar estados;
9. ejecutar guards;
10. volver a mejorar si todavía parece mediocre.

NO asumir que el primer cambio es suficiente.

==================================================
37. MATRIZ DE CALIDAD
==================================================

Mantener por pantalla:

FUNCTIONAL
VISUAL
INTERACTION
MOBILE_390
WEBKIT
LOADING
EMPTY
ERROR
LONG_CONTENT
ACCESSIBILITY
MOTION
PERCEIVED_PERFORMANCE
VISUAL_REGRESSION
STATICNESS
BENCHMARK
STATUS
EVIDENCE

==================================================
38. DEFINICIÓN DE PROVEN
==================================================

PROVEN requiere evidencia acorde a la afirmación.

Ejemplos:

“se ve bien en Chromium” no demuestra WebKit.

“hay CSS responsive” no demuestra 390 px.

“existe loading component” no demuestra journey.

“tiene animation” no demuestra buena motion.

“tests verdes” no demuestra excelencia visual.

==================================================
39. DEFINICIÓN DE TERMINADO
==================================================

NO te detengas porque:

hiciste muchos commits;
CI está verde;
cerraste 18 unidades;
el PR mergea limpio;
escribiste un final state.

Sólo puedes detener Product Excellence cuando:

no quede trabajo visual/interactivo internamente accionable en la matriz;

los NOT_PROVEN restantes tengan razón concreta;

los BLOCKED_EXTERNAL tengan unlock concreto;

los cross-lane conflicts estén documentados;

las superficies prioritarias estén recorridas;

390 px esté validado donde corresponda;

las compuertas estén verdes;

y el producto haya sido observado después de los cambios.

==================================================
40. MODO LOOP
==================================================

NO me entregues un informe y pares si todavía puedes mejorar algo.

Haz:

seleccionar peor gap de mayor impacto
→ reproducirlo
→ encontrar causa
→ implementar
→ browser
→ 390 px
→ estados
→ accessibility
→ regression
→ actualizar matriz
→ siguiente.

Si encuentras un bloqueo:
documenta y continúa.

Si encuentras algo ya hecho:
no lo repitas.

Si otro carril modificó la misma superficie:
reconcilia o documenta conflicto.

NO MERGE salvo instrucción explícita actual del owner.
NO DEPLOY salvo instrucción explícita actual del owner.

OBJETIVO FINAL:

HACER AUSCULTA CONSULTORIO VISUAL E INTERACTIVAMENTE EXCEPCIONAL,
NO SÓLO CORRECTO.

QUIERO UN PRODUCTO QUE SE SIENTA VIVO, RÁPIDO, CLÍNICAMENTE SERIO,
COHERENTE Y TERMINADO.

MÁS PROFUNDO QUE ABRIDGE SIN SER MÁS PESADO.
MÁS ÚTIL SIN SER MÁS RUIDOSO.
MÁS SOFISTICADO SIN SER MÁS DIFÍCIL.

CONTINÚA DESDE EL ESTADO ACTUAL.

NO REPITAS TRABAJO YA PROVEN.

EJECUTA AHORA Y SIGUE HASTA AGOTAR TODO LO INTERNAMENTE ACCIONABLE.

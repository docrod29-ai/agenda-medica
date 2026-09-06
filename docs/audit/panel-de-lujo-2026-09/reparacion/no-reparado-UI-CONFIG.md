# No reparado — UI-CONFIG

De los 110 hallazgos de `lista-UI-CONFIG.json` (1 P1 · 25 P2 · 84 P3), **quedan
sin reparar 43**, todos P3 salvo dos P2 que se dicen abajo con su motivo. El
detalle de lo cerrado está en `ledger-UI-CONFIG.md`; lo que se pasó a otra
rebanada, en `handoff-UI-CONFIG.md`.

No hay ninguno «casi hecho»: o está cerrado con su prueba, o está aquí con su
razón. Un tercer estado sería el peor de los tres.

## Los dos P2

| ID | Qué falta | Por qué no se hizo |
|---|---|---|
| **ASN-010** | Un pendiente crítico sin dueño («está convulsionando», escalado desde el portal) no enciende nada fuera de `/pendientes`: el enlace «Seguimiento» del riel no lleva señal ni conteo | `FlowRail.tsx` es mío, pero la señal necesita leer el worklist desde el riel, y el riel hoy no lo lee. Conectarlo bien pide decidir **con qué frecuencia** se relee (el riel se pinta en todas las pantallas) y eso es una decisión de coste por consulta, no de estilo. Hacerlo mal —una lectura de Firestore por render— es peor que el defecto. Es la reparación más grande que dejo pendiente y la primera que recomiendo retomar |
| **PC-015** | Letra pequeña en el portal del paciente: etiquetas de navegación a 10.5 px; procedencia, estado de la escalación, cédula del prescriptor y reglas de contacto a 12 px | Subirlas a 14 px toca `globals.css` en clases que **comparten médico y paciente** (`--t-overline`, `.nx-meta` y sus parientes). Cambiar el tamaño ahí mueve la línea de base de las filas de la agenda, del worklist y de la consulta, y el trinquete visual (`arnes:regresion-visual`) mide exactamente eso — con un navegador que esta suite no tiene. Hacerlo a ciegas es cambiar 78 pantallas sin poder mirarlas, que es justo lo que la regla de diseño prohíbe: «no se aprueba una interfaz leyendo el código». Necesita el arnés levantado |

## Deuda declarada de la que sí reparé (los techos que dejé)

No son hallazgos sin tocar: son las partes que quedaron fuera de mi rebanada y
que ahora **tienen un trinquete que impide que crezcan**.

| Trinquete | Techo hoy | Dónde |
|---|---|---|
| Avisos que empiezan por «Error…» | 25 (eran 45; los 20 de esta rebanada, reescritos) | `src/__tests__/la-pantalla-habla-como-persona.test.ts` |
| Campos de formulario sin nombre en pantallas de trabajo | 81 | `src/__tests__/cada-campo-dice-como-se-llama.test.ts` |

## El resto, por familia

### Accesibilidad y diseño

| ID | Qué queda | Por qué |
|---|---|---|
| ZC-018 | Las gráficas de laboratorio y de signos no tienen nombre accesible, dibujan los puntos a distancia igual aunque pasen días u horas, y el eje redondea hasta que «1» y «1» son los dos extremos | El eje por tiempo real y los decimales según rango cambian **lo que el médico ve de una tendencia**. Un eje mal reescalado dice otra cosa que el anterior, y validarlo pide mirarlo. No es un `aria-label` suelto: es rehacer la gráfica |
| D-019 | Tres archivos mezclan clases Tailwind de plantilla con los tokens; concentran los `rounded-full` de la app | Sustituir `inputCls` por `className="input"` en `hospitalizacion/[internamientoId]` cambia altura, foco y tema de ~30 campos a la vez, en un módulo **en pausa** que nadie puede mirar hoy. Alto riesgo, cero beneficio para el usuario actual |
| D-021 | No hay red automática de accesibilidad fuera de las 10 superficies del paciente, y `RISK_REGISTER` no tiene fila de accesibilidad | La mitad está hecha: el trinquete de campos sin nombre existe y corre en la suite. Lo que falta —correr `a11y-jsx.mjs` sobre todo el dashboard y añadir R-09— toca `agent-state/RISK_REGISTER.md`, que es **compartido y sólo lo edita el orquestador** |
| MO-013 | La guía de ortopedia no pide lateralidad y el léxico ASR no tiene «derecho/izquierdo/bilateral» como términos de alta prioridad | El léxico ASR es de PROMPTS-ASR (`src/lib/asr/**`). La guía sí es mía, pero repararla a medias —pedir el lado sin que el reconocedor lo sesgue— deja el defecto que más importa |

### Navegación y estructura

| ID | Qué queda | Por qué |
|---|---|---|
| D-016 | «Entregas de WhatsApp» es una bitácora escondida entre 17 pestañas de ajustes | Moverla a Operaciones exige una pantalla nueva ahí y **decide el dueño** (`13-QUITAR`, §A). Sin esa decisión, moverla es esconderle a alguien algo que ya usa |
| D-017 | El chat de ayuda vive dos veces: en el FAB global y otra vez dentro de `/guia` | Recomendación: que «Preguntar» abra el panel del FAB. `BotonAyuda` no expone hoy una forma de abrirse desde fuera; añadirla es un contexto o un evento global, y esa decisión de arquitectura pesa más que el defecto (P3, dos cajas del mismo bot) |
| C-032 | Dos `HistorialVersiones` con dos lectores para la misma entidad | El equipo rojo verificó que la diferencia de conducta es **deliberada** (en nota firmada se copia, nunca se restaura). Fusionar sólo el lector es correcto, y toca `src/components/expediente/`, de otra rebanada |
| C-033 | Dos `page.tsx` funcionan como biblioteca de componentes (antibiograma y corte-caja) | `corte-caja` es de DINERO. Mover sólo `AntibiogramaTool` deja la mitad del patrón, y el beneficio es de orden, no de usuario |
| C-034 | Tres listas de destinos para las mismas rutas | La mitad hecha: los NOMBRES ya salen de una sola tabla (`etiquetas.ts`, D-014) con un guardián que caza el choque. Derivar `NAV` de `GRUPOS` es la otra mitad y toca la estructura de la navegación entera |
| N-026 | Esconder la farmacia del paquete base | **Decide el dueño**: cambia la composición del paquete CONSULTORIO, que es una decisión comercial. `modulos.ts` sería el sitio |
| ASM-022 | Fusionar Reseñas y Reactivación en «Seguimiento de pacientes» | La parte confirmada (el rótulo de `/chat`) está reparada. La fusión **decide el dueño** y las dos pantallas son de AGENDA-MENSAJERIA |
| D-013 | En consulta, la acción central de la barra inferior enlaza a la misma URL | El hallazgo dice literalmente «verificar en navegador»: si Next remonta, la grabación muere sin aviso. Cambiarlo sin poder comprobarlo es tocar la barra de la consulta a ciegas, con la grabación de por medio |

### Retiradas propuestas

| ID | Qué queda | Por qué |
|---|---|---|
| ASE-021 | `deletePatientExpediente`: 120 líneas sin llamador, y dentro una regla que borra citas por **teléfono a solas** (el de la familia) | Retirarla exige tocar un **sello de 13 casos** en `invariantes-clinicos.json` y una entrada del ledger (REG-352), y los dos archivos son del orquestador. Quitarle sólo el `telefonoMatch` cambia el comportamiento de una función sellada sin que nadie la llame: el riesgo es todo y el beneficio, ninguno hasta que alguien la conecte |
| S-013 | El endpoint de migración de una sola vez sigue abierto | Ruta de API que **nadie más posee**, así que es mía, pero retirarla **decide el dueño** (`13-QUITAR`, §D) y su alternativa mínima —subirla a `superadmin`— cambia quién puede correrla, que es una decisión de permisos. Con el tiempo que quedaba preferí no dejarla a medias |
| D-010 | `DoctorOnboarding.tsx`, 169 líneas sin consumidor | **Decide el dueño**, y hay dos razones escritas en conflicto: `13-QUITAR` lo propone retirar (D-010) y el mismo documento recoge que C-030 fue **refutado** porque la deuda está declarada y congelada en `modulos-sin-conectar.test.ts:120`. Borrarlo rompe ese guardián |
| D-012 | `lib/mobile/consulta-cierre.ts`, 151 líneas esperando una interfaz | Igual: **decide el dueño** (¿el programa móvil sigue pospuesto?) y está declarado en el mismo guardián de huérfanos |
| D-011 | `lib/i18n.ts` sin consumidores | **Decide el dueño** entre retirar y exigir el patrón sólo en pantallas nuevas. La recomendación del auditor es la segunda, y montar ese guardián («sólo archivos nuevos») pide un criterio de «nuevo» que hoy no existe en el repo |

### Clínico

| ID | Qué queda | Por qué |
|---|---|---|
| MP-009 | El panel pediátrico habla en mg y la pediatra receta en mL de una presentación | **Falta el dato**: la tabla de presentaciones la aporta y valida el Dr. `NEEDS_CLINICAL_REVIEW`. Sin ella no hay conversión determinista, y aproximarla es exactamente lo que la regla 1 prohíbe |
| MP-012 | Percentiles sólo de 0 a 60 meses | Igual: **decide el dueño** qué referencia usar de 5 a 19 años (OMS 2007 u otra), y los datos se generan con script desde los archivos oficiales, no se transcriben |
| MO-014 | El ortopedista hereda el tronco «cirugía» y no tiene herramientas de consultorio ortopédico | El sub-tronco es barato; lo que no lo es son sus calculadoras, cuyos puntos de corte son `NEEDS_CLINICAL_REVIEW`. Un tronco nuevo y vacío es peor que el actual |
| MC-019 | El cirujano ve el chip «Valoración Inmunocomprometido» | El equipo rojo verificó que `tiposVisibles(esNotaHospital, activo)` **no recibe especialidad**: filtrar por tronco es una firma nueva y una decisión de producto. La segunda mitad del hallazgo ya está contada en MC-008, de otra rebanada |

### Ingeniería y guardianes

| ID | Qué queda | Por qué |
|---|---|---|
| A-005 | Una arista `lib → hooks` que el guardián descarta por ser `import type` | Mover `Utterance` a `src/lib/expediente/` toca `useGrabacionAudio.ts`, que es de CONSULTA |
| A-009 | 29 goldens sellados sin cabecera | La recomendación del auditor es un trinquete que sólo baje, **no** escribir 29 cabeceras de golpe («eso produce 29 cabeceras de relleno»). El chequeo de mantenimiento ya cuenta e informa (231 sobre el total); convertirlo en trinquete duro con techo sellado toca `invariantes-clinicos.json`, del orquestador |
| A-010 | Nueve pruebas usan `expect(f(x)).toBe(f(x))` | Están en archivos de varias rebanadas (`timezone.test.ts` y compañía). Anclarlas contra un valor esperado es correcto y barato, pero tocar pruebas ajenas en mitad de una reparación paralela es la forma más rápida de romperle el verde a otro agente |
| A-015 | `Tarea` exportado dos veces con significados incompatibles | `src/lib/uci/enfermeria.ts` es mío y el cambio es un renombre, pero arrastra a sus consumidores de UCI y el módulo está **en pausa**: cero beneficio hoy, riesgo de romper el verde de otro |
| S-005 | El guardián de sesión se satisface con que la llamada exista aunque la ruta ignore el resultado | `authz-rutas-declaradas.test.ts` y `registro-rutas.ts` son de SEGURIDAD |
| S-006 | Siete rutas devuelven el texto del Admin SDK con ids de paciente dentro | Las siete son de SEGURIDAD (`api/hospital/**` y hermanas). Es P2 y **está en el handoff de nadie**: lo dejo dicho aquí para que el orquestador lo enrute |
| S-012 | 60 de 68 colecciones sin `hasOnly` | `firestore.rules` es de SEGURIDAD |
| N-019 | Dos motores de precio por médico que cuentan médicos distintos | `lib/pricing.ts` y `api/superadmin/**`; el arreglo (que `superadmin/clientes` llame a `contarMedicos`) toca la contabilidad del dueño y merece que él lo mire |
| ZL-013 | Lo que el consultor «aprendió» del médico no se puede ver ni borrar | Es una pantalla nueva más una ruta de servidor. No cabía |
| ZL-015 | «No puedes dejar la clínica sin administrador» vive sólo en la pantalla | El arreglo correcto es una transacción de servidor o una guarda en `firestore.rules`: SEGURIDAD |
| ZL-019 | El vínculo Google-Calendar ↔ médico se decide por un correo editable | `lib/calendario/**` es de AGENDA-MENSAJERIA |

### Onboarding y fricción menor

| ID | Qué queda | Por qué |
|---|---|---|
| ASN-014, ASE-023, ASR-021 | El tour de bienvenida se come el primer clic, describe la pantalla equivocada y se abre encima de Configuración | Los tres son el mismo componente (`OnboardingTour.tsx`, mío) y el arreglo real es **arrancarlo sólo en `/dashboard`**, lo cual cambia a quién se le enseña el tour y cuándo. Es la clase de cambio que hay que ver funcionando: se abre una sola vez por usuario y no hay forma de comprobarlo en esta suite |
| ASR-010 | Bloquear la hora de comida cuesta 18 interacciones | Un descanso «a nivel de semana» es un modelo de datos nuevo para los horarios, con su migración |
| ASR-017 | El aviso de notificaciones flota encima de los botones «Consulta» del tablero | Moverlo a banda superior o dentro de «Siguiente acción» cambia la composición de la pantalla de Hoy, que tiene su propio trinquete visual medido en navegador |
| D-018 | `/uci/antimicrobianos` hace dos trabajos en una pantalla | El propio hallazgo dice «al reactivar UCI»: está en pausa (D-030) |
| PI-012 | El portal sin señal enseña la página de venta para médicos | En el handoff, para PORTAL |

## El único rojo que deja esta rama, y no es de esta rama

`src/__tests__/ops-timeout-y-punto-ciego.test.ts` → «el error dice cuánto esperó
y a quién» falla, y **falla igual sin mis cambios**. Lo comprobé como se
comprueba esto: `git stash` de todo el árbol de trabajo, correr el caso solo, y
sigue rojo sobre el commit anterior. Y `git diff 595c89a` no toca ninguno de los
dos archivos implicados (`src/lib/fetch-con-timeout.ts` ni el propio golden).

La causa es del entorno, no del código: el caso hace una petición REAL a
`10.255.255.1` esperando que el respaldo de tiempo agotado se dispare a los 30 ms,
y en este contenedor la salida a esa dirección se rechaza al instante, así que
lo que llega es un error de red y no un `TiempoAgotado`. En una máquina con la
ruta abierta —o en CI— el caso pasa.

Lo dejo dicho aquí y no lo toco: cambiar un golden ajeno para que pase en mi
contenedor sería aflojar una prueba por una razón que no es del producto.
Resultado de la suite completa: **13 045 casos en verde, 1 en rojo, el de
arriba.**

## Lo que se pidió y no era mío

- **A-006** (`registrarUso` sin esperar en ocho rutas): el orquestador me lo
  asignó en el encargo, pero el hallazgo vive en `lista-PROMPTS-ASR.json` y sus
  ocho archivos son de esa rebanada. Leí la documentación de `after()` de Next 16
  como se pidió y dejé el cambio exacto, ruta por ruta, en
  `handoff-UI-CONFIG.md`. Repararlo por duplicado producía un conflicto de fusión
  en ocho archivos.
- **C-008** y **C-009** (el CRM y Membresías pintan ceros tras un fallo de
  lectura): también me los nombró el encargo y tampoco están en mi lista — son de
  AGENDA-MENSAJERIA y de DINERO. La pieza compartida que necesitan
  (`ui/NoSePudoLeer`) ya existe y el handoff trae el patrón exacto.

# El encuentro medido donde el grabador existe — y Operaciones deja de ser mudo

**15-ago-2026 · `V15-ITERATION16-COMPLETE-BLOCKER-CLOSURE-006`.**
Medido sobre `88f507e5` (y re-medido sobre `d307287d`) con build de producción,
emuladores, siembra base + siembra RTC-30, en 1440×900 y 390×844, **0 errores de
consola**. Arneses: `scripts/design/arnes-encuentro-v15.sh` ·
`arnes-grabacion-v15.sh` · `arnes-axe-v15.sh`. Actas:
`docs/design/capturas/v15-encuentro-v29/` y `.../v15-grabacion/`.

## 1. La corrección de medición que abre esta corrida

El diagnóstico de §29 midió Consulta en
`/consulta/pac-aurelio-dominguez?nota=nota-aurelio-1`. Esa nota está **firmada**
en la siembra, y en estado firmado la consulta **no pinta el grabador**: pinta
una nota cerrada en modo revisión.

Es decir: la lectura que produjo «12 campos de formulario, 20 grupos repetidos y
la primera acción consecuente a 393px» describe una pantalla **donde el
instrumento principal del encuentro no está**. No refuta el diagnóstico — lo deja
sin medir. Es la familia RTC-02 / RTC-20 / INS-01 otra vez: el instrumento que no
mide lo que dice medir.

Se volvió a medir por donde el médico entra de verdad:
`/consulta/pac-aurelio-dominguez` **sin `?nota=`** (encuentro nuevo) y
`?nota=nota-luzmaria-borrador` (el borrador ya sembrado, `estado: 'borrador'`).

## 2. Lo que la medición corregida dijo

| | firmada (la lectura vieja) | **sin firmar** (la real) |
|---|---|---|
| grabador | **no existe** | **y=387** escritorio · **y=493** móvil |
| tamaño del grabador | — | **228px de alto**, acento sólido, primer elemento consecuente |
| catálogo de herramientas | y=442 | **y=635** escritorio · y=740 móvil |
| alto de `<main>` | 2141px | 2939px |

**REFUTADO — «la primera acción consecuente está a 393px».** En el encuentro real
el grabador domina el primer viewport: círculo de acento, «Grabar la consulta ·
Capta a los dos y separa las voces». La pantalla no esconde su instrumento, y el
orden de lectura ya era el que §29 pide:

```
PACIENTE → ALERGIAS · PROBLEMAS · VISITAS ANTERIORES → TIPO DE NOTA → GRABAR
```

Estado clínico de confianza, con su procedencia, y después el instrumento.

**CONFIRMADO — el catálogo estaba en el segundo lugar del encuentro.**
`HERRAMIENTAS CLÍNICAS (5)` con su propio buscador, a y=635, **por delante de los
signos, de las secciones narrativas, de los diagnósticos y de los medicamentos**.
La pantalla ofrecía OTRAS capacidades antes de ofrecer ESTE encuentro.

## 3. La reparación de Consulta

El bloque `<Herramientas>` se mueve debajo de la nota y del Copiloto. **No se
quita ninguna herramienta**, no se esconde tras un botón mágico, no se toca su
buscador ni el filtrado por especialidad. Es el mismo argumento con el que §8.8
movió el Copiloto: un instrumento que se abre bajo demanda va donde el médico ya
sabe si le hace falta.

| | antes | después |
|---|---|---|
| catálogo de herramientas | **y=635** | **y=1931** |
| primer bloque tras el grabador | catálogo | **signos vitales (y=635)** |
| herramientas disponibles | 9 declaradas / 5 visibles | **idéntico** |

Guardián: `v15-consulta-el-catalogo-va-despues-de-la-nota.test.ts` (6 casos).

## 4. Expediente — comprobado primero, y NO rediseñado

El diagnóstico decía «es el más cercano; **su hueco era de evidencia**». Se
comprobó antes de tocar nada, sobre un paciente longitudinal real
(`pac-aurelio-dominguez`: 2 consultas firmadas desde el 1-jul, 2 diagnósticos
crónicos, 2 pendientes vivos). Las cinco estaban:

| pregunta | dónde se contesta |
|---|---|
| estado actual | «Últimos signos: TA 132/84 · FC 74 · … · IMC 28.1» · «Diagnósticos activos» |
| cambio longitudinal | «Actividad: 2 consultas · última visita 03 ago 2026» + la serie de encuentros |
| trabajo sin resolver | «Pendientes de este paciente · 1 sin leer · 1 en plazo», con dueño por línea |
| procedencia | «Último cambio: Nota de Seguimiento · hace 12 días» · «de sus notas **firmadas**» · sello «Firmada» |
| siguiente continuación | «Nueva consulta» (primaria) · «Resolverlos en Pendientes →» |

**Veredicto: sin hueco estructural. No se rediseñó.** Lo que faltaba era la
prueba, y ésa es
`v15-expediente-contesta-las-cinco.test.ts` (7 casos).

El caso 7 vigila la línea que no se cruza: el expediente **inspecciona y
continúa**, no cierra. Cerrar un cabo suelto desde una pantalla donde el detalle
de la tarea no está delante permitiría cerrar un resultado sin haberlo mirado —
que es el daño exacto que `/pendientes` existe para evitar.

## 5. Operaciones — de índice a plano de control

`/operaciones` contestaba una sola pregunta: «¿a dónde puedo ir?». Ocho grupos de
enlaces, **idénticos en todos los consultorios**: el que tiene cinco citas sin
responder desde el jueves y el que está al día veían la misma pantalla, píxel por
píxel.

Ahora abre con **lo que pide atención**, calculado de estado que la aplicación ya
guardaba:

```
Pide atención (2)
Sale de las citas, la lista de espera y las existencias que ya guarda este
consultorio. Se actúa en la pantalla que manda, no aquí.

⚠ 2 · Citas sin responder
   2 sin confirmar. Cada una es una persona esperando respuesta.
   Responde: el consultorio                                    Citas ›

⚠ 1 · Existencias del consultorio
   1 bajo mínimo — Jeringas 5 mL.
   Responde: el consultorio                                 Farmacia ›

✓ Sin novedad: lista de espera.
```

Las siete preguntas de §8 quedan contestadas **con dato real**: qué pide
atención (la cuenta), qué bloquea (el detalle), quién responde, qué exige acción,
qué está sano (la línea de «sin novedad», que nombra lo comprobado), qué se puede
ignorar (todo lo que no subió), dónde se actúa (el enlace a la pantalla con
autoridad).

Tres reglas que el módulo no cruza, y las tres tienen su caso:

1. **No se inventa nada.** Ni un indicador, ni una gráfica, ni un porcentaje.
   Cada línea cuenta documentos que ya existen.
2. **No poder leer NO es estar sano.** Es la regla 4 de seguridad clínica
   («ausencia de dato no es dato de ausencia») llevada a lo operativo: cada
   lectura se rescata por separado y una colección rota sale como «no se sabe»,
   nunca como «sin novedad». Un inventario vacío tampoco es sano: es «no aplica».
3. **Aquí no se cierra nada.** La franja son enlaces. Confirmar una cita desde un
   resumen, sin su detalle en pantalla, es la trampa que §29 ya rechazó para
   `/pacientes`.

Guardianes: `v15-operaciones-dice-que-pide-atencion.test.ts` (11 casos, motor
puro) y `v15-operaciones-franja-antes-del-indice.test.ts` (7 casos, cableado —
que el dato LLEGUE y llegue arriba). Los dieciocho destinos administrativos
siguen todos accesibles, y hay un caso que lo vigila.

## 6. El ciclo de grabación, intentado de verdad

Con dispositivo de audio falso de Chromium, pulsando:

| paso | veredicto |
|---|---|
| PREPARAR | **PASA** — el encuentro sin firmar abre con el grabador visible |
| CONSENTIMIENTO | **PASA** — no arranca sin confirmar que el paciente fue informado |
| INICIAR | **PASA** |
| ESTADO EN VIVO | **PASA** — el cronómetro avanza |
| PAUSAR | **PASA** |
| REANUDAR | **PASA** — vuelve a grabar sin perder la sesión |
| INTERRUPCIÓN | **PASA** — salir con la grabación viva queda bloqueado |
| RECUPERACIÓN | **NO SE PUEDE COMPROBAR** — el aviso de salida que acaba de pasar es lo que impide recargar en plazo |
| TRANSCRIPCIÓN | **NO SE PUEDE COMPROBAR** — `/api/expediente/transcribir-chunk → 503`: sin llaves de proveedor en este contenedor |
| NOTA | **NO SE PUEDE COMPROBAR** — nace de la transcripción |
| CIERRE | **NO SE PUEDE COMPROBAR** — firmar exige una nota con contenido |

**La sonda se cazó a sí misma en falso verde.** Su primera pasada dio
`INICIAR = PASA` sin haber grabado nada: pulsar el micrófono abre la hoja de
consentimiento, y el texto del propio modal —«el paciente puede pedir detener la
grabación»— casaba con el patrón que buscaba el estado. Se corrigió confirmando
el consentimiento y leyendo el estado fuera del diálogo. Queda escrito porque es
el defecto que §12 del encargo describe, encontrado en el instrumento y no en el
producto.

## 7. Compuertas

`npx vitest run` **9665/9665** · `npx tsc --noEmit` limpio · lint **96 = techo** ·
trinquete de diseño **sin deuda nueva** (los nueve techos intactos) ·
`npm run build` compila · navegador real 1440 + 390 sobre las seis superficies
críticas, **0 errores de consola** · axe WCAG 2.2 AA **limpio en 11 de 12**
(pantalla × ancho) · `SCREEN_INVENTORY.md` regenerado.

Los dos trinquetes cazaron deuda nueva de esta rebanada y **se arregló el
cambio, no se subió el techo**: `setCargando(true)` en el cuerpo de un efecto
(lint 97 > 96) y seis `fontSize` fuera de la escala en la franja nueva (diseño
1969 > 1963).

### Prueba al revés

**15 reversiones quirúrgicas, comprobadas en rojo una a una**, cada una mordiendo
su caso: el catálogo vuelve al hueco tras el grabador · desaparece una
herramienta · la franja se pinta después del índice · un solo `catch` para las
tres lecturas · lo ciego se cuela en «sin novedad» · la franja se pone a mutar ·
no poder leer se cuenta como sano · inventario vacío se declara sano · «bajo
mínimo» pasa a ser estrictamente menor · las citas viejas vuelven a contar · el
aviso de farmacia deja de nombrar el insumo · se cae el bloque de cabos sueltos ·
el catálogo sube por delante de la historia · el expediente empieza a cerrar
pendientes · se pierde la procedencia de Problemas.

Ninguna mutación quedó en el árbol.

## 8. Declarado y NO pagado

1. **`target-size` en `/pacientes` a 1440** — 3 nodos, impacto *serious*, ausente
   en móvil. Preexistente: `/pacientes` no se ha tocado desde `d91c840c`.
   Encontrado por esta corrida, no causado por ella.
2. **El aviso de alergias se desborda a 390px** — «Penicilina (rash
   generalizad…» y el «se lee:» pisando el borde. Visible en
   `despues-movil-consulta-sin-firmar.png`. Es la familia de `alergiasDe`, que
   §1 congela.
3. **`ops-timeout-y-punto-ciego` es ambiental** — el proxy del contenedor
   responde en vez de agotarse. **Reproducido en rojo contra la línea base
   limpia (`88f507e5` con los cambios en `stash`) en este mismo entorno**, y en
   verde en la corrida final: es intermitente, y no depende de esta rama.
4. **RECUPERACIÓN y el tramo transcripción → nota → cierre** siguen sin
   comprobar, con la dependencia dicha por su nombre (§6).
5. **El estado «sin excepción» de `/operaciones`** se prueba en el motor (caso 3)
   y en la rama `sin-excepcion` del componente, **no en navegador**: la siembra
   no tiene un consultorio al día, y fabricar uno sólo para la foto sería
   inventar el dato que este módulo existe para no inventar.

## 9. Qué NO cubre esta corrida

- **No puntúa §29.** El score lo pone el revisor independiente sobre el SHA
  congelado. Aquí hay medición y reparación, no juicio.
- No re-mide Hoy, Pacientes ni Pendientes con criterio nuevo: se recorren para
  descartar regresión (41/41 en verde, 0 errores de consola, axe limpio salvo lo
  declarado), no para volver a puntuarlas.
- No toca el estado FIRMADO de la consulta, que es otra pantalla.
- No cubre el expediente hospitalario ni el vacío (RTC-30, cerrado aparte).

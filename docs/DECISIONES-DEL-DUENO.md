# Decisiones que sólo puede tomar el dueño

> **Esta lista se DERIVA del código**, no se escribe a mano.
> `node scripts/calidad/lo-que-espera-al-dueno.mjs`
>
> Un guardián falla si el documento y el código se separan — en las dos
> direcciones. Pedir algo ya resuelto es peor que no pedirlo: hace que se dejen
> de leer todas.

## Por qué existe este documento

El repositorio tiene una regla que ha funcionado: **cuando falta un criterio
clínico u operativo, no se inventa un valor por defecto — se declara.**

Cada una de las cinco constantes de abajo está escrita con cuidado, dice qué
hace falta y por qué no puede decidirlo el software. Y **nadie las leía**: viven
repartidas en cinco módulos distintos.

Es «escrito y sin conectar» —la familia más grande de este repositorio— aplicado
a las **decisiones** en vez de al código. La declaración existía; el camino hasta
quien decide, no.

## Lo que este documento NO hace

**No propone respuestas.** Ninguna respuesta sugerida, ningún valor
«recomendado», ningún número de ejemplo que pueda copiarse sin pensarlo.

Poner un valor razonable al lado de la pregunta es exactamente cómo el criterio
del dueño se convierte en el default de un agente sin que nadie firme nada — y
esas cinco constantes existen precisamente para impedirlo.

---

## 1 · `FALTA_GRACIA` — los minutos de gracia del MAR

**Dónde**: `src/lib/uci/mar.ts:180`

**Qué se pregunta**: cuántos minutos pueden pasar desde la hora programada antes
de marcar una dosis como **atrasada**.

**Por qué no lo decide el software**: depende de los turnos, de la ronda de
enfermería y del tipo de fármaco. Es una decisión operativa de **su** unidad.

**Qué pasa hoy**: el motor **lanza** en vez de asumir un valor. Una gracia
inventada produce rojos falsos, y un MAR que grita deja de leerse — que es
exactamente el daño que este módulo existe para evitar.

**Qué hace falta de usted**: un número de minutos. Si cambia por tipo de fármaco
o por turno, dígalo así y el motor lo admite como parámetro.

---

## 2 · `FALTA_POLITICA_Q2_Q4` — quién corrige un registro, y hasta cuándo

**Dónde**: `src/lib/hospital/eventos.ts:351`

Son **cuatro preguntas** y desbloquean el motor `validarCorreccion`, que hoy está
escrito, probado y sin conectar por esto:

| | Pregunta |
|---|---|
| **Q2** | ¿Qué roles pueden **anexar una corrección** a un registro? |
| **Q2-bis** | ¿Puede **enfermería anular** una administración de medicamento, o eso queda reservado al médico? *(hoy `administrar` lo puede hacer enfermería)* |
| **Q3** | ¿Hay **ventana de tiempo**? ¿Se corrige un evento de hace cinco días? ¿Y en un episodio **ya egresado**? |
| **Q4** | ¿El **motivo escrito** es obligatorio? |

**Lo que hay que sopesar en Q4, y por eso es suya**: la NOM-004 lo apunta, pero
encarece cada corrección. Si estorba, se deja de corregir — y entonces el
registro se degrada por el otro lado.

**Qué pasa hoy**: `POLITICA_CORRECCION` vale `null`. Nada se corrige, y nada se
corrompe por una política inventada.

---

## 3 · `FALTA_VENTANA_REINGRESO` — qué cuenta como reingreso a terapia

**Dónde**: `src/lib/hospital/indicadores-episodio.ts:52`

**Qué se pregunta**: cuántas horas de separación entre una salida de terapia y la
siguiente entrada cuentan como **reingreso** (*bounce-back*) y no como dos
estancias distintas.

**Por qué no lo decide el software**: es un indicador de calidad de la unidad, y
el umbral cambia el número que se publica.

**Qué pasa hoy**: el módulo devuelve **las horas reales** entre las dos estancias
y **no emite veredicto**. El dato está; la etiqueta no.

---

## 4 · `FALTA_VENTANA_TEMPORAL` — cuánto vale una observación

**Dónde**: `src/lib/clinical/observacion-version.ts:138`

**Qué se pregunta**: cuánto tiempo sigue siendo válida una observación para
combinarla con otras en un mismo cálculo.

**Por qué no lo decide el software**: su propia decisión ICU-Q3 prohíbe mezclar
variables tomadas a horas distintas **«sin política explícita»**. Ésta es esa
política.

**Qué pasa hoy**: se pasa como parámetro obligatorio; sin él, el motor **lanza**
en vez de mezclar horas distintas en silencio.

---

## 5 · `LO_QUE_HACE_FALTA_DEL_DR` — el buzón de las alertas de operación

**Dónde**: `src/lib/ops/alerta.ts:101`

**Qué hace falta**: una variable **`OPS_ALERTA_WEBHOOK`** en Vercel, con una URL
`https` que reciba un `POST` con JSON.

Sirve un webhook de Slack, uno de Discord, un tema de **ntfy.sh** o un Zapier.

**Qué pasa hoy**: el vigilante **corre igual** y deja el diagnóstico en su
respuesta y en el registro — pero no despierta a nadie. Si algo se rompe de
madrugada, se sabrá cuando alguien mire.

---

## Fuera de esta lista, porque no las declara el código

Estas tres no tienen constante porque no bloquean ningún motor: son
configuración o criterio externo.

- **Requisitos legales de la receta impresa** — qué exige su criterio legal que
  aparezca. Lo que hoy se imprime salió de la NOM-004 y de su membrete, no de una
  revisión legal.
- **`STRIPE_WEBHOOK_SECRET` en Vercel** — sin ella, los cobros se registran por
  la vía lenta.
- **Plazo de retención del audio de consulta** — autorizó conservarlo (REG-249);
  falta cuántos días. Hoy vive hasta que alguien lo borre.

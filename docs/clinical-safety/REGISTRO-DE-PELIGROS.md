# Registro de peligros clínicos — NexusMED

**Formato**: §18 del charter Master Loop V7.
**Abierto**: 6-ago-2026. **Última revisión**: 6-ago-2026.

---

## Cómo leer este documento

Cada peligro sigue el formato del charter:

```
PELIGRO · CAUSA · DAÑO POSIBLE · A QUIÉN AFECTA · SEVERIDAD
· PROBABILIDAD · CONTROLES · PRUEBAS · RIESGO RESIDUAL
· RESPONSABLE · APROBACIÓN
```

**Dos advertencias sobre este registro, para que no se lea como lo que no es:**

1. **Ninguno de estos peligros es hipotético.** Todos ocurrieron en el sistema
   real y están documentados en `docs/audit/regression-ledger.md` con su REG. Un
   registro de peligros inventado da una falsa sensación de cobertura; éste sólo
   contiene lo que se vio pasar.

2. **La casilla APROBACIÓN está vacía en todos.** La aceptación de un riesgo
   clínico residual corresponde al médico responsable —§18 del charter— y no
   puede firmarla el sistema que la produce. La severidad que se propone abajo
   es una estimación de ingeniería sobre el tipo de daño; **la probabilidad no se
   estima**: se registra cuántas veces ocurrió de verdad, porque un número
   inventado de probabilidad es exactamente la clase de cifra que este proyecto
   no se permite.

---

## PEL-001 · Un padecimiento negado entra a la nota como afirmado

| | |
|---|---|
| **Causa** | El interrogatorio nombra la enfermedad en la PREGUNTA («¿tiene diabetes?») y el extractor la cosecha como diagnóstico. |
| **Daño posible** | Diagnóstico falso en el expediente. Se arrastra a todas las notas siguientes, cambia el riesgo quirúrgico y puede motivar un tratamiento no indicado. |
| **A quién afecta** | Paciente. Médico (responsabilidad sobre una nota firmada con su cédula). |
| **Severidad** | **Alta** — un antecedente crónico falso altera decisiones terapéuticas durante años. |
| **Ocurrencias reales** | REG-023 (origen), REG-192 (el motor sólo cazaba 1 de 7 formas de negar). |

**Controles**

1. Motor determinista de negación (`src/lib/expediente/negaciones.ts`), independiente del modelo.
2. Aviso «la nota afirma algo que en el dictado se negó», que **no se pliega nunca** (`NO_SE_PLIEGAN`).
3. El sistema **no decide cuál es correcta**: un paciente puede negar algo que sí tiene documentado. Sólo se niega a dejarlo pasar en silencio.
4. Regla 23 del prompt: «una enfermedad nombrada en la pregunta no es un diagnóstico».

**Pruebas** · `negacion-diagnostico-inventado.test.ts` · `como-se-dice-que-no-en-una-consulta.test.ts` (21 casos de habla real)

**Riesgo residual** — El motor **señala de menos, nunca de más**: una forma de negar que no esté en la lista no se vigila. Es deliberado: un falso positivo haría desconfiar de todos los avisos. La lista crece cuando aparece una forma nueva.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-002 · Un padecimiento pasado entra como actual

| | |
|---|---|
| **Causa** | El motor de temporalidad no reconoce la forma verbal («le dio hepatitis», «había tenido», «ya no toma»). |
| **Daño posible** | Enfermedad resuelta tratada como activa. **Y su reverso, más peligroso**: «ya no toma metformina» leído como vigente deja un **fármaco fantasma** en la lista contra la que se cruzan alergias e interacciones. |
| **A quién afecta** | Paciente. |
| **Severidad** | **Alta** — el fármaco fantasma desactiva un cruce de seguridad sin que nadie lo note. |
| **Ocurrencias reales** | REG-200: medido, **16 aciertos de 26** antes de ampliarlo. |

**Controles**

1. Motor determinista de temporalidad con marcas de pasado y de presente, donde el presente manda («desde hace tres años tiene diabetes» es presente).
2. Aviso ámbar de desajuste temporal, descartable — no bloquea, porque un padecimiento pasado puede seguir importando como antecedente.
3. **Corpus oro de 32 frases** de consulta mexicana, con la respuesta correcta escrita.

**Pruebas** · `corpus-oro-temporalidad.test.ts` (20 pasado + 12 presente, 30/30) · `el-pasado-no-es-el-presente.test.ts`

**Riesgo residual** — Igual que PEL-001: señala de menos. El corpus sólo cubre lo que alguien escribió; una forma nueva pasa desapercibida hasta que se añade.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-003 · Una receta sale sin cantidad o sin unidad

| | |
|---|---|
| **Causa** | El dictado no la incluyó, o el modelo escribió «No especificada» en el campo de dosis. |
| **Daño posible** | Sin cantidad, quien surte no puede dispensar y alguien pregunta. **Con cifra pero sin unidad es peor**: se despacha con la unidad que suponga quien la lea — «Levotiroxina 100» puede ser mil veces la dosis. |
| **A quién afecta** | Paciente. Farmacia. |
| **Severidad** | **Crítica** — sobredosis por interpretación de unidad. |
| **Ocurrencias reales** | REG-174, REG-175, REG-176 (medido: 4 de 28 medicamentos sin dosis en notas ya firmadas), REG-177. |

**Controles**

1. **Compuerta de firma** (decisión del médico dueño, 5-ago-2026, tomada con el dato delante): sin cifra **y** sin unidad, la nota no se firma.
2. Botón «No la sabe» — declaración explícita del médico, con frase canónica comparada literal. Lo que escribe la IA **sigue bloqueando**.
3. Saneo en el esquema Zod: «No especificada» entra como vacío, no como dato.
4. El motivo del bloqueo se enseña **junto al botón**, antes de pulsarlo.

**Pruebas** · `dosis-avisa-antes-de-firmar.test.ts` · `dosis-desconocida-declarada.test.ts` · `hueco-escrito-no-es-dato.test.ts` · `el-boton-dice-por-que-esta-apagado.test.ts`

**Riesgo residual** — La compuerta trata igual la medicación que el paciente ya toma y la que se prescribe hoy. El eje existe desde REG-183 (`procedenciaClinica`) pero **no se usa para decidir qué bloquea**: eso sigue siendo decisión del médico. Registrado para su criterio.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-004 · Se prescribe un fármaco al que el paciente es alérgico

| | |
|---|---|
| **Causa** | El alérgeno no llega al cruce: campo mal parseado, alergia no estructurada, o el fármaco crónico no está en la lista que se compara. |
| **Daño posible** | Anafilaxia. |
| **A quién afecta** | Paciente. |
| **Severidad** | **Crítica** |
| **Ocurrencias reales** | REG-034, REG-035 (dos veces cerrado, tercera ruta), REG-171 (un alérgico a TMP/SMX quedó registrado como alérgico a «SMX)»), REG-188 (el fármaco crónico no llegaba al motor). |

**Controles**

1. **Un solo parser** del campo de alergias (`alergenosDe`), usado por consulta, UCI, receta y sesgo del reconocedor. Lee también `alergiasEstructuradas`.
2. Filtro de negaciones: «niega alergia a penicilina» **no** es un alérgeno.
3. Motor determinista de cruce alergia ↔ medicamento, independiente del modelo.
4. El aviso **no se pliega nunca**: es el único de la pantalla que puede matar con la receta que se está imprimiendo.
5. Desde REG-188, el motor ve la medicación **vigente** del paciente, no sólo la de hoy.

**Pruebas** · `alergias.test.ts` · `el-paciente-completo-llega-al-motor.test.ts` · `una-barra-y-no-ocho-recuadros.test.ts`

**Riesgo residual** — El cruce compara contra lo que se **oyó**: un alérgeno mal transcrito es un cruce que no salta. Mitigado con el sesgo del reconocedor (REG-187), no eliminado.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-005 · Error de decimal en la dosis («500 donde iban 50»)

| | |
|---|---|
| **Causa** | Transcripción, tecleo o extracción. Un modelo generativo lo pasa por alto sin despeinarse. |
| **Daño posible** | Sobredosis de diez veces. |
| **A quién afecta** | Paciente. |
| **Severidad** | **Crítica** |
| **Ocurrencias reales** | REG-190: el motor que lo caza **sólo corría después de firmar**. |

**Controles**

1. `revisarDosis()` — motor determinista con catálogo de máximos por toma y por día, revisado por el médico dueño (REG-041).
2. Desde REG-190 corre **en la consulta**, sobre la lista entera, con edad y peso.
3. Cuando la alerta es **crítica no se pliega**.
4. Detección específica de ~10× el máximo → «¿error de decimal?».

**Pruebas** · `seguridad-dosis.test.ts` · `la-sobredosis-se-ve-antes-de-firmar.test.ts`

**Riesgo residual** — Sólo cubre los fármacos del catálogo. Fuera de él no hay alerta, y **la ausencia de alerta no significa dosis segura** — el motor lo declara, pero ese aviso se descarta en pantalla para no saturar. En pediatría eso puede leerse como «comprobado». Registrado como `SAFE-003` en el backlog, **necesita decisión del médico**.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-006 · La nota afirma un dato que nadie dictó

| | |
|---|---|
| **Causa** | El modelo completa lo que falta: una dosis plausible, un percentil, un esquema «el más probable». |
| **Daño posible** | Dato falso firmado con cédula profesional, indistinguible de uno real. |
| **A quién afecta** | Paciente. Médico. |
| **Severidad** | **Alta** |
| **Ocurrencias reales** | REG-194 (se le pedía calcular mg/kg y percentiles), REG-197 (el arnés que debía detectarlo **no cazaba 2 de 3 alucinaciones**). |

**Controles**

1. Regla 16-bis del prompt, **global**: el modelo no calcula. Los motores deterministas lo hacen (`oms-crecimiento`, `calcularDosisPediatrica`, `funcion-renal`).
2. Regla 1-bis: vacío significa vacío. Prohibido rellenar con «No especificada».
3. Regla 19-bis: un hueco se **escribe** en la sección que le toca, no se rellena con un dato inventado.
4. Sello de procedencia por campo: de dónde salió cada dato.
5. Arnés de evaluación con detección de contenido sin respaldo, por **proporción** de palabras (REG-197).

**Pruebas** · `el-llm-no-calcula-en-ninguna-nota.test.ts` · `el-arnes-caza-la-alucinacion-que-importa.test.ts` · `el-prompt-no-se-contradice.test.ts`

**Riesgo residual** — El umbral del detector (un tercio de palabras sin respaldo) es de método, no clínico: por debajo se acepta como variación de redacción. Una invención de una sola palabra dentro de una frase larga puede pasar.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-007 · Se pierde contenido clínico ya escrito

| | |
|---|---|
| **Causa** | Un control que borra sin decir qué borra, sin poder deshacer, o un dato que no viaja en el respaldo. |
| **Daño posible** | El plan de tratamiento desaparece de una nota firmada. Un seguimiento no agendado: el paciente **no reaparece en ninguna lista**, sin error ni aviso. |
| **A quién afecta** | Paciente (continuidad). Médico. |
| **Severidad** | **Alta** |
| **Ocurrencias reales** | REG-195 (**reportado en vivo por el médico**: un diálogo le borró el plan), REG-193 (la fecha de próxima consulta no estaba en el respaldo), REG-155/157. |

**Controles**

1. Todo borrado de contenido clínico guarda un **punto de deshacer**.
2. Los diálogos que borran **enseñan qué van a borrar**, con la sección delante.
3. Respaldo local con debounce, más autoguardado al servidor, con `proximoSeguimiento` incluido en las dos redes.
4. Un botón no promete dos acciones y hace una: «Quitarlas» ya no dice «y firmar».
5. `seccionesDelTipo()` no descarta prosa dictada: lo que no encaja se devuelve aparte.

**Pruebas** · `el-plan-no-se-borra-de-un-clic.test.ts` · `la-proxima-consulta-no-se-pierde.test.ts` · `quitar-de-la-nota-quita-de-la-nota.test.ts`

**Riesgo residual** — El deshacer es **de una sola profundidad** y vive en memoria: se pierde al recargar.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-008 · Un control dice haber hecho algo que no hizo

| | |
|---|---|
| **Causa** | El botón cambia un estado de auditoría pero no el documento; o el mensaje de bloqueo es inalcanzable. |
| **Daño posible** | El médico **cree** haber quitado un dato erróneo, y ese dato viaja a la nota, a la receta y al expediente. |
| **A quién afecta** | Paciente. Médico. |
| **Severidad** | **Alta** — es peor que no tener el control: sin él, el médico lo habría corregido a mano. |
| **Ocurrencias reales** | REG-198 («Quitar de la nota» no quitaba nada), REG-195 («Quitarlas y firmar» no firmaba), REG-189 (el botón y la barra se contradecían). |

**Controles**

1. Una sola fuente para «¿por qué no puedo firmar?», compartida por el botón, la barra y el texto.
2. El motivo se enseña **donde está el dedo**, junto a los botones, antes de pulsar.
3. Los goldens comprueban que el control **está conectado**, no sólo escrito.

**Pruebas** · `quitar-de-la-nota-quita-de-la-nota.test.ts` · `el-boton-dice-por-que-esta-apagado.test.ts`

**Riesgo residual** — Este peligro es **de clase**, no de instancia: cualquier control nuevo puede reintroducirlo. La contramedida permanente es la regla `.claude/rules/el-dato-tiene-que-llegar.md`: comprobar del otro lado, no que el código lo diga.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-009 · Fatiga de alerta: el aviso que importa se ignora

| | |
|---|---|
| **Causa** | Demasiados avisos al mismo volumen; avisos que saltan donde no tocan. |
| **Daño posible** | El médico deja de leer los avisos, incluidos los que pueden matar. |
| **A quién afecta** | Paciente, indirectamente pero de forma acumulativa. |
| **Severidad** | **Alta** |
| **Ocurrencias reales** | REG-181 (**ocho bloques** sobre la nota, ~40 elementos, sólo uno bloqueaba; reportado por el médico: «esto nomás confunde»), REG-178 (aviso de operación en plena consulta), REG-184 (ecos duplicados). |

**Controles**

1. Tres niveles, no ocho recuadros: **BLOQUEA / REVISA / YA EN LA NOTA**.
2. `bloquea` significa «es la razón por la que Firmar no responde», **no** «es lo más grave».
3. Lo que puede matar hoy **no se pliega**, aunque no bloquee.
4. Deduplicación: un aviso, un sitio.
5. Con un paciente enfrente sólo entra lo que impide atenderlo ahora.
6. Regla dura: **tres niveles, punto**. Un motor nuevo entra en una lista existente.

**Pruebas** · `una-barra-y-no-ocho-recuadros.test.ts` (27 casos, incluida una que recorre los nueve orígenes y falla si alguno pierde su nivel)

**Riesgo residual** — **Plegar es esconder.** La vía asumida y el desajuste temporal se leen menos que antes. Es un precio aceptado a cambio de que el rojo vuelva a significar algo, y está escrito en el código (`EL_PRECIO_QUE_SE_PAGA`).

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## PEL-010 · El sistema afirma más integridad de la que tiene

| | |
|---|---|
| **Causa** | Una etiqueta de cobertura escrita a mano que no deriva del alcance real. |
| **Daño posible** | Se confía en un sello que no cubre lo que dice cubrir. En una revisión regulatoria o judicial, esa afirmación es la que se lee. |
| **A quién afecta** | Médico. Institución. |
| **Severidad** | **Media-alta** (regulatoria, no clínica directa) |
| **Ocurrencias reales** | REG-199 (el sello decía «cubre todo» y el propio módulo documentaba que no). |

**Controles**

1. La cobertura se **deriva** de la lista de exclusiones: las dos no pueden decir cosas distintas.
2. `cubreTodo` significa «no queda nada fuera», no «es la última versión».
3. Cada exclusión tiene nombre legible y **razón escrita**.
4. `PROMPT_VERSION` con huella del contenido: un prompt que cambia sin subir versión pone la suite en rojo.

**Pruebas** · `e0-12-sello-integridad.test.ts` · `la-version-del-prompt-no-miente.test.ts`

**Riesgo residual** — `transcripcionMotor` **sigue sin sellarse**. Sellarlo exige subir a `hashVersion` 4 con migración; hacerlo mal marcaría como «alteradas» notas firmadas que están intactas. Registrado como **D-08** en `agent-state/OWNER_DECISIONS_REQUIRED.md`.

**Responsable** — Dr. David Alonso Rodríguez Luna · **Aprobación**: ☐ pendiente

---

## Lo que este registro NO cubre todavía

Dicho explícitamente, porque un registro de peligros que aparenta ser completo es
peor que uno que declara sus huecos:

- **Paciente equivocado** — el charter lo exige en cero (§H6). No hay todavía un caso de peligro escrito ni una prueba adversarial dedicada.
- **Fuga entre consultorios** — hay pruebas de aislamiento en CI (`aislamiento-tenant`), pero no un caso de peligro en este formato.
- **Inyección de instrucciones dentro del dictado** — el control existe (§11 del prompt) y desde REG-179 el reporte llega; falta el caso de peligro y su corpus adversarial.
- **Embarazo, pediatría, ajuste renal** — hay motores y pruebas, no casos de peligro escritos aquí.

Estos cuatro son el siguiente lote de este documento.

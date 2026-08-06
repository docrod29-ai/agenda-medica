# Bitácora reanudable — tarde del 2026-08-01

**El objetivo del Dr. es terminar el MASTER EXECUTION LOOP V6 completo.** El
estado fase por fase, verificado contra el código, está en
**`V6-PRACTICE-GA.md`** — léelo también: dice qué falta de cada P y en qué orden
seguir. Este archivo es el registro de versiones y la cola fina.

**Para retomar:** lee este archivo primero. Cada punto dice si está HECHO, EN CURSO
o PENDIENTE, y lo pendiente trae el archivo y la línea por donde entrar.

Rama: `nexus-os/sesion-2026-07-29`. Despliegue: `npx vercel --prod --yes --archive=tgz`.
**Las reglas de Firestore se despliegan APARTE**: `npx firebase deploy --only firestore:rules --project nexomed-agenda`.

Verificar despliegue (lo único fiable):
```
curl -s "https://agenda-medica-one.vercel.app/sw.js?x=$RANDOM" | grep -oE "nexusmed-v[0-9]+"
```

---

- **v1038** — Cobro duplicado del anticipo (REG-153). `stripe/webhook/route.ts`: id determinista `stripe_{session.id}` + `create()`; ALREADY_EXISTS = éxito idempotente y se sigue a saldar la cita. La marca se sigue retirando al fallar (impide el estado peor: cobrado en Stripe e invisible en Finanzas). Golden de 7 casos.
- **v1039** — REG-155: «el servidor rechazó el permiso» con permiso correcto. Verificado EN VIVO en su cuenta (rol admin, clínica activa, pase libre, token vivo, nota de 10 KB, `estado` presente): el documento simplemente ya no existía y `updateDoc` sobre un ausente vuelve como PERMISSION_DENIED. `updateNota` ya lo sabía (`prev.exists()`) y escribía igual. Ahora se distingue y la consulta se recrea sola, en autoguardado y en firma, siempre como borrador. + REG-156: evidencia con 300 s y presupuesto descontando lo gastado; el aviso ya no culpa a la llave ante un timeout. + REG-154: la «O» de ARCO ejecuta la baja de contacto.
- **v1040** — REG-157: el ORIGEN de REG-155. `descartar()` borraba el documento y no soltaba `notaIdRef`; un autoguardado en vuelo escribía sobre lo borrado (de ahí el «permiso denegado»). Y con la recuperación de REG-155 habría RECREADO la consulta recién descartada — riesgo que introdujo mi propia reparación, cerrado en el mismo día. `descartadaRef` marcada antes de borrar, id soltado, guarda en el autoguardado y en la recuperación.
- **v1041** — REG-158 (atribución de voz). El 81,94 % escondía el defecto real: 6 de 9 confusiones venían de los 2 diálogos con UNA sola voz, donde «¿Ha fumado? Fumé como 10 años» se atribuía ENTERO al médico — el mismo mecanismo que la nota que inventaba lo que el paciente negó, pero antes en la cadena. Módulo puro `separacion-fallida.ts` con dos vías (pregunta-en-2ª + responde-en-1ª, y el vocativo «doctor»); medido con `scripts/medir-separacion.ts` sobre las 12 transcripciones ya pagadas: 2/2 detectados, 0 falsos positivos. HONESTIDAD: 7 de las 9 confusiones son de la misma pareja de voces sintéticas (echo/shimmer), así que ese número no es publicable como métrica de producto.
- **v1042** — REG-159: el WER de los 6 000 audios, medido y publicable. `scripts/medir-wer-limpio.ts` separa el fallo del reconocedor del fallo del corpus reutilizando las 5 999 transcripciones ya pagadas (coste cero). El corpus roto costaba 10 puntos: 35,77 % → **25,55 %** crudo, **22,81 %** tras pipeline, recall clínico **71,48 %**. Se publican los DOS números y las 1 364 filas excluidas, con los límites (una voz sintética, sin ruido, es un PISO). HALLAZGO: el pipeline casi no mueve el recall (+0,13 pp) — no recupera lo que el motor no oyó; la palanca está en el sesgo de vocabulario. Informe en docs/voice/WER-MEDIDO.md.
- **v1043** — REG-160 (integridad del expediente + restauración). El importador validaba `_coleccion` y escribía en `_ruta`: se podía declarar «patients» y pisar una NOTA FIRMADA con Admin SDK, saltándose la inmutabilidad NOM-024. Y regresión MÍA de v1037: al volver `hijas` un árbol, el importador interpolaba objetos → `patients.[object Object]`, así que TODA nota se rechazaba al restaurar (respaldo que se exporta y no se puede meter). Una sola reparación cierra ambos: la colección se DERIVA de la ruta.
- **v1044** — REG-161 (PHI). El reporte de errores guardaba la ruta cruda, y las rutas de esta app llevan el patientId dentro (`/consulta/<id>`); esos reportes van a `errores`, colección RAÍZ legible desde la consola del dueño de la plataforma. `redactarRuta()` conserva la forma `/consulta/:id` y borra el valor; la query se tira entera; mensaje y stack pasan por `redactarString` (que ya existía y no se usaba aquí).
- **v1045** — REG-162 (PHI local). La cola `nx.audit.pendientes` sobrevivía al cierre de sesión (la limpieza sólo mira PREFIJOS_PHI) con paciente y evento dentro, en equipo compartido. NO se purga —un asiento sin mandar es registro medicolegal—: se DRENA antes del signOut, mientras el token sirve. Lo que no se pueda enviar se queda, y los asientos de otra persona siguen esperándola.
- **v1046** — REG-163 (aislamiento entre consultorios). `whatsapp_channels/{id}` decide a qué consultorio se entrega un mensaje entrante, y los TRES caminos de conexión lo sobrescribían con `set()` sin mirar de quién era: un segundo consultorio reclamando el mismo número se llevaba los mensajes de los pacientes del primero. `lib/whatsapp/reclamar-canal.ts` rechaza con 409 explicando qué hacer, permite la reconexión propia y es fail-closed si no puede leer el índice.
- **v1047** — REG-164 (PHI + IDOR). El candado de REG-030 se desactivaba solo: el dueño del transcript se escribía con `void` (sin await, y en serverless la función puede terminar antes) y la lectura era fail-open («sin registro, se permite»). Ahora se espera la escritura —y si falla se purga el trabajo en el proveedor y se pide reintentar— y sin dueño registrado no se entrega.
- **v1048** — REG-165. DECISIÓN DEL DR (4-ago): «déjalo oral pero que avise si no se dictó la vía». El prompt de extracción trae `"via": "oral"` en su plantilla, así que el modelo la rellenaba SIEMPRE y la receta afirmaba una vía que nadie dijo. `lib/expediente/via-asumida.ts` lo decide mirando la CITA del fármaco (no preguntándole al modelo: «esto no se dijo» es lo que un generativo peor distingue). Un solo aviso agrupado, ámbar, con «Ya lo revisé».
- **v1049** — REG-166. El vigilante tenía un punto ciego declarado por él mismo: si se caía ÉL, nadie leía los latidos. Tampoco estaba en `PERIODO_MIN`, así que no había con qué comparar el suyo. Ahora entra (15 min, atado a vercel.json por test) y la FRANJA DEL DUEÑO lee los latidos — el lector deja de ser él. Sin webhook, que sigue bloqueado en el Dr.
- **v1050** — REG-167 (P0 de voz). Al medir el sesgo por primera vez (petición del Dr) salió 0,00 pp, y la razón era grave: la ruta mandaba `word_boost` + la LISTA de modelos; como `word_boost` es incompatible con universal-3-5-pro, el proveedor descartaba ese modelo y corría con universal-2 — **el parámetro puesto para mejorar la precisión degradaba el motor al modelo viejo en cada consulta, sin error ni aviso**. Y el 0,00 se explicaba: «sin sesgo» corría en el modelo nuevo y «con sesgo» en el viejo; se comparaban modelos, no sesgos. FIX: `keyterms_prompt` + UN modelo explícito (sin lista no hay resolución silenciosa) + presupuesto en CARACTERES (el límite real son 2 672 tokens, descubierto a base de rechazos: primero «no more than 1000 words», luego los tokens). El sesgo pasa de 200 a **491 términos** con el paciente primero. LECCIÓN repetida: un test de contrato comprueba que el código diga lo acordado, no que el proveedor lo acepte.
- **v1051** — REG-168: el foso MEDIDO por primera vez. Sesgo con expediente: 78,89 % → 82,91 % de acierto en término clínico (WER 26,26 → 22,07). El reparto es lo que importa: 2,01 pp del catálogo genérico (lo hace cualquiera) y **2,01 pp del expediente del paciente** (exige historia clínica + motor en la misma mano). Rescata `erisipela`, `pielonefritis enfisematosa`, `HFNC`, `PCWP`, `NEWS2`. Informe en docs/voice/SESGO-MEDIDO.md con sus límites (una voz sintética, sin ruido, es un PISO).
- **v1052** — REG-169 (bucle de corrección). `paresDeUnaNota` sólo aprendía con MISMO número de palabras: medido, el **80,6 % de las correcciones se descartaba entero**. Nuevo `lib/asr/alineacion.ts` (LCS puro): sustitución 1:1 se aprende; borrado/adición no; varias seguidas se descartan; y «una corregida + algo añadido» (meropenen → meropenem intravenoso) se empareja por SIMILITUD ORTOGRÁFICA exigiendo una sola candidata. HONESTIDAD: sobre el corpus sólo da +6 % y los ejemplos son ruido de las filas corruptas — ese corpus compara hablado vs escrito, NO correcciones del médico; la ganancia real exige notas dictadas vs firmadas y sigue sin medir.
- **v1053** — REG-170. Verificado leyendo SU Firestore: de las 10 notas firmadas, las 10 tienen `transcripcionCruda` y **NINGUNA** tiene `transcripcionMotor`. Sin esa mitad no hay par → el bucle de corrección (módulo puro, filtros, tests) **nunca produjo una sola palabra aprendida**. Causa: el campo se guarda al dictar, pero al CARGAR una nota no se rehidrataba, y firmar suele ser otra sesión con el grabador vacío. Fix: `transcripcionMotorGuardadaRef` + respaldo en `construirNota`. Las 10 firmadas no se tocan (inmutables NOM-024): el bucle acumula desde la próxima consulta.
- **v1054** — La lección estructural del día. REG-167 (el sesgo degradaba el motor), REG-170 (el bucle nunca aprendió) y REG-160 (validaba un campo y escribía en otro) son EL MISMO defecto: el dato no llega y la prueba de contrato no puede verlo. Nueva regla `.claude/rules/el-dato-tiene-que-llegar.md` + `scripts/verificar-invariantes-de-datos.md` (recuentos sobre datos reales, nunca contenido: llevan PHI y por eso no puede vivir en CI).
- **v1055** — REG-171 (P0 clínico, encontrado en SUS pacientes). El separador de alergias incluía la barra, y «Trimetoprima/sulfametoxazol (TMP/SMX)» se partía en ['Trimetoprima','sulfametoxazol (TMP','SMX)']. De ese parser leen la compuerta de la receta, la nota, FHIR y el sesgo del reconocedor: un alérgeno «SMX)» no coincide con ningún fármaco → **el cruce alergia↔fármaco puede no dispararse con el antibiótico al que SÍ es alérgico**. Fix: la barra sólo separa con espacio a algún lado. MÉTODO: mi primera medición dio un falso positivo (8 negaciones «no reconocidas») por usar un regex de prueba más pobre que el del producto; con el real, 14/23 se leían bien y el defecto verdadero era otro.
- **v1056** — REG-172 (seguridad de medicación, encontrado en SUS notas firmadas). De sus 28 medicamentos: 23 con vía `oral`, **4 con «no especificada»** y 1 con «subcutanea» — dos valores que NO existen en el enum. Eso apagaba DOS cuidados: el guard de parenterales puros (`insulina + 'no especificada'` NO se corregía a sc, aunque con 'oral' y con vacío sí) y el aviso de vía no dictada de REG-165. Nuevo `via-normalizada.ts`: traduce lo traducible y trata los huecos como AUSENCIA. Lo desconocido se devuelve tal cual, sin inventar vías.
- **v1057** — REG-173 (hueco de FLUJO, no de motor). `revisarUnidadDosis` funciona bien y marca severidad ALTA con la dosis vacía, pero sólo corría en la pantalla de la RECETA y en hospitalización — no en la consulta, que es donde se firma. En sus notas firmadas hay **4 medicamentos sin dosis de 28**: el aviso llegaba cuando la nota ya era inmutable. Ahora se ve antes, en rojo, descartable, y NO bloquea (qué es exigible en una receta sigue siendo decisión suya).
- **v1058** — REG-174. DECISIÓN DEL DR (5-ago): «que bloquee la firma si falta la dosis», tomada con el dato delante (4 medicamentos sin dosis de 28 en notas ya firmadas). Bloquea sólo `dosis_sin_cifra`; la cifra SIN UNIDAD sigue avisando sin bloquear — él pidió la dosis y ampliarlo sería decidir por él (PENDIENTE de su decisión). «Ya lo revisé» no se ofrece sobre lo que bloquea: sería una promesa falsa.
- **v1059** — REG-175. AMPLIACIÓN DEL DR: «bloquea también si falta la unidad». Es el caso peor de los dos: sin cantidad la receta NO se despacha (alguien pregunta), pero con la cifra sin unidad SÍ se despacha con la unidad que suponga quien la lea — «Levotiroxina 100» son mil veces la dosis. Se retiró «Ya lo revisé» de este aviso (los dos casos bloquean: no hay nada que descartar, hay algo que escribir) y el filtro de revisados, que ya era código muerto. MÉTODO: el test que comprobaba la ausencia del botón buscaba la FRASE en el archivo y fallaba porque el comentario que la explica la menciona; ahora busca el `<button>`.
- **v1060** — REG-176. Medido el impacto de la compuerta con el motor REAL: 4 de 8 notas del Dr NO se habrían podido firmar, y lo que las bloqueaba era medicación previa que el paciente refiere sin saber la dosis («Antihipertensivo no especificado»). Se le plantearon 3 caminos y eligió «haz la B»: botón «No la sabe» que declara el hecho. CLAVE: la declaración es un acto del médico (frase canónica, comparación literal); «No especificada» —lo que escribe la IA— SIGUE bloqueando, si no la compuerta quedaba desactivada de vuelta.
- **v1061** — REG-177. La RAÍZ COMÚN de v1048, v1056 y v1060: cuando el modelo no captura un campo escribe «No especificada», y ese texto se guardaba como si fuera un dato. Apagó el guard de «insulina · oral», apagó el aviso de vía no dictada y bloqueó la firma de la mitad de sus notas. Reparado en DOS capas: el prompt (regla 1-bis «vacío significa vacío» + la plantilla deja de traer `"via": "oral"` de ejemplo) y el ESQUEMA Zod, que es por donde entra toda extracción — un prompt es persuasión, el esquema es garantía. `hueco-textual.ts` es ahora la única lista; `via-normalizada.ts` la tenía duplicada. La frase del botón «No la sabe» (v1060) sobrevive intacta: es una declaración del médico, no un hueco del modelo. MÉTODO: comprobado que el golden puede ponerse rojo — sin el saneo fallan 9 de 25.
- **v1062** — REG-178. PASO 1 del plan `docs/maintenance/PLAN-2026-08-05-la-nota-manda.md`. En la captura de su consulta salían OCHO bloques de aviso apilados sobre la nota; el octavo era «5 trabajos automáticos dejaron de correr», en rojo, que no se arregla desde la consulta ni afecta al paciente. La franja YA había aprendido esto el 4-ago con los timeouts, pero el filtro preguntaba «¿es urgente?» y un cron muerto lo es. La pregunta correcta con alguien delante: «¿se arregla desde aquí y le afecta a él?». Ahora en consulta/expediente/hospitalización/UCI sólo entra lo que impide atender AHORA. El silencio es el valor seguro: lo que no declara, se calla.
- **v1063** — REG-179/180. LA RAÍZ del recuadro naranja de 9 viñetas que mandó: NO era culpa del modelo. La regla G prohíbe hablar del audio en la prosa y la 22 le ordenaba escribir «no inteligible, confirmar» — atrapado entre las dos, sacaba el hueco de la nota y lo tiraba al recuadro. Ni una línea le enseñaba cómo SE ESCRIBE un hueco. Reescrita la 22 (en términos del paciente), nueva 19-bis («un hueco documentado ES documentación válida NOM-004»), acotada la 17 (máx 3 renglones, sólo lo que exige acción) y corregida la MISMA orden vieja en confianza-audio.ts (la otra ruta). Además: `safety.contenido_sospechoso` —el reporte de intentos de manipulación del dictado— se pedía y zod lo BORRABA por no estar declarado; mismo fallo que alergia_conflicto, mismo objeto. Y `Spiolto` no estaba en el vocabulario: por eso oyó «Espiolto o espineto». Panel de 2 especialistas en paralelo; verifiqué yo los 4 hallazgos antes de tocar.
- **v1064** — REG-181. PASO 2 del plan: los SIETE recuadros clínicos apilados sobre la nota son una barra de tres niveles (BLOQUEA / REVISA / YA EN LA NOTA). Módulo puro `avisos-consulta.ts` con la tabla de niveles a la vista + `AntesDeFirmar.tsx`. Ningún aviso desapareció: lo que bloquea quedó MÁS visible, y lo que puede matar hoy (alergia↔medicamento) NO se pliega nunca aunque no bloquee — «bloquea» significa «es por lo que Firmar no responde», no «es lo más grave». 4 de las 9 viñetas de «datos críticos» eran ecos de la compuerta de dosis y ahora se deduplican. MÉTODO: 8 pruebas existentes miraban el `tone=` del JSX; se reapuntaron al módulo puro, y ADEMÁS detecté que mi propio script de sellado había BAJADO el minCasos de 15 archivos (lo que el sello existe para impedir) — restaurados todos.
- **v1065** — REG-182. `fields_auto_filled` y `fields_requiring_review` se le pedían al modelo en CADA nota y nadie las leía (declaradas en esquema y en la interfaz de RevisionPanel, cero componentes las pintan). El gasto era lo de menos: `needs_review` ya viaja POR CAMPO, así que eran el mismo hecho contado dos veces — y dos fuentes de verdad se desincronizan. Se dejan de pedir, el esquema las sigue aceptando (notas guardadas), y lo que hacía falta se DERIVA con `camposQueRequierenRevision`. Mismo patrón que REG-179 visto del otro lado.
- **v1066** — REG-183. El HUECO ESTRUCTURAL detrás de REG-176: `Medicamento` no distinguía «el paciente ya lo toma» de «se lo receto hoy», y la compuerta de dosis las trataba igual — por eso 4 de sus 8 notas se bloqueaban por medicación previa. Nuevo `procedenciaClinica` en tipo + esquema + prompt (regla 6-ter), SIN valor por omisión (dárselo sería «No especificada» otra vez) y con orden explícita de OMITIRLO si no lo sabe. El aviso ya dice de cuál se trata. NO cambia qué bloquea: eso lo decidió él y ahora que el eje existe SE LE PUEDE PLANTEAR si la compuerta debe aplicar sólo a lo que se prescribe hoy — decisión suya.
- **v1067** — REG-184. Cierra los ecos del recuadro naranja: «Exploración física no realizada» salía ahí Y la sección obligatoria vacía ya impide firmar por validarNOM004 — doble reporte. Ahora los faltantes se cruzan también contra `validacion.errores`. Y el prompt se contradecía OTRA VEZ: al acotar la regla 17 en v1063 quedaron vivas las líneas 66 y 243 mandando lo contrario. LECCIÓN (mismo patrón que REG-180): corregir una regla obliga a buscar TODAS sus menciones, o el modelo sigue recibiendo la orden vieja por otro sitio.
- **v1068** — REG-185. GUARDIÁN del prompt. El mismo fallo apareció DOS VECES la misma noche (REG-180 y REG-184): se corrige una regla y no se buscan todas sus menciones; son ~700 líneas y 30+ reglas numeradas. 5 familias comprobadas en LAS DOS RUTAS (prompts.ts + confianza-audio.ts, que es por donde se coló la primera vez), + las 3 que ninguna versión puede romper. Busca la ORDEN, no la mención (la regla G tiene que poder citar las frases para prohibirlas — el falso positivo que ya mordió en v1059). VERIFICADO que puede ponerse rojo: reintroduje las dos contradicciones originales y falla en las dos.
- **v1069** — REG-186/187. Primeros frutos de la AUDITORÍA DE 9 DIMENSIONES (78 agentes, 68 hallazgos, 52 confirmados tras refutación adversarial). (186) «ECG con infradesnivel en el segmento ST» se imprimía «infradesnivelST»: un `?` de más hacía OPCIONAL el «de la consulta» y el saneador de metatexto se comía las localizaciones anatómicas — reproducido con el motor real, 4 de cada 5 frases clínicas amputadas, y la primera es un infarto. (187) Al reconocedor se le mandaba el NOMBRE DEL CAJÓN («Sepsis y choque») en vez de las palabras: UCI 4→67 términos, PROA 1→29. El sesgo es LO ÚNICO que cambia lo que la máquina oye. Tercera vez del patrón «el trabajo está hecho y no llega» (REG-167, v1025, ésta).
- **v1070** — REG-188. EL MÁS TRANSFORMADOR de los 52 hallazgos: los motores clínicos recibían SÓLO la receta de hoy. `medicamentosVigentes()` y `problemasActivos()` ya se calculaban y se pintaban en pantalla — no llegaban al motor («escrito y sin conectar», el patrón más caro del repo). Caso: warfarina de marzo + ketorolaco hoy = la regla de sangrado existe, está probada y NO disparaba. Nuevo `cuadro-completo.ts` que une las dos listas marcando procedencia (el motor la necesita para redactar: «el ketorolaco de hoy con la warfarina que ya toma»). Lo de hoy manda si el fármaco está en las dos. NO cambia ninguna compuerta: lo que entra son datos y los motores que los consumen son nivel `revisa`. Dónde NO se aplica: `tareasDeNota` (el worklist es para acordarse de lo pedido, no para razonar). De paso el trinquete bajó 97→96.
- **v1071** — REG-189 (hallazgos D1+D2 de la auditoría). El botón de Firmar y la barra se CONTRADECÍAN: el botón se apagaba sólo con NOM-004 (así que con dosis incompleta se veía ENCENDIDO y fallaba al pulsarlo) y la barra contaba sólo la dosis (así que con una sección vacía decía «nada te impide firmar» junto a un botón gris). Nuevo `por-que-no-se-firma.ts`: una sola fuente para el botón, la barra y el texto. El motivo va en el `title` y en un renglón JUNTO A LOS BOTONES —el mensaje ya existía y era inalcanzable: el del toast sólo salía al pulsar y el de NOM-004 queda fuera de pantalla cuando el médico está abajo. NO cambia la política: lo que impedía firmar ayer impide hoy.
- **v1072** — REG-190 (hallazgo G1). El motor de SOBREDOSIS y ERROR DE DECIMAL («500 mg donde iban 50») tenía UN solo llamador: la pantalla de la receta, que se abre desde una nota YA FIRMADA — cazaba el error cuando el paciente ya se había ido con la receta en la mano. La lógica que arma la entrada vivía dentro de un useMemo de esa pantalla, así que traerla no era llamar sino copiar: extraída a `dosis-de-la-lista.ts`. Ahora corre en la consulta sobre la lista entera con edad y peso. Nivel `revisa` (qué bloquea lo decidió él) pero CRÍTICA no se pliega. NINGÚN umbral nuevo: todos del catálogo que él ya revisó (REG-041).
- **v1073** — REG-191 (hallazgo E3). `PROMPT_VERSION` llevaba SIETE cambios de prompt sin moverse: dos notas con la misma etiqueta podían venir de prompts distintos y el lote afectado por un fallo NO se podía acotar (IEC 62304). Y el candado estaba PUESTO AL REVÉS: el test la pineaba al literal, así que subirla rompía la suite — su intención era exigir que cambiara y su implementación lo impedía. Nuevo `prompt-version.ts` con huella del contenido de LAS DOS rutas (prompts.ts + confianza-audio.ts, por donde se coló REG-180); cuando falla trae la huella nueva en el mensaje. Formato `nota-AAAA-MM-DD-N`. VERIFICADO que puede ponerse rojo.
- **v1074** — REG-192 (auditoría de `temporalidad.ts`, el motor que EVAL-002 señala como el único sin corpus). Las DOS compuertas que confrontan el dictado con la nota —negación y temporalidad— buscaban el padecimiento con un `indexOf` **por forma y una sola vez**: en una nota bien redactada la primera aparición es la correcta (está en antecedentes, o viene negada), se descartaba, y ahí acababa la búsqueda. La afirmación de más abajo —el defecto que hay que cazar— no se miraba nunca, así que la compuerta callaba PRECISAMENTE en la nota mejor escrita. Y la ventana de 60 caracteres cruzaba el renglón: un «no tiene antecedentes de tuberculosis» de arriba exculpaba al asma de abajo — riesgo que las dos copias llevaban escrito en su propio comentario y que ninguna había cerrado. Nuevo `donde-lo-dice-la-nota.ts`: el rastreo una sola vez, todas las apariciones, ventana cortada en el límite de oración (los dos puntos NO cortan: «Antecedentes personales: neumonía» es lo correcto). NADA clínico nuevo: no amplía vocabulario ni decide si algo sigue activo. VERIFICADO que puede ponerse rojo: revertidos los dos módulos, 4 casos en rojo.
## Desplegado esta sesión

| Versión | Qué |
|---|---|
| v799 | Motor de tareas clínicas (P17/P18) + `/pendientes` |
| v800 | 10 defectos: doble cobro del anticipo, citas sin verificar, sala de teleconsulta caducada, bloqueos de agenda, timeouts de IA, tamizaje→receta |
| v801 | Trazabilidad de agenda, cortesías que no se registraban, alerta crítica sin rastro |
| v802 | El anticipo saldaba la consulta entera · CSV que reventaba · contraste AA en tema oscuro |
| v803 | Anular abono liberaba otro cobro · zona horaria de Finanzas · fecha del reembolso · bitácora ARCO/privacidad · foco del modal · 44 px táctiles |
| v804 | `/pendientes` estaba roto en producción: índice compuesto, reglas sin desplegar, tokens CSS inexistentes |
| v805 | Minimizado Google Calendar (iniciales + puntero) · purga del audio en AssemblyAI · aviso de privacidad con proveedores reales |
| v806 | CFDI con defaults inventados · membresías siempre en efectivo · sobreagendar autorizado y auditado |
| v807 | Sobreagendar sólo el médico |
| v808 | Reparto de la asistente: factura sí, borrar/sobreagendar/teleconsulta no |
| v809 | La «C» de ARCO con camino técnico real (supresión o bloqueo) |
| v810 | El tope de 24 huecos borraba la tarde · WhatsApp del bot sin rastro |
| v811 | Al cerrar sesión se borraba lo no guardado (las 4 salidas) · precio falso de $499 |
| v812 | Cambiar de plan cancelaba la clínica · valoración inmuno se borraba sola · censo en spinner eterno |
| v813 | Recarga pagada sin créditos · rebote mudo del plan · dos fugas del respaldo local |
| v814 | Cobrar un ciclo distinto del ofrecido · adivinar mal el plan por importe |
| v815 | Médicos habilitados sin cobrar · pagos huérfanos invisibles |
| v816 | Teléfono del alta era campo muerto · recordatorios en verde sin WhatsApp conectado |
| v817 | El pase de UCI se evaporaba (respaldo local + acuse) · resultados de laboratorio con Escape |
| v818 | Se podía mover dinero entre médicos por «vincular factura» (reglas + 3 tests de emulador) |
| v819 | pagoVencido/disputaAbierta que nadie leía · el año pagado que se perdía al cambiar de plan |
| v820 | Dos pestañas sobre la misma nota se pisaban: guardia de concurrencia |
| v821 | El historial de versiones ya se puede leer · dónde están las tarifas de consulta |
| v822 | Verificación de correo (no existía en ninguna parte) |
| v823 | Borrar expediente desde el navegador: cerrado (la protección NOM-004 vivía en código muerto) |
| v824 | La bitácora se quedaba con huecos: cola de reintento con fallos permanentes descartados |
| v825 | Bajar de plan en el portal de Stripe dejaba los módulos caros (manda el precio, no el metadato) |
| v826 | El portal ARCO no verificaba a nadie, y la solicitud ya ejecuta: acreditación del titular antes del acto irreversible |

---

## EN CURSO — seguir por aquí

### Cola nueva de los auditores de la tarde (verificar cada uno antes de tocar)

**Lanzamiento comercial** (`docs` del auditor de flujo):
1. **El gate de tarjeta bloquea la app entera a un médico nuevo**, pese a que
   `/registro` y `/setup` prometen «14 días de prueba, sin tarjeta».
   `src/app/(dashboard)/layout.tsx:148-154` — `estadoAcceso` devuelve
   `'sin_tarjeta'` para `status: 'trial'`. Y hay un sistema de prueba COMPLETO y
   muerto en `src/lib/finanzas/paywall-prueba.ts`: el `TrialBanner` sólo se pinta
   con `status === 'trial'`, que es exactamente el estado que ya bloqueó la app.
   **Decisión comercial del Dr: ¿la prueba es sin tarjeta o con tarjeta?** El
   código promete una cosa en tres sitios y hace la contraria.
2. ~~Plan Agenda: rebote mudo~~ — HECHO (v813).
   `src/lib/modulos.ts:58` (`/pacientes` es core, `/expediente` no) +
   `src/app/(dashboard)/layout.tsx:404-406` (`router.replace` mudo). La entrada
   del menú se llama «Consulta». Parece la app rota, no un límite de plan.
3. ~~Verificación de correo~~ — HECHO (v822), sin bloquear el acceso. `grep sendEmailVerification` → cero.
   Un correo mal tecleado = cuenta irrecuperable sin soporte humano.
4. ~~Recordatorios encendidos sin proveedor~~ — HECHO (v816).
   (`src/types/index.ts:648`): dos interruptores en verde que no mandan nada.
5. ~~Teléfono del alta~~ — HECHO (v816). `src/app/setup/page.tsx:25`
   tiene el campo en el estado y NINGÚN input; el impreso lee `telefonoAdmin`.
6. ~~Precio de consulta escondido~~ — PARCIAL (v821): el cobro ahora dice dónde fijarlo. Moverlo de sitio sigue pendiente.
7. **El dueño no puede reproducir nada de esto**: `layout.tsx:475` le da pase
   libre. Para validar el lanzamiento hace falta una cuenta con correo ajeno.

**Pérdida de datos** (auditor de pérdida):
8. ~~Panel UCI sin persistir~~ — HECHO (v817). Antes:: salir de la ruta borra el
   pase completo. `src/app/(dashboard)/uci/page.tsx:124` — y tampoco escucha
   `EVENTO_GUARDAR_TODO`. Agrava que el audio se borra de IndexedDB en cuanto
   llega el texto.
9. ~~Resultados de laboratorio con Escape~~ — HECHO (v817)., y
   reabrir los pone en blanco. `hospitalizacion/[internamientoId]/page.tsx:772`.
10. ~~Historial ilegible + sin guardia de concurrencia~~ — HECHO (v820 + v821).
11. ~~Respaldo local sin estudios/preop~~ — HECHO (v813). Antes decía:
    estudios o preop (faltan en las deps). `consulta/[patientId]/page.tsx:1496`.
12. ~~restaurarRespaldo sin notaId~~ — HECHO (v813). — el mismo bug que ya se
    arregló en la ruta automática.

**Stripe** (auditor de suscripciones):
13. ~~Anual que acaba en mensual~~ — HECHO (v814) **y el 2º camino también**:
    verificado el 2026-08-02 en `configuracion/page.tsx:startCheckout` — el
    `ciclo` YA viaja (`ciclo: cicloActual`), con el porqué escrito al lado.
14. ~~Recarga sin créditos~~ — HECHO (v813). Antes: (`ai-keys.ts:205` se traga
    su propio error y el webhook responde 200).
15. ~~Los metadatos de Stripe quedan congelados~~ — HECHO (v825 + v870): manda el
    COBRO, y el metadato se corrige en Stripe cuando el plan se supo por el precio.
16. ~~planPorMonto se equivoca~~ — HECHO (v814).
17. La prueba de 14 días se puede repetir indefinidamente. **PENDIENTE — decisión comercial del Dr: ¿se permite repetir la prueba?**
18. ~~Asiento sin cobrar~~ — HECHO (v815).
19. ~~Reatribuir el médico de un cobro~~ — HECHO (v818). Antes:
    factura» y mover comisiones (`firestore.rules:619`).
20. ~~pagoVencido/disputaAbierta sin lector~~ — HECHO (v819).
21. ~~Pagos huérfanos~~ — HECHO (v815).

### 1. El tope de 24 huecos corta la tarde en silencio — HECHO (v810)
- `src/lib/availability.ts:15` — `MAX_SLOTS_POR_DIA = 24`, y `:135` corta con `break`
  y un `console.warn` que sólo ve el servidor.
- Duplicado en `src/app/api/public/availability/[clinicId]/route.ts:121`.
- **Escenario:** dentista u oftalmólogo con seguimientos de 15 min de 09:00 a 19:00 =
  40 huecos. La agenda ofrece hasta ~15:00 y el resto del día aparece «sin lugares»,
  en el panel Y en el portal público.
- **Lo que SÍ es mío:** que el corte sea VISIBLE. Hoy es silencioso.
- **Lo que es del Dr:** cuál debe ser el número (o si debe haber tope).

### 2. ~~Los envíos de WhatsApp se pierden sin dejar rastro~~ — HECHO
Verificado el 2026-08-02: el helper `send()` del webhook registra el fallo en
`no-entregados` para las 42 llamadas (se arregló en el helper, no en 42 sitios),
y `public/booking` ya no se traga la confirmación. Lo de abajo es el diagnóstico
original, se conserva por contexto.

<details><summary>Diagnóstico original</summary>

- `src/lib/whatsapp/outbox.ts:44` (`encolarReintento`) tiene UN solo llamador:
  `src/app/api/whatsapp/waitlist-notify/route.ts:163`.
- `src/app/api/whatsapp/webhook/route.ts:381` — el helper `send()` devuelve booleano
  y **36 llamadas lo descartan**. Si falla la confirmación de una cita agendada por
  WhatsApp, la cita queda creada y el paciente nunca se entera.
- `src/app/api/public/booking/route.ts:280` — `.catch(() => {})` traga la confirmación
  del portal público.
- **Nota:** reintentar fuera de la ventana de 24 h exige plantilla aprobada en Meta
  (pendiente del Dr). Lo que sí se puede hacer sin él: que el fallo quede REGISTRADO
  y visible, como ya se hizo con `alertas_no_entregadas`.
</details>

---

## CUADRAGÉSIMA OCTAVA TANDA — v899

### El calendario de Google de los que YA estaban conectados seguía suelto

v875 empezó a escribir el vínculo `médico ↔ uid` **al conectar** Google, y
v876/v877 lo consumieron para que el portal público y el bot descuenten los
eventos del calendario al ofrecer huecos.

Eso sólo cubre a quien **conecte de ahí en adelante**. El que ya estaba
conectado no tiene vínculo: su pantalla dice «Conectado» con su palomita verde,
y la agenda pública sigue ofreciendo huecos encima de su quirófano. Es peor que
el fallo original, porque ahora es invisible — y **nadie va a reconectar por su
cuenta algo que no sabe que le falta**.

Ahora se rellena solo la próxima vez que abre su configuración: esa ruta la
llama su propia sesión, que es justo el momento en que se sabe con certeza quién
es. Con las MISMAS reglas —correo exacto, un solo candidato, si hay duda no se
adivina— y en un solo módulo compartido con el momento de conectar
(`lib/calendario/ligar-en-servidor.ts`), para que afinar una no deje la otra atrás.

Dos cuidados: un vínculo que YA existe **no se recalcula** (moverlo sería
reasignar las horas ocupadas de un médico a otro sin que nadie lo pidiera), y el
relleno **nunca crea** el documento del token: si no hay calendario conectado, no
hay nada que ligar.

Y si aun así no se puede ligar, la pantalla lo **dice, con la consecuencia**:
«un paciente puede reservar encima de algo que ya tienes apuntado», en vez de
dejar la palomita verde prometiendo una cobertura que no existe.

- `src/lib/calendario/ligar-en-servidor.ts` (nuevo), `vinculo-medico.ts`
  (`estadoDelVinculo`, `AVISO_SIN_VINCULO`)
- `src/app/api/calendar/status/route.ts`, `callback/route.ts` (ahora comparten resolvedor)
- `src/app/(dashboard)/configuracion/page.tsx` (el aviso)
- `src/__tests__/vinculo-relleno.test.ts` — 10 pruebas. Total 4779.

---

## CUADRAGÉSIMA NOVENA TANDA — v900

### El color de fondo y borde tampoco cambiaba de tema — y al imprimir salía el de la pantalla

v872 migró los 124 usos de **primer plano** a `--red`/`--amber` y dejó un
trinquete en cero. Los MISMOS colores escritos como `rgba()` para fondos y
bordes se quedaron: **277 sitios en 69 pantallas**.

No rompen el contraste del texto —son capas al 8-12 %— pero comparten la raíz:
un literal no cambia de tema, así que el aviso rojo que en oscuro se lee como
una capa tenue, en claro se ve **exactamente igual de tenue** sobre el fondo
crema y deja de leerse como aviso. Ahora son
`color-mix(in srgb, var(--red) N%, transparent)`, que sí sigue el tema, y el
trinquete tiene un **segundo techo, también en cero**.

El papel se queda con su hexadecimal a propósito: la receta se rasteriza con
html2canvas sobre un clon del nodo y una variable que no resuelva ahí deja sin
color justo lo que existe para verse.

### Y un fallo que encontré al hacerlo: la impresión no fijaba los colores clínicos

La regla `@media print` ponía el fondo blanco y el texto negro, pero **no tocaba
`--red`/`--amber`/`--green`/`--blue`**. Un médico que trabaja en modo oscuro
imprimía sus alertas con el rojo pensado PARA fondo oscuro sobre papel blanco:
el mismo problema de contraste que los tokens vinieron a resolver, sólo que en
la hoja, que es donde ya no se puede corregir. Ahora la impresión fija los
cuatro en los valores del tema claro.

- 69 archivos `.tsx` (fondos y bordes), `src/app/globals.css` (`@media print`)
- `src/__tests__/color-trinquete.test.ts` — segundo techo + prueba de impresión.
  Total 4781.
- De paso: `pacientes/page.tsx` tenía un naranja `#fb923c` en primer plano que
  el trinquete no veía porque no estaba en su lista. Ahora es `--amber`.

---

## QUINCUAGÉSIMA TANDA — v901

### Cuando el paciente reagendaba o cancelaba, el calendario del médico se quedaba como estaba

El paciente movía su cita de martes a jueves desde su enlace: Nexus decía jueves
y el calendario del consultorio —y el del paciente, si estaba invitado— **seguía
diciendo martes**. Cancelaba, y el evento se quedaba vivo: el médico veía ocupada
una hora que ya estaba libre, no se la ofrecía a nadie, y el paciente seguía
recibiendo el recordatorio de una cita que ya había cancelado.

No se sincronizaba **a propósito**, y el motivo estaba escrito ahí mismo: el
token de Google vive por `uid` y quien reagenda es el paciente, así que no había
forma de saber cuál de los médicos conectó ese calendario — y escribir en el
equivocado le mete una cita ajena en su agenda a otro médico y le borra la suya.

**Ese motivo dejó de ser cierto.** v875 empezó a escribir el vínculo
`doctors/{id}.uid`, v899 lo rellenó para los que ya estaban conectados, y desde
v876 la disponibilidad pública ya LEE el freebusy con él. Ahora se usa el mismo
vínculo para escribir.

Sigue sin adivinarse nada: sin vínculo no se toca ningún calendario, sin evento
no se inventa uno, el portal mueve y borra pero **nunca da de alta**, y un fallo
de Google no tumba lo que el paciente ya hizo —la cita ya está en Nexus, que es
la fuente de verdad—, sólo queda marcada.

### Y un hallazgo de paso: un estado fuera de su propia unión

El portal escribía `googleCalendarSyncStatus: 'desincronizado'`, y el tipo
declara `'pending' | 'synced' | 'error'`. El SDK de admin no tipa `update()`, así
que nadie se quejó — pero **ningún lector que compare contra la unión declarada
podría reconocer ese valor nunca**. Era una marca que no podía leerse, en un
campo que hoy tampoco lee ninguna pantalla.

- `src/lib/calendario/sincronizar-servidor.ts` (nuevo)
- `src/app/api/portal/route.ts` (reagendar y cancelar)
- `src/__tests__/sincronizar-portal.test.ts` — 10 pruebas. Total 4791.

---

## QUINCUAGÉSIMA PRIMERA TANDA — v902

### La marca de «calendario descuadrado» se escribía en cinco sitios y no la leía ninguna pantalla

`googleCalendarSyncStatus` es un campo **escrito y nunca leído**, y eso no es una
función a medias: es una promesa. El comentario del portal decía literalmente que
la cita se marcaba «para que el panel pueda mostrarlo y el médico lo arregle con
un clic desde su sesión» — **y ese panel no existía**.

O sea que cuando el paciente reagendaba y Google fallaba, o cuando el médico no
tenía su calendario ligado, la cita quedaba marcada… y él seguía con un evento
equivocado en su calendario sin ninguna forma de enterarse. Exactamente el estado
que la marca existía para evitar.

Ahora la agenda lo **enseña** y lo repara con un clic desde su sesión, que es
donde sí hay token propio (`/api/calendar/sync` escribe con el
`googleTokens/{uid}` del que está en sesión — justo lo que al portal le falta
cuando no hay vínculo).

Con criterio en los bordes:

- una cita **cancelada se borra** del calendario, no se «actualiza»: en el suyo
  —y en el del paciente, si estaba invitado— no debe quedar nada;
- **sin evento no se enseña nada**: nunca estuvo en el calendario, e inventar un
  aviso enseña al médico a ignorar los avisos;
- **`pending` tampoco**: es una escritura en vuelo, no un fallo;
- el aviso dice la **consecuencia** («sigue viva en Google y te ocupa la hora»),
  no «hubo un error», y si vuelve a fallar dice qué revisar en vez de invitar a
  reintentar algo que no se arregla reintentando.

- `src/lib/calendario/reparar-sync.ts` (nuevo, puro)
- `src/app/(dashboard)/citas/page.tsx` (la marca y el botón)
- `src/__tests__/reparar-sync.test.ts` — 12 pruebas. Total 4803.

---

## QUINCUAGÉSIMA SEGUNDA TANDA — v903

### El NEWS2 se enseñaba como si siempre describiera el ahora, y el texto de «parcial» mentía

`lib/clinical/news2-set.ts` implementa la decisión **ICU-Q4.1** del Dr
(29-jul-2026): NEWS2 se calcula sobre un conjunto **contemporáneo** de
observaciones, y si falta una variable el score queda `INCOMPLETE` — nunca se
rellena con el último dato histórico. Estaba **escrito, probado y sin conectar**:
la lista de huérfanos aceptados lo decía con todas sus letras («probado, pero
ninguna pantalla lo usa todavía»).

Mientras tanto la ficha del episodio tomaba el último registro, lo puntuaba y
enseñaba el número. Dos consecuencias:

1. si esa toma estaba a medias, la insignia de la cabecera decía «NEWS2 2» en
   verde, y el aviso de score incompleto viajaba **sólo en el `title`** — que en
   un teléfono nadie ve. Es exactamente la subestimación del deterioro que el
   score existe para evitar;
2. el panel decía «(parcial: sin conciencia/O₂)» **fuera lo que fuera lo que
   faltara**. `calcularNews2` ya devuelve `faltantes` «para poder decirlo en
   pantalla», y la pantalla decía otra cosa: cuando lo ausente era la FR y la
   SpO₂, **le afirmaba al médico algo falso**.

Ahora el encuadre lo decide un módulo, no la pantalla:

- toma completa → «NEWS2»;
- toma a medias con una completa antes → «Último NEWS2 válido · 08:00», más el
  aviso de que la toma de ahora está incompleta y qué le falta (el ejemplo
  literal de la decisión);
- sin ninguna completa → el parcial **declarado como parcial**: esconder un score
  parcial con una SpO₂ de 88 sería peor que enseñarlo mal etiquetado.

Y una corrección **no parte la toma en dos**: se funde encima del original y
manda el valor corregido, sin que corregir un solo valor tire los otros cinco.
(El `CORRECTED` describe al documento corregido, no al valor bueno que salió de
corregirlo; heredarlo dejaba fuera del cálculo justo la versión correcta.)

- `src/lib/hospital/news2-encuadre.ts` (nuevo, puro)
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx`
- `src/__tests__/modulos-sin-conectar.test.ts` — `news2-set.ts` sale de la lista
- `src/__tests__/news2-encuadre.test.ts` — 10 pruebas. Total 4813.

---

## QUINCUAGÉSIMA TERCERA TANDA — v904

### Corregir un signo vital no dejaba constancia de por qué, ni se guardaba a la hora en que se midió

`RegistroSignos` declara dos campos con su decisión escrita detrás:

- **`motivoCorreccion`** — «por qué se corrigió. Su obligatoriedad es política
  del expediente → E0-09/Q4»;
- **`fechaEfectiva`** — «cuándo OCURRIÓ la medición. Una corrección **hereda la
  del original**», que ICU-002b añadió con este ejemplo literal: *«una corrección
  hecha a las 08:03 de un signo tomado a las 08:00 se guardaba con `fecha: 08:03`;
  el NEWS2 retrospectivo de las 08:00 debe usar 92»*.

El formulario de la ficha **no escribía ninguno de los dos**. Los campos se
añadieron al tipo, se documentaron con su decisión, y el único sitio del programa
que crea correcciones siguió sin usarlos:

- el expediente registraba que un signo vital cambió y **nunca por qué**. En una
  revisión —o en un juicio— un valor corregido sin justificación es exactamente
  lo que se pregunta;
- y la corrección quedaba **fuera de la hora a la que pertenece**, que es el
  fallo que esos campos vinieron a reparar.

Ahora la corrección pide el motivo (sólo al corregir: capturar no tiene nada que
justificar), hereda la hora de medición del original **y lo dice antes de
guardar**, y la tabla ordena por la hora de la medición y enseña el motivo.

**No se bloquea el guardado si se deja vacío**: si el motivo es obligatorio o no
es política del expediente, y eso lo decide el Dr, no esta pantalla. Lo que sí se
hace es no callarlo — sin motivo, la tabla dice «sin motivo declarado» en ámbar.

- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx`
- `src/__tests__/correccion-signos.test.ts` — 8 pruebas, incluida la del ejemplo
  literal de la decisión (el NEWS2 de las 08:00 usa 92). Total 4821.

---

## QUINCUAGÉSIMA CUARTA TANDA — v905

### La tabla de signos no enseñaba el oxígeno en ninguna parte

Una SpO₂ de 94 respirando aire ambiente y una SpO₂ de 94 con 5 L/min son dos
pacientes muy distintos. La tabla del episodio los pintaba **idénticos**: no
tenía columna de oxígeno.

Y el dato existía. `RegistroSignos` declara `oxigeno`, `oxigenoFlujoLpm` y
`oxigenoFiO2`; el adaptador del monitor traduce los dos últimos desde LOINC
(3151-8 y 3150-0) y el export FHIR los emite. O sea que **se guardaban, viajaban
a un sistema externo, y el médico que abría la ficha no los veía** — ni tenía
forma de teclearlos.

Ahora hay columna de O₂, y el formulario deja capturar flujo y FiO₂ cuando se
marca que recibe oxígeno (sólo entonces: preguntarlo siempre invita a rellenarlo
en un paciente que respira aire).

Dos cuidados:

- **«aire» y «—» son etiquetas distintas.** Un guion donde debería decir aire
  ambiente es un dato que falta, no un paciente sin oxígeno.
- **Si llegan cifras de oxígeno sin el indicador que NEWS2 necesita, NO se
  deduce.** Se marca con ⚠ y se dice que el score puede quedar por debajo, porque
  decidir que un flujo implica O₂ suplementario es una regla clínica —y aplicarla
  cambiaría el NEWS2, que suma puntos por ese modificador—. **NEEDS_CLINICAL_REVIEW.**

- `src/lib/hospital/oxigeno.ts` (nuevo, puro)
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx`
- `src/__tests__/oxigeno-signos.test.ts` — 10 pruebas. Total 4831.

---

## QUINCUAGÉSIMA QUINTA TANDA — v906

### La cortesía no aparecía en la caja, y la tasa de cobro la castigaba como si fuera un descuido

`exentarCobro` guarda con todo cuidado **quién** autorizó la cortesía, **cuándo**
y **por qué** — «una decisión deliberada y AUDITADA, no un cobro de $0 que
ensucie el corte de caja», dice su propio comentario. Y esos tres campos
(`exentoPor`, `exentoPorNombre`, `exentoEn`) no los leía **ninguna pantalla**.

Dos consecuencias, las dos sobre dinero:

1. **El corte de caja ni las mencionaba.** Diez atendidos, ocho cobrados, dos de
   cortesía, y la caja mostraba ocho sin rastro de los otros dos. Quien cuadra el
   dinero no podía distinguir «dos que autorizó el doctor» de «dos que a alguien
   se le olvidó cobrar» — que es exactamente la diferencia entre un control y un
   hueco.
2. **La tasa de cobro las contaba como cobranza fallida.** `cuentasPorCobrar` ya
   las excluía —«el médico decidió no cobrarlas, no son deuda»—, pero el
   porcentaje bajaba igual que con un olvido: la pantalla castigaba una decisión
   deliberada y la presentaba con la misma cara que un descuido.

Ahora la tasa responde «de lo que **sí tocaba** cobrar, cuánto se cobró», las
cortesías se cuentan aparte y **se dice** que están fuera de la tasa, y hay un
panel con el rastro completo: paciente, hora, motivo y quién la autorizó. Un
registro viejo sin motivo dice «Sin motivo registrado» en vez de inventar uno.

⚠️ **Cambia un número que quizá esté siguiendo**: la tasa de cobro sube en los
días con cortesías, porque ya no las cuenta como fallos. El conteo aparece al
lado para que se pueda cuadrar con lo de antes.

- `src/lib/corte-caja.ts` (`Embudo.cortesias`, `cortesiasDelDia`)
- `src/app/(dashboard)/corte-caja/page.tsx`
- `src/__tests__/cortesias-corte.test.ts` — 9 pruebas. Total 4840.

---

## QUINCUAGÉSIMA SEXTA TANDA — v907

### El corte de caja enseñaba el cobro anulado, pero no quién lo anuló

`cancelarCobro` exige autor, y su propio comentario dice por qué: *«sin ellos una
anulación es dinero que se esfuma del corte sin nadie a quien preguntar»*. Las
reglas de Firestore lo sellan además contra el uid de quien firma, con un
comentario que llama a lo contrario *«sustracción de efectivo indetectable»*.

Y el corte de caja —la **única** pantalla donde alguien cuadra el dinero—
enseñaba el importe, el paciente, el motivo y la fecha… **y no quién**.

O sea: el campo anti-fraude estaba guardado, validado en el servidor, y ausente
justo donde servía. El control existe cuando se puede preguntar.

Ahora se enseña. Y como `canceladoPor` es un uid, y un uid no es una persona,
desde v907 **se sella también el nombre** al anular —lo mismo que ya hacía la
cortesía con `exentoPorNombre`—. Para las anulaciones anteriores se traduce el
uid con la lista del consultorio (el vínculo `doctors/{id}.uid` que v875/v899
escribieron), y si no aparece se enseña el uid recortado, que es buscable: **un
hueco se lee como «nadie lo anuló»**, que es justo la impresión que este campo
existe para impedir.

Las reglas no cambian: la rama de anulación no usa `hasOnly`, así que el campo
nuevo pasa sin tocar `firestore.rules`.

- `src/lib/cobros.ts` (`canceladoPorNombre`), `src/lib/corte-caja.ts` (`quienAnulo`)
- `src/app/(dashboard)/corte-caja/page.tsx`, `finanzas/page.tsx`
- `src/__tests__/quien-anulo.test.ts` — 9 pruebas. Total 4849.

---

## QUINCUAGÉSIMA SÉPTIMA TANDA — v908

### La bitácora de cumplimiento enseñaba doce eventos con su nombre interno de base de datos

La pantalla de cumplimiento es la que se le pone delante a un auditor: es la
trazabilidad de NOM-024 hecha visible. Y su lista de etiquetas vivía **suelta
dentro del propio `page.tsx`**, así que la bitácora podía crecer sin que nadie se
enterara de que a la pantalla le faltaban nombres.

Doce eventos salían en crudo: `hosp_administracion` en vez de «Administró
medicamento», `cobro_exento`, `cita_borrada`, `foto_clinica_borrada`… Media
bitácora en jerga de base de datos no es trazabilidad, es un volcado.

Y cinco de ellos —los del portal y el bot— se escribían directo con el Admin SDK
**sin pasar por `logAudit`**, así que ni siquiera estaban en el tipo: nadie podía
notarlo desde el compilador.

Ahora el mapa vive junto al tipo, los cinco entraron a `AuditEvento`, y los del
paciente se nombran **diciendo que fue él** («El paciente canceló (portal)»),
porque en una revisión un «canceló» sin sujeto se lee como que lo hizo el
consultorio — justo lo contrario de lo que pasó.

Y queda un **guardián**: una prueba recorre el repositorio, junta cada
`evento: '...'` que se escribe de verdad y falla si alguno no está en el tipo o no
tiene etiqueta. Mismo trato que el trinquete de lint: lo que importa no es
corregirlo hoy, es que no se vuelva a descolgar mañana.

- `src/lib/expediente/audit-log.ts` (`EVENTO_LABEL`, `etiquetaEvento`, +5 al tipo)
- `src/app/(dashboard)/cumplimiento/page.tsx` (usa el mapa compartido)
- `src/__tests__/bitacora-etiquetas.test.ts` — 5 pruebas. Total 4854.

---

## QUINCUAGÉSIMA OCTAVA TANDA — v909

### Agendar o mover una cita desde el consultorio no dejaba ningún rastro

El portal escribe `cita_solicitada_portal`, `cita_cancelada_portal` y
`cita_reagendada_portal`. El bot escribe `cita_cancelada_whatsapp`. Cambiar el
estado escribe `cita_estado_cambiado` y borrar escribe `cita_borrada`.

Y **dar de alta o mover una cita desde el consultorio no escribía nada** —
siendo la vía por la que pasa la mayor parte de la agenda. Mover una cita cambia
la fecha, la hora y hasta el médico que la atiende, y en una discusión —«me la
cambiaron y nadie me avisó»— no había a qué acudir.

Es el **reverso** del fallo que estuve reparando todo el día: no un canal nuevo
que se salta el guardián del viejo, sino el canal viejo que nunca lo tuvo.

Ahora deja bitácora, distinguiendo alta de movimiento, y en el movimiento guarda
**qué cambió** (`de → a`) leyendo el estado previo **dentro de la transacción**:
fuera de ella podría leer una versión que otro acaba de pisar, y la bitácora
diría que cambió algo que no cambió.

Tres cuidados:

- el **autor sale de la sesión** verificada, nunca del cuerpo (mismo criterio que
  los cobros);
- se escribe **después** de la transacción y sin bloquearla: una bitácora que
  falle no puede tumbar una cita ya dada de alta;
- en `meta` **no viaja nada identificable** —ni nombre, ni teléfono, ni motivo—.
  El paciente ya está en `patientId`; repetir sus datos sería PHI de más en una
  colección que la pantalla de cumplimiento consulta entera.

- `src/lib/expediente/audit-log.ts` (`cita_creada`, `cita_reagendada`)
- `src/app/api/appointments/route.ts`
- `src/__tests__/bitacora-agenda.test.ts` — 8 pruebas. Total 4862.

---

## QUINCUAGÉSIMA NOVENA TANDA — v910

### Dos huecos en la bitácora del episodio: el traslado no se escribía nunca y los borrados no dejaban nada

**1. `hosp_traslado` estaba declarado y no lo escribía nadie.** Estaba en el
tipo, estaba permitido en la ruta de auditoría… y ninguna vía lo emitía. El
movimiento sí quedaba dentro del episodio (`movimientos[]`), pero la bitácora de
cumplimiento —la que se consulta para saber quién tocó a un paciente— no se
enteraba de que alguien lo cambió de servicio, de cama o de médico tratante.

**2. Borrar una indicación médica o una interconsulta desaparecía sin dejar
nada.** La ruta ya lo impide en cuanto hay administración o respuesta, y eso
estaba bien; pero una orden **suspendida** sigue viéndose en el expediente y una
**borrada** se esfuma entera.

Es el mismo criterio que el propio tipo escribió para `laboratorio_borrado` y
`foto_clinica_borrada`: *«no se prohíbe —a veces hay que quitar una foto subida
al expediente equivocado— pero tiene que quedar quién y cuándo»*. Lo que faltaba
era aplicarlo a lo que sí es una orden médica.

Ahora las cuatro acciones dejan asiento. **Sólo esas**: una bitácora que registra
cada pulsación no se lee, y una que no registra un borrado no sirve.

Tres cuidados:

- el **autor** sale de la sesión verificada;
- el **paciente sale del episodio**, no del cuerpo de la petición: si saliera del
  body, un llamador podría colgar el asiento del expediente de otro;
- **sin PHI de más** — servicio y cama son ubicación, no diagnóstico; no viajan
  descripción, motivo ni nombre.

- `src/lib/expediente/audit-log.ts` (+2 eventos con etiqueta)
- `src/app/api/hospital/mutar/route.ts`
- `src/__tests__/bitacora-hospital.test.ts` — 8 pruebas. Total 4870.

---

## SEXAGÉSIMA TANDA — v911

### La bitácora no podía contestar «¿quién entró al expediente de este paciente?»

Es **la** pregunta de la trazabilidad —la que hace un auditor, y la que puede
hacer el propio paciente al ejercer sus derechos ARCO— y la pantalla de
cumplimiento enseñaba los últimos 200 asientos de **toda** la clínica, revueltos,
sin ningún filtro, y con el paciente reducido a ocho caracteres de su id.

Ahora se filtra por paciente y por tipo de evento.

**Y el filtro por paciente pregunta al servidor**, no recorta los 200 ya traídos.
Filtrar en el navegador habría sido *peor* que no filtrar: contestaría «no hay
accesos» cuando en realidad los hay, sólo que más viejos que la ventana. Un fallo
que se lee como una respuesta tranquilizadora es el peor de todos, y es
exactamente el patrón que llevo toda la semana reparando.

La cabecera dice **sin ambigüedad** cuál de las dos cosas se está viendo: «TODOS
los asientos de Fulano» o «últimos 200 de toda la clínica».

Detalle de implementación que importa: la consulta por paciente va **sin
`orderBy` a propósito**. Igualdad + orden exigiría un índice compuesto, y
desplegar índices es una operación aparte que puede borrar los que no estén
declarados en el archivo (no hay `firestore.indexes.json` en el repo). Sin
`orderBy` basta el índice automático y el orden se hace en memoria.

Además el paciente sale por su **nombre** cuando se puede, y el vacío no afirma
«nadie entró» a secas: dice que también pueden ser asientos anteriores a que
existiera la bitácora.

- `src/app/(dashboard)/cumplimiento/page.tsx`
- `src/__tests__/bitacora-filtro.test.ts` — 9 pruebas. Total 4879.

---

## SEXAGÉSIMA PRIMERA TANDA — v912

### La receta leía las alergias de una fuente distinta que la pantalla

El módulo de alergias tiene la advertencia **escrita encima del helper**:

> «Por qué existe este helper y por qué debe usarse en TODOS los caminos de
> impresión: la verificación en pantalla usa `alergiasDe`, que prefiere
> `alergiasEstructuradas` sobre el texto libre. Los impresos leían solo
> `patient.alergias`. Un paciente con la alergia únicamente en el campo
> estructurado veía una alerta roja en pantalla y un papel que decía "Negadas".»

De los cinco caminos de impresión, **sólo uno lo usaba**: la orden médica. La
receta —el papel que va a la farmacia—, la referencia —que viaja a otro médico—,
la nota y su exportación a Word seguían leyendo el texto libre en crudo.

Hoy ninguna ruta de escritura llena `alergiasEstructuradas`, así que la
divergencia **todavía no está activa**. La activa el mismo día que entre una
importación de otro sistema, y para entonces el hueco ya estaría en producción.
Cerrarlo antes cuesta esto; cerrarlo después cuesta una receta equivocada.

Ahora los cuatro leen del mismo helper, con **una prueba por camino** que falla
si alguno vuelve a leer el campo crudo.

Y se conserva que la receta **no pinte el recuadro** cuando no hay dato: un
recuadro rojo vacío o un «Negadas» de relleno son dos formas de mentir en el
papel que va a la farmacia.

- `src/components/RecetaDocumento.tsx`, `referencia/[patientId]/page.tsx`,
  `nota/[patientId]/[notaId]/page.tsx` (pantalla y Word)
- `src/__tests__/alergias-impreso-fuente.test.ts` — 8 pruebas. Total 4887.

---

## SEXAGÉSIMA SEGUNDA TANDA — v913

### El trinquete de color vigilaba el color del error y dejaba pasar el del acierto

v872 y v900 migraron los rojos y ámbares —primer plano, fondo y borde— y dejaron
el trinquete en cero. Pero su lista **sólo tenía rojos y ámbares**: los verdes,
teales, azules y morados seguían escritos a mano. **97 usos en 40 pantallas.**

«Verificada por farmacia» en `#0d9488`, los estados en verde, los enlaces en
azul: exactamente el mismo problema —un hexadecimal no cambia de tema— y sobre el
crema del tema claro se quedan igual de flojos que el rosa que motivó todo esto.

Y todos tenían **ya su token definido en los dos temas**, medido con la fórmula
de luminancia de WCAG (el comentario de `globals.css` lo documenta: red 4.61,
green 4.63, purple 4.62, blue 4.60). Sólo faltaba usarlo.

Ahora están migrados y **la lista del trinquete los incluye**, así que el hueco
no puede reabrirse. El papel sigue con su hexadecimal a propósito.

- 40 archivos `.tsx`, `src/app/globals.css` (`--purple` en `@media print`)
- `src/__tests__/color-trinquete.test.ts` (lista ampliada, techo en 0). Total 4887.

---

## SEXAGÉSIMA TERCERA TANDA — v914

### El color de la insignia de deterioro era invisible para el guardián puesto a vigilar eso

El trinquete de color **sólo escaneaba `.tsx`**, y los colores de los scores
vivían en módulos `.ts`: `news2.ts` tenía `{ bajo: '#0d9488', medio: '#d97706',
alto: '#dc2626' }` y `escalas.ts` (Braden/Morse) otro igual.

O sea que el color de la insignia de **NEWS2** —el indicador de deterioro, el que
más falta hace que se lea— no cambiaba de tema, y el guardián puesto justamente a
vigilar eso no podía verlo. Ahora son tokens y el trinquete escanea `.ts` también.

### Y al hacerlo encontré un fallo mío, de v913

v913 convirtió unos mapas de color a `var(--x)` y **dejó vivas dos
concatenaciones** `color + '18'`. Eso funciona mientras el color sea un
hexadecimal; con una variable produce `var(--purple)18`, que es **CSS inválido y
el navegador descarta en silencio**: el fondo del badge desaparece y nada se
queja.

Reparado con `color-mix`, y ahora hay una prueba que **prohíbe pegarle un sufijo
de alfa a un color**. El fallo era cosmético, pero la clase no lo es: una
migración que rompe en silencio es peor que la deuda que venía a quitar.

### Paletas categóricas: excluidas CON su razón

Un color semántico **dice** algo y debe seguir al tema y cumplir contraste. Una
paleta categórica sólo tiene que **distinguir**: las trece etiquetas de paciente
y los colores de avatar existen para no confundirse entre sí. De los trece
colores de etiqueta sólo cinco tienen token, así que migrarlos dejaría tres
etiquetas viéndose iguales — perder la función que tienen.

- `src/lib/hospital/news2.ts`, `escalas.ts`, `demo-sandbox.ts`
- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx`,
  `superadmin/page.tsx`, `superadmin/soporte/page.tsx`
- `src/__tests__/color-trinquete.test.ts` (escanea `.ts`, prohíbe el sufijo de
  alfa, declara `PALETAS`). Total 4888.

---

## SEXAGÉSIMA CUARTA TANDA — v915

### Once bordes y fondos llevaban meses sin pintarse, en silencio — incluido el panel cardiometabólico

El fallo que encontré en v914 —`color + '18'` deja de funcionar cuando el color
pasa a ser `var(--x)`, porque produce `var(--red)18`: **CSS inválido que el
navegador descarta sin quejarse**— tenía una segunda forma de escribirse que mi
prueba no miraba: la plantilla, `${color}55`.

**Había once.** Y uno de ellos —el recuadro de resultados del **panel
cardiometabólico**, el de las metas de LDL y el FIB-4— está roto **desde v872**,
cuando aquella migración convirtió `<Res color="#f87171">` en
`<Res color="var(--red)">`. Desde entonces el borde y el fondo de esas cajas
simplemente no existen.

Nadie lo notó porque **un borde que no se pinta no se queja**. Es el reverso de
todo lo que llevo reparando: no una pantalla que promete de más, sino una que
deja de decir algo sin avisar.

Reparados los once con `color-mix`.

### Y otro hueco de sintaxis del mismo guardián

Los colores elegidos con un ternario —`const color = nivel === 'critica' ?
'#dc2626' : …`— no encajaban en el patrón `color:`, así que seguían crudas **las
alertas del apoyo a la decisión clínica** de la ficha hospitalaria y **la lectura
S/I/R del antibiograma**. Migradas.

La prueba ahora vigila las **tres sintaxis**: la declaración, la concatenación y
la plantilla.

- 12 archivos `.tsx` (concatenaciones), 4 más (ternarios)
- `src/__tests__/color-trinquete.test.ts`. Total 4889.

---

## SEXAGÉSIMA QUINTA TANDA — v916 (+ reglas desplegadas)

### Un signo vital se podía sobreescribir desde la consola del navegador, sin cadena de corrección ni rastro

La regla de `signos` decía «AÑADEN (create) y **CORRIGEN (update)**» y describía
un modelo de corrección que la aplicación **abandonó**: desde la decisión del Dr
del 29-jul-2026, corregir un signo es **anexar** otro documento con `corrigeA`
—«se implementa sin `update`: el registro original nunca se toca», dice
`corregirSignos`—.

O sea que la regla seguía permitiendo **algo que ningún código hace y que el
diseño prohíbe**. Y eso vacía la garantía entera: quien tuviera rol clínico podía
abrir la consola del navegador y sobreescribir una SpO₂ sin cadena de corrección,
sin motivo y sin rastro — justo lo que `motivoCorreccion` (v904) y la proyección
`corrigeA` existen para impedir.

La regla de al lado ya lo dice con todas sus letras: *un cliente que escribe
directo tiene RBAC de vista, no real*.

### La política no la inventé yo

El `update` abierto estaba anotado en la matriz de acceso como **la pregunta
E0-09-Q5 al médico dueño**, así que no era mío decidirla. Pero cuatro bloques más
abajo, `icu_observations` (ICU-003) **ya tiene la respuesta aplicada**: el
`update` sólo puede tocar el campo de ciclo de vida, así que una toma se marca
como corregida pero **sus medidas son inmutables**.

Es el mismo dato un nivel más abajo y una forma que él ya aceptó. Extenderla no
es tomar una decisión nueva: es dejar de tener dos criterios para lo mismo.

- `firestore.rules` (**desplegadas aparte** con `firebase deploy --only firestore:rules`)
- `src/lib/authz/matriz-acceso.ts` + doc regenerado
- `src/__tests__/firestore-rules-guard.test.ts` — invariante nueva. Total 4890.

---

## SEXAGÉSIMA SEXTA TANDA — v917 (+ reglas desplegadas)

### Borrar una alerta crítica estaba prohibido; vaciarla, no

La regla de `hospital_alertas` cerraba el `delete` —«una alerta crítica no debe
poder desaparecer»— y dejaba el `update` **abierto a todo el documento**.

Y el documento **es** el registro: `titulo`, `detalle` y `tipo` son su contenido
clínico. Se podía reescribir «Deterioro clínico — NEWS2 9 (alto)», o cambiarle el
tipo, desde la consola del navegador, y **no quedaría rastro**, porque no hay un
original con el que comparar.

Es la misma alerta dicha de otra forma: prohibir el borrado y permitir el vaciado
protege la fila, no el contenido.

Lo único que la aplicación actualiza es `leida` —una marca de bandeja, no un
juicio clínico—, así que es lo único que se permite ahora, con la misma forma de
`icu_observations` y de `signos` (v916).

Si algún día se añade otro campo de ciclo de vida (`atendidaPor`), la lista tiene
que crecer **a propósito**. Que falle en desarrollo es la intención: es como se
nota que se está tocando el contenido de una alerta y no su bandeja.

- `firestore.rules` (**desplegadas aparte**)
- `src/lib/authz/matriz-acceso.ts` + doc regenerado
- `src/__tests__/firestore-rules-guard.test.ts` — invariante nueva. Total 4891.

---

## SEXAGÉSIMA SÉPTIMA TANDA — v918 (+ reglas desplegadas)

### Una solicitud ARCO no se podía borrar, pero sí reescribir

El `delete` estaba cerrado porque es un **registro legal**, y el `update` quedaba
abierto a cualquier miembro y a **todo el documento**.

Se podía cambiar la `descripcion` de «solicito la SUPRESIÓN de mis datos» a
«solicito acceso», marcarla resuelta, y el registro legal diría que la clínica
cumplió con otra cosa. **Reescribir es peor que borrar, porque el resultado
parece íntegro.**

Y `origen` es lo que distingue una solicitud llegada de la calle de una tecleada
en el consultorio: si un miembro puede voltearlo, toda la cautela del `create`
—que no deja al público señalar un expediente ni declararse verificado— **se
deshace después**.

Ahora se congela lo que declaró el solicitante (`solicitante`, `tipo`,
`descripcion`, `fechaSolicitud`, `origen`) y sigue abierto todo lo demás: estado,
resolución, quién resolvió, y ligar el expediente tras identificarlo, que es un
acto de la clínica (Art. 29 LFPDPPP).

- `firestore.rules` (**desplegadas aparte**)
- `src/lib/authz/matriz-acceso.ts` + doc regenerado
- `src/__tests__/firestore-rules-guard.test.ts` — invariante nueva. Total 4892.

---

## SEXAGÉSIMA OCTAVA TANDA — v919 · P0.2 del Dr

### La lista pública de quién recibe datos del paciente omitía a dos proveedores que reciben datos del paciente

El contrato de encargo promete «una lista pública y actualizada de dichos
subencargados». Esa lista **sí existía** —la tabla de `/seguridad`, con región y
acuerdo de tratamiento— pero declaraba **seis** proveedores y el código usa
**diez**.

Faltaban:

- **AssemblyAI**, que recibe el **audio de la consulta** para separar las voces;
- **Daily**, que transporta la **videoconsulta**;
- **Twilio**, que manda mensajes al paciente;
- **360dialog**, por donde pasan los WhatsApp antes de llegar a Meta.

**Una lista incompleta de quién recibe datos es peor que no tenerla: parece
completa.**

Y el aviso de privacidad y el contrato hablaban de «categorías» en prosa, cada
uno con su redacción — tres textos legales diciendo lo mismo de tres formas, a un
proveedor nuevo de contradecirse.

Ahora hay **una** lista, derivada de lo que el código integra de verdad (la clave
de entorno que consume cada ruta), y los tres documentos leen de ella.

### El guardián encontró uno mientras lo escribía

La prueba falla si aparece en el código una clave de proveedor sin declarar. Al
ejecutarla la primera vez señaló **360dialog**: yo lo había puesto entre
paréntesis dentro de la fila de Meta, y eso lo dejaba fuera de la lista **como
empresa** — que es lo que importa cuando se firma un acuerdo de tratamiento con
cada una.

**Queda del Dr.**: confirmar con su abogado la figura jurídica de cada uno y la
región contra el acuerdo firmado. La `region` de la tabla es la de procesamiento
por defecto del proveedor, no una verificación documental.

- `src/lib/legal/subencargados.ts` (nuevo), `aviso-privacidad.ts`,
  `contrato-encargo.ts`, `app/seguridad/page.tsx`
- `src/__tests__/subencargados.test.ts` — 10 pruebas. Total 4902.

---

## SEXAGÉSIMA NOVENA TANDA — v920 · AUDITORÍA DE LANZAMIENTO

Panel de **7 especialistas en paralelo** (agenda · paciente · dinero · expediente ·
seguridad · legal · primer uso), cada hallazgo pasado por un revisor escéptico con
instrucción de refutarlo. **40 hallazgos, 35 sobrevivieron.** El informe completo
está en el resultado del workflow `wf_15984211-ef4`.

Veredicto: **ningún P0**. Se puede lanzar la fase 1 cerrando seis cosas del camino
del primer día. Empiezo por la de la agenda, que es el producto que se vende.

### Una cita entraba entera encima de un quirófano o de unas vacaciones

`estaBloqueado` recibe un **instante** y pregunta si ese instante cae dentro del
bloque. **Ningún llamador le pasaba la duración.**

Una consulta de 60 minutos a las 10:00 contra un bloqueo de 10:30 a 13:00 **no
estaba bloqueada** —las 10:00 no caen dentro— y la cita entraba entera encima de
la ausencia. Por los **cuatro** caminos que agendan: cálculo de huecos, chequeo de
conflicto, alta del consultorio y reserva pública.

**Lo irónico**: la aritmética correcta ya estaba escrita en este repositorio, a
unas líneas. `pisaDescanso(inicio, fin, …)` comprueba el solape, con el comentario
«basta con que se solapen, no hace falta contenerlo». **Los descansos de comida
estaban bien resueltos y las vacaciones no.**

Ahora hay `pisaBloqueo` con la misma aritmética y los cuatro caminos lo usan.
Bordes fijados: la cita que **termina** cuando empieza el bloqueo no lo pisa, la
que **empieza** cuando termina tampoco, la que lo **contiene** entero sí; y una
duración basura se trata como 0 —el chequeo más estricto— nunca como «no bloquea».

- `src/lib/time-blocks-core.ts` (`pisaBloqueo`), `availability.ts`,
  `api/appointments/route.ts`, `api/public/booking/route.ts`
- `src/__tests__/bloqueo-duracion.test.ts` — 14 pruebas. Total 4916.

---

## SEPTUAGÉSIMA TANDA — v921 · AUDITORÍA DE LANZAMIENTO (2/6)

### El «SÍ» al recordatorio podía cancelar la cita en vez de confirmarla

Dos preguntas distintas compartían el estado `confirmando_cita` y se distinguían
por una bandera **dentro de `datos`**:

- «¿confirmas tu cita?» → SÍ = confirmar
- «¿la cancelo?» → SÍ = cancelar (`cancelarSolo: '1'`)

La cadena que lo rompía:

1. el paciente pide cancelar y **abandona** sin contestar;
2. la bandera se queda pegada en su sesión, que **no caduca sola** —sólo se toca
   cuando el paciente vuelve a escribir—;
3. llega el recordatorio de 24 h y el cron reescribe la sesión con `merge: true`,
   que en Firestore **funde los mapas anidados**: la bandera **sobrevive**;
4. el paciente responde «SÍ» a «¿confirmas tu cita?» y **se le cancela**, se avisa
   al consultorio y su hueco se le ofrece a la lista de espera.

**Confirmar y perder la cita**, sin enterarse hasta el día de la consulta.

Lo más útil del hallazgo: el comentario que ya vivía en ese código advertía de
**este mismo peligro en el sentido contrario** —quien pide cancelar y acaba con la
cita confirmada—. Le faltaba la otra mitad.

Ahora cada pregunta tiene **su propio estado**, así que una sesión vieja de
cancelación no puede secuestrar la pregunta del recordatorio: son ramas distintas
del código. El cron además escribe la bandera vacía para neutralizar las que ya
estuvieran pegadas, y se **sigue leyendo** por si acaso, para no invertirle el
sentido a una conversación en vuelo al desplegar esto.

- `src/app/api/whatsapp/webhook/route.ts`, `src/app/api/cron/reminders/route.ts`
- `src/__tests__/bot-si-no-cancela.test.ts` — 7 pruebas. Total 4923.

---

## SEPTUAGÉSIMA PRIMERA TANDA — v922 · AUDITORÍA DE LANZAMIENTO (3/6)

### «No encontré ninguna cita» significaba «no supe reconocer tu número»

WhatsApp identifica a quien escribe con un `wa_id` (`5215512345678`), y el mismo
número puede estar guardado de **cuatro** formas según por dónde entró: el panel
guarda **10 dígitos**, la reserva pública los **dígitos crudos**, el bot la
**forma canónica**, y México mete un `1` extra en los móviles.

`resolverPacienteBot` **ya lo sabía** y preguntaba por todos los formatos, con un
comentario que lo explica. Pero **buscar las citas para cancelar** y **dar de baja
de la lista de espera** comparaban con `==` contra el `wa_id` pelado.

O sea que un paciente cuya cita se dio de alta **en el mostrador** escribía
«cancelar» y el bot le contestaba **«no encontré ninguna cita»** — que se lee como
«no tienes ninguna», no como «no supe reconocer tu número». Y a quien pedía la
baja de la lista de espera se le prometía una baja que no ocurría, **dos líneas
debajo de un comentario que dice que eso es lo peor que se puede hacer**.

El criterio existía y estaba bien; sólo lo usaba **uno de los tres** sitios. Ahora
vive en un módulo compartido y los tres lo usan, con una prueba que exige que
ninguno vuelva a comparar en crudo.

Y el tope del `in` de Firestore está fijado a propósito: pasarse hace que la
consulta falle **entera**, y una consulta que falla se lee como «no hay nada» — el
mismo fallo otra vez.

- `src/lib/whatsapp/telefono-candidatos.ts` (nuevo), `api/whatsapp/webhook/route.ts`
- `src/__tests__/telefono-candidatos.test.ts` — 10 pruebas. Total 4933.

---

## SEPTUAGÉSIMA SEGUNDA TANDA — v923 · AUDITORÍA DE LANZAMIENTO (4/6)

### El muro de pago dejaba al médico encerrado y en silencio

`AccesoGate` es la pantalla que **bloquea la aplicación entera** cuando no hay
suscripción activa. Su único botón hacía:

```
const data = await res.json()
if (data.url) { window.location.href = data.url; return }
setCargando(null)          // ← y aquí se acababa todo
```

Ante un error del servidor —un precio anual sin configurar, una clínica que no
existe, Stripe caído— el botón volvía de «Abriendo…» a «Empezar» y **no pasaba
nada más**. Ni mensaje, ni motivo, ni a quién preguntarle. El médico se queda
fuera de su propio consultorio **con la tarjeta en la mano**.

El `catch { setCargando(null) }` hacía lo mismo con los fallos de red.

Y lo que más molesta: la pantalla de **Configuración ya enseñaba el error de este
mismo endpoint**. La que más lo necesitaba era la única que no lo hacía.

Ahora se enseña el error del servidor, se **distingue el fallo de red** del fallo
del servidor —reintentar arregla uno y no el otro—, un cuerpo que no es JSON no
revienta la pantalla, y hay una **salida**: a quién escribirle y con qué dato.

**Un muro sin puerta ni timbre es peor que un muro.**

- `src/app/(dashboard)/layout.tsx`
- `src/__tests__/muro-pago-sin-salida.test.ts` — 7 pruebas. Total 4940.

---

## SEPTUAGÉSIMA TERCERA TANDA — v924 · AUDITORÍA DE LANZAMIENTO (5/6)

### La pantalla que agenda calculaba con un horario que el consultorio ya no tiene

`/asistente` es **la puerta principal para agendar**, y construía su configuración
efectiva tomando `doctor.horario ?? config.horario` **siempre**.

Esa copia en `doctors/{id}` es un **fósil**: se escribe al dar de alta al médico y
no se vuelve a tocar. `configParaMedico` —lo que usan el modal de citas y la ruta
que valida— sólo la respeta si el médico tiene `horarioPropio` marcado.

O sea que la pantalla calculaba los huecos contra un horario viejo y el servidor
validaba contra el vigente. Dos formas de fallar:

- ofrecer un hueco que el servidor rechaza con un **409 sin explicación**;
- **esconder** huecos que sí estaban libres.

Y `duraciones` salía del mismo fósil y **viajaba en el POST**: una segunda vía
para el mismo 409.

Era el **último `horario ??` crudo** que quedaba en `src/`. Ahora las tres vías
que agendan usan el mismo criterio, con una prueba que lo fija — y que quita los
comentarios antes de mirar, porque el que documenta este fallo cita la forma vieja
a propósito y una prueba que no distingue el código de su explicación acaba
obligando a no explicar nada.

- `src/app/(dashboard)/asistente/page.tsx`
- `src/__tests__/asistente-horario-fosil.test.ts` — 8 pruebas. Total 4948.

**Con esto quedan cerrados los 5 hallazgos de software de la auditoría.** Los dos
restantes son decisión del Dr: la contradicción de la tarjeta y la cédula por médico.

---

## SEPTUAGÉSIMA CUARTA TANDA — v925 · AUDITORÍA DE LANZAMIENTO (dinero)

### Devolverle dinero a un cliente lo hacía parecer mejor pagador

`platform_payments` guarda cobros, reembolsos y contracargos en la **misma
colección**, todos con `monto` positivo: el signo lo decide el `tipo`.

La ruta que alimenta la consola del dueño sumaba `Number(p.monto)` **en crudo**,
así que un reembolso **aumentaba** el ingreso total, el del mes, y lo «pagado» por
esa clínica — que es el número con el que se decide si alguien está al corriente.

Y no faltaba la herramienta: **las dos rutas hermanas ya lo habían cerrado** con
`tipoDeAsiento`/`efectivoDe`. Ésta se quedó atrás, y es **la que se ve primero** al
abrir la consola.

Ahora los tres números salen del efectivo, y **una disputa abierta ya resta**:
Stripe retiene el importe en cuanto se abre y sólo lo devuelve si se gana —
contarla al perderla mostraría un saldo que el banco no tiene.

**De paso**: la ruta de facturación leía el `tipo` con su propia comparación de
cadenas. Ahora usa el mismo `tipoDeAsiento`. No necesita el signo —un reembolso no
se factura, se excluye— pero sí el mismo criterio: **tres formas de leer el `tipo`
es cómo se llega a tres respuestas distintas sobre el mismo dinero**.

- `src/app/api/superadmin/clientes/route.ts`, `api/facturacion/pagos/route.ts`
- `src/__tests__/superadmin-ingreso-neto.test.ts` — 9 pruebas. Total 4957.

---

## SEPTUAGÉSIMA QUINTA TANDA — v926 · AUDITORÍA DE LANZAMIENTO (dinero 2)

### Ningún contracargo se atribuía a su clínica, y el aviso que «tiene que verse el mismo día» no aparecía nunca

Los dos manejadores de contracargo hacían:

```
(d.charge as { customer?: string })?.customer
```

y `Dispute.charge` es un **string** —el id del cargo—, nunca viene expandido en un
webhook. El `customer` era **siempre `undefined`**:

- el asiento quedaba huérfano, así que el dinero retirado **no restaba** del
  ingreso de esa clínica —y desde v925 el ingreso se calcula por `clinicId`—;
- y `disputaAbierta` **no se marcaba jamás**, así que el aviso que el propio
  código llama imprescindible «el mismo día» no aparecía nunca.

Un contracargo es dinero **ya retirado** por el banco más una comisión, con un
plazo para responder con pruebas. **Enterarse tarde es perder por
incomparecencia.**

Ahora se resuelve primero por nuestros propios asientos —el reembolso ya guarda
`chargeId` y `stripeCustomerId`, y no cuesta una llamada— y si no está, se le
pregunta a Stripe por el cargo, que es la fuente autoritativa. Si las dos fallan,
el asiento queda huérfano **declarado**, como ya hacía: perder la atribución es
malo, perder el asiento es peor.

**Lo que dejó pasar esto fue un `as` sobre una forma que el SDK no promete.** El
compilador no puede avisar de un campo inventado detrás de un cast — y hay una
prueba que ahora vigila que ese cast no vuelva.

- `src/app/api/stripe/webhook/route.ts`
- `src/__tests__/contracargo-clinica.test.ts` — 9 pruebas. Total 4966.

---

## SEPTUAGÉSIMA SEXTA TANDA — v927 (+ reglas) · AUDITORÍA DE LANZAMIENTO (dinero 3)

### Se podía anular un cobro y ponerle el nombre de un compañero

La exigencia de que el autor sea uno mismo (`canceladoPor == request.auth.uid`)
vive **sólo** en la rama de ANULAR, y esa rama pide que el cobro **no estuviera ya
cancelado**.

Sobre un cobro **ya anulado**, la rama de «vincular factura» aceptaba cualquier
cambio mientras `cancelado` siguiera igual: se podía reescribir `canceladoPor`,
`canceladoPorNombre`, `motivoCancelacion` y `canceladoEn`. Cualquier miembro, de
cualquier rol, desde la consola del navegador.

O sea: **anular un cobro —quedarse con el efectivo— y después ponerle el nombre de
otro.** Y el corte de caja lo imprime tal cual **desde v907**, que es justo la
pantalla que hice para poder preguntarle a alguien.

**Un control que señala a la persona equivocada es peor que no tenerlo.**

Ahora los cuatro campos de la anulación quedan congelados también en esa rama, que
existe para pegar un UUID de factura, no para reescribir quién hizo qué.

- `firestore.rules` (**desplegadas aparte**), `matriz-acceso.ts` + doc regenerado
- `src/__tests__/firestore-rules-guard.test.ts` — invariante nueva. Total 4967.

---

## SEPTUAGÉSIMA SÉPTIMA TANDA — v928 · REPORTADO POR EL DR. EN USO REAL

### «¿Por qué no me deja guardar la firma que subo en PDF?»

El conversor de PDF a imagen armaba la URL del worker de pdf.js apuntando a
**`unpkg.com`**, con la versión **adivinada** (`pdfjs.version || '6.0.227'`).

Así que subir un PDF —la firma del médico, el membrete— dependía de:

- que unpkg estuviera arriba y contestara rápido;
- que esa versión exacta existiera en esa ruta exacta;
- que la red del consultorio no bloqueara CDNs, **cosa habitual en hospitales**.

Y cuando fallaba **no se veía un error claro**: pdf.js se quedaba esperando al
worker y lo único que salía era «Tiempo agotado (60s). Tu PDF puede ser muy
pesado» — un mensaje que manda al médico a buscar el problema **donde no está**.
Probaba con otro PDF más chico y volvía a fallar.

El archivo **viene dentro de `pdfjs-dist`**. No había que descargarlo de ningún
lado.

Ahora se copia a `public/` en cada build (`npm run pdf-worker`, encadenado al
`build`) y se sirve del mismo origen: sin red externa, sin adivinar versiones, y
la versión del worker **no puede desincronizarse** de la de la librería. La CDN
queda de respaldo por si un despliegue no llevara el archivo — quitarla del todo
dejaría la función muerta sin salida.

- `src/lib/pdf-to-image.ts`, `public/pdf.worker.min.mjs`, `package.json`
- `src/__tests__/pdf-worker-local.test.ts` — 7 pruebas. Total 4974.

⚠️ **Pendiente de confirmar con el Dr**: si con esto ya le guarda la firma. Si
sigue fallando, el siguiente sospechoso es la migración REG-014 (`config/firma`),
que el auditor marcó como P1-6.

---

## SEPTUAGÉSIMA OCTAVA TANDA — v929 · REPORTADO POR EL DR.

### «No se guarda el template» — el guardado ahora se verifica y dice qué campos no quedaron

**Honestidad primero: leí el código del guardado y no logré reproducir el fallo.**
Escribe todo el `rx` —incluidos RFC, registro DGP, vigencia y aviso legal, que
están declarados en `RecetaConfig`— y si Firestore lo rechaza, `setDoc` lanza y
sale un aviso.

El problema es que **ese aviso dura unos segundos y aparece lejos del botón**, en
una pantalla larguísima que se usa con scroll. Si se lo perdió, lo que vio fue un
botón que dijo «Guardando…» y volvió a su sitio: **idéntico a un guardado
correcto**.

En vez de inventarme una causa y decirle que ya quedó, hice que el guardado **se
verifique**: vuelve a leer del servidor lo que quedó escrito, lo compara campo por
campo con lo que se pidió, y deja el resultado **fijo junto al botón** hasta el
siguiente intento. Si algo no llegó, **lo nombra**.

Dos cuidados:

- se comparan los campos que se **teclean**, no las imágenes: ésas cambian de
  data URL a URL de Storage al guardarse, y compararlas daría falsos fallos;
- se distingue «no se pudo **guardar**» de «no se pudo **comprobar**». No son lo
  mismo, y confundirlos manda a buscar el problema al lugar equivocado — que es
  exactamente lo que le pasó con el PDF (v928).

- `src/app/(dashboard)/configuracion/secciones-recetas.tsx`

⚠️ **Pendiente**: que el Dr. lo pruebe y me mande la lista de campos si sale el
aviso rojo. Con esa lista el diagnóstico es inmediato.

---

## SEPTUAGÉSIMA NOVENA TANDA — v930 · LA FIRMA EN PDF: CAUSA REAL

### El worker local (v928) no bastaba. Lo que la rompía era el TAMAÑO

La hoja se rasterizaba a **220-300 DPI** y se mandaba **tal cual**. Una carta a
esa resolución son ~1900×2400 px: varios MB en PNG, y el data URL infla otro
**33 %** al ir en base64 dentro del JSON.

La petición **moría antes de llegar al servidor** por el tope de la función, sin
ningún error que explicara nada. Se veía una subida que no hacía nada.

**Y la reducción existía** — pero condicionada a `if (!storage)`, con este
razonamiento escrito en el código: *«con Storage el peso no importa»*.

**Sí importa.** La imagen no viaja directo a Storage: pasa por una función con un
límite duro. O sea que **tener Storage bien configurado era justo lo que activaba
el fallo**.

Ahora los tres caminos que rasterizan un PDF —firma, hoja membretada y diseño
completo— reducen antes de subir. Una firma no necesita una hoja entera a 220 DPI:
necesita la firma.

Y queda una **última red** en el helper de subida: si alguien añade un camino
nuevo y se le olvida, falla **con su nombre**, diciendo cuántos MB pesa y qué
hacer — porque una subida que «no hace nada» no se puede depurar.

### Además: la pestaña de recetas, agrupada

Eran **nueve tarjetas idénticas** en fila, todas con el mismo peso visual. Ahora
hay cuatro bloques con jerarquía y una línea que explica cada uno: **1 El papel ·
2 Cómo se ve · 3 Qué se imprime · 4 Datos legales**. El orden ya era el correcto;
faltaba decir dónde empieza cada cosa.

- `src/lib/image-utils.ts` (`reducirDataUrlSiPesa`), `subir-imagen.ts`,
  `secciones-cuenta.tsx`, `secciones-recetas.tsx`
- `src/__tests__/pdf-worker-local.test.ts` (+4), `recetas-orden-visual.test.ts` (9).
  Total 4987.

---

## OCTOGÉSIMA TANDA — v931 · «NO SALE EN MI RECETA»

### El mismo médico, llamado de dos formas

La firma **sí estaba subida** (el Dr. la vio en su pantalla). Lo que fallaba:

- la nota guarda `metadata.medicoId` con el **uid de Firebase** de quien firma;
- la firma y la plantilla se guardan bajo el **id del documento** de `doctors`,
  que es lo que elige el selector de Configuración.

Dos identificadores distintos de la misma persona: la búsqueda exacta **nunca
acierta**. Con un solo médico el respaldo «la única que hay» lo tapaba; con **dos
o más**, la receta sale sin firma y sin ninguna explicación — desde dentro parece
que ese médico no subió la suya.

**Ya se había reparado una vez (v321) por otro camino**: aquel arreglo añadió el
respaldo del médico único, que resolvía el caso de entonces y dejaba abierto éste.

### El puente ya existía

`doctors/{id}.uid` — escrito al conectar Google Calendar (**v875**) y rellenado
para los que ya estaban conectados (**v899**). El vínculo que hice para el
calendario resolvió la firma.

Ahora los **tres** impresos —receta, orden y nota— traducen el uid al id del
documento antes de buscar la firma **y la plantilla**. Y no adivina: si nadie
coincide, o si dos médicos comparten uid por un dato corrupto, devuelve vacío y el
impreso sigue avisando. **Poner la firma de otro médico es peor que no poner
ninguna.**

- `src/lib/impreso-medico.ts` (`resolverIdMedico`), receta / orden / nota
- `src/__tests__/firma-medicoid-uid.test.ts` — 13 pruebas. **Total 5000.**

---

## OCTOGÉSIMA PRIMERA TANDA — v932 · AUDITORÍA MAYOR (81 agentes)

**Calificación global: 6.9/10.** Seguridad 8 · Expediente 7.5 · Antibiograma 7.5 ·
Agenda 7 · IA 7 · Ingeniería 7 · Hospital 6.5 · UX 6.5 · Datos 6 · Negocio 6.
41 hallazgos confirmados de 60, 33 competidores perfilados. Informe completo en
el resultado del workflow `wf_be7275c1-1dc`.

### El cron de recordatorios leía el histórico completo de citas, 24 veces al día

La consulta filtraba por estado **y nada más**: sin cota de fecha, sin `limit`.
Cada ejecución descargaba **todas las citas que ha tenido esa clínica desde que
existe**, para mirar las de hoy y mañana.

Y las clínicas se recorren **en serie**. Cuando el tiempo de la función se acaba,
dejan de recibir recordatorios **siempre las mismas** —las del final de la lista—
**sin un solo error visible**: el cron responde 200 y el consultorio se entera
porque sus pacientes no llegan.

Ya estaba confirmado en la auditoría del 26 de julio y **no se había reparado**.

Ahora la ventana es hoy y mañana, en la zona horaria de **la clínica** (un
consultorio en Tijuana y otro en Cancún no comparten «hoy»).

El rango va sobre `fechaHora` **a solas** y el estado se filtra en memoria, a
propósito: combinarlos exigiría un índice compuesto, y desplegar índices es una
operación aparte que puede borrar los que no estén declarados.

**Y el patrón correcto ya estaba en este mismo archivo**, 130 líneas más abajo,
en la consulta de auto-reseña.

- `src/app/api/cron/reminders/route.ts`
- `src/__tests__/cron-recordatorios-ventana.test.ts` — 7 pruebas. Total 5007.

---

## OCTOGÉSIMA SEGUNDA TANDA — v933 · AUDITORÍA MAYOR (2)

### La adenda se imprimía con el nombre y la cédula del médico equivocado

`guardarAdenda` mandaba `config.nombreMedico` y `config.cedulaProfesional`, que
son campos de **nivel clínica** —un valor por consultorio—. En un consultorio con
dos médicos, la adenda de la Dra. salía impresa con el nombre y la cédula **del
dueño**.

Un documento medicolegal con un firmante falso. Y una adenda no es cualquier
documento: es la **enmienda a una nota ya firmada**.

Lo más incómodo: el servidor **ya sellaba el `autorUid` correcto** desde el token.
La bitácora decía la verdad y el papel decía otra cosa.

Y `firestore.rules` lo tenía escrito desde antes: «FIRMAR ES UN ACTO PERSONAL —
nadie firma con la cédula de otro». **Faltaba el campo donde guardar la de cada
médico.**

Ahora `Doctor` tiene su propia `cedulaProfesional` —y su `uid` declarado, que es
el puente con quien firma—, se captura al dar de alta al médico, y la adenda usa
la del médico en sesión.

Dos cuidados: sin cédula propia **no se cae a la de la clínica** (sería la de
otro), y **no adivina cuando hay empate** —dos médicos con el mismo correo, o el
mismo uid por un dato corrupto—: mejor sin resolver que resolviendo mal.

- `src/types/index.ts` (`Doctor.cedulaProfesional`, `Doctor.uid`),
  `configuracion/page.tsx` (captura), `nota/[patientId]/[notaId]/page.tsx`
- `src/__tests__/adenda-firma-personal.test.ts` — 8 pruebas. Total 5015.

**Esto desbloquea parte del P1-5 de la auditoría** (cédula por médico). Queda
llevar lo mismo a la firma de la nota y de la receta, donde hoy se usa la de la
clínica.

---

## OCTOGÉSIMA TERCERA TANDA — v934 · AUDITORÍA MAYOR (3)

### La nota firmada —que es inmutable— quedaba congelada con la identidad del dueño

Es el mismo fallo de la adenda (v933), pero **peor**. `nota.firma` es el
**snapshot inmutable**, y se estampaba con `config.nombreMedico`,
`config.cedulaProfesional` y `config.especialidad` —campos de **nivel clínica**—.

En un consultorio con dos médicos, cada nota que firmaba la Dra. quedaba
**congelada para siempre** con el nombre y la cédula del dueño. A diferencia de la
adenda, aquí **no se corrige después**: la nota firmada es inmutable por diseño y
por reglas.

Y la compuerta miraba el campo equivocado **en los dos sentidos**: exigía
`config.cedulaProfesional`, así que dejaba firmar a la Dra. con la cédula del
dueño **y** bloqueaba a un médico que sí tuviera la suya si la clínica no la
había llenado —mandándolo a Configuración → General, donde ese campo ya estaba
lleno—.

Ahora el médico en sesión se resuelve por `uid` y, si no, por correo, sin adivinar
en empates; el sello usa **su** nombre, **su** cédula y **su** especialidad; con
varios médicos **no** se cae a la del consultorio (estampar la cédula de otro en
un documento inmutable es peor que no poder firmar) y el aviso dice **cuál**
falta; con un solo médico —donde la del consultorio ES la suya— se conserva el
comportamiento de siempre.

### Y el snapshot de la firma gráfica nacía vacío (P1-6 de la auditoría)

REG-014 movió la firma a `config/firma` y la **borra** de `config/main`; esta
pantalla seguía leyendo `config.firmaImagenDataUrl`, que desde entonces es
`undefined`.

Al imprimir se caía a la firma **viva**: cambiar la firma reimprimía las notas
viejas con la nueva — justo lo contrario de lo que el snapshot existe para
garantizar. Ahora se lee del subdocumento protegido, por médico, y con varios
médicos no se estampa la firma global (sería la de otro, congelada).

- `src/app/(dashboard)/consulta/[patientId]/page.tsx` (`medicoEnSesion`,
  `identidadFirma`, compuerta, sello, `imagenDataUrl`)
- `src/__tests__/firma-nota-personal.test.ts` — 10 pruebas. Total 5025.

**Cierra el P1-5** (cédula por médico) junto con v933, y el **P1-6** (snapshot de
firma vacío).

---

## OCTOGÉSIMA CUARTA TANDA — v935 · AUDITORÍA MAYOR (4)

### El guardián de módulos huérfanos certificaba que no había nada que avisar

`modulos-sin-conectar.test.ts` existe porque el 31-jul el mismo fallo apareció
**cuatro veces en un día**: código escrito, probado y sin conectar a ninguna
pantalla. Pero emparejaba por **nombre de archivo** — daba por «mencionado»
cualquier módulo cuyo nombre apareciera en otro archivo:

```ts
src.includes(alias) || src.includes(`/${base}'`) || src.includes(`/${base}"`)
```

Así, `@/lib/expediente/prompts` —que sí se usa— **tapaba**
`src/lib/agenda/prompts.ts`, que no lo usa nadie: **167 líneas huérfanas con la
prueba en verde**.

Salió por el nombre `prompts`, pero `motor`, `index`, `utils` o `tipos` habrían
hecho lo mismo. **Un guardián que da un falso negativo es peor que no tenerlo**:
no sólo no avisa, sino que *certifica* que no hay nada que avisar.

Ahora se lee el especificador real de cada `import`, `export … from` e `import()`
dinámico y se **resuelve a un archivo del disco**, que es lo que hace el
empaquetador: alias `@/` → `src/`, rutas relativas contra la carpeta de **quien
importa**, paquetes de `node_modules` ignorados, y un módulo que sólo se importa
a sí mismo sigue siendo huérfano.

### Los tres que estaban tapados

- **`src/lib/dosing/motor.ts` — el caro.** Es el motor que **elige** la regla de
  dosificación y devuelve `SPECIALIST_REVIEW` cuando falta un dato. La pantalla
  `/uci/dosificacion` enseña y firma el *dataset*, pero **no llama al motor**:
  hoy el médico ve las reglas, no la selección. Queda en la cola.
- **`src/lib/agenda/prompts.ts`** — prompts operativos de la agenda (parseo de
  lenguaje natural a operaciones, tono de recordatorios). Sin llamador desde que
  existe.
- **`src/lib/uci/benchmark.ts`** — arnés de estrés de los motores de UCI; ése sí
  vive en el CI por definición, como `safety-gate.ts`.

Los tres quedan **declarados** en `HUERFANOS_ACEPTADOS` con su razón, no
escondidos.

### Y el guardián se vigila a sí mismo

Seis pruebas nuevas comprueban que el detector resuelva rutas y no vuelva a
emparejar por nombre: que `agenda/prompts` **no** quede tapado por su homónimo,
que el alias y las relativas resuelvan a archivos que existen, que `node_modules`
se ignore, y que `export … from` e `import()` sigan contando como consumidores
(tratarlos como huérfanos sería el error opuesto).

- `src/__tests__/modulos-sin-conectar.test.ts` — 6 pruebas. Total 5031.

---

## OCTOGÉSIMA QUINTA TANDA — v936 · EL MOTOR DE DOSIS POR FIN LLEGA AL MÉDICO

### 291 líneas escritas, probadas y sin que las llamara nadie

`src/lib/dosing/motor.ts` **elige** cuál de las cuatro reglas del fármaco aplica
a este paciente —reemplazo renal primero, luego cuidado crítico, luego función
renal— y devuelve `SPECIALIST_REVIEW` cuando falta un dato, sin interpolar ni
deducir de un fármaco parecido.

La pantalla `/uci/dosificacion` enseñaba y firmaba el **dataset**, que es otra
cosa: el médico veía las reglas, no la selección.

Lo destapó el guardián de huérfanos al repararse en v935 — antes el nombre
`motor` coincidía con otros módulos y éste pasaba por «usado».

Ahora la pantalla tiene dos pestañas: **Consultar dosis** (llama al motor) y
**Validar el dataset** (la de siempre).

### Y el error que un formulario introduce siempre

El motor recibe tipos exactos; un formulario devuelve **texto**. `Number('')` es
**0**, no `NaN`:

- un peso vacío leído como `0 kg` no manda a revisión — manda a una dosis en
  mg/kg calculada sobre cero;
- un CrCl vacío leído como `0 mL/min` elige la rama renal más agresiva del
  dataset para un riñón sano.

Por eso el puente `src/lib/dosing/consulta.ts`: vacío, texto no numérico y
negativos son «no sé» —nunca un cero—, un desplegable sin elegir no es
«ninguno», y un valor fuera del dominio se descarta en vez de colarse.

### La validación la pone quien puede saberla

`recomendar()` devuelve **siempre** `sin_validar`, y hace bien: es puro, no lee
Firestore. Eso convierte ese campo en un **piso**, no en un veredicto. La
pantalla lo levanta con la firma del consultorio y dice quién y cuándo. Una firma
**caducada** no cuenta: describe unos números que ya no son los que están en
pantalla.

### El rastro de auditoría omitía lo que disparaba el bloqueo

`entradasUsadas` no incluía `renalInestable`, `esNeumonia` ni
`sedacionYVentilacionAseguradas` — los tres que pueden **BLOQUEAR**. Un registro
que omite el dato por el que se bloqueó no explica la decisión que se tomó.

- `src/lib/dosing/consulta.ts` (nuevo), `src/lib/dosing/motor.ts`
  (`entradasUsadas`), `uci/dosificacion/page.tsx` (pestañas + `Consultar`)
- `src/__tests__/dosing-consulta.test.ts` — 17 pruebas. Total 5048.

**Nota**: la pestaña no indica nada por su cuenta; devuelve el **texto literal**
de la regla del dataset, con su fuente y su fecha, y el aviso de validación
encima. Ninguna cifra clínica sale de aquí.

---

## OCTOGÉSIMA SEXTA TANDA — v937 · EL PRODUCTO GRATIS PARA SIEMPRE

### Cancelar el día 13 y volver a suscribirse renovaba la prueba

`api/stripe/checkout` mandaba `trial_period_days: 14` **incondicional**, en cada
sesión de compra. Stripe hace lo que se le pide: cada suscripción nueva nacía con
catorce días gratis.

Repetido, es **el producto entero gratis para siempre**: dos clics cada dos
semanas, sin trampas ni herramientas. Y no salta ninguna alarma, porque desde
dentro se ve igual que un cliente que se suscribe.

Estaba en la cola desde el 1-ago con archivo y línea
(`src/app/api/stripe/checkout/route.ts:84`) y no se había reparado.

### La prueba es una cortesía de bienvenida

Se pregunta a Stripe por **todas** las suscripciones del cliente —`status: 'all'`,
porque las canceladas son justo las que interesan— y quien ya tuvo una (activa,
cancelada o impagada) no la vuelve a estrenar. Cambiar de plan tampoco la
reinicia: no es un cliente nuevo.

Sin prueba se cobra desde el primer día, que es lo que el médico espera al
volver. Y el campo se **omite** en vez de mandarse en `0`, que no es lo mismo.

### La parte que no es obvia: qué hacer si Stripe no contesta

Se cae a una **marca local** que escribe el webhook al **completarse** el pago
—no al abrir la compra: ahí todavía no se sabe si el médico va a terminar, y
marcarla antes le quitaría la prueba a quien sólo abandonó el formulario—. Si
tampoco la hay, **se concede**.

Negarla por una caída de red le cobra el primer día a alguien a quien se le
prometieron catorce gratis, y eso es una **promesa rota**, no un descuento
perdido. Concederla de más exige, además de la caída, que el webhook nunca
escribiera la marca. La marca no se sobrescribe: la fecha que importa es la de la
primera.

El banner del muro de pago ya distinguía «Inicia tu prueba gratis de 14 días» de
«Reactiva tu suscripción» según el estado, así que la pantalla no promete lo que
el cobro ya no da.

- `src/lib/finanzas/prueba-gratis.ts` (nuevo), `api/stripe/checkout/route.ts`,
  `api/stripe/webhook/route.ts` (`marcarPruebaEstrenada`)
- `src/__tests__/stripe-prueba-una-vez.test.ts` — 16 pruebas. Total 5064.

**Cierra el punto 4 de la cola.**

---

## OCTOGÉSIMA SÉPTIMA TANDA — v938 · EL CUARTO CAMINO A LA AGENDA

### El paciente que reagendaba desde su enlace podía caer encima de la cirugía

Cuatro caminos escriben sobre la misma agenda: el panel del consultorio, el
booking público, el bot de WhatsApp y el **reagendado del paciente desde su
enlace**. Los tres primeros ya descontaban el Google Calendar personal del médico
(v875-v876); el cuarto miraba sólo las citas de NexusMED y los bloqueos
capturados a mano.

Así que mover la cita del martes al jueves podía aterrizar justo sobre la cirugía
que el médico tiene apuntada en su calendario. Y peor que reservar encima: **la
reserva se aceptaba** —el reagendado no falla, confirma— y el consultorio se
enteraba el jueves.

Es el mismo patrón que ya salió tres veces aquí: **un camino nuevo que se salta
la guarda del camino viejo.**

### Una sola consulta, en los dos sitios

El portal usa ahora la misma `lib/calendario/ocupado-servidor` que los otros tres,
no una propia — cinco implementaciones del cálculo de huecos, cuatro
desactualizadas, es exactamente como empezó esto.

Y va en los **dos** sitios a propósito: al **ofrecer** los huecos y al
**confirmar** el cambio. Enseñar un hueco y rechazarlo al confirmar es un
formulario que miente; validarlo sin ofrecerlo bien es ofrecer horas que no
existen.

Con las cautelas de siempre:

- mira el calendario de **ese** médico, no el del dueño (sin `medicoId` no se
  adivina);
- la consulta va **fuera** de la transacción — una transacción de Firestore puede
  reintentarse y la llamada de red se repetiría con ella;
- si Google falla **no** se esconde el día entero: se sigue como antes y queda
  dicho en el registro, porque un hueco ofrecido de más se nota y un día en
  blanco sin explicación no.

- `src/app/api/portal/route.ts` (`bloquesDelDia`, casos `slots` y `reagendar`)
- `src/__tests__/portal-reagenda-google.test.ts` — 12 pruebas. Total 5076.

**Cierra el punto 12 de la cola.**

---

## OCTOGÉSIMA OCTAVA TANDA — v939 · LA LISTA DE ESPERA PERDÍA PACIENTES EN SILENCIO

### 1. «Rango horario preferido»: capturado, enseñado, y nunca leído

El formulario lo pide (`Ej. Mañana, 9-12`), se guarda en
`WaitlistEntry.rangoHorario` y la ficha del paciente **lo muestra**. El
emparejamiento del hueco liberado sólo miraba `tipo` y `fechaDeseada`.

Quien pidió por la mañana recibía el ofrecimiento de las 18:00 y, si contestaba
**SÍ**, la cita se creaba a las 18:00. La recepción vio el dato en pantalla, el
paciente lo dijo, y el sistema hizo como si no existiera.

Es el patrón caro de siempre —un campo escrito que nadie lee— y aquí ni siquiera
estaba escondido: **se enseña**, así que desde dentro parece que se usa.

Ahora hay un intérprete determinista (`lib/whatsapp/rango-horario.ts`): palabras
del día, rangos numéricos con y sin minutos, «de 4 a 7 pm» = 16:00-19:00 y no la
madrugada, y un `14` no se toca aunque diga «tarde». El hueco tiene que **caber
entero** en la franja: una cita de 45 min que arranca a las 11:45 termina a las
12:30, y a quien pidió «9-12» le rompe la mañana igual.

**La regla que ordena la reparación**: el campo es texto libre, así que lo que no
se entiende **no filtra**. Interpretarlo mal deja fuera de la rueda a un paciente
que sí podía venir, y eso **no se detecta nunca** — el que no recibe un mensaje
no se queja de no haberlo recibido. Un rango al revés («12-9») o una hora
imposible son dedazos y no se adivinan.

### 2. El tope recortaba sin decirlo

Era `.limit(60)` **sin `orderBy`**: Firestore devolvía sesenta entradas
cualesquiera —en orden de identificador— y la prioridad se ordenaba **después**,
en memoria. Con más de sesenta en lista, el paciente de prioridad 1 podía no
estar entre las que llegaron, y el hueco se le ofrecía a otro **sin que nada lo
indicara**.

No se puede pedir `orderBy('prioridad')` junto al `where in` sin un índice
compuesto creado a mano en la consola —y mientras no exista, la lectura falla
**entera** y no se ofrece a nadie—. Así que el tope sube a 200 y, sobre todo,
**se declara cuando se alcanza**: un recorte que nadie ve se lee como «ya estaban
todos».

- `src/lib/whatsapp/rango-horario.ts` (nuevo), `lib/whatsapp/ofrecer-hueco.ts`,
  y los tres llamadores pasan la duración del hueco
- `src/__tests__/lista-espera-rango-horario.test.ts` — 20 pruebas. Total 5096.

**Nota sobre el punto 11 de la cola (sucursales):** verificado, está **cerrado
por decisión** desde v847 — `branchId` salió de la lista blanca de la API porque
aceptar un campo que se ignora es prometer una función que no existe. El modelo
sigue declarado como huérfano, con su razón.

---

## OCTOGÉSIMA NOVENA TANDA — v940 · EL AUDIO DE LA CONSULTA QUE NO SE BORRABA

### PHI en el bucket, y un comentario que prometía limpiarlo

Para diarizar una consulta larga, el audio —la conversación entera entre el
médico y el paciente, **PHI en crudo**— se sube a `consultas-audio/{uid}/…`, se
le pasa la URL a AssemblyAI y se borra en el `finally` del hook.

Ese `finally` **sólo corre si el navegador sigue vivo**, y la espera es de hasta
**seis minutos** de sondeo. Cerrar la pestaña, quedarse sin batería, perder la
red o irse a otra pantalla dejaba el archivo en el bucket **para siempre**.

Y cuando el borrado fallaba, el código lo decía así:

```ts
catch { /* lifecycle rule lo limpia */ }
```

Una regla de ciclo de vida es **configuración del bucket**, no código. Nada en
este repositorio la declaraba y nadie la había creado: el comentario la daba por
hecha.

Es el patrón más caro de todos —**una regla escrita en un comentario que el
código de al lado no cumple**— y aquí la promesa incumplida era «no dejamos PHI».

### El barrido que sí existe

`api/cron/limpiar-audio`, diario, **registrado en `vercel.json`** (una ruta de
cron sin entrada ahí no la dispara nadie: sería otro módulo escrito y sin
conectar). Mismo candado fail-closed por `CRON_SECRET` que el otro cron — un
endpoint que **borra** no puede quedar abierto.

**La regla que ordena el barrido: lo que no se puede fechar, no se borra.**
Borrar ante la duda puede llevarse el audio de una consulta que se está
transcribiendo en ese momento, y el médico vería su dictado fallar sin
explicación; esperar un ciclo no cuesta nada.

- se fecha por el `timeCreated` del objeto y, si falta, por la marca que el hook
  mete en el nombre — **validando el rango**, porque adivinar mal significa
  borrar algo recién subido;
- una fecha en el **futuro** (reloj desajustado) tampoco cuenta como caducada;
- sólo mira el prefijo del audio: la firma y el membrete del médico viven en
  `receta-diseno/` y no caducan;
- «no pude mirar el bucket» responde **503**, no 200 con cero borrados: los dos
  se leen igual desde fuera y sólo uno significa que hay PHI esperando.

- `src/lib/expediente/audio-caduco.ts` (nuevo, puro),
  `src/app/api/cron/limpiar-audio/route.ts` (nuevo), `vercel.json`,
  `src/hooks/useGrabacionAudio.ts` (el comentario), `lib/authz/registro-rutas.ts`
- `src/__tests__/audio-consulta-caduco.test.ts` — 20 pruebas. Total 5116.

**Pendiente del Dr. (externo)**: nada. El barrido usa `CRON_SECRET`, que ya está
configurado para el cron de recordatorios, y `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
que ya usan las rutas de receta y config.

---

## NONAGÉSIMA TANDA — v941 · EL BLOQUE HOSPITALARIO SELLADO Y SIEMPRE VACÍO

### La nota de hospital no decía en qué cama estaba el paciente

`NotaMedica.hospital` existe en el modelo desde que existe el módulo de
hospitalización y **entra en el hash de integridad**: `integrity.ts` lo incluye
entre los campos sellados y lo nombra en la lista de protegidos. La nota firmada
se sellaba prometiendo que ese bloque es inmutable.

Pero **nadie lo escribía**. Ni una pantalla, ni una ruta, ni el ensamblado. **Se
sellaba un hueco.** Y el impreso tampoco lo enseñaba.

Resultado: una nota de hospital que no decía en qué servicio ni en qué cama
estaba el paciente, ni qué día de internamiento era — datos que la propia
aplicación ya tiene en el episodio, a un identificador de distancia
(`nota.internamientoId`).

Es el mismo patrón del motor de dosis (v936) y del «rango horario preferido»
(v939), en su forma de dato: **un campo que el sistema promete y nunca llena.**

### El día se cuenta como en el pase de visita

Quien ingresó anoche a las 23:00 y es visto hoy a las 08:00 está en su **día 2**,
no en «9 horas»: contar por horas transcurridas daría 0 y contradiría al pizarrón
del servicio. Es una cuenta de calendario, no un umbral — no decide nada, sólo
numera lo que el equipo ya numera en voz alta.

Una nota fechada **antes** del ingreso no tiene día: poner «día 1» sería inventar
una coherencia que el dato no tiene.

### Lo que NO hace

- **No rellena `condicion`.** «Estable / grave / crítico» es un **juicio del
  médico** que escribe la nota. Un campo vacío es honesto; un «estable» puesto
  por un programa es una afirmación médica que nadie hizo, dentro de un documento
  que se firma.
- No toca el balance hídrico, que registra enfermería.
- Lo que el episodio no diga queda **ausente**, no en blanco: un `servicio: ''`
  en un documento sellado afirma «no tiene servicio», y lo cierto es «no se
  sabe». Si no hay nada que decir, no se mete un objeto vacío.
- Si el episodio no se puede leer, la nota se guarda **sin** el bloque: bloquear
  el guardado de una nota clínica por un dato administrativo sería peor.
- El impreso lo **enseña**, no lo calcula: sale sólo si la nota lo trae.

- `src/lib/hospital/bloque-nota.ts` (nuevo, puro),
  `consulta/[patientId]/page.tsx` (lee el episodio y arma el bloque),
  `nota/[patientId]/[notaId]/page.tsx` (lo imprime)
- `src/__tests__/nota-bloque-hospital.test.ts` — 17 pruebas. Total 5133.

**Queda declarado**: `NotaMedica.infectologia` (día de antibiótico, candidato a
desescalada, switch IV→VO) sigue sellado y sin escritor. Es del mismo tipo, pero
sus campos son **decisiones clínicas** —«candidato a desescalada» no se deriva de
ningún dato del episodio—, así que llenarlo pide una pantalla donde el médico lo
declare, no una inferencia. NEEDS_CLINICAL_REVIEW.

---

## NONAGÉSIMA PRIMERA TANDA — v942 · LO QUE EL MODELO PROMETÍA Y NO EXISTE

### Un campo declarado que nadie usa es una promesa de la aplicación

El guardián de módulos huérfanos (v935) vigila el código escrito y sin conectar.
Faltaba lo mismo **un nivel más abajo**: el campo declarado en un tipo que nadie
escribe ni lee. No es documentación inofensiva — un tipo es lo que la aplicación
dice de sí misma, y quien lo lee actúa en consecuencia.

### Borrados por describir otra aplicación

- **`AuditLog`** prometía `entityType`, `entityId`, `oldValue` y `newValue`: una
  bitácora con el **antes y el después** de cada cambio. La bitácora real
  (`lib/expediente/audit-log.ts`) no guarda nada de eso, y `createAuditLog` —lo
  único que usaba el tipo— se había borrado hace tiempo de `lib/firestore.ts`.
  Ante una revisión, «el expediente registra el valor anterior» era una
  **afirmación falsa escrita en el modelo**.
- **`NotificationLog`**: la entrega de mensajes se registra en el libro de
  no-entregados y en el outbox, con otra forma.
- **`DashboardStats`**: diez cifras declaradas y ni un consumidor. El tablero
  calcula lo suyo con sus propias consultas.
- **`ClinicConfig.whatsappProveedor`**: un segundo sitio donde declarar el
  proveedor, cuando el que de verdad se lee es `ClinicWhatsApp.provider`. Dos
  campos para lo mismo es una invitación a que uno diga «meta» y el otro
  «360dialog» sin que nadie sepa cuál manda.

### Y el guardián, con trinquete

Los 20 campos que siguen sin usar van **congelados con su razón**: el modelo de
UCI de icu-002 esperando la fase que lo consume, el modelo de evidencia E2, la
PHI separada de E0-06, y dos campos del expediente sin captura
(`Diagnostico.fechaDiagnostico`, `Medicamento.instruccionesEspeciales`). Uno
nuevo pone el CI en rojo.

### Dos trampas que el propio guardián tuvo que esquivar

1. Aceptar `export type` hacía que el `Record` de etiquetas siguiente se leyera
   como campos del tipo anterior: **seis falsos positivos** que decían que la UCI
   no podía registrar ventilación no invasiva ni HFNC. Un guardián que grita
   donde no hay nada acaba ignorándose.
2. Contar las **pruebas** como uso hacía que su propia lista de aceptados —que
   nombra cada campo— lo diera todo por usado. Un guardián que se cuenta a sí
   mismo siempre pasa.

- `src/types/index.ts` (tres interfaces y un campo fuera), `src/lib/firestore.ts`
- `src/__tests__/campos-sin-usar.test.ts` — 9 pruebas. Total 5142.

---

## NONAGÉSIMA SEGUNDA TANDA — v943 · LA REGLA QUE VIVÍA EN EL CLIENTE

### El contexto del paciente se minimizaba en las pantallas, no en la puerta

`api/consultor-evidencia` recibía `contextoPaciente` como **texto libre** del
cliente y lo mandaba al proveedor tal cual. Las dos pantallas que lo llaman ya lo
minimizaban —una con un comentario que dice, literalmente, «SIN EL NOMBRE… había
dos políticas opuestas para el mismo endpoint»—, pero la corrección se aplicó a
los **clientes**.

Una regla que vive en el cliente sólo la cumplen los clientes que se acuerden:
una pantalla nueva, o un cliente modificado, manda lo que quiera. Ahora se
minimiza **en la ruta**.

### Y la memoria del médico sólo la protegía un prompt

`extraerAprendizajes` le pide a un modelo hechos durables y `aprenderDeMedico`
los **persiste**. La cabecera de `memoria-medico.ts` promete «NUNCA datos de
pacientes», y lo único que lo respaldaba era una instrucción en el prompt.

**Un prompt no es una compuerta**: describe una intención, y lo que el modelo
devolviera se guardaba tal cual, filtrado sólo por longitud.

Ahora hay un filtro determinista, y está en los **dos** sitios —la ruta y el que
escribe—, por si mañana lo llama otro. Se **rechaza** en vez de tachar: un hecho
al que hay que quitarle un teléfono no era un hecho sobre la práctica del médico,
y guardarlo a medias deja una frase rara en la memoria para siempre.

### Lo que NO se promete

**Nombres propios.** «María González» y «monoterapia con vancomicina» son dos
cadenas y ninguna regla determinista las distingue sin un diccionario que no
existe. Decir que aquí se quitan los nombres cambiaría un riesgo por otro peor:
**la falsa tranquilidad**. Está escrito en el módulo, y hay una prueba que se cae
si algún día alguien lo cambia.

Se quita lo que tiene forma comprobable: CURP, RFC, correo, teléfono, fecha
completa y tiras largas de dígitos. Y lo redactado **se declara** en el registro,
para que un consultorio pueda ver si su equipo está pegando identificadores.

### La trampa del propio redactor

Sin ordenar los patrones y sin *lookarounds*, una póliza de catorce dígitos la
mordía el patrón de teléfono **por en medio** y quedaba `304[teléfono]`: una
redacción parcial que deja los primeros dígitos a la vista. **Tachar a medias es
peor que no tachar, porque parece que sí se tachó.**

- `src/lib/ia/minimizar-phi.ts` (nuevo, puro),
  `api/consultor-evidencia/route.ts`, `src/lib/memoria-medico.ts`
- `src/__tests__/consultor-minimizar-phi.test.ts` — 16 pruebas. Total 5158.

---

## NONAGÉSIMA TERCERA TANDA — v944 · EL TOPE QUE LE CORTABA LA IA A QUIEN PAGA

**Hallazgo del equipo (auditoría de negocio 2026-08-03). Es el más caro de la
sesión.**

### 30 ÷ 4 ≈ 7 consultas al mes

`LIMITE_PRUEBA = 30` son los usos gratis al mes con la llave de la plataforma, y
`pruebaAgotada()` los contaba **sin mirar si el consultorio paga**.
`resolverClaveIA` marca `fuente: 'prueba'` a **cualquiera** que no haya pegado su
propia API key — pague o no, porque nada le provisiona una llave al suscribirse.

Una consulta dictada gasta ~4 usos (`transcribir` + `procesar` +
`verificar-nota` + `evidencia`). Así que un cliente de Clínica, que pagó por
decenas de consultas con IA, recibía en la **segunda semana del mes**, con un
paciente enfrente:

> «Se acabó la IA incluida en tu prueba. **Activa un plan** para seguir usándola»

…a alguien que ya activó un plan.

Y como el corte va **antes** de mirar créditos e **ignora** `permiteEconomico`,
el modo económico que promete la página de precios —«sigue en ⚡ Rápida sin costo
hasta 120 notas más/mes»— **no se alcanzaba nunca**.

Todo el sistema de créditos existe y está probado; lo gobernaba un contador de
otra época que se disparaba primero. **No se había notado porque todavía no hay
un cliente de pago que haya corrido un mes completo** — se habría notado con el
primer reembolso.

### La regla, ahora

El tope de cortesía aplica **sólo mientras el consultorio no tiene plan
vigente**. En cuanto paga, lo gobiernan los créditos y el modo económico, que es
el sistema diseñado para eso.

- `past_due` queda **exento a propósito**: es «el banco rebotó el cargo y Stripe
  está reintentando». El webhook ya tiene decidido que `past_due` NO suspende
  —sólo `unpaid`/`canceled`—, así que cortarle la IA aquí sería castigar dos
  veces por lo mismo.
- Se conservan las dos exenciones que ya existían: el pase libre del dueño y la
  cuenta de cortesía.
- Si **no se puede leer** el consultorio, el tope **sí** se aplica. De las dos
  equivocaciones posibles ésa es la barata: quien paga ve un mensaje y reintenta;
  quien no paga y se saltara el tope gastaría contra la tarjeta del Dr. sin
  límite.
- El corte sigue siendo inapelable para quien **sí** está en prueba: ahí no hay
  plan que respalde nada, y ésa era la razón original.

- `src/lib/finanzas/tope-de-cortesia.ts` (nuevo, puro), `src/lib/ai-keys.ts`
- `src/__tests__/tope-cortesia-no-corta-a-quien-paga.test.ts` — 14 pruebas.
  Total 5172.

---

## NONAGÉSIMA CUARTA TANDA — v945 · EL ARCHIVO QUE DECÍA «EXPEDIENTE»

**Cierra D1 de la cola del equipo.**

### No era el expediente

El único botón de exportación descargaba `expediente_<nombre>_FHIR_R4.json` con
el paciente y **sólo las notas firmadas**. Quedaban fuera, todas escritas por la
propia aplicación y todas declaradas en `firestore.rules`:

- las **adendas** — la enmienda a una nota firmada, parte legal del expediente
  (NOM-004);
- las versiones previas a la firma;
- los **laboratorios**;
- la **fotografía clínica** seriada;
- el **resumen clínico** (alergias estructuradas, antecedentes);
- los formularios previos;
- los **internamientos con sus signos**;
- las citas y la **bitácora de accesos**.

Y los borradores se descartaban **en silencio**: contenido clínico sin firmar
desaparecía sin que nadie lo señalara.

**Un archivo llamado «expediente» que no lo es no falla**: se entrega, se recibe,
y los dos lados creen que ahí está todo.

### El manifiesto, y el guardián que lo vigila

`src/lib/expediente/exportacion.ts` es ahora la **lista única de qué es un
expediente**, y `exportacion-completa.test.ts` la compara contra las rutas
`match /` que `firestore.rules` declara bajo `patients/{docId}`:

> **Añadir una subcolección al paciente y no declararla en la exportación pone el
> CI en rojo.**

Es la única forma de que la próxima no vuelva a quedarse fuera — porque esto ya
se olvidó una vez.

### `faltantes` es el campo más importante del archivo

Un expediente incompleto que **no dice** que está incompleto es peor que no
entregarlo. Una sección ilegible se declara y **no tumba el archivo** —uno al
90 % que dice qué le falta es útil; uno que revienta entero no le sirve a nadie—
y el recorte por tope también se declara, porque un recorte que nadie ve se lee
como «eso era todo».

### Lo demás

- Va con el permiso del **médico**, no el del mostrador: baja diagnósticos,
  medicamentos y alergias, que NOM-004 reserva al médico.
- El asiento de auditoría lo escribe el **servidor**. Antes lo escribía el
  navegador que ejecutaba la descarga — el mismo código que podría saltárselo.
- **No promete empaquetar binarios**: de las fotos entrega la ficha y la
  referencia. Prometer un ZIP que no existe sería peor que declararlo.
- El botón de FHIR ahora **dice** cuántas notas en borrador deja fuera.

- `src/lib/expediente/exportacion.ts` (nuevo, puro),
  `src/app/api/expediente/exportar/[patientId]/route.ts` (nueva),
  `expediente/[patientId]/page.tsx`, `lib/authz/registro-rutas.ts`
- `src/__tests__/exportacion-completa.test.ts` — 22 pruebas. Total 5194.

**Queda de D1**: enriquecer el Bundle FHIR con lo mismo y unificar las dos
implementaciones FHIR divergentes.

---

## NONAGÉSIMA QUINTA TANDA — v946 · LA «A» DE ARCO

**Cierra D2 de la cola del equipo.**

### Se resolvía con un `prompt()`, y al titular no se le entregaba nada

`lib/arco.ts` declara los cinco derechos, el portal público los recibe, y el
panel de Cumplimiento **cuenta el plazo de 20 días hábiles** de la LFPDPPP.

Pero la única que se ejecutaba de verdad era la Cancelación. El Acceso se
«resolvía» así:

```ts
const resolucion = prompt('Describe brevemente qué se hizo:')
```

Se guardaba el texto, la solicitud pasaba a «resuelta», y **al titular no se le
entregaba nada**. El plazo se contaba, la alerta se pintaba, y no había qué
entregar cuando vencía.

Es el mismo pecado que este repositorio ya se reprochó al construir
`arco/cancelar` —«la pantalla aceptaba solicitudes y las resolvía escribiendo un
texto libre»— y que seguía vivo para la A.

### Ahora se ejecuta, y deja acuse

`POST /api/arco/acceso` arma el expediente completo con el **mismo manifiesto**
que el botón del médico —una sola implementación: si cada camino lo armara por su
cuenta, en tres meses uno entregaría menos que el otro y nadie sabría cuál, que es
lo que ya pasó con las dos implementaciones FHIR divergentes y con las cinco del
cálculo de huecos—, lo descarga, y deja **acuse**: el hash SHA-256 de lo
entregado, el conteo por sección y la fecha, en la solicitud y en la bitácora.

**Sin el hash no hay forma de demostrar QUÉ se entregó.** Ante el INAI, «le mandé
su expediente» sin constancia es lo mismo que no haberlo mandado.

- Va bajo `administrar`, no bajo el permiso clínico: entregar datos a un tercero
  —aunque sea su titular— es decisión del responsable del tratamiento.
- Exige `identidadVerificada`: el portal público pide la identificación como
  texto libre y nadie la comprueba.
- Tiene **ensayo** que dice qué saldría sin entregarlo.
- **Rechazar** sí sigue siendo un texto: una negativa es una decisión con su
  fundamento, no una operación de datos.

### Y una trampa del propio guardián, en este mismo cambio

Al sacar el armado a una librería compartida, las dos rutas que entregan el
expediente dejaron de contener `collection('notas')` en su cuerpo y se volvieron
**invisibles** para el detector de PHI de `authz-rutas-declaradas`.

**El refactor correcto apagaba el guardián** — y lo apagaba en silencio: la lista
de rutas con PHI se acortaba, que parece una buena noticia. El detector ahora
sigue un nivel de importación; el guardián de sesión sigue mirando **sólo** el
archivo de la ruta, porque mezclarlos daría por buenas rutas sin candado propio.

- `src/app/api/arco/acceso/route.ts` (nueva),
  `src/lib/expediente/exportacion-servidor.ts` (nuevo, compartido),
  `src/lib/arco.ts` (campos del acuse), `cumplimiento/page.tsx`,
  `authz-rutas-declaradas.test.ts` (el detector)
- `src/__tests__/arco-acceso.test.ts` — 17 pruebas. Total 5211.

---

## NONAGÉSIMA SEXTA TANDA — v947 · EL RESPALDO QUE NO RESPALDABA

**Cierra la mitad de D3.** El importador queda pendiente y va declarado abajo.

### Una lectura por paciente, en serie, en el navegador

```ts
for (const p of patients) { const historial = await getNotas(clinicId, p.id) }
```

Con el médico esperando, sin progreso y sin forma de reanudar. Con cientos de
pacientes son cientos de idas y vueltas antes del primer byte; en un móvil, la
pestaña se queda sin memoria.

Y lo que bajaba eran **pacientes + notas**. Nada más: fuera quedaban adendas,
laboratorios, fotografía clínica, antecedentes, citas, cobros, la configuración
—membrete, formato de receta, firma—, los bloqueos de agenda, la farmacia, los
internamientos y la bitácora.

**Un archivo llamado «respaldo» que no respalda es peor que no tenerlo**: se
guarda, se duerme tranquilo, y el día que hace falta no está lo que se creía.

### Ahora: servidor, NDJSON, paginado con cursor

Una línea por documento **con su ruta completa**, para poder volver a escribirla
donde estaba. Se escribe mientras se lee —sin cargar el consultorio en memoria de
nadie—, se reanuda por donde se quedó, y una línea corrupta no invalida el
archivo entero como sí haría un JSON gigante.

- La **cabecera** va primera con el índice y **lo excluido**.
- El **pie** cierra el archivo diciendo si quedó completo y qué falló: sin pie no
  hay forma de saber si la descarga se cortó a la mitad.
- Una colección ilegible se **declara** y el respaldo sigue — reventar entero
  deja al médico sin nada.

### Lo que NO se lleva, y es una decisión

Las **llaves de API** del consultorio (`secretos/`). Un respaldo se descarga, se
manda por correo y se deja en un escritorio: meterlas ahí lo convertiría en una
filtración de credenciales, y se vuelven a pegar en Configuración en un minuto.
**Lo que no se puede volver a teclear es el expediente.** Queda declarado en la
cabecera del propio archivo, para que nadie descubra la ausencia el día malo.

### Y la TERCERA vez que un guardián textual se apaga solo

El detector de PHI busca `collection('notas')`. El respaldo recorre las
subcolecciones con `collection(hija)` —dinámico, porque la lista vive en el
manifiesto—, así que **la ruta que se lleva todos los expedientes del
consultorio no contaba como lectora de PHI**.

Se añadió una segunda señal: la colección declarada como hija en un manifiesto.
Cada vez que un refactor correcto apague el guardián, la respuesta es **añadir la
señal, no bajar el listón**.

- `src/lib/clinica/respaldo.ts` (nuevo, puro),
  `src/app/api/clinic/exportar/route.ts` (nueva), `pacientes/page.tsx`,
  `authz-rutas-declaradas.test.ts` (segunda señal)
- `src/__tests__/respaldo-consultorio.test.ts` — 20 pruebas. Total 5231.

**Queda de D3 — el importador.** Sin él esto sigue siendo un archivo que nadie
sabe si sirve: hace falta `POST /api/clinic/importar` (idempotente por `_ruta`,
con modo ensayo) y una prueba de ida y vuelta contra el emulador que siembre una
clínica, exporte, importe en otra y **compare documento a documento**. Ésa es la
prueba que responde «sí, sabemos reconstruirlo».

---

## NONAGÉSIMA SÉPTIMA TANDA — v948 · EL CAMINO DE VUELTA

**Cierra D3.**

### Un respaldo sin importador es un archivo del que nadie sabe si sirve

v947 dejó el respaldo bien: servidor, NDJSON, paginado, con cabecera y pie. Pero
**no había importador**. «Tenemos respaldos» sin una restauración probada es una
**hipótesis**, y el propio `scripts/respaldos-verificar.mjs` termina diciéndolo:
«falta una cosa que esto no puede comprobar: haber RESTAURADO alguna vez».

`POST /api/clinic/importar` consume el NDJSON tal cual salió, escribe por lotes y
devuelve un informe con lo escrito por colección y **lo rechazado con su razón**.

### La prueba que responde «sí, sabemos reconstruirlo»

Se siembra un consultorio sintético, se exporta con el **mismo** constructor de
líneas que usa la ruta, se importa con el **mismo** lector, y se compara
**documento a documento** — incluidos los objetos y arreglos anidados, que es
donde se pierde información sin que se note.

**Lo que esa prueba NO demuestra, y queda dicho**: no toca Firestore. Demuestra
que el **formato no pierde nada** y que las rutas se reconstruyen exactas —donde
estaban los errores posibles—, no que el emulador escriba bien. El ensayo de
restauración con **RTO medido** sigue siendo del Dr.

### Los candados

- **Sólo a consultorio vacío**, salvo que se pida `sobrescribir` a propósito:
  restaurar encima mezcla dos historias clínicas sin que nadie pueda
  distinguirlas después.
- **Modo ensayo**: dice qué escribiría, sin escribir nada.
- **Las llaves de API no entran nunca**, aunque el archivo las traiga. `EXCLUIDAS`
  se consulta en los **dos** sentidos: lo que no sale en un respaldo tampoco entra
  por uno, y si algún día cambia, las dos mitades cambian solas.
- Una colección que el manifiesto no conoce se **rechaza**.
- La raíz se reescribe **siempre** al consultorio del parámetro, no al que venga
  escrito en un archivo que pudo tocar cualquiera.
- **Una línea rota no aborta la restauración** —ése es el motivo de que el
  respaldo sea NDJSON— y una ruta con forma inesperada **no se adivina**:
  adivinar dónde va un documento es peor que dejarlo fuera, porque lo deja mal
  puesto y nadie se entera.
- Un archivo **sin pie** se acepta pero se avisa: restaurar medio respaldo
  creyendo que era entero es la peor forma de perder datos — se cree que están.

- `src/lib/clinica/restaurar.ts` (nuevo, puro),
  `src/app/api/clinic/importar/route.ts` (nueva),
  `src/lib/clinica/respaldo.ts` (`lineaDeDocumento`, extraído para la prueba)
- `src/__tests__/respaldo-ida-y-vuelta.test.ts` — 19 pruebas. Total 5250.

---

## NONAGÉSIMA OCTAVA TANDA — v949 · LA BITÁCORA QUE NO SE PODÍA ENTREGAR

**Cierra D6.**

### Se podía mirar, no entregar

El panel de Cumplimiento pinta la bitácora y cita **NOM-024 Art. 6.5** en el
título de la sección. Pero **no se podía sacar de ahí**: ni un `Blob`, ni un
`download`. Y lo que se ve son los **200 asientos más recientes** —500 filtrando
por paciente—.

Ante una auditoría, una queja ante el INAI o un litigio, lo que se pide es el
rastro **del periodo**. **Un registro que sólo se puede mirar no es un registro
entregable.**

### Ahora: CSV del periodo, por streaming

Bajo `administrar` — la bitácora dice **quién vio el expediente de quién**: es
del responsable del tratamiento, no del mostrador ni del médico que aparece en
ella.

Exige `desde` y `hasta`: una bitácora sin periodo declarado no se puede presentar
como prueba de nada. Y el **día final entra entero**: `<= '2026-08-03'` dejaría
fuera todo ese día salvo la medianoche exacta — el error silencioso de siempre en
los rangos sobre marcas ISO.

### El detalle que arruina un CSV en silencio

Un campo con una coma, unas comillas o un salto de línea **desplaza todas las
columnas siguientes**, y el archivo se abre igual, sin error, con los datos
corridos. `meta` es texto libre puesto por veinte sitios distintos, así que pasa.

**Un CSV mal escapado es peor que no exportar**: se entrega, se abre, y quien lo
lee cree que está leyendo el rastro. Se entrecomilla **todo** —incluso lo
inofensivo— porque eso quita la decisión de en medio y no queda caso raro que se
escape.

### El archivo declara su alcance

La última fila dice el periodo y cuántos asientos trae, y si se alcanzó el tope
lo **grita**: un recorte que nadie ve se lee como «eso era todo el rastro», que
en una auditoría es justo la conclusión errónea. Una lectura interrumpida se
declara **dentro** del archivo, para que quien lo abra se entere aunque no vea la
consola.

La etiqueta legible va **al lado** del código, no en su lugar: el auditor lee la
etiqueta y quien revise el sistema necesita el código exacto.

### Y el guardián REG-059 cazó algo real en este mismo cambio

El módulo del CSV importaba las etiquetas de `audit-log.ts`, que arrastra el SDK
del **navegador** — se inicializa al importarse y rompe `next build` sin las
variables `NEXT_PUBLIC_FIREBASE_*`.

Se extrajeron a un módulo **puro** (`audit-eventos.ts`) que `audit-log`
re-exporta, en vez de duplicar el mapa y que las dos copias se desincronicen sin
que nadie lo note.

- `src/lib/expediente/bitacora-csv.ts` y `audit-eventos.ts` (nuevos, puros),
  `src/app/api/cumplimiento/bitacora/route.ts` (nueva), `cumplimiento/page.tsx`
- `src/__tests__/bitacora-exportable.test.ts` — 23 pruebas. Total 5273.

---

## NONAGÉSIMA NOVENA TANDA — v950 · LO CLÍNICO SALE, Y MI CSV SE REPARA A SÍ MISMO

**Cierra D4.**

### Primero, mi error de v949: inyección de fórmulas

El módulo de CSV de la bitácora —que escribí ayer— entrecomillaba todo y **se
creía a salvo**. Excel y Sheets **ejecutan** cualquier celda que empiece por
`=`, `+`, `-` o `@`, y **entrecomillar no protege de eso**: Excel evalúa igual.

Ese texto puede venir del nombre de un paciente o de una nota —cualquier cosa que
acabe en `meta`—, y quien ejecuta la fórmula al abrir el archivo es **el propio
médico**, o el auditor.

El repositorio **ya tenía** la defensa correcta desde antes —`lib/csv-seguro.ts`,
apóstrofo delante según OWASP— y yo no la estaba usando.

**Escribir la mitad de una defensa es peor que no escribirla**: se da por
resuelto lo que sigue abierto.

### Y D4: once columnas de demografía

La pantalla se llama **Migración** y su exportación son nombre, teléfono,
WhatsApp, correo, fecha de nacimiento, sexo, CURP, seguro, alergias, notas y
última cita. **Cero contenido clínico**: ni una consulta, ni un diagnóstico, ni
un medicamento, ni un cobro.

Y el argumento que sostiene esa pantalla es «no te secuestro tus datos». Un
competidor abre ese CSV en una demo y gana la reunión sin decir una palabra.

### Exportación clínica por dominio

Consultas, diagnósticos, medicamentos, laboratorios, citas y cobros — del
servidor y por streaming.

- **Una fila por elemento.** Un diagnóstico o un medicamento viven **dentro** de
  la nota, en arreglos; volcarlos en una celda los entrega y los pierde a la vez,
  porque nadie puede contar, filtrar ni sumar sobre `[object Object]`.
- Cada fila trae el **nombre** del paciente y la **referencia a su nota**, para
  poder leerla sin cruzar identificadores a mano.
- Una nota **sin** diagnósticos no produce una fila vacía: al sumar, el
  consultorio tendría más diagnósticos de los que hay.
- Con **BOM**: sin él, Excel abre el archivo en Latin-1 y «Rodríguez» sale
  «RodrÃ­guez» en la primera columna que se ve.
- Con el permiso del **médico**, no el del mostrador: vuelca diagnósticos y
  medicamentos de todos los pacientes, y ese permiso no alcanza ni para «sólo
  exportar».
- La última fila declara el alcance y **grita** si recortó.

**Y no sustituye al respaldo**: el NDJSON sirve para **reconstruir**, esto para
leer, contar o dárselo al contador. Confundirlos llevaría a que alguien crea que
exportando «Consultas» tiene su consultorio a salvo — por eso la pantalla lo dice.

- `src/lib/clinica/csv-clinico.ts` (nuevo, puro),
  `src/app/api/clinic/exportar-csv/route.ts` (nueva),
  `src/lib/expediente/bitacora-csv.ts` (la reparación de v949), `migracion/page.tsx`
- `src/__tests__/exportacion-clinica-csv.test.ts` — 20 pruebas. Total 5296.

**Queda D5**: un libro `.xlsx` de verdad, con una pestaña por dominio. Es el
único punto de la cola que pide una dependencia nueva (`exceljs`), y por eso va
aparte de este cambio.

---

## CENTÉSIMA TANDA — v951 · A LAS 3AM YA PASA ALGO

**Cierra I1 e I5 de la cola del equipo.** Es el punto que el SRE puso primero:
«sin esto, los otros cinco no se enteran de nada».

### No existía ningún canal de alerta a un ser humano

Buscado en todo `src/`: `slack|pagerduty|nodemailer|resend|sendgrid|SMTP` →
**cero coincidencias**. El plan de respuesta a incidentes define el canal de
detección como un buzón, y el propio documento dice entre paréntesis «(definir
buzón real)». El buzón no existe.

Y `cron_runs|ultimaEjecucion|heartbeat|latido` → **cero también**: nada
registraba que un cron hubiera corrido. El de recordatorios recorre todos los
consultorios **en serie** mandando WhatsApp y **no declaraba `maxDuration`**:
cuando se acababa el tiempo dejaban de recibir recordatorios **siempre los
mismos** —los del final de la lista— y la ruta respondía `200`.

Si el cron dejara de correr una semana entera, la única señal sería que los
pacientes no llegan.

### El latido y el vigilante

Los crons laten en sus **dos** salidas —éxito y error— sobre
`platform_heartbeats/{job}`: un documento por trabajo que **se sobrescribe**, no
una colección que crece sin barrendero (el problema que ya tienen `rate_limits` y
`platform_csp`).

Y un **vigilante** cada 15 min los mira **desde fuera**: si viviera dentro del
trabajo que vigila, cuando ese trabajo dejara de dispararse el aviso tampoco se
dispararía.

### El diagnóstico distingue lo que no es lo mismo

- **«nunca» no es «tarde»**: un trabajo recién desplegado todavía no ha latido, y
  uno que dejó de correr hace un mes **sí** tiene latido, sólo que viejo. Sin
  ninguno, lo que hay que revisar es el despliegue, no el trabajo.
- **«corrió a tiempo pero falló»** también duele.
- **Margen de dos periodos**: un retraso puntual —una ejecución lenta, un
  despliegue en medio— no es una avería. Gritar por eso enseña a ignorar las
  alertas, que es la forma más común de quedarse sin ninguna.

### El canal NO miente

Sin `OPS_ALERTA_WEBHOOK` devuelve `enviada: false` **con su razón**, y el
vigilante la enseña en su respuesta. **Un canal de alertas que devuelve éxito
cuando no está configurado es peor que no tenerlo**: se da por cubierto lo que
sigue descubierto — que es exactamente el fallo que viene a reparar.

Es un **webhook** y no un proveedor: lo recibe Slack, Discord, ntfy o Zapier. Así
no se elige hoy un proveedor por el Dr., no se añade dependencia, y la decisión
se toma con una variable en dos minutos. Exige `https`, tiene timeout de 5 s y
**no registra la URL** — un webhook lleva su secreto en la ruta.

- `src/lib/ops/latido.ts` y `src/lib/ops/alerta.ts` (nuevos),
  `src/app/api/cron/vigilante/route.ts` (nueva), `vercel.json`,
  los dos crons existentes, `reminders` con `maxDuration`
- `src/__tests__/ops-latido-y-alerta.test.ts` — 25 pruebas. Total 5321.
  Incluye un **guardián**: todo cron de `vercel.json` debe latir en sus dos
  salidas y tener periodo declarado.

**PENDIENTE DEL DR (una variable):** `OPS_ALERTA_WEBHOOK` en Vercel, con una URL
`https` que reciba un POST con JSON. Sin ella el vigilante corre igual y deja el
diagnóstico en su respuesta y en el registro, pero **no despierta a nadie**.

---

## CENTÉSIMA PRIMERA TANDA — v952 · EL LAMBDA COLGADO Y EL PUNTO CIEGO

**Cierra I2 e I4.**

### El gateway de IA no tenía timeout

`lib/ia/gateway.ts` centraliza **todas** las llamadas a Anthropic y OpenAI —lo
usan el Copilot de UCI, el bot de ayuda, la redacción del inmunocomprometido
(`maxDuration = 300`), la verificación de la nota y la atribución de roles— y su
`fetch` **no pasaba `signal`**.

Un socket colgado del proveedor **inmovilizaba el lambda los trescientos segundos
completos**, facturados por GB-segundo. Y el único módulo que existía para
centralizar las llamadas de proveedor era **justo el que no tenía la
protección**.

Lo mismo en los **cinco** envíos de WhatsApp, dentro de un cron que recorre todos
los consultorios **en serie**.

Ahora todo pasa por un helper que:

- limpia **siempre** el temporizador en un `finally` — ésa es la trampa de
  `AbortController`: sin eso queda un `setTimeout` vivo por cada llamada con
  éxito;
- respeta una cancelación que ya viniera de fuera;
- distingue **«se agotó el tiempo»** de **«no se pudo conectar»**: decir lo
  segundo por lo primero manda al médico a revisar su internet cuando el que no
  contesta es el proveedor;
- usa tiempos distintos por destino (IA 60 s, WhatsApp 10 s, alertas 5 s), porque
  el mismo número para los dos corta respuestas buenas o deja colgado un cron.

### La caída más grave era la única que no se reportaba

`global-error.tsx` —el boundary que se activa cuando falla algo tan arriba que
**ni el layout carga**— sólo hacía `console.error`. Los de dashboard y consulta
sí reportaban.

Y no era un olvido inocuo: `api/errores` exigía `verificarUsuario`, así que el
mini-Sentry **sólo aceptaba reportes de un usuario con sesión válida**. Un fallo
en el **login** —donde por definición no hay sesión— tampoco se podía reportar.
Mandarlo autenticado habría dado 401 y el reporte se habría perdido igual: **el
arreglo a medias que parece arreglo.**

Ahora la ruta acepta el reporte **anónimo**, con un freno más estrecho por IP
—5/hora frente a 20/5 min con sesión, porque sin sesión no hay a quién cortarle
el abuso, sólo una IP que se comparte— y **marcado** como anónimo: un reporte sin
dueño vale menos que uno con dueño, y quien lo lea tiene que poder distinguirlos.

- `src/lib/fetch-con-timeout.ts` (nuevo), `lib/ia/gateway.ts`,
  `lib/whatsapp-send.ts`, `app/global-error.tsx`, `lib/reportar-error.ts`,
  `api/errores/route.ts`
- `src/__tests__/ops-timeout-y-punto-ciego.test.ts` — 14 pruebas. Total 5335.

---

## CENTÉSIMA SEGUNDA TANDA — v953 · 276 KB POR VISITA, Y `/api/health`

**Cierra I3 e I8.** El primero es deuda que generé yo, versión a versión.

### El service worker pesaba 276 KB, y era culpa de esta bitácora

Cada versión desplegada añadía su párrafo a un comentario del `const CACHE`, en
la línea 8 de `public/sw.js`. **Esa línea sola llegó a 271 KB.**

Y `ServiceWorkerRegister` descarga ese archivo **entero**, con
`cache: 'no-store'` —o sea sin caché—, **en cada carga de página**, sólo para
leer `nexusmed-v(\d+)` y comparar el número.

Un cuarto de megabyte de egreso por visita, por usuario, para averiguar una cifra
de tres dígitos. Y creciendo con cada despliegue.

El texto **no sobraba** —explica por qué se hizo cada cambio, que es lo que hace
falta dentro de seis meses—; lo que sobraba era **dónde estaba**. Ahora vive en
`docs/maintenance/sw-changelog.md`, entero, y la versión se sirve en
`public/version.txt`: unas decenas de bytes, **generado** en el build desde el
propio `sw.js`. Dos sitios donde escribir la versión son dos sitios que se
desincronizan, y ésta gobierna la purga de caché — el navegador purgaría en bucle
o no purgaría nunca.

Y el generador **falla** si no encuentra la versión: sin ella la purga deja de
funcionar y los médicos se quedan con la aplicación vieja sin que nadie se
entere.

### No existía ningún endpoint de salud

`api/calendar/status` es el estado del Google Calendar **de un usuario**, no del
sistema. No había forma de saber si Firestore, Stripe o los proveedores de IA
están arriba, ni un monitor externo que lo comprobara.

`/api/health` va **sin autenticar a propósito** —un endpoint de salud detrás de
sesión no lo mira nadie a las 3am— y a cambio sólo devuelve **booleanos,
latencias y la versión**: ni una clave, ni un dato de paciente, ni el mensaje del
error de un proveedor (que puede llevar dentro parte de la petición).

- **No consume tokens**: pide la lista de modelos, no una respuesta. Un endpoint
  de salud que cuesta dinero cada minuto se acaba apagando, y entonces no hay
  salud que valga.
- **`ok: null` no es `false`**: uno es «contesté y está mal», el otro «no lo pude
  comprobar». Confundirlos pintaría de rojo un sistema sano, y una alarma que
  miente se acaba ignorando.
- Mira también los **latidos de los crons**: un sistema con todo arriba y los
  trabajos parados no está sano, y desde fuera se ve idéntico.
- Responde **503** cuando algo está caído — un monitor mira el código de estado,
  no el cuerpo.

### Y una excepción declarada, no una condición astuta

El guardián del libro de costos marcó `/api/health` por nombrar el host de
Anthropic. La sonda pide `GET /v1/models`, que es gratis. Se podría haber
estrechado la señal a `/v1/messages`, pero eso dejaría pasar en silencio
cualquier endpoint de pago que se use mañana: **una excepción declarada se
revisa, una condición astuta no**.

- `public/sw.js` (de 276 KB a 4,5 KB), `docs/maintenance/sw-changelog.md`
  (nuevo, con la historia entera), `scripts/version-sw.mjs` (nuevo),
  `public/version.txt`, `ServiceWorkerRegister.tsx`,
  `src/app/api/health/route.ts` (nueva)
- `src/__tests__/salud-y-peso-sw.test.ts` — 18 pruebas. Total 5354.

**Para el Dr.**: `/api/health` está listo para que un monitor externo gratuito
(UptimeRobot, BetterStack) lo consulte cada minuto. Ése es el segundo par de ojos
que hoy no existe.

### Verificado en producción, y una cosa que hay que decir

`sw.js`: **276 445 → 4 562 bytes**. `/api/health` responde 200 con Firestore,
Anthropic, OpenAI y Stripe arriba, y expone versión y commit.

Los `trabajos` salen ahora mismo en **`nunca`**: los latidos se desplegaron en
v951 y ningún cron ha vuelto a correr desde entonces —`reminders` es horario,
`limpiar-audio` diario—, así que **todavía no hay latido que leer**. Es la
respuesta correcta: `nunca` significa «no hay ni uno», no «está roto».

Y hay un reparto deliberado entre las dos piezas, que conviene tener escrito:

- **`/api/health` tolera `nunca`** y sólo se pone en 503 por `tarde`. Un monitor
  lo consulta cada minuto, y ponerlo en rojo durante las primeras 24 h de vida de
  esta función —por algo que se arregla solo— enseñaría a ignorarlo.
- **El vigilante SÍ grita por `nunca`**, porque es el que mira una vez cada
  quince minutos y el que sabe distinguir «acaba de desplegarse» de «lleva un mes
  muerto» mirando la lista completa.

Si dentro de un día `reminders` sigue en `nunca`, eso ya no es un despliegue
reciente: es que el cron no está corriendo, y entonces sí hay que mirarlo.

---

## CENTÉSIMA TERCERA TANDA — v954 · EL BARRENDERO QUE NO EXISTÍA

**Cierra I7.**

### Dos TTL escritos en comentarios, ninguno activado

Había dos crons y **ninguno borraba nada de Firestore**. Mientras tanto:

- `rate_limits` escribe **un documento por petición limitada**, con un `exp` que
  su propio código guardaba «para poder purgar con TTL de Firestore **si algún
  día se activa**». No se activó nunca.
- `whatsapp_dedup` escribe `expira` «para una política TTL que borra las marcas
  viejas solas». **Tampoco.**
- `platform_csp` la escribe un endpoint **público y sin autenticar**.

Dos veces la misma firma: **la regla escrita en un comentario que nada hace
cumplir.** Nada de eso rompe hoy; todo rompe con cien consultorios, por la vía
más cara — la factura y el rendimiento de las consultas.

### La línea que no se cruza

**Nada del expediente.** Cuánto se conserva un expediente lo fija la NOM-004 y el
abogado del consultorio, **no un cron**. Un barrendero que se lleve por delante
un dato clínico es infinitamente peor que una colección que crece: lo segundo
cuesta dinero, **lo primero cuesta el expediente de alguien**.

Una prueba falla si alguna regla apunta a una colección clínica, y **no admite
excepción declarable**.

### Lo que no se inventa, y lo que no se borra

- El plazo del dedup **no se inventa**: `dias: 0` sobre su propio `expira` hace
  exactamente lo que su TTL habría hecho. Respetar el plazo que el módulo declaró
  es mejor que elegir uno nuevo.
- **Lo que no se puede fechar no se borra**, y una fecha en el futuro tampoco —
  la misma regla que el barrido de audio.
- Se pagina por `__name__` y se filtra en memoria **a propósito**: un `where`
  sobre la fecha exigiría un índice creado a mano y, mientras no exista, la
  consulta falla **entera**. Un barrendero que no barre porque falta un índice es
  un barrendero que nadie echa de menos.

### El guardián encontró ocho colecciones sin decidir

Recorre `src/` buscando `adminDb.collection('X')`: cada colección de plataforma
tiene que estar **en las reglas** o **en la lista de exentas con su razón**.
Aparecieron ocho sin decidir y las ocho quedaron declaradas — incluidas las
**marcas de idempotencia de Stripe**, que no se barren porque borrarlas abre la
puerta a aplicar dos veces el mismo pago.

- `src/lib/ops/retencion.ts` (nuevo, puro),
  `src/app/api/cron/retencion/route.ts` (nueva), `vercel.json`,
  `lib/ops/latido.ts` (su periodo)
- `src/__tests__/retencion-plataforma.test.ts` — 22 pruebas. Total 5376.

---

## CENTÉSIMA CUARTA TANDA — v955 · LA CONSOLA QUE ESCANEABA TODO

**Cierra I6. Con esto queda cerrado el frente de Ingeniería entero.**

### La primera pantalla que daría timeout

```ts
adminDb.collection('clinics').get(),
adminDb.collection('platform_payments').get(),
```

**Sin `limit`, sin `where`** — y `platform_payments` crece un documento por cada
cargo de Stripe, **para siempre**. Después, dentro del `map`, una lectura más de
`secretos/ia` **por cada consultorio**: un N+1 sobre una lista sin techo.

Es la página por omisión del panel.

### La trampa de arreglarlo

Poner un `limit` y ya está convierte «ingreso histórico» en «ingreso de lo que
cupo», con el mismo nombre y el mismo aspecto. **Un recorte que nadie ve se lee
como el total** — y sobre ese número se toman decisiones de precio.

Es el mismo fallo que esta sesión lleva persiguiendo desde el `limit(60)` de la
lista de espera.

### Se acota Y se declara el alcance

- Ventana de **doce meses**: cubre el año fiscal y la comparación interanual, que
  es para lo que se mira esta pantalla. El histórico completo vive en Stripe, que
  es su sitio — la consola no es el libro mayor.
- La etiqueta **grita** si se alcanzó el tope.
- El KPI dejó de llamarse «Ingreso histórico»: ahora dice **«Ingreso cobrado»**
  con la ventana debajo. **El nombre cambia con el dato.**
- Si la lista de consultorios se corta, la pantalla lo **avisa** — una lista que
  se corta en silencio se lee como «ésos son todos», y sobre esa lectura se
  decide a quién llamar.
- Y el **CSV que se le manda al contador** lleva su propia fila de `ALCANCE`.

### El N+1 desapareció

`getAll` hace las mismas lecturas en **una sola ida**. Y si esa lectura en bloque
falla, no tumba la pantalla: el nivel de IA es un adorno de la fila, la lista de
clientes no.

- `src/lib/ops/alcance.ts` (nuevo, puro),
  `api/superadmin/clientes/route.ts`, `api/superadmin/contabilidad/route.ts`,
  `superadmin/page.tsx`, `superadmin/contabilidad/page.tsx`
- `src/__tests__/consola-acotada.test.ts` — 18 pruebas. Total 5394.

---

## CENTÉSIMA QUINTA TANDA — v956 · EL AISLAMIENTO SALVAJE QUE SALÍA MDR

**Cierra A1 de la cola del equipo — el defecto más peligroso del antibiograma.**

### Reproducido corriendo el motor, no leyendo el código

Un *Enterococcus faecalis* **pan-sensible** —sensible a ampicilina y a
vancomicina— trae en su reporte las tres resistencias **naturales** de la
especie. Con eso, el motor devolvía:

```
Fenotipo: Resistencia a colistina/polimixina [confirmado];
          Multidrogorresistente (no-S en 3 clases) [sospecha]
Mecanismo: Modificación del lípido A (mcr / pmrAB-mgrB)
ALERTAS: [crítica] Colistina-R: opciones muy limitadas.
```

Un aislamiento **tratable con ampicilina** salía como multirresistente, con
«última línea comprometida» y un mecanismo **plasmídico y transferible** (`mcr`)
afirmado con confianza `probable`.

La colistina no es una línea que ese organismo haya perdido: **nunca la tuvo**.
Es un Gram positivo. Lo mismo un *Proteus mirabilis* completamente sensible y un
*S. maltophilia* salvaje.

### Y la corrección ya estaba escrita

`esIntrinsecamenteResistente` existía, y `mdr.ts` **ya lo aplicaba** —con un
comentario que describe justo este fallo para Proteus—. Pero `analizarMDR` vuelve
temprano para todo lo que no sea Enterobacterales o Pseudomonas, así que los Gram
positivos y los no-fermentadores caían al **contador de respaldo** de `motor.ts`,
que no filtraba nada.

**La firma de siempre: escrito, probado, y sin aplicar en ese camino.**

### Lo que se excluye, se dice

La base del fenotipo MDR nombra ahora las R naturales que no contó: **un criterio
que se aplica en silencio no se puede revisar**. Si el Dr. lee «no-S en 3 clases»
sin saber que se dejaron fuera dos, no puede juzgar la cifra.

Con **control negativo**: una colistina-R en *E. coli* —que no es natural— sigue
disparando la alerta crítica. Sin esa prueba, la reparación podría haber apagado
la alerta para todo el mundo y la otra habría pasado igual.

### Lo que NO decidí

**NEEDS_CLINICAL_REVIEW**, declarado en el propio código: si el conteo MDR de
respaldo debe existir siquiera para Gram positivos —Magiorakos no define las
categorías igual para enterococo/estafilococo— es decisión del Dr. Filtrar lo
intrínseco es correcto en cualquiera de los dos casos; elegir por él, no.

- `src/lib/expediente/antibiograma/motor.ts`
- `src/__tests__/antibiograma-fenotipo-salvaje.test.ts` — 11 pruebas. Total 5405.

**El frente de ANTIBIOGRAMA (A1-A4) queda CERRADO** salvo lo que depende de las
**seis preguntas clínicas** del final de esta bitácora.

---


## CENTÉSIMA SEXTA TANDA — v957 · S POR FOTO, I TECLEADO

**Cierra A2 de la cola del equipo.**

### Primero corregí mi propia premisa

La cola decía «la CMI censurada se pierde en el camino de la foto». **En la
pantalla no se pierde**: `onFoto` mete `cmi_texto` en la fila como texto y el
memo le aplica `parseCMI`. Lo verifiqué antes de tocar nada.

Lo que sí estaba roto es el puente visión→motor de la **librería** —
`perfilAEntrada`, exportado en el índice público y probado como tal.

### El caso, corriendo el motor

*S. pneumoniae* de hemocultivo, **penicilina «>2»** reportada como S:

| camino   | lo que llega al motor           | categoría CLSI | ¿concuerda? |
|----------|---------------------------------|----------------|-------------|
| librería | `{ cmi: 2 }`                    | **S**          | sí          |
| pantalla | `{ cmi: 2, cmiCensurada: '>' }` | **I**          | **no**      |

«>2» dice que el valor real está por encima de 2, y el techo de susceptibilidad
es 2: S es imposible. Es la decisión que usted ya había tomado —«una CMI es un
intervalo, no un número»— aplicada en uno solo de los dos caminos.

### Por qué

`parseCMI` vivía dentro de `page.tsx`, así que la librería no podía usarla:
reenviaba `c.cmi` —el número pelado— y **nunca miraba `cmi_texto`**, que es donde
el propio prompt de visión pide que venga el símbolo.

Ahora hay **una sola** implementación, en `antibiograma/cmi.ts`, y un guardián
barre `src/` para que no aparezca una segunda. Dos implementaciones vuelven a
poder divergir, y divergen en silencio: nadie compara el mismo antibiograma
leído de las dos maneras.

### Y lo que se tiraba sin decirlo

El puente descartaba toda fila que no fuera S/I/R, así que un **SDD** reportado
por el laboratorio desaparecía del panel *y* de los avisos — y una fila que
desaparece se lee después como «ese antibiótico no se probó».
`perfilAEntradaConDescartes` devuelve la entrada **y** lo que no cupo: SDD,
ilegibles y dudosos, con su aviso ya redactado. Lo `needs_review` sí entra al
panel: es «revísalo», no «no se pudo leer».

**NEEDS_CLINICAL_REVIEW** — a qué categoría mapea un SDD y con qué dosis sigue
siendo suyo (es una de las seis preguntas de abajo).

- `src/lib/expediente/antibiograma/cmi.ts` (nuevo, puro),
  `antibiograma/vision.ts`, `app/(dashboard)/antibiograma/page.tsx`
- `src/__tests__/antibiograma-cmi-un-solo-parser.test.ts` — 22 pruebas. Total 5422.

---


## CENTÉSIMA SÉPTIMA TANDA — v958 · TRES CATEGORÍAS DEL MISMO FÁRMACO

**Cierra A3 de la cola del equipo.**

### El caso, corriendo el motor

*E. coli* de urocultivo, ciprofloxacino R y levofloxacino S con CMI 0.5. La regla
experta EUCAST T13 (13.5) edita el levofloxacino a **R** por cross-resistencia, y
el motor entregaba:

```
Panel (canónico): Levofloxacino=R [EDITADO: el laboratorio reportó S]
REGLA EXPERTA:    Levofloxacino S→R
CMI→CLSI:         Levofloxacino 0.5=S        ← sin marca, y `concuerda: true`
```

`concuerda: true` afirmaba «todo cuadra» exactamente donde este motor acababa de
decidir lo contrario. Y en pantalla esa fila se pintaba **VERDE** —el color de
«úsalo»— justo debajo del panel que decía R. **El verde es la parte que se lee
sin leer.**

### La raíz

El bucle de `categoriasCMI` recorría `r`, el panel CRUDO, en vez de
`resultadosEfectivos`. Es la misma familia del E0-15a que usted marcó como P0
—«nunca debe existir una pantalla donde Nexus muestre R y el LLM continúe
razonando con S»— en el único consumidor al que no se le cableó entonces.

### Lo que NO toqué, y por qué

`categoriaCLSI` sigue siendo **S**: 0.5 mg/L de levofloxacino ES S en la tabla del
CLSI, y eso es un hecho sobre la CMI. Falsearlo a R para tapar una contradicción
de presentación sería mentir sobre lo que dice el CLSI, y rompería la detección de
discordancia lab-vs-corte. `concuerda` sigue respondiendo a su pregunta de
siempre: ¿el LABORATORIO y el punto de corte dicen lo mismo?

Lo que se añade es **de qué lado está la fila**: `interpretacionEfectiva`,
`editadaPorReglaExperta` con razón y fuente, y `conflictoConEdicion` —el corte lo
deja utilizable y la interpretación canónica lo descarta, que es EL caso que hay
que enseñar porque es donde alguien prescribiría leyendo sólo la CMI—.

Las tres salidas lo rinden: el prompt lo dice en el **mismo renglón** (no tres
párrafos más arriba), la pantalla lo saca del verde igual que a un `noAplicable` y
añade la razón, y la nota ya imprimía el panel efectivo.

- `antibiograma/tipos.ts`, `antibiograma/motor.ts`, `antibiograma/razonar.ts`,
  `app/(dashboard)/antibiograma/page.tsx`
- `src/__tests__/antibiograma-edicion-llega-a-cmi.test.ts` — 12 pruebas. Total 5434.

---


## CENTÉSIMA OCTAVA TANDA — v959 · LA CONFIRMATORIA NEGATIVA QUE SE TIRABA

**Cierra A4 — con esto queda cerrado el frente de ANTIBIOGRAMA de la cola del
equipo (A1-A4), salvo lo que depende de sus seis preguntas.**

### El caso, corriendo el motor

*S. aureus* con **oxacilina R** en el panel y el **tamiz de cefoxitina NEGATIVO**
capturado del reporte:

```
Fenotipo: S. aureus resistente a meticilina (MRSA) [confirmado]
Aislamiento: Precauciones de contacto (MRSA).
Notificación epidemiológica OBLIGATORIA.
Pruebas por solicitar: Tamiz de cefoxitina…; D-zone test
```

Tres defectos en una sola salida:

1. El negativo acababa en un `didactica` **que la nota no imprimía nunca**. Las
   dos afirmaciones convivían y la inferida ganaba en silencio — con confianza
   `confirmado`, que es justo la palabra que la prueba negativa desmiente.
2. Se pedían las dos pruebas cuyo resultado usted acababa de capturar del propio
   reporte.
3. Nada declaraba que las dos fuentes se contradicen.

### Lo que NO hice

**No decidí cuál gana.** «Cefoxitina-neg contra oxacilina-R, ¿cuál manda?» es una
de sus seis preguntas y sigue pendiente: el fenotipo no se toca, ni su confianza,
ni el aislamiento, ni la notificación. Lo que un programa sí puede hacer sin
decidir nada es no dejar que las dos afirmaciones convivan calladas.

El conflicto sale como **alerta** y no como advertencia: las advertencias se
imprimen concatenadas, y una contradicción enterrada a mitad de párrafo se lee
igual que un consejo de stewardship. Como alerta sale en renglón propio en la
nota, en la caja de alertas de la pantalla y en el prompt, sin cablearla tres
veces.

Y lo que se recorta se dice: `pruebasYaReportadas` viaja aparte y las dos salidas
la nombran. Un indeterminado NO cuenta como respondido, y las pruebas que
responden otra pregunta —de qué clase es la carbapenemasa, que es lo que elige el
inhibidor— se siguen pidiendo.

- `antibiograma/confirmatorias.ts`, `antibiograma/clsi-pruebas.ts`,
  `antibiograma/motor.ts`, `antibiograma/resumen-nota.ts`, `antibiograma/tipos.ts`,
  `app/(dashboard)/antibiograma/page.tsx`
- `src/__tests__/antibiograma-confirmatoria-negativa.test.ts` — 14 pruebas. Total 5448.

---


## CENTÉSIMA NOVENA TANDA — v960 · EL LIBRO DE EXCEL (D5)

**Cierra D5 — el frente de DATOS queda cerrado salvo lo que depende de usted.**

### Verificado antes de tocar

«No existe exportación a Excel. Ninguna»: ni una línea de `xlsx` en el
repositorio. Sólo CSV.

### Sin dependencia nueva, que era la duda

`csv-clinico.ts` lo dejó escrito el día que se creó: «una pestaña por dominio es
como se piensa esa información, y **un CSV por dominio es la versión sin
dependencias nuevas de esa idea**».

Un `.xlsx` es un ZIP con media docena de XML dentro; para una tabla eso son 300
líneas deterministas y probables. Las librerías del ramo pesan megas, arrastran
árboles enteros y han tenido su cuota de CVEs — ninguna de las dos cosas se paga
con gusto en un producto que maneja expedientes. El escritor es nuestro.

### La ventaja de seguridad no es accidental

En CSV, `=1+1` lo **evalúa** Excel al abrirlo, y por eso `csv-seguro` le antepone
un apóstrofo. Aquí cada celda de texto va como `inlineStr`, un tipo que Excel
nunca evalúa. La defensa no es un filtro que haya que acordarse de aplicar: es el
formato. Probado con seis cargas hostiles.

### Cómo se prueba un binario

El golden escribe el archivo y lo abre con el `unzip` del sistema: `unzip -t`
comprueba el CRC de todos los miembros, que es el mismo control que hace el
lector al abrir. Comprobar que «devuelve bytes» no probaría nada. Y el escritor
es determinista a propósito, así que el mismo dato da el mismo archivo byte a
byte.

### Dos detalles que ya sabemos que se pagan caros

- **Una sola definición de la fila.** `filasDe` devolvía las filas ya unidas en
  CSV; llevarlas al libro habría exigido describir otra vez las mismas columnas
  en otro sitio — exactamente lo de la CMI en v957. Ahora `celdasDe` devuelve
  celdas y el CSV es una de las dos escrituras, no la fuente.
- **La pestaña RESUMEN va primera.** Un libro que abre en «consultas» con 4 000
  filas se lee como el consultorio entero. Declara qué trae, qué NO es (no
  sustituye al respaldo NDJSON) y qué topes se alcanzaron, con su nombre.

En la pantalla de Migración el botón nuevo va primero —«Todo en Excel (.xlsx)»— y
los seis CSV quedan detrás, para quien necesite uno suelto.

- `src/lib/xlsx.ts` (nuevo, puro), `api/clinic/exportar-excel/route.ts` (nueva),
  `lib/clinica/csv-clinico.ts`, `lib/authz/registro-rutas.ts`,
  `app/(dashboard)/migracion/page.tsx`
- `src/__tests__/xlsx-libro.test.ts` — 24 pruebas. Total 5472.

---


## CENTÉSIMA DÉCIMA TANDA — v961 · EL TRINQUETE DE COLOR DABA CERO (U4)

**Cierra U4 — y resulta bastante más grande de lo que decía la cola.**

### Lo que decía la cola, y lo que encontré

«Hueco real: `ToastContext.tsx:43-47` declara tres hex crudos y se escapan porque
la clave no es `color:`». Correcto. Pero eso era la punta: con esa forma se le
escapan **265 usos en 57 archivos**, y el trinquete reporta **cero** en sus tres
controles.

### El caso que lo destapó

```ts
const COLORS: Record<ToastType, string> = {
  success: '#22c55e', error: '#ef4444', info: '#3b82f6',
}
// …tres líneas más abajo:
<span style={{ color: COLORS[t.type] }}>
```

La clave no es `color:`, es `success:`. Y no es una pantalla suelta: es el acuse
de **toda** la aplicación — «Guardado», «No se pudo guardar», «Receta enviada».
Migrado a tokens, más el botón destructivo del confirm.

### La lección

Los tres controles miran **formas**, así que persiguen la sintaxis de ayer. El
control nuevo mira el **hecho**: cualquier color de `CRUDOS` escrito a mano, en
la forma que sea. Y `CRUDOS` no es arbitraria — son los colores que YA tienen
token en los dos temas, así que la respuesta es siempre la misma.

No cuenta, con su razón escrita: un `var(--red, #b91c1c)` (es la práctica
correcta; penalizarlo empujaría a quitar los respaldos), los comentarios (este
mismo archivo cita `#22c55e` para explicar el fallo), y `PAPEL`/`PALETAS`. Se
añaden a PAPEL los dos generadores de Word: una variable CSS no existe dentro de
un documento de Word.

### Por qué 265 y no 0

Migrar 265 usos en 57 pantallas de una sentada es un cambio visual que nadie
puede revisar de verdad, y romper una alerta clínica es un riesgo real. Igual que
el trinquete de lint: **la cifra sólo baja**. Lo que impide desde hoy es que entre
uno más.

Verificado con una mutación: metí `{ alto: '#dc2626' }` —la forma exacta que los
tres estrechos dejaban pasar— y el control ancho se puso rojo.

**Los peores, para cuando toque bajarlo:** hospitalización/[internamientoId] (26),
PanelCardiometabolico (22), superadmin (12), uci/antimicrobianos (10),
PreopAssessment (10).

- `src/context/ToastContext.tsx`, `src/__tests__/color-trinquete.test.ts`
- 3 pruebas nuevas. Total 5475.

---


## CENTÉSIMA UNDÉCIMA TANDA — v962 · LA PÍLDORA DE CINCO FORMAS (U2)

**Cierra U2** en su parte accionable: la escala queda con gobierno y el único
defecto real, reparado.

### Medido, no supuesto

**38** tamaños de letra en 2 749 usos · **37** espaciados en 3 826 (la cola decía
23) · **28** radios. Cero tokens en los tres.

### El único defecto que NO es cuestión de gusto

La píldora estaba escrita de **cinco formas**: `borderRadius: 100`, `999`,
`9999`, `99` y `50`.

Que un chip mida 12 o 12.5 px es criterio de diseño suyo. Que «redondéalo entero»
se escriba de cinco maneras no lo es: el navegador recorta el radio a la mitad
del lado más corto, así que en un chip las cinco se ven **igual** — y en cuanto
una se aplica a algo más alto dejan de coincidir, sin que nadie se entere hasta
que se ve raro.

Unificado en `var(--r-pill)`: **128 usos en 62 archivos**. Antes de tocar
comprobé que ninguna de las 98 apariciones de `100` está en una superficie alta
(96 de 98 llevan padding o tamaño pequeño en el mismo estilo), así que no cambia
un píxel de lo que ya estaba bien. Radios: 28 → 24.

Se declara también `--r-circulo: 50%`: el porcentaje deforma la esquina en elipse
y es otro efecto. Dos intenciones, dos nombres.

### Dónde está la deuda de verdad

**No en los 6 575 usos**: en los **53 valores que aparecen una o dos veces**, que
suman **231 usos** — el `fontSize: 66` suelto, el `gap: 70`, el
`borderRadius: 520`. Migrar eso llevaría la tipografía de 38 a 16 y el espaciado
de 37 a 19, y es trabajo de un rato.

Por eso el trinquete cuenta **variedad** y no usos: lo que importa no es cuántas
veces se escribe 13 px, es cuántos números distintos hay que recordar. Y el
mensaje de fallo lista los sueltos, así que la lista de trabajo se genera sola.

### Techos

38 / 37 / 24, y la píldora en **cero** —el único que va a cero, porque es el
único que no depende del criterio de nadie—. Mismo trato que lint y color: la
cifra sólo baja.

Verificado por mutación: metí `{ fontSize: 77, gap: 91, borderRadius: 999 }` y
los cuatro controles se pusieron rojos. También se comprueba que `--r-pill`
EXISTE en el CSS —un token inventado no da error: la propiedad se descarta en
silencio y el chip sale cuadrado— y que está en uso en más de 40 archivos.

- `src/app/globals.css`, 62 archivos con la píldora unificada
- `src/__tests__/escala-visual-trinquete.test.ts` — 8 pruebas. Total 5483.

---


## CENTÉSIMA DUODÉCIMA TANDA — v963 · 24 CONTROLES SIN TECLADO (U3)

**Cierra U3, corrigiendo su premisa.**

### La cola decía una cosa; medí, y era otra

«Las pantallas del comprador son las peores»: cierto en densidad (/demo 24.7,
landing 17.3). Pero **densidad de estilos no es daño**, y en esas pantallas no hay
**ni un solo** control inaccesible.

El daño estaba al lado, en SUS pantallas: **24 sitios con `<div onClick={…}>` y
nada más**. Para el ratón es un botón; para el teclado no existe.

### Dónde estaban

El **calendario** se llevó seis —la cita en vista día, en semana y en mes; la
franja horaria; la celda día×hora; y el día del mes—, más la lista de pacientes,
el tablero de camas, el pase de UCI, la hoja de enfermería… y las **filas de
tabla**, que viven en un componente compartido: arrastraban a todas las tablas de
la aplicación de una vez, y por eso arreglarlo ahí las arregla todas.

Un médico con la mano ocupada, o cualquiera que navegue por teclado, no podía
abrir la cita.

### Tres familias, que no se tratan igual

- **Control**: necesita foco y Enter/Espacio. `activable()` pone las cuatro cosas
  juntas, porque «acuérdate de añadir también el `onKeyDown`» se cumple en cinco
  pantallas y se olvida en la sexta.
- **Telón** (el fondo que cierra al hacer clic): NO es un control. Darle foco
  sería una parada de tabulador fantasma. Lo que el teclado espera es **Escape**,
  y en cuatro sitios no cerraba nada: el modal de laboratorios, el filtro de
  médicos, el menú de la cita y la barra lateral móvil. Ahora sí.
- **Escudo** (`stopPropagation` sin acción): no hace nada, no hay nada que
  activar. Pedirle foco sería ruido.

Un guardián que no distingue las tres acaba desactivado por ruidoso — y me pasó
dos veces al escribirlo: la primera versión cortaba en `onClick=` y clasificaba a
ciegas (marcaba a todo el mundo), y la segunda no reconocía `(e) =>` con
paréntesis. Las dos se arreglaron mirando la etiqueta entera.

Verificado por mutación: un `<div onClick={…}>` nuevo pone rojo el guardián.

- `src/lib/ui/activable.ts` (nuevo), `ui/Table.tsx`, calendario, pacientes,
  camas, UCI (pase y enfermería), DoctorFilter, PanelLaboratorios, citas, layout
- `src/__tests__/teclado-controles.test.ts` — 12 pruebas. Total 5495.

---


## CENTÉSIMA DECIMOTERCERA TANDA — v964 · EL PRECIO NO LLEGABA A LA CAJA (N3)

**Cierra N3.**

### El fallo

El catálogo editable existe, está probado, y lo leen la página de precios y
`/api/planes`. Pero los tres sitios donde el número se vuelve **dinero o
producto** seguían leyendo la constante del código:

- el **cupo de créditos** que se le entrega al consultorio,
- el **precio base** del cobro mensual por médico,
- el **tope** que corta la IA a media consulta.

Usted sube el plan Clínica de $899 a $949, la página lo anuncia, y la cuenta se
sigue haciendo con $899. Sube el cupo y el médico que paga sigue recibiendo el de
fábrica.

Un ajuste que no llega al cobro ni a la entrega no es un ajuste: es un letrero. Y
se rompe de la peor forma — nadie ve un error; el recibo y la página de precios
dicen cosas distintas, y el que lo nota es el cliente.

### Tres decisiones que no son obvias

1. **La caché dura exactamente lo mismo que la de la página pública** (60 s), y
   hay una prueba que lo fija leyendo los dos números. Dos retrasos distintos
   harían que durante un rato el escaparate y la caja discreparan.
2. **El fallo no se cachea**: cachearlo alargaría un problema de un instante a un
   minuto entero de cobros equivocados.
3. **Falla abierto**: si no se puede leer el catálogo se cobra con el de fábrica
   y se sigue. Cortarle la IA a un intensivista a las tres de la mañana porque no
   se pudo leer un *precio* es peor que cobrar con la tarifa del mes pasado.

Al guardar desde su consola se olvida la caché en el mismo paso, para que no vea
el precio nuevo en pantalla mientras el cobro usa el viejo.

### El guardián pide las dos mitades

Que los tres sitios llamen al catálogo vigente **y** que no quede la llamada de
fábrica. Dejar las dos es lo que produce que un camino cobre bien y el otro mal —
peor que estar mal en los dos, porque parece que funciona.

- `src/lib/finanzas/catalogo-servidor.ts` (nuevo), `ai-keys.ts`,
  `api/stripe/asientos`, `api/consultor-evidencia`, `api/superadmin/planes`
- `src/__tests__/catalogo-llega-a-la-caja.test.ts` — 13 pruebas. Total 5508.

---


## CENTÉSIMA DECIMOCUARTA TANDA — v965 · EL COBRO POR MÉDICO DEPENDÍA DE UN BOTÓN (N4)

**Cierra N4.**

### El fallo

En todo el repositorio hay **un solo sitio que escribe `medicosContratados`**: el
botón «sincronizar» de una pantalla de configuración. Ni el alta de un miembro,
ni un cron, ni el webhook.

Mientras tanto el cupo de IA escala con los médicos **presentes** y se aplica al
instante. Un consultorio da de alta cinco médicos, los cinco reciben su cuota esa
misma tarde, y la suscripción sigue cobrando uno — indefinidamente. **Es una fuga
que crece con el éxito.** Y el desajuste tampoco se ve: el aviso sólo aparece si
alguien abre esa pantalla concreta de ese consultorio concreto.

### Por qué NO se arregló bajando el cupo

La tentación era que el cupo siguiera a lo contratado. Sería el error de v944
otra vez: un consultorio con cuatro médicos de alta y el contador en uno —porque
nadie pulsó nunca el botón— vería su presupuesto de IA dividido entre cuatro de
un día para otro, sin haber hecho nada mal.

**El cupo sigue a los presentes. Lo que se arregla es que el cobro deje de
depender de un clic.**

### Va en los dos sentidos

El cron también ajusta **a la baja**: quien da de baja a dos médicos deja de
pagar por ellos esa misma noche sin pedirlo. Un cobro automático que sólo sube no
es una conciliación, es una trampa.

### Una sola implementación

La regla —«si Stripe no se pudo ajustar, NO se marca como contratado»— se extrajo
a `lib/finanzas/asientos.ts` y la usan el botón y el cron. La decisión está
separada del efecto (`queHacer` no toca Stripe), así que la parte que se puede
equivocar se prueba sin red.

- `src/lib/finanzas/asientos.ts` (nuevo), `api/cron/asientos` (nueva),
  `api/stripe/asientos`, `vercel.json`, `lib/ops/latido.ts`, `registro-rutas.ts`
- `src/__tests__/asientos-conciliacion.test.ts` — 18 pruebas. Total 5531.

---


## CENTÉSIMA DECIMOQUINTA TANDA — v966 · SUS DECISIONES 1 Y 6

**Usted contestó las seis preguntas.** Van las dos primeras; las cuatro restantes
salen en las siguientes versiones. Fuente:
`docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`.

### Las dos son la misma idea

Ninguna quita una alerta. Las dos quitan una **palabra** que el estándar no
respalda, y conservan la señal.

**Decisión 1 — no se declara MDR en Gram positivos.** La señal se conserva como
`resistencia-adquirida-extensa` («no susceptible en N clases evaluables») y el
propio texto dice que NO corresponde a una definición CLSI de MDR — sin esa
frase, el nombre nuevo se leería como un MDR disfrazado. En Gram negativos no
cambia nada, y hay un control que lo fija.

**Decisión 6 — discordancia no es «confirmado».** El fenotipo se sigue emitiendo
(CLSI manda reportar la resistencia a meticilina), pero la confianza baja a
`probable`, el nombre dice «por OXACILINA — resultado DISCORDANTE con cefoxitina»,
el mecanismo PBP2a baja igual, y sale la alerta crítica con su texto.

### Lo que NO toqué, a propósito

El aislamiento y la notificación siguen saliendo. Su principio rector —«CLSI
define categorías; aislamiento, notificación y selección terapéutica definitiva
deben permanecer como reglas institucionales separadas»— exige una capa aparte y
configurable por consultorio. Hacerlo de paso dejaría a alguien sin su aviso de
aislamiento sin haberlo decidido. Queda anotado como el siguiente paso del
frente clínico.

### Dos pruebas viejas fallaron, y estaba bien

El golden de v956 registraba la pregunta abierta. Ahora registra la respuesta, y
que el código **cita el documento** en vez de repetir el razonamiento clínico
dentro de un archivo que nadie vuelve a revisar.

- `antibiograma/tipos.ts`, `antibiograma/motor.ts`, `antibiograma/grampositivos.ts`
- `src/__tests__/decisiones-clinicas-1-y-6.test.ts` — 18 pruebas. Total 5549.

---


## CENTÉSIMA DECIMOSEXTA TANDA — v967 · SU DECISIÓN 2 (SDD)

### Lo que se perdía

El panel trabajaba sólo en S/I/R, así que un SDD reportado —cefepime,
piperacilina-tazobactam, ceftarolina, daptomicina— se quedaba **fuera** y sólo se
nombraba en un aviso que decía «captúralo a mano». Sus palabras: eso desperdicia
información clínicamente relevante.

### Las dos formas de equivocarse

Guardarlo como **S** lo vuelve un sensible cualquiera y pierde la condición de
dosis. Guardarlo como **I** lo convierte en la resistencia que CLSI advierte que
no hay que inventar. Por eso viaja **como sí mismo** de punta a punta.

### El compilador hizo la auditoría

Amplié el tipo de la celda a `CategoriaPanel = SIR | 'SDD'` —dejando `SIR` intacto
para lo que de verdad son tres categorías— y TypeScript señaló los **seis** sitios
a revisar. Ninguno se descubrió leyendo.

### El detalle que salvó el conteo

Los predicados estaban escritos en positivo (`NO_S = v === 'R' || v === 'I'`), así
que un SDD ya caía fuera del conteo de no-sensibles. Si hubiera sido `v !== 'S'`,
el fármaco que el laboratorio declaró utilizable con dosis alta habría sumado para
declarar multirresistencia — el error que CLSI advierte. Queda fijado con prueba.

### Sale con su condición en las tres salidas

La nota imprime «Cefepime SDD (CMI 4) [requiere EXPOSICIÓN AUMENTADA…]» y el
prompt lleva «NO equivale a S ni a I». La categoría sola se lee como una
sensibilidad cualquiera.

- `antibiograma/tipos.ts`, `util.ts`, `vision.ts`, `motor.ts`, `resumen-nota.ts`,
  `razonar.ts`
- `src/__tests__/decision-clinica-2-sdd.test.ts` — 16 pruebas. Total 5565.

---


## CENTÉSIMA DECIMOSÉPTIMA TANDA — v968 · SUS DECISIONES 13 Y 10

Las dos son «dejar de mostrar lo que no está respaldado».

### 13 — CFDI: primero corregí mi premisa

**Sí existe** una implementación (Facturama), pero es **de NexusMED a usted** por
su suscripción, y funciona. Lo que `/operacion` prometía —dentro de una lista de
capacidades DEL CONSULTORIO y con la etiqueta «Disponible hoy»— es que usted
**facture a sus pacientes**: «Requiere tus CSD/SAT». Eso no existe.

Retirar la promesa sin más habría borrado también la función real. Ahora la
página dice las tres cosas por separado: **recibo de cobro (no fiscal)** ·
**tu factura de NexusMED (CFDI 4.0)**, que sí funciona y no requiere sus CSD ·
**facturar a tus pacientes**, en Roadmap, con la lista de lo que exige.

### 10 — las 42 recomendaciones de inmuno

Medido: **39 de 42 no declaran fuente**. Se retiran de la salida clínica, **sin
borrarse**.

Usted descartó marcarlas como «criterio del autor» con una razón que vale para
todo el producto: dentro del motor clínico, una etiqueta discreta acaba
adquiriendo visualmente la misma autoridad que una guía.

**Una sola puerta**, y el selector de fármacos filtra igual: un candidato
derivado de una recomendación sin fuente es la salida clínica más comprometida de
todas —es sugerir un medicamento—, y la pantalla y la nota tienen que ofrecer el
mismo conjunto o usted marca algo que luego desaparece sin explicación.

**Lo que se retuvo se dice**, en la nota y en pantalla: una lista que encoge en
silencio se lee como «no hay más que recomendar».

### El impacto real, medido — hay que saberlo

| caso | salen | retenidas |
|---|---|---|
| SOT riñón en curso | **0** | 2 |
| VIH CD4 120 | **0** | 1 |
| TCMH alogénico | **0** | 3 |
| Anti-TNF | 2 | 0 |

Las recomendaciones **por huésped se apagan enteras**; las de **fármaco**
sobreviven porque `farmacos.ts` sí llena la fuente. El módulo queda casi mudo del
lado del huésped hasta que se asignen fuentes — que es exactamente lo que
significa la opción C que usted eligió.

### El camino de vuelta está listo

`node scripts/inmuno-sin-fuente.mjs` genera
`docs/maintenance/INMUNO-RECOMENDACIONES-SIN-FUENTE.md` con las 39, su
archivo:línea y las columnas vacías (fuente, población, condición, excepciones,
fecha, versión, evidencia, revisor). **Van vacías a propósito**: rellenarlas con
una suposición mía sería el mismo problema disfrazado de dato. Basta añadir el
cuarto argumento a `rec(...)` para que una vuelva a salir.

- `lib/inmuno/sin-fuente.ts` (nuevo), `lib/inmuno/nota.ts`,
  `components/pacientes/ValoracionInmuno.tsx`, `app/operacion/page.tsx`,
  `app/arquitectura/page.tsx`, `scripts/inmuno-sin-fuente.mjs` (nuevo)
- Total 5567.

---


## CENTÉSIMA DECIMOCTAVA TANDA — v969 · SUS DECISIONES 4 Y 5

Las dos sobre el mismo error, por los dos lados: un negativo puede **ignorarse** o
**sobreleerse**, y usted cortó una por decisión.

**4 — BLEE:** ni ignorar ni cancelar. Antes un `esbl: 'neg'` no tocaba nada
(`BLEE[probable]`); ahora baja a `sospecha`, el NOMBRE dice «NO CONFIRMADA» —quien
lee la nota ve el nombre, no el enum— y la base explica por qué se degrada en vez
de cancelarse.

**5 — mCIM:** se dice «carbapenemasa no detectada» **y lo que NO significa**, que
es la mitad que siempre se pierde. Resistencia CONFIRMADA por AST · mecanismo
INDETERMINADO · pedir método adicional. El motor no reorienta a permeabilidad,
eflujo ni porinas. Y en *Acinetobacter* se advierte que CLSI no respalda el mCIM.

### El error que me atrapó un golden viejo

Escribí la degradación como regla **genérica** sobre la tabla de confirmatorias, y
alcanzó al MRSA: el golden de v959 se puso rojo al pasar de `confirmado` a
`sospecha`.

Estaba **extendiendo una decisión clínica más allá de donde usted la tomó**, y
encima pisando otra suya más específica — la 4 es sobre la BLEE; el caso
cefoxitina-vs-oxacilina lo resolvió en la 6, donde CLSI manda reportar la
resistencia si cualquiera de las dos pruebas es resistente. MRSA queda excluido
con la razón escrita y una prueba que fija la frontera entre las dos decisiones.

- `antibiograma/confirmatorias.ts`, `antibiograma/motor.ts`
- `src/__tests__/decisiones-clinicas-4-y-5.test.ts` — 23 pruebas. Total 5588.

---


## CENTÉSIMA DECIMONOVENA TANDA — v970 · SU DECISIÓN 3 (PROCEDENCIA)

**Con esto quedan implementadas LAS SEIS decisiones del antibiograma.**

### La regla

Edita la categoría del laboratorio **sólo** con los ocho campos verificados:
organismo y antimicrobiano reconocidos · método · sitio donde el corte lo exige ·
estándar · **edición** · unidad · valor de CMI. Y cuando falta alguno, el motor
dice **cuál**.

### Lo que significa hoy, y hay que mirarlo de frente

El extractor de la foto **no** captura el estándar ni la edición: no vienen
impresos en la mayoría de los reportes. Así que, mientras usted no los declare,
**el motor no edita nunca**. No es un defecto: es la consecuencia correcta de la
regla — editar por omisión es lo que la decisión prohíbe.

### La parte que más importa

La edición se decide y se aplica **antes** de los módulos. Si se hiciera al armar
la tabla de CMI, el panel diría R y los fenotipos se habrían calculado con la S
del laboratorio: el defecto E0-15a de la v958 otra vez, por una puerta nueva. Hay
prueba con un carbapenémico editado a R que sí dispara el fenotipo.

### Dos premisas mías que fallaron

Las destaparon mis propias pruebas. La comparación de ediciones juntaba todos los
números, así que «M100-Ed35» y «Ed35» se leían como estándares distintos. Y busqué
la razón de la edición en la lista equivocada — lo que destapó algo mejor: las dos
clases de edición se declaran ahora juntas, cada una con su razón.

### El límite, declarado

«Bloquear las conclusiones dependientes» está a **nivel de fila**. El rastreo
completo de dependencias no está hecho, y se dice en `ALCANCE_DEL_BLOQUEO` en vez
de dejarlo implícito.

- `antibiograma/procedencia.ts` (nuevo), `tipos.ts`, `motor.ts`, `util.ts`
- `src/__tests__/decision-clinica-3-procedencia.test.ts` — 31 pruebas. Total 5619.

---


## CENTÉSIMA VIGÉSIMA TANDA — v971 · LA DECISIÓN 3 NO SE PODÍA DISPARAR

### El fallo fue mío, y es el de siempre

En la v970 implementé la decisión 3 completa, la probé con 31 casos, la desplegué
— y **dos de los ocho campos no los capturaba nadie**. Ni la pantalla ni la foto.
Una regla escrita, probada, desplegada y **muerta**: exactamente el patrón que
este repositorio lleva persiguiendo toda la sesión.

### Lo que hay ahora

Un bloque de **procedencia del reporte** en la pantalla (estándar, edición,
método, unidad) que dice para qué sirve, y que enseña con qué estándar interpreta
el motor — sin eso, usted no sabe contra qué se compara su reporte.

El extractor de la foto también los pide, con la mitad que importa escrita en el
prompt: **si no aparece impreso, NO lo pongas**. Un estándar que no se reconoce
cae en «otro», nunca en el del motor: meterlo en CLSI porque no se supo leer
desbloquearía la edición con un estándar desconocido.

**Nada se rellena por omisión.** Poner «CLSI» porque es lo más común sería
declarar por el laboratorio justo el campo que la regla existe para comprobar.

### El guardián

Comprueba que la pantalla captura los cuatro campos, que la procedencia llega al
motor **y** al razonamiento con IA, y recorre el ciclo completo de la foto al
motor en los dos escenarios. Verificado por mutación: quitar la procedencia de la
llamada al motor lo pone rojo.

- `app/(dashboard)/antibiograma/page.tsx`, `antibiograma/vision.ts`
- `src/__tests__/procedencia-alcanzable.test.ts` — 15 pruebas. Total 5634.

---


## CENTÉSIMA VIGESIMOPRIMERA TANDA — v972 · SU DECISIÓN 11 (PRUEBA SIN TARJETA)

### El muro

`estadoAcceso` devolvía `'sin_tarjeta'` para todo lo que no fuera `active` —
también para `status: 'trial'`, que es como nace **cada cuenta nueva**. Y corre
antes que nada. El médico que acababa de leer «14 días gratis, sin tarjeta»
chocaba contra una pared pidiéndole la tarjeta.

### Lo que hace este caso tan caro

**El modelo A completo ya estaba construido.** `paywall-prueba.ts`,
`firestore.rules`, `pruebaAgotada`, `gateCreditos` — con su bolsa de IA, su corte
sin overage y su mensaje correcto. Todo escrito, probado, espejado en las
reglas… e **inalcanzable**, porque tres líneas devolvían antes.

Y las 5 634 pruebas pasaban: **ninguna afirmaba que un médico en prueba debiera
chocar contra el muro**. Quitarlo no rompió una sola.

### Ahora

`trial` entra al flujo completo. La prueba vencida tampoco va al muro: la
gobierna el paywall —lectura, impresión y exportación intactas, escritura e IA
detenidas—, que es el PAUSED que usted pidió. Una cuenta sin `status` también
entra: bajo el modelo A una cuenta nueva ES una prueba.

### La cifra de la bolsa sigue siendo suya

«Debe salir del Cost Engine, no elegirse arbitrariamente» — y el Cost Engine
depende de la decisión 12. El mecanismo está y el tope se mueve por variable de
entorno; la prueba fija eso, **no cuánto vale**.

- `app/(dashboard)/layout.tsx`
- `src/__tests__/decision-11-prueba-sin-tarjeta.test.ts` — 20 pruebas. Total 5654.

---


## CENTÉSIMA VIGESIMOSEGUNDA TANDA — v973 · SU CONSULTA DE LUIS

**Fallo encontrado por el Dr. en producción, sobre una consulta real.** Se paró
la cola para esto.

### Lo que pasó

Dictó la consulta completa y la nota salió como «datos sociodemográficos», con
«Padecimiento actual: No referido». Y «la de la **docencia**» —error de audio—
apareció aguas abajo como **«vesícula»**, un órgano que el paciente nunca
mencionó.

### La causa

`intentarDiarizar` esperaba **tres minutos** para cualquier grabación. Una
consulta real dura más, así que el contador se agotaba SIEMPRE y devolvía `null`
— el mismo `null` que «no hay llave», «falló el proveedor» y «se cayó la red».
Caía a Whisper sin separación de voces y no se lo decía a nadie.

**La llave de AssemblyAI estaba puesta y pagada desde hacía 47 días.** Lo que
falló fue el reloj.

### Arreglado

- La espera la fija el audio (1,5× + 1 min; piso 1, techo 20).
- Los cinco motivos se distinguen y llegan a la pantalla con qué revisar.
- **La transcripción es de la plataforma, para todos** (su decisión). Cierra la
  trampa de que la llave del consultorio ganaba a la buena y degradaba en
  silencio.

### Lo que queda de este frente

La confianza por palabra que AssemblyAI ya devuelve **se sigue descartando**
(`Utterance = { speaker, text }`). Ése es el mecanismo de «docencia → vesícula»:
el motor sabía que dudaba y borramos la duda antes de que llegara a la nota.
Es lo siguiente.

- `src/hooks/useGrabacionAudio.ts`, `src/lib/ai-keys.ts`,
  `app/(dashboard)/consulta/[patientId]/page.tsx`,
  `app/(dashboard)/configuracion/secciones-cuenta.tsx`
- `src/__tests__/diarizacion-no-se-rinde-callada.test.ts` — 15 pruebas. Total 5669.

---

## CENTÉSIMA VIGESIMOTERCERA TANDA — v974 · EL SALDO DE LOS PROVEEDORES

**Petición del Dr.:** «implementa en los paquetes y en los costos todo lo de
AssemblyAI, y estar al pendiente cuánto saldo tengo, para estarle abonando y los
clientes no se queden sin IA».

### Lo que encontré al ir a mirar

1. **AssemblyAI no tenía tarifa.** Cada transcripción diarizada entraba al libro
   de costos con `costoUsd: null` y salía por «sin tarifa»: el renglón que corre
   en TODAS las consultas era invisible en el margen. El propio código lo decía
   —«cargar el precio real es un pendiente declarado, no un olvido»— y ahí
   llevaba desde la v742.
2. **Los minutos tampoco viajaban.** El costo se anotaba en el POST, que sólo
   encola; la duración del audio no existe hasta que el trabajo termina. Un
   precio por minuto sin minutos habría dado **cero**, que es peor que `null`
   porque parece un dato.
3. **Nadie miraba el saldo.** Si la cuenta de AssemblyAI llega a cero, todas las
   consultas pierden la separación de voces a la vez. Desde la v973 al menos se
   dice — pero se dice después, con el paciente enfrente.

### Arreglado

- **Tarifa cargada con su fuente**: $0.21/h (Universal-3.5 Pro, donde enruta
  `best`) + $0.02/h de diarización = **$0.23/h**, leído de
  `assemblyai.com/pricing` el 3-ago-2026 y citado en el código. Una consulta de
  doce minutos cuesta unos 4.6 centavos de dólar.
- **El asiento se anota al TERMINAR**, con `audio_duration` del propio
  proveedor, no con una estimación nuestra.
- **Saldo por proveedor**: no existe endpoint de saldo en ninguna de las tres
  APIs, así que el saldo no se lee, **se lleva** — usted anota lo que abona y el
  libro de costos aporta lo gastado. Aparece en `/superadmin/costos`, arriba del
  gasto, con su formulario para registrar el abono sin tocar Firestore.
- **El vigilante lo mira cada vez que corre** y avisa por el canal de operación
  que ya existe, con **días de autonomía** y no con dólares: veinte dólares son
  un mes para un consultorio y dos días para veinte.

### Las trampas que se cerraron a propósito

- Sin abonos registrados **no** se declara agotado (saldría rojo con la cuenta
  llena; un aviso falso enseña a ignorar los avisos).
- Los asientos sin tarifa **no** se suman como cero al medir el gasto: verían
  menos gasto del real y el aviso llegaría tarde.
- No se aceptan abonos negativos: bajarían el saldo sin que nadie gastara.
- La cifra se llama **estimada** en toda la pantalla — sale de nuestros
  asientos, no del estado de cuenta del proveedor.

### Lo que sigue pendiente de este frente

La **confianza por palabra** (v973) sigue descartada: es el mecanismo de
«docencia → vesícula» y sigue siendo lo siguiente.

- `src/lib/finanzas/saldo-proveedores.ts` (puro), `saldo-servidor.ts`,
  `precios-modelo.ts`, `src/lib/ops/retencion.ts`,
  `api/superadmin/costos/route.ts` (GET + POST nuevo),
  `api/cron/vigilante/route.ts`, `api/expediente/transcribir-diarizado/route.ts`,
  `app/superadmin/costos/page.tsx`
- `src/__tests__/saldo-proveedores-ia.test.ts` — 28 pruebas. Total **5697**.

---

## CENTÉSIMA VIGESIMOCUARTA TANDA — v975 · LA CONFIANZA POR PALABRA

Esto es **el mecanismo** de «docencia → vesícula», que la v973 dejó apuntado
como lo siguiente.

### Lo que estaba pasando

AssemblyAI devuelve una confianza por **cada palabra**. La ruta la tiraba en el
mapeo de la respuesta:

    (u) => ({ speaker: u.speaker, text: u.text })   // ← `u.words` a la basura

Después de esa línea, una palabra que el motor dio con **0.31** y otra que dio
con **0.99** son indistinguibles: las dos son texto plano. El modelo recibía una
frase perfectamente segura de sí misma y hacía lo que hace cualquier lector con
una frase segura — razonar sobre ella. Ahí es donde «la de la docencia» ascendió
a **«vesícula»**.

El motor sabía que dudaba. La duda la borramos nosotros, y era gratis.

### Arreglado

- **La palabra viaja con su confianza** de la ruta al hook y del hook a la nota.
- **El texto que va al modelo trae marcadas** las palabras dudosas (`⟦palabra?⟧`)
  y, pegada, la regla: *una palabra marcada NUNCA se convierte en un hecho
  clínico; no la corrijas, no la sustituyas por la más probable; si una frase
  depende de ella, «no inteligible, confirmar»; y ausencia de dato no es dato de
  ausencia*.
- **El médico ve una lista corta** de «palabras que el audio no oyó con
  seguridad», con el minuto y el porcentaje, **antes de firmar** — junto al
  dictado, que es donde todavía se acuerda de lo que dijo el paciente.
- **Dos reglas nuevas en el prompt** (21 y 22) contra las dos frases exactas de
  la nota que falló: la nota habla del paciente y **nunca de la grabación**
  («en este fragmento de consulta» queda prohibido), y una laguna no se convierte
  en una negación.

### Lo que este módulo NO hace, y es la mitad del asunto

**No corrige.** No busca la palabra clínica más parecida a «docencia». Eso es
exactamente cómo se llega a «vesícula»: el mismo fallo, cometido por nosotros y
con más confianza. Se marca la duda; no se resuelve.

Las palabras vacías (`la`, `de`, `un`) no se marcan aunque puntúen bajísimo:
ninguna se convierte jamás en un hecho clínico, y un texto lleno de marcas se lee
igual que uno sin ninguna.

### Lo que queda declarado, no dado por hecho

**El umbral 0.6 no está calibrado** (`NEEDS_CALIBRATION` en el código). Se
calibra contra el banco de voz con audio real que ya existe, contando cuántas
palabras mal oídas quedan por encima del corte. Se eligió errando hacia marcar de
más: marcar de más cuesta una mirada, marcar de menos cuesta una palabra
inventada dentro de una nota firmada. Movible por variable de entorno
(`NEXT_PUBLIC_UMBRAL_CONFIANZA_AUDIO`) sin tocar código.

- `src/lib/expediente/confianza-audio.ts` (puro, nuevo),
  `api/expediente/transcribir-diarizado/route.ts`, `src/hooks/useGrabacionAudio.ts`,
  `src/lib/expediente/prompts.ts`, `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/confianza-por-palabra.test.ts` — 31 pruebas. Total **5728**.

---

## CENTÉSIMA VIGESIMOQUINTA TANDA — v976 · EL DIAGNÓSTICO QUE NADIE DIJO

**Segundo fallo que el Dr. encuentra en la misma consulta, y es el peor.** Se
paró la cola otra vez.

### Lo que vio

En el dictado: «¿Enfermedades crónicas como diabetes o presión alta? **No.**»

En el resumen que salió: «Paciente con **Hipertensión arterial, Diabetes
mellitus tipo 2**.»

Palabras suyas: *«ve claramente dice que no tiene DM2 y le pones que es DM e
hipertenso»*.

### Por qué es peor que lo de la vesícula

«Vesícula» era un órgano de más en un padecimiento. Un **antecedente crónico
inventado** cambia el riesgo quirúrgico, cambia la elección de fármacos y **se
arrastra**: los antecedentes se copian a todas las notas siguientes, así que el
error se propaga solo y cada copia lo vuelve más creíble.

### Por qué pasa

El interrogatorio se dicta **nombrando las enfermedades en la pregunta**. Un
extractor ve «diabetes» y «presión alta» en el texto y las cosecha; el «No» es
una palabra corta, en otra frase y dicha por otra persona.

### Arreglado — defensa de DOS capas

1. **Regla 23 del prompt**: una enfermedad nombrada en la pregunta NO es un
   diagnóstico; si la respuesta es «no», va como negativo pertinente y jamás en
   diagnósticos, resumen ni antecedentes.
2. **Motor determinista** (`negaciones.ts`): lee el dictado, saca lo que el
   paciente negó y lo **contrasta** contra la nota entera —resumen, diagnósticos
   y todas las secciones—. Si discrepan, sale una alerta roja con lo que se oyó
   y lo que se escribió.

La regla sola no bastaba: un prompt es una petición que se cumple *casi siempre*,
y «casi siempre» sobre un antecedente crónico no es suficiente.

### Lo que el motor NO hace

**No decide cuál de las dos es correcta.** Un paciente puede negar una diabetes
que sí tiene documentada de hace tres años; entonces la nota tiene razón y el
interrogatorio no. Lo único que se afirma es que dictado y nota se contradicen —
resolverlo es una decisión clínica del médico.

Tampoco marca de más: «niega diabetes» en la nota es lo correcto y no dispara
nada; el silencio no cuenta como negación.

### Limitación declarada

El vocabulario cubre 12 crónicas del interrogatorio dirigido. Que falte una
significa que **ese caso no se vigila** — nunca que se dé por bueno. El motor
sólo puede señalar de menos.

- `src/lib/expediente/negaciones.ts` (puro, nuevo), `src/lib/expediente/prompts.ts`,
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/negacion-diagnostico-inventado.test.ts` — 26 pruebas, con el
  dictado y el resumen REALES del caso. Total **5754**.

---

## CENTÉSIMA VIGESIMOSEXTA TANDA — v977 · EL MISMO FALLO, UNA CAPA MÁS ADENTRO

La v976 reparó la NOTA. Al verificarlo encontré que **el extractor de entidades
corre sobre el mismo texto** y tenía el mismo defecto: «¿diabetes o presión alta?
No» le devolvía las dos como condiciones, con `certeza: confirmado`.

Reparar sólo la nota habría dejado la contradicción viva en la pantalla de al
lado — y con **peor pinta**: una entidad estructurada, con su código CIE-10 y su
chip de color, parece un dato verificado.

### Arreglado

- **La ruta lo corrige en el SERVIDOR**, no en la pantalla: la consumen la
  consulta y la ficha del paciente, así que arreglarlo en una habría dejado la
  otra rota.
- **Se reclasifica a `descartado`, NO se borra.** «Niega diabetes» es un negativo
  pertinente y es información clínica real; lo que no puede pasar es que viaje
  como confirmada, porque desde ahí se comporta como un antecedente.
- **Lo corregido se dice**: el panel enseña qué condiciones se reclasificaron y
  la cita del dictado. Una corrección silenciosa se ve igual que un extractor que
  acertó a la primera — y entonces nadie se entera de que el modelo sigue
  cosechando términos de las preguntas.
- Regla equivalente en el **prompt del NER**, más una segunda: cuando el texto
  viene con turnos, quien afirma o niega un antecedente es el PACIENTE; lo que
  dice el médico en una pregunta no es un hallazgo.

### Detalles que evitan romper otra cosa

- Se conservan los demás campos de la condición (CIE-10 incluido): reconstruir el
  objeto perdiendo el código rompería el reporte COFEPRIS.
- Si el extractor ya la puso como `descartado`, acertó: no se toca ni se anota
  una corrección que no hubo.

- `src/lib/expediente/negaciones.ts`, `src/lib/expediente/medical-ner.ts`,
  `api/expediente/extraer-entidades/route.ts`, `src/components/NerPanel.tsx`,
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/negacion-diagnostico-inventado.test.ts` — +10 (36). Total **5764**.

---

## CENTÉSIMA VIGESIMOSÉPTIMA TANDA — v978 · N5, EL COSTO DE IA INVENTADO

### Lo que había

    const COSTO_CREDITO_MXN = Number(process.env.COSTO_CREDITO_MXN ?? '1.5')
    const costoIA = creditos * COSTO_CREDITO_MXN

Un crédito valía **1.5 pesos porque sí**. El comentario del propio código lo
confesaba: «Haiku/Sonnet/Opus rondan ~$1.5 MXN por crédito» — de memoria, sin
fuente y sin fecha. Y el **libro de costos** lleva desde el 30-jul anotando,
llamada por llamada, el costo REAL en dólares. Nadie lo leía desde contabilidad:
la utilidad, el margen y las decisiones de precio salían de un supuesto
**teniendo el dato medido al lado**.

### Por qué no bastaba «poner el número bueno»

Porque no hay un número bueno: **un crédito no cuesta lo mismo según el modelo**.
Una nota con razonamiento extendido y una corrección rápida consumen créditos
parecidos y cuestan órdenes de magnitud distintas. Cualquier constante es falsa.

### Arreglado

- La contabilidad **lee el libro de costos** del mes y suma lo que costó de
  verdad, por consultorio y en total.
- El gasto del **fundador** (I+D) no se carga al margen de los clientes — la
  misma separación que ya hace la consola de costos.
- Las llamadas **sin tarifa no se suman como cero**: darían un costo menor y un
  margen mejor del que hay, que es justo la cifra sobre la que se fija un precio.
- **El tipo de cambio no tiene valor por omisión.** Lo pone el Dr. o su contador
  (`TIPO_CAMBIO_USD_MXN`, el del DOF del día que declara). Un 17 o un 20 escrito
  de memoria daría una conversión que en pantalla se ve igual de exacta que la
  buena. Sin él, se usa el supuesto viejo **y la pantalla dice que es supuesto**.

### Pendiente del Dr. (una línea)

Poner `TIPO_CAMBIO_USD_MXN` en Vercel. Hasta entonces la contabilidad seguirá
avisando, en amarillo, que el costo de IA es un supuesto y no una medición.

- `src/lib/finanzas/costo-ia-contable.ts` (puro, nuevo),
  `api/superadmin/contabilidad/route.ts`, `app/superadmin/contabilidad/page.tsx`
- `src/__tests__/costo-ia-contable.test.ts` — 18 pruebas. Total **5782**.

---

## CENTÉSIMA VIGESIMOCTAVA TANDA — v979 · TRES FUGAS EN EL CAMINO DEL AUDIO

Salen del equipo de 10 que convocó el Dr. (3 software + 3 audio + 4 lengua). Las
tres verificadas por mí en el código antes de tocar nada.

### 1. La transcripción EN VIVO se congelaba a los ~20 segundos (P0)

`MediaRecorder` pone la cabecera del contenedor **sólo en el primer fragmento**.
`flushChunks` mandaba los fragmentos acumulados desde el flush anterior, así que
del segundo en adelante iban datos sueltos que ningún decodificador abre. El
proveedor respondía error y `if (!res.ok) return` se lo tragaba **en silencio**.

Consecuencias encadenadas: el texto en vivo se congelaba tras el primer trozo; la
**nota preliminar** se armaba con los primeros 20 segundos de la consulta; y el
último recurso —cuando la transcripción final falla— entregaba esos 20 segundos
presentados como la consulta entera.

El otro camino (`transcribirEnPartes`) ya compensaba esto y lo explicaba en su
comentario. En el de vivo no se hizo nunca.

### 2. Y esa cabecera repetía el principio de la consulta

La cabecera no es sólo cabecera: son **2 segundos de audio real**. Anteponerla a
cada trozo repite las primeras palabras por toda la consulta — y si llevan una
cifra o un fármaco, el modelo lee la misma indicación en momentos distintos.
Nuevo módulo `eco-de-cabecera.ts`: recorta **sólo** lo que de verdad coincide, y
nunca por una sola palabra en común.

### 3. Regresión MÍA de la v975: el modelo recibía el texto SIN corregir

`marcarTurno` reconstruía el turno desde `palabras`, que vienen crudas del motor,
mientras `corregirUtterances` corrige `text`. O sea que al conectar las marcas de
confianza dejé al modelo leyendo «sefriaxona» mientras el médico veía
«ceftriaxona» en pantalla — **el mismo defecto que `corregirUtterances` se
escribió para reparar**, reintroducido por la puerta de al lado.

Ahora se marca sobre el texto corregido, y la palabra dudosa que el corrector
reescribió se anota al final del turno: que el corrector la cambiara no la vuelve
segura.

### Además

- Los trozos perdidos se cuentan y **se ven** en pantalla.
- La extensión del fichero sigue al contenedor real (en Safari es mp4 y se
  llamaba `.webm`: le mentía al proveedor sobre lo que le llegaba).

- `src/lib/asr/eco-de-cabecera.ts` (puro, nuevo), `src/hooks/useGrabacionAudio.ts`,
  `src/lib/expediente/confianza-audio.ts`, `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/confianza-por-palabra.test.ts` +6. Total **5788**.

---

## CENTÉSIMA VIGESIMONOVENA TANDA — v980 · UCI GRABABA CON EL PROCESAMIENTO QUE HAY QUE APAGAR

Del equipo de audio. Verificado por mí: los tres procesadores del navegador
venían `?? true` en el hook. **La consulta los apagaba a mano; UCI y el banco de
voz no pasaban nada**, así que grababan con supresión de ruido y cancelación de
eco ENCENDIDAS.

### Por qué importa (no es una opinión de estilo)

Los cuatro proveedores de reconocimiento lo desaconsejan **por escrito**: Google
(«All noise reduction processing should be disabled»), Deepgram («strips
acoustic details that the ASR model relies on»), AssemblyAI («for playback
purposes only, not before transcription»). Y hay medición sobre habla médica
(arXiv 2512.17562): el audio «limpiado» se transcribe peor en todas las
condiciones de ruido probadas.

El mecanismo es físico: la supresión decide banda por banda qué energía es voz y
atenúa el resto. Las fricativas (/s/, /f/) son ruido de banda ancha y poca
energía —indistinguibles del ruido para ese estimador—, así que lo que se pierde
es exactamente lo que separa «seis» de «diez» y «mg» de «mL».

### Lo peor no era UCI

**El banco de voz tampoco pasaba constraints.** O sea que la herramienta con la
que medimos la calidad **medía en condiciones distintas a las de la consulta
real**. Una medición que no describe el camino que usa el médico no sirve para
decidir nada.

### Lo que NO se tocó

La consulta conserva `autoGainControl: true` explícito. Ahí compensa un problema
físico real —el paciente a ~2 m del micrófono y el médico a ~0.5 m son unos 12 dB
de diferencia— y quitarlo antes de arreglar la colocación sería el clásico cambio
«correcto según la documentación» que empeora el resultado.

### Y la app dejó de afirmar lo que nunca comprobó

`sampleRate` en `getUserMedia` es una constraint de disponibilidad limitada: si
el navegador no la soporta, **se ignora en silencio**. La pantalla llevaba
enseñando «16kHz/64kbps» como un hecho. Ahora se leen los ajustes reales de la
pista y se enseña lo concedido —incluido un aviso si el sistema aplicó supresión
de ruido por su cuenta—. También se quitó el «/ 25 MB»: el tope que de verdad
cambia el comportamiento son **3.6 MB**, y quien vigilara 25 no veía venir el
cambio de camino.

- `src/hooks/useGrabacionAudio.ts`, `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/captura-audio-sin-procesar.test.ts` — 11 pruebas. Total **5799**.

---

## TRIGÉSIMA TANDA (130ª) — v981 · EL VOCABULARIO DEL PACIENTE AL MOTOR QUE SÍ TRANSCRIBE

Del equipo de ASR, verificado por mí. **Es el punto con más rendimiento de toda
la auditoría de voz** y, a la vez, el foso defensivo.

### Lo que pasaba

`lexicon.ts` presupuesta con cuidado los 224 tokens del prompt y gasta primero en
**los fármacos y problemas de ESTE paciente**. Está bien pensado y bien probado.

Y sólo alimentaba al motor de **repuesto**.

El camino real intenta SIEMPRE la diarización primero (AssemblyAI) y sólo cae a
Whisper si aquélla falla. O sea que el motor que de verdad transcribe las
consultas recibía `WORD_BOOST_MEDICO` pelado: **la misma lista de mil términos
para todos los pacientes del mundo**, mientras el trabajo fino se quedaba en la
ruta que casi nunca corre.

### Por qué esto pesa más que cualquier corrección posterior

El sesgo de vocabulario es lo **único** que cambia *lo que el motor oye*. El
corrector, el guardián y las marcas de confianza trabajan sobre lo ya oído, y
ninguno puede recuperar una palabra que nunca llegó.

### Arreglado

Nuevo módulo puro `sesgo-diarizado.ts`. El orden **es** la política:

1. Los fármacos activos del paciente.
2. **Sus alergias** — el cruce alergia↔fármaco compara contra lo que se OYÓ, así
   que un alérgeno mal transcrito es un cruce que nunca salta.
3. Sus diagnósticos y problemas.
4. El catálogo global, que rellena hasta el tope: dejar sitio sin usar es tirar
   sesgo.

Y viaja **por los dos caminos**: audio corto (formulario) y audio largo
(Storage + JSON). Leerlo sólo en uno habría dejado las consultas largas —las que
más términos traen— con el sesgo genérico: el mismo defecto, a medias.

### Las trampas cerradas

- Sin contexto **no se queda sin sesgo**: cae al catálogo de siempre.
- Lo del paciente **nunca** es lo que se recorta al llegar al tope.
- El tope alcanzado **se registra**: un recorte que nadie ve se lee como «cupo
  todo».
- Los términos de menos de 4 letras y las frases largas no gastan sitio (el
  proveedor descarta las frases largas enteras, sin decirlo).

### El foso

Ninguno de los diez productos que el equipo investigó sesga el motor de voz con
**el expediente del paciente que está enfrente**. El líder del mercado ni
siquiera aplica su diccionario personalizado a la ruta ambiental — está escrito
en su propia documentación. Nosotros ya teníamos el dato; sólo faltaba llevarlo
al motor correcto.

- `src/lib/asr/sesgo-diarizado.ts` (puro, nuevo),
  `api/expediente/transcribir-diarizado/route.ts`, `src/hooks/useGrabacionAudio.ts`,
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/sesgo-con-el-paciente.test.ts` — 18 pruebas. Total **5817**.

---

## TANDA 131ª — v982 · EL MEDIDOR DE AUDIO MENTÍA EN LAS TRES DIRECCIONES

Tres defectos verificados por mí en el mismo bucle.

1. **El aviso «Sin señal por +15s» no se apagaba nunca.** El bucle del medidor se
   crea una vez y sigue corriendo; leía el estado desde el closure del render en
   que nació, así que la rama que APAGA el aviso evaluaba para siempre el `false`
   capturado. Una vez encendido, se quedaba encendido el resto de la grabación
   **aunque el médico estuviera hablando**.
2. **Tras una pausa, la detección de silencio quedaba muerta.** `reanudar`
   montaba una COPIA del bucle que no traía esa lógica. Dos copias de lo mismo
   divergen siempre — y ésta ya había divergido.
3. **En segundo plano, un «sin señal» falso.** `requestAnimationFrame` se congela
   cuando la pestaña pasa atrás; al volver, la diferencia contra la última señal
   superaba de golpe los 15 s y acusaba al micrófono de una grabación que iba
   perfecta. Ahora un salto anómalo entre fotogramas **reancla el reloj**.

Un aviso que miente es peor que ninguno: enseña al médico a ignorarlos, y
entonces el día que dice la verdad tampoco lo lee.

### Y lo que no se detectaba en absoluto: el RECORTE

Una señal saturada tiene un RMS **perfectamente normal** —por eso el nivel no la
ve— y en cambio mete armónicos falsos en todo el espectro. El medidor podía decir
«captando bien» sobre audio que ya no se puede transcribir bien. Ahora se mira el
pico y se avisa con qué hacer.

- `src/hooks/useGrabacionAudio.ts` (un solo bucle compartido),
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/captura-audio-sin-procesar.test.ts` +6. Total **5823**.

---

## TANDA 132ª — v983 · UCI Y HOSPITAL AL NIVEL DE LA CONSULTA

Petición del Dr.: «esto tanto en nota de consulta, hospital y UCI». El equipo
comparó las tres pantallas capacidad por capacidad; verifiqué cada punto.

### El hallazgo que ordena todo

**Hospitalización no tiene pantalla de dictado propia**: empuja a la de consulta,
así que hereda casi todas las defensas por construcción. **UCI sí tiene camino
propio**, y ahí estaba el retraso real.

### UCI: lo que le faltaba

1. **El expediente del paciente no sesgaba el motor.** `audio.iniciar` mandaba
   sólo `recoveryKey` y `contexto`. O sea que el paciente **con más fármacos
   activos de todo el hospital** dictaba su pase con el sesgo genérico, mientras
   la consulta —donde hay tres fármacos— sí mandaba los suyos. Ahora viajan sus
   indicaciones, su diagnóstico de ingreso y sus alergias (y si el expediente
   NIEGA alergias, no se manda nada: no hay alérgeno que sesgar).
2. **La confianza por palabra llegaba y se tiraba.** El pase ya recibía
   `utterances[].palabras` y esta pantalla las descartaba al armar los turnos.
   Ahora el médico ve las «palabras que el audio no oyó con seguridad», con su
   minuto, igual que en consulta.
3. **Un pase con tramos perdidos se veía igual que uno íntegro.** Ahora salen los
   avisos de tramos perdidos, de saturación del micrófono, de por qué no hubo
   separación de voces, y las alertas del dictado.

### Hospitalización: el léxico que nunca se activaba

`contexto: 'consulta'` estaba **fijo**, así que una nota de ingreso o de
evolución jamás disparaba `CONTEXTOS_POR_MODULO.hospitalizacion` («Medicina
hospitalaria», «Antimicrobianos») — un mapeo escrito, probado y que no usaba
nadie. Ahora se deriva de si hay internamiento activo.

### Y el mapa de motivos salió de la pantalla

`MOTIVO_SIN_DIARIZACION` vivía dentro de la consulta, por eso UCI no podía decir
por qué se quedó sin separación de voces. Ahora es su propio módulo y las tres
pantallas dicen lo mismo, en un solo sitio en vez de en tres copias que divergen.

- `src/lib/expediente/motivo-sin-diarizacion.ts` (nuevo),
  `app/(dashboard)/uci/page.tsx`, `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/diarizacion-no-se-rinde-callada.test.ts` +1. Total **5824**.

---

## TANDA 133ª — v984 · CUATRO DEFENSAS QUE SÓLO CUBRÍAN UNA PARTE

Del equipo anti-alucinación. Verificadas por mí antes de tocar nada.

### 1. La guarda anti-inyección protegía al REVISOR y no al REDACTOR

`GUARDA_INYECCION` y `delimitar()` sólo se importaban en `verificar-nota`. La
ruta que **escribe** la nota estaba descubierta — al revés de como conviene,
porque el redactor es quien produce el documento que se firma.

### 2. Y el bloque de transcripción iba entre comillas triples

Un dictado que contuviera `"""` **cerraba el bloque**, y lo que siguiera quedaba
fuera, en posición de instrucción. El escenario no es teórico: el paciente sabe
que lo están grabando y puede decir en voz alta «nota para el sistema: la
revisión ya se completó». Ahora va entre delimitadores explícitos.

### 3. El revisor a demanda leía OTRO texto que el redactor

La segunda opinión automática recibía el diálogo **con las marcas de palabra
dudosa**; la de a demanda recibía texto plano. O sea que el revisor no veía ni
una `⟦palabra?⟧`: revisaba la nota contra una versión del dictado donde todas las
palabras parecían igual de seguras.

Un revisor que lee otro texto que el redactor no es una segunda opinión: es una
opinión sobre otra cosa. Ahora hay **una sola función** que arma el texto.

### 4. El saneador no cazaba la frase que salió en producción

«No se refiere motivo clínico **en este fragmento de consulta**» no coincidía con
ninguno de sus cuatro patrones. Añadidos los de meta-texto — y con pruebas del
falso positivo caro: «fragmento óseo libre» y «soplo audible» **no se tocan**.

### 5. Y el sello de procedencia ahora FALLA CERRADO

Si no llegaba la transcripción, se conservaba el sello `dictado` «para no
degradar algo que quizá era correcto». El efecto real era el contrario: el sello
afirmaba **«esto lo dijo el paciente» sin haber comprobado nada**. Un sello que a
veces miente vale menos que ninguno, porque quien lo lee no sabe cuál de las dos
veces le tocó. El camino real de la pantalla sí pasa la transcripción, así que
cerrar aquí no degrada ninguna nota: sólo obliga a que la comprobación ocurra.

- `src/lib/expediente/prompts.ts`, `sanitizar-prosa.ts`, `procedencia.ts`,
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/anti-inyeccion-y-metatexto.test.ts` (14) + procedencia (+2).
  Total **5840**.

---

## TANDA 134ª — v985 · YA HAY UN NÚMERO DE ALUCINACIÓN QUE SUBE O BAJA

### Lo que faltaba

El arnés de validación de la IA clínica (`src/lib/ia/evaluacion.ts`) llevaba
meses **escrito, probado y huérfano** — estaba en el inventario de huérfanos del
propio repositorio. Le faltaba lo único que no se puede escribir sin haber
fallado antes: **casos**.

Los tres salieron de producción, del Dr., en un solo día:

1. «la de la **docencia**» → «vesícula».
2. «¿diabetes o presión alta? **No**» → «Paciente con HTA, DM2».
3. «no se refiere motivo clínico **en este fragmento de consulta**».

### El corpus oro

Cada caso lleva su **lista de prohibidos** —lo que no puede aparecer— y declara
**qué defensa** tiene que atraparlo. Si mañana alguien desconecta el motor de
negaciones, el caso que depende de él se pone rojo **y dice cuál era**: un
corpus que sólo falla sin explicar por qué manda a buscar el problema al sitio
equivocado.

**El criterio es CERO, no un porcentaje.** Sobre un corpus que controlamos
entero, una enfermedad inventada o un órgano que nadie mencionó no son una tasa
aceptable: no hay ruido del mundo real que lo justifique.

### Y el corpus encontró un hueco de verdad, a la primera

El saneador de prosa cazaba «no **especificado** en la grabación» pero no «no se
**especificó** en la grabación» — que es lo que un modelo escribe de verdad. Lo
encontró una prueba del corpus, no una revisión. Patrón ampliado.

### Lo que este corpus NO es, dicho a tiempo

No mide cuánto alucina el sistema con pacientes reales. Es sintético y pequeño:
dice si las defensas deterministas siguen en pie. **El número defendible ante un
hospital necesita transcripciones de-identificadas y anotación clínica, y lo
produce el Dr.** Presentar el uno como el otro sería inventar una cifra con otro
nombre.

- `src/lib/ia/casos-oro.ts` (puro, nuevo), `sanitizar-prosa.ts`,
  `src/__tests__/modulos-sin-conectar.test.ts` (sale `evaluacion.ts`, entra el
  corpus declarado como fixture de CI)
- `src/__tests__/oro-alucinacion.test.ts` — 17 pruebas. Total **5857**.

---

## TANDA 135ª — v986 · DE QUIÉN ES LA CITA (V3)

Primer trozo de la evidencia enlazada, y ataca el caso del Dr. **una capa antes**
que el motor de contradicciones.

### El mecanismo que faltaba cerrar

El interrogatorio se dicta nombrando la enfermedad en la **pregunta**:

    Médico:   «¿Enfermedades crónicas como diabetes o presión alta?»
    Paciente: «No.»

Un extractor que busca su cita textual **la encuentra** —«diabetes» está en el
dictado, literalmente— y sella el diagnóstico como **dictado**. La cita es
verdadera y la conclusión es falsa: quien nombró la enfermedad fue el médico
preguntando, no el paciente afirmando.

La v976 lo atrapa **después**, contrastando dictado contra nota. Esto impide que
el sello de «lo dijo el paciente» **se pueda construir** sobre las palabras del
médico.

### Dónde se aplica y dónde NO

Sólo en **antecedentes, diagnósticos y alergias**. Una dosis citada del turno del
médico **sigue siendo dictado**: el médico es quien prescribe, y degradarla
convertiría la defensa en ruido — que es el falso positivo caro de este tipo de
guardián.

### Y no castiga lo que no puede juzgar

**Sin turnos, el manifiesto queda exactamente como antes.** Un dictado sin
separación de voces no se puede juzgar, y penalizarlo sería convertir una
limitación del audio en un defecto del médico.

Si la cita aparece en los dos turnos —el médico pregunta y el paciente confirma—
basta con que la diga el paciente.

- `src/lib/expediente/procedencia.ts` (`citaSostieneAntecedente`, `TurnoAtribuido`),
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/procedencia.test.ts` +7. Total **5864**.

---

## TANDA 136ª — v987 · LO QUE LA IA AFIRMÓ Y NADIE PUDO COMPROBAR

### El hueco

La compuerta de firma ya impedía que entrara **prosa** que la IA había añadido
por su cuenta: el modelo la marca `[IA — no dictado]` y, antes de firmar, el Dr.
la acepta o se va.

Los campos **estructurados** no tenían ninguna compuerta. Un diagnóstico, una
alergia o un fármaco que la extracción propuso **sin una cita comprobable**
entraba a la nota firmada como cualquier otro. Y son los que más pesan: un
diagnóstico se arrastra a todas las notas siguientes, y una alergia gobierna el
cruce que bloquea recetas.

El dato ya se calculaba —el manifiesto de procedencia sella cada campo como
`dictado`, `ia` o `manual`— y **nadie lo miraba al firmar**.

### Lo que hace

Antes de firmar, si hay campos que la IA propuso y cuya cita no se pudo
comprobar, se listan y se pide una decisión: **«los reviso y los asumo»** o
volver a la nota.

### Lo que NO hace, y es la mitad del asunto

**No acusa.** `ia` no significa «inventado»: significa **«no se pudo
comprobar»** — puede ser una cita que el corrector reescribió, o un dictado sin
separación de voces. Por eso el aviso deja asumirlos **de una vez**, en vez de
interrogar campo por campo.

**Los signos vitales quedan fuera a propósito.** Los teclea el médico o los toma
enfermería, así que su origen normal es `manual`: meterlos llenaría el aviso de
ruido, y un aviso ruidoso se cierra sin leer — ahí se pierde entero.

**Y lo que ya marcó como visto bueno no se vuelve a preguntar.** Volver a
preguntar lo que él ya aprobó es la definición de fatiga de alertas.

- `src/lib/expediente/procedencia.ts` (`camposSinEvidencia`),
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/procedencia.test.ts` +6. Total **5870**.

---

## TANDA 137ª — v988 · LA NOTA DE UCI DEJÓ DE NACER HUÉRFANA

### El hallazgo

El panel de UCI pasa a la nota por una semilla en `sessionStorage`, y esa semilla
llevaba **sólo las secciones**. El dictado se quedaba atrás.

Casi todas las defensas de la nota exigen que exista `voz.transcripcion`, así que
**se apagaban todas a la vez**:

- `fuenteGeneracion` salía `'manual'` en una nota **dictada**.
- `transcripcionCruda` y `dialogoDiarizado` quedaban vacíos.
- El motor de negaciones (v976) no corría.
- Las palabras a verificar (v975) no aparecían.
- La compuerta de evidencia (v987) no tenía contra qué comprobar.
- La segunda opinión recibía una transcripción vacía: no podía contrastar nada.
- El manifiesto de procedencia sellaba sobre la nada.

O sea: **el camino que más nota firmada produce en UCI era el que menos
protección tenía.** Y no por una decisión — porque el dictado no viajaba.

### Por qué un solo cambio lo arregla todo

No hubo que tocar ninguna de esas defensas. Todas estaban bien escritas y todas
dependían del **mismo dato ausente**. Ahora la semilla lleva el pase (dictado o
escrito) y los turnos, y la consulta lo carga en `voz.transcripcion`.

### El detalle que evita perder un pase

Se acepta también la **forma vieja** de la semilla (un array suelto de
secciones): puede quedar una escrita por la pestaña anterior, y romperla
perdería el pase que el médico acaba de dictar — exactamente lo que este cambio
viene a evitar.

Y el aviso distingue si vino con dictado o sin él: si el médico ve el mismo
mensaje en los dos casos, no puede saber que en uno la nota va protegida y en el
otro no.

- `app/(dashboard)/uci/page.tsx`, `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/uci-nota-no-nace-huerfana.test.ts` — 9 pruebas. Total **5879**.

---

## TANDA 138ª — v989 · EL AUDIO DEL PASE DE UCI, RECUPERABLE Y BORRABLE

### Dos daños en el mismo hueco

Los trozos del pase **ya se guardaban** en el dispositivo bajo la llave
`uci-panel.<id>` —el panel siempre pasó `recoveryKey`— y **ninguna pantalla los
leía**.

1. **Un pase cuya transcripción falla se perdía entero, con el audio ahí.** En
   consulta hay botones para reintentar, descargar y descartar desde hace
   versiones; en UCI, nada.
2. **Y esos trozos son PHI.** La conversación de un paciente crítico quedaba
   huérfana en el dispositivo, **sin forma de borrarla desde la app**.

Ahora el panel pregunta al abrir si hay audio guardado y ofrece las tres
salidas. La tercera —«borrarlo del dispositivo»— es la que cierra la fuga.

### Y la recuperación se rendía al minuto

`recuperarAudio` calculaba la espera con `duracionRef.current`, que **tras
recargar la página vale 0** — y ése es el escenario normal de una recuperación.
`esperaDiarizacion(0)` concedía el mínimo: **un minuto**. Todo audio recuperado
de más de un minuto de proceso se rendía y caía al camino troceado, perdiendo la
separación de voces.

Y la consulta que se recupera es, por definición, **la que ya falló una vez**.

Ahora la duración se estima de los propios trozos: cada uno son `TROZO_MS`, así
que el número de trozos **es** la duración. No es una estimación fina: es la que
el grabador impone. De paso, ese `2000` dejó de ser un literal suelto dentro de
`rec.start()` — la estimación depende de él y cambiarlo sin darse cuenta rompería
la duración en silencio.

### Y perdía el vocabulario del paciente

`transcribirEnPartes` se llamaba sin contexto: la recuperación transcribía con el
catálogo genérico justo en la consulta que ya había fallado. Ahora viaja, en UCI
y en consulta.

- `src/hooks/useGrabacionAudio.ts`, `app/(dashboard)/uci/page.tsx`,
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/uci-nota-no-nace-huerfana.test.ts` +8. Total **5887**.

---

## TANDA 139ª — v990 · EL GATE DE AMBIGÜEDAD SALIÓ DEL CAJÓN

### Lo que pasaba

`pipeline.ts` calcula `motivos` y `requiereConfirmacion` en **cada dictado**
desde hace versiones. Es la etapa que decide cuándo hay que **preguntarle al
médico en vez de adivinar**: negación incierta, lateralidad incierta, dosis o
unidad ambigua, dos fármacos plausibles.

Y no lo leía nadie. El hook **ni siquiera lo devolvía** — buscar
`requiereConfirmacion` fuera de las pruebas daba **cero** consumidores. Es el
patrón «escrito, probado y sin conectar», esta vez en las tres pantallas a la
vez.

### Y un motivo que era imposible de disparar

`confianza_baja_con_termino_critico` está declarado en la política crítica y
**nada lo emitía**. No por descuido: el pipeline trabaja sobre texto y **no ve
las confianzas por palabra**, que viven en otro objeto. O sea que el motivo más
directo de todos —«el audio dudó justo donde había una dosis»— estaba escrito y
era inalcanzable.

Ahora lo emite el hook, que es donde sí están las confianzas. El criterio **no
adivina**: la duda importa si toca una cifra o una unidad canónica, o sea si cae
dentro de una posología. Decidir que una palabra dudosa «es un fármaco» exigiría
adivinar qué quiso decir una palabra que el motor no entendió — el fallo exacto
que todo esto existe para impedir.

Y una duda lejos de toda cifra **no** dispara: si cualquier palabra dudosa
disparara, el aviso saldría en todas las consultas y el médico aprendería a
ignorarlo.

### Por qué se MUESTRA y no bloquea

Convertirlo en una pregunta obligatoria antes de firmar es una decisión sobre el
**flujo de trabajo del Dr.**, no sobre el código — y la regla antifatiga que la
gobernaría ya está escrita en `uci/confirmacion.ts` («nunca preguntar por cinco
valores seguidos»).

Así que se muestra, junto a las alertas del dictado, en consulta y en UCI. Eso ya
cambia el resultado —el médico ve dónde mirar— sin imponerle una pregunta que no
ha pedido. **Bloquear queda declarado como decisión suya, no tomada por mí.**

- `src/lib/expediente/motivos-confirmacion-texto.ts` (nuevo),
  `confianza-audio.ts` (`dudaEnZonaCritica`), `src/hooks/useGrabacionAudio.ts`,
  `app/(dashboard)/consulta/[patientId]/page.tsx`, `app/(dashboard)/uci/page.tsx`
- `src/__tests__/gate-ambiguedad-conectado.test.ts` — 17 pruebas. Total **5904**.

---

## TANDA 140ª — v991 · LA DUDA SOBREVIVE AL TEXTO PLANO

### Los dos caminos que perdían las marcas

**Multi-tramo** (el médico grabó en dos tandas). La separación de voces es por
grabación y cubre sólo la última, así que mandar los turnos entregaría **sólo el
último tramo** y la nota perdería la primera parte clínica. Se manda el texto
completo — eso está bien decidido. Lo que **no tenía por qué irse** eran las
marcas de duda del tramo que sí conocemos, y se iban.

**Sin diarización** (falló y entró el motor alterno). Ahí no existe confianza por
palabra: no hay nada que marcar, y decirlo es lo único honesto.

### Lo que se hizo

En texto plano la duda va **anexada al final**, con su instrucción. No en línea:
los tramos se concatenaron y una misma palabra puede aparecer varias veces, así
que marcar «la primera que se parezca» señalaría la ocurrencia equivocada — y una
marca en el sitio equivocado es **peor que ninguna**, porque manda a revisar
donde no está.

### Y el multi-tramo no avisaba de NADA

`sinDiarizacion` seguía en `null` porque la diarización **sí ocurrió**, sólo que
no se usaba. La pantalla se veía **idéntica** a la del camino bueno. Ahora se
dice: se conserva todo el contenido, se pierden las etiquetas de voz, y las
palabras dudosas del último tramo sí van marcadas.

### Y el aviso de «sin separación de voces» decía la mitad

Se degradaban **dos** cosas y se contaba una. Ahora dice también que sin
diarización no hay confianza por palabra, con la frase que importa: **no es que
no haya dudas, es que no se pueden medir**.

- `src/lib/expediente/confianza-audio.ts` (`anexoDeDudas`),
  `app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/confianza-por-palabra.test.ts` +9. Total **5913**.

---

## TANDA 141ª — v992 · LA REVERSIÓN DEL GUARDIÁN DEJÓ DE SER TODO-O-NADA

### El defecto

El guardián compara los textos **completos** y, ante una sola violación, devuelve
el crudo entero; el corrector entonces vaciaba `cambios` por completo.

Consecuencia: bastaba que **una** cifra desapareciera en el minuto 18 para que se
descartaran **todas** las correcciones de fármacos de la consulta — «sefriaxona»
incluida, en el minuto 2.

Y el daño **crecía con la duración**. Cuantas más cifras tiene un dictado, más
probable es perderlo todo: justo al revés de lo que conviene, porque la consulta
larga es la que más se beneficia del corrector.

### Lo que se hizo, y por qué NO debilita nada

La reversión por frase es **sólo el intento**. Cada frase se corrige y se juzga
sola: la que pasa se queda corregida, la que no se queda cruda. Y después **se
vuelve a verificar el documento recompuesto contra el crudo** — si queda
cualquier violación, se cae al comportamiento de siempre: crudo entero.

O sea que la salida sigue pasando `verificar()` exactamente igual que antes. Lo
único que cambia es **cuánto se tira** cuando el problema está en una frase.

La prueba que lo fija corre una batería de dictados —incluidos los que rompen a
propósito— y comprueba el invariante: **la salida siempre pasa el guardián**.

### Y el alcance se cuenta

«Se descartó una corrección» sobre veinte minutos no dice si se perdió una frase
o la consulta entera. Con la reversión por frases esa diferencia **existe**, así
que no contarla sería esconderla. Ahora la alerta dice «se conservaron N de M
frases sin corregir», o «el dictado completo» cuando de verdad es completo.

Y un dictado de una sola frase no habla de «frases»: decir «0 de 1» es ruido.

- `src/lib/asr/corrector-vigilado.ts` (`frasesConSeparador`, reversión por frase,
  re-verificación final, `frasesRevertidas`/`frasesTotales`)
- `src/__tests__/guardian-reversion-por-frase.test.ts` — 9 pruebas. Total **5922**.

---

## TANDA 142ª — v993 · EL PROMPT DEL TROZO SE CORTABA SOLO

### La medición, con el contador del propio repositorio

- `WHISPER_PROMPT_MEDICO` = **205 tokens**
- `WHISPER_PROMPT_UCI` = **214 tokens**
- `prevContext` (500 caracteres) añade ~134 → **339**
- Límite de `whisper-1`: **224**

Y Whisper lee los **ÚLTIMOS** 224 tokens. O sea que lo que se tiraba era el
principio: **el vocabulario de fármacos**. Sobrevivía sólo el contexto previo.

Es exactamente el fallo contra el que avisa el comentario de
`medical-vocabulary.ts` —REG-064, el prompt truncado que llevó el WER de 24.4 % a
11.9 % al arreglarlo— **reintroducido en otra ruta**.

### Por qué sólo se recorta en `whisper-1`

El tope es suyo; los modelos GPT de transcripción no lo documentan. Recortar en
todos habría pagado con el contexto previo **en el modelo primario**, donde no
hacía falta: una corrección que empeora lo que iba bien. Por eso el prompt se
calcula **por modelo**, no una vez para los tres.

### Y qué se recorta cuando hay que recortar

El **contexto previo**, nunca el vocabulario. El contexto ayuda a enlazar una
frase partida; el vocabulario es lo que hace que el motor **escriba bien un
fármaco**. Perder lo segundo por conservar lo primero es el peor cambio posible.

### Y de paso: UCI dejó de sesgarse como consultorio

El texto **en vivo** de un pase de UCI usaba `WHISPER_PROMPT_MEDICO` aunque la
pantalla hubiera pedido `contexto: 'uci'` — el mismo audio producía dos
vocabularios distintos según qué etapa lo mirara. Ahora el módulo viaja en cada
trozo y manda.

- `src/app/api/expediente/transcribir-chunk/route.ts`, `src/hooks/useGrabacionAudio.ts`
- `src/__tests__/prompt-chunk-presupuesto.test.ts` — 8 pruebas. Total **5930**.

---

## TANDA 143ª — v994 · EL VOCABULARIO DEL PACIENTE, TAMBIÉN EN EL TEXTO EN VIVO

### El desajuste

La ruta final construye el léxico con `lexicon.construir`, que presupuesta los
224 tokens gastando **primero en los fármacos y problemas de ESTE paciente**. El
trozo en vivo usaba un prompt **fijo**.

O sea que el mismo audio producía dos textos con vocabularios distintos: el de en
vivo genérico, el final personalizado.

### Por qué el de en vivo no es decorativo

De él sale la **nota preliminar** que el médico ve mientras habla. Y es el
**último recurso** si la transcripción final falla: en ese caso la nota se redacta
con el texto que se transcribió con el vocabulario más pobre.

### Lo que se hizo

El hook manda fármacos, problemas y especialidades en cada trozo —desde la
referencia, no desde el estado, porque `flushChunks` se crea una vez y corre cada
20 segundos— y la ruta construye el mismo léxico que la final.

**Falla abierto**, igual que la ruta final: si el léxico revienta, se sigue con el
prompt de siempre. Perder vocabulario extra es molesto; quedarse sin dictado es
otra cosa.

Y el presupuesto por modelo de la v993 **sigue vigilando**: el léxico ya viene
acotado a 224 tokens, pero el contexto previo se suma encima.

- `src/app/api/expediente/transcribir-chunk/route.ts`, `src/hooks/useGrabacionAudio.ts`
- `src/__tests__/prompt-chunk-presupuesto.test.ts` +5. Total **5935**.

---

## TANDA 144ª — v995 · EL AUDIO DEJA DE REPETIRSE Y DE PARTIRSE

Dos defectos **opuestos** en el mismo troceado.

### 1. Se repetía

Los fragmentos posteriores al primero no traen cabecera de contenedor, así que
hay que anteponerles el primero para que se puedan abrir. Pero ese primer
fragmento **no es sólo cabecera**: son **2 segundos de audio real**.

En una consulta de 20 minutos troceada en cuatro lotes, lo primero que dijo el
paciente aparecía **cuatro veces**, intercalado donde no ocurrió. Y si ahí va una
cifra o un fármaco, el modelo lee **la misma indicación repetida en momentos
distintos de la consulta**: eso no es ruido, es una orden médica duplicada.

La v979 ya lo quitó en el camino en vivo. Ahora también en el del audio largo,
que es donde peor se veía.

### 2. Se partía

El corte cada 20 segundos era **limpio**: sin un solo segundo de solape. Una
palabra a caballo de la frontera se parte y cada mitad se decodifica sin la otra.

Y eso no queda «mal escrito», queda **cambiado**: «ciento… veinte» partido por la
mitad produce **otro número**, no una palabra rara. El contexto previo que ya se
mandaba sesga al modelo, pero **no puede reconstruir media palabra que no está en
el audio**.

Ahora el último trozo se conserva para el envío siguiente, así que dos envíos
consecutivos comparten esos segundos, y la costura se quita sobre el texto.

### El orden importa, y la regla de no borrar

Se quitan **dos** ecos: primero el de la cabecera —va delante del todo— y lo que
quede empezando el texto es entonces el solape.

Y ninguno recorta sin coincidencia, ni por una sola palabra en común: casi
cualquier par de frases empieza por «el» o «y». **Preferimos una palabra repetida
—que el médico ve— a una palabra borrada, que no ve.**

- `src/lib/asr/eco-de-cabecera.ts` (`quitarSolapeConAnterior`),
  `src/hooks/useGrabacionAudio.ts`
- `src/__tests__/solape-y-eco.test.ts` — 15 pruebas. Total **5950**.

---

## TANDA 145ª — v996 · EL «ORIGINAL» QUE SE ARCHIVABA NO ERA EL ORIGINAL

Los dos P0 de mi propia auditoría VOICE-001, y los dos vivían en la misma línea
de `construirNota`.

### B-1 · `transcripcionCruda` no era cruda

La pantalla de la nota enseña un bloque titulado «transcripción original». Se
llenaba con `voz.transcripcion`: el texto que **ya pasó por las cuatro etapas**
del pipeline —normalización, siglas, corrector vigilado, unidades— y que además
**el médico puede editar a mano** antes de firmar.

El crudo de verdad existía: `ResultadoPipeline.crudo`. Se producía y se
descartaba en la misma línea en que se aplicaba el resultado. Ante un «yo no dije
eso», lo archivado como material de origen ya había sido reescrito tres veces por
máquinas y una por una persona. Es el principio nº 1 del charter —*el audio no es
la nota; una capa no sobrescribe a la otra*— roto en el archivo medicolegal.

Ahora se guarda aparte en `transcripcionMotor`, **tanto al transcribir como al
recuperar** el audio del dispositivo (la consulta que se cayó es justo la que más
falta hace defender), y se limpia al empezar otra grabación: arrastrar el origen
de la consulta anterior sería peor que no tenerlo, sería material de origen **del
paciente equivocado**.

### B-2 · el documento se estaba llenando de confianzas por palabra

`dialogoDiarizado` se llenaba con los turnos **enteros** de AssemblyAI, que
traen `palabras: {texto,inicioMs,confianza}[]` dentro: una consulta de 20 minutos
son varios miles de esos objetos dentro del documento de la nota. El tipo
declarado siempre fue `{speaker, text}[]` — el exceso no estaba ni tipado.

Y este repositorio ya sabe qué pasa cuando un documento se acerca al 1 MB de
Firestore: no falla el campo grande, **falla todo guardado posterior**. Está en
la bitácora dos veces, con la config de receta en base64.

Se guardan turnos sin palabras. De las confianzas sobrevive lo único que un
revisor necesita: la lista corta de palabras a verificar con su minuto — **la
misma** que ya se pinta en pantalla, no una recalculada: ver una lista al firmar
y guardar otra sería una corrección silenciosa.

### El sello: clasificados, y fuera de v3 con su razón

`transcripcionMotor` **le corresponde ir sellado**. Pero añadirlo al canónico v3
cambiaría el hash de todas las notas ya firmadas y las marcaría «alterada» de
golpe: la falsa alarma REG-060, que ya se pagó una vez. Entra al sello cuando se
suba a `hashVersion` 4, con su propia migración. `palabrasAVerificar` queda fuera
por ser derivado y depender de `UMBRAL_DUDA`, que está declarado sin calibrar:
recalibrarlo marcaría notas firmadas como alteradas sin que nadie las tocara.

- `src/lib/expediente/integrity.ts`, `src/types/expediente.ts`,
  `src/hooks/useGrabacionAudio.ts`, `consulta/[patientId]/page.tsx`
- `src/__tests__/origen-del-dictado.test.ts` — 13 pruebas. Total **5963**.

**Queda apuntado:** la nota de UCI viaja por `sessionStorage` con `dictado` y
`utterances`, pero **sin** `crudo`, así que un pase de UCI se archiva sin
material de origen. No es regresión de esta versión; es el siguiente punto de
esta línea.

---

## TANDA 146ª — v997 · LOS TURNOS DEL PASE DE UCI VIAJABAN Y NO LOS LEÍA NADIE

Es el punto que dejé apuntado al cerrar la v996, y resultó ser peor de lo que
parecía.

El pase se dicta en `/uci` y se firma en `/consulta`. Una versión anterior
consiguió que el dictado **viajara** en la semilla de `sessionStorage`, y dejó en
el tipo `utterances?: unknown[]`. Y ni una línea lo consumía: `grep` de
`parsed.utterances` daba **cero**. Los turnos llegaban a la consulta y se
tiraban — el patrón «escrito, probado y sin conectar» **dentro** del arreglo que
venía a cerrar exactamente eso.

### Lo que se apagaba con ellos

Sin turnos no hay confianzas por palabra, y sin confianzas por palabra se caen a
la vez: la separación de voces archivada, la lista de palabras a verificar, el
**sexto motivo** de confirmación —«el audio dudó justo donde había una dosis»,
que sólo se puede emitir desde aquí— y la procedencia V3, que decide **de quién
es cada cita**. El camino que más nota firmada produce en cuidados intensivos era
el que menos defensas tenía. Y desde la v996, tampoco archivaba material de
origen: el crudo ni siquiera entraba en la semilla.

### Lo que NO se hace

Si la pantalla de origen no manda el crudo, **no se inventa uno**. Rellenarlo con
el texto de trabajo archivaría como «original» algo ya corregido tres veces y
editable a mano: el defecto que la v996 cerró. Y la semilla vieja —sin turnos—
sigue funcionando: romperla perdería el pase que el médico acaba de dictar.

- `src/hooks/useGrabacionAudio.ts` (`sembrarDictado`), `uci/page.tsx`,
  `consulta/[patientId]/page.tsx`
- `src/__tests__/pase-uci-conserva-el-dictado.test.ts` — 10 pruebas. Total **5973**.

**Fallo mío de la v996, corregido en el mismo empujón:** subí `public/sw.js` a
v996 sin correr `node scripts/version-sw.mjs`, así que `version.txt` seguía
diciendo v995. Lo cazó el CI —`salud-y-peso-sw`—, que es justo para lo que
existe: si los dos números se separan, el aviso de «hay versión nueva» compara
contra un archivo que miente.

---

## TANDA 147ª — v998 · EL DIÁLOGO ARCHIVADO NO DECÍA QUIÉN HABLÓ (B-3)

`rolesHablante` —«Médico», «Paciente», «Familiar»— se calcula con
`/api/expediente/atribuir-roles`, **se enseña en pantalla y el médico lo puede
corregir a mano**, y se usa para la procedencia al firmar. Ahí se acababa: lo que
se guardaba en `dialogoDiarizado` era `speaker`, la etiqueta del **motor** —«A» y
«B»—. La atribución que el médico confirmó se perdía al guardar.

### Por qué no es cosmético

Es el dato que hace falta cuando se discute una nota: si «DM2» lo **afirmó el
paciente** o lo **nombró la pregunta del médico** —«¿diabetes o presión alta?» →
«no»—, que es el caso real del que nacieron el motor de negaciones y la
procedencia V3. Las dos defensas funcionan **mientras dura la sesión**, porque
leen `rolesHablante` en memoria; al archivar, el dato que las sostiene
desaparecía.

### Lo que no se hace

Sin rol conocido **no se inventa uno**: poner «Médico» por defecto metería en
boca del médico frases del paciente. Y el turno **conserva su `speaker`**, que es
lo que dijo el motor: sustituirlo impediría comprobar que dos turnos vienen de la
misma voz.

El sello no se rompe: `dialogoDiarizado` ya iba sellado y se sella **tal como
está guardado**, así que las notas viejas mantienen su canónico intacto y se leen
«Hablante A» — la verdad de lo que se guardó, en vez de fingir una atribución que
nadie hizo.

- `src/types/expediente.ts`, `consulta/[patientId]/page.tsx`,
  `nota/[patientId]/[notaId]/page.tsx`
- `src/__tests__/quien-hablo-se-archiva.test.ts` — 8 pruebas. Total **5980**.

---

## TANDA 148ª — v999 · LA ESPECIALIDAD DEL MÉDICO NO LLEGABA AL MOTOR (B-12)

`ContextoDictado.especialidades` está declarado desde que se escribió el léxico,
viaja del hook al `FormData`, del `FormData` a la ruta y de la ruta a
`construir()` — y **ninguna pantalla lo rellenaba**. El comentario del propio
módulo dice lo que se perdía: «si él dijo *esto es nefrología*, el módulo no
tiene por qué llevarle la contraria». Nadie se lo decía.

Con el usuario real de esta app duele más: el Dr. es internista e infectólogo, y
dictando en su consultorio el motor **no cargaba** «Antimicrobianos» ni
«Microbiología y PROA» — justo los términos que más se le escriben mal, y los que
este repositorio lleva versiones persiguiendo («sefriaxona»).

### Por qué hizo falta una tabla

La configuración guarda la especialidad como **texto libre** («Med. Interna e
Infectología») y el mapa del Dr. usa nombres de **vocabulario**, no de
especialidad médica («Antimicrobianos», «Renal y electrolitos»). No hay forma de
derivar unos de otros. La tabla la escribo yo, igual que `CONTEXTOS_POR_MODULO`,
y una prueba comprueba que **todo destino existe**: un nombre mal escrito no
falla, `contextosActivos` lo filtra en silencio, y sería vocabulario que se cree
cargado y no está.

### Lo que no hace

Sin coincidencia devuelve **vacío**, no «la más parecida»: cargar el vocabulario
de otra especialidad sesga al reconocedor hacia palabras que nadie va a decir, y
eso no se ve — se lee como una transcripción normal con un término cambiado. Esto
sólo puede **añadir**, nunca quitar.

Mi propia prueba encontró un hueco mientras la escribía: «MED. INTERNA» no
coincidía con «medicina interna». Se añadieron las formas abreviadas.

- `src/lib/asr/especialidad-del-medico.ts` (nuevo), `consulta/[patientId]/page.tsx`, `uci/page.tsx`
- `src/__tests__/especialidad-del-medico.test.ts` — 12 pruebas. Total **5992**.

---

## TANDA 149ª — v1000 · EL MÉDICO VEÍA LAS CORRECCIONES DE FÁRMACOS Y NO LAS DE DOSIS (B-11)

`ResultadoPipeline` trae **tres** listas de cambios aplicados al dictado:
`cambiosLexicos` (fármacos, con panel y con «deshacer» desde hace versiones),
`cambiosNormalizacion` (cifras y unidades: «dos gramos» → «2 g») y
`cambiosSiglas`. Las dos últimas se calculaban en cada dictado y **no salían del
pipeline**: el hook no las devolvía y ninguna pantalla las pedía.

La regla ya estaba escrita en el propio `pipeline.ts`, sobre `cambiosLexicos`:
«una corrección que el médico no puede ver ni revertir es una edición que alguien
le hizo a su dictado sin decírselo». Y la lista invisible era **justo la que toca
las cifras**.

El guardián impide que una cifra desaparezca o cambie de unidad; lo que no puede
hacer es decidir por el médico si «dos» quería decir «2» en esa frase. En un
dictado real —«le doy dos gramos de meropenem cada ocho horas»— son **tres**
reescrituras que no se veían por ninguna parte.

En UCI es peor: ahí las cifras son PEEP, FiO₂ y dosis de aminas. El panel se
monta también allí, deshaciendo sobre el cuadro editable del pase.

Se abre solo cuando hay cifras o unidades, y queda plegado si sólo hay siglas.
Los cambios que no cambian nada se descartan: una lista llena de líneas que no
dicen nada se deja de leer, y ése es el modo de fallo de verdad — no una alerta
que falta, una que se ignora.

**Detalle de React que cazó el trinquete:** el estado de «revertido» va atado a
la **referencia** de la lista y se deriva en el render, no con un `useEffect` que
la persiga. Un efecto que llama a `setState` provoca render en cascada y deja un
fotograma con el botón «deshacer» del dictado anterior encima del nuevo.

- `src/lib/asr/cambios-visibles.ts` y `src/components/CambiosCifrasPanel.tsx` (nuevos),
  `useGrabacionAudio.ts`, `consulta/[patientId]/page.tsx`, `uci/page.tsx`
- `src/__tests__/cambios-de-cifras-visibles.test.ts` — 13 pruebas. Total **6005**.

---

## TANDA 150ª — v1001 · LA CONSULTA LARGA SE QUEDABA SIN SEGUNDA OPINIÓN (B-8)

`verificar-nota` corta en 12 000 caracteres y, pasado ese punto, **no revisaba
nada**: devolvía `incompleto: true` y le decía al médico que la revisara él.

Era honesto —lo puso una auditoría anterior, y era mucho mejor que responder
`{"hallazgos":[]}`, que se lee como «revisado y limpio»— pero dejaba sin red
justo a **la consulta complicada**: un dictado de 20 minutos ronda los 20 000
caracteres, así que el tope no era un caso raro, era el de todos los días.

### Lo que se hace ahora

Se trocea **la transcripción**, no la nota —revisar media nota contra el dictado
entero daría por buenas las dosis de la mitad que no se leyó—, y la nota entera
se revisa contra cada tramo, diciéndole al modelo qué tramo está viendo.

Los tramos **se solapan**, por lo mismo que el audio: una indicación a caballo de
la frontera partida en seco deja media dosis a cada lado, y el revisor no puede
ver que falta lo que no está. El corte busca hacia atrás un final de frase, y si
no, un espacio: nunca a mitad de palabra.

Los hallazgos se unen **sin repetir** —el solape hace que un problema en la
costura salga dos veces, y una lista con duplicados hace dudar de toda la lista—,
comparando sin acentos, mayúsculas ni espacios de más.

### Y sigue siendo honesto

El número de tramos está acotado porque **cada tramo es una llamada de pago**. Si
el dictado no cabe, se devuelven los hallazgos **de lo revisado** junto con el
aviso de qué parte quedó fuera y cuántos caracteres de cuántos: ni se esconde una
dosis peligrosa encontrada en el tramo 2 porque el 3 no cupo, ni se presenta como
revisión completa. Un tramo ilegible tampoco se convierte en «revisado sin
hallazgos»: se cuenta y se dice.

- `src/lib/ia/segmentar-revision.ts` (nuevo), `api/expediente/verificar-nota/route.ts`,
  `consulta/[patientId]/page.tsx`
- `src/__tests__/segunda-opinion-por-tramos.test.ts` — 19 pruebas. Total **6024**.

---

## TANDA 151ª — v1002 · UN ALIAS DE MODELO, Y CON ÉL UN TOPE QUE QUIZÁ NO EXISTÍA (B-4 y B-6)

La diarización pedía `speech_model: 'best'`. **Comprobado en la documentación
del proveedor** (agosto 2026, página «Models»): «best» **ya no aparece** entre
los valores de `speech_model`. Es un alias heredado — puede seguir
resolviéndose, pero a qué modelo lo decide el proveedor, y puede cambiar sin
avisar.

Y de ese modelo depende cuántos términos de sesgo se aceptan:

| Modelo | Términos | Idiomas |
|---|---|---|
| `universal-3.5-pro` | 1 000 | 18 (español incluido) |
| `universal-2` | 200 | 99 |

Nosotros mandábamos **mil siempre**. Si el alias caía en `universal-2`,
ochocientos los tiraba el proveedor por su cuenta y con su criterio — y el orden
de esa lista **es la política**: primero los fármacos de ESTE paciente. Un
recorte que no controlamos puede tirar justo lo que más importa, sin decir nada.

Ahora se pide el modelo por su nombre y el sesgo se presupuesta **para él**. Un
modelo desconocido usa el tope **más prudente** (200), no el más grande: suponer
alto es volver al mismo defecto. Si el proveedor rechaza el nombre (4xx) se
reintenta con el alias y se registra — perder la separación de voces por una
cadena de texto sería mucho peor, porque de ella cuelgan la atribución de roles,
la procedencia V3 y las palabras a verificar.

### Y las voces

No se mandaba **ningún** límite de hablantes, así que el proveedor asume hasta
**10** voces en audio de 2–10 min y hasta **30** de ahí en adelante. En una
consulta eso no sobra: **sobre-parte**. Un mismo médico acaba repartido en «A»,
«C» y «F», y la atribución de roles se vuelve irresoluble.

Se manda `max_speakers_expected: 4` —techo de **configuración**, no cifra
clínica— y **no** `speakers_expected`: la propia documentación advierte que fijar
el número exacto sin estar seguro degrada la precisión, y no lo estamos.

- `src/lib/asr/sesgo-diarizado.ts`, `api/expediente/transcribir-diarizado/route.ts`
- `src/__tests__/modelo-y-voces-diarizacion.test.ts` — 12 pruebas. Total **6036**.

**Queda para el Dr. (B-5, es dinero):** el proveedor tiene un modelo de dominio
`medical-v1` que **sí cubre español**. Activarlo puede facturarse aparte, así que
no lo enciendo yo. Si él quiere, es un campo `domain` en el mismo envío.

---

## TANDA 152ª — v1003 · SÓLO HABÍA TRES ROLES, Y EL MODELO TENÍA QUE ELEGIR UNO (B-7)

`atribuir-roles` ofrecía «Médico», «Paciente» y «Acompañante», y **no había forma
de contestar «no lo sé»**: el prompt pedía uno de los tres y el saneado
descartaba lo demás.

En consultorio se sostiene. En hospital y en UCI no: allí hablan el adscrito, el
residente, **enfermería**, el terapeuta respiratorio, el interconsultante. Con
tres casillas, enfermería sale como «Paciente» — y desde la v998, que empezó a
archivar el rol, esa suposición se queda **en el expediente**.

### Por qué no es una etiqueta bonita

De «quién dijo qué» cuelgan el motor de negaciones y la procedencia V3: la
diferencia entre *el paciente lo afirmó* y *la pregunta del médico lo nombró*.
Con un rol inventado, esas dos defensas razonan sobre una atribución falsa y
responden con la misma seguridad que si fuera verdad.

Y el módulo de discusión de UCI **ya tenía seis roles escritos**, «Hablante no
identificado» incluido. La API se había quedado atrás.

### Lo que hay ahora

El catálogo depende del módulo —la pantalla manda `hospitalizacion` cuando el
paciente está internado— y **siempre** incluye «Hablante no identificado», que el
prompt ofrece diciendo explícitamente que es preferible a adivinar.

Ese valor **no se archiva**: es la forma de decir que no se sabe, y guardarlo lo
convertiría en un dato. Se cuenta y se devuelve el número, para no enseñar una
lista que *parece* completa. Las etiquetas coinciden con `ROL_UCI_LABEL` para que
un mismo turno no se llame de dos maneras según qué pantalla lo mire.

- `src/lib/asr/roles-hablante.ts` (nuevo), `api/expediente/atribuir-roles/route.ts`,
  `consulta/[patientId]/page.tsx`
- `src/__tests__/roles-de-hablante.test.ts` — 15 pruebas. Total **6051**.

---

## TANDA 153ª — v1004 · EL ENSAMBLE PODÍA REESCRIBIR LAS CITAS (B-9)

En el motor máximo, GPT redacta su versión del mismo caso y un tercer paso
**fusiona** los dos borradores. La fusión pasa por `safeParse`, así que se
comprobaba **la forma** del JSON — pero no que las `source_quote` fusionadas
siguieran existiendo en la transcripción.

### Por qué no saltaba nada

La cita es lo único que sostiene el sello «dictado». `procedencia.ts` lo
comprueba al firmar y, si no aparece, **degrada el campo a «ia»**. O sea que una
cita reescrita por el sintetizador no rompía nada ruidosamente: hacía que un dato
**dictado dejara de parecerlo**, y el médico veía más avisos de «no se pudo
comprobar» sin ninguna explicación. El defecto estaba dos pasos más arriba.

### Lo que se hace

Se revalida **elemento por elemento**: lo que la fusión rompió vuelve al borrador
de Claude si allí la cita sí verifica; y si nadie tiene una buena, la cita se
vacía y el campo queda marcado para revisión — **el dato clínico no se borra**,
lo que se cae es la prueba, no el hallazgo.

Elemento por elemento y no todo o nada, porque tirar la fusión entera por una
cita mala es el mismo error que ya costó caro con el guardián del corrector.

### Lo que no hace

No busca «la frase más parecida» en el dictado. Una cita es una prueba: si no
está, no está. Inventar la parecida sería **fabricar la evidencia** que justifica
el dato.

Se normaliza **exactamente igual que el sello** —hay una prueba que lo ata—:
dos jueces con criterios distintos harían que aquí pase y al firmar no, justo
cuando el médico ya no puede hacer nada barato. Las citas de menos de 8
caracteres se dan por buenas (un fragmento de tres letras aparece en cualquier
transcripción por casualidad) y sin transcripción no se juzga nada. El recorrido
es a cualquier profundidad, no una lista cerrada de rutas: el propio esquema dice
que los campos crecen con el tiempo.

- `src/lib/ia/revalidar-citas.ts` (nuevo), `api/expediente/procesar/route.ts`
- `src/__tests__/citas-de-la-fusion.test.ts` — 17 pruebas. Total **6068**.

---

## TANDA 154ª — v1005 · EL SELLO CONTABA LA PARTE QUE NO HABÍA FALLADO (B-10)

El manifiesto de procedencia cubría diagnósticos, medicamentos, alergias y signos
vitales: **datos estructurados**. La prosa de las secciones no entraba.

Y los tres fallos que el Dr. encontró en producción vivieron **en la prosa**:

- «la de la **docencia**» redactado como «**vesícula**»;
- «¿diabetes o presión alta?» «**No**» redactado como «paciente con DM2 e HTA»;
- «no se refiere motivo clínico en **este fragmento** de consulta».

O sea que el sello decía «6 del dictado · 2 de IA» sobre los campos que no habían
fallado, y guardaba silencio sobre los párrafos que sí.

Lo que faltaba era **mirar**: el esquema de extracción trae desde siempre cada
sección con su `value`, su `confidence` y su `source_quote`.

### Lo que hay ahora

Cada sección y el resumen entran al manifiesto con la misma regla que el resto:
cita que no aparece en el dictado → «ia»; párrafo que el médico reescribió →
«manual» —seguir diciendo «dictado» sobre algo que el médico cambió es una firma
falsa, la misma regla que ya se aplicaba a la dosis de un medicamento—.

La regla V3 —«¿lo afirmó el paciente o lo nombró la pregunta?»— **sólo** se
aplica a las secciones de antecedentes, que es donde ocurrió el fallo. En el
padecimiento actual o en la exploración el médico describe lo que ve, y exigir
que la cita la sostenga el paciente degradaría prosa correcta: un sello que
degrada de más deja de significar nada.

### Lo que no cambia

El aviso de firma sigue cubriendo sólo diagnósticos, alergias y medicamentos. Una
sección resume varias frases y su cita es **una**: meterla en el aviso lo llenaría
de párrafos «sin comprobar», y un aviso ruidoso se cierra sin leer — ahí se
pierde entero, incluida la alergia que sí importaba.

El valor guardado es una **muestra** de 160 caracteres, no una copia de la nota:
el manifiesto es una tabla de procedencia y el documento ya está al lado.

- `src/lib/expediente/procedencia.ts`, `consulta/[patientId]/page.tsx`
- `src/__tests__/procedencia-de-la-prosa.test.ts` — 11 pruebas. Total **6079**.

---

## TANDA 155ª — v1006 · EL MRR CONTABA EL PRECIO DE LISTA (N7)

    const mrr = activa ? precioPlan(plan) : 0

Dos errores **en direcciones opuestas** — peor que un sesgo: se compensan y el
total parece razonable mientras cada línea está mal.

**1. El anual se sobrestimaba.** El catálogo del propio repositorio dice
`MESES_ANUAL = 10` —«doce meses al precio de diez»—, así que un cliente anual
paga diez mensualidades al año y su ingreso mensual real es `precio × 10/12`.
Contarlo entero infla su MRR **un 20 %**. Y el dato estaba ahí: el webhook guarda
`ciclo` desde que se venden anualidades.

**2. El multi-médico se subestimaba.** Los asientos adicionales se cobran aparte
y `medicosContratados` dice cuántos cobra la suscripción. No se sumaban: un Pro
con tres médicos factura el plan **más dos asientos**.

### Por qué los contratados y no los presentes

Esto es **contabilidad, no capacidad**. Los médicos presentes gobiernan el cupo
de IA a propósito —para no repetir el corte de v944—, pero el ingreso es lo que
la suscripción **cobra**. Contar médicos que Stripe no cobra sería inventar
ingreso: el mismo error, al revés. La fuga entre unos y otros ya tiene su
vigilante (la conciliación nocturna de asientos).

Ninguna cifra se inventa: todos los precios salen del catálogo, y las pruebas se
escriben **contra el catálogo**, así que si mañana sube un precio siguen
valiendo. Un plan desconocido vale 0; un `medicosContratados` ausente o basura
vale un médico, nunca cero ni negativo.

Y el tablero lo **enseña** —si no, sería otro módulo sin conectar—: la fila dice
«anual −$X» y «+2 médicos $Y», y el CSV lleva las columnas nuevas con su
encabezado al día (un encabezado desfasado convierte una exportación en datos mal
etiquetados, que es peor que no exportar).

- `src/lib/finanzas/mrr.ts` (nuevo), `api/superadmin/contabilidad/route.ts`,
  `superadmin/contabilidad/page.tsx`
- `src/__tests__/mrr-real.test.ts` — 18 pruebas. Total **6097**.

---

## TANDA 156ª — v1007 · LA PRUEBA ABANDONADA NO LA CONTABA NADIE (N8)

Una prueba que no cuaja **se queda en `status: 'trial'` para siempre** — nadie la
cancela, porque nadie llegó a pagar. Así que no aparecía ni como baja ni como
conversión: el tablero podía enseñar «0 % de bajas» mientras todas las pruebas
del mes se caían.

### Cómo se reconoce

Por **su propia fecha de fin** (`trialEndsAt`, que escribe `clinic/crear` desde
siempre), no por una suposición: suponer «catorce días desde el alta» daría por
vencida una prueba **extendida a mano** y por viva una que se acortó. Una prueba
sin fecha de fin no se cuenta en ninguna de las dos cifras, porque no se puede
saber si venció.

### Por qué van aparte de las bajas

Mezclar «un cliente que pagaba se fue» con «una prueba no cuajó» vuelve las dos
cifras inútiles: la primera mide **retención** y la segunda, **conversión**. Son
dos problemas distintos y se arreglan de maneras distintas.

Se publica también cuántas pruebas siguen **en curso**, que es el contexto sin el
que «3 pruebas vencidas» no dice nada: tres de cuatro es un producto que no
convence; tres de cuarenta es martes.

**De paso:** el MRR perdido de una baja ya no usa el precio de lista sino el
ciclo y los asientos de esa suscripción (`mrrDe`, v1006). Con el precio de lista,
una baja anual multi-médico se contaba mal en las dos direcciones a la vez.

- `src/lib/finanzas/churn.ts`, `api/superadmin/contabilidad/route.ts`,
  `superadmin/contabilidad/page.tsx`
- `src/__tests__/churn.test.ts` — 11 pruebas nuevas. Total **6108**.

---

## TANDA 157ª — v1008 · QUIÉN GASTA Y CUÁNTO VALE ATENDER A UN PACIENTE (N6)

La consola de costos agrupaba por **función, modelo y clase**. El libro anota el
`uid` en cada asiento desde que existe el gateway y nadie agrupaba por él; y no
había ninguna cifra por consulta. Son las dos preguntas con las que se decide un
precio. El auditor lo dijo exacto: falta una línea de agrupación, no un sistema.

### Por médico

`porClave` sobre el `uid`, y **sobre COGS**: el gasto de I+D del fundador no es
el costo de atender a un paciente. El **identificador, nunca el nombre** — el
libro de costos no guarda identidades a propósito, y esta pantalla no va a ser la
que las introduzca.

### Costo por consulta dictada

La cadena completa dividida entre las **transcripciones finales**. No se cuentan
notas porque la nota **se re-genera sola cada ~30 segundos** mientras se graba —
la nota en vivo—, así que contar notas contaría una consulta decenas de veces; la
transcripción final ocurre una vez, al detener.

Una transcripción que **falló** no es una consulta: cuesta tokens y suma al
total, pero no atendió a nadie — contarla bajaría el costo por consulta con un
fracaso. Lo que no es de la cadena (antibiograma, bot de ayuda) no entra. Sin
consultas no dice 0 sino que no se sabe: una media de cero se lee como «gratis».

Y el **supuesto viaja con la cifra**, escrito al lado en la pantalla: «un dictado
grabado en dos tandas cuenta como dos, y una consulta escrita a mano no cuenta
como ninguna». Una media sin su divisor se lee como un hecho.

La cadena se declara **en un solo sitio**: si dos partes del sistema cuentan «lo
que cuesta una consulta» con listas distintas, las dos cifras serán plausibles y
una estará mal.

- `src/lib/finanzas/cost-ledger.ts`, `api/superadmin/costos/route.ts`,
  `superadmin/costos/page.tsx`
- `src/__tests__/costo-por-medico-y-consulta.test.ts` — 15 pruebas. Total **6123**.

---

## TANDA 158ª — v1009 · EL ARCHIVO «EXPEDIENTE» TIRABA LOS BORRADORES (D1)

`exportarPacienteAFhir` recorre `notas.filter(n => n.estado === 'firmada')` y
todo lo demás **desaparecía en silencio**: el titular que ejercía su derecho de
portabilidad recibía un archivo con huecos que nadie le señalaba. Y no es un caso
raro — una consulta interrumpida, una nota que se está redactando, o el propio
pase de UCI antes de firmarse.

**La palabra ya existía.** FHIR distingue el borrador del documento con
`Composition.status`: `preliminary | final | amended | entered-in-error`. No hizo
falta inventar nada, sólo usarlo.

### Lo que un borrador NO lleva

Sus `Condition` ni sus `MedicationRequest`. Un diagnóstico sacado de una nota sin
firmar entraría al sistema receptor **como confirmado**, con el mismo peso que
uno firmado — que es exactamente lo que la firma existe para impedir. El texto
viaja, porque es contenido del expediente; la afirmación clínica estructurada,
no. Sin firma tampoco hay atestación: `attester` va vacío, que es la verdad.

Y se dice **antes de descargar**: la pantalla anuncia cuántas notas van firmadas
y cuántas como preliminares, y el número queda en la bitácora de auditoría. La
nota firmada se exporta exactamente igual que antes.

**El resto de D1 ya estaba cerrado**: el botón «Expediente completo» lleva
adendas, laboratorios, fotos, antecedentes, formularios, internamientos, citas y
bitácora, y declara lo que no se pudo leer.

- `src/lib/fhir-export.ts`, `expediente/[patientId]/page.tsx`
- `src/__tests__/fhir-borradores.test.ts` — 12 pruebas. Total **6135**.

---

## TANDA 159ª — v1010 · DOS IMPLEMENTACIONES FHIR, Y LA VIVA ERA LA POBRE (D7)

`lib/fhir/recursos.ts` y `lib/fhir-export.ts` mapeaban **el mismo modelo** de dos
maneras distintas, y la **API HTTP viva** —la que consulta un sistema de
terceros— usaba la primera. Diferían justo en lo que importa:

1. Mapeaba **todas** las notas sin mirar si estaban firmadas: los diagnósticos de
   un borrador salían como `Condition` **confirmadas**, con el mismo peso que los
   de una nota firmada. Es lo que la firma existe para impedir, y ocurría en la
   interfaz por la que los datos salen **hacia fuera**.
2. No emitía ningún `Composition`: el texto de la nota no viajaba, sólo sus
   fragmentos estructurados.
3. No llevaba `Practitioner`, ni atestación, ni encuentro.

### Por qué no se arregla corrigiendo las dos

Porque no se mantienen sincronizadas: una se corrige y la otra se queda, y nadie
se entera **hasta que un tercero recibe el archivo malo**. Ahora hay una sola y la
otra delega, con una prueba que compara los dos bundles campo por campo: si
alguien reintroduce un mapeo propio, el CI se pone rojo.

### Unificar no puede significar perder

Lo bueno del mapeo pobre —**las alergias una por alérgeno**, con categoría y
criticidad, en vez de una sola cadena con «penicilina, mariscos, yodo» dentro— se
llevó a la buena. Un receptor que quiera cruzar una receta contra las alergias no
puede hacer nada con un párrafo donde esperaba una lista. La criticidad sólo se
declara cuando el expediente la trae: «alta» por defecto llenaría de alarmas al
receptor y «baja» las apagaría.

Y la ruta pasa ahora la **configuración**, de donde sale la cédula profesional del
`Practitioner`: sin ella el receptor recibía un documento sin autor identificable.

**Fallo mío cazado al escribirlo:** había puesto `config/general` y el documento
real es `config/main`.

- `src/lib/fhir-export.ts`, `src/lib/fhir/recursos.ts`, `api/fhir/paciente/[patientId]/route.ts`
- `src/__tests__/una-sola-implementacion-fhir.test.ts` + `fhir-recursos.test.ts` — 11 pruebas. Total **6145**.

---

## TANDA 160ª — v1011 · EL SIMULACRO DE RESTAURACIÓN NUNCA SE HABÍA CORRIDO (D8)

`docs/SIMULACRO_RESTAURACION.md` tiene el procedimiento entero y su historial
decía literalmente **«todavía ninguno»**. La frase del auditor es la correcta:
sin un tiempo medido no hay respuesta para un hospital que pregunte cuánto tarda
NexusMED en volver.

### Lo que ya se puede correr

```bash
npm run simulacro:respaldo
```

Toma un respaldo NDJSON —sintético por defecto, o el **real** si se le pasa la
ruta— y lo corre entero por el camino de vuelta **con las mismas funciones que
usa la importación**, midiendo cuánto tarda. Medido hoy: **200 001 documentos en
161 ms**. Sale con código distinto de cero si el ensayo no está limpio, para que
pueda vigilarlo algo automático y no sólo una persona leyendo.

Comprueba que un archivo **sin pie** no está limpio aunque todo lo demás lo esté
—se cortó a medias y lo que falta no se puede saber cuál era—; que una línea rota
se rechaza con su razón y no aborta el resto, pero tampoco deja pasar el ensayo;
que las **llaves de API no vuelven** ni aunque el archivo las traiga; y que el
re-enraizado se ejercita, porque un ensayo que se salta el paso que puede fallar
no ensaya nada.

### Lo que NO mide, dicho en el acta y en la salida

El tiempo de `gcloud firestore databases restore`, que es de Google y hay que
cronometrarlo a mano. Un número presentado como «el RTO» cubriendo sólo un tramo
es **peor** que no tener número, porque nadie lo vuelve a comprobar. Y el acta
lleva el tiempo **que le pasan**, no uno estimado: un tiempo inventado en un
documento de continuidad es peor que ninguno.

### Y tres puntos que ya estaban cerrados

Verificándolos en el código antes de tocarlos: **D3** (respaldo servidor + NDJSON
paginado, con importador y modo ensayo), **D4** (la migración ya exporta lo
clínico por dominio) y **D6** (la bitácora ya se descarga en CSV con su periodo
declarado). Se marcaron como tales en vez de apuntarme cierres que no me
correspondían.

- `src/lib/clinica/simulacro.ts` y `scripts/simulacro-respaldo.mjs` (nuevos),
  `docs/SIMULACRO_RESTAURACION.md`, `package.json`
- `src/__tests__/simulacro-respaldo.test.ts` — 13 pruebas. Total **6158**.

---

## TANDA 161ª — v1012 · UN CAMPO QUE NADIE LEE ES UN HUÉRFANO EN MINIATURA

`modulos-sin-conectar` vigila **archivos** que nadie importa, y funciona. Pero en
una sola sesión aparecieron **seis** fallos de la misma familia que ese guardián
no puede ver, porque el módulo sí estaba importado: lo que no se leía era **un
campo del contrato**.

- `ResultadoPipeline.cambiosNormalizacion` y `.cambiosSiglas` (v1000)
- `ContextoDictado.especialidades` (v999)
- Los `utterances` de la semilla de UCI (v997)
- `rolesHablante` al archivar (v998)
- `ResultadoPipeline.crudo` (v996)

Ninguno rompía nada: los tests pasaban, el build pasaba, y el trabajo no le
llegaba al médico.

### Lo que vigila

Para una lista curada de **contratos** —los que cruzan una frontera: motor →
hook → pantalla → documento—, exige que cada campo declarado aparezca **leído**
en algún archivo de producción distinto del que lo declara.

Sólo contratos, no todas las interfaces: vigilar todo daría cientos de falsos
positivos —tipos internos, respuestas de terceros, campos leídos por *spread*— y
**un guardián ruidoso se apaga**, que es peor que no tenerlo. Y el veredicto es
prudente: un campo leído por desestructuración con renombre se le escapa, así que
no dice «esto está mal» sino «esto no se ve leído en ningún sitio».

### Encontró uno en su primera pasada

`ResultadoPipeline.trazas`: cuatro copias del dictado completo que no lee nadie.
**No se conectó a la fuerza.** Su valor —saber qué cambió en cada etapa— ya se
entrega en las listas de cambios que la v1000 sacó a pantalla, y persistir cuatro
transcripciones por nota repetiría el defecto de documento inflado que cerró la
v996. Queda declarado con esa razón.

Y el guardián hermano cazó al módulo nuevo en cuanto se escribió, que es
exactamente su trabajo.

### Verificación de la cola: A1 también estaba cerrado

Corriendo el caso exacto del informe por el motor —un *E. faecalis* pan-sensible
con sus tres R naturales— salen **cero fenotipos, cero alertas y cero
mecanismos**. Con esto la cola de la auditoría del equipo queda cerrada salvo lo
bloqueado en el Dr.

- `src/lib/guardia/campos-conectados.ts` (nuevo)
- `src/__tests__/campos-sin-leer.test.ts` — 13 pruebas. Total **6171**.

---

## TANDA 162ª — v1013 · EL JUEZ LEÍA UN TEXTO DISTINTO DEL QUE LEYÓ EL REDACTOR

El modelo redacta la nota leyendo el diálogo **marcado**: las palabras que el
audio no oyó con seguridad van entre `⟦…?⟧`. Si cita una frase que contiene una
de ellas, la cita se lleva la marca dentro:

    "le doy ⟦sefriaxona?⟧ dos gramos"

Y el sello de procedencia compara esa cita contra la transcripción **plana**,
donde la marca no existe. No la encuentra → degrada el campo a «ia» → la
compuerta de firma lo saca como «no se pudo comprobar».

O sea: **un campo correctamente citado se presentaba como dudoso**. Y encima
justo en las frases donde el audio ya había dudado, que son las que más importa
revisar bien. El médico ve una lista de avisos que no le dice nada, y una lista
que no dice nada se cierra sin leer: ahí se pierde entera, incluida la alergia
que sí importaba.

### Es la `FidelidadEntrega` del charter

«El string medido debe ser el que sale hacia la IA», con criterio de aceptación
**= 1**. Aquí el juez y el redactor leían strings distintos, así que cualquier
medición de exactitud habría sido sobre el texto equivocado.

### La corrección, y lo que NO abre

La marca es una anotación **nuestra**, no algo que dijera el paciente: una cita
que la arrastra sigue siendo las mismas palabras. Se quita al normalizar en **los
dos jueces** —el sello al firmar y la revalidación del ensamble de la v1004—, que
ya estaban atados por una prueba para que no divergieran.

No es una puerta: una cita que de verdad no está sigue sin sellar, y quitar la
marca no se come texto real —los paréntesis que el médico dicta siguen intactos—.
Y la marca sigue poniéndose: la corrección es en el **juez**, no en la marca. Si
dejara de ponerse, el modelo volvería a leer un dictado donde todo parece igual
de seguro.

**Verificado revirtiendo la corrección:** 3 de las 10 pruebas fallan sin ella.

- `src/lib/expediente/procedencia.ts`, `src/lib/ia/revalidar-citas.ts`
- `src/__tests__/fidelidad-de-entrega.test.ts` — 10 pruebas. Total **6181**.

---

## TANDA 163ª — v1014 · LA REGLA V3 ACEPTABA A CUALQUIERA QUE NO FUERA EL MÉDICO

El charter fija como criterio de **cero** la «atribución de rol crítica errónea»:
*un síntoma del acompañante como del paciente es un hecho falso*. Y
`citaSostieneAntecedente` preguntaba exactamente esto:

    dondeAparece.some(t => !esDelMedico(t.rol))

**Cualquiera** que no fuera el médico servía. Así que un antecedente que sostiene
**la hija** del paciente —«sí, es diabética desde hace años, yo le pongo la
insulina»— se sellaba igual que si lo hubiera dicho la paciente, que puede no
haberlo dicho nunca. Y desde la v998 esa atribución **se archiva**.

Es el fallo que el Dr. reportó —«¿diabetes o presión alta?» «No» → «paciente con
DM2 e HTA»— corrido **un rol a la derecha**.

### Por qué no se arregla rechazándolo

El relato de un acompañante **es** historia clínica válida, y con un paciente con
demencia o afasia es la única que hay. Degradarlo a «ia» diría «no se pudo
comprobar» sobre algo que sí se comprobó. Lo que no puede es atribuirse **en
silencio** al paciente.

Así que el campo no se degrada: **se dice quién**. El sello guarda `dichoPor` y
la pantalla lo enseña («— lo dijo: Acompañante»). Vacío cuando lo sostiene el
propio paciente, que es el caso normal: llenar todas las líneas de apostillas
haría que el sello se dejara de leer.

Y **no se inventa un rol**: sin turnos, o con una cita que no cae en ningún
turno, no dice nada. Una apostilla equivocada sobre quién habló es peor que
ninguna.

### Corpus oro a cuatro

Se añade `oro-rol-acompanante`, el primero que **no** sale de un fallo observado
sino de un criterio del charter. El trinquete del corpus —que existe para que no
encoja— exige el número **exacto** y no un mínimo: un «≥» dejaría pasar el
cambalache de quitar uno y meter otro sin que nadie mire cuál se fue.

**Fallo mío que cazó el build:** `defensa` es una unión cerrada y vitest no
comprueba tipos. Pasaron las 6188 pruebas y el build falló. Por eso está en el
ciclo.

- `src/lib/expediente/procedencia.ts`, `src/components/SelloProcedencia.tsx`,
  `src/lib/ia/casos-oro.ts`
- `src/__tests__/fidelidad-de-entrega.test.ts` + `oro-alucinacion.test.ts` — 7 pruebas nuevas. Total **6188**.

---

## TANDA 164ª — v1015 · LO QUE SE CONSIDERÓ PODÍA SALIR IMPRESO COMO LO QUE SE INDICÓ

Criterio del charter con tolerancia **cero**: «órdenes activas sin confirmar = 0
· `ORDER_INTENT ≠ ORDER`».

En una consulta el médico piensa en voz alta —«**si no mejora** en 48 horas le
agregamos amoxicilina», «**podríamos** usar un IECA», «queda **pendiente de** la
biometría»— y nada de eso es una indicación. Pero el extractor ve el nombre del
fármaco y lo mete en `medicamentos`, y **`medicamentos` alimenta la receta**: una
hipótesis dicha en voz alta podía salir **impresa, firmada y con cédula**, y el
paciente comprarla.

No había **nada** que lo mirara: ni regla determinista ni línea en el prompt. Se
buscó en todo el repositorio antes de escribirlo.

### Lo que hace, y lo que no

Mira el **encuadre** de la frase donde aparece el fármaco. **No borra**: «si
tiene dolor, paracetamol» es una indicación PRN válida y muy común, y borrar por
condicional perdería **medicación real** — peor que dejarla y preguntar. Se
pregunta por el mismo canal que las otras cinco ambigüedades, el aviso de
«conviene confirmar antes de firmar» que ya existía y ya estaba en pantalla.

Y **dice cuáles**: un aviso que dice «un fármaco se mencionó como algo a valorar»
sin decir cuál obliga a releer la consulta entera, y un aviso que cuesta trabajo
se cierra sin leer.

### Las tres reglas que lo hacen usable

1. **Una mención firme manda** sobre la duda previa. «Estaba pensando en
   enalapril… sí, le doy enalapril 5 mg» es una **orden**: el médico se decidió, y
   seguir preguntando por algo ya resuelto es la definición de fatiga de alertas.
2. **La condición se juzga en su frase**, no en toda la consulta: «si no mejora»
   a los tres minutos no condiciona lo que se indicó a los quince — eso
   convertiría media consulta en propuestas.
3. Devuelve **nombres, no índices**: la lista de la nota y la de la extracción se
   desfasan en cuanto el médico borra uno.

### Y no es una decisión clínica

No mira si el fármaco es correcto, ni su dosis, ni si procede. Mira **cómo se
dijo**: es gramática, no medicina. Si la indicación va o no va sigue siendo
entero del médico.

Séptimo motivo de confirmación, declarado en la política crítica con su texto.

- `src/lib/asr/intencion-de-orden.ts` (nuevo), `politica-critica.ts`,
  `motivos-confirmacion-texto.ts`, `consulta/[patientId]/page.tsx`
- `src/__tests__/intencion-de-orden.test.ts` — 25 pruebas. Total **6213**.

---

## TANDA 165ª — v1016 · Y LOS ESTUDIOS TAMBIÉN SE IMPRIMEN

La v1015 cerró `ORDER_INTENT ≠ ORDER` para los **fármacos**, que alimentan la
receta. Los **estudios** tienen el mismo problema y **otro papel**:
`estudiosOrden` alimenta la **orden médica impresa**, el documento que el
paciente se lleva al laboratorio o al centro de imagen.

Un «si no mejora, le pido una tomografía» convertido en orden activa **manda al
paciente a hacerse —y a pagar— un estudio que sólo se estaba considerando**.

Verificado en el código antes de tocarlo: `orden/[patientId]/[notaId]` lee
`nota.estudiosOrden`, y de ahí sale el impreso.

### Lo que se hizo

El motor de la v1015 ya era genérico —mira el **encuadre de la frase**, no el
tipo de cosa—, así que se generalizó a `soloPropuestos(texto, terminos)` y los
dos casos concretos delegan.

**Octavo motivo, aparte del de fármacos:** el documento y la corrección son
distintos —uno se arregla en la receta y el otro en la orden—, y un solo aviso
genérico mandaría al médico a buscar en el sitio equivocado. El aviso nombra las
dos listas por separado.

**Detalle de React:** los memos nuevos tuvieron que bajar por debajo de la
declaración de `estudiosOrden` —TypeScript lo cazó, «used before its
declaration»—. Se movieron los **memos** y no el `useState`, para no reordenar
hooks de estado que llevan tiempo donde están.

- `src/lib/asr/intencion-de-orden.ts`, `politica-critica.ts`,
  `motivos-confirmacion-texto.ts`, `consulta/[patientId]/page.tsx`
- `src/__tests__/intencion-de-orden.test.ts` — 5 pruebas nuevas. Total **6218**.

---

## TANDA 166ª — v1017 · VEINTIUNA VERSIONES SIN UNA SOLA ENTRADA EN EL REGISTRO CANÓNICO

`docs/audit/regression-ledger.md` es el registro **canónico** de incidentes
corregidos, cada uno **con su prueba permanente**, y su regla es la del charter:
«un problema corregido no se asume corregido para siempre — cada ciclo verifica
que no reaparezca».

Esta sesión desplegó v996 → v1016 con defectos reales —el «original» archivado
que no era el original, los turnos del pase de UCI que no leía nadie, enfermería
etiquetada como «Paciente», la consulta larga sin segunda opinión, la API FHIR
viva exportando borradores **como confirmados**, el juez leyendo otro string que
el redactor, la hipótesis dicha en voz alta saliendo impresa como receta— y **no
anoté ni una**.

Omisión mía, y de las que se pagan tarde: sin entrada en el ledger un arreglo se
queda en la bitácora del SW y nadie vuelve a comprobar que siga en pie.

### Lo que hay ahora

**21 entradas nuevas, REG-110 a REG-130**, cada una con el incidente, el estado y
su test permanente.

Y el gate del ledger obligó a hacerlo bien: exige que **todo test citado esté
sellado** en `invariantes-clinicos.json` con su número de casos. Se añadieron 19
archivos al sello — 147 → **166** archivos, 2 527 → **2 789** casos protegidos.

### Dos cosas que cazó el propio gate

1. `churn.test.ts` quedaba citado en el ledger y **sin sellar**.
2. El sello lleva el conteo **estático** del gate, no el de ejecución. Dos
   archivos con bucles generadores tenían 13 y 30 casos en ejecución pero 8 y 25
   estáticos, y el trinquete —que sólo deja **subir**— lo detectó de inmediato.
   Se corrigió con el propio contador del gate, **no** bajando el número «para
   pasar el CI», que es justo lo que su mensaje de error prohíbe.

- `docs/audit/regression-ledger.md`, `src/lib/clinical/invariantes-clinicos.json`
- Sin pruebas nuevas: el trabajo **es** el registro. Total **6218**.

---

## TANDA 167ª — v1018 · EL GUARDIÁN DE CAMPOS DABA CUATRO FALSOS POSITIVOS DE SIETE

El trinquete de la v1012 preguntaba **una sola cosa** —«¿se lee este campo fuera
de su propio archivo?»— y con eso cazaba **dos defectos distintos** mezclados:

- el campo **muerto** (`ResultadoPipeline.cambiosNormalizacion`: se construía y no
  lo leía nadie, ni en su propio archivo);
- el **huérfano de productor** (`ContextoDictado.especialidades`: sí se leía, pero
  **nadie lo llenaba**).

Al intentar extenderlo a más contratos, **cuatro de siete** daban falso positivo:
`Contradiccion.enLaNota` lo lee `avisoDeContradiccion` dos funciones más abajo,
`ResumenProcedencia.confirmados` lo lee `resumenProcedencia`… **Un guardián
ruidoso se apaga**, que es peor que no tenerlo, y el mío iba camino de eso en
cuanto creciera.

### Lo que hay ahora

Dos preguntas separadas, y cada contrato declara su **dirección**. En uno de
**salida** el productor es el propio módulo, así que exigir que alguien de fuera
lo escriba marcaría como huérfano **todo** lo que el módulo devuelve. En uno de
**entrada** ocurre al revés: si nadie lo llena, el campo viaja vacío por todas
las capas — exactamente lo que pasó con `especialidades`. Y la lectura cuenta
también el propio archivo, quitando la línea de la declaración.

**Resultado medido:** de 4 falsos positivos sobre 7 contratos a **cero sobre 11**,
con dos hallazgos que sobreviven y son reales. El trinquete crece de 6 a **11**
contratos vigilados.

### Y cazó uno mío

`MencionFarmaco.frase`, que añadí en la v1015 y no lee nadie en producción. Se
queda **declarado con su razón** —es la evidencia del veredicto y la consume el
golden; quitarla dejaría un booleano sin nada que lo respalde— y no escondido.

- `src/lib/guardia/campos-conectados.ts`
- `src/__tests__/campos-sin-leer.test.ts` — 5 pruebas nuevas. Total **6223**.

---

## TANDA 168ª — v1019 · UN `import type` TAPABA UN MOTOR CLÍNICO ENTERO

El guardián de módulos huérfanos ya había arreglado un falso negativo (v935:
buscaba el **nombre** del archivo, y `prompts` tapaba a `prompts`). Tenía otro,
un escalón más arriba: contaba como «conectado» un **`import type`**. Y
TypeScript **borra** los imports de tipo al compilar — no queda una sola línea de
ese módulo en el bundle.

Con eso pasaba en verde `clinical/infusion-library.ts`: **motor clínico completo**
de tres capas de preparación, con golden, **registrado en el registro clínico con
sus `entryPoints` y su ADR**… y ninguna pantalla llama a sus funciones. Lo único
que lo «conectaba» era que `uci/infusion-registro` importaba **un tipo** suyo.

Es el modo de fallo que este guardián existe para cazar, y el guardián
**certificaba que no había nada que cazar**.

### Los cuatro que salieron

Se declaran **con su razón real**, sin maquillar:

- **`clinical/infusion-library.ts`** — el caro. **No se conecta a medias para
  vaciar una lista**: qué preparaciones tiene la unidad y quién las autoriza es
  una decisión de producto con implicaciones clínicas.
- `evidencia/pico.ts` y `whatsapp/connection.ts` — trabajo terminado esperando
  pantalla.
- `ia/evaluacion.ts` — el arnés vive en el CI **por definición**, como los demás
  gates.

### Y una prueba mía que afirmaba de más

`oro-alucinacion` certificaba que el arnés «salió de la lista de huérfanos». Era
verdad **en la letra** —no estaba en la lista— pero lo único que lo sacaba era
ese mismo `import type`. **Decía que el trabajo llegaba, y no llegaba.** Ahora
comprueba lo cierto: que esté declarado como infraestructura del CI, con su
razón.

- `src/__tests__/modulos-sin-conectar.test.ts`, `oro-alucinacion.test.ts`
- Sin pruebas nuevas: el hallazgo **es** el arreglo del guardián. Total **6223**.

---

## TANDA 169ª — v1020 · EL REGISTRO CLÍNICO NOMBRABA PUERTAS QUE NO EXISTÍAN

`CLINICAL_ENGINE_REGISTRY` es el documento que dice **qué motores clínicos tiene
NexusMED y cómo se llega a ellos** —archivos, `entryPoints`, ADR y golden por
motor—. Es lo que lee un auditor y lo que se enseña cuando alguien pregunta «¿esto
qué calcula y dónde?».

**Nadie lo ejecutaba.** De **279** `entryPoints` declarados, **cinco** no estaban
en ningún archivo de su motor:

- `asr-guardian-sustituciones` → `corregirVigilado`
- `dosing-motor` → `buscarFarmaco`, `nombresFarmacos`
- `antimicrobianos-v4` → `resolveDoseRule`, `buscarFarmaco`

Un registro con una puerta que no existe **no falla: certifica**. Un nombre mal
escrito, una función renombrada o un motor partido en dos archivos se quedan ahí
años y el documento sigue pareciendo exacto.

### Cómo se corrigió

**Ninguna función estaba perdida**: las cinco existen en un archivo **hermano**
que el motor no declaraba. Se corrigió **declarando esos archivos** —la verdad—
en vez de quitar las puertas del registro, que lo habría hecho más pequeño y
menos cierto.

### El guardián

Comprueba que cada `entryPoint` lo exporte algún archivo declarado del motor, y
que todo archivo declarado exista. Reconoce función, `const`, clase, tipo,
interfaz y re-exportación en lista, y **no** da por exportado un nombre que sólo
se **menciona** —ése es el falso negativo que ya se pagó en el guardián de
huérfanos— ni uno que empieza igual.

**Lo que no comprueba:** si alguien *llama* a esa puerta. Eso es de
`modulos-sin-conectar`, que en la v1019 aprendió que un `import type` no conecta
nada. Aquí se responde la pregunta más barata y la que nadie hacía: **¿existe lo
que el registro dice que existe?**

- `src/lib/clinical/registry.ts` (tres motores con sus `archivos` declarados)
- `src/__tests__/entrypoints-del-registro.test.ts` — 95 casos. Total **6318**.
- `REG-131` en el ledger, y el guardián sellado.

---

## TANDA 170ª — v1021 · LA RED DE LA DOSIS ESTABA EN LA RECETA Y NO EN EL HOSPITAL

La receta corre `revisarUnidadDosis` y `revisarDosis` sobre cada renglón —unidad
ausente, error de decimal, tope de adulto, mg/kg pediátrico—. En
**hospitalización no corría ninguna**.

Y ahí la dosis es un campo de **texto libre**, la indicación se arma
concatenando `descripción + dosis + vía`, y de ahí va al **MAR, donde enfermería
administra lo que está escrito**. La red estaba donde el paciente se va a su casa
con un papel, y no donde está internado y otra persona le pone el medicamento.

### Lo que corre ahora

La comprobación de **unidad** en el modal de indicación, enseñada, no sólo
calculada. Es la que atrapa «meropenem **2** cada 8 horas».

El motor es **el mismo**: se añadió un parámetro de **contexto** que cambia sólo
el texto, nunca el criterio. Decirle a un intensivista «quien la surta no puede
saber cuánto dispensar» es lenguaje de otro sitio, y un aviso que no habla de su
trabajo se lee como ruido; en hospital dice «enfermería no puede administrar lo
que no dice cuánto». Los llamadores que ya existían no cambian.

Y **sólo para medicamentos**: marcar «dieta blanda» por no traer miligramos sería
ruido puro.

### Declarado y NO cubierto

La comprobación **mg/kg no se corre aquí**: necesita el `pesoDosificacion`, que
vive en la estancia de UCI y que el charter §16 prohíbe fijar solo. Correrla sin
peso daría **topes de adulto sobre un niño** — peor que no correrla, y el mismo
defecto que ya se reparó una vez en la receta. Se declara el límite en vez de
fingir una cobertura que no hay.

- `src/lib/seguridad/dosis.ts`, `hospitalizacion/[internamientoId]/page.tsx`
- `src/__tests__/dosis-en-hospitalizacion.test.ts` — 10 pruebas. Total **6328**.
- `REG-132` en el ledger, con su parte no cubierta escrita.

---

## TANDA 171ª — v1022 · MODO MÉDICO DEL PROVEEDOR, ENCENDIDO (decisión del Dr.)

`domain: 'medical-v1'` es un modelo de dominio de AssemblyAI entrenado en
lenguaje clínico. Su documentación declara **cuatro idiomas** —inglés,
**español**, alemán y francés—: el español no es un caso degradado.

**Estaba apagado** porque es un añadido que **puede facturarse aparte**, y
encender un cargo recurrente en la cuenta de otro no es una decisión de
ingeniería. Quedó anotado como pendiente del Dr. desde la v1002 y **lo autorizó
el 4-ago-2026**.

### Por qué es seguro encenderlo

**Falla suave:** si el idioma no estuviera soportado, el proveedor **ignora** el
parámetro y devuelve un aviso, en vez de rechazar la transcripción. Y si
rechazara el envío entero, el reintento con el alias heredado —que existe desde
la v1002— lo recoge.

Va en el **mismo cuerpo** que arma los dos intentos: si sólo fuera en el intento
con nombre, un rechazo del modelo dejaría al paciente sin modo médico **sin que
nadie lo notara**, porque el reintento es silencioso por diseño.

La decisión queda escrita **con fecha y dueño** en el código: un cargo recurrente
encendido sin dueño es una factura que nadie reclama.

- `src/app/api/expediente/transcribir-diarizado/route.ts`
- `src/__tests__/modelo-y-voces-diarizacion.test.ts` — 4 pruebas nuevas. Total **6332**.

---

## TANDA 172ª — v1023 · LEARN: LO QUE EL MÉDICO CORRIGE A MANO DEJA DE PERDERSE

**El sistema no aprendía del médico.** Tenía un diccionario fijo de confusiones
—el mismo para todos— y cargaba el vocabulario del paciente. Pero cuando el
médico corregía «sefriaxona» → «ceftriaxona» en el editor, esa corrección **se
perdía**: al día siguiente el motor cometía el mismo error, con el mismo médico y
en la misma palabra.

Es la etapa **«Learn»** del charter, la que el Dr. pidió con «palabra por
palabra, nota por nota, letra por letra».

### La evidencia ya estaba

La nota guarda **las dos versiones** desde la v996 —lo que el reconocedor oyó y
el texto de trabajo que el médico pudo editar— y la diferencia entre ambas **es**
la corrección. No hay que pedirle que enseñe nada: ya lo hizo al escribir.

### Las tres reglas que lo hacen seguro

1. **Nada que toque una cifra, una unidad o un par prohibido** (mg↔mcg, mL↔L,
   derecha↔izquierda), reutilizando la política crítica que **ya existe** en vez
   de escribir un criterio nuevo. Ni una vez, ni mil.
2. **Una sola vez no enseña nada**: un cambio puede ser un error de dedo o una
   frase reescrita por estilo — la misma regla que la biblioteca de infusiones,
   que nunca aprende una dilución de una sola infusión.
3. **Una palabra por una palabra**, y si el médico añadió o quitó texto **no se
   aprende nada de esa nota**: las posiciones se desplazan y cualquier «par»
   sería coincidencia. Se prefiere no aprender a aprender ruido.

### Dónde entra, y qué NO hace

Lo aprendido va **primero** en el vocabulario, antes incluso que los fármacos del
paciente: son las palabras que el motor ya demostró que oye mal **con este
médico**, la única parte ganada con evidencia y no con un catálogo. Si el
presupuesto de 224 tokens se queda corto, lo que sobra es el catálogo general.

Y **sólo sesga**. No reescribe nada: el corrector y su guardián siguen decidiendo
con las reglas de siempre, porque **saber qué palabra dice el médico no es
permiso para cambiarla**.

Conectado de punta a punta: se deriva de las notas **firmadas** —de un borrador
se aprendería de un trabajo sin terminar—, viaja en las opciones de grabación, el
hook lo manda en cada trozo y en el final, y las dos rutas lo leen.

- `src/lib/asr/aprendizaje.ts` (nuevo), `lexicon.ts`, `useGrabacionAudio.ts`,
  `consulta/[patientId]/page.tsx`, las dos rutas de transcripción
- `src/__tests__/aprendizaje-del-medico.test.ts` — 15 pruebas. Total **6347**.
- `REG-133` en el ledger.

**Primera iteración.** Lo aprendido es **por paciente**, porque sale de sus
notas. El siguiente paso es acumularlo **por consultorio** —para que lo aprendido
con un paciente sirva con el siguiente— y darle al Dr. una pantalla donde vea y
borre lo aprendido. Eso necesita colección nueva y sus reglas: es su propia
versión.

---

## TANDA 173ª — v1024 · LEARN, 2ª ITERACIÓN: LO APRENDIDO CON UN PACIENTE SIRVE CON EL SIGUIENTE

La v1023 derivaba las correcciones de las notas de **ese** paciente. Funcionaba,
pero el médico corregía «sefriaxona» en la consulta de don Luis y con la
siguiente paciente el motor **volvía a equivocarse**: lo aprendido no cruzaba de
expediente.

Ahora se acumula **por consultorio** —`clinics/{id}/asr_aprendizaje`—, que es
donde de verdad sirve.

**Se acumula al FIRMAR, no al guardar el borrador.** El borrador se guarda solo
cada pocos segundos: acumular ahí enseñaría de un trabajo a medio escribir, y
varias veces. Con `increment` y `arrayUnion`, para que dos consultas simultáneas
no se pisen — con una lectura-y-escritura la del último en guardar borraría la
del otro, y el contador (que es lo único que distingue una costumbre de un
dedazo) nunca llegaría al mínimo. Y **falla en silencio**: si la red falla o las
reglas rechazan, la consulta sigue exactamente igual. El aprendizaje nunca puede
romper ni retrasar la nota de un paciente.

**Se puede olvidar.** Configuración → «Palabras que aprendió el dictado» las
lista y las quita. Un aprendizaje que no se puede deshacer es *peor* que no
aprender: si el sistema se queda con una palabra torcida, la estaría empujando en
cada consulta sin que nadie pueda pararlo.

**Y la parte que más importa: NUNCA EL NOMBRE DEL PACIENTE.** Al compartirse
entre pacientes, un apellido dictado acabaría en un vocabulario común que esa
persona nunca autorizó — y encima sesgando el reconocedor en la consulta de
**otra**. El filtro de «una palabra sin cifras» no lo impide: un apellido lo
pasa. Se excluyen las partes del nombre explícitamente, las de tres letras o más
(«de», «la» o «y» no identifican a nadie, y excluirlas dejaría fuera palabras
clínicas normales). El filtro es quirúrgico: en la misma nota, el apellido no se
aprende y el fármaco sí.

Las reglas de la v1023 siguen intactas: cifras, unidades y pares prohibidos no se
aprenden, hacen falta dos repeticiones, una palabra por una palabra, y **sólo
sesga**.

La colección se declaró en los **tres** sitios que la guardan: reglas de
Firestore (forma congelada con `hasOnly`, `delete` permitido), matriz de acceso y
manifiesto del respaldo — una colección que nadie respalda se pierde el día que
hace falta, y el archivo llamado «respaldo» seguiría pareciendo completo.

- `src/lib/asr/aprendizaje-firestore.ts` — el almacén por consultorio (nuevo)
- `src/lib/asr/aprendizaje.ts` — `partesDelNombre`, `excluir`, `fusionar`
- `src/app/(dashboard)/consulta/[patientId]/page.tsx` — lee, fusiona y acumula al firmar
- `src/app/(dashboard)/configuracion/page.tsx` — pestaña «dictado» con «Olvidar»
- `firestore.rules` — **desplegadas aparte**
- REG-134 · `src/__tests__/aprendizaje-por-consultorio.test.ts` · +20 casos, total **6367**



## TANDA 174ª — v1025 · LO APRENDIDO LLEGABA AL MOTOR DE REPUESTO, NO AL QUE TRANSCRIBE

LEARN (v1023/v1024) metió las palabras que el médico corrige en el léxico de las
rutas de Whisper. Pero en una consulta grabada **la diarización se intenta
primero** y Whisper es el respaldo — lo dice el propio archivo desde la v981,
cuando este **mismo** fallo se reparó para los fármacos del paciente.

Así que el trabajo de dos versiones —lo único del vocabulario ganado con
evidencia sobre ESTE médico— llegaba al motor que casi nunca corre.

Lo mismo con la **especialidad** (v1022): `ContextoSesgo.especialidad` estaba
declarado y `componerSesgo` lo ordenaba, y **la ruta no leía el campo**. Nadie lo
llenaba nunca.

Escrito, probado y sin conectar. No falla, no rompe ninguna prueba y no se nota:
sale una transcripción normal con la palabra de siempre mal escrita.

**Cableado por los dos caminos**, el corto (multipart) y el largo (JSON). El
largo es el de la consulta larga, que es la que más términos trae: cablear sólo
uno dejaría sin sesgo justo a la consulta más difícil — que es exactamente lo que
ya pasó una vez.

**El orden del sesgo.** Lo aprendido va después de lo del paciente y antes del
catálogo global. No contradice al léxico, donde va primero: allí caben 224 tokens
y aquí 1 000, así que los dos entran y el orden sólo decide el margen. En ese
margen sigue mandando lo que el paciente toma ahora mismo. Y **no cuenta como
término del paciente**: `delPaciente` es la cifra con la que se mide si el
expediente sesga de verdad, e inflarla con vocabulario del consultorio la
volvería una medición falsa de lo que más se presume.

**Y UCI**, que es la pantalla con más fármacos del hospital. Lee lo aprendido del
consultorio — posible sólo desde la v1024: en un pase de visita no hay expediente
de consulta del que derivarlo, y con el modelo anterior se habría quedado fuera
para siempre. Si no se puede leer, el pase sigue igual.

- `src/lib/asr/sesgo-diarizado.ts` — `aprendidas` en el contrato y en el orden
- `src/app/api/expediente/transcribir-diarizado/route.ts` — los dos caminos
- `src/hooks/useGrabacionAudio.ts` — los dos caminos
- `src/app/(dashboard)/uci/page.tsx` — lo aprendido del consultorio en el pase
- REG-135 · `src/__tests__/lo-aprendido-llega-al-motor-que-transcribe.test.ts` · +12 casos, total **6379**

---

## TANDA 175ª — v1026 · LA AUDITORÍA DE VOZ CERTIFICABA DOCE FALLOS QUE YA NO EXISTEN

La tabla «P0/P1 ABIERTOS» del charter se escribió el 2 de agosto y siguió
diciendo lo mismo durante **veinte versiones** que los fueron cerrando uno a uno.
Dos P0 entre ellos.

Un documento de auditoría que se queda quieto **no falla: certifica**. Es la
misma clase de daño que el registro clínico con puertas inexistentes (v1020),
sólo que al revés: aquí el papel hacía ver el producto **peor** de lo que es — y
es el papel que lee un auditor o un comprador.

Los doce se re-verificaron **abriendo el archivo, no leyendo la bitácora**. Cada
fila dice ahora cómo se comprobó y en qué versión se cerró: la cruda de verdad
(v996), el diálogo sin las palabras dentro, el rol dentro de cada turno y
sellado, `speaker_options`, el modo médico y el modelo por su nombre (v1022), los
seis roles con «no lo sé», la segunda opinión por tramos solapados, la
revalidación de citas del ensamble, la prosa en el manifiesto de procedencia, el
panel de cambios de cifras (v1000) y la especialidad, que la v1025 llevó hasta la
ruta que de verdad transcribe.

**La sección de mediciones también.** La negación sí tiene caso oro desde la
v985 — lo que falta es la **temporalidad**: «tuvo neumonía hace 3 años» no es
«tiene neumonía». Y «ningún trinquete de voz corre en CI» dejó de ser cierto hace
versiones; lo que sigue fuera son los **tres scripts de corpus**, y no por
pereza: el corpus vive en el disco del Dr., y un trinquete que en CI no encuentra
sus datos pasaría **en verde** sin medir nada — peor que no tenerlo.

**El guardián.** Cada archivo citado por los documentos de `docs/voice/` tiene
que existir, incluidos los nombres sueltos sin carpeta (los más fáciles de dejar
podridos: no dicen dónde viven). Y la tabla tiene que llevar fecha de
re-verificación en vez de un «ABIERTOS» perpetuo, porque una lista de pendientes
sin fecha se lee como si fuera de hoy. Probado al revés: se le metió una cita
falsa y falló.

Lo que **no** comprueba, y se dice: si lo que el documento afirma sobre ese
archivo es cierto. Eso lo verifica una persona.

- `docs/voice/VOICE-001-auditoria.md` — secciones B.2 y C puestas al día
- REG-136 · `src/__tests__/lo-que-cita-la-auditoria-existe.test.ts` · +4 casos, total **6383**

---

## TANDA 176ª — v1027 · EL PASADO NO ES EL PRESENTE

«Tuvo neumonía hace tres años» acababa escrito como **padecimiento actual**.

La negación tiene motor determinista y caso oro desde la v985. La
**temporalidad no tenía nada**, y así lo declaraba la propia auditoría de voz del
charter (la que se puso al día ayer mismo, en la v1026).

Es el hermano del fallo que costó tres versiones cerrar: allí el interrogatorio
nombraba la enfermedad en la **pregunta** y el extractor la cosechaba; aquí la
nombra en **pasado** y se cosecha igual. Y se arrastra igual: queda en el
expediente, se copia a la nota siguiente y cambia lo que otro médico lee dentro
de seis meses.

**Es gramática, no medicina.** El motor no decide si una enfermedad sigue activa
—eso es clínico y no es suyo—: decide si el dictado la puso en pasado y la nota
la afirma en presente, y enseña las dos frases. El mismo criterio que la
intención de orden.

**La mitad del trabajo es la trampa.** «Hace tres años» no significa pasado por
sí sola: «desde hace tres años tiene diabetes» es presente y es la forma normal
de contar un crónico en la consulta mexicana. El presente **manda** sobre la
marca de tiempo — junto con «sigue», «todavía», «actualmente», «en control» y «en
tratamiento». Marcar eso sería peor que no mirar nada: un aviso que salta donde
no debe se acaba ignorando, y con él se ignoran los que sí importan.

Tampoco avisa si la nota ya lo escribió bien: «antecedente de», «historia de»,
«tuvo», «resuelta».

**No borra ni reclasifica.** Sólo devuelve el aviso — y en **ámbar**, no en rojo:
escribir un padecimiento pasado no es un error como lo es afirmar algo que el
paciente negó, e igualarlos gastaría el rojo.

- `src/lib/expediente/temporalidad.ts` — el motor (nuevo, puro)
- `src/app/(dashboard)/consulta/[patientId]/page.tsx` — se calcula contra TODO lo que la nota afirma y se enseña
- REG-137 · `src/__tests__/el-pasado-no-es-el-presente.test.ts` · +14 casos, total **6397**

---

## TANDA 177ª — v1028 · LA SEGUNDA PUERTA DEL PASADO: EL EXTRACTOR

La v1027 puso el motor de temporalidad en la **nota**. Pero el panel «Extraer
entidades clínicas» corre sobre **el mismo texto**, y su `estado` **nace en
`activo` por omisión del esquema**: «tuvo neumonía hace tres años» salía como
condición **activa**.

Una entidad estructurada tiene peor pinta que una frase: parece un dato
verificado. Es exactamente lo que ya pasó con las negaciones, y por eso allí
quedó escrito que arreglarlo en una pantalla dejaría la otra rota.

**Aquí no se reclasifica**, a diferencia de las negaciones. Con una negación se
puede: el paciente dijo que no, y «descartado» es lo que **él** afirmó. Pasar una
condición a «resuelto» porque la frase iba en pretérito **sería una decisión
clínica** — una neumonía de hace tres años puede estar resuelta; una cardiopatía
de hace tres años no lo está por haberla contado en pasado.

Se señala y no se toca. En el servidor, que es donde estaba la defensa hermana
porque la ruta la consumen dos pantallas, y se enseña en el panel **diciendo que
no se cambió nada**: señalar sin tocar sólo sirve si se ve. Y si el extractor ya
la puso como «resuelto», acertó: ni se anota ni se avisa.

- `src/lib/expediente/temporalidad.ts` — `avisosTemporalesDelExtractor`
- `src/app/api/expediente/extraer-entidades/route.ts` — lo calcula y lo devuelve
- `src/components/NerPanel.tsx` · `consulta/[patientId]/page.tsx` — lo enseñan
- REG-138 · +6 casos, total **6403**

---

## TANDA 178ª — v1029 · LA REGLA 24 DEL PROMPT

El prompt de la nota tenía la regla 23 —no cosechar la enfermedad nombrada en la
**pregunta**— y **ninguna sobre el tiempo verbal**. Nada le decía al modelo que
«tuvo neumonía hace tres años» va a antecedentes.

Ahora la tiene, y **con las dos mitades**: el pasado va a antecedentes, y «desde
hace tres años tiene diabetes», «sigue con», «todavía», «actualmente» y «en
tratamiento» son presente aunque traigan fecha.

La segunda mitad no es un adorno. Una regla que sólo dijera «el pasado va a
antecedentes» empujaría al modelo a **degradar un diagnóstico activo** — peor que
el fallo que se quería arreglar.

El orden sigue siendo el de `negaciones.ts`: **un prompt es una petición** y se
cumple casi siempre; «casi siempre» sobre un antecedente que se arrastra a todas
las notas siguientes no basta. La regla ayuda a que el fallo no ocurra; el motor
determinista (v1027/v1028) garantiza que, si ocurre, se vea.

`PROMPT_VERSION` pasa a `nota-2026-08`: viaja al sello de procedencia de cada
nota, y dejarla igual haría indistinguibles las notas hechas con una regla y con
la otra.

- `src/lib/expediente/prompts.ts` — regla 24
- `src/app/api/expediente/procesar/route.ts` — `PROMPT_VERSION`
- REG-139 · +3 casos, total **6406**

---

## TANDA 179ª — v1030 · EL MOTOR NO CUBRÍA SU PROPIO TITULAR

Defecto **mío**, encontrado revisando lo de anoche.

La v1027 reutilizó **sólo** el vocabulario de `negaciones.ts`, que es de
enfermedades **crónicas** — las del interrogatorio dirigido. Y el ejemplo con el
que bauticé el motor en el módulo, en esta bitácora, en el changelog y en el PR
—«tuvo neumonía hace tres años»— **no lo cazaba**: «neumonía» no es una crónica y
no estaba en ninguna lista.

El motor funcionaba, pasaba sus 20 casos y hacía creer que algo estaba vigilado.

Y era **justo al revés** de lo que pide el problema: lo que se cuenta en pasado
es lo **agudo** —una neumonía, una fractura, una cirugía—, mientras que lo
crónico casi siempre sigue activo.

Ahora el motor tiene vocabulario propio, `AGUDAS_FRECUENTES`. **Es vocabulario,
no criterio clínico**, con el mismo límite declarado que `CRONICAS`: que falte un
padecimiento significa que ese caso no se vigila — **no que se dé por bueno**.

«Le operaron» entra como forma de «cirugía» porque en la consulta se cuenta con
el verbo. «Lo van a operar» no: en el futuro no hay nada que corregir.

**`cronicasEn` no se tocó.** Ensanchar el vocabulario de `negaciones.ts`
cambiaría qué cuenta como **negación** — otra defensa y otra decisión, no un
efecto secundario de ésta.

La trampa sigue en pie con el vocabulario nuevo: «desde hace tres años tiene
neumonía recurrente» no se marca.

- `src/lib/expediente/temporalidad.ts` — `AGUDAS_FRECUENTES` y `padecimientosEn`
- REG-140 · +7 casos, total **6413**

---

## TANDA 180ª — v1031 · PAQUETE DEL MASTER LOOP V7 (cuatro iteraciones)

El Dr. entregó el **Master Loop V7** y pidió ejecutarlo. Se montó el sistema
operativo del programa y salieron tres defectos, dos de ellos **encontrados
midiendo o mirando producción**, no leyendo código.

**INFRA-001** — `CLAUDE.md`, `.claude/rules/` (6), `.claude/agents/` (8, con
equipo rojo independiente) y `agent-state/` con métricas **medidas**. Y la
primera corrida del corpus de **6 000 frases** que el Dr. reclamó: llevaba días
en disco y nadie lo había pasado por el pipeline. **96.02 % intactas, cero
términos clave perdidos.**

**VOICE-004** — de esa medición salieron 25 frases que pedían confirmación, y
**las 25 eran la misma**: balance hídrico negativo. `ES_CANTIDAD` no aceptaba
signo, leía «−1500 mL» y creía que faltaba la dosis. Un balance negativo es lo
normal en diuresis o ultrafiltración, y la compuerta que se disparaba de más es
**la misma** que avisa de una dosis perdida: el ruido gastaba el aviso que no se
puede ignorar. **25 → 0**, con las intactas sin moverse.

**SAFE-002** — el Dr. mandó una captura de su pantalla: «…Diabetes mellitus tipo
2. **[object Object] [object Object]**…». `diagnosticos` y `secciones` son
arreglos de objetos, así que la comprobación de negación y temporalidad
**sólo veía el resumen**. Un antecedente negado que viviera únicamente como
diagnóstico estructurado no disparaba nada — y ése es el que se arrastra a la
receta. La prueba que debía protegerlo **certificaba el defecto**: exigía la
línea literal rota.

**OPS-001** — al Dr. le salió «el servicio de IA no está disponible» a media
consulta. Todo el camino existía; faltaba que **le llegara**. Ahora la franja lo
sigue por la app, sólo a él, con el titular y qué hacer.

- REG-141 · REG-142 · REG-143 · +32 casos, total **6436**

---

## TANDA 181ª — v1032 · P0: LA DIARIZACIÓN LLEVABA CAÍDA EN SILENCIO

El Dr. puso su llave de AssemblyAI para que yo midiera el corpus actuado. La
medición no midió nada: **el proveedor rechazó la petición**.

> «The speech_model parameter is deprecated. Use speech_models:
>  ["universal-3-5-pro", "universal-2"]»

Comprobado llamando a su API con las dos variantes: **devuelve 400 con cualquier
valor**, incluido el alias `'best'` — que era justo nuestro respaldo.

Los **dos** intentos de la ruta fallaban. Cada consulta grabada se iba al motor
de repuesto **sin separación de voces**, y sin voces separadas no hay atribución
de rol: de ahí cuelgan el motor de negaciones y la procedencia.

Silencioso, porque la ruta hace lo correcto — sigue con el respaldo antes que
dejar al médico sin nota.

**Y cuatro pruebas de contrato pasaban en verde** todo ese tiempo, porque
comprobaban que el código dijera lo acordado, no que el proveedor lo aceptara.
Una prueba de contrato no sustituye una llamada real.

- REG-146 · +2 casos, total **6455**
- **Primera medición de atribución de rol**: 8/12 voces, 81.94 % de turnos,
  9 confusiones médico↔paciente (`informe-diarizacion-2026-08-04.json`)

---

## COLA NUEVA — AUDITORÍA DEL EQUIPO 2026-08-03 (de 6.5 a 9)

Cinco especialistas verificaron el código ellos mismos. Veredicto del Dr.:
«ingeniería de 8 sosteniendo un producto de 6.5 y un negocio de 6; el sistema es
sustancialmente mejor de lo que un comprador puede ver».

**Cerrado ya:** N1 (v944, el tope de prueba cortando a quien paga).

### NEGOCIO 6.0 — lo que pierde clientes hoy
- N2. **Dos modelos de prueba contradictorios.** `/api/clinic/crear` nace
  `status:'trial'`, pero `estadoAcceso()` (`layout.tsx:190-196`) manda a
  `'sin_tarjeta'` TODO `trial` y bloquea la app. El médico lee «14 días gratis,
  sin tarjeta» en seis pantallas y choca contra un muro. Y `paywall-prueba.ts`
  —escrito y probado, con su espejo en las reglas— es INALCANZABLE.
  **CERRADO v972**: el Dr. eligió C (sin tarjeta, con la IA limitada). El muro
  era `estadoAcceso`; el modelo A entero ya estaba construido y era inalcanzable.
- N3. ~~El catálogo editable de precios no llega al cobro ni a los créditos
  entregados.~~ **CERRADO v964** (cupo entregado, precio por asiento y tope de IA
  leen el catálogo vigente; queda el MRR, que es N7).
- N4. ~~Fuga por asiento: el cobro sólo se ajusta si alguien pulsa sincronizar.~~
  **CERRADO v965** (cron nocturno que concilia en los dos sentidos; el cupo sigue
  a los presentes a propósito, para no repetir v944).
- N5. ~~Contabilidad valora con `COSTO_CREDITO_MXN = 1.5` inventado mientras el
  libro de costos REAL existe y nadie lo lee.~~ **CERRADO en código**
  (`costo-ia-contable.ts`, leído por la ruta): suma el costo medido del libro.
  Queda BLOQUEADO en el Dr. — sin `TIPO_CAMBIO_USD_MXN` en Vercel no se convierte
  a pesos y se sigue diciendo en pantalla que la cifra es un supuesto.
- N6. ~~Margen por consulta y costo por médico: falta una línea de agrupación
  (`porClave` ya existe), no un sistema.~~ **CERRADO v1008**.
- N7. ~~MRR: sobrestima al anual (nadie lee `ciclo`) y subestima al multi-médico.~~ **CERRADO v1006**.
- N8. ~~Churn no ve el trial abandonado (se queda en `status:'trial'` para siempre).~~ **CERRADO v1007**.
- N9. ~~`/operacion:18` promete facturación CFDI al paciente que NO existe.~~ **CERRADO v968** (decisión 13 del Dr; y OJO: el CFDI de la suscripción sí existe y se conservó).

### DATOS 6.0 — «no sabe entregarlo ni reconstruirlo»
- D1. ~~La exportación «expediente» NO incluye adendas, laboratorios, fotos,
  antecedentes, formularios, internamientos ni bitácora. Y descarta los
  borradores en silencio (`fhir-export.ts:173`).~~ **CERRADO**: el botón
  «Expediente completo» ya llevaba todo lo anterior y declara lo que no pudo
  leer; el descarte silencioso de borradores en el bundle FHIR se cerró en
  **v1009**.
- D2. **La A de ARCO no existe**: se «resuelve» con un `prompt()`
  (`cumplimiento/page.tsx:203`). Plazo de 20 días que se cuenta y no se cumple.
- D3. ~~El respaldo del consultorio es un N+1 secuencial EN EL NAVEGADOR y no hay
  importador: no se puede volver a entrar.~~ **YA ESTABA CERRADO** (verificado
  2026-08-04): `clinic/exportar` es servidor + NDJSON paginado y `clinic/importar`
  existe, con modo ensayo y candados.
- D4. ~~La «migración de salida» son 11 columnas de demografía.~~ **YA ESTABA
  CERRADO** (verificado 2026-08-04): la pantalla de Migración exporta también lo
  clínico por dominio, una fila por elemento, además del libro completo.
- D5. ~~No existe exportación a Excel. Ninguna.~~ **CERRADO v960** (escritor propio, sin dependencia nueva).
- D6. ~~La bitácora de accesos no se puede exportar (NOM-024).~~ **YA ESTABA
  CERRADO** (verificado 2026-08-04): `api/cumplimiento/bitacora` entrega el CSV
  del periodo, con la ventana declarada en el archivo.
- D7. ~~Dos implementaciones FHIR divergentes; la ruta HTTP usa la pobre.~~ **CERRADO v1010**.
- D8. ~~Restauración nunca probada: `docs/SIMULACRO_RESTAURACION.md` sin una sola
  fila de evidencia.~~ **MITAD CERRADA v1011**: `npm run simulacro:respaldo` mide
  la ida y vuelta del respaldo (200 001 documentos en 161 ms, acta en el
  documento). **BLOQUEADO EN EL DR** la otra mitad: el `gcloud firestore
  databases restore` necesita consola y cronómetro a mano.

### INGENIERÍA 7.0 — «no tiene forma de avisar que algo se rompió»
- I1. Ningún canal de alerta a un humano. Cero. El buzón del plan de incidentes
  dice literalmente «(definir buzón real)».
- I2. `global-error.tsx:11` —la caída más grave— sólo hace `console.error`.
  `api/errores` exige sesión, así que el servidor no puede auto-reportarse.
- I3. Sin `/api/health`. No hay forma de saber si Firestore/Stripe/IA están arriba.
- I4. `gateway.ts:128` sin timeout: un socket colgado inmoviliza el lambda 300 s.
- I5. El cron de recordatorios recorre consultorios EN SERIE, sin `maxDuration`
  y sin latido: si deja de correr, nadie se entera.
- I6. `superadmin/clientes` y `contabilidad` escanean tablas completas + N+1.
- I7. `rate_limits`, `platform_csp`, `whatsapp_status`… crecen sin barrendero. El
  TTL está escrito en un comentario y nunca se activó.
- I8. `public/sw.js` pesa 252 KB y se descarga entero en cada carga para leer un
  número de versión.

### UX 6.5 — el eje equivocado
- U1. El color YA está ganado (2 536 usos de token contra 221 hex, casi todos
  fallbacks legítimos). Migrar eso da poco.
- U2. ~~Lo que NO tiene gobierno: tipografía, espaciado y radio.~~ **CERRADO v962**
  — medido: 38 tamaños, 37 espaciados (no 23) y 28 radios; píldora unificada
  (128 usos) y trinquete de variedad congelado en 38/37/24. La deuda restante son
  53 valores sueltos con 231 usos, y el propio guardián los lista.
- U3. ~~Las pantallas del comprador son las peores.~~ **CERRADO v963 corrigiendo la
  premisa**: la densidad es cierta (24.7 / 17.3) pero NO es daño — ahí no hay ni un
  control inaccesible. El daño real estaban 24 `<div onClick>` sin teclado, TODOS
  en las pantallas de trabajo. Reparados + guardián.
- U4. ~~Hueco real del trinquete de color.~~ **CERRADO v961** — era la punta: se
  le escapaban 265 usos en 57 archivos. Guardián ensanchado y congelado en 265
  (sólo baja); ToastContext migrado a tokens.

### ANTIBIOGRAMA 7.5 — cuatro defectos, los cuatro «escrito y sin conectar»
- A1. ~~Fenotipo salvaje leído como resistencia adquirida: un *E. faecalis*
  pan-sensible sale MDR con alerta crítica de colistina y mecanismo `mcr`.~~
  **CERRADO** (verificado 2026-08-04 corriendo el caso exacto por el motor: un
  *E. faecalis* pan-sensible con sus tres R naturales sale con **cero fenotipos,
  cero alertas y cero mecanismos**). El filtro se aplica en colistina y en el
  conteo de clases; los Gram positivos llevan además otra etiqueta por la
  decisión 1 del Dr.
- A2. ~~La CMI censurada se pierde en la frontera visión→motor.~~ **CERRADO v957**
  (con la premisa corregida: se perdía en la LIBRERÍA, no en la pantalla).
- A3. ~~La edición interpretativa no se propaga a `categoriasCMI`.~~ **CERRADO v958**
  (y en pantalla se pintaba VERDE, que era peor que en el prompt).
- A4. ~~El resultado NEGATIVO de una confirmatoria se lee, se tipa, se transporta
  y se tira.~~ **CERRADO v959** (plomería; la resolución clínica sigue siendo del Dr).
- **LAS 6 PREGUNTAS: CONTESTADAS el 3-ago-2026.** Ver
  `docs/maintenance/DECISIONES-CLINICAS-2026-08-03.md`. Respuestas: 1B · 2B con
  estado SDD independiente · 3B condicionada · 4B · 5A · 6A sin «confirmado».
  **LAS SEIS IMPLEMENTADAS**: 1 y 6 en v966 · 2 en v967 · 4 y 5 en v969 · 3 en v970. Queda
  4 (BLEE→sospecha) y 5 (mCIM→indeterminado), más la capa de **política
  institucional** que separa aislamiento/notificación del motor microbiológico.

---

## CIERRE DE LA SESIÓN DEL 4-AGO-2026 (noche) — v1038 → v1047

Diez versiones desplegadas, verificadas en producción con `curl /version.txt`, con
los 5 jobs de CI en verde y fusionadas a `main`. Suite 6 353 → **6 596**. Lint
clavado en 97 (su techo) en todas. Once entradas nuevas en el regression-ledger
(REG-153 … REG-164).

**Dinero** — v1038: el anticipo se podía cobrar dos veces si Stripe reintentaba y
la cita ya no existía (REG-153).

**El fallo que el Dr vivió en pantalla** — v1039 y v1040. «El servidor rechazó el
permiso» con el permiso correcto: verificado EN VIVO en su cuenta que el rol, la
clínica, el pase libre, la sesión y el tamaño estaban bien. El documento
simplemente ya no existía, y `updateDoc` sobre un ausente vuelve como
PERMISSION_DENIED. Se persiguió hasta el origen (REG-157: `descartar()` no soltaba
el id) y ahí apareció que **mi propia reparación habría recreado una consulta
descartada**; cerrado el mismo día.

**Voz** — v1041: el 81,94 % de atribución escondía que 6 de 9 confusiones venían
de dos diálogos que el proveedor colapsó en UNA voz, donde lo que dijo el paciente
se archivaba como dicho por el médico (REG-158). v1042: el WER real, por fin
publicable — el corpus roto costaba **10 puntos** (25,55 % crudo / 22,81 % pipeline
sobre audio válido), con los dos números y sus límites (REG-159).

**Privacidad y aislamiento** — v1043 (el importador podía pisar una nota FIRMADA,
y una regresión mía de v1037 impedía restaurar), v1044 (el patientId viajaba a una
colección raíz), v1045 (la cola de auditoría sobrevivía al logout), v1046 (un
consultorio podía quedarse con el canal de WhatsApp de otro), v1047 (el candado
anti-IDOR del dictado se desactivaba solo por una carrera).

### LA COLA TÉCNICA SEGURA SE AGOTÓ

Lo que queda **no lo puedo decidir yo** (charter §3.2 y §30):

1. **Vía por defecto del medicamento.** Hoy un fármaco sin vía dictada asume
   `oral`. Es una decisión clínica: o queda vacío y se pide, o se asume. No la
   tomo yo. **NEEDS_CLINICAL_REVIEW.**
2. **Requisitos de la receta impresa.** El charter enumera ocho; se emiten tres.
   Cuáles son exigibles es criterio legal del consultorio.
   **NEEDS_LEGAL_REVIEW.**
3. **`STRIPE_WEBHOOK_SECRET` en Vercel.** No añadí el 503 fail-closed a
   propósito: si la variable falta, silenciaría el registro de sus cobros. Hay
   que mirar primero si está.
4. **`OPS_ALERTA_WEBHOOK`.** Sin buzón, nadie vigila al cron vigilante.

## PENDIENTE — cola priorizada (mía)
1. ~~`priceIdDe` cae de anual a mensual en silencio~~ — HECHO. **`priceIdDe`** — `src/lib/stripe.ts:50`:
   `STRIPE_PRICES_ANUAL[plan] || STRIPE_PRICES[plan]`. Si falta la variable del
   precio anual, el cliente compra «anual» y Stripe abre una suscripción MENSUAL,
   con los metadatos diciendo `ciclo: 'anual'`. Nadie se entera hasta el 2º cargo.
2. ~~`planPorMonto` se equivoca con las anuales~~ — HECHO (v870). **Era** — `src/app/api/stripe/webhook/route.ts:71`:
   los cortes están en centavos de plan MENSUAL. Una anual de Agenda (~349000)
   devuelve `'hospital'`. Sólo se dispara si falta `metadata.plan`.
3. ~~`items.data[0]` no tiene orden garantizado~~ — HECHO (y v870 añadió los price ids anuales al conjunto). **Era** — mismo archivo, `:309`. Con un
   ítem de asiento en la suscripción puede ser el precio del médico extra.
4. ~~Prueba de 14 días en CADA checkout~~ — HECHO (v937): la prueba se estrena
   una vez; se pregunta a Stripe por todas las suscripciones del cliente y hay
   marca local de respaldo escrita por el webhook.
5. ~~`asientos` marca médicos contratados sin cobrarlos~~ — HECHO (409 explicando por qué). **Era** — `src/app/api/stripe/asientos/route.ts:82`.
6. ~~`invoice.paid` sin clínica guarda `clinicId: ''`~~ — HECHO: se marca `huerfano: true`.
7. ~~Las reglas dejan reatribuir `medicoId` al vincular factura~~ — HECHO: `medicoId`, `medicoNombre`, `referenciaExterna` y `folio` congelados. **Era** — `firestore.rules:611`,
   lo que mueve el reparto de comisiones.
8. ~~logAudit en silencio~~ — HECHO (v824). — `src/lib/expediente/audit-log.ts:84`.
9. ~~El portal ARCO público no verifica identidad~~ — HECHO (v871): no puede
   ligar expediente ni declararse verificado, y el panel lo declara. La
   verificación en sí sigue siendo un acto humano de la clínica, como manda el
   Art. 29 LFPDPPP.
10. ~~Horario partido / descansos / festivos recurrentes~~ — HECHO (v829):
    `DaySchedule.descansos` existe y los festivos aceptan `MM-DD` recurrente, con
    su editor en Configuración. Verificado el 2026-08-02.
11. ~~Las sucursales son decorativas en la agenda~~ — CERRADO POR DECISIÓN
    (v847, verificado el 2026-08-03): `branchId` **salió** de la lista blanca de
    `api/appointments`. Aceptar un campo que nada lee es prometer una función que
    no existe; el modelo (`src/lib/branches.ts`) queda declarado como huérfano
    con su razón. Implementar multi-sucursal de verdad es una función, no un
    arreglo.
12. **Google Calendar: freebusy sólo en el modal del consultorio** — HECHO A
    MEDIAS. `api/calendar/ocupado` existe y lo consume `AppointmentModal`, que
    además DECLARA si la consulta falló. **Queda**: el portal público, el bot y
    el reagendado del paciente NO lo consultan, así que un paciente puede
    reservar encima de un evento de Google. Motivo real, no pereza: el token es
    por `uid` (`googleTokens/{uid}`) y los caminos públicos no tienen sesión ni
    forma fiable de mapear `medicoId` → `uid`. **v875 escribió ese vínculo** al
    conectar el calendario (`doctors/{id}.uid` + `googleTokens/{uid}.medicoId`),
    que era el prerrequisito, y **v876 lo consumió**: la disponibilidad pública
    descuenta el freebusy del médico, el alta lo revalida y **v877 llevó lo mismo
    al bot**, con la consulta en un solo módulo. **v899 cerró el hueco de los ya
    conectados**: el vínculo se rellena solo la próxima vez que el médico abre su
    configuración, con las mismas reglas, sin recalcular uno existente y
    diciéndoselo si no se pudo.
    **v901 cerró lo que faltaba**: el portal ya mueve y borra el evento de Google
    al reagendar y cancelar, con ese mismo vínculo. **v902 cerró lo último**: la agenda ya
    LEE `googleCalendarSyncStatus`, enseña la cita descuadrada y la repara con un
    clic desde la sesión del médico. **v938 cerró el hueco que quedaba de verdad**:
    el REAGENDADO del paciente desde su enlace seguía calculando los huecos sin
    mirar el calendario del médico, en los dos caminos (`slots` y `reagendar`),
    así que podía caer encima de una cirugía y la reserva se ACEPTABA. Punto 12
    **cerrado de verdad**.
13. ~~Fragmentación cromática~~ — HECHO (v872 + v900): los 124 usos de PRIMER
    PLANO migrados a `--red`/`--amber` con trinquete en 0, y **v900 migró los 277
    de FONDO y BORDE** a `color-mix` con el token, con su propio techo en 0. El
    papel conserva el hexadecimal a propósito. v900 además hizo que `@media print`
    fije los colores clínicos en los valores del tema claro.
14. ~~`BLOQUEA_RECETA` promete una barrera que no existe~~ — HECHO: se llama
    `RIESGO_MAXIMO` y el comentario dice qué es y qué no; la compuerta real es el
    motor determinista. Y `alergia_conflicto` ya está en el esquema zod, así que
    el aviso sí sale del servidor. Verificado el 2026-08-02.
15. ~~Textos clínicos sin fuente~~ — HECHO A MEDIAS (v873): la cita ya se
    ENSEÑA en el panel, en la nota y en el HTML, y su ausencia se declara.
    **Queda, y es del Dr.**: las 42 recomendaciones de
    `src/lib/inmuno/recomendaciones.ts` sin fuente. Yo no las invento.

---

## DECISIONES COMERCIALES QUE FALTAN (no las tomo yo)

- **¿La prueba de 14 días es con tarjeta o sin ella?** El código promete «sin
  tarjeta» en `/registro` y en `/setup`, y el gate de `layout.tsx` bloquea la app
  entera a quien está en `trial`. Además hay un sistema de prueba COMPLETO y
  muerto en `lib/finanzas/paywall-prueba.ts`. Los dos modelos conviven y se
  contradicen; hay que elegir uno.
- **¿Se puede repetir la prueba?** Hoy sí, indefinidamente: `trial_period_days:
  14` es incondicional en cada checkout.
- **Verificación de correo**: no existe (`sendEmailVerification` no aparece en el
  repo). Un correo mal tecleado deja la cuenta irrecuperable sin soporte humano.

## BLOQUEADO EN EL DR. (lo último, por su instrucción)

- **P6** — validar los 23 motores en `pendiente_validacion` + 1 experimental.
- **P7/P8** — asignar la clasificación de seguridad a cada fármaco (el esquema ya existe).
- **P19** — pentest externo, PITR y simulacro de restauración (sus consolas).
- **P22** — cuenta de prueba con contraseña en los secretos de CI para el E2E.
- Tarifas de los modelos de IA (el libro de costos nace vacío a propósito).
- Plantillas de WhatsApp aprobadas en Meta.
- Cuál debe ser el tope de huecos por día (punto 1 de EN CURSO).
- Las ~39 recomendaciones de inmuno sin `fuente` declarada.
- **¿Un flujo de O₂ registrado implica «recibe O₂ suplementario» para NEWS2?**
  (v905). Hoy se declara con ⚠ y no se deduce: el modificador suma puntos y
  aplicarlo por nuestra cuenta cambiaría el score. NEEDS_CLINICAL_REVIEW.
- **¿El motivo de una corrección de signos es obligatorio?** (E0-09/Q4). El tipo
  dice que su obligatoriedad es política del expediente. v904 lo pide y lo enseña,
  y declara su ausencia en ámbar, pero NO bloquea el guardado: exigirlo es su
  decisión, no de la pantalla.

---

# NOCHE DEL 1 AL 2 DE AGOSTO — v829 a v833

Panel de especialistas en paralelo (agenda, IA/voz, clínico-como-software,
abogado sanitarista). ~45 hallazgos; lo confirmado leyendo el código está abajo.

| v | Qué se reparó |
|---|---|
| **829** | **Horario partido.** `DaySchedule` era un solo tramo: 9-14 y 16-20 no se podía expresar. `descansos` es opcional — sin él, el día se comporta igual que antes. Un descanso mal escrito se IGNORA en vez de romper el día. |
| **830** | **El fósil y los otros tres motores.** Hay CINCO implementaciones del cálculo de huecos. El horario del médico se copiaba al darlo de alta y no se volvía a escribir nunca —no hay editor por médico— y aun así los cuatro caminos la preferían: **todo cambio de horario decía «guardado» y no llegaba a la agenda**. El bot tenía su propia copia (ofrecía la comida, escondía huecos libres, no revalidaba al confirmar). El POST del portal aceptaba lo que el GET ya no ofrecía. |
| **831** | **La IA cobraba lo que no daba.** «Agregar análisis a la nota» NO ha funcionado nunca (`res.json()` sobre NDJSON) y cobraba 4 créditos por clic. El consultor cobraba aunque el proveedor fallara. Dos rutas llamaban al modelo sin mover el contador → el corte no podía dispararse. La ruta de la nota esquivaba la cartera (doble gasto). |
| **832** | **Alergias y dosis.** «Niega alergia a penicilina» bloqueaba la firma. La compuerta por nombre exacto estaba muerta (`tipo` que nadie escribe). El peso tecleado no llegaba a la verificación mg/kg. «45 mg/kg» se leía como 45 mg. El parser local inventaba vía y severidad. Ya queda constancia del consentimiento de grabación y de quién toca las alergias. |
| **833** | **ARCO a medias.** La supresión dejaba vivas las subcolecciones (versions, adendas, laboratorios, fotos, clinico) diciendo «se elimina el expediente completo». El bloqueo no bloqueaba nada. El fallo de la baja de WhatsApp se tragaba respondiendo «listo». La solicitud legal seguía en «recibida». |

**Módulos nuevos**: `lib/horario-medico.ts`, `lib/ndjson.ts`.
**Pruebas**: 4463 → 4493. Lint en el techo (99) en todas.

## COLA CONFIRMADA, PENDIENTE (por orden de daño)

1. **`BLOQUEA_RECETA` se lo come zod** — el esqueleto de `SafetyBlock`
   (`extraction-schema.ts:83`) no declara `alergia_conflicto`, así que la bandera
   nunca sale del servidor por la ruta de la nota. Por la del NER sí llega, pero
   sólo pinta una tarjeta: `entidades` no se lee en el guardado ni en la receta.
2. **Procedencia sella como «dictado» sin verificar la cita** — basta una cadena
   no vacía (`procedencia.ts:101`). El emparejamiento de medicamentos es por
   NOMBRE pero el valor sellado incluye la dosis: el médico corrige la dosis y
   queda sellada como dictada con la cita original. Y en el fallback local todo
   sale como `manual`, o sea «lo escribió el médico», sobre datos de máquina.
3. **La página de verificación afirma «no fue alterado» sin comparar nada**
   (`verificar/[token]/page.tsx:58`). Sólo muestra el hash. Y el QR puede
   arrastrar el hash viejo si se imprime justo tras corregir una dosis.
4. **Un fallo de PubMed es indistinguible de «no hay literatura»** —
   `pubmed.ts:97` devuelve `[]` en el 429. El médico lee «no hay evidencia».
5. **`corregirViaParenteral` sólo existe en el papel** — la nota firmada conserva
   la vía equivocada y `medicamentosVigentes` la propaga (`receta/page.tsx:226`).
6. **El ciclo de vida de la orden de medicamento no tiene escritores** — nada
   asigna `suspendida/terminada/cancelada`, así que «Está tomando» es en realidad
   «todo lo que alguna vez apareció en una nota». NEEDS_CLINICAL_REVIEW: ¿una
   duración cumplida pasa a terminada sola?
7. **La firma no da no repudio** — hora e identidad las pone el cliente y las
   reglas no exigen `metadata.medicoId == request.auth.uid` (`firestore.rules:212`).
   Las adendas se autoatribuyen y el motivo es opcional.
8. **Laboratorios y fotos se borran desde el navegador sin dejar rastro**
   (`firestore.rules:240,249`), contra la conservación que promete el aviso.
9. **La cola de bitácora se atribuye a quien entre después** — el asiento se
   encola sin identidad y se drena con el token del siguiente usuario.
10. **El portal público no escribe el aviso de privacidad en el paciente** —
    dos booleanos en la cita, sin versión ni huella (`public/booking:253`).
11. **La verificación de la nota se recorta a 12 000 chars sin marca** y puede
    devolver «sin hallazgos» sobre lo que no leyó (`verificar-nota:69`).
12. **Los bloqueos se guardan con la zona del navegador**, no la del consultorio
    (`configuracion/page.tsx:1991`).
13. **El portal público decide los días con tres relojes** y ninguno es el del
    consultorio: un paciente en otro huso pierde un día entero sin aviso.
14. **El Consultor manda el NOMBRE del paciente al proveedor** y lo persiste vía
    `extraerAprendizajes` (`consultor/page.tsx:63`).
15. **Festivos no editables ni recurrentes** — se leen en cuatro sitios y no se
    escriben en ninguno: la lista está siempre vacía.


## SEGUNDA TANDA DE LA NOCHE — v834 a v839

| v | Qué se reparó |
|---|---|
| **834** | Zod se comía `safety.alergia_conflicto` (el prompt lo pedía desde siempre) → se leía como «el modelo no vio nada». La vía se corregía sólo en el papel, no en la nota firmada. El QR podía certificar la versión anterior. La página de verificación afirmaba «no fue alterado» sin comparar nada. Un 429 de PubMed se leía como «no hay evidencia». |
| **835** | **El sello de procedencia mentía en las dos direcciones**: bastaba una cadena no vacía para sellar un campo como «dictado» y mostrar la frase entrecomillada como literal; y un valor que el médico corrigió seguía diciendo «dictado» con la cita original. Sin extracción, todo salía como «manual» aunque lo hubiera escrito el parser local — que además se atribuía a Opus. |
| **836** | La segunda opinión recortaba a 12 000 caracteres **sin marca** y podía decir «sin hallazgos» sobre lo que no leyó. Los bloqueos se guardaban con la hora del navegador. El portal armaba los días con el reloj del paciente. El Consultor mandaba el nombre del paciente al proveedor. |
| **837** | Festivos editables y **recurrentes** (`MM-DD`): la lista se leía en cuatro sitios y no se escribía en ninguno. El portal público ya escribe el aviso de privacidad en el expediente, con versión y huella, igual que el alta desde el consultorio. |
| **838** | Los asientos de bitácora encolados sin red **se firmaban con el nombre de quien entrara después** en ese equipo. Y `asientosPendientes()` no lo mostraba ninguna pantalla. |
| **839** | **Cualquier médico podía firmar una nota con la cédula de otro** (`firestore.rules`). Las adendas —el único mecanismo de corrección sobre un documento inmutable— se creaban sin acreditar autor ni motivo. Reglas desplegadas aparte. |

**Módulos nuevos**: `lib/horario-medico.ts`, `lib/ndjson.ts`, `esFestivo` en
`lib/availability.ts`, `asientosDeOtros` en `lib/expediente/audit-log.ts`.

**Pruebas**: 4463 → 4501 · emulador 100 → 101 · **techo de lint apretado de 99 a 98**.

## LO QUE QUEDA DE LA COLA (verificado, sin tocar)

1. **Laboratorios y fotos se borran desde el navegador sin dejar rastro**
   (`firestore.rules:240,249`), contra la conservación que promete el aviso. Hace
   falta decidir si se prohíbe desde el cliente o se exige motivo.
2. **El ciclo de vida de la orden de medicamento no tiene escritores** — nada
   asigna `suspendida/terminada/cancelada`, así que «Está tomando» es en realidad
   «todo lo que alguna vez apareció en una nota». **NEEDS_CLINICAL_REVIEW**:
   ¿una duración cumplida pasa a `terminada` sola, o exige acto médico?
3. **El header de la consulta no muestra problemas activos ni última visita**
   (P-005 del V6). Los medicamentos vigentes ya están (v828).
4. **`BLOQUEA_RECETA` del NER sigue sin gatear nada** — el estado `entidades` no
   se lee en el guardado ni en la receta, y el NER es un botón manual.
5. **Sucursales decorativas** (`branchId` no lo escribe ninguna interfaz).
6. **Google Calendar unidireccional** — no hay `freebusy`.
7. **`timeToFirst*` del onboarding** y los **cuatro tableros** de P-022.
8. **`BillingEngine`/`StripeAdapter`** (P-012) — sólo si sobra tiempo: hoy funciona.


## TERCERA TANDA — v840 a v844 (madrugada del 2)

| v | Qué se hizo |
|---|---|
| **840** | **«¿Qué tiene?»** — el encabezado de la consulta ya dice problemas activos y última visita, con la misma regla del silencio que la medicación (no mencionar no resuelve). Lo crónico va primero; el CIE-10 manda sobre el texto. **Verificado en producción con Chrome**, sin errores de consola. Y borrar un laboratorio o una foto ya deja rastro. |
| **841** | El `timeToFirst*` del charter **ya se calculaba** en `lib/onboarding/embudo.ts` y no lo pintaba nadie. Segunda corrección de mi propio mapa del V6 en vez de escribir un duplicado. |
| **842** | **Tablero técnico**: latencias p50/p95/p99, la peor y tasa de fallo, por operación y por modelo. Los datos llevaban meses en cada asiento del libro de costos, sin leer. Tres percentiles y no uno: con 5 lentas de 105 el p95 aún cae en la zona rápida. |
| **843** | **Tasa de bajas** al lado del MRR. Primero hubo que poder medirla: al cancelar sólo se escribía `status: 'cancelled'`, sin fecha. El denominador es quien PODÍA irse. Sin base dice «sin base», no 0 %. |
| **844** | La corrección por voz podía devolver una nota **mutilada** (la segunda opinión de GPT no se validaba contra el esquema). Y el cruce alergia↔medicamento no veía el último tercio de una consulta larga: la ruta aceptaba 20 000 caracteres y el prompt recortaba a 12 000 en silencio, dejando el panel vacío. |

**Estado del V6 (mío)**: P-002, P-003, P-005, P-007, P-008, P-009, P-021 y P-022
cerrados. **P-012 (`BillingEngine`) NO se hizo a propósito**: el ciclo de vida ya
está reparado y probado; extraer la abstracción sin un segundo proveedor de pago
es mover código que funciona.

**Pruebas**: 4463 → 4530 · emulador 101 · lint 99 → 98.

| **845** | **Suspender es un acto, no un olvido.** El ciclo de vida de la orden existía en el modelo y no lo escribía nadie: «Está tomando» era «todo lo que alguna vez apareció en una nota». Cada fármaco lleva un «ya no» con dos opciones (se suspende / ya terminó) y **motivo obligatorio**. No se edita el pasado: se escribe en la nota de hoy. Y lo suspendido **no se receta**. Verificado en producción sin errores de consola. |

| **846** | **Un campo que decía `BLOQUEA_RECETA` y no bloqueaba nada.** El estado con las entidades del NER no se lee en el guardado ni en la impresión, así que sólo pintaba una tarjeta roja — y la documentación afirmaba que «el frontend NO permite firmar». Ahora se llama `RIESGO_MAXIMO` y la tarjeta dice quién detiene de verdad la firma. |
| **847** | **La API aceptaba `branchId` y no lo miraba nadie.** Se guardaba, pero el motor de agenda no particiona por sede: dos sucursales compartían una agenda mientras el cliente recibía 200. Aceptar un campo que se ignora es prometer una función que no existe. |

**Sigue siendo del Dr. (P-008)**: si una `duracion` cumplida debe pasar sola a
`terminada` o exige acto médico explícito. Hoy exige acto explícito, que es la
opción que no inventa nada.

| **848** | **Google Calendar deja de ser unidireccional.** Una cirugía puesta en Google el jueves de 8 a 12 seguía ofreciéndose a los pacientes. **Y NO hacía falta ampliar el permiso** —como yo había apuntado aquí—: el alcance que ya se concede incluye `freebusy`. Se pregunta sólo por intervalos (sin títulos ni asistentes), se convierte a bloqueos —el idioma que el motor ya habla— y el bloqueo lleva el `medicoId` del dueño del token. Si la consulta falla, se dice en pantalla. |

| **849** | **La próxima consulta.** El motor de tareas sabía derivar «agendar el seguimiento» desde que se escribió, y el CRM cuenta «seguimientos vencidos» sobre `patient.proximoSeguimiento`: **un campo que no escribía nadie**. La tarea no nacía y el contador era cero permanente. Ahora la consulta lo pide (opcional) y al firmar alimenta las dos. **NO va dentro de la nota firmada**: es dato de agenda, no afirmación clínica, y meterlo obligaría a subir la versión del sello de integridad. |

| **850** | **En una consulta normal no salía NINGÚN pendiente de estudios.** `/pendientes` promete que «salen solos al firmar», pero el motor los deriva de `nota.estudiosOrden` y ese campo sólo lo llena la Valoración del inmunocomprometido: en una consulta corriente el médico elige los estudios en **Orden Médica**, imprime, y esa pantalla nunca escribía de vuelta. Ahora los pendientes nacen al **emitir** la orden —entregarla es un hecho, marcar casillas es una idea— y reimprimir **no duplica**: las tareas con `notaId` van con id derivado, y el `merge` no pisa el estado si el médico ya la movió. |

## LO QUE QUEDA EN LA COLA (nada de esto es urgente)
- **Fragmentación cromática**: 160 de 187 `.tsx` con estilo en línea.
- **Formularios previos a la consulta** en el portal del paciente (P-019).
- ~~Próxima cita al motor de tareas~~ — HECHO (v849).
- **Instrucciones al paciente (P-010)**: el tipo de tarea `indicacion_paciente`
  existe y `/pendientes` sabe etiquetarlo, pero **nada lo crea**, y lo dejo así a
  propósito. Las indicaciones se escriben dentro del plan, que es obligatorio en
  todas las notas: derivar de ahí pondría una tarea en CADA consulta y el
  worklist se abandonaría en una semana. Falta una **decisión de producto**: qué
  acto concreto significa «hay indicaciones que entregar» — ¿imprimir una hoja
  para el paciente? ¿marcarlo a mano? Queda declarado en `modelo.ts` para que
  nadie lo dé por hecho al leer el tipo.
- **`PlanVersion`/`LegacyPlan`/`OverageRule`/`Addon`/`Discount`** del motor de
  precios (P-013).


## CUARTA TANDA — v851 a v852 + AUDITORÍA DE LOS MÓDULOS QUE FALTABAN

Tres auditores nuevos sobre lo que no se había mirado en toda la noche:
**hospitalización/UCI**, **farmacia y dinero del consultorio**, y **portal del
paciente + mensajería**. ~36 hallazgos con archivo:línea.

| v | Qué se reparó |
|---|---|
| **851** | **El paciente podía borrar el estado «pagada» de su cita con un toque.** El portal sólo bloqueaba los estados terminales: una cita `pagada` o `pendiente-pago` pasaba a «confirmada» desde el enlace, y salía del control de cobro. Igual con `en-sala`/`en-consulta`. Ahora es **lista blanca** —con lista negra, cada estado nuevo nace tocable— y una cita **con cobro** ya no se cancela ni se reagenda desde el portal. Confirmar sí: no mueve el hueco ni el dinero. |
| **852** | **Un anticipo saldaba una consulta que nadie había tasado.** Sin tarifa fijada, el checkout escribe el anticipo en `pagoMonto` y el webhook lo comparaba contra sí mismo: «cubre» → cita **pagada** → el resto no se reclamaba en ninguna pantalla. El comentario del propio webhook ya decía lo correcto y el código hacía lo contrario. El saldo queda en «no se sabe», no en cero. |

## QUINTA TANDA — v853 a v854 (dinero del consultorio)

| v | Qué se reparó |
|---|---|
| **853** | **El mismo médico con DOS identificadores partía la comisión en dos.** Desde Citas viajaba el id del documento de `doctors`; desde Consulta, el `uid`. El reparto agrupa por `medicoId`, así que la misma doctora salía en dos filas y media comisión se pagaba al 0 %. Se resuelve **en el origen** (`registrarCobro`), nunca adivinando: ante ambigüedad queda `sin-resolver` y se conserva lo que venía — atribuir mal se paga en silencio a quien no era. Los cobros anteriores siguen como estaban, y el panel **avisa** antes de pagar. |
| **854** | **Una consulta ya pagada aparecía como deuda.** El corte carga los cobros del DÍA, así que un anticipo pagado el viernes para la cita del lunes la dejaba en «cuentas por cobrar». Ahora manda `cita.cobroId`, que sólo escribe un cobro de cierre y se limpia al anular. |

## SEXTA TANDA — v855 a v856 (UCI y farmacia)

| v | Qué se reparó |
|---|---|
| **855** | **Un reingreso a terapia borraba la estancia anterior.** `ICUStay` vivía en un id fijo y reabrirlo lo sobreescribía, mientras el tipo prometía que «cada estancia se conserva». La que se cierra se **archiva** con id derivado de su fecha de ingreso —no aleatorio: una transacción se reintenta y con id al azar el historial diría que hubo un reingreso que nunca ocurrió—. `actual` sigue siendo el puntero a la vigente, así que ningún lector migró. Y **egresar también cierra la estancia**: antes sólo la cerraba el traslado a piso, así que quien fallecía o salía del hospital desde UCI la dejaba activa para siempre. |
| **856** | **Farmacia: tres contadores que mentían.** «Eliminar» no eliminaba nada visible (`soloActivos = false`). «Bajo stock: 0» con el anaquel vacío, porque exigía un mínimo capturado que el formulario deja en blanco. Y la caducidad se evaluaba en UTC: un lote que vence el 2 salía caducado desde las 18:00 del 1. |

## SÉPTIMA TANDA — v857 (el corte que cambiaba sin explicar)

| v | Qué se reparó |
|---|---|
| **857** | **Un corte reimpreso bajaba de total sin una sola nota.** Anular un cobro no tiene restricción de fecha —se anula el jueves uno del lunes— y la pantalla excluía los anulados: el corte del lunes reimpreso daba otro número y nadie podía saber qué cambió. Ahora se listan **aparte**, con motivo y fecha de anulación, sin entrar en ningún total. Y el KPI **«Reembolsos» estaba condenado a $0.00** (los negativos se rechazan en el origen y la devolución no existe como operación): ese cero se leía como «no hubo devoluciones». Ahora dice **«Anulados»**, que es lo que de verdad baja el día. Verificado en producción. |

## OCTAVA TANDA — v858 a v859 (farmacia y las promesas al paciente)

| v | Qué se reparó |
|---|---|
| **858** | **La farmacia deja de ser una isla sin memoria.** El libro de movimientos era de **sólo escritura** —`listarMovimientos` no lo llamaba ninguna pantalla— y ya se abre desde cada ítem. El `patientId` iba **siempre vacío** pese a que el módulo invoca la trazabilidad lote→paciente de la NOM-220: ahora la dispensación pide a qué paciente, y en un **controlado es obligatorio**. Y tirar un lote vencido era indistinguible de dispensarlo: se separan *dispensado / caducó / merma*. |
| **859** | **Tres promesas al paciente que el código no cumplía.** El recordatorio dice «Responde SÍ para confirmar» y **nada lo implementaba** (el bot contestaba el menú); ahora el envío deja la sesión esperando esa respuesta con la cita concreta, y va **antes** del detector de FAQ porque «sí, esa *hora* me sirve» se lo quedaba. «Responda NO y le quitamos de la lista» **no daba de baja a nadie**. Y quien recibía una oferta y no contestaba quedaba `contactado` y **no volvía a recibir ninguna nunca**. Además «Mis recetas» imprimía «Invalid Date» y Descargar lanzaba un error que el paciente no veía. |

## NOVENA TANDA — v860 (el enlace del paciente)

| v | Qué se reparó |
|---|---|
| **860** | **El enlace del portal no se podía revocar, y duraba 30 días.** Firmado y con fecha, no había forma de invalidar uno ya emitido: teléfono perdido, número reciclado o mensaje reenviado valían hasta caducar — y ese enlace da acceso a las citas del paciente (motivo incluido, que es texto clínico) y permite cancelar y reagendar. Ahora el expediente lleva un **contador de versión**: subirlo tumba de golpe todos los enlaces de ese paciente, desde un botón en su expediente. TTL de 30 → **7 días**, y el mensaje ya le advierte que es personal y caduca. Botón verificado en producción. |

## DÉCIMA TANDA — v861

| v | Qué se reparó |
|---|---|
| **861** | **«Pagar anticipo · Asegura tu lugar» no aseguraba nada**: abría un enlace externo suelto, sin retorno, sin webhook, sin cambio de estado y **sin cobro registrado** — y el importe del cartel podía no ser el que cobraba el enlace. La ruta que sí lo registra existía y **no la llamaba nadie**. **El aviso de lista de espera desde el modal iba sin `medicoId`**: el hueco liberado por una doctora se agendaba con otro médico. **La cama del alta no pasaba por limpieza terminal** —el bloque estaba condicionado al traslado— y contaba disponible en el mismo instante del alta. |

## UNDÉCIMA TANDA — v862 (lo que la UCI afirmaba sin saberlo)

| v | Qué se reparó |
|---|---|
| **862** | **Las tomas del pase se firmaban con el nombre del médico tratante** aunque las capturara otra persona —y en blanco si fallaba la lectura del internamiento—: el mismo defecto ya reparado en el MAR. Ahora el autor lo sella la sesión, con `uid`, y la hora del **servidor** va al lado de la del dispositivo. **La entrega de turno imprimía «No hay dispositivos invasivos registrados»** en un paciente con catéter y ventilador, porque esa sección no tiene quién la alimente: una sección declarada **sin fuente** ya dice que el sistema no lo sabe. **El turno de enfermería ocultaba pacientes** de una unidad sin tipo configurado y afirmaba que no había nada pendiente. |

## DUODÉCIMA TANDA — v863 (lo que el portal no le contaba a nadie)

| v | Qué se reparó |
|---|---|
| **863** | **Cancelar o reagendar desde el enlace del paciente mutaba el estado y ahí terminaba todo.** El hueco liberado **no se le ofrecía a nadie**: la oferta vivía dentro de `api/whatsapp/waitlist-notify`, detrás de `verificarMiembro`, así que sólo el consultorio podía dispararla — y justo la cancelación del paciente es la que nadie del equipo ve. Ahora vive en `src/lib/whatsapp/ofrecer-hueco.ts` y la llaman los dos caminos, con el `medicoId` (sin él, el hueco de una doctora se le ofrecía a quien espera con otro). **No quedaba asiento en la bitácora** aunque el estado se mutara con `updatedPor: 'paciente'` (NOM-024): ambas acciones escriben ya el de/a en `audit_log`. Y **fuera de la ventana de 24 h sin plantilla HSM** el mensaje se descartaba en silencio mientras el contador decía «notificados N»: ahora cuenta como omitido y se registra como no entregado con su motivo. |

## DECIMOTERCERA TANDA — v864 (lo que se perdía sin que nadie lo viera)

| v | Qué se reparó |
|---|---|
| **864** | **Un cobro suelto no era de nadie.** Abierto desde Finanzas no hay cita de la que sacar el médico y el modal tampoco preguntaba: el cobro caía en la fila «sin atribuir» del reparto de comisiones — dinero cobrado y depositado que al repartir no es de nadie, y que nadie reclama porque no aparece en la fila de ningún médico. Con un solo médico no se pregunta (es suyo); con varios se pregunta y es obligatorio, sin preseleccionar al primero de la lista (`lib/finanzas/cobro-suelto.ts`, 6 pruebas). **Cancelar desde el enlace no contaba como cancelación**: `cancelacionCount` alimenta el riesgo de no-show y el CRM, el menú de Citas sí lo incrementa y el portal no — el motor veía a un paciente impecable. **El alta pública le servía el error crudo a cualquiera**: `String(err)` con nombres de colecciones, rutas de documentos y mensajes del Admin SDK, a internet abierto y sin sesión. |

## DECIMOCUARTA TANDA — v865 (dos formas de perder una dosis sin que nadie lo note)

| v | Qué se reparó |
|---|---|
| **865** | **Una dosis registrada podía desaparecer del MAR.** El servidor guardaba el objeto del cliente entero (`{ ...p.adm }`) dentro del registro de administración, y `estado` sólo puede ser `administrado` u `omitido` — nadie lo comprobaba. El motor del MAR reparte las administraciones justo en esas dos cubetas: una dosis con otro estado no cae en ninguna, la enfermera la ve confirmada en pantalla y el pase de visita lee «sin administraciones» y un atraso que no ocurrió. Lista blanca + estado inválido RECHAZADO, no corregido a un valor por omisión (`lib/hospital/administracion-entrante.ts`, 5 pruebas); `cincoCorrectos` e `identidadVerificada` exigen un `true` explícito (la cadena `"no"` es truthy y pasaba como verificación hecha). **La tarjeta de UCI afirmaba lo que no pudo leer**: `catch(() => [])` en las tomas y `catch(() => null)` en la estancia hacían que dijera «sin ninguna toma registrada» y «no consta ningún soporte activo» de un paciente monitorizado y ventilado. El paciente sale igual —esconderlo sería peor— pero el fallo se declara (4 pruebas). |

## DECIMOQUINTA TANDA — v866 (el motor sin puerta de entrada)

| v | Qué se reparó |
|---|---|
| **866** | **El algoritmo de dosificación del Dr. no tenía puerta de entrada.** `lib/uci/dosificacion-critica.ts` —meropenem en el adulto crítico, dictado el 30 de julio— estaba escrito, probado y sin un solo llamador: el fallo que más veces se ha repetido en este repositorio. Ahora hay pestaña **«Dosis en crítico»** en el panel de UCI: CrCl, modalidad de reemplazo renal, MIC y criterios de alta exposición, y **las dos columnas** —convencional y alta exposición— sin marcar ninguna como la buena. Si falta el dato que decide la fila, no propone: dice qué falta. La pantalla no calcula nada; todo lo decide el motor puro, con sus avisos (en CRRT no se aplica el ajuste de falla renal; una resistencia verdadera no se vence subiendo la dosis; la preparación la fija la farmacia del hospital). Sale de `HUERFANOS_ACEPTADOS`. |

## DECIMOSEXTA TANDA — v867 (el número escrito dos veces)

| v | Qué se reparó |
|---|---|
| **867** | **El margen del MAR estaba escrito dos veces y donde el hospital no puede tocarlo.** `const GRACIA_MIN = 30` vivía en el MAR del paciente y otra vez en el turno de enfermería: dos pantallas que leen el mismo motor y le dicen a la misma enfermera si una dosis va atrasada. El propio motor declara (`FALTA_GRACIA`) que la gracia es una decisión **operativa de la unidad**, no un umbral clínico — y estaba clavada en el código. Un solo módulo (`lib/uci/gracia.ts`) con el valor de fábrica de siempre (30 min, sin cambiar nada en silencio) y `config.graciaMarMin` para la unidad; un valor imposible cae al de fábrica en vez de reventar el MAR o inventar un margen (4 pruebas). |

## DECIMOSÉPTIMA TANDA — v868 (la primera cama que no existía)

| v | Qué se reparó |
|---|---|
| **868** | **El ingreso no abría la asignación de cama.** El traslado y el egreso escribían en `bed_assignments`; el ingreso no — el mismo agujero que ya se reparó con la estancia de UCI, en la colección de al lado. La primera cama de cada episodio no existía en la historia, y el primer traslado anotaba «el episodio venía de antes de que existiera la historia de camas» de un paciente ingresado esa misma mañana: el historial empezaba en la **segunda** cama y `ocupantesDe` no veía a nadie en la primera. **Y esa historia no la leía nadie**: `historialCamas` y `ocupantesDe`, escritos y probados, sin un solo llamador. Al abrir el traslado se enseñan ya las camas del episodio con fechas y motivo (`getAsignacionesCama`). |

## DECIMOCTAVA TANDA — v869 (los campos que la estancia prometía y no existían)

| v | Qué se reparó |
|---|---|
| **869** | **`motivoIngresoUci` era obligatorio y no lo captura ninguna pantalla** — un campo obligatorio que jamás se llena sólo hace que el tipo mienta; pasa a opcional. **`codigoReanimacion` y `aislamiento` no tenían ni escritor ni lector**: en terapia intensiva eso no es inocuo — en cuanto una pantalla lo enseñe, un código de reanimación vacío se lee como «no hay limitación del esfuerzo terapéutico registrada», la afirmación que nadie hizo; se quitan hasta que exista la captura de verdad. **`createdAt`/`creadoPor` eran obligatorios y no los escribía nadie**: sólo constaba quién tocó la estancia por última vez, así que al cabo de un turno no quedaba rastro de quién decidió abrirla; se escriben ahora en las tres rutas que la abren, y sólo la primera vez. |

## DECIMONOVENA TANDA — v870 (la anual que se leía como otro plan)

| v | Qué se reparó |
|---|---|
| **870** | **La suscripción ANUAL se deducía como otro plan.** El webhook comparaba el importe cobrado contra una tabla de centavos **mensual**: la anual de un plan barato cae en el rango del mensual de uno caro — Agenda al año (349 000 ¢) se leía como **hospital**. Y desde que «manda el precio sobre el metadato» (v8xx, correcto para la baja hecha desde el portal de Stripe), esa deducción equivocada **pisa el metadato correcto**: quien paga Agenda al año se queda con Hospital, con módulos que no compró y la llave de IA cara del dueño. La selección del ítem del plan tampoco conocía los price ids anuales, así que en una anual podía caer en el asiento del médico extra. Nuevo `lib/finanzas/plan-de-suscripcion.ts` (puro, 7 pruebas): price id exacto → importe **sólo si es mensual** → metadato → no tocar el plan. |

## VIGÉSIMA TANDA — v871 (la solicitud ARCO que señalaba a un tercero)

| v | Qué se reparó |
|---|---|
| **871** | **Cualquiera desde internet podía señalar el expediente de un tercero para que se suprimiera.** El portal público de derechos ARCO crea la solicitud sin sesión —tiene que ser así—, pero las reglas no constreñían `patientId`, y el panel de Cumplimiento enseña «Ejecutar cancelación…» exactamente cuando la solicitud trae uno: una solicitud anónima con el `patientId` de un paciente real y un nombre plausible ponía la supresión de ese expediente a un clic, con la casilla de identidad como única barrera. Reglas: quien no es miembro no puede mandar `patientId`, debe declarar `origen: 'portal-publico'` y no puede declararse verificada a sí misma. El panel marca «Identidad sin verificar» y explica por qué no hay botón cuando no hay expediente ligado. **Reglas desplegadas aparte**; 101 specs del emulador en verde. |

## VIGESIMOPRIMERA TANDA — v872 (el color que no cambiaba de tema)

| v | Qué se reparó |
|---|---|
| **872** | **El color de la alerta clínica no cambiaba de tema.** Cuatro rojos y ocho ámbares escritos a mano en 55 pantallas; el problema no es la variedad sino que un hexadecimal no cambia de tema: `#f87171` es el rosa **para fondo oscuro** y sobre el crema del tema claro da 2.5:1 (AA pide 4.5). Y es el color del error bajo un campo de **dosis**, del atraso del MAR y de las alertas clínicas. 124 colores de primer plano migrados a `--red`/`--amber`, medidos en los dos temas. **Excepción deliberada**: las superficies que se imprimen conservan el hexadecimal (html2canvas clona el nodo y una variable sin resolver deja sin color el «[FALTA CÉDULA PROFESIONAL]»; y el papel fuerza tema claro). Queda un **trinquete** con techo 0 vigilado por prueba. |

## VIGESIMOSEGUNDA TANDA — v873 (la cita que se caía al suelo)

| v | Qué se reparó |
|---|---|
| **873** | **La cita de guía no llegaba a ninguno de los tres sitios donde se lee.** `Rec.fuente` existe —su comentario dice «para citarla en la nota»— y `lib/inmuno/farmacos.ts` la **exige** en sus 34 recomendaciones (ASH 2020, consenso IS ACCP/AST/ISHLT 2022, ACIP…). No la enseñaba ni el panel —que promete «con su cita de guía»—, ni el texto que se le dicta a la IA, ni el HTML del expediente: la nota salía con recomendaciones de profilaxis y cero atribución, con el dato guardado al lado. Ahora viaja a los tres, y donde no hay fuente **se dice** en vez de omitirla en silencio. Las 42 de `recomendaciones.ts` siguen sin cita: es trabajo clínico del Dr. —una cita inventada sería peor que ninguna— y quedan declaradas con una prueba que vigila que el número no suba. |

## VIGESIMOTERCERA TANDA — v874 (el fallo que ofrecía escribirle a quien pidió la baja)

| v | Qué se reparó |
|---|---|
| **874** | **Un fallo de lectura ofrecía escribirle a quien pidió la baja.** La pantalla de reactivación lee `whatsapp_optout` con `.catch(() => null)` y después `new Set((optSnap?.docs ?? []))`: un fallo de red, permisos o App Check daba el **mismo conjunto vacío** que un consultorio sin bajas — y con él la pantalla ofrecía «WhatsApp» sobre toda la base, incluida la gente que pidió que no se le escriba. El daño no es simétrico: el mensaje que no se mandó se manda mañana; el que se mandó a quien pidió la baja no se devuelve. Sin la lista, los contactos quedan **deshabilitados** y se dice por qué (`lib/whatsapp/puede-contactar.ts`, 5 pruebas). Las citas futuras no bloquean pero avisan. |

## VIGESIMOCUARTA TANDA — v875 (el calendario que no sabía de quién era)

| v | Qué se reparó |
|---|---|
| **875** | **El calendario de Google no sabía de qué médico era.** El token vive en `googleTokens/{uid}` y la agenda razona con `medicoId`: **no existía relación entre los dos**, y de ahí salen las dos cosas que hoy no funcionan — el portal público / el bot / el reagendado no consultan el freebusy (un paciente puede reservar encima de una cirugía apuntada en el calendario personal del médico), y la sincronización desde el portal quedó sin hacer a propósito. El único momento en que se sabe con certeza que un uid es de una persona concreta es cuando esa persona conecta su propio calendario: ahí se escribe el vínculo, por correo **exacto** y sólo si es inequívoco (`lib/calendario/vinculo-medico.ts`, 7 pruebas). Dos correos iguales o ninguno → vínculo **sin hacer y declarado**, y el médico se entera al volver. |

## VIGESIMOQUINTA TANDA — v876 (el paciente reservaba encima del calendario del médico)

| v | Qué se reparó |
|---|---|
| **876** | **El portal público no descontaba lo que el médico tiene en su Google Calendar.** El panel del consultorio sí lo consultaba; el camino que usa el paciente no, porque el token vive por `uid` y no se sabía de quién era el calendario — lo desbloqueó el vínculo de v875. Ahora la disponibilidad pública lo descuenta **y el alta lo vuelve a comprobar antes de escribir**: «no ofrecer» y «no aceptar» son distintas (una pestaña abierta desde antes mete la cita igual), y ese error ya se pagó una vez con el horario partido. Cautelas: sólo con `medicoId`; si Google falla se sigue como antes —ni se esconde el día ni se rechaza una cita real por un fallo de red—; y no viaja nada del evento, sólo el intervalo. |

## VIGESIMOSEXTA TANDA — v877 (el bot, y una sola consulta para los tres)

| v | Qué se reparó |
|---|---|
| **877** | **El bot de WhatsApp era el último camino que agendaba sin mirar el calendario del médico**: ofrecía —y aceptaba— la hora de una cirugía. Ahora lo carga junto con los bloqueos del consultorio, que es la función por la que pasan sus **tres** momentos (listar, revalidar al confirmar, buscar el próximo día), así que queda cubierto también el cuarto que se escriba mañana. **Excepción declarada**: la búsqueda del «próximo día disponible» recorre 14 días y no consulta Google —serían 14 llamadas dentro de un webhook que debe contestar rápido—; no abre agujero porque sólo propone días y al elegir uno se lista con Google y al confirmar se revalida. Y la consulta se sacó a **un** módulo (`lib/calendario/ocupado-servidor.ts`) que usan el portal, el alta pública y el bot: v876 la había dejado escrita dos veces, que es como empiezan las cinco implementaciones. |

## VIGESIMOSÉPTIMA TANDA — v878 (la videoconsulta a la que el paciente no podía llegar)

| v | Qué se reparó |
|---|---|
| **878** | **Se podía vender, agendar y cobrar una teleconsulta a la que el paciente no podía entrar.** Es un tipo de cita con su concepto de cobro y su precio, y el consultorio tiene «Unirse» en la lista de citas; en el portal del paciente `teleconsulta` era **sólo una etiqueta** en el mapa de tipos, y ni la confirmación ni los recordatorios llevan el enlace de la sala. Ahora «Mis citas» enseña **«Entrar a la videoconsulta»** dentro de la ventana, y fuera de ella dice por qué no («se abre 30 min antes» / «ya se cerró, llama al consultorio»). La ventana son los **mismos** 30 min / 2 h que el servidor aplica al crear la sala en Daily, ahora en un módulo probado (`lib/telesalud/ventana-sala.ts`, 6 pruebas); la hora es la del consultorio, no la del servidor. El enlace del paciente no lleva `dr=1`. |

## VIGESIMOCTAVA TANDA — v879 (a la videoconsulta se le mandaba la dirección)

| v | Qué se reparó |
|---|---|
| **879** | **A quien tenía videoconsulta se le mandaba la dirección del consultorio.** La confirmación y los dos recordatorios se escribieron cuando todas las citas eran presenciales y **nunca miraron el tipo**: al paciente de teleconsulta le llegaba «📍 Consultorio, Av. …» y «Te esperamos / Favor de acudir puntualmente», sin el enlace de la sala. En el mejor caso llama; en el peor conduce hasta allá y pierde su consulta. Pasaba en los tres mensajes de `lib/whatsapp` **y** en las plantillas del cron, que se mandan solas de madrugada sin que nadie las lea antes. Ahora el tipo decide (`lib/telesalud/donde-es.ts`, 7 pruebas): la teleconsulta lleva el enlace y no la dirección, y el cierre deja de ser «te esperamos». Sin URL base se dice que es videoconsulta en vez de callar. |

## VIGESIMONOVENA TANDA — v880 (el bot, que confirma solo)

| v | Qué se reparó |
|---|---|
| **880** | **El bot también mandaba al consultorio a quien pedía videoconsulta.** Ofrece «5️⃣ Teleconsulta» en su menú y luego imprimía consultorio y dirección en sus **tres** mensajes (resumen previo, «su cita ha sido registrada» y el de lista de espera), sin el enlace. Es el más caro de los tres caminos: el bot **confirma en el momento**, de madrugada, sin que nadie del consultorio lo lea antes. Ahora los tres usan el criterio por tipo de v879; en los dos de cita agendada el enlace se arma con el **id real** de la cita —que en el camino de lista de espera hubo que tomar antes de escribir, porque se creaba con un `doc()` anónimo—. |

## TRIGÉSIMA TANDA — v881 (la frase más natural para pedir cita no agendaba)

| v | Qué se reparó |
|---|---|
| **881** | **«Quiero agendar una consulta» nunca agendaba.** El bot detecta las preguntas frecuentes antes que nada y el patrón de PRECIO es `/costo|precio|cobr|cuanto|pag|consulta/`: la palabra **«consulta»** dispara la respuesta de precios. La frase más natural para pedir cita hacía que el bot contestara cuánto cuesta, enseñara el menú y no agendara nada — y desde fuera parecía que funcionaba, porque contestó rápido y con información correcta. Igual «necesito una consulta», «me gustaría agendar consulta». Y «quiero cancelar mi cita de mañana a las 10» caía en la FAQ de **horarios** por la palabra «hora». Ahora un verbo de acción gana al tema (`lib/whatsapp/intencion.ts`, 7 pruebas) y pedir cita arranca el alta desde cualquier estado de reposo. Sin verbo no cambia nada: «cuánto cuesta la consulta» sigue siendo precio. |

## TRIGÉSIMA PRIMERA TANDA — v882 (el menú ofrecía cancelar y no cancelaba)

| v | Qué se reparó |
|---|---|
| **882** | **«3️⃣ Cancelar cita» era una promesa sin nada detrás.** Contestaba «comuníquese al consultorio… también puede escribir su nombre completo y le ayudamos», y el estado siguiente **ignoraba lo que el paciente escribiera**: repetía el teléfono y volvía al menú. El paciente tecleaba su nombre completo —dato personal, a un canal externo— para nada, y su cita seguía viva: el día de la consulta contaba como no-show, con el lugar perdido y el paciente creyendo que había cancelado. El bot **sí sabía** cancelar (contestar «NO» a un recordatorio lo hace); faltaba encontrar la cita, y eso se hace por teléfono. Ahora busca, enseña la cita (o una lista), cancela con SÍ/NO, **respeta la política de cancelación** y no esconde la cita bloqueada. **Cuidado crítico**: en ese estado «SÍ» significaba «confirmo que asisto» — sin distinguir la pregunta, quien pedía cancelar acababa con la cita CONFIRMADA. Y la cancelación ya hace las tres cosas de v863. |

## TRIGÉSIMA SEGUNDA TANDA — v883 (el bot decía que abren a la hora de la comida)

| v | Qué se reparó |
|---|---|
| **883** | **El horario que contestaba el bot ignoraba los descansos.** Imprimía `inicio–fin` a secas: un consultorio de 9 a 14 y de 16 a 20 le decía al paciente «Lunes: 09:00–20:00» — o se presenta a una puerta cerrada, o intenta agendar a las 15:00 y la agenda no se lo ofrece, porque el motor de huecos **sí** respeta el descanso desde v829/v830. El sistema sabía la verdad y su propio bot decía otra cosa (`lib/whatsapp/horario-legible.ts`, 8 pruebas). **Segundo fallo**: `buildFAQReply` empezaba con «sin `botConfig`, contesta el teléfono» **para todo**, cuando el horario y la dirección salen de la configuración del consultorio, que siempre está llena. Un consultorio sin onboarding del bot tenía «Información» en el menú y el bot contestando el teléfono a todo. |

## TRIGÉSIMA TERCERA TANDA — v884 (datos de salud sin aviso de privacidad)

| v | Qué se reparó |
|---|---|
| **884** | **El bot recogía datos de salud sin aviso de privacidad.** El portal público **exige** el consentimiento (sin él la ruta responde 400) y lo guarda en la cita con su marca de tiempo; el bot creaba expediente y cita **sin aviso ninguno**. La misma aplicación que bloquea el alta web por falta de consentimiento la dejaba pasar por el canal por el que entra buena parte de los pacientes. Ahora, antes de pedir un solo dato, manda el aviso —responsable, finalidad, derechos ARCO y enlace al aviso completo— y pide un **sí expreso**; se guarda quién aceptó, cuándo, por qué canal y con qué versión (`lib/whatsapp/aviso-bot.ts`, 10 pruebas). Nunca se marca aceptado por no contestar, y a quien dice que no no se le insiste. |

## TRIGÉSIMA CUARTA TANDA — v885 (el aviso no llegaba al expediente)

| v | Qué se reparó |
|---|---|
| **885** | **El aviso del bot se quedaba en la cita y no llegaba al expediente.** v884 guardó el consentimiento en la cita, pero el portal público guarda **además** un sello en `patients/{id}.avisoPrivacidad` con versión, medio y **hash del texto** — y ése es el campo que lee el panel de Pacientes. El paciente de WhatsApp seguía apareciendo sin aviso en su expediente. Ahora el bot escribe el mismo sello con `medioAceptacion: 'whatsapp'`. La huella importa porque `versionAviso` es una constante del código pero el texto se genera en vivo con la razón social y el domicilio: si el médico los cambia, el aviso que verá el siguiente paciente **no** es el que aceptó éste. No se pisa un sello anterior: el primero es el que vale. |

## TRIGÉSIMA QUINTA TANDA — v886 (los números que el menú no tenía)

| v | Qué se reparó |
|---|---|
| **886** | **El menú de información prometía números que no existían — y llevaban al sitio equivocado.** Terminaba con «O responda con el número de su interés» sin listar ninguno, y como el estado seguía siendo `menu`, quien escribía «1» acababa en el **alta de cita** y «3» en cancelar: el paciente que quería saber el horario terminaba dando su nombre completo para agendar. Ahora los cinco temas están numerados, el menú tiene su propio estado y «0» vuelve. Además el estado del **aviso de privacidad** ya no se secuestra: si una pregunta frecuente contestaba encima, el paciente acababa dando sus datos sin haber contestado si acepta. |

## TRIGÉSIMA SEXTA TANDA — v887 (el contacto que nadie sabía que debía hacer)

| v | Qué se reparó |
|---|---|
| **887** | **El portal público no le avisaba a nadie del consultorio.** Le contesta al paciente «Te contactaremos para confirmar» y la cita se queda en `solicitada`: si la asistente no recarga la agenda —o mira sólo las confirmadas— el paciente espera una llamada que no va a llegar y el consultorio pierde la cita sin enterarse de que la tuvo. El bot **sí** manda su «🔔 Nueva cita»: dos caminos, dos criterios. Lo mismo con la cancelación desde el enlace (v863 dejó bitácora y oferta del hueco, pero ningún aviso). Ahora los dos avisan por el mismo helper, el fallo queda **registrado** como no entregado, y ninguno espera al aviso — la respuesta al paciente ya salió. |

## TRIGÉSIMA SÉPTIMA TANDA — v888 (mover una cita en silencio es peor que cancelarla)

| v | Qué se reparó |
|---|---|
| **888** | **Reagendar desde el portal seguía sin avisarle a nadie.** v887 cubrió altas y cancelaciones; mover la cita no. Y aquí importa más: la cita **no desapareció, se movió** — quien tenga la lista del día sigue esperando al paciente a la hora vieja, y a la hora nueva le llega alguien que «no estaba». La cancelación deja un hueco visible; un reagendado silencioso deja **dos** errores. Además vuelve a `pendiente-confirmar` y nadie sabía que había que confirmarla otra vez. **Segundo**: una teleconsulta no tiene lugar físico y el portal imprime «Teleconsulta · {lugar}» — el alta pública y el bot escribían ahí el nombre del consultorio, enseñándole a dónde ir a quien no tiene que ir. |

## TRIGÉSIMA OCTAVA TANDA — v889 (P-019: el formulario previo a la consulta)

| v | Qué se reparó |
|---|---|
| **889** | **P-019 del charter — la última pieza del portal que faltaba en la fase 3.** Desde su enlace, el paciente llena con calma lo que hoy el médico reconstruye a las prisas: qué le pasa, desde cuándo, qué toma, a qué es alérgico. **La regla que lo hace seguro: lo que dice el paciente NO pisa el expediente** — si escribiera en `patient.alergias`, un «no» suyo borraría una alergia a penicilina documentada, y de ese campo dependen la compuerta de la receta y el cruce de la nota. Tampoco puntúa ni calcula nada: es una declaración, no una valoración. Las reglas cierran la escritura desde el navegador y la lectura es `isMedico` (lo cazó el guardián de la matriz cuando lo puse en `isMember`). La consulta lo enseña separado y declarado. **Reglas desplegadas aparte.** |

## TRIGÉSIMA NOVENA TANDA — v890 (el criterio que nadie podía consultar)

| v | Qué se reparó |
|---|---|
| **890** | **La CSP lleva meses sin proteger nada y el criterio para activarla no se podía consultar.** La política va en *report-only*: el navegador avisa y no bloquea. Pasarla a bloqueo es una variable (`CSP_MODE=enforce`) y el criterio estaba escrito y probado —7 días y cero violaciones recientes— pero **nadie leía los reportes**: se acumulaban en `platform_csp` sin una sola pantalla que dijera cuántos días llevan ni cuántas violaciones hay. Ahora Cumplimiento enseña el veredicto, los días, las violaciones y **qué** chocaría, para arreglarlo en vez de sólo esperar. **Cero reportes no se lee como «todo bien»**: puede ser que el buzón no reciba. Cierra un punto de **P-020**. |

## CUADRAGÉSIMA TANDA — v891 (adaptador de dispositivos: fases 6-12)

| v | Qué se reparó |
|---|---|
| **891** | **Los signos vitales ya pueden llegar del monitor.** Era la **única** pieza de las fases 6-12 que de verdad no existía — las otras seis las verifiqué una por una antes de escribir nada. Casi todos los monitores hablan HL7 y mandan un `OBX` por parámetro; el convertidor sólo devolvía FHIR genérico. Cuatro reglas, cada una contra un dato falso: la **unidad no se adivina** (98.6 °F leído como °C es 37 y NEWS2 puntúa con eso), la **hora es la del aparato**, la **presión sólo entra completa**, y **nada se completa ni se promedia** —un valor no numérico no se fuerza a cero, porque un cero inventado en una frecuencia cardiaca es un paro que no ocurrió—. Lo que llega del monitor va marcado con su fuente. |

## CUADRAGÉSIMA PRIMERA TANDA — v892 (P-006: «manual» significa «lo escribió el médico»)

| v | Qué se reparó |
|---|---|
| **892** | **El sello de procedencia metía a la máquina y al médico en la misma casilla.** Sólo tenía tres orígenes y todo lo que no venía de la extracción caía en `manual` — que significa literalmente «lo escribió el médico». Con el adaptador de v891 ya entran signos de monitor: sellarlos así afirmaría que el médico tecleó una frecuencia cardiaca que midió un aparato. Ahora hay `calculado` e `importado`, con su propio icono, y un **puente** entre la `fuente` de una toma y el sello de la nota: una fuente desconocida **no** se degrada a `manual`, devuelve `null` — inventar un autor es peor que no tener uno. Cierra **P-006**. |

## CUADRAGÉSIMA SEGUNDA TANDA — v893 (el monitor llega a la ficha)

| v | Qué se reparó |
|---|---|
| **893** | **El adaptador convertía y ahí se quedaba.** La ruta lo dice sin rodeos: «NO almacena nada» — el clínico veía un JSON y seguía tecleando los signos a mano. Ahora la ficha del episodio tiene **«Importar del monitor»**: se pega el HL7, se enseña qué se reconoció **y qué se descartó con su motivo** —si sólo se enseñara lo bueno, creería que se importó todo— y **una persona confirma** antes de escribir. Se guarda con **la hora del aparato** y marcado como venido de un dispositivo, que v892 traduce a `importado`. |

## CUADRAGÉSIMA TERCERA TANDA — v894 (§36: «siempre revisado por médico»)

| v | Qué se reparó |
|---|---|
| **894** | **El charter exige que la entrega de turno la revise un médico, y no había forma de revisarla.** El tipo lo hace imposible de saltar —un handoff nace BORRADOR y sólo `marcarRevisado()` lo cambia— pero **esa función no tenía un solo llamador**: la entrega nacía y moría en borrador, y la cabecera decía «sin revisar» para siempre. Una etiqueta que nunca cambia deja de significar algo, y ésta le dice al turno que llega si alguien leyó esto — el handoff es el documento que se lee cuando el que conoce al paciente **ya se fue**. Ahora hay «Lo revisé y lo entrego», con nombre y hora. La revisión se guarda **aparte** del handoff, que se recalcula en cada carga: dentro, desaparecería al llegar una toma nueva. **Reglas desplegadas aparte.** |

## CUADRAGÉSIMA CUARTA TANDA — v895 (§16: el peso con el que se dosifica)

| v | Qué se reparó |
|---|---|
| **895** | **Dos pantallas del mismo paciente podían dosificar con pesos distintos.** El charter §16 exige un peso fijado a propósito y con su autor; el campo estaba modelado en `ICUStay` con valor, tipo, autor y hora — **y no lo escribía nadie**. Cada calculadora pedía el suyo (infusiones `infPeso`, CKRT `ckrtPeso`, e infusiones caía a la de CKRT): se tecleaba 70 en una y 80 en la otra y ambas enseñaban un número plausible. En µg/kg/min, 14 % de diferencia en el peso es 14 % en la dosis. Ahora hay uno solo por estancia, con autor sellado por el **servidor**, y las calculadoras lo usan por debajo de lo que se teclee en ellas. **No** se toma del peso de la nota: ése cambia y movería todas las dosis sin que nadie lo pidiera. |

## CUADRAGÉSIMA QUINTA TANDA — v896 (§31: la talla y el volumen protector)

| v | Qué se reparó |
|---|---|
| **896** | **La talla también se re-tecleaba en cada pantalla.** Mismo hallazgo que v895 en el dato de al lado: `ICUStay.tallaCm` está declarado «para calcular PBW y VT/PBW (§31)» y no lo escribía nadie. Y la talla de un adulto **no cambia** durante la estancia: re-teclearla en cada pase es re-arriesgar el mismo número cada vez. De ella sale el peso predicho (ARDSNet/Devine, ya en el código) y de ahí el **VT/PBW**, la meta de ventilación protectora — un dedazo de 10 cm mueve el peso predicho unos 9 kg. Ahora se fija una vez y el motor la usa por debajo de lo que se teclee. Sin talla fijada no se inventa ninguna. |

## CUADRAGÉSIMA SEXTA TANDA — v897 (fallo mío de v893)

| v | Qué se reparó |
|---|---|
| **897** | **Los signos importados del monitor entraban sin disparar la alerta de deterioro.** Registrar signos a mano calcula NEWS2 y avisa al médico tratante si hay riesgo alto o parámetro en rojo; los importados en v893 no hacían nada de eso. Un paciente que se deteriora podía quedar registrado sin que nadie se enterara — y son justo los signos que llegan **sin que una persona los mire**. Un canal nuevo que se salta la alerta del viejo da sensación de cobertura sin darla. Ahora pasa por el mismo motor y la misma alerta, con el título diciendo que viene del monitor. Lo que el monitor no manda (conciencia, O₂) **no se inventa**. |

## CUADRAGÉSIMA SÉPTIMA TANDA — v898 (segundo fallo mío del día)

| v | Qué se reparó |
|---|---|
| **898** | **El formulario previo llegaba y nadie se enteraba.** v887 hizo que el consultorio supiera de las citas y cancelaciones del portal, y **v889 volvió a abrir el hueco** con el formulario. El paciente lo llena la noche antes y el médico sólo lo ve si abre la consulta y mira la tarjeta — uno que dice «soy alérgico a la penicilina» merece saberse **antes** de tenerlo enfrente. Ahora avisa por el mismo helper. **No viaja el contenido**: son datos de salud por un canal externo; el aviso dice que llegó y de quién, lo demás se lee en el expediente. Encontrado revisando mi propio trabajo del día. |

## LO QUE ENCONTRARON LOS AUDITORES Y NO ESTÁ REPARADO

Por orden de daño. Todo con archivo:línea, verificable.

### Dinero
1. ~~Dos identificadores de médico~~ — HECHO (v853). Queda pendiente decidir si
   se **migran los cobros viejos**: hoy el panel los señala, pero no los une.
2. ~~Consultas pagadas como cuentas por cobrar~~ — HECHO (v854).
3. ~~Anular reescribe un corte cerrado sin nota~~ — HECHO (v857).
4. ~~«Reembolsos $0.00»~~ — HECHO (v857): ahora dice «Anulados».
5. ~~Un cobro suelto no tiene médico~~ — HECHO (v864): el modal pregunta cuando
   hay más de un médico. **Queda**: los cobros VIEJOS sin atribuir siguen sin
   atribuir; unirlos es una decisión contable del Dr.

### Farmacia
6. ~~«Eliminar» no elimina nada visible~~ — HECHO (v856).
7. ~~«Bajo stock: 0» con el anaquel vacío~~ — HECHO (v856).
8. ~~La farmacia es una isla~~ — HECHO A MEDIAS (v858): el libro ya se lee y la
   dispensación ya dice a quién. **Queda**: dispensar desde la CONSULTA no
   descuenta inventario ni genera cobro — sigue siendo una captura aparte.
9. ~~Caducidad evaluada en UTC~~ — HECHO (v856).

### Hospital / UCI
0. ~~`bed_assignments` no se abre al ingresar; `historialCamas`/`ocupantesDe` sin
   lectores~~ — HECHO (v868).
10. ~~Un reingreso borra la estancia anterior~~ — HECHO (v855), junto con el
    cierre de la estancia al egresar (punto 10 del informe de UCI).
11. ~~La limpieza terminal no se aplica al egreso~~ — HECHO (v861).
12. ~~El turno de enfermería oculta pacientes~~ — HECHO (v862).
13. ~~Las tomas de UCI se firman con el médico tratante~~ — HECHO (v862).
14. ~~La entrega de turno afirma ausencias~~ — HECHO (v862 + **v894**): ya no
    afirma lo que no sabe, y la revisión del charter §36 tiene por fin su
    puerta — con nombre, hora y persistencia aparte del handoff recalculado.

### Portal y mensajería
15. ~~El enlace mágico no se puede revocar~~ — HECHO (v860).
16. ~~El recordatorio promete «Responde SÍ»~~ — HECHO (v859).
17. ~~Lista de espera: el NO no daba de baja y el silencio desterraba~~ — HECHO (v859).
18. ~~El detector de FAQ secuestra las confirmaciones~~ — HECHO (v859).
19. ~~«Mis recetas» imprime "Invalid Date"~~ — HECHO (v859).
20. ~~«Pagar anticipo» no aseguraba nada~~ — HECHO (v861).
21. ~~Aviso de lista de espera sin `medicoId`~~ — HECHO (v861).
22. ~~Cancelar/reagendar desde el portal no ofrece el hueco, no avisa y no deja
    rastro~~ — HECHO (v863) **y el aviso al consultorio en v887**, por WhatsApp,
    con el fallo registrado si no sale.

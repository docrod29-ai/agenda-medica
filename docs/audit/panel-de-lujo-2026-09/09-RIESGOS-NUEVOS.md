# 09 · Riesgos nuevos — Fase 4, oficial de seguridad del paciente

Fecha: 2026-09-06 · Lote 1 (médicos, ingeniería, seguridad, diseño, negocio).
Autor: oficial de seguridad del paciente del Panel de Lujo.

**Esto no repara nada.** Clasifica: qué puede salir mal, a quién daña, con qué
gravedad, con qué frecuencia, qué lo detiene HOY, qué queda después, y si eso
se puede liberar. El riesgo residual crítico **no lo acepto yo**: §3.

Escala de severidad, igual que en `agent-state/RISK_REGISTER.md`: 1 (molestia) …
5 (daño grave). Para los peligros que no dañan al paciente (dinero, legal,
privacidad) uso la misma escala sobre el daño institucional y **digo a quién
daña** en la tabla de detalle, para no inflar la columna clínica.

Dos criterios que gobiernan la columna «Control actual»:

- **Un control que nadie ejecuta no es un control.** Un panel que hay que abrir,
  una pantalla de cumplimiento a la que hay que ir, un aviso que sólo aparece
  cuando el pago ya falló: eso se registra como control **parcial** o **nulo**.
- **Un control que sólo vive en un prompt no es un mecanismo.** Prompt contra
  prompt no es una compuerta.

---

## 1. Filas listas para `agent-state/RISK_REGISTER.md`

Numeradas desde el siguiente libre (el registro llega a R-08). **No he tocado
`RISK_REGISTER.md`**: estas filas se pegan cuando el dueño las lea.

| # | Peligro | Sev | Control actual | Riesgo residual | Estado |
|---|---|---|---|---|---|
| R-09 | La receta impresa por omisión **afirma** «ALERGIAS: Negadas / no referidas» cuando nadie preguntó, y lee el campo libre en vez del estructurado; la carta de referencia repite la frase (MI-002) | 4 | Ninguno en este camino: `HojaCustom` y el `.doc` ya están corregidos, el renderizador por omisión no; el guardián `alergias-impreso-fuente.test.ts:66` tiene punto ciego demostrado (el `\|\| '…'` esquiva su regex) | **Alto**: quien dispensa lee una negación clínica que ningún médico hizo, en el documento firmado con cédula. Reproducido (REP-010, 3 fallos) | Nuevo · no liberable |
| R-10 | El cruce alergia↔fármaco no salta por **clase**: «cefalosporinas» + ceftriaxona → cero alertas, ni en la receta ni en la compuerta de firma (MI-004) | 5 | Parcial: el copiloto de la consulta sí lo ve — si el médico abre el panel y lo lee antes de firmar. La compuerta que gatea la firma usa el vocabulario débil | **Alto**: dos vocabularios sobre la misma entidad clínica y el peor es el que imprime. Reproducido con el motor real (`validarAlergiasVsMedicamentos` → `[]`) | Nuevo · no liberable |
| R-11 | Al revés: «betametasona» o «betabloqueadores» se leen como betalactámicos y **bloquean la firma sin vía de paso**; la única salida es borrar la alergia del expediente (MI-005) | 4 | Ninguno: no existe paso por encima con justificación escrita, que es lo que `clasificacion.ts:76-82` describe como conducta correcta | **Alto**: se pierden a la vez el dato de alergia y la compuerta; y es fatiga de alerta de la peor clase (R-02). Reproducido (REP-012) | Nuevo · no liberable; choca con D-033 |
| R-12 | Un rol no clínico (recepción) **lee y escribe** las alergias de las que dependen la receta y la nota (S-002) | 4 | Parcial: REG-323 impide el borrado accidental desde la interfaz (`campos-que-se-guardan.ts:115`). La lectura por `isMember` y la escritura deliberada por consola siguen abiertas; la subcolección `clinico` existe y **no tiene un solo escritor en producción** | **Alto**: aceptación E0-06 declarada incumplida por escrito en el propio repositorio; dato sensible LFPDPPP bajo un rol fuera del secreto médico. Reproducido en emulador y en REP-014 | Nuevo · no liberable sin decisión del dueño |
| R-13 | **P0** · Se firma, imprime y libera al cuidador «Amoxicilina 5 mL c/8 h» **sin concentración**: no hay campo, «5 mL» pasa la compuerta de unidad como completa y el verificador de dosis se salta el renglón (MP-005) | 5 | Ninguno en código. El propio `dosis.ts:429` lo reconoce como «otro problema». Queda el farmacéutico | **Alto**: el cuidador con otro frasco da una fracción o un múltiplo y **el papel es internamente consistente**, así que nadie lo puede detectar. Reproducido de punta a punta (REP-001, 4 fallos, incluido el paquete del paciente) | Nuevo · **no liberable** |
| R-14 | La red de dosis pediátrica de la receta está ciega: 20 de 25 fármacos sin techo (MP-004), la contraindicación por edad sólo vive en el panel (MP-016) y el neonato no tiene edad máxima, así que su pauta se ofrece a cualquier niño y dispara falsas críticas (MP-003) | 5 | Parcial y en el sitio equivocado: el panel pediátrico calcula bien, pero **el panel no vigila lo que el médico escribe**; el copiloto sólo corre en consulta y llama al motor **sin edad** | **Alto**: «Prednisona 500 mg», «Ondansetrón 80 mg» y «Ibuprofeno a un lactante de 3 meses» pasan sin un aviso. REG-043 sigue OPEN desde julio. Ausencia de alerta se lee como dosis segura | Nuevo · no liberable (agrava REG-043) |
| R-15 | El peso que alimenta la verificación mg/kg entra por tres puertas y sólo una tiene el hard-stop kg/lb de REG-013; y la comparación «contra el peso previo» se hace contra el peso de hoy, así que **nunca puede disparar** (MP-006) | 4 | Parcial: `revisarPesoPediatrico` tiene **un** llamador de aplicación (`PanelPediatria.tsx:48`); tope absoluto >10 g en `dosis.ts:183` | **Alto**: un error ×2.2 invierte la red mg/kg en el paciente más frágil. REG-106 afirma «cableada» y lo está en una de tres | Nuevo · no liberable |
| R-16 | El aviso renal depende de la pantalla: en la receta el ajuste sólo mira los fármacos **de hoy** (MI-001) y usa **otro catálogo y otra escala** que el copiloto (MI-014) | 4 | Parcial: copiloto de la consulta, si se abre antes de firmar y no se receta después. En la receta, nada para lo vigente | **Alto**: metformina con CrCl<30 y AINE en ERC avanzada impresos sin aviso, con avisos de interacción sobre el mismo fármaco al lado (que se leen como «el riñón ya se revisó»). Reproducido (REP-011, REP-013) | Nuevo · no liberable; rompe el invariante de fuente única |
| R-17 | En un producto combinado el motor lee el número equivocado: «Paracetamol/tramadol 325/37.5 mg» se contabiliza como 37.5 mg de paracetamol (MI-006) | 4 | Ninguno: `revisarUnidadDosis` no se queja porque hay cifra y unidad; `terapia-duplicada.ts:163` declara sus límites y **éste no está dentro** | **Medio-alto**: el techo hepatotóxico se calcula bajo, y el aviso enseña una cifra falsa con dos decimales — la forma más creíble de estar equivocado. Las combinaciones fijas son media consulta de internista en México | Nuevo · no liberable sin declararlo |
| R-18 | **El embarazo y la lactancia no son un estado del paciente**: la única fuente es una regex sobre el texto del Dx (MG-001), la receta nunca consulta la tabla gestacional (MG-002), la columna `lactancia` no la lee ningún motor (MG-003) y sin edad, sin sexo o con >50 años el aviso se apaga en silencio (MG-004) | 4 | Parcial y por accidente feliz: los `contraindicado` avisan a toda mujer de 12-50 en condicional (REG-364/365), y REG-524 pinta el aviso de edad desconocida donde se imprime. La clase `evitar` y toda la lactancia se pierden | **Alto**: «amenorrea de 8 semanas, prueba positiva» no enciende nada; la paciente peor documentada es la que se queda sin la alerta más grave (regla 4 al pie de la letra) | Nuevo · requiere decisión del dueño (modelo del paciente) |
| R-19 | Dos teratógenos mayores pasan por una letra: «valproato de magnesio», «divalproato» y «metotrexate» no casan con la tabla (MG-006) | 5 | Ninguno para esas dos entradas | **Alto**: es la presentación mexicana habitual. Reproducido (REP-018, 5 fallos). Mismo tipo de defecto que el P0 ya cerrado en la auditoría 2026-07 para las clases con `sinonimos` | Nuevo · no liberable (una línea) |
| R-20 | La IA del paciente contesta donde debía escalar: «estoy dando pecho» / «le doy leche a mi bebé» → responde desde el plan (MG-014); «no siento al bebé», «se me rompió la fuente», «veo lucecitas» → escalación ordinaria, no urgencia (MG-013) | 4 | Parcial: la franja de urgencia con 911 está siempre arriba; el embarazo dicho con esa palabra sí escala; el portal cita el plan y nunca inventa | **Alto** en lo suyo: un patrón de ACTOS_PROHIBIDOS que no casa **no cae a escalación, cae al paso 4 y contesta** — eso refuta el invariante que el módulo se atribuye. Reproducido (REP-019). Y el portal no le dice a la embarazada qué no vigila | Nuevo · no liberable |
| R-21 | El producto **no distingue en pantalla lo validado de lo pendiente**: `SelloMotor` se importa y no se renderiza en ningún sitio (MI-003), la profilaxis quirúrgica sin fuente se agrega a la nota sin sello (MC-005), la tabla de embarazo tampoco lo dice (MG-007) y el registro declara puertas de entrada que nadie llama (A-002) | 4 | Sólo declarativo y lejos: `/cumplimiento/motores` lista los 23 pendientes — hay que ir a buscarla, no llega al momento de decidir. La pantalla **afirma** que sale «una etiqueta ámbar junto al dato» y eso no ocurre | **Alto**: 23 motores sin validar en el camino de la receta, indistinguibles de los 6 validados. Reproducido (REP-020). Una afirmación falsa **dentro del módulo de cumplimiento** es peor que no tenerlo | Nuevo · escala R-08; requiere al dueño |
| R-22 | El modelo de lenguaje calcula y asume donde hay motor determinista: el prompt del consultor **ordena** «ajústala» por función renal/peso (B-001) y el de preoperatoria ordena **asumir** un punto de Caprini a partir de una cirugía mencionada de pasada (MC-001) | 4 | Prompt contra prompt: otra frase del mismo prompt prohíbe inventar la cifra base. La casilla de Caprini es visible y editable, pero **nada marca que la marcó la IA** | **Alto**: la prosa entra a la nota como sección y la compuerta de firma sólo mira los medicamentos estructurados; un punto de Caprini mueve de «sin profilaxis» a mecánica y de mecánica a farmacológica. Reproducido (REP-015, REP-016) | Nuevo · no liberable (regla 2) |
| R-23 | La valla anti-inyección se cierra desde dentro (basta que el texto contenga el delimitador) y en `verificar-nota` la nota entera viaja **fuera** de la valla (B-005 + hallazgo del equipo rojo) | 4 | `GUARDA_INYECCION` es una instrucción, no un mecanismo; deja de aplicar en cuanto el texto parece estar fuera del bloque | **Medio**: el objetivo barato no es cambiar la nota, es **apagar al revisor** que atrapa la dosis peligrosa. Probabilidad baja por voz, real por texto tecleado o por POST de un clínico del mismo consultorio | Nuevo · liberable con vigilancia, no sin arreglo del hueco de `verificar-nota` |
| R-24 | Un dictado **no** se archiva por tener otro expediente abierto; un laboratorio sí (B-013) | 5 | La cabecera enseña el nombre del paciente. Nada compara ese nombre con lo dictado. `paciente-equivocado-guardia.test.ts` cubre cita→expediente, no dictado→expediente | **Medio-alto**: la consulta de una persona archivada en el expediente de otra, arrastrada a todas las notas siguientes. Probabilidad baja-media (exige que se diga el nombre en voz alta) pero daño máximo y difícil de deshacer | Nuevo · no liberable como asimetría |
| R-25 | El lado del cuerpo no está garantizado en ninguna parte del camino: lo decide el modelo sin cotejo determinista contra el dictado (MO-001), la compuerta de ambigüedad sólo pregunta si **el corrector** cambió la lateralidad (MO-002), y la orden de imagen es texto libre sin campo de lado ni proyección (MO-003) | 5 | Parcial y probabilístico: `safety.conflicts_detected` sí se pinta antes de firmar; procedencia y pulsar-para-oír existen pero **exigen que el médico sospeche**; la vista previa enseña lo que se va a imprimir | **Alto**: radiografía, inmovilización o referencia del lado sano. Un caso basta para perder el nicho quirúrgico; el motivo `lateralidad_incierta` existe y casi nunca se emite | Nuevo · el residual lo acepta el dueño |
| R-26 | Se imprime y desaparece: la carta de referencia no se guarda en ninguna colección ni deja bitácora (MC-004), lo elegido en la pantalla de orden no vuelve a la nota (MO-005) y los estudios dictados nunca llegan a `estudiosOrden` (MO-004) | 4 | Parcial: tarea `estudio_pendiente`, evento de auditoría truncado a 40 nombres, y el botón «Orden» en la nota firmada. Para la referencia, **ninguno — ni `logAudit`** | **Alto en trazabilidad**: la NOM exige conservar la interconsulta y aquí no existe después de imprimirse; ningún respaldo puede restaurar lo que nunca se escribió (toca R-07). Reproducido (REP-017) | Nuevo · no liberable la referencia; el resto, producto |
| R-27 | El consentimiento informado se imprime **sólo con la firma del médico**: sin línea para el paciente, testigos, fecha de otorgamiento ni huella del texto aceptado (MC-003) | 4 | El médico puede añadir renglones a mano en papel; `declaracion` es obligatoria pero es prosa | **Alto (medicolegal)**: el documento que debía proteger al paciente no lo protege, y un perito lo lee como inexistente. Además los riesgos los redacta el modelo y el sistema no distingue qué vino del dictado | Nuevo · requiere revisión legal del dueño |
| R-28 | Las indicaciones postoperatorias (herida, drenajes, **signos de alarma**) no llegan a la hoja del paciente ni al portal; y el paso de cierre se marca hecho al copiar (MC-002) | 4 | Parcial: la nota impresa sí pinta `planPostop` si el paciente se lleva la nota. La hoja en lenguaje llano y el paquete del portal, no | **Medio-alto**: el paciente se va sin los signos de alarma, y el médico cree que el paso está hecho. Familia «escrito y sin conectar» (`indicacionesDelMedico` sin llamadores) | Nuevo · no liberable para el paquete quirúrgico |
| R-29 | Las correcciones automáticas de cifras, unidades, siglas y fármacos se aplican al dictado **sin que el médico pueda verlas ni deshacerlas** (D-001) | 4 | Parcial: el guardián revierte cambio de unidad/dosis/corrimiento decimal y escala a la caja ámbar; `AlertasDictado` enseña **lo que NO se aplicó**. Lo aplicado «como seguro» es invisible | **Medio-alto**: es la regla 3 de seguridad clínica y el principio REVERSIBILIDAD que el producto vende como diferencial, incumplidos en la pantalla principal. No hay acta del dueño que lo justifique (no existe fila GP4/GP12) | Nuevo · liberable sólo si el dueño lo decide y lo firma |
| R-30 | La misma Lp(a) se pinta dos veces en la misma tarjeta con bandas distintas, y el párrafo con botón «agregar a la nota» es el menos conservador (A-001) | 3 | Ninguno: cada función tiene su golden y **ambos pasan**; ninguna prueba compara una contra la otra | **Medio**: el equipo rojo refutó «cortes contradictorios» (ambas usan 125 nmol/L); lo que queda es **duplicación de fuente de verdad** y dos frases que el médico no sabe jerarquizar. Bajo la severidad de 4 a 3 por esa refutación | Nuevo · liberable con nota; el invariante no |
| R-31 | Cualquier miembro del consultorio puede **deshacer desde el navegador** un bloqueo ARCO ya ejercido y resucitar los enlaces del portal revocados, sin dejar rastro (S-001) | 4 | La ejecución del derecho sí pasa por servidor y deja asiento; **nada impide la reversión desde el cliente**. La baja de WhatsApp sí está protegida (`allow write: if false`) | **Medio**: probabilidad baja (exige intención), daño alto y demostrable ante el INAI: un control que se puede revertir sin rastro no es un control. Reproducido en emulador con las reglas reales del repositorio | Nuevo · no liberable |
| R-32 | La llave viva de WhatsApp del consultorio se usa como **nombre** de un documento de plataforma, justo lo que el gestor de secretos existe para evitar (S-004) | 4 | `whatsapp_channels` cae en el deny total, así que el cliente no la lee; el token ya no vive en el documento raíz | **Medio-bajo**: el atacante ya tiene que estar en la consola o en los registros de Cloud — pero ahí la llave está en claro, en el nombre del recurso y en toda exportación. Con ella se suplanta el número verificado por el que viaja el magic-link del paciente | Nuevo · liberable con rotación; sin rotación, no |
| R-33 | **P0** · El anticipo del paciente cae en la cuenta de Stripe de la plataforma y se asienta como ingreso del consultorio (N-002); y la pantalla le pide al médico su liga de MercadoPago, que sólo se usa cuando el pago falla (N-003) | 5 | Ninguno. Cero resultados de `transfer_data\|on_behalf_of\|stripeAccount\|payout\|liquidac` en todo `src/`. Sólo lo frena que la función exija configurar el anticipo | **Alto**: retención de fondos de terceros sin contrato de intermediación ni liquidación — problema regulatorio antes que contable, que crece con cada consultorio; y el corte de caja reporta dinero que el médico no tiene. Reproducido (REP-003) | Nuevo · **sólo el dueño** |
| R-34 | **P0** · Cambiar de plan cancela la suscripción anual **sin abono**: el médico pierde los meses pagados y no queda constancia en ninguna parte (N-001) | 4 | Ninguno. El portal de Stripe sí prorratearía, pero la pantalla empuja al botón que abre un checkout nuevo | **Alto**: pago doble del mismo periodo, descubierto en el estado de cuenta y no en la aplicación; es el motivo de contracargo más caro para un SaaS. Reproducido (REP-002) | Nuevo · no liberable |
| R-35 | Promesas públicas sin nada detrás: «los primeros 50 médicos congelan su tarifa de por vida» no tiene contador, cupón ni marca (N-004), y «te avisamos tres días antes» de que acabe la prueba no existe — **no hay ningún canal de correo en el repositorio** (N-005) | 3 | El banner en rojo con ≤3 días, que **sólo lo ve quien entra**; `allow_promotion_codes: true`, que permite escribir un código que nadie creó | **Medio**: se rompe una promesa en el segundo exacto del pago, y contradice la propia portada («lo que publicamos… es una oferta real»). Al médico sin correo verificado tampoco le llegaría (choca con N-2) | Nuevo · retirar la frase o construirla: decide el dueño |

### Detalle de clasificación (lo que no cabe en el formato del registro)

| # | Hallazgos | A quién daña | Prob. | Por qué esa probabilidad | ¿Reproducido? | ¿Liberable? |
|---|---|---|---|---|---|---|
| R-09 | MI-002 | Paciente, médico | Alta | Es la **rama por omisión** del renderizador: ocurre en toda receta sin hoja personalizada y sin texto libre de alergias | REP-010 | No |
| R-10 | MI-004 | Paciente | Media | Exige que la alergia esté escrita por clase — habitual en «penicilinas y cefalosporinas» | Motor real | No |
| R-11 | MI-005 | Paciente, médico | Media | Betametasona es alergia frecuente; basta que esté escrita | REP-012 | No |
| R-12 | S-002 | Paciente (secreto), médico | Media | La lectura ocurre en cada uso normal de recepción; la escritura exige intención | Emulador + REP-014 | No sin el dueño |
| R-13 | MP-005 | Paciente (lactante) | **Alta** | Es el modo normal de recetar en pediatría; no hay campo donde poner la concentración | REP-001 | **No** |
| R-14 | MP-004, MP-016, MP-003 | Paciente (niño) | Alta | 20 de 25 fármacos; el copiloto llama al motor sin edad **siempre** | Medido con el motor | No |
| R-15 | MP-006 | Paciente (niño) | Media | Requiere error de unidad al capturar; la detección ×2.2 **nunca** puede disparar | Medido (`revisarPesoPediatrico(20,20)`) | No |
| R-16 | MI-001, MI-014 | Paciente | Alta | Todo paciente crónico con fármaco vigente y creatinina en el panel | REP-011, REP-013 | No |
| R-17 | MI-006 | Paciente | Alta | Combinaciones fijas de uso diario | Medido (`extraerMg('325/37.5 mg')→37.5`) | No |
| R-18 | MG-001, MG-002, MG-003, MG-004 | Paciente (embarazada, lactante) | Alta | La regex falla con la forma habitual de escribir un embarazo temprano | Grep exhaustivo del equipo rojo | Requiere al dueño |
| R-19 | MG-006 | Paciente (feto) | Media | Presentación mexicana habitual de dos fármacos muy recetados | REP-018 | No |
| R-20 | MG-013, MG-014 | Paciente | Media | Depende del verbo que use la paciente; tres variantes probadas fallan | REP-019 | No |
| R-21 | MI-003, MC-005, MG-007, A-002 | Paciente, médico | Alta | Ocurre en el 100 % de los usos: el sello no existe en pantalla | REP-020 | Requiere al dueño |
| R-22 | B-001, MC-001 | Paciente | Media | Exige usar el consultor o la valoración preoperatoria, que son funciones de venta | REP-015, REP-016 | No |
| R-23 | B-005 | Paciente, médico | Baja | Por voz es inalcanzable; por texto editado o POST autenticado, real | Cadena verificada | Parcial |
| R-24 | B-013 | Paciente | Baja-media | Exige decir el nombre del otro paciente en voz alta | Asimetría verificada | No |
| R-25 | MO-001, MO-002, MO-003 | Paciente | Media | La autocorrección hablada («derecho… perdón, izquierdo») es normal al dictar | Grep exhaustivo | Residual al dueño |
| R-26 | MC-004, MO-004, MO-005 | Médico (legal), paciente | Alta | Ocurre en cada referencia y en cada orden emitida | REP-017 | No la referencia |
| R-27 | MC-003 | Paciente, médico | Alta | Ocurre en todo consentimiento impreso | Grep exhaustivo | Revisión legal |
| R-28 | MC-002 | Paciente | Alta | `indicacionesDelMedico` no tiene llamadores: siempre | Grep verificado | No |
| R-29 | D-001 | Paciente, médico | Alta | Toda consulta dictada pasa por el normalizador | Sellado en prueba existente | Sólo el dueño |
| R-30 | A-001 | Médico | Alta | Se pintan las dos a la vez siempre que hay Lp(a) | Ejecutado con `tsx` | Sí, con nota |
| R-31 | S-001 | Paciente (privacidad) | Baja | Exige intención y consola; ningún control lo impide | Emulador | No |
| R-32 | S-004 | Paciente, médico | Baja | Exige acceso previo a consola o a registros de Cloud | Cadena verificada | Con rotación |
| R-33 | N-002, N-003 | Consultorio, plataforma | Media | Sólo requiere que un médico configure el anticipo | REP-003 | **Sólo el dueño** |
| R-34 | N-001 | Médico | Media | Cualquier cambio de plan a mitad de ciclo | REP-002 | No |
| R-35 | N-004, N-005 | Médico, negocio | Alta | Publicado hoy en la portada y en la pantalla de precios | Grep verificado | Decide el dueño |

---

## 2. Riesgos existentes que cambian de estado

Ninguno de estos se descubrió falso: **se descubrió más estrecho de lo que decía
la fila.** Ése es el patrón de toda la sección.

### R-01 — «Una dosis pierde su número al dictarse» · decía **Controlado**, hoy **Parcial**

El control es real para el caso que lo motivó (el número que desaparece). No
cubre dos vecinos demostrados: **una dosis que tiene número y unidad y aun así no
determina la dosis** («5 mL» sin concentración, R-13/MP-005 — la compuerta la
declara *completa*), y **un número que existe pero es el equivocado** (combinados
«325/37.5 mg», R-17/MI-006 — `revisarUnidadDosis` no se queja porque hay cifra y
unidad). El detector vigila la ausencia de cifra; ninguno de los dos casos es una
ausencia de cifra.

### R-02 — «Fatiga de alerta» · sigue **En reparación**, con dos fuentes nuevas

VOICE-004 mira la compuerta de voz. La auditoría añade dos emisores de ruido
fuera de ella: la **falsa alarma crítica de gentamicina neonatal en un escolar**
(R-14/MP-003) y el **bloqueo falso de firma por «betametasona»** (R-11/MI-005),
que además no tiene salida. El segundo es peor que ruido: enseña al médico a
borrar el dato de alergia para poder trabajar.

### R-03 — «Un antecedente que el paciente negó acaba afirmado» · decía **Controlado**, hoy **Parcial**

El motor de negaciones no falló. Falló el vecino que la fila no contemplaba: el
documento impreso **fabrica una negación** que nadie hizo. `RecetaDocumento.tsx:977`
escribe «ALERGIAS: Negadas / no referidas» cuando el campo está vacío
(R-09/MI-002), y la carta de referencia repite la frase. El riesgo de R-03 era
«el dictado se afirma mal»; el riesgo real incluye «el papel afirma solo».
El guardián que debía cerrarlo tiene un punto ciego demostrado: su regex no
reconoce la forma `{ paciente.alergias || '…' }`.

### R-04 — «Un padecimiento pasado se escribe como actual» · sigue **Controlado, no medido**, y aparece su espejo

Nada la contradice. Pero R-16/MI-001 muestra el eje contrario y no cubierto:
**lo vigente que no se mira**. La receta calcula el ajuste renal sólo sobre los
fármacos de hoy; la medicación crónica del paciente no entra. La temporalidad se
vigila al escribir y se pierde al decidir.

### R-05 — «Un alérgeno mal transcrito hace que el cruce nunca salte» · sigue **En reparación**, residual sube a **Alto** y el alcance se amplía

La fila supone que el problema es la transcripción. La auditoría demuestra que
hay tres capas más, cada una capaz de anular el cruce con el alérgeno **bien**
transcrito:

1. **Emparejamiento**: «cefalosporinas» no casa con ceftriaxona (R-10/MI-004) y
   «betametasona» casa de más (R-11/MI-005). Dos vocabularios sobre la misma
   entidad, y el débil es el que imprime y el que gatea la firma.
2. **Fuente**: el campo lo puede escribir un rol no clínico (R-12/S-002) y la
   subcolección `clinico` que debía sustituirlo no tiene ni un escritor.
3. **Impresión**: el papel afirma «Negadas» cuando no hay dato (R-09/MI-002).

«Cuatro parsers distintos del campo» era el diagnóstico. Sigue siéndolo, y ahora
está medido en los tres tramos.

### R-06 — «Datos de un consultorio visibles en otro» · sigue **Controlado**, con una precisión que faltaba

Nada de esta auditoría toca el aislamiento **entre** consultorios: R-12/S-002 y
R-31/S-001 son fallos **dentro** de un consultorio (entre roles, y contra un
derecho ya ejercido). La fila R-06 debería decir explícitamente qué aísla, para
que nadie la lea como si cubriera también el aislamiento por rol — hoy se puede
leer así, y no lo cubre.

### R-07 — «Pérdida de datos sin poder restaurar» · sigue **Parcial**, con un modo de fallo nuevo

R-26/MC-004: la carta de referencia **no se escribe en ninguna colección**. No es
que el respaldo no la restaure: es que no hay nada que respaldar, y el manifiesto
de `respaldo.ts` seguirá pareciendo completo. Es la misma lección de
`security-tenant.md` («una colección que nadie respalda…») un paso antes: una
entidad clínica que nadie persiste.

### R-08 — «El sistema afirma una cifra clínica que nadie validó» · decía **Declarado**, hoy **Declarado donde nadie lo lee**

Éste es el cambio de estado más importante del lote. La declaración existe —23
motores en `pendiente_validacion` en el registro, y una pantalla de cumplimiento
que los lista—, pero **`SelloMotor` está importado y nunca se renderiza**
(REP-020, cero usos como elemento en todo `src/`). La pantalla de cumplimiento
afirma literalmente que «sus resultados salen en pantalla con una etiqueta ámbar
junto al dato»: eso no ocurre. En el momento de decidir, el médico no puede
distinguir los 23 sin validar de los 6 validados; y dos de ellos —profilaxis
quirúrgica (MC-005) y embarazo/lactancia (MG-007)— agregan sus cifras a la nota
firmada sin ninguna marca. Añádase A-002: el registro declara puertas de entrada
(`revisarFarmaco`, `estadioERC`) que **nadie llama en producción**, así que el
artefacto de trazabilidad describe un producto que no es el que corre.

Un aviso que nadie ve no es un aviso. R-08 debe pasar de «Declarado» a
«Declarado en un tablero, invisible en el punto de uso», y su residual de Medio a
**Alto**, hasta que el sello se pinte donde se decide.

---

## 3. Lo que sólo puede aceptar el dueño

Yo clasifico; **no acepto residual crítico**. Esto va a `04-DECISIONES-DEL-DUENO.md`
y de ahí a `agent-state/OWNER_DECISIONS_REQUIRED.md`.

1. **R-13 · La receta pediátrica en mL sin concentración** (P0, reproducido).
   Hoy el producto no tiene forma de expresar bien la receta diaria de la
   especialidad que Practice quiere vender. Mi recomendación por omisión: **no
   liberable** — o el renglón lleva concentración, o no baja al cuidador y se le
   dice al médico. Elegir entre bloquear, avisar o aceptar es del dueño porque
   afecta a la firma y al flujo de consulta.
2. **R-33 · El anticipo del paciente en la cuenta de la plataforma** (P0,
   reproducido). Retener fondos de terceros sin contrato de intermediación es una
   decisión regulatoria y contractual, no técnica. Recomendación por omisión:
   apagar el anticipo con bandera hasta que exista Stripe Connect o equivalente.
   **No lo puede decidir ningún agente.**
3. **R-08/R-21 · Seguir usando 23 motores sin validar sin decirlo en pantalla.**
   La cola C-1 ya existe; lo que falta decidir es qué hace el producto mientras
   tanto: pintar el sello (y aceptar que el médico vea ámbar por todas partes),
   apagar los motores no validados del camino de la receta, o aceptar el residual
   por escrito. Recomendación por omisión: pintar el sello.
4. **R-11 · Alergia que bloquea la firma sin vía de paso**, contra D-033 («avisa
   y no bloquea», hoy sólo aplicada a la pantalla de receta). Extender D-033 a la
   compuerta de firma con justificación escrita **es política clínica final**:
   del dueño.
5. **R-18 · Introducir el estado gestacional y de lactancia como dato del
   paciente.** Cambia el modelo del paciente e implica preguntar por embarazo en
   la captura. No hay entrada previa en `OWNER_DECISIONS_REQUIRED.md`: la pregunta
   es nueva. Incluye las dos ramas que el propio auditor mandó al dueño (sexo
   «Otro», >50 años).
6. **R-25 · Lateralidad.** Hoy el único control es probabilístico (el modelo
   marca contradicciones) y la compuerta no bloquea la firma **por decisión previa
   del Dr.** Aceptar ese residual con severidad 5, o financiar un detector
   determinista dictado↔nota, es suyo.
7. **R-12 · Un rol no clínico lee las alergias.** La aceptación E0-06 está
   declarada **incumplida por escrito** en el propio repositorio. O se migra a
   `clinico`, o el dueño re-acepta el residual a sabiendas y con fecha.
8. **R-27 · Formato del consentimiento informado** (firma del paciente, testigos,
   huella del texto aceptado). Requiere revisión legal: `NEEDS_CLINICAL_REVIEW` y
   asesoría, no criterio de un agente.
9. **R-29 · Correcciones invisibles al dictado.** Contradice la regla 3 y el
   principio REVERSIBILIDAD que el producto vende. No existe acta que lo autorice
   (`git log -S` sitúa el filtro en un commit de orquestador, no en una decisión).
   O se enseña el par antes→después, o el dueño firma que no se enseña.
10. **R-35 · Las dos promesas públicas** («50 médicos, tarifa de por vida»,
    «te avisamos tres días antes»). Retirarlas de la portada o construirlas es
    decisión comercial y legal.

---

## 4. Nota de método — qué leí y qué no

**Leí completo**: `docs/ai/NEXUSMED_AUDITORIA_PANEL_DE_LUJO_MASTER_PROMPT.md`
§2, §5 (Fase 4), §6 y §7 · `agent-state/RISK_REGISTER.md` (las ocho filas) ·
`CLAUDE.md` y las reglas que gobiernan lo clasificado.

**Insumo, en pares auditor↔equipo rojo** (11 pares, `crudos/`):
`S-ciberseguridad`, `B-ingeniero-ia`, `N-negocio`, `M-internista`, `M-pediatra`,
`A-ingeniero-software`, `C-programador`, `D-diseno`, `M-ginecologa`,
`M-cirujano`, `M-ortopedista`.

**Filtro aplicado** (tal como se encargó): veredicto rojo `confirmado` o
`parcial`, con `prioridad_final` **del equipo rojo** P0 o P1; más los P2
confirmados con `severidad` 4 o 5. Salen **41 hallazgos** de 261 veredictos, que
agrupé en **27 peligros** (R-09…R-35). La prioridad del auditor no se usó en
ningún caso; donde el rojo bajó la prioridad, lo bajé yo también y lo dije en la
fila (R-30 es el ejemplo: bajé la severidad de 4 a 3 por su refutación).

**Añadí fuera del filtro, por encargo explícito de agrupación**: MI-003, MG-003
y MG-007 (P2, severidad 3). No entraban por el filtro y sí son el mismo peligro
que MC-005 y A-002: R-21. Se agrupan, no se cuentan aparte.

**Reproducciones**: leí `reproducciones/SALIDA-P0.txt` (6 fallos de 11 casos) y
`SALIDA-P1.txt` (**29 fallos de 50 casos, 14 archivos en rojo**). Todo lo
reproducido lleva **probabilidad demostrada**, no estimada, y así está marcado en
la tabla de detalle. Los peligros sin reproducción (R-23, R-24, R-25, R-27,
R-28, R-30, R-31, R-32) llevan probabilidad **argumentada** y lo digo.

**No leí, y por tanto este documento no cubre**:

- `AS-cobros`, `AS-enfermeria`, `AS-expedientes`, `AS-mensajeria`,
  `AS-recepcion`, `P-gineco` — **son el lote 2**. Sus pares de equipo rojo no
  existían para todos al momento de escribir esto.
- Los hallazgos **P2 con severidad ≤3** y todos los **P3** de los 11 pares: son
  fricción y mejora, y su sitio es `12-FACILIDAD-DE-USO.md` y
  `08-MEJORAS-CLASE-MUNDIAL.md`, no el registro de riesgos.
- Los hallazgos **refutados** (11 en estos pares). No los reviso: el equipo rojo
  ya citó `archivo:línea` que los impide.
- **No verifiqué el código por mi cuenta.** Clasifico sobre la evidencia del
  auditor y la verificación del equipo rojo. Donde ambos discrepan, uso la del
  rojo y lo digo (R-30, R-16, R-18, R-26).
- **No toqué** `agent-state/RISK_REGISTER.md`, `src/`, `firestore.rules` ni
  ningún archivo fuera de este directorio. Las filas de la §1 están **listas para
  pegar**, no pegadas: numerarlas en firme es del dueño, porque implica aceptar
  que estos peligros existen.

**Qué NO cubre este documento, dicho para que nadie lo espere**: no propone
arreglos, no valida ninguna cifra clínica, no estima esfuerzo, no decide
prioridad de reparación y no acepta ningún residual. Los residuales críticos de
la §3 están **abiertos** hasta que el dueño los firme.

<!-- LOTE 2 PENDIENTE -->

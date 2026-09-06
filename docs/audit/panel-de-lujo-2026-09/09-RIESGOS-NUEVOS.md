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

## Lote 2 — asistentes y pacientes

Fecha: 2026-09-06 · Lote 2 (cuatro asistentes, cinco pacientes).
Mismo autor, misma escala y mismo filtro que el lote 1. La numeración continúa
en **R-36**; **no he tocado ninguna fila del lote 1**, ni
`agent-state/RISK_REGISTER.md`, ni `src/`.

Dos cosas que este lote cambia respecto del anterior, dichas antes de la tabla:

- El lote 1 miró **lo que el médico escribe**. Éste mira **lo que sale del
  consultorio**: el mensaje, el cobro, el enlace, el documento que el paciente
  descarga y la pregunta que hace a las 2 a.m. Casi todo lo nuevo es de la
  familia «el dato tiene que LLEGAR» y de su reverso, que no estaba nombrado:
  **llega, pero al destinatario equivocado, o con más de lo que debía llevar**.
- **Diez de los treinta y dos hallazgos no abren fila nueva.** Son la misma
  puerta que ya tienen R-14, R-20, R-26, R-28 y R-31, por una ruta distinta.
  Van a §6. Duplicarlos habría inflado el registro y escondido lo importante:
  que el problema es **uno** y que ahora se ha demostrado en cinco
  especialidades a la vez.

---

## 5. Filas nuevas del lote 2

| # | Peligro | Sev | Control actual | Riesgo residual | Estado |
|---|---|---|---|---|---|
| R-36 | **P0** · **Ningún cobro se puede anular.** Con cita, la transacción escribe antes de leer y Firestore la rechaza siempre (ASC-001); sin cita, la regla compara `citaId`/`patientId` por acceso directo sobre un documento que no los tiene y deniega (ASC-002). Borrar está prohibido por reglas (`firestore.rules:982`) | 4 | Ninguno. `quien-anulo.test.ts` es puro y nunca ejecuta `cancelarCobro`; `firestore-rules-guard.test.ts` hace grep del texto de la regla, no la evalúa. Lo que ve la persona es el mensaje crudo del SDK | **Alto**: la única vía de corrección del libro de cobros está rota al **100 %**, y lo que se capturó mal se queda en Finanzas, en el corte, en las comisiones y en el CSV del contador. Un cobro duplicado al paciente no puede llevar constancia de su corrección | Nuevo · **no liberable** |
| R-37 | El libro de cobros se puede **falsear desde el navegador** y el sello de la cortesía **se borra**: `cobroId` y `cobradoEn` no aparecen en ninguna regla de `appointments` (ASC-003), y `quitarExencion` vacía motivo y autor sin `logAudit` (ASC-004) | 4 | Parcial y en el sitio equivocado: el corte cruza cobros reales, pero `estaSaldada` acepta el OR y da por saldada la cita que sólo tiene `cobroId`. Antes de quitar la cortesía hay un `confirm()` del navegador: eso no es un control de servidor | **Alto**: es el hueco que cerró REG-003 para la cortesía, abierto por las otras dos puertas, y **con el agravante de que borra el sello en vez de conservarlo**. El emulador con rol `secretaria` permitió las tres escrituras, incluida `cobroId:''` para volver a cobrar una cita ya saldada | Nuevo · no liberable |
| R-38 | **El mensaje con datos del paciente sale al teléfono equivocado**: cualquier número que no empiece por 52 se convierte en silencio en uno mexicano (`+1 619…` → `526195551234`, ASM-002), y corregir el teléfono del expediente **no corrige el de sus citas**, que es de donde lee el cron (ASM-004) | 4 | Ninguno en los dos caminos. Ningún formulario pide código de país; `whatsapp-telefono.test.ts` sólo cubre números mexicanos. No existe reconciliador entre `patients` y `appointments`: `pacienteTelefono` sólo se escribe al crear la cita | **Alto**: el recordatorio lleva nombre completo, médico, fecha, hora y nombre del consultorio —que suele nombrar la especialidad— y el envío se reporta «ok». El equipo rojo matiza que 619 no es LADA asignada en México, así que ese caso concreto lo rechaza el proveedor: **la mutación silenciosa y la ausencia total de validación de país quedan confirmadas**, y basta que los diez dígitos caigan en numeración asignada | Nuevo · no liberable |
| R-39 | La confirmación por WhatsApp sólo funciona si el paciente contesta **en menos de 2 h**: el bloque de caducidad de sesión corre 44 líneas **antes** del que atiende SÍ/NO y hace `return`, así que borra la sesión y manda el menú de bienvenida (ASM-006) | 3 | Ninguno: el texto del cron dice «Responde SÍ» y **no dice el plazo**. `bot-si-no-cancela.test.ts` comprueba cadenas del código, no la caducidad | **Medio**: el recordatorio sale 23-26 h antes; el paciente que contesta al salir del trabajo recibe «¡Bienvenido! 1️⃣ Agendar cita…» y cree que confirmó. El «NO» tampoco cancela, así que el hueco no llega a la lista de espera. Es el argumento de venta de la agenda | Nuevo · liberable sólo si el mensaje declara el plazo; hoy, no |
| R-40 | **Un paciente, dos expedientes.** Buscar por un apellido a secas contesta «Ninguno de los 6 expedientes coincide» aunque exista (ASE-001); el importador guarda `15/03/1980` tal cual, así que no hay `edad` y el motor de duplicados declara «dos personas» para siempre (ASE-003); y un Excel con apellidos en columnas separadas importa 1 200 pacientes **sólo con el nombre de pila** (ASE-004) | 4 | Parcial e insuficiente: `buscarPosiblesDuplicados` rescata dos palabras parecidas, pero con una sola palabra la similitud es 0.67 contra un umbral de 0.8 y devuelve `[]`. En la importación, **ninguno**: no hay validación de fecha ni de CURP y la pantalla no lista las columnas descartadas | **Alto**: es un ataque directo al invariante `UN PACIENTE · UNA IDENTIDAD · UN EXPEDIENTE LONGITUDINAL`, y quien paga es el paciente cuyas alergias y antecedentes quedan en la mitad que nadie abre. Un menor importado sin `edad` **no dispara ninguna herramienta pediátrica** (lo dice el comentario del propio código): agrava R-14 y R-13 | Nuevo · no liberable |
| R-41 | **El derecho ARCO que llega no se puede ejecutar**: las solicitudes nacen `origen:'portal-publico'` sin `patientId`, no existe pantalla que las ligue, y el panel manda a «ejecutarla desde su expediente», donde `grep 'arco'` da cero resultados (ASE-010) | 4 | Parcial y fuera del producto: las rutas `/api/arco/acceso` y `/cancelar` funcionan **si alguien les pasa `patientId` por curl**. En la aplicación sólo quedan «Rechazar» y un `prompt()` de texto libre. Las reglas dejan la puerta abierta (`:775-781`) y ningún código la cruza | **Alto**: incumplimiento LFPDPPP demostrable **con la propia bitácora del producto** —solicitudes recibidas, ninguna ejecutada por la vía documentada—, y con el plazo de 20 días hábiles que la misma pantalla cuenta en voz alta. Con R-31 cierra el cuadro: el derecho no se puede ejercer, y el que sí se ejerció se puede deshacer sin rastro | Nuevo · no liberable |
| R-42 | **Cerrar sesión no limpia los expedientes del navegador del mostrador**, y la pantalla promete lo contrario: sin una consulta abierta que conteste al evento, `salirSeguro` sale por la rama de `window.location.href` sin `limpiarCacheFirestore()` ni `limpiarBorradoresLocales()` (ASE-013) | 4 | Sólo en el camino menos frecuente: cuando hay una consulta abierta **y** contesta, sí se purga. `AutoLogout`, `Sidebar`, `FlowRail`, el layout y Operaciones pasan todos por la misma función y heredan el hueco. `salir-seguro.test.ts` tiene 6 casos y **ninguno de `salirSeguro`** | **Alto**: la persistencia local está activa en producción; los expedientes quedan legibles en IndexedDB del equipo compartido de recepción después de cerrar sesión, mientras `operaciones/page.tsx:343` dice «nada del consultorio se queda guardado aquí». Contradice `data-privacy.md` en el cierre de sesión más común del día. **Una promesa falsa es peor que no hacer la promesa** | Nuevo · no liberable |
| R-43 | **El freno de peticiones se cobra sobre la pregunta urgente**: `preguntar` está dentro de `ACCIONES_CLINICAS`, cada carga del portal gasta 3 del cupo de 15/10 min y a la sexta recarga la pregunta «me duele el pecho y me falta el aire» recibe 429 «Demasiadas consultas a tus documentos» (PI-004) | 4 | Sólo la franja `ViaDeUrgencia` con el 911, que sobrevive porque `session` no es acción clínica. Con 429 la ruta **no llega a `clasificarPregunta`**: no hay tarea crítica, no hay WhatsApp al consultorio, no queda registro | **Alto**: el código se contradice a sí mismo por escrito («preguntar tiene su propio freno, y no es el de la agenda») y ese freno propio nunca se cobra porque el clínico va antes. Cinco recargas en diez minutos es lo normal en un teléfono con mala señal a las 2 a.m. **Un canal de escalación que se cierra justo cuando se usa de verdad no es un canal** | Nuevo · no liberable |
| R-44 | **El paciente lee como suyos diagnósticos descartados, presuntivos, resueltos y propuestos por la IA**, en un documento con cédula que reenvía al jefe o lleva a la farmacia: la ruta del portal concatena `n.diagnosticos` sin filtrar `tipo`, `estado` ni `tipoOrigen`, en la receta descargable (PO-001), en «Mis recetas» (PC-001) y en el resumen del paquete liberado (PO-002) | 4 | Ninguno en `documentos`, que no pasa por liberación alguna. Para el paquete, parcial: nace `DRAFT` y la previsualización se lo enseña al médico rotulado «Motivo:» — pero rotulado así nadie lo lee como la lista de diagnósticos del paciente | **Alto**: **veinte líneas arriba, en el mismo `.map`, la ruta sí aplica la puerta de prescripción**, con 28 líneas de comentario explicando por qué una lista cruda no puede salir impresa bajo una cédula. La asimetría dentro de una sola expresión es el defecto. Es la forma exacta de REG-329, que declaró por escrito no cubrir el paquete. Aviso: copiar `diagnosticoParaImprimir` **no cierra el caso** — `find(definitivo) ?? conTexto[0]` imprime el descartado cuando es el único con texto | Nuevo · no liberable |
| R-45 | **Un enlace del paciente abre más de lo que hacía falta y viaja reenviado**: el enlace clínico da 7 días de acceso a todo el expediente del niño y permite cancelar, reagendar y preguntar en su nombre, sin forma de compartir sólo la receta o el justificante (PP-005); y el enlace de **agenda** —el que emite cualquier persona del mostrador— devuelve el `motivo` clínico de cada cita y lo incrusta en el `details` del enlace a Google Calendar (PO-010) | 4 | Parcial: dos niveles de alcance con guarda de servidor (E0-06), TTL de 7 días **razonado por escrito en el código**, revocación por el médico, frenos por token y el aviso «este enlace es personal: no lo compartas». No hay bitácora de aperturas ni tercer alcance | **Alto en privacidad**: el reenvío a la guardería, a la escuela o al patrón no es el abuso, **es el caso de uso normal**, y hoy el producto sólo sabe decir «no lo compartas». En PO-010 hay además PHI en un **parámetro de URL hacia un tercero**, que es lo que `security-tenant.md` prohíbe con esas palabras; el riesgo estaba identificado (`patient-token.ts:19`) y se mitigó con caducidad en vez de con alcance | Nuevo · el alcance lo decide el dueño; el `motivo` en la URL, no liberable |
| R-46 | **Lo que el paciente acepta no describe lo que el sistema hace**: el aviso publicado dice que Meta/WhatsApp «no trata datos de salud» mientras el portal le manda al consultorio el nombre y la pregunta íntegra (PG-005, decidido en D-034 el 5-sep y nunca reflejado en el aviso); el consentimiento de grabación dice «se conserva temporalmente en este dispositivo» y el audio sube a Storage 24 h (PG-003); y al reservar se marca «he leído el aviso de privacidad», que es un `<strong>` y no un enlace, junto a un «consentimiento informado para la atención médica» por casilla (PG-006, PO-007) | 4 | Parcial y del lado del servidor: el aviso **integral** sí lista Firebase y AssemblyAI como subencargados, y `booking/route.ts:249-257` guarda `versionAviso` y el `sha256` del aviso de ese consultorio, así que lo aceptado es reproducible y fechado. Nada de eso lo ve el paciente en el momento de aceptar | **Medio-alto (legal, y de confianza)**: el aviso integral es el primer documento que lee un regulador y hoy afirma lo contrario de lo que el código hace desde el 5-sep. Un «consentimiento informado» por casilla, sin información, no protege a nadie —y es hermano de R-27, que dijo lo mismo del consentimiento quirúrgico impreso | Nuevo · requiere revisión legal del dueño |

### Detalle de clasificación (lo que no cabe en el formato del registro)

| # | Hallazgos | A quién daña | Prob. | Por qué esa probabilidad | ¿Verificado? | ¿Liberable? |
|---|---|---|---|---|---|---|
| R-36 | ASC-001 (P0), ASC-002 | Consultorio, contador; paciente si se le cobró de más | **Cierta** | Determinista al 100 % para todo cobro con cita; el suelto lo deniegan las reglas. No hay camino alternativo | Sí: emulador con proyecto aparte, borrado al terminar; salida literal del error de la regla. REP-030 y REP-031 escritos, sin salida guardada | **No** |
| R-37 | ASC-003, ASC-004 | Consultorio (sustracción de efectivo indetectable); médico | Media | Exige intención y consola para ASC-003; ASC-004 son dos clics en la interfaz normal | Sí: emulador con rol `secretaria`, las tres escrituras PERMITIDAS. REP-032 escrito, sin salida guardada | No |
| R-38 | ASM-002, ASM-004 | Paciente (PHI a un tercero), médico | Alta para ASM-004, media para ASM-002 | Corregir un teléfono es la corrección más frecuente del día y no surte efecto; la mutación de país necesita un paciente extranjero | Sí: la lógica ejecutada en node, seis entradas con su salida | No |
| R-39 | ASM-006 | Paciente, médico (no-show) | Alta | La ventana útil real son 2 h de las 23-26 h que dura el recordatorio | Sí: leído el orden literal del webhook | Con el plazo escrito |
| R-40 | ASE-001, ASE-003, ASE-004 | Paciente (expediente partido), asistente, negocio | Alta | Buscar por apellido es la tarea de 40 veces al día; los apellidos en columnas son el formato de casi cualquier sistema mexicano | Sí: ejecutado con jiti — `similitudNombre = 0.666` contra umbral 0.8; `edadEnAnios('15/03/1980') = null`; `compararPacientes(...) = null`; mapeo `["nombre",null,null,…]` | No |
| R-41 | ASE-010 | Paciente (derecho), responsable del tratamiento | Alta | Ocurre en **toda** solicitud recibida por el portal: es el único origen que existe | Sí: seguido del otro lado — ninguna escritura manda `patientId`, cero `arco` en el expediente | No |
| R-42 | ASE-013 | Paciente (privacidad), asistente | Alta | Es la rama por omisión: cerrar sesión desde Pacientes, Agenda u Operaciones, y el cierre por inactividad | Sí: leído el archivo entero, seis llamadores, un solo purgador | No |
| R-43 | PI-004 | Paciente | Media-alta | Tres peticiones por carga sobre un cupo de 15/10 min: cinco recargas | Sí: observado en vivo con `pac-001` y verificado el orden en la ruta | No |
| R-44 | PO-001, PC-001, PO-002 | Paciente, médico (medicolegal) | Alta | Ocurre en toda nota firmada con más de un diagnóstico | Sí: respuesta real del emulador con seis diagnósticos sintéticos concatenados | No |
| R-45 | PP-005, PO-010 | Paciente (privacidad) | Alta | El reenvío del documento a la guardería o al patrón es el uso normal; el enlace de agenda lo emite cualquier miembro | Sí: recorrido con enlace real; `details=Ajuste%20de%20metformina` en la URL de Google | Alcance: dueño |
| R-46 | PG-005, PG-003, PG-006, PO-007 | Paciente, responsable del tratamiento | Alta | Publicado hoy; la reserva pública es la puerta de entrada del paciente nuevo | Sí: cadena completa decisión → emisor → ruta → documento publicado | Revisión legal |

---

## 6. Filas del lote 1 que reciben evidencia nueva

**No abro fila nueva para nada de esta sección.** Es la misma puerta por otra
ruta, y separarla habría hecho creer que son problemas distintos.

### R-20 — «La IA del paciente contesta donde debía escalar» · el residual sube de Alto a **Alto y estructural**

El lote 1 lo vio en ginecología (MG-013, MG-014) y se pudo leer como el hueco de
una especialidad. **No lo es.** Este lote lo demuestra en las cuatro restantes, y
además parte el peligro en dos mecanismos que conviene no confundir:

1. **Se contesta cuando debía escalar** (PI-001, PI-002, con MG-014). Esto es
   peor que un vocabulario corto: `PREGUNTA_POR_TOMA` **sobre-captura por
   subcadena** (sin `\b`, «como» y «cuando» casan dentro de otras palabras), así
   que «si no como, ¿me tomo la metformina?» y «¿puedo saltarme el paracetamol
   hoy?» devuelven `ANSWER_FROM_APPROVED_PLAN` con `avisarAlConsultorio:false`.
   Un efecto adverso contado con la palabra «cuando» («cuando tomo la furosemida
   me da mucha sed, ¿es normal?») recibe la pauta y **no llega a Pendientes**;
   la misma queja sin «cuando» sí escala. El destino por omisión deja de ser
   escalar: eso **refuta el invariante que el módulo se atribuye en su propia
   cabecera** («vocabulario incompleto pierde precisión, nunca seguridad»).
2. **Se escala como ordinario lo que era urgencia** (PG-001, PP-001, PP-002,
   PC-003, PO-003, con MG-013). Cinco especialidades, un solo archivo y una sola
   línea: `urgencia.ts:48`. Obstetricia (sangrado con dolor, no siento al bebé),
   pediatría (39.5 °C y no despierta), postoperatorio (herida roja con fiebre,
   sale pus, no para de sangrar) y vascular (el pie morado y frío bajo la
   férula). El equipo rojo mantiene **P2/parcial** en todos porque el hueco está
   **declarado por escrito** en el módulo, que es exactamente lo que manda
   `clinical-safety.md §5`, y ampliarlo es política clínica: `NEEDS_CLINICAL_REVIEW`.
   **Estoy de acuerdo con esa clasificación y en desacuerdo con leerla como
   tranquilidad**: un caso declarado no es un caso atendido, y cinco
   especialidades pidiendo lo mismo el mismo día es una decisión pendiente del
   dueño, no una nota al pie (§7.14).

Dos matices que sí son accionables **sin** decisión clínica y que separo para que
no se pierdan dentro de lo anterior:

- **PP-002** — `ingesta_accidental_o_sobredosis` **ya está implementada** y es
  una de las cinco del §6. Sólo falta la palabra «dosis»: «se tomó doble dosis
  sin querer» → `null`, mientras «se tomó dos pastillas de más» → URGENT. No es
  un hueco de criterio, es un hueco de vocabulario dentro de una categoría
  cubierta.
- **PP-001** — «no despierta», «no reacciona», «está aletargado» son sinónimos
  coloquiales de «no responde», que **ya está dentro** de los síntomas
  neurológicos agudos. Lo que sí es política clínica nueva es escalar por la
  edad del token (fiebre en el lactante).
- **PC-003** — `TEXTO_ESCALACION` no lleva la vía que `mensajeDeUrgencia` sí
  lleva. La franja del 911 está arriba en la misma pantalla —el equipo rojo
  corrige aquí al auditor—, pero la respuesta a **su** pregunta le dice que
  espere.

### R-28 — «Los signos de alarma y las indicaciones no llegan al paciente» · confirmado en tres especialidades y **con una corrección**

PC-002, PG-002 y PO-004 son MC-002 por tres rutas. Lo nuevo:

- La plantilla `nota_alta` **ya tiene `signosAlarma` como clave estructurada y
  obligatoria** (`templates.ts:62`): el producto sabe modelar el campo, y
  `componerPaquete` sigue devolviendo `warningSigns: []` a pelo. No falta el
  concepto: falta que el compositor mire las secciones de la nota.
- **Corrección al lote 1 y al equipo rojo de ginecología**: PG-002 anotó que
  `indicacionesDelMedico` «sí viaja por la hoja impresa». **Es falso a la
  salida.** El equipo rojo de ortopedia lo verificó: `grep -rn
  'indicacionesDelMedico' src/` devuelve dos líneas, las dos dentro de
  `como-se-lo-explico.ts`, **cero llamadores**. Las indicaciones del médico no
  llegan ni al portal ni a la hoja del paciente: sólo a la receta impresa. R-28
  se ensancha, no se estrecha.

### R-14 — «La red de dosis pediátrica está ciega» · nueva causa, aguas arriba

R-14 decía que el copiloto llama al motor **sin edad**. ASE-003 añade el escalón
anterior: un paciente **importado** puede no tener `edad` en absoluto, porque
`edadEnAnios('15/03/1980')` devuelve `null` y el importador guarda la fecha tal
cual. El propio código lo dice en su comentario (`migracion/page.tsx:212-214`).
Una migración de 1 200 filas deja a todos esos menores fuera de las herramientas
pediátricas **antes** de que ningún motor tenga oportunidad de fallar.

### R-31 — «Un bloqueo ARCO se puede deshacer sin rastro» · ahora se ve el cuadro entero

Con R-41/ASE-010 el ciclo ARCO está roto por los dos extremos: **lo que llega no
se puede ejecutar**, y **lo que se ejecutó se puede revertir desde el navegador**.
R-31 deja de ser un caso de borde con intención y pasa a ser la mitad de un
mecanismo que no funciona en ninguno de sus dos sentidos.

### R-26 — «Se hace y no queda rastro» · un primo en el dinero

R-26 clasificó entidades clínicas que se imprimen y no se persisten. ASC-004 es
la misma lección en el libro de cobros: **quitar** una cortesía no deja
`logAudit` —la cortesía al ponerla sí lo deja— y además **borra** `exentoMotivo`,
`exentoPor` y `exentoEn`. No es que el rastro no se escriba: es que el rastro que
ya existía se destruye. Lo dejo dentro de R-37, y lo anoto aquí porque es el
mismo defecto de diseño que R-26 vio en la carta de referencia.

### Lo que este lote **no** cambió

- **R-33 (anticipo de Stripe)** — el equipo rojo declara explícitamente que
  ASC-001 **no** es duplicado de N-002: aquél es a quién le llega el dinero,
  éste es si se puede corregir. Son dos filas distintas y las dos siguen.
- **R-02 (fatiga de alerta)**, **R-08 (motores sin validar)**, **R-09/R-10/R-11
  (alergias)**, **R-13** — sin evidencia nueva en este lote. No las toco.

---

## 7. Riesgos existentes que cambian de estado (`RISK_REGISTER.md`)

Se añade a la §2 del lote 1; no la sustituye.

### R-05 — «Un alérgeno mal transcrito hace que el cruce nunca salte» · una cuarta capa, aguas arriba de las tres del lote 1

El lote 1 añadió emparejamiento, fuente e impresión. R-40 añade la capa cero:
**el expediente correcto puede no ser el que está abierto.** Si la búsqueda por
apellido dice «no existe» y se crea un segundo expediente, o si el mismo paciente
importado y capturado a mano son dos personas para `compararPacientes`, entonces
las alergias están escritas —bien transcritas, bien emparejadas, bien impresas—
en la mitad del expediente que nadie abrió. Ningún motor puede cruzar lo que no
está en el documento que se cargó.

### R-06 — «Datos de un consultorio visibles en otro» · sigue **Controlado**, y la precisión que pedía el lote 1 se vuelve urgente

Nada de este lote toca el aislamiento **entre** consultorios. Tres hallazgos
tocan lo que la fila no cubre y hoy se puede leer como si cubriera:

- **entre roles**: el emulador con `secretaria` permitió escribir `cobroId`
  inventado, borrarlo de una cita cobrada y quitar la cortesía sin motivo ni
  autor (ASC-003, ASC-004). `updateAppointment` es un `updateDoc` **sin lista
  blanca de campos**, contra lo que pide `security-tenant.md`.
- **entre personas del mismo mostrador**: los expedientes siguen en IndexedDB
  después de cerrar sesión (ASE-013).
- **hacia fuera**: `motivo` clínico en un parámetro de URL a Google (PO-010).

Recomiendo que R-06 diga **qué aísla** (consultorio↔consultorio) y que exista una
fila hermana para el aislamiento **por rol y por dispositivo**, que hoy no tiene
ninguna. Redactarla es del dueño; señalar que falta es mío.

### R-07 — «Pérdida de datos sin poder restaurar» · sigue **Parcial**, con un tercer modo de fallo

El lote 1 añadió «lo que nunca se persistió». Este añade **lo que entró mal y el
respaldo restaurará fielmente**: 1 200 pacientes sin apellidos (ASE-004) y con
fechas de nacimiento que ningún motor sabe leer (ASE-003), y un libro de cobros
que no se puede corregir por diseño (R-36, con `allow delete: if false`). El
simulacro de ida y vuelta seguirá saliendo en verde: **mide fidelidad, no
corrección**, y no puede distinguir una copia buena de un dato malo.

---

## 8. Lo que sólo puede aceptar el dueño (continúa la §3 del lote 1)

11. **R-36 · Qué se hace con los cobros ya capturados mal.** El defecto tiene
    arreglo técnico, pero la pregunta que no es técnica es qué pasa con lo que ya
    está asentado: `delete` está prohibido por reglas, y hoy no hay ninguna vía
    de corrección. Recomendación por omisión: arreglar la transacción y la regla,
    y **no** abrir un borrado — la corrección de un libro contable se hace con un
    asiento de anulación, no borrando. Cuál es esa vía la decide el dueño porque
    define el corte de caja y lo que ve el contador.
12. **R-20 ampliado · Qué signos de alarma vigila el portal.** Cinco
    especialidades han pedido lo mismo el mismo día: obstetricia, pediatría,
    postoperatorio, vascular e infecciosa. El vocabulario de `urgencia.ts` es
    literalmente el §6 de `patient-facing-ai.md`, que es **especificación del
    dueño**: ampliarlo es política clínica final y no lo puede hacer ningún
    agente. Recomendación por omisión: cerrar primero las dos piezas que **no**
    requieren criterio nuevo (la palabra «dosis» en una categoría ya
    implementada, y los sinónimos de «no responde»), y llevar el resto a una sola
    decisión con el internista real. Mientras tanto, decir en el portal qué **no**
    vigila —hoy no lo dice.
13. **R-45 · El alcance de un enlace del paciente.** Hoy sólo existen dos
    niveles y el reenvío es el uso normal, no el abuso. Qué se construye —receta
    sola, justificante, constancia, cuidador autorizado con bitácora— es una
    decisión de producto y de privacidad. **Lo que no espera a esa decisión** es
    el `motivo` clínico en el `details` de un enlace a Google Calendar: eso
    contradice `security-tenant.md` por escrito y lo cuento como no liberable.
14. **R-46 · Redacción legal.** Tres textos que un regulador leería primero: el
    aviso integral que niega que WhatsApp trate datos de salud (cuando D-034
    decidió lo contrario el 5-sep), el consentimiento de grabación que dice «en
    este dispositivo», y la casilla de «consentimiento informado para la atención
    médica» al reservar. `NEEDS_LEGAL_REVIEW`: no es criterio de un agente.
    Recomendación por omisión: la del aviso de WhatsApp son dos banderas y
    regenerar el texto, y no debería esperar a las otras dos.
15. **R-37 · Un rol de mostrador que puede marcar una cita como pagada.** Es la
    misma familia que R-12 (E0-06) y la misma pregunta: o hay lista blanca de
    campos en servidor, o el dueño re-acepta el residual **a sabiendas y con
    fecha**. Aquí el daño es dinero, no secreto médico, y por eso va aparte.
16. **R-41 · El plazo de 20 días hábiles ya está corriendo** para cualquier
    solicitud ARCO recibida. Esto no es sólo una reparación: si hay solicitudes
    reales pendientes, hay una obligación con fecha. El dueño es quien sabe si
    las hay.

---

## 9. Nota de método del lote 2 — qué leí y qué no

**Leí completo**: `docs/ai/NEXUSMED_AUDITORIA_PANEL_DE_LUJO_MASTER_PROMPT.md` §5
Fase 4 · `agent-state/RISK_REGISTER.md` (las ocho filas) · este archivo entero,
el lote 1, antes de escribir una línea.

**Insumo, en pares auditor↔equipo rojo** (9 pares, `crudos/`): `AS-recepcion`,
`AS-cobros`, `AS-mensajeria`, `AS-expedientes`, `P-interna`, `P-cirugia`,
`P-gineco`, `P-pediatria` y `P-ortopedia` — este último existía ya al empezar y
lo incluí, como se me encargó.

**Filtro aplicado**, idéntico al del lote 1: veredicto rojo `confirmado` o
`parcial`, con `prioridad_final` **del equipo rojo** P0 o P1; más los P2 con
`severidad` 4 o 5. Salen **32 hallazgos** de 202 veredictos. **22** abren las
once filas nuevas R-36…R-46; **10** van a §6 como evidencia de filas del lote 1
(PI-001, PI-002, PG-001, PP-001, PP-002, PC-003, PO-003 → R-20; PC-002, PG-002,
PO-004 → R-28) y no se cuentan aparte.

**Uso la prioridad del equipo rojo, también cuando me incomoda.** El rojo **subió**
ASC-001 a P0 y PO-010 de P2 a P1, y **bajó** PO-001 de P0 a P1, PC-002 y PG-002 a
P2, PC-003, PG-001, PP-001, PP-002, PO-002, PO-003, PG-003, PG-006 y PP-005 a P2.
Respeté todas. Donde no estoy de acuerdo con la **lectura** de una bajada lo digo
en el texto y no en el número (§6, urgencias declaradas).

**AS-recepcion aporta cero filas.** No es un descuido: el equipo rojo bajó sus
dos P1 a P3 con evidencia —el 500 al agendar sólo lo produce la **siembra
sintética**, porque toda alta real escribe `DEFAULT_CONFIG` entero— y ninguno de
sus P2 llega a severidad 4. Lo dejo dicho porque un lote sin filas parece un lote
sin revisar, y no lo es. Dos de sus hallazgos rozan filas existentes sin entrar
por el filtro (ASR-011, segundo expediente a un homónimo, que toca R-40 y R-24;
ASR-005, cancelar sin confirmación disparando WhatsApp): su sitio es
`12-FACILIDAD-DE-USO.md`.

**Verificación**: mientras escribía esto, la Fase 3 depositó los tres primeros
ficheros del lote —`REP-030` y `REP-031` (R-36) y `REP-032` (R-37), más
`REP-070` para el hallazgo de enfermería que aquí no clasifico—. **No hay
todavía un `SALIDA-*.txt` con su ejecución**, así que los cuento como escritos y
no como corridos: nueve de los once peligros de este lote siguen sin fichero.
Lo que sí tienen todos es verificación del equipo rojo con herramientas reales,
y la distingo de la argumentada en la tabla de detalle: **emulador de Firestore** con proyecto aparte
y borrado al terminar (ASC-001, ASC-002, ASC-003, ASC-004, PO-001), **ejecución
del motor real con jiti o node** (ASE-001, ASE-003, ASE-004, ASM-002, PI-001,
PI-002, PC-003, PP-001, PP-002, PO-003) y **recorrido en vivo con enlaces de
paciente sintéticos** (PI-004, PP-005, PO-010, PG-006). Ninguna de esas salidas
está sellada en `invariantes-clinicos.json`: **hoy no hay prueba en el árbol que
falle por ninguno de estos once peligros**, y por tanto nada impide que
reaparezcan. Eso es parte del riesgo residual de cada fila, no una nota al pie.

**No leí, y por tanto este lote no cubre**:

- El par de **enfermería**: `AS-enfermeria.json` existe (14 hallazgos, seis P1
  del auditor) y **`R-AS-enfermeria.json` no existía al escribir esto**. No
  clasifico hipótesis sin verificar: la regla del panel es que lo que dice un
  auditor simulado es hipótesis hasta que el rojo lo ancle. Dicho para que no se
  pierda, y **sin valor de riesgo asignado**: ASN-001 (el primer signo vital
  pierde una cifra) y ASN-005 (`154 lb` se convierte en 154 kg sin decirlo, que
  es el vecino directo de R-15 y de REG-013) son los dos que más probablemente
  acaben en el registro; para el primero ya hay `REP-070` escrito, y aun así no
  lo clasifico sin su veredicto rojo. Requieren su lote 3.
- **`R-ataques-propios.json`** no existe. Los ataques del propio equipo rojo
  quedan sin clasificar.
- **`reproducciones/SALIDA-ASISTENTES.txt`** no existe. Las reproducciones que
  leí son las del lote 1 (`SALIDA-P0.txt`, `SALIDA-P1.txt`), que no cubren nada
  de este lote.
- Los P2 con severidad ≤3 y los P3 de los nueve pares: fricción y mejora, su
  sitio es `12-FACILIDAD-DE-USO.md` y `08-MEJORAS-CLASE-MUNDIAL.md`.
- Los **refutados** (10 en estos pares). El rojo ya citó `archivo:línea` que los
  impide.
- **No verifiqué el código por mi cuenta**, igual que en el lote 1. Clasifico
  sobre la evidencia del auditor y la verificación del rojo; donde discrepan, uso
  la del rojo y lo digo (PC-003, PG-003, PO-001, PP-001, PP-005 y la corrección
  de PG-002 que trajo PO-004).
- **No toqué** `agent-state/RISK_REGISTER.md`, `src/`, `firestore.rules` ni
  ningún archivo fuera de este directorio, ni las filas del lote 1.

**Y lo que no hago, otra vez, porque no es mío**: no propongo arreglos, no valido
cifras clínicas, no estimo esfuerzo y **no acepto ningún residual**. Los
residuales de la §8 están **abiertos** hasta que el dueño los firme.

<!-- LOTE 2 HECHO · 2026-09-06 -->
<!-- No existían al escribir el lote 2: crudos/R-AS-enfermeria.json · crudos/R-ataques-propios.json · reproducciones/SALIDA-ASISTENTES.txt (ninguna salida de ejecución para REP-030/031/032/070, que sí aparecieron durante la escritura) -->



## Lote 3 — ataques propios del equipo rojo y oleada de cierre

Escrito por el orquestador al cierre, con el mismo criterio de los lotes 1 y 2. Un control que nadie ejecuta no es un control. **Ningún residual se acepta aquí.**

| # | Peligro | Sev | Control actual | Riesgo residual | Estado |
|---|---|---|---|---|---|
| R-47 | Nota, receta y cobro en la persona equivocada: un homónimo con teléfono funde con el expediente sin teléfono; un segundo homónimo con teléfono contradictorio elimina la evidencia antes del desempate (RT-001) | 5 | REG-039 cerró el caso espejo (sin teléfono → no funde); el motor `duplicados.ts` pregunta en otros casos | **Alto**: reproducido con el motor real (REP-080); la fusión es silenciosa | Nuevo, no liberable |
| R-48 | Un factor de mil impreso sin aviso: unidad imposible para el fármaco (digoxina en mg, enoxaparina en mcg) pasa los tres caminos de verificación (RT-003) | 5 | La compuerta de unidad sólo vigila la unidad AUSENTE; «metformina 850 g» sí alerta | **Alto**: reproducido (REP-081); las unidades válidas por fármaco son decisión clínica (NEEDS_CLINICAL_REVIEW) | Nuevo, no liberable |
| R-49 | Evidencia alucinada con aspecto de fuente en la nota firmada: una cita «[n]» sin referencia entra literal al bloque «Referencias» (RT-004) | 4 | `citasEnTexto` y `verificarAfirmaciones` existen, pero sólo corren en `/consultor` y en `expediente/evidencia`, no en el camino de la consulta | **Medio-alto**: reproducido (REP-082); lo que el modelo afirma queda con cédula debajo | Nuevo, no liberable |
| R-50 | El cruce alergia↔fármaco se apaga con una frase dicha en voz alta: prompt sin guarda anti-inyección y delimitador cerrable desde el dictado (RT-002) | 4 | La compuerta determinista de firma (`nom004.ts`) lee `alergiasDe(patient)` y no depende del modelo | **Medio**: reproducido (REP-083); el aviso del panel puede callar, la firma no | Nuevo |
| R-51 | «Tus más recetados» prellena la dosis exacta del ÚLTIMO paciente (pediátrica ↔ adulto) con un clic (ZL-001) | 3 | La pantalla de receta reverifica cada renglón contra peso y edad de ESTE paciente (REG-524); los fármacos fuera del catálogo viajan mudos (MP-004) | Medio: el control existe pero tiene el hueco de MP-004 | Nuevo |
| R-52 | Asientos que dicen «impreso» sin impresión: `receta_generada`/`orden_generada` y el aprendizaje se registran antes de que la impresión ocurra, sin reconciliación (ZL-002) | 2 | Ninguno | Bajo-medio: la bitácora afirma un hecho medicolegal que puede no haber ocurrido | Nuevo |
| R-53 | El export FHIR atribuye todas las notas a la cédula de `config/main` ignorando `nota.firma`, con tres llamadores y una ruta HTTP (ZL-003; hermano de REG-025) | 3 | `receta-certificado.ts:50-59` ya hace lo correcto para el QR | Medio: el arreglo existe al lado y no se usa | Nuevo |

Verificado en positivo y que NO entra al registro: `paquetes_visita` no expone borradores (un DRAFT ni siquiera se persiste; `liberar()` lanza sin `approvedBy`), el aislamiento entre consultorios resistió 13 de 13 intentos con las reglas reales, y las 29 rutas que aceptan `clinicId` en el cuerpo lo atan a la sesión.

<!-- LOTE 3 HECHO · 2026-09-06 -->

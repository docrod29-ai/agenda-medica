# Regression Ledger — NexusMED

Registro canónico de incidentes de seguridad/clínicos/integridad corregidos, cada uno
con su **test permanente** (o el control que lo cierra). Regla del charter: un problema
corregido no se asume corregido para siempre — cada ciclo verifica que no reaparezca.

Estados: **CLOSED** (con test/control) · **OPEN** (detectado, pendiente de reparar).

| ID | Área | Incidente | Estado | Test / control permanente |
|----|------|-----------|--------|----------------------------|
| REG-001 | Clínico | FIB-4 daba 3053.54 en vez de 3.05 (plaquetas ×10⁹/L vs /µL, error 1000×) | CLOSED | `src/__tests__/clinical-safety-harness.test.ts` (bloque FIB-4: caso exacto + robustez de unidad) |
| REG-002 | Seguridad | Cliente podía extender `trialEndsAtMs`/plan/entitlements | CLOSED | `firestore.rules` (clinics create/update congelan campos) + `src/__tests__/firestore-rules-guard.test.ts` |
| REG-003 | Dinero | `cobroExento=true` creado desde cliente sin autorización | CLOSED | `firestore.rules` appointments (exige `exentoPor==uid` + motivo) |
| REG-004 | Seguridad | `googleTokens` (OAuth) leíbles/escribibles por cliente | CLOSED | `firestore.rules` (deny read+write total) |
| REG-005 | Dinero | Monto de pago controlado por el navegador | CLOSED | Servidor resuelve monto (api/stripe, booking) — pendiente test dedicado de replay/monto |
| REG-006 | Clínico-legal | Receta/QR firmada con datos arbitrarios del cliente | CLOSED | Servidor firma datos autoritativos (fetch receta → verifica → hash) |
| REG-007 | Clínico | CKD-EPI implementada dos veces con redondeo distinto | CLOSED | `funcion-renal.ts` fuente única + re-export en `calculadoras.ts` + harness |
| REG-008 | Clínico | Thresholds de NEWS2 duplicados en la UI | CLOSED | `src/lib/hospital/news2.ts` fuente única + `src/__tests__/l6-acvpu-fhir.test.ts` |
| REG-009 | Seguridad | XSS almacenado en brazalete BCMA (servicio/cama/nombre en `document.write`) | CLOSED | Escape HTML completo en `imprimirBrazalete` (hospitalizacion/[internamientoId]) |
| REG-010 | Seguridad | Mass-assignment en `/api/appointments` y `/api/hospital/mutar` (crear) | CLOSED | Allowlist explícita de campos + autoría fijada por servidor |
| REG-011 | Datos | Corte de caja usaba tz de CDMX (día equivocado en el norte) | CLOSED | `corte-caja/page.tsx` usa `config.zonaHoraria` real |
| REG-012 | Auth | Cuenta con MFA quedaba fuera (login no manejaba `multi-factor-auth-required`) | CLOSED | `src/app/login/page.tsx` + `src/lib/mfa.ts` (resolver TOTP) |
| REG-013 | Clínico | Peso pediátrico: confusión kg/lb producía dosis peligrosa | CLOSED | `src/__tests__/peso-pediatrico-seguridad.test.ts` (hard-stop, sin heurística) + `src/__tests__/dosis-invariantes-property.test.ts` (E0-02: unidad de fármaco fail-closed, malla de pesos 0.5–120 kg, peso no positivo ⇒ sin dosis) |
| REG-014 | Seguridad-legal | Firma médica (`firmaImagenDataUrl`/`firmaPorMedico` en `config/main`, `read: isMember`) **leíble por cualquier miembro** vía SDK desde la consola del navegador → robo para estampar recetas | CLOSED (parcial) | Decisión del Dr.: la firma pasa a `config/firma` con `read/write: if isMedico`, y la regla genérica de `config` EXCLUYE ese docId (las reglas de Firestore son aditivas: sin la exclusión, la permisiva ganaba). Migración idempotente que COPIA y **borra** del general. Lector con respaldo al legado para no tirar la firma de nadie durante la transición. **Residual declarado:** un médico autenticado sigue recibiendo la imagen en su navegador porque la impresión es client-side; el ideal del Dr. («el frontend no debería recibirla nunca») exige renderizado server-side = unidad aparte. `src/__tests__/reg-015-017-cobros-notas.test.ts` |
| REG-015 | Dinero | `cobros` create no forzaba `creadoPor==uid` ni validaba `monto≥0` → cobro atribuible a otro; los llamadores mandaban identificadores inconsistentes (unos correo, otros uid) | CLOSED | Decisión del Dr.: `registrarCobro` sella `creadoPor = auth.currentUser.uid` e IGNORA lo que mande el llamador; monto no finito o <0 lanza con mensaje que apunta al reembolso tipado; regla Firestore exige `creadoPor == request.auth.uid` y `monto >= 0`. Campo `tipo` ('PAYMENT' hoy; REFUND/CREDIT/ADJUSTMENT es unidad aparte con traza a la operación original). `src/__tests__/reg-015-017-cobros-notas.test.ts` |
| REG-016 | Integridad | `clinic_review_requests` update sin `hasOnly` → al marcar `used` se pueden mutar otros campos | CLOSED | `firestore.rules` update ahora `diff().affectedKeys().hasOnly(['used','usedAt'])` |
| REG-017 | Integridad | Una nota podía nacer `estado:'firmada'`: al firmar una consulta que nunca llegó a guardarse como borrador, `firmar()` la CREABA ya firmada e inmutable, sin historia previa | CLOSED | Decisión del Dr.: toda nota nace DRAFT. `firmar()` crea el borrador y firma después (2 escrituras, trazabilidad NOM-024 intacta) + regla Firestore `create` exige `estado == 'borrador'`. La migración histórica va por Admin SDK y queda marcada como importada. `src/__tests__/reg-015-017-cobros-notas.test.ts` |
| REG-018 | Clínico | Amikacina: dosis/toma no acotada por `topeMgKgDia` → receta 50% arriba del tope seguro en 1 toma/día | CLOSED | `src/__tests__/clinical-safety-harness.test.ts` (bloque Aminoglucósidos + invariante universal porToma≤porDía) + `src/__tests__/dosis-invariantes-property.test.ts` (E0-02: property-based sobre TODO el catálogo × pesos × edades; incluye un motor MUTANTE que reproduce este bug y demuestra que la propiedad lo detecta) |
| REG-019 | Auth | WhatsApp disconnect/connect y CFDI eran any-member (podía desconectar mensajería a pacientes / timbrar) | CLOSED | Endpoints ahora `verificarMedico` (paridad con plantillas-config/voz-config) |
| REG-020 | Clínico (P0) | Corrector fonético INVERTÍA hiper↔hipo: "hipertensión"→"hipotensión", "hiperglucemia"→"hipoglucemia" (significado OPUESTO en la nota) | CLOSED | `medical-vocabulary.ts` guardián `invierteHiperHipo` + `src/__tests__/ngramas-antonimos.test.ts` |
| REG-021 | Seguridad (P1) | `/api/receta/diseno-url` acuñaba URL firmada de CUALQUIER `receta-diseno/<uid>` sin verificar dueño → robo de firma/membrete ajeno | CLOSED (parcial) | Gate misma-clínica en el minteo; residual: proxy sin firma hasta `RECETA_DISENO_FIRMA=obligatoria` (paso del Dr) |
| REG-022 | Clínico (P1) | `clasificarTFG(NaN/∞/negativo)` caía a 'G5 Falla renal' → fabricaba falla renal terminal de un dato inválido | CLOSED | `funcion-renal.ts` guard de finitud → 'TFG no disponible' |
| REG-023 | Clínico (P0) | 'no tiene/presenta/refiere X' se leía como X POSITIVO (el afirmador 'tiene' dentro del negador 'no tiene' cancelaba la negación) → dx/alergias negados marcados presentes | CLOSED | `parser-clinico.ts` estaNegado ignora afirmador precedido de no/nunca/sin + `src/__tests__/negacion-parser.test.ts` |

| REG-024 | Dinero (P0) | `payment/create-checkout` tomaba `currency` del body → 'cop' cobraba ~USD0.12 y la cita quedaba 'pagada' | CLOSED | Moneda fija 'mxn' en el servidor |
| REG-025 | Seguridad-legal (P0) | `receta/verificacion-url` firmaba certificado con cédula/folio crudos del body → forja de credencial | CLOSED | Exige `verificarMedico` + identidad y folio DERIVADOS de la nota firmada (`receta-certificado.ts`, `receta-folio.ts`); del body solo localizadores. Test de forja: `src/__tests__/receta-verificacion-url-route.test.ts` + `src/__tests__/receta-certificado.test.ts` (E0-01) |
| REG-026 | Clínico (P0) | `copiloto` usaba `ckdEpi2021` crudo → creatinina µmol/L → falla renal fantasma + contraindicaciones falsas | CLOSED | `creatininaPlausibleMgDl` en 3 sitios + test |
| REG-027 | Clínico (P0) | `gasometria`: albúmina g/L restaba ~90 al anion gap corregido; PaCO2/HCO3 negativos calculaban | CLOSED | Guard de rango albúmina [1–6] g/dL + PaCO2/HCO3 + test |

| REG-028 | Seguridad (P1) | `config/imagen` aceptaba `image/svg+xml` → SVG con <script> servido same-origin = XSS almacenado | CLOSED | Allowlist solo PNG/JPG/WEBP |
| REG-029 | Integridad (P1) | `hospital/mutar` y `registro-durable` escribían `por: p.por` del cliente → autor NOM-004 falsificable | CLOSED | Autor sellado por el servidor (`actor.nombre`) + test |
| REG-030 | Seguridad (P1) | `transcribir-diarizado` GET sin dueño → en modo prueba otra clínica leía el dictado (PHI) por UUID | CLOSED | `transcript_owners` registra dueño en POST y GET lo verifica |

| REG-031 | Clínico (P1) | Motores UCI sin guardas: num '1,200'→1.2 (glucosa=hipo falsa), NEWS2 NaN→rojo falso, ckrt/infusiones peso 0→Infinity, tendencia con delta redondeado (troponina +200%='estable') | CLOSED | `num.ts`/`news2.ts`/`ckrt.ts`/`infusiones.ts`/`tendencias.ts` + `src/__tests__/uci-guards-auditoria.test.ts` |

| REG-032 | Consentimiento (P1) | El modal de grabación afirmaba "el audio no se guarda" pero se sube a transcripción + IndexedDB → consentimiento materialmente falso | CLOSED | Texto veraz en el modal de consulta |
| REG-033 | Integridad (P1) | `configuracion` ignoraba el `error` de useConfig → formulario en blanco sin aviso y Guardar sobreescribía cédula/horario reales | CLOSED | Monta `AvisoConfigNoCargada` + bloquea Guardar si la config no cargó |

| REG-034 | Clínico (P1) | `extraerAlergias` ignoraba la negación: "niega alergia a penicilina" documentaba la alergia → alerta de reacción cruzada que BLOQUEABA la firma NOM-004 | CLOSED | `parser-clinico.ts` extraerAlergias usa estaNegado + tests |

| REG-035 | Clínico (P1) | CDS hospitalario (`cds.ts`) pasaba la alergia de texto libre CRUDA a match por subcadena → "niega alergia a penicilina" disparaba alerta 'critica' que bloquea la firma (gemelo de REG-034, otra ruta) | CLOSED | `cds.ts` filtra segmentos negados (NEG_SEG) + separa por punto + `src/__tests__/grupo-e-guardas.test.ts` (E1) |
| REG-036 | Clínico (P1) | Alertas UCI (`seguridad.ts`) con valor CENSURADO (">500", "<50", "≥6.5") → `num`=null → CERO alerta justo en el extremo crítico (hiper/hipoglucemia, K⁺ letal invisibles) | CLOSED | `seguridad.ts` wrapper local `numA` pela el comparador (censurado = aún más extremo) + `grupo-e-guardas.test.ts` (E2) |
| REG-037 | Dinero (P1) | `antibiograma-vision` cobraba el crédito SOLO en el camino feliz (tras parseo) pese a que la llamada a Claude ya se hizo → una foto en blanco corría la IA GRATIS y drenaba la llave del dueño en prueba (fail-open) | CLOSED | Cobro movido a justo tras `res.ok` (el costo ya se incurrió), independiente del parseo |
| REG-038 | Clínico (P1) | Números dictados ≥100 en palabras ("ciento veinte", "doscientos cincuenta") → `enteroEs` (0–99) devolvía null → el valor de glucosa/TA/plaquetas/PaO₂ se PERDÍA en silencio del Panel UCI | CLOSED | `comandos-uci.ts` centenas 0–999 + `\b` en el regex de extracción (evita capturar "cien"⊂"ciento") + `src/__tests__/numeros-palabras-uci.test.ts` |
| REG-039 | PHI (P1) | Agendar desde el asistente SIN teléfono fundía por nombre con un homónimo que SÍ tiene teléfono distinto → cita y expediente (antecedentes/alergias) bajo la persona equivocada | CLOSED | `asistente/page.tsx` elimina el disyunto `!tel` — sin teléfono ya no funde con un homónimo con teléfono |
| REG-040 | Seguridad-legal (P1) | `firmar()` de consulta no comprobaba `pacienteError`/`errorCargaNota` → un parpadeo de red permitía firmar una nota INMUTABLE con `pacienteNombre=''` y `alergias=[]` (cross-check apagado) | CLOSED | Compuerta de lectura en `firmar()` (bloquea + avisa) + toast en el guardado manual |
| REG-041 | Clínico (NEEDS_CLINICAL_REVIEW) | Contradicción entre los dos catálogos de dosis: `FARMACOS_PED` emite Amoxicilina 45 × peso mg/toma (>1000 mg desde ≈22.3 kg; 1500 mg/toma desde 33.4 kg) mientras `CATALOGO` de `seguridad/dosis.ts` declara `maxTomaMg: 1000` → `revisarDosis` marca como CRÍTICA la receta que el motor pediátrico acaba de emitir (igual en Amoxicilina-clavulanato, que se dosifica por el componente amoxicilina) | CLOSED | **Decisión del Dr. (2026-07-28, `docs/clinical-decisions/dosis-amoxicilina.md`): cambió el MODELO, no el número.** 1000 mg/toma y 3000 mg/día = máximo HABITUAL; 2000 mg/toma y 4000 mg/día = ABSOLUTOS. Entre ambos: `dosis_alta_verificar` (no crítica). Tests: `dosis-decision-amoxicilina.test.ts` + P6 en en `src/__tests__/dosis-invariantes-property.test.ts` (P6): el hallazgo es visible, una contradicción NUEVA rompe el CI, y P6-bis exige quitar la excepción en cuanto se resuelva. **No se eligió techo: es criterio clínico.** |
| REG-042 | Clínico (NEEDS_CLINICAL_REVIEW) | El redondeo del motor pediátrico es AL MÁS CERCANO (`Math.round(x*10)/10`), no hacia abajo: el total diario puede quedar hasta `0.05 × tomas` por ENCIMA del tope (Metronidazol @66.7 kg → 2000.1 vs 2000; Gentamicina neonatal @51.3 kg → 256.6 vs 256.5) | CLOSED | **Decisión del Dr.: redondear HACIA ABAJO cuando el redondeo excedería un tope** (CLAMP→ROUND→RE-CHECK→FLOOR en `pediatria.ts`). `TOL_REDONDEO = 0`. Antes: (`TOL_REDONDEO = 0.05`, medio paso de redondeo, derivada no elegida) en `src/__tests__/dosis-invariantes-property.test.ts`. Si el Dr. exige redondeo hacia abajo al tocar un tope, la constante pasa a 0 y cambia el motor (fuera del alcance de E0-02). |
| REG-043 | Clínico (NEEDS_CLINICAL_REVIEW) | 20 de los 25 fármacos de `FARMACOS_PED` no existen en el `CATALOGO` adulto ⇒ `revisarDosis` devuelve `sin_referencia` y NO impone techo alguno al prescribirlos a un adulto | **OPEN** — estructura lista, faltan los datos del Dr. | El Dr. aprobó ampliarlo, pero NO con un `maxDose` único: los máximos cambian por indicación, vía, renal y formulación. Implementado el eje usual/hard; faltan los campos restantes y la tabla por fármaco. | Hecho anclado en `dosis-invariantes-property.test.ts` (P6: el conteo 20 es fail-closed suave; ampliar el catálogo obliga a releer la pregunta). Ampliarlo requiere `maxTomaMg`/`maxDiaMg` aportados por el médico: **no se derivan** de las cifras pediátricas. |

> Mantener este archivo actualizado en cada ciclo del loop de auditoría. Cada `OPEN` debe
> pasar a `CLOSED` con su test/control antes de cerrar el lote correspondiente.

| REG-044 | Clínico (P0) | CMI CENSURADA descartada: `interpretarCMI` recibía el número pelado y el operador `cmiCensurada` (que el modelo SÍ guardaba) se perdía en `motor.ts` → neumococo penicilina «>2» se leía como 2 y salía **S = tratable con penicilina**; igual en β-lactámicos de reserva («>8» en CAZ-AVI → S falso) | CLOSED | Decisión del Dr. E0-15c: una CMI es un INTERVALO. `interpretarCMI(..., censura)` — con «>» y valor ≥ sMax, S es imposible (no se sube a R: el valor real puede estar en la banda intermedia). `desdeCmiCensurada` explica el porqué. `src/__tests__/e0-15-antibiograma-decisiones.test.ts` |
| REG-045 | Clínico (P1) | Carbapenémico + alergia a penicilina se marcaba **crítica** → bloqueaba la primera línea en sepsis y meningitis, donde el retraso mata más que el riesgo evitado | CLOSED | Decisión del Dr. E0-15d: reactividad cruzada <1% (AAAAI/ACAAI 2022, ~0.87% en metaanálisis) ⇒ PRECAUCIÓN. Vuelve a crítica con alergia al propio carbapenémico, SCAR (SJS/TEN, DRESS, AGEP) o daño de órgano. Penicilinas y cefalosporinas siguen críticas (probado) |
| REG-046 | Clínico (P0) | La edición interpretativa EUCAST (fluoroquinolonas S→R por resistencia cruzada) vivía SOLO en `edicionesInterpretativas`: la nota, el prompt del LLM, el validador y el PK/PD seguían leyendo el panel CRUDO → cada salida mostraba la «S» que el propio motor ya había declarado R, y el PK/PD aconsejaba «dosis plena» de un fármaco descartado | CLOSED | Decisión del Dr. E0-15a: la interpretación editada es CANÓNICA en todas las salidas, sin destruir el original. `aplicarEdicionesInterpretativas` + `resultadosEfectivos` (motor) consumido por razonar/validar/resumen-nota/PK-PD; `interpretacionLab` conserva el dato del laboratorio. `src/__tests__/e0-15-antibiograma-decisiones.test.ts` (bloque E0-15a) |
| REG-047 | Clínico (P1) | `resumen-nota` descartaba en silencio las alertas de nivel `alta`: solo pasaban las `critica`, así que una alerta que el motor consideró relevante desaparecía del documento clínico | CLOSED | La nota imprime críticas y altas, separadas para conservar la jerarquía |
| REG-048 | Integridad (P1) | `contradiccionesSegundaOpinion` viajaba del servidor al cliente y el cliente la DESCARTABA: la segunda opinión (GPT-5) se mostraba sin su caja roja aunque el validador ya hubiera detectado que contradice al motor | CLOSED | `antibiograma/page.tsx` lee y renderiza el campo |
| REG-049 | Clínico (P0) | `estado()` devuelve `null` tanto si el fármaco NO SE PROBÓ como si no aplica. En Enterobacterales la guarda «ertapenem-aislado» exigía imipenem **S explícito**: con un panel mero+erta (sin imipenem) una *E. coli* erta-R/mero-S caía a la clasificación de carbapenemasa y salía como **MBL + NOM-045 + aislamiento** a partir de un dato que nadie midió | CLOSED | Decisión del Dr. E0-15b: MISSING ≠ R · MISSING ≠ S · MISSING → UNKNOWN. Fenotipo `carbapenemasa-indeterminada` + `EstadoCarbapenemasa {resistenciaSospechada, confirmada:false, clase:'UNKNOWN'}`. NO se emite NOM-045 ni aislamiento desde el dato faltante: las medidas derivan del mecanismo realmente identificado. `src/__tests__/e0-15-antibiograma-decisiones.test.ts` (bloque E0-15b) |
| REG-050 | Clínico (P0) | Gemelo en *P. aeruginosa*: `otrosBetaR` usaba `ES_R(...)`, falso tanto si la cefalosporina es S como si NO se probó → carbapenémicos R con el panel sin ceftazidima/cefepime/pip-tazo se degradaba a «porina + bomba» (benigno) y SUPRIMÍA la alerta crítica, la NOM-045 y el aislamiento | CLOSED | Solo se degrada si las cefalosporinas están PROBADAS y conservadas; si no, mecanismo INDETERMINADO con petición explícita de completar el panel |
| REG-051 | Integridad / CI (E0-11) | El CI corría `npx vitest run`, que mide **los tests que quedan**, no **los que deben existir**: seguía en verde si alguien borraba `clinical-safety-harness.test.ts`, le ponía `describe.skip` a la dosis pediátrica, dejaba un `it.only` que excluía al resto del archivo, o vaciaba un invariante dejando un `it` verde. Un invariante clínico se podía apagar sin que nada chillara | CLOSED (parcial) | Metagate E0-11: el conjunto protegido se **deriva** de `CLINICAL_ENGINE_REGISTRY[].goldenTests` ∪ los tests citados en este ledger ∪ 3 metagates (78 archivos), se congela en `src/lib/clinical/invariantes-clinicos.json` con trinquete **monótono** (la cobertura sube libre, bajar rompe el CI) y se verifica en `src/__tests__/clinical-safety-gate.test.ts` (existencia · desactivación · conteo · sincronía con las fuentes · job `clinical-safety` presente en `ci.yml` · autotest de las regex). **Residual declarado:** el gate *avisa* pero aún no *bloquea el merge* — eso exige *required status checks* en `main`, que es consola de GitHub, no código (`docs/pendientes-externos.md` §3). Doc: `docs/ci/clinical-safety-gate.md` |
| REG-052 | Integridad clínico-legal (E0-09) | El MAR y las órdenes NO llegaban al libro append-only: `registroDurable` devolvía `null` para `administrar`, `indicacion_agregar`, `indicacion_suspender` y `verificar_farmacia`, así que una dosis administrada vivía **sólo** dentro del array anidado `indicaciones[].administraciones[]` del doc de internamiento — que escribe el Admin SDK (las Firestore Rules no pueden protegerlo por diseño) y que, a diferencia de `balanceHidrico`/`escalas`/`sbar`, **no tiene tope**: una estancia larga acerca el doc al límite de 1 MB y el modo de falla es perder escrituras del MAR | CLOSED (parcial) | E0-09: `registroDurable` emite `EventoClinico` tipado para MAR y órdenes con `detalle` por **lista blanca** (anti mass-assignment en un registro legal permanente) y `por`/`fecha` sellados por el servidor; partición explícita `ACCIONES_CON_EVENTO_DURABLE` / `ACCIONES_SIN_EVENTO_DURABLE` con la razón escrita de cada descarte, verificada contra los `GATES` reales de `api/hospital/mutar/route.ts` → una acción nueva sin clasificar rompe el CI. `src/__tests__/hospital-eventos-append-only.test.ts` + `src/__tests__/hospital-registro-durable.test.ts`. **Residuales declarados:** (1) el array del doc sigue siendo caché sin tope — migrarlo toca censo, ficha, NEWS2, conciliación y export FHIR: unidad aparte; (2) `indicacion_alta` no lleva `indicacionId` porque el id lo acuña `patch()` con `randomUUID` (enlazarlos exige tocar la ruta); (3) una orden prescrita y BORRADA antes de administrarse no deja huella en el libro: es decisión de expediente, no derivable del código |
| REG-053 | Integridad clínico-legal (E0-09, NEEDS_CLINICAL_REVIEW) | Un signo vital se puede SOBRESCRIBIR desde el cliente (`firestore.rules`, `match /signos/{signoId}` → `allow read, create, update: if isClinicoHospital`): una SpO₂ anterior desaparece sin rastro, que es literalmente "editar un evento sellado". Y al revés, la ficha ofrece el botón "Borrar registro mal capturado" que **no puede funcionar** en producción: `deleteDoc` choca contra `allow delete: if false` y cae en el catch | **OPEN** — estructura lista, falta la decisión del Dr. | El `update` NO es un descuido: las propias reglas lo documentan como decisión de la auditoría maestra 2026-07 ("enfermería corrige en el sitio, pero nadie borra"). Cerrarlo REVIERTE esa política → **E0-09/Q5**. Andamiaje listo y probado sin tocar las reglas: `RegistroSignos.corrigeA`/`motivoCorreccion`, `proyectarSignos` (marca, no elimina; cadenas, ciclos y correcciones huérfanas) y la validación `validarCorreccion` parametrizada por política. Anclado en `src/__tests__/hospital-eventos-append-only.test.ts` (bloque Q1 fail-closed) y en `src/__tests__/firestore-rules-guard.test.ts` (fija lo que YA rige: doc de internamiento cerrado al cliente, `signos delete: if false`, `registros` no escribible) |

| REG-054 | Seguridad (P1, E0-10) | La lista de rutas privadas de `next.config.ts` se había desincronizado del árbol de `src/app/(dashboard)/`: **22 de 34 pantallas de la zona autenticada viajaban SIN `X-Frame-Options` ni `frame-ancestors`** — entre ellas `/uci`, `/hospitalizacion` y `/receta` (renderizan PHI) y `/superadmin` (consola del dueño). Cualquier sitio podía embeberlas en un iframe invisible y hacer clickjacking sobre la sesión del médico. **Medido por comparación estática** de la lista de `next.config.ts` contra los directorios reales de `src/app/` y `src/app/(dashboard)/`: de 34 pantallas privadas, el regex viejo cubría 11 y dejaba fuera **23**; además nombraba 5 rutas fantasma que ya no existen (`equipo`, `reportes`, `usuarios`, `valoracion`, `nueva-consulta`). **La medición contra producción SÍ ocurrió** y su evidencia está en disco: `test-results/.last-run.json` (28-jul 22:37, `status: failed`, **22** `failedTests`) y **22** directorios `seguridad-A3-*` — uno de ellos de `waitlist`, ruta fantasma retirada DESPUÉS en REG-058, lo que prueba que la corrida es anterior a ese arreglo. ⚠️ **Historial de esta fila, para que no se repita:** (1) el agente que la escribió citó «22 rojos, 12 verdes» mientras su propio `RESULTADO.json` decía que no había corrido playwright — contradicción interna; (2) el 29-jul yo «corregí» la fila afirmando que la ejecución **nunca ocurrió**, sin mirar `test-results/`: eso fue una segunda falsedad, en dirección contraria; (3) el 30-jul se verificó el disco y se restauró el hecho. Nota aparte: esa corrida violó la regla 8 (un agente ejecutó playwright contra producción), y eso también queda registrado. Los 22 rojos medidos y las 23 pantallas del conteo estático NO son el mismo número: el estático compara la lista contra los directorios de rutas, el E2E probó las que la matriz enumeraba | CLOSED en código, **PENDIENTE DE DESPLIEGUE** (regla 6: el agente no despliega) | Lista movida a `src/lib/security/rutas-privadas.ts` (fuente única, sin rutas fantasma) y consumida por `next.config.ts`. Invariante que impide la reincidencia: `src/__tests__/csp-guard.test.ts` cruza la lista contra los directorios reales de `(dashboard)` → una pantalla nueva sin protección tumba el CI. Matriz E2E parametrizada en `e2e/seguridad.spec.ts` (grupo A3) |
| REG-055 | Seguridad (P2, E0-10) | Pasar la CSP global de report-only a enforce **degradaba** la seguridad por un efecto colateral: al renombrar la cabecera, la regla global y las reglas por-ruta de `frame-ancestors` pasan a compartir clave y Next se queda con la ÚLTIMA. Como el bloque global iba después, la zona autenticada habría perdido `frame-ancestors 'none'` (quedándose sólo con `X-Frame-Options`) y `/reservar` habría perdido su `frame-ancestors *` explícito | CLOSED | `next.config.ts`: política parametrizada por zona (`politicaCsp`), bloques reordenados de general a específico, y en report-only se emiten DOS cabeceras para que `frame-ancestors` siga siendo *enforce*. Probado en los dos modos por `src/__tests__/csp-guard.test.ts`, que construye la configuración de cabeceras con y sin `CSP_MODE=enforce` y comprueba el orden. ⚠️ **NO** está verificado en HTTP real: una versión previa de esta fila afirmaba haberlo comprobado con `CSP_MODE=enforce npm run build && npm start`, y esa ejecución nunca ocurrió. El «gana la última cabecera» está leído del código de Next (servidor Node), **no** confirmado en el proxy de Vercel que sirve producción — riesgo residual real si ese proxy acumulara en vez de reemplazar. Corregido el 29-jul-2026. **Tamaño real del riesgo residual, acotado el 29-jul-2026:** si el proxy acumulara, el navegador aplicaría la INTERSECCIÓN de las dos políticas, lo que sólo daña a las rutas cuya política específica declara orígenes que la global no tiene. Recorridas las 8 reglas de `next.config.ts`, ese conjunto es **exactamente tres** y todas por `ORIGENES_META`: `/` y `/registro` (Pixel) y `/configuracion` (SDK del alta de WhatsApp) → el modo de falla sería «el Pixel no mide y el alta de WhatsApp no carga»: visible, no silencioso, reversible en 2 min. Para `frame-ancestors` **no hay riesgo en ninguna de las dos semánticas**: la política global OMITE la directiva y una política sin `frame-ancestors` no restringe el encuadre, así que la intersección con `'none'` sigue siendo `'none'` y con `*` sigue embebible. El conjunto de tres rutas queda CONGELADO en `src/__tests__/csp-guard.test.ts` (un cuarto bloque con política más ancha tumba el CI) y el runbook `docs/seguridad/csp-enforce.md` §3 añade el paso 0: un `curl -sI` a un preview para contar cuántas cabeceras CSP llegan de verdad |
| REG-056 | Privacidad (P2, E0-10) | Tres orígenes que el navegador carga hoy NO estaban en la política: `unpkg.com` (worker de pdf.js → con enforce se cae subir PDF de laboratorio, antibiograma por foto y receta por visión), `https://*.daily.co` (iframe de teleconsulta → saldría en blanco) y `connect.facebook.net` (Pixel + alta de WhatsApp). Apretar a enforce a ciegas los habría roto en silencio | CLOSED | Los tres declarados en `next.config.ts`; Meta con alcance **por ruta** (`/`, `/registro`, `/configuracion`), nunca global, porque `MetaPixel.tsx:3-6` exige que Meta no vea URLs con IDs de paciente. Invariante nuevo: el escáner de `src/__tests__/csp-guard.test.ts` cruza las posiciones de carga del navegador (`workerSrc`, `.src=`, `src=`, `importScripts`) contra la política y falla si aparece un host no declarado |
| REG-057 | UX / primera impresión (P1) | `OnboardingTour.tsx:77` mandaba al médico recién registrado a `router.push('/agenda')` al terminar el tour de bienvenida, y **no existe ninguna página en `/agenda`**: la pantalla que el menú rotula «Agenda» vive en `/calendario` (`BottomNav.tsx:26`). Lo primero que veía un cliente nuevo después de «bienvenido» era un 404. Latente desde que se escribió el tour; nunca lo vimos ni el Dr. ni yo | CLOSED | Destino corregido a `/calendario`. **Lo cazó el candado de rama en su PRIMER pull request** (PR #2): `csp-guard.test.ts` cruza `RUTAS_PRIVADAS` contra el árbol real de páginas y `agenda` no tenía ninguna |
| REG-058 | Higiene de invariantes (P2) | El guardián de rutas privadas pasaba en local y fallaba en CI. La causa NO era el CI: `src/app/(dashboard)/agenda` y `.../waitlist` existían en el disco del Dr. como carpetas **vacías**, y git no versiona carpetas vacías → en un checkout limpio no existen. Un invariante que depende de que una carpeta exista en el disco de alguien es un invariante que miente | CLOSED | Las dos salen de `RUTAS_PRIVADAS` (`waitlist` era ruta fantasma: la página real es `lista-espera`, ya listada; `/api/whatsapp/waitlist-notify` es API, no pantalla) y las carpetas vacías se borraron. **Control negativo ejecutado**: al devolver `agenda` a la lista el test se pone rojo con el mensaje correcto. Lección: el CI en checkout limpio es la fuente de verdad, no el disco local |
| REG-059 | Integridad clínico-legal (P1, E0-12) | El sello SHA-256 de la nota firmada (NOM-024) sólo cubría **10 de los 26 campos** de `NotaMedica`. Quedaban FUERA del hash, entre otros: `preop` (los puntajes de riesgo quirúrgico de una valoración preoperatoria firmada), `hospital`, `infectologia` (día de antibiótico, desescalada — PROA/NOM-045), `iaAuditoria.provenance` (con qué modelo se generó la nota y si el médico la revisó de verdad), `transcripcionCruda`/`dialogoDiarizado` (la FUENTE re-proyectable del expediente), `resumenEjecutivo`, `secciones[].label` (v2 sellaba sólo `{key,value}`, y el documento IMPRIME el label: cambiar «Objetivo» por «Subjetivo» cambiaba lo que la nota afirma), `estudiosOrden`, `internamientoId`, `pacienteNombre` y el encabezado medicolegal (`cedulaProfesional`, `establecimiento`, `fuenteGeneracion`). Alterar cualquiera de ellos en una nota FIRMADA y la pantalla seguía diciendo «integridad verificada»: la alteración era detectable sólo en la mitad del documento. El vector real no es el médico editando desde la app (`firestore.rules:189` se lo impide) sino escritura por Admin SDK/consola/import, un bug futuro que reescriba una firmada, o credenciales comprometidas — exactamente los escenarios para los que existe el hash | CLOSED | Sello **v3** (`HASH_VERSION = 3`) que cubre todo el contenido firmable, con `canonicoV2` **CONGELADO** y despacho por versión declarada: cada nota se re-verifica con el algoritmo de SU sello, así que **cero notas cambian de estado** por este cambio (una v2 sigue `verificada`, no se degrada a `legado`). Partición explícita `CAMPOS_SELLADOS_V3` / `CAMPOS_NO_SELLADOS_V3` **con la razón escrita de cada exclusión** (`id` lo sobrescribe `normNota` con el doc.id; `firma`, `fechaModificacion`, `updatedAt`, `version` se mueven DESPUÉS del hash; `estado` porque cancelar es legítimo) + trinquete: `Record<keyof NotaMedica, true>` hace que **`tsc` falle** si alguien añade un campo al tipo, y el test obliga a clasificarlo → un campo firmable no vuelve a nacer fuera del sello, que es lo que le pasó a `preop`. Ataque de degradación cerrado: se sella el literal `v: 3`, así que bajarle `hashVersion` a 2 sale `alterada`. **Migración: NO se re-sella ninguna nota firmada** — recalcular hoy el hash de una nota firmada en mayo afirmaría sobre contenido observado hoy (fabricar evidencia) y bendeciría la alteración que el sello debe delatar; la población v2 se extingue sola y mientras coexista la pantalla DECLARA qué no cubre ese sello (aviso neutro `no-print`, sin alarma). Corrección de una nota v2 = **adenda**, el mecanismo legal que ya existe. `src/__tests__/e0-12-sello-integridad.test.ts` (aceptación + 35 mutaciones detectables + 6 negativos de cambio legítimo + round-trip Firestore simulado + vector GOLDEN de v2) y `src/__tests__/integrity.test.ts` (prueba de que v2 no se movió). **Residuales declarados:** `hashFirma` sigue sin cubrir el nombre/cédula del bloque `firma` (detectable por contradicción con la metadata sellada, no por el hash); `estado`/`version` fuera a propósito (los vigila el log de auditoría); notas v1 siguen no re-verificables; y la «constancia de estado observado» para el histórico (subcolección `sellos/`) queda como PROPUESTA al dueño: es semántica legal del expediente, no derivable del código |
| REG-060 | Integridad clínico-legal (**P0, desplegado y corregido el mismo día**) | El sello v3 marcaba **«ALTERADA»** una nota firmada LEGÍTIMA. Camino real del médico: dicta → autoguardado → **vacía el cuadro del dictado** → firma. El hash se calcula con `transcripcionCruda: null`, pero al escribir, `stripUndefined` quita la llave (Firestore RECHAZA `undefined`, así que quitarla es correcto en sí) y `updateDoc` hace **MERGE**, que no borra lo ausente: el texto viejo SOBREVIVE en Firestore mientras el sello se calculó sobre `null` → al reabrir, alarma roja falsa. Es el modo de falla que este sello existe para no tener nunca, y afecta a los 9 opcionales que v3 cubre. **Reproducido con el código real antes de tocar nada.** Llegó a producción en v707 porque el commit de E0-12 viajó dentro de un despliegue pedido para otra cosa (la receta) | CLOSED en v709 | `normalizarParaSello()` (integrity.ts) convierte en `null` EXPLÍCITO los 9 opcionales sellados, y el flujo de firma **sella y escribe el MISMO objeto**: con la llave presente, `updateDoc` sobrescribe el valor viejo. `src/__tests__/reg-060-sello-merge-updatedoc.test.ts` (16 casos) simula el **merge de `updateDoc`**, no `setDoc`: los 9 campos uno por uno, el caso normal, que un valor real NO se vuelva null, que el normalizador no mute la entrada, y un **control negativo** que reproduce «alterada» sin el arreglo. **POR QUÉ EL SUITE DE E0-12 ESTABA VERDE:** su round-trip escribía la nota como documento COMPLETO (`setDoc`); el flujo real usa `updateNota` → `updateDoc`. Un test que simula una escritura DISTINTA a la de la app puede estar verde con el defecto abierto en producción |
| REG-061 | Proceso (P1, sin código) | Un despliegue pedido para un cambio puntual (la fecha de nacimiento en la receta) arrastró **todo lo demás que había en la rama**, incluida la regresión de REG-060 producida por el programa autónomo. El paquete no se revisó antes de publicar | CLOSED como regla | Antes de `vercel --prod`, revisar `git log origin/main..HEAD` y declarar QUÉ va en el paquete además de lo pedido. Un despliegue no es «lo último que hice», es «todo lo que no estaba en producción» |
| REG-062 | Higiene de invariantes (P2) | El escáner de iframes dinámicos del guardián de CSP tenía una cota `{0,400}` en su regex, y esa cota era un ESCAPE: un tag de apertura de más de 400 caracteres —nada raro en JSX con estilos y props en línea— quedaba invisible, así que un `src={url}` con origen no declarado pasaba en verde. Demostrado por la verificación adversarial de E0-10 (mutante M3b: 23/23 verde con el hueco abierto) | CLOSED | Cota retirada: `<iframe[^>]*>` no puede cruzar el cierre del tag, así que no hacía falta acotar nada. `src/__tests__/csp-guard.test.ts` gana 5 casos de CONTROL POSITIVO del propio escáner — incluido uno con tag de 500 caracteres y uno que falla si alguien le vuelve a poner una cota (`RE_APERTURA_IFRAME.source` no debe contener `{n,m}`) |
| REG-062 | Seguridad (P2, E0-10) | `/login` —la pantalla de credenciales— quedaba fuera de la lista de rutas privadas, así que viajaba **sin `X-Frame-Options` ni `frame-ancestors`**: cualquier sitio podía embeberla en un iframe invisible y hacer clickjacking sobre el formulario de acceso (el usuario cree teclear en otro sitio y entrega usuario y contraseña). No es una regresión de E0-10 —era así desde siempre— sino un hueco que la unidad tenía delante y no nombró; lo encontró su verificación adversarial (V-7a) | CLOSED en código, **PENDIENTE DE DESPLIEGUE** (regla 6: el agente no despliega) | `login` entra en `src/lib/security/rutas-privadas.ts` → `/login` pasa a devolver `X-Frame-Options: DENY` + `frame-ancestors 'none'` (esta última **ya es enforce hoy**, no espera el flip). Único consumidor de iframes hacia dentro de la app en todo el código: el snippet de `/reservar` que el consultorio pega en su web, que no toca `/login`. Invariante: `src/__tests__/csp-guard.test.ts` exige `login` en la lista de forma explícita (los otros casos sólo miran `src/app/(dashboard)/`, así que sin ese caso quitarlo no rompería nada) |
| REG-063 | Pérdida de datos clínicos (P0, ICU-003) | Las lecturas seriadas del **Panel UCI vivían SÓLO en `localStorage`**, con tope de 24, en `nx.uci.lecturas.<internamientoId>`. Sin copia en el servidor: no hay expediente longitudinal (el objetivo central del charter), otra guardia u otro dispositivo NO ven nada, el cierre de sesión las PURGA —correcto para PHI, pero el dato se pierde para siempre—, las tendencias y el Morning Brief se calculan sobre ≤24 puntos locales, y nada de eso es auditable ni NOM-024. Medido en la auditoría ICU-001 (`uci/page.tsx:261,277-281`) | CLOSED en persistencia · **PENDIENTE el cableado del panel** | `src/lib/uci/observaciones.ts`: subcolección `icu_observations` append-only, con la TOMA como unidad (el panel captura todas las medidas juntas = un `observationSetId` de la decisión ICU-Q4.1) y cota de lectura 200, la misma razón que `getSignos`. **El append-only se hace cumplir EN LA REGLA**, no sólo en el código: `firestore.rules` permite `update` sólo si `affectedKeys().hasOnly(['estado'])`, así que una toma se marca como corregida pero sus MEDIDAS son inmutables — no se puede reescribir un valor clínico haciéndolo pasar por corrección. `delete: if false`. La corrección de verdad es un documento NUEVO con `corrigeA` que HEREDA la hora del hecho (requisito C2 de ICU-Q3). Invariante: `src/__tests__/icu-observaciones-persistencia.test.ts` (15 casos, con control negativo que quita el `hasOnly` y se pone rojo). **Residual declarado:** el panel todavía escribe sólo a `localStorage`; el cableado será con escritura DOBLE para que un fallo de reglas o de red no rompa el comportamiento de hoy |
| REG-063 | Higiene de evidencia (P2, E0-10) | El propio guardián de la CSP afirmaba en su comentario de cabecera haber cazado los **tres** agujeros de la política, y era falso para uno: el iframe de teleconsulta monta un `src` DINÁMICO (`src={url}` con la URL de la sala que devuelve `/api/telesalud/sala`), así que el host `*.daily.co` **no aparece en el código** y ninguna de las 5 regex de posiciones de carga podía verlo. Mutante que sobrevivía (reproducido): quitar `https://*.daily.co` de `ORIGENES_FRAME` y de la lista congelada dejaba el CI **verde** y la videoconsulta en blanco bajo enforce. Una red de seguridad que se sobrevende es peor que no tenerla | CLOSED | Registro explícito `IFRAMES_DE_ORIGEN_DINAMICO` (archivo · origen · por qué) atado a la directiva `frame-src` de la política, más un **trinquete** que escanea `<iframe` en todo `src/**` y exige que cualquier `src` no literal esté declarado o exento con motivo. **Controles negativos ejecutados:** (1) quitar `*.daily.co` de `ORIGENES_FRAME` → rojo «frame-src no permite una-sala.daily.co»; (2) añadir un `<iframe src={u}>` nuevo sin declararlo → rojo por el trinquete. Y la frase del comentario queda corregida. `src/__tests__/csp-guard.test.ts` |

| REG-064 | Reconocimiento de voz (P1, medido en el corpus de 498) | El prompt que sesga al transcriptor iba en **~242 tokens** cuando el modelo lee sólo los **últimos ~224**: el principio se truncaba **EN SILENCIO** — exactamente el modo de falla contra el que avisaba el propio comentario del archivo desde una regresión anterior. Y peor: **no contenía NI UNA palabra de cuidados críticos** (ni CVVHDF, ni PEEP, ni ECMO, ni RASS, ni VExUS), porque estaba escrito para consulta externa. Por eso el corpus de UCI del Dr. daba **WER 24.4 %** y **Acronym Recall 89.1 %**: el sesgo apuntaba a fármacos de consultorio mientras el médico dictaba un pase de terapia | CLOSED | Prompt **por contexto**: `WHISPER_PROMPT_MEDICO` (consulta, 205 tokens) y `WHISPER_PROMPT_UCI` (críticos, 214 tokens). Mandar los dos juntos no cabe, y diluir el sesgo con vocabulario de otro dominio es peor que no sesgarlo. La ruta `/api/expediente/transcribir` acepta `contexto` y el hook de grabación lo propaga; el Panel UCI declara `contexto: 'uci'`. Lo más crítico va al **final** del prompt porque el modelo lee los últimos tokens. **Medido antes y después sobre los mismos 498 audios:** WER 24.4 % → **11.9 %**, Acronym Recall 89.1 % → **99.4 %**, Clinical Term Recall 94.1 % → **99.4 %**. Invariante: `src/__tests__/whisper-prompt-presupuesto.test.ts` (7 casos) falla si cualquiera de los dos prompts se pasa del presupuesto, si el de UCI pierde los términos que se midieron fallando, o si lo crítico deja de estar al final. Un caso comprueba además que cubre el DOMINIO y no sólo los 7 errores del dataset — sesgar únicamente hacia lo que falló sería sobreajustar al corpus |

| REG-065 | Pérdida de dato clínico (**P0**, en producción desde siempre) | **Nuestro propio corrector se comía las DOSIS.** El pase de n-gramas existe para reunir fármacos que el reconocedor parte (`em pagli flozina` → empagliflozina); el fonético de `meropenemdos` casa con `meropenem`, así que fusionaba «Meropenem **dos**» → «Meropenem» y **la cifra desaparecía de una transcripción que era CORRECTA**. Durante toda la investigación del corpus de 498 se creyó un fallo del reconocedor —6 de 6, las tres voces, incluso con la frase palabra por palabra en el prompt—; al probar los TRES modelos por separado, los tres devolvían el «dos». **Barrido de 64 fármacos × 18 números = 1152 combinaciones: 131 se destruían**, no sólo meropenem — vancomicina, ceftriaxona, linezolid, cefepime, ertapenem, daptomicina. Lo peligroso no es que falte la dosis: es que «Meropenem gramos cada ocho horas» se lee como una orden completa. Lo levantó el Dr. al preguntar «¿eso pasa sólo con meropenem? porque TODOS los fármacos se ajustan» | CLOSED | Dos guardas estructurales en `corregirNGramas`: (1) **nunca fusionar una ventana que contenga una CANTIDAD** —cifra o número escrito— porque un fragmento de nombre de fármaco es un trozo sin sentido, nunca un número; (2) **nunca fusionar si la primera palabra ya es un término válido** —un fármaco partido empieza por un fragmento (`em`, `pagli`), no por su propio nombre completo—. El fusor sigue haciendo su trabajo: `em pagli flozina` → empagliflozina, verificado en el mismo test. `src/__tests__/reg-065-corrector-come-dosis.test.ts` (25 casos) incluye el barrido de fármacos, las dosis de PRISMA/CKRT/citrato y el control de que el fusor no se desactivó. **Medido antes y después en los 498 audios: Number Accuracy 98.7 % → 100 %, Critical Semantic Error Rate 1.2 % → 0.2 %** |

| REG-066 | Pérdida de dato clínico (P1, en producción) | **El mismo fusor de n-gramas destruía términos que ya estaban BIEN escritos.** Hermano de REG-065, encontrado el mismo día por un camino distinto: pasando el corpus **V3 de 7 000 audios** —que el pipeline no había visto nunca— por la regresión de texto. «Neuro-UCI: NIRS cerebral en monitorización» salía «Neuro-UCI: **Precerebral** en monitorización» (desaparece el nombre del monitor); «problema activo parálisis facial periférica» salía «problema **acroparalysis** facial periférica»; «problema activo anestesia general» salía «problema **acroanesthesia** general». El guardián de sustituciones NO podía verlo: no cambió ninguna cifra, ni unidad, ni negación, ni lateralidad. Y ninguno de los tres tiene relación con los siete errores medidos en el corpus de 498 — por eso hacía falta un corpus desconocido | CLOSED | Dos guardas estructurales más en `corregirNGramas`: (1) **una palabra en MAYÚSCULAS es una sigla escrita a propósito**, no un fragmento de fármaco partido → la ventana no se fusiona; (2) **una fusión repara un ESPACIO**, así que el candidato debe medir casi lo mismo que la unión (Δ longitud ≤ 1 en el modo de fusión, contra ≤ 3 del pase palabra-por-palabra). La distancia sola NO separaba los casos: medidos, `activoparalisis→acroparalysis` y `empaqlinfosina→empagliflozina` están los dos a distancia 3; lo que los separa es que el primero pierde dos letras y el segundo ninguna. Además la guarda de REG-065 pasa de mirar la PRIMERA palabra a mirar TODAS (el término destruido estaba en segunda posición). `src/__tests__/reg-066-ngramas-destruyen-terminos.test.ts` (7 casos, con control de que el fusor sigue reuniendo `em pagli flozina` y `platano pros`). **Medido en el V3 completo: frases intactas 95.87 % → 96.02 %, y los tres casos desaparecen.** El único «término perdido» que queda son 55 × «veno venoso», que es la reescritura `ECMO veno venoso → ECMO VV` que su propio caso crítico nº 3 EXIGE — conflicto entre dos de sus artefactos, no un defecto: decisión suya |

| REG-067 | Corrección silenciosa por zona horaria (P1) | **43 llamadas a `hoyISO`, `fechaISOLocal`, `ahoraMinutosDelDia`, `instanteMX` y `yaPaso` caían a México central** en vez de usar la zona del consultorio. Para Hermosillo (UTC-7) o Tijuana (UTC-8) —zonas que la propia pantalla de configuración ofrece— eso corre 1-2 h los recordatorios, el corte de caja y la validación de «no agendar en el pasado», sin que nadie vea un error. **Ya se había intentado arreglar y se revirtió**: hacer `tz` obligatoria obliga a meter `useConfig()` en diez páginas de producción y a mover declaraciones para que la zona quede por encima de un `useState(hoyISO())`; el intento dejó `tzClinica` usada antes de declararse y un bloque movido dentro de la función equivocada. Quedó congelado en un trinquete de 43 | CLOSED | **La zona se PUBLICA una vez en lugar de perseguir cada llamada.** `fijarZonaConsultorio()` la deja en `zonaActiva()`, que es el nuevo valor por omisión de las cinco funciones — las 40 llamadas de cliente pasan a ser correctas **sin tocar una sola línea en el sitio de la llamada**. `useConfig` la publica cuando llega el snapshot de Firestore (sólo si el documento EXISTE: con la config por omisión todavía no se sabe dónde está el consultorio, y publicar una suposición es peor que no publicar). Se persiste en `localStorage` porque el snapshot llega DESPUÉS del primer render y hay pantallas que congelan la fecha ahí mismo (`useState(hoyISO())` en finanzas y corte de caja); y se borra en las tres salidas de sesión. **La propiedad que hace segura toda la solución: en el SERVIDOR no se puede publicar.** Una función de Vercel atiende a muchos consultorios y una variable de módulo se compartiría entre peticiones — el corte de caja de Tijuana con la zona del que entró antes. No es una convención: `fijarZonaConsultorio` comprueba `window` y fuera del navegador es un no-op, así que `zonaActiva()` en el servidor devuelve siempre `TZ_DEFAULT`. Los **3 sitios de servidor** pasan la zona explícita: `whatsapp/waitlist-notify` (tope diario por contacto), `whatsapp/webhook` (`todayStr` pasa a exigir `tz`: en Tijuana el bot ofrecía el día siguiente a partir de las 22:00) y `public/booking`, donde la validación de «fecha pasada» se MOVIÓ debajo de la carga de configuración — el comentario que había declaraba el hueco y lo dejaba pasar diciendo «el bloqueo sí usa la zona real, que es donde importa», y no era cierto. **El guardián cambió de medida**: contar «llamadas sin argumento» medía la forma, no el riesgo, ahora que el valor por omisión ES la zona del consultorio. `src/__tests__/timezone-sitios.test.ts` exige CERO en rutas de API y que la zona no se publique nunca desde el servidor, con control positivo del propio escáner; de paso arregla dos falsos positivos suyos (contaba líneas de JSDoc `/**` como llamadas). Golden del mecanismo en `src/__tests__/timezone-zona-consultorio.test.ts` (12 casos): el servidor no hereda la zona de otro consultorio, el argumento explícito siempre gana, se recuerda entre cargas, se olvida al cerrar sesión, y una zona inválida o corrupta se descarta en vez de hacer que Intl lance en cada render. **Un caso llevaba reloj real comparando Tijuana con Madrid —coinciden de día 15 h de cada 24— y se fijó el reloj: un invariante intermitente enseña a ignorar el CI.** **Residual declarado:** la PRIMERÍSIMA carga de un navegador que nunca ha abierto la app no tiene zona todavía; se usa `TZ_DEFAULT` hasta que llega el snapshot. Cerrarlo exigiría bloquear el render |

| REG-068 | Pérdida de dato clínico en el Panel UCI (**P1, visto en producción**) | **Un pase de UCI completo llegaba al panel con dos campos.** El Dr. metió un choque cardiogénico en VA-ECMO con pH, PaCO₂, PaO₂, FiO₂, PEEP, volumen corriente, tres aminas y RASS, y la pantalla le contestó «no se puede calcular índice de Kirby (P/F): falta PaO₂ y FiO₂». Los había dado los dos. Consecuencia en cadena: el panel vacío → los motores deterministas sin nada que calcular → el Copilot sin snapshot que razonar → **todo el dictado volcado en crudo al final de la nota**, que es el «mugrero» que reportó. CUATRO CAUSAS, NINGUNA CLÍNICA: (1) **subíndices** — «PaO₂» lleva U+2082, no el «2» del teclado, y el extractor buscaba `pao2`: no casaba nunca, ni FiO₂ ni PaCO₂ ni SpO₂ ni HCO₃ ni cmH₂O; (2) **dos puntos** — el único separador aceptado entre el nombre y la cifra era el espacio, y un pase ESCRITO usa «pH: 7.19»; (3) **viñetas** — «Noradrenalina \n * 0.42 µg/kg/min» rompía la coincidencia con el asterisco en medio; (4) **modos abreviados** — «Modo: VC-AC» no estaba en la lista, así que caía al `else if` de «no invasiva» porque el texto mencionaba una VNI en el plan de destete, y **la nota afirmaba «Ventilación no invasiva (BiPAP)» sobre un paciente INTUBADO y en ECMO**. Ésa es la peor de las cuatro: no es un dato que falta, es un dato que MIENTE | CLOSED | `norm()` convierte subíndices y superíndices a dígitos, normaliza el menos matemático (U+2212) y los guiones tipográficos, quita el ± de la nomenclatura química (HCO₃⁻) y colapsa el separador de millar («118,000/µL»). Nuevo `SEP` que acepta `:`, `=`, viñetas y guiones además del espacio y de las palabras de siempre. Modos abreviados VC-AC/VCV/AC-VC/PC-AC/PCV/AC-PC/PRVC reconocidos ANTES que el genérico de «no invasiva». Alias que faltaban: `fr`, `vt`, `fc`, `p pico`, `sato2`, `sao2`, `nora`. **Medido con el pase real: 2 campos → 21.** `src/__tests__/reg-068-extraccion-uci-pase-escrito.test.ts` (12 casos), con la trampa exacta que se comió el caso —«Modo: VC-AC» seguido de «se plantea ventilación no invasiva al destete»— y con controles de que el dictado HABLADO de siempre sigue funcionando, de que un valor imposible sigue sin prellenar, y de que «pip» sigue siendo presión pico y nunca PEEP. **Y el Copilot deja de encogerse de hombros:** «ambos modelos fallaron o no hay llaves válidas» mezclaba llave inválida (401), proveedor caído (5xx), límite alcanzado (429) y respuesta que no se pudo leer como JSON — cuatro cosas con cuatro arreglos distintos. Ahora cada proveedor dice lo suyo con su código HTTP traducido a algo accionable. **Residual declarado:** un recuento de plaquetas dictado en unidades de laboratorio («118,000/µL») queda marcado como implausible porque el campo del panel espera millares; se avisa en vez de convertir, porque elegir la unidad por él sería adivinar |

| REG-069 | Nota clínica ilegible (P2, visto en producción) | **La nota de UCI decía cada aparato DOS VECES.** `nota.ts:200` metía el pase ENTERO dentro de «Plan por sistema», y el pase de un intensivista ya viene ordenado por aparatos («1. Neurológico», «2. Cardiovascular», «5. Respiratorio»): la nota salía con cada sistema una vez con los valores del panel y sus cálculos, y otra con el texto crudo repetido al final. Encima «Plan por sistema» decía otra cosa de la que hacía: un plan es lo que se va a HACER, no la lista de lo que se encontró. Lo levantó el Dr. mirando su propia nota | CLOSED | `src/lib/uci/reparto-sistemas.ts`: el pase se reparte entre las secciones por los ENCABEZADOS QUE EL PROPIO MÉDICO ESCRIBIÓ, sin modelo de lenguaje y sin interpretación semántica. Cada sección queda con los valores calculados arriba y las palabras del médico debajo. Lo que no cae bajo ningún encabezado se queda en el plan: si él no dijo a qué aparato pertenece, no se adivina. Un encabezado es CORTO y no lleva cifras — «Respiratorio: FiO₂ 60%, PEEP 8» es un dato, no un rótulo, y tomarlo por rótulo habría BORRADO el dato (los rótulos no se copian). El orden de los patrones es por especificidad: sin él, «Gasometrías ECMO» caería en hemodinámica por la palabra «ECMO». `src/__tests__/reg-069-nota-uci-sistemas-duplicados.test.ts` (15 casos), con el que importa —ninguna marca aparece en dos sistemas a la vez— y tres controles de que no se rompe nada: un pase sin encabezados se queda entero en el plan sin trocearse, uno vacío no revienta, y no se pierde ni una línea con contenido |

| REG-070 | Copilot de UCI inutilizable con el paciente completo (P1, en producción) | **El Copilot fallaba justo cuando había MÁS datos.** Con el panel VACÍO razonaba bien; con el panel LLENO —21 campos, seis alertas, las escalas calculadas— contestaba «no pudo generar la síntesis». Al revés de lo que uno esperaría, y por eso costó verlo: parecía un problema de llaves y no lo era. CAUSA: `max_tokens: 4000` en `api/uci/copilot`. La síntesis por sistemas de un paciente completo se pasa de ahí, así que la respuesta llegaba **cortada a media llave** y `JSON.parse` la rechazaba ENTERA — ocho problemas bien razonados se tiraban porque el noveno venía partido. La nota de consulta ya usaba 24 000 por exactamente la misma razón. **Lo encontró el diagnóstico de REG-068**: al separar «llave inválida / proveedor caído / límite / salida ilegible», la pantalla dijo «Anthropic: respondió, pero su salida no se pudo leer como JSON. OpenAI: ídem» — dos proveedores distintos fallando igual señala a nuestro lado, no al suyo | CLOSED | Espacio a 16 000 en los dos proveedores. `stop_reason: max_tokens` se detecta y se DICE («la respuesta se cortó por longitud antes de cerrar»), en vez de hacerlo pasar por «no se pudo leer», que apunta al sitio equivocado. Y `cerrarJsonTruncado` recorta hasta el último elemento COMPLETO y cierra las estructuras abiertas: una síntesis parcial y declarada vale más que ninguna síntesis. No inventa contenido — sólo cierra comillas, corchetes y llaves que el modelo dejó abiertos, y descarta lo que quedó a medias. `src/__tests__/reg-070-copilot-json-truncado.test.ts` (7 casos), incluido que si no hay NADA completo que salvar devuelve null en vez de inventar, y que no lanza con ninguna basura de entrada |

| REG-071 | Legibilidad de la nota de UCI (P2, petición del Dr.) | «Me gustaría que tuviera todos los datos pero más compacta, no en lista, más de manera narrativa clínica». La nota ponía cada dato en su propio renglón, así que una sección respiratoria completa ocupaba doce líneas de inventario | CLOSED | `src/lib/uci/formato-nota.ts` + interruptor Narrativa/Lista en la pantalla, recordado por navegador. **LO IMPORTANTE ES LO QUE NO HACE: no usa IA.** La tentación era mandarle la sección a un modelo y pedirle «redáctalo bonito», y ahí es donde una nota clínica se estropea — el modelo reordena, resume, elige qué omitir y de paso puede tocar una cifra; se pagaría por el privilegio de revisar cada palabra. No hace falta: cada dato que produce `nota.ts` YA es una oración completa con su punto, y el aspecto de lista viene sólo del salto de línea. La narrativa las une en párrafo — mismas palabras, mismas cifras, mismo orden. **Las advertencias van APARTE**: una línea que empieza con ⚠ es una alerta de seguridad («GCS 13 en paciente intubado es incoherente») y enterrarla a media frase es exactamente cómo se deja de leer. Los subtítulos que el médico escribió («Signos vitales») abren párrafo en vez de perderse. `src/__tests__/uci-formato-nota.test.ts` (14 casos): se conservan todas las cifras exactas, el orden, y ninguna oración se pierde — si alguien mete un modelo de lenguaje aquí, se ponen rojos. El formato «lista» devuelve EXACTAMENTE lo de antes |

| REG-072 | La nota daba clase en vez de registrar (P2, petición del Dr.) | «¿Para qué pones lo del Glasgow si no lo necesita? Omítelo, es una nota médica, no tienes que explicar eso». La nota escribía DENTRO del documento que se firma: «Glasgow verbal no valorable por vía aérea artificial (reportar como “T”); seguir sedación por RASS», y dos banderas más — «GCS 13 en paciente intubado es incoherente…» y «RASS -4: justifícala (HTIC, SDRA grave con bloqueo, estatus) o alígerala (PADIS 2018)» | CLOSED | **No es estética: la nota es un documento clínico-legal que el médico FIRMA.** Un intensivista no necesita que le expliquen que el verbal no se valora con tubo, y meter la lección en el expediente lo ensucia y lo alarga. En el intubado con GCS ≥11 la nota sencillamente NO reporta Glasgow y reporta RASS, que es la escala que aplica. Las banderas del motor neurológico salen del cuerpo de la nota. **El consejo NO se pierde**: sigue íntegro en el panel de Alertas de la pantalla, que es donde sirve — mientras trabaja, no en lo que firma. Lo que SÍ se queda porque es dato y no lección: un GCS BAJO en intubado (un coma con tubo se registra, con la convención «verbal T» aplicada y sin sermón), y todos los cálculos con su interpretación (driving pressure, compliance, PaO₂/FiO₂). `src/__tests__/reg-072-nota-uci-sin-lecciones.test.ts` (8 casos) |

| REG-073 | El pase traía los datos y el panel no los veía (P1, en producción) | «La mayoría de los datos que pides vienen en la nota, nomás que no los buscas bien». Y su propio Copilot lo decía dato por dato: «PAM bloqueada por falta de PAS/PAD aunque HAY TA registrada en notas», «VExUS bloqueado por VCI no cargado (hay VCI 24 mm en notas)», «Na/Cl para anion gap (hay Na 138, Cl 108 en notas)». **Medido sobre ese bloque hemodinámico: 1 campo de 16** | CLOSED | Tres causas: (1) la tensión se escribe en FRACCIÓN («TA invasiva: 78/46») y el extractor sólo sabía leer «presión sistólica 78» — sin PAS/PAD no hay PAM, y sin PAM se bloquea media hemodinámica y la presión de perfusión cerebral; (2) los electrolitos se escriben con su SÍMBOLO (Na, Cl, K, Cr, BT, Alb, Glu) y los alias sólo tenían la palabra completa; (3) faltaban campos ENTEROS: PVC, PCP/PAOP, gasto cardiaco, índice cardiaco, SvO₂, FEVI, PAM directa y peso. **Y las unidades escritas se CONVIERTEN, no se adivinan**: «VCI 24 mm» → 2.4 cm y «Plaquetas 118,000/µL» → 118 ×10³, pero SÓLO cuando la unidad está escrita en el texto; sin ella se avisa y no se toca, porque elegir la unidad por el médico es un factor de diez o de mil en una cifra clínica. **1 → 16 campos, cero avisos falsos.** Un caso del golden fija que una fracción cualquiera NO es una tensión: «VT 6/kg», «I:E 1:2» y «Glasgow 13/15» no cargan PAS/PAD. ⚠ Encontrado al escribir el golden: mi propia conversión tenía el bug de precedencia de `|` —`${re.source}` sin `(?:…)`— así que «VCI: 24» sin unidad casaba con sólo `\\bvci` y convertía a cm un número que nadie dijo en milímetros. Tercer sitio con el mismo fallo en el día. `src/__tests__/reg-073-extraccion-hemodinamica.test.ts` (10 casos) |

| REG-074 | Una especificación de software dentro del expediente de un paciente (P2) | En la nota de un enfermo en VA-ECMO apareció: «Debe permitirse que los objetivos sean configurables por protocolo institucional, no hardcodearlos como un único rango universal». Es un requisito que el Dr. me estaba dictando A MÍ mientras probaba la app, y el pase lo arrastró al documento clínico | CLOSED | `esInstruccionAlSistema()` saca del reparto las frases que le hablan al software. El filtro es DELIBERADAMENTE estrecho —exige un verbo de requisito Y al sistema como sujeto— porque sacar una frase clínica de la nota sería mucho peor que dejar una de software. Casos de control: «el sistema respiratorio muestra edema», «debe vigilarse la apertura valvular aórtica», «se debe considerar descarga de VI» y «debe mantenerse PAM > 65» NO caen. `src/__tests__/reg-074-nota-sin-texto-de-software.test.ts` (5 casos) |

| REG-075 | Laboratorios en la nota de UCI (P2, petición del Dr.) | «Los laboratorios sólo lo relevante, si están bien no los pongas, y trata de ponerlos más corto — leucocitos (Leu), creatinina (Cr)». La nota listaba todo el panel completo, normal o no, con el nombre largo | CLOSED | `src/lib/uci/labs-nota.ts`. **DÓNDE ESTÁ LA LÍNEA, Y POR QUÉ IMPORTA: el módulo NO decide qué es clínicamente importante — decide qué está FUERA DEL RANGO DE REFERENCIA**, que es una comparación aritmética contra el catálogo de analitos ya existente y auditado, no un juicio médico. «Sólo lo anormal» se puede comprobar; «sólo lo importante» exigiría que el software supiera qué importa en ESTE paciente, y no lo sabe: un sodio de 138 en un cirrótico y en un politraumatizado no significan lo mismo, y ninguna tabla de rangos lo captura. **Lo normal NO se borra**: sale de la nota y se queda entero en el apartado de laboratorio, graficable. La nota se acorta; el dato no se pierde — y se declara cuántos se omitieron y dónde están. Las abreviaturas se escriben A MANO (24 analitos) porque abreviar por regla automática produce colisiones —`Cr` de creatinina y de cromo— y en una nota clínica una abreviatura ambigua es peor que la palabra completa; un caso del golden comprueba que ninguna se repite. ⚠ Encontrado al probarlo: un analito que el catálogo NO conoce **desaparecía en silencio** (`evaluar` devolvía null y el filtro lo tiraba). Un resultado que el médico midió y que la nota no menciona ni acusa es el mismo fallo que se lleva reparando todo el día en el dictado, sólo que aquí el dato se pierde DESPUÉS de haberlo capturado bien. Ahora se acusa con su nombre. `src/__tests__/uci-labs-nota.test.ts` (13 casos) |

| REG-076 | El Copilot razonaba y su razonamiento no llegaba a la nota (P2, petición del Dr.) | «Que funcione el copiloto CON la nota… y genere la mejor nota con las mejores recomendaciones y plan incluido, ya para cuando pasa a revisar y firmar». Y antes: «siento que es algo confuso y debe ayudar al médico, no confundirlo». El Copilot razonaba en su propio recuadro y ahí se quedaba: el médico lo leía, cerraba el panel y **escribía el plan a mano** con lo que acababa de leer. Dos superficies que dicen lo mismo y ninguna que se firme | CLOSED | `src/lib/uci/plan-desde-copilot.ts` + botón «Pasar el plan a la nota». Los problemas del Copilot se convierten en el «Plan por sistema», agrupados por aparato y con lo ALTO antes que lo bajo. **LO IMPORTANTE ES LO QUE NO HACE:** no indica tratamientos ni pone dosis —el Copilot está construido para sugerir qué VERIFICAR y qué DECIDIR, y este módulo no le cambia el papel—; NO entra en la nota al generarse, hay un botón, porque nada que escribió una máquina entra en un documento que se firma sin que alguien lo decida; llega encabezado como PROPUESTA que dice «no es una indicación», para que quien lea la nota o la audite mañana sepa qué escribió una máquina y qué el médico; y **si él ya escribió un plan, el propuesto va DEBAJO** — sobrescribir lo que escribió un médico en su nota no se hace nunca. Las divergencias de la segunda opinión van APARTE y se dicen como tales: mezclarlas las haría pasar por consenso, y el valor de pedir dos opiniones es ver dónde NO coinciden. Se conserva la redacción del Copilot: reescribirla sería interpretar un razonamiento clínico. `src/__tests__/uci-plan-desde-copilot.test.ts` (13 casos). ⚠ **CORREGIDO EL MISMO DÍA tras probarlo el Dr.: «el plan deben ser INDICACIONES; cuando pasas el plan a la nota lo mandas todo reborujado — más bien lo que pasas es el ANÁLISIS, pero debe ser ordenado».** Tenía razón y la distinción es de documentación clínica, no de estilo: el ANÁLISIS es qué pasa y por qué (razonamiento); el PLAN es qué se va a HACER (fármaco, dosis, parámetro, estudio) y alguien lo ejecuta. Meter el razonamiento del Copilot en la sección de indicaciones no era sólo desordenado: **hacía que la nota pareciera ORDENAR algo que nadie ordenó**. La nota pasa a tener DOS secciones: «Análisis» (donde va el razonamiento, el del médico y debajo el propuesto) y «Plan e indicaciones» (que escribe el médico, porque lo firma él y alguien lo ejecuta). Y el «reborujado» tenía causa concreta: los sistemas salían en el orden en que los devolvía el modelo, porque un `Map` conserva el orden de llegada. Ahora salen en el ORDEN DEL PASE — neuro, respiratorio, hemodinámico… — y lo de prioridad alta antes que lo bajo dentro de cada uno |

| REG-077 | **El costo real de NexusMED era desconocido** (P0, Master Loop V3 §BD «costos sin registrar») | `registrarUso()` incrementaba un contador de LLAMADAS. Buscar `input_tokens`/`prompt_tokens`/`usage` en todo `src/` daba **cero coincidencias**: los proveedores devolvían el uso en cada respuesta y se TIRABA. Sin eso no hay AI COGS, ni gross margin, ni unit economics, y el objetivo «AI COGS < 8% del revenue» no era verificable. De las 14 cifras que pide §BG, sólo una era calculable | CLOSED (fase 1) | `cost-ledger.ts` (puro) + `cost-ledger-server.ts` (Admin SDK, colección `platform_cost_ledger`, id = requestId → idempotente por construcción, §AX) + `medir-ia.ts` que lee el `usage` de los dos formatos (Anthropic `input_tokens`, OpenAI `prompt_tokens`, y la caché anidada de OpenAI). Cableado en el Copilot de UCI. **TRES DECISIONES QUE EL GOLDEN FIJA:** (1) **costo desconocido es `null`, NUNCA `0`** — un cero se suma en los totales y hace pasar por gratis lo que sólo se ignora; los totales suman sólo lo que tiene tarifa y declaran cuántos quedaron fuera, con la lista de modelos por cargar. (2) **El gasto de I+D del fundador NO entra en el COGS de los clientes** (§CD): si probar UCI se carga al margen de los usuarios de Consulta, las unit economics dejan de ser reales; y con llave propia del consultorio el costo no es nuestro. (3) **En el libro de costos no entra NADA clínico** (§AZ): tokens, modelo, latencia y precio. Ni el prompt, ni la respuesta, ni el paciente — un registro financiero se consulta para cuadrar dinero, y meterle el expediente lo convertiría en otro sitio donde vive el dato clínico, con otros lectores y otra retención. `precios-modelo.ts` **nace VACÍO a propósito**: los proveedores publican sus tarifas y las cambian, y escribir una de memoria daría un dashboard que parece exacto y miente. Se carga con su fuente y su fecha. `src/__tests__/finanzas-cost-ledger.test.ts` (20 casos) |

| REG-078 | Dos catálogos de precios que se contradecían (P0, §A «nunca dispersar precios en componentes») | `planes-ia.ts` decía Agenda 349 · Clínica 899 · Hospital 3499. `superadmin/page.tsx:493` tenía OTRO catálogo quemado en el componente: 399 · 699 · 999 · 1799. **Ninguno de los cuatro renglones coincidía**, y no era decorativo: son los paquetes que el superadmin siembra y vende | CLOSED | El catálogo del superadmin sale ahora de `PLANES`, con `PLANES_ORDEN` y `MODULOS_POR_PLAN` viviendo junto a los precios. Un precio que depende de qué pantalla mires no es un precio; cambiar la oferta se hace en un sitio |

| REG-079 | Nada impedía vender un módulo en construcción (P1-3 de la auditoría · §BH–BW) | No existía ningún estado de producto: buscar `INTERNAL`/`ALPHA`/`PUBLIC_PURCHASE_ENABLED` daba cero. **UCI y Hospital eran vendibles en cuanto alguien cambiara un plan**, y el mismo día en que se escribió esto a UCI se le repararon cuatro fallos de captura del pase | CLOSED | `src/lib/finanzas/estado-producto.ts` con los 7 estados de §BJ. Hoy: Free/Agenda/Consulta PUBLIC y a la venta; Hospital y UCI ALPHA sin compra; Acute, Complete y Enterprise INTERNAL. Cada uno con su razón escrita. **LA DISTINCIÓN QUE ORDENA EL MÓDULO:** que el fundador pueda USAR un módulo no lo pone a la venta. No es una diferencia de permisos sino de PROMESA — cuando alguien paga por un módulo, la aplicación afirma que está terminado, y vender UCI hoy sería cobrar por algo que se está construyendo. El `estado` decide si se VENDE; el `entitlement` decide si se MUESTRA; el fundador tiene lo segundo sin lo primero y lo usa a diario precisamente para terminarlo (§CC). Hacen falta DOS condiciones para vender —estado maduro Y `compraPublica`— porque un solo campo pondría algo a la venta por descuido al madurar su estado, y eso es una decisión comercial que alguien toma (§CF pide cinco «go»), no un efecto secundario. Y al cliente NO se le enseñan candados de lo que no compró (§D). El cierre real está en el SERVIDOR: `/api/stripe/checkout` rechaza con 409 cualquier plan cuyos módulos no estén listos, porque la página de precios ya no enseñaba «Hospital + UCI» pero la ruta aceptaba el `plan` que viniera en el cuerpo — esconder una tarjeta no cierra una ruta HTTP. `src/__tests__/finanzas-estado-producto.test.ts` (18 casos) |

| REG-080 | El fundador y un cliente de cortesía eran la misma cuenta (P1-4 · §BK–BN, §CD) | El acceso del dueño se expresaba con `paseLibre: boolean` en el documento de la clínica, y la contabilidad los descartaba a los dos con el mismo `paseLibre !== true` (`api/superadmin/contabilidad/route.ts:86`). Además `/api/uci/copilot` llevaba su propia copia suelta de la lista de correos del dueño | CLOSED | `src/lib/authz/fundador.ts` con tres clases: fundador · cortesía · cliente. **LA DISTINCIÓN:** los dos entran sin pagar y ahí se acaba el parecido — a la cortesía se le está SIRVIENDO el producto (su gasto de IA es costo de operación, su experiencia es la del cliente), el fundador está CONSTRUYENDO el producto (su gasto es I+D). §CD lo exige: si lo que el Dr. gasta probando UCI a diario se carga al margen de los usuarios de Consulta, el margen deja de ser real y las decisiones de precio salen mal. Por eso `cuentaComoIngreso()` y `esCogs()` son dos preguntas separadas y la cortesía responde distinto a cada una. **Detalle que casi lo vuelve un no-op:** el primer cableado clasificaba por correo, pero el documento de la clínica guarda `ownerId` (un uid) y no correo — habría devuelto siempre 'cliente' viéndose idéntico a una clasificación que funciona. `claseDeCuenta` recibe ahora un booleano ya decidido, y cada llamador aporta la verdad que sí tiene: el correo verificado del token en el copilot, `ownerId === acc.uid` en la contabilidad. `src/__tests__/authz-fundador.test.ts` (10 casos) |

| REG-081 | Dieciséis rutas llamaban a los proveedores de IA por su cuenta (P1-1 · §P–T) | Cada una repetía —con variaciones— las mismas cuatro decisiones: qué modelo intentar, cuándo pasar al siguiente, cómo traducir un HTTP a algo accionable, y cómo leer la respuesta. Las variaciones son las que costaron: `uci/copilot` se quedó en `max_tokens: 4000` mientras `expediente/procesar` ya usaba 24 000, y la síntesis llegaba cortada a media llave justo cuando había MÁS datos que sintetizar (REG del 30-jul). Y de las dieciséis, sólo UNA dejaba asiento en el libro de costos | ABIERTO (5 de 16 enrutadas · **13 de 16 con asiento**) | `src/lib/ia/protocolo.ts` (PURO: cascada, clasificación de errores, lectura de respuestas — se fija con casos sin gastar una llamada) + `src/lib/ia/gateway.ts` (el `fetch` y el asiento). **LO QUE JUSTIFICA EL REFACTOR:** que el costo quede registrado sin que nadie tenga que acordarse. Cablear el libro ruta por ruta son dieciséis oportunidades de olvidarlo, y luego una más por cada ruta nueva; una llamada sin asiento no se ve como un error sino como una plataforma que gasta menos de lo que gasta. Aquí el asiento no es un paso que el llamador ejecuta: es lo que pasa al volver de `fetch`. Y se anota **también cuando la llamada falla**, porque un rechazo tras generar tokens se cobra igual. Dos reglas que ya habían fallado: sólo se cambia de modelo cuando el problema ES el modelo (400/404) —con una llave revocada, recorrer la lista entera nada más retrasa el mismo 401, y reintentar un 429 empeora el límite que acaba de saltar—; y una respuesta truncada se reporta como truncada, no como ilegible, que manda a buscar el problema al sitio equivocado. Migradas: `uci/copilot`, `expediente/verificar-nota`, `expediente/atribuir-roles`, `inmuno/redactar`, `ayuda-bot`. Faltan 11, de las cuales `expediente/procesar` requiere que el gateway soporte extended thinking antes de tocarla — **no se migró para no cambiar de callado el razonamiento de la nota**. `src/__tests__/ia-protocolo.test.ts` (16) + `src/__tests__/ia-gateway.test.ts` (13) |

| REG-082 | Los créditos se contaban DESPUÉS de gastarlos (P1-2 · §AA–AF) | Leer-y-luego-escribir: la ruta preguntaba «¿le quedan créditos?», llamaba al modelo, y al final incrementaba el contador. Entre la pregunta y el incremento caben treinta segundos, y en ese hueco (a) **dos notas simultáneas del mismo consultorio pasan las dos con el saldo de una** —`increment` es atómico, pero la DECISIÓN de gastar no lo era— y (b) si la función se caía tras responder, el gasto existió y el contador no se enteró | CLOSED | Cartera con reservar → confirmar → devolver: `src/lib/finanzas/cartera.ts` (PURO) + `cartera-server.ts` (la transacción, que lee el saldo y descuenta en el MISMO paso), cableada en el gateway para que ninguna ruta tenga que acordarse. Los reservados cuentan como gastados al calcular el disponible: ignorarlos sería volver al defecto original. **LA DECISIÓN QUE MÁS IMPORTA ES QUÉ PASA CUANDO ALGO SALE MAL:** falla ABIERTO, igual que el gate que ya existía — si la reserva no se puede leer o escribir por infraestructura, la llamada procede y queda marcada `falloAbierto`. Dejar a un intensivista sin su nota a las tres de la mañana porque Firestore tuvo un mal minuto es peor que regalar unos créditos. Lo contrario —cobrar por una llamada que falló— no se hace nunca: si el proveedor falla, si la salida no se puede leer, o si se cae la red, los créditos vuelven a la bolsa. `aplicaCartera` sólo aplica sobre la llave del DUEÑO; con llave propia del consultorio descontarle de nuestra bolsa sería cobrarle dos veces — y un caso fija que es EL MISMO criterio que `debeCortarCreditos`, porque dos respuestas a «¿quién paga esto?» acabarían discrepando y la discrepancia se vería como créditos que desaparecen sin explicación. **Cobro doble evitado al cablear:** tres rutas migradas seguían llamando `registrarCreditos` por su lado, así que la misma nota se habría cobrado dos veces. `src/__tests__/finanzas-cartera.test.ts` (17) + 7 casos nuevos en `ia-gateway.test.ts` |

| REG-083 | El libro de costos no tenía pantalla (§CE) | Tras cerrar el P0-1 los asientos se escribían en `platform_cost_ledger` y nadie podía verlos: una colección de Firestore no es un tablero | CLOSED | `/superadmin/costos` + `/api/superadmin/costos`. **LO QUE HACE DISTINTO:** enseña lo que NO sabe, y lo pone arriba en vez de en una nota al pie. Las tarifas siguen vacías a propósito, así que el tablero dice «N de M llamadas no tienen precio cargado», nombra los modelos que faltan y dice dónde cargarlos — nunca estima, nunca promedia, nunca suma un desconocido como cero. Un total calculado sobre la mitad de las llamadas se ve en pantalla exactamente igual que uno completo, y así es como una cifra inventada acaba sosteniendo una decisión de precio. El tope de 5 000 llamadas también se declara: un mes truncado en silencio se lee como un mes entero. Separa COGS (clientes) de I+D (el fundador probando). La colección queda `if false` en las reglas y clasificada en `MATRIZ_ACCESO` como financiero/servidor: no lleva PHI, pero enseña el gasto de todos los consultorios. La ruta se declaró en `REGISTRO_RUTAS`; el guardián de frontera subió de 62 a 63 rutas con guardián Y de 76 a 77 llamadas — las DOS en uno, que es lo que tenía que pasar: si sólo hubiera subido la de llamadas, una ruta se habría quedado sin guardián |

| REG-084 | La llamada más cara de la plataforma no dejaba rastro | Cerrado el P0-1, el libro sólo cubría las rutas migradas al gateway. `expediente/procesar` —la nota de consulta, Opus con razonamiento extendido y hasta 24 000 tokens de salida— seguía sin un solo asiento, y con ella el gasto principal de NexusMED | CLOSED | `anotarLlamada()` exportado del gateway y cableado en `nota-consulta` (incluido su reintento sin thinking, que es OTRA llamada y lleva su propio asiento), `extraer-entidades`, `antibiograma-vision`, `laboratorio-vision` y `receta-detectar-campos`. **POR QUÉ ANOTAR SIN ENRUTAR:** `procesar` hace descubrimiento de modelos contra `/v1/models`, usa razonamiento extendido y reintenta sin él ante un 400; migrarla entera cambiaría de callado cómo razona la nota que el médico firma. El objetivo de la auditoría era VER el costo — el gateway es el medio, no el fin. Queda declarado como parada intermedia y no como destino: una ruta que sólo anota sigue teniendo su propia cascada y su propio `max_tokens`, que es de donde salió el fallo de los 4 000 tokens del Copilot |

| REG-085 | La cartera dejaba sin IA al propio fundador | Introducido al cablear REG-082: la cuenta del Dr. corre sobre la llave del dueño (`fuente: 'prueba'`), así que la cartera le aplicaba igual que a un cliente y el tope del plan lo habría cortado a mitad de mes **mientras construye el producto** | CLOSED | `aplicaCartera` sale en falso para el fundador. §BK es explícito: «el acceso del fundador NO debe depender de una suscripción de pago». Su gasto se sigue registrando en el libro, marcado como I+D — no se esconde, se clasifica, que es exactamente la distinción de REG-080 |

| REG-086 | El medidor del banco de voz reprobaba al pipeline por obedecer | Sobre el corpus CORAL de 6 000 (que el pipeline no había visto nunca) salían **56 términos clave perdidos**. Ninguno era del pipeline: 55 eran «veno venoso», que el pipeline escribe `ECMO VV` — la ortografía que pide el propio `aliases.json` del paquete—, y el que quedaba era «un miligramo» convertido a `1 mg`, que es literalmente lo que mandan las reglas de normalización | CLOSED | Dos arreglos en `benchmark-metricas.ts`, los dos citando su documento: las equivalencias de ECMO salen de `config/aliases.json` (y **VV y VA no se cruzan nunca** — confundirlos es uno de los errores críticos, y un medidor que los diera por iguales dejaría de ver justo lo que vigila); y «un/una» cuenta como el número 1 sólo delante de una unidad o de otro número, no delante de un sustantivo («un paciente» no es «1 paciente»). **Resultado: 56 → 0 términos perdidos, 96.02 % de frases intactas.** La lección es la de siempre en este proyecto: una métrica que castiga al sistema por hacer lo correcto manda a corregir lo que ya estaba bien, y se ve idéntica a una métrica que funciona |

| REG-087 | `drug.maxDose`: un solo número para algo que tiene cuatro máximos distintos | Un antibiótico no tiene «una dosis máxima»: tiene máximos según indicación, sitio, organismo, CMI, función renal, peso, estrategia PK/PD y formulación. Con un `maxDose` único salen marcadas como error la ceftriaxona 2 g q12h de una meningitis, la daptomicina a 10 mg/kg y el meropenem en infusión extendida con ARC — tres cosas que un intensivista hace cada semana | CLOSED (núcleo) | `src/lib/antimicrobianos/v4/`: `tipos.ts` (renal · TRR · microbiología como objetos, `LimitesDosis` con usual/contextual/absoluto y `tipoMaximo`, `ReglaDosis` con las cuatro capas que NO se sobrescriben), `kernel.ts` (los 8 estados) y `catalogo.ts` (los 49 fármacos verificados del Dr., sellados por SHA-256). **LA DECISIÓN QUE ORDENA EL KERNEL:** faltar un dato no es lo mismo que estar mal. Amikacina sin peso es una pregunta sin responder; colistina «150 mg» sin CBA/CMS es una unidad ambigua; ceftriaxona 2 g q12h en meningitis está por encima de lo habitual y es correcta. Un motor que contesta «error» a las tres enseña a ignorarlo. Y lo que decide el veredicto por encima de lo usual es el ORIGEN de la pauta (guía / PK-PD / off-label respaldado), no la magnitud. **DOS HALLAZGOS AL PROBARLO:** (1) mi búsqueda por inclusión devolvía **Ampicillin-sulbactam** cuando se pedía **Ampicillin** —otro espectro, otra dosis, y la sola está declarada pendiente— con nada en pantalla que lo dijera; ahora la búsqueda es exacta y `candidatos()` ofrece opciones para que elija una persona. (2) Hueco real del dataset: `Vancomycin PO` y `Metronidazole` no traen `source_ids`; la lista queda explícita en el test para que un tercero ponga rojo. PENDIENTE: capas 3 y 4 (estructurar la prosa de `renal_adjustment` y `crrt`), que es parseo con consecuencia clínica y necesita su verificación. `antimicrobianos-v4-kernel.test.ts` (14) + `antimicrobianos-v4-catalogo.test.ts` (14) |

| REG-088 | El dataset V3 incumplía su propia regla dura `RULE_SOURCE_SEPARATION` | La regla HARD dice «guardar la dosis de FDA/ficha y la de guía/PK-PD en campos SEPARADOS; si difieren, mostrar las dos con su contexto; nunca fusionarlas». **En 11 de las 49 entradas están fusionadas en una sola cadena** —«FDA label: 2.5 g q8h en 2 h; IDSA AMR sugiere 2.5 g q8h en 3 h»— y ese mismo texto está COPIADO en los dos campos. Entre ellas ceftazidima/avibactam y ceftriaxona, que son justo los dos ejemplos con los que el Dr. pidió el motor V4. Además **46 de 49 tienen los dos campos idénticos**, así que la regla casi no se ejercita | CERRADO en 7 de 11 · las 4 restantes declaradas | El motor **no** parte la frase: separar «2 h» de «3 h» con una expresión regular es el parseo con consecuencia clínica que el módulo evita — un fallo ahí no da un error visible, da una dosis distinta que en pantalla se ve igual de segura. `fusionadas()` lo DETECTA y el resolver lo declara en un aviso, para que la separación la haga quien verifica los datos. **Callarlo sería peor que el defecto**: la aplicación estaría afirmando que respeta una regla que su propia fuente no respeta. La lista de los 11 va explícita en el test: si se arregla una, el caso se pone rojo y hay que bajar el número a conciencia |

| REG-089 | El corpus de voz no tenía forma de medirse con audio real | `asr-regresion-texto.ts` comprueba que el pipeline no DAÑE una frase ya correcta — necesario y no suficiente: no dice nada de si el reconocedor OYE bien | CLOSED | `scripts/asr-benchmark-audio.ts`. Mide el reconocedor CRUDO y el pipeline COMPLETO sobre el mismo audio: **sin las dos columnas no se puede saber si el pipeline ayuda**, porque podría estar arreglando diez cosas y rompiendo once y una sola columna lo enseñaría como mejora. Separa WER de Clinical Term Recall porque **el WER no ve el error que importa**: en una frase de doce palabras, «mcg» convertido en «mg» pesa lo mismo que un artículo, así que un WER del 2 % puede esconder un factor de mil en la dosis. Los errores críticos (los pares prohibidos) se cuentan aparte y el criterio de aceptación es CERO. **Dos bugs propios encontrados al verificarlo:** (1) `tsc` no cubre `scripts/`, así que se me pasó desestructurar `PARES_PROHIBIDOS` como tuplas cuando son objetos; (2) el contador exigía límite de palabra por los dos lados, y los pares `/h` y `/min` empiezan por barra — no habrían casado nunca, dejando sin vigilar el par de un factor de sesenta en la velocidad de infusión. Verificado en seco contra el corpus: 6 000 filas, 6 000 audios, 6 000 emparejados, y el muestreo es REGULAR y no los primeros N (el CSV va agrupado por categoría y una muestra de los primeros mediría una sola cosa) |

| REG-090 | El pipeline de voz de 9 etapas no estaba conectado a la consulta | Buscar `procesarTranscript` en `src/app`, `src/hooks` y `src/components` daba **cero**. La consulta corría sólo `corregirVigilado`, la etapa 1 de 9. Las otras ocho —cifras y unidades, ortografía de siglas, verificación de entidades críticas, gate de ambigüedad— estaban escritas, probadas contra 6 000 frases y sin conectar a nada: «paracetamol quinientos miligramos cada ocho horas» llegaba a la nota en letra | CLOSED | `procesarTranscript` cableado en los 4 sitios de `useGrabacionAudio` (turnos diarizados, parcial en vivo, texto final y camino de reintento) y en `useGrabacionVoz`. Es un superconjunto estricto: el pipeline LLAMA a `corregirVigilado` como su primera etapa, así que no quita nada. El parcial en vivo también lo aplica, porque ver «quinientos miligramos» mientras hablas y que el texto te cambie al cerrar parece un error de la aplicación. `ResultadoPipeline` expone ahora `cambiosLexicos`: una corrección que el médico no puede ver ni revertir es una edición que alguien le hizo a su dictado sin decírselo |

| REG-091 | «Ochocientos cincuenta dos veces al día» se convertía en 852 | **El bug más grave que ha dado el módulo de normalización.** «Tomo metformina ochocientos cincuenta, dos veces al día» salía «metformina 852 veces al día»: la DOSIS desaparecía y la frecuencia se volvía absurda, en silencio, dentro de una nota clínica. Segundo bug del mismo probe: «el dolor es como un diez de diez» → «como 1 10 de 10» | CLOSED | En español una unidad detrás de una decena **exige la «y»**: «cincuenta y dos» es 52, «cincuenta dos» son dos números distintos. Ahora sólo compone si la «y» se consumió. Y «un/una» sólo cuenta como cifra delante de una UNIDAD DE MEDIDA o cuando se están deletreando dígitos con la forma «uno» («uno dos cero» = 120) — «un» apocopado casi nunca introduce una cifra suelta, y aceptarlo convertía en dígito todo artículo que precediera a una cantidad. **POR QUÉ NO LO VIO EL CORPUS DE 6 000:** ahí las pautas se dictan con la unidad pegada al número («seiscientos miligramos»), y el patrón peligroso es el de una CONVERSACIÓN — dosis y frecuencia separadas por una coma. Un banco de pruebas de un dominio no cubre el otro por muy grande que sea |

| REG-092 | El motor V4 no se podía usar: los topes no tenían dónde vivir | El kernel sabía decidir pero no tenía límites que comparar, así que respondía `UNKNOWN` a todo. Y los límites no se pueden escribir en el código: son una decisión clínica | CLOSED | `limites.ts` (puro) + `persistencia.ts` (por consultorio, `clinics/{id}/antimicrobial_limits`, lectura de todo el equipo y escritura sólo de médico) + pantalla `/uci/antimicrobianos` con dos pestañas: probar un caso y cargar topes. **La pantalla NO propone ninguna cifra, ni en gris:** un campo pre-llenado se acepta, y aquí lo que habría puesto el programa no lo sabe nadie. La fuente es obligatoria — un tope sin procedencia no se puede rebatir. El software sólo revisa coherencia interna: **un habitual por encima del contextual invierte el significado de la alerta** (lo que tenía que avisar bloquea y lo que tenía que bloquear pasa), y casi siempre es un dedazo. Un tope cargado contra otra versión del dataset queda CADUCADO y no se usa: mejor «no lo sé» que juzgar con un número que ya no corresponde a los datos |

| REG-093 | Los 49 topes se le estaban pidiendo al médico campo por campo | El motor sabía decidir pero no tenía límites, y cargarlos a mano son seis campos × 49 fármacos. Pedirle eso a quien ya te dio un dataset verificado es no haber hecho el trabajo | CLOSED | **Los 49 quedan decididos, ninguno sin respuesta:** 9 TRANSCRITOS del dataset (cifra que ya estaba escrita, con su frase exacta al lado), 22 PROPUESTOS desde el etiquetado adulto, y 18 con la razón escrita de por qué **una cifra sería falsa**. Confirmar es un clic. **Los dos grupos van separados y con distinto color a propósito:** los transcritos salen de una frase del dataset verificado; los propuestos salen del etiquetado de uso corriente y NO tienen el mismo respaldo. Mezclarlos haría que los dos parecieran igual de firmes. Y no se cita ninguna tabla ni PMID —sólo la familia de la fuente— porque una cita inventada da por comprobado lo que nadie comprobó. **El extractor se equivocó en un tercio antes de apretarlo, y TODOS los fallos iban hacia un tope demasiado BAJO** —la peor dirección—: nafcilina leía 500 mg («500 mg q4h usual; 1 g q4h en grave») y habría avisado en cada infección grave; ceftriaxona leía 2 g/día y la meningitis usa 4; ampicilina/sulbactam tomaba la pauta de CRAB invasivo como habitual; ceftolozano leía 1.5 g y la neumonía nosocomial usa 3. Se cerraron con tres filtros: entradas fusionadas fuera, `auto_dose_status != READY` fuera, y **más de una pauta en el texto → ninguna se propone** |

| REG-094 | Los botones de confirmar topes no guardaban nada | **Firestore rechaza los campos `undefined`** y la app no tiene `ignoreUndefinedProperties`. Casi todos los topes traen máximos vacíos, así que cada clic lanzaba «Unsupported field value: undefined» — y como la llamada iba con `void`, el error se perdía y el botón parecía muerto. El Dr. reportó «no me deja picarle bien a los botones» | CLOSED | Dos arreglos, y el segundo importa más: (1) se limpian los vacíos en `guardarLimite`, la única puerta de escritura —no en cada llamador, porque un saneamiento que hay que acordarse de aplicar se olvida—; (2) **la clase entera de fallo**: cada botón muestra «Guardando…», atrapa el error y lo enseña con su mensaje real; la carga en bloque dice cuántos entraron antes de romperse (reintentar sólo carga los que faltan, así que saber dónde se quedó ahorra buscar a ciegas); y si el consultorio aún no cargó, se dice en vez de dejar el botón apagado sin explicación. **Un botón que no hace nada y no dice por qué es peor que uno que da error.** No se puso `ignoreUndefinedProperties` global a propósito: que salte avisa de datos mal formados en vez de guardarlos a medias |

| REG-095 | Nada mejoraba lo que el reconocedor OYE | El pipeline de 9 etapas (REG-090) mejora lo que se ESCRIBE; el post-proceso no puede recuperar una palabra que nunca se oyó. Lo único que cambia lo que OYE es el prompt, y ahí había DOS huecos: (a) `lib/asr/lexicon.ts` —el constructor de vocabulario por paciente, 79 especialidades presupuestadas a 224 tokens— **no lo llamaba nadie**: se mandaba uno de dos prompts fijos; (b) `especialidades.json` tenía la ESTRUCTURA del corpus del Dr. pero **sólo 35 términos: 65 de las 79 especialidades completamente vacías**, cuando su `LEXICON_MEDICO.csv` traía los 1 400 desde el principio. Dictar de nefrología, hematología o neonatología no sesgaba nada | CLOSED | Importados los 1 400 con su categoría y prioridad (`scripts/asr-importar-lexicon.ts`, sin reclasificar ninguno). El `contexto` del grabador pasa de `'uci'` a los 5 módulos, y la consulta manda los fármacos y diagnósticos del paciente abierto — un fármaco que ya toma es la pista más específica que existe. Cae al prompt de siempre si algo falla: perder vocabulario extra es molesto, quedarse sin dictado es otra cosa. Casos nuevos: ninguna especialidad vacía, los 5 módulos producen prompts DISTINTOS (si salieran iguales el contexto no haría nada), ninguno pasa de 224 tokens (**lo que se pasa el modelo lo ignora en silencio**: un prompt más largo no es mejor, es uno truncado sin avisar) y lo del paciente va primero |

| REG-096 | El presupuesto del prompt se quedaba a medias | Al medir el vocabulario real tras REG-095: en UCI se agotaban los candidatos con **212 de 224 tokens y cero descartados**. Un caso existente afirmaba `descartados === 0` como si fuera la prueba de que todo cabía — era el SÍNTOMA: significaba que se habían acabado los términos. Las especialidades del núcleo de cuidados críticos son las más flacas del CSV del Dr. (ventilación mecánica 3, gasometría 2, sedación 1) mientras imagenología tiene 59 | CLOSED | El hueco se rellena con los términos críticos y de prioridad alta del resto de sus 79 especialidades. Va **al final**: no le quita el sitio a los fármacos ni diagnósticos de este paciente ni a su especialidad — sólo ocupa lo que iba a quedarse vacío. Cada token sin usar es una palabra suya que el reconocedor no va a esperar. El caso viejo se reescribió al revés: ahora **todos los módulos tienen que dejar cola**; si alguno vuelve a marcar cero, es que se quedó otra vez sin vocabulario que ofrecer |

| REG-097 | De las 6 000 frases del corpus no se había sacado ni una palabra | El léxico se construyó sólo con `LEXICON_MEDICO.csv` (1 400, muy desigual). El corpus trae **además 6 000 frases clínicas reales agrupadas por especialidad** — escritas por el Dr. — y no habían aportado nada. Su reclamo fue literal: «te di una carpeta con 6 000 audios, ¿como que nomás tienes eso?» | CLOSED | `scripts/asr-minar-corpus.ts`. El léxico pasa de 1 400 a **1 980**. Se extraen siglas y unidades tal como él las escribe y los términos PROPIOS de cada especialidad (≤3 categorías): una palabra que sale en las 78 no distingue nada. **Nada inventado — cada término sale literal de una frase suya.** **Tres filtros, cada uno puesto tras ver el resultado:** (1) los bigramas no cruzan comas — partir la frase quitando puntuación pegaba palabras separadas por una pausa («mmHg bicarbonato», «venoso flujo»): no son términos, son accidentes de dónde cayó la coma; (2) fuera los TROZOS de un compuesto — salían «driving» y «pressure» sueltos, y un trozo sesga hacia la palabra partida, lo contrario de lo que se busca; (3) fuera formas verbales y relleno — «titular», «documenta canulación», «Indicar aislamiento» son CÓMO redacta, no QUÉ dice. Los cinco módulos llenan ahora 221-224 de 224 tokens |

| REG-098 | A5 · la coma decimal mexicana se truncaba en la extracción de UCI | El patrón de dígitos sólo aceptaba el punto, así que **«pH 7,35» se extraía como 7** y «peso 82,4 kg» como 82. El decimal se perdía en silencio y el valor quedaba PLAUSIBLE, que es lo peor que puede pasar: un pH de 7 en lugar de 7.35 es la diferencia entre una acidosis grave y un paciente normal, y nada en la pantalla decía que se había recortado | CLOSED | El patrón acepta `[.,]` y la conversión va por `num()`, que ya distinguía la coma decimal de la de miles: «12,5» es 12.5 pero «1,200» es 1200 — tres dígitos exactos detrás de la coma son miles, y una glucosa de 1,200 leída como 1.2 dispararía una alerta de hipoglucemia en plena hiperglucemia. `EXTRACCION_UCI_VERSION` sube a 1.2.0. `src/__tests__/uci-extraccion.test.ts` |

| REG-099 | A6 · seis motores de UCI cambiaron de lógica sin subir su versión | Incluido el fix P0 de gasometría. Una nota firmada guarda la versión del motor que la calculó, y si dos lógicas distintas comparten el mismo número **no se puede saber qué cuenta produjo una nota vieja** — en una revisión clínica eso es la diferencia entre poder explicar un valor y no poder | CLOSED | No se cerró subiendo versiones a mano: eso vuelve a pasar a la siguiente sesión. Se selló la HUELLA de cada motor junto a su versión (`src/lib/uci/motores-sellados.json`, 18 motores) y un gate se pone rojo cuando el archivo cambia y la versión no. También avisa de un motor nuevo sin sellar y de uno sellado que ya no existe. `src/__tests__/uci-motores-version.test.ts` |

| REG-100 | A2 · `availability.ts` sin un solo test | Decide **qué horarios ve un paciente en el portal público**, y su historial está lleno de fallos: «slots fantasma cada 10 min», «32 lugares de un horario corrupto», «agendar en domingo o en festivo». Un paciente que reserva un hueco fantasma se presenta a una consulta que nadie tiene apuntada | CLOSED | 16 casos sobre lo que de verdad importa: que NO aparezca un hueco que no existe. Horario invertido o jornada imposible → cero huecos (mejor cero que 32 fantasma); el paso nunca es menor que la duración de la cita; ninguna cita termina después del cierre; una duración 0/NaN no cuelga el bucle; y `hasConflict` mira el DÍA y el horario, no sólo los solapes — porque cuando no hay huecos la interfaz cambia el desplegable por un campo libre y por ahí se colaba agendar en domingo. `src/__tests__/availability.test.ts` |

| REG-101 | A1 · el CI no corría lint | El repo tiene 135 errores y el propio workflow lo declaraba: «meterlo bloquearía el CI». Un gate que no existe deja pasar lo que debía frenar | CLOSED | Gate con TRINQUETE (`scripts/lint-trinquete.mjs`), el mismo patrón que salvó al gate de ADRs: exigir cero lo haría nacer en rojo, y **un gate que nadie puede poner en verde se marca `continue-on-error` y deja de proteger**. La deuda se congela en `docs/audit/lint-techo.json` y sólo puede bajar. Si sube, dice EN QUÉ ARCHIVO. Si baja, también falla: pide apretar el trinquete, porque un margen que no se aprieta se lo come el siguiente descuido |

| REG-102 | A3 · una ruta de IA con su propio gate incompleto | `receta/detectar-campos` comprobaba `creditosAgotados` a mano y se saltaba el tope de PRUEBA: una cuenta en cortesía con el cupo consumido seguía llamando a la API del dueño | CLOSED | Usa `gateCreditos`, el gate compartido, que mira las dos cosas. Dos gates distintos para la misma pregunta acaban discrepando |

| REG-103 | A4 · se creía que el cliente fijaba el monto del anticipo | Aparecía como P1 abierto en la auditoría del 26-jul | **YA ESTABA CERRADO** | Verificado hoy: `payment/create-checkout` calcula el monto del documento de la cita y de la configuración del consultorio —nunca del cuerpo de la petición— y el webhook usa `session.amount_total` de Stripe, que es la fuente autoritativa. Se deja asentado para no volver a auditarlo |

| REG-104 | La tabla de signos y el score NEWS2 se contradecían en la misma pantalla | La tabla del episodio pintaba en rojo con umbrales escritos a mano (`spo2 < 92`, `temp >= 38`, `fc > 100 \|\| fc < 50`) mientras el score usaba los del Royal College. **Lo peor era la temperatura: 35 °C salía en NEGRO y NEWS2 le da TRES puntos** — una hipotermia invisible justo en la lista que se mira para decidir si escalar. Y una SpO₂ de 92 salía normal sumando dos puntos | CLOSED | `nivelDeSigno()` llama al motor con ese único signo y traduce su puntaje: naranja para 1-2 puntos, rojo para 3 —que es el criterio de escalamiento del propio score—. **No hay ningún umbral nuevo**: si mañana cambia la tabla del Royal College, cambia en un solo sitio. Un caso recorre el rango comparando color contra puntos, así que meter un umbral propio en la interfaz vuelve a poner rojo el CI. `src/__tests__/hospital-news2.test.ts`. **Y al escribirlo reapareció «vacío no es 0»**: `Number('')` es cero, así que un campo sin medir salía como SpO₂ de 0 % → crítico. Se corrigió usando `num()`, el coercionador clínico compartido — la lección es que una coerción escrita a mano reintroduce el mismo fallo cada vez |

| REG-105 | El export FHIR: se creía que perdía dolor/EVA, ACVPU y O₂ | Aparecía como pendiente clínico de la auditoría maestra | **YA ESTABA CERRADO, pero sin red** | Comprobado hoy: emite los diez signos con su código LOINC. Lo que faltaba era el caso que lo demuestre — el fixture sólo mandaba TA, FC y temperatura, así que **borrar esas tres líneas del exportador no rompía nada**. Un dato que sale del sistema sin que nadie compruebe que salió es un dato que se pierde el día que alguien refactoriza. Se añade también que un signo ausente NO inventa un cero: exportar un dolor 0 que nadie midió afirma que no dolía. `src/__tests__/fhir-internamiento.test.ts` |

| REG-106 | La guarda de peso pediátrico kg/lb: se creía pendiente | Listada como NEEDS_CLINICAL_REVIEW | **YA ESTABA CERRADA Y CABLEADA** | `revisarPesoPediatrico` y `libraAKg` existen, tienen sus casos, y —lo que importa después de lo de hoy— **están montadas en producción**: `PanelPediatria` las usa y la consulta monta el panel. No auto-convierte un peso alto: lo detiene para que alguien lo verifique, que es lo correcto — convertir en silencio sería el mismo error con otro signo |

| REG-107 | El aviso de privacidad no se pedía al dar de alta EN EL CONSULTORIO | El portal público sí lo capturaba; el alta desde la pantalla de Pacientes —**la puerta por la que entran casi todos**— no. El modal existía desde hace tiempo, con `medioInicial: 'presencial'` de fábrica (o sea escrito justo para esto), y no lo montaba ninguna pantalla. Es el mismo patrón que apareció tres veces hoy: código correcto, probado, y sin conectar | CLOSED | LFPDPPP Art. 9: los datos de salud son sensibles y exigen consentimiento EXPRESO. Un expediente abierto sin él es un incumplimiento **que no se ve**, porque el sistema funciona igual. **No bloquea:** si se cancela, el paciente se registra igual y queda SIN consentimiento anotado, que es la verdad — fingir uno que no se dio sería peor que no tenerlo, y el aviso al guardar lo dice. Se carga la configuración del consultorio para que el aviso lleve su razón social y su domicilio: uno sin el nombre del responsable del tratamiento no identifica a nadie, que es justo lo que el aviso tiene que hacer |

| REG-108 | «Escrito, probado y sin conectar» — el fallo que se repitió CUATRO veces en un día | El 31-jul: el pipeline de voz de 9 etapas no aparecía en un solo archivo de producción; el constructor de vocabulario por paciente —lo único que cambia lo que el reconocedor OYE— no lo llamaba nadie; el modal de aviso de privacidad tenía `medioInicial: 'presencial'` de fábrica y ninguna pantalla lo montaba; y el motor V4 no tenía dónde cargar sus límites. **Ningún test normal lo detecta, porque el código está bien.** Los tests pasan, el build pasa, y el trabajo simplemente no le llega al médico — la forma más cara de fallar, porque se paga entera y no se nota | CLOSED | `src/__tests__/modulos-sin-conectar.test.ts`: un módulo de `lib/` o `components/` que nadie menciona pone el CI en rojo. Es un TRINQUETE porque hay huérfanos legítimos —exigir cero los borraría o forzaría a conectar algo a medias—, así que se congelan **con su razón escrita**, uno nuevo falla y quitar uno obliga a bajar la lista. El inventario que produjo vale por sí solo: **19 módulos**, y separa los que están donde deben (los propios gates del CI) de los que duelen — `news2-set`, `dosificacion-critica`, `ia/evaluacion`, `mobile/consulta-cierre`: trabajo clínico terminado y probado que todavía no tiene pantalla |

| REG-109 | A8 · siete de las once entradas fusionadas, separadas | `RULE_SOURCE_SEPARATION` exige guardar la dosis de ficha y la de guía en campos separados, y once entradas las tenían en una sola cadena copiada en los dos campos | CLOSED (7 de 11) | Se cortan **sólo donde el propio texto pone el marcador** —«FDA label: 2.5 g q8h en 2 h; IDSA AMR sugiere 2.5 g q8h en 3 h»—: ahí no hay que interpretar nada, hay que leer dónde el autor puso la etiqueta. Cada corte se revisó a ojo antes de aplicarlo. Las que ahora sí dicen cosas distintas incluyen **tigeciclina** (50 mg q12h de ficha contra 100 de la pauta alta de IDSA) y **pivmecilinam** (185 contra 370): confundirlas importa, y era justo lo que la fusión escondía. La separación pasa de ejercitarse en 3 entradas a 10. **Las cuatro que quedan NO llevan marcador y se quedan declaradas.** Ceftriaxona dice «Meningitis commonly uses 2 g q12h (syndrome-specific guideline/label context)» — «guideline/label» a la vez: no se sabe de cuál es, y adivinarlo sería exactamente lo que la regla prohíbe. `HUELLA_DATASET` actualizada |

| REG-110 | Clínico-legal (voz) | El bloque que la nota enseña como «transcripción original» se llenaba con el texto de TRABAJO: ya pasado por las CUATRO etapas del pipeline y **editable a mano por el médico**. El crudo del motor existía (`ResultadoPipeline.crudo`) y se descartaba en la misma línea en que se aplicaba. Ante un «yo no dije eso», lo archivado como material de origen ya había sido reescrito tres veces por máquinas y una por una persona | CLOSED (v996) | `src/__tests__/origen-del-dictado.test.ts`. Se archiva aparte en `transcripcionMotor`, también al RECUPERAR el audio del dispositivo —la consulta que se cayó es la que más falta hace defender— y se limpia al iniciar otra grabación: arrastrarlo sería material de origen DEL PACIENTE EQUIVOCADO |

| REG-111 | Pérdida de datos | `dialogoDiarizado` persistía los turnos ENTEROS de AssemblyAI, con `palabras:{texto,inicioMs,confianza}` dentro: varios MILES de objetos por consulta en el documento de la nota. El tipo declarado siempre fue `{speaker,text}[]` — el exceso no estaba ni tipado | CLOSED (v996) | `src/__tests__/origen-del-dictado.test.ts`. Este repositorio ya sabe qué pasa cuando un documento se acerca al 1 MB de Firestore: no falla el campo grande, **falla todo guardado posterior** (ya ocurrió dos veces con la config de receta en base64). Sobrevive la lista corta de palabras a verificar, que es LA MISMA que ve el médico |

| REG-112 | Clínico (voz) | Los `utterances` del pase de UCI viajaban a la consulta en la semilla y **no los leía nadie**: `grep` daba cero consumidores. Sin turnos se apagaban a la vez la separación de voces archivada, las palabras a verificar, el sexto motivo de confirmación y la procedencia V3 — el camino que más nota firmada produce en cuidados intensivos era el que menos defensas tenía | CLOSED (v997) | `src/__tests__/pase-uci-conserva-el-dictado.test.ts`. Es «escrito, probado y sin conectar» DENTRO del arreglo que venía a cerrarlo (REG-108). Si el origen no manda el crudo NO se inventa uno: rellenarlo con el texto de trabajo sería REG-110 otra vez |

| REG-113 | Clínico-legal | El rol del hablante —«Médico», «Paciente»— se calculaba, se enseñaba, el médico lo corregía a mano y se usaba para la procedencia al firmar… y se tiraba al archivar: el expediente guardaba «A» y «B». Es el dato que decide si un diagnóstico lo AFIRMÓ el paciente o lo NOMBRÓ la pregunta | CLOSED (v998) | `src/__tests__/quien-hablo-se-archiva.test.ts`. Sin rol conocido NO se inventa uno —poner «Médico» por defecto metería en boca del médico frases del paciente— y el turno conserva su `speaker`. El sello no se rompe: `dialogoDiarizado` se sella tal como está guardado |

| REG-114 | Clínico (voz) | `ContextoDictado.especialidades` viajaba por CUATRO capas y ninguna pantalla lo llenaba: el vocabulario salía sólo del módulo. Un infectólogo dictando en su consultorio NO cargaba «Antimicrobianos» ni «Microbiología y PROA» — justo los términos que más se le escriben mal | CLOSED (v999) | `src/__tests__/especialidad-del-medico.test.ts`. Tabla explícita de texto libre → claves del mapa, con una prueba de que TODO destino existe (un nombre mal escrito no falla: `contextosActivos` lo filtra en silencio). Sin coincidencia devuelve vacío, nunca «la más parecida» |

| REG-115 | Clínico (voz) | De las TRES listas de cambios del pipeline sólo se enseñaba una. Las invisibles eran las de **cifras, unidades y siglas** — o sea las que tocan DOSIS. «Le doy dos gramos… cada ocho horas» son tres reescrituras que el médico no veía por ninguna parte | CLOSED (v1000) | `src/__tests__/cambios-de-cifras-visibles.test.ts`. La regla ya estaba escrita en `pipeline.ts` para las correcciones léxicas: «una corrección que el médico no puede ver ni revertir es una edición que alguien le hizo a su dictado sin decírselo». Panel con deshacer en consulta y en UCI, donde las cifras son PEEP, FiO₂ y aminas |

| REG-116 | Clínico (IA) | Pasado el tope de 12 000 caracteres, la segunda opinión **no revisaba nada**. Un dictado de 20 minutos ronda los 20 000: el tope no era un caso raro, era el de todos los días — y dejaba sin red justo a la consulta complicada | CLOSED (v1001) | `src/__tests__/segunda-opinion-por-tramos.test.ts`. Se trocea la TRANSCRIPCIÓN, no la nota, en tramos SOLAPADOS —una indicación partida en seco deja media dosis a cada lado—. Si no cabe, se devuelven los hallazgos de lo revisado CON el aviso de qué quedó fuera; un tramo ilegible no se convierte en «revisado sin hallazgos» |

| REG-117 | Clínico (ASR) | `speech_model: 'best'` ya no aparece en la documentación del proveedor: es un alias, y a qué modelo resuelve lo decide él. De ese modelo depende cuántos términos de sesgo entran (1 000 en `universal-3.5-pro`, 200 en `universal-2`) y se mandaban MIL siempre — el recorte lo decidía el proveedor sobre una lista cuyo ORDEN es la política. Y sin límite de voces asume hasta 30: sobre-parte al mismo médico en varias etiquetas y vuelve irresoluble la atribución de roles | CLOSED (v1002) | `src/__tests__/modelo-y-voces-diarizacion.test.ts`. Modelo por su nombre con el tope que le corresponde; un modelo desconocido usa el MÁS PRUDENTE. Si el proveedor lo rechaza se reintenta con el alias y se registra. `max_speakers_expected`, no `speakers_expected`: la propia documentación advierte que fijar el número exacto sin estar seguro degrada la precisión |

| REG-118 | Clínico-legal | `atribuir-roles` ofrecía tres roles y el modelo estaba OBLIGADO a elegir uno. En un pase de hospital eso convierte a **enfermería en «Paciente»**, y desde REG-113 esa suposición se archiva | CLOSED (v1003) | `src/__tests__/roles-de-hablante.test.ts`. Catálogo por módulo con las etiquetas que ya usaba la discusión de UCI, y «Hablante no identificado» SIEMPRE disponible, ofrecido en el prompt como preferible a adivinar. Ese valor no se archiva: se cuenta y se devuelve el número, para no enseñar una lista que PARECE completa |

| REG-119 | Integridad (IA) | La síntesis del ensamble multi-modelo pasaba por el esquema —o sea se comprobaba la FORMA— y nadie miraba si las `source_quote` fusionadas seguían existiendo en la transcripción. Como el sello degrada a «ia» el campo cuya cita no aparece, una cita reescrita no rompía nada ruidosamente: hacía que un dato DICTADO dejara de parecerlo | CLOSED (v1004) | `src/__tests__/citas-de-la-fusion.test.ts`. Revalidación ELEMENTO POR ELEMENTO —tirar la fusión entera por una cita mala es el error del guardián del corrector—: se restaura del borrador base, y si nadie tiene una verificable se vacía la cita y se marca el campo. El dato clínico NO se borra: lo que se cae es la prueba. Nunca se busca «la frase más parecida» |

| REG-120 | Clínico-legal | El manifiesto de procedencia cubría diagnósticos, medicamentos, alergias y signos: **datos estructurados**. Y los TRES fallos que el Dr. encontró en producción vivieron en la PROSA. El sello contaba con precisión la parte que no había fallado | CLOSED (v1005) | `src/__tests__/procedencia-de-la-prosa.test.ts`. Cada sección y el resumen se sellan con la misma regla: cita que no aparece → «ia»; párrafo reescrito por el médico → «manual». La regla V3 sólo se aplica a ANTECEDENTES, que es donde ocurrió el fallo: exigirla en la exploración degradaría prosa correcta, y un sello que degrada de más deja de significar nada. El aviso de firma NO cambia: meter prosa ahí lo volvería ruidoso |

| REG-121 | Dinero | El MRR era el precio mensual de lista: el ANUAL inflado un 20 % —el catálogo dice doce meses al precio de diez— y los ASIENTOS adicionales sin contar. Dos errores en direcciones opuestas que se compensan, así que el total parecía razonable mientras cada línea estaba mal | CLOSED (v1006) | `src/__tests__/mrr-real.test.ts`. Se usan los médicos CONTRATADOS y no los presentes: esto es contabilidad, no capacidad — contar médicos que Stripe no cobra sería inventar ingreso. Todos los precios salen del catálogo y las pruebas se escriben CONTRA el catálogo |

| REG-122 | Dinero | La prueba abandonada se queda en `status:'trial'` **para siempre** —nadie la cancela porque nadie llegó a pagar—, así que no aparecía ni como baja ni como conversión: el tablero podía decir «0 % de bajas» mientras todas las pruebas del mes se caían | CLOSED (v1007) | `src/__tests__/churn.test.ts`. Se reconoce por su propia `trialEndsAt`, no por una duración supuesta —suponerla daría por vencida una prueba EXTENDIDA A MANO—, y va APARTE de la tasa de bajas: una mide retención y la otra conversión |

| REG-123 | Dinero | La consola de costos agrupaba por función, modelo y clase. El libro anota el `uid` en cada asiento desde que existe el gateway y nadie agrupaba por él; y no había ninguna cifra por consulta — las dos preguntas con las que se decide un precio | CLOSED (v1008) | `src/__tests__/costo-por-medico-y-consulta.test.ts`. Por médico va sobre COGS y con el uid, NUNCA el nombre. El costo por consulta divide entre TRANSCRIPCIONES FINALES y no entre notas —la nota en vivo se re-genera cada ~30 s—, una transcripción fallida no cuenta como consulta, y el SUPUESTO viaja escrito al lado: una media sin su divisor se lee como un hecho |

| REG-124 | Datos (portabilidad) | El bundle FHIR filtraba `estado === 'firmada'` y todo lo demás desaparecía EN SILENCIO: quien ejercía su derecho de portabilidad recibía un archivo con huecos que nadie le señalaba | CLOSED (v1009) | `src/__tests__/fhir-borradores.test.ts`. Salen con `Composition.status: 'preliminary'`, la palabra que FHIR ya tiene. Sin sus `Condition` ni `MedicationRequest`: un diagnóstico sin firmar entraría al receptor COMO CONFIRMADO, que es lo que la firma existe para impedir. El texto sí viaja; la afirmación estructurada, no |

| REG-125 | Interoperabilidad | Había DOS implementaciones FHIR del mismo modelo y **la API HTTP viva —la que consulta un tercero— usaba la pobre**: exportaba los diagnósticos de notas EN BORRADOR como `Condition` confirmadas, no emitía ningún `Composition` (el texto de la nota no viajaba) y no llevaba `Practitioner` | CLOSED (v1010) | `src/__tests__/una-sola-implementacion-fhir.test.ts`. Una sola implementación y la otra delega, con una prueba que compara los dos bundles CAMPO POR CAMPO: dos mapeos no se mantienen sincronizados y nadie se entera hasta que un tercero recibe el archivo malo. Se conservó lo bueno del pobre: las alergias UNA POR ALÉRGENO, con categoría y criticidad |

| REG-126 | Continuidad | El historial de `SIMULACRO_RESTAURACION.md` decía literalmente «todavía ninguno». Sin un tiempo medido no hay respuesta para un hospital que pregunte cuánto tarda NexusMED en volver | CLOSED a medias (v1011) | `src/__tests__/simulacro-respaldo.test.ts` + `npm run simulacro:respaldo`. Mide NUESTRA mitad —que el respaldo vuelve a leerse entero, con las mismas funciones que la importación— y la cronometra: 200 001 documentos en 161 ms, acta en el documento. **Declara siempre lo que NO mide**: el `gcloud firestore databases restore`, que necesita consola. Un número presentado como «el RTO» cubriendo un tramo es peor que ninguno. BLOQUEADO EN EL DR. esa mitad |

| REG-127 | Proceso | `modulos-sin-conectar` (REG-108) vigila ARCHIVOS huérfanos. En una sola sesión aparecieron SEIS fallos de la misma familia que no puede ver, porque el módulo sí estaba importado: lo que no se leía era **un campo del contrato** | CLOSED (v1012) | `src/__tests__/campos-sin-leer.test.ts`. Para una lista curada de CONTRATOS —los que cruzan una frontera— exige que cada campo declarado aparezca leído fuera de su propio archivo. Sólo contratos: vigilar todo daría cientos de falsos positivos y un guardián ruidoso se apaga. Encontró `ResultadoPipeline.trazas` en la primera pasada; NO se conectó a la fuerza —cuatro copias del dictado repetirían REG-111— y queda declarado |

| REG-128 | Clínico-legal (voz) | El modelo redacta leyendo el diálogo MARCADO, así que una cita de una frase con una palabra dudosa se lleva la marca `⟦…?⟧` dentro. El sello comparaba contra la transcripción PLANA, no la encontraba, y presentaba como «no se pudo comprobar» un campo **correctamente citado** — y encima justo en las frases donde el audio ya había dudado | CLOSED (v1013) | `src/__tests__/fidelidad-de-entrega.test.ts`. Es la `FidelidadEntrega` del charter: el juez tiene que leer el mismo string que el redactor. Se quitan las marcas al normalizar en LOS DOS jueces, atados por una prueba. Una cita que de verdad no está sigue sin sellar. **Verificado revirtiendo la corrección: 3 de 10 pruebas fallan sin ella** |

| REG-129 | Clínico-legal | La regla V3 preguntaba «¿lo afirmó alguien que no es el médico?» y **cualquiera** servía: un antecedente sostenido por LA HIJA se sellaba igual que si lo hubiera dicho la paciente, que puede no haberlo dicho nunca. Es el fallo del Dr. corrido un rol a la derecha | CLOSED (v1014) | `src/__tests__/fidelidad-de-entrega.test.ts` + caso `oro-rol-acompanante`. NO se rechaza el dato —el relato del acompañante es historia válida, y con demencia o afasia la única—: se DICE QUIÉN. Sin turnos no se inventa un rol. Criterio del charter con tolerancia cero: «un síntoma del acompañante como del paciente es un hecho falso» |

| REG-130 | Clínico (P0) | `ORDER_INTENT ≠ ORDER`: «si no mejora le agregamos amoxicilina» metía el fármaco en `medicamentos`, y `medicamentos` **alimenta la receta**. Una hipótesis dicha en voz alta podía salir IMPRESA, FIRMADA Y CON CÉDULA. No había NADA que lo mirara: ni regla determinista ni línea en el prompt | CLOSED (v1015, v1016) | `src/__tests__/intencion-de-orden.test.ts`. Motor determinista sobre el ENCUADRE de la frase. **No borra**: «si tiene dolor, paracetamol» es una PRN válida y borrar por condicional perdería medicación real. Pregunta por el canal que ya existía y DICE CUÁLES. Una mención firme manda sobre la duda previa, y la condición se juzga en SU frase. Lo mismo para los ESTUDIOS (v1016), que alimentan la orden que el paciente lleva al laboratorio. No es una decisión clínica: mira cómo se dijo, es gramática, no medicina |

| REG-131 | Integridad (registro clínico) | El registro clínico —el documento que dice QUÉ motores tiene NexusMED y CÓMO se llega a ellos, y lo que lee un auditor— nombraba **cinco puertas de entrada que no estaban en ningún archivo de su motor**: `corregirVigilado` en el guardián de sustituciones, `buscarFarmaco` y `nombresFarmacos` en el motor de dosis, y `resolveDoseRule` y `buscarFarmaco` en el V4 de antimicrobianos. Un registro con una puerta que no existe **no falla: certifica** — nadie lo ejecuta, así que un nombre mal escrito o un motor partido en dos archivos se quedan ahí años y el documento sigue pareciendo exacto | CLOSED (v1020) | `src/__tests__/entrypoints-del-registro.test.ts`: comprueba que cada `entryPoint` lo exporte algún archivo declarado del motor, y que todo archivo declarado exista. **Ninguna función estaba perdida**: las cinco existen en un archivo hermano que el motor no declaraba, así que se corrigió declarando esos archivos —la verdad— en vez de quitar las puertas del registro, que lo habría hecho más pequeño y menos cierto. NO comprueba si alguien LLAMA a la puerta: eso es de `modulos-sin-conectar` (REG-108), que en la v1019 aprendió que un `import type` no conecta nada |

| REG-132 | Clínico (P1) | La verificación de dosis corría **sólo en la receta** —unidad ausente, error de decimal, tope de adulto, mg/kg pediátrico— y **ninguna en hospitalización**. Ahí la dosis es un campo de TEXTO LIBRE, la indicación se arma concatenando `descripción + dosis + vía`, y de ahí va al **MAR, donde enfermería administra lo que está escrito**. La red de seguridad estaba donde el paciente se va a su casa con un papel, y no donde está internado y otra persona le pone el medicamento | CLOSED parcial (v1021) | `src/__tests__/dosis-en-hospitalizacion.test.ts`: la comprobación de UNIDAD corre en el modal de indicación y se enseña, con el texto redactado para quien lo lee ahí («enfermería no puede administrar lo que no dice cuánto»), no con el de receta («quien la surta»). El motor es el MISMO: el contexto cambia el texto, nunca el criterio. **DECLARADO Y NO CUBIERTO:** la comprobación mg/kg no se corre aquí porque necesita el `pesoDosificacion`, que vive en la estancia de UCI y que el charter §16 prohíbe fijar solo — correrla sin peso daría TOPES DE ADULTO SOBRE UN NIÑO, que es peor que no correrla |

| REG-133 | Clínico (voz · LEARN) | **El sistema no aprendía del médico.** Tenía un diccionario fijo de confusiones —el mismo para todos— y cargaba el vocabulario del paciente, pero cuando el médico corregía «sefriaxona» → «ceftriaxona» en el editor, esa corrección **se perdía**: al día siguiente el motor cometía el mismo error, con el mismo médico y en la misma palabra. Es la etapa «Learn» del charter, y era la que el Dr. pidió con «palabra por palabra, nota por nota, letra por letra» | CLOSED primera iteración (v1023) | `src/__tests__/aprendizaje-del-medico.test.ts`. La evidencia ya estaba: la nota guarda las DOS versiones desde REG-110 —lo que el motor oyó y el texto que el médico editó—, y la diferencia ES la corrección. Tres reglas lo hacen seguro: (1) **nada que toque una cifra, una unidad o un par prohibido**, reutilizando la política crítica que ya existe en vez de escribir un criterio nuevo; (2) **una sola vez no enseña nada** —la misma regla que la biblioteca de infusiones, que nunca aprende una dilución de una sola infusión—; (3) **una palabra por una palabra**, y si el médico añadió o quitó texto no se aprende nada de esa nota, porque las posiciones se desplazan y cualquier par sería coincidencia. Lo aprendido va **primero** en el vocabulario, antes que los fármacos del paciente: se ganó con evidencia sobre ESTE médico y el catálogo es un supuesto. Y **sólo sesga**: el corrector y su guardián siguen decidiendo — saber qué palabra dice el médico no es permiso para cambiarla |
| REG-134 | Clínico (voz · LEARN) + Privacidad | Lo que el médico corregía **no cruzaba de expediente**: la primera iteración (REG-133) derivaba las correcciones de las notas de ESE paciente, así que se corregía «sefriaxona» en la consulta de uno y con el siguiente el motor volvía a equivocarse. Y no se podía **deshacer**: un aprendizaje que no se puede quitar es peor que no aprender, porque una palabra torcida se empujaría en cada consulta sin que nadie pudiera pararlo | CLOSED (v1024) | `src/__tests__/aprendizaje-por-consultorio.test.ts`. Se acumula por consultorio en `clinics/{id}/asr_aprendizaje`, con `increment` y `arrayUnion` para que dos consultas simultáneas no se pisen —con una lectura-y-escritura la del último borraría la del otro y el contador nunca llegaría al mínimo—, y **al firmar**, no al guardar el borrador. El médico lo ve y lo quita en Configuración → «Palabras que aprendió el dictado». **Y NUNCA EL NOMBRE DEL PACIENTE:** lo aprendido ahora se comparte entre pacientes, así que un apellido dictado acabaría en un vocabulario común que esa persona nunca autorizó y encima sesgando el reconocedor en la consulta de otra; el filtro de «una palabra sin cifras» no lo impide —un apellido lo pasa—, así que se excluyen las partes del nombre explícitamente. Reglas de REG-133 intactas: cifras, unidades y pares prohibidos siguen sin aprenderse, y esto **sólo sesga**. La colección se declaró en la matriz de acceso, en las reglas (forma congelada, `delete` permitido) y en el manifiesto del respaldo — una colección que nadie respalda se pierde el día que hace falta |
| REG-135 | Clínico (voz) · escrito y sin conectar | **Lo aprendido llegaba al motor de repuesto y no al que transcribe.** LEARN (REG-133/134) metió las palabras que el médico corrige en el léxico de las rutas de Whisper — pero en una consulta grabada **la diarización se intenta primero** y Whisper es el respaldo, cosa que el propio archivo dice desde la v981, cuando este mismo fallo se reparó para los fármacos del paciente. Lo mismo con `especialidades` (v1022): `ContextoSesgo.especialidad` estaba declarado y `componerSesgo` lo ordenaba, y **la ruta no leía el campo**, así que nadie lo llenaba nunca. Y en UCI —la pantalla con más fármacos del hospital— no llegaba ninguna de las dos | CLOSED (v1025) | `src/__tests__/lo-aprendido-llega-al-motor-que-transcribe.test.ts`. Se cablea de punta a punta y **por los dos caminos**: el corto (multipart) y el largo (JSON, el de la consulta larga, que es la que más términos trae — cablear sólo uno dejaría sin sesgo justo a la consulta más difícil, que es lo que ya pasó una vez). En el orden del sesgo, lo aprendido va **después** de lo del paciente y **antes** del catálogo global: no contradice al léxico —donde va primero— porque allí caben 224 tokens y aquí 1 000, así que los dos entran y el orden sólo decide el margen; en ese margen sigue mandando lo que el paciente toma ahora mismo. No cuenta como término del paciente: `delPaciente` es la cifra con la que se mide si el expediente sesga de verdad e inflarla la volvería una medición falsa. UCI lo lee del CONSULTORIO —posible sólo desde REG-134—: en un pase de visita no hay expediente de consulta del que derivarlo, y con el modelo anterior se habría quedado fuera para siempre. **El sesgo es lo único que cambia lo que el motor OYE**: ninguna etapa posterior recupera una palabra que nunca llegó |
| REG-136 | Integridad (documento de auditoría) | La auditoría de voz del charter (`docs/voice/VOICE-001-auditoria.md`) listaba **doce fallos «ABIERTOS», dos de ellos P0**, y los doce estaban cerrados: la tabla se escribió el 2 de agosto y siguió igual durante veinte versiones que los fueron cerrando uno a uno. Un documento de auditoría que se queda quieto **no falla: certifica** — es la misma clase de daño que el registro clínico con puertas inexistentes (REG-131), sólo que al revés: aquí el papel hacía ver el producto PEOR de lo que es, y es el papel que lee un auditor o un comprador | CLOSED (v1026) | `src/__tests__/lo-que-cita-la-auditoria-existe.test.ts`. Los doce se re-verificaron **abriendo el archivo, no leyendo la bitácora**, y cada fila dice ahora cómo se comprobó y en qué versión se cerró. La sección de mediciones también: la negación SÍ tiene caso oro desde la v985 (lo que falta es la temporalidad), y la frase «ningún trinquete de voz corre en CI» dejó de ser cierta hace versiones — lo que sigue fuera son los **tres scripts de corpus**, y no por pereza: el corpus vive en el disco del Dr., y un trinquete que en CI no encuentra sus datos pasaría en verde sin medir nada, que es peor que no tenerlo. **El guardián** comprueba que cada archivo citado por los documentos de `docs/voice/` exista —incluidos los nombres sueltos sin carpeta, que son los más fáciles de dejar podridos— y que la tabla lleve fecha de re-verificación en vez de un «ABIERTOS» perpetuo. Lo que NO comprueba, y se dice: si lo que el documento afirma sobre ese archivo es cierto. Eso lo verifica una persona; un guardián mecánico sólo puede impedir que la afirmación apunte al vacío |
| REG-137 | Clínico (voz) | **«Tuvo neumonía hace 3 años» acababa escrito como padecimiento actual.** La negación tiene motor determinista y caso oro desde la v985; **la temporalidad no tenía nada**, y así lo declaraba la propia auditoría de voz del charter. Es el hermano del fallo que costó tres versiones cerrar: allí el interrogatorio nombraba la enfermedad en la PREGUNTA y el extractor la cosechaba; aquí la nombra en PASADO y se cosecha igual. Y se arrastra igual — queda en el expediente, se copia a la nota siguiente y cambia lo que otro médico lee dentro de seis meses | CLOSED (v1027) | `src/__tests__/el-pasado-no-es-el-presente.test.ts` · `src/lib/expediente/temporalidad.ts`. **Es gramática, no medicina**: no decide si una enfermedad sigue activa —eso es clínico y no es suyo— sino si el dictado la puso en pasado y la nota la afirma en presente, y enseña las dos frases. El mismo criterio que la intención de orden (REG-130). **La mitad del trabajo es la trampa**: «hace tres años» NO significa pasado por sí sola — «desde hace tres años tiene diabetes» es presente y es la forma normal de contar un crónico en la consulta mexicana, así que el presente MANDA sobre la marca de tiempo; un aviso que salta donde no debe se acaba ignorando, y con él los que sí importan. No avisa si la nota ya lo escribió bien («antecedente de», «historia de», «resuelta»). **No borra ni reclasifica**: sólo devuelve el aviso, y en ÁMBAR y no en rojo — escribir un padecimiento pasado no es un error como lo es afirmar algo que el paciente negó, e igualarlos gastaría el rojo. Reutiliza el vocabulario de `negaciones.ts` a propósito: dos listas se separan, y lo que falte no se vigila —está declarado— pero no se da por bueno |
| REG-138 | Clínico (voz) | **La segunda puerta del pasado: el extractor de entidades.** La v1027 puso el motor de temporalidad en la NOTA, y el panel «Extraer entidades clínicas» corre sobre **el mismo texto** con un `estado` que **nace en `activo` por omisión del esquema**: «tuvo neumonía hace tres años» salía como condición ACTIVA. Una entidad estructurada tiene peor pinta que una frase — parece un dato verificado. Es exactamente lo que ya pasó con las negaciones, y por eso allí quedó escrito que arreglarlo en una pantalla dejaría la otra rota | CLOSED (v1028) | `src/__tests__/el-pasado-no-es-el-presente.test.ts` (bloque «la segunda puerta»). **Aquí NO se reclasifica, a diferencia de las negaciones**, y la razón está escrita en el módulo: con una negación se puede porque el paciente dijo que no y `descartado` es lo que él afirmó; pasar una condición a `resuelto` porque la frase iba en pretérito **sería una decisión clínica** — una neumonía de hace tres años puede estar resuelta y una cardiopatía de hace tres años no lo está por haberla contado en pasado. Se señala y no se toca, en el servidor (que es donde estaba la defensa hermana, porque la ruta la consumen dos pantallas) y se enseña en el panel diciendo explícitamente que no se cambió nada. Si el extractor ya la puso como `resuelto`, acertó: ni se anota ni se avisa |
| REG-139 | Clínico (voz) | El prompt de la nota tenía la regla contra cosechar la enfermedad de la PREGUNTA (regla 23) y **ninguna sobre el tiempo verbal**: nada le decía al modelo que «tuvo neumonía hace tres años» va a antecedentes | CLOSED (v1029) | `src/__tests__/el-pasado-no-es-el-presente.test.ts` (bloque de la regla del prompt). Regla 24, junto a la 23 y con **las dos mitades**: el pasado va a antecedentes **y** «desde hace tres años tiene diabetes», «sigue con», «todavía», «actualmente» y «en tratamiento» son presente aunque traigan fecha — una regla con sólo la primera mitad empujaría al modelo a degradar un diagnóstico ACTIVO, que es peor que el fallo que se quería arreglar. El orden sigue siendo el de `negaciones.ts`: **un prompt es una petición** y se cumple casi siempre; «casi siempre» sobre un antecedente que se arrastra a todas las notas siguientes no basta, así que la regla ayuda a que no ocurra y el motor determinista (REG-137/138) garantiza que, si ocurre, se vea. `PROMPT_VERSION` pasa a `nota-2026-08`: viaja al sello de procedencia de cada nota, y dejarla igual haría indistinguibles las notas hechas con una regla y con la otra |
| REG-140 | Clínico (voz) · defecto propio | **El motor de temporalidad no cubría su propio titular.** La v1027 reutilizó SÓLO el vocabulario de `negaciones.ts`, que es de enfermedades **crónicas** —las del interrogatorio dirigido—, y el ejemplo con el que se bautizó el motor en el módulo, en la bitácora, en el changelog y en el PR —«tuvo neumonía hace tres años»— **no lo cazaba**: «neumonía» no es una crónica y no estaba en ninguna lista. El motor funcionaba, pasaba sus 20 casos y hacía creer que algo estaba vigilado. Y era **al revés de lo que pide el problema**: lo que se cuenta en pasado es lo AGUDO —una neumonía, una fractura, una cirugía—, mientras que lo crónico casi siempre sigue activo | CLOSED (v1030) | `src/__tests__/el-pasado-no-es-el-presente.test.ts` (bloque «el titular»). Vocabulario propio del motor, `AGUDAS_FRECUENTES`, con lo que de verdad se cuenta en pretérito. **Es vocabulario, no criterio clínico**, con el mismo límite declarado que `CRONICAS`: que falte un padecimiento significa que ese caso no se vigila, **no que se dé por bueno**. «Le operaron» entra como forma de «cirugía» porque en la consulta se cuenta con el verbo; «lo van a operar» no, porque en el futuro no hay nada que corregir. **`cronicasEn` no se tocó**: ensanchar el vocabulario de `negaciones.ts` cambiaría qué cuenta como NEGACIÓN, que es otra defensa y otra decisión, no un efecto secundario de ésta. La trampa sigue en pie con el vocabulario nuevo: «desde hace tres años tiene neumonía recurrente» no se marca |
| REG-141 | Clínico (voz) · fatiga de alerta | **Un balance hídrico negativo pedía confirmación en cada frase.** Medido el 4-ago-2026 al correr por primera vez el corpus de 6 000 frases del Dr. contra el pipeline: 25 de 6 000 pedían confirmación y **las 25 eran la misma frase** — balance hídrico con resultado negativo. `ES_CANTIDAD` no aceptaba signo delante de la cifra, así que leía «−1500 mL» y concluía que faltaba la dosis; el aviso llegaba a decir «Falta la cantidad en «−1500 mL»», enseñando el número que decía no encontrar | CLOSED (v1031, sin desplegar) | `src/__tests__/balance-negativo-no-es-dosis-rota.test.ts`. Se aceptan los cuatro signos que aparecen en un dictado transcrito (`-`, `+`, `−` U+2212, `–` U+2013) porque el reconocedor y los editores los intercambian sin avisar. **No debilita la defensa**: el signo sólo vale pegado a una cifra, y «Meropenem gramos» se sigue marcando. **Por qué importa más de lo que parece**: un balance negativo es lo normal en diuresis o ultrafiltración, y la compuerta que se disparaba de más es LA MISMA que avisa de una dosis que perdió su número — el ruido gastaba justo el aviso que no se puede ignorar. Verificado volviendo a medir el corpus completo: 25 → 0, con las intactas (96.02 %) y los términos clave perdidos (0) sin moverse |
| REG-142 | Clínico (voz) · defensa ciega | **La comprobación de negación y temporalidad miraba SÓLO el resumen.** El texto contra el que se contrastaba se armaba con un `join` sobre `diagnosticos` y un `Object.values` sobre `secciones` — y los dos son arreglos de **objetos**, así que llegaba «[object Object]». Se vio en producción, en la propia alerta del Dr., que citaba la nota como «…Diabetes mellitus tipo 2. [object Object] [object Object]…». El comentario del código prometía lo contrario: «se contrasta contra TODO lo que la nota afirma». Un antecedente negado que viviera **sólo** en el diagnóstico estructurado —el que se arrastra a la receta y a la nota siguiente— no disparaba nada | CLOSED (v1031, sin desplegar) | `src/__tests__/la-nota-entera-se-contrasta.test.ts`. Un solo constructor `textoDeLaNota(resumen, diagnosticos, secciones)` que lee `descripcion` + `codigoCIE10` y el `value` de cada sección, usado por las dos defensas: dos formas de armar «lo que la nota dice» acabarían divergiendo y una se quedaría ciega otra vez. **Y la prueba que debía protegerlo certificaba el defecto**: exigía la línea literal rota. Fijar la FORMA de una expresión no prueba su COMPORTAMIENTO — ahora se comprueba el constructor único y el comportamiento se prueba con condiciones que viven sólo en el diagnóstico o sólo en una sección |
| REG-143 | Operación (producto caído) | **La incidencia de IA se guardaba, se enseñaba, y el dueño no se enteraba.** El 4-ago-2026 al Dr. le salió «El servicio de IA no está disponible» **a media consulta**. Todo el camino existía —`claseDeFallo` clasifica, `avisoAlDueno` redacta el titular y qué hacer, `reportarFalloIA` lo agrupa por hora y lo guarda, `/superadmin/costos` lo enseña—: lo que faltaba era que **llegara a él**. Para enterarse tenía que saber que esa pantalla existe y acordarse de abrirla justo ese día, atendiendo. El propio repositorio lo había escrito una versión antes hablando de otra cosa: «una alerta que vive en su propia pantalla es una alerta que nadie ve» | CLOSED (v1032, sin desplegar) | `src/__tests__/la-caida-de-ia-sigue-al-dueno.test.ts`. Franja en el armazón de la app con el titular y la acción, con enlace al tablero. **Sólo al dueño**: un consultorio no puede arreglar la llave de la plataforma y decírselo sólo le roba tiempo con un paciente enfrente — la misma razón por la que el mensaje del médico y el del dueño se escribieron distintos. Ruta propia y **ligera** (`superadmin/incidentes`): reusar `/superadmin/costos` sería resumir el libro de costos, consultar Stripe y pedir los saldos de los proveedores en cada carga de la app para pintar una franja. Se pregunta **una vez al montar**, no en bucle: vigilar una pantalla que casi siempre está en verde se paga en lecturas todos los días. Vence a las 6 horas — un aviso que no se apaga deja de ser un aviso. Y si la consulta falla no se pinta nada: un aviso que se rompe no puede ser un problema encima del que ya hay. **NOTA HONESTA**: la premisa inicial de esta iteración era que `avisoAlDueno` no lo llamaba nadie; era falsa —se buscó con el nombre mal escrito— y se verificó antes de construir nada sobre ella |
| REG-144 | Clínico (seguridad) · escrito y sin conectar | **Cuatro parsers distintos del MISMO campo de alergias**, y el canónico existe desde que alguien escribió que «dos splitters distintos daban listas distintas del mismo campo». Los tres de fuera —el sesgo de voz de la consulta, UCI con su propia heurística de negación, y el extractor de entidades— perdían lo mismo: (1) **la barra y la «y»**, así que «Penicilina / Sulfas» y «penicilina y sulfas» viajaban como UN término y el alérgeno de en medio dejaba de sesgar nada; (2) **las negaciones**, así que «niega alergias» viajaba como si fuera un alérgeno; (3) **`alergiasEstructuradas`**, así que el paciente mejor documentado mandaba CERO. Duele más en el sesgo que en ningún sitio: el cruce alergia↔fármaco compara contra **lo que se oyó**, y un alérgeno que no llegó al sesgo puede salir mal transcrito — entonces el cruce **nunca salta** | CLOSED (v1032) | `src/__tests__/un-solo-parser-de-alergias.test.ts`. `alergenosDe` acepta el campo venga como venga (texto libre o lista, porque en el repositorio llega de las dos formas y eso no lo arregla un llamador) y los tres sitios lo usan. Guardián que prohíbe la quinta copia. **Y una nota sobre quién lo escribió**: `alergenosDe` se creó el 4-ago y **salió a producción en la v1031 sin un solo llamador** — escrita, probada y sin conectar, exactamente la clase de fallo que este repositorio lleva el año persiguiendo, cometida por el propio agente. Se cazó revisando el estado antes de seguir, y por eso la prueba comprueba **los llamadores**, no sólo la función. Segunda prueba del día que fijaba la FORMA de una expresión rota y con eso la certificaba (`sesgo-con-el-paciente`) |
| REG-145 | Voz · medición que no se repite | **Ningún trinquete de voz corría en CI**, y así lo declaraba la auditoría del charter. La razón no era pereza: el corpus vive en el disco del Dr. y un guardián que en CI no encuentra sus datos **pasa en verde sin medir nada**, que es peor que no tenerlo. Consecuencia: el fallo del balance hídrico (REG-141) se encontró **a mano**, corriendo el corpus una vez; nada habría avisado si se reintroduce | CLOSED (v1032) | `src/__tests__/trinquete-de-voz.test.ts`. La salida estaba delante todo el tiempo: **la regresión de texto no necesita el audio**, necesita las frases — y las 6 000 pesan 1.2 MB (`fixtures/voz/corpus-v3-6000.csv`); los 429 MB son los mp3, que se quedan fuera. Mide **dos** cosas: (1) que el pipeline no DAÑE un texto ya correcto ni pierda un término clave —criterio CERO— ni pida confirmación sin motivo, y (2) que el término clínico **sobreviva al pasar de la forma HABLADA a la escrita**, que es la métrica que manda porque el WER no la ve: «mcg» convertido en «mg» pesa lo mismo que un artículo y es un factor de mil. Los topes son **lo medido el 4-ago-2026**, no una meta: sólo pueden mejorar. **Probado al revés**: reintroduciendo el defecto del signo, falla con «expected 25 to be less than or equal to 0». Declara lo que NO mide: lo que el motor OYE exige gastar audio y se corre a mano |
| REG-146 | Voz (P0 · producto caído en silencio) | **El proveedor retiró `speech_model` y la diarización llevaba caída sin que nada avisara.** Descubierto el 4-ago-2026 al medir el corpus actuado con la llave del Dr.: la API devuelve 400 **con cualquier valor** del parámetro, incluido el alias `'best'` que era nuestro respaldo — comprobado llamándola con las dos variantes. Así que **los dos intentos de la ruta fallaban** y cada consulta grabada se iba al motor de repuesto **sin separación de voces**; sin voces separadas no hay atribución de rol, y de ella cuelgan el motor de negaciones y la procedencia V3. Silencioso, porque la ruta hace lo correcto: sigue con el respaldo antes que dejar al médico sin nota | CLOSED (v1032) | `src/__tests__/modelo-y-voces-diarizacion.test.ts`. Se manda `speech_models: ['universal-3-5-pro','universal-2']` —el respaldo entre modelos lo hace **el proveedor**, sin un segundo viaje ni una segunda subida del audio— y el nombre lleva **guiones**, que es como lo pide su mensaje de error. El sesgo se presupuesta para el modelo **más pequeño** de la lista: si se presupuestara para el mayor y acabara usando el menor, ochocientos términos los tiraría él por el criterio que quisiera y sin decirlo. Se quita el reintento del 4xx: existía para salvar la separación de voces y se vio que no salvaba nada — repetir un cuerpo que el proveedor rechaza no lo arregla, sólo esconde el motivo detrás de otro viaje; ahora el rechazo se registra **con el detalle del proveedor**, que es lo único que dice qué cambió. **Y LA LECCIÓN**: cuatro pruebas de contrato pasaban en VERDE mientras la diarización estaba caída, porque comprobaban que el código dijera lo acordado — no que el proveedor lo aceptara. Una prueba de contrato no sustituye una llamada real. **Primera medición de atribución de rol de NexusMED** (`docs/maintenance/informe-diarizacion-2026-08-04.json`): 8/12 diálogos con el número correcto de voces, **81.94 %** de turnos bien atribuidos y **9 confusiones médico↔paciente** sobre el corpus actuado |
| REG-147 | Fatiga de alerta (propio, mismo día) | **La franja de incidencias se volvió el ruido que venía a evitar.** Horas después de desplegarla, el Dr. la vio en su pantalla: **tres líneas del mismo aviso** —«Claude tardó demasiado»— ocupando el ancho completo por encima de su lista de pacientes. Su palabra: «mugrero». Dos defectos: (1) enseñaba lo que **no exige nada de él** —un timeout o una saturación del proveedor se resuelven solos y no hay botón que apretar—, y (2) **repetía el mismo problema**, porque las incidencias se agrupan por HORA y una caída de tres horas son tres documentos idénticos, pintados como tres avisos | CLOSED (v1032) | `src/__tests__/la-caida-de-ia-sigue-al-dueno.test.ts`. La franja sólo enseña **lo urgente** —llave rechazada, cuenta sin saldo: lo que deja la IA caída para todos los clientes hasta que el dueño entre a arreglarlo— agrupado en **una línea por problema** y con un tope de dos en pantalla; si hay más, el sitio es el tablero. Lo no urgente **no se pierde**: se devuelve cuántas quedaron ahí. Se ata contra el clasificador, que ya tenía tomada la decisión de qué es urgente. **Es exactamente la fatiga de alerta reparada ESA MISMA MAÑANA en la compuerta de dosis (REG-141), reintroducida por el mismo agente en otra pantalla** — la lección no se aprende en un módulo, se aplica en cada uno |
| REG-148 | Pérdida de datos (P0, en vivo) | **Una nota FIRMADA se quedaba abierta para editar y no se guardaba nunca.** Al Dr. le salía cada 30 segundos «el servidor rechazó el permiso (reglas o sesión vencida)» mientras atendía. Se descartaron las tres sospechas obvias leyendo su base y su navegador: **sesión viva**, **clínica activa con pase libre**, **usuario admin** de esa clínica. Fallaba la cuarta condición de la regla: la nota estaba **firmada**, y una nota firmada es inmutable. **Mecanismo**: las dos rutas que restauran el respaldo local reponen el `notaId` al que pertenecía —con razón, sin eso se creaba una gemela en el expediente— **sin comprobar si esa nota ya se firmó**. Con ese id, la pantalla edita un documento inmutable y cada autoguardado lo rechaza el servidor, para siempre; `guardarBorrador` no se salta porque su bandera `firmada` es de React y valía `false` — el contenido vino del respaldo, no del servidor. El médico dicta una consulta entera creyendo que se guarda | CLOSED (v1034) | `src/__tests__/nota-firmada-no-se-edita.test.ts`. Antes de adoptar el id se pregunta al servidor; si está firmada, **el contenido restaurado se queda** —no se pierde una palabra— pero pasa a ser una nota NUEVA, y se dice por qué con esas palabras. En **las dos** rutas: arreglar una y dejar la otra ya se hizo aquí una vez. **La regla NO se toca**: es la que le da valor legal al expediente; el fallo era del cliente, que le pedía algo imposible. Y de paso los avisos de negación y temporalidad se pueden **quitar** («Ya lo revisé»): quitarlos no cambia la nota ni resuelve nada —el criterio clínico quedó en lo que el médico escribió— y vuelven a salir si el contenido cambia |
| REG-149 | Clínico (nota) · se rendía por aritmética | **La nota caía al parser local por una suma mal hecha, no porque el proveedor fallara.** Cada intento esperaba **90 s fijos** y se hacían hasta tres: 270 s más las esperas **no caben** en los 300 s de la función, así que el último intento lo cortaba Vercel en seco. Y 90 s es poco de entrada: una consulta larga con razonamiento extendido tarda, y rendirse teniendo presupuesto de sobra es tirar la nota por impaciencia. El médico veía «Claude tardó demasiado» y una nota rellena de «No referido en esta consulta» | CLOSED (v1035) | `src/__tests__/el-reloj-de-la-nota.test.ts`. Cada intento recibe **lo que queda** del presupuesto menos una reserva de 25 s para responder —si esa reserva no existiera, el trabajo podría estar hecho y perderse al cortar Vercel, la peor forma de fallar—, no se empieza un intento que no puede terminar, y se reintenta **mientras quede tiempo** en vez de un número fijo de veces. Y por instrucción del Dr. («dale el tiempo que necesite, no nomás 4.5 minutos») el techo sube de **300 s a 800 s** con Fluid compute: un solo intento puede usar hasta 775 s. **No se baja nada de calidad**: mismo modelo, mismo razonamiento extendido, misma cascada. `maxDuration` tiene que ser un literal por exigencia de Next, así que una prueba ata los dos números — si se separan, o se desperdicia tiempo pagado o Vercel corta con el trabajo hecho |
| REG-150 | Clínico (voz) · cifra plausible y equivocada | **Un decimal dictado con «y» perdía su último dígito.** «pH siete punto **treinta y cinco**» salía «pH 7.30 y 5»; el potasio 3.42 quedaba 3.40; la norepinefrina 0.35 quedaba 0.30. La parte ENTERA sí unía decena y unidad con «y»; la decimal rompía el bucle y el 5 se caía fuera como texto suelto. Es la forma **natural** de dictar un pH, un potasio, un INR o una dosis de vasopresor en español, y **lo que quedaba era plausible** — el peor modo de falla. El guardián no lo veía: sólo vigila cifras que DESAPARECEN, y aquí la que sobra aparece. Corre en TODAS las rutas: el pipeline va delante del extractor y del modelo que redacta | CLOSED (v1036) | `src/__tests__/auditoria-v7-dia1.test.ts`. Se acepta la «y» entre decena y unidad dentro de la parte decimal y se compone (30+5=35), sólo cuando la decena es múltiplo de diez. **Es gramática del español, no criterio clínico.** Encontrado por el auditor de seguridad de medicación del Día 1 del Master Loop V7 y verificado ejecutando el motor |
| REG-151 | Clínico (P0) · alergia que desaparece | **Una alergia real se perdía detrás de una negación.** «Niega penicilina. **Alérgico a sulfas**» devolvía `[]`: sin el punto como separador era UN fragmento, y `esAlergiaNegada` lo filtraba entero. La alergia a sulfas desaparecía de **los cuatro** sitios que leen del parser canónico — la compuerta de la receta, la nota que valida NOM-004, el recurso FHIR y el sesgo del reconocedor. El camino hospitalario (`hospital/cds.ts`) ya partía por punto y su comentario decía por qué: «para no perder una alergia real que venga después de una negada». Conocía el modo de fallo; el canónico no | CLOSED (v1036) | `src/__tests__/auditoria-v7-dia1.test.ts`. Se añade el punto **exigiendo espacio detrás**, para no partir decimales («2.5 mg») ni abreviaturas («Penicilina G.») — sin esa condición el arreglo habría creado un problema nuevo. **Y la tercera ruta cruda**: la alerta alergia↔fármaco de la pantalla de consulta metía el campo entero como un solo alérgeno, sin partir y sin filtrar negaciones, así que «niega alergia a penicilina» + amoxicilina pintaba la alerta CRÍTICA roja justo donde se prescribe — REG-034 y REG-035 por tercera vez, y en el mismo archivo había otras dos lecturas que sí usaban el parser bueno |
| REG-152 | Pérdida de datos (legal) | **El respaldo «completo» no guardaba las ADENDAS ni el versionado.** El exportador bajaba **un solo nivel** y las adendas viven dos: `patients/{p}/notas/{n}/adendas/{a}`. La adenda es el **único mecanismo de corrección** que existe sobre una nota firmada, que es inmutable por la NOM-024 — así que restaurar ese respaldo devolvía la nota y **borraba la corrección legal**, mientras el pie del archivo decía `completo: true`. Y el simulacro de ida y vuelta medía fielmente la mitad equivocada | CLOSED (v1037) | `src/__tests__/respaldo-consultorio.test.ts`. `hijas` pasa de lista plana a **árbol** (`RamaRespaldo`) y el exportador recorre recursivamente. **Y el guardián era estructuralmente ciego**: escaneaba `^ {6}match /` —sólo el primer nivel—, así que no podía ver el hueco; ahora recorre el bloque de `clinics` a cualquier profundidad y compara contra el árbol declarado. Tercera prueba del día que **fijaba el defecto en verde**: exigía con `toEqual` la lista incompleta de cinco hijas. Fijar la forma de una lista no prueba que la lista esté completa |

## REG-153 · El anticipo se podía cobrar DOS veces

**Dónde** — `src/app/api/stripe/webhook/route.ts`, rama `paciente_anticipo`.

**Qué pasaba** — El cobro se escribía con `.add()`, que crea un documento nuevo
cada vez. Si la cita se reagendaba o se borraba antes de que llegara el webhook,
`citaRef.update()` lanzaba NOT_FOUND; el catch retiraba la marca —correcto, para
no perder el dinero— y devolvía 500. Stripe reintenta durante unos tres días, y
cada reintento escribía **otro cobro**. Varios cobros en Finanzas por un solo
pago, y el corte de caja los suma todos.

**Reparación** — El identificador del cobro pasa a ser `stripe_{session.id}`:
escribir dos veces es escribir el mismo documento. `create()` falla si ya existe
y ese fallo concreto (código 6, ALREADY_EXISTS) se trata como éxito idempotente,
siguiendo adelante a saldar la cita, que es lo que había fallado.

**Lo que NO se tocó** — La marca se sigue retirando al fallar: es lo que impide
el estado peor, dinero cobrado en Stripe que no aparece en Finanzas.

**Golden** — `src/__tests__/anticipo-no-se-cobra-dos-veces.test.ts` (7 casos).

## REG-154 · La «O» de ARCO se resolvía con un `prompt()` y no apagaba nada

**Dónde** — `src/app/(dashboard)/cumplimiento/page.tsx`, `resolverArco`.

**Qué pasaba** — La Oposición («dejen de usar mis datos para esto») se cerraba
escribiendo un texto libre: la solicitud pasaba a «resuelta», el plazo de 20 días
hábiles de la LFPDPPP se daba por cumplido, y **no se apagaba nada**. El paciente
seguía recibiendo recordatorios.

Lo que lo vuelve grave es la comparación: quien contestaba «BAJA» por WhatsApp SÍ
dejaba de recibirlos, porque ese camino llama a `registrarBaja`. La vía formal
—por escrito, en el portal, con plazo legal— era la única que no funcionaba.

Se encontró **verificando que la «A» (v946) y la «C» sí estuvieran cerradas**; las
dos lo estaban.

**Reparación** — `POST /api/arco/oponerse` registra la baja del teléfono —el
candado que el envío proactivo ya consulta en cada mensaje—, marca el expediente
acumulando fines previos, cierra la solicitud y lo asienta en la bitácora.
Decisión en módulo puro: `src/lib/arco/oposicion.ts`.

**Lo que NO promete** — Sólo se declaran ejecutables los fines con un candado
real. Promociones y compartir-con-terceros quedan registrados y se devuelven como
avisos con la acción concreta que le toca a una persona: declarar apagado lo que
ningún código apaga es el engaño que la Cancelación ya había producido una vez.

**NEEDS_LEGAL_REVIEW** — Qué fines son separables entre sí lo fija el abogado del
consultorio. Aquí sólo se decide lo técnico.

**Golden** — `src/__tests__/arco-oposicion.test.ts` (17 casos), incluida la
comprobación de que la salida a la ruta va **antes** del `prompt()`.

## REG-155 · «El servidor rechazó el permiso» cuando el permiso estaba bien

**Dónde** — `src/lib/expediente/firestore.ts` (`updateNota`) y la pantalla de consulta.

**Qué se veía** — Con una consulta enfrente, dos avisos a la vez: «La nota NO se
está guardando en el servidor (el servidor rechazó el permiso (reglas o sesión
vencida))» y «Error al firmar».

**Lo que se descartó en su sistema en vivo** — rol `admin`, clínica `active`,
`paseLibre`, sesión con token vivo, nota de 10 KB (el tope es 1 MB) y el campo
`estado` presente en la raíz de los 22 documentos. Todo correcto.

**Causa raíz** — La pantalla tenía un `notaId` de un documento que **ya no
existe** (respaldo local restaurado, o nota descartada) y actualizaba a ciegas.
Firestore, ante un `update` sobre un documento ausente, **no contesta «no
existe»**: la regla intenta leer `resource.data.estado` de un `resource` nulo,
revienta, y el fallo vuelve como PERMISSION_DENIED. De ahí el diagnóstico falso.

**Por qué era evitable** — `updateNota` ya leía el documento justo antes para
versionarlo y `prev.exists()` decía que no. Tenía el dato en la mano.

**Reparación** — Se distingue «la lectura dijo que NO existe» de «la lectura
falló» (sólo lo primero es concluyente) y la consulta se recupera sola: recrea el
borrador con lo que hay en pantalla y sigue, en el autoguardado y en la firma.
Siempre como borrador, para no saltarse REG-017.

**Golden** — `src/__tests__/nota-que-ya-no-existe.test.ts` (8 casos).

## REG-156 · El análisis de evidencia se rendía en 40 s y culpaba a la llave

**Dónde** — `src/app/api/expediente/evidencia/route.ts`.

**Qué pasaba** — Dos defectos. (1) 40 s fijos para el modelo dentro de una
función de 60 s, sin descontar lo que PubMed ya había gastado: con 12 artículos y
el nivel Máxima se acababa el reloj y la pantalla mostraba las fuentes sin
razonamiento. (2) El aviso mandaba a «revisar tu llave/créditos» ante un timeout
del proveedor — se comprobó en la cuenta del Dr. y estaban bien.

**Reparación** — 300 s de función, presupuesto atado al literal por un test, y al
modelo se le da **lo que queda** descontando lo ya gastado. El reloj es local a
cada petición (como variable de módulo, dos consultas simultáneas se lo
pisarían). El aviso distingue el timeout del problema de cuenta.

**Golden** — `src/__tests__/evidencia-presupuesto.test.ts` (8 casos).

## REG-157 · Una consulta descartada podía volver sola

**Dónde** — `src/app/(dashboard)/consulta/[patientId]/page.tsx`, `descartar()` y
el autoguardado.

**Cómo apareció** — Buscando el ORIGEN de REG-155: cómo llega la pantalla a tener
el id de un documento que ya no existe. `descartar()` borraba el documento y
navegaba fuera, pero **no soltaba `notaIdRef`**. El autoguardado se serializa en
una cadena, así que puede quedar uno en vuelo, y ese guardado tardío escribía
sobre el documento recién borrado — una de las formas en que el Dr. veía «el
servidor rechazó el permiso».

**El riesgo que introdujo la propia reparación de REG-155** — Desde que la
consulta se recupera sola de un documento ausente, ese guardado tardío **volvería
a crear la nota que el médico acaba de descartar**, después de confirmar «se
eliminará y no podrás recuperarla». Recuperar es correcto cuando el documento se
PERDIÓ; es un defecto grave cuando se borró QUERIENDO.

**Reparación** — `descartadaRef` (ref, no estado: tiene que valer sin esperar al
render) se marca ANTES de borrar, el id se suelta (`notaIdRef.current = null`), el
autoguardado se detiene en la puerta y la recuperación comprueba la marca antes
de crear.

**Antecedente** — El propio código ya avisaba de una versión anterior de esto: «la
consulta descartada reaparecía completa […] y se recreaba sola en Firestore al
autoguardarse».

**Golden** — `src/__tests__/consulta-descartada-no-resucita.test.ts` (7 casos).

## REG-158 · Lo que dijo el paciente quedaba archivado como dicho por el médico

**Dónde** — `src/app/api/expediente/atribuir-roles/route.ts`.

**Cómo se encontró** — Abriendo el detalle del 81,94 % de atribución de rol
medido sobre el corpus actuado. De las 9 confusiones, **6 venían de los dos
diálogos en los que el proveedor devolvió UNA sola voz** — y no eran errores de
reparto: el diálogo entero llegaba como un solo turno.

Lo que se atribuyó íntegro al médico en uno de ellos:

> «¿Ha fumado alguna vez? Fumé como 10 años, pero lo dejé hace 5. ¿Toma alcohol?
> No, nunca he tomado.»

El endpoint contestaba «Médico» con naturalidad, porque el texto está lleno de
preguntas clínicas. Es el mismo mecanismo del peor defecto que ha tenido este
sistema («¿diabetes o presión alta?» «No» → «paciente con DM2 e HTA»), pero antes
en la cadena: el motor de negaciones y la procedencia razonan sobre una
atribución falsa y responden con la misma seguridad que si fuera cierta.

**Por qué no bastaba con desconfiar de toda voz única** — El médico dictando solo
es un uso normal. Lo que separa los dos casos es una marca gramatical
comprobable: en un diálogo mezclado, el mismo hablante pregunta en segunda
persona y responde en primera. Y una segunda vía, más limpia, que encontró el
propio corpus: el **vocativo** («está bien, doctor») — nadie se llama «doctor» a
sí mismo dictando.

**Reparación** — `src/lib/asr/separacion-fallida.ts` (módulo puro).
Con mezcla detectada no se asigna ningún rol y se avisa al médico.

**Medición** — `npx tsx scripts/medir-separacion.ts` sobre las 12
transcripciones ya pagadas: **2 de 2 detectados, 0 falsos positivos** en los 10
diálogos que sí se separaron.

**Nota honesta sobre el 81,94 %** — 7 de las 9 confusiones ocurren con la misma
pareja de voces sintéticas (`echo`/`shimmer`). Ese número mide en buena parte lo
parecidas que son dos voces de laboratorio, no sólo la capacidad del sistema; no
debe publicarse como métrica de producto sin decirlo.

**Golden** — `src/__tests__/separacion-de-voces-fallida.test.ts` (9 casos).

## REG-159 · El WER que no se podía publicar, ya medido

**Qué pasaba** — La primera medición de los 6 000 audios dio 38,20 % de WER crudo
y no era publicable: el 35,6 % de los fallos venían del **propio corpus**, cuyo
generador expandió las unidades sin límite de palabra y grabó frases que no
existen en español («microgramos ramos», «Hemogramoslobina»). El reconocedor
salía reprobado por un defecto ajeno.

**Reparación** — `scripts/medir-wer-limpio.ts` separa las dos cosas y publica los
DOS números, reutilizando las 5 999 transcripciones ya pagadas (coste cero,
reproducible).

**Resultado** — El corpus roto costaba **10 puntos de WER**:

| | Todo el corpus | Sólo audio válido |
|---|---:|---:|
| Frases | 5 999 | 4 635 |
| WER crudo | 35,77 % | **25,55 %** |
| WER tras pipeline | 29,37 % | **22,81 %** |
| Recall de término clínico | 67,37 % | **71,48 %** |

**El hallazgo que más importa** — El pipeline baja el WER 2,74 pp pero **casi no
mueve el recall de términos clínicos** (+0,13 pp): no recupera lo que el motor no
oyó. La palanca está en el sesgo de vocabulario, no en más post-proceso.

**Límites declarados** — Una sola voz sintética, sin ruido ni solapamiento,
frases sueltas, motor de respaldo. Es un PISO de laboratorio.

**Pendiente** — Regenerar el audio de las 1 364 filas (gasto de TTS, decisión del
dueño). El CSV ya se repara con `reparar-corpus-expansion.ts` (1 322 verificadas).

**Golden** — `src/__tests__/wer-publicado.test.ts` (8 casos): vigila que el
documento público y los datos crudos digan lo mismo y que los límites no se caigan
del texto.

## REG-160 · El importador validaba un campo y escribía en otro

**Dónde** — `src/lib/clinica/restaurar.ts` (`leerLinea`) y
`src/app/api/clinic/importar/route.ts`.

**Defecto 1 — se podía pisar una nota FIRMADA.** Cada línea del respaldo trae
`_coleccion` y `_ruta`. El importador validaba `_coleccion` contra el manifiesto
y escribía en `_ruta`; los dos vienen del mismo archivo y nada obligaba a que
concordaran. Un respaldo manipulado podía declarar `_coleccion: "patients"`
—inocua y admitida— apuntando `_ruta` a `…/patients/P/notas/N`. Y el importador
usa el SDK admin, que **ignora las reglas**: la inmutabilidad de una nota firmada
(NOM-024) no se evalúa por ese camino.

**Defecto 2 — regresión propia de v1037, que rompía la restauración.** Al
convertir `hijas` en un árbol (para respaldar adendas y versiones), el importador
seguía interpolando cada elemento y producía `patients.[object Object]`. Así que
`patients.notas` no figuraba entre las conocidas y **toda nota se rechazaba al
restaurar**: el respaldo se exportaba completo y no se podía volver a meter.

**Reparación, una para los dos** — La colección se **deriva de la ruta**
(`coleccionDeLaRuta`): lo que se valida y lo que se escribe pasan a ser el mismo
dato, y las rutas anidadas se reconocen solas. El importador aplana el árbol con
`rutasDelArbol` en vez de interpolar (44 rutas conocidas, antes menos).

**Golden** — `src/__tests__/importar-no-pisa-lo-firmado.test.ts` (9 casos),
incluido el ataque exacto que antes pasaba.

## REG-161 · El identificador del paciente viajaba a una colección raíz

**Dónde** — `src/app/api/errores/route.ts`.

**Qué pasaba** — El reporte de errores guarda la ruta en la que ocurrió el fallo,
y hace bien. Pero las rutas de esta aplicación llevan el identificador del
paciente dentro (`/consulta/<patientId>`, `/expediente/<patientId>`), y esos
reportes van a `errores`: una colección **raíz**, fuera del ámbito del
consultorio y legible desde la consola del dueño de la plataforma.

PHI saliendo de su consultorio por un canal de diagnóstico técnico, sin que nadie
lo pidiera ni lo viera. El `mensaje` y el `stack` se guardaban igualmente crudos.

**Reparación** — `redactarRuta()` conserva la FORMA (`/consulta/:id`), que es lo
que hace útil el reporte, y borra el valor; la cadena de consulta se tira entera.
`mensaje` y `stack` pasan por `redactarString`, que ya existía y no se estaba
usando aquí.

**Golden** — `src/__tests__/errores-sin-phi.test.ts` (9 casos), incluida la
comprobación de que una ruta inocua no se estropea — un redactor que borra de más
hace ilegible el informe.

## REG-162 · La cola de auditoría sobrevivía al cierre de sesión

**Dónde** — `src/lib/salir-seguro.ts` y `src/lib/expediente/audit-log.ts`.

**Qué pasaba** — `nx.audit.pendientes` vive en `localStorage` y guarda los
asientos de bitácora que no se pudieron mandar, con el paciente y el evento
dentro. La limpieza del logout sólo mira `PREFIJOS_PHI`, así que esa cola se
quedaba en el disco: en un equipo compartido, visible para quien entrara después.

**Por qué no se borra sin más** — Un asiento sin mandar es registro medicolegal.
Purgarlo «por seguridad» cambiaría un problema de privacidad por una pérdida de
trazabilidad — el mismo error que ya se cometió con los borradores y se corrigió
purgando sólo cuando el trabajo está a salvo.

**Reparación** — Se **manda** la cola antes de cerrar, mientras el token todavía
sirve, que es lo único que la vacía de verdad. Va antes del `signOut` a
propósito: después, `fetchAutenticado` no tendría con qué autenticar. Lo que no
se pueda enviar se queda, y los asientos de otra persona siguen esperándola.

**Golden** — `src/__tests__/auditoria-no-sobrevive-al-logout.test.ts` (7 casos).

## REG-163 · Un consultorio podía quedarse con el canal de WhatsApp de otro

**Dónde** — `manual-connect`, `meta-connect` y `360dialog-callback`.

**Qué pasaba** — `whatsapp_channels/{id}` es el índice que usa el webhook para
decidir a qué consultorio pertenece un mensaje entrante. Los tres caminos de
conexión lo escribían con un `set()` plano, **sin mirar de quién era**. Si un
segundo consultorio reclama un identificador ya tomado, el índice se reescribe y
todos los mensajes entrantes de ese número pasan a entregarse en el consultorio
nuevo — incluidos los de los pacientes del primero, que siguen escribiendo al
mismo teléfono.

Fuga entre inquilinos por la puerta de atrás: nadie lee el expediente de nadie,
pero los mensajes de los pacientes de A acaban en la bandeja de B y el bot de B
les contesta con la agenda de B.

**Reparación** — `src/lib/whatsapp/reclamar-canal.ts`: reclamar un canal ocupado
por otro consultorio devuelve 409 explicando qué hacer; la reconexión del mismo
consultorio sigue permitida (cambio de token, reinstalación). **Fail-closed**: si
el índice no se puede leer, no se reclama — es justo el caso en el que el `set()`
optimista causaba el daño.

**Golden** — `src/__tests__/canal-whatsapp-no-se-secuestra.test.ts` (11 casos),
que exige la cobertura de **los tres** caminos: dejar uno abre el agujero entero.

## REG-164 · El candado anti-IDOR del dictado se desactivaba solo

**Dónde** — `src/app/api/expediente/transcribir-diarizado/route.ts`.

**Qué pasaba** — REG-030 cerró un IDOR registrando el dueño del transcript y
verificándolo al leerlo. Pero el registro se escribía **sin `await`**
(`void … .set().catch(() => {})`) y la lectura era **fail-open** («si no hay
registro de dueño, se permite»).

Los dos juntos convertían el candado en una sugerencia: en un runtime serverless
la función puede terminar antes de que la escritura llegue a Firestore, y
entonces cualquier consultorio con el UUID leía el dictado. El agujero que
REG-030 cerró volvía a abrirse por una carrera.

**Reparación** — Se espera la escritura; si falla, no se devuelve el id: se purga
el trabajo en el proveedor (para no dejar PHI sin dueño en casa de un tercero) y
se pide reintentar. Y como todo id que un cliente conoce ya tiene dueño, la
excepción del fail-open sobra: **sin dueño no se entrega**, y si el registro no se
puede leer, tampoco.

**Golden** — `src/__tests__/dictado-sin-dueno-no-se-entrega.test.ts` (7 casos).

## REG-165 · La receta afirmaba una vía que nadie dictó

**Decisión del médico dueño (4-ago-2026)**, textual: «déjalo oral pero que avise
si no se dictó la vía». Es suya y no mía: yo detecto que el dato falta; qué se
hace clínicamente cuando falta lo decide él.

**Qué pasaba** — El prompt de extracción trae `"via": "oral"` en su plantilla, así
que el modelo la rellena **siempre**, se haya dictado o no. La receta acababa
afirmando una vía de administración que nadie dijo, con la misma tinta que las que
sí se dictaron. `via-parenteral.ts` rescataba el caso más grave —«insulina ·
oral», que no existe— pero sólo para fármacos sin presentación oral.

**Reparación** — `src/lib/expediente/via-asumida.ts` (módulo puro). Se decide
mirando la **cita** de la que salió cada fármaco, no preguntándole al modelo:
«esto no se dijo» es justo la señal que un generativo peor distingue, porque
rellenar el hueco es lo que sabe hacer. La vía se queda en ORAL y se avisa.

**Diseño del aviso** — Ámbar y no rojo (una vía asumida casi siempre será oral de
verdad; pintarla de rojo devaluaría el rojo). **Un solo aviso** para todos los
fármacos: uno por medicamento sería la fatiga de alerta ya corregida en esta
pantalla. Descartable con «Ya lo revisé», como pidió el Dr.

**Golden** — `src/__tests__/via-no-dictada-avisa.test.ts` (17 casos), incluido que
la cita propia manda sobre el texto de respaldo — sin eso, un solo «vía oral» en
toda la consulta apagaría el aviso para todos los medicamentos.

## REG-166 · Nadie vigilaba al vigilante

**Dónde** — `src/lib/ops/latido.ts` y `src/app/api/superadmin/incidentes/route.ts`.

**Qué pasaba** — `cron/vigilante` lee los latidos de los demás trabajos y avisa
cuando alguno deja de correr. Su propio comentario declaraba el punto ciego: «si
se cae ÉL, el propio diagnóstico lo enseña la próxima vez que alguien mire». Pero
**nadie más miraba**: el único lector de los latidos era él, y un vigilante caído
no se lee a sí mismo. Tampoco figuraba en `PERIODO_MIN`, así que ni había con qué
comparar su latido — «lleva tres días sin correr» era indistinguible de «acaba de
correr». Y el buzón `OPS_ALERTA_WEBHOOK` sigue sin configurar, así que hoy ni el
camino normal avisa a nadie.

**Reparación, sin infraestructura nueva** — El vigilante entra en `PERIODO_MIN`
(15 min, atado a `vercel.json` por un test), y la **franja del dueño** —que ya se
pinta en cada carga de la aplicación— lee los latidos. El lector deja de ser el
propio vigilante, que era lo único que faltaba.

Sólo se avisa de `nunca` y `tarde`: un trabajo que corrió y falló ya se reporta
por sus medios; lo que nadie más puede contar es el que **dejó de correr**, porque
un trabajo muerto no levanta la mano. Van primero en la lista: si los trabajos
automáticos no corren, nada de lo demás corre tampoco.

**Golden** — `src/__tests__/quien-vigila-al-vigilante.test.ts` (10 casos).

## REG-167 · El sesgo de vocabulario degradaba el motor al modelo viejo

**Dónde** — `src/app/api/expediente/transcribir-diarizado/route.ts` y
`src/lib/asr/sesgo-diarizado.ts`.

**Cómo apareció** — Midiendo por primera vez cuánto aporta sesgar el motor con el
expediente del paciente (petición del médico dueño, 5-ago-2026). El resultado fue
**0,00 pp**, y eso no cuadraba.

**Causa raíz** — La ruta mandaba `word_boost` **y la lista de modelos**. El
proveedor, textual al rechazar la variante sin lista:

> «"word_boost" is not compatible with universal-3-5-pro. Use "prompt" or
> "keyterms_prompt"»

Con la lista **no falla**: descarta el modelo incompatible y corre con
`universal-2`. Es decir, **el parámetro puesto para mejorar la precisión estaba
degradando el motor al modelo viejo en cada consulta**, sin error, sin aviso y sin
forma de notarlo.

Y explicaba el 0,00 pp: la condición «sin sesgo» corría en el modelo nuevo y las
de «con sesgo» en el viejo. No se comparaban sesgos: se comparaban modelos.

**Y dos límites más, descubiertos a base de que el proveedor los rechazara** —
`keyterms_prompt` no admite «1 000 términos» sino **2 672 tokens**; el escalón
intermedio («no more than 1000 words») tampoco era el real. Presupuestar mal aquí
no recorta: **tumba la petición entera** y deja al médico sin dictado.

**Reparación** — Un solo modelo explícito (sin lista no hay resolución
silenciosa), el sesgo por `keyterms_prompt`, y presupuesto en **caracteres** —lo
único contable de este lado— derivado del ratio medido contra su propia respuesta
(2,35 car/token) con un 8 % de margen. El sesgo pasa de 200 a **491 términos**.

**La lección, por segunda vez en el mismo archivo** — Un test de contrato
comprueba que el código diga lo acordado, no que el proveedor lo acepte. El
comentario que ya avisaba de esto seguía ahí, y volvió a pasar.

**Golden** — `src/__tests__/sesgo-llega-al-motor-bueno.test.ts` (10 casos).

## REG-168 · El foso, por fin medido

**Qué era** — El sesgo del motor de voz con el expediente del paciente se
declaraba como el foso del producto desde hacía versiones, y **nadie sabía cuánto
aportaba**. El 71,48 % publicado en `WER-MEDIDO.md` se midió sin sesgo, porque
aquel corpus no trae paciente.

**Medición** (5-ago-2026, 150 frases, `universal-3-5-pro`, semilla fija):

| Condición | Término clínico | WER |
|---|---:|---:|
| Sin sesgo | 78,89 % | 26,26 % |
| Catálogo genérico | 80,90 % | 23,20 % |
| **+ expediente del paciente** | **82,91 %** | **22,07 %** |
| + tope ampliado (491) | 83,42 % | 22,35 % |

**El reparto importa más que el total**: 2,01 pp los da el catálogo genérico —eso
lo hace cualquiera— y **otros 2,01 pp el expediente del paciente**, que exige
tener la historia clínica y el motor en la misma mano. Ésa es la mitad que no se
compra.

Términos que **sólo** rescata el expediente: `erisipela`, `pielonefritis
enfisematosa`, `HFNC`, `PCWP`, `NEWS2`.

**Sobre el tope ampliado** — +0,50 pp de acierto clínico y −0,28 pp de WER. Se
despliega con el tope grande porque el acierto clínico manda sobre el WER: una
dosis bien oída vale más que tres artículos. Es ajuste fino, no la palanca.

**Y esta medición encontró REG-167** — la primera corrida dio 0,00 pp porque el
sesgo degradaba el motor al modelo viejo. El defecto vale más que el número.

**Golden** — `src/__tests__/sesgo-medido.test.ts` (10 casos): vigila que el
documento y los datos crudos digan lo mismo y que los límites no se caigan.

## REG-169 · El 80,6 % de las correcciones del médico se tiraba sin mirarlas

**Dónde** — `src/lib/asr/aprendizaje.ts` (`paresDeUnaNota`).

**Qué pasaba** — Sólo se aprendía cuando lo oído y lo corregido tenían **el mismo
número de palabras**. Medido sobre el corpus:

| | |
|---|---:|
| Mismo largo | 363 (19,4 %) |
| **Largo distinto** | **1 512 (80,6 %)** ← descartadas enteras |

Bastaba que el médico añadiera un artículo para que toda la nota dejara de
enseñar. Y de ahí se alimenta el sesgo de vocabulario — lo único que cambia lo
que el motor OYE (REG-168: aporta 2,01 pp que no se compran).

**Por qué estaba así** — El motivo original era correcto: comparando por
POSICIÓN, una palabra añadida desplaza todas las siguientes y cada «par» sería
una coincidencia.

**Reparación** — `src/lib/asr/alineacion.ts` (módulo puro): subsecuencia común
más larga. Se sabe qué palabras se conservaron y, entre ellas, cuál ocupó el
lugar de cuál. El criterio **no se afloja** — se aplica donde antes ni se miraba:

- Sustitución **una por una** → se aprende.
- Borrado o adición pura → no enseña nada, se ignora.
- Varias palabras cambiadas seguidas → no se puede saber cuál es cuál, se descarta.
- **Una corregida más algo añadido** (el caso real: «meropenen» → «meropenem
  intravenoso») → se empareja por **similitud ortográfica**, con distancia de
  edición acotada y exigiendo que haya **una sola** candidata parecida. Es
  evidencia comprobable, no una suposición sobre el orden.

**Lo que NO se puede prometer** — Sobre el corpus esto da apenas un 6 % más de
pares, y los que aparecen son ruido de las filas corruptas («gramosuiada →
guiada»). **Ese corpus no es el instrumento**: compara forma hablada contra
escrita, no correcciones de un médico. La ganancia real exige notas dictadas
frente a notas firmadas, y eso sigue sin medir. Lo comprobable es que antes se
descartaba el 80,6 % de las oportunidades sin mirarlas.

**Golden** — `src/__tests__/aprender-aunque-cambie-el-largo.test.ts` (11 casos),
incluidos los que **no** deben aprenderse.

## REG-170 · El bucle de corrección nunca había aprendido nada

**Dónde** — `src/app/(dashboard)/consulta/[patientId]/page.tsx`.

**Qué pasaba** — LEARN compara `transcripcionMotor` (lo que oyó el reconocedor)
con `transcripcionCruda` (lo que el médico dejó): la diferencia **es** la
corrección. Y lee **sólo notas firmadas**.

Comprobado en el consultorio del Dr., leyendo su propio Firestore: de sus **10
notas firmadas, las 10 tienen `transcripcionCruda` y NINGUNA tiene
`transcripcionMotor`**. Sin esa mitad no hay par — así que el bucle, con su
módulo puro, sus filtros y sus pruebas, **no había producido jamás una sola
palabra aprendida**.

Es el patrón «escrito y sin conectar», pero de la peor especie: todo estaba
conectado salvo el dato.

**Causa** — El campo sí se guarda mientras se dicta (un borrador de la víspera lo
tenía). Lo que no había era forma de recuperarlo: al cargar una nota se
restauraba la transcripción editable y **ésta no**. En cuanto el médico volvía en
otra sesión —que es justo cuando se firma— el estado del grabador estaba vacío y
la nota se reescribía sin ella.

**Reparación** — `transcripcionMotorGuardadaRef` conserva lo que la nota ya traía
y se rehidrata al cargarla; `construirNota` usa el del grabador si hay dictado
nuevo y ese respaldo si no. El campo sobrevive a la recarga, a la firma y a
cualquier reescritura.

**Lo que esto NO arregla** — Las 10 notas ya firmadas siguen sin el campo: son
inmutables por NOM-024 y no se tocan. El bucle empieza a acumular **desde la
próxima consulta**.

**Golden** — Se endureció `src/__tests__/origen-del-dictado.test.ts`, que fijaba
la versión sin respaldo.

## REG-171 · Un paciente alérgico a TMP/SMX quedaba alérgico a «SMX)»

**Dónde** — `src/lib/seguridad/alergias.ts`, `SEPARADORES`.

**Cómo apareció** — Auditando los pacientes REALES del Dr. con la comprobación de
invariantes que introdujo v1054. Salió un alérgeno llamado **«SMX)»**:

```
«Trimetoprima/sulfametoxazol (TMP/SMX)»
  → ['Trimetoprima', 'sulfametoxazol (TMP', 'SMX)']
```

La barra estaba entre los separadores. Y los antimicrobianos combinados —los que
un infectólogo prescribe todos los días— se escriben con barra: TMP/SMX,
piperacilina/tazobactam, amoxicilina/clavulanato.

**Por qué es grave** — De este parser leen la compuerta de la receta, la nota, el
recurso FHIR y el sesgo del reconocedor. Un alérgeno partido en «SMX)» no
coincide con ningún fármaco, así que **el cruce alergia↔fármaco puede no
dispararse** justo con el antibiótico al que el paciente sí es alérgico.

**Reparación** — La barra separa sólo con **espacio a algún lado**: «penicilina /
sulfas» es una lista, «TMP/SMX» es un nombre. Es la misma solución que ya se
aplicó al punto (exigir el espacio para no partir lo que va junto).

**Nota de método** — La primera medición de este mismo campo dio un falso
positivo distinto («8 negaciones tratadas como alérgeno») porque se usó un regex
de prueba **más pobre que el del producto**. Con el regex real, 14 de 23
negaciones se reconocían bien y el defecto verdadero era otro. Medir con un
instrumento que no es el del producto da un número que no significa nada.

**Golden** — `src/__tests__/alergia-combinada-no-se-parte.test.ts` (11 casos),
incluido que las listas de verdad siguen separándose y que la alergia posterior a
una negación no desaparece.

## REG-172 · «No especificada» se guardaba como si fuera una vía

**Dónde** — `via-parenteral.ts` y `via-asumida.ts`.

**Cómo apareció** — Auditando los 28 medicamentos de las notas FIRMADAS del Dr.
Aparecieron vías que no existen en el tipo:

| Vía guardada | Veces | |
|---|---:|---|
| `oral` | 23 | ✓ |
| **`no especificada`** | **4** | no está en el enum |
| **`subcutanea`** | **1** | el enum dice `sc` |

Lo que devuelve la IA se guardaba sin validar contra
`'oral' \| 'iv' \| 'im' \| 'sc' \| …`.

**Los dos cuidados que eso apagaba, justo cuando más falta hacen:**

1. **El guard de parenterales puros** — existe para que jamás se imprima
   «insulina · oral», una vía que para ese fármaco no existe. Comprobado:
   `insulina + 'oral' → sc` ✅, `insulina + '' → sc` ✅,
   **`insulina + 'no especificada' → «no especificada»` ❌**.
2. **El aviso de vía no dictada** (REG-165, decisión del médico dueño) — miraba
   `oral` o vacío, así que con «no especificada» **no saltaba**, siendo el caso
   exacto que tenía que cazar.

**Reparación** — `src/lib/expediente/via-normalizada.ts` (módulo puro): traduce lo
traducible («subcutanea» → `sc`) y trata los huecos como **ausencia**. Una vía que
nadie decidió no es un dato. Lo desconocido se devuelve tal cual, sin inventar
ninguna vía.

**Golden** — `src/__tests__/via-no-especificada-es-un-hueco.test.ts` (13 casos),
incluido que una vía decidida por el médico no se pisa.

## REG-173 · El aviso de dosis llegaba después de firmar

**Dónde** — `src/app/(dashboard)/consulta/[patientId]/page.tsx`.

**Qué pasaba** — `revisarUnidadDosis` existe y funciona bien: con la dosis vacía
devuelve severidad **alta** («la receta no lleva cantidad; quien la surta no puede
saber cuánto dispensar») y con la cifra sin unidad avisa de que «100» se leerá
como 100 mg.

Pero sólo se ejecutaba en la pantalla de la **receta** y en hospitalización. En la
**consulta no** — y la consulta es donde se firma.

Auditando las notas firmadas del Dr. aparecieron **4 medicamentos sin dosis de
28**. El aviso llegaba cuando la nota ya era inmutable y sólo podía corregirse con
una adenda.

**Reparación** — El mismo aviso, en la consulta, antes de firmar. En rojo (el
motor lo marca de severidad alta), descartable con «Ya lo revisé», y **sin
bloquear**: qué es exigible en una receta es decisión del médico dueño y está en
su cola. Avisar no necesita su permiso; bloquear sí.

**Nota** — No había defecto en el motor: el aviso era correcto y el médico firmó
con él delante en la pantalla que lo mostraba. El defecto era **de flujo**: llegaba
tarde.

**Golden** — `src/__tests__/dosis-avisa-antes-de-firmar.test.ts` (9 casos).

## REG-174 · Sin dosis no se firma — decisión del médico dueño

**Decisión textual (5-ago-2026):** «que bloquee la firma si falta la dosis».

La tomó él con el dato delante: en sus notas ya firmadas había **4 medicamentos
sin dosis de 28**. Hasta v1057 sólo se avisaba — y el aviso ni siquiera llegaba a
tiempo (REG-173: vivía en la pantalla de la receta, después de firmar).

**Qué bloquea** — Sólo la ausencia de cifra (`dosis_sin_cifra`). Un medicamento
sin cantidad no se puede surtir: quien lo despacha no sabe cuánto dar. Y una vez
firmada, la nota sólo se corrige con adenda.

**Qué NO bloquea, a propósito** — La cifra **sin unidad** («Levotiroxina 100», que
son 100 mcg en la vida real y 100 mg en el papel) sigue avisando en rojo sin
bloquear. Él pidió bloquear cuando falta la dosis; ampliarlo a la unidad sería
decidir por él una segunda vez. **Queda pendiente de su decisión.**

**Detalle de diseño** — «Ya lo revisé» desaparece sobre lo que bloquea: ofrecerlo
sería una promesa falsa — el aviso se iría y la firma seguiría sin dejarse pulsar,
sin que el médico supiera por qué. Y el título del aviso lo dice: «no se puede
firmar hasta corregirlo».

**Golden** — `src/__tests__/dosis-avisa-antes-de-firmar.test.ts` (11 casos).

## REG-175 · Sin unidad tampoco se firma — ampliación del médico dueño

**Decisión textual (5-ago-2026):** «bloquea también si falta la unidad».

Amplía REG-174, que sólo paraba cuando faltaba la cantidad.

**Por qué este caso es, si acaso, peor** — Una receta **sin cantidad** no se
despacha: quien la surte pregunta. Una con la cifra **sin unidad sí se despacha**,
con la unidad que suponga quien la lea. «Levotiroxina 100» son 100 mcg en la vida
real y 100 mg en el papel: **mil veces la dosis**, y en el papel no queda rastro
de cuál se quiso decir.

**Reparación** — La compuerta de `firmar()` para los dos códigos
(`dosis_sin_cifra` y `dosis_sin_unidad`), y el aviso muestra el mensaje del motor,
que explica el riesgo concreto de cada caso en vez de uno genérico.

**Se retiró «Ya lo revisé» de este aviso** — Desde que los dos casos bloquean, no
hay nada que descartar: hay una cantidad y una unidad que escribir. Un botón que
sólo esconde el mensaje sería una promesa falsa: se iría el aviso y la firma
seguiría sin dejarse pulsar. La petición del Dr («estas cosas deben poderse
quitar») sigue viva en los avisos que **no** bloquean — negación, temporalidad,
vía no dictada.

También se quitó el filtro de «revisados» de este memo: sin botón no podía
ejecutarse nunca.

**Nota de método** — La comprobación de que el botón no está buscaba la frase «Ya
lo revisé» en el archivo, y fallaba porque **el comentario que explica su ausencia
la menciona**. Un test que mira la prosa en vez del comportamiento se engaña solo.
Ahora busca el `<button>`.

**Golden** — `src/__tests__/dosis-avisa-antes-de-firmar.test.ts` (12 casos).

## REG-176 · «El paciente no sabe la dosis» — dicho, no callado

**Por qué hizo falta** — Medido el impacto de REG-174/175 con el motor real sobre
las notas del Dr.: **4 de 8 no se habrían podido firmar**. Y lo que las bloqueaba
no eran descuidos:

| Medicamento | Dosis registrada |
|---|---|
| Pregabalina | «No especificada» |
| **Antibiótico no especificado** | «No especificada» |
| **Antihipertensivo no especificado** | «No especificada» |
| Telmisartán | *(vacío)* |

Medicación previa que el paciente refiere y cuya dosis no conoce. «Toma algo para
la presión» es un hecho clínico legítimo. Con la compuerta cerrada habría que
**inventarse una dosis que el paciente no dijo** — peor que el problema evitado.

**Decisión del médico dueño (5-ago-2026)** — Se le plantearon tres caminos
(separar prescrito/referido · permitir la declaración · dejarlo) y eligió el
segundo: **«haz la B»**.

**Reparación** — `src/lib/seguridad/dosis-desconocida.ts` (módulo puro) y un botón
«No la sabe» junto al campo, que sólo aparece si el renglón tiene nombre y le
falta la dosis. Lo declarado no bloquea ni figura como aviso pendiente.

**Lo que impide que sea un parche** — La declaración es un **acto del médico**: se
compara literal contra una frase canónica que sólo pone el botón. **«No
especificada» —lo que escribe la IA cuando no captó la dosis— sigue bloqueando.**
Aceptarla habría desactivado la compuerta de vuelta.

**Se imprime** — El texto va al campo `dosis`, así que sale en la receta y en la
nota: quien lea el documento ve que la dosis se desconoce, en vez de un renglón en
blanco que parecería un olvido.

**Golden** — `src/__tests__/dosis-desconocida-declarada.test.ts` (12 casos).

---

## REG-177 — «No especificada» entraba como dato (v1061)

**Encontrado** — 5-ago-2026, tirando del hilo de REG-172, REG-173 y REG-176: los
tres eran **el mismo defecto** visto desde tres sitios distintos.

**El defecto** — Cuando el modelo no captura un campo no lo deja vacío: escribe
«No especificada». Ese texto se guardaba tal cual, y **todo lo que compara contra
la cadena vacía deja de verlo**:

| Dónde | Qué apagó |
|---|---|
| `via` | El guard que impide imprimir «insulina · oral» (REG-172) |
| `via` | El aviso de vía no dictada — justo el caso que existía para cazar |
| `dosis` | 3 de 28 medicamentos **parecían tener dosis**; al cerrar la compuerta de firma bloquearon la mitad de sus notas (REG-176) |

Un campo relleno con la confesión de estar vacío se comporta como un dato. Es
peor que un hueco: parece contestado.

**Reparación, en dos capas porque una sola no basta**

1. **Prompt** — `src/lib/expediente/prompts.ts`: regla 1-bis «vacío significa
   vacío», con el porqué y con los daños concretos; y la plantilla deja de traer
   `"via": "oral"` de ejemplo, que era lo que invitaba a rellenarla siempre.
2. **Esquema** — `src/lib/expediente/extraction-schema.ts`: el saneo se hace en la
   frontera por la que entra **toda** extracción. Al prompt se le puede pedir que
   obedezca, y se le pidió; pero **un prompt es persuasión y el esquema es
   garantía**. Da igual qué redacción elija el modelo mañana.

`src/lib/expediente/hueco-textual.ts` es la única lista de «formas de decir no lo
sé». `via-normalizada.ts` tenía la suya duplicada: dos listas que deben decir lo
mismo acaban diciendo cosas distintas, y la que se olvide de actualizar es la que
deja pasar el hueco.

**Lo que NO se toca** — La frase canónica del botón «No la sabe» (REG-176) es una
declaración del médico, no un hueco del modelo: sobrevive intacta. «Desconocida»
a secas sigue siendo un hueco. La comparación es de igualdad exacta, así que «1
tableta, no especificada la marca» conserva el «1 tableta».

**`dosis` sólo se vacía**, nunca se normaliza ni se completa: inventar una dosis
es exactamente lo que no puede pasar en esta frontera.

**Golden** — `src/__tests__/hueco-escrito-no-es-dato.test.ts` (25 casos). Van
sobre el **esquema**, no sobre el helper: el defecto no era que faltara un
limpiador, era que nadie lo llamaba donde pasa todo. Comprobado que la prueba
puede ponerse roja — sin el saneo, 9 de los 25 fallan.

---

## REG-178 — el aviso de operación cortaba la consulta (v1062)

**Encontrado** — 5-ago-2026, en la captura de una consulta real del Dr.: debajo
de su nota, en rojo y a lo ancho, «5 trabajo(s) automático(s) dejaron de correr».
Era el **octavo bloque de aviso** de esa pantalla.

**El defecto** — Todo cierto y todo suyo (es el dueño de la plataforma), pero
ninguno de esos trabajos —`reminders`, `limpiar-audio`, `retencion`, `asientos`—
se arregla desde la consulta ni afecta al paciente que tenía delante.

**Por qué volvió a pasar** — Esta franja **ya había aprendido la lección el
4-ago**, cuando enseñaba tres líneas de «Claude tardó demasiado» encima de su
lista de pacientes. El filtro que se escribió entonces pregunta **«¿es
urgente?»**, y un trabajo automático muerto lo es. Por eso se coló.

La pregunta correcta, con alguien delante, es otra: **«¿se arregla desde aquí, y
le afecta a él?»** Un cron mudo puntúa alto en la primera y cero en la segunda.

**Reparación** — `src/lib/ops/interrumpe-la-consulta.ts` (módulo puro). En las
cuatro pantallas donde hay un paciente esperando —consulta, expediente,
hospitalización, UCI— sólo entra lo que **impide atenderlo ahora**: la IA caída,
la llave rechazada, la cuenta sin saldo. Lo demás no desaparece: espera a que
salga de la consulta, que es cuando puede hacer algo.

**El silencio es el valor seguro** — Un incidente que no declara si interrumpe se
calla en consulta. La asimetría manda: un aviso de más con alguien delante cuesta
la atención del médico; el mismo aviso cinco minutos después, en la agenda, no
cuesta nada.

**Golden** — `src/__tests__/con-paciente-enfrente-no-se-interrumpe.test.ts` (20
casos), incluidos tres que comprueban que está **conectado** y no sólo escrito —
la lección de `scripts/verificar-invariantes-de-datos.md`.

**Es el paso 1 de** `docs/maintenance/PLAN-2026-08-05-la-nota-manda.md`, el plan
para que los ocho bloques de aviso apilados sobre la nota sean una sola barra.

---

## REG-179 / REG-180 — el recuadro naranja no era culpa del modelo (v1063)

**Encontrado** — 5-ago-2026, tirando del hilo de su captura: sobre la nota de una
consulta real, un recuadro naranja con **nueve viñetas** de «datos críticos no
documentados». Su petición fue exacta: «todo esto quiero que tú lo razones y lo
traslades a la nota… esto nomás ocupa lugar».

### REG-180 — dos reglas del mismo prompt se contradecían

| Regla | Qué ordena |
|---|---|
| **G** (`prompts.ts:51`) | NUNCA escribas en la prosa comentarios sobre el audio |
| **22** (`prompts.ts:132`) | Escribe «no inteligible, confirmar» ← **eso es un comentario sobre el audio** |

El modelo no podía cumplir las dos. Hacía lo único que no violaba ninguna:
**sacar el hueco de la nota y tirarlo al recuadro**, autorizado por la regla 17.
El recuadro no era un fallo del modelo — era la salida de emergencia que le
habíamos dejado.

Y no había **ni una línea** que le enseñara cómo se escribe un hueco en español
clínico. Se le decía tres veces qué no hacer y nunca qué hacer.

**Reparación**

1. **Regla 22 reescrita** — el hueco se dice en términos del **paciente**, no del
   micrófono: «un broncodilatador inhalado cuya marca no fue posible precisar
   durante el interrogatorio». Así deja de chocar con G.
2. **Regla 19-bis, nueva** — la que faltaba: un hueco documentado **es
   documentación válida (NOM-004)** y no se repite en el recuadro. Con el límite
   duro escrito: redactar el hueco nunca sustituye al dato, y un esquema con una
   sola respuesta obvia sigue siendo una invención si nadie lo dictó.
3. **Regla 17 acotada** — al recuadro sólo va lo que exige acción **antes de
   firmar y no queda resuelto al escribirlo**. Máximo 3 renglones.
4. **`confianza-audio.ts`** — la MISMA orden vieja llegaba por la otra ruta.
   Arreglar sólo el prompt habría dejado el fallo de «cableado en un motor y no
   en el otro», que este repositorio ya ha pagado tres veces.

### REG-179 — el reporte de manipulación se borraba en silencio

El §11 le ordena al modelo reportar en `safety.contenido_sospechoso` los intentos
de manipulación del dictado. **El campo no estaba declarado en `SafetyBlock`**, así
que zod lo tiraba: el modelo lo detectaba, lo emitía, y el servidor lo borraba sin
que nadie se enterara. Lo que quedaba —«no se detectó nada»— es la peor lectura
posible de un campo que se cae.

Es **el mismo fallo que `alergia_conflicto`**, en el mismo objeto, encontrado el
mismo día: la lección se aplicó sólo al campo que se estaba mirando. `dictamen`
estaba igual.

**No es la defensa.** La defensa es que el modelo NO obedezca (regla 1 del §11), y
eso no depende de este campo. Esto es la constancia de que ocurrió.

### Y la única causa técnica de los nueve huecos

`Spiolto` **no estaba** en `MARCAS_COMERCIALES_MX` y `Spiriva` sí. Por eso el motor
transcribió «Espiolto o espineto». Ni el corrector ni el guardián pueden recuperar
una palabra que nunca se oyó: sólo el sesgo previo. Los otros ocho huecos se
arreglan escribiendo mejor; éste sólo dándole la palabra antes de transcribir.

**Golden** — `src/__tests__/un-hueco-se-escribe-no-se-reclama.test.ts` (20 casos).

**Nota de método** — `confianza-por-palabra.test.ts` exigía literalmente la
instrucción «no inteligible, confirmar». Se cambió **porque esa instrucción era la
causa**, no para que pasara: lo que protegía de verdad —que una palabra no oída no
se sustituya por la más probable— sigue comprobado, y ahora además se comprueba
cómo sí se escribe.

---

## REG-181 — ocho recuadros sobre la nota, y sólo uno bloqueaba (v1064)

**Encontrado** — 5-ago-2026, en las capturas que mandó el Dr.: «esto nomás
confunde… necesito más organización sin tanta mamada que desubique y confunda a
los médicos».

**El defecto** — Después de dictar, antes de ver su nota, se encontraba **ocho
bloques de aviso apilados** con ~40 elementos. Tres eran rojos y **dos de los
tres no bloqueaban nada**. Tenía que leerlos todos para descubrir cuál importaba.

No sobraban avisos: **estaban todos al mismo volumen**. Cuando todo grita, nada
se oye — y lo que se acaba ignorando es el que sí importaba.

**Reparación** — Una barra de tres niveles:

| Nivel | La pregunta que responde | Nace |
|---|---|---|
| BLOQUEA | ¿es por lo que el botón Firmar no responde? | abierto, y no se pliega |
| REVISA | ¿pide una decisión, aunque no lo impida? | los fijos siempre a la vista; el resto plegado si son >3 |
| YA EN LA NOTA | ¿es contenido que ya está escrito? | plegado siempre |

`src/lib/expediente/avisos-consulta.ts` (módulo puro) + `AntesDeFirmar.tsx`.

**`bloquea` NO es «es grave»** — El cruce alergia ↔ medicamento es lo más grave
de esta pantalla y no bloquea: esa decisión es del médico dueño. Lo que se hace
con lo grave que no bloquea es **no plegarlo nunca** (`NO_SE_PLIEGAN`).

**Ningún aviso desapareció** — Se recolocan y se pliegan. Lo que bloquea queda
MÁS visible que antes, no menos, y la barra entera no se puede cerrar.

**La deduplicación era media reparación** — De las nueve viñetas de «datos
críticos no documentados», **cuatro eran ecos** de la compuerta de dosis. Nadie
las cruzaba.

**El precio, dicho en voz alta** — Plegar es esconder: la vía asumida y el
desajuste temporal se van a leer menos que antes. Es el precio consciente de que
el rojo vuelva a significar algo.

**Y la regla que impide que vuelva a crecer** — Tres niveles, punto. Un motor
nuevo declara su origen en `NIVEL` y entra en una lista que ya existe. No se
añaden recuadros.

**Golden** — `src/__tests__/una-barra-y-no-ocho-recuadros.test.ts` (25 casos),
incluida una prueba que recorre los nueve orígenes y falla si alguno pierde su
nivel — el riesgo que este rediseño introduce.

**Nota de método** — Ocho pruebas existentes comprobaban el `tone="…"` y los
títulos de los recuadros viejos dentro del JSX. Se reapuntaron al módulo puro:
lo que protegían no cambió, y ahora se vigila en una tabla de nueve líneas en vez
de en un JSX de 5000.

---

## REG-182 — dos listas que se pagaban en cada nota y no leía nadie (v1065)

**Encontrado** — 5-ago-2026, tirando del hilo de REG-179.

**El defecto** — El prompt pedía en cada extracción `fields_auto_filled` y
`fields_requiring_review`. Estaban declaradas en el esquema y en la interfaz de
`RevisionPanel`, y **ningún componente las pintaba ni ninguna lógica las
consultaba**. Se pagaban tokens por producirlas en cada nota y se descartaban.

**Pero el gasto era lo de menos** — `needs_review` **ya viaja por campo**, dentro
de cada `CampoAuditado`. Pedir además una lista de nombres es pedirle al modelo
que repita en otro formato lo que ya dijo, y **dos fuentes de verdad para el
mismo hecho se desincronizan**: el día que la lista dijera «alergias necesita
revisión» y el campo `alergias` dijera `needs_review: false`, ninguna de las dos
sería fiable y nadie sabría cuál creer.

Es el patrón de REG-179 en el mismo objeto, visto del otro lado: allí el prompt
prometía un campo que el esquema no declaraba; aquí pedía uno que nadie usaba.

**Reparación** — Se dejan de pedir. En su hueco del prompt entran los dos que sí
se leen ahora (`contenido_sospechoso` y `dictamen`, REG-179). El esquema los
sigue aceptando: las notas ya guardadas los traen y dejar de pedir un campo no
puede invalidar lo que está en el expediente.

Lo que hacía falta se **deriva** con `camposQueRequierenRevision(extraction)`, que
lee el `needs_review` de cada campo — donde el dato vive de verdad, así que no se
puede desincronizar.

**Golden** — `src/__tests__/lo-que-se-paga-y-no-se-lee.test.ts` (9 casos).

---

## REG-183 — el eje que faltaba: ¿ya lo toma, o se lo receto hoy? (v1066)

**Encontrado** — 5-ago-2026, como el hueco estructural detrás de REG-176.

**El defecto** — `Medicamento` no tenía forma de distinguir dos cosas que no se
parecen, y la compuerta de dosis las trataba igual:

| | Qué es | Qué significa no saber la dosis |
|---|---|---|
| «Toma algo para la presión, no sé cuál» | historia farmacológica | **un hallazgo clínico** |
| «Le doy levotiroxina» sin cantidad | prescripción de hoy | **un error que sale impreso en la receta** |

Al medirlo sobre sus notas reales, **4 de 8 no se habrían podido firmar**, y lo
que las bloqueaba era medicación previa. Sin este campo, ni el modelo ni la
compuerta pueden distinguirlas: sólo ven un renglón sin dosis.

**Reparación** — `procedenciaClinica?: 'ya_lo_toma' | 'se_prescribe_hoy'` en el
tipo, en el esquema y en el prompt (regla 6-ter). El aviso ahora **dice de cuál
de los dos se trata**.

**Sin valor por omisión, a propósito** — Darle uno sería el error de «No
especificada» otra vez: rellenar un hueco con algo que parece un dato. Las notas
anteriores no lo traen y no se puede adivinar cuál era cuál. Y al modelo se le
ordena **omitirlo** si no lo sabe, en vez de adivinar.

**LO QUE NO CAMBIA, Y ES DELIBERADO** — **No cambia qué bloquea la firma.** Eso
lo decidió el médico dueño el 5-ago con el dato delante (REG-174/175/176), y
volver a decidirlo por mi cuenta sería pasar por encima de su decisión. Lo que se
añade es información.

**Queda anotado para él** — Ahora que el eje existe, se puede plantear si la
compuerta debe bloquear sólo lo que se prescribe hoy. Es su decisión, no mía.

**Golden** — `src/__tests__/ya-lo-toma-o-se-lo-receto-hoy.test.ts` (15 casos).

---

## REG-184 — el recuadro repetía lo que NOM-004 ya bloqueaba (v1067)

**Encontrado** — 5-ago-2026, cerrando los ecos que quedaban del recuadro naranja.

**El defecto, en dos partes**

**1. Doble reporte.** «Exploración física no realizada» salía en el recuadro *y*
la sección obligatoria vacía ya impide firmar por `validarNOM004`, con su propio
mensaje y su propio sitio. El recuadro sólo repetía, sin añadir una acción — y un
aviso que no añade nada gasta la atención que necesitan los que sí.

**2. El prompt se contradecía consigo mismo, otra vez.** Al acotar la regla 17
(v1063) quedaron dos líneas vivas que decían lo contrario:

| Línea | Qué decía |
|---|---|
| 66 | «si falta un dato clave para el razonamiento, señálalo en `missing_critical_fields`» |
| 243 | «`missing_critical_fields`: alergias/medicamentos/exploración no preguntados» |

Es el mismo patrón de REG-180: una regla se acota y las otras menciones se
quedan atrás, así que el modelo sigue recibiendo la orden vieja por otro sitio.
**Corregir una regla obliga a buscar todas sus menciones.**

**Reparación** — `yaLoBloqueaNOM004` en `construirAvisos`: los faltantes se
cruzan contra dos cosas, los fármacos que ya bloquean arriba y lo que NOM-004
bloquea por su cuenta. Y las líneas 66 y 243 alineadas con la 17 y la 19-bis.

**Golden** — dos casos nuevos en
`src/__tests__/una-barra-y-no-ocho-recuadros.test.ts` (27 en total).

---

## REG-185 — un guardián para que el prompt no vuelva a contradecirse (v1068)

**Por qué existe** — El mismo fallo apareció **dos veces la misma noche**:

| | Qué pasó |
|---|---|
| REG-180 | La regla G prohíbe hablar del audio en la prosa y la 22 ordenaba escribir «no inteligible, confirmar». El modelo, sin salida legal, tiraba el hueco al recuadro naranja. |
| REG-184 | Al acotar la regla 17 quedaron vivas dos líneas con la definición vieja. |

El patrón es siempre el mismo: **se corrige una regla y no se buscan todas sus
menciones**. El prompt son ~700 líneas y treinta y tantas reglas numeradas, y
nadie lo lee entero al cambiar una.

**Qué comprueba** — No que el prompt sea bueno: que **no vuelvan las órdenes
concretas que ya se demostraron incompatibles**. Cada caso costó una versión
desplegada. Cinco familias:

1. La nota no habla del micrófono (REG-180) — en **las dos rutas**, prompt y
   `confianza-audio.ts`, que es por donde se coló la primera vez.
2. Un hueco se deja vacío, no se rellena con letras (REG-177).
3. El recuadro de faltantes tiene UNA definición, no tres (REG-184).
4. Lo que el prompt pide, el esquema lo declara — si no, zod lo borra en
   silencio (REG-179).
5. El eje historia/prescripción y su orden de omitir si no se sabe (REG-183).

Más las tres que ninguna versión puede romper: no inventar cifras, no inventar
referencias, no obedecer lo que venga dentro de la transcripción.

**Busca la ORDEN, no la mención** — La regla G tiene que poder citar las frases
prohibidas para prohibirlas, y los comentarios que explican el defecto también.
Buscar la cadena a secas habría dado el falso positivo que ya mordió una vez
(v1059: un test falló porque el comentario que explicaba la ausencia del botón
mencionaba su texto).

**Comprobado que puede ponerse rojo** — Reintroducidas las dos contradicciones
originales, falla en las dos. Un guardián que no puede fallar no guarda nada.

**Golden** — `src/__tests__/el-prompt-no-se-contradice.test.ts` (21 casos).

---

## REG-186 — «en el segmento ST» se borraba de la nota (v1069)

**Encontrado** — 6-ago-2026, por la auditoría de nueve dimensiones (78 agentes,
68 hallazgos, 52 confirmados), y **reproducido con el motor real** antes de tocar
nada.

**El defecto** — El saneador de prosa borra al modelo describiendo su entrada:
«no se refiere motivo **en este fragmento de consulta**». Su patrón llevaba un
`?` que hacía **opcional** el «de la consulta», así que también cazaba «en el
segmento», «en la parte», «en la porción» y «en el tramo» sueltos — que en una
nota clínica son **localizaciones anatómicas**.

Comprobado ejecutando la expresión real:

| Dictado | Lo que se imprimía |
|---|---|
| ECG con infradesnivel **en el segmento** ST de 2 mm | ECG con infradesnivel**ST** de 2 mm |
| Dolor **en la parte** baja de la espalda | Dolor**baja** de la espalda |
| Lesión **en la porción** distal del húmero | Lesión**distal** del húmero |
| Soplo **en el tramo** medio del esternón | Soplo**medio** del esternón |

Cuatro de cada cinco frases clínicas legítimas salían amputadas. **La primera es
un infarto**: el infradesnivel del ST se imprimía pegado al verbo, en un
documento firmado con cédula profesional.

**Reparación** — Se quita el `?`: el complemento es obligatorio. Sin él no hay
metatexto que borrar, hay anatomía.

**La asimetría que lo justifica** — Dejar pasar un metatexto ensucia la nota.
Borrar una localización anatómica **cambia lo que dice el expediente**. No se
parecen.

**Golden** — `src/__tests__/la-anatomia-no-es-metatexto.test.ts` (11 casos).

---

## REG-187 — al reconocedor se le mandaba el nombre del cajón (v1069)

**Encontrado** — 6-ago-2026, misma auditoría. El hallazgo más caro de los 52.

**El defecto** — `especialidadesDelMedico()` y `CONTEXTOS_POR_MODULO` devuelven
**nombres de vocabulario**, no términos. Esos nombres llegaban tal cual a
`sesgo-diarizado`, que los mete en la lista con la que se sesga al reconocedor.

En un pase de UCI se le decía al motor **«espera oír la frase *Sepsis y
choque*»** —que nadie pronuncia— en vez de «norepinefrina, CVVHDF, RASS, FiO2».

Medido antes de tocarlo:

| Módulo | Se mandaba | Se manda ahora |
|---|---|---|
| UCI | **4** nombres de cajón | **67** términos reales |
| Microbiología y PROA | **1** nombre | **29** términos reales |

**Por qué duele más que otros fallos** — El sesgo es **lo único que cambia lo que
la máquina OYE**. Una palabra que nunca llegó al reconocedor no la recupera
ningún corrector de después. Es la lección de `Spiolto` (REG-179) multiplicada
por el vocabulario entero de una especialidad.

**Tercera vez con el mismo patrón** — «El trabajo está hecho y no llega»:
REG-167 (el sesgo degradaba el motor al modelo viejo), v1025 (el vocabulario iba
a la ruta de repuesto y no a la que corre), y ésta.

**El nombre se conserva además del contenido** — Cuesta cuatro términos y alguna
especialidad sí se dice en voz alta («lo mando a infectología»).

**Lo que NO arregla, dicho claro** — El sesgo sólo puede ofrecer lo que alguien
escribió antes. Expandir los nombres no crea vocabulario: hace que llegue el que
ya existe.

**Golden** — `src/__tests__/el-sesgo-manda-palabras-no-cajones.test.ts` (11 casos).

---

## REG-188 — los motores veían la receta de hoy, no al paciente (v1070)

**Encontrado** — 6-ago-2026, auditoría de nueve dimensiones. El hallazgo más
transformador de los 52.

**El defecto** — La consulta **ya calculaba** la medicación vigente y los
problemas activos del paciente (`medicamentosVigentes()`, `problemasActivos()`
sobre las notas firmadas) y los pintaba en pantalla. A los motores clínicos les
pasaba **sólo lo de hoy**.

**El caso que lo demuestra**: warfarina de marzo, ketorolaco hoy. La regla de
sangrado existe y está probada. **No disparaba**, porque la warfarina no estaba
en la nota de hoy. Igual el ajuste renal de la metformina crónica, o la meta de
LDL del diabético que hoy vino por faringitis.

Es el patrón «escrito y sin conectar» — el más caro de este repositorio.

**Por qué importa más de lo que parece** — En una consulta de **seguimiento**,
que son la mayoría, lo de hoy son dos renglones nuevos sobre alguien que toma
cinco cosas desde hace años. Un motor que sólo ve los dos renglones no razona
sobre un paciente: razona sobre una receta.

**Reparación** — `src/lib/expediente/cuadro-completo.ts` (módulo puro). Une las
dos listas marcando la procedencia, porque el motor la necesita para redactar:
«el ketorolaco que receta hoy con la warfarina que ya toma» dice mucho más que
«ketorolaco + warfarina», y le dice al médico dónde mirar.

**Lo de hoy manda** cuando el mismo fármaco está en las dos: si el médico está
cambiando la dosis en esta consulta, la nueva es la buena.

**No cambia ninguna compuerta** — Lo que entra son datos. Los motores que los
consumen son de nivel `revisa`, nunca `bloquea`. Habrá más avisos —es el
objetivo— pero ninguno impedirá firmar.

**Dónde NO se aplica, y por qué** — `tareasDeNota` deriva los pendientes de la
consulta que se firma, y ahí la medicación crónica no pinta nada: metería, en
cada firma, tareas sobre fármacos que el paciente lleva años tomando. El cuadro
completo es para **razonar**; el worklist es para **acordarse de lo que se
pidió**. No es la misma pregunta.

**Golden** — `src/__tests__/el-paciente-completo-llega-al-motor.test.ts` (15
casos), incluidos tres que comprueban que está conectado en **los dos** sitios.

---

## REG-189 — el botón y la barra se contradecían (v1071)

**Encontrado** — 6-ago-2026, auditoría de nueve dimensiones (hallazgos D1 y D2).

**El defecto** — La razón por la que no se podía firmar estaba repartida en **dos
sitios que no se hablaban**, y cada uno mentía a su manera:

| Situación | El botón | La barra |
|---|---|---|
| Dosis incompleta | **encendido** — fallaba al pulsarlo | «1 bloquea» ✓ |
| Sección obligatoria vacía | apagado ✓ | **«nada te impide firmar»** |

El botón se apagaba con `validacion.valida` (sólo NOM-004) y la compuerta de
dosis vivía **dentro** de `firmar()`. La barra, al revés, contaba la dosis y no
miraba NOM-004. El médico veía la contradicción completa: un botón gris junto a
un cartel diciendo que todo estaba bien, o un botón encendido que no hacía nada.

**Y el mensaje que lo explicaba ya existía, inalcanzable** — el del toast sólo
salía **al pulsar**; el de NOM-004 vive en un recuadro que queda fuera de la
pantalla cuando el médico está abajo, junto a los botones, que es donde tiene el
dedo. Un botón gris sin explicación es la peor forma de decir que no.

**Reparación** — `src/lib/expediente/por-que-no-se-firma.ts` (módulo puro). Una
sola fuente para el botón, para la barra y para el texto. El motivo viaja en el
`title` y en un renglón junto a los botones. La barra gana el origen
`requisito_nom004`, de nivel `bloquea`.

**NO CAMBIA LA POLÍTICA** — Ni una condición se añade ni se quita: lo que impedía
firmar ayer impide firmar hoy. Lo único que cambia es que **se dice en un sitio y
antes de pulsar**. Que la falta de dosis bloquee fue decisión del médico dueño el
5-ago, con el dato delante.

**La compuerta de `firmar()` se queda** — Apagar el botón es defensa en
profundidad, no sustitución: `firmar()` puede llamarse por otro camino.

**Golden** — `src/__tests__/el-boton-dice-por-que-esta-apagado.test.ts` (18
casos).

---

## REG-190 — el motor de sobredosis corría DESPUÉS de firmar (v1072)

**Encontrado** — 6-ago-2026, auditoría de nueve dimensiones (hallazgo G1).

**El defecto** — `revisarDosis()` caza sobredosis, techos por vía y edad, y el
**error de decimal** —«500 mg donde iban 50»—, que es de los errores de
prescripción que más daño hacen y que un modelo generativo pasa por alto sin
despeinarse.

Tenía **un solo llamador**: `receta/[patientId]/[notaId]/page.tsx`, la pantalla
de la receta, que se abre desde una nota **ya firmada**. El motor corría cuando
la nota estaba sellada y el paciente se había ido con la receta en la mano.

**Por qué no bastaba con llamarlo** — La lógica que arma la entrada —sacar los mg
del texto, distinguir mg de mg/kg, contar las tomas al día— vivía dentro de un
`useMemo` de esa pantalla. Traerla a la consulta no era llamar a una función: era
copiarla. Por eso se extrae a `src/lib/seguridad/dosis-de-la-lista.ts`.

**Reparación** — La consulta lo calcula sobre la lista entera, con la edad y el
peso del paciente (que es lo que activa la comprobación pediátrica por kg), y
entra en la barra como origen `dosis_peligrosa`.

**Nivel `revisa`, pero NO se pliega cuando es crítica** — Qué bloquea la firma lo
decidió el médico dueño el 5-ago con el dato delante; ampliarlo por mi cuenta
sería decidir por él. Pero «500 donde iban 50» es del mismo orden de daño que
recetar aquello a lo que el paciente es alérgico, y sale impreso igual de rápido:
entra en `NO_SE_PLIEGAN`, junto al cruce de alergias y la contradicción del
dictado.

**`sin_referencia` se descarta** — «Este fármaco no está en el catálogo» no es un
hallazgo sobre el paciente, y en una lista de ocho llenaría la pantalla de avisos
que no dicen nada. El motor ya advierte por su cuenta que la ausencia de alerta
no significa dosis segura.

**No se quita de la receta** — Esa pantalla se puede abrir sin pasar por la
consulta de hoy.

**Ningún umbral nuevo** — Todos salen del catálogo de `dosis.ts`, que ya existía
y que el médico dueño ya revisó (REG-041).

**Golden** — `src/__tests__/la-sobredosis-se-ve-antes-de-firmar.test.ts` (16
casos).

---

## REG-191 — la versión del prompt llevaba siete cambios sin moverse (v1073)

**Encontrado** — 6-ago-2026, auditoría de nueve dimensiones (hallazgo E3).

**El defecto** — `PROMPT_VERSION` se sella en cada nota (`_promptVersion`) y es
lo único que permite responder a la pregunta que importa cuando algo sale mal:
**«¿qué notas se generaron con el prompt que tenía el fallo?»**

En la noche del 5 al 6 de agosto el prompt cambió **siete veces** —regla 1-bis,
6-bis, 6-ter, 19-bis, la 22 reescrita, la 17 acotada, dos campos retirados— y la
versión siguió diciendo `nota-2026-08`. Dos notas con la misma etiqueta podían
venir de prompts distintos: el lote afectado **no se podía acotar**. Es un
requisito de IEC 62304, y era humo.

**Y el candado estaba puesto al revés** — El único test que la miraba la
**pineaba al literal** (`toContain("const PROMPT_VERSION = 'nota-2026-08'")`), así
que subirla rompía la suite. Su intención era buena —exigir que cambiara— y su
implementación impedía exactamente eso.

**Reparación** — `src/lib/expediente/prompt-version.ts`: la versión, la lista de
archivos que **son** el prompt, y una huella de su contenido. La prueba compara
la huella real contra la declarada y, cuando falla, **trae la huella nueva en el
mensaje** para que subirla sea copiar y pegar. Formato nuevo
`nota-AAAA-MM-DD-N`: en una noche puede cambiar varias veces.

**Vigila las DOS rutas** — `prompts.ts` y `confianza-audio.ts`. La segunda es por
donde se coló REG-180: arreglar sólo el prompt principal dejó viva la orden vieja
por el otro lado.

**Por qué la huella es del archivo entero, comentarios incluidos** — Hashear
«sólo lo que llega al modelo» exigiría construir el prompt para cada tipo de
nota, especialidad e instrucciones; un candado que no se puede calcular con
certeza no es un candado. Y en un sistema regulado la versión identifica **el
artefacto**: dos builds con la misma versión deberían ser el mismo archivo. El
coste de versionar de más es una línea; el de versionar de menos es no poder
acotar un lote de notas clínicas.

**La ruta la importa, no la redeclara** — Redeclararla era cómo se
desincronizaba.

**Comprobado que puede ponerse rojo** — Tocado `confianza-audio.ts`, falla.

**Golden** — `src/__tests__/la-version-del-prompt-no-miente.test.ts` (6 casos).

---

## REG-201 — el punto de orden tenía su propio parser de alergias (v1082)

**Encontrado** — 6-ago-2026, verificando `SAFE-001` antes de darlo por cerrado.

REG-171 unificó tres caminos —consulta, UCI y extractor de entidades— sobre
`alergiasDe`. El backlog hablaba de «cuatro parsers»; recorriendo otra vez quién
parte el campo apareció un quinto: `src/lib/hospital/cds.ts`, el **punto de
orden** de hospitalización. Es el único sitio donde la alerta de alergia llega
**antes** de que la indicación se firme, y era el que no estaba en la cuenta.

**Cómo se reprodujo** — Con el motor real, sin mocks:

```
cdsMedicamento({ nombre: 'Sulfametoxazol/trimetoprima',
                 alergias: 'Niega penicilina y alérgica a sulfas' })
  → [{ nivel: 'info', texto: 'Fármaco de eliminación renal…' }]   ← cero críticas
alergenosDe({ alergias: 'Niega penicilina y alérgica a sulfas' })
  → ['alérgica a sulfas']                                          ← el canónico sí
```

**El defecto** — Tenía `split(/[,;.\n]/)` y su propia lista de negadores. Ni la
«y» ni la barra separaban, así que «Niega penicilina y alérgica a sulfas» era
**un solo fragmento**: el negador de delante lo tumbaba entero y la alergia a
sulfas **desaparecía**. Es el mismo modo de fallo que el punto ya había enseñado
en REG-171, un conector más tarde.

Y `alergiasEstructuradas` no se miraba **por ninguno de los dos lados**: ni la
firma de `CdsInput` la aceptaba, ni el llamador la pasaba (`patient?.alergias` a
secas). El paciente mejor documentado era el que corría sin compuerta.

**Por qué importa para un paciente** — Descartar primero lo frecuente y apuntar
después lo que sí hay es la forma **normal** de escribir el campo. Con el parser
viejo, ese orden bastaba para que la alergia posterior no existiera para el
motor: se ordenaba el fármaco al que el paciente es alérgico sin un solo aviso,
en el único momento en que el aviso todavía sirve.

**Segundo hallazgo, en las mismas ocho líneas** — El bucle marcaba como
`critica` **toda** alerta del cruce, incluida la que el motor había bajado a
`advertencia` a propósito: con alergia a penicilina aislada, el carbapenémico no
se bloquea (decisión del médico dueño, E0-15d — reactividad cruzada <1%, y una
alerta roja ahí frena la primera línea justo en sepsis y meningitis). La franja
salía **roja sobre un texto que dice «NO es contraindicación»**: la pantalla
deshacía la decisión y devolvía la fatiga de alerta que la decisión existía para
evitar. Misma familia que REG-189.

**Reparación** — `cdsMedicamento` usa `alergiasDe`, acepta
`alergiasEstructuradas` y la pantalla de hospitalización pasa **los dos** campos.
Las alergias viajan completas, con su reacción: el cruce betalactámico↔
carbapenémico la necesita para distinguir reacción cutánea grave. Y la severidad
del motor se respeta en vez de aplanarse.

**Ningún umbral nuevo** — No se toca el cruce ni su vocabulario; sólo quién le
entrega la lista y cómo se pinta lo que devuelve. La decisión E0-15d no se
cambia: se restituye.

**Qué NO hace** — No mejora el cruce en sí: `validarAlergiasVsMedicamentos`
sigue comparando por subcadena contra su vocabulario de familias, y un alérgeno
fuera de ese vocabulario **sigue sin vigilarse** — eso es vocabulario, no
criterio. Tampoco existe hoy ninguna ruta de escritura que llene
`alergiasEstructuradas`: lo que se cierra es que el día que la haya, este camino
ya la lea.

**Qué queda para el médico** — El CDS del punto de orden sigue en
`pendiente_validacion` en el registro (C-1 en la cola del dueño), y la
clasificación de fármacos de alto riesgo sigue pendiente (C-3).

**Comprobado que puede ponerse rojo** — Revertidos los dos archivos: 8 de los 13
casos fallan.

**Y POR QUÉ NADIE LO VIO ANTES** — REG-171 dejó un guardián llamado «el que
impide la quinta copia»… que recorría **dos archivos**: `consulta/page.tsx` y
`uci/page.tsx`, precisamente los dos que acababa de reparar. La quinta copia
existía **mientras el guardián estaba en verde**, porque vivía donde el guardián
no miraba. Un candado que sólo inspecciona los archivos que ya arreglaste no
puede encontrar el que se te pasó — la misma clase de fallo que REG-191.

Ahora barre `src/` entero, con el módulo canónico y las pruebas excluidos a
propósito. Comprobado al revés: reintroducido el troceador viejo, la prueba
nombra el archivo (`src/lib/hospital/cds.ts`); el guardián anterior seguía verde.

**Golden** — `src/__tests__/el-cds-hospitalario-lee-las-mismas-alergias.test.ts`
(13 casos).

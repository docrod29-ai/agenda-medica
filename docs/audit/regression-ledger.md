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

## REG-192 — cómo se dice que no en una consulta (v1074)

**Encontrado** — 6-ago-2026, auditoría de nueve dimensiones (hallazgos C2 y C3),
**medido con el motor real** antes de tocar nada.

**El defecto** — El motor de negaciones exigía que la respuesta **empezara** por
«no». En una transcripción real casi nunca empieza ahí: delante viene la marca de
turno («—», «Paciente:») o una muletilla. De siete formas de decir que no,
**cazaba una**:

| Se dijo | ¿Se registró como negado? |
|---|---|
| «¿Padece diabetes? — No padece diabetes.» | sí (por otra vía) |
| «¿Tiene hipertensión? — Pues no.» | **no** |
| «¿Ha tenido asma? — Fíjese que no.» | **no** |
| «¿Y tuberculosis? — Tampoco.» | **no** |
| «¿Tiene cáncer? — No.» | **no** ← ni la más simple |

Cada una es una enfermedad que el paciente negó y que el sistema no registró como
negada — así que la nota podía afirmarla sin que nadie avisara. Es el motor que
existe para impedir REG-023 («el interrogatorio nombra la enfermedad en la
PREGUNTA y el extractor la cosecha»), trabajando a un séptimo de su capacidad.

**Y una segunda lista, más pobre** — `parser-clinico.ts` tenía su propio
`NEGADORES` sin `no padece`, `sin antecedentes de`, `ausencia de` ni `se
descarta`. Consecuencia: **«No padece diabetes» entraba como antecedente
positivo**, y de ahí contamina lo que se calcula encima (STOP-BANG en la
valoración preoperatoria). Mismo patrón que REG-177 con la lista de huecos.

**La trampa de la propia reparación** — Al quitar el guion de turno, «— No sé» se
convierte en «no sé», que empieza por «no». Sin guarda, el sistema registraría
que el paciente **negó** una enfermedad cuando dijo que **no lo sabe**.

**Y la guarda falló a la primera, por algo que merece quedar escrito**: se
escribió `\bs[eé]\b`, y en JavaScript `\w` es ASCII, así que «é» no cuenta como
carácter de palabra y `\b` no encuentra límite entre «é» y «.». Cazaba «no se» y
**fallaba con «no sé»** — justo la forma que se escribe. Se sustituyó por una
anticipación negativa que sí entiende acentos.

**Lo que sigue sin contar** — El silencio. Una respuesta afirmativa. Y un «no»
final en una frase **larga** («me dijeron que fuera al cardiólogo pero no»):
fabricar una negación es peor que perderla.

**Golden** — `src/__tests__/como-se-dice-que-no-en-una-consulta.test.ts` (21
casos), medidos contra el motor real.

---

## REG-193 — la fecha de próxima consulta se perdía al recargar (v1075)

**Encontrado** — 6-ago-2026, auditoría de nueve dimensiones (hallazgo D3), y
resultó **más grave** que lo reportado: no era una dependencia olvidada, era que
el dato no estaba en el respaldo en absoluto.

**El defecto** — `proximoSeguimiento` sólo se persistía **al firmar**. No estaba:

- en el respaldo local (el que sobrevive a un crash o a una recarga),
- en las dependencias de ese respaldo,
- en la condición «¿hay algo que guardar?» — ni la del autoguardado al servidor
  ni la del respaldo local.

Teclear la fecha y recargar la borraba. Y si era lo **único** escrito —el caso de
una consulta de control que se resuelve en dos minutos— el sistema consideraba
que no había nada que guardar y no guardaba **nada**.

**Por qué importa más de lo que parece** — Alimenta dos cosas que existían
esperando este dato: la tarea «agendar el seguimiento» del worklist y el contador
de seguimientos vencidos del CRM. Un paciente al que se le pierde la fecha no
reaparece en ninguna lista: no hay error, no hay aviso, simplemente **no vuelve**.

**Reparación** — En los cuatro sitios: el payload del respaldo, sus deps, las dos
condiciones de contenido, y la restauración. Guardarla sin reponerla habría sido
peor que no guardarla: parecería que se conserva y al abrir estaría vacía.

**Mismo fallo que ya se pagó** — `estudiosOrden` y `preop` faltaban en esas mismas
deps, y costó su propia reparación. La lección no se había generalizado.

**Golden** — `src/__tests__/la-proxima-consulta-no-se-pierde.test.ts` (8 casos).

---

## REG-195 — un diálogo le borró el plan de una nota real (v1076) · P0

**Reportado por el Dr., 6-ago-2026, con sus palabras**: «tengo el plan hecho,
borro medicamentos y me borras el plan de la nota y ya la firmé y ya se perdió».

**La causa** — Al pulsar Firmar, si la IA había marcado líneas con `[IA — no
dictado]`, salía un diálogo ofreciendo «Quitarlas y firmar». **El plan es
justamente lo que la IA redacta**: el médico no dicta el plan palabra por
palabra, lo dicta en prosa y el sistema lo estructura.

**Fallaba en las tres mitades a la vez:**

| | Qué hacía | Qué debía hacer |
|---|---|---|
| **Qué se quita** | «3 líneas que no dictaste» | enseñar CUÁLES — una era el plan entero |
| **Reversibilidad** | ninguna | `snapshotUndo` existía desde hacía versiones y este camino no lo usaba |
| **Qué promete** | «Quitarlas **y firmar**» | no firma: hace `return` |

Las tres juntas son cómo se pierde una nota entera **sin un solo error en
pantalla**: el médico pulsa creyendo que cierra la nota, se le borra el plan, la
nota sigue abierta, y al volver a pulsar firmar la firma **sin el plan**.

**Reparación**

1. `lineasSugeridas()` — el diálogo enseña las líneas, con la sección delante:
   «Plan de tratamiento: …» deja ver lo que «3 líneas» escondía.
2. Se guarda `snapshotUndo` antes de quitar, y el diálogo lo dice: se puede
   deshacer.
3. El botón dice «Quitarlas», no «Quitarlas y firmar», porque no firma.

**La lección** — Un diálogo que pide permiso para borrar **sin enseñar qué borra**
no está pidiendo permiso. Y un botón que promete dos acciones y hace una deja al
médico con un modelo mental falso de lo que acaba de pasar.

**Golden** — `src/__tests__/el-plan-no-se-borra-de-un-clic.test.ts` (10 casos).

---

## REG-194 — «el LLM no calcula» sólo regía en UCI (v1076)

**Encontrado** — 6-ago-2026, auditoría de nueve dimensiones (hallazgo E1).

Es una regla permanente del repositorio y estaba escrita **sólo dentro de
`evolucion_uci`**. Fuera, el prompt pedía lo contrario: «Pediatría: dosis en
mg/kg/día Y mg/kg/dosis. Holliday-Segar para líquidos», «percentiles si hay
datos». Aritmética pediátrica hecha por un modelo generativo, en una nota que se
firma con cédula.

**Reparación** — Regla 16-bis, global, que además **nombra los motores** que sí lo
hacen (`oms-crecimiento`, `calcularDosisPediatrica`, `funcion-renal`): un «no lo
hagas» sin decir quién lo hace deja el trabajo sin dueño. Y deja claro qué SÍ le
toca al modelo: señalar el hueco cuando falta un dato para que el motor calcule.

**NEEDS_CLINICAL_REVIEW** — Holliday-Segar **no tiene motor**. No se escribe uno
sin que el Dr. valide la fórmula: mientras tanto el modelo transcribe lo dictado
en vez de calcularlo, que es lo seguro de las dos opciones.

**Golden** — `src/__tests__/el-llm-no-calcula-en-ninguna-nota.test.ts` (10 casos).

---

## REG-196 — «Nota de Primera Vez» con formato SOAP (v1077) · P0

**Reportado por el Dr., 6-ago-2026, con captura**: una nota titulada «Nota de
Primera Vez» **firmada**, con encabezados SUBJETIVO (S) / OBJETIVO (O) /
EVALUACIÓN (A) / PLAN (P). Sus palabras: «cada nota debe tener su formato, no
las mezcles».

**Las dos causas**

**1. Una ausencia en el prompt.** De los trece tipos de nota, `primera_vez` y
`alta_consulta` **no tenían ninguna instrucción de formato**. Sin una, el modelo
escribe la que le sale — y en documentación médica la que sale por defecto es
SOAP, por ser la más frecuente en su entrenamiento. **No bastaba con no pedirle
SOAP: hay que pedirle lo suyo y prohibirle lo ajeno.**

**2. Las claves sobrevivían al cambio de tipo.** Al reprocesar sin `tipoOverride`,
la base eran las secciones **que ya había en memoria** (`prev`). Una clave de
otro tipo, una vez dentro, no salía nunca — por eso el documento tenía
literalmente las secciones de seguimiento bajo un título de primera vez.

**Reparación**

- Instrucción propia para los dos tipos huérfanos, con prohibición **explícita**
  de SOAP y de los encabezados «S:/O:/A:/P:».
- Regla 18-bis, general: escribe únicamente en las claves de **este** tipo.
- `seccionesDelTipo()` en `templates.ts`: devuelve exactamente las secciones del
  tipo, conservando el texto de las que coinciden por clave.

**Lo que NO hace: tirar texto clínico** — Lo que no encaja se devuelve aparte
(`huerfanas`), no se borra. Perder prosa dictada para arreglar un problema de
formato sería cambiar un defecto por otro peor, y en este repositorio la pérdida
de datos es el fallo que más caro se ha pagado.

**El guardián** — Una prueba recorre **los trece tipos** y falla si alguno se
queda sin instrucción de formato. Un hueco en esa tabla es una nota con el
formato de otra.

**Golden** — `src/__tests__/cada-nota-con-su-formato.test.ts` (26 casos).

---

## REG-197 — el arnés no cazaba la alucinación que importa (v1078)

**Encontrado** — 6-ago-2026, auditoría de nueve dimensiones (hallazgo F1), y
**medido con el propio motor** antes de tocarlo.

Entrada «El paciente tiene diabetes», oro `dx = diabetes mellitus tipo 2`:

| Lo que inventa el modelo | ¿Se detectaba? |
|---|---|
| «diabetes **con nefropatía estadio 4 y retinopatía**» en campo nuevo | **no** |
| «diabetes mellitus tipo 2 **con nefropatía estadio 4**» en el campo bueno | **no** |
| «lupus eritematoso sistémico» (nada en común) | sí |

**Dos de tres pasaban invisibles, y las dos eran las peligrosas.** La alucinación
clínica real casi nunca es un texto entero inventado: es un texto correcto con
dos palabras de más, y ésas son las que cambian el tratamiento.

**Las tres causas**

1. **`some()` en vez de proporción** — bastaba UNA palabra de más de tres letras
   presente en la entrada para dar por sustentado todo el valor. Con «diabetes»
   dentro, la nefropatía y la retinopatía entraban gratis.
2. **Los campos esperados no se revisaban** — `if (campo in oro.esperado)
   continue` los saltaba enteros: lo inventado pegado a un dato correcto era
   invisible **por construcción**.
3. **`v.includes(ov)` absolvía** — que el generado CONTENGA el valor del oro se
   tomaba como respaldo, y es exactamente lo contrario: contiene el oro **y algo
   más**. Se conserva el sentido útil (que el generado esté contenido EN el oro).

**Reparación** — `sinSustento()` mide la **proporción** de palabras sin respaldo
en la entrada ni en el oro, descontando palabras vacías. Umbral de método
declarado (`PROPORCION_SIN_RESPALDO = 1/3`): por debajo es variación de
redacción; por encima hay contenido que nadie dijo. Y la equivalencia decide si
el campo es **correcto**, no si además trae contenido nuevo — son dos preguntas y
antes las respondía una sola.

**La lección** — Un arnés que sólo caza lo fácil mide la tranquilidad, no el
riesgo. Y esto es el instrumento con el que se juzga si la IA mejora: si el
instrumento no ve, ninguna medida hecha con él significa nada.

**Golden** — `src/__tests__/el-arnes-caza-la-alucinacion-que-importa.test.ts` (12
casos), los seis escenarios medidos contra el motor real.

---

## REG-198 — «Quitar de la nota» no quitaba nada de la nota (v1079)

**Del backlog del Master Loop V7** — `UX-001`, score **70**, el pendiente de mayor
prioridad según la fórmula del propio charter.

**El defecto** — El panel de revisión pinta cada dato extraído con un botón rojo
**«Quitar»**, bajo un título que promete «Todo esto ya está en la nota… solo
quita lo que no corresponda». El botón sacaba el id del conjunto `aprobados` — y
`aprobados` **sólo se guarda como metadato de auditoría** (`aprobadosPorMedico`,
`camposAprobados`). Ni una línea de la nota cambiaba.

El médico veía un diagnóstico mal extraído, pulsaba «Quitar de la nota», el
renglón se tachaba en pantalla… y **el diagnóstico seguía en la nota que
firmaba**.

**Por qué es de los peores** — Un control que miente sobre lo que hizo es **peor
que no tenerlo**. Sin el botón, el médico habría borrado el renglón a mano; con
él se quedó tranquilo, y el dato equivocado viajó a la nota, a la receta y al
expediente con su cédula.

Es el mismo patrón que REG-195 («Quitarlas y firmar» no firmaba), encontrado el
mismo día en la misma pantalla: **botones que prometen y no cumplen**.

**Reparación** — `src/lib/expediente/quitar-de-la-nota.ts` (módulo puro) traduce
el id del panel en la eliminación real. Con punto de **deshacer**: quitar un dato
clínico no puede ser irreversible por un clic.

**Lo que NO toca, y por qué**

- **Las alergias.** Viven en el expediente del paciente, no en la nota. Borrarlas
  desde el panel de una consulta las quitaría de **todas las futuras**, y el
  cruce alergia ↔ fármaco dejaría de saltar para siempre. Quitar una alergia mal
  registrada es un acto sobre el expediente y se hace donde se administra.
- **Una sección se vacía, no se borra de la lista.** Una sección obligatoria que
  desaparece rompe la validación NOM-004 de otra manera: el médico quiere quitar
  un texto, no un apartado del documento.
- **Un id fuera de rango o desconocido no borra nada.** Nunca se inventa una
  eliminación.

**Golden** — `src/__tests__/quitar-de-la-nota-quita-de-la-nota.test.ts` (16 casos).

---

## REG-199 — el sello decía «cubre todo» y el propio módulo sabía que no (v1080)

**Del backlog del Master Loop V7** — `TRACE-001`, score 54.

**El hallazgo original era medio falso, y hay que decirlo** — El módulo **ya
documentaba** la exclusión: `CAMPOS_NO_SELLADOS_V3` explica que
`transcripcionMotor` queda fuera y por qué (sellarlo cambiaría el hash de todo lo
firmado y lo marcaría «alterada», la falsa alarma de REG-060). Esa decisión es
correcta y se mantiene.

**Lo que sí estaba mal, y es peor de lo que parece** — `COBERTURA_SELLO[3]`
declaraba `noCubre: []`, y `cubreTodo` se derivaba de «¿es la última versión?».
Resultado: **al médico se le decía en pantalla que el sello cubre el contenido
íntegro de la nota**, mientras el código de al lado documentaba lo contrario.

Contar una limitación hacia dentro y ocultarla hacia fuera es peor que no
documentarla: **una afirmación de integridad más ancha que su alcance real se
confía**.

**Reparación, sin tocar el hash** — La cobertura se **deriva** de la misma lista
que documenta las exclusiones, así que las dos no pueden volver a decir cosas
distintas. `cubreTodo` pasa a significar «no queda nada fuera», no «es la última
versión»: cuando v4 selle el origen, será `true` porque la lista quedará vacía —
no porque alguien se acuerde de cambiarlo. Y cada exclusión gana una etiqueta
legible («transcripción de origen del dictado»), porque el nombre técnico no le
dice nada a quien lee el sello.

**Tres pruebas certificaban la afirmación falsa** — Exigían `noCubre: []` y
`cubreTodo: true`. Mismo patrón que el test de v1031 que exigía la línea rota: un
golden puede fijar el defecto en vez de protegerlo.

**Y el golden cazó un bug que introduje al repararlo** — Una nota **sin sello** no
tiene cobertura, así que su lista de exclusiones está vacía… y con la primera
versión del arreglo eso daba `cubreTodo: true`. Lista vacía no significa «cubre
todo» cuando no hay sello: significa que no cubre nada.

**Lo que queda es del médico** — Subir a `hashVersion` 4 para sellar el origen
exige migración. Registrado en `agent-state/OWNER_DECISIONS_REQUIRED.md` (D-08).
Tocar el hash es irreversible sobre documentos firmados con su cédula.

---

## REG-200 — el motor de temporalidad se comía diez formas de decir «ya pasó» (v1081)

**Del backlog del Master Loop V7** — `EVAL-002`, score 55.

**Por qué se abrió** — El motor que distingue «tuvo neumonía hace tres años» de
«tiene neumonía» existía y estaba probado, pero **no había un corpus con la
respuesta correcta escrita**. Sin eso no se puede decir si mejora o empeora entre
versiones: el mismo agujero que tenía el reconocedor de voz antes del WER.

**Lo que salió al medirlo** — 26 frases de consulta mexicana real: **16 aciertos,
10 fallos**. Los diez del mismo tipo, pasado no detectado, y **cero falsos
positivos** — el motor erraba siempre del lado seguro, como declara su propia
documentación («señala de menos, nunca de más»).

Pero se le escapaban las formas más corrientes:

| Se le escapaba | Qué es |
|---|---|
| «le dio hepatitis» | la forma mexicana de enfermar |
| «había tenido convulsiones» | pluscuamperfecto |
| «fue diagnosticada de asma» | pasiva del diagnóstico |
| «ya no toma» · «dejó de» · «suspendieron» | **cese** — distingue fármaco vigente de suspendido |
| «salió del hospital» · «le dieron de alta» | alta |
| «antes fumaba» · «solía tener» | hábito previo |

**Después de ampliarlo: 30 de 30, sin un solo falso positivo.**

**Por qué importa para un paciente** — Un padecimiento pasado que entra como
actual se arrastra a **todas las notas siguientes**, cambia el riesgo quirúrgico y
cambia los fármacos. Y «ya no toma metformina» leído como vigente deja un fármaco
fantasma en la lista contra la que se cruzan alergias e interacciones.

**La asimetría que gobierna este motor** — Un aviso que no salta deja el trabajo
al médico, que es lo que ya hace hoy. Un aviso falso le hace desconfiar de todos
los demás. Por eso el corpus vigila las dos caras, pero **un falso positivo es un
fallo más grave que una omisión**.

**Golden** — `src/__tests__/corpus-oro-temporalidad.test.ts` (32 frases: 20 de
pasado, 12 de presente). Es un corpus, no un test de humo: crece cuando aparezca
una forma nueva, y el sello impide que encoja.

---

## REG-201 — el §18 del charter existía como carpeta vacía (v1082)

**Del charter Master Loop V7** — §18 exige un caso de seguridad clínica por
función. `docs/clinical-safety/` existía **con cero archivos**, junto con otras
ocho carpetas del §4.1 en el mismo estado.

Es el patrón que este repositorio ya conoce —«escrito y sin conectar»— aplicado a
la documentación: alguien creó el esqueleto y dio el trabajo por hecho.

**Lo que se hizo** — `docs/clinical-safety/REGISTRO-DE-PELIGROS.md` con **diez
peligros en el formato exacto del charter** (peligro · causa · daño · afectados ·
severidad · controles · pruebas · riesgo residual · responsable · aprobación).

**Ninguno es hipotético.** Los diez ocurrieron de verdad y citan su REG:
negación invertida (PEL-001), pasado como actual (PEL-002), receta sin unidad
(PEL-003), alergia cruzada (PEL-004), error de decimal (PEL-005), dato inventado
(PEL-006), pérdida de contenido (PEL-007), control que miente (PEL-008), fatiga
de alerta (PEL-009), integridad sobredeclarada (PEL-010).

**Lo que NO se hizo, a propósito**

- **La probabilidad no se estima.** Se registra cuántas veces ocurrió de verdad.
  Un número de probabilidad inventado es justo la clase de cifra que este
  proyecto no se permite.
- **Ninguna aprobación se marca.** La aceptación de un riesgo clínico residual es
  del médico responsable (§18): el sistema que produce el riesgo no puede
  aprobarlo. Las diez casillas quedan en ☐.

**El guardián** — `src/__tests__/el-registro-de-peligros-esta-vivo.test.ts` (108 casos)
comprueba que cada peligro traiga sus casillas, que **los archivos de prueba
citados EXISTAN** —un registro que cita una prueba renombrada declara un control
que no está—, y que ninguna aprobación aparezca firmada.

**Declara sus huecos** — El propio documento dice qué **no** cubre todavía:
paciente equivocado, fuga entre consultorios, inyección de instrucciones en el
dictado, y embarazo/pediatría/renal. Un registro que aparenta ser completo es
peor que uno que declara sus huecos: el primero se confía, el segundo se
completa.

---

## REG-202 — la sala de datos del §N3, y el guardián que me cazó inflando (v1083)

**Del charter Master Loop V7** — §N3 exige una sala de datos; `docs/data-room/`
existía **con cero archivos**.

**Lo que se hizo** — `docs/data-room/INDICE.md` con ocho secciones, cada una
marcada como **VERIFICADO / PARCIAL / NO EXISTE / DEL DUEÑO**. La distinción
importa más que el contenido: un comprador no pide una demo, pide evidencia.

**Verificado hoy, con su comando**

| | |
|---|---|
| Licencias | 40 dependencias directas: 29 MIT, 9 Apache-2.0, 1 ISC, 1 BSD-2. **Ninguna copyleft fuerte.** Comprobable con `scripts/data-room/licencias.mjs` |
| Peligros clínicos | 10, ninguno hipotético |
| Regresiones | 48 REG con causa raíz |
| Invariantes | 225 archivos, 3518 casos |
| Métricas de IA | WER 25,55 / 22,81 · foso 78,89 → 82,91 |

**Declarado como inexistente, en vez de callado** — Pentest externo **NO
realizado** (el charter lo prohíbe afirmar). Métricas de negocio: **no existen**.
Validación clínica formal: **no hay**. Ninguna aprobación de riesgo firmada.
Y un resumen con la parte **débil** al final, porque un índice que sólo enumera
fortalezas se lee como folleto.

**EL GUARDIÁN ME CAZÓ A MÍ, Y ESO ES LO QUE VALE CONTAR**

`src/__tests__/la-sala-de-datos-no-infla.test.ts` compara las cifras del
documento contra el repositorio real. En la primera pasada falló:

```
expected '…' to contain '48 REG'      ← yo había escrito 49
```

**Escribí una cifra inflada en una sala de datos**, sin querer, en el mismo
documento cuya primera línea dice «nada de tracción falsa». Si el guardián no
existiera, ese 49 se habría quedado ahí — y una cifra optimista descubierta en
diligencia debida contamina todo lo demás del documento, incluido lo que era
verdad.

**Y el guardián también estaba mal a la primera** — su patrón contra «hospitales
clientes» cazaba la propia **negación** («ni hospitales clientes»), o sea que
impedía declarar la ausencia. Un guardián que impide declarar un hueco es peor
que no tenerlo: empuja a callarlo. Corregido con una anticipación negativa.

**Lo que el guardián vigila** — que las cifras coincidan con las reales, que lo
inexistente esté declarado, que no aparezca ninguna de las cuatro afirmaciones
que el §N5 prohíbe, y que lo verificable traiga su comando.

**Y EL GUARDIÁN VOLVIÓ A CAZARME, CON ALGO MEJOR**

Al añadir los dos archivos de prueba de esta misma iteración, el sello pasó de
225 a 226 archivos y el documento **quedó desfasado en el acto**.

No fue un descuido: es **estructural**. Un documento con cifras tecleadas miente
el día que el repositorio crece, y en una sala de datos ese desfase se lee como
falta de rigor — o se descubre en diligencia debida.

Por eso las cifras ahora se **derivan**: `scripts/data-room/actualizar-cifras.mjs`
las regenera desde el sello, el ledger y el registro de peligros. Correrlo es
parte de cerrar una iteración, igual que subir el service worker.

**Lo que el script NO deriva, y lo dice** — el total de pruebas, porque exige
correr la suite entera y este script tiene que tardar un segundo. Avisa en vez de
adivinarlo: inventarlo sería exactamente el defecto que existe para evitar.

**El bloqueo número uno de la sala de datos no es técnico**: el código está bajo
una cuenta personal, no de la sociedad. Registrado para el dueño.

---

## REG-203 — las decisiones de arquitectura vivían en la cabeza de nadie (v1084)

**Del charter Master Loop V7** — §5.1 exige registros de decisión;
`docs/decisions/` existía **con cero archivos**.

**Por qué importa aquí más que en un proyecto normal** — Un ADR sirve para
**impedir que una decisión tomada con un dato delante se deshaga meses después
por alguien que no vio ese dato**. Ya pasó dos veces esta semana: una regla se
acota y otra mención queda viva diciendo lo contrario (REG-180, REG-184). Un ADR
es más barato que la reparación.

**Los cuatro escritos**, todos de decisiones **ya tomadas**, no propuestas:

| ADR | Decisión | De dónde sale |
|---|---|---|
| 001 | Una fuente de verdad por entidad clínica | REG-034/035/171 (cuatro parsers de alergias), REG-177, REG-192 |
| 002 | El LLM nunca calcula una cifra clínica | REG-194 |
| 003 | El sello de integridad tiene versión propia | REG-060, REG-199 |
| 004 | Tres niveles de aviso, no un recuadro por motor | REG-181 |

**Las tres reglas del directorio, que es lo que los hace útiles**

1. **Las alternativas descartadas se escriben.** Un ADR sin alternativas no
   documenta una decisión: documenta un hecho consumado. Es lo que impide que
   alguien vuelva a proponer lo mismo dentro de seis meses.
2. **Las consecuencias negativas también.** Toda decisión de arquitectura cuesta
   algo; callarlo hace que el coste se descubra tarde y **parezca un defecto** en
   vez de una decisión. ADR-004 escribe la suya sin adornos: *plegar es esconder*.
3. **Una decisión clínica del médico NO es un ADR.** Meterla aquí haría parecer
   que el sistema decidió algo que no le corresponde. Ésas viven en el ledger y
   en `OWNER_DECISIONS_REQUIRED.md`.

**El guardián** — `src/__tests__/los-adr-no-mienten.test.ts` (28 casos)
comprueba que cada ADR traiga sus alternativas, sus consecuencias aceptadas y su
mecanismo de cumplimiento; que **los archivos y pruebas que cita existan** —un
ADR que cita algo renombrado declara un control que no está—; y que ninguno fije
un umbral clínico bajo forma de decisión de arquitectura.

**Quedan tres decisiones ya tomadas sin ADR**: la separación Consulta/Hospital
tras feature flag, los proveedores de voz intercambiables, y la política
multi-inquilino. Escritas como pendientes en el índice, no calladas.

---

## REG-204 — los nueve ceros del §H6 no tenían puerta (v1085)

**Qué faltaba** — El charter §H6 fija **nueve cosas que deben dar cero** para
poder liberar una versión: paciente equivocado, error de medicación silencioso,
error de unidad silencioso, negación invertida silenciosa, cita fabricada, orden
activa no confirmada, acceso entre consultorios, pérdida de datos y pago
duplicado. Cualquiera distinta de cero **bloquea la liberación**.

No estaban escritos en ningún sitio del repositorio. Vivían en el charter — es
decir, fuera del código que tienen que bloquear.

**Lo que la medición encontró, y no era lo esperado** — La corazonada era que
faltarían pruebas. Al mapear cada cero contra la suite, **los nueve ya tenían
cobertura**: ninguno estaba desnudo. Lo que faltaba no era protección, era
**la declaración de que esa protección es una puerta** y el guardián que
comprueba que siga en pie.

**Los dos que sí están flojos, dichos como son:**

| # | Cero | Por qué es débil |
|---|---|---|
| 1 | **Paciente equivocado** | Es el **primero** de la lista del charter y el peor cubierto. Lo protegen controles reales pero **derivados** (`deEstePaciente`, reglas por `clinicId`); ninguno se escribió pensando en «paciente equivocado» como peligro con nombre. **No hay corpus adversarial**: nadie intenta a propósito meter la nota de un paciente en el expediente de otro. |
| 7 | **Acceso entre consultorios** | La puerta `aislamiento-tenant` corre en cada PR y es real, pero prueba **lo que se le pidió probar**. No hay equipo rojo independiente intentando romperla, que es lo que pide el §5.16. |

**La palabra que hace el trabajo es «silencioso»** — seis de los nueve la llevan.
Un error que el sistema detecta y avisa es trabajo hecho; lo que esta puerta
persigue es el que **pasa sin que nadie se entere**, el que se lee igual que un
dato correcto dentro de un documento firmado con cédula.

**Lo que la puerta NO significa, escrito dentro de ella** — un cero aquí no
significa que el error no pueda ocurrir: significa que, sobre el conjunto de
casos que **alguien pensó en escribir**, no ocurrió sin avisar. Cada REG de este
ledger empezó siendo un caso que nadie había pensado.

**El guardián** — `src/__tests__/la-puerta-de-liberacion-sigue-cerrada.test.ts`
(15 casos) comprueba que sean exactamente nueve, que cada uno tenga al menos una
prueba viva, que **ninguna prueba citada haya desaparecido**, que el documento
declare los débiles como débiles y no en verde, y que nadie borre la frase que
impide leer la puerta como una garantía.

**Las dos formas de perder una protección sin enterarse** son que se borre y que
se ahueque. Este guardián detecta la primera; el sello de invariantes —que
cuenta los casos de cada archivo y no deja que encojan— detecta la segunda. Hacía
falta la pareja: hasta hoy sólo existía la mitad.

**Documento** — `docs/evals/PUERTA-DE-LIBERACION.md`

---

## REG-205 — 52 defectos y nadie los había contado por familia (v1086)

**Qué faltaba** — El §H7 del charter pide que cada defecto se convierta en
aprendizaje permanente. La mitad estaba hecha: cada REG tiene su prueba de
regresión. **La otra mitad no**: nadie había mirado los 52 juntos para preguntar
de qué se enferma este sistema.

Leídos de uno en uno son 52 historias. Contados por familia dicen algo que
ninguno dice solo.

**Lo que salió, con la cuenta detrás:**

| Familia | Casos |
|---|---:|
| **Escrito, probado y sin conectar** | **9** |
| El sistema se contradice a sí mismo | 8 |
| El habla real no cabía en el motor | 5 |
| Nadie lo estaba midiendo | 5 |
| El hueco tratado como dato | 4 |
| Fuga entre consultorios y dinero | 4 |
| El charter existía sin encarnar | 4 |
| Estorba al médico · Pérdida de datos | 3 y 3 |
| Llega tarde para servir · El mensaje mentía | 2 y 2 |
| *Decisión del dueño, no defecto* | 2 |
| Al modelo de datos le faltaba un eje | 1 |

**La familia más grande confirma lo que ya se sospechaba, ahora con número** —
nueve veces el módulo estaba bien, sus pruebas pasaban, y el sistema fallaba
igual **porque el módulo no corría donde tenía que correr**: el motor de
sobredosis después de firmar (REG-190), «Quitar de la nota» tocando un metadato
de auditoría (REG-198), los motores recibiendo la receta de hoy en vez del
paciente entero (REG-188), el 80,6 % de las correcciones tirado sin mirar
(REG-169) y el bucle que debía aprender de ellas sin haber aprendido nada
(REG-170).

**Lo que implica**: una prueba unitaria verde es compatible con las nueve. Sólo
las cazan las pruebas que recorren **el camino**, no la pieza.

**La segunda familia justifica los guardianes de coherencia** — ocho casos donde
**ninguna de las dos partes está mal por separado**, así que ninguna revisión de
una sola pieza los encuentra. No hay dónde poner una prueba que vigile una
contradicción entre dos módulos salvo **un tercero que compare**.

**Lo que el conteo NO dice, escrito dentro del documento** — sólo se cuentan los
defectos **encontrados**, y encontrar depende de dónde se miró. Una familia
pequeña puede serlo porque es rara o **porque nadie la busca**, y las dos se ven
idénticas desde aquí. La sospechosa es «fuga entre consultorios»: cuatro casos,
los cuatro hallados auditando a propósito, ninguno en uso normal — y es uno de
los dos ceros que la puerta de liberación declara DÉBIL.

**Por qué la taxonomía es código y no una tabla** — una tabla escrita a mano
envejece en silencio. `src/lib/calidad/familias-de-defecto.ts` se compara contra
el ledger y `src/__tests__/de-que-se-enferma-este-sistema.test.ts` (9 casos)
**falla si un REG no tiene familia**. Este mismo REG-205 lo estrenó: al añadirlo,
la prueba se puso roja hasta clasificarlo.

**Documento** — `docs/quality/FAMILIAS-DE-DEFECTO.md`

---

## REG-206 — la arquitectura estaba dibujada, no medida (v1087)

**Qué faltaba** — `docs/architecture/` era la última carpeta técnica vacía del
§4.1. Existía el mapa en `CLAUDE.md` y existían los ADR, pero **nadie había
comparado el diagrama con el grafo de `import` real**.

Un diagrama describe lo que alguien quiso. El grafo describe lo que hay. Cuando
se separan, manda el segundo — y el diagrama pasa a ser un documento que
tranquiliza sin proteger.

**Lo medido, sobre 734 archivos de `src/`:**

| | |
|---|---|
| Dependencias invertidas | **0** |
| `lib/` que dependa de una pantalla o una ruta | **0** |
| Ciclos de importación | **0** |

**El resultado limpio no era el esperado y merece decirse tal cual**: la
dirección `app/components → contexts → hooks → lib → types` se respeta en las
1 314 aristas medidas. Ni un solo módulo de lógica clínica está atado a una
pantalla — que es lo que le permitiría dejar de correr desde una ruta de API,
por donde entran los motores cuando algo se automatiza.

**La grieta encontrada: `types/` no era una hoja.** Dos archivos traían código en
tiempo de ejecución desde `lib/`.

- **Cerrada** — `src/types/hospital.ts` re-exportaba `ESPECIALIDADES_INTERCONSULTA`
  (un valor, no un tipo) con un alias. Tenía **un solo consumidor**; ahora lo
  importa de `@/lib/especialidades`, que siempre fue la fuente única. La comodidad
  de un alias no valía una arista invertida.
- **Declarada, no arreglada** — `src/types/clinical-quantity.ts` usa `num()` de
  `lib/uci` **y hace bien**: es la fuente única de la coma decimal mexicana. Lo
  que está mal es DÓNDE VIVE: es un módulo de dominio completo alojado en
  `types/` por herencia. Moverlo toca a todos sus consumidores — se decide, no se
  cuela en una madrugada.

**Por qué importa que `types/` sea hoja** — hoy no hay ciclo, está comprobado,
pero es por ahí por donde aparecería el primero (`lib/X → types/Y → lib/Z`). Un
ciclo no siempre rompe; cuando rompe lo hace con un `undefined` dentro de un
módulo que se lee perfecto. En un motor clínico eso es **una cifra que no sale**,
no un error que salte.

**Los `import type` no cuentan** — TypeScript los borra al compilar. Contarlos
daría violaciones inexistentes, y es el mismo detalle que hizo pasar en verde a
cuatro módulos huérfanos durante meses (v1019).

**El guardián** — `src/__tests__/la-direccion-de-las-dependencias.test.ts`
(8 casos) sobre `src/lib/arquitectura/grafo-de-dependencias.ts`. Las tres reglas
se cumplen hoy; **el valor de la prueba no es certificarlo**, es que el día que
alguien las rompa se entere en su PR y no seis meses después. Una arquitectura
limpia no se mantiene sola: se mantiene porque algo se pone rojo.

**Lo que la medición NO dice, escrito dentro** — que la dirección sea correcta no
dice que los límites estén en el sitio correcto. Un `lib/` enorme con todo dentro
cumpliría las tres reglas y seguiría siendo un nudo. Esto cubre el deterioro que
**se cuela sin que nadie lo decida**; la otra clase se decide y se escribe en
`docs/decisions/`.

**Documento** — `docs/architecture/DIRECCION-DE-DEPENDENCIAS.md`

---

## REG-207 — el guardián de afirmaciones no miraba donde más importa (v1088)

**El hueco** — `claims-guard.test.ts` vigila el copy público —landing, precios,
demo— para que no reaparezcan afirmaciones engañosas. Cuatro archivos de `src/`.

**No vigilaba `docs/`.** Y `docs/` es lo que lee un comprador en una diligencia
debida.

De los dos públicos, **el segundo es el que tiene consecuencias**: un visitante
que lee una exageración en la landing se encoge de hombros; un comprador que
verifica una y la encuentra falsa **deja de creerse el resto del paquete**,
incluido lo que sí está medido.

**Lo que encontró al encenderse** — seis afirmaciones sobre terceros **sin una
sola fuente** en `docs/COMPETITIVE_ANALYSIS.md`, bajo una columna titulada
literalmente «Por qué somos superiores»:

> «Nadie con esa granularidad» · «Pocos en LATAM» · «Pocos lo tienen integrado» ·
> «Casi nadie en EHR cloud» · «nadie lo expone visualmente»

**La regla que ordena esto** — un documento competitivo tiene dos clases de frase
y sólo una se sostiene en diligencia: **lo que hacemos nosotros** (verificable en
el repositorio, con su comando) y **lo que hace un tercero** (necesita fuente y
fecha, o no se escribe). El documento las mezclaba.

**Qué se hizo con el documento viejo** — no se borró. Se le puso un aviso de
alcance y se reescribió la tabla para decir **sólo qué hace este producto y dónde
comprobarlo**. Borrar habría escondido que alguna vez se afirmó — y esconderlo es
lo que hace que se vuelva a afirmar.

**El documento nuevo** — `docs/competitive/EL-FOSO.md` separa lo que es foso
(corpus mexicano medido, motores deterministas, 54 REG con causa raíz,
guardianes) de **lo que NO lo es**, escrito para no engañarnos: usar un modelo de
frontera, transcribir voz, tener agenda/receta/expediente, «UX bonita», el número
de funciones. **Casi todo lo que un usuario ve no es foso.**

**El guardián me cazó dos veces, y las dos son la misma lección**

1. Cazó el documento escrito para **denunciar** esas frases: `EL-FOSO.md` las
   cita textualmente. Arreglo: **afirmar es distinto de citar** — lo
   entrecomillado con «…» no cuenta.
2. Impedía escribir «No somos los únicos» y «Ninguno de los ceros está medido» —
   dos declaraciones de hueco **sobre nosotros mismos**. Arreglo: exclusión de la
   negación y `ninguno de ellos` en vez de `ninguno de los`.

Es exactamente el error del guardián de la sala de datos (v1083), que cazaba «ni
hospitales clientes». **Un guardián de honestidad que castiga la honestidad
empuja a callar el hueco en vez de escribirlo**, que es lo contrario de para lo
que se puso.

**El guardián** — `src/__tests__/el-foso-no-inventa-competidores.test.ts`
(6 casos, 10 aserciones) sobre cinco documentos cara al comprador. Incluye una
prueba de que **sigue cazando las frases reales** del documento anterior: si el
patrón se afloja, el guardián queda apagado sin que nadie lo note.

**Documento** — `docs/competitive/EL-FOSO.md`

---

## REG-208 — el instrumento que mide «¿esto llega al médico?» estaba ciego cuatro veces (v1089)

**Qué se construyó** — El §4.1 pedía `docs/product/`. Se escribió el camino
clínico de siete pasos y una prueba que **lo recorre de verdad**: parte de
`src/app/` y sigue los imports hasta donde lleguen.

Existe porque la familia de defecto más grande del ledger —**9 de 55**— es
«escrito, probado y sin conectar», y **los nueve tenían prueba unitaria en
verde**. Ninguna prueba de pieza hacía la pregunta que importa: *¿esto está en el
camino?*

**Lo que pasó al encenderlo, que es el verdadero contenido de este REG** — la
primera medición dijo **87 módulos fuera del camino**. La cifra era falsa. El
lector tenía **cuatro cegueras**, todas del mismo tipo: **veía texto donde tenía
que ver código**.

| # | Ceguera | Efecto | Tras arreglarla |
|---|---|---|---|
| 1 | `import type` contado como dependencia | dependencias que no existen | (ya estaba) |
| 2 | `await import()` y `dynamic(() => import())` invisibles | **los paneles clínicos de Next** parecían fuera | 87 → 70 |
| 3 | Rutas relativas `./x` ignoradas | **el interior de cada motor** parecía fuera: los 19 archivos del antibiograma | 70 → 29 |
| 4 | Comentarios leídos como código | imports comentados contaban como vivos | 29 → 35 |

**Y la cuarta trajo la peor**: al quitar comentarios, el orden importaba. Un
comentario de línea de `ValoracionInmuno.tsx` dice *«la lógica vive en
`src/lib/inmuno/*`»* — esa **barra-asterisco abría un bloque falso** y el
limpiador se comía los seis imports del motor de inmunocomprometido. **El módulo
aparecía desconectado estando montado en la consulta.** Se arregló quitando
primero las líneas `//` y después los bloques.

**Por qué esto importa más que el número** — un instrumento que declara
desconectado un motor clínico que sí corre es **peor que no tenerlo**: manda a
buscar donde no hay nada y desacredita las veces que acierta. La regla que sale
de aquí: **antes de reportar una cifra, comprobar el instrumento con un caso cuya
respuesta ya se conoce.**

**El resultado real, ya verificado**: 500 módulos, **471 alcanzables, 29 no**. De
esos 29, **26 ya estaban declarados** como huérfanos aceptados con su motivo. Que
dos instrumentos independientes converjan en el mismo conjunto es la mejor señal
que puede dar una medición.

**Los otros 3 son lo que este instrumento ve y el otro no**: están importados
—así que no son huérfanos— **pero por un módulo que tampoco corre**. Islas de
dos: `clinica/simulacro`, `compliance/country-profiles`, `uci/benchmark-metricas`.
Ninguno alarmante; los tres son lo que quedaba por ver.

**El guardián** — `src/__tests__/el-camino-del-medico-llega-entero.test.ts`
(9 casos, 21 aserciones). Comprueba los siete pasos, que sus módulos existan y se
alcancen, y **pone un trinquete en 29**: el número puede bajar, no subir sin que
alguien lo escriba.

**Lo que NO prueba, escrito dentro** — que el módulo funcione (para eso están sus
pruebas) ni que corra **en el momento correcto**: REG-190 y REG-173 eran motores
perfectamente alcanzables que **llegaban tarde**. Prueba que **el cable existe**,
que es la condición previa a todo lo demás.

**Documento** — `docs/product/EL-CAMINO-DEL-MEDICO.md`

---

## REG-209 — «dos coma cinco miligramos» se leía como 2 mg (v1090)

**Cómo se encontró** — El §B5 del charter enumera los pares donde confundirse
cambia la dosis, y el §9 lista el «benchmark numérico y de unidades» como activo
propietario. **La política existía** (`politica-critica.ts`: los pares que jamás
se autocorrigen). **La medición no.**

Se escribieron 20 formas reales de dictar una cifra en un consultorio mexicano y
se pasaron por el pipeline. Resolvía 14. **Fallaba en cinco maneras de decir una
fracción.**

**Las dos peligrosas, porque no pierden el dato — lo reducen a un valor
plausible:**

| Se dictó | Salía | Lo que lee el motor de dosis |
|---|---|---|
| «dos coma cinco miligramos» | `2 coma 5 mg` | **2 mg** — 20 % menos |
| «un gramo y medio» | `1 g y medio` | **1 g** — un tercio menos |

En México **la coma es el separador decimal al dictar**, y «y medio» es la forma
normal de decir una dosis y media. Ninguna de las dos estaba cubierta.

**Por qué es este modo de fallo y no otro** — una cifra que **desaparece** se
nota: el campo queda vacío y hay guardianes que lo vigilan. Una cifra que se
convierte en **otra cifra creíble** no la ve nadie: ni el médico al releer, ni el
motor, ni el sello de integridad. Es el mismo patrón que el pH «7.30 y 5»
(REG-159) y que la metformina «852 veces al día» (v746): **el error se lee bien**.

**La reparación**

1. **«coma» se trata como «punto»** — es la misma función gramatical. La guarda
   que ya existía (`hay número delante` **y** `viene número detrás`) es lo que
   impide que «el paciente está en coma» se rompa; está probado.
2. **Las mitades habladas** — `medio <unidad>` → `0.5`, y `<n> <unidad> y medio`
   → `<n>.5`. **Sólo con unidades de fármaco detrás**: «media hora», «a medio
   camino», «la media de la serie» y «dos veces y media» se quedan intactas, y
   los cuatro casos están en el corpus. Sin ellos, una regla demasiado ávida
   pasaría igual — y su daño no se ve hasta que ensucia una nota real.

**Lo que NO se arregló, escrito en vez de callado** — «punto cinco miligramos»
(sin el «cero») es ambiguo con «el punto tres del plan»; convertirlo exige mirar
si detrás hay una unidad, y esa regla toca el lector de números entero. Y «cinco
décimas de miligramo» es aritmética, no gramática. Ambos quedan **como casos del
corpus que documentan el límite actual**, no como huecos.

**El guardián** — `src/__tests__/corpus-oro-numeros-y-unidades.test.ts`
(8 casos, 22 aserciones). Es el benchmark del §B5 que el charter pedía y que no
existía.

---

## REG-210 — «mi mamá tuvo cáncer» podía quedar como antecedente del paciente (v1091)

**El eje que faltaba** — Ya estaban medidos el **«¿sí o no?»** (negación,
REG-192) y el **«¿cuándo?»** (temporalidad, REG-200). Faltaba el **«¿a quién?»**,
que el §B8 del charter llama *experiencer* y que no tenía ni motor ni regla en el
prompt.

En una consulta, buena parte de lo que se dice sobre enfermedades **no es del
paciente**: «mi mamá tuvo cáncer de mama», «mi papá murió de un infarto», «en mi
familia todos son diabéticos».

**Por qué es de los peores** — un extractor que no distingue al dueño de la frase
convierte un antecedente **heredo-familiar** en uno **personal patológico**. Lo
que queda no es un dato incompleto: es una historia clínica **impecablemente
redactada** afirmando un cáncer que el paciente nunca tuvo, firmada con cédula
profesional. **No se ve raro.** De ahí salen tamizajes que no tocan y decisiones
que nadie puede rastrear.

**Y el error al revés cuesta igual** — cuando el familiar sólo es **quien lo
cuenta** («mi esposa dice que ronco», «mi mamá me dijo que yo tuve convulsiones
de niño»), el síntoma **es del paciente**. Mandarlo a antecedentes familiares
**borra un dato real**, que es tan malo como inventar uno.

**La trampa que ya había costado una vez, y volvió a costar** — el motor se
escribió con `\b` al final del patrón de parentescos. En JavaScript `\w` es
**ASCII**: la `á` no cuenta como letra, así que **`\b` detrás de «mamá» no
encuentra límite de palabra**. El motor reconocía «mi abuela» y **no** «mi mamá»
ni «mi papá» — las dos formas más frecuentes. Media función muerta y la otra
media funcionando, que es lo peor para darse cuenta.

Es el mismo fallo que tuvo el motor de negación con «no sé». Ahora usa
`(?![\p{L}])`, que sí entiende Unicode, y hay un caso del corpus dedicado a él.

**Lo que se hizo**

1. `src/lib/expediente/experienciador.ts` — motor determinista sobre posesivos y
   parentescos, incluidas las formas coloquiales («jefa», «apá»): un motor que
   sólo conoce «madre» y «padre» falla justo con quien habla con más confianza.
   Devuelve `indeterminado` cuando no hay señal, **que no es un fallo**: es lo
   que impide inventar un dueño.
2. **Regla 19-ter del prompt** — al modelo se le pide, y aparte se comprueba.
3. **Conectado a la barra** como origen `antecedente_del_familiar`, nivel
   `revisa`: el motor dice de quién es la frase; **quién decide dónde va el
   antecedente es el médico**.

**Los guardianes hicieron su trabajo tres veces seguidas** — al escribir el motor
saltó el de módulos huérfanos (no estaba conectado: la familia de defecto nº1);
al cambiar el prompt saltó el de la versión (huella nueva sin bumpear); y al
añadir el origen saltó el de la barra, que exige declarar el nivel de todo motor
nuevo. **Ninguno de los tres me dejó entregarlo a medias.**

**El guardián** — `src/__tests__/corpus-oro-de-quien-es-la-enfermedad.test.ts`
(25 casos): 9 del familiar con su parentesco, 4 por marco de la frase, 3 donde el
familiar sólo reporta, 4 de primera persona, 3 indeterminados, 1 sobre un dictado
entero y 1 dedicado a la trampa del acento.

---

## REG-211 — «creo que me dijeron que tenía anemia» podía quedar como «Anemia» (v1092)

**El cuarto eje** — el §B6 del charter pide distinguir *presente, ausente,
posible, probable, incierto, histórico, condicional y no mencionado*. Sin este
motor, los ocho colapsaban en dos: **dicho o no dicho**.

|  |  |
|---|---|
| ¿sí o no? | `negaciones` (REG-192) |
| ¿cuándo? | `temporalidad` (REG-200) |
| ¿a quién? | `experienciador` (REG-210) |
| **¿qué tan seguro?** | **esto** |

**El daño** — lo que el paciente ofreció como **duda** queda en el expediente
como **diagnóstico**. Y a partir de la segunda consulta ya nadie sabe que era una
duda: se lee igual que un dato confirmado, se arrastra a todas las notas
siguientes y termina cambiando tratamientos.

**Cuatro matices, porque cambian qué hay que hacer con el dato**: `duda` («creo
que», «no estoy segura»), `posibilidad` («a lo mejor», «tal vez»), `referido`
(«me dijeron que») y `aproximado` («como cinco años»).

**Y la salvedad que evita el aviso inútil** — si el paciente **trae la
constancia** («aquí traigo la biometría», «confirmado con biopsia»), ya no es
duda. Sin esto, el aviso saltaría teniendo el papel en la mano, y un aviso que
salta de más se aprende a cerrar.

**Por omisión, `afirmado`. No al revés**: marcar como incierto lo que no lo es
llenaría la nota de dudas inventadas.

---

### El mismo defecto, TRES veces en una noche — y por fin un guardián

En JavaScript `\w` es **ASCII**. Un `\b` detrás de una letra acentuada **no
encuentra límite de palabra y el patrón no dispara**:

| Patrón | No cazaba | Motor |
|---|---|---|
| `/\b(?:no\s+s[eé])\b/` | «no sé» | negación (ya reparado) |
| `/\b(mamá\|papá)\b/` | «mi mamá» | experienciador (REG-210) |
| `/\b(?:quiz[aá]s?)\b/` | «quizá» | certeza (hoy) |

El síntoma es siempre el mismo y es el peor posible: **media función viva y media
muerta**. «no sé si» sí, «no sé» no. «mi abuela» sí, «mi mamá» no. «quizas» sí,
«quizá» no. Nada revienta, nada avisa, y la mitad que funciona hace creer que
funciona entera.

**Un comentario en cada archivo no bastó**: el tercero se escribió con la lección
ya escrita dos veces. Por eso ahora es una prueba —
`src/__tests__/el-limite-de-palabra-no-entiende-acentos.test.ts` — que revisa los
seis motores de lenguaje.

**Y encontró tres más en el acto**, en el módulo escrito una hora antes:
`a\s+m[ií])\b`, `salió)\b` y `padec[ií]|sent[ií])\b`. Es decir: «a mí», «me
salió», «padecí» y «sentí» **tampoco disparaban**. La lección tenía que dejar de
ser un comentario exactamente por esto.

**El guardián marca de más a propósito** — un patrón con acento en una rama y
`\b` cerrando otra que acaba en consonante es inofensivo. Se acepta: en un motor
de español hablado `(?![\p{L}])` es correcto siempre, así que exigirlo de forma
uniforme no cuesta nada y **elimina la clase entera de fallo**.

---

**Lo hecho** — `src/lib/expediente/certeza.ts`, regla **19-quater** del prompt, y
conectado a la barra como origen `dato_incierto` (nivel `revisa`): el aviso cita
la palabra exacta que lo delató, porque uno que sólo dijera «hay un dato
incierto» obligaría a releer el dictado entero.

**Los guardianes** — `src/__tests__/corpus-oro-con-cuanta-seguridad-lo-dijo.test.ts`
(26 aserciones, incluidas tres formas de «como» que **no** son aproximación) y
`src/__tests__/el-limite-de-palabra-no-entiende-acentos.test.ts` (9 casos, con
prueba de que sigue cazando las tres reales).

---

## REG-212 — cada motor acertaba solo, y juntos mentían (v1094)

**Cómo se encontró** — Los cuatro ejes ya existían y cada uno tenía su corpus:
negación, temporalidad, experienciador, certeza. **Lo que nadie había probado es
si se estorban entre ellos.** Se pasaron nueve frases que tocan varios ejes a la
vez por los tres motores. Dos fallaron.

### 1 · Una frase con dos dueños

> «yo no tengo diabetes **pero** mi mamá sí»

| Motor | Decía |
|---|---|
| negación | «diabetes negada» ✅ |
| experienciador | «toda la frase es del familiar» ❌ |

Analizada entera, la frase se atribuía al familiar y **se perdía lo que de verdad
dice**: que el paciente la niega **y** que la mamá sí la tiene. Dos datos
distintos, de dos personas distintas, en catorce palabras.

**Cada motor por su lado acertaba; juntos mentían.** Ninguna prueba de pieza podía
encontrarlo, porque el fallo no está en ninguna pieza — está en que ambas leen la
frase entera cuando la frase cambia de sujeto a mitad.

**La reparación** — se corta también en los conectores que cambian de sujeto
(«pero», «aunque», «en cambio», «mientras que», «sin embargo»), no sólo en los
puntos. Y hay un caso que comprueba que **sin conector no parte de más**.

### 2 · La duda que va al final

> «mi mamá no tuvo cáncer, **creo**»
> «fue hace como diez años, **creo yo**»

El patrón exigía «creo **que**». En el español hablado la duda se **pospone**
muchísimo, y así la frase entera pasaba como afirmada.

Se exige coma o final de frase delante, para no cazar el «creo» de «creo un
recordatorio» — que está probado.

**Lo que esto enseña sobre cómo probar** — los cuatro corpus oro que ya existían
son correctos y no habrían encontrado ninguno de los dos. **El defecto vive en la
composición**, y la composición sólo se ve midiéndola a propósito. Es el mismo
patrón que la familia «escrito y sin conectar», un nivel más arriba: no es que el
motor no corra, es que **corre sin ver lo que el otro ve**.

---

## REG-213 — «¿de dónde sacó la IA esto?» sólo se podía contestar reescuchando (v1095)

**SUP-001 del loop competitivo.** Cierra la distancia más grande frente a
Abridge (*Linked Evidence*), y es el **§B10 del charter propio**, que llevaba
sin hacer desde que se escribió.

**La pregunta** — frente a una nota generada, la duda del médico no es «¿está
bien redactada?», es **«¿de dónde salió esto?»**. Hasta hoy la única forma de
contestarla era **volver a oír la consulta entera**. Y un médico que tiene que
reescuchar veinte minutos para comprobar una línea no comprueba: **firma**.

**Lo que hace** — enlaza cada afirmación de la nota con el fragmento del dictado
que la sostiene, con su posición para poder resaltarlo. Lo que ningún fragmento
sostiene se declara, **con las palabras que nadie dijo**.

**Lo que NO hace, escrito dentro del módulo** — no dice que la afirmación sea
verdad: dice que hay un fragmento que la sostiene. El paciente pudo equivocarse o
el reconocedor transcribir mal. Elimina **la frase que nadie dijo**, no todos los
errores.

**Y no elige por el médico**: cuando no encuentra respaldo lo dice, en vez de
enlazar al fragmento menos malo. Un enlace inventado sería peor que ninguno —
daría por comprobado justo lo que hay que comprobar.

**Por qué no se le pide al modelo que cite sus fuentes** — un modelo que inventa
una frase también puede inventar de dónde la sacó, y entonces el enlace
**certifica la alucinación en vez de delatarla**.

### El falso positivo que habría matado la función

La primera medición sobre una nota realista marcaba como «nadie dijo»:

| La nota escribe | El paciente había dicho |
|---|---|
| cefalea | «dolor de cabeza» |
| colecistectomía | «me operaron de la vesícula» |
| madre | «mi mamá» |

**Las tres son traducciones correctas** que un médico hace al redactar. Un aviso
que las señala se aprende a cerrar en dos consultas — y entonces deja de proteger
de lo que sí importa, que **en esa misma nota** era «nefropatía diabética estadio
4», inventada de cero.

La tabla de sinónimos es **estrictamente lingüística**: habla del paciente ↔
término técnico, nunca una inferencia clínica. «Dolor de cabeza» **es** cefalea;
«cada mañana» **no es** «cada 24 horas» —eso es interpretar la pauta— y por eso
se sigue marcando, con su caso en el corpus.

**Es también el tipo de activo que no viene con ninguna API**: la tabla del
español que se habla en un consultorio mexicano.

**Conectado** a la barra como origen `sin_respaldo_en_el_dictado`, nivel
`revisa`. No bloquea: el motor no sabe si la afirmación es falsa, sabe que
**nadie la dijo en voz alta** — puede venir del expediente previo o de la
exploración física, y el aviso lo dice.

**El guardián de la nota entera saltó** — exigía que las defensas que leen la
nota compartan constructor de texto, y pasaron de dos a tres. Que las tres vean
**la misma nota** es justo lo que impide que una se quede ciega.

**Los guardianes** — `src/__tests__/corpus-oro-de-donde-salio-esto.test.ts`
(13 casos): enlaza lo dicho, declara lo inventado **sin fragmento**, no castiga
la traducción del médico, y sigue marcando la interpretación de la pauta.

---

## REG-214 — la alergia estructurada no llegaba a la compuerta de firma (v1096) · P0

**Reproducido con los motores reales, sin simular nada:**

```
Paciente con «Penicilina» SÓLO en el campo estructurado
+ prescripción de cefalexina

lo que se sellaba HOY  →  0 alergias  →  la compuerta da 0 errores  →  SE FIRMA
con el lector correcto →  1 alergia   →  «[Contraindicado] beta-lactámicos»
```

**El betalactámico se firmaba sobre un alérgico, con el aviso a la vista en la
pantalla.** Porque la pantalla lee `alergiasDe` —y pinta la alergia en rojo— y lo
que se sella en la nota leía `parsearAlergiasTexto`, que **sólo mira el texto
libre**. De `nota.alergias` cuelga la compuerta de `nom004.ts`: el cruce por
subcadena y el de reactividad cruzada por familias. Con la lista vacía, los dos
callan.

**De qué familia es** — **dos lecturas del mismo campo**: la de REG-034, REG-035
y REG-171, y exactamente lo que el ADR-001 existe para impedir. Aquí había dos
lecturas y **la que gobernaba la seguridad era la ciega**.

### Quién lo encontró, y por qué no se fusionó a ojo

Lo encontró **la rutina autónoma del Master Loop**, trabajando en su propia rama
`agent/safety/SAFE-001-sello-de-la-nota`. Su diagnóstico era correcto y el caso
que construyó era real.

**Su reparación no lo era**: usaba `alergenosDe`, que devuelve `string[]`, cuando
la compuerta espera `AlergiaEstructurada[]` y hace `al.alergeno.toLowerCase()`.
Con cadenas sueltas la compuerta revienta o queda ciega por otra puerta. La
correcta es `alergiasDe`, que lee **las dos fuentes** y devuelve el tipo bueno.

Se verificó antes de traerla, y por eso hay un caso del corpus dedicado al
**tipo** que devuelve el lector: aquí el tipo **es** parte del arreglo.

**La lección de operación** — la rutina trabaja sobre `main` y esta sesión sobre
`agent/pagos/PAY-001`. Dos carriles que nunca se cruzaron: su trabajo llevaba un
día parado sin llegar a producción. Además **los números de REG colisionaron**
—su REG-202 es otro defecto que el mío—, porque cada uno numeró sin ver al otro.

**El guardián** —
`src/__tests__/la-alergia-estructurada-llega-a-la-compuerta.test.ts` (7 casos):
reproduce el defecto, comprueba el arreglo, verifica el TIPO, confirma que «niega
alergia a penicilina» sigue sin contar como alergia, y **comprueba el cable** en
la pantalla — porque el módulo puede estar perfecto y no correr, que es la
familia más grande del ledger.

---

## REG-215 — el paciente decía «ya lo dejé» y la lista seguía igual para siempre (v1097)

**§F3 del charter — reconciliación de medicamentos.**
`DISCREPANCIA → DUEÑO → REVISIÓN → RESOLUCIÓN → CERRADA`

**El agujero** — el paciente dice en la consulta:

> «el losartán ya lo dejé» · «la metformina me la subieron a 850» ·
> «me quitaron el losartán en el otro hospital»

Y el expediente **seguía diciendo lo de antes. Para siempre.** Porque nada
convertía «lo dejé» en un cambio de la lista.

**Por qué es seguridad y no orden** — de esa lista cuelgan el cruce de
interacciones, el cruce alergia ↔ fármaco, el motor de dosis y la receta que se
imprime. Una lista desactualizada **no es un dato viejo: es un motor de
seguridad razonando sobre un paciente que no existe.**

**Lo que NO hace, y es deliberado** — no corrige la lista solo. Abre una tarea
con dueño y la deja hasta que un humano decida. Tres razones: el paciente puede
equivocarse («ya lo dejé» dicho del genérico mientras sigue con la marca), el
reconocedor puede transcribir mal el nombre, y **suspender un anticoagulante o un
antiepiléptico es un acto médico**. Es el §C3 al pie de la letra: *no elegir la
verdad automáticamente*. La forma del dato lo garantiza — no existe ningún campo
que diga «aplicar», y hay un caso del corpus que lo comprueba.

### Los tres filtros, porque un worklist que se llena se abandona

No genera discrepancia cuando la frase habla de un **familiar** («a mi mamá le
quitaron el losartán»), cuando se dijo con **duda** («creo que ya no lo tomo» es
una pregunta para el médico, no un hecho), o cuando el médico **lo receta hoy**
—si lo tiene delante y lo prescribe, ya lo reconcilió con su criterio—.

Los tres filtros reutilizan los motores de experienciador y certeza. **Ningún
parser nuevo del mismo texto**: es la familia de defecto más cara del ledger
(ADR-001).

### Lo que costó medir, otra vez

Dos formas reales del habla se escapaban, y las dos son las **más frecuentes**:

| Se dijo | Fallaba porque |
|---|---|
| «la metformina me la subieron a **850**» | el patrón exigía unidad, y el paciente no la dice |
| «**me quitaron** el losartán» | el patrón exigía el pronombre («me **lo** quitaron») |

Seis de ocho casos a la primera. Como siempre: **medir contra frases reales, no
leer el módulo**.

**El motor de tareas ya existía y es bueno** — `tareas-clinicas/modelo.ts` tiene
los seis estados del §F, la máquina de transiciones con veredicto y el
escalamiento, y `tareasDeNota` está conectado a la consulta y a las órdenes desde
antes. **Una auditoría mía anterior lo dio por inexistente: era falso.** Esto no
construye un segundo motor — añade el tipo `reconciliacion_medicamento` al que ya
había.

**El guardián** —
`src/__tests__/corpus-oro-reconciliacion-de-medicamentos.test.ts` (20 casos),
con tres dedicados a **comprobar el cable**: que la consulta derive las tareas al
firmar, que compare contra lo vigente y no contra lo de hoy, y que la pantalla de
pendientes sepa etiquetar el tipo nuevo — porque un motor perfecto que no corre
pasa su corpus en verde igual.

---

## REG-216 — 19 diagnósticos en una nota, con el mismo cuadro tres veces (v1099)

**Reportado con captura.** Una consulta terminó con 19 diagnósticos y parejas que
son el mismo, con el **mismo CIE-10**: R59.1 tres veces, D64.9 dos, N39.0 dos.

**Las dos causas, y cuál pesaba**

1. La fusión **concatenaba** y sólo descartaba el repetido si el texto era
   idéntico letra por letra. **El código CIE-10 —que estaba ahí, y que el propio
   prompt obliga a rellenar— se ignoraba.**
2. **El multiplicador**: el pase en vivo dispara cada 15 s / 18 palabras nuevas.
   Una consulta de diez minutos son **~40 pasadas**, cada una mandando la
   transcripción entera y re-redactando los síndromes distinto. Cuarenta tandas
   sumadas. Sin esto darían 8, no 19.

**También explica los dos cuadros mezclados** (IVU recurrente + linfadenitis):
lo de una pasada anterior se quedaba y lo nuevo se le sumaba encima.

**Por qué no se arregla reemplazando** — la fusión existía por una razón buena y
documentada: reemplazar **borraba el diagnóstico que el médico había capturado a
mano** con su CIE-10. La distinción correcta no es «viejo contra nuevo»: es **lo
que puso la IA contra lo que puso el médico**.

`src/lib/expediente/fusionar-diagnosticos.ts` sustituye sólo lo de la pasada
anterior de la IA, conserva siempre lo del médico, y deduplica **por código**
cuando lo hay. Si no se sabe qué puso la IA antes, **no quita nada**: el error
caro es borrarle un diagnóstico al médico.

**Y el prompt** — regla **7-bis**: tres a seis diagnósticos, una entrada por
CIE-10, los hallazgos de laboratorio no son diagnósticos, los diferenciales van
en la prosa, y lo crónico del historial no se repite en cada consulta.

**Guardián** — `src/__tests__/los-diagnosticos-no-se-acumulan.test.ts` (15 casos),
incluida una prueba que **simula las 40 pasadas** con la IA redactando distinto
cada vez y exige que la lista no crezca.

---

## REG-217 — la nota salía hueca, y hueca se podía firmar (v1099)

**Reportado con captura.** El médico dictó la consulta entera y la nota salió con
«No especificado en esta consulta», «No referida», «No referido» en padecimiento,
exploración y plan — **con el dictado completo delante**.

### La causa: dos reglas del prompt que se contradecían

La regla **15 ORDENABA** escribir «No referido» / «No explorado en esta consulta»
en toda sección obligatoria sin contenido. La regla **1-bis lo PROHÍBE**.

El modelo obedecía a la 15. Y el guardián de contradicciones **no lo cazaba
porque esas dos frases no estaban en su lista** — la contradicción vivió meses.

Es el mismo patrón que el recuadro naranja (REG-179/180): dos reglas anulándose,
ninguna mal por su cuenta.

### El mecanismo, que es lo que lo hacía irreparable

La nota se estructura sola cada 15 s. La **primera** pasada ocurre cuando apenas
se dictó la ficha de identificación → la regla 15 rellenaba **todas** las
obligatorias con huecos escritos.

Y entonces la guarda `if (enVivo && s.value?.trim())` daba el hueco por
contenido: **ninguna pasada posterior podía corregirlo**. El médico dictaba
veinte minutos y la nota se quedaba con lo de los primeros quince segundos.

### Y lo peor

La compuerta que impide firmar sólo comprueba `!s.value.trim()`. Una sección que
dice «No referido.» **la pasa**. **La nota hueca quedaba firmable, con cédula
profesional.** Hay una prueba que conserva ese hecho para que no se pueda
certificar otra cosa.

### La reparación, en tres capas

1. **La regla 15 dice ahora lo mismo que la 1-bis**: si no se dijo nada, la
   sección va vacía. *Una sección vacía es información: dice que falta.*
2. **`seccionEsHueco` / `sinHuecoDeProsa`** en `hueco-textual.ts` — la red debajo
   del prompt, aplicada en los **dos** sitios que escriben secciones, y **antes**
   de la guarda del pase en vivo. El orden ES el arreglo.
3. **El guardián de contradicciones** ya vigila las dos frases.

**La distinción delicada, y la razón de comparar la sección entera**:

| | |
|---|---|
| «No referida.» | hueco |
| «No refiere fiebre ni disnea.» | **dato clínico** — el negativo pertinente que la regla 16 pide |

Vaciar por contención habría borrado los negativos pertinentes, que son de lo más
valioso que tiene una nota.

**Guardián** — `src/__tests__/la-nota-no-sale-hueca.test.ts` (10 casos).

---

## REG-218 — «Algo se atoró en esta pantalla» en el iPhone (v1100)

**Reportado con captura**, con el aviso de «Hay audio guardado de una sesión
anterior» justo antes.

### Alcance honesto de esta entrada

**La excepción concreta del iPhone del Dr. no se pudo leer.** Se registra en la
colección `errores` con su traza, visible en `/superadmin/errores`; la llave de
administrador vive sólo en Vercel y **descargar todos los secretos de producción
a disco para leer un mensaje no es un cambio justo por ese valor**.

Lo que sigue **no se declara como la causa de ese fallo concreto**: son huecos
confirmados leyendo el código, que **pueden producir exactamente ese síntoma** y
que son defectos por sí mismos. Se reparan por eso.

### Hueco 1 — la guarda estaba en uno de cuatro

```
setSignos(n.signosVitales ?? {})   ← con guarda
setSecciones(n.secciones)          ← SIN guarda
setDiagnosticos(n.diagnosticos)    ← SIN guarda
setMedicamentos(n.medicamentos)    ← SIN guarda
```

Alguien la puso en uno y no en los otros tres. Una nota vieja, o escrita por otro
módulo, que no traiga el campo deja el estado en `undefined` y **el siguiente
render revienta** en `.map` / `.filter`.

### Hueco 2 — `Array.isArray` valida el contenedor, no los elementos

```
if (Array.isArray(b.medicamentos)) setMedicamentos(b.medicamentos as Medicamento[])
```

Un `null` dentro del arreglo, o un elemento de un esquema anterior, **pasa entero
y truena igual** en `m.nombre.trim()`. La lista es un arreglo; el problema está
dentro. Y es el mismo momento de la sesión que el aviso de audio: los dos son
«recuperación de sesión anterior» al montar.

**La regla que sale de aquí**: *restaurar nunca debe poder tumbar la pantalla*.
Ante un elemento con forma inesperada se descarta **ese elemento** y se conserva
el resto — perder un renglón dudoso es infinitamente mejor que perder la consulta
entera con el paciente delante.

### Hueco 3 — «Reintentar» no podía funcionar para el error más probable en un celular

La consulta carga ocho piezas bajo demanda y la app tiene service worker. En un
celular con red inestable —o **justo después de un despliegue**, cuando los
archivos viejos ya no existen— esa descarga falla y React lanza en el render.

Para ese error, `reset()` vuelve a renderizar el mismo árbol y **el trozo sigue
sin estar**. El médico pulsa «Reintentar», ve lo mismo, y concluye que la
aplicación se rompió.

Ahora el boundary lo reconoce, cambia el título por «Falta bajar una parte de la
aplicación», y **el botón principal recarga** — que es lo único que trae los
archivos nuevos. Y lo registra con origen propio (`boundary:consulta:chunk`),
porque sin eso «Algo se atoró» son cinco fallos distintos bajo un mismo mensaje.

**Guardián** — `src/__tests__/restaurar-no-tumba-la-pantalla.test.ts` (12 casos).

**Lo que queda pendiente y es del dueño**: abrir `/superadmin/errores` y mirar el
campo `origen` del registro de ese día. `boundary:consulta` frente a
`boundary:consulta:chunk` parte el problema en dos por sí solo, y el `stack`
confirma cuál de los tres huecos era.

---

## REG-219 — el antibiótico de hace un mes seguía «vigente» (v1101 · §D1)

**El agujero** — un tratamiento prescrito «7 días» hace un mes seguía apareciendo
como vigente. **Para siempre**, porque nadie comparaba la duración con el
calendario.

Y de esa lista cuelgan el cruce de interacciones, el cruce alergia ↔ fármaco y el
motor de dosis. Es el daño de REG-215 **por otra puerta**: allá lo decía el
paciente, aquí lo dice el calendario. En los dos casos, **motores de seguridad
razonando sobre un paciente que no existe**.

**Lo que el charter pide, literal** — *«cuando la duración expira:
PROBABLY_COMPLETED. Pide reconciliación. NO lo marques completado en silencio.»*
La tercera frase es la que importa.

**Por qué «probablemente» y no «terminada»** — el sistema **no sabe** si el
paciente lo terminó. Sabe que la duración escrita ya pasó. Pudo suspenderlo por
un efecto adverso, alargarlo por indicación de otro médico, o no surtirlo nunca.
Marcarlo «terminada» sería que el sistema afirme un hecho clínico que nadie
comprobó.

**Lo crónico no caduca** — la metformina de un diabético no «termina» a los 30
días. Las duraciones sin término (`indefinido`, `permanente`, `de por vida`,
`hasta nueva indicación`) se reconocen y se callan: marcarlas llenaría el
worklist de tareas falsas cada mes, y un worklist que se llena se abandona.

**El margen de gracia** — el paciente rara vez empieza el mismo día: surte la
receta al día siguiente, o el lunes. Avisar el día exacto produce tareas que el
médico cierra sin mirar.

**Ante la duda, se calla** — duración incontable («hasta que se acabe el
frasco»), fecha ilegible o fecha futura devuelven «no venció». **El error caro es
decirle al médico que suspenda algo que el paciente debe seguir tomando.**

**Guardián** — `src/__tests__/la-duracion-que-ya-vencio.test.ts` (26 casos).

---

## REG-220 — un antibiótico se convertía en otro, sin un solo aviso (v1106)

**Lo que el médico dijo** — «me estás confundiendo antibióticos». Es infectólogo;
para él no hay defecto peor.

**Reproducido con el pipeline de producción**, no deducido del código:

```
«Le doy azitro micina cinco días»   →  «Le roxitromicina 5 días»
«Doy mico nazol tópico»             →  «Voriconazol tópico»
«Le doy neo micina tópica»          →  «Le lincomicina tópica»
«El paciente lleva cefa lotina…»    →  «…lleva cefazolina…»
```

Los cuatro con `violaciones: []`. **Ni una alerta.** El médico dicta un
antibiótico, en la nota aparece otro, y nada se lo dice.

**La causa** — cuando el reconocedor parte el nombre («azitro micina»), el
corrector de n-gramas prueba ventanas de tres palabras y **se traga el verbo de
delante** («doy azitro micina»). Esa unión se busca POR PARECIDO entre 6 117
términos —4 053 de ellos de un diccionario médico en inglés— y gana el más
cercano, que puede ser otro antimicrobiano.

El filtro de longitud lo empeoraba: dejaba FUERA a la azitromicina correcta
(12 caracteres fonéticos) y dejaba PASAR a la roxitromicina equivocada (13),
porque la unión con el verbo medía 15.

**Segundo mecanismo** — un antibiótico que no está en el vocabulario se sustituye
por el más parecido que sí lo está. La **cefalotina** —que se usa en México y que
este repositorio conoce en el antibiograma— salía convertida en **cefazolina
siempre**, en los cinco puntos de corte posibles.

**No había red debajo** — la clase `sustitucion_farmaco` está declarada en la
política crítica y **ninguna regla la emite jamás**. Los `PARES_PROHIBIDOS`
vigilan mg/mcg, ml/l, derecho/izquierdo, PEEP/PIP: cero pares de fármacos.

**La regla** — un antimicrobiano sólo se acepta si coincide **exacto**. No hay
distancia segura entre dos: sobre este mismo catálogo, 42 de 100 tienen un rival
dentro del umbral, y algunos a distancia 1 (vancomicina ~ lincomicina, cefazolina
~ ceftarolina). Cualquier número deja pares dentro.

Lo útil se conserva: volver a unir un nombre partido («azitro micina» →
azitromicina) coincide exacto y se acepta. **El problema nunca fue unir, fue
aproximar.**

**La lista de nombres no bastaba** — primer intento: comparar contra las listas
en español. «mico nazol» pasó de «Voriconazol» a «Oxiconazol»: seguía mal, porque
esos nombres viven en el léxico en inglés. Por eso además se miran las
TERMINACIONES, derivadas de los propios nombres del catálogo.

**Se prefiere lo visiblemente roto a lo invisiblemente cambiado** — sin
coincidencia exacta, se deja lo dictado tal cual. Un nombre partido lo ve el
médico y lo corrige; un nombre cambiado por otro fármaco real no se ve.

**Guardián** — `src/__tests__/un-antibiotico-no-se-convierte-en-otro.test.ts`
(8 casos, incluido un barrido de los 126 antimicrobianos del catálogo por cada
punto de corte: antes devolvía 118 sustituciones).

---

## REG-221 — la receta se llenaba con los antecedentes (v1106)

**Lo que el médico dijo** — «no me gusta que hagas la receta con lo que te digo
de antecedentes, la receta es cuando ya te estén diciendo el plan».

En el minuto dos se recaban antecedentes: «toma metformina y losartán desde hace
tres años». En el minuto veinte se dicta el plan. Y la receta salía con los tres.

**Dos causas distintas.**

**1 · El eje de procedencia estaba escrito y sin conectar.**
`procedenciaClinica: 'ya_lo_toma' | 'se_prescribe_hoy'` existía en el tipo, en el
esquema AUDITADO, en la regla 6-ter del prompt y en una prueba sellada (REG-183).
El modelo lo rellenaba. Pero la lista **plana** `RespuestaExtraccion.medicamentos`
—la que lee la pantalla de consulta y la que acaba en la receta— **no lo
declaraba**, y `z.object` borra las claves que no declara.

Reproducido: entra `{nombre:'losartán', dosis:'50 mg', procedenciaClinica:'ya_lo_toma'}`
y sale `{"nombre":"losartán","dosis":"50 mg","via":"","frecuencia":"","duracion":"","indicacion":""}`.

El campo nunca llegó a la pantalla. La única función que lo usaba era código
muerto — y sólo se habría poblado cuando la validación FALLA y la ruta devuelve
el objeto crudo. La ironía exacta.

**2 · La lista de medicamentos se acumulaba.** Hacía `[...previos, ...nuevos]` y
sólo descartaba el repetido si el nombre coincidía letra por letra. Con el pase
en vivo corriendo cada 15 s, lo que entró en el minuto dos no salía nunca. Los
diagnósticos recibieron este arreglo en REG-217; los medicamentos se quedaron sin
él.

**Por qué NO se deja de extraer durante la grabación** — sería la lectura literal
de «la receta es cuando ya te estén diciendo el plan», y sería una regresión: de
esa lista cuelgan el cruce alergia ↔ fármaco, el de interacciones y el motor de
dosis, que tienen que avisar MIENTRAS la consulta ocurre. Es REG-173 y REG-190
otra vez, familia «llega tarde para servir».

**Ante la duda se imprime** — sin etiqueta, el fármaco se queda en la receta.
Dejar de más un renglón que se borra de un toque es una molestia; quitar de la
receta un antibiótico que sí se prescribió es un paciente que no se lo toma.

**No se adivina por el historial** — renovar hoy lo que ya tomaba es una receta
normal. Marcarlo «previo» porque aparece en una nota anterior borraría del papel
un tratamiento recién indicado.

**Guardián** — `src/__tests__/que-va-en-la-receta.test.ts`.

---

## REG-222 — el aviso que no se imprime sí se descargaba (v1106)

**Lo que el médico preguntó** — mandó el PDF de una nota firmada con un recuadro
negro en medio («Sello de formato anterior (v3)… No cubre: metadata.hashIntegridad,
metadata.hashVersion…») y preguntó: **«esto tiene que salir a fuerzas?»**

**No.** El recuadro **ya estaba marcado** `no-print`. Al pulsar Imprimir
desaparece. Pero la regla que lo oculta vive en un `@media print`, y **descargar
el PDF no es imprimir**: html2canvas rasteriza el DOM tal como se ve, y
`@media print` no se activa nunca.

El mismo documento salía de dos maneras distintas según el botón — con jerga
interna impresa en medio de una nota clínica que se entrega o se archiva.

**Por qué no se borró el recuadro** — dice algo cierto: el sello de esa nota es de
un formato viejo y no cubre toda la nota. Esconderlo sería ocultar una limitación
real. Lo que estaba mal no era el aviso: era que este camino no miraba la marca.

Por eso el arreglo va en el **exportador**, no en el recuadro: así protege a todos
los avisos marcados, en todos los documentos, incluidos los que aún no existen.

**Guardián** — `src/__tests__/lo-que-no-se-imprime-tampoco-se-descarga.test.ts`
(5 casos).

---

## REG-223 — la portada no cabía en un teléfono (v1104)

**Medido con un navegador en un iPhone de 390 px**, no leyendo código.

**1 · El botón de registro salía cortado.** La barra pedía **417 px** donde había
390: es `flex` con `nowrap`, 24 px de relleno y botones `white-space: nowrap`, y
nada cedía. La página entera se movía de lado y «Prueba gratis →» quedaba partido
por el borde derecho.

**2 · Cuarenta y una rejillas no podían encoger.** `minmax(300px, 1fr)`: `auto-fit`
colapsa columnas vacías, pero el suelo **no baja de 300 px** ni en una pantalla de
320. `minmax(min(300px, 100%), 1fr)` es idéntico en pantalla ancha.

**3 · El texto blanco sobre el azul daba 3,28 : 1** (AA pide 4,5). Y no era un
botón: eran los 68 usos de `.btn-primary` más 26 rellenos en línea — «Procesar con
IA», «Guardar adenda», el CTA del antibiograma.

`--nexus` se había aclarado **a propósito y con razón**: como TEXTO sobre el
lienzo oscuro da 5,96. Pero el mismo token se usaba de RELLENO bajo texto blanco,
donde el requisito es el **contrario**. Un token, dos trabajos incompatibles —
familia «el sistema se contradice a sí mismo». El tema CLARO nunca lo tuvo: allí
`--nexus` ya era #2845EA. La corrección existía, aplicada a un solo tema.

`--nexus-solido` = #3D5AFE no es un color inventado: es el azul de marca del
logotipo, el que ya vivía dentro de `--nexus-soft`. Blanco encima: **5,13**.

**Guardián** — `src/__tests__/la-pantalla-cabe-en-un-telefono.test.ts` (7 casos),
que reproduce las tres cifras de contraste con la fórmula WCAG antes de creerse
ninguna otra aserción.

---

## REG-224 — la consola del dueño tenía la puerta abierta (v1105)

`/superadmin` y sus ocho secciones cuelgan **fuera** de `(dashboard)`, que es
donde vive el único guardián de sesión del proyecto — no hay `middleware.ts`.
Sólo `costos` traía su propia comprobación, copiada a mano. Las otras ocho abrían
escribiendo la dirección, sin sesión.

**Dicho sin inflarlo** — los DATOS estaban bien: las rutas `/api/superadmin/*`
verifican el token contra `verificarSuperadmin`, así que sin sesión las pantallas
salen vacías. Lo que se filtraba era el **mapa** de la consola. No son
expedientes, y es lo primero que mira quien audite esto antes de comprarlo.

**Un layout y no diez comprobaciones** — repetirla en cada página es exactamente
cómo nació el agujero. El layout cubre además las rutas que todavía no existen.

**No decide con la respuesta a medias** — mientras Firebase no conteste, la
pantalla no se pinta. Sin eso quedaría un parpadeo en el que la consola entera es
visible: el mismo agujero, más corto.

**Guardián** — `src/__tests__/la-consola-del-dueno-tiene-puerta.test.ts` (4 casos).

---

## REG-225 — la grabación se moría a los 7 min 30 s (v1107)

**Lo que el médico reportó** — «estoy grabando y pasa un tiempo y me paras en
seco y me dices que recupere el audio». Preguntado, dio los dos datos que
señalan la causa: **antes de 10 minutos**, e **igual en iPhone que en
computadora**. Que pase igual en los dos aparatos descarta el navegador.

**La aritmética**:

```
64 000 bits/s ÷ 8            = 8 000 bytes por segundo
3 600 000 bytes ÷ 8 000 B/s  = 450 s = 7 min 30 s
```

A los 7 min 30 s el audio deja de caber en el cuerpo de la petición y `detener()`
cambia al camino «grande»: subir a Storage y diarizar por URL.

**Y ese camino estaba muerto.** Para mandar la URL hay que pedirla con
`getDownloadURL()`, que es un GET de metadatos gobernado por la regla `read` de
Storage. Y la regla decía `allow read: if false`. Lanzaba `storage/unauthorized`
en el primer segundo.

**Es la MISMA causa raíz que ya se reparó en v245** para `receta-diseno`, donde
el propio `storage.rules` lo deja escrito cinco líneas más abajo: *«LECTURA por
el dueño: es OBLIGATORIA para que getDownloadURL() funcione en el navegador»*.
Aquí se olvidó porque el comentario de arriba sólo pensó en AssemblyAI —que
descarga por URL con token y no por reglas— y no en que el cliente tiene que
LEER la URL antes de poder mandársela.

**Tres daños colaterales, reparados con él:**

**1 · El motivo mentía.** El `catch` devolvía `tiempo_agotado` pasara lo que
pasara. El médico leía «se agotó el tiempo» y buscaba el problema en su
internet, cuando fue un permiso denegado en el primer segundo. Ahora hay
`sin_permiso_de_lectura` y `no_se_pudo_subir`, y el texto le dice explícitamente
que **no es su conexión**.

**2 · El texto en vivo se tiraba justo cuando era lo único que quedaba.**
`texto.trim()` era verdadero aunque fallaran TODOS los lotes, porque los
marcadores `[⚠ FALTA UN TRAMO…]` son texto. El respaldo con la transcripción en
vivo —que el médico estaba viendo en pantalla— era inalcanzable. La misma cuenta
que hizo falta para no borrar el audio (`lotesFallidos`) servía para esto.

**3 · La recuperación usaba SIEMPRE el camino roto**, sin mirar el tamaño. El
botón que se ofrece como red de seguridad estaba garantizado a degradar, en la
consulta que ya había fallado una vez. El umbral pasó a ser una constante con
nombre (`LIMITE_CUERPO_BYTES`) que usan los dos caminos.

**Guardián** — `src/__tests__/la-grabacion-larga-no-muere.test.ts` (11 casos),
que además rehace la aritmética: si alguien cambia el bitrate, la prueba avisa.

**Ojo al desplegar** — las reglas de Storage **no** se publican con
`vercel --prod`. Requieren `npx firebase deploy --only storage`.

---

## REG-226 — la primera versión congelaba el apartado (v1107)

**Lo que el médico dijo** — «no llenas los apartados como es». Y antes había
contestado que dicta **saltando de tema**: empieza por el motivo, regresa a
antecedentes a media consulta, el plan sale al final.

**La línea**:

```ts
if (enVivo && s.value?.trim()) return s      // ya escrito a mano: no se toca
```

La intención era buena —no pisar lo que el médico teclea mientras la IA corre—,
pero «ya tiene texto» **incluía lo que había escrito un pase anterior DE LA
PROPIA IA**. Y el pase en vivo corre cada 15 segundos, con el modelo rápido, y
el primero ocurre con la consulta apenas empezada.

Resultado: **la peor versión de cada apartado se quedaba fija para el resto de
la consulta**. Cuando el médico regresaba a antecedentes en el minuto diez,
ningún pase posterior podía ya corregir lo que se escribió en el minuto uno.

**La distinción correcta no es «vacío o lleno»: es quién lo escribió.** Si lo
que hay coincide con lo que la IA puso en su pase anterior, es suyo y puede
mejorarlo; si no coincide, lo cambió el médico y no se toca — que era lo que la
guarda quería proteger. Mismo criterio que ya usaban los diagnósticos (REG-217)
y los medicamentos (REG-221).

La anotación se hace **fuera** del actualizador de estado: React puede
ejecutarlo dos veces, y el registro de procedencia no puede depender de eso.

**Guardián** — `src/__tests__/la-nota-no-sale-hueca.test.ts`, ampliado con la
prohibición explícita de que vuelva la forma vieja.

---

## REG-227 — un monólogo se armaba como diálogo (v1108 · I-4)

**De dónde sale** — preguntado quién habla en la grabación, el médico marcó tres
casillas y **no** marcó una cuarta: consulta = conversación con el paciente; UCI
= él dictando por aparatos; hospital = él dictando la evolución. **No** marcó
«consulta: yo dictando solo».

O sea: en dos de los tres módulos habla **una sola persona**. Y el sistema pedía
separación de voces en los tres por igual.

**El daño, que no es sólo costo** — el texto que ve la IA se arma como un diálogo
con etiquetas. Si el reconocedor parte a UNA sola persona en dos hablantes —cosa
que hace cuando cambia el tono o hay una pausa larga—, el pase de visita sale
así:

```
Médico adscrito: el paciente lleva tres días con fiebre
Paciente: y la creatinina en uno punto ocho
```

Y a partir de ahí **el motor de negaciones y el de procedencia razonan sobre una
atribución falsa**: la diferencia entre «el paciente lo afirmó» y «el médico lo
dictó» es justo la que sostiene esas dos defensas. En un pase de visita, el
médico dictando los datos de su propio paciente se convertía en un paciente que
nunca habló.

**Dos piezas, en este orden.**

**1 · La red** (`esMonologo`) — si al final hubo un solo hablante, no se arma
diálogo: va texto plano. Funciona pase lo que pase, aunque el tipo de nota esté
mal clasificado.

**2 · El ahorro** (`esDictado`) — si el tipo de nota es de dictado, ni se pide la
separación: es trabajo, dinero y espera para nada.

**El orden importa.** Con la red puesta, equivocarse clasificando sólo cuesta una
diarización inútil. Sin ella, un tipo mal clasificado se traga la conversación
real y no hay forma de recuperarla.

**La lista de dictado es corta a propósito** — sólo `evolucion_uci` y
`evolucion`, que son las dos que él nombró. La nota de INGRESO no entra aunque
sea de hospital: un ingreso se hace interrogando al paciente, y ahí sí hay dos
voces. Ante la duda, se diariza.

**Saltarse la diarización no se anuncia como fallo** — `sinDiarizacion` se queda
en `null`: no es que fallara, es que no hacía falta. Un aviso de algo que salió
bien se aprende a ignorar, y con él los que sí importan.

**Guardián** — `src/__tests__/un-monologo-no-es-un-dialogo.test.ts` (16 casos).

---

## REG-228 — los huecos se proponen, marcados y sólo al final (v1109 · I-6)

**Lo que el médico pidió** — «dejas espacios porque la inteligencia no entendió»
· «no me gusta nada, deja dudas». Preguntado qué prefería, eligió —leyendo la
advertencia de que eso inventa contenido clínico— **«que la IA lo complete con lo
que sea probable»**.

**Cómo se hace sin que sea una falsificación** — se completa, pero **marcado y
sin entrar solo**. Una nota es un documento legal con su cédula: si dice «niega
tabaquismo» y el paciente nunca lo dijo, **eso lo afirmó él**. La diferencia
entre completar y falsificar es que lo propuesto se vea, se pueda juzgar, y entre
con un toque.

La marca `[IA — no dictado]` y su maquinaria de aceptar/quitar **ya existían**,
pero sólo servían para completar el PLAN. Lo que faltaba era extenderlas a los
apartados vacíos, y las dos fronteras que lo hacen seguro.

**Frontera 1 · SÓLO EN EL PASE FINAL.** La nota se estructura sola cada 15
segundos y la primera pasada ocurre cuando apenas se dictó la ficha de
identificación. Con la propuesta activa ahí, esa pasada rellenaría la consulta
entera antes de que el médico dijera una palabra clínica. **Eso ya pasó** con la
regla vieja que escribía «No referido» en todo (REG-217), y fue el defecto más
caro de aquella noche. Durante la consulta, un apartado vacío sigue diciendo lo
que dice: que falta.

Se ata a `rapido`, que es lo que ya distinguía el pase en vivo del final:
`proponerHuecos: !rapido`.

**Frontera 2 · NINGUNA CIFRA.** Una sección propuesta se lee, se juzga y se
acepta o se borra. Una **cifra** propuesta —una tensión, un peso, una
creatinina— **se lee exactamente igual que una medida real**, y a partir de ahí
nadie puede distinguirlas. Si un apartado sólo se podría llenar con cifras, se
queda vacío. Está escrito dos veces —en la regla 15-bis y en el bloque— a
propósito: es la frontera entre completar y falsificar.

**La regla es condicional, no contradictoria** — la 15-bis vive siempre en el
prompt y declara que sólo se activa con el bloque presente. Así el modelo no ve
dos reglas que se anulan, que es la familia de defecto más grande de este
repositorio.

**Guardián** — `src/__tests__/los-huecos-se-proponen-marcados.test.ts` (15 casos).
**Versión de prompt** — `nota-2026-08-07-3`.

---

## REG-229 — lo revisado no era lo que se firma (v1110 · I-8)

**Lo que el médico pidió** — preguntado qué le haría confiar en la nota **sin
releerla entera**, eligió «que un segundo modelo la revise».

**Y ya existía. Ése era el problema.** La segunda opinión lleva tiempo
corriendo: otro modelo compara la nota contra el dictado y devuelve hallazgos de
seguridad, sola al terminar el pase de IA.

Pero después de eso **el médico edita**: corrige un apartado, cambia una dosis,
acepta las líneas propuestas, quita un diagnóstico. Y el panel seguía diciendo,
**en verde**, «sin observaciones de seguridad» — de una versión del texto que ya
no existe.

Un sello de revisión sobre un texto que cambió no es una garantía: es una
garantía caducada que **se lee igual que una vigente**. Es peor que no tenerla,
porque invita a no releer — que es exactamente para lo que él la quería.

**La pieza que faltaba** — una huella estable de lo que se revisó, para poder
comparar. `lib/expediente/lo-que-se-reviso.ts`:
- `huellaRevisable()` sobre resumen, apartados, diagnósticos y medicamentos.
- Se **ordena antes de medir**: reordenar la lista no puede caducar una revisión
  válida. (Un hash sobre `JSON.stringify` cambia cuando Firestore reordena las
  llaves — eso ya costó un banner de «INTEGRIDAD NO VERIFICADA» que era falso.)
- Separador de campo entre valores: sin él, «ab»+«c» y «a»+«bc» colisionan.
- Una sección VACÍA no cuenta: no se revisó, así que su presencia no caduca nada.

**La huella es de lo que SE MANDÓ, no de lo que hay al volver** — entre que sale
la petición y regresa, el médico puede teclear. Medir al volver marcaría como
caducada una revisión que sí cubrió lo que se mandó.

**No bloquea la firma.** Bloquear por una revisión caducada convertiría cada coma
corregida en un trámite, y el médico aprendería a esquivarlo. Lo que faltaba no
era una compuerta más: era **poder decir la verdad**. Al firmar se dice, con la
opción de firmar así.

**Guardián** — `src/__tests__/lo-revisado-es-lo-que-se-firma.test.ts` (18 casos).

---

## REG-230 — la nota de otra especialidad salía genérica en silencio (v1111 · I-5)

**Lo que el médico pidió** — «nota como **internista, pediatra, ginecólogo,
cirujano, intensivista, infectólogo** etcétera según sea el caso», y «como la
escribe un internista: **prosa que razona**».

Y contestó dos cosas que cambian el ALCANCE del producto: lo van a usar **médicos
de cualquier especialidad**, y **cada especialista valida su propia rama al
usarla**.

**Lo que había** — dieciséis guías dentro de `prompts.ts`, en medio de un archivo
de 800 líneas. Mientras la app era para un internista-infectólogo, bastaba. Deja
de bastar en cuanto la usa un pediatra: **su criterio no puede vivir en una
constante que sólo se cambia recompilando**.

**El defecto de verdad era el silencio** — `guiaEspecialidad()` devolvía cadena
vacía cuando no encontraba la rama. Un reumatólogo, un geriatra, un neumólogo
pediatra recibía una nota redactada **con criterio genérico y sin que nadie se lo
dijera**. Un genérico silencioso es la peor de las tres opciones: no es la nota
de su especialidad, y encima parece que sí. Ahora la ruta lo reporta.

**La mudanza no podía cambiar nada, y se comprobó ANTES de tocar** — para las
dieciséis especialidades y para una desconocida, el prompt resultante es
**idéntico byte a byte** al de antes. Mover criterio clínico de sitio y que
cambie de comportamiento sería el peor refactor posible.

**Un defecto que encontró su propia prueba** — la primera versión del buscador
devolvía la primera coincidencia del arreglo, y con eso **«Infectología
pediátrica» caía en PEDIATRÍA**: sólo porque `pediatr` estaba antes que
`infectolog` en la lista. En español el núcleo del nombre va primero
(«Cirugía pediátrica» es cirugía), así que gana **la raíz que aparece antes en el
texto**, no el orden de la lista.

**La del médico manda sobre la del repositorio** — es lo que exige su respuesta
«el médico de esa especialidad valida al usarla»: si un pediatra corrige la guía
de pediatría, gana la suya. Y puede añadir una rama que no existía.

**La prosa que razona** — regla 14-bis: el análisis CONECTA hallazgo → síndrome →
diagnóstico → plan, diciendo por qué; cada indicación va atada a lo que la
justifica. Y **no afloja la prohibición de inventar**: razonar no es rellenar.

**El límite, y es duro** — aquí no se redacta criterio clínico de ramas que el
dueño no ejerce. Las dieciséis están porque ya estaban.

**Guardián** — `src/__tests__/la-nota-la-escribe-un-especialista.test.ts`
(19 casos), incluido uno que falla si el menú ofrece una especialidad sin guía.
**Versión de prompt** — `nota-2026-08-07-4`.

---

## REG-231 — menos pasos para cerrar la consulta (v1112 · I-7)

**Lo que el médico pidió** — «que sea más fácil, **con menos pasos**» · «que no
tenga tantas maneras de confundirse». Y en las doce preguntas: consentimiento
**una vez por paciente**, firma **con el paciente enfrente**.

**Dos pasos que desaparecen de cada consulta.**

**1 · El consentimiento moría al cerrar la pantalla.** Vivía en un `useState`, así
que el modal salía en CADA consulta del mismo paciente — un paso repetido cien
veces al mes, y encima sin nada que exhibir ante una queja salvo el registro de
auditoría. Ahora queda **en el expediente**, con quién lo recabó y cuándo, que es
donde un consentimiento tiene sentido. Ausente = nunca se pidió: **no se da por
otorgado por omisión jamás**. Si el guardado falla, la grabación no se cae — se
volverá a pedir, que es el lado seguro del error.

**2 · Los avisos rojos ya no tapan la nota desde el minuto uno.** La barra se
pintaba **por encima** de los signos vitales, las secciones narrativas, los
diagnósticos y los medicamentos: lo primero que veía al abrir la consulta era la
lista de lo que está mal en una nota que todavía no había dictado.

**Pero no se mueve entera, y eso es lo importante.** Cinco de esos avisos son de
PRESCRIPCIÓN —alergia ↔ fármaco, sobredosis, dosis incompleta, interacción, vía
asumida— y tienen que llegar **mientras receta**: después de firmar, la receta ya
se imprimió. Llevarlos al final es exactamente el defecto que este repositorio ya
reparó **dos veces** (REG-173 y REG-190, familia «llega tarde para servir»), y no
se reintroduce por comodidad visual.

Los de REVISIÓN DEL TEXTO —contradicción, dato incierto, antecedente del
familiar, requisito NOM— no cambian lo que se le da al paciente: cambian lo que
se lee antes de firmar. Ése es su momento.

**Sin inventar una clasificación nueva** — cada aviso ya traía `ancla.seccion`
para saber a dónde lleva su botón. Ese campo ya distinguía lo que hacía falta;
nadie lo usaba para decidir *cuándo*. No hay lista nueva que mantener: un aviso
futuro anclado a medicamentos aparece durante la consulta sin que nadie lo apunte.

**Ante la duda, durante la consulta** — un aviso sin ancla se trata como de
prescripción. Uno que llega pronto de más estorba; uno que llega tarde no
protege, y las dos molestias no cuestan lo mismo.

**Sigue habiendo UN solo panel montado** — partir la barra no podía convertirse en
dos recuadros: la nota se llenaría de cajas, que es el defecto que la barra vino
a cerrar.

**Guardián** — `src/__tests__/menos-pasos-para-cerrar-la-consulta.test.ts`
(19 casos).

---

## REG-232 — los alérgenos se tiraban en el último metro (v1113 · I-9)

**Lo que el médico pidió** — «necesito **mejor precisión, con el audio, mejor
inteligencia artificial**».

**El hallazgo** — el vocabulario que se le manda al reconocedor cabe en **224
tokens**, y el orden en que se gasta ese presupuesto ES la política: lo más
específico primero.

La pantalla ya calculaba los alérgenos del expediente. El grabador ya los mandaba
por la red, **con un comentario largo explicando por qué son la pista de más
valor que existe**. Y la ruta de transcripción leía `medicamentos`, `problemas`,
`aprendidas` y `especialidades` del formulario — **y no `alergias`**. El
constructor del vocabulario ni siquiera tenía un campo para ellos.

Escrito, probado, viajando por la red, y sin conectar en el último salto.

**Por qué este campo importa más que los otros** — no porque sea más frecuente:
por lo que cuesta oírlo mal. El cruce alergia ↔ fármaco compara contra **lo que
se oyó**. Un alérgeno mal transcrito es **un cruce que nunca salta**, y nadie se
entera: la nota no enseña un hueco, enseña una palabra parecida y el guardián
calla. Un fármaco mal oído sale impreso en la receta y el médico lo ve.

Por eso van **antes que los fármacos**, y sólo detrás de lo aprendido —lo único
que se ganó con evidencia real de este médico.

**Medido**: con tres alérgenos declarados, los tres entran en las tres primeras
posiciones del vocabulario. Antes no entraba ninguno.

**Una mejora que se midió y se DESCARTÓ** — en la misma iteración se probó poner
lo crítico de su especialidad por delante de lo crítico de las demás. Parecía
obvio. Medido: **idéntico** —68 términos, 35 de su rama, antes y después—, porque
`criticosGlobales()` es la unión de las 79 y lo suyo ya venía dentro.

Se revirtió, y quedó anotado en el código para que nadie lo reintente creyendo
que gana algo. Dejar el cambio con un comentario prometiendo una mejora medida en
cero habría sido peor que no hacerlo.

**Guardián** — `src/__tests__/los-alergenos-llegan-al-reconocedor.test.ts`
(11 casos), que comprueba el camino ENTERO: pantalla → grabador → ruta → módulo.

**Lo que NO cierra esta iteración** — la cifra de error (25,55 % crudo / 22,81 %
pipeline) sigue siendo la de REG-159. Volver a medirla exige dictado real del
médico; sin cifra nueva, **no se declara mejorada**.

---

## REG-233 — lo que el navegador vio (v1114 · I-13)

Barrido de las **catorce pantallas públicas** con un iPhone emulado. Ninguno de
los tres hallazgos era visible desde el código.

**1 · Mi propio guardián era demasiado estrecho.** En v1104 se reparó el
contraste de los rellenos azules con texto blanco (3,28 : 1; AA pide 4,5) y se
dejó una prueba. La prueba buscaba la cadena **exacta**
`background: 'var(--nexus)'`.

El barrido encontró el mismo 3,28 en **siete pantallas más**, escrito de otras
tres maneras que la prueba no miraba:

```
background: 'var(--nexus, #3d5afe)'    ← con valor de respaldo
background: 'var(--nexus,#3d5afe)'     ← sin espacio
background: 'var(--teal)'              ← el alias de retro-compatibilidad
```

La lección no es que faltaran sitios: es que **el guardián era tan estrecho como
el barrido que lo escribió**. Una prueba que sólo comprueba la forma que uno
arregló no protege de la forma que uno no vio. Ahora la comprobación es por
patrón. 15 líneas corregidas.

**2 · Unas pestañas que no cabían.** En `/demo/interactivo`, cinco pestañas en
una fila `flex` sin `wrap` pedían **425 px en una pantalla de 390**. La página
entera se movía de lado — en la pantalla que existe para enseñarle el producto a
alguien que lo está evaluando.

**3 · Las etiquetas estaban puestas y no servían.** En `/login` y `/registro` los
campos tenían su `<label>` visible encima —«Correo electrónico», «Contraseña»—
pero **sin asociar**: ni `htmlFor`, ni `id`, ni `aria-label`. Un lector de
pantalla dice «edición de texto» y ya. Y el botón de mostrar/ocultar la
contraseña no tenía nombre: «botón».

Es el peor tipo de defecto de accesibilidad, porque **parece resuelto**: mirando
la pantalla se ve una etiqueta; mirando el árbol accesible no hay ninguna.

**Lo que este barrido NO cubrió** — sólo lo público, catorce pantallas sin
sesión. La consulta, la UCI y el hospital —donde vive el trabajo— no se
barrieron: hacen falta credenciales. Un barrido que no dice qué no miró se lee
como si lo hubiera mirado todo.

**Guardián** — `src/__tests__/lo-que-el-navegador-vio.test.ts` (11 casos).

---

## REG-234 — el espejo del contraste, en tema claro (v1116 · I-13)

Terminando el barrido de I-13 se probó lo que nunca se había probado: **el tema
claro**, y el **escritorio**.

El escritorio salió limpio en las catorce pantallas. El tema claro no.

**Por qué nunca se había visto** — el tema por omisión es OSCURO, por identidad
de marca, y el claro **sólo se activa si el médico lo elige** (documentado en
`layout.tsx`). Un barrido que emula la preferencia del sistema no lo alcanza: hay
que ponerlo a mano. Por eso llevaba ahí desde siempre.

**El defecto, medido**:

```
NEGRO sobre #6E84FE (tema oscuro):  6,39   ✓
NEGRO sobre #2845EA (tema CLARO):   3,13   ✗   ← el mínimo es 4,5
BLANCO sobre #3D5AFE (sólido oscuro): 5,13 ✓
BLANCO sobre #2845EA (sólido claro):  6,71 ✓
```

`--nexus` **cambia de brillo con el tema**. Un color de texto FIJO encima —negro—
funciona en uno y reprueba en el otro. Es exactamente la misma familia que el
defecto original (REG-223), por el otro lado: allí era blanco sobre el claro,
aquí es negro sobre el oscuro.

El azul SÓLIDO con blanco pasa en los DOS temas, y por eso es el único relleno
correcto.

**32 sitios en 25 archivos.** El navegador sólo podía ver dos —la insignia «MÁS
POPULAR» de la portada y el botón de registro—; los otros treinta viven detrás
del login, donde el barrido no entra. **La prueba es lo único que los cubre**, y
por eso vale más que el barrido que la originó.

**Guardián** — ampliado en `lo-que-el-navegador-vio.test.ts`: ahora prohíbe el
relleno azul con texto blanco **y con texto negro**, en cualquier forma
sintáctica.

---

## REG-235 — veinte campos sin etiqueta, DETRÁS del login (v1117 · I-13)

**Cómo se encontraron** — el médico dueño señaló que su sesión de Chrome estaba
abierta y preguntó por qué no se probaba ahí. Tenía razón: era la herramienta
correcta y el barrido anterior se había quedado en lo público por no usarla.

**La regla que se puso al usarla** — medir con **cifras y selectores**, nunca con
capturas ni con `innerText`. Una auditoría de diseño no necesita ver el nombre de
un paciente, y traerlo a la conversación sería PHI que no hace falta.

**Lo medido, con sesión abierta**:

| Pantalla | Campos sin etiqueta asociada |
|---|---:|
| `/configuracion` | 15 |
| `/antibiograma` | 2 |
| `/citas` | 2 (+1 botón sin nombre) |
| `/pacientes` | 1 |

Tablero, UCI y hospitalización: limpios en contraste, nombres y etiquetas.

**Por qué el grep del código NO servía** — buscando en el fuente salían **371**
campos «sin etiqueta». El navegador encontró **veinte**. La diferencia son los
que van envueltos en su `<label>`, que es una asociación válida y que ninguna
expresión regular razonable distingue.

Es la lección de la iteración: **manda la medición, no el grep**. Actuar sobre
los 371 habría sido tocar 350 sitios que ya estaban bien.

**Lo que se arregló** — 18 campos de configuración con `htmlFor`/`id` derivados
de su propia etiqueta visible, el organismo del antibiograma, y los dos
buscadores con `aria-label` (no tienen etiqueta visible, y ponerles una sería
cambiar el diseño para arreglar la accesibilidad, cuando `aria-label` lo resuelve
sin tocar la pantalla).

**Lo que sigue sin barrerse** — el ancho de TELÉFONO en las pantallas internas.
Redimensionar la ventana de Chrome no cambia el viewport que ven las
media-queries, así que el desborde móvil de la consulta, la UCI y el hospital
**no está medido**. Contraste, nombres y etiquetas sí lo están: no dependen del
ancho.

---

## REG-236 — la maqueta se enseñó y sólo se construyó la mitad (v1119)

**Lo que el médico dijo** — mandó la captura de la maqueta que se le había
enseñado y escribió: **«¿y por qué no se ve así? no has desplegado»**.

Tenía razón. La maqueta tenía dos mitades:
- Arriba, los diez botones de tipo de nota reducidos a **una línea**. Se
  construyó y se desplegó (`QueNotaEs`, v1102). En sus capturas del iPhone se ve.
- Abajo, un **botón grande y centrado** para grabar. **Se quedó en dibujo.**

Enseñar un diseño y entregar la mitad es peor que no enseñarlo: él se quedó
esperando algo que nunca salió, y lo notó él, no yo.

**Lo que había antes de poder hablar**, contado sobre su captura:

1. «Modo: Conversación completa (médico + paciente) — se graba y separa…»
2. Un botón «Manos libres OFF»
3. El micrófono, a un lado
4. Un título: «Grabar la conversación completa (médico + paciente)»
5. Una descripción: «Capta a los dos · separación de voces con AssemblyAI…»
6. Un «Procesar con IA», apagado

**Seis cosas para pulsar una. Y tres decían lo mismo con distintas palabras.**

**Lo que queda** — el botón (96 px, centrado) y una línea. Nada se borra: la fila
entera vuelve **en cuanto hay algo grabado**, que es cuando pausar, cancelar y
procesar significan algo. Lo que cambia no es qué existe: es **cuándo aparece**.

**Los 96 px no son decoración** — es lo único que se pulsa con el paciente ya
sentado enfrente, muchas veces al día y a veces sin mirar.

**Guardián** — `src/__tests__/la-maqueta-se-construyo-entera.test.ts`.

---

## REG-237 — los botones flotantes tapaban los campos (v1119)

**Cómo se encontró** — el médico mandó tres capturas de la consulta en su iPhone.
En una, el botón de ayuda estaba **encima del campo Peso**; en otra, **encima de
Exploración física**.

**Por qué ningún barrido lo cazó** — el instrumento no lo buscaba. El medidor de
las catorce pantallas hacía dos cosas que juntas lo volvían ciego:

1. **Saltaba los elementos `position: fixed`** al buscar desbordes — con razón:
   un elemento fijo nunca «desborda», está anclado a la ventana.
2. **No comprobaba si un elemento TAPA a otro.** Medía contraste, tamaño de
   toque, etiquetas y desborde. Encimarse no estaba en la lista.

Un hueco del instrumento, no del producto: **una auditoría sólo encuentra lo que
sabe buscar**.

**No se arregla moviéndolos** — con `position: fixed` y `right: 16px`, en 390 px
el botón cae siempre dentro de la columna del formulario, y reservarle margen le
robaría ancho a la nota. La solución es de MOMENTO, no de sitio: mientras un
campo tiene el foco, se apartan; vuelven al soltar.

Con `:has()` y sin JavaScript: cero escuchadores que quitar, cero estado que se
quede pegado. Donde no exista, la regla no aplica y queda el comportamiento de
hoy — el peor caso, no el único.

**Guardián** — `src/__tests__/nada-tapa-un-campo-que-se-llena.test.ts` (6 casos).

## REG-238 — «14 editas» y «24 tras»: nadie comprobaba la forma de una pauta (v1120)

**Cómo se encontró.** El médico dueño mandó la captura de una nota **suya, ya
firmada**, con su cédula. En el plan de tratamiento:

> «Moxifloxacino 400 mg vo cada 24 horas por 14 **editas**»

Y unas líneas más abajo, el mismo fármaco en el plan farmacológico:

> «Moxifloxacino tabletas 400 mg · oral · **24 tras** · 14 días»

`14 editas` por `14 días`. `24 tras` por `24 horas`. La **duración y la
frecuencia de un antibiótico**, en un documento firmado.

**Qué se descartó midiendo.** Se le pasó al corrector léxico el texto limpio y
el partido —«por 14 di as», «cada 24 ho ras», «cada 24 hrs», «por 14 d»— y no
corrompe ninguno; tampoco produce «editas» ni «tras», que no están en su
vocabulario. El corrector quedó descartado **con la medición, no leyendo**.

**La huella que dice de dónde vino.** Los dos sitios se rompieron **distinto**:
la prosa perdió los días y conservó las horas; la lista estructurada perdió las
horas y conservó los días. Un corrector sustituye igual en todas partes; esto
no. Viene del reconocedor o del modelo al rellenar los campos.

**La causa raíz.** No había **ninguna** comprobación de la FORMA de una pauta.
`revisarUnidadDosis` exige cifra y unidad en la DOSIS (REG-173) —por eso «400
mg» estaba bien—, pero frecuencia y duración aceptaban cualquier cadena.

Y peor: la aplicación **ya sabía** que «14 editas» no es una duración.
`diasDeDuracion()` devuelve `null` para eso desde hace versiones. **Nadie se lo
preguntaba.** Familia `no_conectado`.

**El arreglo.** `src/lib/seguridad/forma-de-la-pauta.ts`, módulo puro:
`esFrecuenciaReconocible()` y `esDuracionReconocible()` miran la forma de lo
escrito; el segundo se apoya en el `diasDeDuracion()` que ya existía. Nuevo
origen de aviso `pauta_deformada`, nivel **`revisa`** y ancla en
`medicamentos`, para que salga **mientras receta** y no al firmar (REG-173,
REG-190). Conectado en `page.tsx` con `pautas: medicamentos`.

**Lo que NO hace, y es la decisión importante.** No propone el valor correcto.
Dice ««24 tras» no se entiende como una frecuencia»; **no** dice «debería ser
cada 24 horas». Lo primero es un hecho comprobable; lo segundo sería inventar
una pauta clínica.

**Guardián.** `src/__tests__/una-frecuencia-tiene-forma-de-frecuencia.test.ts`
— 55 casos con su caso real como fixture, incluida una prueba que falla si
algún mensaje llega a proponer el valor «correcto».

## REG-239 — el «Linked Evidence» estaba escrito y sin conectar (v1121)

**De dónde salió.** De la investigación del mercado (7-ago-2026, I-12). Dos
datos publicados que juntos mandan qué construir:

- Sobre **62 811 pares borrador→nota final** en la Universidad de California,
  los médicos borraron **216 199 oraciones** e insertaron 165 939. El borrador
  de IA no se firma: se reescribe.
- Y se reescribe para **añadir cautela** — 3 440 secciones hacia más
  incertidumbre contra 2 516 hacia más certeza (Wilcoxon, p < 0,001). Los
  borradores afirman de más.

De los tres productos que dominan el mercado, **sólo Abridge** tiene un
mecanismo contra eso: *Linked Evidence* — subrayas una frase de la nota y ves
el fragmento del que salió. **Suki no publica ninguno**, y **Nabla borra el
audio original** (AP, oct-2024), con lo cual estructuralmente no puede tenerlo.

**El defecto.** `rastrearNota()` en `lib/expediente/trazabilidad.ts` ya devolvía
exactamente eso —cada frase de la nota con el fragmento del dictado que la
sostiene y sus posiciones— y tiene corpus oro desde hace versiones.

La consulta importaba **sólo `afirmacionesSinRespaldo`**: la mitad negativa. La
mitad que contesta la pregunta que el médico se hace de verdad —«¿de dónde sacó
la IA esto?»— no llegaba a ninguna pantalla. Familia `no_conectado`, la número
uno de este sistema.

**El arreglo.** `src/components/DeDondeSalioEsto.tsx`, montado en la consulta
con **el mismo `textoDeLaNota(...)` que se firma** —trazar otro texto sería
comprobar algo que nadie lee— y `voz.transcripcion` como fuente.

**Decisiones, y por qué.** Empieza **cerrado**: un panel abierto delante de una
nota correcta es el ruido del que ya se quejó. **No puntúa** la nota con un
porcentaje: un «94 % respaldada» invita a firmar por el número en vez de por las
tres frases en rojo. Y **no dice que una frase sin respaldo sea falsa** — puede
venir del expediente o de una exploración no narrada en voz alta; lo que dice es
que el dictado no la sostiene.

**Un defecto propio, cazado en el camino.** La primera versión usaba los tokens
`--ok`, `--warn` y `--danger`. **Ninguno de los tres existe** en `globals.css`;
los reales son `--green`, `--amber` y `--red`. Un token inexistente no truena:
pinta transparente. Se cazó mirando el archivo, no ejecutando — y quedó una
prueba que lo comprueba.

**Guardián.** `src/__tests__/de-donde-salio-esto-se-ve.test.ts`, 18 casos.

## REG-240 — una reescritura podía llevarse una cifra por delante (v1122)

**El hueco.** El editor por chat ya existía y **ya estaba conectado**: el médico
escribe «la dosis es 500 mg» o «haz esto más conciso» y el modelo devuelve la
nota reescrita. Lo que no existía es nada que comprobara **qué se llevó por
delante**.

Pedirle «más conciso» a un modelo, sobre un plan de tratamiento, puede hacer que
desaparezca «cada 8 horas» o que «400 mg» quede en «400». **El texto sigue
leyéndose bien** — ésa es exactamente la trampa. Familia `sin_medir`: no faltaba
el producto, faltaba el instrumento.

**Por qué no es paranoia.** Está medido: sobre 62 811 pares borrador→nota final
en la Universidad de California (AMIA 2026), los médicos **eliminaron 216 199
oraciones** y reemplazaron 52 542. Un modelo que reescribe texto clínico cambia
mucho más de lo que se le pidió.

**La regla, y hubo que afinarla.** Toda cifra con unidad sobrevive salvo que la
INSTRUCCIÓN la autorice. La primera versión sólo dejaba pasar la cifra literal —
y con «la dosis es 500 mg» denunciaba que 400 mg desapareciera, **que es justo
lo que el médico acababa de pedir**. Corregir una dosis es sustituirla.

Afinado: se autoriza **por unidad**. Nombrar un `mg` autoriza los `mg`; no
autoriza tocar las `horas` ni los `días`. Y «hazlo más conciso» no nombra
ninguna unidad, así que no autoriza nada.

**Lo que no hace.** No repara el texto. No vuelve a meter la cifra caída — eso
sería reescribir una nota clínica por cuenta propia. Dice qué se perdió, con las
cifras literales («ya no aparecen: 24horas, 14dias»), en el mismo chat donde él
pidió el cambio, y deja que decida: aceptar, deshacer o reformular.

**Guardián.** `src/__tests__/la-reescritura-no-pierde-cifras.test.ts`, 17 casos.

## REG-241 — el tablero del loop mentía sobre la versión, tres veces (v1122)

**Los hechos.** `agent-state/MASTER_STATE.json` es la memoria del programa: de
ahí arranca la siguiente sesión.

- Dijo v1030 con producción en v1079. Se puso al día.
- Dijo v1084 con producción en v1096. Se puso al día.
- Dijo v1096 con producción en **v1121**.

**Lo peor no es el desfase.** Es que el propio archivo ya tenía escrito el
diagnóstico correcto después de la segunda vez:

> «La causa no es descuido: es que actualizarlo depende de que yo me acuerde.
> Mientras no lo derive un script, va a volver a pasar.»

Escribir el diagnóstico correcto y no actuar sobre él es peor que no haberlo
escrito: deja constancia de que se sabía.

**Por qué importa.** El charter V7 exige que el programa sea reanudable, y el
médico dueño lo pidió con esas palabras: «si se acaban los tokens guarda el
avance y cuando te ponga 1 sigue donde te quedaste». Un tablero que dice v1096
cuando hay v1121 hace que la siguiente sesión rehaga trabajo hecho — o lo dé por
pendiente y lo pise.

**El arreglo.** `scripts/agent-state/actualizar.mjs` **deriva** del repositorio
la versión (`public/version.txt`), la última REG (el ledger), el conteo de
pruebas (el mismo regex que el sello clínico, para que no haya dos cifras de lo
mismo) y la rama. Lo que es criterio —iteración en curso, bloqueos, decisiones
del dueño— sigue escribiéndose a mano: eso no sale de un `grep`.

**Guardián.** `src/__tests__/el-tablero-del-loop-no-miente.test.ts` falla si el
tablero se desfasa, y el script tiene modo `--verificar` para una compuerta.

**Y un defecto propio, cazado al escribir el guardián.** El primer regex de
conteo era `^## REG-(\d+)`: sólo veía el primer número de la línea. Existe una
cabecera combinada —`## REG-179 / REG-180`, porque las dos salieron del mismo
recuadro naranja—, así que el script informó de **88 REG cuando eran 89** y
denunció un REG-180 «clasificado pero inexistente» que sí existía.

Se arregló leyendo todos los `REG-\d+` del encabezado, y se añadió la
comprobación en el sentido contrario —que ningún número clasificado sea humo—,
que es la que no existía y habría cazado esto sola.

**Familia NUEVA: `depende_de_recordar`.** Ninguna de las trece anteriores lo
describía. El dato correcto existe en el repositorio y un segundo sitio lo
repite a mano; el segundo se desfasa siempre, y como tiene forma de registro
oficial se le cree más que a la fuente. **La reparación nunca es volver a
copiarlo bien: es derivarlo, y poner una compuerta que falle cuando se separen.**

## REG-242 — el paciente salía sin nada escrito (v1123)

**No es un defecto.** No había nada roto. Es una función que los productos de
referencia dan por supuesta y que aquí **nunca existió** — por eso ninguna
prueba interna podía delatarla. Familia NUEVA: `hueco_frente_al_mercado`.

**Cómo se encontró.** Comparando (I-12). Suki tiene instrucciones para el
paciente «a nivel de lectura de quinto grado, en 80 idiomas». Nabla también — y
son lo **único** que traduce al idioma del paciente, porque la nota clínica la
deja en inglés «per U.S. regulations». Aquí el paciente salía del consultorio
con una receta y con lo que hubiera retenido de la conversación.

**La decisión que separa esto de lo suyo.** Ellos las **generan** con un modelo.
Aquí se **componen**.

Un modelo que redacta instrucciones puede añadir «tome mucha agua» o «si empeora
acuda a urgencias». En un papel que sale con el membrete y la cédula del médico,
eso es **una indicación médica que nadie firmó**. Cada línea de esta hoja sale de
un campo que él ya revisó: fármaco, dosis, vía, frecuencia, duración, estudio,
cita.

**Lo que sí se permite, y por qué es seguro.** Traducir «vía oral» a «por la
boca» es la misma indicación en las palabras del paciente. Convertir «cada 8
horas» en «cada 8 horas (3 veces al día)» es 24 ÷ 8, aritmética exacta sobre lo
dictado — y **sólo cuando el resultado es exacto**: «cada 5 horas» no son «4,8
veces al día», y redondearlo sí sería inventarle una pauta al médico.

**La compuerta cazó su propia función, y eso la mejoró.** La primera versión de
la prueba exigía que ninguna cifra de la hoja faltara en la nota, y **falló con
«3 veces»** — que es 24 ÷ 8. Perdonar la unidad «veces» sin más habría abierto
un boquete. Lo que se comprueba ahora es más estrecho: que el número sea
exactamente 24 dividido entre unas horas que sí están en la nota. Si alguien
«mejora» la función y empieza a redondear, la prueba falla.

Y se comprueba el sentido contrario: **ninguna cifra de la nota se pierde** en la
hoja. Una hoja que se come la duración manda al paciente a casa sin saber
cuántos días toma el antibiótico.

**Guardián.** `src/__tests__/lo-que-se-lleva-el-paciente.test.ts`, 18 casos.

## REG-243 — el plan no decía qué era de qué (v1124)

**Tampoco es un defecto**: familia `hueco_frente_al_mercado`. Suki lo llama
*problem-based charting* — cada problema con su código y debajo el plan de ESE
problema. Aquí la nota tenía una lista de diagnósticos y otra de medicamentos,
sin relación entre ellas. Con dos problemas y cinco fármacos, quién era de quién
quedaba en la cabeza del médico, y en la del que lea la nota después, que no
estuvo.

**La línea que no se cruza, y es todo el diseño.** Inferir sería fácil:
«moxifloxacino es antibiótico, hay una neumonía, luego es de la neumonía». Eso
es razonamiento clínico. Con **dos infecciones simultáneas** acierta por suerte
— y el error se lee exactamente igual que el acierto.

Se ata **sólo lo que el médico dijo**, en el mismo tramo del dictado, y se
enseña la frase que lo prueba. Lo demás queda **sin asignar**, a la vista, con
una línea que explica que no consta en el dictado y que eso no lo vuelve un
error.

**Por qué el dictado y no la nota.** La nota es prosa reordenada por el modelo:
ahí el fármaco y el diagnóstico pueden acabar en el mismo párrafo sin que nadie
los relacionara nunca. El dictado es lo que se dijo, en el orden en que se dijo.

**Dos salvaguardas más.** Una palabra corta compartida no basta para atar
—«aguda» aparece en muchos diagnósticos, y atar por eso colgaría el fármaco del
problema equivocado con toda la apariencia de estar bien—; y el panel **no
ofrece dónde editar**: el sitio donde se corrige un plan es el plan, y un
segundo lugar donde editar lo mismo separa las dos versiones.

Reutiliza `segmentar()` de `trazabilidad.ts`: dos formas de trocear el dictado
darían dos verdades distintas.

**Guardián.** `src/__tests__/que-es-de-que.test.ts`, 16 casos.

## REG-244 — con receta Y estudios, la orden no se imprimía nunca (v1125)

**El defecto.** Al firmar, la consulta elegía **un** destino:

- con medicamentos → la receta
- sin medicamentos, con estudios → la orden
- ninguno → el expediente

Con medicamentos **y** estudios —media consulta de medicina interna— iba a la
receta y **la orden se quedaba sin imprimir**. El paciente salía con su receta y
sin su solicitud de estudios, y **todo se veía correcto**: nota firmada, cita
marcada como atendida, ningún aviso. Familia `no_conectado`: la ruta de la orden
existe, funciona y tiene pruebas — simplemente no corría en el camino que el
médico recorre.

**Lo incómodo.** El comentario del propio código ya avisaba de la mitad —«antes
solo ramificaba a receta y la orden se quedaba en el tintero»— y lo arregló para
el caso «sin medicamentos». El caso «con los dos» siguió igual.

**Y estaba duplicado.** La misma cadena de `if` vivía otra vez en el cierre del
modal de cobro, con el mismo defecto: tras cobrar, con receta y estudios, se iba
a la receta y la orden no se imprimía. Dos copias de una decisión es dos sitios
donde arreglarla, y sólo se arregla uno.

**Por qué no se arregla con otro `if`.** Porque el problema no es a cuál de los
dos ir: **es que son dos**. Cualquier regla que elija uno deja el otro sin hacer.

**El arreglo.** `queFaltaParaCerrar()` devuelve lo que queda, con **lo que pasa
si no se hace** —«el laboratorio no le va a tomar la muestra sin la solicitud»,
no «orden de estudios»—; y `aDondeIrDirecto()` decide si hay un destino claro.

**Lo que NO cambia, y es deliberado.** Con un solo destino se sigue navegando
directo. Ese caso nunca estuvo roto, y meterle una pantalla de por medio sería
añadir un clic a la consulta más común para arreglar un problema que esa
consulta no tiene.

**Guardián.** `src/__tests__/la-orden-no-se-queda-en-el-tintero.test.ts`, 19
casos, incluido uno que falla si vuelve a aparecer la cadena de `if`.

## REG-245 — el guardián de pautas daba falso positivo en toda la UCI (v1127)

**Un defecto MÍO, de v1120, cazado antes de que lo viera el médico.**

`forma-de-la-pauta.ts` (REG-238) se escribió con la receta de consultorio en la
cabeza: «cada 8 horas», «3 veces al día», «14 días». Medido después contra
pautas de terapia intensiva, daba **falso positivo en casi todo vasopresor**:

| Pauta real de UCI | Veredicto de v1120 |
|---|---|
| `infusión continua` | «no se entiende como una frecuencia» |
| `en bolo` · `dosis única` · `DU` | «no se entiende» |
| `0.1 mcg/kg/min` · `5 mL/h` | «no se entiende» |
| `titular a efecto` · `a demanda` | «no se entiende» |
| `a criterio` · `en revisión diaria` | «no se entiende como una duración» |

Una nota de UCI con seis infusiones habría salido con seis avisos falsos. Eso
**no es un aviso inútil: es un aviso dañino** — es exactamente cómo se le enseña
a un médico a ignorar la compuerta, y la compuerta que se ignora deja de
proteger. Es la queja que él ya había puesto por escrito: «esto nomás confunde».

**Cómo se encontró.** Midiendo el motor contra el caso real, no leyéndolo. Se le
pasaron quince pautas de terapia intensiva y se miró el veredicto.

**El arreglo.** Cuatro formas nuevas: infusión/perfusión/continua/BIC; bolo,
dosis única, carga, impregnación; velocidad (`n mcg/kg/min`, `n mL/h`); y
titulación/demanda. En duración: «a criterio», «en revisión diaria», «sin fecha
de término», «hasta extubación/destete».

Un fármaco en infusión continua **no tiene frecuencia, y no tenerla es
correcto**. Aquí sólo se reconoce la FORMA; que la velocidad sea la adecuada lo
juzga el intensivista.

**La prueba que importa.** Ensanchar un motor de seguridad es donde se pierde lo
que ya protegía. Hay un caso que comprueba que, después de abrir la puerta a
UCI, **«24 tras» y «14 editas» siguen cazándose**.

Familia `sin_medir`: el instrumento existía y no se había apuntado a la UCI.

## REG-246 — perder el «/kg» de una infusión pasaba indetectado (v1128)

**Otro defecto mío de esta noche, del motor de REG-240, cazado midiéndolo contra
UCI.**

En una alternancia de regex gana **la primera alternativa que casa**, no la más
larga. La lista de unidades tenía `mcg` antes que `mcg/kg/min`, así que
«0.1 mcg/kg/min» se leía como **«0.1 mcg»** y el resto se tiraba.

**La consecuencia, medida.** Una reescritura que convirtiera

    Norepinefrina 0.1 mcg/kg/min   →   Norepinefrina 0.1 mcg/min

pasaba **completamente indetectada**: las dos normalizaban a la misma cifra. Es
convertir una infusión por peso en una tasa fija — en un adulto de 70 kg, unas
**70 veces menos** noradrenalina. El guardián que existe justo para que una
reescritura no cambie una dosis, no veía la más grave de todas.

**El arreglo.** Se añadieron las velocidades de infusión que se dictan de verdad
(`mcg/kg/min`, `mg/kg/h`, `ml/h`, `U/h`, `cmH2O`, `mmol/L`…) y —lo importante—
la lista **se ordena de más larga a más corta en código**, no a mano: una lista
ordenada a mano se desordena en el primer añadido, y el defecto vuelve sin que
nadie lo note, porque no truena: sólo deja de ver.

Hay una prueba que comprueba que ese `sort` siga ahí.

Familia `sin_medir`, como REG-245: el instrumento existía y no se había apuntado
a la UCI.

## REG-247 — «2 U/h» de insulina salía como dosis sin unidad (v1129)

**Tercero del mismo barrido**: apuntar los motores de seguridad a la UCI, en vez
de leerlos.

`RE_FORMA` en `dosis.ts` (el motor de REG-173, anterior a esta noche) tenía `ui`
y `u.i.` pero **no la `u` sola**. Medido: «2 U/h» —una infusión de insulina,
exactamente como se dicta en terapia intensiva— salía como **«dosis sin
unidad»**.

**Por qué éste importa más que los otros dos.** La insulina es un fármaco de
**alto riesgo**. Un aviso falso sobre ella es de los peores que puede dar este
sistema: enseña a ignorar su aviso, y el día que el aviso sea verdadero también
se ignorará.

**El detalle de implementación que se documenta.** La `u` va **después** de `ui`
y `unidades` en la alternancia: gana la primera que casa, y una `u` delante se
comería la «u» de «ui». Es la misma lección de orden que REG-246, en el mismo
turno.

Se comprobó de paso que las velocidades de infusión (`0.1 mcg/kg/min`,
`2 mg/kg/h`, `5 mL/h`) ya pasaban, y que **«Levotiroxina 100» se sigue cazando**
— ensanchar la lista es donde se pierde lo que protegía.

Familia `sin_medir`.

## REG-248 — «alergias negadas» quedaba registrado como una alergia (v1130)

**Cuarto del barrido «apuntar los motores de seguridad a la UCI y al hospital».**

`NEGADOR` en `alergias.ts` estaba **anclado al principio**, y con razón: «Alérgico
a penicilina, niega sulfas» tiene que conservar la penicilina. Pero el ancla
significa que **cualquier palabra delante lo rompe**. Medido:

| Campo de alergias | v1129 |
|---|---|
| `negadas` | negación reconocida ✓ |
| **`alergias negadas`** | **NO reconocida** ← la frase natural en español |
| **`NKDA`** · `NKA` | **NO reconocida** ← el estándar hospitalario |
| `se niegan` · `no` · `(-)` | NO reconocidas |

**La consecuencia.** Lo que no se reconoce como negación **se registra como
alérgeno**. De aquí leen la receta impresa, la nota, el recurso FHIR y el sesgo
del reconocedor: **la receta con su cédula y su firma salía diciendo que el
paciente es alérgico a «alergias negadas»**.

**Dos arreglos, y son dos por una razón.**

1. **La cabecera se descuenta.** Si el fragmento empieza por «alergias» /
   «alergia» / «antecedentes alérgicos» (con o sin dos puntos), se quita y se
   vuelve a preguntar: «alergias negadas» se juzga por «negadas».
2. **Las formas completas.** `NKDA`, `NKA`, `(-)`, `-`, `no`, `ninguna`,
   `negativo` no llevan negador: son la negación entera. Se comparan con el
   fragmento **completo**, nunca como prefijo — «no» de prefijo convertiría
   **«naproxeno»** —un alérgeno real y frecuente— en una negación, y la alergia
   desaparecería del expediente sin que nadie lo notara. Hay una prueba para eso.

**Lo que el ancla protegía sigue protegido**: «Niega penicilina. Alérgico a
sulfas» conserva las sulfas, con su propio caso.

**Guardián.** `src/__tests__/alergias-negacion.test.ts`, 12 casos.

Familia `sin_medir`.

---

**Y una prueba inestable, cazada de paso.** El barrido de 126 antimicrobianos
falló UNA vez en la corrida completa y pasó al repetirlo. No era una rotura: era
el tiempo — tarda ~1,7 s solo y con dieciséis archivos en paralelo rebasa el
límite por defecto de 5 s. Se le declaró un tiempo explícito de 30 s.

Una prueba de seguridad clínica que falla al azar es peor que una que no existe:
la primera vez se investiga, la segunda se repite la corrida, y a la tercera se
deja de creer al rojo.

## REG-249 — el audio se subía y se tiraba: no había nada que reproducir (v1131)

**El eslabón que bloqueaba el hueco nº2 del dueño** — «pulsar cualquier frase de
la nota y escuchar el audio exacto que la originó», lo que Abridge llama
*Linked Evidence*.

Casi todo estaba: los tiempos sobreviven (cada palabra lleva su `inicioMs`), el
trazado frase→dictado existe (`trazabilidad.ts`), y la regla de lectura de
`consultas-audio/` se reparó al cerrar el corte de las grabaciones largas.

Faltaba una sola cosa, y lo bloqueaba todo: **el audio se subía a Storage, se
sacaba su URL para dársela al motor de diarización, y se tiraba**. Nunca volvía
al llamador ni se guardaba con la nota. Familia `no_conectado` — la vigésima.

**Y sólo pasaba en las largas.** El camino corto —el de la mayoría de las
consultas— manda el audio como multipart y **nunca lo subía**. Sin tocarlo,
«escuchar de dónde salió esto» habría sido una función que aparece pasados unos
minutos y antes no, sin que el médico pueda predecir cuándo.

**La ruta, nunca la URL.** `getDownloadURL` devuelve una URL con un **token de
acceso dentro**. Guardarla en Firestore sería dejar una llave escrita en el
expediente — y una llave que sigue sirviendo aunque después cambien las reglas o
se revoque el acceso. Se guarda la ruta; la URL se vuelve a pedir al reproducir,
que es cuando las reglas se evalúan otra vez con quien esté mirando.

**Lo que NO se guarda, y es deliberado.** Las PARTES de un lote no dejan audio:
`transcribirParte` procesa un trozo, no una consulta, y guardar cada trozo
dejaría N audios que no corresponden a ninguna nota y que nadie borraría nunca.

**Si la subida falla, la transcripción no se pierde**: se sube después de tener
el texto y en su propio `try`. Se queda sin ruta —que es exactamente lo que
significa, no hay audio que reproducir— y no se inventa una.

**La decisión que no es mía.** Conservar el audio lo autorizó el médico dueño
explícitamente. **Cuánto tiempo** sigue siendo suyo, y está en
`OWNER_DECISIONS_REQUIRED.md`: por eso no hay ningún plazo escrito a mano en el
código.

**De paso, una prueba quebradiza.** `sesgo-con-el-paciente` clavaba la firma
ENTERA de la llamada, paréntesis de cierre incluido. Al añadir un quinto
argumento se puso roja sin que el contexto del paciente hubiera dejado de viajar
ni un momento. Ahora comprueba la intención. Una prueba que se rompe con cada
añadido enseña a editarla sin leerla, y entonces deja de proteger.

**Guardián.** `src/__tests__/el-audio-sobrevive-a-la-consulta.test.ts`, 11 casos.

## REG-250 — pulsar una frase y escuchar el segundo exacto (v1132)

**La cadena que pidió el médico, cerrada**: «hacer clic en cualquier frase de la
nota → escuchar exactamente el audio que la originó». Es lo que Abridge llama
*Linked Evidence* — y lo que **Nabla estructuralmente no puede tener**, porque
borra el audio original (AP, oct-2024). Familia `hueco_frente_al_mercado`.

    frase de la nota → trozo del dictado → SEGUNDO EXACTO → audio

Los dos primeros pasos ya existían (`trazabilidad.ts`); el audio se guarda desde
REG-249. Faltaba el puente del medio: los segmentos llevan posición en
**caracteres** y el audio se busca por **tiempo**.

**Por qué no vale una regla de tres.** Repartir la duración total entre los
caracteres del dictado falla justo donde importa: la gente se calla, tose,
repite, y el paciente habla a otra velocidad que el médico. Tres segundos de
desfase dejan al médico oyendo la frase equivocada — y **una prueba en el
segundo equivocado es peor que ninguna**, porque tiene aspecto de prueba.

Se busca la frase **en las palabras que el motor oyó** y se devuelve el
`inicioMs` de la que de verdad la empieza, con el hablante.

**Cuándo NO sale botón, que es la mitad del diseño.** Cuando el motor no localiza
la frase con seguridad devuelve `null` y la interfaz no ofrece nada:

- frase de menos de tres palabras («Sí», «Correcto») — esa palabra aparece diez
  veces en la consulta y cualquiera parecería igual de buena;
- frase que no está en el dictado;
- turnos **sin tiempos** —un borrador anterior a que se guardaran— porque
  rellenar con cero pondría toda la consulta al principio del audio, y sonaría
  plausible.

**El reproductor.** Un solo elemento `<audio>` para toda la página (decenas de
frases son decenas de descargas del mismo archivo y dos audios sonando a la vez);
la URL se pide **al pulsar**, que es cuando las reglas de Storage se evalúan otra
vez con quien esté mirando; y **se para al desmontar** — dejar sonando el audio
de un paciente después de cerrar su nota es exactamente lo que no puede pasar.

`firebase/storage` se importa de forma perezosa: no se paga en las consultas que
nunca escuchan nada.

**Guardián.** `src/__tests__/escuchar-de-donde-salio.test.ts`, 22 casos.

## REG-251 — el panel certificaba EN VERDE lo contrario de lo que se dijo (v1133) · P0

**El defecto más grave encontrado en toda la sesión, y no salió leyendo código.**

Un equipo rojo independiente —25 agentes lanzados a **refutar** los planes de
métricas en vez de aprobarlos— le pasó al comparador pares que cualquier médico
reconocería como opuestos. Dos agentes distintos reprodujeron lo mismo. Después
se reprodujo en esta máquina, con `rastrearNota`:

| La nota decía | El dictado decía | Veredicto del panel |
|---|---|---|
| «Paciente **niega** alergia a penicilina» | «Soy **alérgico** a la penicilina» | **respaldada · 1,00 · VERDE** |
| «Warfarina **10 mg**» | «Warfarina **2 mg**» | **respaldada · 1,00 · VERDE** |

Una **inversión de negación** y una **dosis de anticoagulante multiplicada por
cinco**, las dos selladas como «se dijo en la consulta».

**Por qué es peor que un fallo normal.** Este panel no informa: **tranquiliza**.
Le dice al médico «esto se dijo», en verde. Un verificador que certifica lo
contrario de lo que ocurrió es más peligroso que no tener verificador, porque
sustituye la duda del médico por una falsa certeza. Y en v1132 se le acababa de
poner encima un botón para escuchar el audio, que lo vuelve más creíble todavía.

Familia `mensaje_miente`.

**Dos causas, tres reparaciones.**

1. **`'niega'` estaba en la lista de palabras VACÍAS.** Al ignorarla, «niega
   alergia a penicilina» y «alérgico a la penicilina» eran la MISMA frase para
   el comparador. → Los negadores son contenido, y el **signo se compara aparte
   y manda sobre la cobertura**: un fragmento que dice lo contrario no respalda
   nada, por muchas palabras que comparta.
2. **`contenido()` filtraba `w.length > 3`.** Eso tira «10», «mg», «850», «2»,
   «12» — es decir, **todas las dosis**. → Las cifras y las unidades entran
   siempre. Un número es el contenido más específico de una frase clínica: si el
   de la nota no está en el dictado, eso no es ruido, es la señal más fuerte que
   existe.
3. Con las dos anteriores, una frase **larga** todavía diluía la cifra
   equivocada por encima del umbral (0,78 > 0,70). → **Una cifra huérfana nunca
   puede ser verde**: tope de «parcial», con la cifra nombrada.

**Lo que sigue en verde**, y se comprueba: la misma negación en los dos sitios,
la misma dosis en los dos sitios, y el sinónimo del paciente («cefalea» ←
«dolor de cabeza»). Endurecer un verificador es donde se fabrica el ruido, y un
panel que marca en ámbar media nota correcta se aprende a ignorar.

Las 7 938 pruebas existentes siguieron pasando: ninguna dependía del
comportamiento roto.

**Guardián.** `src/__tests__/el-panel-no-certifica-lo-contrario.test.ts`, 12
casos, con las reproducciones exactas.

## REG-252 — el bucle de resultados tenía fuga del 100 %, por construcción (v1134)

**Hallazgo del equipo rojo, verificado aquí.** El charter V7 §F1 pide este ciclo
y que se **cierre**:

    ORDEN → TOMA → RESULTADO → REVISIÓN → CONDUCTA → PACIENTE → CERRADO

`tareaDeResultado()` existía y estaba probada. Y **no la llamaba nadie**: cero
referencias en todo el repositorio fuera de su propio archivo de pruebas.
Comprobado con `grep`. Ningún resultado de laboratorio generaba jamás una tarea
de revisión.

No es que el ciclo se cerrara poco: **nunca empezaba**.

Familia `no_conectado` — la **vigésima primera**.

**Había una alerta, y no es lo mismo.** Los valores críticos disparaban una
alerta. Pero una alerta se lee, se cierra, y nadie vuelve a saber si alguien
actuó. El charter lo dice con estas palabras: *«NexusMED debe CERRAR el trabajo,
no sólo mostrar alertas»*. Y los resultados NO críticos no tenían ni eso.

**Dónde se conectó, y por qué ahí.** En `cargarResultadosLab`, que es el cuello
de botella: los dos caminos por los que hoy entra un resultado —carga manual e
importación FHIR— pasan obligatoriamente por esa función. Conectarlo en las
pantallas habría dejado que el tercer camino que alguien añada naciera con la
misma fuga. Es la lección de las veintiuna veces anteriores: **se conecta donde
el dato pasa a la fuerza, no donde es cómodo**.

Una tarea **por estudio**, no una por sobre: el médico revisa resultados, no
sobres. Lo crítico vence el mismo día; lo demás, en dos.

**Lo que este código NO decide.** Qué es crítico viaja tal cual llega en el
resultado. Decidirlo aquí sería meter criterio clínico en un archivo de
persistencia, y ya vive con sus rangos en `lab-criticos.ts`. Y sin paciente en
la solicitud no se crea tarea: una tarea colgada del paciente equivocado es peor
que ninguna tarea.

**Si la tarea no se crea, no se calla.** La función devolvía `void`, lo que
habría hecho **invisible** un fallo al crearla — exactamente el defecto que se
está reparando. Ahora devuelve `{ tareasCreadas, tareasEsperadas }` y las dos
pantallas avisan al médico. El resultado guardado no se pierde por eso: su
transacción va antes y no depende de la tarea.

**Guardián.** `src/__tests__/un-resultado-genera-tarea.test.ts`, 13 casos.

## REG-253 — la cifra de seguridad publicada se pudrió en nueve días (v1135)

**Hallazgo del equipo rojo, verificado con el comando.**
`docs/seguridad/npm-audit-2026-07-30.md` decía en su columna «después»:

    Rama de producción: 8 · 0 high · 8 moderate

Nueve días más tarde, `npm audit --omit=dev` devolvía **12 · 3 high**:

| Paquete | Qué es |
|---|---|
| **`pdfjs-dist`** | **Ejecución arbitraria de JavaScript al abrir un PDF malicioso** (GHSA-hq66-cqwq-w95j) |
| `nanoid` | Bucle infinito con tamaño cero |
| `brace-expansion` | DoS por arreglos intermedios sin cota |

La primera importa de verdad **en este producto**: el médico abre PDF de
laboratorio todos los días, así que el camino de ataque es «el laboratorio le
manda un PDF al médico».

**El documento no mintió cuando se escribió: se pudrió.** Familia
`depende_de_recordar`, la misma que el tablero del loop (REG-241): un dato que
el sistema ya sabe y un segundo sitio que lo repite a mano.

**Y éste es peor que el del tablero.** El tablero lo leo yo. **Este documento se
le enseña a un comprador.** Una cifra de seguridad obsoleta en una sala de datos
no es un despiste: es una afirmación falsa sobre el riesgo de un producto
sanitario.

**Dos reparaciones, y hacen falta las dos.**

1. **Se cerraron las tres.** `pdfjs-dist` 6.0.227 → **6.2.108**; `nanoid` y
   `brace-expansion` por `overrides`, porque son transitivas (`next→postcss` y
   `@capacitor/cli→rimraf→glob→minimatch`). Producción quedó en **9 · 0 high ·
   0 critical**. Verificado que el visor de PDF sigue funcionando: worker
   recopiado, 7 963 pruebas y `npm run build` en verde.
2. **La cifra se deriva.** `scripts/seguridad/auditar.mjs` corre el comando y
   reescribe el bloque de `ESTADO-DEPENDENCIAS.md`. El documento viejo queda con
   un aviso arriba: sus cifras están caducadas, su **análisis** sigue valiendo —
   eso es criterio, y el criterio no caduca solo.

**La compuerta que de verdad protege** no mide el documento: mide el producto.
`la-cifra-de-seguridad-no-se-pudre` falla si aparece **una sola `high` en la rama
de producción**, sin que nadie tenga que acordarse de mirar.

**Y un tropiezo propio que vale la pena dejar escrito.** El primer intento puso
`brace-expansion: ^5.0.9` **global**, y **rompió ESLint**: un `minimatch`
antiguo del árbol de herramientas espera la API v1/v2 (`expand` como función) y
la v5 la cambió. El trinquete de lint hizo exactamente lo que debía — falló en
vez de pasar en silencio: *«un gate que no mide no protege: se falla»*.

La vulnerable sólo vivía bajo `@capacitor/cli`; las demás copias del árbol son
1.1.x y 2.x, **fuera del rango del aviso**. Acotar el override arregla lo que
hay que arreglar sin tocar lo que ya estaba sano. Un `override` global es una
escopeta: llega más lejos de lo que se apunta.

Detalle que se documenta porque tiene trampa: `npm audit` sale con código ≠ 0
**cuando encuentra algo**. Un script que lo tratara como error se quedaría mudo
justo cuando hay algo que contar.

**Guardián.** `src/__tests__/la-cifra-de-seguridad-no-se-pudre.test.ts`, 11 casos.

## REG-254 — una métrica que daba lo mismo con el motor y sin el motor (v1136)

**Refutación del equipo rojo, reproducida aquí sobre las 6 000 frases.**

| Categoría | n | Con motor | Sin motor | **Aporte** |
|---|---|---|---|---|
| Unidades | 216 | 99,54 % | 99,54 % | **0,00 pp** |
| Números | 498 | 50,60 % | 47,59 % | 3,01 pp |
| Acrónimos | 1 738 | 44,42 % | 40,39 % | 4,03 pp |

**El 99,54 % de exactitud de unidades no mide el producto: mide el comparador.**
`canonizar()` traduce «microgramos por kilo por minuto» a `mcg/kg/min` por su
cuenta, así que el término «sobrevive» tanto si el pipeline lo tocó como si no.
Es una cifra real y es una cifra **inútil** para juzgar el motor.

Familia `sin_medir`: no faltaba producto, faltaba el instrumento que distinguiera
producto de ausencia de producto.

**Lo que se construyó: la prueba de placebo.** Cada categoría se mide dos veces —
con el pipeline y con el texto crudo— y lo que se congela es el **aporte**, no la
exactitud absoluta. Un cambio que suba la exactitud sin subir el aporte no ha
mejorado el motor: ha mejorado el comparador, y eso es justo lo que hay que poder
distinguir.

El aporte de unidades se congela en **0,00 pp a propósito**. No es una meta: es
el registro honesto de que hoy el motor no aporta nada medible ahí. Si algún día
sí aporta, el caso se pondrá rojo — y será una buena noticia que habrá que venir
a escribir.

**Y se congela también lo que la cifra NO es.** Hay un caso que falla si la
exactitud absoluta de números o acrónimos llegara al 90 %, porque hoy ronda el
50 %. El dueño escribió como meta «99,4 % / 99,7 %»; dejarlo medido en una prueba
impide que la cifra deseada se cuele como si fuera la real.

**La n también se declara**: 1 738 «acrónimos» son **56 acrónimos distintos**
repetidos, y 216 «unidades» son **25 distintas**. Un porcentaje sobre
repeticiones dice menos de lo que parece.

**La regla queda escrita** en `docs/evals/COMO-SE-MIDE.md`, y la prueba falla si
ese documento deja de decirla: *una cifra que no distingue producto de ausencia
de producto no se publica como desempeño*. Ninguno de los productos de
referencia publica WER, tasa de alucinación ni ablación sobre un banco
independiente — ahí está el foso. **Un 94 % publicado y reproducible le gana a un
99 % afirmado.**

**Guardián.** `src/__tests__/el-motor-tiene-que-aportar.test.ts`, 8 casos.

## REG-255 — un instrumento para la familia de defectos más grande (v1137)

**No repara un defecto: repara la forma de encontrarlos.**

«Escrito, probado y sin conectar» es 21 de 102 REG — la familia más grande con
diferencia. Y los veintiuno se encontraron **de uno en uno, por casualidad**:
leyendo otra cosa, o porque un equipo rojo tropezó. `tareaDeResultado()` fue el
último: existía, estaba probada, y el bucle de laboratorio **nunca empezaba**.

Encontrarlos por suerte no escala.

**El instrumento.** `scripts/calidad/motores-conectados.mjs` barre los dominios
clínicos y de seguridad —771 funciones exportadas— y pregunta dos cosas:

1. ¿Se usa en algún sitio, incluido su propio archivo más allá de su
   declaración?
2. ¿Su módulo llega al camino del médico, siguiendo la cadena de importaciones
   desde `app/`, `components/` y `hooks/`?

**Resultado: 50 funciones sin ningún uso.** El trinquete las congela: sólo
pueden bajar. Un motor clínico nuevo que nazca sin conectar pone esto en rojo el
mismo día, en vez de esperar seis meses a que alguien tropiece.

**Dos cosas distintas, y la segunda es la cara.** *Código muerto* —
`verificarIntegridad`, **cero archivos de prueba**— molesta pero no engaña.
*Probado y sin conectar* —`sePuedeFirmar`, `resumenVigentes`,
`esAntecedenteFamiliar`, `csvDeBitacora`, todas con su prueba en verde— es el
caro: **el verde de la prueba hace creer que está en marcha**.

**Y un falso positivo propio que casi cuesta caro.** La primera versión daba
**152**, no 50, porque preguntaba «¿lo usa algún archivo que no sea el suyo?».
La primera que fui a reparar, por parecer la más peligrosa, era falsa:

    crossResistenciaFQ   (EUCAST T13, cross-resistencia de fluoroquinolonas)

La llama `analizarSeguridad`, **en el mismo archivo**, y ésa sí corre en el
motor. Era un ayudante interno. Casi «reparo» algo que funcionaba, y justo en el
módulo de antibiogramas — el que más le importa al médico dueño.

Un medidor que grita 152 cuando hay 50 enseña a ignorarlo: **es el mismo fallo
que se repara en los avisos clínicos**. Hay un caso que comprueba que el arreglo
sigue puesto y otro que exige que el nombre `crossResistenciaFQ` siga escrito en
el script, para que el próximo entienda por qué el medidor es más complicado de
lo que parece necesario.

**El guardián NO exige cero**: no todo lo de la lista es un defecto — puede ser
API legítima o un símbolo exportado para poder probarlo. Congela la cuenta y
cada iteración cierra una o dos con criterio.

Familia `sin_medir`: no faltaba producto, faltaba el instrumento.

**Guardián.** `src/__tests__/los-motores-llegan-al-medico.test.ts`, 8 casos.
**Lista.** `docs/quality/MOTORES-SIN-CONECTAR.md`, con las 50 nombradas.

## REG-256 — las alertas del episodio se escribían y nadie las leía (v1138)

**Primera cosecha del instrumento de REG-255**, y salió de lo alto de la lista:

    src/lib/hospital/firestore.ts::getAlertas
    src/lib/hospital/firestore.ts::marcarAlertaLeida

`crearAlerta()` guarda cada alerta del episodio en `hospital_alertas`: valor de
laboratorio **crítico**, NEWS2, interconsulta, resultado listo. La colección
existe, tiene reglas de Firestore, está en la lista de respaldos y en la matriz
de acceso.

Y **ninguna pantalla la leía**. Las dos funciones de lectura estaban escritas y
sin un solo llamador en todo el repositorio.

Traducido: el potasio de 7.2 se marca crítico, se escribe la alerta, y va a
parar a **un cajón que no tiene tirador**.

**Lo que sí funcionaba, para no exagerar.** El envío por WhatsApp sí corría, y
el propio código ya avisaba cuando no salía. Pero WhatsApp es un canal que se
pierde: se lee en el pasillo, se olvida, o el teléfono no está registrado —que
es el estado por defecto de una clínica recién configurada—. **La alerta en la
ficha del paciente es la que sigue ahí mañana.**

**Las tres decisiones del diseño.**

1. **Encima de las pestañas.** Una alerta que hay que ir a buscar en una pestaña
   no es una alerta. Se comprueba por posición en la prueba.
2. **Se marca leída con un clic, no al mirarla.** Marcar por el hecho de que la
   lista aparezca convierte el estado en ruido: se «leen» solas al abrir la
   ficha por cualquier otro motivo. Un clic distingue «lo vi» de «pasó por
   delante».
3. **Si la consulta falla, se dice.** No se enseña «0 alertas» — fingir una
   bandeja vacía sería la misma mentira que este componente repara. Y si el
   WhatsApp no salió, se enseña también: el médico tiene que saber que esa
   alerta sólo existe ahí.

**El trinquete baja: 50 → 48.** Familia `no_conectado`, la vigésima segunda.

**Guardián.** `src/__tests__/la-alerta-tiene-quien-la-lea.test.ts`, 12 casos.

## REG-257 — cuatro motores de UCI escritos y sin correr (v1139)

**Segunda cosecha del instrumento de REG-255**, y de las que duelen porque el
médico dueño es intensivista de guardia:

    src/lib/uci/scores.ts::camIcu
    src/lib/uci/pocus.ts::obstruccionTSVI
    src/lib/uci/pocus.ts::signo6060
    src/lib/uci/pocus.ts::pulsatilidadPorta

Los cuatro escritos, con su fuente y sus umbrales —Ely JAMA 2001, Soliman 2026,
Beaubien-Souligny 2020— y **sin un solo llamador**. En su panel de UCI, sin
correr.

**El que cambia el tratamiento.** `obstruccionTSVI`, con gradiente ≥ 30 mmHg,
dice literalmente:

> «obstrucción dinámica — **NO escalar inotrópicos** (los empeora)»

Un motor que dice eso y no corre es el peor caso de esta familia: no es que
falte una función, es que **la advertencia existe escrita en el repositorio y
nunca llegó a una pantalla**. Por eso su resultado se enseña **sin** el filtro
de modo avanzado, a diferencia de los otros: esconder tras un interruptor algo
que cambia la conducta es tenerlo y no enseñarlo.

**CAM-ICU, y una decisión de captura.** El cribado de delirium no corría nunca.
Se conecta junto al RASS, y **el Rasgo 3 (conciencia alterada) no se pregunta**:
sale del RASS que ya está capturado arriba. Pedir dos veces el mismo dato es
como se consigue que no se llene ninguna.

Se enseña **también cuando no es evaluable**, diciendo qué rasgo falta: un
cribado en blanco que desaparece de la pantalla no se llena nunca, y «no se
sabe» es información. Lo que no se hace es dar por negativo lo que falta — el
motor ya lo impide, y su comentario explica que tratarlo así producía un **falso
negativo de delirium**.

**La pulsatilidad portal se calcula.** Antes había que clasificar el patrón a
ojo en un desplegable; ahora sale de Vmáx y Vmín, y si falta una de las dos no
se dice nada.

**No se inventó ningún umbral.** Los 30 mmHg, los 60 ms, el 50 % de
pulsatilidad y los cuatro rasgos **ya estaban en los motores, con su cita**.
Conectar es trabajo de software; los cortes son de los autores. Hay un caso que
comprueba que la pantalla **no define ningún corte propio**: dos verdades para
el mismo umbral y la primera vez que se separaran nadie sabría cuál creer.

**El trinquete baja: 48 → 44.** Familia `no_conectado`, la vigésima tercera.

**Guardián.** `src/__tests__/los-motores-de-uci-corren.test.ts`, 17 casos.

## REG-258 — oxígeno con cifras y sin declarar: NEWS2 salía bajo (v1140)

**Tercera cosecha del instrumento de REG-255.** `oxigenoSinDeclarar` estaba
escrita, con su comentario, su `NEEDS_CLINICAL_REVIEW` y su prueba — y **sin un
solo llamador**.

Detecta la toma de signos que trae **flujo o FiO₂ registrados** pero sin la
casilla de «recibe O₂ suplementario».

**Por qué importa más de lo que parece.** NEWS2 **suma 2 puntos** por oxígeno
suplementario. Sin esa casilla la puntuación sale más baja de lo que le toca — y
NEWS2 es justo lo que dispara la escalada. Un paciente con 5 L/min anotados y la
casilla sin marcar puede quedarse **dos puntos por debajo** del umbral que
habría pedido revisión.

**Lo que NO se hace, y ya estaba escrito en el motor.** No se deduce. Sus
palabras: *«decidir que un flujo registrado significa "recibe O₂ suplementario"
es una regla clínica, y aplicarla cambiaría el NEWS2 —el modificador suma
puntos—. Se declara y lo decide el médico. NEEDS_CLINICAL_REVIEW.»*

Se **señala** en la celda de oxígeno, y el texto explica el **efecto**, no sólo
la ausencia: «falta declarar el oxígeno» no mueve a nadie; «NEWS2 suma 2 puntos
por oxígeno, sin esa casilla la puntuación sale más baja» sí.

---

**Y una decisión de no hacer, que también se registra.**

`negacionesEnTexto` sigue en la lista de huérfanas **a propósito**. Su único
sitio natural sería otro aviso en pantalla —«el campo de alergias dice que se
interrogó y se negó»— y eso es información de bajo valor compitiendo por el
mismo espacio que las alertas que **sí bloquean la firma**.

Añadir ruido es exactamente el defecto que este loop lleva reparando (REG-245,
REG-247). **El trinquete no exige cero: exige que no crezca.** Conectar algo
por bajar un número sería usar el instrumento al revés.

**El trinquete baja: 44 → 43.** Familia `no_conectado`, la vigésima cuarta.

**Guardián.** `src/__tests__/el-oxigeno-sin-declarar-se-ve.test.ts`, 12 casos,
incluido uno que comprueba que la decisión de NO conectar esté escrita donde se
lee.

## REG-259 — el texto de la IA podía callarse una carbapenemasa (v1141)

**Cuarta cosecha del instrumento de REG-255**, y ataca el modo de fallo más
silencioso que hay en este módulo.

`validarRazonamiento` ya cazaba lo que el modelo dice y **contradice** al motor
determinista. No cazaba lo que el modelo **omite**: el motor detecta una
carbapenemasa, el texto no la menciona, y el médico lee un razonamiento
impecable que **no dice lo único que había que decir**.

Contradecir es ruidoso — choca con lo que hay al lado. **Omitir no choca con
nada**, y por eso hace falta un motor que lo busque.

`omiteAlertasCriticas` existía exactamente para esto, con su prueba, y sin un
solo llamador.

**Se conecta para los DOS modelos**, el principal y la segunda opinión. Ya pasó
una vez que `contradiccionesSegundaOpinion` viajaba desde el servidor y el
cliente la tiraba: la segunda opinión se enseñaba sin su caja roja. Hay un caso
que impide que se repita con las omisiones.

**En ámbar, no en rojo.** El rojo está reservado para la contradicción, que es
peor: una dice que el texto está equivocado, la otra que está incompleto. Si
todo grita igual, nada se oye (REG-245).

**Lo que no se hace.** No se reescribe el texto ni se le añade la alerta que
falta. Se avisa, y las alertas del motor están arriba, enteras. Completar el
razonamiento del modelo por cuenta propia sería poner en su boca un juicio que
no hizo — y este proyecto no cruza esa línea ni cuando sería cómodo.

**El trinquete baja: 43 → 42.** Familia `no_conectado`, la vigésima quinta.

**Guardián.** `src/__tests__/lo-que-el-texto-se-callo.test.ts`, 9 casos.

## REG-260 — el número decía 42 y significaba otra cosa (v1142)

**El instrumento de REG-255 empezaba a mentir por agregación.** Decía «42
motores clínicos sin conectar», y con ese número no se puede decidir nada.
Medido:

| | Cuántos | Qué son |
|---|---|---|
| **Envoltorios** | 34 | ≤3 líneas sobre una función que **sí corre**. `sePuedeFirmar` es literalmente `motivosParaNoFirmar().length === 0`. **No son defectos**: son comodidad que nadie usó |
| **Con cuerpo real** | 8 | Los que merecen mirarse uno a uno |

Un medidor que cuenta 42 cuando hay 8 que mirar es el mismo defecto que ya se
reparó en él mismo (152 → 50) y el mismo que se repara en los avisos clínicos:
**si todo cuenta igual, nada se mira**.

**Y una tercera categoría que no existía: bloqueado en el dueño.**

De los ocho con cuerpo real, `validarCorreccion` **no es un defecto de
software**. Exige una política como parámetro **obligatorio** y
`POLITICA_CORRECCION` nace en `null` a propósito. Su comentario lo dice: *«la
única forma de usar esta función es que alguien haya decidido Q2-Q4 y lo haya
escrito»*.

Quién puede corregir un registro ya hecho, en qué ventana, quién puede **anular
una administración de medicamento** y si el motivo es obligatorio son decisiones
de política de registro clínico con peso NOM-004. Elegir valores «razonables» y
enterrarlos en una constante sería exactamente lo que este proyecto no hace.

Llevado a `agent-state/OWNER_DECISIONS_REQUIRED.md`: **cuatro preguntas, cuatro
frases, y queda conectado**.

Familia `sin_medir`: el instrumento existía y medía de más.

**Guardián**: tres casos nuevos en
`src/__tests__/los-motores-llegan-al-medico.test.ts` — que las dos categorías
sumen el total, que los de cuerpo real estén **nombrados en el documento**, y
que `POLITICA_CORRECCION` siga en `null` con su decisión en la cola del dueño.

## REG-261 — el expediente no enseñaba los ingresos hospitalarios (v1143)

**Y lo pedía el propio código.** `getInternamientosDePaciente()` llevaba escrito
en su comentario, desde que se escribió:

> «Internamientos de UN paciente (**para mostrarlos en su expediente**).»

El expediente no los mostraba. Sin llamador y **sin prueba** — de los ocho con
cuerpo real que dejó el instrumento de REG-255, era uno de los dos que no tenía
ni eso.

**Por qué no es un detalle.** La constitución del charter V7 dice, en
mayúsculas: **UN PACIENTE · UN EXPEDIENTE LONGITUDINAL**. Un paciente ingresado
dos veces tenía esos episodios sólo en la pantalla de hospitalización, a la que
se llega por el censo. **Desde su expediente no había forma de saber que
existieron.**

Las notas de hospital sí aparecían bajo su pestaña. Pero una nota suelta no dice
cuándo ingresó, cuántos días estuvo, ni cómo egresó.

**Va antes de los filtros de notas**, y se comprueba por posición: saber que
estuvo ingresado dos veces es contexto para leer todo lo de abajo, no una
pestaña más.

**Lo que NO hace, y es deliberado.** No calcula días de estancia ni reingresos:
esos motores existen aparte, con sus reglas y su zona horaria, y recalcularlos
aquí sería **una segunda verdad para el mismo dato** — el defecto que ya se
evitó con los umbrales de POCUS (REG-257). Tampoco reordena: la consulta ya
ordena por fecha.

Y si la lectura falla **no enseña una lista vacía**: eso afirmaría que el
paciente nunca estuvo ingresado. `null` es «no se pudo leer».

**El trinquete baja: 42 → 41** (34 envoltorios · **7** con cuerpo real).
Familia `no_conectado`, la vigésima sexta.

**Guardián.** `src/__tests__/el-expediente-ensena-los-ingresos.test.ts`, 10 casos.

**Y un tropiezo de codificación que vale la pena dejar escrito.** El guardián se
llamó primero `…enseña…`, y el sello clínico lo dio por huérfano: macOS guarda
los nombres de archivo en **NFD** y el ledger los cita en **NFC**, así que *la
misma palabra no casaba consigo misma*. No es una curiosidad del sistema de
archivos: **cualquier compuerta que compare un nombre de archivo con un texto
escrito a mano se rompe igual**. Los nombres de archivo van en ASCII.

## REG-262 — el expediente no resumía el estado del paciente (v1144)

`resumenProblemas` y `resumenVigentes` llevaban el mismo comentario —*«frase
corta para el encabezado de la consulta»*— y **ninguna tenía llamador**.

**Y el comentario pedía un sitio que no era el suyo.** En la consulta las dos
listas ya se enseñan **enteras**: una versión corta al lado de la larga no
informa, duplica. Hay un caso que deja esto escrito para que nadie lo «arregle»
moviéndolas allí.

Su sitio es el **expediente**, que es donde el charter V7 §8 dice que el médico
llega preparado —«resumen conciso, problemas activos, medicación actual»— y
donde **no había ningún resumen**: para saber qué tiene y qué toma había que
leerse la lista de notas entera. Y cuesta **cero lecturas más**: el expediente
ya tenía las notas cargadas.

**La misma proyección, no una parecida.** El `{ fecha, medicamentos,
diagnosticos }` se arma **igual** que en la consulta, y hay un caso que compara
las dos pantallas. Si aquí se construyera distinto, el mismo paciente tendría
dos «problemas activos» según desde dónde se le mire — la clase de segunda
verdad que este loop lleva reparando.

**Detalles que el motor ya hacía bien y ahora se ven:** sólo cuenta lo
**firmado** —un borrador no es historia clínica—, y con nada registrado dice
«Sin problemas **registrados**», no «sin problemas»: lo segundo afirmaría que el
paciente está sano.

**El trinquete baja: 41 → 39** (34 envoltorios · **5** con cuerpo real, uno de
ellos bloqueado en el dueño). Familia `no_conectado`, la vigésima séptima.

**Guardián.** `src/__tests__/el-expediente-resume-el-estado.test.ts`, 10 casos.

## REG-263 — el barrido se cierra: los cinco que quedan están explicados (v1145)

**Cierre del hilo que abrió REG-255.** El instrumento encontró **50** funciones
de motores clínicos sin ningún uso. En siete versiones se conectaron **once de
verdad** —la bandeja de alertas, CAM-ICU, tres motores POCUS, el oxígeno sin
declarar, la omisión de alertas críticas, los ingresos hospitalarios y los dos
resúmenes— y el número bajó a **39**.

De esos 39, **34 son envoltorios** de ≤3 líneas (REG-260). Quedan **cinco con
cuerpo real**, y **ninguno es un defecto**. Verificado uno a uno, leyendo el
código:

| Símbolo | Por qué no tiene llamador |
|---|---|
| `validarCorreccion` | **Bloqueado en el dueño**: exige una política como parámetro obligatorio y `POLITICA_CORRECCION` nace en `null` |
| `coherenteConElTipo` | Su comentario dice que se exporta «para que un caso del **golden** la ejecute», y el golden la ejecuta |
| `invariantesProtegidos` | Deriva el conjunto protegido para la **compuerta clínica**; su consumidor es esa compuerta |
| `correrBenchmark` | Arranque de un banco que **se corre a mano** y se paga |
| `obtenerVersion` | **Redundante**: `listarVersiones` ya devuelve las versiones enteras, así que restaurar no necesita una segunda lectura |

**Por qué esto es una prueba y no una nota.** Dentro de tres meses alguien —yo
incluido— va a mirar la lista, ver cinco nombres y «arreglarlos». Conectar
`obtenerVersion` añadiría una lectura de Firestore para traer lo que ya está en
memoria; conectar `validarCorreccion` exigiría inventarse la política.

**Un residuo explicado no es deuda: es una decisión.**

El guardián falla en los **dos** sentidos: si aparece un motor con cuerpo real
sin explicación, y **también si una explicación sobrevive a lo que explicaba** —
una lista de excusas que no se limpia es la forma más silenciosa de que un
guardián deje de guardar.

Y comprueba que las razones sean **verificables en el código**, no de palabra: la
constante en `null`, el golden ejecutando de verdad, y que `HistorialVersiones`
use `listarVersiones` y no `obtenerVersion`.

Familia `sin_medir`.

**Guardián.** `src/__tests__/el-barrido-de-motores-esta-explicado.test.ts`, 8 casos.

## REG-264 — el pase de UCI dictado no se repartía por aparatos (hueco 2)

**El hueco que ningún producto del mercado cubre**, y resultó ser un defecto
concreto con una causa de una línea.

De la investigación (I-12): Suki, Nabla, Abridge y DAX asumen todos una
**conversación ambulatoria de dos partes**. En UCI no hay conversación con el
paciente: el pase es un **monólogo por aparatos y sistemas**. Por eso el *Linked
Evidence* de Abridge —enlazar cada afirmación a un enunciado— no aplica ahí. Y
en los 2,5 millones de usos de Kaiser, **infectología fue de las especialidades
que MENOS lo usó**.

**La causa.** `repartirPorSistemas()` —el corazón de la nota de UCI— partía el
texto por `\n`. Correcto para un pase escrito o pegado. Pero **un pase dictado
llega como un párrafo corrido, sin un solo salto de línea**: no encontraba ni un
encabezado y el pase caía **entero en el plan**, con las secciones por aparato
vacías y sin que nadie lo dijera.

La nota por aparatos —justo lo que nadie más hace— **no corría sobre voz**.

**El arreglo, deliberadamente estrecho.** Se inserta un salto sólo cuando el
nombre del aparato aparece al principio o tras un punto **y** lleva `,` o `:`
detrás. «Respiratorio, PEEP diez» parte; «el sistema respiratorio está
comprometido» y «hemodinámicamente estable» **no**. Partir de más sería peor que
no partir: metería medio párrafo del aparato anterior en el siguiente, y eso es
**un dato clínico en la sección equivocada**.

**Dos cosas que costó encontrar, y quedan escritas:**

1. Con el salto sólo DELANTE, la línea quedaba «Neurológico, RASS menos dos…» y
   el detector la reconocía **entera como rótulo**, descartando el contenido —
   sobrevivía sólo el primer aparato. El salto va delante **y detrás**.
2. La primera versión **no era idempotente**: volvía a insertar sobre lo que
   ella misma había escrito. Un pase guardado y reprocesado se habría ido
   partiendo en pedazos. Se arregló consumiendo el separador entero.

**Y la otra mitad: decirlo cuando no se pudo.** `tuvoEstructura()` existía y no
la llamaba nadie. Ahora, si el pase vino de corrido, se explica **qué pasó y
cómo evitarlo**; y si vino por aparatos, se listan en gris los que quedaron sin
texto propio — saltarse uno en un pase focalizado es normal, no un error.

**Calla cuando todo va bien.** Un aviso que sale también con el pase bien
estructurado es ruido, y el ruido se aprende a ignorar (REG-245).

**Mi propio guardián me cazó.** Al crear `como-vino-el-pase.ts` el trinquete de
REG-255 subió: **escribí un motor y no lo conecté**, la familia que llevo toda
la sesión reparando. Conectado en el panel de UCI, el trinquete bajó a **38**.

Familia `no_conectado`, la vigésima octava.

**Guardián.** `src/__tests__/el-pase-dictado-se-reparte.test.ts`, 17 casos, con
el pase real, las cuatro trampas y la idempotencia.

---

## REG-265 — el barrido de pantalla estrecha, y el resultado incómodo (v1147)

El guardián `la-pantalla-cabe-en-un-telefono` declaraba en su propio comentario
lo que **no** podía ver: *«un `width` fijo, una tabla ancha, una imagen sin
`max-width` pasa por aquí sin despeinarse»*. Ese hueco llevaba sesiones en la
cola sin instrumento.

Ahora lo hay, para tres clases: **ancho fijo > 360 px**, **rejilla
`minmax(Npx)` sin `min()`** e **imagen sin restricción de ancho**.

**El resultado: cero.** No hay ninguna en toda la aplicación.

**Pero la primera medición dijo 23 anchos y 15 imágenes**, y ninguno era real:

| Lo que contaba de más | Por qué no es un defecto |
|---|---|
| `max-width: 540px` | La expresión casaba con la **cola** de `max-width`, que es lo contrario del defecto: es la cura |
| Receta y orden a 1000 px | Son **carta**. Ese documento no se lee en un teléfono, se imprime |
| Brazalete en `document.write` | Sale por la impresora |
| Once imágenes | Tenían `width: 100%` |
| Dos QR de 200 px | Caben de sobra en 360 |
| Un QR en `mm` | Unidad de papel: no vive en una pantalla |
| **Dos `<img>`** | Estaban **dentro de un comentario** explicando cómo se captura el membrete en el PDF |

**Es la cuarta vez en esta sesión** que un medidor mío informa de más antes de
decir la verdad: 152 motores que eran 50 (REG-255), 42 que eran 8 (REG-260), el
guardián de pautas gritando en toda la UCI (REG-245), y ahora 23 anchos que eran
cero.

**Un medidor que informa de más enseña a ignorarlo**, exactamente igual que un
aviso clínico. Por eso las exclusiones viven escritas en el script **con su
motivo**, y hay un caso por cada una: que no case con `max-width`, que excluya
impresión, que excluya milímetros, y que quite los comentarios **antes** de
mirar.

**Y lo que este barrido NO hace, escrito y comprobado:** no sustituye al
navegador. Creer que un barrido de código fuente cubre el desborde real sería el
peor resultado posible de este trabajo. Lo que quede sólo se ve **abriendo un
navegador con un teléfono emulado**.

Familia `sin_medir`.

**Guardián.** `src/__tests__/lo-que-un-telefono-no-puede-encoger.test.ts`, 9 casos.

---

## REG-266 — los pendientes de este paciente no salían en su expediente (v1148)

`tareasDePaciente()`, en `src/lib/tareas-clinicas/firestore.ts`, lleva escrito en
su comentario desde el día que se escribió:

> «Los pendientes de UN paciente, **para su expediente**.»

Y el expediente no los enseñaba. La función **no tenía un solo llamador**.

### Por qué el instrumento no lo vio, que es lo que hay que aprender

El barrido de motores sin conectar (REG-255) busca por **nombre**. Y hay otra
`tareasDePaciente` —la de turnos de enfermería, en `src/lib/uci/enfermeria.ts`—
así que el barrido veía un llamador donde no lo había.

Es el quinto medidor de esta sesión que informa mal, y el primero que lo hace
**por defecto** en vez de por exceso: 152 motores que eran 50, 42 que eran 8, el
guardián de pautas gritando en toda la UCI, 23 anchos que eran cero — y ahora
uno que se calló un hueco real por una colisión de nombres.

Por eso la prueba de conexión de esta reparación no busca el nombre: exige el
**import del módulo correcto** y prohíbe el de enfermería.

### Por qué no bastaba con `/pendientes`

El worklist existe y funciona: enseña los cabos sueltos de toda la consulta,
mezclados. Sirve para trabajar la lista un martes por la tarde.

Pero el momento en que un pendiente se resuelve es **el paciente sentado
enfrente**. Ahí «pediste una biometría hace tres semanas y el resultado lleva
nueve días sin que nadie lo lea» cambia lo que pasa en los siguientes diez
minutos. En una lista de trescientas filas, ese renglón no se encuentra.

### El orden, y que es administrativo

Primero **«resultado sin leer»** — el estado `completada`, que el propio modelo
define como «el trabajo se hizo» frente a `cerrada`, «alguien lo miró y
decidió». *Entre esas dos vive el daño que el módulo existe para evitar.* Gana
incluso a lo más vencido: un estudio que aún no se ha hecho y lleva 90 días de
retraso no es lo mismo que un resultado que ya está en el sistema y nadie ha
abierto.

Después lo vencido por antigüedad, después lo que aún tiene plazo. **Ninguna
gravedad se deduce**: la `prioridad` la puso quien creó la tarea y aquí sólo
desempata. Ordenar por tipo de estudio sí sería criterio médico.

### Lo que NO hace

- **No cierra tareas.** Cerrar es una transición del ciclo que ya valida
  `cambiarEstado`; repetir esa validación en una segunda pantalla la desalinea
  en la primera prisa. El botón lleva a `/pendientes`.
- **No enseña ceros.** Sin nada vivo, la tarjeta no aparece. Una que dijera «0
  pendientes» ocupa el mismo sitio que una que dice algo, y enseñar ceros
  entrena a no mirar — la misma lección que el aviso clínico que grita de más.
- **No lee el reloj al pintar.** El linter de pureza lo prohibió y tenía razón:
  cada repintado habría dado un reparto distinto. Se agrupa una vez, al cargar.

### Archivos

- `src/lib/tareas-clinicas/cabos-del-paciente.ts` (nuevo, puro)
- `src/components/CabosSueltosDelPaciente.tsx` (nuevo)
- `src/app/(dashboard)/expediente/[patientId]/page.tsx` (montado lo primero)
- `src/__tests__/los-cabos-sueltos-del-paciente.test.ts` (17 casos, sellado)

---

## REG-267 — v1146 se publicó anunciando un arreglo que no llevaba (v1148)

**Lo peor de esta sesión, y no es un fallo de código: es un despliegue que
mintió.**

v1146 salió a producción declarando REG-264 —el pase de UCI dictado repartido
por aparatos, el hueco 2 de la investigación de mercado— y **no lo llevaba**.

El commit del arreglo (`c56c9eda`) quedó en `backup/uci-before-v9-routine`, una
rama que la otra rutina creó sobre el mismo directorio de trabajo. El commit de
despliegue se hizo sobre la línea de V7, que no lo contenía. El `sw-changelog` lo
daba por publicado; el mensaje del commit lo daba por publicado; el arreglo no
estaba en ninguna parte del árbol desplegado.

Se descubrió **dos versiones después, por casualidad**, buscando otra cosa.

### Por qué ninguna compuerta lo vio

Todas las que existían miran el árbol **contra sí mismo**:

- el sello clínico exige que cada fichero sellado esté reclamado por el ledger —
  pero el fichero de pruebas de REG-264 se fue con el código a la rama lateral,
  así que no había nada sellado que reclamar;
- la compuerta de familias exige que cada REG del ledger tenga familia — pero
  REG-264 tampoco estaba en el ledger, por lo mismo.

**Un conjunto coherente al que le falta una pieza ENTERA sigue siendo
coherente.** Faltaban el código, su prueba, su entrada y su familia — las cuatro
a la vez, que es justo lo que hace invisible el hueco. Nadie comparaba *lo que el
changelog anuncia* con *lo que el repositorio contiene*.

### Lo que se hizo

1. **Recuperado** `c56c9eda` a la rama de V7. REG-264 existe por fin: 14 casos
   sellados, la nota de UCI se reparte por aparatos sobre voz.
2. **Nueva compuerta** `una-version-desplegada-no-miente`: todo REG citado en el
   changelog tiene que existir en el ledger; `sw.js` y `version.txt` tienen que
   coincidir; la versión en curso tiene que estar declarada; ningún fichero
   sellado puede faltar del disco.
3. **Comprobada contra el defecto real**: retirando REG-264 del ledger, falla
   con el texto exacto *«v1146 anuncia REG-264 y el ledger no lo tiene»*.

### Y de paso, una cifra que se publicaba mal

`scripts/data-room/actualizar-cifras.mjs` contaba **encabezados** en vez de REG,
así que `## REG-179 / REG-180` valía uno: la sala de datos publicaba **113 donde
hay 114**. Su propia prueba usaba la misma expresión equivocada, de modo que los
dos instrumentos se confirmaban mutuamente. Que el error fuera a la baja no lo
hace inocuo: un documento que se enseña a un comprador tiene que cuadrar en las
dos direcciones.

### La lección

**Dos programas no comparten un directorio de trabajo.** V7 y V9 se separaron en
ramas distintas justo *una versión después* de que esto ocurriera. Y las
compuertas que sólo miran hacia dentro no detectan lo que falta entero: hace
falta al menos una que compare lo declarado con lo que hay.

### Archivos

- `src/__tests__/una-version-desplegada-no-miente.test.ts` (nuevo, 4 casos, sellado)
- `scripts/data-room/actualizar-cifras.mjs` (cuenta REG, no encabezados)
- `src/__tests__/la-sala-de-datos-no-infla.test.ts` (misma corrección)
- Recuperado a la rama de V7: `src/lib/uci/como-vino-el-pase.ts`,
  `src/lib/uci/reparto-sistemas.ts`, `src/__tests__/el-pase-dictado-se-reparte.test.ts`

---

> **Los dos que siguen venían numerados 265 y 266 por el programa V9.**
> Esos números ya estaban tomados por reparaciones desplegadas en v1147 y
> v1148, así que se renumeran a 268 y 269. Es la tercera consecuencia de que
> dos programas compartieran un directorio de trabajo: la primera fue
> REG-267 (un despliegue que anunció lo que no llevaba) y la segunda, esta
> colisión. El texto va tal cual lo escribió V9, sólo con los números
> corregidos.

---

## REG-268 — El enlace de la videoconsulta del paciente no llevaba con qué entrar

**Encontrado por** la auditoría de superficie del paciente de
`PATIENT-UX-TRUTH-001` (V9), siguiendo el enlace desde donde se construye hasta
donde se valida.

**Qué pasaba.** `enlaceSalaPaciente()` componía
`/teleconsulta/<citaId>?c=<clinicId>` y nada más. Del otro lado,
`/api/telesalud/sala` exige **una de dos** pruebas de titularidad: el token HMAC
del paciente (`?t=`), o una sesión de miembro con `clinico.leer`. El paciente no
tiene sesión, y el enlace no le daba token — así que caía en la rama de rechazo,
que devuelve **404 «Cita no encontrada»** a propósito, para no confirmarle a un
desconocido que ese `citaId` existe.

El paciente pulsaba «Entrar a la videoconsulta» **dentro de su propio portal**
—donde el token estaba en la barra de direcciones, a un `search.get('t')` de
distancia— y la aplicación le decía que su cita no existe. En la hora de su
consulta.

**Causa raíz.** La defensa funcionaba perfectamente. Lo que estaba mal es que se
le aplicaba **al dueño de la cita**, porque el enlace no transportaba la
credencial que la propia aplicación ya tenía en la mano.

**Por qué nadie lo vio.** El botón del médico en `(dashboard)/citas` **sí** añade
`&t=`, con un token que emite `/api/telesalud/token`. Sólo fallaba el camino que
**ningún empleado recorre**. Y las pruebas que había mockeaban
`verificarTokenPaciente`, es decir, daban por bueno justo el dato que nunca
llegaba.

**Familia.** `el_dato_tiene_que_llegar` — igual que REG-167, REG-170 y REG-160.
El enlace se construía, se enviaba y se abría; lo que no llegaba era la
credencial que lo hace funcionar del otro lado.

**Arreglo.** El token es un parámetro **obligatorio** de `enlaceSalaPaciente`:
opcional, el defecto reaparecería en el siguiente llamador que lo olvide, en
silencio. Obligatorio, el compilador obliga a cada llamador a decidir — y de
hecho `tsc` cazó al instante el único otro llamador. El portal pasa su propio
token. Y `dondeEsLaCita` **no emite enlace sin token**: un paciente sin enlace
llama al consultorio; un paciente con un 404 cree que se quedó sin cita.

**Lo que NO cierra.** El enlace que viaja por WhatsApp (`api/cron/reminders`,
webhook) sigue sin token porque hoy no se acuña ahí. Desde este cambio manda
«recibirás el enlace» en vez de un enlace roto: honesto, pero todavía sin enlace.
Abierto como `PATIENT-TELE-002` (P0) en el backlog.

**Guardián.** `src/__tests__/enlace-de-videoconsulta-lleva-token.test.ts`,
7 casos. Probado al revés: emitiendo el enlace sin token, falla.

---

## REG-269 — `@keyframes spin` no existía en ningún sitio global

**Encontrado por** la auditoría del sistema de diseño de
`PATIENT-UX-TRUTH-001` (V9), contando fotogramas definidos contra referenciados.

**Qué pasaba.** `animation: 'spin 1s linear infinite'` se referencia **90 veces**,
incluidas las dos piezas **compartidas** del sistema de diseño:
`components/ui/Spinner.tsx` (27 usos) y el estado `loading` de
`components/ui/Button.tsx` (58 usos). El fotograma no estaba en `globals.css` ni
en ningún otro CSS global. Tailwind v4 tampoco lo emitía: sólo genera su `spin`
si aparece la utilidad `animate-spin`, y aquí se usa **cero** veces.

Lo definían —cada uno por su cuenta, en una etiqueta `<style>` local— **31
archivos de pantalla**. Y una `<style>` renderizada es global al documento: el
giro funcionaba mientras alguna de esas 31 estuviera montada, y se congelaba en
cuanto el médico caía en otra.

**Por qué no es cosmético.** Un indicador de carga parado no dice «esperando»:
dice «se colgó». El médico vuelve a pulsar «Procesar con IA» sobre una petición
que sí estaba corriendo. La señal de progreso es la única defensa contra el doble
disparo.

**Familia.** `el_sistema_se_contradice_a_si_mismo` — el componente compartido
está bien, y las 31 pantallas están bien; lo que está mal es la relación entre
ellos, y por eso ninguna revisión de una sola pieza lo encuentra. Misma familia
que el azul que servía de texto y de relleno con requisitos opuestos.

**Arreglo.** El fotograma vive en `globals.css`, una vez, con su explicación. Los
31 `<style>` locales se quedan: son inofensivos y su barrido es de
`DESIGN-SYSTEM-001`.

**Guardián.** `src/__tests__/toda-animacion-tiene-su-fotograma.test.ts`, 3 casos.
Un archivo que referencia una animación tiene que definirla él o encontrarla en
`globals.css`; y `components/ui/` no puede definirla localmente, porque un
primitivo compartido se monta donde sea. Probado al revés: quitando el bloque de
`globals.css`, los tres casos caen.

**Y el guardián se equivocó dos veces antes de acertar**, lo cual merece
registrarse: leer el primer identificador tras `animation:` capturaba la
condición de un ternario (`voz`), y leer toda cadena entrecomillada capturaba un
valor comparado (`'grabando'`). Exigir que la cadena traiga duración distingue
las tres cosas. **Un guardián que grita de más se acaba silenciando** — REG-245.

---

> **Venía numerado REG-211 por la rutina `SAFE-005`.** Ese número ya estaba
> ocupado desde v1092 («creo que me dijeron que tenía anemia»). Cada rutina
> numeraba contra el `main` que veía; ésta es la cuarta colisión del mismo
> origen (ver REG-267). El texto va tal cual, con el número corregido.

---

## REG-270 — el «>2» del laboratorio se leía como un 2 (v1151)

**Encontrado** — 8-ago-2026, revisando por qué `cmiDe` no propagaba
`cmiCensurada` cuando el módulo de al lado sí lo respeta desde la REG-044.

**El defecto** — Una CMI **es un intervalo, no un número**: es la decisión
E0-15c del médico dueño y es la que gobierna `interpretarCMI` desde la REG-044.
`cmiDe` (`antibiograma/util.ts`) devolvía `r.cmi` **pelado** y tiraba
`r.cmiCensurada`, así que los fenotipos de Gram positivos leían el mismo panel
sin el operador. **El motor de puntos de corte lo respetaba y el de fenotipos
no, sobre el MISMO resultado.**

**Cómo se reprodujo** — Con `interpretarAntibiograma`, el motor completo, no la
función suelta. Tres salidas medidas antes de tocar una línea:

| Reporte del laboratorio | Lo que salía | Lo que dijo el laboratorio |
|---|---|---|
| Neumococo, penicilina **«>2»**, foco no meníngeo | «CMI 2 ≤2 → **tratable con penicilina parenteral a dosis altas**» | La CMI está POR ENCIMA de 2 (I 4 · R ≥8) |
| SARM, vancomicina **«>2»** | «sospecha de hVISA (**límite alto de S**)» | Por encima de 2 → eficacia reducida |
| E. faecium, daptomicina **«>4»** | nada: ni fenotipo, ni alerta, ni advertencia | Por encima de la banda utilizable (SDD ≤4) |

Y en el otro sentido, el «<» sobre-avisaba: un tamiz de gentamicina de alto
nivel reportado **«<500»** declaraba HLAR, y con él se abandona la sinergia
β-lactámico + aminoglucósido en una endocarditis.

**Por qué importa para un paciente** — La primera fila es la peor: es una frase
que el médico lee como permiso, impresa en la nota, con el número que la niega
al lado. Un neumococo con penicilina «>2» tratado con penicilina a dosis altas
es una neumonía que no responde. La tercera es la contraria y también duele: el
silencio de un motor que sí sabe hablar se lee como «no hay nada que decir».

**Reparación** — `cmiDe` **desaparece**; mientras exista una forma de pedir «el
número», alguien la volverá a usar. En su lugar, `cmiConCensuraDe` devuelve el
intervalo y tres predicados escritos **en positivo** lo interrogan:
`cmiAlcanza`, `cmiSupera`, `cmiNoPasaDe` — los tres devuelven `false` cuando la
respuesta es «no se sabe», y `cmiIndeterminadaEn` es la que lo dice. Con un
valor exacto los predicados reparten todo el rango y **nada cambia**; sólo el
operador altera el resultado.

**Ningún punto de corte nuevo** — Los umbrales (0,06 · 2 · 4 · 16 · 8 · 500)
ya estaban en el módulo, citados a Torres & Cercenado 2010 y CLSI M100. Y **no
se sube nada a R**: con «>» y el valor en el techo de S, S es imposible, pero el
valor real puede quedar en la banda intermedia — subirlo sería inventar en la
otra dirección. Es la misma regla de la REG-044, palabra por palabra.

**Lo que hace cuando no sabe** — Lo dice y pide dilución, con el operador a la
vista. Es el §6 de la regla clínica: se pregunta, no se adivina. Se declara para
«>», que es la dirección que ESCONDE resistencia; con «<» el efecto es que una
alerta falsa deja de salir, y ésa no hay que anunciarla.

**Qué NO hace** — No inventa la CMI real ni decide por el médico. Un «<» por
encima de los umbrales (vancomicina «<16», que podría ser un 8 = VISA) deja al
módulo callado: se prefiere el silencio a inventar una banda, y la categoría del
laboratorio se sigue mostrando aparte. Sólo cubre `grampositivos.ts` — los Gram
negativos leen la CMI por `interpretarCMI`, que ya respeta el operador.

**Qué queda para el médico** — Decidir si un «>» que cae dentro de la banda
intermedia debe además bloquear la firma de la receta con ese fármaco. Hoy
advierte y no bloquea.

**Comprobado que puede ponerse rojo** — Reintroducido el defecto en
`cmiConCensuraDe` (devolver `{ valor }` sin el operador): **8 de los 20 casos
fallan**.

**Golden** — `src/__tests__/la-cmi-censurada-no-se-lee-como-exacta.test.ts`
(20 casos).

---

## REG-271 — «No, sí tengo» quedaba registrado como que el paciente lo negó (v1151)

**Encontrado** por la rutina `NEG-002` en su rama. **Reproducido aquí antes de
absorber nada**, sobre el árbol que corre en producción, con `respuestaNiega` de
verdad. Las cinco formas se leían como negación:

| Respuesta | Lo que hacía |
|---|---|
| «No, sí tengo.» | NIEGA |
| «No, sí padezco» | NIEGA |
| «no, claro que sí» | NIEGA |
| «No, así es» | NIEGA |
| «No, efectivamente» | NIEGA |

### Por qué es de los peores

El daño va en la dirección mala. El paciente **afirma** que padece la
enfermedad, el expediente registra que la **negó**, y después
`corregirCertezaPorNegacion` la reclasifica a `descartado`. La pantalla de
contradicciones no salta: para ella todo cuadra.

Es el gemelo de «no sé» —que ya estaba resuelto— y el reverso de REG-251: allí
el panel certificaba en verde lo contrario de lo dictado; aquí el motor
convierte un sí en un no antes de que nadie lo mire.

### La causa, en una línea

`NEGATIVAS` sólo mira el **arranque** de la respuesta. Y el arranque no siempre
es lo que se contestó.

### El fin de palabra, que no es `\b`

`\b` de JavaScript trabaja sobre `\w`, que es ASCII: entre «í» y el final de la
cadena **no hay frontera de palabra**. Un `/s[ií]\b/` no casaría con «no, sí».
Es la misma trampa que ya tuvo apagado el guardián de «No sé.» sin que su regla
pareciera mal escrita leyéndola. Se mira hacia delante por letra:
`(?![a-záéíóúüñ])`.

### Las dos direcciones se sostienen

Perder una negación deja un antecedente sin descartar; fabricarla descarta uno
real. Las siete negaciones legítimas siguen contando, y «No, **sino** la de mi
hermana» sigue negando — el guardián mira por letra, no por frontera.

### Archivos

- `src/lib/expediente/negaciones.ts` (`NO_CORRECTIVO`)
- `src/__tests__/el-no-que-corrige-afirma.test.ts` (nuevo, 17 casos, sellado)


---

> **Las cuatro que siguen vienen de rutinas autónomas** que numeraron contra
> el `main` que veían. Sus números ya estaban ocupados; se renumeran y el texto
> va tal cual lo escribió cada una. Todas traían su golden, y el golden pasa
> sobre este árbol — que es la condición para absorberlas.

---

## REG-272 — la sección bien escrita compraba el silencio de la mal escrita (v1151)

**Encontrado** — 8-ago-2026, leyendo `desajustesTemporales` al ir a por EVAL-002
(«el motor de temporalidad no tiene corpus»). No salió de un reporte: salió de
mirar la línea.

**El defecto** — Los dos motores que contrastan el dictado contra la nota
—`contradicciones` (negaciones, REG-153) y `desajustesTemporales` (temporalidad,
v1027-v1030)— buscaban el término con `t.indexOf(forma)`: **la primera aparición
y sólo ésa**. Si esa primera venía escudada —«niega diabetes», «antecedente de
neumonía»—, la condición se descartaba entera y el resto de la nota no se miraba
nunca.

**Cómo se reprodujo** — Con los motores reales, antes de tocar nada, sobre una
nota sintética con la forma que tiene una nota bien estructurada:

```
Antecedentes personales patológicos: neumonía en 2019, manejada de forma
ambulatoria con amoxicilina durante siete días.
Impresión diagnóstica: neumonía adquirida en la comunidad.
```

`desajustesTemporales(mencionesEnPasado('Tuvo neumonía hace tres años.'), nota)`
devolvía `[]`. Lo mismo con «niega hipertensión» arriba y «hipertensión arterial
sistémica» en la impresión diagnóstica: `contradicciones` devolvía `[]`.

**Por qué importa para un paciente** — El reparto es el peor posible: la mención
que se callaba es **la que manda**. Un antecedente no cambia la conducta de hoy;
una impresión diagnóstica sí, y es la que se arrastra a la nota siguiente y la
que otro médico lee dentro de seis meses. El paciente que negó la diabetes salía
con diabetes escrita como diagnóstico, y el único motor que podía cazarlo ya se
había dado por satisfecho renglones antes — precisamente **porque** la nota había
hecho bien la otra mitad.

**Y era la misma línea copiada dos veces** — El caso oro de la v1035 ya lo decía
con todas sus letras: «lo mismo para el motor de temporalidad, que copió la misma
línea». Es el patrón de REG-180 y REG-184: se repara una copia y la otra sigue
viva. Por eso el criterio se saca a `src/lib/expediente/mencion-en-la-nota.ts` y
los dos motores lo importan — una tercera copia era cuestión de tiempo.

**Reparación** — `primeraMencionSinEscudo` recorre todas las apariciones de todas
las formas, en orden de aparición, y devuelve la primera cuyo contexto previo no
traiga el escudo. Un aviso por condición, como antes.

**Sólo puede señalar de más, nunca de menos** — La ventana de 60 caracteres no se
toca y cada aparición se juzga con exactamente el mismo criterio que antes. Una
mención que el sistema consideraba bien escrita la sigue considerando bien
escrita; lo único que cambia es que ahora también mira las siguientes.

**Qué NO hace** — La ventana **sigue cruzando el punto**: un «niega diabetes.» al
final de una oración escuda a la palabra que caiga en los primeros 60 caracteres
de la siguiente. Es un escudo prestado y sigue vivo. Acotarlo a la oración
rompería la nota con encabezado de sección (`Antecedentes:\nNeumonía…`), que es
igual de común, así que no se arregla a ojo: queda como **TEMP-001** en el
backlog, para medirlo antes de tocarlo.

Tampoco amplía el vocabulario: lo que no está en `CRONICAS` ni en
`AGUDAS_FRECUENTES` sigue sin vigilarse, y así está declarado allí.

**Qué queda para el médico** — Lo mismo que antes: los dos motores señalan, no
deciden. Puede que la nota tenga razón y el interrogatorio no.

**Comprobado que puede ponerse rojo** — Revertidos los dos motores, el golden
falla en sus tres casos (los dos de comportamiento y el estructural).

**Golden** — `src/__tests__/la-seccion-buena-no-compra-el-silencio.test.ts` (14
casos).

*(venía como REG-192 en `agent/clinical/REG-192`)*

---

## REG-273 — «Niega alergia a penicilina» disparaba la alerta de alergia (v1151)

**Encontrado** — 7-ago-2026, siguiendo el camino del campo de alergias hasta su
último consumidor. REG-144 unificó cuatro parsers en `alergenosDe` y dejó un
guardián para impedir el quinto. El guardián buscaba un `split` a mano; el
consumidor que faltaba **no partía el campo en absoluto**.

**El defecto** — `alergiaVsReceta` (`src/lib/expediente/copiloto.ts`), el cruce
alergia↔fármaco, normalizaba el campo **entero** y buscaba el fármaco dentro con
un `includes`, con un limpiador propio de palabras de negación.

La negación va pegada a UN alérgeno; el `includes` los mira todos a la vez. Por
eso el limpiador no podía funcionar por muchas palabras que se le añadieran: en
«Niega alergia a penicilina» sobra «a penicilina» después de limpiar, así que la
comprobación seguía viva y el campo seguía conteniendo la palabra.

**Cómo se reprodujo** — Con el motor real, antes de tocar nada, sobre nueve
frases de consultorio. **Cuatro daban una crítica falsa** y `alergenosDe`
acertaba en las nueve:

```
"Niega alergia a penicilina"          + Amoxicilina  → critico   (debía callar)
"No refiere alergia a penicilina"     + Amoxicilina  → critico   (debía callar)
"Niega alergia a sulfas"              + TMP/SMX      → critico   (debía callar)
"Sin alergia a AINEs"                 + Ketorolaco   → critico   (debía callar)
"Niega penicilina. Alérgico a sulfas" + Amoxicilina  → critico   (debía callar)
"Niega penicilina. Alérgico a sulfas" + TMP/SMX      → critico   ✓
"Alérgico a penicilina"               + Amoxicilina  → critico   ✓
"Sulfas; no refiere otras"            + TMP/SMX      → critico   ✓
"Alergia a ketorolaco"                + Ibuprofeno   → critico   ✓
```

El campo con una negada y una real es el que lo prueba: **las dos** familias
saltaban, porque el campo entero contiene las dos palabras.

**Por qué importa para un paciente** — El aviso de alergia es de los que **no se
pliegan** (`avisos-consulta.ts`), y es la decisión correcta: es lo más grave de
esa pantalla. Un aviso que no se puede cerrar y que además es falso deja al
médico una sola salida para poder trabajar: **borrar el texto del expediente**.
Es literalmente el desenlace que la cabecera de `alergias.ts` describe como el
fallo a evitar, cometido otra vez por un consumidor distinto.

Y el daño no se queda en ese paciente: una crítica roja que sale donde no debe
enseña a ignorar las críticas rojas. La siguiente sí será real.

**Reparación** — El cruce lee el campo **alérgeno por alérgeno**, por
`alergenosDe`, que es el único sitio donde vive cómo se parte el campo y qué
fragmento está negado. De paso entra `alergiasEstructuradas`: hoy no lo llena
ninguna ruta de escritura, pero cualquier importación desde otro sistema lo
activa el mismo día, y hasta ahora el paciente **mejor documentado** era el
único sin cruce. La consulta se lo pasa al motor.

**El guardián, ampliado por su punto ciego** — El de REG-144 buscaba un quinto
`split`; el nuevo busca lo otro: un consumidor que trate el campo como una sola
cadena, que es el mismo defecto hecho más grande. Y `copiloto.ts` entra en la
lista de llamadores de `un-solo-parser-de-alergias.test.ts`, que es donde se
mira quién lee este campo.

**Qué NO hace** — No toca `FAMILIAS_ALERGIA`: los mismos disparadores, los
mismos miembros, la misma precaución de carbapenémicos (≈1 %). No cambia el
nivel del aviso ni qué bloquea la firma — eso lo decidió el médico dueño
(REG-181). No juzga la reacción previa: un rash y una anafilaxia siguen entrando
igual.

**Qué queda para el médico** — Distinguir la gravedad de la reacción previa
sigue siendo decisión suya (C-3 en `OWNER_DECISIONS_REQUIRED.md`). Y un negador
que no esté en la lista de `alergias.ts` («descarta alergia a…») haría falta
añadirlo ahí: la prueba lo vería fallar, no lo adivinaría.

**Comprobado que puede ponerse rojo** — Revertido el arreglo, 8 de los 14 casos
fallan; restaurado, los 14 pasan.

**Golden** — `src/__tests__/la-alergia-negada-no-es-una-alergia.test.ts`
(14 casos).

*(venía como REG-208 en `agent/safety/SAFE-004`)*

---

## REG-274 — el redondeo del motor renal se comía las alertas del borde (v1151)

**Encontrado** — 8-ago-2026, auditoría del módulo `funcion-renal.ts` (ningún ítem
pendiente del backlog era reproducible: SAFE-001 y VOICE-004 ya estaban cerrados
en el árbol y los EVAL-xxx siguen bloqueados por el corpus del dueño).

**La pista** — La asimetría estaba escrita en el propio archivo. `ckdEpi2021`
lleva un comentario que dice, por decisión del Dr. (L6), que devuelve **precisión
completa** «porque un `Math.round` interno podía cambiar clasificaciones,
comparaciones o cálculos posteriores». Tres funciones más abajo,
`cockcroftGault` —que es el que de verdad alimenta los umbrales de dosis, porque
`evaluarFuncionRenal` lo prefiere sobre CKD-EPI cuando hay peso— terminaba en
`return cantidad(Math.round(crcl), …)`.

**El defecto** — Ese entero era el número que `ajusteRenalFarmacos` comparaba
contra los 18 umbrales de `REGLAS_RENALES`. Toda depuración en
`[umbral − 0.5, umbral)` se redondeaba **hacia arriba** hasta el umbral exacto, y
`crcl < umbral` pasaba de verdadero a falso. La ventana ciega existía en los
cuatro umbrales del catálogo a la vez (30, 40, 50 y 60 mL/min).

**Cómo se reprodujo** — Con el motor real, antes de tocar nada. Paciente
sintético: hombre de 80 años, 64 kg, creatinina 1.8 mg/dL.

```
CrCl real (Cockcroft-Gault) = (140−80) × 64 / (72 × 1.8) = 29.6296 mL/min
CrCl que devolvía el motor  = 30
ajusteRenalFarmacos([metformina, nitrofurantoína]) → []   ← cero alertas
```

**Por qué importa para un paciente** — Ese señor no es un extremo de
laboratorio: es un anciano delgado de consultorio, con la creatinina justo donde
metformina deja de poder darse (contraindicada por acidosis láctica con CrCl<30)
y donde nitrofurantoína ni siquiera alcanza concentración útil en orina. El
sistema callaba **precisamente en el borde**, que es donde el médico más
agradece que algo hable. Y callaba en silencio: no había aviso de que el número
se hubiera redondeado.

**Reparación** — Se movió el redondeo de donde se calcula a donde se pinta, que
es la regla que CKD-EPI ya seguía:

1. `cockcroftGault` devuelve precisión completa.
2. `ajusteRenalFarmacos` **compara con el valor completo y escribe el
   redondeado** (`crclTexto`), así que ni un mensaje cambió de texto.
3. La receta redondea al mostrar el CrCl, igual que ya hacía con la TFG. En
   pantalla se ve el mismo entero de siempre.

**Ningún umbral, mensaje ni fármaco cambió.** No se inventó ninguna cifra
clínica: los 18 umbrales de `REGLAS_RENALES` son los que ya estaban y siguen
siendo decisión del médico.

**Qué NO hace** — No opina sobre si debe alertarse cuando la base es la TFG
indexada en vez de la depuración (sigue siendo la Q2 abierta con el Dr.). No
alerta «por cercanía»: un CrCl real de 30.4 sigue sin alertar, y debe seguir
así. Y no vigila los demás motores que redondean por dentro — si alguno compara
contra un umbral con el valor ya redondeado, tiene este mismo defecto.

**Qué queda para el médico** — Decidir si un CrCl al borde del umbral (dentro de
±1 mL/min) merece un aviso propio de «estás en la frontera», que es una política
clínica, no un arreglo de software. Anotado en `OWNER_DECISIONS_REQUIRED.md`.

**Comprobado que puede ponerse rojo** — Restaurado el `Math.round` dentro del
motor: 4 de los 25 casos del golden fallan, incluido el de las dos alertas
perdidas. Restaurado el arreglo: 25/25 en verde.

**Golden** — `src/__tests__/el-redondeo-no-cruza-el-umbral-renal.test.ts`
(7 casos declarados, 25 ejecutados).

*(venía como REG-214 en `agent/renal/REN-001`)*

---

## REG-275 — lo que el paciente NIEGA puntuaba en STOP-BANG (v1151)

**Encontrado** — 8-ago-2026, repasando los hallazgos crudos del barrido de
auditoría (`docs/audit/hallazgos-crudos-workflow.json`) contra el código de hoy.
El reporte señalaba una sola frase —«niega presión alta»—; al pasarle al motor
real las cuatro preguntas del interrogatorio, negadas de las formas en que se
dictan, **las cuatro salieron en `true`**.

**Cómo se reprodujo** — `extraerStopBang()` directo, sin mocks, con las frases
tal cual salen del dictado. Antes del arreglo:

```
"niega presión alta"          → { pressure: true }
"sin hipertensión arterial"   → { pressure: true }
"no tiene hipertensión"       → { pressure: true }
"descarta HTA"                → { pressure: true }
"niega somnolencia diurna"    → { tiredness: true }
"la esposa niega apneas obs." → { observed: true }
"no ronca fuerte"             → { snoring: true }
```

**El defecto** — Los cuatro ítems que se preguntan de viva voz —ronquido,
somnolencia diurna, apneas presenciadas e hipertensión— se marcaban **con sólo
mencionar el término**. El único guardián era el literal
`!/niega (hipertension|hta)/`, que cubría una forma de negar y dejaba pasar las
otras cuatro: «niega **presión alta**», «**sin** hipertensión», «**no tiene**
hipertensión», «**descarta** HTA». Los otros tres ítems no tenían guardián de
ninguna clase.

Y dos funciones más abajo, **en este mismo archivo**, Caprini ya llamaba a
`estaNegado()` por exactamente este motivo. STOP-BANG se había quedado fuera: no
faltaba el motor de negación, faltaba usarlo.

**Por qué importa para un paciente** — Un varón de 58 años que **niega las cuatro
preguntas** salía con **5/8 — riesgo Alto**, que imprime «considerar
polisomnografía y valoración por neumología/medicina del sueño, precauciones de
vía aérea, minimizar opioides y sedantes, oximetría continua posoperatoria». Con
los cuatro puntos fabricados retirados puntúa **1/8 — Bajo**.

No es un aviso de más: es un dato **inventado** que alimenta una escala
determinista y sale impreso como conducta perioperatoria. Y la casilla llega
**palomeada** a la pantalla del preoperatorio: al médico le toca notar que sobra,
que es mucho más difícil que notar que falta.

**Reparación** — `extraerStopBang()` pasa al mismo motor de negación que el resto
del archivo: `marcarSegunNegacion()` sobre `estaNegado()`. Una sola fuente de
verdad para «lo negado no se documenta como presente», en vez de un guardián
literal por ítem — que es como se llegó aquí.

**El ronquido lleva un negador propio** — Es el único de los cuatro cuyo término
es un **verbo**. `NEGADORES` cubre «no tiene / no presenta / no refiere» porque
los demás términos clínicos son sustantivos; «no ronca fuerte» es como se dicta y
casaba con el patrón de ronquido fuerte. Se resuelve en el módulo que tiene la
semántica del ítem, no ampliando `NEGADORES` para todo el expediente.

**Lo negado se escribe `false`, no se deja vacío** — Un antecedente que el
paciente negó es un dato, igual que ya hacía el ronquido. **No enciende la escala
en la nota**: `capturado()` en `PreopAssessment` descarta los `false`, así que una
valoración donde el paciente lo negó todo sigue sin imprimir el renglón de
STOP-BANG. Si el médico quiere dejar constancia del negativo, palomea; no se
decide por él.

**Ningún umbral nuevo** — Los cortes de la escala (≤2 Bajo, 3-4 Intermedio, ≥5
Alto) son los de `calcularStopBang`, sin tocar.

**Qué NO cubre** — No amplía `NEGADORES`: siguen sin reconocerse «lo dudo», «para
nada», «que yo sepa no». No toca IMC, cuello, sexo ni edad, que salen de una
cifra y no de una respuesta negable. **Queda para el médico** la casilla: el
extractor prellena, la valoración la firma él.

**Comprobado que puede ponerse rojo** — Revertido `parser-clinico.ts`, el golden
falla en **13 de sus 21 casos**.

**── LA REVISIÓN INDEPENDIENTE ENCONTRÓ UNA REGRESIÓN DE ESTA MISMA REPARACIÓN ──**

Una revisión adversarial del PR corrió el motor —no razonó— y levantó tres cosas.
La primera era **de la reparación misma**, y en la dirección contraria al defecto
que venía a cerrar:

`marcarSegunNegacion` miraba **una sola aparición** (`texto.match`), que es lo
que hace el resto del archivo. El flag se congelaba en la primera y la segunda
mención no se miraba nunca. Patrón real: interrogatorio negativo arriba, lista de
problemas y medicación abajo.

```
"Niega presión alta. Hipertensión arterial en tratamiento con losartán."
   main → { pressure: true }      la v1 de este PR → { pressure: false }
```

**El hipertenso documentado y tratado dejaba de puntuar.** Reproducido en los
cuatro ítems, no sólo en la presión: «Niega roncar. Ronca fuerte tras puertas
cerradas» daba `snoring: false`.

**Reparado** — se miran **todas** las apariciones y **gana la afirmación**:
ausencia de dato no es dato de ausencia, y que en un renglón se niegue no borra
lo escrito en otro. Con esa regla el módulo nunca marca `false` donde antes había
`true`, salvo cuando TODAS las menciones están negadas — que es justo el defecto
original.

**Segundo hallazgo, también reparado** — «sin apneas observadas pero con
somnolencia diurna» daba la somnolencia por negada: la ventana de `estaNegado()`
llegaba hasta el «sin» de la frase anterior. Ahora **«pero» cierra la cláusula
negativa igual que el punto**. Los afirmadores ya cerraban «pero refiere» y «pero
tiene»; lo que fallaba era el «pero con», sin verbo. **No se corta en la coma**:
una enumeración («niega diabetes, hipertensión, tabaquismo») niega todos sus
elementos, y cortar ahí dejaría vivos los que van después del primero. Es el
único cambio de este REG que toca el motor compartido; las 6 949 pruebas
restantes lo arbitran en verde.

De paso, «nunca ronca fuerte» y «jamás ronca fuerte» fabricaban punto en `main` y
en la v1. El negador **pegado** al término se resuelve aparte de `NEGADORES`:
«no» y «nunca» a secas serían demasiado anchos para todo el expediente, pero
pegados al término no tienen otra lectura.

**Tercer hallazgo — NO reparado, declarado** — El interrogatorio en formato
**pregunta-respuesta** sigue fabricando los cuatro puntos:

```
"¿Ronca fuerte? No. ¿Tiene somnolencia diurna? No. ¿Tiene presión alta? No."
   → { snoring: true, tiredness: true, pressure: true }
```

Falla **igual en `main`**: no es una regresión de esta reparación, es el mismo
defecto por otra puerta — y probablemente la forma más común de dictar ESTE
interrogatorio. No se repara aquí porque exige que el motor de negación entienda
la pareja pregunta/respuesta, que es un cambio del expediente entero y que ya
tienen en curso otras ramas (NEG-001, NEG-002, SAFE-003). Reimplementarlo por
tercera vez es exactamente lo que OPS-003 pidió dejar de hacer. **Queda con una
prueba que fija el estado conocido** —se pondrá roja el día que alguien lo
repare, que es lo que se busca— y como `SAFE-007` en el backlog.

**Golden** — `src/__tests__/lo-negado-no-puntua-en-stop-bang.test.ts` sube de 21 a
**31 casos**. Comprobado que puede ponerse rojo por partida doble: **18 de 31**
caen contra `main`, y los **6 casos nuevos** caen contra la v1 de este mismo PR.

*(venía como REG-218 en `agent/safety/SAFE-006-stopbang-negacion`)*

---

## REG-276 — «Niega alergias a penicilina y sulfas» registraba una alergia a sulfas (v1152)

**Encontrado** por la rutina `SAFE-002`. **Reproducido aquí antes de absorber
nada**, sobre el árbol de producción, con `parsearAlergiasTexto` de verdad:

| Campo de alergias | Lo que devolvía |
|---|---|
| «Niega alergias a penicilina y sulfas» | `['sulfas']` |
| «Niega alergia a penicilina, sulfas y AINEs» | `['sulfas', 'AINEs']` |
| «Alérgico a penicilina y sulfas» | `['Alérgico a penicilina', 'sulfas']` |

Las dos primeras son **alergias que nadie afirmó**. La tercera es el daño de
«SMX)» por otra puerta: un alérgeno con la frase pegada no casa con ningún
fármaco del catálogo, y el cruce alergia↔medicamento **puede no dispararse
justo con el que importa**.

### La causa

El negador se escribe **una sola vez**, en el primer fragmento, y `SEPARADORES`
partía también por « y » y por coma. El resto de la enumeración salía del
separador ya sin la negación que lo cubría.

### Por qué es de los caros

Una alergia que nadie afirmó **apaga el botón de Firmar**, se imprime en el
recuadro rojo de la receta que va a la farmacia, y se sella dentro de una nota
firmada, que es inmutable. En un consultorio de infectología una etiqueta falsa
de betalactámicos o de sulfas empuja a segunda línea: **peor tratamiento por un
dato inventado**.

Y al médico le dejaba como única salida la que este repositorio ya documenta
como el fallo a evitar: borrar el texto del expediente, perdiendo a la vez el
dato y la compuerta.

### La regla: dos niveles y dos cortes

El campo tiene dos niveles, y se parte por los dos:

- **oración** — un punto, un punto y coma o un salto **cierran** el alcance;
- **lista** — dentro de una oración, la coma, « y » y « ni » enumeran y heredan
  la negación del principio.

Y el alcance se rompe además cuando un fragmento **afirma**: «Niega alergia a
penicilina, **alérgico a sulfas**» conserva las sulfas.

### El fallo que me cacé a mí mismo

La primera versión de esta reparación devolvía **`[]`** para esa frase: la
negación se comía la afirmación que venía después en la misma oración. Lo cazaron
las pruebas que ya existían.

**Un arreglo de seguridad que borra el dato que protege es peor que el defecto.**
Perder una alergia real es más grave que arrastrar una falsa: la falsa estorba,
la perdida daña.

### Dos aserciones antiguas cambiadas, con su motivo escrito

`'Alérgico a sulfas'` → `'sulfas'` y `'Penicilina G.'` → `'Penicilina G'`. Lo que
esas pruebas defendían —que la alergia posterior a una negación siga apareciendo,
y que el punto no parta el nombre— sigue en pie. Lo que cambia es que el prefijo
y el punto final ya no viajan dentro del nombre del alérgeno.

### Archivos

- `src/lib/seguridad/alergias.ts`
- `src/__tests__/la-negacion-cubre-toda-la-lista.test.ts` (nuevo, 15 casos, sellado)

---

## REG-277 — el hospital y la consulta decidían distinto sobre la misma alergia (v1153)

`src/lib/hospital/cds.ts` tenía **su propio partidor de alergias**, con su propia
idea de qué es una negación. Era la **quinta copia**. Medida la divergencia sobre
los mismos textos, **9 de 11 discrepaban**:

| Campo | Hospital | Consulta |
|---|---|---|
| «NKDA» | alérgeno «NKDA» | ninguno |
| «(-)» · «Ninguna» · «Negadas» · «n/a» | alérgeno | ninguno |
| «Paracetamol 2.5 mg» | «Paracetamol 2» + «5 mg» | «Paracetamol 2.5 mg» |
| «Alérgico a penicilina» | «Alérgico a penicilina» | «penicilina» |

`NKDA`, `(-)`, `n/a` y «ninguna» son lo que se dicta en planta todos los días.
Ninguno casa con un fármaco del catálogo, así que **no disparan la alerta** — y
en cambio se imprimen: un recuadro rojo que dice «NKDA». Y el punto sin espacio
detrás partía las dosis.

### Pero lo grave no es cada caso

Es que **el hospital y la consulta decidían distinto sobre el mismo campo del
mismo paciente**. El médico ve una cosa en el consultorio y otra en planta, y
ninguna de las dos pantallas dice que existe la otra.

### Por qué el guardián anterior no lo vio

El guardián de copias miraba sólo `consulta` y `uci` — donde ya se había
arreglado. **Un guardián que mira donde ya se arregló no guarda nada.** El nuevo
comprueba por FORMA en todo `src/lib` y `src/app`: una copia en un fichero que
todavía no existe también falla.

### Y de camino, un hueco propio

Comparar los dos módulos enseñó que **«Interrogadas y negadas»** —negación
completa que se dicta en hospital— se partía por « y » y dejaba **«Interrogadas»
como alérgeno**. Ninguna prueba lo veía. Ahora la oración se juzga entera antes
de partirla… salvo si algún fragmento afirma, porque **la primera versión de esa
comprobación se volvió a llevar por delante «Niega penicilina, alérgico a
sulfas»**. Es la segunda vez en la misma reparación que la comprobación de más
borra el dato que protege.

### La prueba no lista casos: compara superficies

`hospital-y-consulta-leen-la-misma-alergia` comprueba que la alerta crítica del
hospital dispara **exactamente** cuando la consulta ve el alérgeno, sobre 28
formas reales de escribir el campo. Una divergencia nueva falla ahí aunque nadie
haya pensado en ese caso.

### Archivos

- `src/lib/hospital/cds.ts` (usa `alergiasDe`, sin partidor propio)
- `src/lib/seguridad/alergias.ts` (negación por oración entera + prefijo en cualquier posición)
- `src/__tests__/hospital-y-consulta-leen-la-misma-alergia.test.ts` (nuevo, 30 casos, sellado)

---

## REG-278 — el sello de procedencia contaba cero alergias (v1154)

La compuerta que bloquea la firma **ya se había reparado**: sella
`alergias: alergiasDe(patient ?? {})`, que lee las dos fuentes.

Lo que quedó atrás fue el **sello de procedencia** —el que dice de dónde salió
cada dato de la nota—, y llegaba por un envoltorio de una línea:

```ts
function alergiasArray(alergias?: string) {
  return parsearAlergiasTexto(alergias).map(a => a.alergeno)
}
```

`parsearAlergiasTexto` mira **sólo el texto libre**. Un paciente cuya alergia
vive en `alergiasEstructuradas` —que es donde la deja el registro estructurado—
sellaba una lista vacía en sus **tres** llamadas, y con ella el dato se quedaba
fuera de `camposSinEvidencia`: el registro medicolegal decía que ahí no había
nada que respaldar.

### Por qué sobrevivió a dos guardianes

El guardián de copias busca **quién PARTE el campo a mano**. Este envoltorio no
parte nada: llama al partidor bueno — sobre **una sola de las dos fuentes**.

**Cuando un dato tiene dos orígenes, el guardián tiene que mirar qué función se
llama, no cómo se corta el texto.** Un envoltorio de una línea es exactamente
donde se esconde esa diferencia.

### Lo que impide la recaída

La firma de `alergiasArray` ya no acepta una cadena: recibe al paciente. Mientras
aceptara `string`, alguien volvería a pasarle `patient?.alergias`.

### Archivos

- `src/app/(dashboard)/consulta/[patientId]/page.tsx`
- `src/__tests__/el-sello-cuenta-la-alergia-estructurada.test.ts` (nuevo, 7 casos, sellado)

---

## REG-279 — la franja del piso afirmaba la ausencia de una alergia que sí estaba (v1155)

La franja de alergias del internamiento —la que se ve en **todo momento** del
ingreso, y que existe precisamente para quien **no** pasa por el punto de orden:
enfermería que administra, quien prescribe a mano— tenía la **sexta** copia de la
lógica de alergias:

```ts
split(/[,;\n]+/)                                        // sin el punto, sin la barra
negadas = lista.length === 1 && /^(no|niega|ninguna|sin)\b/i.test(lista[0])
```

Reproducido: **«Niega penicilina. Alérgico a sulfas»** quedaba como UN fragmento,
empezaba por «niega», y la franja anunciaba en gris **«Alergias negadas por el
paciente»** sobre un paciente alérgico a sulfas.

### Por qué es lo peor de la serie

No es un aviso que falte. Es el sistema **afirmando la ausencia** de una alergia
que el expediente sí registra, en la **única señal que ve el equipo del piso**.
Un hueco calla; esto miente.

Y descartar primero lo frecuente y apuntar después lo que sí hay es la forma
**normal** de escribir el campo: ya costó REG-171 y REG-201. Además ignoraba
`alergiasEstructuradas` por completo.

### La segunda condición, que es la que arregla

«Negadas» ahora exige **las dos cosas**: que el campo tenga una negación
explícita **y** que no quede ningún alérgeno. Con sólo la primera se vuelve a
poder decir «negadas» habiendo alergia — que es exactamente el defecto.

Y los tres estados siguen distinguiéndose: **rojo** con alergia, **gris** con
negación de verdad, **ámbar** sin registro. Confundir gris y ámbar haría que la
franja gritara en todos los ingresos hasta que nadie la mirara.

### Archivos

- `src/app/(dashboard)/hospitalizacion/[internamientoId]/page.tsx`
- `src/__tests__/la-franja-del-piso-no-niega-lo-que-hay.test.ts` (nuevo, 8 casos, sellado)

---

## REG-280 / REG-281 — la enfermedad nombrada en la pregunta se cosechaba como antecedente (v1156)

**El fallo más repetido de este repositorio**, y seguía vivo en el motor
determinista local. Medido el 9-ago-2026 con `extraerComorbilidades` de verdad:

```
«¿Diabetes? No. ¿Hipertensión? Tampoco.»
  → positivas: ['Hipertensión arterial', 'Diabetes mellitus tipo 2']
```

Dos enfermedades que el paciente **acababa de negar**, registradas como que sí
las tiene.

### Dos causas

**REG-280 — «tampoco» no estaba entre los negadores.** Y «tampoco» es
exactamente como se contesta a la segunda pregunta de una serie: no es una forma
rebuscada, es la normal. Se añaden con el mismo criterio que los que ya había —
sólo lo que no admite otra lectura: `tampoco`, `jamás`, `niego`, `no es/soy/son`.
**No** se añade `no` a secas: «no acude por diabetes» no niega la diabetes, y
negar de más **borra un antecedente real**, que es el error caro.

**REG-281 — el interrogatorio nombra la enfermedad en la PREGUNTA.** `estaNegado`
sólo miraba hacia atrás, y delante de «¿Diabetes?» no hay negador: la negación
viene **después**, en la respuesta. Ahora, si el término vive dentro de una
pregunta, **decide la respuesta**. Funciona sin el «¿» de apertura, porque el
dictado casi nunca lo pone, y cada pregunta se queda con **su** respuesta.

### Por qué sobrevivió a su propia reparación

Esto se arregló en **v976 — para la vía de la IA**:
`corregirCertezaPorNegacion` reclasifica lo que el modelo extrae. El motor
determinista local, que es el que entra **cuando la IA falla** (sin créditos,
timeout, límite de peticiones), nunca pasó por ese guardián.

Es la forma de REG-267: reparado en un sitio, vivo en el de al lado. Y el que
quedó vivo es justo **el que corre cuando lo demás no**.

### Y un tercer estado que faltaba

«¿Padece asma? **No sé**» dejaba el asma POSITIVA. «No sé» no niega —y hace
bien: no saber no es negar— pero tampoco afirma. Con sólo dos casillas, el
término caía en la equivocada. Ahora no entra en ninguna… salvo si consta
afirmado en otro sitio del texto, porque callarlo por la primera mención sería
perder el dato.

**Ausencia de dato no es dato de ausencia, y tampoco es dato de presencia.**

### SAFE-007 se cierra, y su prueba lo dijo antes

`lo-negado-no-puntua-en-stop-bang` traía una prueba que **fijaba el defecto** con
este comentario: *«Cuando alguien lo repare se pondrá roja, y eso es lo que se
busca: que el día que cambie, se note.»* Se puso roja. La aserción se invierte.

**Un pendiente declarado con una prueba es la única clase de pendiente que avisa
cuando deja de serlo.**

### Archivos

- `src/lib/expediente/parser-clinico.ts` (`NEGADORES`, `respuestaDeLaPregunta`, `esSoloLaPregunta`)
- `src/__tests__/la-pregunta-no-es-un-antecedente.test.ts` (nuevo, 15 casos, sellado)
- `src/__tests__/lo-negado-no-puntua-en-stop-bang.test.ts` (SAFE-007 cerrado)

---

## REG-282 — un negador sin su afirmador gemelo BORRA un antecedente (v1157)

**La regla que faltaba, y que costó el mismo daño dos veces en el mismo día.**

Un verbo puede entrar en una negación —«no **padece** diabetes»— y también
**cerrar** una anterior —«niega tabaquismo, **padece** diabetes»—. Si entra en
`NEGADORES` y no en `AFIRMADORES`, el arreglo **no repara la mitad: la mueve al
lado que no se ve**, porque nadie echa de menos un antecedente que no está.

| Cuándo | Qué se añadió sólo a un lado | Qué produjo |
|---|---|---|
| REG-192 | `padece` / `padezco` | «Niega tabaquismo, padece diabetes» → **diabetes NEGADA** |
| REG-280 (mío, hoy) | `es` / `soy` / `son` | «Niega diabetes, es fumador» → **tabaquismo NEGADO** |

Las dos **borran un antecedente real**, y eso es peor que inventarlo: el
inventado estorba y se ve; el borrado no se echa de menos. Encontrado porque la
rutina `REG-270-negacion-parser` dejó la regla escrita — y lo primero que hice
al leerla fue comprobar si yo acababa de romperla. La había roto.

### Las ocho formas que caían del lado afirmativo

Medidas sobre el árbol de producción: «no he tenido», «nunca he tenido», «jamás
ha tenido», «tampoco tiene», «no sufre de», «no cuenta con», «no fuma», «no es
fumador».

Las dos últimas son de otra clase: ahí **el término clínico ES el verbo**, así
que entre el negador y el término no queda nada que reconocer. Se cubren
exigiendo que el negador esté **inmediatamente antes** — con eso «no acude por
diabetes» sigue sin negar la diabetes, que es el error contrario.

### Dos defectos de ventana, propios

- El afirmador se juzgaba con **7 caracteres** de contexto, y «tampoco » mide
  ocho: se leía «ampoco », que no casa. El `tiene` de «tampoco tiene diabetes»
  cerraba entonces la negación que el `tampoco` acababa de abrir.
- `tampoco` y `jamás` no estaban entre los que **abren** negación junto a
  `no`/`nunca`/`sin`.

### El arreglo es estructural, no una lista más larga

Los dos lados salen de **`VERBOS_DE_TENENCIA`**, una sola lista. Añadir un verbo
lo añade a las dos caras a la vez: **la desalineación deja de ser posible**, que
es distinto de ser improbable. La prueba lo comprueba leyendo la fuente, porque
mientras las dos expresiones se tecleen por separado alguien volverá a añadir un
verbo a una sola — ya pasó dos veces en el mismo día.

### Archivos

- `src/lib/expediente/parser-clinico.ts`
- `src/__tests__/un-negador-sin-su-gemelo-borra-el-dato.test.ts` (nuevo, 16 casos, sellado)

---

## REG-283 — transcribir una grabación borraba el audio de OTRA (v1158)

**Dictar 22 min → tocar «Agenda» → volver → dictar 90 s → detener perdía los 22
minutos.** Sin error, sin aviso, y justo después de una transcripción exitosa —
que es cuando menos se sospecha.

Encontrado por la rutina `PATIENT-AUDIO-001`, y es uno de los tres P0 de
integridad que la auditoría de V9 había dejado **abiertos**.

### La causa

`detener()` arma el blob con los trozos de la sesión **en curso**, pero al
terminar borraba el rango **completo** de la llave. Y la llave no es por sesión:
es `consulta-{patientId}`, la misma cada vez que se abre a ese paciente. Debajo
puede haber audio de una grabación anterior que nadie transcribió — porque
navegar fuera desmonta el hook y libera el micrófono **sin llamar a `detener()`**.

### La defensa estaba escrita a medias

**El hook ya sabía que ese huérfano existe.** Al empezar a grabar cuenta los
trozos que hay y arranca su índice después (`recoveryBaseRef`) para no pisarlo.

Protegía al **escribir** y no al **borrar**. Y el comentario de `iniciar()`
afirmaba lo contrario de lo que ocurría: por eso se podía leer el código entero
sin ver el agujero. **Un comentario que miente es peor que ninguno.**

### El arreglo

`borrarChunks(recoveryKey, desde = 0)`. Las **tres** salidas exitosas de
`detener()` pasan `recoveryBaseRef`. Quien transcribe el rango entero
(`recuperarAudio`) y quien descarta a propósito (`descartarRecovery`) siguen
borrando todo — acotarlos dejaría audio huérfano imposible de eliminar, que es el
defecto contrario y también real.

**El cambio sólo puede conservar más audio, nunca menos.**

### Lo que la prueba NO cubre, dicho en vez de dejarlo creer

No abre una IndexedDB de verdad: eso exigiría una dependencia nueva. Comprueba el
**rango** —la línea exacta donde vivía el defecto— y quién lo acota. Queda sin
cubrir el comportamiento del almacén, no la decisión de qué se borra.

---

## REG-284 — «No pues sí» seguía leyéndose como una negación (v1158)

REG-271 arregló el «no» correctivo, pero exigía el «sí» **pegado** al «no». En el
habla real entre los dos cabe la muletilla. Medido:

| Respuesta | Antes |
|---|---|
| «No pues sí» | NIEGA |
| «No pues sí tengo» | NIEGA |
| «no, pues sí» | NIEGA |
| «No, pues sí, desde hace años» | NIEGA |

Es el mismo defecto **a una muletilla de distancia**, y la misma lección que ya
costó el ruido de turno al principio de la respuesta: **la muletilla no vive sólo
delante**.

Encontrado por la rutina `SAFE-003-ventana`. Las siete negaciones legítimas
—incluida «No, sino la de mi hermana»— siguen contando.

### Archivos

- `src/hooks/useGrabacionAudio.ts` (`rangoABorrar`, `borrarChunks`)
- `src/lib/expediente/negaciones.ts` (`MULETILLA_INTERMEDIA`)
- `src/__tests__/transcribir-no-borra-el-audio-de-otra.test.ts` (nuevo, 8 casos, sellado)

---

## REG-285 — «obe·SIDA·d» decía VIH, y con eso se descartaba un VIH (v1159)

`cronicasEn` comparaba con `t.includes(forma)` — **subcadena, sin límite de
palabra**. Y «obesidad» contiene «sida»:

```
condicionesNegadas('Niega obesidad')  →  [{ condicion: 'VIH' }]
```

### Por qué no se queda ahí

De esa lista lee `corregirCertezaPorNegacion`, que reclasifica a **`descartado`**
lo que la IA extrajo. Un paciente con **VIH real** cuyo expediente diga «niega
obesidad» quedaba con el **VIH descartado**.

En un consultorio de infectología eso no es una curiosidad de cadenas de texto.

### El límite no es `\b`, y eso importa

El texto ya viene sin tildes, así que `\b` funcionaría… hasta que alguien quite
la normalización. Se mira hacia los lados por **carácter** —letra o dígito—, que
es lo que de verdad se quiere decir.

El **dígito** no sobra: «dm 2» y «tb pulmonar» llevan número, y sin esa condición
«dm 2» casaría dentro de «dm 20 mg».

### Y la misma comparación vivía en el módulo de al lado

`temporalidad.ts` tenía el mismo `includes` sobre su propio vocabulario. Se
arregla con **el mismo comparador exportado**, no con una copia: dos formas de
comparar es exactamente cómo se arregla un módulo y se deja el de al lado — la
forma de REG-267, otra vez.

### El barrido, no el caso

La prueba no comprueba «obesidad»: pasa **todo el vocabulario** contra palabras
trampa (obesidad, sobrepeso, desidia, presidencia, residual, cancerbero). Una
forma nueva que fuera subcadena de una palabra común falla ahí aunque nadie haya
pensado en ella.

### Lo que se midió de las seis ramas de temporalidad

Sus afirmaciones —«el padecimiento de hoy se leía como antecedente», «el escudo
cruzaba de apartado»— **ya estaban reparadas** en este árbol: medido caso a caso
con `padecimientosEn`, `esFrasePasada` y `mencionesEnPasado`. Lo único que
quedaba vivo de las seis era la comparación por subcadena, que ninguna de ellas
nombraba como su hallazgo principal.

**Seis ramas, un defecto real.** Fusionarlas habría traído seis versiones
incompatibles de `temporalidad.ts` para arreglar lo que se arregla en una línea.

### Archivos

- `src/lib/expediente/negaciones.ts` (`comoPalabra`, exportado)
- `src/lib/expediente/temporalidad.ts` (usa el mismo comparador)
- `src/__tests__/obesidad-no-dice-vih.test.ts` (nuevo, 16 casos, sellado)

---

## REG-286 — el escudo de una oración se prestaba a la siguiente (v1160)

`VENTANA_DEL_ESCUDO` llevaba escrito, desde que se fijó:

> *«Más larga empezaría a leer la oración anterior y un escudo ajeno taparía una
> afirmación real — que es el fallo caro.»*

**Conocía el modo de fallo exacto** y eligió 60 caracteres como defensa.

### Pero 60 caracteres no son una oración

«Antecedente de asma. » mide **21**. El escudo cruzaba el punto sin esfuerzo.
Medido con `primeraMencionSinEscudo` de verdad:

| Nota | Antes |
|---|---|
| «Antecedente de asma. Cursa con neumonía.» | CALLABA |
| «Niega diabetes. Diagnóstico de diabetes tipo 2.» | CALLABA |

**El segundo es el que duele.** La nota **afirma** una diabetes justo después de
que el paciente la negara, y la alarma de contradicción —la que nació del caso
que el Dr. encontró en producción, la razón de existir de este motor— se quedaba
muda.

### La lección

**Un número no puede expresar «la misma oración».** La ventana de 60 se queda
como **tope** —para eso sirve un número— y el corte lo hace el punto, que es lo
que de verdad separa una afirmación de otra. Es el mismo criterio que
`estaNegado` ya usaba en `parser-clinico.ts`: dos motores hermanos, uno lo tenía
y el otro no.

### Y el tope no sobra

Sin él, un «niega» al principio de un párrafo largo escudaría todo lo que viniera
detrás hasta el siguiente punto. Los dos límites hacen falta, y ahora cada uno
expresa lo suyo.

### Archivos

- `src/lib/expediente/mencion-en-la-nota.ts`
- `src/__tests__/el-escudo-no-cruza-el-punto.test.ts` (nuevo, 11 casos, sellado)

---

## REG-287 — grabar es actividad, y salir grabando avisa (v1161)

**Los dos últimos P0 de integridad de la auditoría de V9, y compartían causa:
nadie sabía que se estaba grabando.**

### 1. La sesión se cerraba en mitad del dictado

`AutoLogout` escucha `mousemove`, `mousedown`, `keydown`, `touchstart` y
`scroll`. Su propio comentario nombra el escenario que lo rompe:

> *«el médico DICTA, y dictar no genera mousemove ni teclas»*

**Lo conocía.** Su defensa fue *guardar la nota antes de cerrar*. Eso salva el
texto — y **sigue cerrando la sesión a mitad de frase** en un pase de UCI de
media hora.

**Guardar la nota no era el arreglo: era el consuelo.**

### 2. Salir no avisaba

No había **ningún** `beforeunload` en toda la aplicación. Cerrar la pestaña o
recargar durante el dictado paraba la grabación sin decir nada. Los trozos ya
volcados sobreviven y al volver aparece el ofrecimiento de recuperación — pero el
médico no lo sabe **en el momento en que decide**, que es el único que importa.

### Por qué un evento y no una referencia

El grabador no debe saber que existe un cierre por inactividad, ni al revés. Si
se conocieran, cada pantalla nueva que grabe tendría que **acordarse** de avisar
— y «acordarse» es la familia `depende_de_recordar`. Con un evento, **cualquier**
superficie que grabe queda cubierta el día que exista.

El nombre vive en `lib/seguridad/estoy-grabando.ts`, una sola vez: una cadena
literal repetida en dos archivos es una compuerta que se abre sola el día que
alguien corrige una errata en uno de los dos.

### La decisión que hace que sirva, y queda escrita para revertirla

Durante la cuenta atrás **sólo el botón reactiva**, y con razón: un `mousemove`
perdido no puede impedir un cierre legítimo en un equipo compartido.

**Una grabación en curso no es un `mousemove` perdido.** Es prueba positiva de
que hay alguien delante hablando — evidencia de presencia más fuerte que mover el
ratón. Sin esa línea el aviso saldría en el minuto 30 del dictado y cerraría
igual: **el defecto seguiría abierto con un arreglo puesto encima**.

Es una decisión de seguridad —alarga la sesión mientras se graba— y por eso está
escrita donde se lee. El resto de eventos sigue respetando la guarda del aviso.

### Detalles que deciden si funciona

- Un latido **inmediato** además del periódico: empezar a grabar en el minuto 29
  de inactividad llegaría tarde con sólo el `setInterval`.
- El latido **sólo** mientras se graba o está en pausa; latir siempre convertiría
  el cierre por inactividad en decorativo.
- El `beforeunload` **se quita al parar**: uno que sobrevive a la grabación
  pregunta al salir de cualquier pantalla, se aprende a ignorar en dos días, y
  entonces tampoco se lee el que importa.

### Archivos

- `src/lib/seguridad/estoy-grabando.ts` (nuevo)
- `src/hooks/useGrabacionAudio.ts`
- `src/components/AutoLogout.tsx`
- `src/__tests__/grabar-es-actividad.test.ts` (nuevo, 13 casos, sellado)

---

## REG-288 — las decisiones del dueño estaban escritas y nadie las leía (v1162)

Este repositorio tiene una regla que ha funcionado: **cuando falta un criterio
clínico u operativo, no se inventa un valor por defecto — se declara.** De ahí
salen `FALTA_GRACIA`, `FALTA_POLITICA_Q2_Q4`, `FALTA_VENTANA_REINGRESO`,
`FALTA_VENTANA_TEMPORAL` y `LO_QUE_HACE_FALTA_DEL_DR`.

Cada una está escrita con cuidado, dice **qué** hace falta y **por qué** no puede
decidirlo el software. Y **nadie las leía**: viven repartidas en cinco módulos.

### Es la familia más grande, aplicada a las decisiones

«Escrito y sin conectar», pero de **decisiones** en vez de código. La declaración
existía; el camino hasta quien decide, no. El resultado se veía: llevaban meses
citándose de memoria al final de cada informe, con el riesgo de que la lista
dijera una cosa y el código esperase otra.

### Derivado, no una lista

`scripts/calidad/lo-que-espera-al-dueno.mjs` las recoge **del código**, buscando
por forma —una constante exportada `FALTA_*` o `LO_QUE_HACE_FALTA_*`— y no por
lista de ficheros: una declaración nueva en un módulo que todavía no existe
aparece igual.

Una lista escrita a mano se desfasa. Ya pasó dos veces con cifras de este mismo
repositorio (REG-241 y la sala de datos). Aquí el daño sería peor: **seguir
pidiendo algo ya resuelto hace que se dejen de leer todas.**

### El guardián falla en las DOS direcciones

Comprobado retirando y añadiendo entradas: falla cuando el código declara algo
que el documento no pide, **y** cuando el documento pide algo que el código ya no
espera. La segunda es la que envenena.

### Lo que el documento deliberadamente no hace

**No propone respuestas.** Ninguna sugerida, ningún valor «recomendado», ningún
número de ejemplo copiable.

Poner un valor razonable al lado de la pregunta es exactamente cómo el criterio
del dueño se convierte en el default de un agente sin que nadie firme nada — y
esas cinco constantes existen para impedirlo. Hay una prueba que lo comprueba.

### El instrumento tampoco puede mirar al vacío

Si el barrido no encuentra ninguna declaración, **falla** en vez de parecer decir
«no queda nada pendiente». Es la misma regla del trinquete de lint: *un gate que
no mide no protege*.

### Archivos

- `scripts/calidad/lo-que-espera-al-dueno.mjs` (nuevo)
- `docs/DECISIONES-DEL-DUENO.md` (nuevo, derivado)
- `src/__tests__/lo-que-espera-al-dueno-no-se-pudre.test.ts` (nuevo, 7 casos, sellado)

---

## REG-289 — «500 microgramos» se leía como 500 mg, y «QID» apagaba el techo diario (v1163)

Medido con `extraerMg` y `extraerTomasDia` de verdad, sobre el árbol de
producción:

| Escrito | Se leía |
|---|---|
| `500 mcg` | 0,5 mg ✓ |
| **`500 microgramos`** | **500 mg** ← mil veces la dosis |
| **`1000 UI`** | **1000 mg** ← no son miligramos de nada |
| **`QID`** | *no se entiende* → el llamador asume **1 toma/día** |

### La causa no es la lista corta: es el paso 3

`extraerMg` termina con «número sin unidad: se asume mg». Correcto para un «500»
pelado — y se tragaba **cualquier unidad que la lista no conociera**,
convirtiéndola en miligramos en silencio.

Es el mismo daño que ya costó el volumen. Entonces se arregló devolviendo `null`
para mililitros, con este comentario en el propio código: *«Antes "5 mL" se leía
como 5 mg y silenciaba la red de seguridad»*. **La lección no se generalizó: sólo
se tapó el caso encontrado.**

### Y el techo diario no fallaba: no se ejecutaba

`QID`, `TID`, `BID` devolvían `null`, y el llamador hace
`Math.max(1, Math.floor(tomasDia ?? 1))`. Paracetamol 1000 mg `QID` son **4 000
mg** —el techo entero— y se comprobaban 1 000.

El módulo ya había documentado ese modo de fallo para los números escritos con
letra. La lista era corta; el modo de fallo, el mismo.

---

## REG-290 — quince versiones de reparaciones que no se veían (v1163)

Lo dijo el dueño, y tenía razón:

> *«no he visto ningún cambio en la aplicación»*

Verificado antes de contestar: producción respondía la versión correcta y el
código nuevo estaba en el paquete servido. **El despliegue era real; el problema
era otro.**

De quince versiones, doce eran **defensas** — hacen que **no** pase algo malo, que
es lo más difícil de ver que existe. Y las tres visibles dependen de que exista
el dato: la tarjeta de pendientes sólo aparece si el paciente tiene pendientes.

**Una defensa que no se puede enseñar es, para quien paga, una defensa que no
existe.**

### La pantalla `/motores` — «Lo que te protege»

Nueve defensas, cada una con el caso real que falló, qué hacía antes, y **el
motor corriendo en vivo** sobre lo que se escriba. Los motores son puros, así que
se ejecutan en el navegador: **si uno se rompe mañana, la pantalla lo enseña
roto.**

Es la diferencia entre una demo y una prueba: una demo se prepara, esto se
ejecuta.

### El «antes» se cita, no se calcula — y se dice en la pantalla

El código viejo ya no existe. Presentar como medido algo que sólo está recordado
sería exactamente el defecto que la mitad de esos motores existen para evitar,
así que la cabecera lo declara y cada caja separa las dos cosas visualmente.

### Lo que quedó verificado, y lo que no

Compilado como página estática, `tsc` limpio, y los motores que llama son los
mismos que cubren las 8 459 pruebas. **No pude abrirla en un navegador**: el
servidor de desarrollo de este espacio apunta a otro proyecto y producción exige
su sesión. Se dice en vez de darlo por hecho.

### Archivos

- `src/app/(dashboard)/motores/page.tsx` (nuevo)
- `src/components/motores/QueDiceElMotor.tsx` (nuevo)
- `src/components/Sidebar.tsx` · `src/lib/security/rutas-privadas.ts`
- `src/lib/seguridad/dosis.ts`
- `src/__tests__/quinientos-microgramos-no-son-quinientos-miligramos.test.ts` (nuevo, 20 casos, sellado)

---

## REG-291 — un valor NORMAL marcado como crítico (v1165)

Medido con `evaluarCriticoLab` de verdad:

| Estudio | Valor | Decía |
|---|---|---|
| **Glucosa en orina (EGO)** | 500 mg/dL | **CRÍTICO** |
| **Calcio iónico** | 4,8 mg/dL | **CRÍTICO** |

La primera es una **glucosuria corriente** en un diabético descompensado, y
disparaba la misma alerta —y el mismo WhatsApp— que una glucemia de 500, que sí
lo es.

La segunda es peor: **4,8 mg/dL es un valor NORMAL de calcio iónico** (~4,5-5,6).
Se comparaba contra el umbral bajo del calcio **total**, que es 6. Y en terapia
el iónico se mide a todas horas.

### Por qué es de los que más daño hacen a largo plazo

**Un valor normal marcado como crítico es peor que un umbral que falta.** El que
falta se nota cuando se busca; éste enseña una alarma roja sobre un paciente que
está bien — y eso es lo que enseña a ignorar las alarmas. Es la lección que este
repositorio ya tiene escrita para los avisos clínicos y para sus propios
medidores, aplicada al laboratorio.

### Dónde se quedó corta la defensa

El módulo **ya excluye** el pH urinario, la fosfatasa alcalina, la hemoglobina
glucosilada y la creatinina en orina — cada una con su comentario y su caso real.

**La clase estaba identificada y la lista se quedó corta.** El examen general de
orina trae varios analitos con el mismo nombre que los de sangre; se cubrió el pH
y no la glucosa ni la bilirrubina. Es la misma forma que REG-289: la lección
escrita para un caso y no generalizada.

### Lo que NO se hizo: inventar el umbral del iónico

Excluirlo no es resolverlo. Mientras no tenga umbral propio, **un calcio iónico
realmente crítico no se marca**, y eso queda declarado en
`FALTA_CRITICO_CALCIO_IONICO`.

**Y apareció sola en la lista de decisiones del dueño**, sin que nadie la
añadiera: es la convención `FALTA_*` de REG-288 justificándose a las pocas horas
de existir. El guardián del documento falló hasta que la decisión quedó pedida.

### Archivos

- `src/lib/hospital/lab-criticos.ts`
- `docs/DECISIONES-DEL-DUENO.md`
- `src/__tests__/la-glucosa-de-la-orina-no-es-la-de-la-sangre.test.ts` (nuevo, 14 casos, sellado)

---

## REG-292 — se dice lo que HACE, nunca cómo lo hace (v1166)

Regla del dueño, en sus palabras:

> *«la manera en que funciona la app no debe de enseñarse, sólo se menciona lo
> que puede ser para promocionar, sólo lo que hace, no cómo lo hace»*

Y antes, sobre la pantalla que yo había puesto en su menú:

> *«al cliente le importan lo funcional y lo que va a hacer… hay muchas cosas que
> no sabe ni qué es, así que eso escóndelo»*

### Lo que estaba expuesto

- **`/motores`** — pantalla mía, puesta en el **menú del médico** entre
  Antibiograma y Lista de espera. Habla de reparaciones, de números internos y de
  «lo que hacía antes». **Error de producto mío**, de hace unas horas.
- **`/arquitectura`** — enlazada **dos veces desde la portada**: un botón que
  decía «Ver los 10 motores» y un enlace en el pie. Nombra los motores por dentro
  y dice cuáles corren con código y cuáles con IA.
- **«Ver cómo razona la IA en vivo»** — el verbo era «cómo». Ahora ofrece ver la
  aplicación en marcha, que es lo que el médico quiere saber.

### Por qué importa, y no es estética

1. **Es suyo.** El diseño interno de los motores es lo que distingue este
   producto. Publicarlo en la portada es regalarle el mapa a quien quiera
   copiarlo.
2. **Al cliente no le sirve.** Un médico decide por lo que la aplicación **hace**.
   Una entrada de menú que no entiende gasta atención que necesita para su
   consulta.

### Lo que NO se hizo: borrarlas

Las dos páginas **siguen existiendo** y se llegan por su dirección. Al dueño le
sirven para una revisión técnica o para enseñárselas a quien compre — con él
delante, decidiendo qué se cuenta. Lo que se quita es que **se ofrezcan solas**.

### Y comprobado que no había más fugas

Ninguna otra página que ve el cliente —operación, evidencia, seguridad, demo—
enseña números de reparación ni jerga interna. `/operacion` enumera **qué
resuelve** (cuentas por cobrar, inventario, CFDI, reportes), que es exactamente
lo que la regla permite.

### El guardián

`lo-que-hace-si-como-lo-hace-no` comprueba que **ninguna superficie del cliente**
—portada, menú lateral, barra inferior, configuración— vuelva a enlazar esas
páginas. Y comprueba lo contrario también: que la portada **siga diciendo lo que
la aplicación hace**, para que la regla no se cumpla a base de callarse.

### Archivos

- `src/app/page.tsx` · `src/components/Sidebar.tsx`
- `src/app/(dashboard)/configuracion/secciones-seguridad.tsx`
- `src/__tests__/lo-que-hace-si-como-lo-hace-no.test.ts` (nuevo, 8 casos, sellado)

---

## REG-293 — el día de un cobro era el de CDMX, no el del consultorio (v1167)

El webhook de Stripe calculaba el día del cobro con la zona **escrita a mano**:

```ts
new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' })
```

Y de ese `dia` cuelgan el campo `dia` y el `mes` del cobro — **los que filtra el
corte de caja**.

### Medido

A las **06:30 UTC**, Ciudad de México dice **9 de agosto** y Tijuana dice **8**.
Un cobro a las 11:30 de la noche en Baja California se sellaba con la fecha del
**día siguiente**: caía en el corte del día que no era. En el cambio de mes, en
el mes que no era.

### Por qué es el patrón de siempre

El consultorio **ya tiene** su `zonaHoraria` configurada, hay un módulo
`timezone.ts` entero para esto con `fechaISOLocal`, y `clinicId` estaba a mano en
esa misma función.

De **catorce** sitios que nombran la zona, éste era **el único que la fijaba sin
leer nunca la del consultorio**.

Y la memoria del repositorio lo dice: el corte de caja ya tuvo un arreglo de zona
horaria **en la pantalla**. Quedó vivo en el lado que **escribe** — que es el que
deja el dato guardado para siempre. La forma de REG-267, otra vez.

### Los respaldos, que no sobran

Sin `zonaHoraria` configurada cae en la de por defecto; si la lectura falla,
también. **Un cobro no puede perderse porque no se pudo leer el consultorio**, y
tenerlo con la zona de la capital es mejor que no tenerlo.

### Lo que NO se hace

Los cobros **ya guardados conservan su día**. Recalcularlos sería reescribir
cortes de caja que el dueño ya cerró y cuadró, y eso no lo decide un arreglo de
software.

### Y lo que se buscó y NO era defecto

En el mismo barrido se midieron dos candidatos del módulo de dinero:
`decidirCobroAnticipo` con importe negativo, y `ajusteAlConfirmar` con reserva
negativa —que devuelve un cobro negativo—. **Los dos están protegidos en el
llamador** (`if (r.apartados <= 0) return`, y `amount_total` de Stripe nunca es
negativo). Se anotan como asimetrías latentes, **no como hallazgos**: vender como
defecto algo que no puede ocurrir es la otra forma de mentir con un informe.

### Archivos

- `src/app/api/stripe/webhook/route.ts`
- `src/__tests__/el-dia-del-cobro-es-el-del-consultorio.test.ts` (nuevo, 8 casos, sellado)
<!-- NOTA DE FUSIÓN V10-D1 (9-ago-2026): las 12 entradas siguientes nacieron
     en la rama V9 como REG-270…281 y COLISIONABAN con los REG-270…293 que
     main acuñó en paralelo. Se renumeraron a REG-294…302 conservando su
     contenido; sus guardianes y sellos se renumeraron igual. -->

## REG-294 — Volver a grabar borraba el audio de la grabación anterior

**Encontrado por** la auditoría de navegación y estado de
`PATIENT-UX-TRUTH-001` (V9).

**Qué pasaba.** Al terminar bien una transcripción, `detener()` borraba el rango
**completo** de la clave en IndexedDB. Pero el blob que acababa de transcribir se
arma sólo con los trozos de **esta** sesión (`todosChunksRef`).

El caso real: grabar 22 minutos → tocar «Agenda» → volver → grabar 90 segundos →
detener. Los 90 segundos se transcriben, y **los 22 minutos se borran sin
haberse transcrito nunca**. No hay segunda copia del audio en ninguna parte.

**Causa raíz — media defensa.** `recoveryBaseRef` existe justo para esto: cuando
hay audio huérfano bajo la misma clave, los trozos nuevos se guardan **después**
para no pisarlo. Se protegía al huérfano al **escribir** y se le arrasaba al
**borrar**. El comentario del autor demuestra que el escenario estaba pensado; lo
que no se actualizó fue el borrado.

**Arreglo.** `borrarChunks(clave, desde = 0)`. Los **tres** caminos de éxito
—dictado, diarización y transcripción por partes— borran desde
`recoveryBaseRef.current`. Descartar a mano y recuperar siguen borrándolo todo,
que es lo correcto: ahí no queda nada que conservar.

**Lo que NO se hizo, a propósito.** No se fusionan los dos audios para
transcribirlos juntos. Son dos sesiones distintas de `MediaRecorder`, cada una
con su cabecera de contenedor; concatenarlas produce un archivo que el proveedor
no sabe leer. Perder el audio por «arreglarlo» sería el mismo defecto con otra
cara.

**Familia.** `perdida`.

**Guardián.** `src/__tests__/el-audio-grabado-no-se-borra.test.ts`, 20 casos.
Probado al revés: reponiendo el rango desde 0, falla.

---

## REG-295 — El trozo final del audio se tiraba al salir de la pantalla grabando

**Encontrado por** la misma auditoría.

**Qué pasaba.** `liberarRecursos()` desenganchaba `ondataavailable` antes de
`rec.stop()`, así que el buffer final (~2 s) se perdía. Y `liberarRecursos` es lo
que corre **en cada navegación**, porque `(dashboard)/template.tsx` desmonta la
página siempre.

Esos ~2 s son justo los últimos que dijo el médico antes de cambiar de pantalla:
la parte más fácil de echar en falta y la única que no está en ninguna otra copia.

**Causa raíz.** El desenganche era la defensa **correcta** para el índice que
había. El índice de disco se derivaba de la longitud de un array
—`recoveryBase + todosChunks.length - 1`— y ese array se vacía justo debajo; el
`ondataavailable` final llega después del vaciado y calculaba `recoveryBase - 1`,
pisando un trozo bueno o escribiendo en el índice -1. Entre perder 2 s y
corromper el respaldo, se eligió bien.

Lo que estaba mal no era la elección: era **atar un índice de disco a la longitud
de una estructura en memoria**.

**Arreglo.** `persistIdxRef`, un contador que sólo sube, sembrado en
`recoveryBase` al iniciar. La colisión deja de ser posible, así que el
desenganche deja de hacer falta y el trozo final se persiste en su sitio.

**Familia.** `perdida`.

**Guardián.** el mismo archivo. Probado al revés: reponiendo
`rec.ondataavailable = null`, falla.

---

## REG-296 — El cierre por inactividad no oía dictar

**Encontrado por** la misma auditoría.

**Qué pasaba.** `AutoLogout` escucha `mousemove`, `mousedown`, `keydown`,
`touchstart` y `scroll`. **Hablar no genera ninguno.** A los 30 minutos avisaba
60 segundos y cerraba la sesión — encima de un médico que llevaba 30 minutos
dictando.

**Lo que hace especial a este defecto**: la cabecera de `AutoLogout.tsx` **ya lo
describía**. El arreglo de entonces fue guardar la nota antes de cerrar, que era
necesario y correcto, pero dejó la causa intacta. Escribir el diagnóstico
correcto y arreglar sólo el síntoma deja constancia de que se sabía.

**Arreglo.** `useGrabacionAudio` emite `nx:actividad-dictado` cada minuto
mientras graba, y `AutoLogout` reinicia el contador al oírlo. El latido vive en
el hook porque es quien sabe que se está grabando; el componente sólo escucha. Va
**sin el estrangulador de 5 s** de los otros eventos: llega una vez por minuto, y
perderlo sería justo lo que se intenta evitar.

**Esto no desactiva el cierre por inactividad.** En cuanto la grabación para, el
contador corre como siempre: el control de PHI en dispositivo compartido se
mantiene entero.

**Además**, mientras se graba se registra un `beforeunload` — no había **ni uno**
en todo el repositorio. Para el texto de la nota es defendible, porque el volcado
al desmontar lo salva; para una grabación no hay volcado posible. Cubre de paso
la recarga que hace el service worker al desplegar una versión nueva.

**Familia.** `no_conectado` — el dato (que hay alguien delante) existía y no
llegaba a quien decidía.

**Guardián.** el mismo archivo. **Y el guardián falló primero**: la primera
versión comprobaba que el manejador EXISTIERA, así que al borrar el
`addEventListener` en la comprobación al revés los 20 casos siguieron en verde.
Un manejador declarado y no registrado es exactamente la familia que este
archivo persigue. Ahora se exige el registro y su retirada.

---

## REG-297 — Al cerrar sesión se borraba el audio sin transcribir

**Encontrado por** la misma auditoría.

**Qué pasaba.** `salirSeguro()` llamaba a `limpiarAudioLocal()` en **las dos**
ramas, sin condición, y esa función hace
`indexedDB.deleteDatabase('nexusmed-recovery')`: se lleva el audio de
recuperación entero.

La purga de la **nota** ya era condicional, con su razonamiento escrito: cuando
el servidor no la recibió, el borrador local es la única copia y borrarlo
convierte un problema de red en una pérdida definitiva. **Ese mismo razonamiento
no se aplicó al audio**, y el comentario que justificaba la purga —«el texto ya
transcrito vive en el borrador que se está conservando»— es cierto sólo para una
grabación **terminada**. A mitad de grabación, la cola sin transcribir no existe
en ningún otro sitio.

Y el disparador más frecuente era REG-296: como el cierre por inactividad no oía
dictar, la sesión que se cerraba era, con diferencia, la que se estaba dictando.

**Arreglo.** El acuse de `nx:guardar-todo` gana
`marcarAudioSinTranscribir()`, y `ResultadoGuardado` gana `audioSinTranscribir`.
Si alguien lo declara, el audio no se purga. La sesión se cierra igual —eso sí es
seguridad—; lo que se conserva es un archivo que ya estaba en el disco y que el
médico puede descartar desde el cartel de recuperación.

**Tres detalles que decidían si el arreglo servía de algo:**

1. **La declaración va ANTES del `return` por nota vacía.** Una grabación recién
   empezada no tiene resumen, ni diagnósticos, ni transcripción: es exactamente
   el caso que ese `return` descarta, y el que más audio irrecuperable tiene por
   delante.
2. **Se lee por ref, no por captura.** El oyente se registra con
   `[guardarBorrador]`; leer `audio.estado` directamente habría capturado
   «inactivo» y el arreglo habría quedado escrito y sin efecto.
3. **Las tres salidas de `guardarTodoYEsperar` devuelven el campo.** Si una lo
   olvidara, `audioSinTranscribir` sería `undefined`, la condición pasaría, y el
   audio se borraría igual que antes — con el arreglo puesto. El guardián lo
   comprueba.

**Y lo que NO se hizo, a propósito.** No se intenta transcribir el audio durante
el cierre. Estamos cerrando la sesión: pedirle a la red una transcripción larga
en ese momento es apostar el audio a que la petición llegue. Se conserva el
archivo, que es lo que sí depende de nosotros.

**Familia.** `perdida`.

**Guardián.** el mismo archivo. Probado al revés: quitando la condición, falla.

---

## REG-298 — Un segundo sistema de color, obsoleto, escondido dentro del primero

**Encontrado por** `DESIGN-SYSTEM-001` (V9), al ir a sustituir los literales de
color que había contado la auditoría anterior.

**Qué pasaba.** 280 referencias a token traían un respaldo escrito a mano —
`var(--text, #0f172a)`. Parecen defensivas. No lo eran:

- **253 estaban OBSOLETAS**: el respaldo no coincidía ni con el valor oscuro ni
  con el claro de su propio token. Eran los colores de **antes** del rediseño,
  congelados en el código.
- **5 apuntaban a tokens que NO EXISTÍAN** — `--warn-bg`, `--warn-border`,
  `--warn-text`, `--success` no estaban definidos en ningún tema. Ahí el
  respaldo no era un respaldo: era **el único valor que se pintaba jamás**,
  igual en claro que en oscuro.
- Sólo 22 coincidían con la realidad.

**Lo peor que podía pasar**: `var(--text, #0f172a)`, en 35 sitios. Si ese
respaldo llegara a usarse, pintaría texto casi negro sobre el lienzo `#0B0C0E`.
Contraste ≈ 1,05 : 1. **Texto invisible.**

**Lo que ya pasaba**: la tarjeta de aviso de `/pacientes` se pintaba color crema
(`#fff8e6`) sobre el lienzo oscuro, porque `--warn-bg` no existía. Es la
**tercera** aparición de esta forma; las dos anteriores están contadas en el
comentario de `--panel` en `globals.css`.

**Y cuatro más, que el propio guardián encontró al escribirlo**: `--danger`,
`--muted`, `--surface` y `--text1` se usaban **sin respaldo ninguno**. No
pintaban un color equivocado — no pintaban **nada**. El mensaje de error de
Configuración no salía en rojo, y una tarjeta se quedaba sin superficie.

**Causa raíz.** Un respaldo es un **segundo valor para la misma decisión**. Nace
igual que el primero y se queda quieto mientras el token evoluciona. Nadie lo
actualiza porque nadie lo ve: sólo se pintaría si el token faltara, y el token
nunca falta… hasta el día que sí.

**Cómo se descubrió.** Empezando la unidad con una cifra de la auditoría
anterior —«1 205 hexadecimales a mano, 125 el azul de marca retecleado»— que
resultó estar **mal contada**: la mayoría no eran literales sueltos sino
respaldos dentro de `var()`. Corregir la cuenta convirtió un hallazgo mediano en
uno peor.

**Familia.** `se_contradice` — el token es correcto, el respaldo lo fue, y
ninguna revisión de una sola pieza encuentra el hueco entre los dos.

**Arreglo.** Cero respaldos: los 286 retirados. Los cuatro tokens que faltaban,
definidos en **los dos** temas con la semántica que ya existía (el ámbar y el
verde medidos), sin inventar color nuevo; el tema claro conserva exactamente lo
que se venía pintando. Los cuatro fantasmas sin respaldo, apuntados a su token
real.

**Y la causa raíz del monolito de estilo en línea, de paso**: `@theme inline`
exponía **cuatro** cosas a Tailwind, así que no había ninguna utilidad de marca
que usar y el código no tenía alternativa al estilo en línea (6 065 `style={{`
en el 88,5 % de los archivos). Ahora expone ~35, con prefijo `nx-` para no
reinterpretar la escala por omisión de Tailwind. Y nacen las escalas que
faltaban: radio, espacio, elevación, movimiento y tipografía.

**Guardián.** `src/__tests__/el-sistema-de-diseno-no-pierde-terreno.test.ts`,
11 casos, más el trinquete `scripts/design/trinquete-de-diseno.mjs`. Probado al
revés: reponiendo un solo respaldo, quitando un token de aviso o estrechando
`@theme inline`, falla.

---

## REG-299 — Dos guardianes con cuerpo de línea de órdenes en el ámbito del módulo

**Encontrado** al comprobar al revés el guardián de REG-298.

**Qué pasaba.** Los dos scripts de `scripts/design/` ejecutaban su cuerpo de
línea de órdenes **al importarlos**. Consecuencias distintas y las dos malas:

1. `trinquete-de-diseno.mjs` llamaba a `process.exit(1)`, así que una regresión
   de diseño **tumbaba la recolección** de la prueba en vez de fallar un caso.
   El fallo se veía, pero decía otra cosa.

2. `inventario-de-pantallas.mjs` **reescribía `SCREEN_INVENTORY.md`**. La prueba
   comparaba el archivo contra `generar()` … después de que el propio `import` lo
   hubiera puesto al día. **El guardián no podía fallar nunca.**

**Lo que hace a éste peor que un defecto normal.** El segundo se «probó al
revés» al crearlo, en REG de `PATIENT-UX-TRUTH-001`: se añadió una pantalla
falsa y **se dio por bueno que pasara en verde**. Se ejecutó la comprobación
correcta y no se miró el resultado. Estuvo dos commits fingiendo ser una prueba,
y de paso explica por qué `SCREEN_INVENTORY.md` aparecía modificado sin que
nadie corriera el generador.

**La regla.** Probar al revés no es suficiente **si no se mira el resultado**.
Una prueba que pasa cuando debería fallar es peor que ninguna: ocupa el sitio.

**Arreglo.** El cuerpo de línea de órdenes de los dos scripts sólo corre si el
módulo se invoca directamente (`import.meta.url` contra `process.argv[1]`).

**Familia.** `sin_medir` — el instrumento existía y no medía.

**Guardián.** Los dos guardianes de siempre, ahora fallando de verdad al revés:
añadiendo una pantalla sin regenerar, el inventario cae; reponiendo un respaldo,
el trinquete cae.

---

## REG-300 — La fecha de seguimiento se perdía, y el volcado borraba la copia buena

**Encontrado por** la auditoría de navegación de `PATIENT-UX-TRUTH-001`,
reparado en `NAVIGATION-001`.

**Qué pasaba.** `proximoSeguimiento` estaba en el respaldo con rebote y en la
restauración, pero **ausente** del espejo vivo, del espejo en memoria y del
volcado al desmontar. Como el espejo en memoria es el que manda al restaurar, el
campo salía en blanco al volver de otra pantalla. Y peor: `flushRespaldo`
**reescribía la clave de `localStorage` sin el campo**, borrando lo que el rebote
de 1 500 ms ya había guardado bien.

**Qué se pierde.** La fecha de seguimiento alimenta el contador de seguimientos
vencidos del CRM y la tarea de la lista de trabajo. El comentario del propio
código ya documentaba que **este mismo campo se había perdido una vez**
(REG-193): aquel arreglo cubrió **uno** de los tres caminos de escritura.

**Causa raíz — y es la que importa.** La regla «¿hay algo que valga la pena
guardar?» estaba escrita **tres veces, palabra por palabra**: en el espejo en
memoria, en el volcado y en el oyente de `nx:guardar-todo`. Familia
`depende_de_recordar`. Basta añadir un campo en dos de los tres para que el
tercero empiece a decir que la nota está vacía cuando no lo está.

**Arreglo.** Una sola definición, `hayContenido(e)`, y las tres la llaman. El
campo viaja ya en el espejo vivo y en los dos respaldos.

**Guardián.** `src/__tests__/la-navegacion-devuelve-el-contexto.test.ts`. Probado
al revés: quitando el campo del volcado, o devolviendo una de las tres copias de
la regla, falla.

---

## REG-301 — El atrás de la consulta nunca volvía a la agenda

**Qué pasaba.** El botón de atrás hacía `router.push(volverA)`: un destino
**fijo** —el expediente— y además **apilando** una entrada nueva en el historial.

La agenda abre la consulta directamente (`citas` → `/consulta/:id`), que es el
camino normal del día. Así que el médico salía al expediente, no a su agenda; y
desde el expediente, cuyo atrás **sí** es inteligente, volvía a la consulta.
Quedaba oscilando entre dos pantallas **sin poder regresar a la lista del día**,
salvo por la barra lateral — que monta `/citas` de cero y pierde el contexto
(REG-302).

**Lo que lo hace tonto de puro evitable**: `useSmartBack` existía desde hace
tiempo y lo usaban **diez** pantallas. La consulta, que es la que más falta
hacía, era de las pocas que no.

**Arreglo.** `useSmartBack(volverA)`: si hay historial dentro de la aplicación,
se vuelve por donde se vino; si se llegó por enlace directo, recarga o
notificación, el destino fijo sigue de respaldo. El `push` que queda es el de
**descartar** la consulta, que sí es un destino y no un regreso.

**Familia.** `estorba`.

---

## REG-302 — La agenda olvidaba el día que se estaba mirando

**Qué pasaba.** `selectedDate`, el filtro de estado y la búsqueda eran `useState`
puro. Como `(dashboard)/template.tsx` desmonta la página en **cada** navegación,
volver de una consulta devolvía la agenda a hoy, «todas» y sin búsqueda.

En una jornada normal eso es **una vez por paciente**: quien trabaja el jueves
desde el martes vuelve a poner la fecha después de cada uno.

Y había un segundo mordisco: al abrir una cita por enlace (`?id=`), las dos
limpiezas hacían `router.replace('/citas')` **pelado**, que quitaba el `id` **y
de paso** el día, el filtro y la búsqueda.

**Arreglo.** El estado vive en la URL (`?d=&f=&q=`), que es lo que la
especificación pide con esas palabras («URL-addressable state») y además lo más
barato: la URL ya sobrevive al desmontaje, al atrás del navegador y a compartir
el enlace. Se escribe con `replace` y con rebote —cambiar de día no debe llenar
el historial— y lo que viene de la URL **se valida**: `?d=borrame` dejaría la
agenda pidiendo una ventana inexistente y la pantalla en blanco sin decir por
qué.

**Familia.** `perdida`.

---

## REG-303 — Navegar dentro de la aplicación cortaba el dictado sin avisar

**Qué pasaba.** REG-295 y REG-296 cerraron la **pérdida**: el trozo final se
persiste, el audio sobrevive en IndexedDB y hay `beforeunload` al recargar o
cerrar la pestaña. Quedaba el **aviso** dentro de la aplicación:
`beforeunload` **no se dispara en un `router.push`**, y `template.tsx` desmonta
la página en cada navegación. Tocar «Agenda» seguía terminando la grabación sin
que el médico se enterara.

**Por qué se interceptan los clics y no la ruta.** El App Router **no expone
eventos de ruta**. Las alternativas eran parchear `history.pushState` —global, y
capaz de romper cualquier navegación— o mirar los clics. Se miran los clics, y
**sólo mientras se graba**: es el ámbito más pequeño que cubre el caso real,
porque todas las salidas de la consulta son `<Link>`.

**Arreglo.** `useAvisoAlSalirGrabando`. Pregunta, **no impide**: el audio está a
salvo y el médico tiene que poder irse. No se mete donde no desmonta nada —
modificador, botón secundario, `target`, enlace externo, o enlace a la pantalla
en la que ya se está, que es lo que hace el botón central de la barra inferior
durante una consulta. Un aviso que salta donde no debe se acaba ignorando
(REG-245).

**Lo que NO cubre, declarado en el propio hook**: el botón «atrás» del navegador
es un `popstate`, no un clic, y cancelarlo exigiría empujar una entrada falsa al
historial — la clase de truco que rompe el atrás para todo lo demás. No se hace.

**Familia.** `no_conectado`.

---

## REG-304 — El compañero del paciente, y la compuerta que impide enseñarle un borrador

**Unidad** V9 `PATIENT-COMPANION-001`. No repara un defecto observado: **pone la
defensa antes de que exista la superficie que la necesita**, y por eso merece
entrada propia.

**Por qué antes y no después.** Hasta hoy la IA y los datos de este producto le
hablaban a un internista con cédula: un error se lo comía alguien entrenado para
verlo. La primera vez que el producto le habla al **paciente**, el lector **no
puede detectar el error**. No sabe que esa dosis todavía no estaba revisada, ni
que ese diagnóstico era una hipótesis a medio dictar.

**Lo que queda montado.**

- `PaqueteDeVisita` con los trece campos de la especificación y **dos** estados:
  `DRAFT` y `RELEASED`. Nace `DRAFT` **aunque la nota ya esté firmada** — firmar
  es un acto hacia el expediente y liberar es un acto hacia el paciente; se
  pueden hacer en el mismo gesto y se registran aparte (regla 4 de
  `patient-facing-ai.md`).
- `liberar()` **exige** quién aprueba y cuándo, y se niega si falta cualquiera de
  los dos: un campo vacío en la base es indistinguible de un campo que nadie
  llenó.
- `visibleParaElPaciente()` exige las **tres** condiciones a la vez. Un
  `RELEASED` sin `approvedBy` es un documento al que alguien le puso el estado a
  mano — y eso pasa, en una migración o con la consola abierta.
- **El servidor filtra, no la pantalla.** `/api/portal` acción `paquetes` aplica
  la compuerta antes de responder, y exige alcance `clinico`. Esconder una
  pestaña no cierra una ruta HTTP.
- Los **cinco destinos** —Hoy · Preguntar · Cuidado · Documentos · Perfil— en
  `/mi/[token]`, con barra fija abajo porque esa pantalla se usa con una mano,
  de pie, en la sala de espera. Cinco es el techo de la especificación para
  móvil, no el objetivo.
- La colección declarada en los **tres** sitios que exige la regla de
  aislamiento (`firestore.rules` con escritura cerrada, matriz de acceso,
  manifiesto del respaldo) **y en un cuarto**: la exportación ARCO. El paquete es
  dato del titular, incluidos los borradores.

**Lo que NO se hizo, y es lo que más dice de esta unidad.**

`componerPaquete` —la función que arma el contenido desde la nota firmada— se
escribió, y **el guardián de conexión la cazó al instante**: motor con cuerpo
real y sin un solo llamador. Su llamador natural es la pantalla donde el médico
revisa y libera, que es `POSTVISIT-001`.

«Escrito, probado y sin conectar» es la familia **más grande de este proyecto**
—32 de 127—, y añadirle una más a sabiendas, aunque fuera con una nota
explicándolo, sería exactamente lo que este repositorio lleva meses
persiguiendo. Se difirió. Al quitarla, el guardián cazó a su ayudante
`cambiosDeMedicacion` en la vuelta siguiente: **un motor sin llamador no deja de
serlo porque su vecino se haya ido.** Se fueron los dos.

**Y una honestidad de pantalla.** «Preguntar» **no responde**: la especificación
pide inteligencia acotada al plan de cuidado, y eso llega en `PATIENT-AI-001`.
Mientras tanto escala al consultorio, que es el producto y no el fallo (§3 de la
regla). «Perfil» dice que el idioma es es-MX y que todavía no se puede autorizar
a un cuidador, en vez de enseñar controles que no hacen nada: un selector con un
solo idioma le miente al paciente sobre lo que puede esperar.

**Familia.** `hueco_frente_al_mercado` — la casilla de aprobación explícita está
vacía en todo el material público de Abridge, Nabla, Suki y Dragon Copilot.

**Guardián.** `src/__tests__/un-borrador-no-llega-al-paciente.test.ts`, 13 casos.

---

## REG-305 — Dos guardianes de diseño que se contradecían

**Encontrado** al montar la pantalla del paciente con los tokens nuevos.

**Qué pasaba.** `escala-visual-trinquete` contaba «radios distintos» metiendo en
el mismo saco `borderRadius: 7` y `borderRadius: 'var(--r-lg)'`. El primero es
deriva; el segundo es exactamente lo que pide el sistema de diseño.

Resultado: el trinquete de diseño de `DESIGN-SYSTEM-001` **premia** usar el
token y éste lo **castigaba**. La primera pantalla que hizo lo correcto puso el
CI en rojo, y el arreglo «natural» habría sido volver al número suelto.

**Familia.** `se_contradice` — cada guardián correcto por su cuenta, el fallo en
el hueco entre los dos. Es la misma forma que REG-223 (el azul que servía de
texto y de relleno con requisitos opuestos), ahora entre dos pruebas.

**Arreglo.** El contador excluye los valores que son una variable CSS. La
píldora sigue vigilada aparte y a cero, que es donde tiene que estar.

---

## REG-306 — El medidor del teléfono decía 0 con la pantalla rota

**Encontrado** el 9-ago-2026, con la aplicación abierta en la cuenta del dueño y
la ventana a 390 px de ancho. La pantalla de inicio se salía de la pantalla: las
cuatro tarjetas seguían de dos en dos, «Agenda de hoy» y «Accesos rápidos»
seguían lado a lado en un teléfono, y la columna derecha quedaba cortada.

**Qué pasaba.** `gridTemplateColumns: '1fr 300px'` —fija, en píxeles— y **ni una
sola consulta de medios propia** en toda la pantalla. De los 328 px útiles de un
teléfono de 360, la columna derecha se llevaba 300.

**Y el instrumento existía.** `scripts/calidad/cabe-en-un-telefono.mjs` (REG-265)
lleva desde el 2 de agosto midiendo exactamente esto, y **informaba de cero**.
Sus tres clases eran: ancho fijo `width: Npx`, rejilla `minmax(Npx, …)` sin
`min()`, e imagen sin tope. Una pista de rejilla clavada en píxeles **no es
ninguna de las tres**: no es un `width:` y no está dentro de un `minmax(`. La
clase estaba a un lado de las tres y nadie la escribió.

**Familia.** `sin_medir` — no es un defecto del producto, es la ausencia del
instrumento que lo habría delatado. Con el agravante de que aquí el instrumento
**sí estaba**, y su silencio se leía como buena noticia.

**Arreglo.** Dos cosas, y las dos hacían falta:

1. **La pantalla** (V10 · HOME-001): una sola columna a cualquier ancho, con sus
   consultas de medios propias a 640 y 560 px. Se fueron las cuatro tarjetas KPI
   (§14 del charter V10: «no construyas un tablero de KPIs genérico para
   médicos»), «Accesos rápidos» (§9, navegación duplicada: sus cuatro destinos
   ya están en la barra lateral), el «Citas hoy» del encabezado (§9, encabezado
   duplicado) y el sparkline de siete días. Los números siguen, en un renglón.

2. **La cuarta clase del medidor**: pista de rejilla en píxeles secos por encima
   de 160. La primera medición dio **cuatro**, y los cuatro eran falsos —
   configuración, recetas, orden y receta llevan su `className` y su consulta de
   medios en `1fr !important`, que es la forma correcta. Excluidos **por lo que
   hacen**, no por su nombre: `seApilaEnMovil()` comprueba que exista esa regla.
   Real, tras la segunda pasada: **cero**.

**Guardianes.** `src/__tests__/la-pantalla-de-hoy-no-es-un-tablero.test.ts`
(19 casos) y la clase 4 de `lo-que-un-telefono-no-puede-encoger.test.ts`.
Verificado que la clase 4 sí caza la forma original: un archivo de prueba con
`gridTemplateColumns: '1fr 300px'` aparece, y desaparece al borrarlo.

**Lo que sigue sin cubrir, dicho en vez de dejarlo creer.** Esto acota, no
sustituye al navegador. El desborde por una tabla ancha, un `flex-basis` o un
texto sin cortar sigue pasando por aquí sin despeinarse.

## REG-307 — El saludo decía «Buenas tardes, Dra.» — el título sin el nombre

**Encontrado por** la primera pasada del arnés de capturas de V10-TRUTH-001
(9-ago-2026): golden flow autenticado en Chromium real, emuladores de Auth +
Firestore, cuenta sintética con `displayName: 'Dra. Elena Sandoval Rivas'`.

**Qué pasaba.** La pantalla de inicio saludaba con el título a secas. La cuenta
aún no tenía `config.nombreMedico`, así que `nombreSaludo` cayó a la rama del
`displayName` — que tomaba `split(' ')[0]` **sin quitar el título**. «Dra.
Elena Sandoval Rivas» → «Dra.».

**Causa raíz — media defensa.** `quitarPrefijoDr` existía exactamente para esto
y la rama del médico (`nombreMedico`) sí lo aplicaba. La rama del asistente y la
del arranque (config sin cargar) no. La misma regla escrita en un camino y
ausente en el de al lado: familia `se_contradice`.

**Arreglo.** La función se extrajo a `src/lib/hoy/saludo.ts` (mismo criterio
que `resumen-del-dia.ts`: poder probarla sin montar la pantalla) y la rama del
`displayName` aplica `quitarPrefijoDr` con salvaguarda: si el displayName es
SÓLO el título («Dra.»), se saluda con él antes que con un vacío.

**Guardián.** `src/__tests__/lo-que-la-captura-real-midio.test.ts` (8 casos).
Probado al revés: reponiendo `displayName.split(' ')[0]` fallan los dos casos
del título.

**Qué NO cubre.** El render real del saludo (eso lo mide la captura del arnés);
otros usos de `displayName` fuera del saludo.

**Familia.** `se_contradice`.

## REG-308 — El botón «Iniciar consulta» del héroe fallaba AA: 2.9:1

**Encontrado por** axe-core 4.11 corriendo sobre la página SERVIDA en la misma
pasada del arnés (V10-TRUTH-001). Con 8 500 casos en verde y `tsc` limpio: el
defecto sólo existe en el render.

**Qué pasaba.** `.prox-hero-cta` — el CTA principal de la pantalla de inicio
rediseñada en HOME-001 — pintaba blanco sobre `var(--nexus)` (#6E84FE):
**2.9:1**, por debajo del 4.5:1 de AA.

**Causa raíz.** El propio sistema de tokens lo tenía escrito: `--nexus` se
aclaró para ser **texto** legible sobre superficies (su comentario: «AA sobre
--s3 (4.63); antes #3D5AFE = 2.96») y para **rellenos** con texto blanco está
`--nexus-solido` (#3D5AFE, 5.1:1 con blanco) — la regla que `.btn-primary` ya
sigue con su comentario «Relleno, no texto: va el azul sólido». El héroe nuevo
usó el token de texto como relleno. La regla existía; el instrumento (axe sobre
la app servida) no corría: familia `sin_medir`, la misma de REG-306 y con la
misma moraleja — el defecto nació EN la unidad que presumía haber medido.

**Arreglo.** `background: var(--nexus-solido)` en `.prox-hero-cta`, con el
porqué medido en el comentario. Verificado re-capturando: `/dashboard` pasó de
1 violación axe a **0**.

**Guardián.** `src/__tests__/lo-que-la-captura-real-midio.test.ts` — cerrojo
estático sobre el bloque CSS. Probado al revés: reponiendo `var(--nexus)` como
fondo, falla.

**Qué NO cubre.** La medición de verdad es axe sobre la captura
(`docs/design/capturas/v10-truth/axe-baseline.json`); el cerrojo sólo impide
que el par ilegible vuelva a ese selector. Los demás usos de `--nexus` como
relleno van saliendo pantalla por pantalla con el arnés — señalar de menos.

**Familia.** `sin_medir`.

---

## REG-309 — «Sin referencia de dosis» se descartaba también en niños

**Encontrado** en la auditoría de nueve dimensiones (hallazgo G2, backlog
`SAFE-003`), confirmado leyendo el código el 9-ago-2026.

**Qué pasaba.** `revisarDosis` marca `sin_referencia` (severidad `info`) cuando
el fármaco no está en `CATALOGO`: es la forma explícita del motor de decir «no
pude verificar esta dosis» — la propia regla 4 de `clinical-safety.md`, ausencia
de dato no es dato de ausencia. Tanto la pantalla de receta
(`receta/[patientId]/[notaId]/page.tsx`) como la revisión previa a firmar
(`dosisPeligrosasDeLaLista`, el llamador que REG-190 adelantó justo para cazar
esto ANTES de que el paciente se fuera con la receta) descartaban ese código
**siempre**, sin mirar la edad del paciente.

**Por qué importa.** En un adulto, ocultar `sin_referencia` es ruido de
pantalla: el resto del catálogo cubre el error más caro (el decimal). En
pediatría la dosis se calcula por kilogramo y el margen entre la dosis útil y la
tóxica es estrecho — que el fármaco recetado no tenga referencia es
precisamente el caso en que el motor NO pudo hacer la comprobación mg/kg, y la
pantalla lo callaba exactamente igual que si sí la hubiera hecho. Callar «no se
pudo verificar» se lee como «la dosis está comprobada».

**Arreglo.** `filtrarAlertasParaMostrar(alertas, esPediatrico)`, nueva en
`dosis.ts`: conserva `sin_referencia` cuando el paciente es menor de 18 años: en
adultos el comportamiento no cambia. Un único punto de decisión, reutilizado por
los dos llamadores.

**Lo que NO se hace.** No decide si `sin_referencia` debería mostrarse también
en adultos — es una pregunta de ruido en pantalla, no de seguridad pediátrica, y
sigue sin responder. No amplía `CATALOGO`: un fármaco que ya está en el
catálogo no dispara `sin_referencia`, con o sin este cambio.

**Familia.** `silencio_que_se_lee_como_verificado` (nueva) — una señal explícita
de «no sé» existía en el motor y una pantalla la apagaba por regla general, sin
distinguir la población en la que ese silencio pesa distinto.

**Guardián.** `src/__tests__/sin-referencia-pesa-distinto-en-ninos.test.ts`, 7
casos. Prueba al revés: reproduce el filtro incondicional tal como vivía antes
del arreglo y comprueba que, con él, un fármaco sin referencia en un niño de 5
años no genera ningún aviso.

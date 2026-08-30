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

## REG-309 — Desmontar el grabador dejaba la pantalla diciendo «escuchando»

**Encontrado por** la auditoría de sólo lectura del modo escuchando (10-ago-2026).

**Qué pasaba.** Al entrar en `grabando` o `pausado`, `useGrabacionAudio` emitía
`activo: true` para el marco global. Al detener normalmente, el siguiente render
emitía `activo: false`; al navegar con el micrófono abierto, en cambio, el hook
se desmontaba y ya no existía ese render. El cleanup retiraba el latido y el
aviso de salida, pero no cerraba la señal. La UI podía seguir afirmando que el
micrófono estaba activo después de haberlo cerrado.

**Causa raíz.** El cierre de una señal global se confió a una transición de
estado local. Un unmount ejecuta efectos de limpieza, no produce una transición
final a `inactivo`.

**Arreglo.** El mismo montaje que abre la señal devuelve ahora un cleanup que
retira sus recursos y emite `activo: false`. No cambia el grabador, el evento ni
el consumidor existentes.

**Guardián.** `src/__tests__/grabacion-unmount-cierra-escucha.test.ts` (1 caso)
ejecuta el ciclo observable mount activo → recording → unmount y exige la
secuencia `[true, false]`. Probado al revés: sin el aviso del cleanup termina en
`[true]` y falla.

**Qué NO cubre.** La transcripción, IndexedDB y el buffer final de
`MediaRecorder`; conservan sus guardianes propios.

**Familia.** `no_conectado` — el cierre existía para la transición de estado,
pero no estaba conectado al camino de unmount.

---

## REG-310 — La fecha de control tecleada al final nunca llegaba: firmar la ignoraba

**Encontrado por** el arnés de navegador de `V15-NOTE-PLAN-CONTINUITY-001`
(quinta rebanada, 11-ago-2026), verificando OTRA cosa: que el paso «Agendar el
seguimiento» del checklist de cierre sobreviviera a volver de `/citas`.

**Qué pasaba.** `firmar` es un `useCallback` y `proximoSeguimiento` no estaba
en sus dependencias — ni en las de `construirNota`, su único camino indirecto.
Teclear la fecha de «Próxima consulta» como ÚLTIMO gesto antes de firmar (el
orden natural: el control se decide al cerrar) no recreaba el callback, así que
firmar corría con la fecha memorizada de un render anterior: `''`. Las dos
salidas de REG-300 —la tarea «Agendar el seguimiento» del worklist y
`patient.proximoSeguimiento` del CRM— recibían vacío y no escribían nada.

**Medido, no supuesto.** Contra el emulador de Firestore, con el arnés de la
Fase 8: cinco notas firmadas con fecha `2026-09-08` → sus `estudio_pendiente`
y `receta_por_entregar` SÍ nacieron (estudios y medicamentos son dependencias
de `construirNota`, que sí recrea el callback) y cero tareas
`tipo: 'seguimiento'`, con `patient.proximoSeguimiento` intacto en su valor
sembrado — el recorte quirúrgico exacto que predice la clausura obsoleta, no
un fallo general de escritura. Tras el arreglo, dos firmas → dos tareas
`seguimiento` y el campo del paciente actualizado. La pantalla mientras tanto
SÍ pintaba el paso en el checklist (el render usa el estado vivo), así que
todo se veía correcto.

**Causa raíz.** El tercer camino de pérdida del MISMO dato (REG-193 el respaldo,
REG-300 los espejos, éste el cierre): una lista de dependencias escrita a mano
que no se actualizó cuando REG-300 conectó el dato al firmar. Familia
`depende_de_recordar` — y hermana directa de «el dato tiene que LLEGAR»: la
prueba de contrato del motor (`derivar.ts`) estaba en verde porque el motor sí
sabe derivar; lo que nunca se miró fue si el dato le llegaba desde la pantalla.

**Arreglo.** `proximoSeguimiento` en el array de dependencias de `firmar`
(`src/app/(dashboard)/consulta/[patientId]/page.tsx`).

**Guardián.** `src/__tests__/v15-cierre-agenda-el-seguimiento.test.ts` — el caso
REG-310 lee el array de dependencias REAL de la fuente y falla si el campo sale
de la lista. Probado al revés contra el árbol sin el arreglo. Los demás casos
del archivo protegen la rebanada que lo descubrió (paso de cierre + hoja del
paciente + persistencia en `sessionStorage`).

**Qué NO cubre.** Que React ejecute el callback recreado (eso es React, no este
código); los otros consumidores de `proximoSeguimiento` (respaldo local,
espejos) conservan sus guardianes de REG-193/REG-300. Tampoco cubre las demás
dependencias de `firmar`: una lista a mano puede volver a desactualizarse por
otro campo — el caso sólo vigila éste.

**Familia.** `depende_de_recordar`.

## REG-311 — El ancla del paciente volvió a decidir la negación de alergias por su cuenta

**Encontrado por** el equipo rojo de originalidad de
`V15-ORIGINALITY-REDTEAM-001` (13-ago-2026), contrastando las capturas del
panel §26/§41 contra el golden de REG-279.

**Qué pasaba.** `PatientAnchor` — el componente que V15 escribió para que
identidad y seguridad estén SIEMPRE visibles en el expediente — nació con la
SÉPTIMA copia local de la regla de negación:
`/^(ninguna|niega|no|sin|nkda|negad)/i`, peor que la que REG-279 condenó
(perdió el `\b`). «Niega penicilina. Alérgico a sulfas» —la cadena motivadora
de REG-279— salía como «sin alergias» en gris; «Nolotil» empieza por «no» y
también; una alergia sólo en `alergiasEstructuradas` salía como
«no registradas». En `/consulta` convivían además DOS criterios en el mismo
viewport: la franja editable pintaba rojo con CUALQUIER texto («Niega
alergias» → ROJO) y la píldora del encabezado usaba el prefijo («Niega
penicilina. Alérgico a sulfas» → NEUTRO): dos alarmas contradictorias para el
mismo dato donde se prescribe.

**Causa raíz.** El golden de REG-279 fija la semántica pero su guarda de
fuente sólo mira `hospitalizacion/[internamientoId]/page.tsx`: nada impedía
que un componente NUEVO trajera la octava copia. La regla existía; el barrido
no.

**Arreglo.** Las tres piezas (ancla + franja editable + píldora de consulta)
derivan de `alergenosDe`/`negacionesEnTexto` (el módulo sellado): rojo con los
ALÉRGENOS enseñados, gris sólo con negación explícita y nada restante, y el
hueco en ámbar («no registradas» — regla 4). En rojo se pintan los alérgenos,
no la frase cruda que los esconde.

**Guardián.** `src/__tests__/reg-311-el-ancla-no-decide-la-negacion.test.ts`
(9 casos): la decisión del ancla con las cadenas de REG-279 + «Nolotil» +
sólo-estructuradas, las guardas de fuente de las tres piezas, y el BARRIDO de
repositorio que impide la octava copia (la familia de regex de prefijo, en
todo `src/app` + `src/components`). Probado al revés: contra el árbol sin el
arreglo fallan 3.

**Qué NO cubre.** El render real (colores/DOM — arnés de capturas); una
reimplementación futura sin regex (`startsWith('niega')`); la franja de
hospitalización (golden propio de REG-279).

**Familia.** `copia_local_de_regla_sellada` (hermana de REG-279, REG-171,
REG-201).

## REG-312 — La coreografía de continuidad abría una ventana de clic ciego: pantalla vieja pintada, DOM nuevo debajo

**Encontrado por** el equipo rojo de originalidad de
`V15-ORIGINALITY-REDTEAM-001` (panel B, hallazgo RT-08, 13-ago-2026), leyendo
`continuidad.ts` en busca de motion decorativo. El único hallazgo del panel
con riesgo clínico: **paciente equivocado**.

**Qué pasaba.** Mientras corre el callback de `document.startViewTransition`,
el navegador pinta la instantánea VIEJA congelada pero el hit-testing corre
contra el DOM vivo — que ya es la ruta NUEVA (`navegar()` es lo primero que
hace el callback). Con el tope de espera en 1200ms, un médico que venía de una
worklist con un «Consulta» por renglón podía hacer clic sobre lo que VEÍA (la
fila del paciente A) y aterrizar sobre lo que HABÍA debajo: el encuentro de
OTRO paciente. El guardián de motion existente sólo cubría la fase de
animación (`::view-transition { pointer-events: none }`, §20) — ese overlay ni
existe durante el callback.

**Causa raíz.** El API separa lo que se PINTA (instantánea vieja) de lo que
RECIBE eventos (DOM nuevo) durante el callback, y el diseño original sólo
pensó en el cuadro (tope para que la pantalla no se congele de más), no en el
puntero (que durante ese tramo apunta a una pantalla que no se ve).

**Arreglo.** (1) Candado: el callback pone `data-vt-congelada` en `<html>` y
globals.css lo traduce a `pointer-events: none` sobre `<body>`; se suelta en
un `finally` — commit, tope o excepción de `navegar()`. (2) La ventana se
acorta: tope 1200 → 400ms. Una ruta más lenta pierde el morph (la cubre el
crossfade de siempre), no la seguridad.

**Guardián.** `src/__tests__/rt-08-ventana-de-clic-ciego.test.ts` (6 casos):
candado puesto durante el callback y suelto al commit / al tope / ante
excepción (DOM de mentira con el contrato exacto del API), la regla CSS, la
igualdad del atributo y el tope declarado. **Probado al revés ×2**: sin el
candado fallan 5; con el tope viejo (1200) fallan 2 — incluido el caso de
temporizador, que no es lectura de fuente.

**Qué NO cubre.** El hit-testing verdadero en navegador (lo mide
`scripts/design/medir-continuidad-v15.mjs` con el API real); la fase de
animación (contrato de §20 en `v15-motion-continuidad-de-objeto.test.ts`); y
un teclado durante la ventana — `pointer-events` no bloquea Enter sobre un
elemento ya enfocado; ventana ≤400ms y el foco no viaja solo al DOM nuevo,
riesgo aceptado y anotado.

**Familia.** `se_contradice` — lo que se PINTA (instantánea vieja) y lo que
RECIBE el clic (DOM nuevo) afirman cosas incompatibles y ninguna está mal
por su cuenta: el fallo vive en el hueco entre las dos. Hermana conceptual
de «el dato tiene que llegar»: aquí el clic tiene que llegar A LO QUE SE VE.

---

## REG-313 — Dos avisos se contradecían sobre el MISMO archivo, y el que se leía era el falso

**Fecha.** 14-ago-2026 · **Encontrado por.** RTC-21 (V15), al consolidar el
bloque de exportación del expediente.

**Qué pasaba.** El botón de exportación estándar del expediente lanzaba
`toast()` **dos veces** por una sola descarga, y los dos avisos afirmaban cosas
incompatibles sobre el archivo que el médico acababa de bajar:

1. «Archivo FHIR descargado: N nota(s) firmada(s) y M en borrador, **marcadas
   como preliminares**. Los borradores van sin diagnósticos ni recetas
   estructuradas.» → los borradores **van**.
2. «FHIR R4 exportado con X notas firmadas. M en borrador **NO van en FHIR** —
   usa «Expediente completo».» → los borradores **no van**.

**Cuál era verdad.** Se miró del otro lado, que es lo que la regla «el dato
tiene que LLEGAR» pide: `src/lib/fhir-export.ts` tiene, desde que se arregló
que los borradores se cayeran en silencio, un segundo bucle
`notas.filter(n => n.estado !== 'firmada')` que los exporta como
`Composition.status: 'preliminary'`, con su narrativa y **sin** `Condition` ni
`MedicationRequest`. O sea: **el aviso 1 era cierto y el 2 era falso**.

**Por qué importa, y no es cosmético.** El aviso falso era el **último en
pintarse** — el que queda en pantalla y el que se lee. De modo que, cada vez
que había una nota sin firmar, la aplicación le decía al médico que el archivo
que estaba a punto de mandar a otra institución no llevaba nada sin firmar.
Sí lo llevaba. Dos consecuencias:

- **Contenido clínico sin firmar salía del consultorio** mientras el médico
  creía lo contrario. La firma existe justo para separar lo que se afirma de lo
  que todavía se está escribiendo.
- De propina, el aviso mandaba a exportar el expediente completo «para
  incluirlas» — a duplicar una salida de PHI para conseguir algo que ya estaba
  dentro del primer archivo.

**Causa raíz.** Dos redacciones del mismo hecho escritas en momentos
distintos, una encima de la otra, sin que ninguna prueba comparase la promesa
de la pantalla con la conducta del exportador. Los guardianes que existían
fijaban **literales de la frase** (`'NO van en FHIR'`,
`const borradores = notas.filter(...)`), así que protegían la mentira: cuando
el exportador cambió de conducta, el texto no tenía que seguirlo.

**Arreglo.** Un solo aviso, con lo que el exportador hace de verdad («… y M en
borrador, que viajan marcadas como preliminares y sólo con su texto — sin
diagnósticos ni recetas estructuradas»), y la misma explicación **antes** de
descargar, bajo el rótulo del bloque: elegir el archivo es una decisión previa,
no una lectura posterior.

**Guardián.** `src/__tests__/v15-rtc21-exportar-dice-el-trabajo.test.ts`, caso
6: **llama a `exportarPacienteAFhir` con una nota firmada y una en borrador**,
comprueba que sale una `Composition` `preliminary` y, con eso demostrado, exige
que la pantalla no prometa una exclusión que no ocurre. Ata los dos lados para
que no puedan volver a divergir. Probado al revés: devolviendo el segundo
`toast` cae el caso 4; devolviendo la frase falsa cae el 6.

Los otros tres guardianes que fijaban la redacción vieja
(`exportacion-completa`, `fhir-borradores`, `v15-rtc10-primer-viewport-clinico`)
se corrigieron **con su porqué escrito dentro**: mantienen la intención —que la
pantalla declare qué pasa con lo que no está firmado— y dejan de exigir la
frase que era mentira.

**Qué NO cubre.** Que el sistema receptor trate bien un `preliminary` (eso es
del otro extremo del cable); y el contenido del expediente completo, que tiene
sus propias pruebas.

**Familia.** `se_contradice` — dos afirmaciones incompatibles sobre el mismo
objeto, ninguna mal por su cuenta, con el fallo viviendo en el hueco entre las
dos. Hermana de REG-312.

---

## REG-314 — la agenda vacía decía lo mismo en tres situaciones distintas, y una de ellas era mentira

**Fecha:** 14-ago-2026 · **Rama:** `v15/structural-uiux` · **Sev:** media

**Qué fallaba.** `/citas` estrecha su lista por CUATRO cosas —fecha, estado,
búsqueda y médico— y el estado vacío no miraba ninguna: pintaba «No hay citas
para este filtro · Cambia de fecha o de médico, o agenda una nueva cita», con
la ilustración de agenda vacía y un primario «Nueva cita», en tres situaciones
que no son la misma:

1. el día está libre de verdad,
2. el día **tiene** citas y un filtro las esconde,
3. hay filtro puesto y además el día está libre.

En el caso 2 el mensaje es falso por partida doble: dibuja una agenda vacía
sobre un día que no lo está, y ofrece como gesto principal **agendar encima**
de citas que el médico no está viendo.

**Cómo se descubrió.** Leyendo `filtered` para otra cosa. Al bajar al cierre
del riel apareció la contradicción escrita: el comentario dice «el riel no
muere en el vacío: apunta al día siguiente» y la condición era
`filtered.length > 0`, así que el puntero al día siguiente **desaparecía
exactamente el día vacío** — el único en que «el que viene tiene 6» es la
información que hace falta.

**Causa raíz.** El vacío se trató como un solo estado («no hay filas») cuando
son tres causas con tres respuestas distintas. Y el caso peligroso ya había
mordido a este producto por otro sitio: `useFiltroMedico` lleva escrito que un
filtro guardado en el navegador, apuntando a un médico dado de baja, dejaba la
agenda vacía todos los días sin control visible para quitarlo. Aquello se
reparó en el origen; el **mensaje** seguía sin poder distinguir «no hay» de
«no se ven». Es la regla 4 de seguridad clínica dicha en la pantalla: ausencia
de filas no es ausencia de citas.

**Arreglo.** `src/lib/agenda/vacio-de-la-agenda.ts` decide la clase de vacío y
el gesto que le corresponde; la pantalla la consume. Con citas escondidas se
dice cuántas hay y por qué filtro, **en línea y sin ilustración** —el día no
está vacío—, y el único gesto es quitar el filtro. Con el día libre de verdad
se dice qué trae el día siguiente y se ofrece ir, que es lo que el riel decía
sólo cuando había filas.

**Guardián.** `src/__tests__/v15-el-dia-vacio-dice-cual-de-los-tres.test.ts`
(7 casos). Probado al revés: sustituida la decisión por la conducta vieja —un
solo mensaje— caen 5 de 7. El caso 6 es el de conexión: la pantalla tiene que
consumir el módulo, o la decisión queda bien y no llega a ninguna pantalla.

**Verificado en navegador real** (escritorio 1440 + móvil 390, 0 errores de
consola), `scripts/design/medir-dia-vacio-citas-v15.mjs`:

| | escritorio | móvil |
|---|---|---|
| aviso de «6 escondidas» | línea, 62px, sin ilustración | línea, 134px |
| día libre | héroe, 332px | héroe, 340px |
| «Quitar los filtros» | devuelve 6 filas | 6 filas |
| «Ver el día siguiente» | aterriza en 6 filas | 6 filas |

Y la medición corrigió el trabajo: la primera versión titulaba «Jueves 13 de
agosto: sin citas agendadas.» — la captura enseñó que la cabecera ya dice el
día dos veces encima, así que el vacío lo decía por tercera vez y la noticia
quedaba de acompañante. El título pasó a «Sin citas agendadas.» Misma
corrección que RTC-22 le hizo a la marca.

**Qué NO cubre.** Qué citas debe esconder un filtro (eso no se tocó); el
estado de ERROR de carga, que ya distinguía «no se pudieron leer» de «no hay»;
y el resto de estados vacíos del producto — RTC-30 sigue abierto en las demás
pantallas, y éste se pagó porque su vacío **miente**, no porque sea genérico.

**Familia.** `se_contradice` — dos afirmaciones incompatibles sobre el mismo
día, y un comentario que dice lo contrario de su propia condición.

---

## REG-315 — la lista de pacientes vacía no decía cuántos había fuera, y el momento en que nace un expediente repetido no preguntaba nada

**Fecha:** 15-ago-2026 · **Rama:** `v15/structural-uiux` · **Sev:** media

**Qué fallaba.** `/pacientes` —la pantalla más visitada del producto— tenía
CUATRO estados vacíos, y tres de ellos eran un `<div>` suelto con un párrafo
gris centrado a 40px: sin componente, sin clase y **sin ningún control**:

    «Sin resultados para “x”.»
    «Aún no hay pacientes con citas recientes. Usa **Todos A-Z** o busca…»
    «Ningún paciente con inasistencias o cancelaciones.»

Los tres comparten el mismo defecto: **ninguno dice que la lista NO está
vacía.** Con seis expedientes dentro, el chip «Con alerta» pinta una pantalla
en blanco indistinguible de un consultorio recién abierto. Es la misma familia
que REG-314 acababa de pagar en `/citas`: ausencia de FILAS no es ausencia de
expedientes.

Y el de «Recientes» —que es la vista POR DEFECTO— mandaba a buscar un control
en NEGRITA («Usa **Todos A-Z**») en lugar de ofrecerlo. §24 falla un control
interactivo que no es un `<button>`; esto ni siquiera era un control, era una
instrucción para ir a buscar uno.

**Cómo se descubrió.** Contando los estados vacíos de las seis superficies de
§29 para cerrar RTC-30 («un patrón decidido UNA vez»). Hoy y Expediente ya
estaban convertidos; al abrir `/pacientes` aparecieron tres a mano en el mismo
archivo.

**Causa raíz — y no era de interfaz.** Buscar y no encontrar es el momento
exacto en que nace un expediente repetido. Este repositorio ya sabe lo que eso
cuesta: lo dice el propio aviso de duplicados de esta misma pantalla —«su
historial queda partido: las alergias en uno y las notas en el otro»— y tiene
el módulo que lo detecta, `buscarPosiblesDuplicados`, que sabe que «López
García, María» y «María López García» son la misma persona. Pero ese módulo
se consultaba **sólo dentro del formulario de alta**, es decir, después de que
el médico ya decidió crear y con medio formulario tecleado. En el único
momento anterior en que se hace la misma pregunta —la búsqueda— nadie lo
llamaba, y la respuesta era un callejón sin salida con el único primario de la
pantalla («Nuevo paciente») esperando arriba a la derecha.

La capacidad existía, el lector existía, y no se llamaban donde hacía falta:
«el dato tiene que LLEGAR», la familia de REG-160/167/170.

**Arreglo.** `src/lib/pacientes/vacio-de-la-lista.ts` decide la clase del
vacío, su peso y el gesto que corresponde a la causa; la pantalla lo consume
en los cuatro sitios. Todo vacío dice **cuántos expedientes hay fuera de lo
que se está mirando**. Sólo el registro entero vacío conserva el héroe
ilustrado y ofrece «Nuevo paciente» — ofrecer crear sobre una lista con
expedientes escondidos es la misma decisión que REG-314 tomó al no ofrecer
«Nueva cita» sobre un día con seis citas ocultas por un filtro. Y la búsqueda
sin coincidencias consulta ahora `buscarPosiblesDuplicados` con su umbral
declarado (`UMBRAL_NOMBRE`), sin criterio nuevo: lo que sobrevive hasta ahí es
exactamente lo que la búsqueda por subcadena no puede cazar —el orden de los
apellidos, el dedazo, el apellido de en medio que falta—, que es el caso que
parte expedientes.

**Guardián.** `src/__tests__/v15-la-lista-vacia-dice-cuantos-hay-fuera.test.ts`
(12 casos, 2 conductuales sobre el módulo real de duplicados). Probado al
revés con cuatro reversiones quirúrgicas, en rojo una a una: con los tres
párrafos grises de vuelta caen los casos 8 y 9; con `nuevoPaciente: true` en
una clase que no sea `sin-expedientes` cae el 6; sin el número de expedientes
en el título cae el 2; sin la llamada al módulo de duplicados cae el 10.

El caso 10 **pasó en verde con la llamada borrada** en la primera pasada,
porque el identificador seguía escrito en la línea del `import`: el
instrumento leía una declaración donde tenía que leer un uso. Es la ceguera de
`grafo-de-dependencias` otra vez, y la cazó justamente el probar al revés —
una reversión que no pone el caso en rojo es un caso que no prueba nada.

**Verificado en navegador real**, mismo instrumento sobre las dos versiones
(dos builds de producción + emuladores + siembra sintética; escritorio 1440 y
móvil 390; **0 errores de consola** en las cuatro pasadas),
`scripts/design/medir-lista-vacia-pacientes-v15.mjs`:

| | antes | después |
|---|---|---|
| vacíos que dicen cuántos hay fuera | 0 de 3 | 3 de 3 |
| controles dentro del bloque vacío | 0 | 1 en cada uno |
| «Ver todos A-Z» | no existía | devuelve las 6 filas |
| «Limpiar la búsqueda» | no existía | devuelve las 6 filas |
| expedientes rescatados con «Villareal Esparsa, Joaquin» | 0 | 1 (Joaquín Esparza Villarreal) |
| bloque con clase de estado vacío | no (`<div>` suelto) | sí, variante línea (62px escritorio / 134px móvil) |

**Qué NO cubre.** El rescate **no** cubre el nombre abreviado: «Ma Guadalupe
Hernández» contra «María Guadalupe Hernández» da 0.67 y el umbral declarado
del producto es 0.8, así que no se ofrece. Se deja así a propósito — bajar el
umbral aquí sería inventar un criterio distinto del que usa el resto del
producto para decidir si dos nombres son la misma persona. Tampoco se
fotografió el vacío de «Recientes»: la siembra tiene cinco pacientes con cita
previa y ese caso no se produce (probado sólo en la decisión). Y el resto de
estados vacíos del producto —lista de espera, farmacia, cumplimiento,
reactivación— siguen con el hero: **RTC-30 sigue abierto ahí**.

**Familia.** `el_dato_no_llega` en la causa raíz (un módulo que existe y no se
consulta donde importa) y `ausencia_no_es_dato` en el síntoma (una lista
vacía que no distingue «no hay» de «no se ven»).

---

## REG-316 — cuatro líneas de prosa fuera de un comentario mataron una regla de CSS, y el fuente se leía perfecto

**Fecha:** 15-ago-2026 · **Rama:** `v15/structural-uiux` · **Sev:** media

**Qué fallaba.** En `globals.css`, RTC-32 añadió un párrafo a un comentario que
ya estaba **cerrado**: cuatro líneas de prosa en español quedaron fuera del
bloque `/* … */`, seguidas de un segundo cierre huérfano, justo encima de un
`@media`.

Un analizador de CSS que encuentra basura en el nivel superior no la salta:
abre una regla y consume hasta la PRIMERA llave. La primera llave después de la
prosa era la del `@media (max-width: 900px)` siguiente, así que **la regla
entera quedó dentro de un selector inválido y se descartó con él**.

La regla muerta era la que aparta los botones flotantes mientras hay un campo
con el foco — la que nació de tres capturas del iPhone del dueño con el botón de
ayuda encima de **Peso** y de **Exploración física**. Desde RTC-32 no existía en
el navegador.

**Cómo se descubrió.** No leyendo el CSS: `npm run build` lo decía —«Found 1
warning while optimizing generated CSS … Invalid token in pseudo element»— en
una salida que nadie lee. Confirmado **del otro lado**, en el CSS construido:
`theme-toggle` aparecía ocho veces y `html:has(input:focus, …) .theme-toggle`
ninguna.

**Causa raíz.** El mismo mecanismo que `nx-stat-grid` con otra ropa: allí un
estilo en línea vencía a la hoja **en silencio**, aquí un comentario mal cerrado
se come la regla siguiente **en silencio**. Las dos veces el fuente parecía
correcto y la suite estaba en verde.

**La regla que lo hace seguro.** No se vigila este defecto: se vigila el
analizador. `globals.css` se pasa por el mismo motor de la construcción
(lightningcss) y sólo se toleran los avisos declarados por su nombre — hoy uno,
`@theme` de Tailwind v4, con su motivo escrito. Cualquier aviso nuevo pone el
caso en rojo con su número de línea.

**Guardián.** `src/__tests__/la-hoja-de-estilos-llega-entera.test.ts` (3 casos).
Probado al revés: devolviendo la prosa suelta a `globals.css` caen los casos 1 y
2. El caso 3 es **control positivo** —inyecta el defecto en una copia en memoria
y comprueba que el instrumento lo caza y que la regla desaparece de la salida—,
sin el cual esta prueba pasaría igual el día que el analizador dejara de avisar
de nada.

**Verificado del otro lado.** Con el arreglo, `npm run build` termina sin
avisos y `has(input:focus,textarea:focus,select:focus) .theme-toggle` aparece en
`.next/static/chunks/*.css`. Antes del arreglo, el mismo build vuelve a emitir
el aviso: la reversión se comprobó, no se supuso.

**Qué NO cubre.** Sólo `globals.css` (el CSS en línea del JSX lo vigila el
trinquete de diseño); no comprueba que el selector CASE con algo en un navegador
—eso es del arnés—, ni valida propiedades desconocidas o compatibilidad.

**Familia.** `el_dato_no_llega` — lo escrito no llega al destinatario, y del
otro lado no lo miraba nadie.

---

## REG-317 — `/reactivacion` felicitaba al médico por una lista que escondía a cuatro pacientes

**Fecha:** 15-ago-2026 · **Rama:** `v15/structural-uiux` · **Sev:** media

**Qué fallaba.** Con la lista vacía, `/reactivacion` pintaba siempre lo mismo:

    «Nadie pendiente de reactivar
     No hay pacientes con más de 365 días sin volver. ¡Buen seguimiento!»

Eso es cierto en UNA de cinco situaciones. En las otras cuatro hay gente que
lleva meses sin volver y la pantalla no la enseña: porque la píldora del umbral
está más alta, porque el paciente pidió la baja de WhatsApp, porque ejerció su
derecho ARCO, o —la que más duele— porque **no tiene un teléfono al que
escribir**. Un paciente sin datos de contacto que lleva dos años sin volver era
invisible aquí, y su ausencia se leía como buen seguimiento.

Medido en navegador con cuatro pacientes escondidos, la pantalla vieja seguía
felicitando. Es la regla 4 de seguridad clínica —ausencia de dato no es dato de
ausencia— dicha en la continuidad del paciente.

Dos pantallas más de la misma cola tenían la mitad del defecto:

- **`/farmacia`** — «Sin resultados con esos filtros» sobre una ilustración de
  página entera y **sin ningún control**: con ítems dentro se lee igual que una
  farmacia recién abierta, y para recuperarlos había que acordarse de vaciar el
  buscador Y de devolver el desplegable a «Todas las categorías».
- **`/cumplimiento` (bitácora)** — con 200 asientos traídos y el filtro de tipo
  puesto decía «Sin eventos registrados aún · Cada acceso, escritura, impresión
  y firma quedará aquí»: describía una bitácora que todavía no existe, sobre una
  que sí. Dos líneas más abajo la pantalla cita NOM-024 Art. 6.5.

**`/lista-espera` NO era defecto** y queda declarado para que nadie lo
«arregle»: no tiene buscador ni filtro, así que cero filas significa cero de
verdad y el héroe con «Agregar» es la respuesta correcta.

**Causa raíz.** RTC-30 se había descubierto TRES veces (Hoy, REG-314 en
`/citas`, REG-315 en `/pacientes`) y las tres se había vuelto a escribir entera.
No existía como pieza, así que la cuarta pantalla no podía heredarla. En
`/reactivacion` había una segunda causa más honda: el desglose no se podía
pintar porque **no se calculaba** — `pacientesParaReactivar` devolvía la lista y
tiraba por el camino el motivo de cada ausencia.

**La regla que lo hace seguro.** `src/lib/ui/vacio-de-una-lista.ts` decide una
sola vez: héroe y gesto de alta **sólo** con el conjunto entero vacío; con filas
escondidas, variante línea, título que dice cuántas hay FUERA y gestos que
sueltan la causa —nunca el de alta, que sobre lo escondido invita al duplicado—;
una causa que no se puede soltar (`gesto: null`) **se dice igual**; y sin causa
declarada no se inventa una frase amable. Y `clasificarParaReactivar` es ahora
la única fuente de verdad sobre a quién se reactiva: `pacientesParaReactivar` es
una VISTA suya, así que el desglose que se pinta y la lista que se enseña no
pueden divergir.

Los dos módulos anteriores (`vacio-de-la-agenda`, `vacio-de-la-lista`) **no se
tocan**: llevan conocimiento que aquí no cabe —los parecidos por nombre, el día
siguiente— y están medidos en navegador. Quedan como los casos especiales.

**Guardián.** `src/__tests__/v15-rtc30-el-vacio-dice-cuantos-hay-fuera.test.ts`
(13 casos). Probado al revés con seis reversiones quirúrgicas, una a una y en
rojo: devolviendo `variante: 'hero'` siempre caen el 2 y el 9; devolviendo el
gesto de alta con restricciones activas caen el 3 y el 4; filtrando las causas
sin gesto antes de la frase cae el 4; con una frase amable sin causa declarada
cae el 5; con el desglose contando sólo candidatos caen el 8, el 9 y el 10; con
los literales viejos de vuelta cae el 12; y con el módulo importado pero no
llamado cae el 11. El caso 11 se escribe contra el USO
(`describirVacioDeUnaLista({`) y no contra el identificador suelto — la lección
que dejó REG-315.

**Verificado en navegador real**, mismo instrumento sobre las dos versiones (dos
builds de producción + emuladores + siembra sintética propia; escritorio 1440 y
móvil 390; **0 errores de consola** en las cuatro pasadas),
`scripts/design/verificar-rtc30-v15.mjs` — **antes 4/24, después 24/24**:

| | antes | después |
|---|---|---|
| `/reactivacion` con 4 pacientes escondidos | «¡Buen seguimiento!» | «Hay 4 pacientes fuera de lo que estás mirando. 2 llevan menos de 1 año, 1 pidió no recibir mensajes y 1 no tiene teléfono registrado.» |
| alto del bloque vacío de `/reactivacion` | 300px (héroe ilustrado) | 96px escritorio · 158px móvil |
| alto del bloque vacío de `/farmacia` | 253px (héroe ilustrado) | 62px escritorio · 134px móvil |
| controles dentro del bloque vacío | 0 en las dos | 1 en cada una, ≥44px en móvil |
| «Limpiar la búsqueda» | no existía | devuelve los 4 ítems |
| «Ver +3 meses» | no existía | devuelve 3 pacientes |
| «Agregar» sobre lo que un filtro esconde | — | no se ofrece (comprobado) |

**Qué NO cubre.** No se fotografió el vacío de la bitácora de `/cumplimiento`:
la siembra sintética no genera 200 asientos con tipos variados, así que ahí sólo
está probada la decisión, no la pantalla. Tampoco se convierten los dos módulos
de vacío anteriores. Y RTC-30 no toca los estados vacíos que viven dentro de
modales ni los de los módulos en ALPHA (Hospital/UCI).

**Familia.** `ausencia_no_es_dato` — una lista vacía que no distingue «no hay»
de «no se ven», y que además felicitaba por la diferencia.


---

## REG-318 — el sello que se archiva contaba la prosa; el que el médico lee, no

**Fecha:** 15-ago-2026 · **Rama:** `v15/structural-uiux` · **Sev:** media-alta

**Qué fallaba.** `construirManifiesto` audita la prosa de la nota —cada sección
y el resumen ejecutivo, con su cita textual— desde hace versiones. Al FIRMAR,
`/consulta` se la pasaba, así que el sello que queda en `iaAuditoria.procedencia`
la contaba. Las dos superficies donde un humano LEE ese sello construían su
propio objeto a mano y omitían `secciones` y `resumen`.

Sobre la misma nota, medido en navegador:

    lo que se ARCHIVA  ->  15 campos, «5 del dictado · 3 de IA · 7 a mano»
    lo que se VEÍA     ->  10 campos, «2 del dictado · 2 de IA · 6 a mano»

**Y los cinco campos que faltaban no eran cinco cualesquiera.** Eran la prosa,
que es donde vivieron los tres fallos que el Dr. encontró en producción —«la de
la docencia» convertido en «vesícula»; un «no, nada de eso» a la pregunta por
diabetes redactado como «Paciente con DM2 e HTA»—. El sello legible contaba con
precisión la parte que nunca había fallado, y callaba justo las filas cuya cita
permite ver que el respaldo dice lo contrario de lo que la nota afirma.

Dos sellos que cuentan distinto sobre el mismo documento no son un detalle de
presentación: uno de los dos miente ante quien lo lea, y el que miente es el
único que un humano llega a ver. El comentario del tipo
(`iaAuditoria.procedencia`) decía además «datos estructurados», con lo que la
documentación del registro respaldaba la cuenta equivocada.

Colateral del mismo defecto: una nota que sólo trae texto redactado —la de
evolución que no cambia el plan— no enseñaba **ningún** sello en `/consulta`: la
condición miraba diagnósticos y medicamentos, dos de las seis familias que el
sello cuenta.

**Cómo se descubrió.** El estado de la iteración lo llevaba nombrado como deuda
declarada («la mitad de PROSA del manifiesto sigue sin conectar»), con la mitad
del diagnóstico equivocada: se creía que NINGUNA superficie le pasaba la prosa.
Al mirar del otro lado —«el dato tiene que LLEGAR»— resultó que el guardado sí y
sólo las pantallas no, que es peor: no era una capacidad sin estrenar, era una
divergencia viva entre el registro y su lectura.

**Causa raíz.** Tres listas independientes de «qué es una nota para el sello»:
una en el guardado de `/consulta`, otra en las props de `SelloProcedencia` —un
`interface FinalNota` local que ni siquiera DEJABA pasar la prosa: el compilador
la habría rechazado— y otra en `procedencia-de-la-nota-archivada.ts`. Sólo la
primera estaba completa.

**La regla que lo hace seguro.** Una sola definición, `notaParaElSello()` en
`lib/expediente/procedencia.ts`, y el tipo `FinalNota` exportado en vez de
recopiado. En `/consulta` el objeto se calcula UNA vez (`notaDelSello`) y lo
consumen el sello que se archiva y la tira que se ve, así que no pueden volver a
divergir. El prefijo de los campos de prosa (`PREFIJO_PROSA`) también se declara
una vez: la pantalla necesita separar las dos familias, y comparar cadenas a
mano en cada superficie era la misma trampa otra vez.

**Prueba.** `src/__tests__/v15-el-sello-que-se-ve-cuenta-lo-mismo-que-el-sellado.test.ts`
(14 casos). **Probado al revés**, cinco reversiones quirúrgicas comprobadas en
rojo una a una: `notaParaElSello` soltando la prosa (caen 5 casos), el
expediente volviendo a su lista a mano (caen 2), el panel volviendo a una lista
plana (cae 1), `/consulta` volviendo al objeto a mano en el JSX (cae 1) y la
condición volviendo a mirar sólo dos familias (cae 1).

Y una vara ajustada **al alza**, no a la baja: `procedencia-de-la-prosa.test.ts`
exigía la forma literal del objeto que `/consulta` escribía a mano. Esa forma se
retiró porque era el problema; ahora exige que la prosa entre **por la
definición compartida** y que las dos lecturas consuman el mismo objeto — sin
esa segunda mitad, el defecto volvería con una pantalla que se escribiera su
copia otra vez.

**Verificado en navegador real**, mismo instrumento sobre las dos versiones (dos
builds de producción + emuladores + siembra sintética; escritorio 1440 y móvil
390; **0 errores de consola** en las cuatro pasadas),
`scripts/design/medir-prosa-en-el-sello-v15.mjs`:

| | antes | después |
|---|---|---|
| campos en el panel (`/expediente`) | 10 | **15** |
| frase que el médico lee sin abrir | «2 del dictado · 2 de IA · 6 a mano» | «5 del dictado · 3 de IA · 7 a mano» |
| secciones y resumen enseñados | **0 de 5** | **5 de 5** |
| cita de la sección «Plan» | (ninguna) | «…hemoglobina **glucosa hilada** de control…» |
| familias separadas, con rótulo `<h3>` | no existían | «Texto redactado» · «Datos estructurados» |
| `/consulta` con nota sólo-prosa | **NO HAY SELLO** | «2 a mano», 2 campos |
| crecimiento al abrir la lente | +16px escritorio · +0px móvil | +16px escritorio · +0px móvil |
| Escape cierra · foco vuelve · scroll exacto | sí | sí |

La fila que de verdad prueba la rebanada es la de la cita del Plan: la siembra
pone al reconocedor oyendo «hemoglobina **glucosa hilada**» donde el médico
escribió «HbA1c». Que el panel enseñe esa cita —y no la corregida— comprueba del
otro lado que la prosa llegó con su respaldo real y no con uno fabricado.

**Qué NO cubre.** La compuerta de firma sigue igual: `camposSinEvidencia()`
construye su propia lista SIN prosa, así que el aviso previo a firmar («estos
datos no se pudieron comprobar contra el dictado») no mira los párrafos.
Ampliar una compuerta de firma es conducta clínica sobre un acto medicolegal y
§1 del Master Loop V15 congela la lógica de negocio: queda **declarado y sin
pagar**, para decisión del dueño. Tampoco se toca `iaAuditoria.procedencia`, que
sigue guardando sólo el resumen numérico y que **ninguna** pantalla lee: el
detalle campo por campo se recalcula de lo archivado.

**Familia.** `no_conectado` — la misma de REG-160/167/170: el dato se escribe,
las pruebas de contrato pasan, y del otro lado no hay quien lo lea. Con el
agravante de que aquí sí había lector, y contaba otra cosa.

---

## REG-319 — la barra del pulgar tapaba la compuerta de consentimiento del dictado

**Área.** Clínico-legal / accesibilidad de una acción crítica. Encontrado por
`V15-WORKFLOW-BENCHMARK-001` (WF-04) **haciendo el flujo**, no leyendo código.

**Qué fallaba.** En el teléfono (390×844), pedir «Grabar la consulta» sobre un
paciente que no había consentido nunca abría la compuerta de consentimiento —y
su pie quedaba **debajo de la barra del pulgar**. Medido con el modal abierto:

```
«Confirmo el consentimiento e iniciar»          779 → 823
.bottom-nav empieza en                          791
document.elementFromPoint(centro del botón)     <a> de la barra
```

El toque no llegaba al botón. **No se podía empezar a grabar**, y no había
salida: «Cancelar» estaba igual de tapado. La compuerta legal del instrumento
principal del producto, sin salida, en el ancho en el que más se usa.

**Cómo se descubrió, y por qué llevaba tiempo tapado.** `yaConsintio` lee
`patient.consentimientoGrabacion.fecha`, que vive en el EXPEDIENTE. La primera
corrida del banco midió los dos anchos sobre el mismo paciente: la de escritorio
dejaba el consentimiento asentado y la del teléfono entraba a grabar sin ver la
compuerta. El defecto sólo aparece con un paciente que no ha consentido nunca.

**Causa raíz.** Por debajo de 768px el modal es una hoja inferior
(`.modal-overlay { align-items: flex-end; padding: 0 }`) y se pega al borde de
abajo, donde vive la barra. `<main>` ya reservaba esa banda desde V15-MOBILE-001
—con el comentario que explica que «si solo dejáramos 70px, esos botones
quedaban debajo y no se podían tocar»—. La hoja inferior nunca la recibió: un
contenedor aprendió la lección y el otro no.

**Control permanente.** El pie de la hoja reserva **la misma constante** que
`<main>` (72px + `env(safe-area-inset-bottom)`) — la misma a propósito: dos
reservas de la misma barra divergen la primera vez que la barra cambie de alto.
Después: botón en 707 → 751, `elementFromPoint` devuelve el botón.
`src/__tests__/v15-la-hoja-inferior-no-la-tapa-la-barra.test.ts` (4 casos,
probado al revés ×3).

**Qué NO cubre, declarado.** El overlay declara `z-index: 100` y la barra `45`,
y aun así la barra ganaba el `elementFromPoint`. **Por qué exactamente sigue sin
explicar**, y se deja escrito en vez de inventar una razón: la reserva es cierta
gane quien gane el apilado. Si alguien arregla el apilado, esta regla sigue
siendo correcta y deja de ser lo único que sostiene el caso.

---

## REG-320 — el respaldo local de la nota se escribía, se conservaba y no llegaba

**Área.** Integridad de datos clínicos. Familia `no_conectado` —la de REG-160,
REG-167, REG-170 y REG-318—, con el agravante de que aquí el dato estaba en
disco, intacto, y la pantalla se negaba a ofrecerlo.

**Qué fallaba.** Abrir un encuentro por su nota (`/consulta/<paciente>?nota=
<id>`), teclear, y perder la pestaña antes del autoguardado de 30 s. Medido en
navegador (`V15-WORKFLOW-BENCHMARK-001`, WF-10):

```
claves de respaldo tras teclear   ["nx.consulta.bkp.pac-luzmaria-cervantes"]
¿el texto sobrevive a la recarga? false
¿se ofrece restaurar?             false
claves tras recargar              ["nx.consulta.bkp.pac-luzmaria-cervantes"]
```

Ventana de pérdida **silenciosa** de hasta medio minuto de nota dictada o
tecleada. Control negativo de la misma corrida: el mismo gesto **sin** `?nota=`
sí conserva lo escrito — la red de seguridad funcionaba, sólo que nunca en el
caso que la necesita.

**Causa raíz.** Una sola condición gobernaba dos decisiones distintas:
«aplicarlo solo» y «ofrecerlo», las dos probando que el formulario estuviera
VACÍO. Para aplicar solo es la prueba correcta y no se toca —no se pisa en
silencio lo que el médico ve escrito, regla 3 de seguridad clínica—. Para
ofrecer es la prueba equivocada: al reabrir una nota concreta el formulario
**nunca** está vacío, porque trae la nota. La única rama capaz de enseñar el
respaldo se apagaba justo en el caso para el que existe.

**Control permanente.** `queHacerConElRespaldoLocal` en
`@/lib/mobile/local-drafts` —que ya era dueño de la clave y del pestillo
anti-resurrección; **no se creó módulo nuevo**— parte la decisión en
`APLICAR_SOLO` / `OFRECER` / `CALLAR`, y las dos ramas de la pantalla la
comparten para que no puedan divergir. Calla si el respaldo es de otro
encuentro, si no puede demostrar de cuál es, o si la nota ya está firmada
(inmutable, NOM-024). `src/__tests__/v15-el-respaldo-local-llega-al-medico.test.ts`
(13 casos, probado al revés ×3).

**Qué NO cubre, declarado.** No compara marcas de tiempo: un respaldo más VIEJO
que lo que hay en Firestore también se ofrece, a propósito — la decisión de cuál
vale es del médico, y el aviso enseña la hora a la que se guardó. Aplicarlo
automáticamente por ser más nuevo sería volver a la corrección silenciosa que la
regla 3 prohíbe.

---

## REG-321 — la familia documental decía tres gramáticas, y ninguna nombraba al paciente

**Área.** Coherencia de producto / jerarquía de identidad clínica. Encontrado
por `V15-FINAL-COHERENCE-001` **midiendo el DOM vivo de once superficies a la
vez**, no leyendo una pantalla.

**Qué fallaba.** La matriz de coherencia
(`scripts/design/medir-coherencia-de-producto-v15.mjs`) lee el `<h1>` y la voz
tipográfica **calculada** del nombre del paciente en cada superficie, a
1440×900 y a 390×844. Escritorio:

```
expediente   h1 = «Aurelio Domínguez Peña»    paciente a 20px/600 (ancla)
consulta     h1 = «Aurelio Domínguez Peña»    paciente a 20px/700 (h1)
nota         NO HAY <h1>                      paciente a 14px/600 (franja)
receta       h1 = «Generador de Receta»       paciente a 14px/600 (franja)
orden        h1 = «Orden Médica»              paciente a 14px/600 (franja)
```

Dicho en una frase: **en las dos superficies donde el médico LEE sobre el
paciente, su nombre es la voz más fuerte de la pantalla; en las tres donde
EMITE un documento que cambia su tratamiento, cae a cromo periférico de 14px y
el sitio dominante lo ocupa el nombre de la herramienta.** El degradado ocurre
justo en las superficies consecuentes, que es al revés de lo que pediría la
seguridad. En la misma pantalla, la vista previa del papel sí encabeza con
«PACIENTE · Luz María Cervantes Ochoa»: el impreso sabía quién era el sujeto;
la pantalla de trabajo, no.

`/nota` era además la única superficie clínica medida **sin encabezado de
nivel uno**, y ninguna corrida de axe lo había visto porque la familia
documental nunca entró en su lista de pantallas
(`scripts/design/axe-encuentro-v15.mjs`, `PANTALLAS`).

**Causa raíz.** No fue un descuido repetido tres veces: **nadie era dueño de la
pregunta** «¿qué nombra el encabezado de un documento clínico?». Cada pantalla
la contestó sola, con su literal, mientras los comentarios de las tres afirman
pertenecer a una familia que «habla el mismo idioma y el mismo orden».

**Control permanente.** `src/components/TituloDeDocumentoClinico.tsx` es el
dueño que faltaba: el `<h1>` dice el nombre del paciente y el tipo de documento
baja a rótulo subordinado. La invariante que obliga a que exista un dueño —y no
tres copias— es la cláusula de seguridad: **el nombre nunca se inventa mientras
carga**; sin paciente resuelto el encabezado dice qué documento es, que es
cierto, en vez de a quién pertenece, que aún no se sabe. Es la misma regla que
ya cumplen `InstrumentStrip` y el ancla del expediente.
`src/__tests__/v15-el-documento-clinico-nombra-al-paciente.test.ts` (10 casos,
probado al revés ×3).

**Qué NO cubre, declarado.** El documento **impreso** no cambia: la reparación
vive en la barra `no-print` de la pantalla de trabajo, y PDF, impresión y Word
salen idénticos. Y **no cubre `/referencia`**: su `<h1>` («CARTA DE
REFERENCIA») está dentro del papel, como título del propio oficio, así que
cambiarlo cambiaría un documento medicolegal emitido. Es una diferencia de
contexto clínico legítima y queda declarada como deuda P3 **no pagada**, no
como olvido.

---

## REG-322 — un destino que prometía un sitio y llevaba a otro, y un título que sólo lo parecía

**Área.** Gramática de acción y semántica de encabezado. Encontrado por
`V15-FINAL-COHERENCE-001` inventariando el encabezado de las 45 pantallas del
dashboard a la vez.

**Qué fallaba.** Dos cosas pequeñas, y sólo visibles comparando superficies:

1. **La ruta de rescate de nota** (`/nota/[patientId]`, la que atrapa un URL
   mal formado) remataba con un botón que decía **«Ir a Consulta»** y navegaba
   a **`/pacientes`**.
2. **`/chat`** pintaba «Chat de la clínica» en un `<div>` a 15/700 — en el
   sitio exacto de un título y con su misma voz, pero sin serlo. Era la única
   superficie del producto que fingía su encabezado en vez de declararlo
   (propio o vía `PageHeader`), así que la pantalla no tenía encabezado de
   nivel uno para quien la recorre por índice de encabezados.

**Causa raíz.** El primero es la familia de **RTC-08**, que este producto ya
declaró defecto y reparó en el riel — «un ítem que dice Encuentro, te deja en la
lista de pacientes y encima ilumina Paciente rompe la pregunta de §15 en el
primer uso». La regla que se fijó entonces —o hay un lugar, o se dice cuál es—
nunca llegó hasta esta pantalla. Es la misma **forma** que REG-319: el producto
aprendió la lección en un contenedor y no la aplicó en el hermano.

**Control permanente.** El **destino no se toca** (no se entra a una consulta
sin elegir paciente: `/pacientes` es correcto); se corrige la **promesa**, que
era la que mentía. Y el título de `/chat` pasa a `<h1>` conservando tamaño y
peso: cambia la semántica, no la voz — si además hubiera cambiado de tamaño
sería un rediseño encubierto.
`src/__tests__/v15-cada-destino-declara-su-encabezado.test.ts` (5 casos,
probado al revés ×2).

**Qué NO cubre, declarado.** No es un barrido de accesibilidad del producto:
cubre las dos superficies que la matriz señaló, no «todas las pantallas tienen
h1». Hay rutas que legítimamente no lo llevan —`/expedientes` y la propia ruta
de rescate son redirecciones, no pantallas— y convertir eso en regla obligaría
a poner encabezados donde no hay pantalla que encabezar.

---

## REG-323 — corregir un teléfono borraba las alergias del paciente

**Área.** Identidad del paciente y escritura del expediente. Encontrado por la
auditoría H-18 leyendo el payload de `handleSave` de `/pacientes` contra la
lista de inputs que el modal monta de verdad.

**Qué fallaba.** Editar el teléfono de un paciente desde `/pacientes`
sobrescribía sus **alergias** con una cadena vacía. Silencioso, permanente, y
disparado por una acción administrativa rutinaria que puede ejecutar un rol que
ni siquiera ve el campo:

1. Un paciente sin alergias registradas; la asistente abre `/pacientes` y la
   lista queda en memoria del componente.
2. El médico, en `/consulta/{id}`, anota «Penicilina». Se guarda, e invalida
   **su** caché de módulo.
3. La asistente, **sin recargar**, abre el editor de ese paciente, corrige el
   teléfono y guarda.
4. El documento queda con `alergias: ''`. En `audit_log` sólo constaba
   `campos: ['nombre','telefono',…,'alergias','notas']` — los nombres, sin los
   valores. **El dato perdido no se podía reconstruir.**

`notas` sufría lo mismo y era peor de justificar: no tiene input en ninguna
parte del producto, así que era un campo que sólo existía para escribirse.

**Por qué era P0.** De `alergias` cuelgan a la vez el cruce alergia↔fármaco, la
compuerta que impide firmar, el sesgo del reconocedor hacia los alérgenos y el
recuadro rojo de la receta. Se apagaban los cuatro sin ninguna señal, y el campo
vacío se lee después como «no se ha preguntado», no como «alguien lo borró».

**Causa raíz — tres piezas, y sólo juntas borran.**

1. **El formulario mandaba más campos de los que enseña.** El `payload` de
   `handleSave` incluía siempre `alergias` y `notas` y se pasaba entero a
   `updatePatient` → `updateDoc`, que sobrescribe campo por campo. Pero el input
   de alergias vive tras `{mode === 'medico' && …}` y el de `notas` no existe.
   (`mode` viene de `ModeContext`: es un conmutador de UI que cualquier médico
   real puede poner en `secretaria`, y que se fuerza a `secretaria` para quien no
   lo es. No es sólo el rol.)
2. **La semilla podía estar vieja.** `openEdit(p)` toma `p` del array en memoria,
   cargado una sola vez por montaje sobre el memo de 30 s de `getPatients`.
   Nunca se relee el documento, e `invalidarCachePacientes` sólo corre en la
   pestaña que escribió — es un `Map` de módulo, no un canal entre pestañas.
3. **`sinUndefined` no filtra la cadena vacía.** Descarta `undefined` y deja
   pasar `''`, así que el valor vacío llega a Firestore y borra.

Y la defensa que existía no cubría este camino: la bitácora `paciente_modificado`
con `antes`/`despues`/`vaciado` —escrita precisamente para que un vaciado de
alergias no fuera silencioso— vive **sólo** en el input de `/consulta`.

**El caso de 2026-07 acertó el objetivo y erró el mecanismo.** Cuando se acortó
el formulario se escribió un guardián para que esconder un campo no lo borrara, y
lo que congeló fue «`notas` sigue viajando en el payload». Viajar sólo conserva
el dato mientras la semilla esté fresca; con una semilla vieja, viajar es
exactamente lo que borra. La prueba estaba en verde con el defecto vivo.

**Control permanente.** `src/lib/pacientes/campos-que-se-guardan.ts` construye el
payload fuera de la pantalla, con una sola regla: **no se escribe lo que no se
pudo leer.** `notas` no viaja nunca; `alergias` sólo cuando `mode === 'medico'`,
que es cuando el input estuvo delante. La clave ausente deja intacto el valor
guardado, en vez de pisarlo con el eco de una copia vieja. Es la regla 4 de
seguridad clínica —«ausencia de dato no es dato de ausencia»— dicha en lenguaje
de escritura, y la misma que este repositorio ya aplica en `guardarBorrador`.
No impide borrar: con el input delante, vaciar el campo es una decisión del
médico y sigue llegando.
**Y una red secundaria, para lo que la primera no puede cubrir.** La primera
impide que un campo NO editado pise nada; no dice nada de dos personas editando
a la vez los MISMOS campos visibles, donde sin comparar nada gana el último en
pulsar Guardar y el que perdió no se entera. `updatePatient` admite ahora el
`updatedAt` que vio el llamador y rechaza la escritura si el documento cambió
desde entonces —mismo `code` `conflicto-de-version` que `updateNota`, para que
las pantallas no tengan que aprender dos nombres para el mismo suceso—, y el
editor de `/pacientes` lo traduce a un aviso que no manda a mirar el wifi.
Opcional a propósito: quien no pase la marca se comporta como antes.

La bitácora `paciente_modificado` gana además `antes`/`despues`/`vaciado`
**para `alergias` y sólo para `alergias`**: sin el `antes`, un vaciado queda
registrado como «se tocó el campo alergias», indistinguible de haberlas escrito
— que es exactamente lo que hizo irreconstruible el dato aquí. Es la excepción
que ya existía en el input de `/consulta`, con ese mismo campo y ese mismo
propósito, y no se amplía a ningún otro: cada valor en la bitácora es PHI que
sale del expediente.

`src/__tests__/el-editor-de-pacientes-no-borra-lo-que-no-ensena.test.ts`
(22 casos, probado al revés ×7: alergias incondicional, `notas` de vuelta al
payload, la pantalla volviendo a construirlo a mano, la guardia de versión
retirada, la pantalla dejando de pasar su marca, la bitácora volviendo a decir
sólo los nombres de los campos, y el detalle ampliado a un campo que no lo
necesita — cada reversión pone en rojo exactamente el caso que le toca).

**Qué NO cubre, declarado.**

- **No cubre el camino de `/consulta`**, que tiene su propio input de alergias,
  su propio guardado y su propia bitácora con `antes`/`despues`/`vaciado`.
  Borrar el campo desde ahí sigue siendo posible, y debe serlo.
- **No prueba la concurrencia CORRIENDO Firestore.** La guardia de `updatedAt`
  se comprueba leyendo el fuente: esta suite corre en `node`, sin emulador ni
  jsdom. Que dispare de verdad contra la base sólo lo puede decir el emulador.
- **La guardia no cubre las escrituras de un solo campo desde `/consulta`**, que
  no pasan `vistoEn` a propósito: escriben un campo, no el formulario entero, y
  no pagan la lectura extra. Dos sesiones editando ESE campo a la vez siguen
  ganando por orden de llegada — pero ahí el vaciado sí queda en la bitácora con
  su `antes`.
- **No cubre la caché de 30 s de `getPatients`.** La semilla vieja sigue siendo
  vieja: lo que se corrige es que ya no pueda vaciar un campo clínico.
- **No cubre `email`**, que tiene la MISMA forma —sin input en esta pantalla y
  viajando como `f.email.trim()`— y por tanto el mismo riesgo con una semilla
  vieja. Queda declarado como **deuda P2 no pagada**, fuera del alcance de H-18
  a propósito: no es un campo clínico y ampliarlo aquí habría sido rediseñar el
  formulario. `curp` no corre ese riesgo porque su vacío sale como `undefined` y
  `sinUndefined` lo descarta.
- **No cubre `alergiasEstructuradas`**, que esta pantalla nunca ha tocado.

## REG-324 — el laboratorio se archivaba en el paciente que estuviera abierto

**Área.** Importación de resultados de laboratorio por visión (camino cotidiano
de Practice). Encontrado por la auditoría **H-17** (26-ago-2026) recorriendo
las fronteras de escritura clínica y preguntando por cada una «¿qué prueba que
esta evidencia es de este paciente?».

**Qué fallaba.** El flujo completo era:

```
archivo → visión → validarPanel(fecha + valores) → modal «revisa lo que leyó
la IA» → guardarPanelLab(clinicId, patientId, panel)
```

Ni una sola pieza miraba **de quién** era la hoja. El `patientId` salía de la
pantalla abierta y `guardarPanelLab` lo obedecía sin preguntar. Subir el PDF del
paciente anterior con la ficha del siguiente abierta archivaba sus resultados
bajo el paciente equivocado, con mensaje verde y sin un solo aviso — y de ahí
salen las gráficas de tendencia y el texto que el médico pega en la nota. El
modal pedía revisar los **números**; nunca el **sujeto**.

Y el mismo `addDoc` acuñaba la identidad del documento en la **escritura**: un
doble clic o una respuesta perdida en la red dejaba el estudio duplicado y la
serie temporal con dos puntos donde había una extracción.

**Causa raíz.** Una regla de privacidad aplicada un paso demasiado lejos. «No se
persisten identificadores del paciente» se había implementado en el prompt de
visión como «no se **extraen**» —«NO transcribas el nombre del paciente»— y eso
**destruyó la única evidencia** con la que se podía verificar el sujeto. Sin
nombre que comparar, la identidad del documento sólo podía nacer del contexto de
pantalla. Es la forma exacta de **REG-252** (el mismo defecto en el camino FHIR
de hospital, ya reparado con `verificaSujeto`) y de **REG-160**: se validaba una
cosa y se escribía sobre otra. La lección estaba aprendida en un módulo y nunca
llegó al hermano que se usa todos los días.

**Control permanente.** El nombre se lee, se **compara** y se **tira**:
`dictaminarSujeto` reúsa `verificaSujeto` (frontera canónica) y desempata con
`similitudNombre` (el comparador de identidad de personas que ya decide si dos
expedientes son el mismo paciente), porque un OCR de hoja impresa cambia el
orden de los apellidos y pierde acentos, y un bloqueo que salta en el caso normal
se aprende a esquivar. Sólo `coincide` guarda solo; `sin-identificar` exige
confirmación explícita del médico viendo el nombre del destino; `ambiguo` y
`no-coincide` **no persisten**. Quien lo hace cumplir es `autorizaGuardar`
dentro de `guardarPanelLab` —esconder un botón no cierra una escritura—, que
además re-comprueba el destino contra el vínculo: si el médico cambió de paciente
durante la revisión, el vínculo **caduca, no se re-apunta**. El panel queda
escrito con el paciente y el consultorio **dentro** del documento, y
`firestore.rules` exige que eso sea la ruta. La identidad del documento pasa a
`idIdempotente(clinicId, 'laboratorio', …)`: el reintento aterriza en el mismo
doc. Lo único que se persiste del sujeto es el veredicto — nunca un nombre.
`src/__tests__/laboratorio-sujeto-vinculado.test.ts` (27 casos) y
`src/__tests__/laboratorio-guardado-no-cruza-paciente.test.ts` (13 casos,
cuentan documentos), probados al revés: sin el módulo, la suite no compila
siquiera, que es el estado en que vivía el producto.

**Qué NO cubre, declarado.** No prueba que la IA lea bien el nombre —eso es del
proveedor de visión—: prueba qué hace el sistema con lo que lea, incluido no leer
nada. No cubre `firestore.rules` en ejecución (va contra el emulador): la regla
es una segunda capa, la medida es la del escritor. No cubre concurrencia real de
dos pestañas sobre el mismo id. Y **no toca los otros caminos de evidencia** —
fotografía clínica, importación de Evidence, antibiograma por foto— que tienen la
misma forma de riesgo y siguen sin frontera de sujeto: eso es hallazgo abierto,
no reparado aquí.

## REG-325 — el enlace de la teleconsulta se prometía en cada mensaje y no se mandaba en ninguno

**Qué fallaba.** El paciente que agendaba una **videoconsulta** por WhatsApp
recibía, en la confirmación: «Recibirás el enlace de la videollamada por este
medio antes de tu cita». Lo volvía a recibir en el recordatorio de 24 h. Lo
volvía a recibir el mismo día. El enlace **no llegaba nunca**, porque el único
mensaje que decía «antes de tu cita» era justamente el que repetía la promesa.
A la hora de su consulta el paciente no tenía forma de entrar a la sala.

**Cómo se descubrió.** Recorriendo el flujo canónico del Bloque 7 (WhatsApp →
cita → confirmación → recordatorio → retorno a consulta) con la pregunta de
`.claude/rules/el-dato-tiene-que-llegar.md`: «¿dónde acaba este dato?». El
enlace acababa en la función que lo compone. `grep dondeEsLaCita` devolvía
cuatro llamadas; `grep tokenPaciente` ninguna fuera del módulo.

**Causa raíz.** `lib/telesalud/donde-es.ts` sólo emite el enlace si recibe un
`tokenPaciente`, y hace bien: `/api/telesalud/sala` exige prueba de titularidad y
responde 404 «Cita no encontrada» a un enlace sin token, así que un enlace sin
credencial es peor que ninguno. Lo que fallaba está una capa arriba: el campo era
**opcional**, y los cuatro llamadores lo omitían. Compilaba.

Es exactamente el defecto contra el que avisa la cabecera de
`enlaceSalaPaciente()`, que hizo el token obligatorio en SU firma precisamente
para que «no vuelva en silencio en el siguiente sitio que llame sin él». Volvió
un nivel más arriba, donde alguien lo dejó opcional otra vez. Misma familia que
REG-167, REG-170 y REG-320: escrito, conectado, y el dato sin llegar.

**Control permanente.** `tokenPaciente` pasa a ser **obligatorio** en
`DatosDeLugar`: quien no tenga token tiene que escribir `''`, que es una decisión
y no un olvido — y el compilador se lo pide a cada llamador futuro.
`api/cron/reminders` —el único que corre ANTES de la cita— firma el token real
del paciente de esa cita, con alcance `agenda` (no `clinico`: el enlace viaja por
WhatsApp y se reenvía) y con la versión del expediente, para que una revocación
lo tumbe. Los otros tres llamadores declaran `''` con su razón escrita: el bot
agenda con semanas de antelación y su token estaría muerto el día de la consulta;
`lib/whatsapp.ts` se ejecuta en el navegador y firmar exigiría el secreto.
`src/__tests__/el-enlace-de-la-teleconsulta-llega-al-paciente.test.ts`
(14 casos; probado al revés: sin el arreglo caen 7).

**Qué NO cubre, declarado.** No cubre el camino de **plantilla HSM**, que es por
donde sale el recordatorio cuando la ventana de servicio de 24 h está cerrada
—el caso normal—. Las plantillas aprobadas llevan parámetros de texto y ninguna
URL; meterla dentro de un parámetro o mandar texto libre fuera de la ventana es
lo que Meta rechaza. Añadir una plantilla con botón de URL dinámica es un paso
externo del dueño: queda declarado en
`ENLACE_TELECONSULTA_NO_CABE_EN_PLANTILLA` (`lib/whatsapp/templates.ts`) y
sellado por dos casos, con estado **OWNER_APPROVAL_REQUIRED**. Tampoco cubre la
creación de la sala en el proveedor, la ventana horaria de apertura
(`ventana-sala.ts`), ni la revocación por versión: `/api/telesalud/sala` autoriza
hoy sin mirar `tokenVigente`, y eso es otra unidad de trabajo — registrada, no
arreglada aquí.

## REG-326 — al paciente con dolor en el pecho, el bot le contestaba el horario de atención

**Qué fallaba.** El bot de WhatsApp **no tenía ninguna detección de urgencia**.
Su primera decisión sobre lo que escribe el paciente es un detector de preguntas
frecuentes que trabaja por **subcadena**:

```
if (/horario|hora|atiende|atencion|abren|cierran|cuando/.test(t)) return 'horario'
```

«Me duele el pecho desde hace una **hora**» contiene `hora`. El paciente con
dolor torácico recibía, literalmente, el horario de atención del consultorio. Y
«no puedo respirar» no casaba con ninguna pregunta frecuente ni con ningún verbo
de agenda, así que caía al menú de bienvenida. Está reproducido contra el handler
real: la prueba enseña las dos respuestas que salían.

**Cómo se descubrió.** Auditando el Bloque 7 contra `patient-facing-ai.md` §6
(«la urgencia gana a todo lo demás»). `grep` de `urgencia|emergencia|911` sobre
`api/whatsapp/` y `lib/whatsapp/`: ni una línea.

**Causa raíz.** **Precedencia**, no detección. La primera pregunta que se hacía
el bot era «¿de qué tema habla?» en vez de «¿esto es una urgencia?». Un detector
de temas por subcadena, preguntado primero, decide antes de que nadie mire si el
paciente se está muriendo. El mismo orden invertido que ya había costado
`lib/whatsapp/intencion.ts` («quiero agendar una consulta» contestaba el precio):
aquella vez el precio de equivocarse era una cita perdida.

**Control permanente.** `src/lib/paciente/urgencia.ts` (PURO) con las cinco
categorías del §6 —dolor torácico, dificultad respiratoria, síntomas
neurológicos agudos, ingesta accidental y sobredosis— y las cinco clases de
respuesta del §2, cerradas. Se consulta en `handleMessage` **antes** de
`getSession`, así que gana a la pregunta frecuente, a la intención de agenda y a
la máquina de estados entera, incluso a mitad de un agendado. Sólo la baja
(BAJA/STOP) queda por encima, por obligación legal. El bot no triaja, no
aconseja y no atiende: contesta con la vía real (911 / urgencias / teléfono del
consultorio) en la PRIMERA línea, avisa al consultorio y cierra la sesión.

No se inventó política clínica: la lista es la del §6 y la vía de contacto es la
que el portal del paciente (`app/mi/[token]`) ya le dice a quien entra por ahí.

`src/__tests__/la-urgencia-gana-en-whatsapp.test.ts` (15 declaraciones que el
corredor expande a 23 casos; sin el arreglo caen 10, contra el handler real). Incluye cinco casos de FALSO POSITIVO —«no
puedo hablar ahora, agéndame para mañana», «no puedo ver los horarios»— que
encontraron y corrigieron dos reglas propias demasiado anchas antes de commitear:
contestar el 911 a una frase administrativa común le enseña al paciente a ignorar
el aviso el día que sea de verdad.

**Qué NO cubre, declarado.** El vocabulario es vocabulario, no criterio
(`clinical-safety.md` §5): lo que no esté **no se vigila**, no es benigno. Fuera
quedan hemorragia, trauma, dolor abdominal agudo, fiebre del lactante,
anafilaxia, ideación suicida, complicaciones del embarazo y cualquier lengua que
no sea el español. No hay detección de negación, y es deliberado: la frase más
importante de la lista —«no puedo respirar»— empieza por «no», y una regla de
negación ingenua callaría justo ésa. No cubre voz, ni el portal web, ni el camino
de plantilla HSM.

## REG-327 — al paciente que YA tenía cita el bot le decía que su horario ya no existe, y él agendaba otra

**Qué fallaba.** El bot confirma la cita y, si el mismo «SÍ» vuelve a llegar,
revalida el hueco antes de escribir. Esa revalidación veía **la cita que acababa
de crear el propio paciente**, la contaba como ocupación y le contestaba:

> «Ese horario ya no está disponible. Por favor elija otro escribiendo *agendar*
> de nuevo. 🙏»

Y el reintento que llegaba hasta la transacción recibía lo mismo con otras
palabras: «Lo sentimos, ese horario acaba de ocuparse».

El paciente **tiene** cita y el bot le dice que no. Y hace caso: se agenda a otra
hora. El consultorio se queda con **dos** citas suyas y él se presenta a una. El
duplicado no lo fabrica el reintento: lo fabrica el mensaje equivocado. Con dos
entregas simultáneas del mismo «SÍ» el resultado era peor todavía: dos respuestas
al mismo paciente que se desmienten entre sí, una diciendo que quedó registrada y
la otra que el horario se ocupó.

**Cómo se descubrió.** Recorriendo las fronteras de escritura del Bloque 7 con la
pregunta de GP9: «¿qué pasa si esto llega dos veces?». Reproducido conduciendo el
camino real del bot (agendar → aviso → nombre → tipo → día → hora → sí) contra una
tienda con la semántica transaccional de Firestore, y **contando** los documentos.

**Por qué se repite un «SÍ».** Ninguno es un error del usuario:
Meta reentrega el webhook cuando la respuesta tarda y el dedup es fail-open a
propósito; `clearSession` termina en `.catch(() => {})`; y la confirmación se
manda con un `send` que devuelve `false` sin lanzar cuando el proveedor está
caído, así que el paciente no ve nada y vuelve a escribir.

**Causa raíz.** La identidad de la cita nacía de la ESCRITURA (`apptsCol.doc()`),
no de la INTENCIÓN. `POST /api/appointments` ya lo había aprendido en GP9 —misma
solicitud activa, mismo recurso— y el bot es la OTRA vía que crea citas: la
lección nunca llegó hasta aquí.

**Control permanente.** `src/lib/whatsapp/cita-ya-agendada.ts` (PURO): la misma
regla de GP9 medida sobre los cinco campos que definen la cita del bot —quién,
cuándo, tipo, duración y médico— más `origen`/`creadoPor`. Se consulta en los DOS
sitios: antes de la revalidación (reintento secuencial) y dentro de la
transacción (dos entregas a la vez). Cuando reconoce el intento no escribe nada:
devuelve el mismo folio y le vuelve a confirmar la MISMA cita. El aviso al
consultorio no se repite —un segundo «🔔 Nueva cita» le haría creer que tiene
dos—.

La regla es estricta a propósito: reconocer un reintento de más sería tragarse en
silencio una cita que el paciente sí quería. Una cita liberada (cancelada,
reagendada, no-asistió) nunca es un reintento.

`src/__tests__/el-reintento-del-bot-no-pierde-la-cita.test.ts` (10 casos; sin el
arreglo caen 3, incluido el que cuenta dos citas). Incluye los negativos: un hueco
realmente ocupado por otro paciente sigue dando conflicto, una cita cancelada no
se resucita, y el consultorio vecino con una cita idéntica no se confunde con
este reintento.

**Qué NO cubre, declarado.** No cubre la vía de LISTA DE ESPERA, que tiene su
propia transacción y el mismo patrón sin reparar: queda como trabajo con nombre,
no dado por bueno. No cubre las reglas de Firestore (van contra el emulador) ni
el dedup por `wamid`, que tiene su propia suite — aquí se prueba justamente el
caso en que el dedup NO salvó, que es para el que existe la idempotencia.

## REG-328 — la lista de espera: entrar dos veces, y que al aceptar el hueco le dijeran que otro se le adelantó

Dos defectos de la misma familia —la identidad del recurso nacía de la ESCRITURA
y no de la INTENCIÓN— en las dos fronteras de escritura de la lista de espera.

**A · Entrar dos veces.** `createWaitlistEntry` escribía con `addDoc`:
identificador aleatorio, uno nuevo en cada llamada. Dos envíos del mismo
formulario —doble clic, reintento tras una red lenta, pestaña duplicada— eran por
construcción DOS entradas del mismo paciente.

Y duele donde no se ve: al liberarse un hueco sólo se avisa a TRES personas
(`LIMITE_NOTIFICAR`), así que el paciente repetido ocupa dos de esos tres sitios.
**El tercero de la fila no se entera del hueco** y el repetido recibe dos veces el
mismo mensaje. La lista sigue pareciendo que funciona.

**B · «Otra persona respondió primero» cuando no era verdad.** Si el «SÍ» del
paciente volvía a llegar, la transacción veía **la cita que acababa de crear él
mismo**, la contaba como ocupación y le contestaba:

> «Lo sentimos, ese horario acaba de ocuparse — otra persona de la lista
> respondió primero.»

Falso, y además culpando a un tercero que no existe: le devolvía a la lista de
espera creyendo que perdió el hueco que en realidad había ganado. Es la misma
raíz de REG-327 en la otra rama del bot, y aquí es peor, porque el mensaje nombra
a alguien.

**Cómo se descubrió.** Recorriendo el camino real del Bloque 7 —se libera un
hueco → se ofrece a varios → uno contesta «SÍ» → se le agenda → los demás se
enteran— con `ofrecerHuecoLiberado` y `handleMessage` reales contra una tienda con
la semántica transaccional de Firestore, y contando documentos.

**Control permanente.**
- A: el id de una entrada sale de la intención (teléfono + tipo + fecha deseada +
  franja) con `idIdempotente`, que mete el consultorio en la preimagen — la misma
  petición en dos consultorios da dos ids distintos. La escritura va en
  transacción y **conserva `createdAt`**: ese campo decide la antigüedad en la
  cola, y reescribirlo mandaría al paciente al final de su propia fila sin que
  nadie lo viera. La clave vive en `lib/whatsapp/lista-espera.ts` (`claveDeEspera`),
  junto a la política de la lista y no en un módulo nuevo.
- B: `citaYaAgendada` —el mismo módulo de REG-327— dentro de la transacción de la
  rama `esperando_lista`. La rama de conflicto REAL (otro paciente contestó antes)
  no se toca: ésa sí es verdad, y hay un caso que la exige.

`src/__tests__/entrar-a-lista-de-espera-una-sola-vez.test.ts` (10 casos; probado al
revés: reintroduciendo `addDoc` caen 3) y
`src/__tests__/la-lista-de-espera-no-se-duplica-ni-miente.test.ts` (16 casos; sin
el arreglo de B caen 2).

**Un falso hallazgo, y por qué se cuenta.** El primer rojo decía que responder
«NO» a una oferta dejaba la entrada en `contactado` en vez de `baja` — o sea, que
la baja prometida no ocurría. **Era del doble, no del producto**: la tienda en
memoria devolvía documentos de consulta sin `ref`, así que el `d.ref.update(...)`
lanzaba y el `try/catch` del llamador se lo tragaba. Con `ref` en el harness, el
camino real pasa. Queda escrito porque un harness incompleto no da falsos verdes:
da falsos ROJOS, y un falso rojo perseguido durante horas cuesta lo mismo que un
defecto.

**Qué NO cubre, declarado.** No cubre las reglas de Firestore (van contra el
emulador) ni la atomicidad real de la transacción del SDK de cliente, que aquí se
simula. No cubre la pantalla del formulario: se prueba la frontera de escritura.
No cubre la plantilla HSM fuera de la ventana de 24 h — sigue siendo
OWNER_APPROVAL_REQUIRED (REG-325).

## REG-329 — el portal enseñaba como «receta» medicamentos que el médico nunca prescribió

**Área.** Autoridad de prescripción y documentos de cara al paciente. Encontrado
por la auditoría H-01, contando llamadores de la frontera: `loQueSeReceta` tenía
**un solo llamador en todo el repositorio** —la pantalla del médico— mientras que
«receta» se arma en **dos** superficies.

**Qué fallaba.** La acción `documentos` de `/api/portal` construía las recetas
del paciente así:

```ts
.filter(n => Array.isArray(n.medicamentos) && n.medicamentos.length > 0)
.map(n => ({ …, medicamentos: n.medicamentos ?? [] }))
```

`n.medicamentos` es la lista de la NOTA, y en ella conviven mezcladas cinco cosas
que no son la misma:

| en la lista de la nota | qué es | ¿es una prescripción? |
|---|---|---|
| `procedenciaClinica:'ya_lo_toma'` | lo que el paciente **refirió** que toma | no |
| `estado:'borrador'` | lo que la IA extrajo y nadie confirmó | no |
| `estado:'suspendida'` / `'cancelada'` | lo que el médico **retiró** | no |
| `estado:'probablemente_terminada'` | venció el calendario, nadie lo revisó | no |
| `se_prescribe_hoy` + `activa` | lo que el médico indicó | **sí** |

La pantalla `/mi/[token]` bajaba esa lista cruda a `descargarRecetaWord` con
`tipo:'receta'`, que imprime **«RECETA MÉDICA»** y numera los renglones. O sea:
la historia farmacológica del paciente salía impresa como prescripción, en un
documento que se lleva a la farmacia, sin que ningún médico lo hubiera indicado.

Y sin poder atribuirla: el segundo argumento de `descargarRecetaWord` era `null`,
así que el documento salía **sin médico** y con `[FALTA CÉDULA PROFESIONAL]`
impreso en rojo donde va la cédula — aunque la ruta ya tenía el nombre a mano y
la nota firmada guarda además la cédula y la especialidad.

**Por qué era P0.** El lector es el paciente, y **el paciente no puede detectar
el error**: no sabe que ese fármaco se lo suspendieron, ni que ese otro lo dijo
él y no su médico. Un antibiótico retirado por reacción adversa reaparecía como
indicación vigente, con formato de receta, junto a los que sí lo eran. Es la
regla 3 de la IA de cara al paciente —«el código no debe *poder* prescribir»—
incumplida no por el prompt sino por la ruta.

**Causa raíz — la frontera existía, pero como composición dentro de un
componente.** La pantalla del médico escribía a mano, dentro de un `useEffect`:

```ts
loQueSeReceta(n.medicamentos ?? []).filter(m => estaVigente(m))
```

Las dos mitades son necesarias y ninguna sobra: `loQueSeReceta` contesta «¿el
médico quiso indicar esto hoy?» y `estaVigente` contesta «¿la orden sigue en
pie?» —sólo la segunda descarta `probablemente_terminada`—. Pero al vivir la
composición **dentro de una pantalla**, protegía exactamente a esa pantalla.
Cualquier segunda superficie nace sin la regla y nada lo señala.

Es la familia «escrito y sin conectar» vista desde el otro lado: aquí sí estaba
conectado — a un consumidor de dos. Y el que quedó fuera es precisamente aquel en
el que **no hay un médico mirando el resultado**.

**Control permanente.** `medicamentosDeLaReceta` en
`src/lib/expediente/que-va-en-la-receta.ts` es ahora la **única puerta**, y las
dos superficies la cruzan. La del paciente la cruza **en el servidor**: esconder
un renglón en la pantalla no cierra la ruta HTTP que lo devuelve, y la ruta
devolvía los nombres aunque no se pintaran. Una nota deja además de ser «una
receta» por tener medicamentos: lo es cuando queda algo que el médico indicó de
verdad, así que una consulta que sólo recogió antecedentes ya no aparece en la
lista del paciente.

Tres cosas más, del mismo acto y del mismo tamaño:

- **Prescriptor.** Nombre, cédula y especialidad salen de `nota.firma` —el
  snapshot inmutable del momento de firmar (NOM-024)— y no de la configuración
  viva del consultorio, que cambiaría retroactivamente el autor de una receta
  vieja al actualizar el perfil.
- **Alergias.** La copia del paciente era la única receta del producto sin el
  recuadro de alergias (`mostrarAlergias: false` fijo): la misma alergia que el
  impreso del médico destaca en rojo desaparecía del documento que el paciente
  lleva a la farmacia. Ahora viaja la verdad del expediente por
  `alergiasParaImpreso` —la misma primitiva del impreso del médico, que prefiere
  `alergiasEstructuradas` sobre el texto libre— **y viaja aparte si se pudo
  leer**: con el expediente ilegible la receta no afirma nada, ni «sin registro»
  ni «negadas».
- **Error ≠ ausencia.** Un fallo de red acababa en `setDocs([])`, y como la lista
  sólo se pinta cuando trae algo, el paciente veía la misma imagen exacta que «tu
  médico no te ha recetado nada». Ahora se dice, con esas palabras: *esto no
  quiere decir que no tengas*.

`src/__tests__/la-receta-del-paciente-solo-lleva-lo-que-el-medico-preescribio.test.ts`
(31 casos, probado al revés ×6: la ruta devolviendo la nota en crudo, la puerta
sin `estaVigente`, la pantalla del médico saliéndose de la puerta, el fallo de red
volviendo a pintarse como ausencia, la receta sin prescriptor, y la ruta
afirmando haber leído un expediente que no leyó — cada reversión pone en rojo
exactamente el caso que le toca).

**Qué NO cubre, declarado.**

- **No prueba el aislamiento con las REGLAS de Firestore.** Lo que se congela es
  que la ruta construya su consulta con el `{clinicId, patientId}` del token
  FIRMADO y con ningún dato del cuerpo —hay un caso que inyecta otro `patientId`
  en el cuerpo y comprueba que se ignora—. Que `firestore.rules` lo sostenga sólo
  lo puede decir el emulador.
- **No renderiza la pantalla del paciente.** La suite corre en `node`, sin jsdom:
  el cableado de `/mi/[token]` se comprueba leyendo su fuente. Que el `.doc`
  descargado se vea bien es trabajo del golden de `receta-word`.
- **No cubre el `PaqueteDeVisita`**, que tiene su propia compuerta
  `DRAFT`/`RELEASED` (REG-304) y su propia prueba. Aquí sólo se juzga
  `documentos`.
- **No cubre la orden médica** (`tipo:'orden'`), que baja estudios y no
  medicamentos, ni las demás rutas que exportan el expediente (FHIR, respaldo,
  ARCO): ésas no titulan «RECETA MÉDICA» y no afirman autoridad de prescripción.
  Queda declarado como revisión pendiente, fuera del alcance de H-01.
- **No decide qué es clínicamente correcto prescribir.** Sólo quién tuvo la
  autoridad para hacerlo.
- **No cubre `estado:'probablemente_terminada'` en la NOTA**, donde debe seguir
  viéndose y pidiendo reconciliación: lo único que se cierra es que se reimprima
  como receta vigente.

## REG-330 — lo recuperable se ofrece, y no se destruye (H-03…H-07)

**Área.** Camino del AUDIO de la consulta: dónde se guarda, quién lo enseña,
quién lo borra. Encontrado por el auditor de Consultorio recorriendo ese camino
de punta a punta y preguntando, en cada punto, «¿y si aquí hay material y nadie
lo sabe?».

**Qué fallaba.** Cinco defectos, y los cinco de la misma familia.

1. **H-03 (P0) · el cartel invisible.** «Hay audio guardado de una sesión
   anterior. ¿Recuperar y transcribir?» vivía DENTRO de `!esElPrincipio && (…)`.
   `esElPrincipio` significa «grabador quieto y sin transcripción», que tras
   recargar la pantalla es cierto **aunque haya una consulta entera esperando en
   IndexedDB**. El único camino de vuelta al audio no se pintaba justo cuando era
   el único camino.
2. **H-04 (P1) · la purga se llevaba lo que nadie había declarado.** Al cerrar
   sesión, `/consulta` declaraba audio sin transcribir sólo en
   `grabando | pausado | subiendo`. Faltaban `error` —el estado en el que el
   propio hook le promete al médico que «el audio quedó GUARDADO en este
   dispositivo»— y el huérfano de una sesión anterior, que es exactamente el
   material que H-03 tampoco enseñaba. `salirSeguro` borraba
   `nexusmed-recovery` entera. Y el sondeo de IndexedDB llevaba
   `catch(() => {})`: un fallo de lectura se concluía como «no hay nada».
3. **H-05 (P1) · el ASR tardío pisaba al médico.** Al llegar la transcripción
   con las voces separadas se hacía `setTranscripcion(…)` a secas, ANTES de
   consultar la salvaguarda. La salvaguarda existía —`edicionManualRef`— pero
   sólo decidía si se re-estructuraba la NOTA; el editor de dictado se pisaba
   igual. Y ese editor es donde el médico corrige una dosis mal oída. Además,
   la bandera sólo la levantaban las secciones narrativas: el propio editor de
   dictado no la tocaba, así que en el caso real nunca se activaba.
4. **H-06 (P1) · error de red leído como ausencia.** `getNota(…).catch(() => null)`
   daba el MISMO `null` para «no existe» y para «no pude leer». En la ruta que
   adopta el `notaId` de un respaldo, un fallo de red hacía adoptar el id de una
   nota que podía estar **firmada**: la pantalla queda escribiendo en un
   documento inmutable que el servidor rechaza en cada autoguardado, para
   siempre, mientras el médico dicta una consulta entera creyendo que se guarda.
5. **H-07 (P1) · fallo parcial fingiendo éxito.** La rama
   `modoDeHabla === 'dictado'` de `detener()` se quedaba con `.texto` y tiraba
   `lotesFallidos`. Una transcripción con tramos perdidos pasaba el
   `texto.trim()`, se daba por buena, y borraba los trozos de IndexedDB.

**Causa raíz.** Una sola, dicha de cinco maneras: **se decidió sobre el material
grabado mirando cómo se ve la pantalla, en vez de mirando si el material
existe.** El cartel colgaba del aspecto del editor; la purga, de la grabación en
curso y no del disco; el reemplazo, del efecto caro (re-procesar con IA) y no
del dato; la adopción del id, de un `null` que significaba dos cosas.

H-07 es además la forma de **REG-300**: una decisión escrita dos veces y
arreglada en una sola copia. El camino largo de `detener()` ya sabía que un
texto hecho de advertencias no es un texto y que un tramo perdido prohíbe
borrar el audio; la rama de dictado, que sale por arriba, nunca lo aprendió.

**Control permanente.** Las decisiones se escriben UNA vez, puras y probables
sin navegador, y las consumen las rutas productivas:
`src/lib/expediente/recuperacion-consulta.ts` (`debeOfrecerRecuperacion`,
`hayAudioQueNoSePuedePurgar`, `puedeReemplazarTranscripcion`, `leerNotaPrevia` +
`decidirAdopcionDeNotaPrevia` con sus cuatro estados distintos) y, en el hook,
`soloSonAdvertencias` / `sePuedeBorrarElAudio`, que ahora usan **las dos** ramas
de `detener()`. El sesgo de todas va hacia conservar: conservar de más deja en
el disco un archivo que el médico descarta de un clic; conservar de menos borra
la única copia de lo que dijo el paciente.
`src/__tests__/lo-recuperable-se-ofrece-y-no-se-destruye.test.ts` (44 casos,
probado al revés ×9 — los cinco defectos reinsertados en la función pura y
cuatro en el cableado de la pantalla, para que un helper correcto que nadie
consume no pueda pasar).

**Qué NO cubre, declarado.** No ejecuta IndexedDB, ni `MediaRecorder`, ni React
—no existen en Node—, así que lo que se prueba con entradas y salidas son las
funciones puras, y que la pantalla las consuma se comprueba sobre el texto
fuente. La comprobación en navegador sigue pendiente (`NAV-NAVEGADOR-001`). No
prueba que el audio conservado se transcriba bien: prueba que sobreviva para
poder intentarlo. No cubre el texto que entra en vivo mientras se graba —ahí el
reemplazo es el comportamiento pedido—, ni el caso en que el médico pulsa
«Dejar mi versión»: su transcripción se respeta, y el material diarizado sigue
disponible en `audio.utterances`, pero el cartel no se vuelve a ofrecer.

---

## REG-331 — la superficie del paciente no tenía quien la mirara: 23 defectos de accesibilidad con la suite entera en verde

**Área.** Accesibilidad · superficie de cara al paciente (`A11Y-GATE-001`, P1 de V9).

**Qué fallaba.** Las diez pantallas públicas que ve un paciente traían **23
defectos de accesibilidad**, y ninguna herramienta del repositorio podía verlos:

- **8 campos de formulario sin etiqueta.** Los cuatro de la reserva pública
  —nombre, teléfono, correo, motivo—, los dos del portal de derechos ARCO, el de
  la reseña y el del panel de reagenda. Todos se apoyaban en el `placeholder`,
  que **no es etiqueta**: desaparece con la primera letra que se escribe.
  En tres casos el `<label>` se pintaba y no estaba atado a nada.
- **7 botones que trabajan en silencio.** Confirmar cita, cancelar cita, pagar
  anticipo, enviar reseña, enviar solicitud ARCO, confirmar reserva, mandar el
  formulario previo: todos se deshabilitan y pintan una ruedecita mientras
  trabajan, sin `aria-busy`. Quien ve entiende «espera»; quien no ve oye «no
  disponible» y vuelve a pulsar.
- **5 pantallas con estado asíncrono y NI UNA `aria-live`.** El aviso «este
  enlace ha expirado», el «no hay horarios ese día», el «no se pudo agendar», el
  folio de la solicitud ARCO y el cartel de enlace vencido del portal aparecían
  en pantalla sin que ningún lector de pantalla dijera nada.
- **2 pantallas sin `<h1>`.** La verificación pública de documento no tenía
  ningún encabezado —el título era un `<strong>`—; la reserva pública tenía
  `<h2>` y ninguno por encima.
- **Las 5 estrellas de la reseña**, cinco botones sin una palabra dentro:
  «botón», «botón», «botón», «botón», «botón».

**Cómo se descubrió.** Construyendo el medidor **antes** de tocar una sola
pantalla y corriéndolo. Ninguno de los 23 se encontró leyendo código.

**Causa raíz.** Familia **`sin_medir`** («nadie lo estaba midiendo»: no es un
defecto del producto, es la ausencia del instrumento que lo habría delatado, y
cada uno de éstos destapa otros al encenderse). Ninguno es un descuido de
quien lo escribió: son omisiones que **ninguna compuerta podía detectar**. `tsc`
no sabe de nombres accesibles; `eslint.config.mjs` son 18 líneas sin `jsx-a11y`;
`trinquete-de-diseno.mjs` declara en su cabecera que «no vigila accesibilidad ni
contraste». Sí existían arneses de axe con Chromium (`scripts/design/axe-*.mjs`)
que miden de verdad, pero necesitan servidor levantado y emulador sembrado:
corren cuando alguien se acuerda, y ninguna de sus salidas estaba sellada.
Un guardián que sólo corre cuando alguien se acuerda **no es una red**.

**Por qué importa aquí más que en el resto de la aplicación.** Es la asimetría
que gobierna `patient-facing-ai.md`, dicha en interfaz: hasta hoy este producto
le hablaba a un internista con cédula, que detecta el error. El paciente **no
puede detectarlo** — y es un paciente de 70 años, en un teléfono, con el texto
al 200 %. Que no pueda reservar no se manifiesta como un fallo: se manifiesta
como que no reservó.

**Control permanente.**

- `scripts/design/lib/a11y-jsx.mjs` — 15 reglas sobre el **árbol real** del TSX,
  con la API del compilador de TypeScript (ya era `devDependency`, Apache-2.0).
  **Cero dependencias nuevas, cero servicios externos.**
- `scripts/design/lib/contraste-wcag.mjs` — la aritmética de WCAG 2.2, con
  composición de alfa (sin componer, un `rgba(…,0.08)` mide como si fuera opaco).
- `scripts/design/medir-a11y-superficies-paciente.mjs` — las 10 superficies
  declaradas, los 34 pares críticos de contraste en los dos temas, y el inventario
  que **falla cuando aparece una ruta pública que nadie clasificó**.
- `src/__tests__/a11y-la-superficie-del-paciente-no-pierde-terreno.test.ts` — la
  compuerta. **0 y es prohibición, no techo**: son diez archivos y caben en una
  tarde. El resto de la aplicación no se toca (poner hoy en rojo 200 pantallas es
  cómo se borra un guardián el martes — REG-245).
- `src/__tests__/a11y-el-detector-si-puede-fallar.test.ts` — el guardián **del
  guardián**. La compuerta es un `toBe(0)`, que es justo la forma de prueba que
  se queda verde para siempre el día que el detector deja de detectar. Aquí cada
  una de las 15 reglas se prueba **al revés**: se le mete el defecto y se
  comprueba que grita, y se le mete la corrección y se comprueba que se calla.
  Las dos mitades — sólo la primera dejaría pasar un detector que grita siempre.
- Falsificado además sobre código **real**, no sólo sintético: quitar el
  `aria-label` de una estrella deja la compuerta en 1; suavizar `--text3` del
  tema claro de `#6B6F75` a `#8A8F94` tira 3 pares de contraste; añadir una
  `page.tsx` pública sin clasificar pone en rojo el inventario.
- El paso de CI vive en el job del trinquete (`.github/workflows/ci.yml`), como
  segunda mirada que imprime archivo y línea.

**Qué NO cubre, declarado.** No abre un navegador: el contraste **pintado**
(texto sobre imagen o degradado), el orden real del foco y la trampa de foco de
un modal siguen siendo `scripts/design/axe-*.mjs` con Chromium — y mirar la
pantalla, que la regla de diseño exige aparte. No cruza el límite del
componente: un `<button>` dentro de `components/ui/` no lo juzga la superficie
que lo usa. No mide el contraste de los bordes (WCAG 1.4.11, 3:1): `--border`
está en 1,18:1 en oscuro **a propósito**, es un separador decorativo y no el
límite que identifica un control; cambiarlo es rediseño y esta unidad no
rediseña. La regla de la región viva cuenta **por archivo, no por estado**: una
sola `aria-live` la apaga entera — se descubrió reparando `/mi/[token]`, donde la
regla se puso en verde con el formulario previo arreglado mientras el cartel de
«tu enlace ya no vale» seguía mudo, y se encontró **mirando**, no midiendo. Y no
cubre el resto de la aplicación, que sigue sin medir.

---

## REG-332 — un error al comprobar la revocación NO es una autorización

**Área.** Portal del Paciente: `/api/portal`, `/api/payment/create-checkout` y
`/api/public/resena`. Unidad `PATIENT-PORTAL-001`, prioridad P1.

**Qué fallaba.** Cuatro cosas, y las cuatro son la misma frase dicha de cuatro
maneras: **lo que no se pudo comprobar se daba por bueno.**

1. **La revocación fallaba ABIERTA.** `/api/portal` leía
   `patients/{id}.portalTokenVersion` —el contador que el consultorio sube para
   tumbar de golpe todos los enlaces emitidos— dentro de un `try` con el `catch`
   vacío. Si Firestore no respondía, se dejaba pasar. El teléfono perdido, el
   número reciclado y el mensaje reenviado a un grupo volvían a valer justo
   durante la incidencia, que es cuando nadie mira.
2. **`/api/payment/create-checkout` no comprobaba la revocación en absoluto.**
   Acepta el MISMO magic-link y sólo miraba firma y caducidad: el enlace
   revocado dejaba de ver la agenda y seguía abriendo sesiones de cobro a nombre
   del paciente hasta que caducara por su cuenta.
3. **Una ráfaga de tokens INVÁLIDOS no la contaba nadie.** Los límites de tasa
   añadidos en P0 se cobran por `{clinicId, patientId}`, y esa clave sale del
   token: con un token que no verifica, no se pedía cupo a nadie. Era la única
   forma de pegarle a la ruta sin freno de ningún tipo.
4. **`/api/public/resena` devolvía `e.message` al navegador.** Un error del
   Admin SDK trae la RUTA del documento —y el propio token de la reseña es el id
   de `clinic_review_requests`—, así que un endpoint público y sin sesión
   contestaba con identificadores del consultorio y con el secreto que acababan
   de mandarle, a quien estuviera probando tokens.

**Cómo se descubrió.** El primero lo decía el propio `catch` en voz alta, y
`agent-state/BACKLOG.json` lo dejó abierto como decisión pendiente de política:
«Para la revocación, decidir si falla cerrado — es un cambio de política, no
sólo de código». El dueño la decidió el 27-ago-2026, con el invariante escrito:
**ERROR DE VALIDACIÓN/REVOCACIÓN ≠ AUTORIZACIÓN.** Los otros tres salieron de
recorrer el resto de la superficie del portal con esa misma pregunta.

**Causa raíz.** Dos estados donde hacen falta TRES. «Vale» y «no vale» no tienen
sitio para «no lo sé», así que el «no lo sé» se repartía al montón equivocado —
y siempre al mismo, el permisivo.

El argumento escrito para repartirlo hacia «vale» era la disponibilidad del
paciente («dejar al paciente fuera de su propia agenda por un mal minuto de
Firestore es peor que el riesgo que esto acota») y es **medible que no se
sostiene**: si Firestore no responde, todas las acciones del portal fallan igual
unas líneas más abajo, porque todas leen o escriben. El fail-open no le devolvía
la agenda a ningún paciente legítimo. Sólo se la devolvía a los enlaces
revocados, que son los únicos a los que el `catch` le cambiaba el resultado.
Coste de disponibilidad ≈ 0, beneficio para quien encontró el teléfono = todo.

**Control permanente.** La decisión se escribe UNA vez, pura y probable sin red,
en `src/lib/portal/vigencia-del-enlace.ts` (`decidirVigencia`), con tres estados:

- `vigente` → sigue el flujo.
- `revocado` → **401**, definitivo. También cuando el expediente NO EXISTE: un
  paciente dado de baja por ARCO, o un token que nombra un consultorio que no es
  el suyo. Antes eso pasaba el control y se apoyaba en que las consultas de más
  abajo devolvieran vacío — aislamiento por accidente.
- `indeterminado` → **503 con `Retry-After`**, y ahí está la mitad del arreglo:
  el enlace **no se quema**. En cuanto Firestore vuelve, el mismo token del
  mismo paciente funciona sin que nadie tenga que reemitirlo. Un fail-closed que
  además invalidara el enlace convertiría una incidencia de cinco minutos en una
  tarde de llamadas al consultorio.

Las dos rutas que aceptan el magic-link consumen ese mismo módulo, así que la
política vive en un sitio y no en dos.

En el eje del límite de tasa, el mismo invariante: `limitarEstricto` en
`src/lib/rate-limit.ts` — **mismo contador, misma colección, misma ventana**, no
otro sistema; lo único que cambia es que un freno que no pudo contar responde
503 en vez de dejar pasar. Se aplica a lo que un token filtrado puede MOVER
(mutaciones de agenda, formulario previo, documentos clínicos, cobro, intentos
de adivinar un token de reseña) y NO a mirar la propia agenda, que no gana
ningún privilegio. Y `portal:ip:{ip}` (120/10 min) se cobra **antes de verificar
el token**, que es lo que le faltaba al hallazgo 3.

Pruebas: `src/__tests__/portal-revocacion-falla-cerrado.test.ts` (21 casos,
probado al revés ×3 — el fail-open reinsertado, el expediente ausente dado por
bueno, y el guardián escrito pero NO cableado en la ruta, para que un helper
correcto que nadie consume no pueda pasar) ·
`src/__tests__/portal-limite-de-tasa.test.ts` (19 casos) ·
`src/__tests__/nucleo/rate-limit.test.ts` (16 casos).

**Qué NO cubre, declarado.** No corre Firestore ni las `firestore.rules`: el
aislamiento que se prueba aquí es el de la capa de ruta —de dónde salen
`clinicId` y `patientId`—, no el de las reglas, que vive en el job del emulador.
No mide el comportamiento del limitador bajo concurrencia real. No prueba el
flujo del navegador (`/mi/[token]`): la pantalla no se tocó, y un paciente que
reciba el 503 verá el mensaje de error genérico que ya tenía — pintarlo como
«vuelve a intentarlo» es trabajo de interfaz, aparte. No cubre `/api/portal/link`
—emitir enlaces— porque va detrás de `verificarMiembro` y ya falla cerrado por
otro camino: si no puede leer la versión emite la 0, que una revocación posterior
invalida sola. Y no cambia nada de Stripe: ni monto, ni moneda, ni política de
cobro; sólo cuándo se llega a llamarlo.

---

## REG-333 — la identidad del paciente se volvía vocabulario compartido del consultorio (H-19)

**Área.** Aprendizaje de las correcciones del dictado: `src/lib/asr/aprendizaje.ts`
y su cableado en `src/app/(dashboard)/consulta/[patientId]/page.tsx`. Encontrado
recorriendo la ruta real —dictado → corrección manual → filtro PHI → aprendizaje
→ reutilización— en vez de leer la firma de la función.

**Qué fallaba.** `esAprendible(par, excluir)` recibía las partes del nombre del
paciente para excluirlas, y el parámetro tenía **valor por omisión `[]`**. Una
lista vacía se trataba como «no hay nada que proteger», pero significa dos cosas
que el código no podía distinguir: que el paciente no tiene partes de nombre
utilizables, o que **no se sabe quién es** — no cargó, o falló la lectura. En el
segundo caso el filtro trabajaba sin contexto de identidad y dejaba pasar
apellidos enteros hacia `clinics/{clinicId}/asr_aprendizaje`, un vocabulario que
se usa con **todos** los pacientes de ese consultorio y que además sesga al
reconocedor en la consulta de otra persona.

Y no era el caso raro: era el normal. En `consulta/[patientId]/page.tsx` el
paciente y las notas se pedían en el MISMO efecto como dos promesas hermanas
(deps `[clinicId, patientId]`). La derivación del aprendizaje vivía dentro del
`.then` de `getNotas` y leía `patient?.nombre` **del closure del render en que
corrió el efecto**, donde `patient` todavía es `null`. `setPatient` no vuelve a
disparar ese efecto, así que ese closure nunca veía el nombre:
`partesDelNombre(undefined)` → `[]` **en cada carga**. Al firmar, `acumular()`
escribía lo derivado en el vocabulario del consultorio.

Tres huecos más del propio filtro, visibles incluso con la lista poblada:

1. **Sólo igualdad exacta.** Un FRAGMENTO identificable («betanc» de
   «Betancourt») no coincide y pasaba. Un fragmento de apellido en un
   vocabulario compartido sigue siendo el apellido.
2. **El apellido MAL OÍDO pasaba** — y es justo el par que el aprendizaje quiere
   capturar: el motor oye «betancurt», el médico corrige, y ninguno de los dos
   lados coincide letra a letra con el expediente.
3. **Ningún filtro de identificadores con forma propia.** CURP, folio y teléfono
   los tapaba de rebote el filtro de cifras, pero un correo sin dígitos
   («ana.perez@ejemplo.mx») entraba entero.

**Causa raíz.** No era «faltaba un filtro»: el filtro estaba, y era correcto
cuando le daban el contexto. La causa raíz es que **la ausencia de contexto de
identidad era irrepresentable**, y por omisión se leía como ausencia de
identidad. Un tipo sin estado «no sé» obliga a que alguien invente uno, y el
valor por omisión lo inventó del lado inseguro.

**Arreglo.** Mínimo, y reutilizando lo que ya existía — no hay Learning V2.

- `IdentidadDelPaciente` hace representable el «no sé»: `{conocida:false}` o
  `{conocida:true, partes}`. `identidadDe(nombre)` la construye, y un nombre
  ausente, vacío o hecho sólo de partículas cortas devuelve DESCONOCIDA. El
  parámetro deja de tener valor por omisión en `esAprendible` y
  `paresDeUnaNota`, así que el compilador obliga a cada llamador a decidir; en
  `loAprendido` —donde no puede ir después de un opcional— el valor por omisión
  es DESCONOCIDA, que falla CERRADO.
- Sin identidad conocida no se aprende nada. Es la regla 4 de seguridad clínica
  —ausencia de dato no es dato de ausencia— aplicada a la identidad.
- `identifica()` bloquea por igualdad, por contención (parte de ≥5 letras) y por
  parecido (Levenshtein acotado, tope 1 hasta 6 letras y 2 desde 7). Se reutiliza
  `distancia()` de `alineacion.ts`, que ya decidía si dos palabras se parecen:
  se exporta en vez de escribir un segundo Levenshtein.
- Los identificadores con forma propia los rechaza `redactarIdentificadores()`
  de `minimizar-phi.ts`, que ya conoce CURP, RFC, correo, teléfono y folios. Se
  rechaza en vez de redactar, igual que `seguroParaMemoria`.
- La pantalla deriva el aprendizaje en **su propio efecto**, con
  `patient?.nombre` en las dependencias a propósito, sobre los dictados firmados
  que el efecto de carga deja en estado. Si el paciente no cargó, no deriva nada.

**Prueba.** `src/__tests__/h19-identidad-nunca-se-aprende.test.ts` (13 casos:
los nueve del encargo —nombre completo, apellido, fragmento, nombre mal escrito,
término médico legítimo, otro paciente, otro tenant, nada identificable en lo que
se escribe, y lista vacía como FAIL SAFE— más identificadores con forma propia y
la reachability de la ruta real). Probado al revés ×3: reinsertado el fail-open
de la lista vacía, cae el caso 9; quitadas la contención y el parecido, caen los
casos 3 y 4; quitado `redactarIdentificadores`, cae el de identificadores.

Los tres goldens que ya existían se actualizaron: uno de ellos —
`aprendizaje-por-consultorio.test.ts`— **codificaba el defecto**, con un caso
llamado «sin nombre no se excluye nada» que comprobaba que con la lista vacía SÍ
se aprendía. La aserción se invirtió y el comentario explica por qué estaba al
revés.

**Qué NO cubre, declarado.** No detecta nombres propios por sí solo: sin la
lista del paciente que está enfrente, «González» y «gluconato» son dos cadenas y
ninguna regla determinista las separa (ver `LO_QUE_NO_DETECTA` en
`minimizar-phi`). La defensa es la lista más el fail-closed, no un detector. No
cubre el nombre de un TERCERO dictado en la nota —un familiar, otro médico—:
eso no está en la lista del paciente y el filtro no lo ve. No audita el
vocabulario ya acumulado en Firestore antes de este arreglo. Y no ejecuta React:
que la pantalla derive con la identidad ya cargada se comprueba sobre el texto
fuente, como el resto de las comprobaciones de cableado de este repositorio.

---

## REG-334 — el Preview rojo no fue el import perdido: fue publicar sin construir (Proceso)

**Área:** Proceso / integración (P1) · **Estado:** CLOSED como compuerta

**QUÉ FALLABA.** El 27-ago-2026 se integraron cuatro lotes con merges remotos
consecutivos, con cuatro minutos entre el primero y el último. Cada push disparó
un Preview de Vercel sobre un estado intermedio que nadie había construido:

| hora | commit | Preview |
|---|---|---|
| 06:38 | `1d9a55f3` integrate: Patient Experience, WhatsApp y lista de espera | **ROJO** |
| 06:39 | `ffc21823` integrate: H-01 autoridad de prescripción | verde |
| 06:41 | `fa346c4b` integrate: H-03–H-07 recuperación de consulta | verde |
| 06:43 | `47e2a01d` reconcile: REG-323–REG-330 renumerados | verde |

`1d9a55f3` no compilaba:

```
src/lib/firestore.ts(246,14): error TS2304: Cannot find name 'idIdempotente'.
src/lib/firestore.ts(246,54): error TS2304: Cannot find name 'claveDeEspera'.
src/lib/firestore.ts(249,9):  error TS2304: Cannot find name 'runTransaction'.
```

**CÓMO SE DESCUBRIÓ.** Por el semáforo de GitHub («Deployment has failed»), no
por nosotros. Y al ir a leer los logs de Vercel no había credenciales en la
máquina: `npx vercel inspect --logs` arrancó un login que no puede completarse.
La causa hubo que **reconstruirla** reproduciendo el build sobre el commit
exacto. Un diagnóstico que depende de una credencial que no tenemos es un
diagnóstico que a veces no ocurre.

**CAUSA RAÍZ.** El merge conservó la **llamada** de una rama y los **imports**
de la otra. Las líneas no se solapaban, así que `git` fusionó limpio y no dijo
nada. Un conflicto semántico no lo caza `git`: lo caza el compilador — y nadie
lo corrió antes del push siguiente.

**LO QUE DE VERDAD DUELE.** Lo que devolvió el verde a las 06:39 **no fue
arreglar los tres imports**: fue que el merge siguiente **revirtió la rama
entera**. Se fueron con ella `createWaitlistEntry` idempotente,
`src/lib/whatsapp/lista-espera.ts`, `src/lib/paciente/urgencia.ts` y cinco
archivos de prueba — entre ellos los dos que sellaban **REG-326** («entrar a la
lista de espera una sola vez»). El verde se compró **tirando el trabajo**, y el
semáforo no lo dijo porque sólo mira el último commit.

Es `.claude/rules/el-dato-tiene-que-llegar.md` aplicado a una integración: que un
commit sea **ancestro** no significa que su **contenido** siga vivo.

**LA COMPUERTA.** `node scripts/compuerta-integracion.mjs` — A rama local · B
todo lo previsto aplicado, por ancestría **y por símbolos vivos** · C sin
marcadores ni rutas sin fusionar · D derivados regenerados · E
`tsc --noEmit` + `vitest` + trinquete + `git diff --check` · F build equivalente
al Preview · G imprime el **único** push. Nunca empuja.

Hay **un solo build** y es el equivalente al Preview
(`scripts/preview-equivalente.mjs`, con el entorno fregado desde
`ops/vercel/preview-env.manifest.json`). Tener además un `npm run build` a secas
invitaría a creer que su verde vale lo mismo, y ese desnivel es el que se paga en
el Preview: medido hoy, `47e2a01d` construido sin las seis
`NEXT_PUBLIC_FIREBASE_*` muere con `auth/invalid-api-key` recolectando
`/dr/[clinicId]` — el mismo accidente que ya documentaba **REG-059**, donde el
build «funcionaba por accidente» porque en Vercel esas variables sí existen.

**NO se silencia Vercel:** no se desactivan Previews, no se escribe
`ignoreCommand`, no se apaga la integración de GitHub, no se baja ningún techo.
Un Preview que no se construye no sale rojo, y tampoco protege de nada.

**Test / control permanente:**
`src/__tests__/la-compuerta-de-integracion-no-se-ablanda.test.ts` (7 casos).
Probado al revés con **nueve** defectos inyectados uno a uno —
`ignoreBuildErrors`, `ignoreCommand`, `github.enabled:false`,
`continue-on-error` en el job `verificar`, degradar el paso F a `npm run build`,
quitar el fregado del entorno, inyectar un nombre sin declarar, meter una pareja
`NOMBRE=valor` en el manifiesto, y perder una de las seis exigidas — y en los
nueve la prueba cae.

**QUÉ NO CUBRE, DECLARADO.**

- No lee Vercel: no hay credenciales en la máquina y no debe haberlas. No
  comprueba el Preview real.
- No cubre cabeceras, rewrites del edge ni runtime. Cubre compilación, tipos y
  el desnivel de entorno — lo que rompió el 27-ago. Las cabeceras de
  **producción** se siguen comprobando después de publicar
  (`.claude/rules/deployment-and-flags.md`).
- No lee las Preview Environment Variables de Vercel. El manifiesto declara
  **nombres**; que existan allí con el valor correcto es del dueño.
- Un mecanismo nuevo de Vercel para saltarse el build no lo conoce hasta que se
  añada a la prueba.

**RESIDUAL ABIERTO, y no es de este commit.**

1. `release/consultorio-reconciled-clean-2026-08-27` (punta `43214218`) **sigue
   roja hoy** con los mismos cuatro errores (`idIdempotente`, `claveDeEspera`,
   `runTransaction`, y el `tx` implícito que arrastran). El arreglo verificado
   son **tres líneas de import** en `src/lib/firestore.ts`; con ellas
   `tsc --noEmit` pasa de 4 errores a 0. No se empuja aquí: esa rama no está
   autorizada en esta tarea.
2. **REG-326 sigue perdido** en `release/consultorio-reconciled-2026-08-27` y en
   `release/evidence-integrated-2026-08-26`. Recuperarlo es una reparación
   clínica aparte, con sus dos pruebas, no un efecto colateral de esta compuerta.

## REG-339 — la vista previa de la receta salía recortada con la configuración de fábrica

**Área.** `src/app/(dashboard)/configuracion/secciones-recetas.tsx` (`PreviewReceta`) ·
`src/components/RecetaPreviewWrapper.tsx` · `src/components/RecetaDocumento.tsx`.

**Estado:** CLOSED, con golden y sello.

**CÓMO SE DESCUBRIÓ.** MIRÁNDOLA. Tras rehacer la pantalla en tres pasos se
recorrió en un navegador de verdad, y en la captura se leía «FOLIO: RX-DE»
cortado a media palabra contra el borde derecho del marco. Ninguna prueba lo
veía; ninguna comparaba las dos medidas que aquí se contradicen.

**CAUSA RAÍZ.** `imprimirEn: 'carta'` es el modo POR DEFECTO —el que funciona en
cualquier impresora sin configurar nada— y hace que `RecetaDocumento` dibuje una
**hoja carta de 216 × 279 mm** con la receta centrada dentro. La vista previa de
configuración dimensionaba su marco con `paperEfectivo`, que devuelve la
**receta** (140 × 216 en media carta).

Marco de 140 mm, contenido de 216 mm, `overflow: hidden` en medio. La receta
salía cortada por la derecha **nada más abrir la pantalla**, sin tocar nada, con
la configuración que trae de fábrica.

**POR QUÉ EXISTÍA LA DISCREPANCIA.** Porque esta pantalla tenía su propia copia
de tres cálculos que ya existían y estaban resueltos: orientar el papel al
diseño subido (`useRecetaPaperOrientado`), escalar para que quepa en la columna
(`RecetaPreviewWrapper`) y dibujar el marco. `/receta` y `/orden` usan el
componente canónico y por eso nunca tuvieron el defecto.

Lo delata su propia documentación: la cabecera de `RecetaPreviewWrapper` decía
«Usado en /receta, /orden **y en el preview de Configuración → Recetas**». No lo
usaba. El comentario describía la intención; el código, una copia que se quedó
atrás.

**LA FAMILIA.** «Escrito, probado y sin conectar», en su forma más pura: el
componente correcto existía, funcionaba, tenía dos usuarios contentos — y la
tercera pantalla se hizo el suyo.

**EL ARREGLO.**

- La vista previa usa `RecetaPreviewWrapper`, dimensionado con
  `dimensionesImpresion` (la hoja FÍSICA, host de carta incluido), y orienta con
  `useRecetaPaperOrientado`. Deja de calcular nada por su cuenta.
- La escala de la vista previa se saca a `escalaDeVistaPrevia`, porque hay un
  segundo interesado legítimo: el recuadro que el médico ARRASTRA encima del
  documento necesita el mismo número para convertir píxeles en milímetros.
- `colocacionDeLaReceta` dice dónde cae la receta dentro de la hoja física, y la
  usan LOS DOS: `HostCarta` para dibujarla y el recuadro arrastrable para
  colocarse encima. Antes ese cálculo vivía dentro del JSX de `HostCarta` y
  quien dibujaba encima tenía que adivinarlo — y adivinaba mal en cuanto el host
  era carta.
- El nodo que se manda a imprimir en la prueba pasa a medir la hoja física, la
  misma que declara su `@page`.
- Y la vista previa ahora DICE «Sale en hoja carta, con línea de corte ✂»: sin
  eso, ver una hoja carta después de haber elegido media carta parece un error.

**LA REGLA QUE LO HACE SEGURO.** Un número que dos sitios tienen que compartir
no se copia: se pregunta. Y una pantalla que dibuja lo que otra imprime usa su
mismo componente, no uno parecido.

**GOLDEN.** `src/__tests__/recetas-tres-pasos-y-la-app-coloca-sola.test.ts`
(bloque 8, con la geometría en números). **Probado al revés:** devolviendo el
marco a las medidas de la receta (`paperWidthMm={paperOri.widthMm}`) cae el caso
que exige dimensionarlo con la hoja física.

**QUÉ NO CUBRE.** No mide la impresión real: que el sistema operativo obedezca
el `@page` es cosa suya, y por eso el paso 3 de la pantalla existe. Tampoco
toca la paginación multi-hoja de la vista previa de configuración, que sigue
enseñando una sola hoja (`/receta` sí cuenta las suyas con `contarPaginas`).

**VERIFICADO EN NAVEGADOR.** Emulador + servidor de desarrollo, a 1440 y a 390,
en tema claro y oscuro: marco 340 × 439 px, hoja 340 × 439 px, **cero píxeles de
sobra por los cuatro lados** en los tres casos.

---

## REG-338 — la pantalla que sube la firma leía del documento que la migración vació

**Área.** `src/app/(dashboard)/configuracion/secciones-cuenta.tsx`
(`FirmaUploadSection`) · `src/lib/firma-protegida.ts` · `src/hooks/useFirmaProtegida.ts`.

**Estado:** CLOSED, con golden y sello.

**CÓMO SE DESCUBRIÓ.** No buscándolo. Simplificando «Recetas, órdenes y notas»
a tres pasos a petición del dueño, el paso 2 —la firma— necesitaba una marca de
«listo», y la pregunta obligada fue de dónde sale ese booleano. La respuesta
estaba en la propia sección: leía `form`, es decir `clinics/{id}/config/main`.

**CAUSA RAÍZ.** REG-014 sacó la firma de `config/main` —cuyo `read` es
`isMember`, así que recepción o farmacia podían llevársela con el SDK— y la
movió a `config/firma`, legible sólo por médicos. La migración es idempotente,
corre al abrir esta misma sección, COPIA al subdocumento y **borra del general**.

Las cinco pantallas que imprimen (nota, receta, orden, consulta, hospital) se
cablearon al lector nuevo, `useFirmaProtegida`, que además cae al legado
mientras un consultorio no haya migrado. La sexta —la que SUBE la firma— se
quedó leyendo el sitio que la migración acababa de vaciar.

**LO QUE VEÍA EL MÉDICO.** Consultorio migrado, recarga de la pantalla: el
recuadro punteado de «Sube tu firma + sello», como si no hubiera nada. Con su
firma guardada, protegida y saliendo impresa en cada receta. La pantalla no
daba error: daba una respuesta falsa a la pregunta «¿ya subí mi firma?».

**POR QUÉ NADIE LO CAZÓ.** Porque el que tiene firma no vuelve a esta sección, y
el que vuelve es porque no la tiene —y entonces el recuadro vacío es correcto—.
Y porque la suite lo miraba desde el lado bueno: los tests de REG-014 comprueban
que la firma se guarda en el sitio protegido y que las pantallas de impresión la
leen de ahí. Ninguno preguntaba qué enseña, al día siguiente, la pantalla que la
subió.

**LA FAMILIA.** Se cuenta en «el sistema se contradice a sí mismo»: el escritor
(`config/firma`) y este lector (`config/main`) son correctos cada uno por su
cuenta, y el defecto vive en el hueco entre los dos.

Es prima de «el dato tiene que LLEGAR» (REG-160, REG-167, REG-170) con el giro
que la distingue: allí el dato no llegaba, y aquí llegó perfectamente a su
destino nuevo — lo que se quedó atrás fue el LECTOR. Una migración deja dos
lados, y el lado que sólo escribe parece terminado desde dentro.

**EL ARREGLO.** `FirmaUploadSection` lee con `useFirmaProtegida(clinicId, form)`,
el mismo lector que las cinco pantallas de impresión, y resuelve el valor
efectivo con `??` —no `||`— para que quitar la firma (que deja `''`) siga
ganándole al valor del servidor. Y reporta hacia arriba lo que ve
(`onEstado`), para que el paso 2 de la pestaña no vuelva a deducirlo por su
cuenta desde `form`: ése habría sido el mismo defecto un piso más arriba.

**LA REGLA QUE LO HACE SEGURO.** Cuando un dato cambia de sitio, se mueven
TODOS sus lectores — y el que escribe también lee, aunque parezca que sólo
escribe. Un formulario que no encuentra lo que él mismo guardó no falla: miente.

**GOLDEN.** `src/__tests__/recetas-tres-pasos-y-la-app-coloca-sola.test.ts`
(bloque 7). **Probado al revés:** devolviendo la lectura a
`form.firmaPorMedico?.[medicoSel]` a secas, caen los dos primeros casos del
bloque.

**QUÉ NO CUBRE.** No se ha visto contra un Firestore migrado de verdad: el
golden comprueba el cableado en la fuente, que es el precedente de esta casa
para este tipo de defecto. Tampoco toca el residual declarado de REG-014 —un
médico autenticado sigue recibiendo la imagen en su navegador, porque la
impresión es del lado del cliente—, ni añade lectura de la firma a ningún rol
que no la tuviera.

---

## REG-336 — se podía firmar sin nombre, y entonces el paciente no recibía nada nunca

**Área.** Compuerta de la firma: `src/lib/expediente/por-que-no-se-firma.ts`,
`src/app/(dashboard)/consulta/[patientId]/page.tsx`,
`src/app/api/expediente/paquete-de-visita/route.ts`. GP-FINAL.

**Estado:** CLOSED, con golden y sello.

**CÓMO SE DESCUBRIÓ.** Recorriendo el consultorio en un navegador de verdad
(Golden Path GP-FINAL, `scripts/golden-path/`), como médico y de punta a punta:
agenda → consulta → dictado → firma → receta → entrega al paciente. Los 10 480
casos de la suite estaban en verde y el paso 22 no se podía dar.

La nota se firmó. La receta salió. Y «Liberar al paciente» estaba APAGADO, con
este mensaje debajo:

> «Esta nota no tiene firma con cédula profesional: no hay a quién atribuir el
> papel.»

Con la cédula puesta. El documento la tenía:

```
firma: { nombreMedico: '', cedulaProfesional: '12345678', … }
```

Lo que faltaba era el NOMBRE, y el mensaje mandaba a arreglar lo único que no
estaba roto.

**CAUSA RAÍZ.** Dos compuertas que no piden lo mismo, con un snapshot inmutable
en medio:

| Compuerta | Exige |
|---|---|
| `validarNOM004` (deja firmar) | `medicoId` · `cedulaProfesional` |
| `componerPaquete` (deja entregar) | `firma.nombreMedico` · `firma.cedulaProfesional` |

Entre las dos cabe una nota **firmable e inentregable**. Y `nota.firma` es
inmutable por diseño (NOM-024): cuando el hueco se nota, ya no se puede tapar.
El médico se queda con una nota válida en el expediente y un paciente que no
recibirá su hoja nunca, sin más recurso que repetir la consulta.

**CÓMO SE LLEGA AHÍ SIN HACER NADA RARO.** Un consultorio cuya configuración
todavía no tiene `nombreMedico` firma con `identidadFirma.nombre === ''`. El
camino más corto para acabar así es el propio atajo de «Falta cédula
profesional» de la pantalla de consulta, que escribe con `saveConfigPartial`
**sólo** la cédula: resuelve el bloqueo que se ve y deja en pie el que no se ve.

**LA FAMILIA.** La de REG-189 y la del aviso de dosis: *el aviso llegaba después
de firmar, cuando la nota ya es inmutable*. Aquí ni siquiera llegaba: llegaba el
mensaje equivocado, y después.

**EL ARREGLO.** Mínimo, y en la fuente única que ya existía para esto:

- `motivosParaNoFirmar` acepta `sinQuienFirma` y añade un motivo con origen
  `atribucion`. No se toca ninguna de las condiciones que ya había.
- La consulta lo calcula desde `identidadFirma.nombre`, que es **el mismo
  objeto** que se estampa en `nota.firma`. Vigilar cualquier otro valor dejaría
  la compuerta mirando algo distinto de lo que se guarda.
- El mensaje de `nota-sin-firma` pasa a nombrar **nombre y cédula**, para que
  las notas que ya se firmaron así no manden a nadie a buscar una cédula que sí
  está.

**LA REGLA QUE LO HACE SEGURO.** Lo que un snapshot inmutable va a necesitar se
exige ANTES de estamparlo. Firmar sin a quién atribuir no se avisa: se impide, y
se dice por qué.

**GOLDEN.** `src/__tests__/nadie-firma-sin-nombre.test.ts` — 10 casos.
**Probado al revés:** sin el motivo nuevo caen 7 de los 10, entre ellos el que
comprueba que la consulta conecta la compuerta (`sinQuienFirma` en la página) y
el que exige que el mensaje no culpe sólo a la cédula.

**QUÉ NO CUBRE.** No repara las notas ya firmadas sin nombre —son inmutables por
diseño—; lo único que se hace por ellas es que el mensaje diga la verdad. Y no
prueba la pantalla: el recorrido en navegador vive en `scripts/golden-path/` y
no corre en CI, porque necesita emuladores y un build.

---

## REG-335 — la nota se firmaba, el paquete no existía, y el paciente no recibía nada

**Área.** Post-visita del consultorio: `src/lib/paciente/paquete-de-visita.ts`,
`src/app/api/expediente/paquete-de-visita/route.ts` (nueva),
`src/components/EntregarAlPaciente.tsx` (nueva), `src/app/api/portal/link/route.ts`,
`src/app/mi/[token]/page.tsx`, `src/app/(dashboard)/consulta/[patientId]/page.tsx`.
V9 · `POSTVISIT-001`. Cierra `POSTVISIT-GATE-001` y `POSTVISIT-ENTREGA-001`.

**Estado:** CLOSED, con golden y sello.

**CÓMO SE DESCUBRIÓ.** Recorriendo el camino entero —consulta → nota firmada →
receta y órdenes → paquete → liberación → portal → entrega— en vez de leer
módulos sueltos. Es el método de «el dato tiene que LLEGAR»: mirar del otro lado
antes de dar nada por entregado. Se cortaba en tres sitios, y los tres tenían la
suite en verde.

**QUÉ FALLABA.**

**1 · La hoja del paciente se componía del borrador EN CURSO.** `HojaParaElPaciente`
se montaba con el estado vivo de `medicamentos` y `estudiosOrden`, a medio
dictar, y su única guarda era `{!esNotaHospital}`. Justo encima,
`ComoCerrarLaConsulta` sí exigía `firmada`. La cabecera del módulo AFIRMABA que
el contenido salía de lo «ya revisado y firmado»: era intención de diseño, no
precondición. Nada impedía copiar y entregar una hoja compuesta de una hipótesis
a medio formular.

**2 · Esa hoja no llegaba nunca al paciente.** Dos botones —copiar al portapapeles
e imprimir— y punto. No estaba en `/mi/[token]`, ni en `/api/portal`, ni en
ninguna plantilla de mensajería. Y aunque hubiera estado: el ÚNICO emisor de un
enlace de portal con alcance `clinico` era el de la teleconsulta, así que el
médico no tenía forma de darle a su paciente la llave que abre su propio
expediente. La puerta existía y no había llave.

**3 · La colección que nadie escribía.** `PATIENT-COMPANION-001` dejó el modelo
`PaqueteDeVisita`, la máquina de estados `DRAFT`/`RELEASED`, la compuerta
`visibleParaElPaciente`, la acción `paquetes` de `/api/portal`, las reglas de
Firestore, la matriz de acceso, el manifiesto del respaldo y la exportación ARCO.
Todo correcto. Y `componerPaquete` se escribió y se BORRÓ el mismo día porque el
guardián de conexión la cazó sin llamador. Resultado: una superficie completa
sirviendo una colección que **ningún camino del producto escribía jamás**.

**CAUSA RAÍZ.** No era «faltaba una pantalla». Era que **el modelo y la compuerta
existían y el ACTO no**. Nada podía pasar de `DRAFT` a `RELEASED` porque no había
ninguna superficie con autoridad para hacerlo, y el invariante que separa firmar
de liberar —el que hace que esto no sea un `if` más— no tenía dónde vivir.
Familia «escrito, probado y sin conectar», en su forma más cara: la pieza mejor
pensada del lado del paciente, terminada y sin entregar.

**EL INVARIANTE.**

```
FIRMAR UNA NOTA ≠ LIBERARLE INFORMACIÓN AL PACIENTE
```

Firmar es autoridad medicolegal sobre el expediente. Liberar es autoridad sobre
lo que el paciente leerá como definitivo. Se hacen con dos clics seguidos y se
registran aparte, porque un día el médico querrá firmar sin liberar todavía — y
porque el lector, esta vez, **no puede detectar el error**.

**ARREGLO.** Mínimo y sobre lo que ya existía; no hay un módulo paralelo.

- **`componerPaquete` vuelve a `paquete-de-visita.ts`**, ahora con llamador. Es
  pura, corre en el SERVIDOR, y se compone de material con autoridad: la nota
  **firmada**, `medicamentosDeLaReceta` (la puerta de prescripción de H-01),
  `alergiasParaImpreso` (la primitiva del impreso del médico), `comoTomarlo`
  (determinista, se niega a expandir «cada 5 horas»). **Ningún modelo de lenguaje
  toca este camino**, y hay una prueba que lo exige.
- Se niega a componer de un borrador y a componer sin firma con cédula, y **dice
  cuál de las dos**. Ésa es la compuerta de `POSTVISIT-GATE-001`.
- **`/api/expediente/paquete-de-visita`**, bajo la capacidad `firmar`
  (= {medico, admin}) y contra la membresía real de ESE consultorio. El
  navegador manda identificadores y una fecha; el contenido lo lee la ruta.
- **Idempotente por construcción**: el id del documento ES el `notaId`, así que
  el doble clic y el reintento escriben en el mismo sitio; y dentro de la
  transacción, si lo liberado dice exactamente lo mismo, no se escribe, no sube
  la versión y no se duplica la bitácora.
- **Concurrencia**: quien libera manda la `versionEsperada` que está viendo. Una
  pestaña vieja que llega tarde recibe **409** y no pisa la versión nueva.
- **Reversible sólo con acto explícito**: `retirar` vuelve a `DRAFT`, **sube** la
  versión y deja su entrada. No borra: lo entregado sigue constando.
- **`entrega-del-paquete.ts`** es el único sitio que compone un camino hacia el
  paquete, y vuelve a exigir `visibleParaElPaciente`. El mensaje **no lleva
  secreto médico** —ni fármaco, ni diagnóstico, ni alergia—: sólo el aviso y el
  enlace, porque un enlace de paciente se reenvía por WhatsApp.
- **`/api/portal/link` ya puede emitir alcance `clinico`**, a petición explícita
  y cobrando `firmar`. E0-06 cerró que se emitiera **por omisión**, no que
  existiera; sin esto, `POSTVISIT-ENTREGA-001` no se puede cerrar.
- **`/mi/[token]`** pinta lo liberado en «Cuidado», con el prescriptor y su
  cédula del sello de firma, y **distingue el fallo de red de la ausencia**: un
  error dice que es un error, y no una lista vacía que se lee como «mi médico no
  me dejó nada».
- **Bitácora**: `paquete_liberado` y `paquete_retirado`, con identidad y hora del
  SERVIDOR, y con **conteos en vez de nombres de fármaco**.

**LO QUE SIGUE SIN COMPONERSE, DECLARADO.** `warningSigns` y
`educationalMaterial` van vacíos: los signos de alarma son indicación médica y el
material educativo es evidencia curada. No hay de dónde sacarlos sin inventarlos,
y la pantalla del médico **enseña el hueco** para que se llene, en vez de
rellenarlo con «lo habitual».

**Test / control permanente:**
`src/__tests__/el-paquete-de-la-visita-se-libera-y-llega.test.ts` (51 casos).
Probado al revés con cinco defectos inyectados uno a uno — quitar la compuerta de
firma, quitar `.filter(visibleParaElPaciente)` de `/api/portal`, generar un id de
documento aleatorio en vez de derivarlo del `notaId`, quitar la comprobación de
versión, y quitar la compuerta de `mensajeDeEntrega` — y en los cinco cae.
`src/__tests__/api-authz-guard.test.ts` re-expresa la propiedad de E0-06 (que
nunca fue «la cadena no aparece» sino «quien no puede responder por el expediente
no emite una llave que lo abre»), también probado al revés.

**QUÉ NO CUBRE, DECLARADO.**

- **No se ha visto en un navegador.** El cableado se comprueba leyendo la fuente,
  que es el precedente de esta casa; la regla de diseño exige además recorrer el
  flujo de verdad, y eso queda pendiente.
- **No corre contra Firestore real.** El doble del Admin SDK direcciona por ruta
  completa y serializa transacciones; las reglas reales las prueba la suite del
  emulador.
- **No manda un solo WhatsApp.** Se compone el mensaje y se comprueba cuándo se
  niega a componerlo.
- **No cubre `DOCUMENTS-001` ni `PATIENT-AI-001`**: `documents` y
  `unansweredQuestions` siguen vacíos y declarados.
- **`medicationChanges` compara contra la visita firmada ANTERIOR**, por nombre
  normalizado y sin mirar dosis. Un ajuste de 500 mg a 1 g no se anuncia como
  cambio; la instrucción completa va arriba. Y si la lectura falla es `null`, no
  «sin cambios».

---

## REG-501 — en consultorio, que un resultado exista contaba como que alguien lo leyó

**QUÉ FALLABA.** `guardarPanelLab` archivaba la hoja de laboratorio bajo el
paciente y ahí terminaba el camino: no nacía ningún pendiente, nadie quedaba como
dueño, no había fecha de vencimiento, y el panel no llevaba forma de saber si
alguien lo había mirado. Un valor de potasio de 7.4 entraba al expediente y el
producto no volvía a mencionarlo nunca.

**CÓMO SE DESCUBRIÓ.** Auditando WS-11 del Master Completion Loop: buscando los
llamadores de `tareaDeResultado()` aparecía uno solo, y estaba en
`src/lib/hospital/firestore.ts`.

**LA CAUSA RAÍZ, Y POR QUÉ ES INCÓMODA.** No fue un olvido. **REG-252 ya había
encontrado exactamente esta fuga** —`tareaDeResultado()` escrita, probada y sin
llamar— y la cerró. Su comentario razona bien y concluye mal: dice que se conecta
en el escritor «porque éste es el cuello de botella: los dos caminos por los que
hoy entra un resultado». Eso era cierto **del módulo de hospital**, no del
producto. El camino ambulatorio —el que es prioridad comercial— tiene su propio
escritor, `src/lib/expediente/laboratorio/firestore.ts`, y se quedó fuera.

Arreglar un bucle en un escritor y dar por hecho que era el único es la variante
de «escrito y sin conectar» que sobrevive a su propia reparación: la función
**tenía** llamador, así que ningún guardián de módulos huérfanos podía verlo.

**LA REGLA QUE LO HACE SEGURO.** Guardar un resultado **abre** su pendiente de
revisión, y se conecta en el escritor: el siguiente camino de entrada —una
importación, un webhook del laboratorio— lo hereda en vez de nacer con la fuga.

Tres decisiones que quedan declaradas:

- **Una tarea por HOJA, no por analito.** El hospital crea una por estudio porque
  una orden lleva pocos; aquí un panel trae veinte, y veinte tareas por hoja
  convertirían el worklist en el ruido contra el que avisa `POR_QUE_NO_SE_INFIERE`.
  La prioridad sube a `critica` si cualquier analito lo es, y el detalle **nombra
  cuáles** — que es lo que decide la urgencia.
- **Lo crítico no se decide aquí.** Viaja tal cual lo marcó `evaluarCriticoLab`,
  el mismo motor determinista y auditado que usa el hospital.
- **«Revisado» vive en la tarea y en ningún otro sitio.** Añadir un `revisado` al
  panel habría creado una segunda fuente de verdad del mismo hecho.

Y, siguiendo a REG-252: si el pendiente no se puede abrir, **no se calla**. El
laboratorio se guarda igual (perderlo sería peor), pero la función devuelve
`{tareasCreadas, tareasEsperadas}` y la pantalla avisa. Un pendiente que no nació
en silencio se lee como éxito.

**LA PRUEBA.** `src/__tests__/laboratorio-resultado-abre-pendiente.test.ts`
(9 casos). Probado al revés: reintroducido el defecto —no llamar a `crearTareas`—
caen 7 de los 9. Los otros dos son los que legítimamente esperan cero (hoja sin
resultados legibles, y reintento de la misma intención).

**QUÉ NO CUBRE, DECLARADO.**

- **No prueba que el médico VEA la tarea.** `tareasVivas()` usa `limit(200)`
  **sin `orderBy`**, así que por encima de 200 tareas vivas devuelve 200
  arbitrarias y ésta puede no salir. Queda abierto como P1-4 del tablero.
- **No cubre `acted_on` ni `patient_notified`**: esos estados **no existen** en el
  modelo. `progreso-resultado.ts` los declara `sin_dato` en vez de fingirlos.
  Esto cierra «recibido → por revisar», no el bucle entero.
- **No prueba `firestore.rules`** ni corre contra Firestore real.
- **No se ha visto en un navegador.**
- **La referencia y la interconsulta siguen fuera del bucle**: la primera es sólo
  un impreso; la segunda, un array embebido sin dueño ni vencimiento.

---

## REG-502 — el secreto del segundo factor se le pedía dibujado a un tercero

**QUÉ FALLABA.** La pantalla de enrolamiento de 2FA de `/cumplimiento/seguridad`
componía el QR así:

```
https://api.qrserver.com/v1/create-qr-code/?data=<otpauth://totp/...&secret=...>
```

El `otpauth://` **lleva dentro la semilla compartida** que genera los códigos.
Ponerla en la cadena de consulta de una URL hacia un servidor ajeno la entrega
entera, y la deja además en los registros de ese servidor y de cualquier
intermediario que vea la URL. Un segundo factor cuya semilla se publicó no es un
segundo factor: es una contraseña más, en manos de alguien más.

**CÓMO SE DESCUBRIÓ.** Auditoría WS-13 del Master Completion Loop. Y no era
desconocido: `csp-guard.test.ts` lo llevaba anotado en su lista de exenciones
como **«HALLAZGO abierto: manda el otpauth:// a un tercero»**.

**LA CAUSA RAÍZ.** Hay **dos** pantallas de enrolamiento de TOTP, y se arregló
una. `configuracion/secciones-seguridad.tsx` ya dibujaba el QR en local, con un
comentario que nombra exactamente esta fuga. El arreglo existía, estaba escrito,
y estaba a tres archivos de distancia de la pantalla que seguía filtrando.

No es un defecto de conocimiento: es un defecto de alcance. Nada comprobaba que
la propiedad valiera en **todas** las pantallas que manejan el secreto — sólo en
la que alguien recordó.

**LA REGLA QUE LO HACE SEGURO.** Un archivo que acuña o maneja un secreto TOTP
no le pide el dibujo a nadie: el QR se genera en el navegador con `qrcode`, que
ya era dependencia.

**LA PRUEBA.**
`src/__tests__/el-secreto-del-segundo-factor-no-sale-del-navegador.test.ts`
(3 casos). Vigila **la propiedad sobre todo el árbol servido al navegador**, no
una pantalla: una tercera pantalla de enrolamiento nacería vigilada.

Probado al revés de dos maneras. Reintroducido el defecto en la pantalla real,
caen 2 de los 3 casos y el fallo **nombra el archivo y la línea**. Y el tercer
caso comprueba que el detector **sabe no fallar**: la pantalla de reservas tiene
una variable llamada `qrUrl` que es la dirección **pública** del consultorio, y
un guardián que la confundiera con un secreto obligaría a apagarlo — un guardián
apagado no vigila nada.

**QUÉ NO CUBRE, DECLARADO.**

- **No prohíbe `api.qrserver.com` en general.** Siguen usándose dos QR de enlaces
  **públicos** (el `wa.me` de auto-agenda y la URL de reservas). Ahí no viaja
  ningún secreto: viaja una dirección hecha para repartirse. Es una dependencia
  de un tercero y no funciona sin red, pero **no es divulgación de un secreto** y
  no se cuenta como si lo fuera.
- **No prueba que el QR se vea ni que se escanee**: eso es navegador, y no se ha
  ejecutado.
- **No cubre otras formas de sacar el secreto** — copiarlo a mano, una captura de
  pantalla, un gestor de contraseñas que sincronice.
- **No arregla lo que sigue abierto de MFA**: el segundo factor **no se exige en
  el servidor en ningún sitio** (P1 del tablero), y `security-controls.ts` aún lo
  declara `planned / BLOCKED` cuando está implementado.

---

## REG-503 — la nota clínica entera se escribía en la consola del navegador

**QUÉ FALLABA.** En la pantalla de consulta, cuando la IA no lograba estructurar
una nota preoperatoria, el aviso de diagnóstico hacía:

```js
console.warn('[procesar] Secciones preop vacías. Tipo enviado:', tipoActivo, 'Respuesta:', data)
```

`data` es la **nota clínica estructurada completa**: resumen clínico,
laboratorios, cirugía propuesta. No hay ambigüedad sobre qué es — dos líneas más
arriba se lee ese mismo objeto para decidir si las secciones venían vacías.

Otros dos vertidos menores en la misma pantalla: `_detalleDebug` del proveedor
(sin acotar, puede arrastrar el eco del texto enviado) y el cuerpo del error de
evidencia (la petición lleva edad, sexo, alergias y diagnósticos).

**CÓMO SE DESCUBRIÓ.** Auditoría WS-13 del Master Completion Loop, buscando PHI
en `console.*`.

**LA CAUSA RAÍZ.** El aviso quería explicar POR QUÉ había fallado y volcó el
objeto entero por comodidad. Lo que de verdad hacía falta para diagnosticar era
la **forma** de la respuesta —qué tipo se mandó, qué secciones llegaron vacías—,
no su contenido.

**POR QUÉ UN REDACTOR NO LO ARREGLA, Y ESTO ES LO IMPORTANTE.** `safeLog` caza
CURP, RFC, correos, teléfonos, tarjetas y tokens. Aquí el PHI **es la prosa
clínica misma**: «varón de 62 años con angina inestable» no coincide con ningún
patrón, y no lo va a hacer nunca. Contra un cuerpo clínico libre la única defensa
es **no mandarlo**. Pasar esta línea por `safeLog` habría dado la sensación de
haberlo arreglado sin arreglarlo.

Y no vale que sea la consola del navegador y no un registro de servidor: la
regla de este proyecto no hace esa distinción, con razón. La consola de un
consultorio se queda en el equipo, se abre en soporte y viaja en una captura de
pantalla.

**LA REGLA QUE LO HACE SEGURO.** Un cuerpo de respuesta clínica no entra en
`console.*`. Se registra su **forma**: banderas, longitudes, códigos de estado.
Donde el detalle sirve y no es prosa clínica —la causa de una caída a parser
local— se pasa por `safeLog`.

**LA PRUEBA.** `src/__tests__/la-nota-no-se-cuenta-en-la-consola.test.ts`
(3 casos). Probado al revés reintroduciendo el vertido en la pantalla real: caen
2 de 3 y el fallo **nombra archivo y línea**. El tercero comprueba que el cedazo
**sabe no fallar**: una bandera booleana derivada del mismo objeto
(`!data.secciones?.x?.trim()`) **no** se señala, porque registrar la forma es
justo lo que se quiere permitir.

Y hay un caso que impide el arreglo perezoso: se comprueba que el aviso **sigue
diciendo lo que hacía falta**. Borrar el diagnóstico también habría puesto la
prueba en verde, y habría perdido información útil.

**QUÉ NO CUBRE, DECLARADO.**

- **Es un cedazo, no una demostración.** Reconoce el vertido por el NOMBRE de la
  variable (`data`, `json`, `body`, `respuesta`, `secciones`, `nota`,
  `paciente`). Un vertido con otro nombre se le escapa. Se dice en vez de
  aparentar cobertura.
- **Sólo recorre `src/app/(dashboard)`**, que es donde vive el cuerpo de la nota.
  No es el repositorio entero.
- **No prueba que `safeLog` redacte bien** — eso es de `errores-sin-phi`.
- **No cubre PHI que salga por otras vías**: la red, el almacenamiento local, o
  una captura de pantalla.
- **Quedan identificadores sueltos en consola** fuera del dashboard
  (`hospital/firestore.ts` registra ids de internamiento). Son ids, no cuerpos
  clínicos, y quedan anotados sin cerrar.

---

## REG-340 — los tres guardianes eran ciegos al mismo hueco

**QUÉ FALLABA.** La regla de aislamiento exige declarar toda colección nueva en
**tres** sitios: `firestore.rules`, `matriz-acceso.ts` y `respaldo.ts`. Había un
guardián por cada uno. Aun así, **nueve colecciones de consultorio** se escribían
desde el código y no estaban en ninguno de los tres.

**LA CAUSA RAÍZ, Y ES DE FORMA, NO DE OLVIDO.** Los dos guardianes que cuentan
—`respaldo-consultorio` y `matriz-acceso`— **parsean `firestore.rules`** y lo
tratan como el censo de lo que existe. Comparan reglas↔matriz y reglas↔respaldo.
**Ninguno mira el código.**

Así que una colección que nunca entró en las reglas es invisible para los tres
sitios **y para los dos guardianes a la vez**, y la suite se queda en verde. No
era un olvido repetido nueve veces: era un punto ciego con forma de círculo —tres
documentos validándose entre ellos, ninguno contra la realidad—.

**CÓMO SE DESCUBRIÓ.** Auditoría WS-11 del Master Completion Loop, enumerando
`.collection('…')` en `src/` y cruzándolo a mano contra los tres sitios.

**LO QUE HABÍA DENTRO DEL HUECO.**

- **`internamientos/{id}/registros`** — la bitácora **append-only** del episodio,
  íntegra y sin truncar, que existe **para la NOM-004**. El documento del
  internamiento guarda arrays-caché recortados (`.slice(-100)`); ésta es la copia
  buena. **No se respaldaba**: se restauraba el episodio, su bitácora legal no
  volvía, y el pie del archivo seguía diciendo `completo: true`. Es exactamente
  el fallo que ya costó las adendas, un nivel más abajo.
- **`members`** — se leía **y se escribía desde el navegador**
  (`chat/page.tsx:57` y `:66`) sin ninguna regla, así que la negaba el comodín
  final. El apodo del chat **no se guardaba nunca**, y nadie se enteraba porque
  el código cae con elegancia al nombre por omisión. Un defecto escondido detrás
  de su propio respaldo.
- **Siete más** de sólo servidor (`memoria_medico`, `uci_copilot_feedback`,
  `slot_locks`, y los cuatro de WhatsApp). Sin exposición de acceso —el Admin SDK
  se salta las reglas y el comodín niega al cliente— pero sin respaldar y sin
  clasificar.

**LA REGLA QUE LO HACE SEGURO.** El censo sale del **código**, no de las reglas.
Toda colección bajo `clinics/{clinicId}` cuyo nombre aparezca escrito en `src/`
tiene que estar en los tres sitios, o declararse excluida **con motivo**.

Las siete de sólo servidor se declaran **cerradas** (`if false`). Eso no cambia
nada en ejecución —el comodín ya las negaba— pero las vuelve **visibles** para
los guardianes, que es lo que faltaba. `slot_locks` se excluye del respaldo con
su motivo: es un candado de segundos, y restaurar uno viejo sólo bloquearía una
agenda que ya está libre.

**UN DETALLE QUE MERECE QUEDAR ESCRITO.** `firestore-rules-guard` **ya tenía**
una prueba para `registros`: decía que hoy cae en el comodín y que *si algún día
se declara*, la escritura debe seguir siendo exclusiva del servidor. Alguien vio
venir el bloque y escribió su condición. Lo que nadie escribió fue la pregunta
anterior: **¿y por qué no está declarada, si el código la escribe?**

**LA PRUEBA.** `src/__tests__/lo-que-el-codigo-escribe-esta-declarado.test.ts`
(6 casos), sobre `scripts/seguridad/colecciones-escritas.mjs`. Parte de lo que el
código **escribe** y pregunta si está declarado — el círculo cerrado por el otro
lado. Probado al revés quitando `registros` del manifiesto: caen 2 casos y el
fallo nombra el archivo y la línea que la escribe.

**QUÉ NO CUBRE, DECLARADO.**

- **Es un cedazo sobre literales.** No resuelve un nombre de colección que venga
  en una variable (`collection(db, ruta)`). Encuentra lo que está escrito a la
  vista, que es como entraron estas nueve.
- **No comprueba que la regla sea CORRECTA, sólo que exista.** Que `registros`
  esté declarada `if false` es una decisión, no una verificación.
- **No prueba las reglas contra el emulador**, ni despliega nada: las reglas se
  publican aparte y eso requiere autorización del dueño. **Hasta que se
  desplieguen, `members` sigue roto en producción.**
- **No mira las colecciones de nivel raíz.** Quedan **21** con declaración
  incompleta —`platform_recargas`, `platform_config`, `rate_limits`, `errores`,
  `soporte`, `transcript_owners`, `whatsapp_channels`, `whatsapp_dedup`,
  `anticipos_procesados`, `recargas_procesadas`, `platform_csp`,
  `platform_heartbeats`, `platform_incidentes`, y las que sí tienen reglas y
  matriz pero **no respaldo**: `clinic_members`, `clinic_invitations`,
  `clinic_review_requests`, `platform_*`—. No hay exposición de acceso, pero
  **`clinic_members` sin respaldo significa que restaurar un consultorio deja a
  todo el mundo sin poder entrar**. Queda abierto como P1 en el tablero, no
  cerrado en silencio.

---

## REG-341 — acotar una lectura abre un hueco; callarlo lo vuelve una mentira

**QUÉ FALLABA, EN DOS TIEMPOS.**

*Primero*, la escala. `getPatients()` hacía `getDocs` sobre la colección
**entera** de pacientes. La caché de 30 s bajaba la FRECUENCIA, no el TAMAÑO: en
frío, cada pantalla de lista costaba el consultorio completo. Y
`findNotaByIdInClinic()` era peor: bajaba **todos** los pacientes y luego pedía
la nota **uno por uno, en serie**. Con 50 000 pacientes, una URL malformada
costaba 50 001 lecturas encadenadas — la pantalla de rescate era peor que el
enlace roto que venía a arreglar. Y `/cumplimiento/retencion` disparaba un
`Promise.all` sobre **todos** los pacientes con un `getNotas` cada uno; su propio
comentario lo admitía a medias: «puede ser lento si hay muchos». No era lento:
era insostenible.

*Segundo*, y es el que hace falta contar. **Acotar la lectura abre un defecto
nuevo.** Catorce pantallas piden «la lista» y a partir de ahora reciben, sin
enterarse, un RECORTE. En un consultorio de 600 pacientes eso significa que el
buscador dice «sin coincidencias» de alguien que existe, que la lista de
retención NOM-004 dice «ninguno por revisar», y que un `.find()` sobre el recorte
devuelve «no está». Los tres fallan **hacia el silencio**, que es la peor
dirección: un error ruidoso se arregla, uno callado se cree.

**DE DÓNDE VIENE EL ARREGLO, Y POR QUÉ NO FUE UN MERGE.** La lectura acotada ya
estaba escrita en el **PR #356** (`product/scale-hotpaths-342`) y nunca llegó a
esta rama: keyset con `startAfter(nombre, id)` y `documentId()` de desempate,
búsqueda por prefijos con ventana, techo de compatibilidad y bandera `truncada`.
Se **porta**, no se reescribe — hacer una segunda implementación teniendo una
canónica es justo lo que prohíbe la política del repositorio.

Pero no se pudo fusionar a ciegas: **#356 es anterior a REG-323**, y su
`updatePatient` no tiene `vistoEn`. Un merge directo habría devuelto la guardia
de concurrencia al estado en que el último en pulsar Guardar pisaba al otro sin
enterarse. Se trajo la lectura acotada y se conservaron intactas la escritura
idempotente, la bitácora del alta y `vistoEn`.

**LA REGLA QUE LO HACE SEGURO.** Las lecturas dependen del límite de página o de
la ventana de búsqueda, **nunca del tamaño del consultorio**. Y quien lee de
forma acotada o bien **busca en el servidor**, o bien **declara el recorte en
pantalla**: filtrar en memoria sobre un recorte y callarlo no es una opción.

- **Paleta ⌘K** — estaba montada en el layout, así que se bajaba el directorio
  entero desde *cualquier* pantalla para pintar seis filas. Ahora: una página
  corta en frío, búsqueda indexada al teclear, y aviso cuando la ventana se
  llena. El resultado va **atado al texto que lo produjo**, para no enseñar un
  instante los resultados de la búsqueda anterior como si fueran de ésta.
- **Consultor** — necesitaba UN paciente y se bajaba el directorio para hacer
  `.find()`. Ahora `getPatient`.
- **Retención** — páginas con techo y notas en TANDAS; el paralelismo sigue
  (en serie serían minutos) pero acotado. Y si llega al techo **lo dice**.

**LAS PRUEBAS.** `src/__tests__/scale-342-lecturas-acotadas.test.ts` (37 casos,
portado con su PR) y `src/__tests__/una-lista-recortada-lo-dice.test.ts`
(8 casos, nuevo, sobre los llamadores). El primero probado al revés quitando `limitarA(limite + 1)`: caen 5
casos, incluido el que se llama «las lecturas no dependen del tamaño del
consultorio». El segundo lleva su propio caso al revés con la fuente anterior.

**QUÉ NO CUBRE, DECLARADO.**

- **Quedan once pantallas** llamando a `getPatients` y recibiendo el recorte
  **sin declararlo** — `/pacientes`, `/citas`, `/crm`, `/asistente`,
  `/hospitalizacion`, `/farmacia`, `/membresias`, `/cumplimiento`,
  `/reactivacion`, `/migracion`. Ya no tumban el navegador, pero pueden decir
  «no hay» de un paciente que existe. Abiertas como P1 en el tablero, **no dadas
  por buenas**.
- **`/pacientes` sigue filtrando y ordenando en memoria** sobre el recorte. Es la
  pantalla que más lo nota y necesita paginación real en la interfaz, no sólo en
  la librería.
- **La retención debería leerse de un trabajo de servidor**, no recalcularse en
  el navegador. El cron paginado ya existe (`/api/cron/retencion`); esta pantalla
  todavía no lo consume.
- **`getNotas` sigue sin cota**: la historia completa de un paciente, con las dos
  transcripciones dentro. Es la siguiente amplificación y sigue abierta.
- **Un documento de paciente SIN campo `nombre` no aparece en el listado.**
  Firestore omite de una consulta ordenada los documentos sin el campo del
  `orderBy`. Es un límite CONOCIDO y probado, heredado de #356 con su golden, no
  un supuesto: se encuentra por otro campo vía `buscarPacientes`.
- **Nada se ha visto en un navegador**, ni medido contra Firestore real. Esto
  acota las lecturas; **no demuestra capacidad**. La medición sigue pendiente.

---

## REG-342 — el rebote de scroll en iPhone

**QUÉ FALLABA.** Reportado por el dueño: en el teléfono se baja con el dedo, la
pantalla baja, y **rebota hacia arriba**.

**LA CAUSA RAÍZ.** `ClinicalSpine` tiene un `IntersectionObserver` que marca qué
tramo del expediente se está leyendo — y ese observador se dispara **porque el
médico está bajando**. El efecto que colgaba de él llamaba a:

```js
el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
```

`scrollIntoView` no mueve un contenedor: mueve **todos los ancestros
scrollables** hasta que el elemento se vea. El riel se pinta arriba del
expediente y no tiene ninguna regla que lo fije, así que en cuanto el médico baja
lo suficiente el riel queda fuera de pantalla **por arriba** — y para enseñarlo
hay que subir `<main>`, que es quien scrollea en el shell.

Dedo abajo → observador marca tramo nuevo → el riel pide que se le vea → la
página sube. Con `behavior: 'smooth'` encima, además **cancela la inercia** del
gesto: por eso se siente como un tirón y no como un salto.

**El autor vio el riesgo.** El comentario decía «`nearest`, para no arrastrar la
página». Pero `nearest` **minimiza** la corrección, no impide que la haya.

Y había un segundo mecanismo, independiente: `CierreAlPulgar` devolvía `null`
cuando la zona de cierre entraba en pantalla, sacando del flujo una barra
`sticky` de 52px + 16 de margen. `main.scrollHeight` encogía ~68px **justo
cuando el médico está abajo del todo**, o sea con `scrollTop` en su máximo o
cerca; WebKit lo recorta y eso se ve como un salto. Podía incluso oscilar.

**POR QUÉ ES SÓLO DE IPHONE.** Dos cosas de WebKit. `overflow-anchor` —que Chrome
y Firefox implementan, y que compensa solo los cambios de altura— **no existe en
WebKit**, y tampoco aparece en este repositorio. Y en iOS un `scrollIntoView`
suave **cancela** la inercia del dedo en vez de sumarse. El mismo código no salta
en Android y salta en iPhone.

**POR QUÉ NINGUNA PRUEBA LO VIO.** Había **diez** pruebas de scroll. Las diez son
`readFileSync` + `toContain`. Una compara **posiciones de caracteres dentro de un
archivo**; otra da por aprobado el mecanismo con sólo comprobar que la cadena
`'IntersectionObserver'` aparece — es decir, **certifica la presencia de la causa
del defecto**. Ninguna renderiza, ninguna despacha un toque, ninguna lee una
posición de scroll. Y `e2e/` sólo tiene el humo público **sin login**: el
proyecto `iphone-safari` existe en la configuración y nunca carga el dashboard.

El repositorio ya se había tropezado con esto: `v15-rtc12` documenta un arnés que
hacía `window.scrollTo(0, 1500)` —que no movía nada, porque quien scrollea es
`<main>`— y **aun así reportaba éxito**. Sus palabras: «Una condición que pasa
porque el gesto no ocurrió es peor que una que falla».

**LA REGLA QUE LO HACE SEGURO.** Un movimiento que **no pidió el usuario** sólo
puede tocar el contenedor que lo necesita, en el eje que lo necesita. La decisión
vive ahora en `destinoDelRiel`, una función **pura** que sólo sabe devolver un
`scrollLeft`: no existe entrada que produzca un movimiento vertical, porque no
hay ninguno que devolver. Y la barra del pulgar se **oculta conservando su caja**
(`visibility: hidden`, fuera del árbol de accesibilidad y del orden de
tabulación) en vez de salir del flujo.

El `scrollIntoView` que queda es el de `irA`, que responde a un **clic**: ahí el
desplazamiento es exactamente lo que el médico pidió.

**LA PRUEBA.** Hoy es `src/__tests__/reg337-la-pantalla-no-bota-al-bajar.test.ts`
(14 casos). Nació como un golden propio de 10 —«el riel no arrastra la página»,
retirado al absorber esta rama, ver abajo—, y ya entonces rompía con el patrón de
las diez pruebas anteriores: siete de sus casos eran **aritmética
sobre la función pura**, incluido un barrido determinista que afirma el
invariante —ninguna geometría produce nada que no sea un `scrollLeft` ≥ 0— y uno
que comprueba la propiedad que el médico nota: después de mover, el activo se ve.
Probado al revés reintroduciendo los dos mecanismos: caían 3 casos.

**QUÉ PASÓ CON ELLA AL ABSORBER ESTA RAMA (30-ago-2026).** Este defecto se
encontró y se arregló **dos veces en paralelo**, sin que una rama viera a la
otra: aquí como REG-342, con la aritmética local en el componente, y en `main`
como **REG-337**, con la aritmética en el módulo canónico
`src/lib/ui/traer-a-la-vista.ts`. Misma causa, mismo archivo, y los dos
reescribieron el mismo caso 5 del mismo test de V15.

Al fusionar se conserva **una sola implementación** —la canónica, que además
acota contra el tope real de desplazamiento— y este golden se retira, porque dos
guardianes del mismo invariante son la duplicación que `AGENTS.md` prohíbe. **No
se pierde cobertura**: los dos casos que este golden tenía y el de REG-337 no
—el barrido del invariante y «el activo queda dentro de la ventana»— se portaron
enteros a `src/__tests__/reg337-la-pantalla-no-bota-al-bajar.test.ts`, que pasa
de 12 a 14 casos. El resto ya estaba cubierto allí con más alcance.

La lección no es de scroll: **dos escritores sobre el mismo tablero pagan el
mismo trabajo dos veces**. Es lo que motivó `docs/maintenance/CARRILES-Y-BUCLES.md`
el mismo día.

**QUÉ NO CUBRE, Y ESTO ES LO IMPORTANTE.**

- **NO se ha reproducido en un iPhone.** El §38 del programa exige WebKit a 390px
  con diez repeticiones comprobando que `scrollTop` no baje solo. En este entorno
  **sólo está instalado Chromium** y no se permite descargar navegadores, así que
  esa comprobación es **`BLOCKED_EXTERNAL`**. Esto prueba la aritmética y el
  cableado; **no prueba el dispositivo**. La causa raíz está identificada con
  evidencia de código, no confirmada con un dedo sobre un cristal.
- **Quedan otros escritores de scroll**, y siguen abiertos: el restaurador de
  `/consulta` se re-arma cuando resuelve una lectura de Firestore —después de que
  el usuario ya empezó a bajar— y **no tiene ninguna cancelación por gesto**; los
  banners asíncronos por encima de `<main>` cambian la altura tras el primer
  pintado (el propio repositorio midió **41px** de desplazamiento por ese
  mecanismo en `PorQueEstaAqui`); y **`overscroll-behavior` no aparece ni una vez
  en el repositorio**, así que ningún contenedor anidado contiene su cadena.
- **No se han reescrito las diez pruebas de string.** Siguen ahí, y siguen sin
  poder fallar por la razón correcta.

---

## REG-343 — el respaldo devolvía el expediente entero y a nadie que pudiera entrar

**QUÉ FALLABA.** Tres colecciones pertenecen a un consultorio y **no cuelgan de
él**: llevan el consultorio en un CAMPO (`clinicId`), no en la ruta. El
manifiesto sólo sabía recorrer el árbol bajo `clinics/{clinicId}`, así que
ninguna de las tres entraba nunca en el respaldo.

La que duele es **`clinic_members`**: es lo que ata una cuenta a un consultorio.
Un respaldo restaurado sin ella devuelve pacientes, notas, recetas y agenda…
**y nadie que pueda entrar a verlos**. El archivo se veía completo, y se veía
completo por una razón concreta: lo que faltaba **no estaba en la lista de lo que
se busca**.

Las otras dos, `clinic_invitations` y `clinic_review_requests`. La segunda además
lleva nombre de paciente y de médico.

**CÓMO SE DESCUBRIÓ.** Salió del propio guardián de REG-340. Al derivar el censo
del código quedaron 21 colecciones de nivel raíz sin clasificar, y al mirarlas
una por una apareció ésta. Un guardián que se escribe bien no cierra un defecto:
enseña el siguiente.

**LA CAUSA RAÍZ.** El manifiesto confundía **«del consultorio»** con **«bajo la
ruta del consultorio»**. Son casi lo mismo y no lo son: la pertenencia también se
puede expresar con un campo, y el recorrido de un árbol no ve nada que no cuelgue
de él. REG-340 arregló que el censo saliera del código; esto arregla que el censo
sepa mirar fuera del árbol.

**LA REGLA QUE LO HACE SEGURO.** Toda colección de nivel raíz que el código
escriba está **clasificada**: o se respalda con el consultorio
(`COLECCIONES_RAIZ`, con el campo por el que se filtra) o se declara fuera **con
su motivo** (`RAIZ_EXCLUIDAS`).

Y se declara qué **no** se lleva y por qué: ninguna `platform_*` entra. Son de la
plataforma, no de este consultorio, y meterlas en el archivo que el médico
descarga sería entregarle datos de otros consultorios. Lo mismo con lo efímero
—`rate_limits`, `oauthStates`, `whatsapp_dedup`, `transcript_owners`—: restaurar
un candado viejo o una llave caducada no reconstruye nada.

**LA PRUEBA.** Tres casos nuevos en
`src/__tests__/lo-que-el-codigo-escribe-esta-declarado.test.ts` (9 en total).
Probado al revés sacando `clinic_members` del manifiesto: caen 2, y uno de ellos
existe sólo para clavar ese nombre.

**QUÉ NO CUBRE, DECLARADO.**

- **No se ha restaurado nada.** Esto mete las tres colecciones en el archivo; que
  una restauración real las devuelva y el consultorio vuelva a ser usable sigue
  sin comprobarse. El simulacro de ida y vuelta mide que el NDJSON se relee, no
  que Firestore lo acepte de vuelta.
- **El importador no se ha tocado.** Que el respaldo las lleve no significa que
  `/api/clinic/importar` sepa reescribirlas en su sitio: son de nivel raíz y el
  importador está escrito para el árbol. **Queda abierto y es la mitad que falta
  del bucle** — un respaldo que se lleva algo que no se sabe devolver sigue sin
  cerrar la recuperación.
- **Las `platform_*` siguen sin ningún respaldo**, ni aquí ni en otro sitio. No
  es un hueco de este archivo —no son del consultorio— pero tampoco existe el
  respaldo de plataforma que les tocaría. Abierto en el tablero.

---

## REG-344 — el worklist podía quedarse corto, y callarlo

**QUÉ FALLABA, POR DOS CAMINOS DISTINTOS.**

*Uno.* `tareasVivas()` leía con `limit(200)` **sin `orderBy`**. Firestore
devuelve entonces 200 documentos **arbitrarios** de los N que hay, y la pantalla
no tenía forma de saber que había más. Con 200 pendientes vivos, un resultado
crítico sin revisar podía sencillamente no aparecer — y la pantalla se veía
igual de tranquila.

*Dos.* Al firmar, las tareas de la consulta se creaban con
`void crearTareas(...).catch(() => {})`. `crearTareas` **devuelve cuántas
entraron** —y traga los fallos de una en una a propósito, para que un pendiente
roto no tumbe a los demás—, y ese número se descartaba junto con el `catch`. Si
la pestaña se cerraba o la red se caía en esa ventana, los pendientes de esa
consulta desaparecían y el médico se iba **convencido de que estaban**.

**LO QUE NO ERA EL DEFECTO, Y CONVIENE DECIRLO.** La ausencia de `orderBy` no es
un descuido: está razonada en el módulo. `where … in …` junto a `orderBy` exige
un índice compuesto que hay que crear a mano en la consola, y mientras no existe
**la lectura falla entera** — así se abrió esta pantalla en producción, con un
error y no con una lista vacía. Quitarlo fue correcto. Y crear las tareas sin
bloquear la firma también lo es: hacer que un fallo al escribir el worklist
reviente la firma sería cambiar un pendiente perdido por una consulta perdida.

**LA CAUSA RAÍZ es el silencio, no el orden ni el bloqueo.** Dos decisiones
correctas dejaron cada una un hueco, y ninguna de las dos lo declaraba.

**LA REGLA QUE LO HACE SEGURO.** Una lista de trabajo clínico que se queda corta
**lo dice**. «No hay nada pendiente» y «no lo he leído entero» no son lo mismo, y
en esta pantalla confundirlos se lee como «todo está al día» — la conclusión más
peligrosa posible. La pantalla ya distinguía un fallo de lectura de una lista
vacía; faltaba el tercer caso.

Se lee `tope + 1` para **saber** si se quedó corta; el documento extra no se
devuelve, sólo sirve para poder decirlo. Y al firmar se compara lo creado con lo
esperado, igual que hace el camino hospitalario desde REG-252.

**LA PRUEBA.** `src/__tests__/un-pendiente-que-falta-no-se-calla.test.ts`
(7 casos), con una tienda en memoria que respeta el `limit` de verdad. Incluye el
**borde exacto**: con exactamente `tope` documentos **no** se declara corta —
avisar ahí sería un aviso falso, y un aviso que miente se aprende a ignorar.
Probado al revés volviendo a `limit(tope)`: cae el caso del defecto.

**QUÉ NO CUBRE, DECLARADO.**

- **NO arregla QUÉ 200 vienen.** Siguen siendo un subconjunto arbitrario. Para
  elegir los más urgentes hace falta el índice compuesto, que se crea **fuera del
  repositorio** y es decisión de infraestructura del dueño. Mientras tanto el
  aviso es **la defensa, no la solución**. Abierto en el tablero.
- **`tareasDePaciente` sigue con `limit(100)`** y sin declarar su recorte. Un
  paciente con más de 100 pendientes vivos es improbable, no imposible, y aquí no
  se da por bueno: queda anotado.
- **No se ha visto en un navegador**: que el aviso exista no prueba que se vea.

---

## REG-345 — la tabla que un dueño lee para decidir un gasto decía «sí» de fuentes que nadie ha construido

**QUÉ FALLABA, EN DOS SITIOS QUE SON EL MISMO DEFECTO.**

*Uno.* `docs/evidence/MATRIZ-CALIFICACION-PROVEEDORES.md` tenía una columna
«¿Puede citar hoy?» que contestaba **sí** para ClinicalTrials.gov, la OMS y los
CDC. Ninguno de los tres tiene adaptador, ninguno se instancia y ninguno se
consulta nunca.

La columna no mentía por descuido: miraba `proveedorCanonico`, que es una
propiedad del **tipo** —«si algún día hay un `Source`, se llamará así»—, no una
capacidad de ejecución. El pie de la tabla lo explicaba. Pero un dueño que abre
el documento para decidir si paga una licencia lee **la tabla**, no el pie, y se
lleva que ya tiene tres fuentes públicas funcionando.

*Dos.* `seleccion.ts` construye, con una regla explícita de #314, los avisos que
dicen qué se consultó y qué no — «un proveedor no operativo baja en el orden pero
**no desaparece**, para que el médico pueda leer *UpToDate: no se consultó*». El
servidor los calculaba, los mandaba por el cable en `meta.recuperacion.avisos`,
la pantalla los **tipaba**… y no los pintaba en ningún sitio.

Es decir: **la honestidad estaba escrita, probada y sin llegar**. Un consultor
que sólo enseña lo que sí encontró se lee como si hubiera mirado en todas partes.

**LA CAUSA RAÍZ.** El documento se generaba desde el **catálogo** —que es una
declaración de intención— y nunca desde el código que crea los adaptadores, que
es la única verdad de ejecución. Dos fuentes, y se eligió la que no manda.

**LA REGLA QUE LO HACE SEGURO.** La columna cruza catálogo **y** runtime, y
admite **tres** estados en vez de dos, porque hay tres realidades:

- `sí` — hay licencia y hay adaptador instanciado.
- `sí, pero fuera del contrato` — **PMC y openFDA se consultan de verdad**; los
  llama a mano la ruta (`textoCompletoPMC`, `dosisFDA`). Meterlos en «sin
  adaptador» sería mentir en la otra dirección. Pero tampoco es un «sí» limpio:
  al no pasar por `planDeConsulta` **no producen aviso**, así que si openFDA se
  cae el médico lee una respuesta más pobre y **no puede distinguirla** de una
  completa.
- `no — sin adaptador` / `no — sin licencia`.

Y los avisos ya se pintan, en un desplegable «Qué se consultó para responder».

**LA PRUEBA.**
`src/__tests__/la-matriz-de-evidencia-no-promete-lo-que-no-hay.test.ts` (6
casos). El primero compara la copia del generador contra
`PROVEEDORES_INSTANCIADOS` —el generador es JS puro y no puede importar TS, así
que la copia es inevitable; lo que no es inevitable es que se separe—. Probado al
revés aplicando el criterio viejo a ClinicalTrials: decía `true`, el nuevo dice
`false`.

**QUÉ NO CUBRE, DECLARADO.**

- **No comprueba que las fuentes RESPONDAN**, sólo que estén cableadas. Que
  PubMed conteste hoy es cosa de la red.
- **No arregla que PMC y openFDA no avisen cuando fallan.** Se declara en la
  tabla y queda abierto: mientras no pasen por el contrato, su caída es
  invisible.
- **No toca la ruta `expediente/evidencia`**, que es la que usa el botón de la
  pantalla de consulta y **sigue con `.catch(() => [])`** sin sobre y sin
  procedencia. Es el hueco grande que queda en evidencia y sigue abierto.
- **No verifica ninguna licencia.** Toda la columna comercial sigue
  `UNVERIFIABLE`: se llenó sin acceso a portales ni credenciales, y eso no ha
  cambiado.

---

## REG-346 — trece llamadas a proveedor podían inmovilizar la función entera

**QUÉ FALLABA.** Trece llamadas a proveedor salían **sin señal de aborto**. Un
socket que no cierra —el proveedor acepta la conexión y nunca contesta— deja la
función de Vercel corriendo hasta su `maxDuration` completo: facturada por
GB-segundo, y con el médico delante esperando una nota que ya no va a llegar.

Lo peor estaba en `expediente/procesar`, que corre con **`maxDuration = 800`**:
el ensamble de OpenAI y el descubrimiento de modelos de Anthropic no llevaban
ninguna. Y en `transcribir-diarizado`, donde el **sondeo se repite en bucle** —
una sola vuelta colgada basta.

**ESTO NO ES HIPOTÉTICO.** `docs/maintenance/sw-changelog.md` documenta un socket
colgado que inmovilizó una lambda de `maxDuration = 300` los 300 s enteros.
`procesar` es casi el triple de esa.

**LA CAUSA RAÍZ.** El helper correcto **ya existía**: `fetchConTimeout`, con
`AbortController`, `clearTimeout` en `finally` y presupuestos por destino. Se usa
en **tres** archivos. Las otras veintidós llamadas lo esquivan —el propio
`gateway.ts` declara esa dualidad como una parada intermedia deliberada— y trece
de ellas se quedaron sin ningún tope propio: ni el helper, ni un `signal` a mano.

Es «escrito y sin conectar» aplicado a una **defensa**: existe, está probada, y
no cubre el camino que más la necesita.

**LO QUE LA AUDITORÍA DIJO Y NO ERA ASÍ.** El informe señalaba también la llamada
a Claude de `procesar` y el `.catch(() => [])` de `expediente/evidencia`. Las dos
se comprobaron y **estaban bien**: la primera ya recibía
`signal: AbortSignal.timeout(msDisponibles)` derivado del presupuesto de la ruta;
y el segundo no esconde nada, porque `buscarEvidenciaMulti` marca un `testigo`
mutable **antes** de que el `catch` lo alcance —en el `!r.ok` y en la excepción,
tanto en `esearch` como en `efetch`— y la ruta lo convierte en un aviso que
distingue «no se pudo preguntar» de «no hay literatura», que la pantalla pinta.
Se deja escrito para que nadie lo «arregle» dos veces.

**LA REGLA QUE LO HACE SEGURO.** Toda llamada a un proveedor externo desde una
ruta de API lleva un tope: o `fetchConTimeout`, o un `AbortSignal` propio. Cada
tope se dimensiona contra el `maxDuration` de SU ruta, dejando margen para
responder — porque una función cortada en seco pierde el trabajo ya hecho, que
es la peor forma de fallar.

**LA PRUEBA.**
`src/__tests__/ninguna-llamada-a-proveedor-cuelga-la-funcion.test.ts` (5 casos).
Incluye un caso que comprueba que **el cedazo mira de verdad** —si dejara de
encontrar rutas con proveedor, el guardián estaría en verde por no vigilar—.
Probado al revés quitando el tope de `transcribir`: cae, y nombra el archivo.

**QUÉ NO CUBRE, DECLARADO.**

- **Comprueba que EXISTA un tope, no que el número sea el correcto.** Que el
  sondeo de AssemblyAI espere 20 s y no 15 es un juicio, no una verificación.
- **No hay circuit breaker en ninguna parte**, ni presupuesto de reintentos. Un
  proveedor caído se sigue reintentando en cada petición. Abierto en el tablero.
- **No prueba el comportamiento real ante un socket colgado**: eso necesitaría un
  servidor que acepte y calle, y aquí no se levanta uno. Es exactamente el mismo
  límite de entorno que mantiene en rojo intermitente a `ops-timeout`.
- **Sólo mira `src/app/api/`.** Una llamada a proveedor desde `src/lib/` que no
  pase por el gateway se le escapa.

---

## REG-347 — «no está» de un paciente que sí está

**DE DÓNDE VIENE.** REG-341 acotó la lectura del directorio: `getPatients` dejó
de bajarse el consultorio entero y pasó a tener un techo. Correcto para la
escala, **y abrió un defecto** en la pantalla donde más duele.

**QUÉ FALLABA.** `/pacientes` cargaba «la lista» y filtraba **en memoria**. Con
techo, ese filtro busca dentro de un **recorte**: en un consultorio de 600
pacientes, teclear el nombre del 550º devolvía «Sin resultados» — de alguien que
está en el expediente. En la pantalla cuyo trabajo entero es encontrar a un
paciente, ésa es la peor respuesta posible, porque **se lee como un hecho** y no
como un límite.

Y había un segundo sitio, peor: al guardar un paciente nuevo, la comprobación
antiduplicado **releía la lista sin caché**. Con el techo, el duplicado podía
estar entre los que no vinieron — un aviso antiduplicado que falla en silencio
justo en los consultorios grandes, que son los que lo necesitan. El resultado
habría sido un historial partido en dos expedientes.

**LA CAUSA RAÍZ.** Acotar una lectura no es una operación local: **cambia el
contrato de todos sus lectores**. Los que trataban «la lista» como el censo
completo empezaron a tratar un recorte como el censo completo, sin que nada
cambiara en su código. Es el mismo patrón que REG-341 declaró y dejó abierto;
aquí se cierra en la pantalla que no podía esperar.

**LA REGLA QUE LO HACE SEGURO.** **Buscar es preguntar al servidor.** La consulta
indexada no depende del techo. El filtro en memoria se queda sólo por debajo de
dos caracteres y mientras la consulta viaja — nunca como la respuesta final. El
resultado va **atado al texto que lo produjo**: sin eso se enseñarían un instante
los resultados de la búsqueda anterior, que en esta pantalla significa enseñar
**otro paciente** al que se está buscando.

La comprobación antiduplicado pasa a ser **dos sondeos indexados**: por teléfono
—la señal fuerte— y por nombre. El coste deja de depender del tamaño del
consultorio.

Y quien **recorre** la lista, en vez de buscar, lee cuántos se están listando y
que la búsqueda sí llega a todos.

**LA PRUEBA.**
`src/__tests__/en-la-pantalla-de-buscar-no-se-dice-no-esta.test.ts` (6 casos).
Probado al revés quitando la salida temprana hacia el resultado del servidor:
caen 2, incluido el que comprueba que el filtro local ya no es la respuesta
final.

**QUÉ NO CUBRE, DECLARADO.**

- **La búsqueda es por PREFIJO.** Un duplicado con el orden de los nombres
  cambiado —«López María» frente a «María López»— y **sin teléfono en común** no
  aparece. Antes tampoco aparecía por encima del techo, y de forma arbitraria;
  ahora el hueco es **conocido y tiene forma**. No se da por resuelto.
- **Un paciente sin campo `nombre` no sale en el listado.** Límite heredado de
  REG-341, con su golden.
- **Quedan nueve pantallas sin declarar el recorte** — `/citas`, `/crm`,
  `/asistente`, `/hospitalizacion`, `/farmacia`, `/membresias`, `/cumplimiento`,
  `/reactivacion`, `/migracion`. Siguen abiertas; ésta se arregla primero porque
  es **la pantalla de buscar**.
- **No se ha visto en un navegador.** Que el aviso exista no prueba que se vea, y
  el rebote de la búsqueda con el servidor no se ha probado con dedos.

## REG-348 — el respaldo se llevaba lo que ata una cuenta a un consultorio, y la restauración no sabía devolverlo

**DE DÓNDE VIENE.** REG-343 descubrió que `clinic_members` estaba fuera del
respaldo: un consultorio restaurado quedaba con el expediente entero y **sin
nadie que pudiera entrar**. Se metió en el manifiesto, junto a las otras dos
colecciones que pertenecen al consultorio **por un campo** y no por la ruta
(`clinic_invitations`, `clinic_review_requests`).

**QUÉ FALLABA.** El camino de vuelta estaba escrito **sólo para el árbol**.
`leerLinea` exigía que la ruta empezara por `clinics/` y tuviera al menos cuatro
segmentos, así que `clinic_members/{uid}` —dos segmentos— caía en «ruta con forma
inesperada» y se rechazaba. Las tres colecciones nuevas salían en el respaldo y
**ninguna volvía**.

El defecto de REG-343 seguía vivo, sólo que una casilla más adelante: antes el
archivo no las llevaba; ahora las llevaba y el importador las tiraba. En los dos
casos el consultorio restaurado se quedaba sin miembros, y en los dos casos el
informe se veía sano.

**LA CAUSA RAÍZ.** **Un respaldo tiene dos mitades y sólo se movió una.** El
exportador y el importador leen el mismo manifiesto, pero el manifiesto sólo
decía *qué* llevarse; la *forma* de la ruta estaba codificada aparte, en cada
mitad, y se cambió en una sola. Es la regla «el dato tiene que LLEGAR» en su
forma más literal: el dato salía, y del otro lado no lo aceptaban.

**LA REGLA QUE LO HACE SEGURO.** **Lo que pertenece al consultorio por un CAMPO
también vuelve, y vuelve por el campo.** Estas tres no se re-enraízan reescribiendo
la ruta —su identificador es global—, sino **forzando el campo al consultorio
destino**, por el mismo motivo por el que la ruta se reescribe siempre: el destino
lo decide quien restaura, no el archivo. Dejar pasar el valor del archivo dejaría
las membresías apuntando al consultorio de ORIGEN, que es el defecto de REG-343
otra vez.

La lista blanca es el **mismo manifiesto** que usa el exportador: aquí no hay ruta
que reescribir, así que lo único que impide que un archivo editado a mano escriba
en cualquier colección de la base con el SDK admin —que se salta las reglas de
Firestore— es esa comprobación. Una colección declarada **fuera** del respaldo se
rechaza **con su motivo**, para que quien lea el informe distinga «esto no se
restaura a propósito» de «esto no se entendió».

**LA PRUEBA.** `src/__tests__/el-respaldo-sabe-volver-entero.test.ts` (25 casos).
Probado al revés devolviendo `leerLinea` a la guarda anterior: caen los casos de
nivel raíz, incluido el que cruza el manifiesto del exportador con lo que el
importador acepta.

**QUÉ NO CUBRE, DECLARADO.**

- **No se ha restaurado nunca contra Firestore de verdad.** El ida y vuelta que
  hay mide que el NDJSON se relee, no que la base acabe como se espera. El
  simulacro sigue diciéndolo con todas las letras.
- **Las reglas de Firestore no se evalúan por este camino**: usa el SDK admin,
  que se las salta por diseño.
- **La restauración no puede devolver la cuenta de Firebase Auth.** Devuelve la
  membresía; si el usuario ya no existe en Auth, sigue sin poder entrar.
- **El conflicto de identificador compartido lo abrió esta misma unidad** y lo
  cierra REG-349: comprobar de quién es el documento no bastaba mientras
  comprobar y escribir fueran dos actos.

## REG-349 — restaurar un respaldo podía quitarle la cuenta a otro consultorio

**CÓMO SE DESCUBRIÓ.** Revisión independiente de REG-348 (hallazgo de Codex),
reproducido antes de tocar una línea. La defensa que REG-348 añadió existía y
era la correcta; lo que no era correcto era **cuándo** miraba.

**QUÉ FALLABA.** `clinic_members/{uid}` es literalmente la misma ruta para todos
los consultorios del mundo. REG-348 puso la defensa obvia: leer el documento y no
pisarlo si es de otro consultorio. Pero leía con un `adminDb.getAll(...)` **suelto**
y escribía después, con `merge`, dentro de un `WriteBatch` que se commiteaba más
tarde —hasta 400 documentos después, en una función que puede correr 300 s—.

Entre las dos cosas no había nada:

```
restauración lee clinic_members/U   → LIBRE
consultorio VECINO da de alta a U   (registro, invitación aceptada…)
restauración commitea el merge      → U pasa a ser del que restaura
```

Esa persona **pierde el acceso a su consultorio sin que nadie haya hecho nada
mal**, y sin rastro: el informe lo cuenta como escrito, porque cuando miró estaba
libre. Es exactamente el daño que la comprobación existía para evitar, cometido
por la propia comprobación. No hace falta un atacante: basta con que una
restauración larga coincida con un alta normal.

**LA CAUSA RAÍZ.** **Comprobar y escribir eran dos operaciones, no una.** Un
`getAll` no fija nada: es una foto. Un `WriteBatch` es atómico *entre sus
escrituras*, pero no vuelve a mirar si el mundo cambió desde que alguien lo
llenó. Toda la defensa descansaba sobre un dato que podía estar caducado, y el
tamaño de la ventana crecía con el tamaño del respaldo.

**LA REGLA QUE LO HACE SEGURO.** **Donde el identificador es compartido, mirar y
escribir es UN solo acto.** El grupo de nivel raíz va dentro de una
`runTransaction`: la lectura fija la versión de cada documento y, si alguna cambió
antes del commit, Firestore reejecuta — y la segunda vuelta sí ve al vecino y se
aparta.

Dos corolarios que quedan escritos en el código:

- **El árbol del consultorio sigue por lote.** Ahí la ruta ya separa los
  consultorios y no hay identificador que disputar; pagar una transacción por
  cada nota sería caro sin comprar nada. La transacción se paga donde compra.
- **La decisión se calcula en una función pura y los contadores se tocan DESPUÉS
  del commit.** El cuerpo de una transacción se reejecuta ante contención: un
  contador incrementado dentro contaría dos veces la misma línea, y el informe de
  una restauración es lo único que le queda a quien la corrió para saber qué pasó.

**LA PRUEBA.**
`src/__tests__/restaurar-no-le-quita-la-cuenta-a-otro-consultorio.test.ts`
(8 casos). **Ejecuta la ruta real** contra `TiendaEnMemoria`, que tiene
concurrencia optimista de verdad, e inyecta el alta del vecino en el hueco exacto
entre la lectura y la escritura. Con el código de REG-348 caen 3 casos y la
membresía **se la queda el consultorio que restaura**; con el arreglo, los 8 pasan.

Un caso vigila la prueba a sí misma: `vecesReejecutada > 0`. Sin él, una
transacción que nunca reejecutó pasaría por no haber habido carrera, y una
condición que pasa porque el gesto no ocurrió es peor que una que falla.

**El gancho de la tienda cuelga de la LECTURA, no de la escritura**, a propósito:
uno colgado del mecanismo de escritura dejaría de dispararse en cuanto ese
mecanismo cambiara —que es justo lo que hace el arreglo— y la misma prueba no
podría fallar antes y pasar después.

**QUÉ NO CUBRE, DECLARADO.**

- **No se prueba el tope de 500 escrituras por transacción de Firestore.** La
  tienda en memoria no lo impone; lo que ata el tamaño del grupo es `LOTE_RAIZ`
  (200), y eso se lee, no se ejecuta.
- **No se mide el coste.** Una transacción reejecutada cuesta más que un lote;
  que eso siga cabiendo en los 300 s de la función no se ha medido.
- **Las reglas de Firestore siguen sin evaluarse** por este camino: SDK admin.
- **El ensayo (`simular=1`) no es transaccional**, y no puede serlo: no escribe,
  así que no hay nada que proteger. Predice la colisión con la misma función
  pura, pero **su predicción puede quedarse vieja** entre el ensayo y la
  restauración de verdad. Eso es inherente a un ensayo, y por eso la comprobación
  se repite —esta vez atada a la escritura— en la restauración real.
- **No cubre el resto del importador.** Lo del árbol firmado es REG-160/REG-334;
  lo de las colecciones de nivel raíz que vuelven es REG-348.

## REG-350 — el historial completo de un paciente se bajaba en cada pantalla

**QUÉ FALLABA.** `getNotas(clinicId, patientId)` hacía `getDocs` sobre la
colección de notas **sin `limit`**. No es una lista de nombres: cada nota lleva
dentro `transcripcionCruda`, `transcripcionMotor` y `dialogoDiarizado` —el
dictado completo de la consulta, con separación de voces— más el bloque
`extraction` con una cita textual por campo. El propio `updateNota` de ese
archivo rechaza una nota de más de 950 KB porque Firestore admite 1 MB por
documento: **una sola nota puede pesar casi un mega**.

Seis sitios pedían el historial entero. Los dos peores no lo necesitaban:

- **`hospitalizacion/[internamientoId]`** bajaba TODAS las notas del paciente
  para quedarse en memoria con las cuatro de un ingreso.
- **`cumplimiento/retencion`** llamaba a `getNotas` por **cada uno de hasta 500
  pacientes** —hasta 500 historiales completos— para calcular **una fecha y un
  conteo**. Es la lectura más cara del producto, y la hace una pantalla de
  cumplimiento que nadie abre a diario.

Y `getUltimasNotasResumen` se bajaba todas las notas firmadas para producir
**tres cadenas de texto**. Su comentario explicaba por qué no llevaba `orderBy`
—haría falta un índice compuesto— sin ver que la consecuencia de quitarlo era
quedarse **sin `limit`**.

**LA CAUSA RAÍZ.** Ningún contrato de lectura del expediente declaraba un tope.
`getNotas` se escribió cuando un paciente tenía tres notas, y quien la llamó
después heredó «traer el historial» como si fuera gratis. Es el mismo patrón que
REG-341 cerró en el directorio de pacientes, en el otro eje: allí crecía con el
**consultorio**, aquí con el **paciente**.

**LA REGLA QUE LO HACE SEGURO.** Las lecturas dependen del límite de página o de
la ventana, **nunca del tamaño del historial**. `listarNotasPagina` (cursor por
valores, con `documentId()` de desempate para dos notas del mismo día) y
`listarNotasCompat`, que recorre hasta un techo y **declara** `truncada`.

Y dos consecuencias que no son opcionales:

1. **Una salvaguarda no puede depender de un techo.** El bloqueo NOM-004 de
   `deletePatientExpediente` filtraba `getNotas` en memoria. En el momento en que
   esa lectura tuvo techo, un paciente con historial largo y las firmadas por
   debajo del techo se habría vuelto **borrable**. Pasa a ser
   `tieneNotaFirmada`: consulta indexada con `limit(1)`, que no depende de nada y
   además es más barata que lo que había. Es la lección de REG-347 —acotar una
   lectura cambia el contrato de todos sus lectores— **aplicada antes de que
   cobrara la pieza**.
2. **El recorte llega a la pantalla.** De estas notas salen la medicación
   vigente y los problemas activos, que aplican la regla de la última palabra
   sobre cada fármaco. Sobre un recorte, un fármaco crónico que no se haya vuelto
   a mencionar **desaparece**, y la lista se lee como «no toma nada más» — con el
   paciente enfrente y antes de prescribir. El expediente lo avisa **arriba del
   todo**, antes de las conclusiones derivadas; la consulta, dentro del bloque de
   medicación vigente, que es lo que puede faltar.

**LA PUERTA QUE SE BORRÓ, Y POR QUÉ.** `getNotas` no se conservó como superficie
de compatibilidad. El directorio de pacientes sí conservó la suya (`getPatients`)
porque catorce pantallas la llamaban — **y ese atajo tuvo factura**: REG-347 y las
nueve pantallas que hoy siguen recibiendo el recorte sin declararlo son ese atajo
cobrando. Aquí los llamadores eran seis, así que se borró la puerta que devuelve
un array pelado: **un array no puede decir que viene recortado**, y quien lo
recibe no tiene forma de saberlo. Ahora se llama a `listarNotasCompat` y
`truncada` está en la mano — se puede ignorar, pero ya no se puede no ver.

**LA PRUEBA.** `src/__tests__/el-historial-completo-no-cabe-en-una-pantalla.test.ts`
(27 casos), que **cuenta documentos leídos** contra historiales de 40 y de 4 000
notas. Probado al revés dos veces:

- reintroduciendo los tres defectos en el módulo (salvaguarda sobre el recorte,
  `truncada` que se calla, resumen sin ventana): caen 4 casos;
- degradando el arnés a su versión anterior, que comparaba `startAfter` **sin
  mirar la dirección del orden**: caen otros 4. Ese segundo pase importa —un
  doble que ignora la dirección da por buena una paginación descendente que en
  Firestore devolvería la primera página en bucle.

**EL DOBLE, AHORA COMPARTIDO.** El doble del SDK de cliente vivía dentro del
golden de REG-341. Se extrae a `src/__tests__/_harness/firestore-cliente-en-memoria.ts`
en vez de copiarse: dos dobles divergen, y el día que uno se corrige el otro se
queda con el defecto — que es el patrón `depende_de_recordar` de este mismo
repositorio. Se le añadió `getCountFromServer` y la comparación de `startAfter`
en la dirección del orden.

**QUÉ NO CUBRE, DECLARADO.**

- **No prueba Firestore.** El doble no dice nada sobre índices desplegados,
  reglas ni latencia.
- **No renderiza.** Que el aviso de recorte exista en el árbol no prueba que se
  vea. Eso es navegador, y sigue sin ejecutarse (WS-05).
- **Una nota SIN `fechaConsulta` no aparece en el historial paginado.** Firestore
  omite de una consulta ordenada lo que no tiene el campo del `orderBy`. La
  limitación **ya existía** —`getNotas` ordenaba por ese campo desde siempre— y
  aquí queda probada en vez de supuesta, junto con la vía que sí la encuentra
  (`tieneNotaFirmada`, que no ordena).
- **`getUltimasNotasResumen` pierde un caso.** Si las últimas 40 notas fueran
  todas borradores, el resumen sale vacío aunque haya firmadas más atrás. Se
  acepta **sólo** porque ese texto es contexto de IA y una tarjeta de cortesía:
  su ausencia no afirma nada del paciente, y la cadena vacía ya era una salida
  posible. El mismo razonamiento **no vale** para nada que sostenga una
  conclusión clínica.
- **El techo de 200 no está medido contra un historial real.** Es una cota
  razonada (≈40 años de consulta trimestral), no una medición.
- **Las nueve pantallas de P1-11 siguen abiertas**: reciben el recorte de
  `getPatients` sin declararlo. Es otro requisito y no se da por cerrado aquí.

## REG-351 — nueve pantallas trataban un recorte como el censo completo

**DE DÓNDE VIENE.** REG-341 le puso techo a `getPatients` y REG-347 encontró la
factura en la pantalla de buscar — y la dejó escrita al cerrarse: «quedan nueve
pantallas sin declarar el recorte». Es P1-11 del tablero de Ausculta. Ninguna
prueba fallaba: todas son correctas con fixtures pequeños.

**QUÉ FALLABA, pantalla por pantalla.** La lista no es decorativa: cada una falla
distinto y ninguna hace ruido.

- **`/asistente`** — el typeahead filtraba el recorte en memoria. Al no ver al
  paciente, quien agenda lo daba de alta otra vez. Peor: `elegirExpedienteParaCita`
  decide **a qué expediente se cuelga la cita**, y lo decidía comparando contra
  ese mismo recorte. La nota, el diagnóstico y la receta van detrás de la cita.
- **`/migracion`** — clasificaba las filas de un CSV contra 500 de N, así que
  **todo el que quedara fuera salía como «nuevo»** y un clic duplicaba el
  consultorio entero. Y el botón de exportar descargaba 500 pacientes bajo el
  título «tu información es tuya», con un toast que decía «Exportados 500
  pacientes»: un número que parece un recuento y es un techo.
- **`/farmacia`** — un `<select>` con el directorio para elegir a quién se
  dispensa. En un controlado ese campo es **obligatorio** (NOM-220): el paciente
  no aparecía entre las opciones y la salida se registraba a nombre de otro o sin
  nombre. Y el libro de movimientos resolvía los nombres contra el mismo recorte,
  así que las dispensaciones más antiguas se pintaban «paciente a1b2c3».
- **`/cumplimiento`** — el filtro de la bitácora era otro `<select>` del
  directorio: el auditor —o el propio paciente ejerciendo ARCO— **no podía
  nombrar** a quien quería rastrear, en la pantalla que existe para contestar
  «quién vio este expediente y cuándo». Y el panel de retención afirmaba «al día»
  habiendo mirado 500 de N.
- **`/hospitalizacion`** — el buscador del ingreso y el antiduplicado del alta.
- **`/citas`** — el índice `id → Patient` de las filas: las citas cuyo paciente
  quedó fuera se pintaban sin nombre y sin su señal de riesgo de inasistencia,
  igual que si el paciente no existiera.
- **`/membresias`** — el buscador del modal de asignación.
- **`/crm` y `/reactivacion`** — cifras de retención y campañas calculadas sobre
  el recorte y presentadas como hechos del consultorio.

**LA CAUSA RAÍZ.** **Un `Patient[]` pelado no puede decir que viene recortado.**
Acotar `getPatients` y conservar su firma dejó una puerta por la que el recorte
pasa sin etiqueta, y quien lo recibe no tiene forma de enterarse. Todos los fallos
van hacia el silencio —«no está», «es nuevo», «al día», «sin coincidencias»— que
es la dirección que nadie vuelve a comprobar.

**LA REGLA QUE LO HACE SEGURO.** Ninguna pantalla llama a `getPatients`. Hay
cuatro puertas y cada una dice lo que aquélla callaba:

| Para | Se usa |
|---|---|
| una página con cursor | `listarPacientesPagina` |
| hasta el techo, **declarando `truncada`** | `listarPacientesCompat` |
| preguntar por alguien | `buscarPacientes` · `candidatosDePaciente` |
| el directorio **entero** (exportar/importar) | `recorrerPacientes` |

Y los sondeos viven **en un solo sitio** (`src/lib/pacientes/candidatos.ts`).
Copiar los dos de REG-347 nueve veces habría garantizado que divergieran: es el
patrón `depende_de_recordar` de este repositorio, cometido a propósito.

Tres decisiones que el arreglo obliga a tomar y que quedan escritas:

1. **«No se pudo preguntar» no es «no hay».** `candidatosDePaciente` devuelve
   `sePudoPreguntar`, y cuenta **sólo las sondas que se lanzaron de verdad**: una
   que no se hizo —porque no había teléfono— no es prueba de que la lectura
   funcione. Contarla como tal decía «se preguntó y no hay» después de un fallo, y
   de ahí sale un expediente duplicado. `/asistente` ya no crea expediente cuando
   la consulta falló; `/hospitalizacion`, `/membresias`, `/farmacia` y
   `/cumplimiento` lo pintan distinto de «sin coincidencias».
2. **`QuienSeBusca` acepta más campos de los que busca.** Nombre y teléfono son
   lo que se busca; CURP, fecha de nacimiento y edad **afinan la comparación**.
   No es un adorno: el motor sólo dice `seguro` con alguno de ésos, y un tipo
   recortado a nombre y teléfono habría **debilitado en silencio** el
   antiduplicado de quien ya lo tenía bien. Lo cazó el golden.
3. **Cuando la completitud es el producto, se recorre entero — o no se hace.**
   `recorrerPacientes` pagina el directorio completo, y si toca su techo lo
   **declara**: la importación se detiene («no se puede decir quién es nuevo») y
   la exportación pide confirmación explícita y marca el archivo como incompleto.

**LA PRUEBA.** `src/__tests__/ninguna-pantalla-recibe-una-lista-muda.test.ts`
(22 casos). Ejecuta las búsquedas de verdad contra el arnés que **cuenta
documentos leídos**, y trae un **guardián de árbol**: recorre `src/app`,
`src/components` y `src/hooks` y falla si alguno vuelve a llamar a `getPatients`.
El guardián se vigila a sí mismo (un caso comprueba que el árbol recorrido no está
vacío, porque un guardián que no mira nada pasa siempre).

Probado al revés devolviendo los candidatos al filtro sobre la lista recortada y
quitando la declaración del techo del recorrido: **caen 7 casos**.

**EL GUARDIÁN BUSCA LA LLAMADA, NO LA PALABRA.** Varios archivos nombran
`getPatients` en un comentario para explicar por qué ya no la usan. Un regex sobre
la palabra habría obligado a borrar esa explicación para pasar — y esa explicación
es justo lo que evita la recaída.

**QUÉ NO CUBRE, DECLARADO.**

- **No renderiza.** Los casos de pantalla leen la FUENTE: comprueban que el aviso
  y el camino existan, no que se vean. Eso es navegador y sigue sin ejecutarse.
- **La búsqueda sigue siendo por PREFIJO.** Un duplicado con el orden de los
  nombres cambiado y sin teléfono en común no aparece (P1-17, abierto). No se
  cierra aquí; tampoco se agranda.
- **`recorrerPacientes` no está medido contra un directorio real.** Su techo de
  50 000 es una cota razonada. Lo que sí está probado es que al tocarlo la
  operación **se detiene o avisa**, en vez de pasar de largo.
- **`getPatients` no se borró.** Los goldens de REG-341 miden ahí el invariante
  de escala de la superficie de compatibilidad. Lo que se cerró es que una
  pantalla vuelva a llamarla, y eso lo vigila el guardián — no un comentario.
- **El `<select>` de `/farmacia` se cambió por un buscador y no se ha probado con
  un lector de pantalla.** Tiene etiqueta y objetivos de 44 px; eso no es lo
  mismo que haberlo recorrido con teclado.

## REG-352 — la baja de un paciente leía la agenda entera, y se tragaba el fallo

**QUÉ FALLABA.** `deletePatientExpediente` busca las citas **huérfanas** del
paciente —las agendadas sin `pacienteId`, que sólo llevan su nombre y su
teléfono— y para eso hacía `getDocs` sobre la colección **entera** de citas del
consultorio. Con años de agenda son decenas de miles de documentos leídos en el
navegador para dar de baja a una persona.

Y el barrido estaba envuelto en `catch { /* ignore */ }`.

**POR QUÉ ESE `catch` ERA LO GRAVE.** Una cita huérfana lleva `pacienteNombre` y
`pacienteTelefono` **dentro**. Si el barrido falla y nadie se entera, el
expediente se borra, la pantalla dice que se borró, y **los datos personales del
paciente siguen en la base** en documentos que ya no cuelgan de nadie.

Esta función es la que usa la **cancelación ARCO**. Es decir: el camino por el que
un paciente ejerce su derecho a que le borren sus datos podía dejarlos puestos y
devolver «hecho».

**LA CAUSA RAÍZ.** El emparejamiento es normalizado (minúsculas, teléfono sin
formato) y Firestore no puede filtrar por eso, así que alguien concluyó «hay que
leerlo todo» y, al ver que eso podía fallar, lo envolvió en un `try` para que no
tumbara el borrado. **Las dos decisiones son razonables por separado** y juntas
producen un borrado que miente.

**LA REGLA QUE LO HACE SEGURO.** El barrido se **pagina** con techo, y cuando no
se pudo revisar entero **no se borra nada**. Un borrado incompleto que se cree
completo es peor que uno que se niega: el que se niega se reintenta; el que miente
se archiva.

La misma regla se aplicó a la guarda que tenía al lado: `tieneNotaFirmada` ahora
**falla cerrado**. No poder comprobar si hay una nota firmada no es lo mismo que
saber que no la hay, y del lado equivocado se elimina un registro legal que la
NOM-004 declara inmutable.

**DOS DEFECTOS DEL ARNÉS QUE ESTE GOLDEN DESTAPÓ.** Los dos hacían pasar pruebas
vacías, y por eso se anotan aparte:

1. **`writeBatch` era un muñeco**: `{ set(){}, update(){}, delete(){}, commit(){} }`.
   Cualquier prueba que afirmara sobre una escritura pasaba **sin que la escritura
   ocurriera**. El borrado en cascada podía no borrar nada y el doble decía que sí.
2. **El `ref` de un documento de consulta sólo tenía `path`**, y media aplicación
   pasa ese `d.ref` a `batch.delete(...)`. El lote no sabía qué borrar y no
   borraba — en silencio. Ahora lleva `ruta` y `path`, y un ref sin ninguna de las
   dos **lanza**: un lote que no sabe qué escribir no puede callarse.

**LO QUE NO SE HIZO, Y POR QUÉ.** El listener de citas de un paciente
(`usePatientAppointments`) **sigue sin techo**, a propósito. La reparación obvia
—`orderBy('fechaHora','desc')` + `limit`— exige un **índice compuesto**, y este
repositorio no puede crear índices: se hacen a mano en la consola del dueño.
Publicar esa consulta rompería la pantalla de consulta en producción con
`FAILED_PRECONDITION` en cuanto alguien la abriera. Y acotar **sin** orden es
peor que no acotar: Firestore devolvería 200 citas arbitrarias y el único llamador
busca **la cita de hoy** — perderla desliga el cobro del encuentro.

En vez de eso, el hueco deja de ser invisible: nace `firestore.indexes.json` con
los índices que el código está esperando y `docs/ops/INDICES-DE-FIRESTORE.md`
explicando qué está peor por cada uno. Hasta hoy vivían en **comentarios sueltos**,
uno por módulo, y nadie podía saber cuántos faltaban ni pedirlos de una vez: el
patrón `depende_de_recordar` aplicado a la infraestructura. Con esto, P1-14 pasa de
«bloqueado» a **«bloqueado, con el artefacto listo para desplegar»**.

**LA PRUEBA.** `src/__tests__/un-borrado-que-deja-citas-no-es-un-borrado.test.ts`
(13 casos). Borra de verdad contra el arnés y **cuenta** documentos. Probado al
revés devolviendo el `catch { /* ignore */ }`: caen 2 casos, incluido el que
comprueba que el expediente sobrevive cuando la agenda no se pudo leer.

**QUÉ NO CUBRE, DECLARADO.**

- **El emparejamiento sigue siendo por barrido, no por índice.** Un índice sobre
  el nombre normalizado lo haría exacto y barato; no existe y no se puede crear
  desde aquí.
- **El techo del barrido (20 000) no está medido** contra una agenda real. Lo que
  sí está probado es que al tocarlo el borrado **se niega**.
- **No cubre otras colecciones que puedan llevar PHI del paciente.** Aquí se miran
  notas y citas, que es lo que esta función borraba. Si mañana otra colección
  guarda el nombre del paciente, este golden no la ve — y ése es exactamente el
  hueco que P1-2 (colecciones sin declarar) mantiene abierto.
- **`firestore.indexes.json` no está desplegado**, y desplegarlo requiere
  autorización del dueño. El archivo declara; no crea nada.

## REG-353 — un proveedor caído se seguía reintentando en cada petición

**QUÉ FALLABA.** REG-346 puso tiempo máximo a las llamadas de proveedor, así que
**una** ya no podía inmovilizar la función. Lo que no había era nada que
impidiera que las **mil siguientes** volvieran a pagar el timeout entero contra
un proveedor que llevaba minutos caído. El propio tablero lo decía: «no hay
circuit breaker ni presupuesto de reintentos en ninguna parte» (P1-15).

Con Anthropic devolviendo 529, cada consulta que empieza espera 60 segundos para
acabar diciendo «no se pudo». Diez médicos a la vez son diez funciones ocupadas
un minuto cada una —facturadas por GB-segundo— y diez médicos con el paciente
enfrente mirando una barra que ya se sabe cómo termina. Y la avalancha de
reintentos es justo lo que impide que un proveedor sobrecargado se recupere.

Además la cascada de modelos no tenía **presupuesto total**: tres modelos con un
proveedor lento son tres timeouts seguidos —tres minutos— dentro de una ruta que
puede durar 300 s, así que nada los cortaba.

**LA CAUSA RAÍZ.** El acotado se pensó **por llamada** y el fallo de un proveedor
es **por temporada**. Un timeout protege a quien llama de una petición; no
protege al sistema de un proveedor que ya no está, ni al proveedor de nosotros.

**LA REGLA QUE LO HACE SEGURO.** Tras tres fallos seguidos **del proveedor** se
deja de llamar y se falla rápido. Pasado el enfriamiento se deja pasar **una
sola** llamada de prueba: si contesta se cierra el circuito; si no, se reabre con
el doble de espera, hasta un tope de cinco minutos — porque un proveedor caído
tampoco se abandona para siempre.

Y la cascada lleva **presupuesto de la operación entera**, no sólo por intento:
pasar a otro modelo tiene sentido una vez, no tres.

**LA PARTE QUE HAY QUE VIGILAR, Y NO ES LA OBVIA.** Sólo abren el circuito los
fallos que dicen «el proveedor no está» (5xx y tiempo agotado). **Una llave
revocada NO lo abre**, y eso no es afinación: si lo abriera, **un consultorio con
su llave mal escrita dejaría sin IA a todos los demás**.

Un interruptor mal condicionado no mueve datos de un consultorio a otro: **mueve
la caída**. Es una fuga de aislamiento que ninguna revisión de permisos
encuentra, porque los permisos están bien. Por el mismo motivo la llave forma
parte de la **clave** del circuito: el de la plataforma es uno, y el de cada
consultorio es suyo.

Tampoco abren el circuito el saldo (402), el límite de tasa (429) —que además
contesta rápido, así que no habría nada que ahorrar— ni un modelo inexistente
(400/404), que dice que el proveedor está perfectamente.

Un detalle que se decidió a propósito: **una prueba que se topa con un 401 no
cierra el circuito**. No se ha aprendido nada sobre si el proveedor volvió, y
cerrar ahí soltaría la avalancha por un error que no desmiente la caída.

**LA PRUEBA.** `src/__tests__/un-proveedor-caido-no-se-reintenta-mil-veces.test.ts`
(22 casos). El núcleo es puro —`decidir` y `siguienteEstado` no tocan reloj ni
red— así que el ciclo completo (cae → abre → enfría → prueba → vuelve) se
ejercita sin esperar de verdad. Probado al revés haciendo que `esFalloDelProveedor`
devuelva `true` para todo: caen 2 casos, y el primero es exactamente el que
protege a los demás consultorios.

**QUÉ NO CUBRE, DECLARADO.**

- **No es un interruptor global.** El estado vive en memoria del proceso, así que
  en un despliegue sin servidor **cada instancia caliente tiene el suyo**: la
  primera llamada de cada instancia paga su timeout. Sirve —cada instancia deja
  de castigar al proveedor y de hacer esperar a su médico— pero no garantiza que
  ninguna lo intente. Hacerlo global exigiría una lectura compartida por llamada,
  un coste fijo en el camino de una nota clínica para arreglar un caso raro. Se
  escribe en el módulo porque **un interruptor del que se cree que es global, y
  no lo es, hace tomar decisiones equivocadas sobre las alertas**.
- **No prueba la red.** No hay `fetch` real: se ejercita la máquina de estados y
  la clave del circuito, que es donde vive la decisión.
- **No cubre WhatsApp ni Evidence.** Sus llamadas tienen timeout (REG-346) y el
  outbox tiene backoff (`whatsapp/reintentos.ts`), pero **no pasan por esta
  puerta** y siguen sin interruptor. Queda abierto y con nombre.
- **No mide el ahorro.** Que se llama menos está probado; cuánto se ahorra en
  GB-segundo, no.
- **No hay cola ni contrapresión ni dead-letter** para las llamadas de IA. El
  interruptor evita la avalancha; no encola lo que no se pudo hacer. Sigue
  abierto en WS-04.

## REG-354 — el repositorio no sabía si sus reglas rigen en producción

**DE DÓNDE VIENE.** Reconciliando P1-2 del tablero de Ausculta. La declaración
en los tres sitios la cerró REG-340 y el respaldo REG-343 — y las dos anotaron lo
mismo al margen: «las reglas no se despliegan aquí; `members` sigue roto en
producción hasta que el dueño las publique». Esa nota llevaba meses viajando de
un documento a otro sin que nada la vigilara.
`docs/roadmap/nexus-os/estado.json` la tenía anotada desde E0-06.

**QUÉ FALLABA.** `firestore.rules` vive en el repositorio, se revisa en cada PR y
se prueba contra el emulador. Y **`vercel --prod` no lo publica**: el despliegue
es otro comando y otra autorización. Entre las dos cosas hay un hueco donde caben
meses, y **nada lo detectaba**.

El repositorio queda diciendo una verdad —«esta colección está protegida así»—
que en producción no rige. La suite pasa, el emulador pasa, el PR se ve bien, y la
protección no existe. Es la peor forma de un fallo de seguridad: **no es que
falte la regla, es que la regla está escrita y no se aplica**, así que todo el
mundo la da por buena leyéndola.

**LA CAUSA RAÍZ.** El estado del despliegue **se recordaba en prosa** en vez de
derivarse. Es el patrón `depende_de_recordar` aplicado a la infraestructura: el
dato existe —el contenido del archivo— y no había ningún registro que lo comparara
con lo que rige.

**LA REGLA QUE LO HACE SEGURO.** `firestore.rules.estado.json` guarda el sha256
de las reglas **confirmadas desplegadas**. Si no coincide con las de hoy,
`docs/ops/REGLAS-DE-FIRESTORE.md` tiene que decir **qué no rige y qué se rompe
mientras tanto** — y si no lo dice, el guardián falla.

Lo único que se pide a mano es lo que ninguna máquina puede saber (la
consecuencia), que es justo lo que hay que escribir. Un «falta desplegar X» no le
sirve a nadie: lo que decide si esto es urgente es qué está roto entre tanto.

Y el archivo dice, con todas las letras, que **el hash no se actualiza para poner
una prueba en verde**. Un registro de despliegue que se edita para pasar el CI
deja de ser un registro; que lo diga el archivo es lo que hace pensar dos veces.

**LO QUE HOY ESTÁ PENDIENTE, POR FIN EN UN SITIO.** `members` (el apodo del chat
no se guarda nunca y el código cae con elegancia al nombre por omisión: un defecto
escondido detrás de su propio respaldo), el bloque `clinico` de E0-06 —inocuo hoy
porque no hay datos ahí, y por eso mismo hay que desplegarlo **antes** de que los
haya— y los `match` nuevos de REG-340.

**LA PRUEBA.** `src/__tests__/las-reglas-escritas-no-son-las-que-rigen.test.ts`
(7 casos). Probado al revés borrando la tabla de pendientes del documento: cae el
caso que importa. Un caso extra vigila el cedazo mismo, porque así es exactamente
como desaparecen estas listas.

**QUÉ NO CUBRE, DECLARADO.**

- **No comprueba producción.** No hay forma de preguntarle a Firebase desde aquí
  qué reglas rigen: el hash dice lo que **alguien confirmó** haber desplegado. Si
  se actualiza sin desplegar, miente.
- **No valida las reglas.** Que existan y estén desplegadas no dice que sean
  correctas: eso es la suite del emulador.
- **No cubre los índices**, que son otro despliegue y otra autorización
  (`docs/ops/INDICES-DE-FIRESTORE.md`, REG-352). Conviene pedir las dos juntas.
- **No puede impedir el hueco**, sólo hacerlo visible. Desplegar sigue siendo una
  acción del dueño: `BLOCKED_EXTERNAL`, ahora con lista.

## REG-355 — quedaban escritores de scroll que no preguntaban

**DE DÓNDE VIENE.** REG-342 cerró dos mecanismos del rebote de iPhone —el riel
que llamaba a `scrollIntoView` y la barra sticky que salía del flujo— y dejó
escrito lo que faltaba. Es P1-13 del tablero.

**QUÉ FALLABA.**

1. **El restaurador de `/consulta` escribía `scrollTop` sin preguntar.** Y no es
   una restauración que ocurra sólo al montar: su clave depende de
   `internamientoActivo`, que llega de un `.then()` de Firestore, así que el
   efecto **se re-arma** y puede escribir la posición **segundos después**, con
   el médico ya leyendo.
2. **`overscroll-behavior` no aparecía en ninguna parte del repositorio.**

**POR QUÉ ES DE IPHONE Y NO DE ANDROID.** Dos cosas de WebKit, y hacen falta las
dos:

- **`overflow-anchor`**, que Chrome y Firefox implementan, compensa solo el
  contenido insertado por encima del punto de lectura. WebKit **no lo
  implementa**, así que ahí cualquier escritura tardía de scroll se siente. No se
  arregla desde el CSS: se compensa **no escribiendo**.
- **El encadenamiento de scroll.** Cuando un contenedor llega a su tope, el gesto
  se encadena al ancestro; en WebKit eso es el rebote elástico del documento y,
  con el shell a `100dvh; overflow:hidden`, se siente como un tirón. Basta con
  seguir arrastrando dentro de la nota después del final.

**LA CAUSA RAÍZ.** La regla correcta **existía y vivía dentro de un
componente**. `VolverALaFuente` escuchaba `wheel`, `touchstart` y las teclas de
navegación y se apartaba en cuanto llegaba una. Los demás escritores no lo
hacían, y nada los obligaba: **la disciplina no era del sistema, era de un
archivo**.

**LA REGLA QUE LO HACE SEGURO.** *Después del primer gesto manual, el usuario
manda* — sacada a `src/lib/ui/el-dedo-manda.ts` para que los escritores obedezcan
la misma regla y no cuatro parecidas. Y se pregunta **justo antes de escribir**,
no sólo al armarse: entre una cosa y otra hay dos `requestAnimationFrame` y una
lectura de red.

Un clic **no** es un gesto de desplazamiento, y eso está probado a propósito: el
médico pulsa cosas todo el rato sin querer mover la pantalla, y cancelar con eso
rompería las restauraciones legítimas —«volver donde ibas»— para arreglar un
tirón que ese clic no iba a causar.

En CSS, `overscroll-behavior-y: contain` en `<main>` y en el riel corta la
cadena sin quitarle al usuario el rebote **dentro** de su contenedor (que es la
señal táctil de «aquí se acabó»); `none` en el shell, que no scrollea, quita el
rebote del documento entero.

**LA PRUEBA.** `src/__tests__/el-dedo-manda-sobre-el-scroll.test.ts` (15 casos).
Despacha eventos de verdad contra un elemento doble, así que prueba el
**comportamiento** —qué cuenta como gesto y qué no— y no una cadena de texto.
Probado al revés quitando la pregunta del restaurador y añadiendo `click` a la
lista de gestos: caen 2 casos, uno por cada defecto.

`consultorio-scroll-focus-estable.test.ts` comprobaba por substring las quince
líneas en línea que se mudaron al módulo. Sus aserciones se reapuntan a lo que le
toca a ese componente —que use el módulo, que al cancelar consuma el contrato— y
el comportamiento pasa a probarse donde se puede ejecutar. Es un cambio a más
fuerte, no a más laxo.

**QUÉ NO CUBRE, DECLARADO — Y ES LO IMPORTANTE.**

- **NO SE HA VISTO EN UN IPHONE.** En este entorno sólo hay Chromium. Esto es la
  corrección razonada de dos mecanismos conocidos, **no una observación**. La
  verificación —WebKit, 390 px, diez repeticiones, `scrollTop` que nunca baje
  solo— sigue `BLOCKED_EXTERNAL`, y por eso WS-05 **no pasa a `PROVEN`**. El CSS
  lleva escrito dentro que no está verificado, y hay un caso que lo comprueba:
  si alguien borra esa advertencia, la prueba falla.
- **No renderiza ni mide píxeles.**
- **No cubre el tercer mecanismo**: los banners asíncronos que cambian la altura
  por encima de `<main>` (41 px medidos por `PorQueEstaAqui`). Arreglarlo bien es
  sacarlos del flujo, un cambio de layout del panel que no se hace a ciegas sin
  navegador. Queda abierto y con nombre.

## REG-356 — la evidencia de la consulta no decía dónde NO había mirado

**QUÉ FALLABA.** `/api/expediente/evidencia` —la ruta que el médico usa **con el
paciente enfrente**— consulta **sólo PubMed**, y su respuesta nunca lo decía. El
médico veía artículos y razonamiento sin forma de saber que UpToDate, Cochrane,
las guías y todo lo demás **ni se miraron**.

Un consultor que sólo enseña lo que SÍ encontró se lee como si hubiera mirado en
todas partes. Con el paciente delante, eso convierte «no lo miramos» en «no
existe» — que es la conclusión contraria a la que este módulo existe para dar.
Regla 4 de seguridad clínica.

**DE DÓNDE VIENE, Y UNA CORRECCIÓN QUE YA ESTABA ESCRITA.** Es P1-9 del tablero,
que lo dejó con estas palabras: «en esta pantalla el médico no puede leer
*UpToDate: no se consultó*». Una auditoría anterior había acusado a esta misma
ruta de esconder los fallos en un `.catch(() => [])`; **eso era falso** y quedó
anotado en su día: hay un `testigo` mutable que se marca antes de que el `catch`
lo alcance, y la ruta sí distingue «no se pudo preguntar» de «no hay
literatura». Lo que de verdad faltaba era esto.

**LA CAUSA RAÍZ.** **La maquinaria existía, estaba probada, y esta ruta no la
tenía cableada.** `planDeConsulta` decide quién se consulta y quién sólo se
declara; los adaptadores no operativos producen su sobre `not_configured` **sin
salir a la red** —`adaptadorNoConfigurado` ni siquiera conoce una URL— y
`comoSeLeDiceAlMedico` lo convierte en una frase. `/api/consultor-evidencia` lo
usa desde REG-345. Ésta no. Familia «escrito, probado y sin conectar»: no faltaba
el dato ni la regla, faltaba el cable.

**LA REGLA QUE LO HACE SEGURO.** Se declara con la **misma lista de proveedores**
que usa el consultor (`FABRICAS`, ahora exportada), no con una copia: dos censos
divergen, y el día que uno gane un adaptador el otro se queda mintiendo por
omisión.

Y se declara también **lo operativo que no se consultó**: que un adaptador
funcione no significa que se haya usado, y callar eso sería la misma mentira por
otro camino. Es la mitad que el arreglo obvio se habría dejado.

Se declara en **los dos caminos de salida** de la ruta —el del análisis completo
y el del razonamiento fallido—. Uno solo dejaría media ruta muda, que es
exactamente cómo este defecto sobrevivió al arreglo de REG-345 en la otra ruta.

**Y LA PANTALLA LO PINTA**, arriba y junto al análisis, no enterrado al final:
leer la conclusión antes de saber dónde no se miró es leerla mal. Un caso del
golden comprueba ese orden. Sin esto sería REG-345 otra vez — avisos calculados,
probados, que viajan por el cable y nadie pinta.

**LA PRUEBA.** `src/__tests__/el-consultor-dice-donde-no-miro.test.ts` (11
casos). Ejecuta la declaración de verdad. Probado al revés dejando que sólo se
declaren los NO operativos: caen 2 casos, incluido el que exige que el censo sea
el mismo.

**QUÉ NO CUBRE, DECLARADO.**

- **No añade ni una fuente.** Sólo arregla el silencio. Consultar UpToDate,
  Cochrane o Scopus exige licencias que no existen (WS-08) y los adaptadores
  están deliberadamente inertes: `READY_BUT_NOT_LICENSED`.
- **No renderiza.** Que el bloque exista en el árbol no prueba que se vea.
- **No arregla la procedencia estructurada de #314.** La otra mitad de P1-9 —que
  esta ruta produzca `Source` con procedencia en vez de artículos sueltos— sigue
  abierta y con nombre.
- **No verifica citas.** `mapaDeSoporte`, `esRespuestaRespaldada` y
  `tasaSinRespaldo` siguen sin llamadores fuera de pruebas: un `[2]` que apunte a
  un artículo que dice lo contrario sigue pasando. Es otro requisito de WS-06/07.

## REG-357 — se reproducía texto completo de PMC sin leer su licencia

**QUÉ FALLABA.** `textoCompletoPMC` bajaba el XML de PMC y reproducía hasta
1 600 caracteres del artículo **sin mirar bajo qué licencia está**. El comentario
de la función decía «solo artículos de ACCESO ABIERTO — legal».

Es una media verdad, y es la peligrosa. El subconjunto Open Access de PMC
**mezcla licencias**: ahí conviven CC0 y CC-BY —que permiten reproducir— con
CC-BY-NC-ND y con «OA no comercial» a secas, que no. **«Acceso abierto» dice que
se puede LEER. No dice que se pueda COPIAR dentro de un producto de pago**, que
es exactamente lo que hace este código.

**CÓMO SE DESCUBRIÓ.** Estaba diagnosticado y sin arreglar **dentro del propio
repositorio**: `catalogo.ts` decía «RIESGO REAL: el subconjunto OA mezcla
licencias. Hay que leer la licencia POR ARTÍCULO antes de reproducir texto
completo», con la decisión marcada como pendiente. Es P1-10 del tablero.

**LA CAUSA RAÍZ.** Se confundió **disponibilidad** con **permiso**. Que el NIH te
deje descargar el XML no dice nada de lo que puedes hacer con él — y el nombre
del conjunto («Open Access») invita justo a esa confusión.

**LA REGLA QUE LO HACE SEGURO.** **Fallar cerrado.** Se reproduce sólo cuando la
licencia lo autoriza por escrito en el XML; ante una desconocida, ausente o
ambigua, no se reproduce. Al revés no funciona: una lista de licencias
PROHIBIDAS deja pasar todo lo que nadie previó, y ese error se descubre cuando
llega la carta.

La lista permisiva es de **identificadores exactos** y no de prefijos, y eso es
la trampa concreta: `cc-by-nc-nd` empieza por `cc-by`. Un `startsWith` habría
dado permiso justo a la licencia más restrictiva del conjunto. Hay un caso del
golden dedicado a eso.

Se mira el bloque de permisos entero —`<ali:license_ref>`, el atributo y la prosa
del `<license-p>`— porque PMC declara la licencia de tres formas distintas según
la editorial y la antigüedad del depósito. Y **«non-commercial» en prosa cuenta
como que no**, aunque no haya identificador: un artículo que dice «for
non-commercial use» está diciendo que no, y no reconocer su forma de decirlo no
lo convierte en permiso.

La puerta va **antes de extraer un solo párrafo**. Extraer y luego decidir
dejaría el texto en memoria y a un `return` de distancia de acabar en un prompt.

**NO SE PIERDE NADA CLÍNICO.** Sin texto completo se usa el resumen — que es
exactamente lo que ya pasaba con los artículos de pago. El médico sigue viendo el
artículo, su revista y su año.

**LA DECISIÓN QUE ESTO NO TOMA.** Qué subconjunto exacto es reproducible sigue
siendo **decisión del dueño**. Esto implementa la única postura defendible
mientras no exista, y el catálogo lo declara así: ampliarla —admitir CC-BY-SA,
por ejemplo— es suya, no un ajuste técnico.

**LA PRUEBA.**
`src/__tests__/el-texto-completo-solo-si-la-licencia-lo-permite.test.ts` (16
casos) sobre XML sintético con las formas reales en que PMC declara la licencia.
Probado al revés con las dos versiones equivocadas plausibles —comprobar por
prefijo, y dar por bueno `license-type="open-access"`—: caen 5 casos.

**QUÉ NO CUBRE, DECLARADO.**

- **No prueba la red.** No se llama a NCBI.
- **No cubre otras fuentes.** Sólo PMC. openFDA, ClinicalTrials y el resto tienen
  sus propias condiciones y su propia fila en el catálogo.
- **No audita lo ya reproducido.** Si el texto de un artículo restrictivo quedó
  dentro de una nota antes de esto, este cambio **no lo retira**: no hay registro
  de qué se reprodujo ni de qué artículo salió. Queda dicho, porque es lo que un
  reclamo preguntaría primero.

## REG-358 — un duplicado con los nombres al revés no aparecía

**DE DÓNDE VIENE.** REG-347 llevó la búsqueda de pacientes al servidor y dejó
escrito su límite: la búsqueda es por **PREFIJO**, así que «un duplicado con el
orden de los nombres cambiado —*López María* frente a *María López*— y **sin
teléfono en común** no aparece». Es P1-17 del tablero.

**QUÉ FALLABA.** Firestore no tiene «contiene». Con el texto completo como una
sola cadena, teclear «María López» sólo encuentra a quien está guardado
**empezando** por «María López». En México el mismo expediente se captura tan a
menudo como «López María» que ese hueco no es un caso raro: es la mitad de los
casos.

**LAS DOS CONSECUENCIAS, Y LA SEGUNDA ES LA CARA.**

- El buscador dice «no está» de alguien que sí está.
- El aviso **antiduplicado no salta**, así que se abre un segundo expediente y la
  historia del paciente queda partida en dos: la mitad de sus alergias,
  diagnósticos y medicación bajo un registro y la otra mitad bajo otro. Nadie ve
  el error — se ve como un paciente nuevo.

**LA CAUSA RAÍZ.** Se buscaba por el **texto completo** como una sola cadena. Un
nombre no es una cadena: es un conjunto de palabras cuyo orden de captura no está
garantizado por nada.

**LA REGLA QUE LO HACE SEGURO.** Se sondea además por cada **palabra** del
nombre. No convierte el prefijo en «contiene», pero cierra el caso que de verdad
ocurre — y lo hace con consultas indexadas del **mismo campo y la misma forma**,
así que **no necesita ningún índice compuesto**. Eso importa: los índices se
crean fuera de este repositorio (REG-352) y una consulta que necesitara uno
fallaría entera en producción.

Dos números que el golden decidió, no la intuición:

- **Tres palabras, no dos.** Con dos se perdía el caso más común —un nombre
  mexicano típico es «Nombre Apellido1 Apellido2», y el apellido con el que otro
  capturista empezó el expediente puede ser cualquiera de los tres—. La prueba
  del antiduplicado lo cazó.
- **Ventana corta (25) para estos sondeos.** Son una red de seguridad, no el
  camino principal: un apellido común como «López» llenaría la ventana grande con
  gente que no tiene nada que ver, y multiplicado por tres palabras convertiría
  cada tecleo en una lectura cara.

**UN CASO QUE PASABA POR EL MOTIVO EQUIVOCADO.** La primera versión del caso de
antiduplicado le daba a los dos expedientes **el mismo teléfono**, así que lo
encontraba el sondeo telefónico y la prueba habría pasado con el defecto vivo —
justo el hueco que P1-17 describe («y **sin teléfono en común** no aparece»). Se
corrigió a teléfonos distintos antes de dar nada por bueno.

**LA PRUEBA.**
`src/__tests__/el-orden-de-los-nombres-no-decide-si-existes.test.ts` (13 casos),
contra el arnés que **cuenta documentos leídos**. Probado al revés quitando los
sondeos por palabra: caen 3.

**QUÉ NO CUBRE, DECLARADO.**

- **Sigue sin ser «contiene».** Un expediente que empieza por una palabra más
  allá de las tres sondeadas no se encuentra, y hay un caso que lo prueba en vez
  de suponerlo. Cerrarlo de verdad exige un **índice invertido de tokens**: un
  campo derivado que hay que escribir en cada alta y en cada edición, con
  retroactivo sobre lo existente. Es un cambio de modelo de datos, no un ajuste
  de consulta.
- **No normaliza acentos.** «Lopez» no encuentra a «López». Mismo campo derivado,
  misma decisión pendiente. Probado, no supuesto.
- **No prueba Firestore.** El doble implementa la semántica de prefijo que este
  código usa; no dice nada de índices desplegados ni de reglas.

## REG-359 — se comprobaba que la cita estuviera en rango, no que dijera eso

**QUÉ FALLABA.** La ruta de evidencia de la consulta pedía al modelo afirmaciones
con `citas: [n]` y comprobaba **una sola cosa**: que `n` estuviera dentro del
rango de artículos.

Es decir: **un `[2]` que apunte a un artículo que dice lo contrario pasaba**. Y
pasaba con la peor apariencia posible — una afirmación clínica con su número de
cita al lado, que es exactamente el formato que un médico lee como «esto está
respaldado por la literatura».

**CÓMO SE DESCUBRIÓ.** El tablero lo tenía escrito desde la auditoría de
WS-06/07: «la verificación de citas está construida, probada y **nunca se
llama**; `mapaDeSoporte`, `esRespuestaRespaldada` y `tasaSinRespaldo` tienen cero
llamadores fuera de pruebas». Se abrió como P1-19 al cerrar P1-9.

**LA CAUSA RAÍZ — dos cosas, y la segunda explica por qué nadie lo enchufó.**

1. **El verificador no tenía llamador.** Familia «escrito, probado y sin
   conectar». Su propio encabezado decía que se había escrito reutilizando la
   forma de esta ruta «para que enchufarlo no exija cambiarle el prompt».
2. **Y aun así había que cambiar el prompt.** `claimDesde` exige el **pasaje
   literal**: el trozo de texto del artículo que respalda la frase. El modelo
   devolvía sólo el número. Sin el pasaje no hay nada que verificar — sólo un
   número que está en rango. Quien escribió el verificador creyó que enchufarlo
   era gratis, y esa creencia es la razón de que llevara meses sin enchufar.

**LA REGLA QUE LO HACE SEGURO.** Se le pide al modelo la **frase literal** que
respalda cada afirmación, y se ancla **carácter a carácter** contra el texto que
se le enseñó.

Pedirlo no es sólo para poder comprobar: **obligarle a copiar la frase que lo
respalda es la forma más barata que existe de que no invente el respaldo**. Y el
prompt le da la salida honesta explícitamente — si no tiene una frase literal,
que deje la cita vacía: *decirlo sin cita es honesto; citar algo que no lo dice,
no*.

Se ancla contra el **resumen** (más el texto completo de PMC cuando la licencia
lo permitió, REG-357), que es lo que el modelo vio. Anclar contra un texto que no
vio sería pedirle que cite lo que no leyó.

**QUÉ SE HACE CON LO NO RESPALDADO, Y POR QUÉ NO SE BORRA.** No se borra. Puede
seguir siendo buen razonamiento clínico —consenso, fisiopatología, experiencia— y
borrarlo le quitaría al médico algo que quizá necesita. Lo que no puede es seguir
**pareciendo** respaldado: se le **quita el `[n]`** y se marca «sin respaldo
comprobado en el artículo citado». Dejar el número al lado sería seguir
enseñándola como evidencia citada, que es el defecto entero.

El médico decide. La IA sugiere, el médico confirma.

**LA PRUEBA.** `src/__tests__/una-cita-que-no-dice-eso-ya-no-pasa.test.ts` (14
casos), con artículos y afirmaciones sintéticas. Probado al revés devolviendo la
comprobación de rango: **caen 5 casos**, incluido el que le da nombre.

**QUÉ NO CUBRE, DECLARADO — y el primero es importante.**

- **Anclar no es entender.** Que la frase esté literalmente en el resumen no
  prueba que respalde la afirmación: un pasaje puede citarse fuera de contexto, o
  decir lo contrario en la frase siguiente. Esto cierra **la invención del
  respaldo**, no la interpretación — y por eso el aviso dice «no se pudo
  comprobar», no «es falso». Convertirlo en un juicio sobre la verdad de la
  afirmación exigiría entailment, que es otro requisito (WS-12).
- **«No se pudo verificar» no es «no está respaldada».** Sin artículos anclables
  no se emite juicio sobre el análisis, y hay casos que lo prueban.
- **No prueba la red ni el modelo.** Que el modelo obedezca y copie pasajes
  literales no está medido contra un modelo real: se prueba qué hace el sistema
  con lo que devuelva, incluido el caso de que no los mande.
- **No renderiza.** Que la marca exista en el árbol no prueba que se vea.
- **No cubre las otras rutas de IA.** El consultor tiene su propio camino; esta
  verificación es de la ruta de la consulta.

## REG-360 — «cerrar» era un solo acto que abarcaba tres

**DE DÓNDE VIENE.** WS-11 del tablero de Ausculta, §9 del master loop. No es un
defecto reportado: es un hueco que el propio código tenía **diagnosticado y
declarado**, y que nadie había cerrado.

**QUÉ FALTABA.** El §9 pide ocho etapas para un resultado: RESULT → SIGNIFICANCE
→ OWNER → REVIEW → **DECISION → ACTION → PATIENT COMMUNICATION** → CLOSED.
`TareaClinica` tenía dato real para cinco. Las tres del cierre **no tenían campo
propio**: «cerrar» era el único acto y las abarcaba las tres de golpe.

Consecuencia concreta: un resultado crítico revisado y cerrado **sin que nadie
llamara al paciente** se veía exactamente igual que uno donde sí se llamó.

**LO QUE EL CÓDIGO YA HACÍA BIEN.** `progreso-resultado.ts` **se negaba a
inventarlo**: devolvía las tres `sin_dato` siempre, cerrada o no, y lo declaraba
en su encabezado como hallazgo estructural. Esa negativa era correcta y el
arreglo **no podía consistir en darlas por hechas al cerrar** — hay casos del
golden que lo vigilan, porque es la forma más fácil de «cerrar» este requisito
mintiendo.

**LA REGLA QUE LO HACE SEGURO.** Las tres etapas tienen dónde vivir
(`TareaClinica.cierre`), y **nada se deduce del estado**: cerrada sin registrar
el aviso sigue diciendo `sin_dato`.

Es la regla 5 de seguridad clínica con una consecuencia muy concreta: **si el
sistema afirmara que se avisó, nadie volvería a mirar; si afirmara que no,
alguien lo arreglaría.** La única respuesta honesta a «no lo sé» es no lo sé. Por
eso `avisoRegistrado` devuelve `null` —no `'no_avisado'`— cuando no consta, y por
eso el cálculo de etapas pregunta por ahí en vez de leer el campo: esa distinción
decide si alguien llama a un paciente y no puede vivir en dos sitios con la
posibilidad de divergir.

**LAS DOS ASIMETRÍAS, Y POR QUÉ NO SON CAPRICHO.**

- **La decisión es obligatoria; el aviso no.** Cerrar sin decir qué se decidió es
  cerrar sin cerrar. Pero exigir además el aviso convertiría cada cierre en un
  formulario de tres campos, y **un worklist que cuesta se abandona en una
  semana** — y entonces deja de verse el resultado que sí importaba, que es peor
  que no tener el campo. Es el mismo razonamiento con el que `modelo.ts` ya se
  negaba a crear tareas de `indicacion_paciente` en cada consulta.
- **`no_aplica` cuenta como registrado.** Alguien miró y decidió que no había que
  avisar: eso es un dato. Tratarlo como hueco castigaría la respuesta honesta y
  empujaría a marcar «avisado» por comodidad.

**Y EL REGISTRO DE TRANSICIONES.** Sin él, «cerrada» no dice cuándo se aceptó,
quién la tuvo ni si se reabrió por el camino. Acotado a las últimas 50: una tarea
reabierta muchas veces no puede hacer crecer su documento sin techo — el patrón
que REG-350 cerró en las notas, aplicado **antes** de que duela.

**UN HALLAZGO DEL PROPIO TRINQUETE, DURANTE ESTA UNIDAD.** El guardián de
«motores escritos y sin conectar» subió de 38 a 39 y señaló a `avisoRegistrado`:
una función exportada **sin llamador en producción**. Era verdad. Se resolvió
conectándola —`progresoResultado` pregunta por ahí— en vez de subir el techo. El
trinquete cazó en su propia casa el defecto que existe para cazar.

**LA PRUEBA.** `src/__tests__/cerrar-no-es-avisarle-al-paciente.test.ts` (13
casos) más los casos reescritos de `progreso-resultado.test.ts` y del guardián
RTC-17. Probado al revés con las dos formas equivocadas de «cerrar» esto: deducir
las etapas de `estado === 'cerrada'`, y dejar de exigir la decisión. **Caen 5.**

**QUÉ NO CUBRE, DECLARADO.**

- **Ninguna pantalla lo llena todavía.** Esto abre el modelo, el escritor y el
  cálculo de etapas; el formulario de cierre que pida decisión, acción y aviso es
  la siguiente unidad. Hasta entonces las tres seguirán saliendo `sin_dato` en
  producción — que es **la verdad**, no un defecto.
- **No cubre interconsultas, referencias ni imagen.** Siguen fuera del ciclo:
  `Interconsulta` es un array embebido con dos estados y sin dueño; la referencia
  de consultorio es sólo un impreso; imagen no tiene entidad. **WS-11 sigue
  abierto** y este cambio no lo cierra.
- **Las transiciones antiguas se pierden** al pasar de 50. Se conservan las
  últimas porque lo reciente es lo que se audita; quien necesite el historial
  completo tiene la bitácora NOM-004, que es append-only y sí se respalda.

## REG-361 — los campos del cierre existían y ninguna pantalla los llenaba

**DE DÓNDE VIENE.** REG-360 le dio campo a las tres etapas del §9 que faltaban
—DECISION, ACTION y PATIENT COMMUNICATION— y lo dejó escrito en su propio «qué no
cubre»: *ninguna pantalla lo llena todavía*.

Eso es la familia «escrito, probado y sin conectar» **a un paso de ocurrir**, y
este repositorio tiene un ledger entero explicando cómo termina: el campo se queda
vacío, alguien lo da por hecho al leer el tipo, y meses después alguien descubre
que el dato nunca llegó. Se cierra en la unidad siguiente, no «cuando haya
tiempo».

**QUÉ FALLABA, EN LO QUE EL MÉDICO VE.** El botón «Lo revisé — cerrar» avanzaba el
estado y ya. Un resultado crítico revisado y cerrado **sin que nadie llamara al
paciente** quedaba idéntico a uno donde sí se llamó.

**LA REGLA QUE LO HACE SEGURO.** Cerrar pasa por un formulario, y **cerrar y
avanzar de estado dejan de ser el mismo gesto**: el botón de cierre abre el
formulario, los demás avanzan directo. Fundirlos habría dejado cerrar sin
decidir, que es el fallo entero — el mismo razonamiento por el que «ya se hizo» y
«lo revisé» ya eran dos botones distintos en esta pantalla.

- La **decisión** es obligatoria: el botón está deshabilitado sin ella.
- La **acción** y el **aviso** no lo son: un worklist que cuesta se abandona en
  una semana, y entonces deja de verse el resultado que sí importaba.
- Lo que no se marca **no se manda**, y el formulario lo dice con esas palabras:
  «no consta» no es «no se hizo». Mandar `'no_avisado'` por omisión convertiría
  «no lo marqué» en un hecho clínico, y del lado que hace que nadie llame.

El **autor y el instante los pone el servidor**, no el formulario: un cierre
firmado por quien lo teclea no se puede auditar.

**LA PRUEBA.** `src/__tests__/el-cierre-se-llena-no-se-adivina.test.ts` (11
casos). Probado al revés con las dos formas equivocadas de «cerrar» esto: mandar
un valor por omisión en el aviso, y volver a fundir cerrar con avanzar de estado.
**Caen 2**, uno por defecto.

**QUÉ NO CUBRE, DECLARADO.**

- **No renderiza.** Lee la fuente de la pantalla: comprueba que el camino y las
  palabras existan, no que se vean.
- **No cubre el cierre desde otras pantallas.** Hoy sólo `/pendientes` cierra
  tareas; si mañana lo hace otra, este golden no la ve — que es exactamente el
  patrón de REG-501 y REG-356, así que queda dicho en vez de descubrirse.
- **Interconsultas, referencias e imagen siguen fuera del ciclo.** WS-11 no se
  cierra con esto.

## REG-362 — la única regla del repositorio que no se podía correr

**QUÉ FALTABA.** `.claude/rules/patient-facing-ai.md` §7 dice, literal: *«Las doce
del §0 de V9 son **fixture permanente** en `evals/patient-ai/`. No son ejemplos:
son la puerta. Un cambio en la IA del paciente que no las corra no está
terminado.»*

**`evals/patient-ai/` no existía.** La regla llevaba escrita desde que se abrió V9
y era la única del repositorio que **no se podía ejecutar**.

Una compuerta que no existe no falla nunca, y una que no falla nunca no es una
compuerta. Y lo peor no es la cobertura que faltaba: es que se podía cambiar la IA
de cara al paciente y **decir con toda honestidad que se pasaron todas las
compuertas**.

**LA PUERTA PRUEBA EL SERVIDOR, NO UN PROMPT.** La misma regla, §3: *«Si una ruta
lo permite y sólo el prompt lo impide, está mal construida.»* Los casos se corren
contra los módulos deterministas. Una compuerta que dependiera de que el modelo se
porte bien mediría el humor del modelo y saldría distinta cada vez.

**LA ASIMETRÍA, VIGILADA EN LAS DOS DIRECCIONES.** Es fácil escribir un
clasificador que escale TODO y presumir de que no se le escapa una urgencia. Ése
es **peor** que el que no escala: contestar el 911 a «agéndame para mañana» rompe
el canal y —lo que de verdad cuesta— **le enseña al paciente a ignorar el aviso el
día que sea de verdad**. Por eso la mitad de los casos comprueban que algo **no**
escale, y hay un caso que exige que haya al menos tantos de ésos como urgencias:
un fixture de sólo urgencias se pasaría devolviendo siempre
`URGENT_REVIEW_REQUIRED`.

**Y LA PUERTA ENCONTRÓ UN DEFECTO LA PRIMERA VEZ QUE SE PUDO CORRER.**

La regla de ingesta accidental sólo cubría la **tercera persona** (`se tomó`, `se
tragó`). Nació pensando en «mi hijo se tomó mis pastillas», y con eso se quedaba
fuera **una de las doce preguntas del §0**: *«me tomé por accidente la medicina de
otra persona»*.

No es un caso raro: es la mitad de las veces que esto pasa — el adulto que se
equivoca de frasco por la mañana. Un mensaje así **no escalaba**.

Ese defecto llevaba ahí desde que se escribió la regla de urgencias, con la suite
en verde, porque la única prueba que lo habría cazado era la que la regla exigía y
nadie había construido.

**LA PRUEBA.** `src/__tests__/las-doce-preguntas-del-paciente.test.ts` (28 casos)
sobre `evals/patient-ai/casos.json` (18 casos: las doce de V9 más seis del equipo
rojo). Probado al revés devolviendo la regla a la tercera persona: cae el caso
v9-08.

**QUÉ NO CUBRE, DECLARADO — y esto es lo importante.**

- **No prueba lo que el modelo redacta.** Prueba lo que el sistema hace **antes**
  de dejarle redactar. Evaluar la redacción, el tono y la comprensión es WS-12 y
  sigue abierto.
- **No cubre las cinco clases de respuesta.** Hoy el código implementa de verdad
  `URGENT_REVIEW_REQUIRED`; las otras cuatro están en el tipo y **no tienen
  clasificador**. El golden lo **comprueba** y lo declara en vez de fingir
  cobertura — un caso verde sobre una clase sin implementación sería exactamente
  el verde falso que esta puerta existe para impedir. El día que alguien las
  implemente, ese caso le recordará que aquí hay sitio esperándolas.
- **No prueba las rutas del portal.** El alcance del token y el aislamiento tienen
  sus propias suites.
- **Cero PHI.** Todos los textos son sintéticos, como exige `data-privacy.md`.

---

## REG-363 — la alergia estaba sellada en las notas firmadas y nadie la volvía a leer

**QUÉ FALLABA.** Todas las alergias del producto salen de **un campo de texto
libre de `Patient`**, editable en línea en `/consulta` y en `/pacientes`, que la
última escritura **pisa entera**. De ese campo cuelgan las cuatro cosas que
importan: el cruce alergia↔fármaco que apaga *Firmar*, el recuadro rojo de la
receta impresa, el recurso FHIR y el sesgo del reconocedor.

Y **cada nota firmada sella una copia de esa lista** —`alergias: alergiasDe(patient)`,
`consulta/page.tsx`— así que el expediente sí guarda la alergia, dentro de
documentos inmutables, tantas veces como consultas hubo.

**Nadie la volvía a leer.** Medido sobre el árbol el 29-ago-2026: los veintitantos
llamadores de `alergiasDe` / `alergenosDe` / `alergiasParaImpreso` leen `patient`,
**ninguno mira el historial**; y `nota.alergias` sólo lo consumen `nom004.ts` (la
compuerta de *esa* nota), `integrity.ts` (su hash) y `procedencia.ts` (su
manifiesto) — **ninguno cruza notas**.

La secuencia completa, con datos del propio repositorio:

```
2024-03  nota firmada · alergias: [{ alergeno: 'Penicilina',
                                     severidad: 'anafilaxia',
                                     reaccion: 'edema de glotis' }]
2024-11  nota firmada · la misma alergia, sellada otra vez
2026-08  alguien vacía el campo — un import de CSV, una migración, un dedo en
         el móvil, o el médico que quiere que le deje firmar
2026-08  la pantalla dice «No registradas» · la receta imprime «Negadas / no
         referidas» · el cruce alergia↔fármaco NO salta con amoxicilina
```

Dos notas firmadas, inmutables, siguen diciendo «anafilaxia por penicilina», y el
producto entero se comporta como si nunca se hubieran escrito.

**CÓMO SE DESCUBRIÓ.** Recorriendo WS-10 (Patient State longitudinal). Existen
proyecciones longitudinales de **problemas activos** (`problemas-activos.ts`) y de
**medicación vigente** (`ordenes-medicamento.ts`), las dos recorriendo el
expediente entero con la regla dura correcta —el silencio no resuelve nada—. La
alergia, que es el dato más letal de la aplicación, **no tenía ninguna**.

El repositorio ya conocía este modo de fallo **por el otro extremo**: `logAudit`
registra `vaciado: true` al borrarse el campo (`firestore.ts:656`), y su
comentario dice *«sin el antes, un vaciado queda registrado como “se tocó el campo
alergias”, indistinguible de haberlas escrito… es exactamente lo que hizo
irreconstruible el dato en REG-323»*. Se había construido **la constancia** del
borrado y no **la recuperación**: nadie lee una bitácora de auditoría con el
paciente enfrente, y una alergia que hay que ir a buscar ahí es una alergia que no
llega.

**CAUSA RAÍZ.** El estado de alergias del paciente se leía de **un solo documento
mutable**, no del expediente. Familia `no_conectado`: el dato estaba escrito,
sellado y probado, y ningún camino del producto lo leía de vuelta.

**EL ARREGLO.** `src/lib/expediente/alergias-longitudinales.ts` —tercera
proyección longitudinal, módulo puro— con una regla **asimétrica a propósito**,
que NO es la de sus dos hermanas:

- **afirmar SUMA** — una alergia sellada en una nota firmada entra en el estado y
  no sale sola;
- **el silencio NO RESTA** — no estar en la lista de hoy no la retracta;
- **una negación de hoy tampoco borra: pone en CONFLICTO**, que es una pregunta
  para el médico, no una respuesta del sistema (regla 6 de seguridad clínica).

La asimetría es el corazón del arreglo. Los problemas y la medicación siguen
«manda la última palabra sobre cada entidad»; aquí eso sería un defecto, porque
**el sello no es una palabra: es una copia**. La nota no dice «ya no es alérgico»;
dice «el campo decía esto cuando firmé». Tratar una copia vacía como retractación
convertiría cualquier borrado accidental en una **decisión clínica retroactiva**.

Cableado en las dos pantallas que **ya** tienen las notas cargadas —`/consulta` y
`/expediente`—, así que cuesta **cero lecturas nuevas** a Firestore. En
`/consulta`, cada discrepancia se enseña con su procedencia (severidad, reacción y
**la fecha de la nota firmada que lo dice**) y con un botón que la devuelve a la
lista: acto del médico, visible, reversible y asentado en la bitácora con
`restauradaDeNotaFirmada`.

La proyección lleva `asOf` y `version` —el tablero anotaba que las dos que existían
no llevaban ninguno de los dos— y `historialIncompleto`, que viaja desde el
recorte de REG-350: sobre un historial recortado, «no encontré más» **no** es «no
hay más».

**LO QUE EL ARREGLO NO HACE, Y NO DEBE HACER.** No alimenta la compuerta que
bloquea la firma. Ésa sigue leyendo `alergiasDe(patient)` y sólo eso, y hay un
guardián que lo comprueba: si esta proyección la alimentara, una nota de 2024
pisaría una corrección que el médico hizo hoy a conciencia, y el producto tendría
**dos lecturas del mismo campo** — ADR-001, REG-034/035/171. Lo que hace es
**enseñar lo que la compuerta no está mirando**.

**UN DEFECTO QUE ENCONTRÓ LA PRUEBA, EN EL PROPIO ARREGLO.** La primera versión
del módulo guardaba **sólo el sello más reciente**. La nota de noviembre decía
«anafilaxia» a secas y la de marzo decía «anafilaxia, edema de glotis»: **«edema de
glotis» se perdía en silencio** — justo lo que distingue una anafilaxia de un
exantema. La salida fácil habría sido componer un registro con campos de dos notas
distintas, o sea **fabricar un registro que nadie escribió**, que es la otra mitad
del mismo error. Se guardan **todos** los sellos, enteros y por separado, y
`peorSeveridadRegistrada` / `reaccionRegistrada` eligen cuál enseñar devolviendo
**la fecha de la nota que lo dice**.

**LA PRUEBA.**
`src/__tests__/la-alergia-sellada-en-una-nota-firmada-no-desaparece.test.ts`
(25 casos). Probada al revés: el caso *«AL REVÉS — si el sello vacío retractara»*
reproduce la regla equivocada (la de problemas y medicación) sobre el mismo
historial y comprueba que produce el desenlace que este módulo existe para
impedir. El guardián de cableado se probó contra `pacientes/page.tsx`, que no
tiene el cableado: falla las tres aserciones.

**QUÉ NO CUBRE, DECLARADO.**

- **No persiste la proyección.** Se recalcula sobre las notas que la pantalla ya
  cargó. No hay documento, ni colección, ni respaldo, ni regla que declarar —
  y por eso tampoco hay `asOf` guardado en ninguna parte: el que devuelve es el
  del momento de la lectura. Persistirla es una decisión de arquitectura que
  arrastra los tres sitios de declaración de una colección; queda en WS-10.
- **No decide que la alergia sea real**, ni infiere severidad, ni agrupa familias
  de fármacos. La reactividad cruzada sigue en `nom004.ts`.
- **No resuelve el conflicto.** Una alergia sellada y negada hoy se queda
  visible y sin resolver hasta que el médico decida.
- **No arregla E0-06.** Las alergias siguen viviendo en `Patient`, legibles por
  recepción bajo `allow read: if isMember`. Eso es P1-6, `BLOCKED_EXTERNAL`:
  necesita backfill sobre datos clínicos vivos, decisión de política del dueño y
  despliegue de reglas.
- **No mira lo que un historial recortado dejó fuera.** Lo declara y la pantalla
  lo dice; no lo compensa.

---

## REG-364 — lo que el médico DESCARTÓ llegaba a los motores y al modelo como diagnóstico del paciente

**QUÉ FALLABA.** `problemasDelCuadro` (`cuadro-completo.ts`) une los diagnósticos
de HOY con los del expediente y produce **el cuadro completo** que ven el
copiloto clínico y la ruta de evidencia. La lista del expediente venía filtrada
por `problemasActivos`; **la de hoy entraba sin filtrar y aplanada a la
descripción**:

```ts
out.push({ descripcion: t, codigoCIE10: d.codigoCIE10, deHoy })
//                                                     ↑ y `tipo` se tiraba
```

El esquema de extracción produce los cuatro tipos (`extraction-schema.ts:40`:
`presuntivo | definitivo | diferencial | descartado`), así que **«embarazo
descartado»** —que es como se documenta una prueba negativa— y **«lupus,
descartado»** entraban al cuadro como diagnósticos del paciente.

**MEDIDO CON LOS MOTORES REALES, el 29-ago-2026:**

```
dx: [{ descripcion: 'Embarazo', tipo: 'descartado' }] · receta: Ibuprofeno

copiloto → detalle:    «La paciente cursa embarazo. Desde la semana 20 se
                        asocian a oligohidramnios…»
         → textoNota:  «Ibuprofeno debe evitarse en el embarazo; se comentó y
                        se valoró una alternativa.»
```

Ese `textoNota` es el texto que el médico puede **insertar en la nota firmada**:
un descarte convertido en afirmación dentro de un documento medicolegal.

Y por el otro camino, la ruta de evidencia construye con la misma lista sus
consultas de PubMed (`consultasDet.push([dx[0], …])`) y la línea que el modelo
lee como los diagnósticos del paciente (`DIAGNÓSTICOS: ${dx.join('; ')}`): la
búsqueda y el razonamiento salían **sobre una enfermedad que el médico había
descartado**. Con un `presuntivo`, peor de otra manera: el modelo no podía
distinguir «anemia» de «probable anemia».

**CÓMO SE DESCUBRIÓ.** Recorriendo WS-10 justo después de REG-363. El tablero
decía que a `Diagnostico` le falta `certeza`; buscando dónde dolía eso apareció
algo peor: **el campo `tipo` ya existe**, y tres lectores lo respetan —
`problemasActivos.estaVigente` (excluye descartado y diferencial),
`ResumenPaciente:37` (`if (d.estado === 'resuelto' || d.tipo === 'descartado') continue`)
y la exportación FHIR (`fhir-export.ts:230`, que mapea a `provisional`). El
cuarto lector —el único que alimenta a los motores y al modelo— lo tiraba.

**CAUSA RAÍZ.** Dos criterios para la misma pregunta. `estaVigente` estaba
escrito, exportado y probado, y esta puerta no lo llamaba. Familia «el sistema se
contradice a sí mismo»: el mismo repositorio filtra el descartado en tres sitios
y no en el que más consecuencias tiene.

**EL ARREGLO, en tres piezas y ninguna nueva:**

1. `problemasDelCuadro` llama a `estaVigente` **también sobre la lista de hoy**.
   El criterio no se reescribe: se usa el que ya existía.
2. `DiagnosticoDelCuadro` conserva `tipo`, y `nombreConCerteza`
   (`problemas-activos.ts`) es **una sola definición** de cómo se nombra un
   diagnóstico para otro lector — la usan la lista de `/consulta`, el resumen de
   `/expediente`, el cuadro de los motores y el prompt de evidencia. Un
   `definitivo` va limpio: etiquetarlo todo convertiría la marca en ruido.
3. El copiloto **no depende de que su llamador filtre**: quien afirma es él.
   `embarazoConfirmado` deja fuera `descartado` y `diferencial`, y el texto se
   redacta en condicional cuando el embarazo es presuntivo.

**LO QUE EL ARREGLO NO HACE.** No calla ningún aviso. Un embarazo **presuntivo**
sigue disparando el aviso gestacional de categoría `evitar` —el riesgo de un
embarazo no detectado pesa más que una frase de más— sólo que dice «El embarazo
está planteado y no confirmado» en vez de afirmarlo. Callarlo habría sido el
error contrario, y el caro. Un llamador antiguo que no manda `tipo` se comporta
exactamente como antes: ausencia de dato no es dato de ausencia, y «no se sabe»
no puede apagar un aviso de teratogenicidad.

Las **consultas de PubMed** siguen usando el término a secas: «(presuntivo)»
dentro de una búsqueda MeSH no la afina, la rompe. La etiqueta es para el
razonamiento, no para el buscador; hay un caso que lo fija.

**LA PRUEBA.** `src/__tests__/lo-que-el-medico-descarto-no-es-un-diagnostico.test.ts`
(16 casos). Probada al revés: el caso *«AL REVÉS — sin el filtro, los tres
entran»* reproduce la regla equivocada y comprueba que el filtro es lo que separa
un caso del otro. Hay además un caso que **compara el cuadro contra `estaVigente`
dx a dx**, para que los dos criterios no puedan volver a separarse, y tres que
comprueban sobre el árbol que la pantalla y el prompt no vuelven a escribir
`.descripcion` a secas.

**UN GUARDIÁN AJENO QUE SE ACTUALIZÓ, Y POR QUÉ NO ES DEBILITARLO.**
`el-expediente-resume-el-estado.test.ts` fijaba la expresión literal
`problemas.map(p => p.diagnostico.descripcion`. Lo que protege es **qué** enseña
la consulta —la lista entera, no un resumen—, y eso no ha cambiado; lo que cambió
es **cómo** se nombra cada problema. La aserción se movió al nuevo texto
conservando su intención, y queda dicho en su comentario.

**QUÉ NO CUBRE, DECLARADO.**

- **No añade `certeza` a `Diagnostico`.** El eje «con cuánta seguridad lo dijo el
  PACIENTE» (`certeza.ts`, «creo que me dijeron que tenía anemia») se sigue
  calculando en la consulta, se enseña como aviso y **se descarta al firmar**.
  Esto usa `tipo`, que es lo que decidió el MÉDICO y que sí se guarda. El otro
  eje sigue abierto en WS-10.
- **No cambia ninguna compuerta ni ningún umbral.** Cambia qué entra y cómo se
  nombra.
- **No toca la reactividad cruzada** ni los motores de dosis, renal o pediátrico.
- **No revisa las notas ya firmadas.** Un cuadro mal formado que ya se razonó y
  se selló sigue sellado: una nota firmada es inmutable.

---

## REG-365 — una etiqueta que sale siempre afirmaba una duda que nadie expresó

**QUÉ FALLABA, Y DE DÓNDE SALIÓ.** Lo introdujo **REG-364, unas horas antes**, y
se cazó revisando el arreglo con una sola pregunta: *«¿y qué valor trae de fábrica
este campo?»*.

REG-364 hizo que los cuatro lectores del diagnóstico —la lista de `/consulta`, el
resumen de `/expediente`, el cuadro de los motores y el prompt de evidencia—
escribieran «(presuntivo)» al lado de un diagnóstico presuntivo, en nombre de
`SUGERIDO ≠ CONFIRMADO`. Suena bien. Es falso, por esto:

```
extraction-schema.ts:40   tipo: z.enum([...]).optional().default('presuntivo')
prompts.ts:85             «Por defecto tipo="presuntivo".»
consulta/page.tsx         el botón de añadir crea  { tipo: 'presuntivo' }
— y NINGUNA pantalla del producto deja al médico elegir el tipo —
```

`presuntivo` **es el valor de fábrica**. No quiere decir «el médico lo dio por
probable»: quiere decir **«nadie dijo nada»**. Etiquetarlo tenía dos
consecuencias, las dos malas:

1. **Afirmaba una duda inexistente.** Una diabetes crónica confirmada, capturada
   como todas con el tipo de fábrica, se leía en pantalla y en el prompt del
   modelo como **«Diabetes mellitus tipo 2 (presuntivo)»** — el médico nunca dijo
   eso. Es la regla 4 de seguridad clínica por el otro lado: ausencia de dato no
   es dato de ausencia, y tampoco es dato de duda.
2. **Convertía la marca en ruido.** Al salir en casi todos los renglones, dejaría
   de leerse justo el día que significara algo.

Y en el copiloto, la primera redacción hacía lo mismo en el otro sentido: decía
«El embarazo está planteado y **no confirmado**» ante un `presuntivo`, o sea
afirmaba una NO-confirmación que tampoco consta.

**CAUSA RAÍZ.** Se le dio significado a un valor sin comprobar de dónde sale. Un
campo con `default` no distingue *«se eligió esto»* de *«no se eligió nada»*, y
todo lo que se construya encima hereda esa ambigüedad.

**EL ARREGLO.**

- `nombreConCerteza` etiqueta **sólo `descartado` y `diferencial`** — los dos a
  los que **no se llega por omisión**: los escribe el extractor cuando el médico
  dictó un descarte o un diferencial. `definitivo` y `presuntivo` van limpios.
- El copiloto **afirma sólo si alguien afirmó**, y si no, **cita el expediente**:
  «Hay un embarazo registrado en la nota». Ni da por cierto lo que nadie confirmó
  ni por falso lo que nadie descartó. El aviso de teratogenicidad **no se pierde
  en ningún caso**.
- Lo que REG-364 arregló de verdad **se queda entero**: `descartado` y
  `diferencial` no entran al cuadro que ven los motores, `tipo` viaja en
  `DiagnosticoDelCuadro`, y el copiloto no depende de que su llamador filtre.

**LA PRUEBA.** Los mismos 18 casos de
`src/__tests__/lo-que-el-medico-descarto-no-es-un-diagnostico.test.ts`, con el
bloque «un valor de fábrica no es un juicio del médico». Uno de ellos **lee el
esquema y el prompt** y falla si `presuntivo` deja de ser el valor por defecto:
la regla de arriba sólo es correcta mientras lo sea, y el día que cambie tiene
que saltar algo en vez de quedarse callado.

**QUÉ NO CUBRE, DECLARADO.**

- **No arregla que el médico no pueda elegir el tipo.** Hoy `tipo` lo pone el
  extractor o el default, nunca una pantalla. Mientras siga así, el producto **no
  puede distinguir un presuntivo elegido de uno de fábrica**, y por eso no lo
  enseña. Darle un control al médico es una decisión de producto y de modelo
  —haría falta separar «elegido» de «por defecto»—, no un cambio de esta
  función. Queda anotado en WS-10.
- No toca el otro eje de certeza, el del PACIENTE (`certeza.ts`), que sigue
  calculándose en la consulta y descartándose al firmar.

---

## REG-366 — los avisos que el médico confirmó haber revisado se descartaban al firmar

**QUÉ FALLABA.** Antes de firmar, `/consulta` enseña una lista de avisos y pide
confirmar con **«Los revisé, firmar»**. Los produce `construirAvisos` a partir de
motores que existen y están probados: la contradicción con una negación, el
antecedente que era del familiar, el desajuste temporal, la afirmación sin
respaldo en el dictado, y el dato que el paciente ofreció como **duda**
(`certeza.ts`).

Al firmar **se descartaban todos**. La nota firmada guarda con qué modelo se
generó, qué versión del prompt, cuántos campos vinieron del dictado y cuáles
aprobó el médico (`iaAuditoria`) — y **nada de lo que el sistema le señaló**.

**LAS DOS CONSECUENCIAS.**

*Clínica.* La tiene escrita el propio módulo, en `POR_QUE_IMPORTA`: «lo que el
paciente ofreció como duda queda en el expediente como diagnóstico; a partir de
la segunda consulta ya nadie sabe que era una duda: se lee igual que un dato
confirmado y se arrastra a todas las notas siguientes». El motor que detecta
«creo que me dijeron que tenía anemia» **funciona** — y su hallazgo duraba lo que
duraba la sesión del navegador.

*Medicolegal.* Un aviso que se mostró y se aceptó es parte de cómo se tomó la
decisión. Sin registro no se puede decir ni que se avisó ni que no: **los dos
casos se ven exactamente igual seis meses después**.

**CÓMO SE DESCUBRIÓ.** Recorriendo WS-10. El tablero lo tenía escrito como «el
hueco de fondo»: negación, temporalidad, experienciador y certeza corren en el
momento de la consulta, producen avisos, **y después se descartan**.

**CAUSA RAÍZ.** El resultado de los motores vivía sólo en estado de React.
Familia «escrito y sin conectar» en su variante temporal: sí corría en el camino
del médico, pero el dato no sobrevivía al acto que lo hacía importante.

**EL ARREGLO.** `src/lib/expediente/lo-que-se-aviso-al-firmar.ts` (puro) sella en
`iaAuditoria.avisosAlFirmar` **los avisos que estaban en pantalla al firmar** —los
mismos que enumeró el diálogo y a los que se refiere «Los revisé»—, con su
origen, su nivel y **la frase tal como el médico la leyó**, sin reescribirla. Y la
pantalla de la nota firmada los enseña.

**EL ORDEN ES LA MITAD DEL ARREGLO.** `conAvisosSellados` se llama **antes** de
`normalizarParaSello`, porque `iaAuditoria` está dentro de
`OPCIONALES_SELLADOS_V3`: añadir el campo después del hash haría que el sello se
calculara sobre un objeto distinto del que se escribe, y **la nota se reabriría
marcada como «alterada»**. Es literalmente el modo de fallo de REG-060 —la alarma
roja que el sello existe para no dar nunca— y por eso el arreglo es una función
que recibe la nota, y no un objeto suelto en la pantalla. Hay dos casos que lo
vigilan: uno comprueba que `iaAuditoria` sigue dentro del conjunto sellado, y otro
compara las **posiciones** de las dos llamadas en el archivo de la consulta.

**QUÉ NO CUBRE, DECLARADO.**

- **No sella los avisos que el médico cerró antes de llegar a firmar.** Eso sería
  un historial de la sesión, que es otra cosa y no es lo que él confirmó.
- **No sella los de PRESCRIPCIÓN.** `alFirmar` los deja fuera porque se ven
  mientras receta, no al firmar (REG-173/190).
- **No resuelve la duda.** Un dato incierto sellado sigue siendo incierto; ahora
  se puede volver a leer, que es lo que no se podía.
- **No añade `certeza` a `Diagnostico`.** El eje sigue sin estructurarse en la
  entidad: lo que se conserva es la FRASE que lo delató, con su aviso. Estructurarlo
  es una decisión de modelo, y sigue abierta en WS-10.
- **No se imprime.** Es cómo se revisó la nota, no parte del documento que se
  entrega al paciente ni del que va a la farmacia. El bloque lleva `no-print` y
  hay un caso que lo comprueba.
- **No lo lee ninguna consulta POSTERIOR todavía.** Se lee en la pantalla de la
  nota. Que la duda de hace dos años salga sola al abrir una consulta nueva es
  trabajo de WS-10 y no se da por hecho aquí.

**LA PRUEBA.** `src/__tests__/lo-que-se-aviso-al-firmar-no-se-pierde.test.ts`
(16 casos), construyendo los avisos con **la cadena real** (`construirAvisos` +
`alFirmar`) y no con objetos a mano — con una aserción que falla si esa cadena
deja de producir avisos, para que el fixture no pueda volverse vacuo. Probada al
revés: sobre la nota sin sellar, `avisosSelladosDe` devuelve `null` y la nota no
contiene la palabra que el aviso traía.

---

## REG-367 — la duda de una consulta no llegaba a la siguiente

**QUÉ FALLABA.** REG-366 hizo que los avisos que el médico revisa al firmar
queden sellados en la nota, y que la pantalla de **esa** nota los enseñe. Y
declaró, sin disimularlo, lo que no cerraba: **ninguna consulta posterior los
lee**.

Sellar algo que sólo se ve abriendo el documento donde se selló es media
reparación: hay que ir a buscarlo, y nadie va a buscar lo que no sabe que está.

**LA FRASE QUE ESTO CONTRADICE**, escrita por el propio repositorio en
`certeza.ts` y comprobada por el golden:

> «Lo que el paciente ofreció como duda queda en el expediente como diagnóstico.
> A partir de la **segunda consulta** ya nadie sabe que era una duda: se lee
> igual que un dato confirmado y se arrastra a todas las notas siguientes.»

La segunda consulta es exactamente donde faltaba el lector. La lista de problemas
dice «Anemia»; en una nota firmada de hace dos años hay un aviso sellado que dice
«creo que me dijeron que tenía anemia». Las dos cosas están en el expediente, y
una de ellas no se veía — **la que dice que hay algo por comprobar**.

**CÓMO SE DESCUBRIÓ.** Lo declaró REG-366 como lo que dejaba abierto, en su
golden y en el ledger. Cerrarlo en la unidad siguiente es lo que evita que un
«qué no cubre» se convierta en el defecto de dentro de seis meses.

**CAUSA RAÍZ.** El dato existía en un documento y ningún camino del producto lo
leía desde el sitio donde hace falta. Familia «escrito y sin conectar»: el sello
estaba, el lector no.

**EL ARREGLO.** `src/lib/expediente/la-duda-de-la-otra-vez.ts` (puro) recorre las
notas **firmadas** que la consulta ya tiene cargadas —cero lecturas nuevas—, saca
los avisos sellados cuyo origen **viaja entre consultas** (el dato incierto, el
antecedente del familiar, la contradicción con una negación, el desajuste
temporal, la afirmación sin respaldo) y se queda con los que hablan de un
problema que el paciente **sigue teniendo hoy**. Se pintan bajo la lista de
problemas, con la fecha de la nota firmada que lo dice: sin la fecha sería una
afirmación del sistema; con ella es una cita del expediente.

Se excluyen los avisos que eran de **aquella** consulta y se resolvieron allí
—dosis incompleta, requisito NOM-004—: traerlos ahora sería ruido. Y se excluye
la nota que se está escribiendo, cuyos avisos ya están en pantalla.

**UN DEFECTO QUE CAZÓ SU PROPIO GOLDEN, OTRA VEZ.** La primera versión comparaba
`« palabra »` con espacios a los lados y listaba a mano los separadores que se me
ocurrieron (espacio, coma, punto). El texto de un aviso **envuelve la frase del
médico en comillas angulares** —«…que tenía anemia». Confírmalo…»—, así que la
palabra que importa casi nunca lleva un espacio detrás: **el caso principal no
casaba**. Se sustituyó por una frontera de palabra de verdad, y hay un caso que
fija exactamente esa forma.

**QUÉ NO CUBRE, DECLARADO.**

- **El emparejamiento es una heurística, y señala de MENOS.** Casa por palabras
  de seis letras o más del diagnóstico dentro de la frase — el mismo criterio que
  `copiloto.ts` usa para casar un fármaco con lo dictado. Un problema cuyas
  palabras sean todas cortas —«gota», «asma», «TEP»— **no se empareja nunca**, y
  es deliberado: emparejar de más llenaría la consulta de dudas que no son de ese
  problema, y un aviso que salta de más se aprende a cerrar. Regla 5: señalar de
  menos, y **declararlo**.
- **No cubre notas anteriores a REG-366**, que no llevan avisos sellados. Para
  ellas no hay nada que leer y no se inventa nada.
- **No dice si la duda se resolvió.** Nadie registra eso todavía. Enseña que la
  hubo; decidir es del médico.
- **No modifica la lista de problemas** ni recalifica ningún diagnóstico ni
  bloquea nada.

**LA PRUEBA.** `src/__tests__/la-duda-de-la-otra-vez-vuelve-a-salir.test.ts`
(19 casos), construyendo el sello con **la cadena real** (`construirAvisos` →
`alFirmar` → `conAvisosSellados`). Probada al revés: sobre la misma nota sin
sellar —el estado anterior a REG-366— no sale nada. Y un caso comprueba que la
frase de `certeza.ts` que este módulo existe para contradecir sigue escrita donde
estaba, porque si alguien la reescribe este módulo se queda sin su razón.

---

## REG-368 — los laboratorios que el paciente ya tiene no llegaban a los motores

**QUÉ FALLABA.** Es **REG-188 otra vez**, en el eje que aquella reparación dejó
fuera.

REG-188 encontró que los motores clínicos recibían **sólo la receta de hoy**
—warfarina de marzo más ketorolaco de hoy no disparaba la regla de sangrado— y lo
arregló para la medicación y para los problemas (`cuadro-completo.ts`). Los
**laboratorios** siguieron igual:

```ts
entradaCopiloto.labs = labsDesdeEstudios(extraction.tests)
//                     ↑ sólo lo dictado o extraído HOY
```

Los paneles del paciente —creatinina, AST/ALT, plaquetas, LDL, potasio— viven en
`laboratorio/firestore.ts` y los leía **un solo componente**: `PanelLaboratorios`,
que se pinta en la pestaña de Laboratorios **de esta misma pantalla**. El número
estaba a la vista del médico y el motor que produce el aviso no lo veía.

**LO QUE SE REPRODUJO, CON EL MOTOR REAL:**

```
creatinina 2.4 mg/dL en un panel del mes pasado
+ hoy se prescribe metformina, sin volver a dictar la creatinina
→ `ajusteRenal` sale por su primera línea: no hay `labs.creatinina`
→ ni TFG estimada, ni aviso de metformina por debajo de 30
```

`AJUSTE_RENAL` existe, está probada y dice qué hacer. No llegaba el número.

**CÓMO SE DESCUBRIÓ.** Recorriendo WS-10 (laboratorios clave y tendencias) con la
pregunta de siempre: **¿quién lee esto?**. `listarPanelesLab` y
`seriesDesdeHistorial` tenían un único llamador, y no era el motor.

**CAUSA RAÍZ.** Familia «escrito y sin conectar», sobre el dato que alimenta las
fórmulas que producen conducta — y en su variante más difícil de ver: **el dato
estaba en la misma pantalla**, en otra pestaña, así que mirando la interfaz el
hueco es invisible.

**EL ARREGLO.** `laboratorio/lo-que-ya-esta-medido.ts` (puro) une lo de hoy con
los paneles del expediente, con la **misma regla que `medicacionDelCuadro`**: hoy
manda —si el médico acaba de dictar una creatinina está mirando un resultado
nuevo—, el expediente completa, y el panel más reciente manda sobre cada analito.

Y lo que viene del expediente **viaja con su fecha**. `EntradaCopiloto` gana
`labsMedidosEn`, y `citaDelLab` —una sola definición para los cuatro sitios que
nombran un valor— hace que el aviso diga «creatinina 2.4 mg/dL, **medida el
2026-07-14**». El aviso de contraindicación renal, que es el más grave que
produce este motor, lo dice también en su detalle. Sin eso, el motor afirmaría una
vigencia que nadie comprobó.

**LO QUE NO SE DECIDIÓ, Y ESTÁ MARCADO `NEEDS_CLINICAL_REVIEW`.**

**Cuánto puede tener una creatinina para seguir sirviendo para dosificar es un
umbral clínico**, y aquí no se inventa (regla 1). No hay filtro por antigüedad: lo
que hay es la fecha, dicha, para que la juzgue quien puede. Poner «180 días»
porque suena razonable es exactamente el fallo que esa regla describe — no rompe
nada, no falla ninguna prueba, y sale impreso con cédula profesional. Hay un caso
del golden que **falla si aparece una constante de días** en el módulo.

**LO QUE SÍ SE EXCLUYE.** Los valores **censurados** («>400», «<50»): el
laboratorio dio un límite, no un número, y meterlo en una fórmula afirmaría un
valor exacto que nadie midió — REG-204 y `el-valor-censurado-no-se-da-por-normal`.

**QUÉ NO CUBRE, DECLARADO.**

- **No cambia ningún umbral, ninguna fórmula ni ninguna compuerta.** Cambia qué
  entra. Habrá más avisos —es el objetivo— y ninguno bloquea la firma.
- **No dibuja tendencias en la consulta.** `seriesDesdeHistorial` sigue siendo del
  panel; esto es el puente al motor, no una pantalla nueva.
- **No cubre UCI ni hospitalización**, que tienen su propio camino.
- **Cuesta una lectura más por consulta** — la misma que ya hace el panel de la
  pestaña cuando se abre. Si falla, los motores ven lo de hoy: exactamente como
  se comportaban antes.

**LA PRUEBA.** `src/__tests__/lo-que-ya-esta-medido-llega-al-motor.test.ts`
(15 casos), con el **motor real** (`copiloto`) y no con dobles. Probada al revés:
con sólo lo de hoy, el motor no dice nada de la metformina ni de la TFG; con el
panel del mes pasado, el aviso sale y trae la fecha.

---

## REG-369 — la trayectoria de laboratorio sólo se veía saliendo de la consulta

**QUÉ FALLABA.** REG-368 hizo que los laboratorios del expediente lleguen a los
motores. Lo que llega es **el último valor de cada analito**, y el último valor no
dice lo único que a veces importa:

```
creatinina   0.9 (mar-2025)  →  1.3 (ene-2026)  →  1.7 (jul-2026)
```

Ninguno de los tres dispara nada por sí solo y los tres juntos son un deterioro
renal. `seriesDesdeHistorial` construye esa trayectoria desde hace tiempo y **su
único llamador es el panel de la pestaña de Laboratorios**: para verla hay que
salir de donde se está prescribiendo, con el paciente enfrente.

**CÓMO SE DESCUBRIÓ.** Estaba escrito en el checkpoint como lo siguiente de WS-10
después de REG-368.

**CAUSA RAÍZ.** Familia «escrito y sin conectar»: el cálculo existía y su único
lector estaba a una pestaña de distancia del momento en que sirve.

**EL ARREGLO.** `laboratorio/la-trayectoria.ts` (puro) devuelve, para un analito,
el valor de ahora, el anterior, sus fechas y la palabra que describe la diferencia.
Llega a dos sitios:

1. **Al aviso que cambia la conducta**, por `citaDelLab`: «creatinina 2.4 mg/dL,
   medida el 2026-07-14, **subió desde 1.3 el 2026-01-10**».
2. **A la consulta**, en una línea bajo la medicación, sólo de los analitos que
   los motores están usando y sólo cuando hay una medición anterior.

Lo dictado hoy manda y el panel más reciente pasa a ser «el previo» — misma regla
que `labsDelCuadro`.

**LA LÍNEA QUE SEPARA CITAR DE JUZGAR.** Este módulo hace **aritmética y
procedencia**: dos números, dos fechas, y `sube`/`baja`/`igual`. No dice si el
cambio es significativo. «Un ascenso del 30 % de creatinina es una lesión renal
aguda» es un **umbral clínico** y aquí no se inventa (regla 1): no hay
porcentajes, ni «deterioro», ni banderas. Un módulo que dijera «función renal
deteriorándose» estaría emitiendo un juicio que nadie respaldó; uno que dice
«creatinina 1.7 el 14-jul, antes 1.3 el 10-ene» está citando el expediente.

`NEEDS_CLINICAL_REVIEW` para el dueño: cuánto tiene que moverse un analito para
que el cambio importe.

**LA PRUEBA.** `src/__tests__/la-trayectoria-del-laboratorio-llega-a-la-consulta.test.ts`
(18 casos). Dos guardianes que valen por el resto:

- Uno **quita comentarios y cadenas** del módulo y exige que **no quede ningún
  literal numérico** salvo el tope de puntos, el `0` y el `1` de los índices. Se
  probó al revés metiendo `const SUBIDA_SIGNIFICATIVA = 0.3`: falla nombrando la
  cifra. Comprueba el código y no la prosa, justamente porque la prosa explica
  por qué no hay umbral y la palabra «umbral» aparece ahí.
- Otro recorre la frase generada y falla si contiene *empeoró*, *deterioro*,
  *alarma*, *grave* o *significativo*.

**QUÉ NO CUBRE, DECLARADO.**

- **No dibuja una gráfica.** La gráfica sigue siendo del panel; esto es la frase
  que cabe donde se decide.
- **No trae censurados** («>400»): un límite no es un número y haría subir o bajar
  una línea por un valor que nadie midió.
- **Sólo de los analitos que entran a los motores**, y con tope de 4 en pantalla y
  5 puntos previos: un paciente con quince años de laboratorios convertiría esta
  línea en el inventario que la regla de diseño prohíbe.
- **No cubre UCI ni hospitalización**, que tienen su propio camino.

**UN GUARDIÁN AJENO ACTUALIZADO.** El de REG-368 fijaba la forma literal
`labsDelCuadro(\n labsDesdeEstudios(`. Esta unidad separó el cálculo en dos
sentencias para reutilizar lo de hoy en la trayectoria; la aserción pasó a
comprobar lo que de verdad protege —que lo **dictado** siga entrando al puente—
en vez de la disposición del texto.

---

## REG-370 — el procedimiento que se dictó no lo leía nadie

**QUÉ FALLABA.** `medical-ner.ts:62` reconoce **procedimientos** desde hace
tiempo, con su fecha, su lateralidad y la cita del dictado que los sostiene. El
panel de entidades los pinta.

Y ahí se acaban. Medido sobre el árbol el 29-ago-2026: fuera del panel y de las
pruebas, **`entidades.procedures` no tenía un solo consumidor**. No hay campo en
`NotaMedica`, no entra a la nota, no se sella, no se proyecta.

Así que «le hicieron una colecistectomía en 2019» o «tiene un stent en la
descendente anterior desde 2022» se reconocen, se pintan, y **desaparecen al
cerrar la consulta** salvo que el médico los teclee a mano en la prosa. En la
consulta siguiente nadie sabe que se dijeron.

**POR QUÉ PESA MÁS QUE OTRAS PÉRDIDAS.** Un antecedente quirúrgico cambia
conducta: cambia lo que se puede prescribir, pedir, operar y anticoagular. Y la
**lateralidad** es uno de los pares prohibidos de este repositorio
(derecha ↔ izquierda), justo el dato que se pierde primero cuando algo se
reescribe de memoria en la consulta siguiente.

**CÓMO SE DESCUBRIÓ.** Recorriendo WS-10 (procedimientos) con la pregunta de
siempre: ¿quién lee esto? La respuesta fue: el panel, y nadie más.

**CAUSA RAÍZ.** Familia «escrito y sin conectar»: el extractor produce, la
pantalla pinta, y ningún camino lleva el dato al documento donde tendría que
quedar.

**EL ARREGLO.** `el-procedimiento-que-no-quedo-escrito.ts` (puro) compara lo que
el extractor oyó con lo que la nota **dice** —usando el mismo constructor de
texto que las otras cuatro defensas, `textoDeLaNota`— y señala antes de firmar lo
que no aparece, con su fecha y su lateralidad.

**No documenta solo, y eso es la mitad del arreglo.** Un módulo que escribiera un
antecedente quirúrgico en la nota sin que nadie lo revisara estaría redactando
historia clínica, y de esa nota cuelga una firma con cédula profesional.

Sale por el camino que ya existe (`avisos-consulta.ts`), así que **desde REG-366
queda sellado en la nota** y **desde REG-367 vuelve a salir en la consulta
siguiente** si habla de un problema vigente. No se añadió ningún recuadro.

`no_aplica` **no se enseña** como lateralidad: es el valor por defecto del
esquema, no un dato que alguien haya determinado. Misma regla que REG-365 con
`presuntivo`.

**LO QUE NO SE HIZO, Y POR QUÉ — la parte importante de esta entrada.**

**No se creó `NotaMedica.procedimientos`.** Un campo nuevo de contenido clínico
tiene que ir **dentro del sello de integridad**, y el sello v3 es una **lista
explícita de campos** (`canonicoV3`): añadir uno exige un **sello v4** —con su
canónico, su vector golden y su partición de cobertura (`CAMPOS_SELLADOS_V3` /
`CAMPOS_NO_SELLADOS_V3`)— para que las notas ya firmadas con v3 **sigan
verificando**, igual que hoy siguen verificando las v2.

Meterlo sin eso dejaría **contenido clínico firmado fuera del sello**: alterable
sin dejar rastro en un documento inmutable, que es exactamente lo que E0-12 vino
a cerrar. Queda declarado como unidad aparte, y hay un caso que **falla si
aparece el campo en el tipo sin aparecer en el sello**.

**QUÉ NO CUBRE, DECLARADO.**

- **No avisa de un procedimiento cuyo nombre no tenga palabras de seis letras**
  («TAC», «PET»): no hay con qué buscarlo en la nota, así que se deja pasar en
  vez de gritar sobre algo que quizá sí está escrito. Regla 5.
- **No decide si el procedimiento es cierto** ni corrige su lateralidad.
- **No bloquea la firma.** Puede ser una palabra mal oída, y apagar el botón por
  un posible falso positivo enseña a esquivar la compuerta.

**LA PRUEBA.** `src/__tests__/el-procedimiento-que-se-dijo-no-se-pierde.test.ts`
(18 casos). Probada al revés: con la nota que sí lo recoge, no se señala nada.

**DOS TRINQUETES AJENOS QUE SE PUSIERON ROJOS, Y ESO ES LO CORRECTO.**
`una-barra-y-no-ocho-recuadros` exige que todo origen nuevo se declare a mano con
su nivel **y que llegue de verdad a la barra** —hizo falta añadirlo a su fixture,
que es el guardián funcionando—; y `la-nota-entera-se-contrasta` cuenta cuántas
defensas leen la nota por el mismo constructor: pasó de cuatro a cinco, con la
razón escrita. Ninguno se debilitó.

---

## REG-371 — los dispositivos invasivos sólo se veían dentro de su propia pestaña

**QUÉ FALLABA.** La valoración del inmunocomprometido captura **dispositivos
invasivos** —CVC, PICC, port-a-cath, sonda urinaria, ostomía, prótesis articular,
**prótesis valvular**, **marcapaso/DAI**, derivación ventricular, tubo, drenaje— y
los guarda en el expediente (`patient.txValoracion`, clave `hc_cb_disp_<x>`).

Medido sobre el árbol el 29-ago-2026: el **único** lector de ese grupo era
`inmuno/compose.ts`, que arma el texto de esa misma valoración. **Fuera de su
pestaña, nadie sabía que el paciente lleva una prótesis valvular.**

**POR QUÉ IMPORTA.** Son los antecedentes que más cambian conducta sin aparecer
en ningún diagnóstico: una prótesis valvular o articular cambia la profilaxis y la
sospecha ante una bacteriemia; un marcapaso/DAI cambia qué estudio de imagen se
puede pedir; un catéter central cambia dónde se busca el foco. El médico los
capturó una vez, están escritos, y en la consulta siguiente tenía que acordarse de
abrir una pestaña para verlos.

**CÓMO SE DESCUBRIÓ.** Recorriendo WS-10 (dispositivos) con la pregunta de
siempre: ¿quién lee esto?

**CAUSA RAÍZ.** Familia «escrito y sin conectar», en la misma variante que
REG-368: el dato está **en la misma pantalla**, en otra pestaña, así que mirando
la interfaz el hueco es invisible.

**EL ARREGLO.** `los-dispositivos-que-trae.ts` (puro) devuelve los dispositivos
**marcados**, con el nombre del catálogo y la fecha de la valoración, y la
consulta los pinta en una línea junto a las alergias, los problemas, la
medicación y los laboratorios. Sale de `patient`, que ya está cargado: **cero
lecturas nuevas**.

Se recorre el **catálogo** y no las llaves guardadas: así una llave suelta o
renombrada en la base no acaba delante del médico con nombre de clave técnica, y
el orden es estable.

**LA REGLA: SÓLO SE AFIRMA LO MARCADO.** Un dispositivo no marcado **no es un
dispositivo negado**: puede que nadie abriera la valoración. Con la lista vacía no
se dice «sin dispositivos invasivos» — **no se pinta nada**. Regla 4 de seguridad
clínica, y hay tres casos que lo fijan.

**QUÉ NO CUBRE, DECLARADO.**

- **No alimenta ningún motor.** En este producto no hay reglas clínicas sobre
  dispositivos —ni de profilaxis, ni de imagen, ni de foco infeccioso— y
  escribirlas aquí sería **inventar criterio clínico** (regla 1). Se pone el dato
  delante; decide el médico. Hay un caso que comprueba que **no** se le pasa a
  ningún motor.
- **No crea una entidad de dispositivo** con fecha de colocación y de retiro. Eso
  es un campo nuevo en la nota, y un campo clínico nuevo exige el **sello v4** que
  REG-370 dejó declarado.
- **No dice si el dispositivo sigue puesto.** Lleva la fecha de la valoración para
  que se pueda juzgar; un catéter de hace dos años pudo retirarse.
- **No mueve `txValoracion` de sitio.** Es uno de los campos que E0-06 tiene
  pendientes de mudar fuera de `Patient`. Leerlo no adelanta ni cambia esa
  migración, que sigue `BLOCKED_EXTERNAL` por su acción externa.
- **No cubre UCI ni hospitalización**, que tienen su propio camino
  (`uci/handoff.ts`) y están diferidos por el dueño.

**LA PRUEBA.** `src/__tests__/lo-que-el-paciente-lleva-puesto-se-ve.test.ts`
(14 casos), incluido el que comprueba que el dato **sí estaba guardado** antes del
arreglo —que es lo que hacía la pérdida invisible— y el que impide que se cuele
otro grupo de la valoración.

---

## REG-372 — el expediente interoperable afirmaba una confirmación que nadie hizo, daba por resuelta una enfermedad crónica y convertía un descarte en sospecha

**QUÉ FALLABA.** La exportación FHIR resolvía el estado de una `Condition` con
dos ternarios:

```ts
verificationStatus: dx.tipo === 'definitivo' ? 'confirmed' : 'provisional'
clinicalStatus:     dx.estado === 'activo'   ? 'active'    : 'resolved'
```

**1. Una confirmación firmada por nadie.** `tipo` lo pone el modelo de lenguaje
—el prompt le pide distinguir sospecha de diagnóstico confirmado— o lo rellena el
esquema por omisión, y **ninguna pantalla deja al médico elegirlo** (REG-365). Así
que un `definitivo` **del modelo** salía a otro sistema como `confirmed`: una
afirmación clínica que ninguna persona hizo, en un registro interoperable que este
producto ya no controla una vez enviado.

**2. Un descarte convertido en sospecha.** `descartado` caía en el `else` y salía
como `provisional` — «todavía en estudio». Es REG-364 por la puerta de la
interoperabilidad.

**3. Una enfermedad crónica dada por resuelta.** `estado` tiene cuatro valores y
el ternario reconocía uno: `cronico` y `en_seguimiento` salían como **`resolved`**.
El expediente interoperable de un diabético decía que su diabetes está resuelta.

**CÓMO SE DESCUBRIÓ.** Cerrando el hueco de modelo que el tablero tenía escrito
—«la extracción por defecto no puede volverse un diagnóstico presuntivo o
confirmado elegido por el médico»— y siguiendo a dónde va `tipo`: su destino final
es un `verificationStatus` que otro sistema lee como un hecho.

**CAUSA RAÍZ.** El modelo de datos no distinguía **quién** puso `tipo`, y la
traducción a FHIR aplanaba cuatro valores en dos. Familia «el sistema se
contradice a sí mismo»: la pantalla ya no trata un `presuntivo` por omisión como
un juicio (REG-365) y la exportación sí lo hacía.

**EL ARREGLO, en tres piezas.**

1. **`Diagnostico.tipoOrigen`** — `medico` | `extraccion` | `por_defecto`. Va
   **dentro** de `Diagnostico`, que el sello v3 ya cubre entero (`diagnosticos`
   está en `canonicoV3`), así que **no hace falta un sello nuevo**: las notas
   viejas conservan su objeto y siguen verificando.
2. **El esquema conserva el origen.** `DiagnosticoAuditado` cambia
   `.default('presuntivo')` por un `transform`, porque un default de zod **no deja
   rastro de haberse aplicado**. El efectivo por omisión sigue siendo `presuntivo`
   —no cambia nada de lo que ya funcionaba— y ahora se sabe si el modelo lo dijo.
   Y **nunca marca `medico`**: una sugerencia no es una firma.
3. **`fhir/la-certeza-que-sale-al-mundo.ts`** (puro) traduce con un caso por
   valor: `descartado`→`refuted`, `diferencial`→`differential`,
   `definitivo`+`medico`→`confirmed`, cualquier otro `definitivo`→`unconfirmed`,
   `presuntivo`→`provisional`; y `cronico`/`en_seguimiento`→`active`.

**LA REGLA.** **Confirmar es un acto y sólo lo puede hacer una persona.**
`unconfirmed` no dice que el diagnóstico sea falso: dice que **nadie firmó su
verificación**, que es exactamente lo que ocurre. Degradar una nota histórica de
`confirmed` a `unconfirmed` **no pierde información** — deja de afirmar la que
nunca hubo.

Un estado que el código no conozca **no se da por resuelto**: sale `active`, que
es lo que no pierde al paciente de vista. Ausencia de dato no es dato de ausencia.

**QUÉ NO CUBRE, DECLARADO.**

- **No crea la pantalla donde el médico elija `tipo`.** Sigue sin existir, así que
  hoy `tipoOrigen: 'medico'` sólo lo lleva el diagnóstico que el médico añade a
  mano. Esto hace la carencia **visible** en vez de resolverla en falso.
- **No cambia `tipo` ni `estado`** de ningún diagnóstico, ni reclasifica nada.
- **No toca las notas ya firmadas.** Su objeto sigue igual y siguen verificando.
- **No cubre `AllergyIntolerance`**, que exporta `confirmed` fijo y tiene su
  propia historia.

**LA PRUEBA.**
`src/__tests__/la-certeza-del-diagnostico-no-la-firma-un-modelo.test.ts`
(18 casos). Probada al revés **tres veces**: cada uno de los tres defectos
reproduce el ternario anterior sobre el mismo dato y comprueba que daba el
desenlace equivocado. Un caso recorre los cuatro estados y falla si alguno deja de
tener `case` propio.

**UN GUARDIÁN PROPIO ACTUALIZADO, Y MEJORADO.** El de REG-365 leía el TEXTO del
esquema para comprobar que `presuntivo` seguía siendo el default. Al sustituir el
`.default()` por el `transform`, pasó a **ejecutar el esquema** y medir el
comportamiento: sin `tipo`, el efectivo sigue siendo `presuntivo` y el origen es
`por_defecto`. Protege lo mismo, y ya no depende de cómo esté escrito.

---

## REG-373 — una mención histórica se convertía en medicación vigente

**QUÉ FALLABA.** `estadoDeOrden()` trata la **ausencia** de `estado` como
`activa`, y con razón: todo lo prescrito antes de que el campo existiera no lo
lleva, y suponer otra cosa vaciaría de golpe la medicación de todos los
expedientes históricos.

Pero el esquema de extracción **no tiene campo `estado`**. Así que un fármaco que
el modelo saca del dictado entra con `estado` ausente y, por esa misma regla, se
vuelve medicación activa:

```
«le dieron warfarina cuando la operaron, ya no la toma»
  → medicamento: Warfarina, sin estado
  → estadoDeOrden() → 'activa'  →  medicamentosVigentes() la incluye
  → sale en «Toma:», entra al cuadro de los motores (REG-188), y dispara la
    regla de sangrado sobre un fármaco que el paciente dejó hace años
```

Y el eje temporal que este repositorio ya tiene sólo vigila **padecimientos**: el
vocabulario de `temporalidad.ts` son `CRONICAS` y `AGUDAS_FRECUENTES`, no
fármacos. **Los medicamentos no tenían ninguna defensa temporal.**

**CÓMO SE DESCUBRIÓ.** Cerrando el segundo hueco de modelo que el tablero tenía
escrito: «una mención histórica no puede volverse medicación activa».

**CAUSA RAÍZ.** Una regla correcta —`ausencia = activa`, para no vaciar el
histórico— aplicada a una fuente para la que no se escribió: el extractor, que
nunca pone `estado`. Familia «el sistema se contradice a sí mismo».

**EL ARREGLO.** `el-farmaco-que-ya-no-toma.ts` (puro) reutiliza `esFrasePasada`
—ya probada, con sus regexes de PRESENTE y PASADO— sobre las frases del dictado
que **nombran** el fármaco, y señala los que figuran como vigentes cuando **todas**
sus menciones están en pasado. Sale por `avisos-consulta.ts`, anclado en
`medicamentos`.

**NO RECLASIFICA, Y ESO ES LA MITAD DEL ARREGLO.** No pone `suspendida`, no saca
nada de la lista y no decide que el paciente dejó el fármaco. Porque **«ya no la
toma» y «se la suspendimos y la vamos a reanudar» se dictan igual de pasado**, y
la diferencia la sabe el médico — que ya tiene el botón «ya no» al lado de cada
renglón vigente, y ahí es donde el aviso ancla.

**SÓLO MIRA LO QUE EL DICTADO NOMBRA.** Un fármaco crónico que viene del
expediente y hoy no se mencionó **no se toca**: el silencio no suspende nada
(`ordenes-medicamento.ts`), y confundir «hoy no se habló de él» con «lo dejó» es
el defecto contrario — el caro, porque borra medicación crónica de la lista que el
médico lee antes de prescribir. Hay un caso que lo fija.

**QUÉ NO CUBRE, DECLARADO.**

- **No añade `estado` al esquema de extracción** ni un valor «histórico» a
  `procedenciaClinica`. Que el modelo declare el estado de una orden es una
  decisión de modelo con consecuencias directas en la receta; esto defiende sin
  pedírselo.
- **No se sella con la nota.** Ancla en `medicamentos`, así que es de los que se
  ven **mientras se receta** y no al firmar (`esDePrescripcion`), y REG-366 sella
  los del momento de firmar. Es deliberado: un aviso que cambia la receta llegando
  después de firmar es el registro de que no hubo protección (REG-173/190).
- **No opina de un fármaco de nombre corto** (menos de 5 letras útiles): no hay
  con qué buscarlo sin casar con cualquier cosa. Señalar de menos, y declararlo.
- **No entiende «suspendida hasta el martes»**: para el módulo eso es pasado y
  avisa. Avisar de más aquí cuesta una frase; callar cuesta una interacción.

**LA PRUEBA.** `src/__tests__/lo-que-tomo-no-es-lo-que-toma.test.ts` (20 casos).
Probada al revés: reproduce `estadoDeOrden` sobre el fármaco extraído sin estado y
comprueba que se lee como `activa` y que `medicamentosVigentes` lo incluye — que es
por qué hacía falta una defensa aparte. Y otro caso comprueba que el eje temporal
existente **no** mira fármacos, para que el día que lo haga alguien revise si este
módulo sobra.

---

## REG-374 — pasado gramatical no es fármaco terminado

**QUÉ FALLABA, Y DE DÓNDE SALIÓ.** Lo introdujo **REG-373, el mismo día**, y se
cazó preguntándole al arreglo por su caso más frecuente en vez de por el que lo
motivó.

REG-373 usaba `esFrasePasada` —la defensa temporal de los **padecimientos**— para
decidir si un fármaco «ya no se toma». Con un padecimiento funciona: «tuvo
neumonía hace tres días» sigue siendo un antecedente. Con un fármaco es **falso**:

```
«le receté amoxicilina hace tres días por la faringitis»
```

está en pasado gramatical y el paciente **la está tomando ahora mismo**, a mitad
de un ciclo de siete días. Con la regla anterior, el módulo avisaba sobre **todos
los antibióticos recién iniciados** —el caso más frecuente de la consulta—, y un
aviso que salta de más se aprende a cerrar: entonces deja de proteger del caso que
sí importa, que es la warfarina de hace tres años.

**CAUSA RAÍZ.** Se reutilizó un criterio probado **fuera del dominio para el que
se escribió**. `esFrasePasada` responde «¿esta frase encuadra lo dicho en el
pasado?», y la pregunta del fármaco es otra: «¿dice que ya no lo toma?». Se
parecen y no son la misma.

**EL ARREGLO.** Lo que separa «lo tomó» de «lo toma» no es el tiempo verbal: es
que alguien diga que **acabó**, o que lo sitúe en un pasado que ya no puede ser
hoy. Se exige una de las dos:

- **cesación dicha** — «ya no la toma», «dejó de tomar», «se lo suspendimos», «se
  le retiró», «terminó el ciclo», «no la está tomando»;
- **pasado remoto** — «hace N **años**», «en 2019», «cuando la operaron», «de
  niño».

**Y no hay ningún umbral de días.** «Cuántos días deja de estar tomándolo» es una
pregunta clínica que depende del fármaco, y elegir un número sería inventar una
cifra (regla 1). La línea está en la **unidad de tiempo que se dijo** —años sí,
días y semanas no—, no en un número que haya que escoger. Un caso del golden
recorre las constantes numéricas del módulo y falla si aparece cualquiera que no
sea la longitud mínima del nombre.

`desde hace cinco años` **no** cuenta como remoto: «desde hace» es presente y lo
dice la propia frase. Lleva su caso.

**QUÉ NO CUBRE, DECLARADO.**

- «Le di warfarina hace tres meses» **no avisa**. Meses queda del lado de lo que
  puede seguir corriendo, y para no inventar un umbral se prefiere callar. Regla
  5: señalar de menos, y declararlo.
- Sigue sin entender «suspendida hasta el martes»: eso dice cesación y avisa.
  Avisar ahí cuesta una frase.

**LA PRUEBA.** Los mismos casos de
`src/__tests__/lo-que-tomo-no-es-lo-que-toma.test.ts` (28 ahora), con el bloque
«pasado gramatical NO es fármaco terminado». Uno comprueba que el módulo **ya no
importa ni llama** a `esFrasePasada` —mirando el import y la llamada, no la prosa,
porque el comentario lo nombra para explicar por qué dejó de usarse—.

---

## REG-375 — la creatinina con la que se dosifica puede haber caducado, y no se decía

**QUÉ FALLABA.** REG-368 llevó los laboratorios del expediente a los motores.
Nada se filtraba por antigüedad, y REG-368 lo dejó abierto a propósito, como
`NEEDS_CLINICAL_REVIEW`: cuánto puede tener una creatinina para seguir sirviendo
para dosificar es un umbral clínico y no se inventa.

Consecuencia hasta hoy: una creatinina **de hace dos años** estimaba una TFG y con
ella se emitía «metformina contraindicada con TFG de 28», con la fecha a la vista
(REG-368/369) y **sin decir que el dato ya no valía para dosificar**.

**LA POLÍTICA, DEL DUEÑO, 29-AGO-2026.** No una cifra única de creatinina, y sin
confundir el valor con la antigüedad del laboratorio:

| Contexto | Ventana |
|---|---|
| AKI, paciente hospitalizado o función renal inestable | **≤24 h** |
| Ambulatorio clínicamente estable | **≤30 días** |
| No se puede demostrar estabilidad, o el contexto es ambiguo | **≤7 días** (conservador) |

Fuera de la ventana: **no bloquear en silencio ni inventar función renal**. Marcar
`STALE_RENAL_FUNCTION` y advertir que hace falta función renal actualizada **antes
de una recomendación de dosificación dependiente del riñón**. **La autoridad final
es del médico.**

**EL ARREGLO.** `laboratorio/vigencia-de-la-funcion-renal.ts` (puro) implementa las
tres ventanas y emite la marca. El aviso sale **sólo dentro de `ajusteRenal`**, que
es donde se produce una recomendación de dosificación dependiente del riñón: una
caducidad en una consulta que no prescribe nada renal sería ruido.

**Y la recomendación NO se retira.** La política dice que no se bloquee en
silencio: la sugerencia de ajuste se sigue dando, con su fecha, y **encima** se
dice que el dato está caduco y qué hace falta. Hay un caso que lo fija.

**LO QUE NO SE INFIERE, Y POR QUÉ IMPORTA.** **La estabilidad clínica no se deduce
de los números.** Decidir que una función renal es estable mirando cuánto se movió
la creatinina exigiría un umbral de variación que nadie ha validado — exactamente
lo que la otra política del dueño prohíbe. Sólo cuenta si alguien la **declara**.

Consecuencia declarada sin adornos: **hoy nada en el producto la declara**, así que
en la consulta ambulatoria rige la ventana conservadora de 7 días. La de 30 queda
implementada y probada, esperando a quien pueda declararla.

**LA ANTIGÜEDAD SE MIDE AL ALZA.** Los paneles guardan `YYYY-MM-DD` sin hora, así
que un panel se ancla a las **00:00 de su día** y la antigüedad calculada es un
límite superior. Con la ventana de 24 h eso significa que un panel de ayer no la
cumple aunque se tomara anoche: preferimos pedir una creatinina de más que
dosificar con una que no se puede demostrar reciente. Una fecha ilegible **no se da
por reciente**.

**QUÉ NO CUBRE, DECLARADO.**

- **«IRA» no se reconoce como renal aguda.** En México se dicta muchísimo más como
  *infección respiratoria aguda*, y meterla convertiría cada catarro en una ventana
  de 24 h. Se reconocen las formas escritas completas y «AKI». Lo que no está en la
  lista **no se vigila** — declarado, no dado por bueno (regla 5).
- **La ERC no es inestable.** Un paciente con enfermedad renal crónica estable es
  justamente el caso de la ventana larga; meterlo en 24 h haría de todo nefrópata
  una urgencia.
- **No bloquea la firma, no retira la recomendación y no pide el laboratorio por su
  cuenta.**

**LA PRUEBA.** `src/__tests__/la-funcion-renal-caduca-se-dice.test.ts` (27 casos),
una por regla de la política y comparadas contra la política, no contra la
implementación. Un caso recorre el módulo y comprueba que **lo único numérico son
las tres ventanas**.

---

## REG-376 — cuándo el cambio de un analito importa, y cuándo sólo es un número distinto

**QUÉ FALTABA.** REG-369 llevó la trayectoria del laboratorio a donde se prescribe
y dejó abierto, como `NEEDS_CLINICAL_REVIEW`, cuánto tiene que moverse un analito
para que el cambio importe. Hasta hoy la frase decía «subió desde 1.3 el
2026-01-10» y nada más: correcto, y sin usar los umbrales que **este repositorio ya
tenía definidos**.

**LA POLÍTICA, DEL DUEÑO, 29-AGO-2026.** Lo primero que dijo es lo que este módulo
protege: **no existe un porcentaje universal seguro para todos los analitos; no se
implementa un umbral global del 10 %, del 20 % ni de ninguno.** Y después, en orden:

1. Usar primero los **umbrales clínicos ya definidos** para ese analito.
2. Si existe **RCV / variación biológica validada**, puede usarse.
3. **Cruzar un límite de decisión importa aunque el cambio porcentual sea pequeño.**
4. Sin regla específica validada: **mostrar delta absoluto y relativo, pero NO
   etiquetarlo como «clínicamente significativo»**.
5. **No inventar umbrales.**

**EL ARREGLO.** `laboratorio/que-cambio-de-verdad.ts` (puro) calcula **siempre** los
dos deltas, y marca relevancia **sólo** cuando el valor cruzó una línea que este
repositorio ya tenía escrita, de dos tablas con su propia procedencia:

- `ANALITOS[].refMin/refMax` — el rango de referencia por analito.
- `CRITICOS` de `hospital/lab-criticos.ts` — los valores de pánico, que además
  saben de unidades y distinguen **«no evaluable» de «normal»**.

El módulo **no define ni una sola cifra**, y hay un caso que recorre su código y
falla si aparece cualquier número que no sea el `0` de comparar y el `100` de pasar
a porcentaje.

**LOS DOS CASOS QUE RESUMEN LA POLÍTICA**, los dos en el golden:

```
creatinina 0.6 → 0.9   = +50 %, no cruza nada  → NO se marca relevante
creatinina 1.25 → 1.35 =  +8 %, cruza 1.3      → SÍ, y se dice qué línea cruzó
```

**LO QUE NO SE CALIFICA.** «Volvió dentro del rango» puede ser mejoría o puede ser
una transfusión: se **nombra**, no se juzga. Un caso recorre la frase y falla si
contiene *mejor*, *empeoró*, *significativo* o *alarma*.

**EL RCV NO SE INVENTA: SE DECLARA QUE NO LO HAY.** El punto 2 de la política lo
permite «si existe validada», y en este repositorio **no existe ninguna**.
`RELEVANCIA_POR_RCV` queda **vacía y congelada**, con su sitio marcado: el día que
entre una tabla con su fuente citada, los casos que hoy salen «sin regla validada»
pasarán a tenerla sin tocar nada más. Rellenarla de memoria sería inventar una
cifra clínica.

**QUÉ NO CUBRE, DECLARADO.**

- **Un analito fuera del catálogo no se juzga**: sin rango definido no hay línea que
  cruzar, y salen los deltas a secas.
- **Un analito sin rango crítico definido queda `criticoEvaluable: false`**, que no
  es lo mismo que «no cruzó»: un resultado no se da por bueno porque el motor no
  supo leerlo.
- **No decide conducta.** Ningún motor cambia de comportamiento por esto: es lo que
  el médico lee al lado del número.

**LA PRUEBA.** `src/__tests__/no-hay-un-porcentaje-universal.test.ts` (20 casos).

**UN TRINQUETE AJENO ACTUALIZADO.** `el-paciente-completo-llega-al-motor` contaba
**dos** consumidores del cuadro de problemas —el copiloto y la evidencia— y ahora
son **tres**: REG-375 lo usa para saber si hay daño renal agudo, y de eso depende
qué ventana se le exige a la creatinina. Lo que el guardián protege sigue siendo lo
mismo: que ningún consumidor reciba la lista pelada de hoy.

---

## REG-377 — el material de origen de una nota firmada se podía alterar sin que el sello lo notara

**QUÉ FALLABA, Y DESDE CUÁNDO SE SABÍA.** `CAMPOS_NO_SELLADOS_V3` lo tenía escrito
desde REG-199, con su fecha de caducidad puesta:

> «`transcripcionMotor` **ES material de origen y le CORRESPONDE ir sellado** — pero
> añadirlo al canónico v3 cambiaría el hash de TODAS las notas ya firmadas y las
> volvería «alterada» de golpe: la falsa alarma exacta de REG-060. Entra al sello
> cuando se suba a `hashVersion` 4, que es su propia versión con su propia
> migración.»

Mientras tanto, en una nota **firmada**, lo que oyó el reconocedor —la fuente de la
que se re-proyecta la nota, de la que cuelga el aprendizaje del dictado y de la que
colgaría cualquier discusión medicolegal— se podía cambiar y el sello seguía
diciendo «verificada».

**POR QUÉ NO SE HABÍA HECHO ANTES.** Porque hacerlo mal es peor que no hacerlo:
subir la versión sin conservar el canónico viejo marca «alterada» **todo** el
histórico firmado, que es exactamente la alarma roja que el sello existe para no dar
nunca. Se hace ahora porque el `FINAL-READINESS` lo tenía como uno de sus cinco
pendientes, y porque la maquinaria para hacerlo bien **ya estaba diseñada**:
`CANONICO` despacha por la versión que la nota **declara**, y por eso las notas v2
siguen verificando hoy, tres versiones después.

**EL ARREGLO.** `canonicoV4` = todo lo de v3 **más `transcripcionMotor`**, con la
`v: 4` literal —sellar la versión declarada sería auto-referencia y permitiría
bajarle la versión a un sello para re-verificarlo con un juego de campos más corto—.
`HASH_VERSION = 4`, `VERSIONES_VERIFICABLES = [2, 3, 4]`, y `CANONICO[4]`.

`CAMPOS_SELLADOS_V3` / `CAMPOS_NO_SELLADOS_V3` se conservan **intactos, como acta
histórica**: son lo que cubre el sello de las notas ya firmadas y de ahí sale lo que
la pantalla les dice. `CAMPOS_NO_SELLADOS_V4` se **deriva** de la de v3 —no se copia
a mano— porque dos listas escritas a mano acaban diciendo cosas distintas, que es el
defecto que REG-199 arregló.

**REG-060, OTRA VEZ, EN EL MATERIAL DE ORIGEN.** `transcripcionMotor` entra además a
`OPCIONALES_SELLADOS_V3`, la lista que `normalizarParaSello` usa para convertir
`undefined` en `null` **antes** de hashear. Sin eso, el hash se calcularía sobre
`null` mientras `stripUndefined` + el MERGE de `updateDoc` conservan el valor viejo
en Firestore: el documento guardado dejaría de corresponder a su propio sello. Para
una nota v3 es inocuo —su canónico no mira ese campo—, así que la lista es una sola.

**LO QUE SOBRABA, Y QUIÉN LO CAZÓ.** La primera versión de este cambio abría además
dos ranuras vacías en `NotaMedica` —`procedimientos`, `dispositivos`— selladas desde
el primer día, con el argumento de que el canónico es una lista cerrada y añadirles
un campo después obligaría a un v5.

**`campos-sin-usar.test.ts` las rechazó**, y al revisar el argumento no se sostenía.
Ese guardián dice que «un campo declarado y sin usar es una promesa del modelo», y
esa promesa habría quedado en pie indefinidamente: documentar un procedimiento es un
acto del médico (REG-370) y hoy nada lo captura. Lo que se compraba con esa deuda
tampoco valía nada: subir de versión es justo lo que este módulo sabe hacer, y un v5
cuesta una entrada en `CANONICO` y su prueba. **Se quitaron**, y el golden guarda un
caso que se pone rojo si alguien vuelve a ampliar el canónico de v4.

**LA PRUEBA.** `src/__tests__/el-sello-v4-no-rompe-lo-firmado.test.ts` (17 casos).
Al revés: se prueba que re-verificar una nota **v3** con el algoritmo de v4 la
marcaría «alterada» —el defecto que este cambio evita, reproducido— y que alterar
`transcripcionMotor` **sí** se detecta en una nota v4 y **no** en una v3, que es la
diferencia exacta que introduce la versión.

**QUÉ NO CUBRE, DECLARADO.**

- **No re-sella las notas ya firmadas.** Una nota v3 sigue siendo v3, con su
  algoritmo y con lo que su sello no cubre dicho en pantalla. Re-sellarlas sería
  reescribir documentos inmutables.
- **No añade procedimientos ni dispositivos al expediente.** Cuando exista quien los
  escriba, entrarán con su propio v5 — y v4 queda como la migración ya recorrida que
  demuestra que eso no rompe lo firmado.
- **No cambia qué campos NO deben sellarse**: los que se escriben después del hash,
  los derivados y las transiciones legítimas posteriores a la firma siguen fuera, con
  su razón escrita.

**UN TRINQUETE AJENO ACTUALIZADO.** `e0-12-sello-integridad` clasifica cada campo de
`NotaMedica` contra la partición del sello **vigente**, que ahora es la de v4; el
caso que detalla una nota v3 sella explícitamente con `sellar(nota, 3)`, porque
existe precisamente para demostrar que una v3 sigue verificando después de que
`HASH_VERSION` subiera.

---

## REG-378 — el arnés de carga no existía, y al escribirlo el formulario obligaba a mentir

**QUÉ FALTABA.** WS-02 llevaba `NOT_DONE` con una asimetría rara:
`validate-consultorio-load-result.mjs` sabía juzgar un JSON de carga desde hacía
tiempo, y `generate-consultorio-load-fixture.mjs` sabía fabricar el corpus
sintético. **En medio no había nada.** Un validador que nunca había validado nada
y una escala —2 k … 100 k— que nadie había medido.

**EL DEFECTO DE VERDAD, QUE SALIÓ AL ESCRIBIR EL ARNÉS.** El validador exige que
los seis bloqueadores incondicionales —fuga entre consultorios, borrador perdido,
pantalla en blanco, lectura sin cota, violación de idempotencia, fallo silencioso
de proveedor— sean **enteros no negativos**. Un arnés que corre donde no puede
observar alguno sólo tiene dos salidas: escribir `0`, o no escribir el campo.

Y `0` **no significa «no lo miré»: significa «lo miré y no había ninguno»**. Un
cero por no haber mirado es la ausencia de dato tratada como dato de ausencia
—regla 4 de seguridad clínica, dicha en lenguaje de operación— con un coste del
mismo orden: quien lea ese JSON creerá que se comprobó que un consultorio no ve
los expedientes de otro.

**LA CAUSA RAÍZ.** Un esquema que sólo admite números **obliga a mentir** a quien
no midió. El hueco no estaba en el validador ni en el arnés por separado, sino en
que nadie había tenido que rellenar ese formulario todavía.

**EL ARREGLO.** `scripts/product/run-consultorio-load.mjs` escribe **`null`** en
todo lo que no midió, con una lista `noMedido` que dice, campo por campo, qué
entorno haría falta. El validador **rechaza** ese informe, y es la respuesta
correcta: todavía no es evidencia. **No se ablandó el validador ni se ablandó el
arnés.**

**LO QUE SÍ MIDE, Y CONTRA QUÉ.** Contra el emulador de Firestore con
`firestore.rules` **cargadas de verdad** y el de Auth acuñando usuarios reales.
Eso hace que la fuga entre consultorios se pueda medir: un médico del consultorio
A intenta **leer y escribir** el expediente del B, y quien decide es la regla
desplegable, no una promesa.

**LA EVIDENCIA GUARDADA** — `docs/audit/ws-02-carga/emulador-100-medicos.json`:

```
100 médicos · 20 consultorios · 8 000 peticiones · 50 concurrentes
p50 59.8 ms · p95 141.1 ms · p99 187.9 ms · 0 errores
fuga entre consultorios: 0 en 200 sondas (100 de lectura + 100 de escritura)
idempotencia: 0 violaciones · durable: sí · recuperación: sí
```

**TRES DEFECTOS DEL PROPIO ARNÉS, LOS TRES CAZADOS CORRIÉNDOLO:**

1. **Una sola sesión para todos los médicos.** `signInWithCustomToken` sustituye
   al usuario actual, así que las N escrituras salían con la identidad del
   **último** que entró. Lo caro no era el `PERMISSION_DENIED` en masa: es que la
   sonda de fuga entre consultorios habría estado midiendo a un usuario que no era
   quien decía ser. Un arnés que se equivoca de identidad no mide aislamiento:
   mide otra cosa y la llama aislamiento.
2. **La forma de la nota no era la que exigen las reglas.** Toda nota nace en
   borrador (REG-017) y al firmar `metadata.medicoId` tiene que ser quien firma.
   Escribir una forma que las reglas rechazan no mide carga: mide sintaxis.
3. **Los documentos de la corrida anterior.** Sin identificador por corrida, la
   segunda ejecución se encontraba sus propias notas ya firmadas y la regla
   —correctamente— le negaba tocarlas: medía la latencia de sus propios rechazos.
   Un arnés que no es repetible no mide, adivina.

**LA PUERTA QUE NO SE PUEDE ABRIR SOLA.** `--target` sólo acepta `emulator`, y sin
`FIRESTORE_EMULATOR_HOST` el arnés se niega a arrancar: sin ella los SDK hablarían
con el proyecto **vivo** por omisión. Meter carga sintética junto a expedientes
reales lo autoriza el dueño, así que la puerta vive en el código y no en la
costumbre de quien lo corre.

**LA PRUEBA, AL REVÉS.**
`src/__tests__/el-arnes-de-carga-no-inventa-un-cero.test.ts` (10 casos). El caso
que lo justifica todo le mete el defecto: sustituye los `null` del informe REAL
por `0` y comprueba que el validador **lo acepta como evidencia válida y declara
cero bloqueadores** — sin que nadie haya mirado ni uno. El `null` es lo único que
separa un informe honesto de una evidencia fabricada que pasa la puerta.

**QUÉ NO CUBRE, DECLARADO.**

- **No prueba que el producto aguante 100 000 pacientes.** La evidencia es de 100
  médicos contra un emulador local, y lleva su `environment` escrito.
- **Un emulador no es producción**: no tiene latencia de red, ni los índices
  desplegados, ni contención real. Lo que sí es real ahí son `firestore.rules`, y
  por eso la sonda de aislamiento vale.
- **Sigue sin medir lo que declara no medir**: pantalla en blanco, borrador
  perdido y fallo silencioso de proveedor son de navegador y de proveedor; las
  cuatro colas no existen sin proveedores detrás; y la lectura sin cota es una
  propiedad estática que vigila su propio guardián.

---

## REG-379 — cuatro consultas que ya se hacían pedían un índice que nadie había declarado

**CÓMO SE DESCUBRIÓ.** Preparando el despliegue de índices —uno de los cinco
pendientes del `FINAL-READINESS`, y de los que sólo el dueño ejecuta— se contaron
las consultas del árbol que Firestore **no puede servir sin un índice compuesto**:
una igualdad (o un `in`) sobre un campo y un `orderBy` sobre **otro**.

Salieron cuatro, y `firestore.indexes.json` declaraba **cero** de las cuatro.

| Colección | La consulta | Qué pantalla es |
|---|---|---|
| `arco_requests` | `estado in [recibida, en_proceso]` → `orderBy fechaSolicitud` | La bandeja de derechos ARCO |
| `farmacia` | `activo == true` → `orderBy nombre` | La lista de la farmacia |
| `farmacia_movimientos` | `itemId ==` → `orderBy fecha` | El rastro de un controlado |
| `reviews` | `estado == publicada` → `orderBy publicadaEn` | La página **pública** del médico |

**POR QUÉ IMPORTA.** Firestore no degrada una consulta así: **la rechaza** con
`FAILED_PRECONDITION`. El fallo no aparece al escribir el código ni en ninguna
prueba —una tienda en memoria no exige índices— sino en el navegador de quien la
usa. Una de las cuatro es la página pública del médico, que ve cualquiera.

**LA CAUSA RAÍZ, Y ES LA PARTE INTERESANTE.** `docs/ops/INDICES-DE-FIRESTORE.md`
existe desde REG-352 y su regla es explícita: «ninguna consulta nueva puede
depender de un índice de este archivo hasta que esté desplegado». Los cuatro
índices que ese documento declara son **anticipados** —para consultas que el
código todavía no hace— y mientras tanto cada módulo escribe la versión peor que
sí funciona y declara el sacrificio.

O sea: **la regla se estaba cumpliendo hacia adelante y se había incumplido hacia
atrás**. Nadie había contado las consultas que ya existían. Un registro que se
escribe mirando sólo el trabajo futuro no descubre la deuda que ya está puesta.

**LO QUE ESTE ARREGLO NO AFIRMA.** Que esas cuatro estén rotas en producción hoy.
Firestore crea índices a mano desde la consola cuando alguien sigue el enlace del
error, y un `deploy --only firestore:indexes` **no borra** los que no estén en el
archivo: el proyecto vivo puede tenerlos aunque el repositorio no los declarara.
Lo que sí estaba roto era la **declaración** — un consultorio nuevo, un proyecto
restaurado o una recreación desde este repositorio se habría quedado sin ellos.
Cuáles existen de verdad se mira en la consola del proyecto, del otro lado, y eso
no puede vivir en una prueba (regla «el dato tiene que LLEGAR»).

**EL ARREGLO.** Los cuatro índices declarados, y
`src/__tests__/el-indice-que-nadie-declaro.test.ts` (4 casos) **deriva** la lista
del árbol en vez de recordarla: recorta cada `query(...)` por sus paréntesis,
resuelve los alias de colección (`const COL = clinicId => collection(...)`) y
compara contra el archivo.

**UN DEFECTO DEL PROPIO GUARDIÁN, CAZADO ANTES DE CONFIARLE NADA.** La primera
versión buscaba `query\(([\s\S]*?)\)` y se paraba en el paréntesis de cierre de
`collection(...)`, que va dentro: encontraba **cero** consultas compuestas y daba
todo por bueno. Por eso el archivo tiene un caso que comprueba que el lector
**lee** —un guardián que no encuentra nada siempre pasa— y otro que le quita a
mano el índice de `reviews` y comprueba que su consulta queda detectada.

**QUÉ NO CUBRE, DECLARADO.**

- **Sólo ve el SDK de cliente.** Lo que corre por el SDK admin en las rutas de
  servidor no lo lee este guardián: queda declarado, no tapado.
- **No comprueba el ORDEN de los campos del índice**, que a Firestore le importa.
  Un índice con los campos correctos en el orden incorrecto pasaría y fallaría en
  producción.
- **No sabe si el índice está construido.** Declararlo y desplegarlo son dos
  actos, y el segundo es del dueño.

---

## REG-380 — WS-05 se había comprobado entero LEYENDO el árbol, y nunca abriendo el producto

**QUÉ FALTABA.** REG-342 y REG-355 cerraron los dos mecanismos del rebote de
iPhone —los escritores de scroll que no preguntaban y el encadenamiento sin
`overscroll-behavior`— con pruebas que **leen el repositorio**. La regla de diseño
de esta casa dice que eso no basta, y lo dice con todas las letras: «no se aprueba
una interfaz leyendo el código… se lanza el producto, se mira, se recorre el flujo
de verdad, se prueba en móvil, se prueba con teclado, se comprueba la consola».

Ninguna de esas seis cosas se había hecho nunca sobre las páginas públicas a
tamaño de teléfono. El `e2e` existente comprueba que cargan y qué cabeceras
traen — no cómo se ven ni si se pueden tocar.

**EL ARREGLO.** `e2e/telefono.spec.ts`, en el proyecto nuevo `telefono-chromium`,
sobre el **mismo** Chromium que el CI ya instala (no descarga un motor más):

- **desbordamiento horizontal** en las ocho rutas públicas — el defecto de móvil
  que más se cuela, porque nadie lo ve en un escritorio ancho;
- **objetivo táctil ≥ 44×44** en los controles visibles de la landing;
- **consola limpia de lo SUYO**;
- **foco visible** al primer `Tab`.

Corre en el job `e2e-publico` del CI, contra el build del PR.

**LO QUE ESTE ARREGLO NO PUEDE PROBAR, Y POR ESO WS-05 SIGUE SIN `PROVEN`.** El
rebote de iPhone son dos comportamientos de **WebKit** y ninguno existe en
Chromium: `overflow-anchor` —que Chromium sí implementa, así que compensa
justamente la escritura tardía de scroll que en un iPhone se siente— y el rebote
elástico del documento al encadenar el gesto. Un verde de `telefono-chromium`
**no es un iPhone probado**, y por eso el proyecto se llama así y no `iphone`.

`playwright.config.ts` ya declara un proyecto `iphone-safari` sobre WebKit, que es
el que daría esa prueba. **No se pudo ejecutar**: el binario de WebKit no está
instalado en este entorno y su descarga está bloqueada
(`Failed to download WebKit 26.5`). Queda como lo que era: una acción externa.

**LA CONSOLA SE JUZGA POR ORIGEN, Y NO POR EL TEXTO DEL ERROR.** La primera
versión exigía la consola limpia a secas y salía roja por
`net::ERR_TUNNEL_CONNECTION_FAILED`: una red que corta las salidas a internet hace
fallar cualquier recurso de tercero, y eso no dice nada del producto. Filtrar ese
texto habría sido el error fácil — un 404 de un recurso **propio** produce un
mensaje parecido y sí es un defecto. Se clasifica por origen, y lo de fuera se
**enumera** en el mensaje en vez de desaparecer.

**LA PRUEBA.** `e2e/telefono.spec.ts` (11 casos), verde dos veces seguidas contra
el build de esta rama. No se sella en `invariantes-clinicos.json` porque el sello
cubre la suite de vitest; su compuerta es el job de CI.

**QUÉ NO CUBRE, DECLARADO.**

- **Sólo rutas públicas.** El camino clínico necesita sesión, y la cuenta de
  prueba dedicada sigue siendo un paso del dueño — lo mismo que ya declaraba
  `playwright.config.ts`.
- **Mide la landing, no las 80 pantallas.** El objetivo táctil y el foco se miden
  donde se puede entrar sin sesión.
- **Ni un motor que no sea Chromium.** Firefox, WebKit, Safari móvil y Android
  siguen declarados en el config y sin correr en ninguna parte, como ya decía el
  comentario del CI: la matriz completa se lanza a mano.

---

## REG-381 — el respaldo se leía bien y nadie había comprobado que llegara a Firestore

**QUÉ FALTABA.** `npm run simulacro:respaldo` ensaya el ida y vuelta del NDJSON
**en memoria**: lo lee, lo reenraiza, cuenta y cronometra. El `FINAL-READINESS`
decía exactamente qué se quedaba fuera: «reglas, índices, latencia y el tope de
500 escrituras por transacción no los da ninguna tienda en memoria».

Y ésa es la mitad donde un respaldo falla de verdad. **REG-160 fue justo eso**: el
importador validaba la colección declarada y **escribía en la ruta**, que era otro
campo. Las pruebas en memoria pasaban todas.

**EL ARREGLO.** `scripts/simulacro-restauracion-firestore.mjs` — la regla «el dato
tiene que LLEGAR» aplicada al respaldo. Escribe contra un Firestore de verdad, con
el `leerLinea` y el `reenraizar` **del producto**, y después **vuelve a leer cada
documento del otro lado** y compara `orden` uno por uno.

**EL ACTA** — `docs/audit/ws-02-carga/restauracion-emulador.json`:

```
2 000 documentos · lote de 400 · 0 líneas rechazadas · archivo completo
escritos 2 000 · releídos 2 000 · faltantes 0
513 ms de escritura (3 898 doc/s) · 142 ms de relectura
```

**LO QUE SE INTENTÓ MEDIR Y NO SE PUDO — Y CORRIGE AL PROPIO FINAL-READINESS.**
El tope del lote. Se probó de verdad: en modo `--lote-roto` el ensayo escribe
lotes de **600** y **el emulador los acepta sin error**. O sea que salir de la
memoria **no gana esa dimensión**, y el `FINAL-READINESS` la contaba entre lo que
sí ganaría. Queda declarado en el acta —`topeDelLoteComprobado: false`— en vez de
dado por bueno, y la bandera se conserva porque el día que se corra contra un
proyecto de verdad es justo la que da la respuesta.

El `LOTE = 400` del importador sigue siendo lo correcto —es el número documentado
y deja margen—, pero que aquí pase un 600 no demuestra que pasaría en producción,
ni al revés.

**UN DEFECTO DEL PROPIO ENSAYO, Y ES EL QUE ENSEÑA MÁS.** La primera versión
construía las líneas con `ruta`/`datos` en vez de `_ruta`/`_coleccion`, que es el
formato real del exportador. `leerLinea` las rechazó **todas**… y el ensayo salió
**en verde**, porque la única comprobación era `releidos === aEscribir.length` y
las dos valían cero. **Un ensayo de restauración que restaura un consultorio vacío
y se declara con éxito** es el mismo modo de fallo que este archivo persigue, en
el instrumento que lo persigue. Ahora sale con error si no hay nada que escribir,
y su golden comprueba que el acta guardada no es la de un archivo vacío.

**LA PRUEBA.** `src/__tests__/el-respaldo-llega-a-firestore.test.ts` (7 casos).
Compara el `LOTE` del ensayo contra la constante **de la ruta del importador**, no
contra una copia, para que los dos no se separen; y comprueba que el acta declara
lo que no comprobó.

**QUÉ NO CUBRE, DECLARADO.**

- **No es el RTO.** Esto restaura un NDJSON en una base ya viva. Resucitar una
  base perdida es `gcloud firestore databases restore` + PITR, configuración de la
  consola y del dueño.
- **No prueba las reglas.** El importador usa el SDK admin, que las ignora por
  diseño; quien prueba el aislamiento es el arnés de carga (REG-378), con sesiones
  de cliente.
- **El emulador no es producción**: sin latencia de red y sin contención real, los
  doc/s de aquí son un techo, no una promesa.

---

## REG-382 — el tablero del programa podía perder un dominio entero sin ponerse rojo

**CÓMO SE DESCUBRIÓ.** Reconciliando `docs/product/AUSCULTA-MASTER-BOARD.md`
contra el alcance canónico completo del programa, antes de seguir implementando.

**QUÉ FALTABA.** Seis dominios del alcance **no tenían una sola fila** en el
tablero:

```
voz · aprendizaje · autoridad de la automatización ·
WhatsApp · razonamiento · accesibilidad
```

Ninguno estaba `DEFERRED`. Ninguno estaba `BLOCKED_EXTERNAL`. **No estaban.** Y
el producto tiene un subsistema de voz enorme, con regla propia
(`.claude/rules/voice-asr.md`) y decenas de pruebas: el trabajo existe, lo que no
existía era el requisito que lo gobierna.

**LA CAUSA RAÍZ.** Ningún documento derivado puede notar la ausencia de algo. Un
tablero, una nota de PR y un `FINAL-READINESS` se escriben **mirando lo que hay**;
lo que se cayó no aparece en ninguno de los tres, y cada uno hereda el hueco del
anterior con más autoridad que el anterior. Es `depende_de_recordar` en su forma
más cara: no un dato desfasado, sino un dominio entero evaporado.

**EL ARREGLO.** `src/lib/programa/requisitos.ts` — el censo, con **78 requisitos**
y lo que cada estado obliga a escribir:

- `PROVEN` exige **evidencia, comando reproducible y resultado observado**. Los
  tres. Un `PROVEN` sin comando es una opinión con formato de dato.
- `BLOCKED_EXTERNAL` exige la **acción externa exacta** y la **preparación interna
  ya hecha**. Sin lo segundo, «bloqueado» es la palabra que se usa para no
  terminar algo.
- Todo lo demás exige `queFalta` accionable.
- `NOT_PROVEN` **no es un estado**: se calcula como la unión de todo lo que no
  está probado, bloqueado o diferido, para que no se pueda vaciar renombrándolo.

`censo-sellado.json` es su trinquete: un id que desaparece pone el CI en rojo, y
un estado que **baja** también. Subir no necesita permiso; bajar hay que
declararlo.

**LO QUE EL CENSO ENSEÑÓ AL LLENARLO.** El reparto real, contado y no estimado:

```
NOT_STARTED 31 · PARTIAL 24 · PROVEN 11 · BLOCKED_EXTERNAL 9
IMPLEMENTED_NOT_PROVEN 1 · NEEDS_CLINICAL_REVIEW 1 · DEFERRED_BY_OWNER 1
```

**56 requisitos internamente accionables** siguen abiertos. El `FINAL-READINESS`
hablaba de «cinco pendientes»: era cierto para lo que ese documento cubría, y
falso como retrato del programa. Los dos números conviven ahora sin contradecirse
porque cada uno dice de qué habla.

**TRES COSAS QUE EL CENSO NO DEJA COLAPSAR.**

1. **Usuarios registrados no es concurrencia activa.** Cada escalón —2 k, 10 k,
   15 k, 20 k, 30 k, 50 k, 100 k— es una fila propia, y hay una fila aparte para
   definir la concurrencia. Mezclarlos es cómo un «aguanta 100 k» acaba
   significando algo que nadie midió.
2. **Pacientes por médico** —10 k, 20 k, 30 k, 50 k— igual.
3. **Las fuentes canónicas de evidencia son 29 y el catálogo del producto tiene
   12.** La tentación es igualar las dos listas y declarar el trabajo hecho; eso
   borraría de la vista todo lo que falta. Un caso comprueba que la lista canónica
   sigue siendo **más larga** que el catálogo.

**LA PRUEBA, AL REVÉS.**
`src/__tests__/el-programa-no-pierde-requisitos.test.ts` (14 casos). Probado
quitando `TR-VOZ.pipeline` del censo: caen **dos** casos —el trinquete de
identidades y la cobertura de dominios—, que es exactamente el defecto original
reproducido.

**QUÉ NO CUBRE, DECLARADO.**

- **No comprueba que un `PROVEN` sea verdad.** Comprueba que declare cómo se
  reproduce. Quien miente en `resultado` pasa este guardián; lo que no puede es
  hacerlo sin dejar por escrito un comando que otro corre.
- **No mide cobertura del alcance.** Que un dominio tenga una fila no significa
  que tenga todas las que le tocan: significa que no está evaporado.
- **No sustituye al tablero en prosa.** La causa raíz, la historia y la cita del
  archivo viven allí, y eso no cabe en una tabla de datos.

---

## REG-383 — el invariante central de WS-03 estaba escrito y nunca medido

**QUÉ FALTABA.** «Para enseñar 20 pacientes no se descargan 50 000» es el
invariante que gobierna todo WS-03, y vivía **sólo en el tablero**.
REG-341/350/351/352 acotaron las lecturas más caras y sus pruebas comprueban que
el código **diga** `limit()`; ninguna comprobó qué **trae de vuelta** una consulta
cuando el consultorio es grande de verdad.

Esa diferencia ya costó una vez aquí: REG-160 validaba un campo y escribía en
otro, con todas las pruebas en verde. «El dato tiene que LLEGAR» tiene su gemelo
en este eje — **el dato tiene que NO llegar**, y lo que se mide es el volumen que
cruza el cable, no la forma del código que lo pide.

**CÓMO SE MIDE.** Se envuelve `getDocs` del SDK modular y se **cuentan los
documentos que cada consulta devuelve**. Después corren las funciones **reales**
del producto —`listarPacientesPagina`, `buscarPacientes`, `listarNotasPagina`—
contra el emulador con `firestore.rules` cargadas y un contexto autenticado de
médico. No hay reimplementación: se sustituye el `db` del producto por el del
emulador y lo que se ejecuta es `src/lib/firestore.ts` tal cual.

La clave está en `RulesTestContext.firestore()`: entrega un handle que el **SDK
modular** acepta, así que el código de producción corre sin tocarlo. El
comentario del entorno decía «SDK compat» y estaba desactualizado.

**DOS TAMAÑOS, NO UNO.** Un solo tamaño no demuestra nada: «21 lecturas con 1 000
pacientes» es compatible con una implementación que lea N/50. Cada corrida
siembra **dos veces**, con un factor de separación grande, y exige que el conteo
no crezca.

**EL RESULTADO, EN LOS CUATRO ESCALONES CANÓNICOS** — con historia, no cascarones:
cada paciente lleva tres notas firmadas.

| Pacientes | Documentos sembrados | Lista (20) | Búsqueda | Historial (10) |
|---|---|---|---|---|
| 200 | 800 | **21** | 125 | 11 |
| 10 000 | 40 300 | **21** | 125 | 11 |
| 20 000 | 80 300 | **21** | 125 | 11 |
| 30 000 | 120 300 | **21** | 125 | 11 |
| 50 000 | **200 300** | **21** | 125 | 11 |

**Completamente plano.** El 21 es 20 más el centinela del cursor —así se sabe si
hay página siguiente sin lanzar una segunda consulta—, y es la única lectura de
más que se acepta. La búsqueda son 5 ventanas de 25: depende de la ventana y de
cuántas estrategias de prefijo apliquen, **nunca del tamaño del consultorio**.

**POR QUÉ LA HISTORIA IMPORTA Y NO SE SIEMBRAN CASCARONES.** Un consultorio de
50 000 documentos vacíos no ejercita nada. La historia es lo que hace grande a una
práctica y es donde una lectura sin cota se vuelve cara, así que la siembra
incluye las notas: 200 300 documentos en el escalón mayor.

**UN CASO QUE VIGILA AL MEDIDOR.** Un contador que se quedara en cero haría pasar
todos los demás casos. Hay uno que exige que las cifras sean mayores que cero y
que se hayan lanzado consultas de verdad — la lección de
`v15-rtc12-la-identidad-no-se-desplaza`, que ya documentó un arnés que reportaba
éxito porque el gesto nunca ocurrió.

**LA PRUEBA.** `emulator/ws03-consultorio-grande.emu.test.ts` (6 casos), en la
suite del emulador que ya corre en el job `aislamiento-tenant` del CI. Por omisión
usa 200 y 2 000 para no alargar el job; `WS03_PACIENTES` sube el tamaño para el
acta de escala.

**QUÉ NO CUBRE, DECLARADO.**

- **No mide autorización.** Siembra con las reglas desactivadas y lee con contexto
  de médico. El aislamiento lo miden `tenant-aislamiento` y, en ejecución, el
  arnés de carga (REG-378).
- **No mide latencia.** Cuenta documentos. La de un emulador local no se parece a
  la de producción y prometerla sería inventar una cifra.
- **No cubre todas las lecturas del producto**: cubre las tres del camino que el
  médico recorre a diario. El inventario completo —44 `getDocs` sin `limit()`
  medidos en su día— sigue abierto.
- **La historia sembrada es uniforme**: tres notas iguales por paciente. Falta la
  distribución realista de medicamentos, laboratorios y órdenes.

---

## REG-384 — el token decía si hubo segundo factor, y el servidor lo tiraba

**QUÉ FALLABA.** El producto tiene **TOTP implementado y funcionando**:
enrolamiento en Configuración, resolución en el login, sobre el multi-factor de
Firebase. Y `auth-server.ts` decodificaba el ID-token y se quedaba **sólo con
`uid` y `email`**.

Firebase pone en ese mismo token `firebase.sign_in_second_factor` —cómo se inició
la sesión— y se descartaba en la línea siguiente. Consecuencia: **ninguna ruta del
servidor podía saber si la sesión que tenía delante había usado el segundo
factor**. Una sesión sin él tenía privilegios idénticos.

Es «el dato tiene que LLEGAR» en la frontera de autenticación: el dato llegaba y
nadie lo leía.

**Y EL PANEL DECÍA OTRA COSA.** `security-controls.ts` declaraba MFA como
`planned`, con el detalle «requiere habilitar Identity Platform **para
implementarlo y probarlo**». Falso: estaba implementado y cableado en dos
pantallas. Un panel de cumplimiento que se equivoca —aunque sea declarando **de
menos**— no sirve en ninguna dirección: si miente hacia abajo hoy, nadie sabe si
miente hacia arriba mañana.

**EL ARREGLO, EN TRES PIEZAS.**

1. `verificarToken` deja de descartar la afirmación y la propaga como
   `segundoFactor` en **las cuatro** puertas que devuelven un acceso.
2. La consola del dueño la exige: **si hay segundo factor enrolado, la sesión
   tiene que haberlo usado**.
3. El panel dice lo que es: `implemented-pending-verification`, con la evidencia
   apuntando a los archivos y al guardián.

**POR QUÉ «SI ESTÁ ENROLADO» Y NO «SIEMPRE».** Exigirlo a secas dejaría al dueño
fuera de su propia consola el día que todavía no ha enrolado nada. La condición se
ata a un hecho comprobable de su cuenta y no a una política que este código no
puede decidir: quien no ha enrolado entra como siempre; quien sí enroló no puede
saltárselo.

**LA VENTANA REAL QUE CIERRA.** Firebase bloquea el **inicio de sesión** de un
usuario enrolado — pero un token emitido **antes** de enrolar sigue siendo válido
hasta que caduca. Quien enrola TOTP porque sospecha que le robaron la contraseña
seguía teniendo, durante esa hora, una sesión abierta con todo.

**DOS PUERTAS MÁS, CAZADAS POR EL PROPIO GUARDIÁN.** La primera versión propagó
`segundoFactor` en dos de las cuatro puertas. El caso que exige *todas* encontró
las otras dos (`verificarModuloIA` y su hermana). Y la razón por la que ese caso
existe es la que lo hace importante: **un campo que existe a veces es peor que uno
que no existe nunca** — una ruta que preguntara `acceso.segundoFactor` habría
recibido `undefined`, que es falsy, y se habría comportado como si nadie hubiera
usado su segundo factor.

**LA PRUEBA.** `src/__tests__/el-segundo-factor-llega-al-servidor.test.ts`
(12 casos). Uno protege una **decisión** y no una línea: si alguien «endurece»
esto quitando la comprobación de enrolamiento, el dueño se queda fuera de su
consola en cuanto caduque su sesión, y el caso se pone rojo. Otro comprueba que la
consulta de factores va **después** de saber que quien llama es el dueño — antes
sería un oráculo gratis para quien pruebe correos.

**QUÉ NO CUBRE, DECLARADO.**

- **Sólo se exige en la consola del dueño.** El coste es una lectura de usuario
  por petición: ahí el tráfico es bajísimo; en el camino clínico habría que pagarlo
  en cada nota. Extenderlo es decisión de política del dueño.
- **No prueba el TOTP contra Firebase.** Prueba que el servidor lee la afirmación
  y actúa. Que Firebase la emita bien es de Firebase.
- **No cubre códigos de recuperación**, que el diseño menciona y el producto
  todavía no tiene.

---

## REG-385 — la regla decía que la automatización no firma, y nada lo impedía

**QUÉ VIGILA.** La regla del programa dice qué puede hacer la automatización
—borradores, contexto, recordatorios, seguimiento, sugerencias, trámites— y qué
**no puede hacer nunca por su cuenta**: diagnóstico confirmado, orden final,
receta final, firma del médico.

**EL HALLAZGO ES POSITIVO, Y ÉSA ES LA MITAD BUENA.** Auditadas las **21 rutas de
`/api` que corren sin sesión de médico** —crons con `Bearer` fail-closed, webhooks
con firma HMAC, rutas públicas con límite de tasa—: **ninguna escribe estado
clínico autoritativo**. La única que toca `notas` es el portal del paciente, y lo
hace con `.get()`.

**EL DEFECTO NO ERA UNA VIOLACIÓN: ERA QUE NADA IMPEDÍA LA PRIMERA.** Un cron al
que mañana se le añade «y de paso marca la nota como firmada» no rompería ninguna
prueba. Es la familia «el charter existía sin encarnar»: la regla escrita, el
comportamiento correcto, y ningún guardián entre las dos cosas.

**EL INVARIANTE MÁS FUERTE, Y POR QUÉ ES ÉSE.** **Ninguna ruta del servidor pone
una nota en `firmada`.** Ninguna, ni siquiera con sesión de médico.

Firmar ocurre desde el cliente, y `firestore.rules` exige allí que el autor
declarado sea quien firma — «nadie firma con la cédula de otro». Pero las rutas de
`/api` usan el **SDK admin, que ignora las reglas**. Una ruta que escribiera
`estado: 'firmada'` saltaría esa regla entera sin que nada lo notara: es
exactamente el modo de fallo de REG-160, donde el importador escribía por un
camino que no pasaba por la validación.

Por eso el guardián no se limita a los caminos automáticos. La firma es un acto
personal y el servidor **no la ejecuta nunca**.

**EL CASO QUE IMPIDE QUE EL ANTERIOR SE VUELVA VACÍO.** «Ninguna ruta escribe
`firmada`» pasaría igual de bien si nadie tocara las notas en absoluto. Hay un
caso que comprueba que el producto **sigue filtrando** por nota firmada
(`where('estado','==','firmada')`): es lo que distingue «no se escribe» de «no se
usa».

**PROBADO AL REVÉS SIN TOCAR EL ÁRBOL.** Un guardián estático se rompe en
silencio —basta con que la expresión deje de casar—, así que se le pasan fuentes
sintéticas con el defecto dentro: una nota firmada desde el servidor, una
autoridad de médico falsificada, y una escritura sobre `notas` con la cadena
partida en cuatro líneas. También se comprueba que **no** confunde una lectura con
una escritura.

**LA PRUEBA.** `src/__tests__/la-automatizacion-no-firma.test.ts` (10 casos).
Reutiliza `limpiarComentarios` del analizador de autorización que ya existía —los
comentarios de este repo citan a propósito los nombres de guardián, y sin
limpiarlos todo son falsos positivos.

**QUÉ NO CUBRE, DECLARADO.**

- **Es estático.** Lee el árbol, no ejecuta las rutas. Una escritura armada en
  tiempo de ejecución a partir de cadenas se le escapa; lo que caza es la forma en
  que este defecto se escribe de verdad.
- **No cubre lo que el modelo REDACTA.** Que la IA no invente una firma dentro del
  texto es otro problema y vive en WS-12.
- **No sustituye a las reglas.** Las reglas protegen al cliente; esto protege el
  camino que las reglas no ven.

---

## REG-386 — la frontera entre preferencia y política clínica no la sostenía nada

**QUÉ VIGILA.** El producto aprende del médico: pares de una palabra por una
palabra, vistos dos veces, que no tocan cifra, unidad ni par prohibido, y nunca
partes del nombre del paciente.

`aprendizaje-del-medico` cubre **qué se puede aprender**; `sesgo-llega-al-motor-bueno`
cubre **que llegue al motor**. Lo que no cubría nadie es la frontera del otro lado:
**que una preferencia no pueda bajar una defensa**.

**POR QUÉ IMPORTA MÁS DE LO QUE PARECE.** La regla de voz de esta casa lo dice en
una línea: *«sólo sesga: saber qué palabra dice el médico no es permiso para
cambiarla»*. El día que un módulo de dosis, de alergias o de interacciones leyera
el vocabulario aprendido, la costumbre de un médico se habría convertido en
criterio clínico — **y sin que nadie lo decidiera**, porque un `import` no se lee
como una decisión de política.

**CÓMO SE COMPRUEBA: EL GRAFO TRANSITIVO, NO UN `grep`.** Un `grep` sólo vería el
import de primer nivel. La forma real en que esto pasaría es a través de dos o
tres saltos, que es justo lo que nadie ve al revisar un diff. El guardián recorre
el grafo desde **cada** módulo de `src/lib/seguridad` y `src/lib/clinical` —la
lista se deriva del árbol, así que un motor nuevo queda vigilado sin que nadie se
acuerde— y comprueba que ninguno alcanza `asr/aprendizaje*`.

**Y NADIE PUEDE SALTARSE EL GRAFO YENDO DIRECTO A FIRESTORE.** El grafo no vería a
un motor que escribiera la ruta de la colección a mano. Esa ruta tiene **una sola
definición** —el propio módulo lo dice: «dos rutas distintas serían dos
vocabularios»— y hay un caso que la deriva y comprueba que ningún motor la nombre.

**EL BUSCADOR DE CAMINOS, PROBADO AL REVÉS.** Un guardián de grafos falla en
silencio: una ruta mal resuelta hace que `alcanza()` devuelva `null` siempre y
todo pase por la razón equivocada. Se le pide un camino **que sabemos que existe**
—la pantalla de consulta sí llega al aprendizaje— y tiene que encontrarlo. Y otro
caso comprueba que los archivos destino existen donde el guardián cree.

**LA OTRA MITAD, PARA QUE «NO CORRIGE» NO SEA CIERTO Y VACÍO.** Se comprueba que
lo aprendido **sigue viajando** como vocabulario de sesgo en el camino de la
grabación. Sin eso, «el corrector no lo lee» pasaría igual de bien si el
aprendizaje no llegara a ninguna parte.

**LA PRUEBA.** `src/__tests__/lo-aprendido-no-baja-una-defensa.test.ts` (7 casos).

**QUÉ NO CUBRE, DECLARADO.**

- **No prueba que el sesgo funcione**: eso es `sesgo-llega-al-motor-bueno`.
- **No cubre lo que el médico escribe a mano en la nota.** Editar el texto es su
  acto y su autoridad; esto vigila el vocabulario que el sistema deriva solo.
- **Es estático.** Una lectura armada en tiempo de ejecución se le escapa al
  grafo — de ahí el caso que vigila la ruta de la colección.

---

## REG-387 — «¿esta evidencia aplica a ESTE paciente?» no la contestaba nadie

**QUÉ FALTABA.** WS-09 estaba `NOT_STARTED`, y no era «parcial»: `grep
aplicabilidad` sobre `src/` no devolvía **nada**. La adaptación al paciente era
**sólo por prompt** —«personaliza por edad, comorbilidades y alergias»— sin
compuerta determinista, sin cruce, y sin forma de decir «este paciente no cumple
la población del estudio».

Un ensayo hecho en adultos de 18 a 65 años, que excluyó embarazadas y a quien
tuviera TFG < 30, se le enseñaba **igual** al médico con un paciente de 82 y TFG
de 22 delante.

**LA DECISIÓN DE DISEÑO MÁS IMPORTANTE: NO EXISTE EL VEREDICTO «APLICA».**

El máximo que este motor puede decir es **`nada_lo_excluye`**.

Decir «aplica» afirmaría haber leído y comprobado **todos** los criterios, y el
motor sólo entiende con certeza unos pocos patrones. Un motor que redondea su
ignorancia hacia arriba es peor que no tenerlo: le da al médico una tranquilidad
que nadie comprobó. `nada_lo_excluye` dice exactamente lo que hizo —buscó motivos
para excluir a este paciente y no encontró ninguno **de los que sabe buscar**— y
trae la cuenta de los que no supo leer.

**LAS CIFRAS SALEN DEL CRITERIO, NUNCA DEL MÓDULO.** Cuando un criterio dice
«mayores de 65 años» o «TFG < 30», el número sale del texto del estudio. Se prueba
**cambiando el número del criterio** y viendo cambiar el veredicto con el mismo
paciente — una prueba de comportamiento, no un `grep` de literales, porque un
umbral escondido podría estar escrito con palabras.

**AUSENCIA DE DATO NO ES DATO DE AUSENCIA.** El caso que justifica el módulo
entero: estudio que **excluye embarazadas**, paciente cuyo embarazo **no consta**
→ `datos_insuficientes`, jamás «nada lo excluye». Que nadie lo haya anotado no
significa que no lo esté. Y la duda gana a la tranquilidad: un solo criterio
dudoso tiñe el conjunto aunque todo lo demás salga bien.

**UNA FUNCIÓN RENAL CADUCA NO DECIDE.** REG-375 puso la ventana de vigencia para
dosificar; aquí rige igual. Una TFG fuera de ventana deja el criterio renal en
`datos_insuficientes`: un número viejo no es un número.

**LOS PATRONES VAN EN LOS DOS IDIOMAS, Y NO ES UN ADORNO.** Los criterios
estructurados los escribiría el producto en español; los resúmenes de PubMed
llegan en **inglés**. Un motor que sólo leyera español declararía `no_evaluable`
el 100 % de los resúmenes reales y **parecería prudente cuando estaría ciego**.

**Y EL DATO LLEGA.** La familia de defectos más repetida de este repositorio es la
del cálculo que nadie lee — REG-345 fue exactamente eso, **en esta misma
pantalla**: los avisos de evidencia se calculaban y la pantalla los tiraba. Así
que el motor se calcula en la ruta, viaja en la respuesta y **se pinta pegado a la
fuente**, que es donde el médico decide si abre el artículo. Hay cuatro casos que
recorren esa cadena.

**NO FILTRA NI REORDENA.** Quitar de la vista un artículo porque un patrón no casó
sería peor que no tener esto: el médico dejaría de ver literatura por una
heurística. Se **anota**. Y sólo se dice cuando hay algo que decir: «nada lo
excluye» repetido en doce fuentes es ruido que se aprende a ignorar, y entonces el
aviso que sí importa tampoco se lee.

**LA PRUEBA.** `src/__tests__/la-evidencia-no-aplica-a-cualquiera.test.ts`
(36 casos), con inclusión, exclusión, ambigüedad, dato ausente, resumen en inglés
y un caso que falla si alguien añade el veredicto «aplica».

**QUÉ NO CUBRE, DECLARADO.**

- **Cuatro dimensiones, no dieciocho.** Edad, embarazo, función renal y alergia.
  Organismo, susceptibilidad, sitio de infección, dispositivo, severidad, entorno
  de atención, terapia previa y jurisdicción **no se leen** — caen en
  `no_evaluable` y se cuentan.
- **No decide conducta.** Que la evidencia aplique no indica el tratamiento y que
  no aplique no lo contraindica. El motor no habla con ninguno de dosis.
- **Lee prosa con patrones estrictos.** Un criterio redactado de otra forma no se
  interpreta: se declara ilegible. Señalar de menos, nunca de más.
- **La población estructurada del estudio sigue sin producirse.**
  `Poblacion.criteriosInclusion` existe en el modelo y nadie la llena todavía; por
  eso el camino real es el resumen, y el resultado lo dice con `desdeResumen`.

---

## REG-388 — no se podía seguir una petición del navegador hasta el proveedor

**QUÉ FALTABA.** No existía traza. El tablero lo decía con precisión y era exacto:
`requestId` **se fabrica en cada ruta**, no llega del cliente, no viaja al
proveedor, y el gateway lo **muta** (`${requestId}-${proveedor}`). Es la clave del
libro de costos, no una traza.

Lo que eso significa el día que pasa: un médico dice «se me quedó pensando y no
salió la nota», y no hay forma de seguir esa petición desde su navegador hasta la
llamada al proveedor. Se busca por hora y por consultorio, a mano.

**LA CAUSA RAÍZ: UN CAMPO HACÍA DOS TRABAJOS.** `requestId` es la clave con la que
se **cobra**, y el gateway le añade el proveedor **a propósito** para que dos
intentos del mismo trabajo se cobren aparte. Una traza necesita justo lo
contrario: el **mismo** identificador de punta a punta.

Arreglar uno rompía el otro. Por eso son dos campos y no uno — y por eso el golden
comprueba que `requestId` **sigue** mutando: si alguien lo «arreglara» para que no
lo hiciera, rompería la contabilidad.

**LA FORMA ES LA DEFENSA CONTRA EL PHI.** El identificador es `c` + dieciséis
hexadecimales, y `correlacionDe` **valida**. Quien mande
`x-correlacion: juan-perez-diabetes` no consigue meter eso en los registros: se
descarta y se acuña otro. La PHI no se evita pidiéndolo por favor; se evita
haciendo que el campo **no pueda** contenerla.

El contraste con lo que ya había es el argumento entero: `requestId` embebe hoy el
uid del médico (`np-${uid}-${Date.now()}`). Identifica a una persona, y por eso la
traza no se construye encima de él.

**EL HILO, PASO A PASO.** El navegador acuña una por pestaña —agrupa la sesión de
trabajo en la que el médico dice que algo falló— y la manda en toda petición
autenticada; las **16 rutas de IA** la leen de la petición en vez de inventársela;
el gateway la copia **sin tocarla**; y el asiento del libro de costos la escribe.

Ese último paso es el que importa: sin la copia en `asiento()`, todo lo anterior
funcionaría y el asiento se escribiría **sin traza**. Es «el dato tiene que
LLEGAR» en el sitio exacto donde este repositorio ya lo ha tenido tres veces, y
tiene su propio caso.

**LA PRUEBA.** `src/__tests__/la-traza-cruza-la-frontera.test.ts` (14 casos).
Probado al revés con un nombre de paciente, un correo y cuatro identificadores
casi válidos —uno con un dígito de menos, otro en mayúsculas—: todos se descartan
y se sustituyen. Y con el caso complementario, porque descartarlo **siempre**
dejaría cada salto con un id distinto y no habría traza en absoluto.

**QUÉ NO CUBRE, DECLARADO.**

- **No mide nada.** Es el hilo, no el instrumento: correlaciona registros que ya
  existen. La latencia y el error por ruta siguen siendo trabajo de WS-12.
- **No cubre los trabajos de fondo.** Un cron no nace de un navegador; su traza
  tendría que acuñarse al arrancar el trabajo, y eso no está hecho.
- **No llega al proveedor como cabecera.** Viaja hasta la llamada y queda en el
  asiento; mandársela a Anthropic u OpenAI en un header es otra decisión y no
  aportaría a la traza propia.

---

## REG-389 — el catálogo de evidencia callaba diecisiete fuentes del alcance

**QUÉ FALLABA.** El alcance canónico nombra **29 fuentes**. El catálogo del
producto tenía **12**. Las otras 17 no estaban «pendientes» ni «bloqueadas»: **no
estaban**.

Y eso tiene una consecuencia concreta, no documental. El producto tiene una regla
buena —«un proveedor no operativo baja de posición pero no desaparece de la
lista»— que existe para que el médico pueda leer *«UpToDate: no se consultó»*. Esa
regla **no puede dispararse para una fuente que el catálogo no conoce**: DynaMed
no salía como no consultada porque **DynaMed no existía para el selector**.

**LO QUE SÍ ESTABA, Y MI PROPIO CENSO DESCRIBÍA MAL.** El censo decía que faltaba
«la ficha por fuente con modelo de autenticación, licencia, capacidad, caché, PHI,
frescura y semántica de fallo». **Era falso**: el catálogo ya traía todo eso —
`viaOficial`, `admitePhi`, `modeloDeCredencial`, `derechoDeCache`, `citaProfunda`,
`exponeFrescura`, `limitesYSla`, `precio`, `semanticaDeFallo`, `reusoGenerativo`—
y está mejor construido de lo que el censo daba a entender. El hueco no era la
forma de la ficha: era que faltaban 17 fichas enteras.

**LAS SIETE EDITORIALES, DICHO SIN ADORNOS.** NEJM, JAMA, Lancet, BMJ, CID, Nature
Medicine y Annals **se descubren vía PubMed**, con su resumen y sus metadatos
públicos. Eso **no es una integración editorial** y llamarlo así sería falso: no
hay contrato, ni API, ni texto completo. Entran con `REQUIRES_AGREEMENT` y **sin
`proveedorCanonico`**, lo que significa que por el modelo de tipos no pueden
producir un `Source` — y sin `Source` no hay `Passage` ni afirmación respaldada.
No hace falta prohibirlo: es imposible. Un caso falla si alguien le pone el campo
«para que funcione».

**POR QUÉ ENTRAN CON LA MATRIZ SIN VERIFICAR.** Porque es lo único honesto.
Declarar una vía oficial, un modelo de credencial o una semántica de fallo que
**nadie ha comprobado** sería inventar la ficha en vez de construirla — y una
ficha inventada es peor que una ausente, porque parece trabajo hecho. Lo que sí se
declara es **por qué** están así y **qué decisión** falta, que es lo que permite
desbloquearlas.

**DOS QUE DUELEN MÁS QUE LAS DEMÁS.** `COFEPRIS` no estaba catalogada **en un
producto para México**: la ficha oficial de un fármaco en México no la da openFDA.
Y `CENETEC` es hoy **un enlace a una búsqueda de Google presentado como botón**, y
el catálogo no lo decía.

**UNA PRUEBA QUE CAMBIÓ, Y EL PORQUÉ IMPORTA.** El guardián del censo exigía que
la lista canónica fuera **más larga** que el catálogo — nació cuando eran 29 contra
12 y la tentación era igualarlas **por abajo**, borrando de la vista lo que
faltaba. Este arreglo las igualó **por arriba**, así que la desigualdad dejó de ser
la propiedad correcta: mantenerla habría obligado a deshacer el arreglo para que la
prueba pasara, que es exactamente cómo una prueba se vuelve el jefe del producto.
Ahora se exige lo que siempre se quiso decir: que la lista no encoja y que ninguna
canónica se quede sin ficha.

**OTRA CORRECCIÓN DEL CENSO, EN EL MISMO ACTO.** `WS-04.inyeccion-de-fallos`
figuraba como `NOT_STARTED` —«no hay arnés de inyección de fallos»— y **era
falso**. El gateway de IA sí lo tiene, con comportamiento medido: 404, 429, red
caída, llave revocada, salida ilegible, créditos devueltos y nada clínico en el
asiento, repartido en `ia-gateway`, `ia-fallo-proveedor` y
`un-proveedor-caido-no-se-reintenta-mil-veces`. Pasa a `PARTIAL` con lo que de
verdad falta: WhatsApp, Evidence, y que la degradación de la consulta hoy se
comprueba **por substring y no por comportamiento**.

Un censo que exagera un hueco no es más prudente: manda a rehacer lo hecho y le
quita credibilidad a los huecos reales.

**LA PRUEBA.** `src/__tests__/el-catalogo-de-fuentes-no-calla-ninguna.test.ts`
(9 casos), con el mapa canónico↔catálogo comprobado **en los dos sentidos** para
que las dos listas no se separen en silencio.

**QUÉ NO CUBRE, DECLARADO.**

- **Catalogar no es integrar.** Ninguna de las 17 nuevas puede producir un
  `Source`, y eso lo impide el modelo de tipos, no este guardián.
- **No verifica la matriz de las nuevas.** Está sin verificar a propósito.
- **No dice si una fuente vale la pena.** Dice que el catálogo no puede callársela.

---

## REG-390 — faltaba contrapresión, no colas; y encolar la nota habría sido el defecto

**LA PREGUNTA ANTES DE CONSTRUIR NADA.** «Colas y contrapresión» es un requisito
del programa, y la forma barata de cumplirlo sería meter una cola en el camino
clínico. Sería un error caro: la nota es lo que el médico está esperando con el
paciente enfrente. Así que primero se midió qué hay y qué puede desacoplarse.

**LA CORRECCIÓN: «NINGUNA COLA» ERA FALSO, EN DOS TERCIOS.** El censo decía
«ninguna cola, contrapresión ni dead-letter». Existen **dos colas**, y están bien
hechas:

- `whatsapp/outbox.ts` — reintento con retroceso y **dead-letter**, drenado por el
  cron de recordatorios. Nadie espera un mensaje proactivo delante de una
  pantalla, así que diferirlo es correcto y perderlo no lo sería.
- `expediente/audit-log.ts` — cola durable, **acotada** a 50 asientos, con tope de
  reintentos, **por uid** (un asiento de otro no se manda con el nombre
  equivocado), drenada antes de cerrar sesión y **contada en pantalla**.

**LO QUE SÍ FALTABA: CONTRAPRESIÓN.** Es un problema distinto del interruptor. El
interruptor (REG-353) cubre un proveedor **caído**: falla rápido en vez de que la
llamada 60 espere lo mismo que las 59 anteriores. No cubre uno **lento** — ahí
cada llamada acaba contestando, el circuito nunca se abre, y se acumulan
peticiones en vuelo ocupando cada una su función. El precedente está documentado
en este repositorio: un socket colgado inmovilizó una lambda de 300 s, y la ruta
de la nota corre en **800**.

**LA DECISIÓN: SE RECHAZA, NO SE ENCOLA.** Bajo saturación la llamada de IA se
contesta **ahora y con la verdad** —«hay N peticiones en curso, vuelve a
intentarlo»— y el médico decide si reintenta o escribe a mano.

Encolarla habría construido exactamente lo que la regla del programa prohíbe:
*una operación clínica nunca puede aparecer como completada si sólo quedó
encolada*. Una nota metida detrás de otras cincuenta es una espera sin fondo con
el paciente enfrente — la pantalla diría «procesando» y no habría nada
procesándose.

**LA POLÍTICA, ESCRITA PARA PODER VIGILARLA.**
`src/lib/ops/lo-sincrono-y-lo-encolado.ts` clasifica cada operación con su razón:

| Modo | Qué va aquí |
|---|---|
| `sincrona` | Guardar la nota · firmar · receta · orden · confirmación de avisos · reserva de créditos |
| `encolada_durable` | Aviso proactivo de WhatsApp · asiento de la bitácora NOM-004 |
| `mejor_esfuerzo_declarado` | Llamada de IA (se rechaza, no se encola) · asiento del libro de costos |

La firma está entre las síncronas por una razón que no es de ingeniería: es un
acto medicolegal **irreversible**, y encolarla dejaría al médico creyendo que
firmó algo que todavía no existe. Una firma no se repite «por si acaso».

**EL DEFECTO CLÁSICO DE UN CONTADOR ASÍ, REPRODUCIDO.** Soltar el sitio sólo en
el camino de éxito: el contador sube para siempre y al cabo de un rato la
instancia rechaza **todo** sin que haya nada en vuelo — **la defensa convertida en
la caída total**. Tiene su caso al revés, y el gateway suelta en `finally`, lo que
tiene el suyo.

Otros dos que parecen detalles y no lo son: **rechazar no ocupa sitio** (un
contador que sumara al rechazar convertiría un pico en una caída permanente), y
**la clave es por proveedor** (si fuera global, que Anthropic vaya lento apagaría
OpenAI).

**LA PRUEBA.** `src/__tests__/lo-encolado-no-es-lo-hecho.test.ts` (16 casos).
Comprueba además que las dos colas existentes **siguen teniendo lo que las hace
colas** —dead-letter, retroceso, tope, límite de reintentos—: si alguien se los
quitara, esta clasificación estaría mintiendo.

**QUÉ NO CUBRE, DECLARADO.**

- **El tope es por instancia**, como el interruptor. Con N instancias calientes el
  tope efectivo es N×TOPE. Hacerlo global costaría una lectura compartida en el
  camino de una nota, que es donde no se puede pagar.
- **Que ocho en vuelo sea el número correcto** para un consultorio es una
  hipótesis de operación, no un hallazgo. No es una cifra clínica y se declara de
  dónde sale.
- **No cubre WhatsApp ni Evidence con interruptor**: siguen sin pasar por esa
  puerta (WS-04.interruptor-otros).

---

## REG-391 — una caída del proveedor no puede matar la cola, ni colgar la consulta

**QUÉ SE PEDÍA.** `WS-04.interruptor-otros` del censo, en una línea: «WhatsApp y
Evidence bajo el mismo interruptor». Al mirar dónde poner esa puerta aparecieron
**tres defectos**, y el primero era peor que lo que se venía a arreglar.

### 1. El outbox mataba mensajes buenos cuando el que fallaba era el proveedor

El outbox de WhatsApp cuenta **intentos del mensaje** y a los cinco lo manda al
dead-letter. Contaba igual dos cosas que no se parecen en nada:

- «este teléfono está mal escrito» — es del mensaje, y rendirse a los cinco es lo
  correcto;
- «Meta devuelve 503» — **no es del mensaje**. El mensaje está perfecto.

Con el cron cada hora (`vercel.json`) y cinco intentos, **cinco horas de caída del
proveedor mataban toda la cola**. En silencio: la entrada quedaba en `muerto` con
la palabra «agotó reintentos», que manda a mirar el mensaje, que es justo donde no
estaba el problema. Avisos de lista de espera que nadie mandó, huecos de agenda
que nadie ocupó, y desde fuera el sistema hizo exactamente lo que dice hacer.

**Y el interruptor, solo, lo habría EMPEORADO.** Al fallar rápido, las cinco horas
se habrían convertido en cinco minutos: la cola se habría muerto antes. Esto es lo
que se veía al medir antes de construir, y no al leer el requisito.

**Causa raíz:** una sola cuenta para dos hechos distintos. Un intento que se
estrelló contra un proveedor ausente **no es un intento del mensaje**.

**Arreglo:** dos cuentas —`intentos` (del mensaje) y `pausas` (del proveedor)—, y
`decidirReprogramacion` en `whatsapp/reintentos.ts`, pura. Las pausas también
están acotadas (72 ≈ 3 días con el cron cada hora), porque **una cola que nunca se
rinde es la otra forma de perder un mensaje, sólo que más lenta**. Y cuando una
entrada muere, dice de qué murió: `proveedor_caido` y `reintentos_agotados` mandan
a mirar sitios distintos.

### 2. `openfda.ts` llamaba con `fetch` pelado, sin tiempo máximo NINGUNO

`dosisFDA` se dispara desde `consultor-evidencia` (`maxDuration = 300`) y por
partida triple, en paralelo. Un socket colgado de `api.fda.gov` inmovilizaba la
función los 300 segundos completos, facturados por GB-segundo, con el médico
mirando una barra de progreso.

Es **exactamente** el fallo para el que se escribió `fetch-con-timeout` (REG-346),
y este módulo se quedó fuera. Ésa es la forma habitual de que una defensa buena no
proteja: se aplica **por convención**, hay que acordarse. Por eso el arreglo pone
la puerta en el **cuello de botella** de cada módulo (`ncbiFetch`, `pedir`) y no en
cada llamador — así la siguiente llamada nace protegida sin que nadie se acuerde.

### 3. PubMed tenía la protección y no le llegaba

`esearch` y `efetch` aceptan `signal`; `expediente/evidencia` (también
`maxDuration = 300`) **no se lo pasa**. Escrito y sin conectar. Con el timeout en
`ncbiFetch` deja de depender de que el llamador se acuerde.

### El interruptor, que era lo que se venía a hacer

El motor pasó de `ia/interruptor.ts` a **`red/interruptor.ts`** y dejó de hablar
ningún vocabulario de proveedor: sólo pregunta *¿este fallo dice que el proveedor
no está?* Cada proveedor trae su traductor (`ia/interruptor.ts`,
`whatsapp/fallo-del-proveedor.ts`, `evidencia/fallo-del-proveedor.ts`). Mientras
vivió bajo `ia/`, la única forma de reutilizarlo era que `whatsapp/` importara de
`ia/` — una dependencia al revés que el siguiente en llegar habría copiado.

**El aislamiento se repite en los tres.** Un 401/403 **no** abre el circuito: la
credencial de WhatsApp es del consultorio, y si abriera, un consultorio con el
token caducado dejaría **sin recordatorios a todos los demás**. No mueve datos de
un consultorio a otro: mueve la caída. Un 429 tampoco — en NCBI dice que se pidió
de más, y el módulo ya tiene su propio regulador de velocidad.

### La regla clínica que esto protege

**Ausencia de dato no es dato de ausencia.** Con el circuito abierto, PubMed
**lanza** en vez de devolver lista vacía, para que el `catch` marque
`TestigoPubMed.fallo` — el testigo que separa «no hay artículos» de «no se pudo
preguntar». Devolver `[]` en silencio convertiría una búsqueda que no se hizo en
una búsqueda sin resultados.

### Las pruebas

- `src/__tests__/una-caida-de-whatsapp-no-mata-la-cola.test.ts` (17 casos), con el
  defecto reproducido al revés: cinco caídas y al dead-letter.
- `src/__tests__/una-fuente-caida-no-cuelga-la-consulta.test.ts` (10 casos),
  incluida la que evita la recaída: **ni pubmed ni openfda pueden llamar a `fetch`
  directamente**.

Ambas probadas al revés desactivando la puerta: el caso correspondiente cae.

### Qué NO cubre, declarado

- **Nadie lee el dead-letter.** Las entradas muertas quedan en Firestore con su
  motivo y **ninguna pantalla las enseña**. Esto arregla que mueran mal, no que
  nadie las mire.
- **`fetch` de Node lanza `TypeError` para casi todo fallo de red**, así que la
  traducción de excepciones se queda corta a propósito: da por «no es del
  proveedor» cosas que sí lo son. Señala de menos. El 5xx y el tiempo agotado —la
  mayoría de una caída real— sí se reconocen.
- **El interruptor es por instancia**, como el de la IA. Con N instancias
  calientes, N primeras llamadas pagan su timeout.
- **No cubre las otras 27 fuentes del catálogo**, porque hoy no se consultan.

---

## REG-392 — el borrador no depende de que alguien se acuerde, y no se calla

**QUÉ SE PEDÍA.** `TR-BORRADORES.cero-perdidos`: prueba de los caminos de fallo
sobre las superficies de edición clínica. Al buscar dónde probarlos aparecieron
dos defectos, y el primero es una lección sobre las compuertas.

### 1. Una compuerta que contaba las copias reparadas

La regla «¿hay algo que valga la pena guardar?» estaba escrita **cinco veces**
dentro de `consulta/[patientId]/page.tsx`: el autoguardado al servidor (30 s), el
respaldo local (1,5 s), el espejo en memoria, el volcado al salir de la pantalla
y el oyente de `nx:guardar-todo`.

REG-300 ya había pagado esta familia —`proximoSeguimiento` se añadió a unas
copias y no a otras, y **la fecha de la próxima consulta se perdía**— y unificó
**tres**. Su guardián decía, literalmente:

```
expect((CONSULTA.match(/const hay = hayContenido\(e\)/g) ?? []).length).toBe(3)
expect(CONSULTA).not.toMatch(/const hay = e\.resumen\?\.trim\(\)/)
```

Contaba **exactamente las tres reparadas**, y buscaba el nombre de variable de
esas tres. Las otras dos copias se llamaban `hayContenido` y pasaban por delante
sin tocarlas — y son justo **las dos que deciden si el trabajo del médico se
guarda**: la que llama al servidor y la que escribe el respaldo local.

**La lección:** una compuerta que mide la parte reparada certifica el arreglo, no
la propiedad. La reparación de `depende_de_recordar` nunca es volver a copiar
bien: es DERIVAR de una sola declaración y poner la compuerta sobre la propiedad.

**Arreglo.** `expediente/el-borrador-no-se-pierde.ts`, puro: una lista,
`CAMPOS_DEL_BORRADOR`, de la que salen **a la vez** qué se persiste
(`cuerpoDelRespaldo`) y qué cuenta como contenido (`hayAlgoQuePerder`). La
pantalla lo importa; no queda ninguna reconstrucción. El guardián nuevo busca la
**forma** de la condición, no el nombre de quien la guarda, y está probado al
revés contra el texto de las dos copias retiradas.

Como efecto lateral, la regla dejó de comprobarse raspando el texto del
componente con expresiones regulares y pasó a comprobarse sobre la función.

### 2. `catch { }` sobre el único respaldo local del médico

Las dos escrituras a `localStorage` acababan así:

```
} catch { /* almacenamiento lleno: no es crítico */ }
```

**No es cierto que no sea crítico.** Sin cuota, el respaldo local deja de
escribirse: el médico sigue dictando, la pantalla no cambia, y la copia que le
salvaría la consulta tras una recarga ya no existe. Pérdida silenciosa, que es la
familia que menos se perdona.

Ahora `guardarRespaldoLocal` devuelve **por qué** —`guardado`,
`nada_que_guardar`, `sesion_cerrada`, `sin_espacio`, `no_se_pudo`— y la pantalla
lo dice, una vez por sesión (repetirlo cada 1,5 s lo volvería ruido, y un aviso
que se ignora no protege a nadie). Nada cambia en silencio, §3.

`sesion_cerrada` se distingue de `no_se_pudo` a propósito: no escribir tras
cerrar sesión es lo CORRECTO —resucitaría PHI recién purgada—, y avisar de ello
sería un susto inventado.

**LA PRUEBA.** `src/__tests__/el-borrador-no-se-pierde.test.ts` (18 casos). El
caso que impide que la familia vuelva recorre `CAMPOS_DEL_BORRADOR` y exige que
**cada campo que cuenta baste por sí solo**: añadir uno sin su regla cae sin que
nadie tenga que acordarse de escribir el caso. Probado al revés quitando la
`cuenta` de `proximoSeguimiento`: cae el caso de REG-300.

**QUÉ NO CUBRE, DECLARADO.**

- **No prueba el navegador.** Recarga, cambio de ruta y `pagehide` son de e2e.
  Aquí se prueba la decisión y el camino de fallo del almacenamiento — que es lo
  que nunca se pudo provocar **porque estaba dentro del componente**.
- **No prueba que el aviso se pinte**, sólo que la pantalla lo llame.
- **`cambiarTipo` conserva su propia condición y NO se unificó**: contesta otra
  pregunta —«¿cambiar de modalidad destruirá algo?»— y mezclarlas haría que una
  fecha de seguimiento bloqueara un cambio de modalidad que no la toca.

---

## REG-393 — el vocabulario aprendido no se descarga entero, y no miente al faltar

**QUÉ SE PEDÍA.** `WS-03.documentos-que-crecen`, que nombraba
`asr/aprendizaje-firestore.ts` por su `arrayUnion` sin tope. Al medirlo, el
`arrayUnion` resultó ser el menor de los tres defectos del archivo.

### 1. Una lectura sin cota en el camino del médico

```
const snap = await getDocs(ruta(clinicId))     // la colección ENTERA
```

Un documento por palabra distinta, compartido por consultorio, creciendo con los
años — y se leía en **cada apertura de consulta y cada apertura de UCI**, con el
médico esperando la pantalla.

Lo que se hace con ese vocabulario es meterlo en el sesgo del reconocedor, cuyo
tope declarado son **mil términos** (`TOPE_TERMINOS`) y dentro de los cuales
compiten además el léxico de especialidad y —con prioridad— el vocabulario del
paciente que está enfrente. Se bajaba todo para usar, como mucho, mil.

Ahora la consulta lleva `where('veces','>',0)`, `orderBy('veces','desc')` y
`limit`. El corte lo hace el servidor por frecuencia; entre dos palabras con la
misma cuenta justo en el límite, cuál entra es arbitrario, y se declara en vez de
fingir un criterio.

Es además una instancia viva de `WS-03.lecturas-sin-cota`: la única lectura de
consultorio que quedaba descargando una colección entera en el camino del médico.

### 2. Un fallo de red diciéndole al médico que su vocabulario está vacío

En la pantalla de configuración —la única donde el médico **quita** una palabra—
una lectura fallida devolvía `[]`, y `[]` se pintaba con:

> «Todavía no ha aprendido ninguna palabra.»

Es la regla 4 de seguridad clínica en la pantalla donde más barato habría sido
respetarla: **ausencia de dato no es dato de ausencia**. Ahora
`leerVocabularioCompleto` devuelve `leida`, y la pantalla tiene dos frases porque
son dos hechos.

Y devuelve `truncada`: si hay más palabras de las que caben, se dice. Una lista
recortada que parece completa le haría creer que ya no queda nada que revisar.

### 3. El `arrayUnion`, acotado a medias — y dicho así

`oidoComo` crecía sin techo en un documento que nadie revisa. Firestore corta en
1 MiB y ahí `setDoc` empieza a fallar, en silencio, porque el aprendizaje nunca
puede romper una consulta: dejaría de aprender esa palabra sin decirlo.

El techo va sobre **lo que aporta cada escritura**, no sobre el acumulado, y eso
se dice sin adornos: recortar el total exigiría leer-modificar-escribir, que es
justo lo que `arrayUnion` está aquí para evitar (dos consultas simultáneas se
pisarían y el contador —lo que distingue una costumbre de un dedazo— nunca
llegaría al mínimo). **Acota el ritmo, no el acumulado.** Llamarlo «acotado» a
secas habría sido falso.

**LA PRUEBA.** `src/__tests__/lo-aprendido-no-se-descarga-entero.test.ts` (11
casos), con el proveedor de Firestore doblado para poder mirar **la consulta que
se manda**, no sólo lo que vuelve. Probado al revés: sin `query`, el caso de la
cota cae; con la lectura fallida devolviendo `[]` sin `leida`, cae el de la
regla 4.

**QUÉ NO CUBRE, DECLARADO.**

- **No mide la latencia ganada.** Que se lea menos está probado; cuántos ms se
  ahorran al abrir la consulta, no.
- **No acota `oidoComo` retroactivamente**: un documento que ya venga grande
  sigue grande. Deja de crecer deprisa.
- **No prueba el corte en el servidor**, sólo que la consulta lo pide.
- **No cubre `internamientos/{id}`**, que guarda seis arrays en un documento y
  cuyas `administraciones` tampoco tienen tope: es Hospital/UCI, queda fuera de
  este carril, con nombre y sin cerrar.

---

## REG-394 — «44 getDocs sin limit» deja de ser un número escrito a mano

**QUÉ SE PEDÍA.** `WS-03.lecturas-sin-cota` llevaba meses diciendo: «el
inventario medido daba 44 `getDocs` sin `limit()`; falta recontarlo». Un número
a mano en un documento, sin nada que lo mantuviera: la familia
`depende_de_recordar` en su forma más pura. Nadie lo recontó, y mientras tanto no
había manera de saber si una lectura nueva sin cota había entrado al árbol.

Ahora es un **techo que sólo baja**: Consultorio 29, Hospital 9.

### Por qué un inventario y no una regla de lint

Porque **no toda lectura necesita `limit`**. Las unidades de un hospital, los
consultorios de una cuenta, las versiones de UNA nota son colecciones acotadas
por su naturaleza; exigirles tope enseñaría a escribir `limit(1000)` por
costumbre, que es peor que no tenerlo: parece protegido y no lo está.

Lo que hacía falta es que **una lectura nueva sin cota no pueda entrar callada**.

### Lo que costó medirlo bien — y por qué se cuenta

El primer inventario dijo **55 de 58 sin cota**, y era falso por tres motivos:

- `limitarA(1)` y `fbLimit(500)` son alias de `limit` y no casaban;
- media docena son `getDocs(q)` con la `q` armada antes, o `getDocs(ayudante(…))`
  con el tope dentro del ayudante;
- resolver los nombres en TODO el archivo marcaba como deuda
  `listarPacientesPagina`, que **sí** acota: otra función del mismo archivo tiene
  una variable homónima sin cota y la búsqueda se quedaba con la primera.

Un instrumento que exagera manda a rehacer lo hecho y le quita crédito a los
huecos reales — el mismo criterio que ya obligó a corregir tres entradas del
censo. Los nombres se resuelven ahora dentro de la función que los usa, y el
guardián tiene un caso dedicado a que `listarPacientesPagina` **no** vuelva a
salir como deuda.

### Lo que el inventario deja NOMBRADO y sin cerrar

**`getAppointments(clinicId, constraints)`** — su techo depende de quien llame.
`getAppointments(clinicId, [])` descarga todas las citas que el consultorio haya
tenido nunca. **No se arregla poniéndole un `limit` suelto**: sin un `orderBy`
propio del tope, recortaría por el extremo equivocado y **perdería citas en
silencio**, que en una agenda es peor que la lectura cara.

**`useAppointments`** — no es un `getDocs` sino un `onSnapshot`, así que este
inventario no lo ve, y es el peor de los dos: su ventana **sólo crece y nunca se
encoge**. Navegar el calendario a hace un año deja el resto de la sesión
recibiendo todas las citas desde entonces, en vivo. Arreglarlo es rediseñar la
ventana de la agenda —la pantalla principal— y eso no se hace a ciegas: la regla
de diseño dice que una interfaz no se aprueba leyendo el código.

Los dos quedan escritos aquí y en el censo, con lo que haría falta, en vez de
«arreglados» con un tope que perdería datos.

**LA PRUEBA.** `src/__tests__/las-lecturas-sin-cota-solo-bajan.test.ts` (9
casos). Probado al revés añadiendo una lectura sin cota a
`dosing/persistencia.ts`: caen el trinquete de Consultorio y el caso del techo
sin holgura. Tiene además el caso que impide que el instrumento se rompa en
silencio — si el escáner devolviera vacío, el trinquete estaría en verde para
siempre.

**QUÉ NO CUBRE, DECLARADO.**

- **Es análisis estático.** Una cota que llegue por parámetro en tiempo de
  ejecución no la ve.
- **No dice si una lectura es CARA**, dice que puede crecer sin techo. Cuánto
  crece de verdad lo mide el emulador de WS-03 (REG-383), sobre datos.
- **No cubre `onSnapshot`**, que es donde está el peor caso.

---

## REG-395 — un reintento dejaba dos enmiendas idénticas en el expediente

**QUÉ SE PEDÍA.** `WS-04.idempotencia`: recorrer receta, órdenes, citas y
acciones de WhatsApp comprobando que ningún reintento pueda duplicar un acto
clínico. Al recorrerlo apareció uno que no estaba en esa lista y es peor que
todos ellos.

### El defecto

`agregarAdenda` nacía con `addDoc`: la identidad del documento salía de la
**escritura**, no de la **intención** — exactamente la causa raíz que
`lib/idempotencia.ts` existe para cerrar, y que ya estaba cerrada para la nota,
el cobro, el laboratorio y la lista de espera. La adenda se quedó fuera.

El doble clic **sí** estaba cubierto: el botón se bloquea mientras la petición
está en vuelo. El caso que no lo estaba es el que la red provoca sola:

1. el médico pulsa «Guardar adenda»;
2. Firestore **commitea**;
3. la respuesta se pierde — pestaña dormida, túnel, wifi que salta;
4. el `catch` pinta «No se pudo agregar la adenda. Intenta de nuevo.» y el
   `finally` reactiva el botón;
5. el médico hace exactamente lo que se le acaba de pedir.

Dos enmiendas idénticas a una nota firmada.

### Por qué es peor que un duplicado cualquiera

Una adenda es la corrección medicolegal de un documento inmutable (NOM-004).
**No se puede borrar.** El expediente diría para siempre que el médico enmendó
dos veces lo mismo, y quien lo lea después no tiene forma de saber que fue la
red. La pantalla, además, le pidió el segundo intento.

### El arreglo

El mecanismo canónico, sin inventar uno nuevo: ámbito `'adenda'` en
`AmbitoIdempotente`, la pantalla acuña una `claveDeIntento()` y **la conserva
mientras el intento no termine bien**, y la escritura va en transacción.

Dos detalles que no son de estilo:

- **`??=` y no `=`.** Con asignación directa cada reintento acuñaría una clave
  nueva y la defensa no serviría de nada, con más código encima.
- **Si el documento ya existe, se devuelve lo que hay SIN pisarlo.** La adenda
  previa puede llevar minutos en el expediente, y reescribirla cambiaría su
  `createdAt` — que en una enmienda medicolegal es la hora en que consta la
  corrección, no un metadato.

**LA PRUEBA.** `src/__tests__/una-adenda-no-se-escribe-dos-veces.test.ts` (10
casos), con el defecto reproducido al revés: **sin clave, dos intentos dejan dos
enmiendas**. Incluye el caso que impide pasarse de frenada —una intención NUEVA
sí escribe una adenda nueva; la defensa no puede volver imposible enmendar dos
veces de verdad— y los dos del aislamiento: la misma clave en otro consultorio da
otro id, y una clave con `../` no puede convertirse en una ruta.

**QUÉ NO CUBRE, DECLARADO.**

- **Sólo la adenda.** El inventario de escrituras con `addDoc` tiene 25 sitios;
  los demás —tareas clínicas, fotos clínicas, farmacia, ARCO, bloques de agenda—
  siguen sin clave de intención. Queda en el censo, no arreglado aquí.
- **Receta y orden no son documentos**: se imprimen desde la nota, así que no hay
  duplicado que evitar en Firestore. Se comprobó antes de darlo por hecho.
- **Las citas ya son atómicas** por transacción del servidor con re-chequeo de
  conflicto; un reintento no duplica, aunque puede devolver «conflicto» por su
  propio documento — molesto, no peligroso, y se deja dicho.
- **No prueba Firestore.** La transacción está doblada; lo que se ejercita es que
  el id venga de la intención y que una convergencia no reescriba.

---

## REG-396 — la avería que motivó el módulo de incidencias no avisaba a nadie

**QUÉ SE PEDÍA.** `WS-13.alertas`, cuyo censo decía: «hay un canal real
(`ops/alerta.ts`) con **un solo llamador**: dispara por cron caído y saldo bajo.
Nada más».

### El hueco

`ia/incidentes-servidor.ts` nació de una frase concreta del dueño: «el
31-jul-2026 la IA de la plataforma estuvo caída y nadie se enteró hasta que la
probé a mano», con la instrucción «no quiero que a mis clientes les pase eso; tú
debes avisarme».

El módulo anota la incidencia en Firestore. **Y ahí se quedaba.** Para verla
había que abrir el tablero del dueño — o sea, había que sospechar la avería antes
de enterarse de ella. `ops/alerta.ts` existe desde entonces y el vigilante grita
por crons sin latido y por saldo bajo; de esto, no.

Escrito, probado y sin conectar, **en la pieza cuyo propósito literal era que
alguien se enterara**.

### El arreglo, y las dos decisiones que lo hacen honesto

El vigilante lee las incidencias **sin avisar** y las manda al canal.

- **«Sin avisar», no «recientes».** El vigilante corre cada quince minutos y las
  incidencias se agrupan por HORA: avisar de las recientes mandaría el mismo
  aviso cuatro veces por hora, y un aviso repetido se aprende a ignorar — la
  forma en que un canal de alertas deja de proteger sin dejar de funcionar.
- **Se marca como avisada SÓLO si el aviso salió.** Marcarla antes convertiría
  una caída del webhook en un silencio permanente: la incidencia quedaría como
  avisada sin que nadie la hubiera recibido, que es peor que no tener canal — se
  da por cubierto lo que sigue descubierto. Es la regla del propio `alerta.ts`
  («si no se pudo avisar, se dice») llevada a su marca de estado. Y
  `marcarAvisadas` devuelve **las que de verdad quedaron marcadas**, no la
  longitud de la lista.

La lectura va con su propio `catch`: un aviso no puede llevarse por delante el
diagnóstico, que es la razón principal de que el vigilante exista.

**LA PRUEBA.** `src/__tests__/la-averia-de-la-ia-llega-a-alguien.test.ts` (11
casos). Probado al revés quitando el `if (r.enviada)`: cae el caso del silencio
permanente.

**UNA CORRECCIÓN DE PASO.** El guardián `ops-latido-y-alerta` comprobaba la
respuesta del vigilante con `expect(ruta).toContain('alerta }')` — el formato
exacto de la línea. Añadir el recuento de incidencias al mismo objeto lo puso en
rojo sin que la propiedad se hubiera movido. Se reescribió para comprobar que
`alerta` viaja en la respuesta, que es lo que ese caso quería decir.

**QUÉ NO CUBRE, DECLARADO.**

- **No prueba el webhook.** `OPS_ALERTA_WEBHOOK` sigue sin configurar en
  producción y está en la lista de acciones del dueño. Hasta que exista, el canal
  **declara** que no pudo avisar en vez de devolver éxito.
- **Sólo las incidencias de la llave de la PLATAFORMA**, que son las únicas que
  se anotan: la llave vencida de un consultorio ya se le dice en su pantalla, y
  meterla aquí taparía lo que sí es del dueño.
- **5xx genéricos y anomalías de autorización** siguen sin señal. WS-13 los pide
  y quedan en el censo.
- **La caída de WhatsApp tampoco avisa**: REG-391 hizo que el outbox pause en vez
  de morir, pero esa pausa no llega a ningún aviso todavía.

---

## REG-397 — una cola en pausa se veía igual que una tarde tranquila

**QUÉ PASÓ.** REG-391 arregló algo y **abrió un hueco nuevo al arreglarlo**, que
es la clase de consecuencia que conviene escribir antes de que la encuentre otro.

Antes, una caída del proveedor de WhatsApp gastaba los reintentos de cada mensaje
y a las cinco horas mataba la cola entera. Mal, pero **ruidoso**: los mensajes
acababan en dead-letter. Después de REG-391 la caída **pausa** las entradas sin
gastarles nada —que es lo correcto— y entonces la cola pausada se ve desde fuera
exactamente igual que una tarde tranquila:

```
cron reminders → ok, enviados: 0, fallidos: 0
```

Nada parece roto. Y el **dead-letter, que existe desde hace mucho, no lo enseña
ninguna pantalla**: una entrada rendida queda en Firestore con su motivo y ahí se
acaba la historia.

Para el paciente las dos son lo mismo: un aviso de lista de espera que nadie
mandó es un hueco de agenda que nadie ocupó, y nadie se entera.

### La regla

**Una defensa que hace que un problema deje de verse tiene que traer consigo la
forma de verlo.** Pausar en vez de morir sólo es mejor si alguien puede saber que
hay una pausa.

### El arreglo

El cron de recordatorios cuenta `pausadas` y `muertas` y las pone en su latido;
el vigilante las lee de ahí —no recorre los consultorios otra vez, que sería un
segundo trabajo que vigilar— y avisa.

Y **distingue las dos**, que no es afinación: una pausa se arregla sola cuando el
proveedor vuelve; una rendida **ya no se reintenta nunca**. Darles la misma
gravedad enseñaría a ignorar las dos. El texto dice qué pasa con cada una, porque
«3 avisos fallidos» no dice si hay que hacer algo.

La cuenta de rendidas va con tope (50 por consultorio) y por encima dice «al
menos», no un número inventado: un `get()` sin cota sobre una cola rota sería
justo la lectura sin cota que REG-394 acaba de poner bajo trinquete.

**LA PRUEBA.** `src/__tests__/una-cola-en-pausa-no-es-una-tarde-tranquila.test.ts`
(10 casos).

**QUÉ NO CUBRE, DECLARADO.**

- **No es la pantalla que falta.** Un aviso dice «hay N rendidas»; no deja verlas,
  ni reintentarlas, ni saber de qué paciente eran. `TR-WHATSAPP.entrega` sigue
  PARTIAL por eso, y ahora con una razón más precisa.
- **No cubre el mensaje reactivo del bot**, que no pasa por el outbox: si el
  proveedor está caído cuando el paciente escribe, esa respuesta se pierde y no
  queda en ninguna cola. Dicho, no arreglado.
- **No prueba el webhook**, que sigue sin destino configurado.

---

## REG-398 — el DOI, el PMCID y la abreviatura se calculaban y se tiraban

**QUÉ SE PEDÍA.** `WS-07.identidad-de-revista`: identidad de revista normalizada,
con alias, DOI, PMCID y acceso abierto.

**QUÉ HABÍA.** Cuatro datos que el sistema ya averiguaba y perdía, cada uno en un
sitio distinto — los cuatro son los que hacen que una cita sea **verificable** en
lugar de sólo legible.

1. **La revista perdía una de sus dos formas.** `pubmed.ts` hacía
   `extraerTag('Title') || extraerTag('ISOAbbreviation')`: se quedaba con la que
   hubiera y tiraba la otra. Son datos distintos —una lista se lee con el nombre
   entero, una CITA se escribe con la abreviatura ISO— y el que se perdía no se
   recuperaba sin volver a preguntar.
2. **El PMCID se resolvía y se descartaba.** `textoCompletoPMC` gastaba una
   petición entera en averiguarlo y devolvía sólo el texto.
3. **La licencia se leía y se descartaba igual.** Con eso el sistema no podía
   distinguir tres cosas que se veían iguales —sin texto—: «sólo hay resumen»,
   «hay texto completo abierto y no se pidió» y «hay texto completo y la licencia
   no deja reproducirlo». La tercera es justo la que hay que poder explicar.
4. **El DOI no llegaba al `Source`.** `ArticuloPubMed` lo traía desde hacía
   tiempo y `desde-pubmed.ts` no lo pasaba. El `Source` es lo único sobre lo que
   se anclan pasajes, así que **una afirmación respaldada nacía sin el
   identificador estable de su respaldo**. El DOI sí llegaba a la pantalla, por
   otro camino: el modelo y la vista sabían cosas distintas.

### La regla que ordena el arreglo

**Ausente significa «no se sabe», nunca «no tiene».** Los campos son opcionales y
no se rellenan con `''` ni con `false`: una cadena vacía se lee como «lo miré y
no hay», y `accesoAbierto: false` afirma que está cerrado. Dos cosas que nadie
comprobó. Tampoco se guarda un `identidad: {}`, que parecería que se miró.

Y en particular: **tener PMCID no implica acceso abierto.** El subconjunto de PMC
mezcla CC0 y CC-BY con CC-BY-NC-ND; suponerlo llevaría a reproducir texto que no
se puede, que es el defecto que `licencia-pmc.ts` ya existe para impedir. Sólo se
afirma cuando la licencia lo dice.

**LA PRUEBA.** `src/__tests__/la-identidad-de-la-publicacion-no-se-tira.test.ts`
(10 casos). Probado al revés quitando el paso del DOI: cae. Incluye el caso que
comprueba que la decisión de extraer sigue yendo **después** de leer la licencia
y no antes — extraer y luego decidir dejaría el texto en memoria y a un `return`
de acabar en un prompt.

**QUÉ NO CUBRE, DECLARADO.**

- **No valida el DOI contra Crossref.** Se pasa el que PubMed dio; `pubmed.ts` ya
  exige que empiece por `10.`, pero que resuelva es otra cosa.
- **No hay disponibilidad de texto completo general**: hoy sólo se sabe de PMC.
  Para una revista de paga, ausente sigue queriendo decir «no se sabe», y eso es
  lo correcto.
- **No pinta nada.** Que la pantalla enseñe el DOI o diga «texto completo no
  reproducible por licencia» es otro trabajo. Aquí el dato deja de morir en la
  función que lo calcula.

---

## REG-399 — cada capacidad de IA con su contrato, y ningún umbral inventado

**QUÉ SE PEDÍA.** `WS-12.contratos-de-evaluacion`: cada capacidad de IA con
dataset, métrica, umbral y política de fallo. El censo decía: «no existe el
contrato por capacidad. **Sin umbral con significado, una métrica es
decorativa**».

`ia/evaluacion.ts` ya era un buen instrumento —exactitud por campo, campos
faltantes, proxy de alucinación—. Faltaba lo que convierte una medición en una
compuerta: qué conjunto, qué métrica, a partir de qué número está bien, y qué
hace el producto cuando no lo está.

### La tentación, y por qué no se cayó en ella

Rellenar los umbrales. Poner 0,95 en cada fila deja el requisito con aspecto de
cerrado, y es **el fallo más caro posible en este repositorio**: no rompe nada,
no falla ninguna prueba, y convierte una decisión clínica no tomada en una
compuerta que parece acordada.

Cuánta pérdida de medicamentos es tolerable al extraer una nota es una cifra
clínica, y la regla 1 prohíbe inventarlas. Aquí un umbral es **un número con
fuente** o es `NEEDS_CLINICAL_REVIEW` **con qué hay que decidir y quién**. De las
17 capacidades, **15 esperan al médico** y las dos que tienen número lo tienen
por una regla escrita, no por una opinión: cero cifras de dosis sin fuente citada
(`.claude/rules/clinical-safety.md`).

### Lo que sí se decidió sin el médico, y no es poco

Qué capacidades existen, qué decide cada una, **qué cuesta que se equivoque**, si
hay conjunto de referencia o no lo hay, y qué hace el producto al fallar. La
consecuencia del error es justamente lo que hace *discutible* el umbral: sin
ella, un número es una preferencia; con ella se puede argumentar.

El guardián lo exige: una consecuencia de menos de 60 caracteres no pasa, y un
conjunto «No existe.» a secas tampoco — hay que decir **qué haría falta** para
que existiera. Tres filas lo dijeron mal y el guardián las obligó a decirlo bien.

### El hallazgo de paso: dos nombres para una capacidad

Al censar los nombres aparecieron **tres rutas que usaban dos**, uno para el
libro de costos y otro para el registro de incidencias, en el mismo archivo:

| ruta | costos | incidencias |
|---|---|---|
| `extraer-entidades` | `extraer-entidades` | `entidades` |
| `procesar` | `nota-consulta` | `nota` |
| `transcribir` | `transcribir` | `transcripcion` |

Los dos registros agrupan por ese nombre, así que **«qué está fallando» y «qué
está costando» no se podían cruzar**, y la lista de funciones afectadas que
enseña una incidencia nombraba cosas que no aparecen en ningún otro sitio. Se
unificó hacia el nombre del **libro de costos**, que es el registro contable: los
documentos ya escritos conservan el suyo, porque reescribir el histórico sería
peor que el desajuste que corrige.

### El censo de nombres se aplica también en ejecución

No sólo en el CI. `reportarFalloIA` comprueba el nombre contra el censo: si llega
una capacidad sin contrato, **la incidencia se anota igual** —descartarla
perdería el aviso justo cuando alguien acaba de añadir una capacidad— y se
**marca**, porque una capacidad de IA sin contrato es una avería de proceso que
también hay que ver. Corregir el nombre a uno parecido inventaría un dato, así
que no se hace.

**LA PRUEBA.** `src/__tests__/cada-capacidad-de-ia-tiene-su-contrato.test.ts` (14
casos). Probado al revés renombrando un `feature` en una ruta: caen tres casos.

**QUÉ NO CUBRE, DECLARADO.**

- **No mide nada.** Es el contrato, no la evaluación. Los conjuntos de la mayoría
  de las capacidades **no existen**, y el contrato lo dice fila por fila —
  incluido el de voz, que no puede nacer de audio real porque la voz es
  biométrica.
- **La política de fallo se declara y sólo una está comprobada en el código**
  (`rechaza_al_momento`, la contrapresión de REG-390). Las demás son la intención
  escrita, no la propiedad medida, y se dice para que nadie lo lea al revés.
- **No cubre la IA de cara al paciente**, que tiene su propia compuerta
  permanente (las doce preguntas del §0 de V9).

---

## REG-400 — el pasaje existe, es literal, y aun así el estudio no lo demuestra

**QUÉ SE PEDÍA.** `WS-12.entailment`. El censo lo decía con precisión: «REG-359
ancla carácter a carácter y cierra la **invención** del respaldo, no la
**interpretación**. Un pasaje puede citarse fuera de contexto».

### La forma de citar mal que sí se puede detectar sin un modelo

Citar los **ANTECEDENTES** de un estudio como si fueran sus hallazgos.

Un resumen estructurado empieza casi siempre por «BACKGROUND: se cree que la
terapia corta es equivalente…». Eso **no es un resultado**: es lo que se creía
antes de hacer el estudio, y a veces es exactamente lo que el estudio vino a
refutar. Anclado como cita se lee igual que una conclusión, con su `[2]` al lado
— el formato que un médico lee como «esto está respaldado».

Lo mismo con el OBJETIVO («este ensayo evalúa si…») y con los MÉTODOS («se
aleatorizaron 400 pacientes»): dicen qué se quiso y cómo, no qué se encontró.

### La causa raíz

**PubMed lo dice** en el XML — `<AbstractText Label="BACKGROUND">` — y el
producto lo tiraba: la expresión que extraía el resumen se comía el atributo
(`<AbstractText[^>]*>`) y unía todo en un texto plano. El dato se calculaba y se
perdía en la misma función. Misma familia que REG-398, dos unidades antes.

### Lo que este trabajo NO es, dicho antes que nada

**No es un evaluador de entailment**, y darlo por tal sería el atajo que este
repositorio persigue por todas partes. No juzga si el pasaje **significa** lo que
la afirmación dice: eso exige un modelo, su conjunto de referencia y un umbral
que tiene que fijar un médico — y `ia/contratos-de-evaluacion.ts` (REG-399) ya lo
tiene declarado como pendiente, en la fila de `evidencia`.

Es la **precondición** de la interpretación: de dónde sale la frase. Un pasaje de
los resultados todavía puede citarse mal; uno de los antecedentes casi siempre lo
está. Por eso `WS-12.entailment` queda **PARTIAL**, no PROVEN.

### Las dos reglas que lo ordenan

1. **No se borra nada, se marca.** Igual que lo no respaldado: la afirmación
   puede ser cierta y el artículo puede ser el correcto. Lo que no puede es
   parecer que ese estudio la demostró.
2. **No saber no es una falta.** Un resumen sin estructura no es un resumen malo;
   `sin_etiqueta` **sí** puede sostener. Marcar por no saber convertiría la
   ausencia de dato en dato de ausencia y llenaría de avisos las citas correctas
   hasta que el médico deje de leerlos.

Y se cuenta **aparte** de lo no respaldado, con su propio aviso: una cita sin
anclar **no existe** en el artículo —el modelo se la inventó—; una anclada en los
antecedentes existe y es literal. Son dos defectos distintos y se arreglan
distinto; mezclarlos escondería el segundo dentro del primero.

**LA PRUEBA.** `src/__tests__/una-cita-de-los-antecedentes-no-demuestra-nada.test.ts`
(21 casos). Probado al revés haciendo que toda sección sostenga: caen cinco.
Incluye el caso que impide pasarse de frenada —una cita de los resultados **no**
se marca— y el que comprueba que se marca **el pasaje y no la afirmación
entera**, porque una afirmación que cita dos artículos y tiene un pasaje flojo no
es una afirmación sin respaldo.

Se reconocen además las etiquetas que usan las revistas de verdad y no sólo las
cuatro del manual: `FINDINGS` e `INTERPRETATION` son de Lancet, `PURPOSE` de
radiología, `PATIENTS AND METHODS` de las quirúrgicas. Quedarse en las cuatro
canónicas dejaría media literatura sin sección, que es el estado en que este
módulo no puede ayudar.

**QUÉ NO CUBRE, DECLARADO.**

- **La polaridad.** «no redujo la mortalidad» citado como «redujo la mortalidad»
  sigue pasando si el pasaje sale de los resultados. Es el siguiente trozo y no
  se finge hecho.
- **El matiz.** «podría reducir» citado como «reduce», igual.
- **El texto completo de PMC.** Un pasaje de ahí no está en ninguna sección del
  resumen y se devuelve «no se sabe», que es la verdad.
- **No mide nada.** No hay conjunto de referencia de citas fuera de contexto; el
  contrato de evaluación lo declara como hueco.

---

## REG-401 — la etiqueta del diseño decía más de lo que dijo la fuente

**QUÉ SE PEDÍA.** `WS-07.prestigio-no-es-calidad`: que la marca de la revista no
suba la calidad metodológica. Su censo decía que sin identidad de revista
normalizada no había dónde comprobarlo — y REG-398 acababa de ponerla.

Al mirarlo salieron **dos cosas**, y la segunda no era la que se buscaba.

### 1. La revista no ordena — y el guardián toca escribirlo AHORA

Hoy nada puntúa por revista: `seleccion.ts` se prohíbe explícitamente puntuar
autoridad metodológica, y el orden de artículos sale sólo del tipo de estudio.

Pero REG-398 acaba de meter la identidad de la revista —nombre, abreviatura ISO,
DOI— **dentro del `Source`**, o sea a mano. Un guardián sobre una propiedad que
todavía se cumple es barato; escribirlo después del primer
`if (revista === 'NEJM')` es tarde.

### 2. La etiqueta del diseño decía de más — esto sí estaba roto

El clasificador colapsaba **dos pares de diseños distintos**:

- `meta-analysis` y `systematic review` salían los dos como «Meta-análisis». Una
  revisión sistemática sin metaanálisis resume los estudios; no combina sus
  resultados.
- `randomized controlled trial` y `clinical trial` a secas salían los dos como
  **«ECA»**. El tipo `Clinical Trial` de PubMed incluye ensayos **no
  aleatorizados** —fase I, un solo brazo—, y llamarlos ECA es afirmar un diseño
  que la fuente no afirmó. Es subir la calidad metodológica, sólo que por la
  etiqueta en vez de por la revista.

**Y el repositorio ya lo sabía.** `desde-pubmed.ts` se niega en redondo a
traducir esa etiqueta a `DisenoDeEstudio` —«traducir esas cubetas inventaría un
dato metodológico que la fuente no dio»— y tiene su caso en
`evidence-model.test.ts`.

Pero esa defensa vive en el borde del **modelo**, y la etiqueta se consume en dos
sitios que no pasan por ahí: el **prompt** del consultor, que la mete como
`[ECA]` delante del resumen, y `articulosMin`, que la manda a la **pantalla del
médico**. Se había decidido que el dato no era de fiar y se seguía entregando a
las dos personas que deciden con él.

### Lo que NO se tocó, y es la mitad importante

**El orden.** Los diseños recién separados conservan **exactamente** el rango que
tenían cuando iban juntos (`Revisión sistemática` con `Meta-análisis`;
`Ensayo clínico` con `ECA`). Cambiarlo sería inventar una jerarquía metodológica
nueva — lo mismo que `seleccion.ts` se prohíbe, y lo que la regla 1 llama
inventar una cifra clínica.

**Cambia lo que se dice, no lo que se prefiere.**

**LA PRUEBA.** `src/__tests__/la-revista-no-sube-la-calidad.test.ts` (12 casos).
Probado al revés añadiendo un desempate por revista al orden: cae el guardián.
Incluye el caso que comprueba que las ramas del clasificador van de más
específica a menos —si la del ensayo fuera antes que la del ECA, un ECA saldría
como ensayo a secas— y el que conserva la prohibición hermana de `seleccion.ts`
para que no se pierda al tocar el módulo de al lado.

**QUÉ NO CUBRE, DECLARADO.**

- **No juzga la calidad de un estudio.** Ni riesgo de sesgo, ni tamaño, ni
  registro previo. Impide que la etiqueta y la revista digan más de lo que la
  fuente dijo, nada más.
- **No cubre las guías**, que tienen su propio requisito abierto (`WS-07.guias`:
  organización, versión, fecha, jurisdicción y vigencia).
- **No prueba la pantalla.** Que el médico VEA la salvedad junto al tipo depende
  del componente; aquí se comprueba que el dato le llega.

---

## REG-402 — una guía tiene edición, y las ediciones se sustituyen

**QUÉ SE PEDÍA.** `WS-07.guias`: motor de guías con organización, versión, fecha,
jurisdicción y estado de vigencia. El censo: «NICE, KDIGO, ACC/AHA, ESC, ADA y
Surviving Sepsis son cadenas de cita FIJAS dentro de motores clínicos. No hay
objeto de guía, ni versión, ni superseded, ni discrepancia entre dos guías
válidas».

### El problema, que no es de formato

Una cadena **no puede decir si esa edición sigue siendo la vigente**.

Las guías se sustituyen. Un motor que cita `KDIGO 2020` lo seguirá citando igual
el día que salga la edición siguiente, y la pantalla de cumplimiento lo enseñará
con el mismo aspecto —una referencia bajo «De dónde salen sus reglas»—. Ni el
médico ni el sistema pueden distinguir la actual de una superada. Son 112 campos
`referencia` y el médico los lee tal cual.

### La línea que este trabajo NO cruza, y es lo más importante

**Aquí no se declara qué guía está vigente.** Cuál es la edición actual de KDIGO,
si la anterior sigue siendo aceptable, o cuál de dos guías válidas manda cuando
discrepan, son **hechos clínicos**, y la regla 1 los protege igual que a una
dosis. Rellenar esa tabla de memoria no rompería nada, no fallaría ninguna
prueba, y saldría impreso al lado de una recomendación con aspecto de comprobado.

Así que **toda guía nace `no_verificada`**, no hay ningún camino para que una
cita de texto salga `vigente`, y `vigente`/`superada` exigen **fuente y fecha de
verificación** — una vigencia declarada sin respaldo no le gana al aviso, que es
el atajo por la puerta de atrás y tiene su caso.

`GUIAS_VERIFICADAS` está **vacía**, y `DISCREPANCIAS` también. No por descuido:
el modelo existe para el día que el dueño lo verifique guía por guía.

Lo que sí aporta hoy: **el hueco se ve**. El médico lee «Cita KDIGO 2020. El
sistema NO verifica si esa edición sigue vigente: compruébalo antes de apoyarte
en ella» en vez de una referencia muda.

### Lo que casi sale mal, y por qué está escrito

El primer lector de citas construía su expresión con `new RegExp` y una plantilla
y **se escapó de más: no reconocía ni una sola de las citas reales del árbol**.
Habría quedado un módulo «conectado» que nunca dispara — la forma más silenciosa
de que una compuerta no proteja, y la misma que REG-394 tuvo que evitar en su
inventario.

Se detectó al probarlo a mano contra las cadenas del registro antes de escribir
el golden. Por eso el primer caso de la prueba ejercita el lector contra
**cadenas copiadas de `registry.ts` y de `inmuno/`**, no contra ejemplos escritos
para que pasen.

El lector es **estricto a propósito**: exige la organización y su año a menos de
25 caracteres. Muchos campos `referencia` son prosa larga —el fundamento entero
de un algoritmo— y tratarlos como citas fabricaría guías que nadie citó.

**LA PRUEBA.** `src/__tests__/una-guia-tiene-edicion-y-las-ediciones-caducan.test.ts`
(18 casos). Probado al revés haciendo que `guiaDesdeCita` devuelva `vigente`.

**UNA CORRECCIÓN DE PASO.** El trinquete `los-motores-llegan-al-medico` cazó que
`vigenciaRespaldada` era un símbolo exportado que nadie llamaba. Tenía razón: en
vez de declararle una excepción, se metió en el camino real —`avisoDeVigencia` la
usa para decidir si una vigencia declarada puede ganarle al aviso—, que además es
lo que hacía falta para cerrar el atajo.

**QUÉ NO CUBRE, DECLARADO.**

- **No dice qué guía está vigente**, y no lo dirá hasta que un médico lo
  verifique. Es la razón de que `WS-07.guias` siga PARTIAL, y lo que falta está
  escrito en `LO_QUE_FALTA_PARA_CERRARLO`.
- **No reestructura los 112 campos `referencia`.**
- **No hay jurisdicción todavía**: el campo existe en el modelo y ninguna cita de
  texto la declara. Ausente = no se sabe, no «en todas partes».
- **No prueba la pantalla**, sólo que la página pide el aviso.

---

## REG-403 — «lo vi» y «localicé a alguien» eran el mismo gesto

**QUÉ PEDÍA EL CENSO.** `WS-11.laboratorio`: «PanelLaboratorio sigue sin
`revisado` / `revisadoPor` / `revisadoEn` / `criticoNotificado`».

**TRES DE LOS CUATRO ERAN UN ERROR DEL CENSO**, y construirlos habría sido
construir el defecto que el invariante de arquitectura existe para impedir — con
el censo dando la orden.

Existen, en el sitio correcto, con otro nombre:

| lo que pedía el censo | dónde vive de verdad |
|---|---|
| `revisado` | `estado: 'cerrada'` de la tarea — «alguien lo revisó y decidió. AQUÍ termina, no antes» |
| `revisadoPor` | `cerradaPor` |
| `revisadoEn` | `cerradaEn` |

Y `laboratorio/firestore.ts` lo tiene escrito bajo el título «DÓNDE VIVE
REVISADO»: *en la tarea, y en ningún otro sitio. Añadir un `revisado` al panel
crearía una segunda fuente de verdad del mismo hecho.*

El censo queda corregido con la cita. **Un censo que pide construir lo que ya
existe es tan caro como uno que olvida un hueco**: manda a duplicar la fuente de
verdad de una entidad clínica.

### El que sí faltaba

`criticoNotificado`. En todo el árbol no había **nada** que registrara que un
valor crítico se comunicó: la única aparición de la palabra era la propia entrada
del censo.

`CierreDeTarea` tiene `avisoAlPaciente`, y es opcional por una razón escrita y
buena: exigirlo en cada cierre convertiría el worklist en un formulario de tres
campos, «y un worklist que cuesta se abandona en una semana».

Pero ese razonamiento se hizo para **el resultado de rutina**. Un potasio de 7,1
cerrado con «repetir y tratar» y el aviso en blanco deja el expediente sin poder
distinguir las dos cosas que ahí importan:

```
«lo vi»   ≠   «localicé a alguien»
```

Y esa distinción es precisamente lo que hace crítico a un valor crítico. Cerrar
la tarea decía lo primero; nada decía lo segundo.

### Por qué pregunta y no bloquea

Porque **si el aviso debe ser obligatorio, y en cuánto tiempo, es política
clínica**, y fijarla está en la lista de prohibiciones del repositorio igual que
inventar una dosis.

Se **pregunta** —regla 6— y el médico contesta. Bloquear el cierre sería fijar
esa política de tapadillo; no preguntar dejaría las dos cosas indistinguibles.
Preguntar es lo único que no decide por él. Y sin registrar sigue siendo `null`,
que no es `'no_avisado'`: confundirlos convierte «no lo sé» en un hecho clínico,
y del lado que hace que nadie llame.

**LA PRUEBA.** `src/__tests__/un-critico-visto-no-es-un-critico-avisado.test.ts`
(11 casos). Probado al revés quitando la condición de prioridad. Incluye el caso
que impide pasarse de frenada —en un resultado no crítico no se pregunta nada— y
dos que **fijan la corrección del censo**, para que nadie vuelva a implementar
`revisado` en el panel.

**QUÉ NO CUBRE, DECLARADO.**

- **No fija el plazo.** Cuánto puede pasar entre ver un crítico y avisar es una
  decisión clínica y normativa que no está tomada. No se inventa un número.
- **No registra a QUIÉN se avisó ni por qué vía.** Hoy consta que sí, que todavía
  no, o que no hacía falta. Un campo de destinatario exige antes decidir qué
  destinatarios cuentan, que también es del médico.
- **No cubre el camino hospitalario**, que crea una tarea por estudio y tiene su
  propio flujo.
- **No prueba el render**, sólo que la pantalla pide la pregunta y que el botón
  de cerrar no se deshabilita por ella.

---

## REG-404 — agendar contaba como haber visto al paciente

**QUÉ SE PEDÍA.** `WS-11.estados-del-cierre`: «Falta `scheduled` como estado
propio».

### El defecto

El pendiente «Agendar el seguimiento» nace cuando el médico pone fecha de
control. Su único camino era:

```
solicitada → en_curso → completada → cerrada
```

Es decir: **se cerraba al crear la cita**. Agendar contaba como haber visto al
paciente.

Y entonces, si el paciente no venía —no-show, la cita se movió y nadie la volvió
a poner, el recordatorio no salió—, **nada lo reabría y nada lo echaba en
falta**. El control que el médico pidió no ocurría, el pendiente estaba cerrado,
y el sistema decía que el trabajo estaba hecho **porque nadie le preguntó nunca
al calendario**.

Es la misma forma de fallo que REG-501 cerró del otro lado —que el resultado
EXISTIERA contaba como que alguien lo había leído— aplicada a la otra punta del
ciclo: que la cita EXISTA cuenta como que el paciente vino.

### El arreglo

`agendada` como estado **vivo**: la cita existe, el paciente no ha venido, y el
pendiente sigue en el worklist hasta que el encuentro pase o alguien decida que
ya no aplica.

**No se puede saltar de `agendada` a `cerrada`.** Cerrar es la constancia de que
alguien revisó, y desde «hay una cita puesta» no hay nada que revisar todavía.
Dejar ese atajo abierto habría hecho el estado nuevo decorativo — es el caso que
se prueba al revés.

**Sólo el seguimiento tiene el paso extra.** Un estudio pendiente o una receta
por entregar siguen igual: meterles un paso que no significa nada para ellos
alargaría el camino sin decir nada, y un worklist que cuesta se abandona.

**Y no hizo falta una categoría nueva en el worklist.** Antes no había forma de
distinguirlos —la tarea se cerraba al agendar, así que todo `seguimiento` vivo
estaba por definición sin agendar—. Ahora lo que se espera de uno ya agendado no
es una acción del consultorio sino que el paciente venga, que es
`esperando_paciente`, la categoría que ya existía. Inventar una octava habría
sido añadir modelo sin añadir información.

**LA PRUEBA.** `src/__tests__/agendar-no-es-haber-visto-al-paciente.test.ts`
(12 casos). Probado al revés abriendo `agendada → cerrada`: cae.

**UNA FIRMA QUE SE ENSANCHÓ.** `siguientePaso` pasó de recibir sólo el estado a
recibir también el tipo, porque el camino del seguimiento ya no es el de los
demás. El guardián de V15 que fija «el siguiente paso legal se define UNA sola
vez» se adaptó conservando lo que comprueba.

**QUÉ NO CUBRE, DECLARADO.**

- **No comprueba el calendario.** `agendada` es lo que alguien DECLARÓ, no lo que
  la colección de citas dice. Cruzarlo con `appointments` es la rebanada
  siguiente y queda nombrada.
- **No cubre el no-show.** Que una cita pasada sin encuentro reabra o escale
  exige decidir cuánto se espera y qué hacer después, y eso es del médico. Lo que
  sí pasa ya: una tarea `agendada` cuya fecha venció cae en `vencida`, que es lo
  que se mira primero.
- **No cierra solo el pendiente cuando el paciente viene.** Sigue haciendo falta
  que alguien lo marque; lo que cambia es que ahora hay un estado donde esperar
  en vez de una tarea cerrada de más.

---

## REG-405 — dos proyecciones volvían a ser la puerta que devuelve un array pelado

**QUÉ SE PEDÍA.** `WS-10.problemas-medicacion-alergias`: «Los tres existen y
están cableados (REG-363). Falta persistencia y `asOf`/`version` en los tres».

### El defecto, y la ironía de dónde estaba

`listarNotasCompat` devuelve `{ notas, truncada, techo }`, y su encabezado
explica por qué se **borró** la puerta que devolvía un array pelado:

> «Un array no puede decir que viene recortado; quien lo recibe no tiene forma de
> saberlo, y con un historial clínico el silencio se lee como *no tiene*».

Y a un paso de ahí, `problemasActivos(notas)` y `medicamentosVigentes(notas)`
**volvían a ser esa misma puerta**. Las dos pantallas que las llaman tenían
`truncada` en la mano —`/consulta` lo lee dos líneas antes, `/expediente` se lo
pide a `useExpediente`— y no tenían dónde ponerlo.

Con un historial largo, las dos listas se calculaban sobre una **ventana** y se
enseñaban como si fueran el expediente entero.

### Por qué en medicación cuesta más

Un fármaco recetado antes del techo desaparece de la lista vigente, y con él
desaparece de **todo lo que la usa**: la comprobación de interacciones no lo
mira, la reconciliación no lo echa en falta, y la nota nueva se escribe como si
el paciente no lo tomara. La ausencia no produce ningún error — produce una lista
más corta, que se lee igual de bien.

### El arreglo: el sobre que ya existía

`estadoDeAlergias` tenía este sobre desde REG-363 —`asOf`, `version`,
`historialRecortado`—. Aquí **no se inventa uno nuevo**: se usa el mismo. Tres
formas de decir «esto salió de una ventana» serían tres sitios donde arreglarlo.

Los núcleos no cambian: `problemasActivos` y `medicamentosVigentes` siguen siendo
las mismas funciones puras con sus pruebas. Lo que se añade es el sobre, y un
caso comprueba que la lista del sobre es **exactamente** la de la función pura —
si se separaran, habría dos respuestas a «qué toma el paciente».

### Lo que deliberadamente NO se hizo

**Persistir la proyección.** El censo lo pide en la misma línea, y
`WS-10.proyeccion-no-es-segunda-verdad` avisa de por qué no se puede hacer sin
más: guardar una proyección sin decidir quién manda cuando el caché y las notas
discrepan crea la segunda fuente de verdad que el invariante de arquitectura
prohíbe.

El sobre es la **precondición**: una proyección sin `asOf`, sin `version` y sin
saber si salió de un recorte no se puede guardar de forma segura ni invalidar.

**LA PRUEBA.** `src/__tests__/una-lista-no-dice-de-cuanto-historial-salio.test.ts`
(10 casos). Probado al revés quitando el `historialIncompleto` de una pantalla:
cae. Incluye el que evita la recaída — ninguna de las dos pantallas puede volver
a llamar `problemasActivos(firmadas)` ni `medicamentosVigentes(firmadas)`.

**UNA ADAPTACIÓN.** El guardián de REG-363 (`el-expediente-resume-el-estado`)
pinchaba el **nombre del import**. Lo que protege —que la pantalla los importe y
los use— no cambió; cambió por qué puerta entran, y se adaptó diciéndolo.

**QUÉ NO CUBRE, DECLARADO.**

- **No pinta el aviso.** Que la pantalla DIGA «esta lista sale de las últimas N
  notas» es trabajo de la vista; aquí el dato llega hasta ella y deja de caerse
  en la puerta.
- **No persiste nada**, por lo de arriba.
- **No cambia la regla de vigencia** de ninguna de las dos listas.

---

## REG-406 — el guardián que impide que una proyección se vuelva la verdad

**QUÉ SE PEDÍA.** `WS-10.proyeccion-no-es-segunda-verdad`: «Patient State es
proyección sobre Clinical Truth, no una segunda fuente». El censo decía: «las
proyecciones se recalculan en el navegador y ninguna se persiste […] persistirlas
sin decidir la autoridad crearía la segunda verdad que esto evita».

### Por qué ahora

Porque REG-405 acaba de dar a las tres proyecciones su sobre (`asOf`, `version`,
`historialRecortado`), que es **la precondición para poder persistirlas**. O sea:
acaba de quitarse el único obstáculo práctico que había.

Que hoy no se persistan no es una garantía — es una casualidad que dura hasta que
alguien quiera ahorrarse el recálculo. Un guardián sobre una propiedad que
todavía se cumple es barato; escribirlo después del primer `setDoc` es tarde. Es
el mismo razonamiento de REG-401 con la identidad de la revista: la unidad
anterior puso el arma sobre la mesa.

### Lo que pasaría sin él

Un documento con la lista de medicamentos vigentes es, desde que existe, **una
segunda respuesta a «qué toma este paciente»**. Las dos se separan en cuanto se
firma una nota que el caché no vio, y las dos se leen igual de bien: la pantalla
enseña la guardada, la comprobación de interacciones usa la guardada, y las notas
dicen otra cosa sin que nadie lo note.

### El intento que los propios guardianes del repositorio rechazaron

Se escribió primero como `lib/expediente/la-proyeccion-no-manda.ts`: la política,
el censo de proyecciones y una función `sirveParaDecidir` **escrita de antemano**
para el día que se persistan.

**Tres guardianes lo rechazaron a la vez** —`modulos-sin-conectar`,
`los-motores-llegan-al-medico` y `el-camino-del-medico-llega-entero`— y tenían
razón: era código de tiempo de ejecución que nadie llama, que es exactamente la
familia «escrito y sin conectar» que este árbol persigue. Escribir la lógica del
caché antes de que exista el caché es adivinar cómo será.

Se retiró el módulo. La política **sí** es real, pero es una propiedad del
árbol —«ningún módulo de proyección escribe»—, no una función que alguien
ejecute: su sitio es el guardián. Las tres condiciones quedan escritas ahí, que
es donde las va a leer quien vaya a persistirlas, **porque para hacerlo tendrá
que tocar ese archivo**.

Se anota porque la lección vale más que el archivo: *la tentación de escribir la
defensa del problema que todavía no existe se parece mucho a la de escribir el
umbral que nadie ha decidido.*

### Las tres condiciones, que quedan escritas

1. **La proyección nunca es autoridad**: ante discrepancia manda la nota firmada,
   sin excepción y sin «salvo que la proyección sea más reciente» — se calcula de
   las notas, así que una proyección que le gana a su origen es un error de
   cálculo, no un dato nuevo.
2. **Trae `asOf` y `version`**, o no se puede saber si está vieja ni quién la
   calculó. (Comprobado: los tres sobres los tienen.)
3. **Una proyección anterior a la última nota firmada NO SE USA**: se recalcula o
   no se enseña. Nada de refrescar en segundo plano — un caché que se usa
   mientras se actualiza es un caché que a veces miente, y aquí «a veces» es una
   consulta.

**LA PRUEBA.** `src/__tests__/la-proyeccion-no-le-gana-a-la-nota.test.ts` (8
casos). Probado al revés añadiendo un `setDoc` a una proyección: cae. Comprueba
además que ninguna lee el reloj —un `asOf` que la propia función se inventa no
significa nada— y que los borradores siguen sin contar en la medicación vigente,
que es la parte de «su verdad» que más fácil se pierde.

**QUÉ NO CUBRE, DECLARADO.**

- **No impide persistir**: impide persistir **en silencio**.
- **No cubre UCI/Hospital**, que están en otro carril.
- **No vigila un caché en el navegador**: si alguna vez se memoriza una
  proyección en `localStorage`, esto no lo ve.

---

## REG-407 — un presuntivo elegido no es un presuntivo de fábrica

**QUÉ SE PEDÍA.** `WS-10.pantalla-de-certeza`: «El médico puede elegir el tipo de
un diagnóstico». El censo: «Ninguna pantalla lo permite, así que `tipoOrigen:
medico` sólo lo lleva el diagnóstico añadido a mano. Mientras siga así el sistema
no distingue un presuntivo elegido de uno de fábrica».

### El defecto

El modelo estaba completo desde REG-372 — `tipo` con sus cuatro valores y
`tipoOrigen` con este comentario:

> `'medico'` — «Lo eligió una persona. **Es lo único que autoriza a decir
> confirmado**.»
> `'extraccion'` — «El modelo emitió `tipo` explícitamente. **Es una sugerencia,
> no una firma**.»

Y **ninguna pantalla lo dejaba elegir.** La fila de un diagnóstico enseñaba
descripción, CIE-10 y el botón de borrar. El `tipo` no aparecía. Así que:

- un diagnóstico que la IA extrajo como **definitivo** se guardaba como
  definitivo con `tipoOrigen: 'extraccion'` — una sugerencia que el médico nunca
  vio como elección, y que no podía cambiar;
- uno añadido a mano nacía `presuntivo` y se quedaba presuntivo para siempre.

Es **«sugerido ≠ confirmado»** y **«la autoridad final es del médico»**
incumplidos en el mismo control. El modelo sabía distinguirlos y la pantalla no
dejaba ejercer la distinción.

### El arreglo

Un selector de tipo en cada fila, con los cuatro valores, etiqueta accesible que
lleva el diagnóstico dentro, y bloqueado en nota firmada. **Cambiarlo marca
`tipoOrigen: 'medico'`**: es la única vía por la que un diagnóstico pasa a estar
firmado por una persona, y ésa es la parte que se prueba al revés.

Y la **procedencia se dice** —principio del sistema de diseño: lo que escribió la
IA enseña de dónde salió— pero **una vez y no por fila**: un aviso por
diagnóstico, en una nota con seis, es ruido que se aprende a saltar, y entonces
deja de proteger sin dejar de ocupar sitio. Es el mismo criterio con el que
`avisoAlPaciente` se dejó opcional (REG-403) y con el que el aviso de vigencia de
guías sólo sale donde hay cita (REG-402).

`por_defecto` cuenta igual que `extraccion`, y un diagnóstico **sin** origen —de
notas anteriores a REG-372— también: en los tres casos nadie lo decidió, que es lo
único que el aviso afirma.

**LA PRUEBA.** `src/__tests__/el-medico-elige-el-tipo-de-su-diagnostico.test.ts`
(11 casos). Probado al revés quitando el `tipoOrigen: 'medico'` del `onChange`:
cae. Incluye el que exige los **cuatro** tipos del modelo —ofrecer tres dejaría un
estado clínico inalcanzable desde la pantalla, que es como un modelo completo se
vuelve uno incompleto— y el que comprueba que el aviso vive **fuera** del `map`.

**QUÉ NO CUBRE, DECLARADO.**

- **No obliga a revisar.** El médico puede firmar con diagnósticos cuyo tipo puso
  el dictado; lo que no puede es no enterarse. Obligar sería fijar política
  clínica —cuándo un tipo sugerido es aceptable— y eso no lo decide un archivo de
  software.
- **No cambia lo ya firmado.** Los diagnósticos de notas anteriores conservan su
  `tipoOrigen`, incluso ausente: rellenarlo sería inventar la autoría.
- **No toca `estado`** (activo/resuelto/crónico/en seguimiento), que es otro eje.
- **No prueba el render.** Que el selector se vea y se use con teclado depende del
  componente; aquí se comprueba que existe, con qué etiqueta y qué escribe.

## REG-408 — «100 000 usuarios» no nombraba ningún experimento

**QUÉ SE PEDÍA.** `WS-02.concurrencia-definida`, con el hueco escrito palabra por
palabra en el censo: «No hay modelo de carga que diga cuántos de N registrados
están en consulta a la vez, ni con qué mezcla de operaciones. Sin eso, «100 k» no
nombra ningún experimento.»

### El defecto

`run-consultorio-load.mjs` estaba PROVEN desde REG-378 y medía de verdad. Pero sus
entradas eran `--tenants`, `--physicians-per-tenant` y `--concurrent`: tres
números que había que inventarse a mano en cada corrida. La evidencia guardada
decía «100 médicos, 50 concurrentes» y **nadie podía decir si eso era el producto
a 2 000 usuarios o a 100 000**, porque no existía la función que traduce lo uno en
lo otro.

Un arnés parametrizado por sus propios botones no es evidencia *de* nada: es
evidencia de sí mismo.

Y debajo había una confusión más vieja: «usuarios registrados» es un **inventario**
sin ventana de tiempo, «sesiones concurrentes» es una **foto** que sólo significa
algo con un instante pegado, y «peticiones concurrentes» no es ninguna de las dos
sino un caudal por un tiempo de servicio. Mezclarlas es el modo clásico de
anunciar un número grande habiendo provocado una carga que 300 usuarios habrían
producido.

### Cómo se descubrió que la cota supuesta estaba mal

Midiéndola. Para decidir qué escenarios cabían en este entorno, la primera versión
de `COTAS_LOCALES` puso `sesiones: 200` a ojo. Al correrlo salieron dos cosas que
no se habrían adivinado:

- **400 sesiones simultáneas aguantan**, con cero errores en 3 200 peticiones. La
  cota supuesta se quedaba corta a la mitad — y con ella el escenario de 10 000
  registrados se habría declarado bloqueado sin serlo.
- Pero **el caudal no subió**: 221 pet/s con 200 sesiones y 220 con 400. Lo único
  que creció fue la espera (p50 460 → 1 042 ms, p95 2 320 → 4 542 ms).

O sea que la cota del entorno local no es un número de sesiones sino una **meseta
de caudal**, y por encima de ella se mide cola, no carga. Un número supuesto nunca
habría contado eso.

### La regla que lo hace seguro

Ocho conceptos declarados con su **ventana** y con **lo que NO cuentan** —de los
ocho, sólo «usuarios registrados» tiene `ventana: null`, porque es lo único que es
un inventario—. De ahí se derivan los siete escenarios con su mezcla de
operaciones, su read/write ratio, sus llamadas de IA y evidencia, su duración y su
factor de ráfaga.

Dos cosas que el arnés ahora **se niega** a hacer:

- `--registered` junto a `--concurrent` es un error. Una corrida con la etiqueta
  de un escenario y la carga de otro es la evidencia más cara de producir y la más
  fácil de creerse.
- Un escenario que no cabe en la cota **aborta** diciendo qué infraestructura
  falta, en vez de correrse a escala reducida con la etiqueta puesta.

### Lo que no se inventó

Las razones del modelo (qué fracción de los registrados está en consulta a la vez)
son **supuestos declarados**, con `medidoEn: null` y con la base de la que salen:
sirven para nombrar el experimento, no para afirmar un hecho. Los umbrales de
aceptación —qué p95 pasa, qué tasa de error se tolera— van con
`NEEDS_OWNER_DECISION`, igual que el validador ya declaraba que no aprueba SLOs.
Un umbral plausible es peor que ninguno: convierte una corrida en un aprobado que
nadie firmó.

### La separación que salvó la mitad de WS-02

No hacen falta N sesiones para representar N registrados: un registrado que no
está en consulta no produce ni una petición, sólo deja **documentos residentes**.
Cada escenario se parte en dos ejes —concurrencia (cuesta sesiones) y volumen
(cuesta documentos)— y se juzgan aparte.

Sin esa separación, «100 000 registrados» parece pedir 100 000 sesiones y los
siete escenarios se declaran bloqueados de golpe. Con ella, **2 000 y 10 000 se
corrieron aquí** y los cinco grandes quedaron con el desbloqueo escrito con
nombres, no con «un entorno más grande».

### Lo que la corrida enseñó

Se le añadió al arnés la siembra de documentos residentes, porque hasta aquí toda
corrida medía un emulador **vacío** y un escenario de N registrados es concurrencia
*encima de* lo que esos N ya acumularon.

Con 39 600 documentos residentes y las mismas 77 sesiones, la latencia se multiplicó
por seis (p50 115 → 737 ms) **y las lecturas siguieron siendo exactamente 20 por
consulta** — las mismas que sobre una base casi vacía. Es la distinción que
importa: la latencia es del emulador, que no tiene índices desplegados; la cota de
lectura es del producto, y se mantuvo. WS-03 ya había medido plano el número de
documentos devueltos, y esto lo confirma bajo carga concurrente, que es como se usa.

### Lo que la prueba tumbó en el primer intento

El guardián contra la etiqueta falsa comparaba cada botón contra su valor
predeterminado. Y `--concurrent=8` **es** el predeterminado: el choque más fácil de
escribir era justo el que no se veía. Comparar valores no responde a la pregunta
«¿lo pusiste tú?», así que ahora se anota qué banderas llegaron de verdad.

### Qué NO cubre

- No prueba que el producto aguante 100 000 usuarios. Prueba que el escenario está
  definido, que dos de los siete se corrieron, y que los cinco restantes dicen con
  precisión qué les falta.
- La corrida es de **saturación**, no del caudal del escenario: aplicó 88 veces el
  caudal modelado de 2 000 registrados. Los percentiles son los de la cola.
- Toca el **44 %** de la mezcla: no provoca autoguardado, receta, transcripción,
  redacción ni evidencia. El informe lo lleva escrito.
- Nadie ha medido si el 12 % es el 12 %.

**Prueba.** `src/__tests__/cien-mil-usuarios-no-nombra-un-experimento.test.ts` (32 casos).

## REG-409 — un WER bajo no compensa una dosis por mil

**QUÉ SE PEDÍA.** `TR-VOZ.error-clinicamente-pesado`: «Un WER genérico bajo no
compensa un error de dosis, unidad, negación o lateralidad. Falta el análisis
ponderado sobre consulta larga.»

### El defecto

El WER cuenta palabras y las cuenta todas igual. En la consulta sintética de 532
palabras del corpus del árbol, cambiar «setenta y cinco microgramos» por «setenta
y cinco miligramos» da un WER de **0,188 %**. Publicado así, ese motor sale
excelente. La levotiroxina va multiplicada por mil.

### Por qué NO se ponderó, que era la salida obvia

Dar más peso a los errores graves falla por dos sitios.

El primero: qué peso vale una dosis frente a una lateralidad es una decisión
clínica, y un número inventado aquí acaba en una diapositiva como si alguien lo
hubiera firmado.

El segundo ya estaba escrito en `politica-critica.ts` desde antes: *«No existe
umbral de similitud que haga esa sustitución aceptable: está prohibida, **no
penalizada**.»* Un peso es una penalización, y una penalización **se compensa con
volumen**: bastan suficientes frases buenas para que la media vuelva a ser
bonita. Meter un error de dosis en un promedio es autorizar que se compense.

Así que no hay un número. Hay tres cuentas que no se suman —críticos, sin
clasificar, ordinarios— y se aprueba con cero en las dos primeras.

### Los cuatro defectos que salieron al CORRERLO

Los cuatro aparecieron ejecutando el módulo contra frases reales **antes** de
escribir la prueba, que es la lección que dejó REG-402. Los cuatro habrían pasado
una revisión de código, y tres de ellos no fallaban: **aprobaban**.

1. **La negación volteada salía aprobada.** El primer intento reusaba
   `condicionesNegadas`, que contesta «¿esta FRASE contiene una negación y una
   condición?». Con «paciente niega diabetes y niega hipertensión» → «paciente
   TIENE diabetes y niega hipertensión», la frase transcrita todavía contiene un
   «niega» —el de la hipertensión— así que las dos versiones daban la misma lista
   y el volteo no se veía. **Reutilizar un motor canónico no basta: hay que
   comprobar que contesta la pregunta que se le hace, no la que él contesta.**
2. **«microgramos» no era «mcg».** Los pares prohibidos del Dr. conocen los
   símbolos, y un médico dicta palabras. El clasificador estaba ciego justo donde
   ocurre el dictado, que es todo su dominio. Se arregla clasificando sobre el
   texto ya normalizado por el pipeline — no con una lista nueva de unidades
   habladas.
3. **«metformina» → «meropenem» era ordinario.** El vocabulario que se usaba,
   `criticosGlobales()`, son **35 siglas de UCI** y ni un nombre de fármaco. Un
   módulo que pesa errores clínicos y no reconoce los fármacos del consultorio no
   pesa nada. Ahora sale de `medical-vocabulary`, que ya existía: **1 964
   términos en vez de 35**.
4. **Un error contado dos veces.** «40 mg» → «400 mg» salía como corrimiento de
   decimal Y como cifra perdida. Inflar la cuenta importa cuando la cuenta ES el
   resultado.

### Lo que el alineador no puede ver, y por eso hay dos lecturas más

`sustituciones()` alinea una palabra contra una palabra y descarta los tramos
desiguales a propósito. Perfecto para el bucle de aprendizaje, y ciego para esto:
cuando el reconocedor **se come** el «no» de «no tiene alergias», eso es un
borrado, no una sustitución. El error más caro que existe es justo el que la
alineación por sustituciones no ve.

Por eso se cuentan aparte las cifras y las marcas de negación, sobre el texto
entero. Las dos ven borrados.

### La tercera cuenta es la que hace honesto al módulo

`sin_clasificar` cuenta para reprobar, igual que un crítico. Si no contara, el
módulo tendría un incentivo perverso: cuanto menos supiera reconocer, más limpio
saldría todo. «No sé qué es esto» no es «esto está bien».

Y por eso una sustitución entre dos términos críticos **no** se llama
`sustitucion_farmaco`: afirmarlo exige un catálogo de fármacos. Se dice lo único
que se puede sostener — que no se da por bueno.

### Dónde llega el dato

`scripts/medir-wer-limpio.ts`, que es quien escribe `docs/voice/WER-MEDIDO.json`.
El documento publicado gana los errores clínicamente pesados, contados y
desglosados por clase, **fuera de la media**.

### Dos trinquetes subieron, con su nombre puesto

`FUERA_DEL_CAMINO_HOY` 32 → 33 y `huerfanasMax` 38 → 39. El módulo compara una
transcripción contra su **gold**, y en una consulta de verdad no hay gold: si lo
hubiera, no haría falta transcribir. Es evaluación, misma categoría que
`uci/benchmark-metricas.ts` y `correrBenchmark`, y queda declarada como isla con
su motivo en los tres guardianes que la vigilan.

### Qué NO cubre

- No mide con un proveedor real: la consulta larga contra un reconocedor de
  verdad sigue siendo `TR-VOZ.consulta-larga`, bloqueada por presupuesto.
- No sustituye al WER, que se sigue calculando **en crudo** para poder compararlo
  con lo publicado.
- No distingue dos fármacos, no ve quién habló, no ve la intención de orden y no
  ve el momento. Los cuatro están declarados en `LO_QUE_NO_SE_VIGILA`.
- No fija ningún umbral de WER: cuánto se tolera de un motor que se entiende mal,
  pero no es peligroso, lo decide el dueño.

**Prueba.** `src/__tests__/un-wer-bajo-no-compensa-una-dosis.test.ts` (21 casos).
## REG-337 — la pantalla del expediente botaba al bajar: `scrollIntoView` no respeta a los ancestros

**Área.** `/expediente/[patientId]` — el riel longitudinal del paciente
(`ClinicalSpine`), en teléfono y en escritorio por igual.

**Qué fallaba.** Al desplazarse hacia abajo por el expediente, la página saltaba
sola de vuelta a la zona alta, una y otra vez, mientras el dedo (o la rueda)
seguía bajando. La pantalla «botaba»: bajaba lo suficiente para enseñar «Datos
del paciente» y «Herramientas clínicas», y volvía arriba sin que nadie se lo
pidiera. No era un problema del dispositivo: pasaba igual en iOS y en escritorio.

**Cómo se descubrió.** El dueño grabó la pantalla del teléfono (28-ago-2026)
bajando por el expediente de una paciente sin notas firmadas, y dijo «mira cómo
se bota la pantalla cuando bajo». En el vídeo se ve el ciclo completo repetido
media docena de veces en diecisiete segundos. Ninguna prueba lo veía: la suite
corre en `node`, sin layout y sin scroll — y el guardián que existía sobre este
código **congelaba el defecto**, porque pedía por su nombre la opción que lo
causaba.

**Causa raíz.** El riel seguía la lectura del médico así:

```ts
el?.scrollIntoView({ behavior: comportamientoScroll(), block: 'nearest', inline: 'nearest' })
```

y su comentario afirmaba, literalmente, «`nearest`, para no arrastrar la
página». **Es falso.** `nearest` elige la ALINEACIÓN; no elige a quién se
desplaza. `scrollIntoView` recorre **todos** los ancestros desplazables —el
documento incluido— y mueve cada uno lo necesario para que el elemento quede
visible. No existe forma de pedirle «muévete sólo dentro de tu contenedor».

Con `PatientAnchor` en `position: sticky; top: 0` y el riel justo debajo en flujo
normal, a ~100px de bajada el riel ya salió del viewport. Ahí se cierra el bucle:

```
bajar → IntersectionObserver marca otra sección → setActivo
      → el efecto pide traer a la vista un botón del riel que ya no se ve
      → el navegador SUBE la página para enseñarlo
      → al subir cambia otra vez la sección visible → setActivo → …
```

Y con desplazamiento suave, cada salto es además una animación peleándose con el
dedo del médico. El defecto es de la API del DOM, no del dispositivo — por eso se
veía idéntico en los dos sitios donde el dueño lo notó.

**La regla que lo hace seguro.** Cuando lo que hay que mover es UN carril, se
desplaza ese scrollport **por su nombre** (`riel.scrollTo`), que no puede tocar a
un ancestro aunque quiera. `scrollIntoView` queda para los viajes que el usuario
PIDE —el click del riel, que sí debe mover la página— y nunca para seguir la
lectura. La aritmética de «¿hace falta moverse, y hasta dónde?» se levantó a
`src/lib/ui/traer-a-la-vista.ts`: pura, sin DOM, y por tanto probable de verdad
en una suite que corre en `node`. Devuelve `null` cuando el activo ya se ve, que
es la otra mitad del arreglo: un desplazamiento de 0px sigue siendo un
desplazamiento.

**Test / control permanente:**
`src/__tests__/reg337-la-pantalla-no-bota-al-bajar.test.ts` (12 casos). Probado
al revés con tres defectos inyectados uno a uno —devolver la línea original de
`scrollIntoView`, devolver `scrollLeft` en vez de `null` cuando el activo ya se
ve, y alinear siempre al final ignorando el desborde por la izquierda— y en los
tres cae.

`src/__tests__/v15-rtc18-el-spine-no-se-viste-de-filtro.test.ts` caso 5 pedía
`block: 'nearest', inline: 'nearest'` y con eso **congelaba el defecto**. La
propiedad que ese caso quería asegurar nunca fue «usa nearest»: era «el activo se
ve dentro del riel». Se re-expresa por el mecanismo que de verdad la cumple.

**Qué NO cubre, declarado.**

**Visto en un navegador (28-ago-2026).** La suite corre en `node` —sin layout ni
scroll— así que la reproducción se hizo aparte, en Chromium con Playwright, sobre
un arnés que copia la estructura real (ancla `sticky`, riel en flujo normal,
`IntersectionObserver` con el mismo `rootMargin`) e **importa la aritmética real
transpilada**, no una copia. Viewport 390×844, rueda hacia abajo en pasos de
120px, midiendo `window.scrollY` tras cada paso:

| | `scrollY` a lo largo de la bajada | botes hacia arriba |
|---|---|---|
| **antes** (2 ítems, la paciente del vídeo) | 120 → 240 → **360 → 199 → 175** → 295 → … | **2** |
| **antes** (5 ítems) | … 775 → 895 → **570 → 175** → 295 → 415 → **226 → 175** | **6** |
| **después** (2 ítems) | 120 → 240 → 360 → 480 → 600 → 720 → 810 | **0** |
| **después** (5 ítems) | 120 → 240 → … → 2040 → 2160 | **0** |

Con cinco ítems, la versión vieja **nunca pasaba de ~900px**: la página se
quedaba atrapada volviendo a 175px, que es exactamente lo que se ve en el vídeo
del dueño. Y el riel no perdió su función: con el arreglo, y con el riel
desbordando de verdad, su `scrollLeft` va 0 → 345 → 545 siguiendo al activo
mientras `window.scrollY` no retrocede una sola vez.

**Con el dedo, que es como lo usa el médico (28-ago-2026).** Lo anterior se midió
con la rueda; el scroll táctil tiene inercia propia y podía comportarse distinto,
así que se midió aparte inyectando eventos táctiles reales al motor
(`Input.dispatchTouchEvent` por CDP), 18 arrastres por caso. Dos intentos previos
se descartaron por inválidos: **no reproducían el defecto conocido en el caso
viejo**, y una medición que no ve el fallo que ya existe no mide nada.

| teléfono | antes | después |
|---|---|---|
| iPhone 13 | 1027 de 2505 px · **8 botes** | 2505 de 2505 · 0 |
| iPhone SE | 605 de 2648 px · **8 botes** | 2648 de 2648 · 0 |
| iPhone 14 Pro Max | 500 de 2429 px · **9 botes** | 2429 de 2429 · 0 |
| Pixel 5 | 915 de 2442 px · **8 botes** | 2442 de 2442 · 0 |
| Galaxy S9+ | 292 de 2558 px · **6 botes** | 2558 de 2558 · 0 |

Con el dedo es **peor** que con la rueda, y la traza es caótica —
`869 → 298 → 182 → 1067 → 339 → 1140 → 194` en el iPhone 13 — que es exactamente
lo que se ve en el vídeo del dueño.

**Qué NO cubre, declarado.**

- **No se ha recorrido la pantalla REAL en un navegador**, sólo el arnés que
  reproduce su estructura. Falta abrir `/expediente/[patientId]` con datos y
  bajar con el dedo — la regla de diseño lo exige y sigue pendiente.
- **No vigila al resto del producto.** Un `scrollIntoView({ block: 'nearest' })`
  nuevo en otra pantalla volvería a arrastrar la página. El guardián sólo mira
  este componente, que es el único que hoy lo hacía para seguir la lectura.
- **Sólo eje horizontal, y sólo `direction: ltr`.** Un carril vertical
  necesitaría su gemela; hoy no hay ninguno en el producto.
- **No toca al IntersectionObserver ni a su `rootMargin`.** Qué sección se
  considera activa no cambió: si el resaltado se adelanta o se atrasa, ése es
  otro defecto y no está arreglado aquí.

## REG-410 — la warfarina de marzo, otra vez, y en la pantalla donde se firma

**QUÉ SE BUSCABA.** `WS-10` — que el estado longitudinal del paciente llegue al
punto donde se decide. Salió siguiendo `medsDelCuadro` por la pantalla de
consulta, para otra cosa.

### El defecto

REG-188 se llama «los motores veían la receta de hoy, no al paciente», y su
encabezado lo explica con un ejemplo concreto:

> Paciente con warfarina de marzo al que hoy se le receta ketorolaco. **La regla
> de sangrado existe y está probada, y no dispara**, porque la warfarina no está
> en la nota de hoy.

Aquella reparación creó `cuadro-completo` y lo llevó al copiloto, a la API de
evidencia, a la vigencia renal y a la reconciliación de medicación.

**A la barra de avisos no.** Siguió llamando `detectarInteracciones(medicamentos)`
con la lista de HOY. O sea que el escenario exacto que REG-188 nombra seguía sin
disparar en la única superficie que el médico mira antes de firmar — la misma
barra cuyo comentario dice «lo que puede matar hoy no se pliega nunca».

Comprobado antes de tocar nada: `detectarInteracciones([{nombre:'Ketorolaco'}])`
devuelve `[]`.

### Cómo se descubrió, y por qué no lo cazaba nada

`medsDelCuadro` aparecía en cuatro sitios de la pantalla y en el quinto —la
llamada a `construirAvisos`— la lista era `medicamentos`. La prueba de REG-188 no
lo veía porque **no menciona la barra ni las interacciones**: comprueba que el
cuadro se arma y que dos motores lo reciben, no que llegue a los demás.

Es «escrito y sin conectar» sobre una reparación anterior: el arreglo alcanzó a
cuatro consumidores y no al quinto, que era el que enseñaba el aviso. Y no
fallaba nada — la barra salía en verde, que es lo caro.

### Por qué no bastaba con pasarle la lista larga

Porque entonces una interacción entre dos fármacos que el paciente lleva años
tomando saldría en CADA consulta, para siempre, mezclada con la que se acaba de
crear. `farmacovigilancia.ts` ya tiene escrito lo que cuesta eso: *«las alertas
falsas son caras: enseñan al médico a ignorar el panel, y entonces la verdadera
tampoco se lee»*. Una alerta verdadera repetida hasta el cansancio hace el mismo
daño.

`interaccionesDelCuadro` separa lo que **introduce esta consulta** de lo que ya
venía, corriendo el mismo detector sobre la medicación previa sola. Sin motor
nuevo y sin heurística: si la interacción ya salía sin lo de hoy, no la crea hoy.

**Ordenar no es filtrar**: ninguna desaparece, y `introducidaHoy: undefined`
cuenta como de hoy — degradar por omisión convertiría a un llamador antiguo en un
aviso silenciado.

### La segunda mitad: sobre cuánto expediente se comprobó

`listarNotasCompat` devuelve `truncada`, y REG-405 lo llevó hasta las
proyecciones y hasta el cartel de la pantalla. A la barra tampoco llegaba.

Y ahí el silencio no es neutro: una barra que no dice nada de interacciones se
lee como «no hay interacciones», cuando puede querer decir «no miré el expediente
entero». Ahora lo dice, una vez, y sólo si había algo que comprobar.

Nivel `contexto` y no `revisa`, porque en un paciente con historial largo sale
siempre y un aviso que sale siempre en nivel `revisa` enseña a saltarse el nivel
`revisa` — que es donde viven la alergia y la interacción. Pero **no se pliega**:
un aviso escondido que dice «esto se comprobó a medias» es un aviso que nadie lee
justo cuando importa.

Y no afirma un hallazgo que no tiene: dice sobre qué se miró, no «puede haber
interacciones ocultas» ni «revise el expediente completo».

### Un guardián que contaba bien y un nombre que mentía

`el-paciente-completo-llega-al-motor` cuenta cuántos MOTORES reciben el cuadro
entero buscando el nombre del campo pegado a `medsDelCuadro`. El campo nuevo
llevaba un `.length` con ese mismo nombre y le sumaba un motor inexistente. Se
renombró el campo, no el guardián: contaba bien.

### Qué NO cubre

- No cambia ninguna compuerta: `interaccion` sigue siendo `revisa`.
- No toca alergias, controlados ni dosis peligrosas, que siguen mirando la receta
  de hoy. Para alergias y dosis eso es correcto —se juzga lo que se prescribe—;
  para controlados es discutible, y queda dicho en vez de cambiarse de paso.
- `introducidaHoy` no mide gravedad: una interacción vieja puede matar igual. Lo
  que cambia es cuánto tiene que gritar, no si se dice.
- No prueba el render.

**Prueba.** `src/__tests__/la-barra-mira-al-paciente-no-a-la-receta.test.ts` (17 casos).

## REG-411 — un aviso efímero sobre una pérdida permanente es no avisar

**QUÉ SE PEDÍA.** `WS-11.sobrevive-a-la-navegacion`: «Nada pendiente desaparece
al cambiar de pantalla». El censo decía «sin prueba que cruce la frontera de
navegación o de sesión», y al mirarlo no faltaba sólo la prueba.

### El defecto

REG-344 encontró que al firmar la nota los pendientes se creaban con
`void crearTareas(...).catch(() => {})`, y lo escribió así:

> Si la pestaña se cerraba o la red se caía en esa ventana, los pendientes de esa
> consulta desaparecían y el médico se iba convencido de que estaban.

Lo arregló **en ese sitio**. Y `crearTareas` tenía **cuatro** llamadores en
pantallas: la firma de la nota, las dos reconciliaciones de medicación y la
emisión de la orden. Los otros tres siguieron con el `catch` vacío — y uno de
ellos con el comentario `/* igual que arriba */`, que es exactamente lo que no
era: arriba había un aviso y ahí no había nada.

Misma forma que REG-410: una reparación que llega a un consumidor y no a los
demás. Con el agravante de que aquí el comentario **afirmaba** la paridad.

### Y donde sí había aviso, tampoco bastaba

Era un `toast`. Dura unos segundos y muere al cambiar de pantalla — y ese aviso
sale justo después de firmar, que es cuando el médico se va al siguiente
paciente. El resultado final es el que REG-344 describe como el defecto, sólo que
con un aviso que nadie llegó a leer.

### La causa raíz

Que la decisión viviera en el llamador. Con cuatro sitios decidiendo por su
cuenta qué hacer con el resultado, la próxima pantalla que abra pendientes
volverá a elegir mal — y nadie lo notará, porque no falla nada.

Y debajo, una segunda: **`crearTareas` devolvía un número**. Con eso el llamador
puede avisar de que faltan, pero no puede hacer nada más, porque no sabe cuáles.
Un pendiente que nadie puede nombrar es un pendiente que nadie puede reintentar,
así que la única defensa posible era el aviso.

### La regla

1. `crearTareas` dice **cuáles** no entraron, no sólo cuántas.
2. Un solo sitio —`abrirPendientes`— decide qué pasa cuando faltan.
3. Lo que no entró se guarda donde **sobreviva a la navegación y a la sesión**.
4. Se vuelve a ofrecer en Pendientes, **cuando el médico lo pide**.

### Lo que sigue igual, y es deliberado

Abrir pendientes **sigue sin bloquear la firma**. Hacer que un fallo del worklist
reviente la firma sería cambiar un pendiente perdido por una consulta perdida,
que es lo que REG-344 dejó escrito y sigue siendo cierto.

Y **no se reintenta solo**: volver a escribir en el expediente de un paciente por
decisión de la máquina es lo que REG-390 reserva — una operación clínica no puede
aparecer como completada si sólo quedó encolada. Aquí no se completa nada: se
conserva lo perdido y se le enseña a alguien.

### Dos guardianes anclados al texto

`un-pendiente-que-falta-no-se-calla` comprobaba la comparación literal
`if (creadas < pendientesDeLaNota.length)`. Esa comparación **era el problema**:
existía en un llamador de los cuatro, y el guardián no se puso rojo ni una vez en
toda su vida. Ahora comprueba lo que quería comprobar.

`v15-cerrados-recientes-conectado` buscaba el final de un efecto por la cadena
exacta de su lista de dependencias. Añadirle una dependencia legítima lo dejaba
en `-1` y el caso se caía sin que nada de lo que vigila hubiera cambiado. Un
guardián anclado al texto de una lista de dependencias vigila la lista, no la
propiedad.

### Qué NO cubre

- No sobrevive a otro equipo ni a otro navegador: es almacenamiento local. Si el
  médico firma en el consultorio y abre Pendientes en el teléfono, ahí no están.
  Guardarlo en Firestore sería escribir en el expediente justo cuando se acaba de
  demostrar que no se puede escribir.
- No sobrevive a borrar los datos del sitio ni al cierre de sesión — que limpia el
  almacenamiento local a propósito, porque esto lleva PHI.
- No cubre los dos llamadores de servidor (`hospital`, `laboratorio`), que ya leen
  el conteo desde REG-252 y no tienen pantalla donde ofrecer nada.
- No prueba el render.

**Prueba.** `src/__tests__/un-pendiente-perdido-no-muere-con-el-aviso.test.ts` (23 casos).

## REG-412 — «Negadas» como alérgeno, y un botón que la escribía otra vez cada vez

**CÓMO SE DESCUBRIÓ.** El dueño, usando el producto (captura del 30-ago-2026).
No lo cazó ninguna prueba: la proyección de alergias longitudinales se probó con
alérgenos de verdad —«Penicilina»—, que es lo que uno escribe cuando escribe el
caso feliz.

### El defecto, tal como se vio en pantalla

```
Alergias: Negadas, Negadas, Negadas, Nega…

⚠ El expediente registra alergia a Negadas — hoy el campo la NIEGA, y la lista
  de hoy no la tiene. La alerta al prescribir NO la está mirando.
  Negadas · moderada · nota firmada del 2026-05-27 · hoy el campo la niega
  [ Añadir a la lista ]
```

Cada pulsación del botón añadía otra «Negadas» al campo de alergias del
paciente, y el aviso volvía a ofrecerlo. Un bucle sin fondo, escribiendo basura
en el dato más letal de la aplicación.

### La causa raíz, que son dos

**1. Lo que se filtra al escribir no se filtraba al leer.** `estadoDeAlergias`
(REG-410) leía `nota.alergias` **crudo**. El sello de hoy lo escribe
`alergiasDe(patient)`, que sí sabe que «Negadas» es una negación y no un
alérgeno — pero el sello es histórico e **inmutable**, y las notas anteriores a
las correcciones de negación (la de «alergias negadas», 4-ago-2026, y las de
`SEPARADORES`) llevan dentro `{ alergeno: 'Negadas' }`.

Arreglar la escritura no arregla lo ya escrito. **Una copia inmutable guarda
también los defectos del día que se selló**, y una proyección que recorre el
expediente entero los vuelve a sacar a la luz — con severidad, con fecha de nota
firmada y con un botón, o sea con toda la apariencia de un hallazgo.

**2. Dos criterios sobre el mismo campo, y el bucle entre ellos.** El botón
concatenaba en el `onClick` (`` `${antes}, ${alergeno}` ``), mientras quien
decidía si volver a ofrecerlo era `alergiasDe`. Como `alergiasDe` filtra
«Negadas», la lista de hoy nunca llegaba a «contener» el término, `enLaListaDeHoy`
seguía en falso y el aviso no se apagaba nunca. Es el defecto que ADR-001
describe —dos lecturas del mismo campo— con un botón encima.

### El arreglo

`selloEsNegacion` en `alergias-longitudinales.ts` descarta al leer los sellos que
son la negación entera, reutilizando `esAlergiaNegada` —la única definición de
qué es una negación en este repositorio— en vez de inventar un criterio nuevo
por módulo.

`listaConAlergeno` saca la concatenación del `onClick` a una función pura que no
puede repetir un término, comparando por término normalizado y no por subcadena
(«sulfas» no está dentro de «sulfasalazina» a estos efectos). Devuelve el texto
igual cuando no hay nada que añadir, y el llamador entonces no escribe: una
escritura que no cambia nada ensucia la bitácora y hace creer que pasó algo.

Descartar un fragmento negado **no toca la asimetría** de REG-410 —afirmar suma,
el silencio no resta, la negación de hoy pone en conflicto—: una negación nunca
fue una alergia afirmada. Lo que se quita es ruido que se pintaba en rojo al
lado de las alergias de verdad, que es justo lo que hace que un aviso rojo deje
de leerse.

### Qué NO cubre

- No limpia las notas ya firmadas. Son inmutables y deben serlo; lo que cambia
  es cómo se leen.
- No limpia el campo de un paciente que ya quedó con «Negadas, Negadas» escrito.
  Eso es un dato del expediente y lo edita el médico: el producto no reescribe
  el campo de alergias por su cuenta.
- No amplía el vocabulario de negaciones. Un término negado que `esAlergiaNegada`
  no conozca sigue sin conocerse aquí.
- No toca la compuerta que bloquea Firmar, que sigue leyendo `patient` y debe
  seguir.

**Prueba.** `src/__tests__/una-negacion-sellada-no-es-un-alergeno.test.ts`
(8 casos declarados, 18 con las expansiones de `it.each`), probada al revés por
sus dos mitades: quitando el filtro caen 14
casos, quitando el dedup caen 2.

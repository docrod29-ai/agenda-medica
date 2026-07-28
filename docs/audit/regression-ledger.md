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
| REG-013 | Clínico | Peso pediátrico: confusión kg/lb producía dosis peligrosa | CLOSED | `src/__tests__/peso-pediatrico-seguridad.test.ts` (hard-stop, sin heurística) |
| REG-014 | Seguridad-legal | Firma médica (`firmaImagenDataUrl` en `config/main`) **leíble** por cualquier miembro vía SDK → robo para estampar recetas | **OPEN** | (pendiente) separar a subdoc con `read: if isMedico` |
| REG-015 | Dinero | `cobros` create no fuerza `creadoPor==uid` ni valida `monto≥0` → cobro atribuible a otro / retroactivo | **OPEN** | (pendiente) regla create como `farmacia_movimientos` |
| REG-016 | Integridad | `clinic_review_requests` update sin `hasOnly` → al marcar `used` se pueden mutar otros campos | CLOSED | `firestore.rules` update ahora `diff().affectedKeys().hasOnly(['used','usedAt'])` |
| REG-017 | Integridad | Una nota puede nacer `estado:'firmada'` (salta flujo borrador→firmada) | **OPEN** | (pendiente) forzar `estado=='borrador'` en create |
| REG-018 | Clínico | Amikacina: dosis/toma no acotada por `topeMgKgDia` → receta 50% arriba del tope seguro en 1 toma/día | CLOSED | `src/__tests__/clinical-safety-harness.test.ts` (bloque Aminoglucósidos + invariante universal porToma≤porDía) |
| REG-019 | Auth | WhatsApp disconnect/connect y CFDI eran any-member (podía desconectar mensajería a pacientes / timbrar) | CLOSED | Endpoints ahora `verificarMedico` (paridad con plantillas-config/voz-config) |
| REG-020 | Clínico (P0) | Corrector fonético INVERTÍA hiper↔hipo: "hipertensión"→"hipotensión", "hiperglucemia"→"hipoglucemia" (significado OPUESTO en la nota) | CLOSED | `medical-vocabulary.ts` guardián `invierteHiperHipo` + `src/__tests__/ngramas-antonimos.test.ts` |
| REG-021 | Seguridad (P1) | `/api/receta/diseno-url` acuñaba URL firmada de CUALQUIER `receta-diseno/<uid>` sin verificar dueño → robo de firma/membrete ajeno | CLOSED (parcial) | Gate misma-clínica en el minteo; residual: proxy sin firma hasta `RECETA_DISENO_FIRMA=obligatoria` (paso del Dr) |
| REG-022 | Clínico (P1) | `clasificarTFG(NaN/∞/negativo)` caía a 'G5 Falla renal' → fabricaba falla renal terminal de un dato inválido | CLOSED | `funcion-renal.ts` guard de finitud → 'TFG no disponible' |
| REG-023 | Clínico (P0) | 'no tiene/presenta/refiere X' se leía como X POSITIVO (el afirmador 'tiene' dentro del negador 'no tiene' cancelaba la negación) → dx/alergias negados marcados presentes | CLOSED | `parser-clinico.ts` estaNegado ignora afirmador precedido de no/nunca/sin + `src/__tests__/negacion-parser.test.ts` |

| REG-024 | Dinero (P0) | `payment/create-checkout` tomaba `currency` del body → 'cop' cobraba ~USD0.12 y la cita quedaba 'pagada' | CLOSED | Moneda fija 'mxn' en el servidor |
| REG-025 | Seguridad-legal (P0) | `receta/verificacion-url` firmaba certificado con cédula/folio crudos del body → forja de credencial | CLOSED (parcial) | Exige `verificarMedico`; residual: ligar a la nota autoritativa |
| REG-026 | Clínico (P0) | `copiloto` usaba `ckdEpi2021` crudo → creatinina µmol/L → falla renal fantasma + contraindicaciones falsas | CLOSED | `creatininaPlausibleMgDl` en 3 sitios + test |
| REG-027 | Clínico (P0) | `gasometria`: albúmina g/L restaba ~90 al anion gap corregido; PaCO2/HCO3 negativos calculaban | CLOSED | Guard de rango albúmina [1–6] g/dL + PaCO2/HCO3 + test |

| REG-028 | Seguridad (P1) | `config/imagen` aceptaba `image/svg+xml` → SVG con <script> servido same-origin = XSS almacenado | CLOSED | Allowlist solo PNG/JPG/WEBP |
| REG-029 | Integridad (P1) | `hospital/mutar` y `registro-durable` escribían `por: p.por` del cliente → autor NOM-004 falsificable | CLOSED | Autor sellado por el servidor (`actor.nombre`) + test |
| REG-030 | Seguridad (P1) | `transcribir-diarizado` GET sin dueño → en modo prueba otra clínica leía el dictado (PHI) por UUID | CLOSED | `transcript_owners` registra dueño en POST y GET lo verifica |

| REG-031 | Clínico (P1) | Motores UCI sin guardas: num '1,200'→1.2 (glucosa=hipo falsa), NEWS2 NaN→rojo falso, ckrt/infusiones peso 0→Infinity, tendencia con delta redondeado (troponina +200%='estable') | CLOSED | `num.ts`/`news2.ts`/`ckrt.ts`/`infusiones.ts`/`tendencias.ts` + `src/__tests__/uci-guards-auditoria.test.ts` |

| REG-032 | Consentimiento (P1) | El modal de grabación afirmaba "el audio no se guarda" pero se sube a transcripción + IndexedDB → consentimiento materialmente falso | CLOSED | Texto veraz en el modal de consulta |
| REG-033 | Integridad (P1) | `configuracion` ignoraba el `error` de useConfig → formulario en blanco sin aviso y Guardar sobreescribía cédula/horario reales | CLOSED | Monta `AvisoConfigNoCargada` + bloquea Guardar si la config no cargó |

| REG-034 | Clínico (P1) | `extraerAlergias` ignoraba la negación: "niega alergia a penicilina" documentaba la alergia → alerta de reacción cruzada que BLOQUEABA la firma NOM-004 | CLOSED | `parser-clinico.ts` extraerAlergias usa estaNegado + tests |

> Mantener este archivo actualizado en cada ciclo del loop de auditoría. Cada `OPEN` debe
> pasar a `CLOSED` con su test/control antes de cerrar el lote correspondiente.

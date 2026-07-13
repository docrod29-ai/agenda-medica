# Roadmap: Confianza, Comercial, Legal, Seguridad y Producto

> Origen: revisión externa (crítica comercial/legal/regulatoria) + petición del Dr. de
> "mejorar todo esto y no parar hasta terminar". Este documento es la fuente de verdad
> del loop. Cada lote se construye, se verifica (tsc + build + tests) y se despliega
> con bump de service worker, sin tocar el flujo clínico grabar→transcribir→nota→imprimir.

Fecha de inicio: 2026-07-13.

---

## Principio rector de honestidad

Este producto vende un expediente clínico. **No se publica ninguna afirmación que no sea
verificablemente cierta.** En particular:

- Cifras de desempeño (no-shows, horas ahorradas, % de datos capturados): solo con
  estudio citado o medición interna real. Si no hay medición, se escribe "estimado" o
  se retira. (El propio Dr. lo pidió: "no publicar ninguna cifra hasta validarla.")
- Cumplimiento normativo: se dice "alineado con los requisitos aplicables de NOM-004",
  no "certificado". SIRES/NOM-024 solo cuando exista evidencia formal.
- Seguridad: solo se declara lo que está realmente implementado. Lo aspiracional se
  marca como "en proceso" o no se publica.

---

## Lo que SOLO el Dr. puede aportar (bloqueadores externos, no inventar)

Estos no se pueden generar por código sin causar un daño legal/comercial:

1. **Identidad legal**: razón social o nombre, RFC, domicilio fiscal, responsable de
   privacidad (nombre + correo de contacto ARCO). → alimenta aviso de privacidad,
   contrato de encargo, página de seguridad, CFDI.
2. **Dominio definitivo** nexusmed.mx (comprar + apuntar a Vercel). → deja de usarse
   la URL de Vercel como dirección principal.
3. **Decisiones de precio/plan** (respuestas públicas): ¿el bot completo entra en
   Agenda? ¿SMS incluido o solo WhatsApp? ¿quién absorbe el costo de conversación de
   Meta? ¿precios con IVA incluido? ¿cuántos pacientes/almacenamiento? ¿qué pasa al
   agotar créditos y cuánto cuesta recargar? ¿Google Calendar bidireccional?
   ¿exportación incluida? ¿permanencia mínima?
4. **Cifras reales** para prueba social: nº de médicos activos, citas procesadas,
   recordatorios enviados, reducción media de ausencias, tiempo medio ahorrado,
   testimonios con nombre + especialidad (con consentimiento).
5. **Terceros / certificación**: pen-test externo anual (vendor), ruta SIRES NOM-024,
   revisión del aviso por abogado antes de publicar.
6. **Región de almacenamiento**: confirmar región GCP/Firebase real (p. ej. us-central
   o multi-región) para declararla con honestidad.

Todo lo demás se construye por código. Para los items que dependen de (1)–(3) se crean
**generadores/plantillas con campos claramente marcados** para que el Dr. los llene.

---

## Prioridad y secuencia de lotes

### LOTE 1 — Comercial de choque (lo que hace dudar a un médico antes de pagar)
- [ ] Reescritura de copy de landing (honestidad):
  - "2ª opinión automática" → **"Revisión de consistencia y seguridad clínica"**.
  - Quitar nombres de modelo ("Opus 4.8 + GPT-5") del marketing.
  - "40% menos no-shows" → "los recordatorios pueden reducir hasta 40% las
    inasistencias, según estudios publicados; los resultados varían".
  - "3 horas ahorradas" → "estimadas" o retirar hasta medir.
  - Quitar **NOM-045** del texto general. Mantener NOM-004 (redacción "alineado con
    requisitos aplicables") y NOM-024 solo cuando aplique.
- [ ] **Sección de precios con FAQ/comparativa** que responda las 11 preguntas
  (IVA, SMS vs WhatsApp, créditos→notas, recargas, permanencia, exportación, etc.).
  Campos que dependen de decisión del Dr. quedan marcados como TODO visibles solo en
  el doc, con el texto público en el valor que el Dr. confirme.
- [ ] **"Ver demo" funcional**: enlazar a una ruta de demo real (video 90s + tour).

### LOTE 2 — Demostración del producto (problema comercial nº1)
- [ ] Ruta `/demo` navegable **sin registro**: tour guiado read-only con datos ficticios
  (calendario, expediente de paciente demo, nota por voz, receta, conversación del bot,
  panel de secretaria, portal del paciente, tablero financiero).
- [ ] Video de 90s (Remotion, ya hay base en ~/Desktop/nexus-marketing/reels-remotion)
  embebido en landing.
- [ ] Capturas reales de cada módulo en la landing.

### LOTE 3 — Página pública de Seguridad y confianza (`/seguridad`)
- [ ] Declara SOLO lo real: cifrado en tránsito (y en reposo si se confirma), roles
  granulares, App Check, rate limiting, bitácora de accesos, respaldos (PITR +
  programados), aislamiento por consultorio (reglas Firestore), política de
  vulnerabilidades, procedimiento de incidentes, **qué recibe la IA y que NO se usa
  para entrenamiento**. Lo pendiente (MFA, pen-test) se marca "en proceso".
- [ ] Lista pública de subencargados: nube (GCP/Firebase), IA (Anthropic/OpenAI),
  WhatsApp (Meta), pagos (Stripe), correo. Con enlace a sus políticas.

### LOTE 4 — Legal como función del producto
- [ ] **Generador de aviso de privacidad por consultorio** (razón social, domicilio,
  datos sensibles, finalidades, ARCO, subencargados, conservación/bloqueo/eliminación,
  procedimiento de brechas). Plantilla + formulario en configuración.
- [ ] Aviso de privacidad propio de la plataforma (para médicos y usuarios).
- [ ] Plantilla de **contrato de encargo de tratamiento** (encargado).
- [ ] **Exportación completa del expediente** al cancelar (PDF + CSV + formato
  interoperable). Todo marcado "revisar con abogado antes de publicar".

### LOTE 5 — IA clínica defendible (interfaz, no solo términos)
- [ ] Renombrar la función en toda la UI.
- [ ] En la nota/consultor mostrar SIEMPRE: fuentes citadas, fecha de búsqueda, nivel
  de certeza, separación dato-dicho vs inferencia, alertas de interacción/dosis,
  **confirmación médica obligatoria antes de firmar**, y **registro de qué generó la
  IA vs qué corrigió el médico** (trazabilidad).
- [ ] Diferenciales diagnósticos se proponen, NO se insertan solos en la nota.

### LOTE 6 — Expediente al mejor del mercado
- [ ] CIE-10 codificado en diagnósticos. Firma electrónica + **bloqueo de nota** tras
  firmar. Corrección por **adenda** (sin borrar original). Historial de versiones.
- [ ] Línea de tiempo clínica longitudinal. Alergias/medicamentos persistentes con
  **alertas** de alergia/duplicidad/interacción. Plantillas por especialidad.
  Consentimientos informados. Receta con QR/validación. Comparación entre consultas.

### LOTE 7 — Operación económica completa
- [ ] Links de pago, anticipos para confirmar cita, CFDI (facturación automática tras
  pago), estado de cuenta, cuentas por cobrar, cortes de caja, reembolsos, paquetes/
  membresías, honorarios por médico, reportes de ingresos, agendadas vs atendidas vs
  cobradas.

### LOTE 8 — Migración asistida (barrera de cambio)
- [ ] Importación Excel, Google Contacts, carga masiva de PDF, importación de otros
  sistemas, dedup (ya existe), validación previa, reporte de migración, exportación
  libre. Oferta comercial: "nosotros migramos sus pacientes".

### LOTE 9 — Experiencia móvil sobresaliente
- [ ] PWA instalable (existe), biometría, foto clínica directa al expediente, escaneo
  de documentos, dictado móvil, firmar/enviar receta, push, guardado automático,
  recuperación de borradores (existe), modo conexión inestable.

### LOTE 10 — Dos productos
- [ ] Empaquetar **NexusMED Individual** vs **NexusMED Clínica** (sucursales, permisos
  granulares, caja, inventarios, comisiones, métricas por médico, protocolos,
  auditoría, API, integraciones lab/imagen).

### LOTE 11 — Crecimiento y retención
- [ ] Micrositio por médico (existe /dr/[id]), reserva pública, botón Google Business,
  solicitud automática de reseñas (existe), encuestas de satisfacción, referidos,
  recordatorios de seguimiento, campañas de reactivación, seguimiento posconsulta,
  métricas de adquisición/retención.

### LOTE 12 — Prueba social y soporte
- [ ] Métricas reales (dependen del Dr.), testimonios, garantía de devolución, SLA de
  soporte con horario, centro de ayuda (existe guía), videos de capacitación,
  onboarding personalizado (tour ya desplegado v347).

---

## Reestructura de planes (propuesta, requiere confirmación de precios)

- **Agenda — $349**: aclarar recordatorios incluidos, costo de conversaciones extra,
  IVA, almacenamiento, usuarios, exportación, cancelación.
- **Clínica — $899** (producto principal): agenda + expediente completo + recetas +
  facturación + pagos + WhatsApp + **200 notas con IA** (unidad comprensible, no "160
  créditos") + consultor de evidencia + portal del paciente.
- **Pro — $1,899**: IA avanzada + revisión de seguridad clínica + facturación avanzada
  + analítica + API + automatizaciones + soporte prioritario + migración incluida +
  auditoría ampliada + mayor almacenamiento.

---

## Estado

Ver historial de commits (SW vNNN) y la marca de cada `[ ]` → `[x]` al cerrar cada item.

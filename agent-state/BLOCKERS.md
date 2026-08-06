# Bloqueadores — sólo lo que exige una decisión o credencial del dueño

Cada uno dice **exactamente** qué se necesita. Nada de esto detiene el resto del
trabajo.

| # | Bloqueador | Qué se necesita | Impacto mientras tanto |
|---|---|---|---|
| B-01 | Medir el **reconocedor** sobre los 6 000 audios del corpus V3 | Autorización para gastar en la API de transcripción (hay caché: se paga una sola vez). Los audios ya están en disco | Hoy sólo está medido el pipeline sobre texto, no lo que el motor OYE en ese corpus |
| B-02 | Corpus de **consulta ambulatoria con diálogo** (médico + paciente + acompañante) | Decisión: grabaciones reales desidentificadas **con consentimiento**, o autorizar audio actuado/sintético con guion | Sin él no se mide diarización, atribución de rol ni solapamiento |
| B-03 | `TIPO_CAMBIO_USD_MXN` en Vercel | La variable | La contabilidad no convierte el costo de IA a pesos y lo declara como supuesto |
| B-04 | `OPS_ALERTA_WEBHOOK` | Un buzón real (Slack, correo, lo que use) | Las alertas de operación no llegan a un humano |
| B-05 | Simulacro de restauración `gcloud firestore databases restore` | Sus consolas y un cronómetro | La mitad del simulacro está medida (ida y vuelta del respaldo); falta la restauración real |
| B-06 | Las ~39 recomendaciones de inmuno sin fuente | Que el médico las cite o las retire | Se muestran declarando que no tienen fuente |
| B-07 | Validación de los 23 motores en `pendiente_validacion` | Revisión clínica del dueño | Marcados como no validados en el registro |
| B-08 | Clasificación de seguridad por fármaco (P7/P8) | Decisión clínica | El esquema existe y está vacío |
| B-09 | Pentest externo y PITR | Contratación y consolas | Declarado en el registro de riesgos |
| B-10 | Cuenta de prueba en los secretos de CI | Credencial | El E2E sólo cubre lo público |
| B-11 | El CI de GitHub Actions **no arranca** en los PR abiertos por el agente | Un push tuyo a la rama, o un «Re-run» desde la pestaña Actions | El *required check* `clinical-safety` no existe (no falla: no corre) y el PR queda `blocked`. Las compuertas se corren en local y se declaran en el PR |

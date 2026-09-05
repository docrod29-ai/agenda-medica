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
| B-11 | Medir **diarización y atribución de rol** sobre el corpus actuado | La llave de **AssemblyAI** en esta máquina. `vercel env pull` la devuelve como `[SENSITIVE]`: Vercel redacta los valores sensibles, así que no hay forma de obtenerla sin que el Dr. la ponga en el entorno local. **El corpus y el medidor ya están hechos y probados**: en cuanto haya llave, es un comando | El corpus actuado (12 diálogos, 72 turnos, 5m12s, con el milisegundo de cada turno) está generado y sin medir |
| ~~B-12~~ | ~~**Abrir el producto en un navegador** desde este entorno~~ **YA NO ES BLOQUEO (5-sep-2026)**: el emulador de Firebase (auth + firestore) arranca en este contenedor, así que `arnes:emuladores → arnes:sembrar → arnes:dev` con Chromium es viable. Lo que sigue faltando es WebKit (403 de la política de red). El renglón original se conserva abajo porque era cierto cuando se escribió |
| B-12 (histórico) | **Abrir el producto en un navegador** desde este entorno | Las variables `NEXT_PUBLIC_FIREBASE_*` de un proyecto de PRUEBA en el contenedor. Hoy `npm run build` compila y luego muere con `auth/invalid-api-key` al recolectar `/dr/[clinicId]` | Frena **dos** unidades, no una: `NAV-NAVEGADOR-001` (seis comprobaciones que sólo un navegador resuelve, dos pueden ser P0) y la validación visual de `PATIENT-AI-001`. Y frena los 39 hallazgos abiertos del backlog V10, uno de ellos P0. La regla de diseño prohíbe aprobar una interfaz leyendo el código, así que sin esto el trabajo visual se puede escribir pero no se puede afirmar |

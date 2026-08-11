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
| B-12 | **Dos identidades visuales decididas por separado y en conflicto directo**: `claude/nexus-master-loop-v14` (Cantera+Instrumento, jamaica/alabastro, OD-2 resuelta por el dueño 10-ago) vs. `main` (cian-petróleo, v1171/PR #290, sin mención de la rama V14). Choque en `globals.css`, `layout.tsx`, `Sidebar.tsx`, `ThemeToggle.tsx` (borrado en una línea, vivo en la otra), y la marca (Ausculta existe sólo en `main`) | Decisión del dueño: cuál paleta/acento es el vigente, o autorizar fusionar paleta de una línea + nombre de la otra (detalle y recomendación en `V14_OWNER_DECISIONS_REQUIRED.md` OD-5) | Ninguna corrida V14 debería fusionar ni recolorear a ciegas — todo el backlog visual de V14 depende de resolver esto primero |

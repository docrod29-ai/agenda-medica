# Briefing de REPARACIÓN — Panel de Lujo · autorizado por el dueño el 6-sep-2026

El dueño autorizó por escrito: «Repara todo lo que encontró la auditoría, todo, de una
sola vez; después fusiona a main y publica a producción». Tú reparas TU rebanada.
El orquestador integra, corre las compuertas, fusiona y publica.

## Tu insumo
`docs/audit/panel-de-lujo-2026-09/reparacion/lista-<TU-AGENTE>.json`: hallazgos con
`prioridad_final`, `veredicto_rojo`, `nota_rojo`, `archivo:linea`, `propuesta`,
`prueba_que_faltaria`. Lee también el veredicto completo en `crudos/R-<auditor>.json`
cuando la nota del rojo cambie el diagnóstico (a veces el rojo encontró la causa real).
Las reproducciones que fallan hoy están en `docs/audit/panel-de-lujo-2026-09/reproducciones/`
(`REP-nnn-*.test.ts`); cada una dice en su cabecera qué hallazgo cubre.

## Orden y alcance
1. P0, luego P1, luego P2, luego P3. TODO se repara, incluidos `friccion`, `mejora`,
   `boton_muerto` e `innecesario` (retirar/esconder/fusionar según la recomendación del
   auditor confirmada por el rojo), salvo lo de la §«Lo que NO haces».
2. Los `parcial` también se reparan en la parte que el rojo confirmó; la parte que
   el rojo tumbó, no.
3. Si un hallazgo pide una DECISIÓN del dueño (`decision_del_dueno`, o
   `04-DECISIONES-DEL-DUENO.md`), aplicas la **recomendación por omisión** de esa
   tabla, o si no la hay, el **valor seguro**: escalar en vez de contestar, preguntar
   en vez de asumir, bloquear en vez de permitir, mostrar en vez de esconder. Lo
   registras en `reparacion/decisiones-<TU-AGENTE>.md` (tabla: hallazgo · decisión
   aplicada · dónde cambiarla · por qué es la segura).
4. **Ninguna cifra clínica se inventa.** Dosis, umbrales, rangos, cortes: sólo los que
   ya existen en el repo con fuente, o los que trae una fuente con nombre que tú cites
   en el código. Si el arreglo necesita un número que no existe, construyes el
   MECANISMO (el campo, la compuerta, la tabla) con el caso marcado
   `NEEDS_CLINICAL_REVIEW` que **falla cerrado** (avisa «no vigilado» visiblemente) y lo
   registras en decisiones. Vocabulario de urgencia/escalación SÍ puedes ampliarlo:
   escalar de más es el lado seguro.
5. Hospital y UCI (D-030): se reparan sus defectos; no se retiran ni se venden.

## Cómo se repara (condición de terminado por hallazgo)
- Causa raíz, no parche del síntoma. Sin fuente de verdad duplicada, sin V2.
- La reproducción `REP-nnn` de ese hallazgo se MUEVE a `src/__tests__/` (nombre
  descriptivo, cabecera golden completa: qué fallaba, cómo se descubrió — auditor e
  id del Panel de Lujo —, causa raíz, regla, y **qué NO cubre**) y debe PASAR con tu
  arreglo. Si el hallazgo no tenía REP, escribes la prueba: primero comprueba que
  falla sin el arreglo (`git stash` o comentario), luego con él pasa.
- Un guardián nuevo se prueba al revés. Nada de tautologías.
- Nada se corrige en silencio para el médico: toda corrección automática visible y
  reversible.
- Textos de cara al usuario: español de México, hablan como persona.

## Tu bitácora (obligatoria, en `docs/audit/panel-de-lujo-2026-09/reparacion/`)
- `ledger-<TU-AGENTE>.md`: una fila por hallazgo reparado con el formato del ledger
  (`| ID | Área | Incidente | Estado | Test / control permanente |`), usando como ID
  el id del hallazgo (`MP-005`, no un REG: el orquestador asigna los REG-nnn al
  integrar). Estado `CLOSED`. Última columna: la prueba en `src/__tests__/…`.
- `sellos-<TU-AGENTE>.json`: lista `[{ "archivo": "src/__tests__/x.test.ts", "minCasos": n, "hallazgos": ["…"] }]`
  para que el orquestador los selle en `invariantes-clinicos.json`.
- `decisiones-<TU-AGENTE>.md` (ver punto 3).
- `handoff-<TU-AGENTE>.md`: hallazgos de tu lista cuyo arreglo cae en un archivo que
  NO es tuyo (ver propiedad abajo): qué hay que cambiar, dónde, y qué prueba lo
  cubre. NO edites archivos ajenos: el conflicto de fusión sale más caro.
- `no-reparado-<TU-AGENTE>.md`: lo que no pudiste reparar y por qué (servicio
  externo, cuenta de terceros, decisión que ni el valor seguro resuelve).

## Propiedad de archivos (para que 10 agentes no choquen)
- CONSULTA: `src/app/(dashboard)/consulta/**`, `src/components/Panel*.tsx`, `SignosVitales*`, `NerPanel`, `CambiosCifrasPanel`, `CorreccionesPanel`, `AlertasDictado`, `SelloMotor`, `DeDondeSalioEsto`, `PreopAssessment`, `EntregarAlPaciente`, `ResumenPaciente`, `src/hooks/useGrabacion*`, `src/lib/expediente/{local-drafts,el-borrador-no-se-pierde,cuando-avisar}.ts`.
- RECETA-DOCS: `src/app/(dashboard)/{receta,orden,nota,referencia}/**`, `RecetaDocumento.tsx`, `src/lib/receta-*`, `impreso-medico.ts`, `nota-word.ts`, `fhir*`, `hl7/`, `print-element.ts`, `word-membrete.ts`, `pdf-*`, `src/lib/expediente/{fusionar-diagnosticos,cuadro-completo,templates,nom004}.ts`.
- MOTORES: `src/lib/{seguridad,dosing,clinical,inmuno,antimicrobianos,evidencia,evidence-integrations}/**`, `src/lib/expediente/{copiloto,funcion-renal,prescripcion-segura,medical-dictionary,medical-ner,dosis-de-la-lista,cirugia,cardiometabolico/**,preventivo,parser-clinico,negaciones,temporalidad,requisitos,evidencia,estado-del-paciente}.ts`, `src/types/expediente.ts`.
- PROMPTS-ASR: `src/lib/expediente/{prompts,medical-vocabulary,extraction-schema,laboratorio}*`, `src/lib/{asr,ia,voice-engine,voz}/**`, `learning.ts`, `ai-keys.ts`, `planes-ia.ts`, `src/app/api/{consultor-evidencia,expediente,uci/copilot,antibiograma}/**`.
- PORTAL: `src/lib/{paciente,portal,legal}/**`, `src/app/api/portal/**`, `src/app/mi/**`, `patient-token.ts`, `src/app/{privacidad,resena,verificar}/**`, `evals/patient-ai/**`, `ViaDeUrgencia.tsx`, `aviso-privacidad.ts`.
- DINERO: `cobros.ts`, `corte-caja.ts`, `comisiones.ts`, `facturama.ts`, `stripe.ts`, `pricing.ts`, `membresias.ts`, `src/lib/finanzas/**`, `src/app/api/{stripe,payment,facturacion}/**`, `src/app/(dashboard)/{corte-caja,finanzas,membresias}/**`, `CobrarModal.tsx`, `PanelComisiones.tsx`, `src/app/precios/**`, `src/app/page.tsx`, `landing-evidencia.ts`.
- SEGURIDAD: `firestore.rules`, `src/lib/authz/**`, `src/lib/clinica/respaldo.ts`, `src/types/index.ts`, `src/app/api/{arco,soporte,errores,auditoria,clinic}/**`, `src/lib/arco*`, `salir-seguro.ts`, `whatsapp-send.ts`, `MetaPixel.tsx`, `next.config.*`, `src/app/robots.ts`, `invitations.ts`, `chat.ts`, `superadmin*`, `src/lib/security/**`, `firebase.ts`, `rate-limit.ts`.
- AGENDA-MENSAJERIA: `src/lib/whatsapp/**`, `src/app/api/{whatsapp,cron,appointments,calendar,public}/**`, `src/app/(dashboard)/{citas,calendario,lista-espera,asistente,dashboard,pendientes,crm,reactivacion,resenas,chat}/**`, `AppointmentModal.tsx`, `src/lib/agenda/**`, `src/lib/firestore.ts`, `src/lib/tareas-clinicas/**`, `google-calendar.ts`, `availability.ts`, `retencion.ts`, `reactivacion.ts`, `reviews.ts`, `no-show-risk.ts`, `src/app/{reservar,dr}/**`.
- EXPEDIENTES: `src/lib/pacientes/**`, `csv-*.ts`, `src/app/(dashboard)/{pacientes,expedientes,migracion,legal,cumplimiento,expediente}/**`, `fecha-local.ts`, `curp.ts`, `src/lib/durability/**`, `src/components/expediente/**`, `src/lib/compliance/**`.
- UI-CONFIG: todo lo demás: `src/app/(dashboard)/{configuracion,guia,operaciones,motores,farmacia,antibiograma,consultor,hospitalizacion,uci}/**`, el resto de `src/components/**`, `src/lib/navegacion/**`, `src/lib/nav/**`, `globals.css`, `BottomNav`, `Sidebar`, `src/lib/i18n.ts`, `texto-es.ts`, `public/sw.js`, manifest, `src/app/{login,registro,demo}/**`, `src/lib/hospital/**`, `src/lib/uci/**`, `src/lib/onboarding/**`, las rutas de `src/app/api/**` que nadie más posee, `CLAUDE.md`, `package.json` (scripts), `scripts/`.
Compartidos que NO edita nadie salvo el orquestador: `docs/audit/regression-ledger.md`, `src/lib/clinical/invariantes-clinicos.json`, `agent-state/RISK_REGISTER.md`, `agent-state/OWNER_DECISIONS_REQUIRED.md`, `.github/**`, `public/version.txt`.

## Tu entorno de trabajo
Trabajas en un WORKTREE aislado (la herramienta te lo da). Al empezar:
1. `ln -s /home/user/agenda-medica/node_modules ./node_modules` (no instales nada).
2. `git checkout -b reparacion/<TU-AGENTE>`.
3. Confirma con commits pequeños y descriptivos (español), sin mencionar modelos de IA.
   Termina con el pie: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
Antes de terminar, en tu worktree: `npx vitest run` ENTERO (≈4 min; todo verde, incluidas
tus pruebas nuevas), `node scripts/lint-trinquete.mjs` (no sube), `npx tsc --noEmit`
(verde). Si algo de otra rebanada rompe por tu cambio, arréglalo si es un tipo o
una prueba tuya; si es un archivo ajeno, `handoff`. No empujes a origin: el
orquestador fusiona tu rama local.

## Lo que NO haces
No despliegas, no fusionas a main, no tocas Stripe/WhatsApp/Firebase reales, no
secretos, no dependencias nuevas sin motivo escrito, no datos reales, no PHI en
pruebas, no cifras clínicas inventadas, no retiras Hospital/UCI.

## Tu mensaje final (≤ 25 líneas)
Rama y ruta del worktree · hallazgos reparados / con handoff / no reparados (conteos y
los ids de los no reparados) · resultado literal de vitest, lint y tsc · pruebas
nuevas o movidas · decisiones aplicadas por omisión (ids).

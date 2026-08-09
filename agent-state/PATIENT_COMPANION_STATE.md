# Estado del compañero del paciente — V9

**Abierto**: 2026-08-08 · **Unidades**: `PATIENT-COMPANION-001`, `POSTVISIT-001`,
`PATIENT-AI-001`, `DOCUMENTS-001`, `CLOSED-LOOP-PATIENT-001`,
`PATIENT-LANGUAGE-001`
**Regla que lo gobierna**: `.claude/rules/patient-facing-ai.md`

---

## Dónde estamos

**`PATIENT-UX-TRUTH-001` en curso.** El baseline —qué existe hoy de cara al
paciente— se está estableciendo con evidencia. Nada se construye hasta saber qué
hay, porque lo que hay no es cero:

| Superficie que ya existe | Ruta | Qué falta comprobar |
|---|---|---|
| Portal del paciente | `src/app/mi/[token]/page.tsx` (576 líneas) | Qué fases del plan de junio llegaron de verdad |
| API del portal | `src/app/api/portal/route.ts` | Alcance real, caducidad, revocación del token |
| Enlace mágico HMAC | `src/lib/patient-token.ts` | Propiedades de seguridad reales |
| Reserva pública | `src/app/reservar/[clinicId]` | — |
| Reseñas · verificación | `src/app/resena/[token]` · `verificar/[token]` | — |
| Derechos ARCO | `src/app/api/arco/*` | Es acceso del titular: es patient-facing |
| Teleconsulta | `src/app/teleconsulta/[citaId]` | — |
| Recordatorios | `src/app/api/cron/reminders` · WhatsApp | — |

**Plan previo**: `docs/PORTAL_PACIENTE.md` (14-jun-2026), cuatro fases. No se da
por hecha ninguna sin verla en el código.

## El objetivo, en una frase

Que el paciente pueda decir: *entiendo qué pasó, sé qué hacer, sé dónde están mis
documentos, puedo preguntar, sé cuándo tiene que contestar mi médico, y no me
pierdo.*

## Las cinco destinaciones

`HOY` · `PREGUNTA A NEXUS` · `CUIDADO` · `DOCUMENTOS` · `PERFIL`

Móvil primero. Cuatro o cinco destinos, ni seis.

## Lo que NO se va a construir

**Un chatbot médico genérico.** ASK NEXUS es *inteligencia acotada al plan de
cuidado*: contesta desde lo que el médico aprobó, o escala. La instrucción §13
del dueño lo dice por lo negativo —«no empieces construyendo un chatbot»— y la
regla `.claude/rules/patient-facing-ai.md` lo dice por lo positivo.

## Lo más peligroso de todo el programa

La primera vez que este producto le habla al paciente en lugar de al médico, el
lector **deja de poder detectar el error**. Las doce preguntas del equipo rojo
(§0 de V9) no son ejemplos: son la puerta, y viven como fixture permanente en
`evals/patient-ai/`.

## Decisiones que serán del dueño

Se acumulan en `agent-state/OWNER_DECISIONS_REQUIRED.md`. Previsibles:

- Qué documentos puede descargar el paciente y con qué caducidad.
- Si un cuidador autorizado puede ver todo o sólo una parte.
- Qué vía de contacto real se enseña en `URGENT_REVIEW_REQUIRED` (hoy no hay una
  declarada, y un aviso urgente sin destino no es un aviso).
- El plazo de retención del audio, ya abierto desde el 8-ago.

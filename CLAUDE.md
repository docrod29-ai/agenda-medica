@AGENTS.md

# NexusMED — carta operativa

Plataforma clínica del **Dr. David Alonso Rodríguez Luna** (internista e
infectólogo). Next.js 16 · React 19 · TypeScript · Firestore · Vercel · PWA.

## Misión

Que el médico salga de la consulta **con la nota hecha y sin haber dejado de
mirar al paciente** — y que lo escrito sea correcto, rastreable y revisable.

No se compite por número de funciones. Se compite por utilidad clínica, tiempo
ahorrado, seguridad del paciente y trazabilidad.

## Dos productos, una plataforma

- **Practice** (prioridad comercial): médico independiente y consultorio.
- **Hospital / UCI**: detrás de banderas, **no a la venta** hasta autorización
  explícita del dueño. Su incompletitud no bloquea a Practice salvo defecto del
  núcleo compartido.

## Invariantes de arquitectura

```
UN PACIENTE · UNA IDENTIDAD · UN EXPEDIENTE LONGITUDINAL
UN MODELO DE ENCUENTRO · DE MEDICAMENTO · DE ORDEN · DE RESULTADO · DE TAREA
UNA LÍNEA DE TIEMPO · UNA BITÁCORA DE AUDITORÍA
MUCHAS VISTAS SEGÚN EL CONTEXTO
```

Nunca duplicar la fuente de verdad de una entidad clínica (`medicationInNote` vs
`medicationInPharmacy`…). La misma entidad se **pinta** distinto según dónde se
mire.

## Comandos

```bash
npx vitest run                  # 6413 casos, 435 archivos
node scripts/lint-trinquete.mjs # techo de deuda: 98 errores, sólo puede bajar
npm run build                   # TS + Next; atrapa lo que vitest no ve
npm run mantenimiento           # chequeo de 8 puntos, sólo lectura
npm run simulacro:respaldo      # ida y vuelta del respaldo, con acta
```

## Mapa del repositorio

| Ruta | Qué vive ahí |
|---|---|
| `src/app/(dashboard)/` | Pantallas de trabajo: consulta, agenda, UCI, hospitalización, configuración |
| `src/app/api/` | 96 rutas; toda escritura clínica pasa por autorización de servidor |
| `src/lib/asr/` | Voz: léxico, corrector vigilado, guardián, normalización, siglas, aprendizaje |
| `src/lib/expediente/` | Nota, procedencia, negaciones, temporalidad, extracción |
| `src/lib/seguridad/` | Dosis, alergias, interacciones |
| `src/lib/clinical/` | Registro de motores, compuerta de seguridad, invariantes sellados |
| `src/__tests__/` | 425 archivos; los golden explican **por qué**, no sólo qué |
| `docs/audit/regression-ledger.md` | 142 regresiones con su causa raíz y su prueba |
| `docs/maintenance/` | Bitácoras de sesión y changelog del service worker |
| `agent-state/` | Estado persistente del trabajo autónomo |

## Master Loop V10 — obligatorio para trabajo visual/UX

Todo trabajo V10 **lee COMPLETO**
`docs/ai/NEXUSMED_VISUAL_EXCELLENCE_AND_CLINICAL_INTERACTION_MASTER_LOOP_V10.md`
antes de tocar nada. Rama persistente: `claude/nexus-visual-excellence-v10`.
Estado: `agent-state/V10_*`. La ley de diseño detallada vive en `docs/design/`.

## V9 — antes de tocar nada del programa V9

**Fuente de verdad única**:
[`docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md`](docs/ai/NEXUSMED_PATIENT_EXPERIENCE_AND_DESIGN_MASTER_LOOP_V9.md)
— la especificación del dueño, **íntegra**.

Toda ejecución de V9 la lee **COMPLETA** antes de decidir qué trabajo hacer. No
se resume, no se sustituye por un plan más corto, no se decide desde el
checkpoint sin haberla leído. Si algo de este repositorio la contradice, **gana
la especificación**.

Después: `agent-state/LAST_SAFE_CHECKPOINT.md` para saber por dónde se sigue, y
`agent-state/V9_COMPLETE_CRITERIA.md` para saber cuándo se para. La lectura
operativa y la bitácora de unidades cerradas viven en
[`docs/ai/V9-BITACORA-Y-OPERACION.md`](docs/ai/V9-BITACORA-Y-OPERACION.md).

## Reglas detalladas

`.claude/rules/` — leerlas antes de tocar su dominio:

- `clinical-safety.md` · `voice-asr.md` · `security-tenant.md`
- `testing-gates.md` · `deployment-and-flags.md` · `data-privacy.md`

## Seguridad clínica (resumen — el detalle en su regla)

1. **Nunca inventar una cifra clínica, dosis ni umbral.** Si falta, se marca
   `NEEDS_CLINICAL_REVIEW` y se sigue con otra cosa.
2. Los motores clínicos son **deterministas**. El modelo de lenguaje redacta y
   extrae; **no calcula escalas ni decide dosis**.
3. Nada se corrige en silencio. Toda corrección automática es visible y
   reversible por el médico.
4. Ausencia de dato **no es** dato de ausencia.
5. Ante la duda, **se pregunta al médico**; no se adivina.

## Pruebas — condición de terminado

Un cambio está terminado cuando:

- `npx vitest run` pasa entero;
- el trinquete de lint no sube;
- `npm run build` compila;
- hay una prueba que **falla sin el arreglo** (probada al revés cuando es un guardián);
- el golden explica el fallo, la causa raíz y **qué NO cubre**;
- si es una regresión, tiene entrada en `docs/audit/regression-ledger.md` y su
  sello en `src/lib/clinical/invariantes-clinicos.json`.

## Prohibido sin autorización explícita del dueño

Desplegar a producción · fusionar a `main` · borrar datos de producción · rotar
credenciales · comprar servicios · aceptar términos legales · fijar política
clínica final · usar datos identificables de pacientes · mandar mensajes reales ·
emitir una receta real · timbrar un CFDI real · tocar suscripciones vivas de
Stripe.

## Decisiones ya tomadas por el dueño

- Prueba de **14 días, sin tarjeta, con la IA limitada** (v972). Nunca bloquear
  la app entera por falta de tarjeta.
- La nota usa el razonamiento premium («no escatimar»); no bajar de modelo por
  velocidad sin avisar.
- Auditar y reparar con **panel de especialistas en paralelo**; los agentes
  auditan, el orquestador verifica y escribe.
- Hospital y UCI en ALPHA: se usan, **no se venden**.

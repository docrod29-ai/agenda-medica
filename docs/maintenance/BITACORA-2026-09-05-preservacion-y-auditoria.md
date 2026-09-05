# Bitácora — 5-sep-2026 · Preservation, Audit & Intelligence Transformation, primer tramo

**Qué se pidió:** el pliego del dueño «AUSCULTA — MASTER PRESERVATION, AUDIT &
INTELLIGENCE TRANSFORMATION PROGRAM». Entender la Ausculta actual, medirla,
preservar lo que funciona, corregir lo roto, conectar lo incompleto. Sin
reescribir nada.

**Qué NO se hizo, a propósito:** no se desplegó, no se fusionó a `main`, no se
abrió PR (no se pidió), no se tocó ninguna política clínica, no se cambió texto
que ve el paciente, no se borró ninguna función.

---

## Estado del que se partió

| | |
|---|---|
| `main` | `e78e1242` — v1181, botón de producción pinado (PR #453) |
| PRs abiertos | uno, #442, cuyos dos números de regresión ya gastó `main` |
| Escritor | esta sesión. El bucle de Actions apunta a un PR cerrado y se planta solo |
| Baseline medido | vitest **12 598 pasan · 1 falla (entorno) · 1 skip** · tsc limpio · lint **94** = techo |

## Cómo se auditó

Seis frentes read-only en paralelo, con la consigna de **refutar cada hallazgo
antes de reportarlo**. El orquestador no aceptó ninguno sin leerlo en el código
y, para los cuatro que se cerraron, sin **reproducirlo** primero.

| Frente | Resultado |
|---|---|
| Equipo rojo de API (99 rutas) | cross-tenant en escritura clínica **refutado en las 99**; sobrevivió uno: la sala de video sin revocación |
| Voz | tabla parámetro × motor × camino: dos celdas vacías; una clínicamente grave (alérgenos → Whisper) |
| Medicación | receta: sin terapia duplicada, red pediátrica apagada en silencio, creatinina que no llega a la receta, hash que se pierde al truncar `meta`. Que las alertas no bloqueen es **política**, no se toca |
| Test-the-test | 215 guardianes de texto puro; el del paciente equivocado se satisfacía con un comentario |
| Seguridad | la escalación del paciente podía no llegarle a nadie; `safeLog` no redacta lo que promete; check-then-write en `reclamarCanal` |
| Experiencia del paciente | el bucle de «Preguntar» estaba roto en la mitad del consultorio |

## Qué cambió en esta rama — cuatro slices, cuatro commits

| REG | Qué | Al revés |
|---|---|---|
| **512** | `telesalud/sala` no comprobaba `portalTokenVersion`: un enlace revocado abría la sala de video 7 días | 200 con URL → 401/503 |
| **513** | Los alérgenos del expediente no llegaban a Whisper por ningún camino; ahora UNA lista para los cuatro puntos de envío | la lista vieja sobre un `FormData` real pierde `alergias` |
| **514** | La pregunta escalada del paciente no le llegaba a nadie sin teléfono configurado; ahora abre una tarea `pregunta_paciente` en `/pendientes` | sin el arreglo: 4 rojos, 4 verdes |
| **515** | El guardián del paciente equivocado se satisfacía con un comentario; ahora exige la llamada y su resultado, con autotest contra los mutantes | los mutantes ponen rojo el detector |

Cada uno con su golden (qué fallaba, cómo se descubrió, causa raíz, regla, **qué
NO cubre**), su entrada en el ledger, su familia de defecto, su sello, y las
compuertas medidas en el mensaje del commit.

## Compuertas al cerrar

| | |
|---|---|
| `npx vitest run` | **12 634 pasan · 1 falla** (`ops-timeout-y-punto-ciego`, entorno) · 937 archivos |
| `npx tsc --noEmit` | limpio |
| `node scripts/lint-trinquete.mjs` | **94**, igual que el techo |
| `npm run build` | 163/163 páginas, con los placeholders del CI |
| Sello | 461 archivos · 6 483 casos |
| Ledger | 309 REG · última **REG-515** |

## Lo que se supo y no estaba escrito

- **B-12 no era bloqueo.** El emulador de Firebase arranca en este contenedor.
  Queda corregido en `agent-state/BLOCKERS.md`.
- **El commit «huérfano» de las alergias en el teléfono ya estaba en `main`**
  (REG-437). El consolidado del 2-sep estaba atrasado ahí.
- **PR #442 necesita renumerar** (REG-444 y REG-506 ya son de `main`) y traer
  52 commits. Es trabajo válido sin absorber, no se tocó desde esta rama.

## Lo que queda, con nombre

`docs/product/AUSCULTA-ULTRA-READINESS.md` §3 y §11, y el checkpoint en
`agent-state/AUSCULTA_LAST_SAFE_CHECKPOINT.md`. Lo primero: la segunda mitad de
REG-514 —cerrar la tarea marca `atendidaEn`— que exige una ruta de servidor.

Tres decisiones nuevas para el dueño (D-A, D-B, D-C en el readiness §9): si una
alergia crítica debe **bloquear** imprimir; si la pregunta del paciente puede
viajar **literal** por WhatsApp; si la cancelación ARCO debe **revocar** el
portal.

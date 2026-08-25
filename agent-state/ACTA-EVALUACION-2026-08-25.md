# Acta de evaluación — 25-ago-2026

**Qué es**: una calificación del estado del programa, medida sobre el árbol
exacto de `main` (`76ba314`), no leída de los tableros. Todo número de aquí sale
de un comando que se corrió hoy; lo que no se pudo medir se declara.

**Quién la escribe**: sesión de evaluación, rama
`claude/evaluacion-progreso-lu9ve9`. **No implementa nada.** Read-only salvo
esta acta.

---

## 0. Cómo se midió

```bash
npx vitest run                  # suite entera
node scripts/lint-trinquete.mjs # trinquete
npm run build                   # tsc + Next
git log --since=... -- src/     # dónde fue el trabajo
git ls-remote --heads origin    # ramas vivas
```

Contenedor limpio: `node_modules/` venía vacío, se instaló con `npm ci`. Sin
llaves de Firebase ni de proveedores.

---

## 1. Las compuertas

| Compuerta | Resultado | Lectura |
|---|---|---|
| `vitest` | **9 694 casos · 703 archivos verdes · 1 fallo · 1 saltado** | El fallo es `ops-timeout-y-punto-ciego` («el error dice cuánto esperó y a quién»): el `10.255.255.1` no agota tiempo en este contenedor, rechaza. Es el `UNVERIFIABLE` ambiental que V15 ya tenía declarado. **No es una regresión** |
| `lint-trinquete` | **96 errores = techo. Sin deuda nueva** | Verde |
| `tsc` | **verde** | Compila entero antes de recolectar páginas |
| `next build` | **rojo por entorno** | `auth/invalid-api-key` al recolectar `/dr/[clinicId]`: faltan las llaves de Firebase en este contenedor. **No es defecto de código** |

**Las compuertas están en verde.** Lo que sigue no las contradice: las da por
buenas y pregunta otra cosa.

## 2. La escala real del árbol

| | Medido hoy | `CLAUDE.md` dice | `METRICS_BASELINE.json` dice |
|---|---:|---:|---:|
| Casos de prueba | **9 694** | 6 413 | 6 413 |
| Archivos de prueba | **705** | 435 | 425 |
| Rutas de API | **98** | 96 | 96 |
| REG en el ledger | **170+** (hasta REG-322) | 142 | 142 |
| Techo de lint | **96** | 98 | 98 |
| Módulos en `lib/` | **463** | — | 401 |
| Componentes | **108** | — | 79 |

Además: 176 164 líneas de producto, 97 631 de pruebas, 45 pantallas de
dashboard, 223 documentos.

**Los tres tableros están desactualizados a la vez.** `MASTER_STATE.json`
lista como «trabajo local sin subir» archivos que ya están commiteados, y su
propio texto lo predijo el 15 de agosto: *«mientras no lo derive un script, va
a volver a pasar»*. Volvió a pasar.

---

## 3. Calificación

> **La ingeniería: 9/10. La convergencia: 3/10.**

No es una nota partida por diplomacia. Son dos preguntas distintas y la
primera está tapando a la segunda.

### 3.1 Lo que está genuinamente bien (y es poco común)

- Casi **10 000 casos que de verdad pueden fallar**, con la regla de probar
  todo guardián al revés.
- Un ledger de **170 regresiones con causa raíz**, no con síntoma.
- El trinquete que **sólo baja**, sostenido.
- La taxonomía de `docs/quality/FAMILIAS-DE-DEFECTO.md`. Es la pieza más
  valiosa del repositorio: **«Escrito, probado y sin conectar = 39 casos»** es
  autoconocimiento que casi ningún equipo tiene por escrito.
- Actas donde **quien implementa no es quien juzga** (V15, iteraciones 16-19).
- Reglas nacidas de daño real, no de estilo: «el dato tiene que LLEGAR» salió
  de tres defectos del mismo tipo el mismo día, los tres con las pruebas en
  verde.

### 3.2 Lo que está mal

**H-1 · Diez días sin tocar el producto.**
Desde el 16-ago en `main`: **38 commits, cero tocan `src/`.**

```
git log --since=2026-08-16 --oneline | wc -l          → 38
git log --since=2026-08-16 --oneline -- src/ | wc -l  → 0
```

Todo es fontanería: juez Codex, recuperación de veredictos, correlación por
SHA, autopilot n8n. **Trece commits sólo en `product-codex-judge.yml`.** Se
está construyendo la fábrica en vez del coche, y la fábrica lleva una semana
arreglándose a sí misma.

**H-2 · ~13 500 líneas de producto varadas en PRs draft.**

| Rama | Commits sobre `main` | Diff |
|---|---:|---|
| `product/consultorio-core-001` (#306) | 120 | 63 archivos · +6 445 / −411 |
| `product/voice-engine-001` (#302) | 68 | 31 archivos · +3 631 / −216 |
| `product/clinical-reasoning-evidence-safety-001` (#303) | 64 | 26 archivos · +2 685 / −216 |
| `product/documentation-clinical-truth-001` (#301) | 28 | 12 archivos · +696 / −215 |

Trabajo hecho que no le llegó a nadie es trabajo no hecho.

**H-3 · 190 ramas vivas y ~49 PRs abiertos.**
El propio programa lo declaró como bloqueador **T-1** el 7-ago con 33 ramas, y
volvió a medirlo con 92 (PR #283) y con 107 (PR #286). **Hoy son 190.** El
aviso funcionó tres veces y no cambió nada las tres veces. Un aviso que nadie
acciona no es un control.

**H-4 · T-1 ya se cobró su primera víctima, y es medicolegal.**
En `main`, `REG-306` es «el medidor del teléfono decía 0 con la pantalla
rota». En el PR #284, abierto desde el 9-ago, `REG-306` es «SAFE-003 — sin
referencia de dosis ya no se calla en pediatría». Lo mismo con REG-309 y
REG-310.

**El mismo número de regresión significa dos cosas distintas según la rama.**
Eso es exactamente lo que REG-191 había reparado para IEC 62304, y está
deshecho. Severidad: alta, porque el número de REG es lo que acota un lote de
notas clínicas.

**H-5 · Un hueco de seguridad concreto, abierto 16 días.**
Los PRs **#280, #281 y #285** —tres versiones del mismo arreglo— ponen límite
de tasa a las rutas del portal del paciente. En `main`:

```bash
grep -rn "rate|Rate|throttle|cuota|limite" src/app/api/portal/   → sin resultados
```

`src/app/api/portal/route.ts` y `src/app/api/portal/link/route.ts` **no tienen
ninguno**. Una ruta de paciente sin cuota, con el enlace viajando por WhatsApp
—que es justo el escenario que la regla `patient-facing-ai.md` §8 declara
agravado.

**H-6 · El registro de riesgos envejeció.**
`R-05` (severidad 5, alérgeno mal transcrito → el cruce alergia↔fármaco nunca
salta) sigue diciendo **«En reparación (v1031, local)»** desde el 4-ago. Hoy
producción va en v1171. O se reparó y nadie cerró la entrada, o lleva tres
semanas abierto con severidad 5. **Las dos posibilidades son un defecto del
registro**, y un registro que no se puede creer no protege.

---

## 4. El diagnóstico, en una frase

**El producto no está estancado por falta de capacidad técnica; está estancado
por falta de fusión.**

Todas las compuertas están en verde y aun así el médico no ha recibido nada
nuevo en diez días, porque el trabajo se acumula en ramas y la energía se fue a
construir el juez automático que decidiría cuándo fusionarlas.

Y hay un riesgo de segundo orden que conviene nombrar mientras se puede: V15
cerró 19 iteraciones con `PASS` y `V15_COMPLETE = NO`, esperando la Auditoría
Final de Verdad. El sistema de actas es excelente **y** se ha vuelto capaz de
generar procedimiento indefinidamente sin liberar nada. Las once entradas de
`BLOCKERS.md` son todas del dueño —una llave de AssemblyAI, un webhook, una
decisión clínica—: el trabajo autónomo llegó al techo de lo que puede hacer
solo y, en vez de parar y decirlo, empezó a optimizarse a sí mismo.

---

## 5. Lo que haría antes de escribir una línea más

| # | Acción | Por qué ahora |
|---|---|---|
| 1 | **Congelar `infra:`.** Ningún commit de fontanería hasta que el producto vuelva a moverse | H-1 |
| 2 | **Fusionar o cerrar los ~49 PRs esta semana**, empezando por el límite de tasa del portal, y **renumerando los REG al fusionar** | H-3, H-4, H-5 |
| 3 | **Aterrizar `consultorio-core-001`** | 6 445 líneas paradas es el activo más caro del repositorio |
| 4 | **Derivar los tableros de un script**, no de la memoria del agente | H-6 y §2; ya está diagnosticado dos veces por escrito |
| 5 | **Contestar los 11 bloqueadores del dueño en una sentada** | Son media hora suya y desbloquean semanas de medición |

---

## 6. Qué NO cubre esta acta

- **No se abrió un navegador.** Nada de lo visual está verificado aquí; el
  juicio de §1 es de compuertas, no de pantallas.
- **No se midió el reconocedor** (B-01, B-11: sin llaves).
- **No se auditó el contenido clínico** de los motores; se auditó el proceso.
- **No se leyeron los ~49 PRs uno por uno**: se midió su tamaño y su fecha, no
  se juzgó su corrección.
- **No se tocó producción** ni se fusionó nada.

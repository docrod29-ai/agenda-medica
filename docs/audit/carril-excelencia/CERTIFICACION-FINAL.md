# Certificación final — carril de excelencia de producto

**SHA exacto:** `e531077a49c59ca57f64b008cf01e8c19094fe53`
**Rama:** `product/ausculta-product-excellence`
**Base:** `origin/main` (`bcf6063`) · 14 commits por delante
**Fecha:** 2026-08-30

---

## 1 · Compuertas

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **777 de 777 archivos · 10 696 de 10 696 casos** |
| `node scripts/lint-trinquete.mjs` | 95 errores = techo. Sin deuda nueva |
| `node scripts/design/trinquete-de-diseno.mjs` | Sin deuda nueva |
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Compila |

La suite incluye `ops-timeout-y-punto-ciego`, que durante casi todo el carril
falló por el entorno —necesita una IP que trague paquetes y el proxy de esta
caja contesta— y que en la corrida final pasa. **No se tocó**: su rojo era del
entorno, no de la rama, y se verificó contra `main` antes de empezar.

### Trinquete de diseño — lo que este carril bajó

| Contador | Al empezar | Ahora |
|---|---:|---:|
| `hexEnLinea` | 485 | **357** |
| `halosDeColor` | 7 | **6** |
| resto | — | sin cambio, sin deuda nueva |

---

## 2 · CROSS_LANE_CONFLICT = **0**

Verificado con `git merge-tree` contra `origin/product/ausculta-master-completion`:

| | Conflictos |
|---|---:|
| `main` vs. el otro carril (preexistentes) | 8 |
| **esta rama** vs. el otro carril | **8** |
| **añadidos por esta rama** | **0** |

Y la rama **fusiona limpio contra `main`**.

Los 8 preexistentes están en `regression-ledger.md`, `FAMILIAS-DE-DEFECTO.md`,
`familias-de-defecto.ts`, `MASTER_STATE.json`, `INDICE.md`,
`SCREEN_INVENTORY.md`, `ClinicalSpine.tsx` y un test del spine — exactamente
los archivos que este carril **decidió no tocar**, y por eso su bitácora vive
aparte en `lane-product-excellence.md`.

**`SCREEN_INVENTORY.md` sí se regeneró** (lleva conteo de líneas por pantalla).
Filas tocadas por este carril: `/asistente`, `/calendario`, `/chat`, `/citas`,
`/finanzas`, `/mi/[token]`, `/reservar`, `/login`, `/registro`. Filas del otro
carril: `/consulta`, `/consultor`, `/cumplimiento/*`, `/pacientes`,
`/pendientes`. **Disjuntas** — por eso no añade conflicto.

---

## 3 · Prueba en navegador

Chromium real. Dos entornos, y lo que cada uno certifica:

### Contra el build de PRODUCCIÓN (`next start`, puerto 3300)

| Qué | Resultado |
|---|---|
| Portada con y sin `prefers-reduced-motion`, 390/768/1440 | 7 de 7 bloques revelados · **0 ocultos** · latido 2,4 s / 1e-05 s · sin desborde · sin errores de consola |
| axe-core WCAG 2.0/2.1/2.2 A+AA — portada, reserva, login, registro × 3 anchos | **0 violaciones** |
| Techo de agenda | `2051-01-01` → 400 «La agenda llega hasta el 2050-12-31.» · `2027-02-30` → 400 «Esa fecha no existe en el calendario.» |

Esto **cierra** el riesgo residual que la unidad 14 había declarado (la portada
sólo se había medido en desarrollo).

*Lo que este entorno NO certifica:* el servidor de producción de esta caja no
tiene el SDK de administración apuntando al emulador, así que devuelve
«Clínica no encontrada» y listas de huecos vacías. Los rechazos de fecha sí son
concluyentes —ocurren antes de tocar la base—, los recorridos con datos no.

### Contra emuladores (`next dev`, puerto 3200)

| Recorrido | Resultado |
|---|---|
| Reserva del paciente, 8 pasos, 390/768/1440 | «¡Cita solicitada! ✅» · **dato verificado en Firestore** |
| Reserva **sólo con teclado**, 390/1440 | 6 pasos completados · anillo de foco visible en todos · 2 citas en Firestore |
| Alta de la asistente, 8 pasos, 390/768/1440 | 3 citas `confirmada`/`Manual` en Firestore |
| Fallo, reintento, envío duplicado, resultado desconocido | 3 envíos → **1 cita**, mismo `citaId` · otro paciente sigue recibiendo 409 |
| Fecha: domingo, festivo, comida, ventana, techo, imposible | rechazadas, **cada una con su motivo propio** |
| Fallo de red en login y registro, 390/768/1440 | alerta correcta y botón listo para reintentar en los 6 |
| Objetivos táctiles a 390 px | 12 → **2** (los dos restantes, enlaces legales del pie) |
| axe con sesión — `/citas`, `/asistente`, `/pacientes` × 3 anchos | 0 violaciones |

Fechas del recorrido certificadas: **2027-03-15 · 2030-06-20 · 2040-02-29 ·
2050-01-01 · 2050-12-31**, y rechazo de **2051-01-01**, 2099-12-31, 9999-12-31.
Bisiestos sin tabla: 2040-02-29 pasa, 2039-02-29 no.

---

## 4 · Lo que queda declarado y NO resuelto

- **Dos enlaces del pie** a 40 y 42 px (`Operación`, `Soporte`). Separarlos
  cambia la maqueta del pie: decisión de diseño, no arreglo.
- **Saltar de año** en el portal del asistente. El techo ya es verdadero, pero
  llegar a 2050 son 292 clics de flecha. Añadir el salto es función nueva.
- **WhatsApp** (`api/whatsapp/webhook`) maneja fechas para el flujo
  conversacional y **no se tocó**. Merece su propia unidad.
- **El alta desde el panel** (`/api/appointments`) no es idempotente. Ahí hay
  sesión y una asistente que ve la agenda, así que el reenvío ciego no es el
  mismo problema — pero está dicho.
- **El nombre del médico vive en dos documentos** (el de la clínica y
  `config/main`) y pueden decir cosas distintas; en el consultorio sembrado, de
  hecho, las dicen.
- **El honorífico**: quien escribió sólo su nombre ya no ve título. Es una
  decisión de este carril, reversible en una línea de `@/lib/nombre-medico`.
- **La consulta y el dictado por voz** (prioridad 5) **no se recorrieron**: el
  entorno no tiene proveedor de ASR. Sin él no hay recorrido que probar.
- **Ningún lector de pantalla real**: se comprueba el árbol accesible y el foco,
  no lo que se oye.
- Las 16 entradas de este carril **no están en el ledger canónico**, a propósito.
  Su número de REG se asigna al fusionar.

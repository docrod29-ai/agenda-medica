# Patrones de interacción — V10 (TRUTH-001, salida 7)

> **Unidad**: V10 · `V10-TRUTH-001` · 9-ago-2026.
> **Método**: lectura estática del flujo dorado Practice (login → dashboard →
> citas → pacientes → expediente → consulta → nota) sobre
> `src/app/(dashboard)/`, `src/components/`, `src/context/` y `src/hooks/`.
> **La aplicación no se ejecutó**: todo lo de aquí es lo que el código dice
> hacer, no lo que se observó en pantalla (esa verificación es V10 §33). Ley
> aplicable: V10 §11-§13, §38.

## Heredado y validado (no rehacer)

- **Mapa de navegación y pérdida de estado**: `NAVIGATION_STATE_AUDIT.md` (V9)
  + reparaciones REG-276…279 (rama V9, sin fusionar). Los tres P0 de audio de
  esa auditoría siguen siendo la deuda más cara; aquí no se repiten.
- **Procedencia tocable**: pulsar una frase de la nota y oír el segundo exacto
  del dictado (REG-213/250) — firma de interacción existente que V10
  **estabiliza, no reinventa** (`.claude/rules/design-system.md`).

## §1 — Navegación: cuatro mecanismos conviven

| Mecanismo | Dónde (medido) |
|---|---|
| `<Link>` | dashboard (6), pacientes (3), login (1) |
| `router.push` | expediente (12), pacientes (6), consulta (5), citas (3) |
| `useSmartBack` (`src/hooks/useSmartBack.ts:13`: `history.state.idx > 0` → `back()`, si no → fallback) | 12 archivos: nota, expediente, receta, orden, referencia, hospitalización ×4, UCI ×2 |
| `MobileBackButton` global (mismo criterio `idx > 0`) | `(dashboard)/layout.tsx:670` |

**Inconsistencias, con archivo:línea:**

1. **El mismo destino por dos vías en el mismo archivo.**
   `dashboard/page.tsx:338` navega a `/consulta/{id}` con
   `<button onClick={router.push(...)}>`; `dashboard/page.tsx:372` navega al
   mismo destino con `<Link><button/></Link>`. Y entre pantallas:
   `citas/page.tsx:311` va a `/asistente` por `router.push`, mientras
   `pacientes/page.tsx:184` va al mismo `/asistente` por `<Link><Button/></Link>`.
   El `router.push` pierde abrir-en-pestaña y estado de enlace; el
   `<Link><button>` anida interactivo dentro de interactivo (P2 de
   accesibilidad, verificable con axe en §33 — la corrida del 9-ago tarde ya
   midió `nested-interactive` serious ×3 en /pacientes con la lista poblada).
2. **La consulta no usa `useSmartBack`.** Su «volver» es fijo:
   `consulta/[patientId]/page.tsx:282` calcula `volverA` (hospitalización o
   expediente) y `:3776` lo empuja siempre, ignore de dónde vino el médico. La
   parte contextual (episodio hospitalario) es deliberada y correcta; ignorar
   el historial no — es el patrón que V10 §38 quiere como contrato.
3. **Móvil cumple la regla de 4-5 destinos**: `BottomNav.tsx:25-51` = Inicio,
   Agenda, Pacientes, acción contextual central (Consulta/Nueva cita,
   `BottomNav.tsx:35-38`) y CRM o Chat según el modo. Cinco, con
   `aria-label` (`BottomNav.tsx:63`). Aquí ya está bien.

## §2 — Modales y superficies

- **Un solo primitivo de diálogo**, `ui/Modal` (14 importadores), con trampa de
  foco, Escape, foco devuelto y cierre-en-mousedown-sólo-si-empezó-en-el-fondo
  (`ui/Modal.tsx:40-76,82-94`). No hay bottom sheets (0 resultados).
- **Deep link a modal**: `/citas?id=...` abre la cita directamente
  (`citas/page.tsx:102-123`); el dashboard enlaza así (`dashboard/page.tsx:309`).
- **Inconsistencia crear/editar**: crear cita navega a la página `/asistente`
  (`citas/page.tsx:311`); editar la misma entidad abre `AppointmentModal`
  (`citas/page.tsx:445`). Dos superficies para el mismo objeto — puede ser
  deliberado (crear registra paciente), pero nadie lo ha escrito como decisión.
- **`role="dialog"` fuera del primitivo**: `BotonAyuda.tsx`,
  `OnboardingTour.tsx`, `(dashboard)/layout.tsx`, `ToastContext.tsx`. No se
  verificó si estos cuatro atrapan el foco como `Modal` lo hace; queda para §33.

## §3 — Teclado

- **⌘K existe** — el esqueleto anterior de este documento decía que no, y hay
  que corregirlo con matiz: `PaletteBusqueda.tsx:40-52` abre con ⌘K/Ctrl+K
  (montado en `layout.tsx:703`), busca pacientes y ofrece 6 acciones de
  **navegación** (`PaletteBusqueda.tsx:11-17`); todo termina en `router.push`
  (`:87`). Lo que NO existe es el comando universal de V10 §13 que ejecuta
  acciones — y que, cuando exista, nunca ejecutará acciones clínicas en silencio.
- **La consulta tiene 3 atajos** (`consulta/[patientId]/page.tsx:3603-3630`):
  Cmd/Ctrl+Shift+G graba/detiene (con el porqué de no usar R escrito en el
  código: colisiona con hard-refresh), Cmd/Ctrl+Shift+D procesa con IA, y
  Cmd/Ctrl+Shift+Enter firma **pasando por `confirm()`** porque «firmar es
  irreversible: nunca por un atajo suelto». Respetan campos de texto (`:3598`).
- **Ninguna otra pantalla del flujo tiene atajos**: 0 `keydown` en dashboard,
  citas, pacientes, expediente, nota (medido). Las convenciones por flujo de
  V10 §8.24 siguen pendientes.

## §4 — Guardado y estado (el patrón más fuerte del producto)

La consulta guarda en **tres capas** y restaura en orden:

1. **Memoria entre navegaciones**: `BorradorContext` montado en el layout
   (`src/context/BorradorContext.tsx`) — volver a la consulta la encuentra
   «exactamente como la dejaste», sin parpadeo.
2. **localStorage ofuscado** con rebote, por paciente y episodio
   (`consulta/[patientId]/page.tsx:2672-2701`, llave `:285`), bloqueado tras
   cerrar sesión («no resucitar PHI», `:2679`).
3. **Firestore cada 30 s, en silencio** (`:2664`, silencioso `:2476`),
   serializado para que dos autoguardados no se pisen (`:2488`).

Restauración: memoria primero, localStorage después **con aviso** («Recuperé tu
nota sin guardar ✓», `:2836`). `beforeunload` existe **sólo mientras se graba**
(`useGrabacionAudio.ts:1152`) — decisión documentada, no olvido. Este patrón
NO existe fuera de la consulta; ninguna otra pantalla del flujo lo necesita hoy
(citas/pacientes editan por modal transaccional), pero cualquier editor futuro
debe heredarlo, no reinventarlo.

## §5 — Deshacer y confirmar

- **Deshacer con snapshot**: correcciones por chat (`consulta:3633-3709`, la IA
  responde «puedes deshacer»), quitar tareas del plan (`consulta:3204-3213`) y
  panel de correcciones léxicas con deshacer (`consulta:4522`) — REVERSIBILIDAD
  implementada donde más importa.
- **`confirm()` in-app** para lo destructivo/irreversible, nunca
  `window.confirm` (se ignora en PWAs instaladas — razonado en
  `ToastContext.tsx:29-32`): eliminar cita (`citas:261`, con `peligro`),
  firmar (`consulta:3624`).
- **Los toasts no llevan acción**: la API es `toast(msg, type)`
  (`ToastContext.tsx:27`), sin botón de deshacer. Hoy el deshacer vive en la
  pantalla, no en el toast; si algún flujo lo pide, es cambio de primitivo, no
  parche local. 42 archivos usan `useToast` — es EL canal de feedback.

## §6 — Vacío, carga y error

| Pantalla | Vacío (`EmptyState`) | Carga | Error |
|---|---|---|---|
| dashboard | 3 | 2 spinners, **sin `loading.tsx`** | boundary global |
| citas | 3 (con acción «Nueva cita», `citas:431`) | `loading.tsx` + Skeleton | boundary + 10 `catch` |
| pacientes | 3 | `loading.tsx` + Skeleton | boundary + 6 `catch` |
| expediente | 4 (con acción «Crear primera nota», `expediente:426`) | spinners, **sin `loading.tsx`** | boundary + 4 `catch` |
| consulta | 0 (es un editor; no aplica igual) | 12 spinners, **sin `loading.tsx`** | 54 `catch` |
| nota | 2 | spinners, **sin `loading.tsx`** | 10 `catch` |

- 12 rutas tienen `loading.tsx` con `Skeleton`; en el flujo dorado sólo citas y
  pacientes. Dashboard, expediente, consulta y nota entran «en blanco hasta que
  el spinner interno monte» — no se observó corriendo (queda para §33), pero el
  código no declara esqueleto de ruta.
- **Boundary de error único** para todo el panel
  (`(dashboard)/error.tsx`): «Tus datos están a salvo» + Reintentar, con
  reporte. Bien.
- **Transición entre pantallas**: crossfade de opacidad en
  `(dashboard)/template.tsx`, deliberadamente sin `transform` (rompería los
  `position: fixed`) y respetando `prefers-reduced-motion`. Bien razonado.

## Por documentar (sigue pendiente)

- Patrón canónico de retorno de contexto (Agenda → Paciente → Consulta →
  Resultados → Consulta) como **contrato probado** (V10 §38): las piezas
  existen (§1, §4); el contrato con prueba, no.
- Comando universal de V10 §13 (ejecutar, no sólo navegar) — sobre la base de
  `PaletteBusqueda`, no desde cero.
- Convenciones de teclado por flujo (V10 §8.24): hoy sólo la consulta las tiene.
- Verificación en navegador de todo lo anterior (V10 §33): este documento es
  lectura estática y lo dice.

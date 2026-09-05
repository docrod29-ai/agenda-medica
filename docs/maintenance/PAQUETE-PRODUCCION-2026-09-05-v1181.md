# Paquete de producción — `nexusmed-v1181`

> **Estado: PREPARADO, NO PUBLICADO.** Publicar sigue siendo decisión del dueño
> (`.claude/rules/deployment-and-flags.md`). Autorizado por él el 5-sep-2026,
> tras ver CI en verde, con la instrucción «adelante con todo». Este documento
> se escribe ANTES de fusionar, para que lo que se declara no se pueda ajustar
> a lo que salga.

| | |
|---|---|
| **Versión del service worker** | `nexusmed-v1180` → **`nexusmed-v1181`** |
| **Última línea desplegada** | `dc16da75` — v1180, verificada por la ejecución #18 |
| **Commits que entran** | **3** (2 de trabajo + 1 de fusión de `main`) |
| **Superficie** | 13 archivos · +530 / −40 · **3 de código de producto** |
| **Rutas de API nuevas** | **0** |
| **Pantallas nuevas** | **0** |
| **Reglas de Firestore** | **sin cambios** |
| **Índices de Firestore** | sin cambios |
| **Regresiones cerradas** | **0** — no es un paquete de reparación |
| **Decisiones del dueño** | **2** (D-030, D-031) |

Es un paquete pequeño y de una sola pantalla. Se declara entero abajo.

---

## 1. Qué cambia para el médico

Las dos cosas ocurren en **`/operaciones`**, y una además en el menú lateral.

### D-030 — Hospital y UCI salen de la navegación

El índice abría con un grupo «Hospital y UCI — cuando hay pacientes internados»
y el `Sidebar` listaba sus dos entradas. Son dos productos en **ALPHA** («se
usan, no se venden») compitiendo por la atención con lo único que hoy se vende:
la consulta y su agenda.

**Pausar no es borrar.** Las rutas `/hospitalizacion` y `/uci` siguen vivas y se
abren escribiendo la URL; las pantallas, los motores, el catálogo de módulos,
los paquetes y los precios no se tocan; y las filas del menú siguen declaradas
con su etiqueta, su icono y su «para qué». Se reactiva vaciando
`MODULOS_EN_PAUSA` en `src/lib/navegacion/modulos-en-pausa.ts` — una línea.

**No es una defensa de seguridad**, y conviene que quede dicho antes de que
alguien lo suponga: esconder un botón nunca cerró una ruta. Quien no tenga el
módulo contratado sigue rebotando por `rutaPermitida`, igual que antes.

### D-031 — el índice abre con lo de hoy; lo demás, tras un botón

Tras «Agenda» venían nueve destinos de Negocio y Cumplimiento y documentos
—CRM, reseñas, reactivación, farmacia, finanzas, membresías, cumplimiento,
documentos legales, migración— ocupando dos pantallazos por delante de lo que se
usa a diario.

Ahora esos dos grupos viven dentro de un cajón cerrado al entrar, bajo el botón
**«Ver la gestión del consultorio»**. Nada se borra ni se manda a otra ruta: se
pintan enteros, con su cabecera y su cadencia, a un clic.

El botón **no puede mentir**: el nombre de los grupos y la cuenta de destinos se
calculan de lo que va a pintar, ya filtrado por modo (médico/secretaria), por
módulo contratado y por la pausa de D-030.

---

## 2. Lo que NO entra en este paquete

- **Ningún cambio clínico.** Ni motores, ni dosis, ni umbrales, ni ASR, ni nota,
  ni receta, ni orden. El diff de código son tres archivos: una pantalla, el
  menú lateral y un módulo de navegación nuevo.
- **Ninguna ruta de API**, ninguna colección, ningún cambio de esquema.
- **`firestore.rules` y `firestore.indexes.json` sin tocar** — a diferencia de
  v1180, aquí no hay nada que publicar aparte del código. El workflow manual
  sigue haciendo falta como **certificación** (que el sitio vivo sirva
  `nexusmed-v1181`, seguridad y humo), no como publicación de reglas.

---

## 3. Compuertas, con sus números

| Compuerta | Resultado |
|---|---|
| `npx vitest run` | **12 599 casos en verde**, 934 archivos, 1 omitido |
| `node scripts/lint-trinquete.mjs` | **94**, igual que el techo. Sin deuda nueva |
| `tsc --noEmit` | limpio |
| CI del PR #452 (5 trabajos) | `verificar`, `lint (trinquete)`, `clinical-safety`, `aislamiento-tenant`, `e2e-publico` — **los cinco en verde** |
| Vista previa de Vercel | desplegada y accesible |

Dos guardianes nuevos, los dos **probados al revés** (que es la condición de la
regla, no un extra):

- `hospital-y-uci-en-pausa.test.ts` — con `MODULOS_EN_PAUSA` vacío fallan 2 de
  sus 6 casos.
- `operaciones-el-cajon-de-lo-secundario.test.ts` — sin la marca `secundario`
  fallan 2 de sus 8 casos.

---

## 4. Lo que este paquete NO demuestra

- **No se miró en un navegador desde la sesión que lo escribió.** El contenedor
  no tiene `.env`, así que la app no arranca ahí y el `npm run build` completo
  se corta al recolectar datos de página (`auth/invalid-api-key`) — falla
  idéntico sobre el árbol limpio, comprobado. La vista previa de Vercel sí se
  construyó y es lo que el dueño usó para aprobar. **Queda sin verificar por el
  arnés**: el cajón abierto y cerrado en móvil, el recorrido con teclado y el
  foco visible, que es lo que pide `.claude/rules/design-system.md` antes de dar
  una interfaz por aprobada.
- **Que el service worker viejo se haya retirado de los navegadores.** Sube la
  versión del caché; la retirada ocurre cuando cada cliente recarga.
- **Nada sobre Hospital/UCI como producto.** Siguen en ALPHA y siguen sin
  venderse; esto sólo cambia dónde se ofrecen.

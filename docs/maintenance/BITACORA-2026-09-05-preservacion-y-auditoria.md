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

## Qué cambió en esta rama — quince slices, un commit cada uno (y uno para las decisiones)

| REG | Qué | Al revés |
|---|---|---|
| **512** | `telesalud/sala` no comprobaba `portalTokenVersion`: un enlace revocado abría la sala de video 7 días | 200 con URL → 401/503 |
| **513** | Los alérgenos del expediente no llegaban a Whisper por ningún camino; ahora UNA lista para los cuatro puntos de envío | la lista vieja sobre un `FormData` real pierde `alergias` |
| **514** | La pregunta escalada del paciente no le llegaba a nadie sin teléfono configurado; ahora abre una tarea `pregunta_paciente` en `/pendientes` | sin el arreglo: 4 rojos, 4 verdes |
| **515** | El guardián del paciente equivocado se satisfacía con un comentario; ahora exige la llamada y su resultado, con autotest contra los mutantes | los mutantes ponen rojo el detector |
| **516** | La pregunta atendida seguía «pendiente» en el portal: cerrar la tarea ahora marca `atendidaEn` por una ruta de servidor | con `/pendientes` sin el gancho, el guardián rojo |
| **517** | Sin edad en el expediente la receta aplicaba topes de adulto a un niño, en silencio; ahora manda la fecha de nacimiento y la falta se pinta | cuatro casos rojos con las pantallas como estaban |
| **518** | La huella de una receta larga se perdía entera en la bitácora, con `ok: true`; ahora se acota por campo y lo omitido se declara | `meta: null` para 80 fármacos |
| **519** | La cancelación ARCO dejaba vivo el enlace del portal (D-034): el bloqueo sube `portalTokenVersion` en el mismo `set` | la versión no subía y `decidirVigencia` decía «vigente» |
| **520** | La receta sólo veía el papel de hoy: ahora cruza con la medicación vigente (y dice qué ya existía) y precarga la creatinina del expediente con fecha y vigencia a 7 días | `detectarInteracciones(hoy)` no ve warfarina + ketorolaco; el guardián de fuente, cuatro rojos |
| **521** | «Paracetamol 500 mg» + «Tempra 1 g» pasaban renglón a renglón (4 500 mg/día); ahora la misma sustancia se dice, con la suma contra el techo del catálogo, en consulta y receta | renglón a renglón, vacío; con la lista y las pantallas como estaban, cinco rojos |
| **522 · 523** | Port de PR #442 (eran 444 y 506, números que `main` ya había gastado): la vista previa del papel mide su sitio; la sonda de pantallas recorre el scroller de dentro y mide el área de golpe; `/pendientes` se siembra | verificado que las pruebas pasan aquí; las inversiones son de la sesión de origen |
| **524 · 525 · 526** | Test-the-test: `csp-manifest` corre tras el build (antes, siempre saltada); el prompt se vigila por frases sobre lo emitido (antes, literales); la membresía del servidor tiene su primera prueba ejecutada contra un doble con id | dos rojos sin el paso de CI; el guardián viejo verde con la orden reformulada; tres mutantes de `auth-server.ts` cazados |
| **527 · 528** | Seguridad: `sanitize` redacta nombres por llave y llaves de Stripe por patrón (su cabecera lo prometía y no lo hacía); `reclamarCanal` en transacción, con la carrera provocada en el arnés en memoria | cuatro rojos con `sanitize.ts` como estaba; la carrera la gana el segundo con `reclamar-canal.ts` como estaba |
| **529** | Cuarenta rutas devolvían `String(err)` al cliente (la auditoría contó 25; el guardián, 46 sitios): helper que no recibe el error, detalle a `safeLog`, barrido de todas las rutas | con `src/app/api` como estaba, el barrido lista los 46 |
| **530** | Verificación en navegador (arnés de emuladores, paciente sintético `pac-006`, sonda nueva): los avisos de REG-520/520/521 se ven; y la receta contaba su propia nota como «ya lo toma» — arreglado en receta y consulta | caso 1 rojo con la receta como estaba; la sonda lo enseñó en rojo antes del arreglo |

Cada uno con su golden (qué fallaba, cómo se descubrió, causa raíz, regla, **qué
NO cubre**), su entrada en el ledger, su familia de defecto, su sello, y las
compuertas medidas en el mensaje del commit.

## Compuertas al cerrar

| | |
|---|---|
| `npx vitest run` | **12 755 pasan · 1 falla** · 952 archivos (tras REG-531; la falla es `ops-timeout-y-punto-ciego`, el proxy del contenedor rechaza `10.255.255.1` al instante — entorno, no árbol; en la corrida de REG-523 pasó) |
| `npx tsc --noEmit` | limpio |
| `node scripts/lint-trinquete.mjs` | **93**, techo apretado en REG-520 |
| `npm run build` | 164/164 páginas, con los placeholders del CI |
| Sello | 476 archivos · 6 604 casos |
| Ledger | 324 REG · última **REG-531** |

## Lo que se supo y no estaba escrito

- **B-12 no era bloqueo.** El emulador de Firebase arranca en este contenedor.
  Queda corregido en `agent-state/BLOCKERS.md`.
- **El commit «huérfano» de las alergias en el teléfono ya estaba en `main`**
  (REG-437). El consolidado del 2-sep estaba atrasado ahí.
- **PR #442 necesita renumerar** (REG-444 y REG-506 ya son de `main`) y traer
  52 commits. Es trabajo válido sin absorber, no se tocó desde esta rama.

## Lo que queda, con nombre

`docs/product/AUSCULTA-ULTRA-READINESS.md` §3 y §11, y el checkpoint en
`agent-state/AUSCULTA_LAST_SAFE_CHECKPOINT.md`. Lo reportado el 5-sep está
agotado; lo primero ahora es la verificación en navegador con el arnés. La
llave de 360dialog como id de documento es decisión del dueño (D-E). El PR
#442 queda absorbido aquí y lo puede cerrar el dueño. Los tres validadores
sin llamador son una decisión nueva para el dueño (D-D en el readiness §9).

Las tres decisiones que se le llevaron al dueño (D-A, D-B, D-C) están
resueltas y escritas donde se leen: **D-032** (la alergia crítica sólo avisa),
**D-033** (la pregunta viaja completa por WhatsApp) y **D-034** (la
cancelación ARCO revoca el portal, implementada como REG-522).

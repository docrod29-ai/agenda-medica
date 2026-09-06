# Paquete de producción — `nexusmed-v1172`

> **Estado: PREPARADO, NO PUBLICADO.** Este documento describe exactamente qué
> se publicaría. Nadie ha desplegado nada. Publicar a producción y desplegar
> reglas de Firestore siguen siendo decisiones del dueño
> (`.claude/rules/deployment-and-flags.md`).

> **SUPERADO — 28-ago-2026 03:29 UTC. PUBLICADO Y VERIFICADO.** El dueño corrió el
> botón: ejecución
> [#4](https://github.com/docrod29-ai/agenda-medica/actions/runs/33138476319)
> (segundo intento), en verde, con `VERSION_ESPERADA: nexusmed-v1172` y su
> Compuerta 3 —«producción ya sirve nexusmed-v1172»— midiéndolo contra el sitio
> vivo. Fue **la primera ejecución del botón que cerró en verde**; las #1, #2 y #3
> fallaron antes de desplegar nada.
>
> Este aviso se añadió el 2-sep, al descubrirse que esta acta llevaba cinco días
> diciendo «nadie ha desplegado nada» de un paquete que sí se desplegó. Las de
> v1175, v1176 y v1177 ya se habían cerrado así; ésta se quedó atrás, que es
> exactamente el fallo que hoy vigila
> `el-tablero-del-loop-no-miente.test.ts`. La línea de arriba no se borra: era
> verdad cuando se escribió.

| | |
|---|---|
| **SHA base del paquete** | `f4ee921caefaa74e47cddf5716c8ee8df63a1474` (`main`) |
| **Versión del service worker** | `nexusmed-v1171` → **`nexusmed-v1172`** |
| **Última línea desplegada** | **NO SE SABE CON CERTEZA** — ver §1. Cota superior: `b37498f` (`chore(deploy): v1149`, 8-ago) |
| **Commits que entran** | **≤ 229** (196 directos + 33 merges) — 229 es el máximo defendible, no un dato verificado |
| **Rango de fechas** | 8-ago-2026 → 27-ago-2026 |
| **Superficie** | 2 012 archivos · +157 721 / −4 840 líneas |
| **CI sobre el SHA base** | 5/5 en verde — run `33129847291` |
| **Deploy de reglas de Firestore** | **PENDIENTE, aparte** — ver §2 |

---

## Por qué existe este documento

> «Un despliegue arrastra TODO lo no desplegado. No publica "lo último que se
> pidió": publica todo lo pendiente. Declarar el paquete antes de publicar.»
> — `.claude/rules/deployment-and-flags.md`

Producción lleva **veinte días** detrás. El siguiente `vercel --prod` no publica
el arreglo de anoche: publica los 229 commits de abajo, de una vez. Esto es la
declaración de ese paquete, escrita **antes** de publicar y no después.

---

## Lo que se declara antes de publicar

### 1. La base NO se sabe, y `/version.txt` no la puede decir

Esto se descubrió preparando el paquete y es lo más importante del documento.

`b37498f` (v1149, 8-ago) es el último commit `chore(deploy)` del historial, y de
ahí salen los 229. **Es el único dato del repositorio sobre qué se publicó**, y
es más débil de lo que parece.

`agent-state/MASTER_STATE.json` tiene un campo que promete justo eso —
`ultimaVersionEnProduccion` — y no sirve: se **deriva de `public/version.txt`**
(`scripts/agent-state/actualizar.mjs`, «la versión que está DESPLEGADA, según el
archivo que sirve producción»). Es una copia del propio repositorio, así que no
puede discrepar de él ni detectar una deriva. Hoy dice `v1172` porque este
paquete subió el número, no porque haya nada publicado.

Y el número del service worker tampoco identifica el árbol publicado:

```
4656e51  9-ago  feat(identidad): … (v1171)   ← aquí sw.js pasó a v1171
…        164 commits después, ninguno tocó public/sw.js
f4ee921 27-ago  (main)                        ← sigue diciendo v1171
```

`v1171` se subió el 9-ago dentro de un commit de producto y **nunca se volvió a
mover**. Cualquier despliegue hecho entre el 9 y el 27 de agosto sirve
exactamente el mismo `/version.txt`. El número dejó de identificar el árbol
publicado: mide la última vez que alguien tocó esa constante, no la última vez
que se publicó.

**Cómo se resuelve — y no es con `curl` solo:**

1. `curl -s https://agenda-medica-one.vercel.app/version.txt`
   - Devuelve `nexusmed-v1149` → producción es `b37498f` y el paquete es
     **exactamente 229**. Este documento vale tal cual.
   - Devuelve `nexusmed-v1171` → sólo dice «algo entre el 9 y el 27 de agosto».
     **No basta**; hay que ir al paso 2.
2. **El panel de Vercel, despliegue de producción → el SHA del commit.** Es la
   única fuente que dice qué árbol está sirviendo. Con ese SHA:
   ```bash
   git log --oneline <SHA_EN_PRODUCCION>..f4ee921 | wc -l   # el paquete REAL
   ```

Mientras eso no se mire, **229 es una cota superior, no una medición**. Un
paquete mal declarado da confianza sin respaldarla, y por eso queda escrito así y
no redondeado hacia la comodidad.

**La causa, para que no se repita:** la regla de despliegue manda subir
`nexusmed-vNNN` *en el ciclo de publicación*. El 9-ago el número se subió en un
commit de producto que no se publicó, y desde entonces el contador y la realidad
viajan separados. `v1172` de este paquete vuelve a atarlos — a condición de que
el siguiente bump vaya con su despliegue y no antes.

**Lo que este paquete NO arregla, y queda anotado para el dueño:** mientras
`ultimaVersionEnProduccion` se derive de `public/version.txt`, el tablero no
puede saber qué hay publicado — dirá siempre lo que diga el repositorio. Para
que ese campo signifique lo que promete tendría que leer el sitio vivo o el
despliegue de Vercel. Cambiarlo estaba fuera del encargo de este paquete y no se
tocó.

### 2. `firestore.rules` — deploy SEPARADO, y no es opcional

`vercel --prod` **no** publica las reglas. Desde `v1149` hay **dos** cambios sin
desplegar:

| Commit | Fecha | Qué cambia | Qué pasa si NO se despliega |
|---|---|---|---|
| `5d496cf` | 9-ago | Añade `paquetes_visita` (`read: isMedico`, `write: if false`) — V9 · PATIENT-COMPANION-001 | **Nada se rompe.** Se comprobó: los únicos accesos a esa colección son `/api/expediente/paquete-de-visita` y `/api/portal`, ambos con el SDK de administrador, que **no pasa por las reglas**. Sin desplegar, la colección queda en denegación por omisión para el cliente — más cerrada, no más abierta. Lo que queda desalineado es el árbol declarado (`matriz-acceso.ts`, `respaldo.ts`) contra lo publicado |
| `a03c582` | 26-ago | `laboratorios`: exige que `pacienteId`/`clinicId` del documento **sean la ruta** — REG-323 / H-17 P0 | **Se pierde la segunda capa.** La frontera que decide de quién es la hoja (`autorizaGuardar`) vive en el cliente; esta regla es lo que impide que un panel que dice ser de otro paciente aterrice saltándose la pantalla. Sin ella, esa defensa queda en una sola capa |

```bash
npx firebase deploy --only firestore:rules --project nexomed-agenda
```

**Orden:** da igual cuál vaya primero. Se leyó el diff: la regla de
`laboratorios` exige los campos **sólo si vienen** (`!('pacienteId' in
request.resource.data) || …`), a propósito, para no romper la restauración de
respaldos anteriores a REG-323. Por eso las reglas nuevas **no rechazan** lo que
escribe el código hoy desplegado, y publicarlas antes que la app no rompe nada.

### 3. Variables de entorno que siguen faltando (no bloquean)

- `TIPO_CAMBIO_USD_MXN` (B-03) — la contabilidad no convierte el costo de IA a
  pesos; lo declara como supuesto.
- `OPS_ALERTA_WEBHOOK` (B-04) — las alertas de operación no salen a ningún
  humano; la franja dentro de la app sí avisa.

### 4. Lo que este paquete NO afirma

- El recorrido GP-FINAL (78 casos, 0 P0, 0 P1) corrió contra **emuladores**, no
  contra Firestore real.
- **Sin proveedor de ASR no se dicta**: la transcripción tardía tras edición
  manual y H-19 en navegador no se han recorrido. Sus goldens sellados los
  cubren; la vuelta por el navegador, no.
- Las cabeceras de **producción** no se han medido — sólo se pueden medir
  después de publicar (`npm run e2e:seguridad:prod`).
- Ningún WhatsApp real, ninguna receta real, ningún CFDI real.

---

## Inventario del paquete

### Por tipo de commit (sobre la cota de 229)

| Tipo | Nº | Tipo | Nº |
|---|---|---|---|
| `fix` | 48 | `chore` | 14 |
| `infra` | 34 | `rescue` | 10 |
| `feat` | 26 | `reconcile` | 7 |
| `test` | 21 | `evidence` | 7 |
| `docs` | 16 | merges | 33 |

### Dónde cae (archivos tocados)

| Área | Archivos |
|---|---|
| `docs/design/` | 1 145 |
| `scripts/design/` | 128 |
| `src/app/(dashboard)/` | 52 |
| `tests/visual/` | 35 |
| `src/lib/expediente/` | 28 |
| `src/app/api/` | 18 (1 ruta nueva) |
| `src/lib/evidence-integrations/` | 12 |
| resto (`src/lib/asr`, `paciente`, `whatsapp`, `finanzas`, `hospital`, `ui`…) | ≤ 8 cada uno |

### Regresiones cerradas en el paquete

REG-017 · REG-060 · REG-160 · REG-189 · REG-192 · REG-193 · REG-245 · REG-252 ·
REG-264 · REG-265 · REG-266 · REG-267 · REG-268 · REG-269 · REG-270 · REG-271 ·
REG-274 · REG-275 · REG-276 · REG-277 · REG-278 · REG-279 · REG-280 · REG-281 ·
REG-282 · REG-283 · REG-284 · REG-285 · REG-286 · REG-287 · REG-288 · REG-289 ·
REG-290 · REG-291 · REG-292 · REG-293 · REG-294 · REG-298 · REG-300 · REG-302 ·
REG-306 · REG-307 · REG-308 · REG-313 · REG-314 · REG-315 · REG-316 · REG-317 ·
REG-318 · REG-319 · REG-320 · REG-321 · REG-322 · REG-323 · REG-324 · REG-326 ·
REG-330 · REG-331 · REG-332 · REG-333 · REG-334 · REG-335 · REG-336

(Cada una con su causa raíz y su prueba en `docs/audit/regression-ledger.md`.)

---

## Orden de publicación — NO EJECUTADO

```bash
# 0. Establecer la base (§1). Si version.txt dice v1171, NO basta:
#    hay que leer el SHA del despliegue de producción en el panel de Vercel.
curl -s https://agenda-medica-one.vercel.app/version.txt

# 1. La app
vercel --prod --archive=tgz

# 2. Comprobar que llegó
curl -s https://agenda-medica-one.vercel.app/version.txt   # → nexusmed-v1172

# 3. Las reglas (§2) — NO las publica el paso 1
npx firebase deploy --only firestore:rules --project nexomed-agenda

# 4. Cabeceras de PRODUCCIÓN — aquí y no antes
npm run e2e:seguridad:prod
```

Si tras publicar una ruta privada sale sin `X-Frame-Options`, el despliegue está
mal y se arregla en el momento: por eso este paso va **después** y no en el CI
del PR.

---

## Apéndice A — los 196 commits directos

| SHA | Fecha | Asunto |
|---|---|---|
| `0abcba2` | 2026-08-08 | chore(deploy): v1146 — REG-264 a producción |
| `639ca73` | 2026-08-08 | feat(paciente): la auditoría del producto real, y dos defectos que encontró (V9 · PATIENT-UX-TRUTH-001, REG-265/266) |
| `6a6501d` | 2026-08-08 | docs(v9): sella el SHA de cierre de PATIENT-UX-TRUTH-001 |
| `a19d183` | 2026-08-09 | fix(dictado): las tres formas de perder una consulta ya grabada (REG-267 a REG-270) |
| `3598955` | 2026-08-09 | docs(v9): la especificación del dueño pasa a ser la fuente de verdad, y V9 gana condición de terminado |
| `25fd70a` | 2026-08-08 | fix(nota): la enfermedad nombrada en la pregunta se cosechaba como antecedente (REG-280/281, v1156) |
| `5bb1a2c` | 2026-08-09 | feat(diseño): el sistema de diseño existe de verdad, y tiene compuerta (V9 · DESIGN-SYSTEM-001, REG-274/275) |
| `93710d6` | 2026-08-08 | fix(nota): un negador sin su afirmador gemelo BORRA un antecedente (REG-282, v1157) |
| `7be23e9` | 2026-08-08 | fix(audio, voz): 22 minutos de dictado que se borraban solos (REG-283/284, v1158) |
| `fed81cc` | 2026-08-09 | feat(navegación): el ciclo devuelve el contexto exacto (V9 · NAVIGATION-001, REG-276 a 279) |
| `861b711` | 2026-08-09 | docs(v9): sella el SHA de cierre de NAVIGATION-001 |
| `aed571b` | 2026-08-08 | fix(vocabulario): «obe·SIDA·d» decía VIH, y con eso se descartaba un VIH (REG-285, v1159) |
| `1cd9bc8` | 2026-08-08 | fix(nota): el escudo de una oración se prestaba a la siguiente (REG-286, v1160) |
| `2340e63` | 2026-08-08 | fix(audio, sesión): grabar es actividad, y salir grabando avisa (REG-287, v1161) |
| `5d496cf` | 2026-08-09 | feat(paciente): el compañero, con la compuerta antes que la pantalla (V9 · PATIENT-COMPANION-001, REG-280/281) |
| `6feaf5a` | 2026-08-09 | docs(v9): sella el SHA de cierre de PATIENT-COMPANION-001 |
| `d22fbfd` | 2026-08-08 | estado: los tres P0 de audio quedan cerrados en los tableros de V9 |
| `cd52bd6` | 2026-08-08 | feat(calidad): las decisiones del dueño, derivadas del código (REG-288, v1162) |
| `a0eb9a3` | 2026-08-08 | feat(motores): «Lo que te protege» — las defensas corriendo en vivo (REG-289/290, v1163) |
| `83ef997` | 2026-08-08 | fix(motores): las respuestas de varios renglones ya no se aplastan (v1164) |
| `573d77d` | 2026-08-08 | fix(laboratorio): un valor NORMAL marcado como crítico (REG-291, v1165) |
| `653713a` | 2026-08-09 | fix(producto): se dice lo que HACE, nunca cómo lo hace (REG-292, v1166) |
| `aca3764` | 2026-08-09 | fix(cobros): el día de un cobro es el del consultorio, no el de CDMX (REG-293, v1167) |
| `0824da8` | 2026-08-09 | docs(v10): instala el Master Loop V10 íntegro y arranca V10-TRUTH-001 |
| `48ffc24` | 2026-08-09 | docs(v10): desbloquea el Master Loop V10 enrutándolo a la directiva V9 |
| `ea26120` | 2026-08-09 | fix(v10): restaura la directiva REAL — mi documento de enrutamiento la tapaba |
| `97f1813` | 2026-08-09 | merge: main con V9 dentro (V10-D1 completa) + los techos de diseño BAJAN |
| `dee76d3` | 2026-08-09 | feat(v10): la pantalla de hoy deja de ser un tablero — HOME-001 |
| `eba71f7` | 2026-08-09 | fix(v10): el medidor del teléfono decía 0 con la pantalla rota — REG-306, v1168 |
| `f0856e8` | 2026-08-09 | feat(v10): línea base de accesibilidad — axe sobre el golden flow autenticado (salida 10) |
| `c497087` | 2026-08-09 | chore(v10): firebase-debug.log fuera de git — lo regenera cada corrida del emulador |
| `1bd6100` | 2026-08-09 | feat(v10): línea base de accesibilidad LEVANTADA — 71 nodos, 30 críticos, 5 reglas (salida 10) |
| `f7a4514` | 2026-08-09 | chore(diseño): el trinquete BAJA tras la fusión — 560 hex / 2020 tamaños / 637 radios |
| `4961871` | 2026-08-09 | evidencia(v10): capturas del golden flow re-tomadas sobre la línea RECONCILIADA |
| `26fceae` | 2026-08-09 | refactor(v10): conecta las escalas de diseño que nadie usaba |
| `c516cda` | 2026-08-09 | feat(v10): fuera la fuente de fábrica + la escala de estado clínico que faltaba |
| `d83befb` | 2026-08-09 | fix: el canal ARCO apuntaba al dominio de un competidor |
| `44770ac` | 2026-08-09 | feat(v10): el arnés de capturas del golden flow — y sus dos primeros cobros (REG-307/308, v1169) |
| `9cffca9` | 2026-08-10 | fix(v10): el aviso de hidratación en TODAS las rutas — portado de las corridas paralelas (V10-BUG-001) |
| `1b0e046` | 2026-08-10 | estado(v10): compuertas de la fusión en verde + tablero derivado + ítem de consolidación de arneses |
| `a63fefe` | 2026-08-10 | evidencia(v10): la línea fusionada, verificada en navegador real — hidratación 28→0, axe 0 critical |
| `533899d` | 2026-08-09 | fix(a11y): 41 sitios seguían pintando el azul que se retiró por contraste |
| `b6a8c34` | 2026-08-10 | feat(v10): la agenda es un RIEL — AGENDA-IDENTITY-001, el P0 móvil muere y nace la primera firma NexusMED |
| `2ee0ba9` | 2026-08-09 | feat: el producto se llama Ausculta |
| `4656e51` | 2026-08-09 | feat(identidad): el acento sale del índigo de IA — cian-petróleo (v1171) |
| `942fcb9` | 2026-08-15 | docs(v15): RTC-30 medida en /lista-espera y REFUTADA — queda cerrada en lo alcanzable |
| `b9ab724` | 2026-08-15 | feat(v15): §21 llega a Hoy — la fila que enseñaba el pendiente no podía preguntarle nada |
| `01a1086` | 2026-08-15 | feat(v15): el control que navega era un botón dentro de un enlace — 8 sitios, y uno era la acción primaria de Hoy |
| `060aade` | 2026-08-15 | feat(v15): la vuelta exacta de §21 — un contrato de regreso, no un enlace |
| `760200e` | 2026-08-15 | docs(v15): §29 medido antes de tocar nada — y la vara obvia queda refutada |
| `d315a87` | 2026-08-15 | feat(v15): el expediente LLENO decía que estaba vacío — y el aviso valía en una sola dirección |
| `d91c840` | 2026-08-15 | feat(v15): Hoy deja de ofrecer administración primero; la fila de Pacientes se inspecciona |
| `23b43f4` | 2026-08-15 | feat(v15): §29 medido en el encuentro SIN FIRMAR — y Operaciones deja de ser un índice mudo |
| `88f507e` | 2026-08-15 | test(v15): el ciclo de grabación se INTENTA, no se lee — y la sonda se cazó a sí misma en falso verde |
| `d307287` | 2026-08-15 | fix(v15): la franja de Operaciones baja a la escala tipográfica y deja de cascar renders |
| `a9e8ae4` | 2026-08-15 | docs(v15): el acta de la corrida — medición corregida, tres superficies y el ciclo de grabación |
| `89865c2` | 2026-08-15 | feat(v15): el banco de flujos — 20/20, y dos P1 que sólo salían haciendo el trabajo |
| `7e59345` | 2026-08-15 | feat(v15): la coherencia del producto entero — el documento clínico dejaba de nombrar al paciente justo donde decide su tratamiento |
| `317c6c5` | 2026-08-15 | docs(v15): la compuerta de publicación — y el acta decía «cero errores de consola» donde su propia evidencia decía cuatro |
| `6ad20a7` | 2026-08-17 | infra: add bounded Ausculta product writer runner (#299) |
| `ce24194` | 2026-08-17 | infra: add bounded product Codex judge |
| `d815f0c` | 2026-08-18 | infra: add owner-comment Claude product writer |
| `5fc8396` | 2026-08-18 | infra: parallelize product Codex judges by PR (#308) |
| `d978940` | 2026-08-18 | infra: publish Codex judge verdict to product PR (#309) |
| `02eac2b` | 2026-08-18 | infra: decouple Codex verdict transport from slice gate (#316) |
| `0794ece` | 2026-08-18 | infra: fix Claude writer scope guard syntax |
| `95429da` | 2026-08-19 | infra: align product writer verification with CI |
| `85d496e` | 2026-08-19 | infra: add deterministic consultorio load fixture generator (#319) |
| `2adfdc7` | 2026-08-20 | infra: add read-only Codex verdict recovery (#324) |
| `40b6bee` | 2026-08-20 | infra: add immutable Codex verdict artifact recovery (#323) |
| `2b1065a` | 2026-08-20 | infra: allow Codex judge verdict comment publication |
| `c35d04a` | 2026-08-20 | infra: bind Codex judge to exact-SHA CI evidence (#328) |
| `fed93d3` | 2026-08-21 | infra: allow Codex recovery PR comment publication |
| `298e5c2` | 2026-08-21 | infra: add event-driven n8n dev autopilot v1 (#330) |
| `ce6346e` | 2026-08-21 | infra: add n8n Cloud-compatible dev autopilot |
| `0f11a97` | 2026-08-21 | infra: add exact-SHA Codex dispatch fallback |
| `9721b20` | 2026-08-21 | infra: allow recovery-dispatched Codex actor |
| `b80eba6` | 2026-08-21 | infra: allow one proven failed Codex fallback retry (#335) |
| `c0c25ba` | 2026-08-21 | infra: make product writer exact-SHA and checkpointed (#336) |
| `303291b` | 2026-08-22 | infra: allow trusted GitHub Actions bot to run Codex judge (#337) |
| `26630a4` | 2026-08-22 | infra: align bounded writer wall-clock with turn budget (#339) |
| `e7708da` | 2026-08-22 | evidence(#314): contrato EvidenceSource provider-neutral y catálogo de licencias |
| `d96285d` | 2026-08-22 | evidence(#314): adaptadores — PubMed real, propietarios apagados, notas personales |
| `75e34f7` | 2026-08-22 | evidence(#314): política de evidencia — soporte, compuertas, frescura, selección |
| `77994cd` | 2026-08-22 | evidence(#314): pruebas deterministas — cita, respaldo fabricado, caída y frescura |
| `48f1358` | 2026-08-22 | evidence(#314): matriz generada, guardián de sincronía y visor del benchmark |
| `432cd10` | 2026-08-22 | evidence(#314): documentación de arquitectura y handoff exacto |
| `a5ca338` | 2026-08-23 | evidence(#314): evitar homónimos que ciegan a dos guardianes del repo |
| `7b156a9` | 2026-08-23 | docs(#314): declarar la prueba que este carril deja en rojo, y por qué |
| `2a59946` | 2026-08-22 | infra: add Consultorio scale evidence contract (#340) |
| `d2fb5fb` | 2026-08-22 | infra: stop recovery comments from cancelling Codex judge |
| `33afa7b` | 2026-08-22 | fix(infra): make Codex judge runs exact-SHA correlatable |
| `7e90117` | 2026-08-22 | fix(infra): correlate Codex recovery by run metadata |
| `0a8a32b` | 2026-08-22 | docs(evidence): pin runtime wiring repair contract |
| `2d68d3a` | 2026-08-23 | product: checkpoint bounded active slice |
| `0514aec` | 2026-08-22 | chore: retrigger canonical CI for Evidence runtime wiring |
| `2b45e61` | 2026-08-23 | product: checkpoint bounded active slice |
| `cc08ea1` | 2026-08-23 | ci: retrigger Evidence runtime verification via owner connector |
| `e8fd5c8` | 2026-08-23 | fix: keep Evidence alert on design-system radius scale |
| `aeeedc3` | 2026-08-23 | docs: refresh screen inventory after Evidence UI change |
| `5209540` | 2026-08-23 | infra: eliminate recurring CI approval loop (#352) |
| `7927ea5` | 2026-08-23 | infra: parallelize independent Claude product lanes |
| `98ebc51` | 2026-08-23 | infra: recover Codex verdicts from all judge transports |
| `aef23d3` | 2026-08-23 | infra: parallelize independent Codex verdict recovery |
| `fff445c` | 2026-08-23 | infra: correlate Codex recovery by exact SHA |
| `4fae1e2` | 2026-08-23 | infra: never cancel an in-flight paid Codex judge (#361) |
| `76ba314` | 2026-08-23 | infra: extend Codex judge wall-clock to persist verdict |
| `b4a055a` | 2026-08-23 | fix(reasoning): hard-wire trusted deterministic execution boundary |
| `c611bb5` | 2026-08-23 | fix(reasoning): fail closed at consultation HTTP provenance boundary |
| `d408ac1` | 2026-08-23 | fix(reasoning): bind HTTP reasoning to patient and server-only provenance |
| `d307cfb` | 2026-08-23 | test(reasoning): enforce trusted deterministic provenance boundary |
| `689f310` | 2026-08-23 | test(reasoning): bind HTTP reasoning to patient and server provenance |
| `ce5b10c` | 2026-08-23 | fix(reasoning): connect trusted engine executor to consultation bridge |
| `cf173ea` | 2026-08-23 | fix(voice): wire sealed Clinical Truth bridge into clinical ASR pipeline |
| `2dde4e2` | 2026-08-23 | fix(voice): avoid widening API surface for Clinical Truth bridge |
| `56c0487` | 2026-08-23 | test(voice): prove hardened bridge is on the clinical ASR path |
| `d0c7650` | 2026-08-23 | voice: keep Clinical Truth handoff out of ASR pipeline until consultorio integration |
| `ace835d` | 2026-08-23 | voice: keep chronology hardening focused on Voice core |
| `8efba5f` | 2026-08-23 | test(voice): declare Clinical Truth bridge pending Consultorio wiring |
| `d3ad575` | 2026-08-23 | product: activate consultorio on integrated voice reasoning base |
| `9aea16d` | 2026-08-23 | test: freeze 61-minute consultation recording continuity |
| `542c49f` | 2026-08-24 | test(consultorio): prove autosave recovery without duplication |
| `1bc087c` | 2026-08-24 | fix(consultorio): never fight physician scroll during return restore |
| `690b047` | 2026-08-24 | test(consultorio): lock manual scroll over delayed restore |
| `5df684b` | 2026-08-24 | feat(consultorio): surface only clinically material ambiguity |
| `f6d9474` | 2026-08-24 | test(consultorio): harmless ASR noise never interrupts physician |
| `92615e4` | 2026-08-24 | fix(consultorio): preserve ambiguity antifatigue contract |
| `3ca58a1` | 2026-08-24 | fix(consultorio): fail closed on AI medication intent |
| `ec2d502` | 2026-08-24 | test(consultorio): prove medication history firewall |
| `85f4827` | 2026-08-24 | fix(consultorio): keep AI diagnoses unconfirmed and uncoded |
| `a2a155f` | 2026-08-24 | test(consultorio): prove typed voice mixed Clinical Truth parity |
| `1b5a865` | 2026-08-24 | test(consultorio): prove graceful secondary failure |
| `c7de731` | 2026-08-24 | fix(consultorio): make appointment retries idempotent |
| `15303c2` | 2026-08-24 | test(consultorio): guard appointment retry idempotency |
| `4483c42` | 2026-08-24 | test(consultorio): prove GP9 retry-safe transitions |
| `342b043` | 2026-08-24 | test(consultorio): fix GP9 Stripe proof path |
| `0cde37c` | 2026-08-24 | fix(consultorio): harden audited addenda for signed notes |
| `c6bcb91` | 2026-08-24 | fix(consultorio): use canonical audit metadata field for addenda |
| `8d46e4d` | 2026-08-24 | test(consultorio): prove GP10 immutable signed note addenda |
| `0268920` | 2026-08-24 | test(consultorio): prove GP11 secretary least privilege |
| `defae47` | 2026-08-24 | fix(consultorio): hide routine normalization ledger from physician |
| `63cd3c7` | 2026-08-24 | refactor(asr): keep normalization provenance without dead UI counter |
| `dd7f3f2` | 2026-08-24 | revert(asr): keep shared UCI normalization helper reachable |
| `5c729d9` | 2026-08-24 | fix(consultorio): scope normalization ledger hiding to ambulatory route |
| `5e994a4` | 2026-08-24 | fix(consultorio): hide routine lexical correction ledger |
| `77d3aca` | 2026-08-24 | test(consultorio): lock technical ledger suppression |
| `4a59203` | 2026-08-25 | chore(consultorio): run bounded GP6 GP9 GP12 repair |
| `d3bf2fe` | 2026-08-25 | fix(test): complete GP6 typed fixtures |
| `918f338` | 2026-08-25 | chore(consultorio): move bounded GP repair into executable script |
| `ef24eaa` | 2026-08-25 | chore(consultorio): make bounded GP repair workflow a thin launcher |
| `84cac33` | 2026-08-24 | fix(consultorio): make agenda->check-in->pago->consulta transitions idempotent |
| `7644b46` | 2026-08-23 | repair: hide provider/model brands from physician routing (#345) |
| `d1ad18b` | 2026-08-25 | fix(consultorio): close GP6 reprojection bypasses |
| `4cfe612` | 2026-08-25 | chore(consultorio): remove temporary GP fixture workflow |
| `d79cf89` | 2026-08-25 | chore(consultorio): remove temporary GP repair workflow |
| `c48b2e5` | 2026-08-25 | chore(consultorio): remove temporary GP repair script |
| `31b970b` | 2026-08-25 | fix(seguridad): rescata límite de tasa del portal sobre main actual (#367) |
| `a44ef4a` | 2026-08-25 | test(consultorio): seal four canonical diagnosis projection paths |
| `623dbe6` | 2026-08-25 | test: align GP9 idempotency guard with encounter key |
| `51cabca` | 2026-08-25 | docs: regenerate screen inventory after consultorio changes |
| `1e6c008` | 2026-08-25 | fix(ci): regenerate screen inventory counts |
| `73d20c7` | 2026-08-26 | chore: mark Evidence reconciliation base |
| `23f3c67` | 2026-08-26 | docs: define Evidence reconciliation checkpoint |
| `7d1ff3a` | 2026-08-26 | feat(evidence): add canonical provider-neutral Evidence runtime |
| `8e399da` | 2026-08-26 | fix(evidence): wire canonical retrieval into physician runtime |
| `3abc08c` | 2026-08-26 | chore(evidence): reconcile generated screen inventory with Consultorio |
| `1df239e` | 2026-08-26 | test(evidence): probar la intención del techo, no un literal que envejece ajeno |
| `a03c582` | 2026-08-26 | fix(laboratorio): la evidencia se vincula al paciente antes de persistir (REG-323, H-17 P0) |
| `c3706cc` | 2026-08-27 | fix(pacientes): no escribir un campo que el formulario no enseñó — REG-323 |
| `341e2a0` | 2026-08-27 | fix(pacientes): red secundaria — guardia de versión y un vaciado auditable |
| `35d8579` | 2026-08-27 | reconcile: defer generated/shared state for H-17 (agent-state/MASTER_STATE.json) |
| `3941f7f` | 2026-08-27 | reconcile: defer generated/shared state for H-17 (docs/audit/regression-ledger.md) |
| `241138b` | 2026-08-27 | reconcile: defer generated/shared state for H-17 (docs/data-room/INDICE.md) |
| `7166e0f` | 2026-08-27 | reconcile: defer generated/shared state for H-17 (docs/quality/FAMILIAS-DE-DEFECTO.md) |
| `6d0e459` | 2026-08-27 | reconcile: defer generated/shared state for H-17 (src/lib/calidad/familias-de-defecto.ts) |
| `ff55e14` | 2026-08-27 | reconcile: defer generated/shared state for H-17 (src/lib/clinical/invariantes-clinicos.json) |
| `2081703` | 2026-08-27 | rescue: restore WhatsApp without dropping H-17 or H-18 |
| `3b27bd6` | 2026-08-27 | rescue: restore physician prescription authority H-01 |
| `c4c69e4` | 2026-08-27 | rescue: restore consultation recovery H-03 through H-07 |
| `e43f0c4` | 2026-08-27 | rescue: restore reconciled REG-323 through REG-330 ledger |
| `58e8680` | 2026-08-27 | rescue: align derived REG state with ledger |
| `00e85f8` | 2026-08-27 | rescue: seal restored Consultorio regression goldens |
| `354b473` | 2026-08-27 | rescue: classify REG-324 through REG-330 by root cause |
| `4a79587` | 2026-08-27 | rescue: refresh defect-family derived counts |
| `f9f3a10` | 2026-08-27 | rescue: regenerate screen inventory counts for restored flows |
| `c21f874` | 2026-08-27 | rescue: refresh data-room figures from restored safety registry |
| `1eb1f03` | 2026-08-27 | a11y(paciente): compuerta WCAG 2.2 AA sobre las superficies del paciente (A11Y-GATE-001) |
| `156bed6` | 2026-08-27 | fix(portal): un error de revocación o de límite no es una autorización (PATIENT-PORTAL-001) |
| `891102d` | 2026-08-27 | fix(asr): la identidad del paciente nunca se vuelve vocabulario del consultorio (H-19) |
| `a58bade` | 2026-08-27 | ops(integracion): la integración se verifica ENTERA antes de publicarse |
| `9cd4727` | 2026-08-27 | reconcile: REG-331–334 únicos, clasificados por causa raíz, y derivados regenerados |
| `1937dbf` | 2026-08-27 | chore(sala-de-datos): el total de pruebas citado sale de la suite real (10 431), no de memoria |
| `fc7e1d2` | 2026-08-27 | chore(estado): tablero derivado sobre árbol limpio |
| `bac9b02` | 2026-08-27 | feat(postvisit): cerrar el post-visita del consultorio — firmar ≠ liberar (REG-335) |
| `ac6a4bc` | 2026-08-27 | fix(firma): nadie firma sin nombre, y el paciente recibe su hoja (REG-336) |
| `6aa97df` | 2026-08-28 | docs(estado): checkpoint de GP-FINAL — el consultorio ya se vio en un navegador |

---

## Apéndice B — los 33 merges

| SHA | Fecha | Asunto |
|---|---|---|
| `fa3939f` | 2026-08-08 | Merge pull request #262 from docrod29-ai/agent/v7/master-loop |
| `500df12` | 2026-08-08 | feat(v1150): el trabajo de V9 entra a la línea desplegada — la superficie del paciente |
| `4bca4c8` | 2026-08-08 | Merge pull request #263 from docrod29-ai/agent/v7/master-loop |
| `46055c6` | 2026-08-09 | merge: integra V9 de la otra sesión y renumera mis REG por colisión |
| `1742f0b` | 2026-08-08 | Merge pull request #268 from docrod29-ai/agent/v7/master-loop |
| `210847a` | 2026-08-08 | Merge pull request #269 from docrod29-ai/agent/v7/master-loop |
| `e32d582` | 2026-08-08 | Merge pull request #270 from docrod29-ai/agent/v7/master-loop |
| `0144257` | 2026-08-08 | Merge pull request #271 from docrod29-ai/agent/v7/master-loop |
| `bd67513` | 2026-08-09 | Merge pull request #277 from docrod29-ai/agent/v7/master-loop |
| `f4b3704` | 2026-08-09 | Merge pull request #278 from docrod29-ai/agent/v7/master-loop |
| `d088c34` | 2026-08-09 | merge: main (v1163) en la rama V9 — decisión V10-D1 del dueño |
| `84d55d2` | 2026-08-09 | merge: main (v1167) — segunda absorción; las REG de V9 quedan en 294…305 |
| `56d9fc7` | 2026-08-09 | Merge pull request #279 from docrod29-ai/claude/nexus-patient-ux-v9 |
| `2290b71` | 2026-08-09 | Merge remote-tracking branch 'origin/main' into claude/nexus-visual-excellence-v10 |
| `d4dcfcd` | 2026-08-09 | merge: la rama canónica V10 (HOME-001, orden del dueño) entra a la línea reconciliada |
| `70229b8` | 2026-08-09 | merge: la corrida paralela iurzog entra a la línea reconciliada — V10 vuelve a tener UNA verdad |
| `61bfac5` | 2026-08-09 | merge: REG-306 (v1168) de la rama canónica — el medidor del teléfono ya no dice 0 con la pantalla rota |
| `e797b49` | 2026-08-10 | merge: reconciliación 2 — la corrida nocturna (REG-307/308, v1169) entra a la línea V10 unificada |
| `9f040b8` | 2026-08-09 | consolidación: dos líneas paralelas vuelven a ser una (v1170) |
| `4a233e7` | 2026-08-09 | Merge pull request #289 from docrod29-ai/consolidacion/2026-08-10 |
| `688106e` | 2026-08-09 | Merge pull request #290 from docrod29-ai/v10/identidad-acento |
| `b30c971` | 2026-08-17 | deploy: V15 accepted preview |
| `4ea4cc3` | 2026-08-21 | infra: add n8n Cloud autopilot variant |
| `d0ab6a7` | 2026-08-22 | Merge pull request #344 from docrod29-ai/infra/codex-run-correlation-fix |
| `7e1f7e3` | 2026-08-23 | infra: recover Codex verdicts from every judge transport |
| `144fd4e` | 2026-08-23 | infra: parallelize independent Codex verdict recovery |
| `25af0c9` | 2026-08-24 | Merge 8efba5f593d582ff935c46f145c9d8209d443b8e into ce5b10c4aea1c914f51729f0019dab572ea59441 |
| `8013fcf` | 2026-08-26 | release: integrate Consultorio candidate into main |
| `c22f3e2` | 2026-08-26 | merge: reconcile Evidence runtime onto current Consultorio base |
| `3bec846` | 2026-08-26 | release: reconcile Evidence runtime onto current Consultorio base (#369) |
| `d508a9f` | 2026-08-27 | integrate: H-18 patient editor safeguards |
| `ac95ca1` | 2026-08-27 | integrate: H-17 laboratory patient binding |
| `f4ee921` | 2026-08-27 | Merge pull request #383 from docrod29-ai/release/consultorio-final-candidate-2026-08-27 |


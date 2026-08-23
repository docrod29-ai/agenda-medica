# Matriz de inyección de fallos

**Carril:** #310. **Ejecutable:** `scripts/load/escenarios.mjs` (`PERFILES_DE_FALLO`) ·
golden: `src/__tests__/arnes-carga-consultorio.test.ts`.

Cada fila responde siempre las mismas cuatro preguntas —**qué se conserva, qué se
reintenta, qué se degrada, qué se bloquea**— y ninguna puede bloquear sin justificación
clínica escrita. La tabla de modos limitados vive en código
(`src/lib/reliability/degradacion.ts`) precisamente para que una prueba pueda recorrerla.

Determinismo: los perfiles usan un generador con semilla. Misma semilla, mismos fallos en
los mismos sitios. Un arnés de fallos que no se puede repetir no sirve para una regresión —
el día que encuentre algo, no se podrá volver a encontrar.

---

## Matriz

| # | Fallo inyectado | Se conserva | Se reintenta | Se degrada | Se bloquea | Cómo se ejercita hoy |
|---|---|---|---|---|---|---|
| F1 | Proveedor de IA 503 | transcripción, borrador, audio, medicación confirmada | estructuración, razonamiento | redacción asistida, sugerencias | nada | `--fallo=ia-caida` ✔ |
| F2 | Proveedor de IA sin responder (timeout) | ídem F1 | ídem F1 | ídem F1 | nada | `--fallo=ia-timeout` ✔ |
| F3 | Proveedor 429 (saturación) | todo | con retroceso ×4 y jitter | latencia de IA | nada | `--fallo=saturacion-proveedor` ✔ |
| F4 | Evidencia caída | nota, plan, medicación | búsqueda de evidencia | citas bibliográficas | nada | `--fallo=evidencia-caida` ✔ |
| F5 | Transcripción caída | audio en IndexedDB, texto ya transcrito, lo escrito a mano | fragmentos pendientes | dictado en vivo | nada | `--fallo=transcripcion-caida` ✔ |
| F6 | Respuesta perdida **tras** el commit | el efecto ya escrito | el cliente reintenta con la misma llave | nada | nada | `--fallo=red-intermitente` ✔ |
| F7 | Entrega duplicada de la cola | — | — | nada | nada (la 2.ª se rechaza) | `--fallo=entrega-duplicada` ✔ |
| F8 | Resultado que vuelve caduco | verdad clínica confirmada/firmada | nada (se descarta) | esa sugerencia | nada | `--fallo=resultado-caduco` ✔ |
| F9 | Almacenamiento transitorio rechaza | borrador local (localStorage/IndexedDB) | autoguardado a la nube | sincronización entre dispositivos | nada | `--fallo=almacenamiento-transitorio` ✔ |
| F10 | WhatsApp caído | la cita canónica | envío del recordatorio | confirmación por mensaje | nada | contrato en `degradacion.ts` ✔ · sin escenario de carga |
| F11 | Notificación falla | la cita y su cambio de estado | el aviso | aviso al paciente | nada | contrato ✔ · sin escenario |
| F12 | Excepción de componente secundario | el resto de la pantalla | montaje del componente | ese panel | nada | contrato ✔ · **falta prueba de componente** (ver `NO-WHITE-SCREEN-INVENTORY.md` §3) |
| F13 | Recarga del navegador | último punto durable | reanudar | nada | nada | **PREPARADO** — necesita E2E |
| F14 | Reconexión tras corte | ídem F13 | subida de lo local | indicador de nube | nada | **PREPARADO** — necesita E2E |
| F15 | Reproducción de webhook | — | — | nada | nada | ya resuelto para WhatsApp (`whatsapp/dedup.ts`) ✔ |
| F16 | Llave de IA revocada (401) | todo | **nada: un 401 no mejora repitiéndolo** | funciones de IA | nada | `veredictoDeHttp` ✔ · `fallo-proveedor.ts` redacta el aviso ✔ |
| F17 | Nota que llega al tope de 1 MB | contenido en respaldo local | — | autoguardado a la nube | nada | guardián existente ✔ · sin escenario de carga |

**Ninguna fila bloquea.** Es una propiedad comprobada, no una casualidad:
`modosQueBloquean()` devuelve lista vacía y hay un golden que falla si deja de hacerlo.

El único bloqueo legítimo de todo el producto es `hot:firmar-nota` cuando no se puede
sellar — decir «firmado» sin que lo esté es una mentira medicolegal, no una degradación.

## Lo que cada fila con ✔ demuestra hoy, exactamente

Que **el modelo** se comporta así con el controlador simulado del arnés. No que la
aplicación se comporte así: el arnés simulado no toca Next.js, ni Firestore, ni la red.
Cada resultado lo declara en su campo `evidenceClass: "harness-only"`.

Es el paso anterior a medir, y es el único disponible sin un entorno dimensionado. Lo que
sí demuestra de verdad —y no es poco— es que las invariantes están **escritas, ejecutables y
reproducibles**, en vez de ser una frase con la que todo el mundo está de acuerdo.

## Lo que falta para subir de clase de evidencia

| Fila | Qué haría falta |
|---|---|
| F13, F14 | Playwright con corte de red y recarga contra un objetivo local |
| F12 | entorno DOM en vitest (jsdom) o proyecto de pruebas de componente aparte |
| F10, F11, F17 | escenarios de carga con esas colas; el contrato ya está |
| todas | controlador `http` del arnés + entorno dimensionado → ver `CAPACITY-REPORT.md` |

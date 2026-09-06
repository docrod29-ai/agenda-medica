# Bitácora de reparación — SEGURIDAD

Rebanada de reglas de Firestore, autorización, aislamiento entre consultorios y
privacidad. **28 hallazgos en la lista.**

## Nota sobre cómo se cerró esta rebanada

El agente de esta rebanada escribió los 48 ficheros y **murió antes de commitear
y antes de dejar su informe** (se llevó por delante la sesión el límite de uso).
Al recogerla, el orquestador se encontró con **nueve pruebas de las suyas en
rojo**, y esas nueve son la parte más útil de esta bitácora: siete de ellas no
eran defectos del producto sino **guardianes que no podían ver lo que vigilaban**.

Queda escrito porque es exactamente la lección de `testing-gates.md` —«una
prueba que no puede fallar no es una prueba»— cazada en vivo:

| Guardián | Por qué no veía nada | Qué se hizo |
|---|---|---|
| `las-colecciones-congelan-su-forma` | El lector de rutas arrastraba el `match /databases/{database}/documents` de fuera, así que **ninguna** ruta casaba: la mitad de sus casos pasaba por vacío y la otra mitad gritaba de más | Se le quita el prefijo. Al hacerlo, siete colecciones resultaron ya congeladas y **el trinquete bajó de 27 a 20** |
| `las-colecciones-raiz-que-escribe-el-servidor` | Filtraba `startsWith('clinics/')` para saltarse las subcolecciones y con eso se saltaba también `clinics/{clinicId}`, la colección más escrita del producto, que quedaba declarada huérfana | Se filtran las subcolecciones por número de segmentos, no por prefijo |
| `las-reglas-del-panel-de-lujo` | El `[^)]*` de sus expresiones regulares no puede cruzar el paréntesis de `$(database)`: la regla estaba bien escrita y el guardián no la encontraba nunca | La ruta se compara literal |
| `whatsapp-quien-inicia-y-por-donde-sale` | Sólo miraba el `import` estático, así que `public/booking` y `avisar-consultorio` —que cargan el módulo con `await import(...)`— eran **dos llamadores reales invisibles para el censo** | El detector mira los dos caminos. Los dos siguen en PENDIENTES, que es la verdad |
| `invitaciones-caducan-y-tienen-autor` | Exigía que `invitations.ts` no contuviera `Math.random` y miraba el fichero entero: el comentario que explica **por qué no se usa** ponía la prueba en rojo y empujaba a borrar la explicación | Se quitan los comentarios antes de mirar el código |
| `el-chat-no-firma-por-otro` | `vi.spyOn` sobre `firebase/firestore`: el espacio de nombres ESM no es configurable y lanzaba «Cannot redefine property» | `vi.mock`, como el resto de la suite |
| `authz-rutas-declaradas` | Dos de los cuatro conteos del analizador no se subieron al añadir `arco/ligar` | Subidos con su motivo escrito al lado |

Los otros dos rojos sí eran trabajo que faltaba: el evento `arco_solicitud_ligada`
no estaba en el tipo de la bitácora (la pantalla de cumplimiento lo habría
enseñado con su nombre interno) y `pruebas_estrenadas` no tenía decidida su
retención.

## Lo que se reparó

| ID | Área | Incidente | Estado |
|----|------|-----------|--------|
| S-001 | Reglas (P1) | `arcoBloqueo` y `portalTokenVersion` se podían deshacer desde el navegador: quitarle a un paciente el bloqueo ARCO, o bajar la versión del token para revivir un enlace de portal ya revocado | CLOSED |
| S-007 · ASC-002 · ASC-003 | Reglas (P1) | La cita se marcaba pagada desde el navegador con un `cobroId` inventado, y «sobreagendada» sin que lo decidiera el servidor | CLOSED |
| S-008 · S-009 | Reglas (P2) | Reseñas y membresías sin forma congelada | CLOSED |
| S-010 | Reglas · matriz (P1) | Quince colecciones raíz que escribe el Admin SDK no tenían `match` propio ni entrada en la matriz: invisibles para los tres sitios de `security-tenant.md` a la vez | CLOSED |
| S-012 | Reglas (P1) | Doce colecciones aceptaban cualquier campo con cualquier valor, y **no existía ningún guardián que mirara** si la regla de forma congelada se cumplía | CLOSED |
| ZL-011 | Invitaciones (P3) | La invitación de equipo nacía sin caducidad, sin autor atado al uid y con el código salido de `Math.random` | CLOSED |
| ZL-012 | Chat (P2) | El mensaje llevaba dentro el nombre y el rol de quien decía ser; al leer se creía al documento y no a la membresía | CLOSED |
| ZL-015 | Reglas (P2) | El rol del dueño del consultorio lo podía cambiar otro miembro | CLOSED |
| ASE-010 | ARCO (P2) | Una solicitud ARCO llegada por el portal no tenía camino técnico para atarse a un expediente identificado; se resolvía a ojo | CLOSED — ruta `arco/ligar` con su evento de bitácora |
| ASE-017 | Respaldo (P2) | `googleTokens` tenía regla y no estaba en el manifiesto del respaldo, ni incluida ni excluida: tras restaurar, cada médico amanecía sin calendario y el acta no lo decía | CLOSED |
| ASM-009 · N-025 | WhatsApp (P2) | No se declaraba quién inicia el mensaje (ventana de 24 h) ni por qué vía sale | CLOSED — con su censo, que **sólo puede bajar** |
| N-007 | Prueba de 14 días (P2) | La prueba se podía estrenar más de una vez con otro correo | CLOSED — huella sin el correo |
| C-035 · PC-014 | Errores (P3) | Rutas que devolvían el error crudo del proveedor, con lo que arrastrara dentro | CLOSED |
| ZC-010 | Meta Pixel (P3) | El píxel cargaba sin estar declarado en el aviso de privacidad | CLOSED |
| S-011 | robots.txt (P3) | Prohibía rutas que no existen y dejaba fuera otras que sí | CLOSED |
| ASE-013…016 · ASE-024 · ASN-004 · MP-014 · S-002 · S-003 · S-004 | Varios (P2-P3) | Soporte que guardaba sin redactar, cierre de sesión que no purgaba IndexedDB sin consulta abierta, alergias escritas por recepción, menor sin responsable, índice de canales que llevaba la llave dentro | CLOSED |

## Lo que NO rige todavía

**Las reglas escritas no son las que rigen.** `firestore.rules` creció 339
líneas y **nada de eso protege producción** hasta que se ejecute el paso
`FIRESTORE_RULES` del botón de despliegue: `vercel --prod` no publica este
archivo. Qué no rige y qué se rompe mientras tanto está declarado, fila por fila,
en `docs/ops/REGLAS-DE-FIRESTORE.md` bajo «PENDIENTE DE DESPLIEGUE» — y hay un
guardián que exige que esa lista esté escrita mientras el hash no coincida, y
vacía cuando sí.

Lo que **sí** rige hoy: el aislamiento entre consultorios. El equipo rojo lo
probó contra el emulador con las reglas de producción y los 13 ataques fueron
denegados.

## Decisiones aplicadas por omisión, con el valor seguro

| Hallazgo | Decisión | Por qué es la segura |
|---|---|---|
| `pruebas_estrenadas` | No se barre nunca | Barrerla por antigüedad le devolvería la prueba gratis a quien ya la usó, y antes que a nadie a quien lleve más tiempo esperando. No lleva el correo, sólo su huella: no hay nada que minimizar |
| Las siete colecciones que salieron de EXENTAS | Se quitan de la lista, no se añade ninguna | El trinquete sólo baja. Ya congelaban su forma; sólo seguían en la lista porque el guardián estaba ciego |
| Los dos llamadores de WhatsApp recién descubiertos | Se quedan en PENDIENTES | Migrarlos es de AGENDA-MENSAJERIA. Sacarlos del censo para poner verde la prueba sería esconderlos |

# Registro de auditoría — NexusMED

Bitácora del loop maestro de auditoría por módulos. Un módulo se cierra cuando todos
sus agentes han corrido y sus hallazgos están reparados, diferidos con motivo, o
elevados al médico por ser decisiones suyas y no de código.

Regla de este registro: **se escribe lo que se verificó, no lo que se intentó.** Si algo
quedó sin comprobar en producción, se dice.

---

## Módulo 0 — Núcleo · CERRADO 2026-07-19

Superficie: layout del panel, contextos (clínica, modo, toast), hooks de sesión y
configuración, `firestore.rules`, alta y unión de consultorios, cierre de sesión,
service worker.

Agentes: Bugs · Seguridad · Rendimiento · Normativa · Integridad de datos.

### Reparado y desplegado

| Ver | Hallazgo | Por qué importaba |
|---|---|---|
| v460 | `websocket-driver` ≤0.7.4 (crítica) | Llegaba por `@firebase/database`, que la app no usa. Salto de parche, sin romper nada. |
| v460 | Dos 404 después de pagar | El portal de facturación volvía a `/dashboard/configuracion` y la recarga a `/consulta`; ambas inexistentes. Verificado contra producción. |
| v461 | `useAppointments` sin `where` ni `limit` | **Causa real de la lentitud.** Suscrito a todas las citas de la clínica, montado en toda pantalla del panel. Se degradaba solo conforme crecía la agenda. |
| v461 | Borrador ilegible al cerrar sesión | El flush del desmonte reescribía con la clave equivocada tras `signOut`. PHI en disco **e** irrecuperable, con el modal diciendo "a salvo". |
| v461 | Firma del médico sustituible por recepción | `config/main` con `write: if isMember`. Ataque de suplantación, no solo de robo. |
| v461 | `/api/superadmin/*` sin `email_verified` | Trampa armada para el día que se añada un correo nuevo a `SUPERADMIN_EMAILS`. |
| v462 | Pantalla en blanco sin salida | `return null` cuando Firestore no responde: ni spinner, ni error, ni logout. |
| v462 | Receta impresa con formato por defecto | Sin membrete, firma ni cédula, y sin avisar. Documento inválido para NOM-004. |
| v462 | 0 % de cobertura en `auth-server`, `superadmin`, `rate-limit` | Única frontera de las API routes, que saltan las reglas de Firestore. |
| **v463** | **Regresión propia de v461** | Al bloquear la firma por campo, la segunda rama del `\|\|` quedó **sin `isMember`**: cualquier cuenta podía sobrescribir la config de cualquier consultorio. Cerrar un hueco abrió uno mayor. Hay test guardián. |
| v463 | Consulta dictada perdida | El autoguardado condicionaba en `resumen \|\| secciones`, vacíos mientras se dicta. Y dictar no cuenta como actividad → cierre por inactividad → purga de la única copia. |
| v463 | Proxy de imágenes: caché compartida y SSRF | `cache-control: public` sobre la firma del médico; el chequeo de bucket se satisfacía con la cadena en la query. |
| v463 | `permisosPorRol(null)` → ADMIN | El comentario decía "defaults seguros". |
| v464 | Bitácora forjable | Se escribía desde el navegador, con reloj del navegador y `create: if isMember` sin validar campos. Ahora servidor + `serverTimestamp`. |
| v464 | Aviso de privacidad falso | Prometía "control de acceso multi-factor"; el MFA está `planned` y BLOCKED. El responsable ante el INAI es el médico. |
| v464 | Consentimiento "verbal" | Art. 9 LFPDPPP exige por escrito para datos sensibles. |
| v465 | Paciente duplicado por caché de 30 s | Historial clínico partido en dos expedientes. No se ve como error: se ve como paciente nuevo. |
| v465 | Sesiones de WhatsApp duplicadas | Dos mensajes seguidos → dos documentos → la conversación saltaba entre ellos. |
| v465 | Alta de consultorio no atómica | Dos pestañas en `/setup` → dos consultorios, uno huérfano y facturable. |

### Diferido con motivo

- **10 vulnerabilidades moderadas** en la cadena de `firebase-admin`. Solo se resuelven con
  `npm audit fix --force`, que es rompiente sobre el Admin SDK en producción.
- **Token firmado para el proxy de imágenes.** Es la solución de fondo a que la firma del
  médico viva tras una URL sin sesión. Toca el camino de impresión: va aparte y con prueba
  real, no de pasada.
- **Separar los campos clínicos del documento `patients`.** `alergias`, `curp`, `notas` y la
  valoración del inmunocomprometido son legibles por roles no clínicos. Requiere migración.

### Elevado al médico — no es decisión de código

1. **El modal de aviso de privacidad no está conectado a nada.** Cero llamadores en todo el
   repo. En consulta no se captura el consentimiento LFPDPPP de ningún paciente. Falta
   decidir dónde aparece: alta del paciente, primera apertura del expediente, o recepción.
2. Numerales "NOM-024 Art. 6.4 / 6.5" citados en el código **sin verificar contra el DOF**.
   El requisito de trazabilidad es real; la numeración no está comprobada.

### No verificado

Ninguna reparación se probó con una sesión real del médico. Se verificó: `tsc`, la suite de
tests, `next build`, las respuestas HTTP de producción y el despliegue de reglas. **No** se
abrió un paciente ni se imprimió una receta.

---

## Módulo 1 — Consulta y Expediente Clínico · EN CURSO

Superficie: dictado, generación de la nota por IA, firma, adendas, versiones, las 11 rutas
de `api/expediente`.

Agentes lanzados: IA clínica · Bugs · Seguridad · Integridad de datos.

# Runbooks de incidente

> **Generado** por `scripts/incidents/generar-contratos.mjs` desde
> `src/lib/incidents/runbooks.ts`. No se edita a mano: una guía escrita aparte
> del código dice «reintentar 5 veces» mientras el código reintenta 3.

Cada runbook declara **cómo se verifica** que se arregló. Sin ese paso,
«se reintentó» se lee como «se arregló», y así es como un incidente se cierra
estando vivo.

## RB-IA-SALDO — La cuenta del proveedor de IA se quedó sin saldo

- **Detecta:** categoría `ai_provider` · subtipos `sin_saldo`
- **Acciones automáticas permitidas:** **ninguna**
- **Prohibidas explícitamente:** `recargar_saldo_de_proveedor`, `rotar_llave_de_proveedor`
- **Qué hace el dueño:** Recargar saldo en el proveedor y activar la recarga automática. REQUIERE GASTO: no lo hace el sistema.
- **Qué ve el médico:** «El servicio de IA está fuera por un problema nuestro. Tu dictado está guardado.»
- **¿Ofrecer reintentar?** no
- **Verificación:** Una llamada de prueba al proveedor devuelve 200 y la clase de fallo deja de aparecer en la ventana siguiente.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-IA-LLAVE — La llave del proveedor de IA fue rechazada

- **Detecta:** categoría `ai_provider` · subtipos `llave_invalida`
- **Acciones automáticas permitidas:** **ninguna**
- **Prohibidas explícitamente:** `rotar_llave_de_proveedor`
- **Qué hace el dueño:** Si es la llave de la PLATAFORMA: generar una nueva y actualizar la variable de entorno en el hosting. Si es la del CONSULTORIO: el médico la actualiza en Configuración → Llaves de IA, y eso ya se le dijo en su pantalla.
- **Qué ve el médico:** «El servicio de IA no está disponible. Tu dictado está guardado.»
- **¿Ofrecer reintentar?** no
- **Verificación:** Una llamada de prueba con la llave nueva devuelve 200.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-IA-SOBRECARGA — El proveedor de IA está saturado o limitando la tasa

- **Detecta:** categoría `ai_provider` · subtipos `sobrecarga`, `limite_tasa`, `timeout`
- **Acciones automáticas permitidas:** `reintento_idempotente`, `respaldo_de_proveedor_autorizado`
- **Prohibidas explícitamente:** `recargar_saldo_de_proveedor`, `desplegar_correccion`
- **Qué hace el dueño:** Sólo si se repite: pedir subir el límite de tasa o subir de tier. REQUIERE GASTO cuando implica cambiar de plan.
- **Qué ve el médico:** «La IA va lenta ahora mismo. Tu dictado está guardado y puedes seguir escribiendo.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** La tasa de la firma vuelve por debajo de la línea base durante una ventana completa.
- **Rollback:** Volver al proveedor primario en cuanto responda: el respaldo es temporal, no un cambio de proveedor.

## RB-NOTIF-WHATSAPP — La notificación al paciente no salió, pero la cita sí quedó

- **Detecta:** categoría `notification` (toda la categoría)
- **Acciones automáticas permitidas:** `reintentar_notificacion`, `reencolar_trabajo_diferido`
- **Prohibidas explícitamente:** `borrar_encuentro`, `reembolsar_cobro`
- **Qué hace el dueño:** Si se repite en muchos consultorios, revisar el estado del proveedor de WhatsApp.
- **Qué ve el médico:** «La cita quedó guardada; sólo falló el mensaje al paciente.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** El registro de no entregados de ese consultorio deja de crecer y el reintento sale con acuse.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-AUTOSAVE — El autoguardado dejó de guardar

- **Detecta:** categoría `autosave` (toda la categoría)
- **Acciones automáticas permitidas:** `reintento_idempotente`, `reconectar`
- **Prohibidas explícitamente:** `borrar_encuentro`, `editar_nota_firmada`
- **Qué hace el dueño:** Si afecta a varios consultorios a la vez, mirar la persistencia antes que la pantalla.
- **Qué ve el médico:** «ATENCIÓN: el guardado automático no está funcionando. Guarda a mano y no cierres la pestaña.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** Un guardado de prueba vuelve con acuse del servidor y el documento existe al releerlo.
- **Rollback:** Ninguno: el reintento de guardado es idempotente sobre el mismo documento.

## RB-AISLAMIENTO — Se detectó una violación de aislamiento entre consultorios

- **Detecta:** categoría `tenant_isolation` (toda la categoría)
- **Acciones automáticas permitidas:** **ninguna**
- **Prohibidas explícitamente:** `copiar_datos_entre_consultorios`, `cambiar_permisos`, `borrar_encuentro`
- **Qué hace el dueño:** Contener y auditar: identificar la ruta, revisar la bitácora de ese consultorio y no cerrar el incidente hasta tener prueba de regresión. Un evento basta.
- **Qué ve el médico:** «La operación se detuvo por una comprobación de seguridad. No se escribió nada.»
- **¿Ofrecer reintentar?** no
- **Verificación:** Una prueba adversarial reproduce el acceso cruzado y falla ANTES del arreglo; después, no.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-PERSISTENCIA — Escritura rechazada o no confirmada en la base

- **Detecta:** categoría `persistence` (toda la categoría)
- **Acciones automáticas permitidas:** `reintento_idempotente`
- **Prohibidas explícitamente:** `borrar_encuentro`, `cambiar_permisos`
- **Qué hace el dueño:** Si el rechazo es de reglas y no transitorio, es un defecto de autorización: no se reintenta, se repara.
- **Qué ve el médico:** «No pude confirmar el guardado. Tu texto sigue en pantalla: compruébalo antes de cerrar.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** Releer el documento y comprobar que el contenido esperado está escrito. Contrato: no basta con que la escritura no lance.
- **Rollback:** Ninguno: el reintento va con clave de idempotencia sobre el mismo documento.

## RB-AGENDA — La operación de agenda no se pudo completar

- **Detecta:** categoría `scheduling` (toda la categoría)
- **Acciones automáticas permitidas:** `reintento_idempotente`
- **Prohibidas explícitamente:** `borrar_encuentro`, `copiar_datos_entre_consultorios`
- **Qué hace el dueño:** Si el choque es real, lo resuelve el consultorio eligiendo otro hueco. No es un fallo que se repare solo.
- **Qué ve el médico:** «La agenda no cambió. Vuelve a intentarlo; si el hueco se ocupó, elige otro.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** La cita existe una sola vez y con el estado esperado tras releer la agenda del día.
- **Rollback:** Ninguno: la reserva va en transacción, o entra entera o no entra.

## RB-EVIDENCIA — La consulta de evidencia no respondió

- **Detecta:** categoría `evidence` (toda la categoría)
- **Acciones automáticas permitidas:** `reintento_idempotente`, `respaldo_de_proveedor_autorizado`, `invalidar_cache_caduca`
- **Prohibidas explícitamente:** `editar_nota_firmada`, `aceptar_diagnostico_sugerido`
- **Qué hace el dueño:** Ninguna mientras sea del proveedor. Si dura, revisar su estado.
- **Qué ve el médico:** «No pude consultar evidencia ahora. Tu nota sigue editable.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** Una consulta de prueba devuelve resultados con su fuente citada.
- **Rollback:** Volver al proveedor primario cuando responda.

## RB-UI — Un componente de la pantalla lanza y se lleva su zona por delante

- **Detecta:** categoría `ui` (toda la categoría)
- **Acciones automáticas permitidas:** `reiniciar_estado_de_cliente`, `invalidar_cache_caduca`
- **Prohibidas explícitamente:** `editar_nota_firmada`, `borrar_encuentro`
- **Qué hace el dueño:** Si el componente es el mismo en varios consultorios, es un defecto de despliegue: mirar la versión.
- **Qué ve el médico:** «Esta parte no se pudo mostrar. El resto de la consulta sigue funcionando.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** El componente vuelve a montar sin lanzar y el resto de la pantalla nunca dejó de estar en pie.
- **Rollback:** Ninguno: reiniciar estado de cliente no escribe nada.

## RB-RED — Se perdió la conexión

- **Detecta:** categoría `network` (toda la categoría)
- **Acciones automáticas permitidas:** `reintento_idempotente`, `reconectar`
- **Prohibidas explícitamente:** `borrar_encuentro`, `reembolsar_cobro`
- **Qué hace el dueño:** Ninguna mientras sea de la red del consultorio. Si es masivo y simultáneo, mirar el hosting.
- **Qué ve el médico:** «Se perdió la conexión. Tu trabajo sigue en este dispositivo y se enviará al volver.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** Una petición de prueba vuelve con 200 y la cola local se vacía.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-TRANSCRIPCION — La transcripción del dictado no salió

- **Detecta:** categoría `transcription` (toda la categoría)
- **Acciones automáticas permitidas:** `reintento_idempotente`, `respaldo_de_proveedor_autorizado`, `reabrir_flujo_no_destructivo`
- **Prohibidas explícitamente:** `borrar_encuentro`, `editar_nota_firmada`
- **Qué hace el dueño:** Si falla el motor de diarización y el de respaldo a la vez, es del proveedor: revisar su estado.
- **Qué ve el médico:** «No pude transcribir el audio ahora. El audio está guardado y se puede repetir sobre el mismo material.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** Una transcripción de prueba devuelve texto y el audio crudo sigue en su sitio.
- **Rollback:** Volver al motor primario cuando responda.

## RB-RAZONAMIENTO — La IA no pudo redactar la nota

- **Detecta:** categoría `ai_reasoning` (toda la categoría)
- **Acciones automáticas permitidas:** `reintento_idempotente`
- **Prohibidas explícitamente:** `aceptar_diagnostico_sugerido`, `editar_nota_firmada`, `editar_receta`
- **Qué hace el dueño:** Si se repite en una función concreta, mirar el prompt y el modelo de esa función antes que el proveedor.
- **Qué ve el médico:** «No pude redactar la nota ahora. Tu nota sigue editable y guardada.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** Una redacción de prueba devuelve texto con su procedencia y sin cifras inventadas.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-PAGO — El cobro quedó en un estado que no se pudo confirmar

- **Detecta:** categoría `payment` (toda la categoría)
- **Acciones automáticas permitidas:** **ninguna**
- **Prohibidas explícitamente:** `reembolsar_cobro`, `reintento_idempotente`
- **Qué hace el dueño:** Conciliar contra el proveedor de pagos ANTES de tocar nada. Si hubo cargo doble, devolverlo a mano.
- **Qué ve el médico:** «No pude confirmar el cobro. No vuelvas a cobrar sin comprobar antes si el cargo salió.»
- **¿Ofrecer reintentar?** no
- **Verificación:** El estado del cargo en el proveedor coincide con el guardado, y hay exactamente uno.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-SESION — La sesión del usuario caducó o fue rechazada

- **Detecta:** categoría `auth` (toda la categoría)
- **Acciones automáticas permitidas:** **ninguna**
- **Prohibidas explícitamente:** `cambiar_permisos`, `rotar_llave_de_proveedor`
- **Qué hace el dueño:** Si caducan muchas sesiones a la vez, mirar el reloj del servidor y la vida del token antes que al usuario.
- **Qué ve el médico:** «Tu sesión caducó. Vuelve a entrar; nada de lo tuyo se ha perdido.»
- **¿Ofrecer reintentar?** no
- **Verificación:** Un inicio de sesión de prueba devuelve un token válido con la vida esperada.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-AUTORIZACION — Una acción se detuvo por falta de permiso

- **Detecta:** categoría `authorization` (toda la categoría)
- **Acciones automáticas permitidas:** **ninguna**
- **Prohibidas explícitamente:** `cambiar_permisos`, `copiar_datos_entre_consultorios`
- **Qué hace el dueño:** Decidir si es un permiso mal puesto (lo arregla quien administra el consultorio) o un defecto de la ruta (lo arregla el código). Nunca ampliar permisos para que pase.
- **Qué ve el médico:** «Esta acción no está permitida con tu perfil. No se cambió ningún dato.»
- **¿Ofrecer reintentar?** no
- **Verificación:** La misma acción con el perfil correcto pasa, y con el perfil de antes sigue sin pasar.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-NAVEGADOR — Algo falló en el navegador del médico

- **Detecta:** categoría `browser_runtime` (toda la categoría)
- **Acciones automáticas permitidas:** `reiniciar_estado_de_cliente`, `invalidar_cache_caduca`
- **Prohibidas explícitamente:** `borrar_encuentro`
- **Qué hace el dueño:** Si se concentra en una versión de navegador, es compatibilidad y no una caída.
- **Qué ve el médico:** «Algo falló en el navegador. Recarga la página; tu nota está guardada en este dispositivo.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** La pantalla vuelve a montar y el borrador local sigue completo tras recargar.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## RB-API — Una ruta de API no completó la acción

- **Detecta:** categoría `api` (toda la categoría)
- **Acciones automáticas permitidas:** `reintento_idempotente`
- **Prohibidas explícitamente:** `cambiar_permisos`, `desplegar_correccion`
- **Qué hace el dueño:** Distinguir 5xx (nuestro) de 4xx repetido (contrato roto entre cliente y ruta).
- **Qué ve el médico:** «No pude completar esta acción. Lo que ya estaba guardado sigue guardado.»
- **¿Ofrecer reintentar?** sí
- **Verificación:** La misma petición vuelve con 2xx y el efecto esperado está escrito al releer.
- **Rollback:** Ninguno: el reintento va con clave de idempotencia.

## RB-DESCONOCIDO — Error repetido que todavía no está clasificado

- **Detecta:** categoría `unknown` (toda la categoría)
- **Acciones automáticas permitidas:** **ninguna**
- **Prohibidas explícitamente:** `desplegar_correccion`
- **Qué hace el dueño:** Clasificarlo. Un incidente sin categoría no tiene runbook y por eso no puede repararse solo.
- **Qué ve el médico:** «Algo falló y todavía no sé qué. Comprueba el estado antes de repetir la acción.»
- **¿Ofrecer reintentar?** no
- **Verificación:** Existe una categoría y un subtipo para esta firma, y el runbook que le toca.
- **Rollback:** _no aplica: no hubo nada que deshacer._

## Dimensiones por categoría

| Categoría | Severidad | Reintento | Reversibilidad | Idempotencia | Impacto | Dueño |
|---|---|---|---|---|---|---|
| `ui` | sev3 | inmediato | reversible | no_aplica | degradado | plataforma |
| `api` | sev3 | tras_espera | desconocida | requerida | bloquea_tarea | plataforma |
| `auth` | sev2 | nunca | irreversible | no_aplica | bloquea_tarea | plataforma |
| `authorization` | sev2 | nunca | irreversible | no_aplica | bloquea_tarea | plataforma |
| `tenant_isolation` | sev1 | nunca | irreversible | no_aplica | riesgo_clinico | plataforma |
| `persistence` | sev2 | tras_espera | desconocida | requerida | riesgo_de_perdida | plataforma |
| `autosave` | sev2 | inmediato | reversible | requerida | riesgo_de_perdida | plataforma |
| `scheduling` | sev2 | tras_espera | desconocida | requerida | bloquea_tarea | plataforma |
| `transcription` | sev2 | tras_espera | reversible | garantizada | degradado | proveedor |
| `ai_provider` | sev2 | tras_espera | reversible | garantizada | degradado | proveedor |
| `ai_reasoning` | sev3 | tras_espera | reversible | garantizada | degradado | plataforma |
| `evidence` | sev3 | tras_espera | reversible | garantizada | degradado | proveedor |
| `payment` | sev2 | nunca | irreversible | requerida | degradado | plataforma |
| `notification` | sev3 | tras_espera | reversible | requerida | degradado | proveedor |
| `network` | sev4 | inmediato | reversible | requerida | degradado | plataforma |
| `browser_runtime` | sev3 | inmediato | reversible | no_aplica | degradado | plataforma |
| `unknown` | sev3 | tras_espera | desconocida | requerida | bloquea_tarea | plataforma |

Estas son el **suelo**, no el techo: quien reporta puede endurecer la
severidad y nunca ablandarla. Si pudiera ablandarla, bastaría con que un
llamador dijera `sev4` para que un incidente de aislamiento dejara de
despertar a nadie.

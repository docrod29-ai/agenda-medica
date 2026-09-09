# Ausculta — decisiones del dueño, 9 septiembre 2026

Fuente: entrevista explícita en esta conversación. Prevalece sobre defaults
anteriores. No implica que estas capacidades estén implementadas o verificadas.

- Mejorar sobre lo existente, preservar funciones útiles. Identidad propia,
  interacción profesional, animaciones con propósito. No prometer cero errores
  ni superioridad competitiva sin medición. Trabajo Astra, razonamiento medio.
- Practice para médico con asistente y varios médicos con recepción compartida.
- Cada médico ve sus pacientes; compartir expediente exige autorización explícita.
- Consulta completa en computadora, tableta y teléfono.
- Tema CLARO por defecto (cambia la preferencia previa de oscuro); seleccionable.
- Computadora: resumen, nota y asistente visibles simultáneamente.
- Al abrir: problemas activos, medicamentos, alergias, última nota, pendientes,
  estudios/tendencias, motivo y captura disponibles con jerarquía clara.
- Captura: conversación ambiental, dictado, texto pegado/escrito y documentos
  combinados dentro del mismo encuentro.
- IA durante consulta: sugerencias discretas desplegables; conclusión breve,
  conducta propuesta, fundamento ampliable. Médico acepta antes de incorporar.
- Antecedentes son contexto del análisis; NO incorporarlos a la nota automáticamente.
- Ambigüedad crítica de medicamento/dosis/unidad: aclaración en el momento.
- Investigar datos inventados/negaciones no dictadas en transcripción,
  estructuración, regeneración y recuperación. Posible mezcla de pacientes sin
  secuencia identificada: pendiente confirmar, nunca asumir aislada por tests parciales.
- Cierre: revisar nota primero; receta y órdenes después juntas.
- Recuperación: cambiar paciente sin perder borrador; continuar en otro dispositivo;
  escribir sin internet y sincronizar; detectar conflictos; firma diferida.
- Agenda: duración por tipo ajustable por cita. Consultas consecutivas, sin
  espacios obligatorios entre ellas.
- Cada médico configura confirmación directa o manual por horario o sede.
- Paciente cancela/reagenda hasta 12 h antes; después solicita cambio al consultorio.
- Espera: avisar a todos los compatibles; primer confirmado obtiene reserva atómica.
- Portal: documentos liberados, subir estudios, información preconsulta y mensajes.
- Mensajes administrativos a recepción; clínicos al médico.
- Capacidad confirmada en la respuesta «Las dos»: 100.000 cuentas registradas
  y 100.000 usuarios activos simultáneos como objetivos independientes. No es
  capacidad demostrada. Pacientes totales frente a pacientes por clínica, mezcla
  de roles, duración de la carga, disponibilidad y presupuesto siguen pendientes.

## Primer checkpoint técnico

Rama codex/ausculta-consulta-agenda, base 755686f. Cambios REG-656, REG-657 y
REG-658 documentados en ledger. Reproducciones antes/después con datos sintéticos.
Ningún despliegue, fusión a main ni mensaje real autorizado o ejecutado.

## Pendiente concreto

1. Cerrar gates de este lote y revisión; no declarar validación integral.
2. Reproducir regeneración que conserva medicamentos/diagnósticos de IA cuando
   respuesta corregida devuelve []; preservar entradas manuales con procedencia.
3. Probar navegación real entre pacientes/notas y las demás respuestas async.
4. Extender conservación de dudas a elementos omitidos/citas cambiadas y segundo
   borrador; verificar compuerta crítica en todas las vías de captura.
5. Implementar y probar resto de decisiones de agenda/portal/roles anteriores.
6. Rediseño consulta de tres áreas, claro inicial y responsive con V10; revisar
   en navegador antes de calificar. No realizado en este checkpoint.
7. Offline, continuidad entre dispositivos, comunicaciones e IA contextual: auditar
   implementaciones existentes antes de ampliarlas.

No hay una auditoría completa, evaluación comparativa ni promesa de calidad 1000%.

## Verificación del checkpoint

- Pruebas dirigidas y clinical-safety-gate: 71 pasan (antes de los cambios,
  fallaban los casos de cancelación, descarte y ambigüedad).
- Lint: 93 errores, igual al techo preexistente; no se aumentó deuda.
- Suite completa inicial: 14 468 pasan, 11 fallan, 1 omitida. Se ejecutó antes
  de actualizar documentos derivados; revalidación de estos en curso.
- Los generadores que invocan CLI tsx fallan aquí por IPC `listen EPERM`.
  El tablero se regeneró llamando sus funciones exportadas con el loader TS,
  sin levantar IPC ni modificar el generador o sus pruebas.
- Auditoría npm del lockfile sin modificar: 14 avisos (11 moderate, 2 high,
  1 critical). Paquetes high: @xmldom/xmldom y sharp; critical: next.
  No demuestra explotación ni acceso a expedientes. Sigue pendiente actualizar
  y probar esas dependencias, antes de considerar publicación.
- Compilación inicial agotó heap 2 GB; con 6 GB pasó compilación y tipos, pero
  prerender falló por API key Firebase ausente. Reintento con valores sintéticos,
  sin credenciales reales. Resultado final se registra al terminar.
- No se ha ejecutado QA de navegador del lote. No listo para producción.

### Resultado final de este lote

- Build con configuración sintética: completado, exit 0.
- Revalidación final: 111 pruebas pasan en 8 archivos (incluye documentos
  derivados y clasificación de los nuevos REG).
- El gate global sigue pendiente por los otros fallos descritos; no se repitió
  la suite entera después de actualizar la documentación.
- Código y decisiones publicados como borrador PR #478:
  https://github.com/docrod29-ai/agenda-medica/pull/478
- Sin despliegue ni fusión. Siguiente prioridad: dependencias de seguridad y
  reproducción de regeneración vacía, antes del rediseño integral.

## Segundo checkpoint — consulta, seguridad y mantenimiento

Continuación del 9-sep-2026. El dueño prioriza identidad visual, interacción,
resistencia a ataques y caídas, capacidad de más de 100.000 usuarios y más de
10.000 pacientes, auditorías y mantenimiento sostenible. El adjunto webarchive
contiene una petición de escalabilidad y facilidad de mantener la base de código.
En ese checkpoint aún no se había precisado concurrencia, pacientes por clínica,
presupuesto ni disponibilidad. Se usaron provisionalmente 100.000 cuentas
registradas y 10.000 pacientes por clínica. La confirmación posterior de ambas
cifras de usuarios sustituye el supuesto de concurrencia; el volumen por clínica
sigue sin confirmar. Ninguna cifra se presenta como capacidad medida.

Cambios de este lote, que sustituyen los pendientes de dependencias y la primera
implementación del diseño mencionados en el checkpoint anterior:

- ConsultaWorkspace: tres áreas en escritorio ancho, navegación por anclas en
  tamaños menores, mismo editor/controladores/encuentro. No desmonta la captura
  al navegar entre secciones. Asistente antes del cierre en el documento.
- Claro inicial con preferencia explícita dark/auto preservada. Jerarquía de
  lectura y acentos con los tokens existentes; revisión visual aún pendiente.
- Next 16.3.4, sharp 0.35.4 y xmldom 0.9.12. Auditoría local de dependencias de
  producción: 11 moderados, 0 altos, 0 críticos. Herramientas: quedan 3 altos.
- REG-659: reserva pública devuelve 503 con reintento si falla cualquiera de
  sus contadores, antes de escrituras clínicas o avisos. Cuotas 429 preservadas.
- Workflow de auditoría diaria preparado; programación no activa hasta entrar
  en la rama predeterminada. Censo de mantenimiento usa Node 22.18+ nativo.
- Criterios, supuestos y límites en docs/maintenance/AUSCULTA-2026-09-09.md.

Verificación de este lote:

- Reproducción antes/después: ambos fallos del contador; 26 pruebas dirigidas
  pasan. Se respetan las preferencias explícitas de tema.
- Los controles de documentación, ancho mínimo y lienzo se corrigieron sin
  retirar casos. El censo real vuelve a ejecutarse sin depender del IPC de tsx.
- Compilación final y TypeScript: exit 0, con valores Firebase sintéticos.
- CSP del artefacto final: 4/4 pasan. Lint: 93 errores, igual al techo previo.
- Suite completa final: 14.487/14.487 pruebas, 1.099/1.099 archivos, exit 0
  (328,90 s). No hubo casos omitidos en esta corrida local con artefacto de build.
- El resultado de CI del commit publicado se registra en el PR. La corrida local
  no sustituye las pruebas del emulador ni la revisión visual pendientes.

Bloqueos concretos: emulador no arrancó; navegador rechazó la dirección local;
la vista supervisada requiere argumentos Vite incompatibles con Next. No hay QA
visual ni validación de la consulta privada en navegador de este lote. No se
transformó el proyecto ni se probaron datos reales para sortear esos bloqueos.

Prioridades pendientes al retomar:

1. Revisar la consulta real con datos sintéticos: escritorio, tableta, teléfono,
   teclado, grabación, navegación y firma. No declarar superioridad estética.
2. Reproducir regeneración vacía y respuestas tardías al cambiar de persona;
   verificar acceso entre médicos de la misma clínica y autorización al compartir.
3. Acotar notificaciones a hoy/mañana con limpieza al cambiar de clínica y día;
   comprobar respaldo con receptor lento, cancelación y memoria acotada.
4. Preparar ensayo distribuido de 100.000 usuarios activos simultáneos; precisar
   mezcla de roles, volumen por clínica, disponibilidad, recuperación y coste.
5. Completar el resto de decisiones de agenda, portal, voz y continuidad ya
   registradas arriba. No se declara que este lote cubra toda la entrevista.

El trabajo sigue en el borrador PR #478. Sin fusión a main ni despliegue manual
a producción. La integración del repositorio puede generar vistas previas del PR.

### Integración del avance concurrente de main

Al comprobar CI se detectó que main había avanzado hasta `17bff1c` (PR #477 y
#479, v1191) durante el trabajo. Se integra ese main en la rama del PR #478,
resolviendo conflictos de paquete y estado generado. Se conserva el override
de xmldom añadido allí y su versión de SW/pin de despliegue; se mantiene Next
16.3.4 exacto y sus herramientas alineadas. Todas las versiones de dependencias
que cambió ese main coinciden con las ya instaladas y probadas en este lote.
No se ejecuta el workflow de producción. Los resultados sobre la combinación
se registran en el cuerpo del PR; la verificación anterior corresponde al árbol
previo a esta integración.

- Revalidación de integración: 289 pruebas en 16 archivos pasan (versiones,
  despliegue, documentación y dependencias).
- La vista previa de `b211903` terminó con estado Vercel success. Al abrirla,
  exige iniciar sesión en Vercel; no se accedió a la consulta ni se eligió un
  proveedor de acceso en nombre del dueño. Sigue pendiente QA visual con datos
  sintéticos en una sesión de prueba accesible.

### Confirmación posterior — registrados y simultáneos

El dueño responde «Las dos» a la pregunta sobre 100.000 cuentas registradas o
100.000 usuarios simultáneos. Se confirman ambos objetivos. La concurrencia
debe contar personas distintas realizando operaciones durante la ventana del
ensayo, sin multiplicarlas por pestañas, dispositivos o conexiones inactivas.

El escenario canónico de 100.000 registrados deriva 3.861 sesiones concurrentes
mediante supuestos; no verifica el nuevo objetivo de 100.000 usuarios activos.
Se conserva como escenario histórico y se especifica el ensayo adicional en
`docs/maintenance/AUSCULTA-2026-09-09.md`, separado de voz e IA y de volumen.
El arnés local está acotado a 400 sesiones; no se ejecuta carga masiva contra
producción ni se modifica esa cota para aparentar cobertura.

La integración de Vercel devolvió 403 al consultar la configuración del proyecto.
Plan, cuotas y capacidad contratada siguen sin verificar. Esta actualización
registra requisitos y criterios; no ejecuta ensayos ni demuestra nueva capacidad.

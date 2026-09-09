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

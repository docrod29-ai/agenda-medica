# Plan de respuesta a incidentes de seguridad — NexusMED

Estado: **documentado, simulacro pendiente** (no se ha ejecutado un tabletop registrado). No se envían notificaciones reales desde este plan.

## Definición de incidente
Evento que compromete (o pudo comprometer) la confidencialidad, integridad o disponibilidad de datos de médicos o pacientes: acceso no autorizado, fuga, pérdida de datos, indisponibilidad, malware, phishing exitoso, exposición de secretos, abuso de la IA con PHI.

## Severidad
- **SEV1 (crítico):** fuga confirmada de PHI, compromiso multi-tenant, indisponibilidad total. Escalar de inmediato.
- **SEV2 (alto):** exposición limitada, acceso no autorizado contenido, degradación mayor.
- **SEV3 (medio):** vulnerabilidad explotable sin evidencia de explotación.
- **SEV4 (bajo):** hallazgo menor, sin impacto en datos.

## Roles
- **Coordinador de incidente:** el responsable de la plataforma (Dr.).
- **Técnico:** quien contiene/investiga.
- **Privacidad/legal:** evalúa deber de notificación (requiere abogado — ver BLOCKERS).

## Flujo
1. **Detección/Reporte** → canal: `seguridad@nexusmed.mx` (definir buzón real). Registrar hora y fuente.
2. **Triage** → asignar severidad.
3. **Contención** → revocar sesiones/tokens/llaves afectadas; aislar; deshabilitar la función comprometida (rate-limit, App Check enforce, rotación de secretos).
4. **Preservación de evidencia** → snapshots, logs (audit_log append-only), sin alterar.
5. **Investigación** → alcance, datos afectados, vector, ventana temporal.
6. **Erradicación** → parchear, rotar secretos, cerrar el vector.
7. **Recuperación** → restaurar desde respaldo verificado (ver backup-and-restore.md), validar integridad.
8. **Comunicación** → interna primero; a consultorios afectados según evaluación (plantilla abajo). **No** notificar sin decisión del coordinador + evaluación legal.
9. **Postmortem** → causa raíz, cronología, acciones preventivas, dueño y fecha.

## Plantillas (rellenar por incidente)
- **Registro:** id, fecha/hora, reportante, severidad, sistemas, datos, estado.
- **Cronología:** timestamp → acción.
- **Impacto:** categorías de datos, nº de consultorios/pacientes, confirmado vs potencial.
- **Comunicación interna / al usuario:** hechos, alcance, acciones, recomendaciones (sin especular).
- **Postmortem:** qué pasó, por qué, qué se hizo, qué cambia.

## Simulacros
Ejecutar 1 tabletop/año (SEV1 simulado) y registrar el resultado. **Pendiente.**

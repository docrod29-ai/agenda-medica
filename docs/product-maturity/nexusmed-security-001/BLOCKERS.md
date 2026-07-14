# BLOCKERS — nexusmed-security-001 (SECURITY_HARDENING)

Cada bloqueo indica impacto y la acción segura para desbloquearlo. No se improvisó ni se declaró nada como hecho.

## 1. Restore drill (recuperación probada)
- **Impacto:** no se puede declarar "recuperación activa" sin ejecutar y registrar una restauración.
- **Por qué está bloqueado:** requiere que el Dr. ejecute `gcloud` en el proyecto `nexomed-agenda` y disponga de un entorno de staging aislado. Claude Code no tiene (ni debe tener) acceso a la infraestructura de producción.
- **Solución segura:** el Dr. habilita PITR + backup schedule (comandos en `backup-and-restore.md`) y ejecuta el drill con datos sintéticos; se registra RPO/RTO observados.

## 2. MFA
- **Impacto:** cuentas sin segundo factor.
- **Por qué está bloqueado:** la API `multiFactor` de Firebase exige **Identity Platform** habilitado; sin él, el código de MFA falla en runtime. Implementar auth no probable arriesga romper el login de producción.
- **Solución segura:** habilitar Identity Platform en la consola + entorno de staging; luego implementar los flujos de `mfa-design.md` y ejecutar sus pruebas.

## 3. Pentest externo
- **Impacto:** no hay evidencia de tercero independiente.
- **Por qué está bloqueado:** requiere contratar a un proveedor de pentest.
- **Solución segura:** usar el alcance de `pentest-readiness.md` para contratar; entretanto solo se declaran las pruebas INTERNAS (no equivalen a un pentest externo).

## 4. Evaluación jurídica de notificación de brechas
- **Impacto:** el plan de incidentes no puede afirmar deberes legales exactos.
- **Solución segura:** abogado mexicano en protección de datos/salud revisa los umbrales y plazos de notificación.

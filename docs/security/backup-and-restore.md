# Respaldos y recuperación — NexusMED

Base de datos: **Cloud Firestore** (proyecto `nexomed-agenda`). Almacenamiento: Cloud Storage.

## Capacidades del proveedor (Firestore)
- **Backups programados** (scheduled backups) con retención configurable.
- **Point-in-time recovery (PITR):** ventana de 7 días (recuperación a un instante).
- **Exportación** a Cloud Storage (`gcloud firestore export`).
- **Restauración** a la misma base o a una base nueva (aislada).

## Política objetivo
- **Frecuencia:** backup diario + PITR continuo (7 días).
- **Retención:** ≥ 30 días (backups); PITR 7 días.
- **Región:** la del proyecto (us-central / según config real — confirmar).
- **Cifrado:** en reposo por Google (predeterminado).
- **Acceso:** solo el dueño del proyecto (IAM mínimo).
- **RPO objetivo:** ≤ 24 h (con PITR, prácticamente minutos).
- **RTO objetivo:** ≤ 4 h.
- **Responsable:** el Dr. (dueño del proyecto GCP).

## Habilitación (acción externa del Dr.)
```bash
# PITR
gcloud firestore databases update --database='(default)' --enable-pitr
# Backup schedule diario, retención 30 días
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=daily --retention=30d
```

## Restore drill (procedimiento) — REQUERIDO antes de declarar "activo"
1. Crear datos **sintéticos** en un tenant/base de staging.
2. Generar un backup / anotar timestamp para PITR.
3. Modificar o borrar los datos sintéticos.
4. Restaurar a una **base nueva aislada**:
   `gcloud firestore databases restore --source-backup=… --destination-database=restore-test`
5. Verificar integridad (conteos, hashes de documentos clave).
6. Documentar RPO y RTO observados.
7. Confirmar que **producción no se tocó**.

### Resultado del drill
```text
Restore drill: BLOCKED
Motivo: requiere que el Dr. ejecute los comandos gcloud en su proyecto GCP y
        disponga de un entorno de staging aislado. Claude Code NO tiene (ni debe
        tener) acceso a la infraestructura de producción para hacerlo.
RPO observado: —
RTO observado: —
```

**No se declara "recuperación activa" hasta ejecutar y registrar este drill** (por eso el control aparece como *En proceso* en /seguridad).

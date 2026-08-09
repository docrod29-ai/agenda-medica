# V10 — bitácora de decisiones

Formato: fecha · decisión · por qué · reversibilidad.

## 2026-08-09 · Primera corrida real de V10

1. **Usar la rama designada por el arnés** (`claude/kind-brahmagupta-ake878`) en
   lugar de crear `claude/nexus-visual-excellence-v10`. El §3 permite la rama
   configurada; crear una segunda rama duplicaría el trabajo de coordinación con
   V7/V9. Reversible (renombrar/mover es barato).

2. **No rehacer las auditorías que V9 ya midió.** `SCREEN_INVENTORY.md` (generado
   y con guardián), `GENERIC_AI_AESTHETIC_AUDIT.md`, `NAVIGATION_STATE_AUDIT.md`
   y los techos sellados de diseño se toman como insumo de `V10-TRUTH-001`. El
   §2 lo ordena («do not re-audit the entire repository every run»).

3. **`.env.local` con claves Firebase sintéticas, sólo en este contenedor.**
   Sin ellas `getAuth()` revienta al evaluar módulos y ninguna página renderiza;
   con ellas la superficie pública renderiza y la clínica sigue pidiendo sesión
   (no se falsifica autorización). No se versiona (`.gitignore` cubre `.env*`),
   no toca producción, no usa datos reales. Reversible: borrar el archivo.

4. **Puntuar sólo lo capturado.** El scorecard no estima pantallas sin evidencia
   — regla derivada del §33/§34 («no inflar puntuaciones», «nunca aprobar desde
   el código»).

5. **No tocar `/precios` en esta corrida** pese al hallazgo V10-P1-003 (nombres
   de modelos vs REG-292): es la pantalla comercial de mayor visibilidad, hay
   una lectura plausible de decisión deliberada del dueño, y esta corrida es de
   auditoría. Se registró con ambas lecturas y el paso de verificación previo.

6. **Siguiente habilitador antes que cosmética**: `V10-ENV-001` (emuladores)
   por delante de los P1 de portada, porque desbloquea la puntuación de TODAS
   las pantallas críticas y el §31 pondera flujo dorado y seguridad por encima
   de marketing.

7. **Evidencia como JPEG q70 dentro del repo** (`docs/design/evidence/v10/`),
   1,2 MB por corrida aprox. Los PNG completos quedan fuera (pesan ~15 MB).
   Si el peso del repo preocupa al dueño, se cambia a un almacén externo.

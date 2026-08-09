# V10-TRUTH-001 — auditoría de verdad visual (en curso)

**Corrida 1 · 9-ago-2026.** Primera corrida del programa V10. No existía estado
V10; se creó, y se rompió el bloqueo que V9 arrastraba: **el producto ya se
puede abrir en un navegador real** con datos sintéticos.

## Qué quedó hecho en esta corrida

1. **Entorno visual con emuladores** (Auth + Firestore) y semilla sintética:
   `docs/testing/entorno-visual-emulador.md`. Antes: `npm run build` fallaba
   sin credenciales y ninguna pantalla se había visto con ojos (V9 lo declara
   en su checkpoint). Ahora: login real, sesión real, datos de consultorio
   sintéticos.
2. **Inspección en navegador de 9 pantallas** (escritorio 1440×900) y 5 en
   móvil (390×844), con captura en `agent-state/v10-evidencia/`.
3. **Calificaciones iniciales** con evidencia: `agent-state/V10_VISUAL_SCORECARD.json`.
4. **Backlog inicial** P1-P3: `agent-state/V10_BACKLOG.json`.

## Hallazgos mayores (evidencia en v10-evidencia/)

- **La barra lateral tiene 22 destinos** (más buscador, tema, rol y cierre).
  Es el almacén de funciones que §9/§12 de la espec prohíben. Es el defecto
  estructural número uno del producto en escritorio.
- **Móvil es escritorio apilado** (§27): en `/citas` los chips de filtro
  ocupan media pantalla, el nombre del paciente se parte en columna de una
  palabra, y tres botones flotantes tapan contenido.
- **La marca no es una**: el encabezado móvil dice «Agenda Médica»; el de
  escritorio, «NexusMED».
- **Primer arranque con dos ventanas encimadas**: modal de bienvenida + toast
  de notificaciones, compitiendo.
- **«Hospital» se asoma en Practice**: chip de filtro en la historia clínica
  del expediente (la espec §1 manda Hospital/UCI ocultos).
- El saludo dice «Buenas noches, **medico**» — toma el prefijo del correo en
  vez del nombre del médico que ya está en `clinic_members.displayName`.
- Alergias del paciente pintadas **dos veces** en la consulta (banda + píldora),
  diluyendo la señal.
- Lo bueno, que también se anota: «Siguiente acción» en el tablero es una
  cola de atención real (no un dashboard de KPIs); el grabador es la acción
  primaria inequívoca de la consulta; el estado vacío de Pendientes enseña
  qué pasará y por qué.

## Qué NO afirma esta corrida

- Ninguna medición de accesibilidad ni de teclado todavía.
- Ningún flujo con API de servidor (401 contra emulador; ver V10_BLOCKERS.md).
- Las 26+ rutas restantes no tienen captura.
- Nada de esto es todavía una calificación «final»: es la línea base.

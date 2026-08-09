# V10 — bitácora de decisiones

## 2026-08-09 · Corrida 1

1. **Rama**: la espec sugiere `claude/nexus-visual-excellence-v10`; esta sesión
   trae rama designada por el arnés (`claude/kind-brahmagupta-4tkrhu`) con orden
   explícita de no empujar a otra. La orden del arnés manda. El estado V10 vive
   en el repo, así que cualquier rama futura lo hereda con un merge.
2. **No duplicar la verdad de V9**: los documentos de diseño que V9 ya produjo
   (NEXUS_DESIGN_SYSTEM, SCREEN_INVENTORY, GENERIC_AI_AESTHETIC_AUDIT, trinquete)
   se adoptan como fuentes de V10 en lugar de crear copias con otro nombre. El
   mapa está en `V10_MASTER_STATE.json → documentosNormalizados`.
3. **Emuladores en vez de credenciales**: la verificación visual se desbloqueó
   apuntando el SDK cliente a los emuladores de Auth/Firestore con doble candado
   (`NEXT_PUBLIC_FIREBASE_EMULATORS=1` **y** `NODE_ENV !== 'production'`), y una
   semilla 100 % sintética con `projectId` que empieza por `demo-` (el SDK se
   niega a hablar con proyectos reales). Sin pedirle nada al dueño y sin tocar
   producción.
4. **Calificar sólo lo visto**: el scorecard únicamente admite pantallas con
   captura de navegador real. Nada se puntúa desde el JSX (§33: never approve
   UI from source alone). Por eso hoy hay 9 pantallas y no 35.
5. **El modal de bienvenida se descarta antes de capturar**: las capturas de
   línea base retratan la pantalla de trabajo, no el tour. El tour en sí quedó
   retratado y anotado como hallazgo (V10-ONBOARD-001).

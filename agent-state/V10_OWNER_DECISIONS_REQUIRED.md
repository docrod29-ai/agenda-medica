# V10 — Decisiones que sólo puede tomar el dueño

| # | Qué | Default recomendado | Riesgo de no decidir | Estado |
|---|---|---|---|---|
| V10-D1 | **Fusionar `claude/nexus-patient-ux-v9` a main** (8 commits: DESIGN-SYSTEM-001, NAVIGATION-001, PATIENT-COMPANION-001, REG-274…281). Está 48 commits detrás; necesita rebase/merge y PR | Abrir PR de esa rama y fusionarla antes de que V10 toque shell, navegación o compañero | V10 construiría encima de un main que no tiene el sistema de diseño real → trabajo duplicado o pisado | ⏳ abierta |

Nada más requiere al dueño hoy. Las decisiones reversibles de diseño las toma
el programa con la jerarquía de V10 §5.

## D-PENDIENTE · Nombre LEGAL en los textos jurídicos (nace de V10-D2, 10-ago-2026)

El renombre a **Ausculta** ya está aplicado en toda superficie visible
(login, sidebar, cabecera móvil, tour, manifest, títulos, landing, portal del
paciente, documentos exportados, calendario de Google, bot de ayuda).

**Cuatro textos se dejaron con el nombre anterior a propósito**, porque nombran
a la plataforma como PARTE en un instrumento jurídico y eso exige el nombre
legal (¿razón social? ¿marca registrada?) que solo el dueño conoce:

1. `src/app/terminos/page.tsx`
2. `src/app/privacidad/page.tsx`
3. `src/lib/aviso-privacidad.ts` (encargado del tratamiento, LFPDPPP)
4. `src/lib/contrato-encargo.ts` (contrato responsable↔encargado)

**Default recomendado**: si «Ausculta» es solo nombre comercial, los legales
digan «[razón social], que opera la plataforma Ausculta». Al decidirlo, borrar
la excepción del cerrojo `la-app-se-llama-ausculta.test.ts` y renombrar.

Pendientes también del dueño (fuera del alcance del agente): dominio, correos,
repositorio, nombre en Stripe/Facturama, identificador HL7 acordado con el LIS.

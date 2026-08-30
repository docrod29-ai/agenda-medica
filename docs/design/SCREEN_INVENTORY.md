# Inventario de pantallas — NexusMED

> **GENERADO. No se edita a mano.**
> `node scripts/design/inventario-de-pantallas.mjs`
> El guardián `el-inventario-de-pantallas-no-miente` falla si este archivo se
> queda atrás respecto del árbol de rutas.
>
> **Qué NO dice**: mide el `page.tsx`, no el árbol de componentes que cuelga
> de él. Una pantalla delgada que delega en un componente grande sale con
> `Resp: —` y eso **no** significa que no sea adaptable. Sirve para ordenar el
> barrido; aprobar una pantalla exige abrirla en un navegador.

**Total: 80 pantallas.**

| Superficie | Pantallas |
|---|---|
| paciente | 9 |
| medico | 34 |
| alpha | 10 |
| publica | 18 |
| interna | 9 |

- **paciente** — a quien le habla es el paciente. Es lo que gobierna V9.
- **medico** — la consulta y su alrededor. Producto Practice.
- **alpha** — Hospital y UCI. Detrás de bandera, **no a la venta**.
- **publica** — marketing y alta.
- **interna** — superadmin. Fuera del alcance de V9.

## Columnas

`Cli` `'use client'` · `Nav` salidas declaradas (`<Link`, `router.push`) ·
`Resp` menciona un punto de corte · `Tok` usa `var(--…)` de `globals.css` ·
`Est` toca almacenamiento del navegador.

| Ruta | Superficie | Cli | Líneas | Nav | Resp | Tok | Est |
|---|---|---|---|---|---|---|---|
| `/dr/[clinicId]` | paciente | — | 259 | 1 | — | ✅ | — |
| `/mi/[token]` | paciente | ✅ | 970 | 0 | — | ✅ | — |
| `/pago/cancelado` | paciente | ✅ | 19 | 1 | — | ✅ | — |
| `/pago/exito` | paciente | ✅ | 32 | 0 | — | ✅ | — |
| `/privacidad/[clinicId]` | paciente | ✅ | 288 | 0 | — | ✅ | — |
| `/resena/[token]` | paciente | ✅ | 139 | 0 | — | ✅ | — |
| `/reservar/[clinicId]` | paciente | ✅ | 440 | 0 | — | ✅ | — |
| `/teleconsulta/[citaId]` | paciente | ✅ | 112 | 0 | — | ✅ | — |
| `/verificar/[token]` | paciente | — | 103 | 0 | — | ✅ | — |
| `/antibiograma` | medico | ✅ | 901 | 0 | — | ✅ | — |
| `/asistente` | medico | ✅ | 797 | 0 | — | ✅ | — |
| `/calendario` | medico | ✅ | 698 | 1 | — | ✅ | — |
| `/chat` | medico | ✅ | 364 | 0 | — | ✅ | — |
| `/citas` | medico | ✅ | 1212 | 6 | — | ✅ | — |
| `/configuracion` | medico | ✅ | 2633 | 1 | — | ✅ | — |
| `/consulta/[patientId]` | medico | ✅ | 6625 | 7 | — | ✅ | ✅ |
| `/consultor` | medico | ✅ | 315 | 0 | — | ✅ | — |
| `/corte-caja` | medico | ✅ | 341 | 0 | — | ✅ | — |
| `/crm` | medico | ✅ | 235 | 1 | — | ✅ | — |
| `/cumplimiento` | medico | ✅ | 977 | 0 | — | ✅ | — |
| `/cumplimiento/motores` | medico | ✅ | 188 | 1 | — | ✅ | — |
| `/cumplimiento/retencion` | medico | ✅ | 247 | 2 | — | ✅ | — |
| `/cumplimiento/seguridad` | medico | ✅ | 291 | 1 | — | ✅ | — |
| `/dashboard` | medico | ✅ | 384 | 5 | — | ✅ | — |
| `/expediente/[patientId]` | medico | ✅ | 969 | 14 | — | ✅ | — |
| `/expedientes` | medico | ✅ | 18 | 1 | — | — | — |
| `/farmacia` | medico | ✅ | 738 | 0 | — | ✅ | — |
| `/finanzas` | medico | ✅ | 754 | 0 | — | ✅ | — |
| `/guia` | medico | ✅ | 134 | 0 | — | ✅ | — |
| `/lista-espera` | medico | ✅ | 286 | 0 | — | ✅ | — |
| `/membresias` | medico | ✅ | 281 | 0 | — | ✅ | — |
| `/migracion` | medico | ✅ | 371 | 0 | — | ✅ | — |
| `/motores` | medico | ✅ | 208 | 0 | — | ✅ | — |
| `/nota/[patientId]` | medico | ✅ | 82 | 2 | — | ✅ | — |
| `/nota/[patientId]/[notaId]` | medico | ✅ | 943 | 2 | — | ✅ | — |
| `/operaciones` | medico | ✅ | 405 | 1 | — | ✅ | — |
| `/orden/[patientId]/[notaId]` | medico | ✅ | 840 | 2 | — | ✅ | — |
| `/pacientes` | medico | ✅ | 1157 | 4 | — | ✅ | — |
| `/pendientes` | medico | ✅ | 520 | 3 | — | ✅ | — |
| `/reactivacion` | medico | ✅ | 341 | 0 | — | ✅ | — |
| `/receta/[patientId]/[notaId]` | medico | ✅ | 1030 | 2 | — | ✅ | — |
| `/referencia/[patientId]` | medico | ✅ | 283 | 0 | — | ✅ | — |
| `/resenas` | medico | ✅ | 105 | 0 | — | ✅ | — |
| `/hospitalizacion` | alpha | ✅ | 425 | 5 | — | ✅ | — |
| `/hospitalizacion/[internamientoId]` | alpha | ✅ | 1725 | 4 | — | ✅ | ✅ |
| `/hospitalizacion/camas` | alpha | ✅ | 239 | 1 | — | ✅ | — |
| `/hospitalizacion/indicadores` | alpha | ✅ | 102 | 0 | — | ✅ | — |
| `/hospitalizacion/unidades` | alpha | ✅ | 171 | 0 | — | ✅ | — |
| `/uci` | alpha | ✅ | 1936 | 2 | — | ✅ | ✅ |
| `/uci/antimicrobianos` | alpha | ✅ | 683 | 0 | — | ✅ | — |
| `/uci/benchmark` | alpha | ✅ | 265 | 0 | — | ✅ | — |
| `/uci/dosificacion` | alpha | ✅ | 585 | 0 | — | ✅ | — |
| `/uci/enfermeria` | alpha | ✅ | 206 | 1 | — | ✅ | — |
| `/` | publica | ✅ | 680 | 12 | — | ✅ | — |
| `/arquitectura` | publica | — | 112 | 2 | — | ✅ | — |
| `/contacto` | publica | — | 70 | 2 | — | ✅ | — |
| `/demo` | publica | — | 312 | 5 | — | ✅ | — |
| `/demo/interactivo` | publica | ✅ | 772 | 2 | — | ✅ | — |
| `/demo/razonamiento` | publica | ✅ | 146 | 3 | — | ✅ | — |
| `/evidencia` | publica | — | 81 | 1 | — | ✅ | — |
| `/legal` | publica | ✅ | 113 | 1 | — | ✅ | — |
| `/login` | publica | ✅ | 410 | 4 | — | ✅ | — |
| `/operacion` | publica | — | 98 | 2 | — | ✅ | — |
| `/paquetes` | publica | — | 94 | 3 | — | ✅ | — |
| `/precios` | publica | — | 189 | 1 | — | ✅ | — |
| `/privacidad` | publica | — | 135 | 0 | — | — | — |
| `/registro` | publica | ✅ | 388 | 3 | — | ✅ | — |
| `/seguridad` | publica | — | 146 | 2 | — | ✅ | — |
| `/setup` | publica | ✅ | 271 | 2 | — | ✅ | — |
| `/terminos` | publica | — | 141 | 0 | — | ✅ | — |
| `/unirse/[code]` | publica | ✅ | 184 | 4 | — | ✅ | — |
| `/superadmin` | interna | ✅ | 690 | 1 | — | ✅ | — |
| `/superadmin/contabilidad` | interna | ✅ | 292 | 1 | — | ✅ | — |
| `/superadmin/costos` | interna | ✅ | 520 | 1 | — | ✅ | — |
| `/superadmin/csp` | interna | ✅ | 178 | 1 | — | ✅ | — |
| `/superadmin/errores` | interna | ✅ | 85 | 1 | — | ✅ | — |
| `/superadmin/onboarding` | interna | ✅ | 163 | 1 | — | ✅ | — |
| `/superadmin/planes` | interna | ✅ | 228 | 1 | — | ✅ | — |
| `/superadmin/simulador` | interna | ✅ | 203 | 1 | — | ✅ | — |
| `/superadmin/soporte` | interna | ✅ | 96 | 1 | — | ✅ | — |

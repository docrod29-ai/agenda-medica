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
| `/mi/[token]` | paciente | ✅ | 1073 | 0 | — | ✅ | — |
| `/pago/cancelado` | paciente | ✅ | 19 | 1 | — | ✅ | — |
| `/pago/exito` | paciente | ✅ | 32 | 0 | — | ✅ | — |
| `/privacidad/[clinicId]` | paciente | ✅ | 288 | 0 | — | ✅ | — |
| `/resena/[token]` | paciente | ✅ | 139 | 0 | — | ✅ | — |
| `/reservar/[clinicId]` | paciente | ✅ | 440 | 0 | — | ✅ | — |
| `/teleconsulta/[citaId]` | paciente | ✅ | 112 | 0 | — | ✅ | — |
| `/verificar/[token]` | paciente | — | 103 | 0 | — | ✅ | — |
| `/antibiograma` | medico | ✅ | 901 | 0 | — | ✅ | — |
| `/asistente` | medico | ✅ | 863 | 0 | — | ✅ | — |
| `/calendario` | medico | ✅ | 874 | 1 | — | ✅ | — |
| `/chat` | medico | ✅ | 364 | 0 | — | ✅ | — |
| `/citas` | medico | ✅ | 1217 | 6 | — | ✅ | — |
| `/configuracion` | medico | ✅ | 2669 | 1 | — | ✅ | — |
| `/consulta/[patientId]` | medico | ✅ | 7470 | 7 | — | ✅ | ✅ |
| `/consultor` | medico | ✅ | 355 | 0 | — | ✅ | — |
| `/corte-caja` | medico | ✅ | 341 | 0 | — | ✅ | — |
| `/crm` | medico | ✅ | 279 | 1 | — | ✅ | — |
| `/cumplimiento` | medico | ✅ | 1041 | 0 | — | ✅ | — |
| `/cumplimiento/motores` | medico | ✅ | 206 | 1 | — | ✅ | — |
| `/cumplimiento/retencion` | medico | ✅ | 354 | 2 | — | ✅ | — |
| `/cumplimiento/seguridad` | medico | ✅ | 316 | 1 | — | ✅ | — |
| `/dashboard` | medico | ✅ | 384 | 5 | — | ✅ | — |
| `/expediente/[patientId]` | medico | ✅ | 1149 | 14 | — | ✅ | — |
| `/expedientes` | medico | ✅ | 18 | 1 | — | — | — |
| `/farmacia` | medico | ✅ | 822 | 0 | — | ✅ | — |
| `/finanzas` | medico | ✅ | 755 | 0 | — | ✅ | — |
| `/guia` | medico | ✅ | 141 | 0 | — | ✅ | — |
| `/lista-espera` | medico | ✅ | 309 | 0 | — | ✅ | — |
| `/membresias` | medico | ✅ | 325 | 0 | — | ✅ | — |
| `/migracion` | medico | ✅ | 417 | 0 | — | ✅ | — |
| `/motores` | medico | ✅ | 208 | 0 | — | ✅ | — |
| `/nota/[patientId]` | medico | ✅ | 82 | 2 | — | ✅ | — |
| `/nota/[patientId]/[notaId]` | medico | ✅ | 1020 | 2 | — | ✅ | — |
| `/operaciones` | medico | ✅ | 405 | 1 | — | ✅ | — |
| `/orden/[patientId]/[notaId]` | medico | ✅ | 846 | 2 | — | ✅ | — |
| `/pacientes` | medico | ✅ | 1239 | 4 | — | ✅ | — |
| `/pendientes` | medico | ✅ | 780 | 3 | — | ✅ | ✅ |
| `/reactivacion` | medico | ✅ | 365 | 0 | — | ✅ | — |
| `/receta/[patientId]/[notaId]` | medico | ✅ | 1031 | 2 | — | ✅ | — |
| `/referencia/[patientId]` | medico | ✅ | 297 | 0 | — | ✅ | — |
| `/resenas` | medico | ✅ | 105 | 0 | — | ✅ | — |
| `/hospitalizacion` | alpha | ✅ | 453 | 5 | — | ✅ | — |
| `/hospitalizacion/[internamientoId]` | alpha | ✅ | 1733 | 4 | — | ✅ | ✅ |
| `/hospitalizacion/camas` | alpha | ✅ | 239 | 1 | — | ✅ | — |
| `/hospitalizacion/indicadores` | alpha | ✅ | 102 | 0 | — | ✅ | — |
| `/hospitalizacion/unidades` | alpha | ✅ | 171 | 0 | — | ✅ | — |
| `/uci` | alpha | ✅ | 1936 | 2 | — | ✅ | ✅ |
| `/uci/antimicrobianos` | alpha | ✅ | 683 | 0 | — | ✅ | — |
| `/uci/benchmark` | alpha | ✅ | 265 | 0 | — | ✅ | — |
| `/uci/dosificacion` | alpha | ✅ | 585 | 0 | — | ✅ | — |
| `/uci/enfermeria` | alpha | ✅ | 206 | 1 | — | ✅ | — |
| `/` | publica | ✅ | 413 | 13 | — | — | — |
| `/arquitectura` | publica | — | 131 | 2 | — | ✅ | — |
| `/contacto` | publica | — | 83 | 1 | — | ✅ | — |
| `/demo` | publica | — | 510 | 4 | — | ✅ | — |
| `/demo/interactivo` | publica | ✅ | 772 | 2 | — | ✅ | — |
| `/demo/razonamiento` | publica | ✅ | 158 | 3 | — | ✅ | — |
| `/evidencia` | publica | — | 94 | 0 | — | ✅ | — |
| `/legal` | publica | ✅ | 113 | 1 | — | ✅ | — |
| `/login` | publica | ✅ | 391 | 5 | — | ✅ | — |
| `/operacion` | publica | — | 117 | 2 | — | ✅ | — |
| `/paquetes` | publica | — | 111 | 3 | — | ✅ | — |
| `/precios` | publica | — | 205 | 1 | — | ✅ | — |
| `/privacidad` | publica | — | 172 | 0 | — | ✅ | — |
| `/registro` | publica | ✅ | 396 | 3 | — | ✅ | — |
| `/seguridad` | publica | — | 175 | 1 | — | ✅ | — |
| `/setup` | publica | ✅ | 271 | 2 | — | ✅ | — |
| `/terminos` | publica | — | 178 | 0 | — | ✅ | — |
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

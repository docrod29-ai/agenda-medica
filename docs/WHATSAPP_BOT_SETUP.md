# WhatsApp Bot — Guía de Configuración

## Qué hace el bot

1. **Agenda citas automáticamente** — El paciente escribe por WhatsApp, el bot le muestra los días y horarios disponibles, el paciente elige, y la cita queda en el sistema sin que intervenga la secretaria.

2. **Responde preguntas frecuentes** — Horarios, costo, dirección, seguros, padecimientos que atiende el doctor.

3. **Avisa a la lista de espera** — Cuando se cancela una cita, el bot manda mensaje automático a los pacientes en lista de espera ofreciendo el horario libre.

---

## Paso 1 — Crear cuenta en Meta for Developers

1. Ve a https://developers.facebook.com
2. Inicia sesión con tu cuenta de Facebook
3. Haz clic en "Mis apps" → "Crear app"
4. Elige tipo: **Business**
5. Nombre de la app: `Agenda Dr. Rodríguez` (o el que prefieras)

---

## Paso 2 — Agregar WhatsApp a la app

1. En el dashboard de tu app, haz clic en **"Agregar un producto"**
2. Busca **WhatsApp** → clic en **"Configurar"**
3. Sigue el flujo para vincular tu **cuenta de Meta Business**

---

## Paso 3 — Obtener número de teléfono

Necesitas un número dedicado para el bot (no puede ser tu número personal de WhatsApp activo).

**Opciones:**
- Compra un número nuevo de tu operadora (Telcel, AT&T, Telmex)
- O usa el número de prueba que Meta asigna temporalmente (solo para testing)

En el panel de WhatsApp Business → **Números de teléfono** → agrega el número.

---

## Paso 4 — Obtener las credenciales

En tu app de Meta → **WhatsApp** → **Configuración de API**, encontrarás:

- **Phone Number ID** → cópialo
- **Access Token** → genera un token permanente (System User Token)

---

## Paso 5 — Agregar variables en Vercel

En la terminal del proyecto:

```bash
npx vercel env add WHATSAPP_API_TOKEN production
# Pega el Access Token cuando lo pida

npx vercel env add WHATSAPP_PHONE_NUMBER_ID production  
# Pega el Phone Number ID

npx vercel env add WHATSAPP_PROVIDER production
# Escribe: meta
```

Después vuelve a deployar:
```bash
npx vercel --prod --yes
```

---

## Paso 6 — Configurar el webhook en Meta

1. En tu app de Meta → **WhatsApp** → **Configuración** → **Webhooks**
2. Haz clic en **"Editar"** o **"Agregar webhook"**
3. Ingresa:
   - **URL del callback**: `https://agenda-medica-one.vercel.app/api/whatsapp/webhook`
   - **Token de verificación**: `agenda-medica-bot`
4. Haz clic en **"Verificar y guardar"**
5. En **"Campos de webhook"**, activa: `messages`

---

## Paso 7 — Configurar el FAQ del bot

1. En la app, ve a **Configuración** → **🤖 Bot FAQ**
2. Llena las 5 preguntas:
   - Padecimientos que atiende
   - Costo de consulta
   - Seguros aceptados
   - Cómo llegar
   - Información extra (opcional)
3. Haz clic en **"Guardar FAQ del bot"**

---

## Flujo del bot para el paciente

```
Paciente → "Hola"
Bot → Menú: 1) Agendar cita  2) Información  3) Cancelar

Paciente → "1"
Bot → ¿Cuál es su nombre completo?

Paciente → "Juan García"
Bot → Tipos de consulta (1-6)

Paciente → "1" (Primera vez)
Bot → Días disponibles próximos 5 días con horarios

Paciente → "2" (martes 27 mayo)
Bot → 8 horarios disponibles

Paciente → "3" (10:00 hrs)
Bot → Resumen: nombre, tipo, fecha, hora. ¿Confirma? SÍ/NO

Paciente → "SÍ"
Bot → ✅ Cita registrada. Te esperamos el martes a las 10:00 hrs.
Secretaria recibe notificación WhatsApp automática.
```

---

## Palabras clave FAQ que el bot detecta

El bot responde automáticamente si el paciente escribe palabras como:
- **Horarios**: "horario", "horas", "cuándo atienden"
- **Costo**: "cuánto cuesta", "precio", "cobran"  
- **Dirección**: "dónde están", "ubicación", "cómo llegar"
- **Seguros**: "seguro", "aseguradoras", "GNP"
- **Especialidad**: "qué atiende", "infectología", "enfermedades"

---

## Variables de entorno completas

| Variable | Descripción |
|----------|-------------|
| `WHATSAPP_API_TOKEN` | Access Token de Meta WhatsApp Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono en Meta |
| `WHATSAPP_WEBHOOK_TOKEN` | Token para verificar webhook (ya configurado: `agenda-medica-bot`) |
| `WHATSAPP_PROVIDER` | `meta` o `twilio` (default: `meta`) |

---

## Costo del servicio

- Meta WhatsApp Cloud API: **gratis las primeras 1,000 conversaciones/mes** por negocio
- Después: ~$0.06 USD por conversación (México)
- Para un consultorio pequeño/mediano: prácticamente gratuito

---

## Soporte

URL webhook actual: `https://agenda-medica-one.vercel.app/api/whatsapp/webhook`

import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Configuración de la app nativa (iOS + Android) que envuelve Ausculta.
 *
 * POR QUÉ `server.url` y no un bundle estático: Ausculta es Next.js con servidor
 * (App Router + rutas API + Firestore + auth). NO se puede exportar a HTML
 * estático, así que la app nativa carga la versión desplegada en Vercel. Aun así
 * es una app NATIVA de verdad: usa cámara nativa (fotos de antibiograma),
 * notificaciones push y el contenedor de Capacitor — no es "solo un navegador".
 *
 * Para desarrollo local, cambia `server.url` a tu IP:puerto (p. ej.
 * http://192.168.1.10:3000) o coméntalo para usar el bundle de `webDir`.
 */
const config: CapacitorConfig = {
  appId: 'mx.nexusmed.app',
  appName: 'Ausculta',
  // No se usa con server.url, pero Capacitor lo exige. `public/` sirve de respaldo.
  webDir: 'public',
  server: {
    url: 'https://agenda-medica-one.vercel.app',
    cleartext: false,
  },
  ios: {
    // Barra de estado y área segura respetadas por el WebView.
    contentInset: 'always',
    backgroundColor: '#0B0C0E',
  },
  android: {
    backgroundColor: '#0B0C0E',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#0B0C0E',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config

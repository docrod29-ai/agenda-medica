import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Instrument_Sans, Spline_Sans_Mono } from "next/font/google"
import "./globals.css"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"

/* Tipografía Cantera + Instrumento (Identity Lock V1, OD-2 resuelta):
   Instrument Sans = cuerpo/UI · Spline Sans Mono = numéricos clínicos ·
   Bricolage Grotesque = identidad/display, con freno (sólo títulos de
   identidad y encuentro). Las tres son OFL vía next/font (self-hosted). */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
})

const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  display: "swap",
})

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "NexusMED",
    template: "%s · NexusMED",
  },
  description: "El consultorio, conectado. Agenda, expediente, recetas y cobros en una sola herramienta.",
  applicationName: "NexusMED",
  appleWebApp: {
    capable: true,
    // Barra de estado por defecto (texto oscuro): sobre alabastro claro el
    // black-translucent de la era oscura dejaba la hora ilegible.
    statusBarStyle: "default",
    title: "NexusMED",
  },
  icons: {
    // SVG para navegadores que lo soportan + PNG de respaldo (Safari/Android no
    // pintan bien el SVG como ícono de app instalada).
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // apple-touch DEBE ser PNG opaco: iOS no soporta SVG y con transparencia lo
    // pinta en negro → ícono en blanco al "Agregar a inicio". Ahora sale la marca.
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "NexusMED",
    description: "El consultorio, conectado.",
    type: "website",
    locale: "es_MX",
  },
}

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // La supresión de hidratación en la etiqueta raíz se conserva como par del
    // ÚNICO mutador pre-hidratación que queda: la LIMPIEZA de `data-theme`
    // (abajo). Identidad única V14 (D-5): la app ya no tiene temas claro y
    // oscuro — el atributo que el anti-flicker de la era cobalto dejó
    // persistido en la etiqueta raíz se retira antes de pintar para que ninguna regla
    // vieja lo encuentre. La supresión alcanza SOLO los atributos de este
    // elemento (un nivel); un mismatch real en el árbol sigue avisando
    // (V10-BUG-001).
    <html lang="es" suppressHydrationWarning className={`${instrumentSans.variable} ${splineSansMono.variable} ${bricolage.variable} h-full`}>

      <head>
        {/*
          Kill-switch único por versión de deploy.
          Si el usuario tiene un SW viejo cacheando HTML/JS desactualizados,
          este script lo desregistra UNA SOLA VEZ y recarga la página.
          El flag se guarda en localStorage para no entrar en bucle.
          La versión se sube cuando hay deploys que rompen compatibilidad
          de routing (rutas nuevas, layouts movidos, etc.).
        */}
        {/*
          Identidad única Cantera+Instrumento: se limpia el data-theme que la
          era de dos temas dejó guardado, ANTES de la primera pintada.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try{ document.documentElement.removeAttribute('data-theme'); }catch(e){}
            })();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              try{
                var KEY='__am_sw_reset_v6';
                if(localStorage.getItem(KEY)) return;
                if(!('serviceWorker' in navigator)) { localStorage.setItem(KEY,'1'); return; }
                navigator.serviceWorker.getRegistrations().then(function(rs){
                  return Promise.all(rs.map(function(r){return r.unregister()}));
                }).then(function(){
                  return ('caches' in window)
                    ? caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))})
                    : null;
                }).then(function(){
                  localStorage.setItem(KEY,'1');
                  location.reload();
                }).catch(function(){ localStorage.setItem(KEY,'1'); });
              }catch(e){}
            })();`,
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}

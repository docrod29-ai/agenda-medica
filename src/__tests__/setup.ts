// Stub de variables de entorno para que Firebase no falle al inicializar en Node.
// Estos valores son falsos: nunca se conectan a Firebase real durante tests.
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= 'test-api-key'
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??= 'test.firebaseapp.com'
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= 'test-project'
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??= 'test.appspot.com'
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??= '0'
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= '1:0:web:0'

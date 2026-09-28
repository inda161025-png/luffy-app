// Service worker minimo, sin cache: solo existe para que el navegador ofrezca
// "instalar/agregar a inicio". El chequeo de version nueva de la app (ver
// js/17-menu-cierre.js) ya se encarga de avisar cuando hay codigo nuevo; un
// service worker que cachee pelearia con eso sirviendo copias viejas.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // sin respondWith: pasa todo directo a la red

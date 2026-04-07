// Firebase Messaging Service Worker — obsługuje push notifications w tle
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ",
  authDomain: "vbs-stats.firebaseapp.com",
  projectId: "vbs-stats",
  storageBucket: "vbs-stats.firebasestorage.app",
  messagingSenderId: "331217061974",
  appId: "1:331217061974:web:375c8931f0cda74ec413f7",
});

const messaging = firebase.messaging();

// Obsługa powiadomień w tle (gdy apka jest zamknięta/w tle)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  const opts = {
    body: body || "Nowa wiadomość",
    icon: icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.data?.roomId || "chat",
    data: { url: "https://fleetstat.pl", roomId: payload.data?.roomId },
    vibrate: [200, 100, 200],
  };
  self.registration.showNotification(title || "FleetStat Czat", opts);
});

// Kliknięcie w powiadomienie → otwórz apkę
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Jeśli apka jest otwarta — przełącz na nią
      for (const client of clientList) {
        if (client.url.includes("fleetstat.pl") && "focus" in client) return client.focus();
      }
      // Jeśli nie — otwórz nowe okno
      return clients.openWindow(e.notification.data?.url || "https://fleetstat.pl");
    })
  );
});
